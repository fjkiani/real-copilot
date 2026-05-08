# Interview Day Checklist — Google FDE II
### May 19 · Google Cloud Forward Deployed Engineer II · GenAI Focus

---

## T-30 Minutes: Setup & Verification

- [ ] **Launch Natively** — `npm start` in the repo, or double-click the packaged app
- [ ] **Verify Groq API key** — Settings → AI Providers → Groq → confirm green ✅ checkmark
  - If red ❌: re-paste your key from [console.groq.com](https://console.groq.com) → Save
- [ ] **Load reference file** — Settings → Reference Files → Upload → select `fde_reference_context.txt`
  - Confirm filename appears in the list with a ✅
- [ ] **Load system prompt** — Settings → Custom Context → paste contents of `fde_system_prompt.txt` → Save
  - Quick verify: type `ping` in chat → response should be direct, no filler phrases
- [ ] **Select persona mode** — Mode selector dropdown → "🎯 Google FDE II"
  - Confirm the mode name appears in the header/status bar
- [ ] **Test screenshot capture** — Press `Cmd+Shift+S` (Mac) / `Ctrl+Shift+S` (Win/Linux) on any window
  - Expected: Natively shows a thumbnail + AI description within ~3 seconds
  - If nothing happens: check Settings → Hotkeys → screenshot is registered
- [ ] **Test RRK mode** — Type exactly: `RRK: What is RAG?` → press Enter
  - Expected: 3–5 bullet answer in < 3 s, no "Certainly!" opener
  - If slow (> 5 s): check Groq rate limit — wait 60 s and retry
- [ ] **Test Code mode** — Type exactly: `CODE: Two Sum` → press Enter
  - Expected: algorithm approach + Python/pseudocode + O(n) time / O(n) space note
- [ ] **Set overlay opacity** — Drag opacity slider to ~85%
  - Visible enough to read quickly; not so bright it's distracting on camera
- [ ] **Test hide overlay** — Press `Cmd+H` → overlay disappears completely
- [ ] **Test show overlay** — Press `Cmd+H` again → overlay reappears in same position
- [ ] **Confirm model** — Settings → AI Providers → active model shows `llama-3.3-70b-versatile`

---

## T-10 Minutes: Pre-Call Positioning

- [ ] **Open Google Meet link** — join the meeting lobby (don't start yet)
- [ ] **Position Natively overlay**
  - **Option A (preferred):** drag to secondary monitor — fully visible, zero overlap with Meet
  - **Option B:** drag to bottom-right corner of primary monitor, resize to ~400 px wide
- [ ] **Stealth mode check** — in Meet, click "Present screen" → preview your share
  - Natively overlay should be **invisible** in the preview (Electron `setContentProtection`)
  - If visible: Settings → Display → enable "Hide from screen capture" → re-test
- [ ] **Backup reference open** — open `fde_reference_context.txt` in TextEdit / VS Code
  - Minimise it — it's your fallback if Natively has any issue
- [ ] **Close distractions**
  - [ ] Quit Slack / Teams / Discord
  - [ ] Quit email client
  - [ ] Quit music / Spotify
  - [ ] Silence phone (Do Not Disturb on)
  - [ ] Close all browser tabs except Google Meet
- [ ] **Check CPU/RAM** — Activity Monitor / Task Manager → Natively should be < 5% CPU at idle
- [ ] **Charger plugged in** — laptop on AC power, not battery
- [ ] **Water on desk** — seriously, you'll need it

---

## During the Interview

### RRK / Knowledge Round

```
Interviewer asks a question
  → Screenshot it (Cmd+Shift+S)  OR  type it manually
  → Press Cmd+Shift+R  (RRK mode)
  → Read the 3–5 bullet response
  → Pick your top 3 points
  → Answer in YOUR OWN WORDS — paraphrase, don't read verbatim
  → Mention 1–2 GCP products by name (Vertex AI, BigQuery, Cloud Run, etc.)
```

**RRK answer structure (30–60 seconds per answer):**
1. One-sentence definition / what it is
2. Why it matters / the problem it solves
3. How you'd use it / a concrete example
4. (Optional) Trade-off or limitation you're aware of

---

### Coding Round

```
Problem appears on screen
  → Screenshot it (Cmd+Shift+S)
  → Press Cmd+Shift+C  (Code mode)
  → Read the algorithm suggestion
  → STATE THE APPROACH OUT LOUD before typing any code:
      "I'm going to use a hash map for O(n) lookup..."
  → Write the code yourself — use the AI output as a guide, not a copy
  → Walk through a test case out loud
  → State complexity at the end:
      "Time: O(n), Space: O(n) — because..."
```

**If stuck:**
- Type `HINT: [describe where you're stuck]` → `Cmd+Shift+C`
- Use the fast model hint (near-instant) to unblock, then continue yourself

---

### Behavioral / Situational Questions

```
  → Type the question → press Cmd+Shift+R
  → Use the STAR framework bullets the AI provides
  → Personalise with a real story from your experience
  → Keep to 90 seconds max
```

---

## Post-Interview

- [ ] Note any questions you couldn't answer → add to `fde_reference_context.txt` for next round
- [ ] Send thank-you email within 2 hours
- [ ] Log the interview in your notes with date, interviewer name, topics covered

---

## Emergency Fallbacks

| Problem | Immediate fix |
|---------|--------------|
| Natively crashes | Open `fde_reference_context.txt` backup — answer from memory |
| Groq API down | Switch provider: Settings → AI Providers → select Gemini or Claude |
| Hotkey stops working | Click into Natively window → type the question manually |
| Overlay visible in share | `Cmd+H` to hide it immediately; use backup file |
| Internet drops | Natively may have offline cache — check Settings → Offline Mode |

---

## Key Hotkeys (laminate this)

| Action | Mac | Win/Linux |
|--------|-----|-----------|
| RRK answer mode | `Cmd+Shift+R` | `Ctrl+Shift+R` |
| Coding mode | `Cmd+Shift+C` | `Ctrl+Shift+C` |
| Screenshot + analyze | `Cmd+Shift+S` | `Ctrl+Shift+S` |
| Hide / show overlay | `Cmd+H` | `Ctrl+H` |

---

**You've prepared. Trust the prep. Good luck. 🎯**

*Google FDE II Co-Pilot — Interview Day Checklist v1.0*
