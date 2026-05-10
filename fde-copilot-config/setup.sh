#!/bin/bash
# ============================================================
# FDE Copilot — macOS Apple Silicon Setup Script
# Clones fjkiani/real-copilot and configures it for the
# Google Cloud FDE II GenAI interview (May 19, Block B)
# ============================================================
set -e

# ── Colors ───────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

ok()   { echo -e "${GREEN}✅ $1${NC}"; }
info() { echo -e "${YELLOW}ℹ️  $1${NC}"; }
err()  { echo -e "${RED}❌ $1${NC}"; exit 1; }
hdr()  { echo -e "\n${BLUE}${BOLD}══ $1 ══${NC}"; }

REPO_DIR="$HOME/fde-copilot"
REPO_URL="https://github.com/fjkiani/real-copilot.git"

echo -e "${BOLD}"
echo "╔══════════════════════════════════════════════════════╗"
echo "║       FDE Copilot — Setup (Apple Silicon)            ║"
echo "║   Interview: May 19, Block B (1–3:15 PM ET)         ║"
echo "╚══════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ── Step 1: Xcode Command Line Tools ─────────────────────────
hdr "Step 1: Xcode Command Line Tools"
if xcode-select -p &>/dev/null; then
  ok "Xcode CLT already installed: $(xcode-select -p)"
else
  info "Installing Xcode Command Line Tools (required for Rust build)..."
  xcode-select --install
  echo ""
  info "A dialog box appeared. Click 'Install' and wait for it to finish."
  info "Then re-run this script."
  exit 0
fi

# ── Step 2: Homebrew ─────────────────────────────────────────
hdr "Step 2: Homebrew"
if command -v brew &>/dev/null; then
  ok "Homebrew already installed: $(brew --version | head -1)"
else
  info "Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Add brew to PATH for Apple Silicon
  echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> "$HOME/.zprofile"
  eval "$(/opt/homebrew/bin/brew shellenv)"
  ok "Homebrew installed"
fi

# ── Step 3: Node.js v20 via nvm ───────────────────────────────
hdr "Step 3: Node.js v20"
if command -v nvm &>/dev/null || [ -s "$HOME/.nvm/nvm.sh" ]; then
  ok "nvm already installed"
else
  info "Installing nvm..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  ok "nvm installed"
fi

# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

NODE_VERSION=$(node --version 2>/dev/null || echo "none")
if [[ "$NODE_VERSION" == v20* ]] || [[ "$NODE_VERSION" == v21* ]] || [[ "$NODE_VERSION" == v22* ]]; then
  ok "Node.js already at $NODE_VERSION"
else
  info "Installing Node.js v20 LTS..."
  nvm install 20
  nvm use 20
  nvm alias default 20
  ok "Node.js $(node --version) installed"
fi

# ── Step 4: Rust ─────────────────────────────────────────────
hdr "Step 4: Rust (required for native audio module)"
if command -v rustc &>/dev/null; then
  ok "Rust already installed: $(rustc --version)"
else
  info "Installing Rust via rustup..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  source "$HOME/.cargo/env"
  ok "Rust $(rustc --version) installed"
fi

# Ensure cargo is in PATH
source "$HOME/.cargo/env" 2>/dev/null || true

# ── Step 5: Clone repo ────────────────────────────────────────
hdr "Step 5: Clone FDE Copilot repo (fjkiani/real-copilot)"
if [ -d "$REPO_DIR/.git" ]; then
  ok "Repo already cloned at $REPO_DIR"
  info "Pulling latest changes..."
  git -C "$REPO_DIR" pull --ff-only || info "Could not pull (local changes?). Continuing."
else
  info "Cloning FDE Copilot from fjkiani/real-copilot..."
  git clone "$REPO_URL" "$REPO_DIR"
  ok "Repo cloned to $REPO_DIR"
fi

cd "$REPO_DIR"

# ── Step 6: Install npm dependencies ─────────────────────────
hdr "Step 6: npm install"
if [ -d "node_modules" ] && [ -f "node_modules/.package-lock.json" ]; then
  ok "node_modules already present — skipping install"
  info "Run 'npm install' manually if you need to refresh dependencies"
else
  info "Installing npm dependencies (this takes 2-5 minutes)..."
  npm install
  ok "npm dependencies installed"
fi

