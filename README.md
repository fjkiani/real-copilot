# real-copilot

**Live AI co-pilot for the Google Cloud FDE II (GenAI) interview — May 19, Block B (1:00–3:15 PM ET)**

Forked from [Natively AI assistant](https://github.com/Natively-AI-assistant/natively-cluely-ai-assistant) and pre-configured for Fahad Kiani's Google Cloud Forward Deployed Engineer II interview.

- Electron desktop overlay — **invisible to Google Meet screen share** (Electron `setContentProtection`)
- Real-time audio transcription via Rust native module
- Groq (Llama 3.3-70b) for <500ms responses
- Two hard-triggered modes: `RRK:` for knowledge questions, `CODE:` for coding problems
- Pre-loaded with GCP product reference, 6 RRK sub-topics, 10 coding patterns, 5-step coding protocol

---

## Quickstart (macOS Apple Silicon)

```bash
# 1. Run the one-command setup script
bash fde-copilot-config/setup.sh

# 2. Add your Groq API key (free at console.groq.com/keys)
nano ~/fde-copilot/.env
# Replace: PASTE_YOUR_GROQ_KEY_HERE

# 3. Launch
cd ~/fde-copilot && npm start
```

That's it. The script handles: Homebrew → nvm → Node 20 → Rust → npm install → build:native → .env creation.

---

## What the Setup Script Does

| Step | Action |
|------|--------|
| 1 | Install Homebrew (if missing) |
| 2 | Install nvm + Node.js v20 |
| 3 | Install Rust via rustup |
| 4 | Clone this repo to `~/fde-copilot/` |
| 5 | `npm install` — all JS/TS dependencies |
| 6 | `npm run build:native` — compile Rust audio module |
| 7 | Create `.env` with Groq config template |

Re-running is safe — all steps are idempotent.

---

## Load FDE Configuration into Natively (5 min)

After `npm start`, configure the app via its Settings UI:

### 1. Set Groq as AI Provider
```
Settings → AI Providers → Groq
→ Paste API key from console.groq.com/keys
→ Model: llama-3.3-70b-versatile
→ Save
```

### 2. Load System Prompt
```
Settings → Custom Context
→ Open fde-copilot-config/fde_system_prompt.txt
→ Copy all → Paste → Save
```

### 3. Load Reference File
```
Settings → Reference Files → Upload
→ Select: fde-copilot-config/fde_reference_context.txt
```

### 4. Test it works
```
Type: RRK: What is RAG?
Expected: [GenAI Concepts] tag + 3-5 numbered points + GCP product named + follow-up question
No "Certainly!" or filler phrases.

Type: CODE: Two Sum
Expected: Pattern → Algorithm → typed Python → O(n) time O(n) space
```

---

## Interview Day Workflow

See [`fde-copilot-config/patches/interview_day_checklist.md`](fde-copilot-config/patches/interview_day_checklist.md) for the full T-30 → T-10 → during-interview workflow.

**TL;DR during the interview:**

| Situation | Action |
|-----------|--------|
| RRK question | Type `RRK: [question]` → read 3-5 bullets → answer in your own words |
| Coding problem | Type `CODE: [problem]` → read pattern + algorithm → write code yourself |
| Screenshot a question | `Cmd+Shift+S` → AI reads and responds |
| Hide overlay | `Cmd+H` → invisible to screen share |

---

## Hotkeys

| Action | Mac |
|--------|-----|
| Screenshot + analyze | `Cmd+Shift+S` |
| Hide / show overlay | `Cmd+H` |

---

## Interview Details

| Field | Detail |
|-------|--------|
| Date | Tuesday May 19, Block B |
| Time | 1:00–3:15 PM ET |
| Round 1 | RRK — Role-Related Knowledge (60 min) |
| Round 2 | Coding (60 min, static platform, no execution) |
| Primary LLM | Groq llama-3.3-70b-versatile |

---

## Files in This Repo

```
fde-copilot-config/
├── setup.sh                    ← Run this first (macOS Apple Silicon)
├── QUICKSTART.md               ← 10-line human guide
├── fde_system_prompt.txt       ← Paste into Settings → Custom Context
├── fde_reference_context.txt   ← Upload to Settings → Reference Files
└── patches/
    ├── APPLY_PATCHES.md        ← Step-by-step config guide
    ├── fde_groq_config.ts      ← Groq model/param reference
    ├── fde_persona_config.ts   ← Persona mode spec (TypeScript)
    └── interview_day_checklist.md ← Full interview day workflow
.env.example                    ← Copy to .env, add Groq key
```

Everything else is the upstream Natively source (Electron + React + TypeScript + Rust).

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `npm run build:native` fails | Ensure Xcode CLT installed: `xcode-select --install` |
| Groq 401 error | Re-paste API key in Settings → AI Providers → Groq |
| Groq 429 rate limit | Switch to `llama-3.1-8b-instant` temporarily |
| Overlay visible in screen share | Settings → Display → enable "Hide from screen capture" |
| App won't open ("damaged") | `xattr -cr ~/fde-copilot` then relaunch |

---

## License

Natively source: [AGPL-3.0](LICENSE)  
FDE config files (`fde-copilot-config/`): MIT
