/**
 * useOrchestrator.ts — Renderer-side interview session orchestrator
 *
 * Owns the SessionState ref, drives the 5-agent pipeline, and exposes
 * a minimal surface to InterviewHUD:
 *
 *   submitUtterance(text)  — call on every new interviewer utterance
 *   hudRaw                 — current streaming HUD text (for parseHUDSections)
 *   isStreaming            — true while any agent is streaming
 *   agentType              — 'answer' | 'code' | 'rescue' | null
 *   sessionReady           — true after preflight completes
 *   startSession(context)  — call once with job description text
 *   resetSession()         — wipe state and start fresh
 *
 * Architecture notes (Rev 7):
 *   - SessionState lives in a useRef — never triggers re-renders on its own.
 *   - hudRaw is useState — triggers re-render on each streaming token.
 *   - activeQuestion is set as a narrow state update BEFORE conductor call.
 *   - urgency === 'rescue' overrides agentType from conductor.
 *   - agentTypeRef.current is set synchronously before stream invoke.
 *   - onAnswerDone / onCodeDone both call addTurn('candidate', full, ...) (v1 stand-in).
 *   - onRescueDone does NOT call addTurn.
 *   - Rescue timeout is stream-scoped (activeRescueStreamId === streamId).
 *   - Two-brain policy: this hook uses SessionState only; GlobalChatOverlay
 *     uses SessionTracker independently.
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import {
  createSession,
  mergeSessionDiff,
  addTurn,
  startCandidateTurn,
  serializeForTransport,
  type SessionState,
  type SessionDiff,
} from '../lib/session';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AgentType = 'answer' | 'code' | 'rescue' | null;

export interface OrchestratorState {
  hudRaw: string;
  isStreaming: boolean;
  agentType: AgentType;
  sessionReady: boolean;
  activeQuestion: string | null;
  error: string | null;
}

export interface OrchestratorActions {
  startSession: (context: string) => Promise<void>;
  submitUtterance: (utterance: string) => Promise<void>;
  resetSession: () => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useOrchestrator(): OrchestratorState & OrchestratorActions {
  // Session state lives in a ref — mutations don't trigger re-renders.
  const sessionRef = useRef<SessionState>(createSession());

  // Rendered state — only what the HUD needs to re-render.
  const [hudRaw, setHudRaw]               = useState('');
  const [isStreaming, setIsStreaming]      = useState(false);
  const [agentType, setAgentType]         = useState<AgentType>(null);
  const [sessionReady, setSessionReady]   = useState(false);
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);
  const [error, setError]                 = useState<string | null>(null);

  // Synchronous ref for agentType — set before stream invoke so the
  // done/error callbacks can read the correct value without stale closure.
  const agentTypeRef = useRef<AgentType>(null);

  // Rescue timeout handle — scoped to the active rescue stream.
  const rescueTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Listener cleanup registry ─────────────────────────────────────────────
  // We register listeners once per stream and clean them up on done/error.
  const cleanupRef = useRef<Array<() => void>>([]);

  const registerCleanup = (fn: () => void) => {
    cleanupRef.current.push(fn);
  };

  const runCleanup = () => {
    cleanupRef.current.forEach((fn) => fn());
    cleanupRef.current = [];
  };

  // Clean up all listeners on unmount.
  useEffect(() => {
    return () => {
      runCleanup();
      if (rescueTimeoutRef.current) clearTimeout(rescueTimeoutRef.current);
    };
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const alphaAPI = () => (window as any).alphaAPI;

  const mutateSession = (diff: SessionDiff) => {
    sessionRef.current = mergeSessionDiff(sessionRef.current, diff);
  };

  // ── startSession ──────────────────────────────────────────────────────────

  const startSession = useCallback(async (context: string) => {
    setError(null);
    setSessionReady(false);

    // Reset session state
    sessionRef.current = createSession();

    try {
      const result = await alphaAPI().preflight(context);
      if (result?.error) throw new Error(result.error);

      mutateSession({
        briefing:     result.briefing,
        questionBank: result.questionBank,
        phasePlan:    result.phasePlan,
        phase:        'intro',
      });

      setSessionReady(true);
    } catch (e: any) {
      setError(`Preflight failed: ${e?.message ?? 'unknown error'}`);
    }
  }, []);

  // ── submitUtterance ───────────────────────────────────────────────────────

  const submitUtterance = useCallback(async (utterance: string) => {
    if (!utterance.trim()) return;
    if (isStreaming) return; // gate: useInterviewGate enforces this upstream

    setError(null);

    // 1. Add interviewer turn to session history (3-arg form per Rev 7)
    mutateSession(addTurn(sessionRef.current, 'interviewer', utterance));

    // 2. Set activeQuestion BEFORE conductor call (Rev 7 requirement)
    mutateSession({ activeQuestion: utterance });
    setActiveQuestion(utterance);

    // 3. Start candidate turn (clears answerDraft, monitorFlags, resets timer)
    mutateSession(startCandidateTurn(sessionRef.current));

    // 4. Run conductor
    let conductorResult: {
      phase?: string;
      phaseChanged?: boolean;
      matchedQuestionIndex?: number | null;
      agentType?: string;
      conductorPlan?: string;
      urgency?: string;
      error?: string;
    };

    try {
      conductorResult = await alphaAPI().conductor(
        serializeForTransport(sessionRef.current),
        utterance
      );
      if (conductorResult?.error) throw new Error(conductorResult.error);
    } catch (e: any) {
      setError(`Conductor failed: ${e?.message ?? 'unknown error'}`);
      return;
    }

    // 5. Apply conductor diff to session
    const phaseUpdate: SessionDiff = {};
    if (conductorResult.phaseChanged && conductorResult.phase) {
      phaseUpdate.phase = conductorResult.phase as SessionState['phase'];
    }
    mutateSession({ ...phaseUpdate, conductorStep: 'answering' });

    // 6. Normalize agent type — urgency === 'rescue' overrides agentType
    const rawAgentType = conductorResult.agentType ?? 'answer';
    const resolvedAgent: AgentType =
      conductorResult.urgency === 'rescue'
        ? 'rescue'
        : (rawAgentType as AgentType);

    const conductorPlan = conductorResult.conductorPlan ?? 'Answer the question directly.';

    // 7. Resolve matched question from bank
    const matchedIdx = conductorResult.matchedQuestionIndex;
    const matchedQuestion =
      matchedIdx !== null &&
      matchedIdx !== undefined &&
      matchedIdx >= 0 &&
      matchedIdx < sessionRef.current.questionBank.length
        ? (sessionRef.current.questionBank[matchedIdx] as {
            question: string;
            skeleton: string;
            keyMechanism: string;
          })
        : null;

    // 8. Set agentTypeRef synchronously BEFORE stream invoke
    agentTypeRef.current = resolvedAgent;
    setAgentType(resolvedAgent);
    setIsStreaming(true);
    setHudRaw('');

    // 9. Dispatch to correct streaming agent
    if (resolvedAgent === 'answer') {
      await streamAnswerAgent(utterance, conductorPlan, matchedQuestion);
    } else if (resolvedAgent === 'code') {
      await streamCodeAgent(utterance, conductorPlan);
    } else if (resolvedAgent === 'rescue') {
      await streamRescueAgent(utterance, conductorPlan, matchedQuestion);
    } else {
      // pivot / unknown — fall back to answer agent
      await streamAnswerAgent(utterance, conductorPlan, matchedQuestion);
    }
  }, [isStreaming]);

  // ── Answer stream ─────────────────────────────────────────────────────────

  const streamAnswerAgent = async (
    utterance: string,
    conductorPlan: string,
    matchedQuestion: { question: string; skeleton: string; keyMechanism: string } | null
  ) => {
    let accumulated = '';

    const offToken = alphaAPI().onAnswerToken((token: string) => {
      accumulated += token;
      setHudRaw(accumulated);
    });

    const offDone = alphaAPI().onAnswerDone(() => {
      runCleanup();
      setIsStreaming(false);
      // v1 stand-in: record candidate turn with full accumulated response
      mutateSession(
        addTurn(sessionRef.current, 'candidate', accumulated, 'answer', accumulated)
      );
      mutateSession({ conductorStep: 'monitoring', answerDraft: accumulated });
    });

    const offError = alphaAPI().onAnswerError((err: string) => {
      runCleanup();
      setIsStreaming(false);
      setError(`Answer stream error: ${err}`);
    });

    registerCleanup(offToken);
    registerCleanup(offDone);
    registerCleanup(offError);

    // Invoke the stream (tokens arrive via events registered above)
    await alphaAPI().streamAnswer(
      serializeForTransport(sessionRef.current),
      utterance,
      conductorPlan,
      matchedQuestion
    );
  };

  // ── Code stream ───────────────────────────────────────────────────────────

  const streamCodeAgent = async (utterance: string, conductorPlan: string) => {
    let accumulated = '';

    const offToken = alphaAPI().onCodeToken((token: string) => {
      accumulated += token;
      setHudRaw(accumulated);
    });

    const offDone = alphaAPI().onCodeDone(() => {
      runCleanup();
      setIsStreaming(false);
      // v1 stand-in: record candidate turn with full accumulated response
      mutateSession(
        addTurn(sessionRef.current, 'candidate', accumulated, 'code', accumulated)
      );
      mutateSession({ conductorStep: 'monitoring', answerDraft: accumulated });
    });

    const offError = alphaAPI().onCodeError((err: string) => {
      runCleanup();
      setIsStreaming(false);
      setError(`Code stream error: ${err}`);
    });

    registerCleanup(offToken);
    registerCleanup(offDone);
    registerCleanup(offError);

    await alphaAPI().streamCode(
      serializeForTransport(sessionRef.current),
      utterance,
      conductorPlan
    );
  };

  // ── Rescue stream ─────────────────────────────────────────────────────────

  const streamRescueAgent = async (
    utterance: string,
    conductorPlan: string,
    matchedQuestion: { question: string; skeleton: string; keyMechanism: string } | null
  ) => {
    // Capture stream ID for timeout scoping
    const myRescueStreamId = Date.now();
    let accumulated = '';

    // 30-second rescue timeout — scoped to this stream
    rescueTimeoutRef.current = setTimeout(() => {
      // Only fire if this stream is still active (no newer rescue started)
      if (agentTypeRef.current === 'rescue') {
        runCleanup();
        setIsStreaming(false);
        if (accumulated) {
          setHudRaw(accumulated); // keep partial result visible
        } else {
          setError('Rescue timed out — no response received');
        }
      }
    }, 30000);

    const offToken = alphaAPI().onRescueToken((token: string) => {
      accumulated += token;
      setHudRaw(accumulated);
    });

    const offDone = alphaAPI().onRescueDone(() => {
      if (rescueTimeoutRef.current) clearTimeout(rescueTimeoutRef.current);
      runCleanup();
      setIsStreaming(false);
      // Rev 7: onRescueDone does NOT call addTurn
      mutateSession({ conductorStep: 'idle' });
    });

    const offError = alphaAPI().onRescueError((err: string) => {
      if (rescueTimeoutRef.current) clearTimeout(rescueTimeoutRef.current);
      runCleanup();
      setIsStreaming(false);
      setError(`Rescue stream error: ${err}`);
    });

    registerCleanup(offToken);
    registerCleanup(offDone);
    registerCleanup(offError);

    await alphaAPI().streamRescue(
      serializeForTransport(sessionRef.current),
      utterance,
      conductorPlan,
      matchedQuestion
    );
  };

  // ── resetSession ──────────────────────────────────────────────────────────

  const resetSession = useCallback(() => {
    runCleanup();
    if (rescueTimeoutRef.current) clearTimeout(rescueTimeoutRef.current);
    sessionRef.current = createSession();
    setHudRaw('');
    setIsStreaming(false);
    setAgentType(null);
    setSessionReady(false);
    setActiveQuestion(null);
    setError(null);
    agentTypeRef.current = null;
  }, []);

  return {
    hudRaw,
    isStreaming,
    agentType,
    sessionReady,
    activeQuestion,
    error,
    startSession,
    submitUtterance,
    resetSession,
  };
}
