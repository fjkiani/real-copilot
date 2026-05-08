# Applying FDE Co-Pilot Patches to Natively

> **Goal:** Customise a cloned Natively repo to act as a Google FDE II interview co-pilot.  
> **Time required:** ~20 minutes on a fresh clone.

---

## Prerequisites

```bash
# 1. Clone Natively (replace with the actual repo URL)
git clone https://github.com/<org>/natively.git natively-fde
cd natively-fde

# 2. Install dependencies
npm install          # or: pnpm install / yarn

# 3. Copy the FDE patch files into the repo
cp /path/to/patches/fde_persona_config.ts  src/config/
cp /path/to/patches/fde_groq_config.ts     src/config/
```

---

## Step 1 — Locate the Persona Modes File

Natively stores its interview/persona modes in one of these files.  
Run the search to find the exact path:

```bash
# Search for the modes definition
grep -r "Technical Interview\|PersonaMode\|PERSONA_MODES\|modes\s*=" \
     src/ --include="*.ts" --include="*.tsx" -l
```

**Common locations (check in this order):**

| Priority | Path | What to look for |
|----------|------|-----------------|
| 1 | `src/config/modes.ts` | `export const MODES` or `export const PERSONA_MODES` |
| 2 | `src/config/personas.ts` | Array of persona objects |
| 3 | `src/store/modesStore.ts` | Zustand store with initial modes array |
| 4 | `src/constants/modes.ts` | Enum or const array |
| 5 | `src/renderer/config/modes.ts` | Renderer-side config |

Once found, note the **exact export name** of the modes array (e.g. `PERSONA_MODES`, `MODES`, `interviewModes`).

---

## Step 2 — Register the FDE Persona Mode

Open the modes file you found in Step 1 and make **two edits**:

### 2a. Add the import at the top of the file

```typescript
// Add after existing imports
import { registerFdePersona } from './fde_persona_config';
```

### 2b. Wrap the existing modes array export

**Before:**
```typescript
export const PERSONA_MODES = [
  // ... existing modes ...
];
```

**After:**
```typescript
import { registerFdePersona } from './fde_persona_config';

const BASE_PERSONA_MODES = [
  // ... existing modes (unchanged) ...
];

// FDE persona is appended without mutating the original array
export const PERSONA_MODES = registerFdePersona(BASE_PERSONA_MODES);
```

> **Alternative (manual):** If you prefer not to use the helper, simply copy the
> `FDE_PERSONA_MODE` object from `fde_persona_config.ts` and paste it as the last
> element of the existing array.

---

## Step 3 — Set Groq as the Default AI Provider

### 3a. Find the provider settings file

```bash
grep -r "defaultProvider\|aiProvider\|provider.*groq\|groq.*provider" \
     src/ --include="*.ts" --include="*.tsx" -l
```

**Common locations:**

| Path | Key to change |
|------|--------------|
| `src/config/ai.ts` | `defaultProvider: 'groq'` |
| `src/store/settingsStore.ts` | `provider` field in initial state |
| `src/config/settings.ts` | `AI_PROVIDER` constant |
| `electron/main/config.ts` | `provider` in AI config block |

### 3b. Import and apply the Groq config

```typescript
// In the provider settings file:
import { FDE_GROQ_CONFIG, buildGroqClient } from './fde_groq_config';

// Replace or extend the existing provider config:
export const AI_CONFIG = {
  ...existingConfig,
  ...FDE_GROQ_CONFIG,
};
```

### 3c. Register the Groq client in the Electron main process

```typescript
// In electron/main/index.ts (or wherever IPC handlers are set up):
import { buildGroqClient } from '../config/fde_groq_config';

const groqClient = buildGroqClient(
  store.get('groqApiKey') as string | undefined
);
```

### 3d. Set the API key via environment variable (alternative)

```bash
# In your shell profile (~/.zshrc or ~/.bashrc):
export GROQ_API_KEY="gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# Then restart the terminal and launch Natively:
npm start
```

---

## Step 4 — Load `fde_reference_context.txt` as a Reference File

This file contains GCP product summaries, RAG patterns, and FDE-specific knowledge.

**UI path:**

```
Natively → Settings (⚙️) → Reference Files → [ + Upload File ]
  → Select: fde_reference_context.txt
  → Click: Save / Apply
```

**What this does:** The file's content is prepended to every prompt as background
context, giving the AI grounding in GCP products and FDE interview patterns without
you having to re-paste it each session.

**Verify it loaded:** In the main chat, type:
```
What GCP products are in my reference context?
```
You should see a list of products from the file.

