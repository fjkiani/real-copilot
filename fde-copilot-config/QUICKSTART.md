# FDE Co-Pilot — Quick Start Guide

1. **Run the setup script** — `bash setup.sh` — it handles everything below automatically.
2. **Homebrew** is installed if missing (macOS package manager required for build tools).
3. **nvm** is installed and used to pin **Node.js v20** — the version the app requires.
4. **Rust** is installed via `rustup` to compile the native audio-capture module.
5. **The repo** is cloned to `~/fde-copilot/` from the Natively AI assistant on GitHub.
6. **`npm install`** fetches all JavaScript/TypeScript dependencies.
7. **`npm run build:native`** compiles the Rust audio module; macOS quarantine flags are cleared automatically.
8. A **`.env` file** is created — open it and replace `PASTE_YOUR_GROQ_KEY_HERE` with your key from <https://console.groq.com/keys>.
9. **Launch the app** with `cd ~/fde-copilot && npm start`.
10. During your **Google FDE interview**, the co-pilot transcribes audio in real-time and surfaces AI suggestions on demand — keep it on a second display or off-screen.
