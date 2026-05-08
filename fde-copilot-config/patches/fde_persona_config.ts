/**
 * fde_persona_config.ts
 * ---------------------
 * Google FDE II Interview Persona Mode for Natively AI Assistant
 *
 * HOW TO USE:
 *   1. Find the persona/modes config file in the Natively repo:
 *        grep -r "Technical Interview\|PersonaMode\|modes\s*=" src/ --include="*.ts" -l
 *      Likely candidates: src/config/modes.ts | src/config/personas.ts | src/store/modesStore.ts
 *
 *   2. Import this const and push it into the existing modes array, e.g.:
 *        import { FDE_PERSONA_MODE } from './fde_persona_config';
 *        export const PERSONA_MODES = [...existingModes, FDE_PERSONA_MODE];
 *
 *   3. If Natively uses a Zustand / Redux store, add FDE_PERSONA_MODE to the
 *      initial state array so it appears in the UI dropdown on first launch.
 *
 * DEPENDENCIES:
 *   - fde_system_prompt.txt  → loaded via Settings → Custom Context
 *   - fde_reference_context.txt → loaded via Settings → Reference Files
 */

// ─── Type augmentation (add to existing PersonaMode interface if present) ────
export interface NoteTemplate {
  sections: string[];
}

export interface PersonaHotkeys {
  rrkMode: string;
  codeMode: string;
  screenshot: string;
  hide: string;
}

export interface PersonaMode {
  id: string;
  name: string;
  description: string;
  icon: string;
  systemPromptOverride: boolean;
  noteTemplate: NoteTemplate;
  hotkeys: PersonaHotkeys;
  defaultModel: string;
  responseLanguage: string;
  antiChatbot: boolean;
}

// ─── Google FDE II Persona Definition ────────────────────────────────────────

export const FDE_PERSONA_MODE: PersonaMode = {
  // Unique identifier — used as the key in settings storage
  id: 'google-fde-ii',

  // Display name shown in the Natively mode selector dropdown
  name: 'Google FDE II',

  // Subtitle shown below the name in the UI
  description: 'Google Cloud Forward Deployed Engineer II GenAI Interview — May 19',

  // Emoji icon rendered next to the mode name in the selector
  icon: '🎯',

  // When true, Natively will use fde_system_prompt.txt (loaded via Custom Context)
  // instead of the built-in default system prompt for this mode.
  systemPromptOverride: true,

  // Dynamic note template — each section becomes a labelled field in the
  // Notes panel so you can jot structured observations during the interview.
  noteTemplate: {
    sections: [
      'Question Type',       // e.g. RRK | Coding | Behavioral | System Design
      'Sub-Topic',           // e.g. RAG, Vector Search, GKE, BigQuery ML
      'Key Points',          // bullet points of your answer
      'GCP Products Named',  // track which products you mentioned
      'Follow-up to Prepare' // anything you want to review after the call
    ],
  },

  // Global hotkeys registered by Electron's globalShortcut API.
  // These work even when Natively is hidden / not focused.
  hotkeys: {
    // Activate RRK (Role / Responsibility / Knowledge) answer mode
    rrkMode: 'CommandOrControl+Shift+R',

    // Activate Coding problem mode (algorithm + complexity analysis)
    codeMode: 'CommandOrControl+Shift+C',

    // Capture a screenshot of the active window and send to vision model
    screenshot: 'CommandOrControl+Shift+S',

    // Toggle overlay visibility (stealth — hides from screen share)
    hide: 'CommandOrControl+H',
  },

  // Primary model for RRK / long-form reasoning answers (Groq)
  defaultModel: 'llama-3.3-70b-versatile',

  // Force English responses regardless of system locale
  responseLanguage: 'en-US',

  // Suppress filler phrases ("Certainly!", "Great question!", "Of course!")
  // so responses read as direct, professional bullet points.
  antiChatbot: true,
} as const;

// ─── Anti-chatbot filter (used by the response post-processor) ───────────────

/**
 * Phrases to strip from the beginning of any AI response when
 * antiChatbot === true.  Add more as needed.
 */
export const ANTI_CHATBOT_PHRASES: readonly string[] = [
  "Certainly!",
  "Certainly,",
  "Great question!",
  "Great question,",
  "Of course!",
  "Of course,",
  "Absolutely!",
  "Absolutely,",
  "Sure!",
  "Sure,",
  "Happy to help!",
  "I'd be happy to",
  "I'd be glad to",
  "That's a great",
  "That's an excellent",
  "Excellent question",
] as const;

/**
 * Strip leading filler phrases from an AI response string.
 * Call this in the streaming response handler when the active persona
 * has antiChatbot === true.
 *
 * @example
 *   const clean = stripFillerPhrases("Certainly! RAG stands for...");
 *   // → "RAG stands for..."
 */
export function stripFillerPhrases(response: string): string {
  let cleaned = response.trimStart();
  for (const phrase of ANTI_CHATBOT_PHRASES) {
    if (cleaned.startsWith(phrase)) {
      cleaned = cleaned.slice(phrase.length).trimStart();
      // Remove a leading sentence separator if present
      if (cleaned.startsWith('.') || cleaned.startsWith(',')) {
        cleaned = cleaned.slice(1).trimStart();
      }
      break; // only strip one leading phrase
    }
  }
  return cleaned;
}

// ─── Mode registration helper ─────────────────────────────────────────────────

/**
 * Call this function from the Natively modes initialisation code to register
 * the FDE persona without mutating the original modes array.
 *
 * @param existingModes - The array exported by Natively's own modes config
 * @returns A new array with FDE_PERSONA_MODE appended
 *
 * @example
 *   // In src/config/modes.ts (or wherever PERSONA_MODES is defined):
 *   import { registerFdePersona } from './fde_persona_config';
 *   export const PERSONA_MODES = registerFdePersona(BASE_PERSONA_MODES);
 */
export function registerFdePersona<T extends { id: string }>(
  existingModes: T[]
): Array<T | PersonaMode> {
  // Avoid duplicate registration on hot-reload
  if (existingModes.some((m) => m.id === FDE_PERSONA_MODE.id)) {
    return existingModes;
  }
  return [...existingModes, FDE_PERSONA_MODE];
}
