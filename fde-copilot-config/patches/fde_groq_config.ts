/**
 * fde_groq_config.ts
 * ------------------
 * Groq provider configuration for the Google FDE II interview co-pilot.
 *
 * HOW TO USE:
 *   1. Find where Natively stores its AI provider config:
 *        grep -r "provider\|groq\|defaultModel" src/ --include="*.ts" -l
 *      Likely candidates:
 *        src/config/ai.ts | src/config/providers.ts | src/store/settingsStore.ts
 *
 *   2. Import FDE_GROQ_CONFIG and merge it into the provider settings, e.g.:
 *        import { FDE_GROQ_CONFIG, buildGroqClient } from './fde_groq_config';
 *
 *   3. Set your GROQ_API_KEY in the environment or via Settings → AI Providers → Groq.
 *      The key is read from process.env.GROQ_API_KEY by the Electron main process.
 *
 * DEPENDENCIES:
 *   - groq-sdk (already in Natively's package.json)
 *   - GROQ_API_KEY environment variable OR stored in Natively's encrypted key store
 */

import Groq from 'groq-sdk'; // already a Natively dependency

// ─── Model identifiers ────────────────────────────────────────────────────────

/** All Groq model IDs used by the FDE co-pilot, centralised for easy updates. */
export const GROQ_MODELS = {
  /**
   * Primary reasoning model.
   * Used for: RRK answers, system-design explanations, behavioural responses.
   * ~128k context window, best accuracy on the Groq platform.
   */
  text: 'llama-3.3-70b-versatile',

  /**
   * Fast hint model.
   * Used for: quick one-liner hints, autocomplete suggestions, low-latency nudges.
   * Typical TTFT < 200 ms on Groq.
   */
  fast: 'llama-3.1-8b-instant',

  /**
   * Vision / multimodal model.
   * Used for: screenshot OCR, whiteboard analysis, diagram interpretation.
   * Supports image inputs via the Groq vision API.
   */
  vision: 'meta-llama/llama-4-scout-17b-16e-instruct',
} as const;

export type GroqModelKey = keyof typeof GROQ_MODELS;
export type GroqModelId = (typeof GROQ_MODELS)[GroqModelKey];

// ─── Rate-limit envelope ──────────────────────────────────────────────────────

/**
 * Conservative rate-limit settings for the free / developer Groq tier.
 * Adjust upward if you have a paid plan with higher limits.
 *
 * Groq free tier (as of 2025-05):
 *   llama-3.3-70b-versatile : 30 req/min, 6 000 tokens/min
 *   llama-3.1-8b-instant    : 30 req/min, 6 000 tokens/min
 *   llama-4-scout           : 30 req/min, 6 000 tokens/min
 */
export const GROQ_RATE_LIMITS = {
  requestsPerMinute: 30,
  tokensPerMinute: 6_000,
  /** Extra requests allowed in a short burst before throttling kicks in. */
  burstAllowance: 5,
} as const;

// ─── Main config export ───────────────────────────────────────────────────────

export const FDE_GROQ_CONFIG = {
  /** AI provider identifier — matches Natively's internal provider registry key. */
  provider: 'groq' as const,

  /** Model selection per task type. */
  models: GROQ_MODELS,

  /** Rate-limiting envelope (used by the request queue / throttler). */
  rateLimiting: GROQ_RATE_LIMITS,

  /**
   * Enable server-sent-events streaming.
   * Natively renders tokens as they arrive, giving a "live typing" effect
   * that feels faster and lets you start reading before the full answer lands.
   */
  streamingEnabled: true,

  /**
   * Hard cap on output tokens per request.
   * 1 024 tokens ≈ ~750 words — enough for a thorough RRK answer or a
   * well-commented code solution without blowing the token budget.
   * Increase to 2 048 for system-design questions if needed.
   */
  maxTokens: 1_024,

  /**
   * Temperature for the primary text model.
   * 0.3 = focused, low-variance answers (good for technical accuracy).
   * Raise to 0.6 if you want more creative / varied phrasing.
   */
  temperature: 0.3,

  /**
   * Top-p nucleus sampling.
   * 0.9 keeps the distribution tight while allowing natural variation.
   */
  topP: 0.9,
} as const;

// ─── Groq client factory ──────────────────────────────────────────────────────

