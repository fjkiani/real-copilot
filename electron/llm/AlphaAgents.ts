/**
 * AlphaAgents.ts — Streaming agent functions for the interview copilot.
 *
 * Each function is an async generator that yields string tokens.
 * Callers iterate with `for await (const token of streamAnswer(...))`.
 *
 * Provider mapping (per Rev 7 plan):
 *   conductor  → Groq  llama-3.3-70b-versatile  temp 0.1  max 200
 *   preflight  → Gemini gemini-3.1-flash-lite-preview  temp 0.3  max 4000
 *   answer     → Gemini gemini-3.1-flash-lite-preview  temp 0.3  max 600
 *   code       → Groq  llama-3.3-70b-versatile  temp 0.1  max 1200
 *   rescue     → Claude claude-sonnet-4-6  temp 0.5  max 800
 */

import Groq from 'groq-sdk';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import type { SessionState } from '../../src/lib/session';
import { buildConversationContext } from '../../src/lib/session';
import {
  ALPHA_PREFLIGHT_PROMPT,
  ALPHA_CONDUCTOR_PROMPT,
  ALPHA_ANSWER_PROMPT,
  ALPHA_CODE_PROMPT,
  ALPHA_RESCUE_PROMPT,
} from './prompts';

// ── Model constants ───────────────────────────────────────────────────────────
const GROQ_ALPHA_MODEL   = 'llama-3.3-70b-versatile';
const GEMINI_ALPHA_MODEL = 'gemini-3.1-flash-lite-preview';
const CLAUDE_ALPHA_MODEL = 'claude-sonnet-4-6';

// ── Preflight (JSON, not streaming) ──────────────────────────────────────────

export interface PreflightResult {
  briefing: string;
  questionBank: unknown[];
  phasePlan: unknown[];
}