---

## Step 5 — Load `fde_system_prompt.txt` as Custom Context

This is the master instruction set that shapes how the AI responds during the interview.

**UI path:**

```
Natively → Settings (⚙️) → Custom Context → [ text area ]
  → Open fde_system_prompt.txt in a text editor
  → Select All (Cmd+A) → Copy (Cmd+C)
  → Paste into the Custom Context text area (Cmd+V)
  → Click: Save
```

**Verify it loaded:** Switch to the "Google FDE II" persona mode (Step 2 must be
complete). The AI's tone should shift to direct, bullet-point technical answers
without filler phrases.

---

## Step 6 — Hotkeys Reference

These hotkeys are registered globally by Electron (work even when Natively is hidden):

| Action | macOS | Windows / Linux |
|--------|-------|-----------------|
| **RRK answer mode** | `Cmd+Shift+R` | `Ctrl+Shift+R` |
| **Coding problem mode** | `Cmd+Shift+C` | `Ctrl+Shift+C` |
| **Screenshot + analyze** | `Cmd+Shift+S` | `Ctrl+Shift+S` |
| **Toggle overlay visibility** | `Cmd+H` | `Ctrl+H` |

> **Note:** If any hotkey conflicts with an existing system shortcut, change it in
> `fde_persona_config.ts` → `hotkeys` object, then rebuild (`npm run build`).

### Verifying hotkeys are registered

```bash
# In the Electron main process log, look for:
grep -i "globalShortcut\|hotkey\|shortcut" electron/main/index.ts
```

If Natively uses a hotkey registration file, add the FDE hotkeys there:

```typescript
// Example — adapt to Natively's actual hotkey registration pattern:
import { globalShortcut } from 'electron';
import { FDE_PERSONA_MODE } from '../config/fde_persona_config';

const { hotkeys } = FDE_PERSONA_MODE;

globalShortcut.register(hotkeys.rrkMode,    () => activateMode('rrk'));
globalShortcut.register(hotkeys.codeMode,   () => activateMode('code'));
globalShortcut.register(hotkeys.screenshot, () => captureAndAnalyze());
globalShortcut.register(hotkeys.hide,       () => toggleOverlay());
```

---

## Step 7 — Interview Day Workflow (T-10 Minutes)

1. **Launch Natively** — `npm start` or double-click the built app.
2. **Confirm Groq key** — Settings → AI Providers → Groq → green ✅ checkmark.
3. **Select persona** — Mode selector → "Google FDE II" (🎯).
4. **Verify reference file** — Settings → Reference Files → `fde_reference_context.txt` listed.
5. **Verify custom context** — Settings → Custom Context → text is present (not blank).
6. **Test screenshot** — Press `Cmd+Shift+S` on any window; confirm the AI describes it.
7. **Test RRK mode** — Type `RRK: What is RAG?` → expect a 3-bullet answer in < 3 s.
8. **Test Code mode** — Type `CODE: Two Sum` → expect pseudocode + complexity.
9. **Set opacity** — Drag overlay opacity slider to ~85%.
10. **Test hide/show** — `Cmd+H` → overlay disappears → `Cmd+H` → reappears.
11. **Position overlay** — Move to secondary monitor or bottom-right corner of primary.
12. **Stealth check** — Start a Google Meet test call; confirm overlay is NOT visible in the shared screen.
13. **Close distractions** — Quit Slack, email, music apps. Keep only Meet + Natively open.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Google FDE II" not in mode selector | Check Step 2 — confirm `registerFdePersona` is called and the app was rebuilt (`npm run build && npm start`) |
| Groq API errors (401) | Re-enter API key: Settings → AI Providers → Groq → paste key → Save |
| Groq rate limit (429) | Reduce burst: lower `burstAllowance` in `fde_groq_config.ts` → `GROQ_RATE_LIMITS` |
| Screenshot hotkey conflicts with macOS | Change `screenshot` key in `fde_persona_config.ts` to `CommandOrControl+Shift+G` |
| Overlay visible in screen share | Enable Natively's built-in stealth/window-exclusion mode (check Natively docs for `setContentProtection(true)`) |
| Vision model not available | Verify `meta-llama/llama-4-scout-17b-16e-instruct` is enabled on your Groq account at console.groq.com |

---

## Quick Rebuild After Changes

```bash
# After editing any TypeScript config file:
npm run build          # compile TypeScript
npm start              # launch Electron app

# Or in dev mode (hot-reload):
npm run dev
```

---

*Last updated: May 2025 — Google FDE II Interview Co-Pilot v1.0*