/**
 * Build a configured Groq SDK client.
 *
 * Call this once in the Electron main process and pass the instance down
 * via IPC handlers, or call it in the renderer if you expose the API key
 * through a context bridge.
 *
 * @param apiKey - Groq API key. Falls back to GROQ_API_KEY env var.
 * @returns Configured Groq client instance.
 *
 * @example
 *   const groq = buildGroqClient(store.get('groqApiKey'));
 */
export function buildGroqClient(apiKey?: string): Groq {
  const key = apiKey ?? process.env.GROQ_API_KEY;
  if (!key) {
    throw new Error(
      '[fde_groq_config] No Groq API key found. ' +
        'Set GROQ_API_KEY in your environment or add it via ' +
        'Settings → AI Providers → Groq.'
    );
  }
  return new Groq({ apiKey: key });
}

// ─── Typed request helpers ────────────────────────────────────────────────────

export interface FdeTextRequest {
  /** The user's question or prompt text. */
  userMessage: string;
  /** Optional system prompt override (defaults to fde_system_prompt.txt content). */
  systemPrompt?: string;
  /** Which model tier to use. Defaults to 'text'. */
  modelKey?: GroqModelKey;
}

export interface FdeVisionRequest extends FdeTextRequest {
  /** Base-64 encoded PNG/JPEG screenshot. */
  imageBase64: string;
  /** MIME type of the image. */
  mimeType?: 'image/png' | 'image/jpeg' | 'image/webp';
}

/**
 * Build a Groq chat completion request body for a text-only FDE query.
 * Pass the result directly to `groq.chat.completions.create(...)`.
 */
export function buildTextRequest(
  req: FdeTextRequest
): Groq.Chat.ChatCompletionCreateParamsStreaming {
  const modelKey = req.modelKey ?? 'text';
  return {
    model: GROQ_MODELS[modelKey],
    stream: FDE_GROQ_CONFIG.streamingEnabled,
    max_tokens: FDE_GROQ_CONFIG.maxTokens,
    temperature: FDE_GROQ_CONFIG.temperature,
    top_p: FDE_GROQ_CONFIG.topP,
    messages: [
      ...(req.systemPrompt
        ? [{ role: 'system' as const, content: req.systemPrompt }]
        : []),
      { role: 'user' as const, content: req.userMessage },
    ],
  };
}

/**
 * Build a Groq vision request body for screenshot analysis.
 * Pass the result directly to `groq.chat.completions.create(...)`.
 */
export function buildVisionRequest(
  req: FdeVisionRequest
): Groq.Chat.ChatCompletionCreateParamsStreaming {
  const mimeType = req.mimeType ?? 'image/png';
  return {
    model: GROQ_MODELS.vision,
    stream: FDE_GROQ_CONFIG.streamingEnabled,
    max_tokens: FDE_GROQ_CONFIG.maxTokens,
    temperature: FDE_GROQ_CONFIG.temperature,
    messages: [
      ...(req.systemPrompt
        ? [{ role: 'system' as const, content: req.systemPrompt }]
        : []),
      {
        role: 'user' as const,
        content: [
          {
            type: 'image_url' as const,
            image_url: {
              url: `data:${mimeType};base64,${req.imageBase64}`,
            },
          },
          {
            type: 'text' as const,
            text: req.userMessage,
          },
        ],
      },
    ],
  };
}

// ─── Simple token-bucket throttler ───────────────────────────────────────────

/**
 * Minimal token-bucket rate limiter for Groq requests.
 * Instantiate once and call `throttle()` before each API call.
 *
 * @example
 *   const limiter = new GroqThrottler();
 *   await limiter.throttle();
 *   const stream = await groq.chat.completions.create(buildTextRequest(req));
 */
export class GroqThrottler {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per ms

  constructor(
    requestsPerMinute = GROQ_RATE_LIMITS.requestsPerMinute,
    burstAllowance = GROQ_RATE_LIMITS.burstAllowance
  ) {
    this.maxTokens = requestsPerMinute + burstAllowance;
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
    this.refillRate = requestsPerMinute / 60_000; // per ms
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(
      this.maxTokens,
      this.tokens + elapsed * this.refillRate
    );
    this.lastRefill = now;
  }

  /** Resolves immediately if a token is available, otherwise waits. */
  async throttle(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    // Calculate wait time until next token is available
    const waitMs = Math.ceil((1 - this.tokens) / this.refillRate);
    await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
    this.tokens -= 1;
  }
}