# ── Step 7: Build Rust native audio module ───────────────────
hdr "Step 7: Build native audio module (Rust)"
if [ -f "native-module/index.node" ] || ls native-module/*.node &>/dev/null 2>&1; then
  ok "Native module already built"
else
  info "Building Rust audio module (takes 1-3 minutes on first run)..."
  npm run build:native
  ok "Native audio module built"
fi

# ── Step 8: Create .env file ──────────────────────────────────
hdr "Step 8: Configure environment"
if [ -f ".env" ]; then
  ok ".env already exists — not overwriting"
  info "Edit $REPO_DIR/.env to update your API key"
else
  cat > .env << 'ENVEOF'
# ── FDE Copilot Configuration ─────────────────────────────────
# Fill in your Groq API key below (get one free at console.groq.com)

GROQ_API_KEY=PASTE_YOUR_GROQ_KEY_HERE

# Primary model: best reasoning on Groq
DEFAULT_MODEL=llama-3.3-70b-versatile

# Fast model for quick hints
FAST_MODEL=llama-3.1-8b-instant

# Vision model for screenshot OCR
VISION_MODEL=meta-llama/llama-4-scout-17b-16e-instruct

# Enable Groq as default provider
USE_GROQ=true

# Disable telemetry
DISABLE_TELEMETRY=true
ENVEOF
  ok ".env created at $REPO_DIR/.env"
  echo ""
  echo -e "${RED}${BOLD}  ⚠️  ACTION REQUIRED: Edit .env and paste your Groq API key${NC}"
  echo -e "${YELLOW}  Get a free key at: https://console.groq.com/keys${NC}"
  echo -e "${YELLOW}  Then edit: nano $REPO_DIR/.env${NC}"
fi

# ── Step 9: Copy FDE context files ───────────────────────────
hdr "Step 9: Copy FDE reference files"
FDE_ASSETS_DIR="$REPO_DIR/fde-assets"
mkdir -p "$FDE_ASSETS_DIR"

# Source files live inside the cloned repo under fde-copilot-config/
# This is the canonical location after cloning fjkiani/real-copilot.
FDE_CONFIG_DIR="$REPO_DIR/fde-copilot-config"

for f in fde_system_prompt.txt fde_reference_context.txt; do
  if [ -f "$FDE_CONFIG_DIR/$f" ]; then
    cp "$FDE_CONFIG_DIR/$f" "$FDE_ASSETS_DIR/$f"
    ok "Copied $f → $FDE_ASSETS_DIR/$f"
  else
    info "$f not found in $FDE_CONFIG_DIR — skipping (add it to fde-copilot-config/ and re-run)"
  fi
done

# Also copy build.sh to repo root for convenience
if [ -f "$FDE_CONFIG_DIR/build.sh" ]; then
  chmod +x "$FDE_CONFIG_DIR/build.sh"
  ok "build.sh is executable at $FDE_CONFIG_DIR/build.sh"
fi

# ── Step 10: Fix macOS "App is Damaged" issue ─────────────────
hdr "Step 10: macOS security fix"
if [ -d "/Applications/FDE Copilot.app" ]; then
  info "Removing macOS quarantine flag from FDE Copilot.app..."
  xattr -cr "/Applications/FDE Copilot.app" 2>/dev/null && ok "Quarantine flag removed" || info "No quarantine flag found"
elif [ -d "/Applications/Natively.app" ]; then
  info "Removing macOS quarantine flag from Natively.app..."
  xattr -cr /Applications/Natively.app 2>/dev/null && ok "Quarantine flag removed" || info "No quarantine flag found"
fi

# ── Done ──────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}"
echo "╔══════════════════════════════════════════════════════╗"
echo "║              ✅ SETUP COMPLETE                       ║"
echo "╚══════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo -e "${BOLD}Next steps:${NC}"
echo ""
echo -e "  1. ${YELLOW}Paste your Groq API key:${NC}"
echo -e "     nano $REPO_DIR/.env"
echo -e "     (Get free key: https://console.groq.com/keys)"
echo ""
echo -e "  2. ${YELLOW}Launch the app (dev mode):${NC}"
echo -e "     bash $REPO_DIR/fde-copilot-config/build.sh dev"
echo ""
echo -e "  3. ${YELLOW}Run E2E tests:${NC}"
echo -e "     bash $REPO_DIR/fde-copilot-config/build.sh test"
echo ""
echo -e "  4. ${YELLOW}In the app (Settings → AI Providers):${NC}"
echo -e "     • Select Groq → paste your API key → Save"
echo -e "     • Model: llama-3.3-70b-versatile"
echo ""
echo -e "  5. ${YELLOW}Load FDE context (Settings → Custom Context):${NC}"
echo -e "     • Paste contents of: $FDE_ASSETS_DIR/fde_system_prompt.txt"
echo ""
echo -e "  6. ${YELLOW}Load reference file (Settings → Reference Files):${NC}"
echo -e "     • Upload: $FDE_ASSETS_DIR/fde_reference_context.txt"
echo ""
echo -e "  7. ${YELLOW}Select persona mode:${NC}"
echo -e "     • Modes → Technical Interview (closest to FDE mode)"
echo ""
echo -e "  8. ${YELLOW}Test before May 19:${NC}"
echo -e "     • Cmd+Shift+Enter → screenshot a question → verify response"
echo -e "     • Cmd+H → hide overlay → verify it disappears from screen share"
echo ""
echo -e "${BLUE}Interview: Tuesday May 19, Block B (1:00–3:15 PM ET)${NC}"
echo -e "${BLUE}Round 1: RRK (60 min) → Round 2: Coding (60 min)${NC}"
echo ""