export async function runPreflight(
  geminiClient: GoogleGenAI,
  context: string
): Promise<PreflightResult> {
  const userMessage = `Job description / role context:\n\n${context.slice(0, 3000)}`;

  const response = await geminiClient.models.generateContent({
    model: GEMINI_ALPHA_MODEL,
    contents: [{ role: 'user', parts: [{ text: `${ALPHA_PREFLIGHT_PROMPT}\n\n${userMessage}` }] }],
    config: {
      maxOutputTokens: 4000,
      temperature: 0.3,
    },
  });

  // Extract text from response
  let raw = '';
  const candidate = (response as any).candidates?.[0];
  if (candidate?.content?.parts?.[0]?.text) {
    raw = candidate.content.parts[0].text;
  } else if (typeof (response as any).text === 'function') {
    raw = (response as any).text();
  } else if (typeof (response as any).text === 'string') {
    raw = (response as any).text;
  }

  // Strip markdown fences if present
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

  let parsed: { briefing: string; questionBank: unknown[]; phasePlan: unknown[] };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Preflight: model returned invalid JSON. Preview: ${cleaned.slice(0, 200)}`);
  }

  if (
    !parsed.briefing ||
    !Array.isArray(parsed.questionBank) ||
    !Array.isArray(parsed.phasePlan)
  ) {
    throw new Error('Preflight: model returned incomplete structure');
  }

  if (parsed.questionBank.length !== 12) {
    throw new Error(
      `Preflight: questionBank must have exactly 12 entries, got ${parsed.questionBank.length}`
    );
  }

  return {
    briefing: parsed.briefing,
    questionBank: parsed.questionBank,
    phasePlan: parsed.phasePlan,
  };
}

// ── Conductor (JSON, not streaming) ──────────────────────────────────────────

export interface ConductorResult {
  phase: string;
  phaseChanged: boolean;
  matchedQuestionIndex: number | null;
  agentType: string;
  conductorPlan: string;
  urgency: string;
}

export async function runConductor(
  groqClient: Groq,
  session: SessionState,
  utterance: string
): Promise<ConductorResult> {
  const userMessage = `
CURRENT SESSION STATE:
- Phase: ${session.phase}
- Active question: ${session.activeQuestion ?? 'none'}
- Monitor flags this turn: ${session.monitorFlags.map((f) => f.type).join(', ') || 'none'}
- Candidate speaking seconds: ${Math.round((Date.now() - session.currentTurnStartedAt) / 1000)}

QUESTION BANK (${session.questionBank.length} entries):
${session.questionBank
  .map((q: any, i: number) => `[${i}] ${q.question} (phase: ${q.phase}, mechanism: ${q.keyMechanism})`)
  .join('\n')}

PHASE PLAN:
${session.phasePlan
  .map((p: any) => `${p.phase}: triggers=[${p.triggerKeywords.join(', ')}]`)
  .join('\n')}

LATEST INTERVIEWER UTTERANCE:
"${utterance}"

RECENT CONVERSATION (last 4 turns):
${session.turnHistory.slice(-4).map((t) => `${t.speaker}: ${t.text}`).join('\n')}
`.trim();

  const completion = await groqClient.chat.completions.create({
    model: GROQ_ALPHA_MODEL,
    messages: [
      { role: 'system', content: ALPHA_CONDUCTOR_PROMPT },
      { role: 'user', content: userMessage },
    ],
    stream: false,
    temperature: 0.1,
    max_tokens: 200,
  });

  const raw = completion.choices[0]?.message?.content ?? '';

  // Robust JSON extraction — strip fences, find first { ... }
  const fenceStripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  const jsonMatch = fenceStripped.match(/\{[\s\S]*\}/);
  const jsonStr = jsonMatch ? jsonMatch[0] : fenceStripped;

  let parsed: ConductorResult;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    console.warn('[AlphaAgents] conductor JSON parse failed, using fallback. Raw:', raw.slice(0, 200));
    return {
      phase: session.phase,
      phaseChanged: false,
      matchedQuestionIndex: null,
      agentType: 'answer',
      conductorPlan: 'Answer the question directly. Lead with the core mechanism.',
      urgency: 'normal',
    };
  }

  return parsed;
}

// ── Answer agent (streaming) ──────────────────────────────────────────────────

export async function* streamAnswer(
  geminiClient: GoogleGenAI,
  session: SessionState,
  utterance: string,
  conductorPlan: string,
  matchedQuestion: { question: string; skeleton: string; keyMechanism: string } | null
): AsyncGenerator<string, void, unknown> {
  const conversationContext = buildConversationContext(session, 8);

  const userMessage = `
CONDUCTOR PLAN: ${conductorPlan}

${
  matchedQuestion
    ? `MATCHED QUESTION FROM BANK:
Question: ${matchedQuestion.question}
Key mechanism: ${matchedQuestion.keyMechanism}
Answer skeleton: ${matchedQuestion.skeleton}
`
    : ''
}
INTERVIEW PHASE: ${session.phase}

RECENT CONVERSATION:
${conversationContext}

INTERVIEWER JUST ASKED: "${utterance}"

Generate the HUD response now. Follow the 4-section format exactly.
`.trim();

  const fullPrompt = `${ALPHA_ANSWER_PROMPT}\n\n${userMessage}`;

  const streamResult = await geminiClient.models.generateContentStream({
    model: GEMINI_ALPHA_MODEL,
    contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
    config: {
      maxOutputTokens: 600,
      temperature: 0.3,
    },
  });

  // @ts-ignore — stream shape varies across SDK versions
  const stream = streamResult.stream || streamResult;

  for await (const chunk of stream) {
    let chunkText = '';
    if (typeof chunk.text === 'function') {
      chunkText = chunk.text();
    } else if (typeof chunk.text === 'string') {
      chunkText = chunk.text;
    } else if (chunk.candidates?.[0]?.content?.parts?.[0]?.text) {
      chunkText = chunk.candidates[0].content.parts[0].text;
    }
    if (chunkText) yield chunkText;
  }
}

// ── Code agent (streaming) ────────────────────────────────────────────────────

export async function* streamCode(
  groqClient: Groq,
  session: SessionState,
  utterance: string,
  conductorPlan: string
): AsyncGenerator<string, void, unknown> {
  const conversationContext = buildConversationContext(session, 6);

  const userMessage = `
CONDUCTOR PLAN: ${conductorPlan}

INTERVIEW PHASE: ${session.phase}

RECENT CONVERSATION:
${conversationContext}

CODING PROBLEM STATED: "${utterance}"

Generate the guided solve HUD now. Follow the 4-section format exactly.
`.trim();

  const stream = await groqClient.chat.completions.create({
    model: GROQ_ALPHA_MODEL,
    messages: [
      { role: 'system', content: ALPHA_CODE_PROMPT },
      { role: 'user', content: userMessage },
    ],
    stream: true,
    temperature: 0.1,
    max_tokens: 1200,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) yield content;
  }
}

// ── Rescue agent (streaming) ──────────────────────────────────────────────────

export async function* streamRescue(
  claudeClient: Anthropic,
  session: SessionState,
  utterance: string,
  conductorPlan: string,
  matchedQuestion: { question: string; skeleton: string; keyMechanism: string } | null
): AsyncGenerator<string, void, unknown> {
  const conversationContext = buildConversationContext(session, 6);

  const userMessage = `
CONDUCTOR PLAN: ${conductorPlan}

${
  matchedQuestion
    ? `MATCHED QUESTION FROM BANK:
Question: ${matchedQuestion.question}
Key mechanism: ${matchedQuestion.keyMechanism}
Answer skeleton: ${matchedQuestion.skeleton}
`
    : ''
}
INTERVIEW PHASE: ${session.phase}

RECENT CONVERSATION:
${conversationContext}

CANDIDATE IS STUCK ON: "${utterance}"

Generate the rescue response now. Follow the format exactly.
`.trim();

  const stream = await claudeClient.messages.stream({
    model: CLAUDE_ALPHA_MODEL,
    max_tokens: 800,
    system: ALPHA_RESCUE_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield event.delta.text;
    }
  }
}
