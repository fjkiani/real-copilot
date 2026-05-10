#!/bin/bash
# ============================================================
# FDE Copilot — Build Script
# Single entry point for dev, test, and dist modes.
#
# Usage:
#   bash fde-copilot-config/build.sh dev    # Start in development mode
#   bash fde-copilot-config/build.sh test   # Run Playwright E2E tests
#   bash fde-copilot-config/build.sh dist   # Build distributable (gated)
#
# Gates:
#   dist: blocks if .env has placeholder key OR tests haven't passed
#   Override: SKIP_TESTS=1 bash fde-copilot-config/build.sh dist
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
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }

# ── Resolve repo root ─────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_DIR"

# ── Parse mode ───────────────────────────────────────────────
MODE="${1:-}"
if [ -z "$MODE" ]; then
  echo -e "${BOLD}FDE Copilot Build Script${NC}"
  echo ""
  echo "Usage:"
  echo "  bash fde-copilot-config/build.sh dev    # Start in development mode"
  echo "  bash fde-copilot-config/build.sh test   # Run Playwright E2E tests"
  echo "  bash fde-copilot-config/build.sh dist   # Build distributable (gated)"
  echo ""
  echo "Environment:"
  echo "  SKIP_TESTS=1   Skip test gate in dist mode (use with caution)"
  echo ""
  exit 0
fi

# ── Shared: verify prerequisites ─────────────────────────────
hdr "Checking prerequisites"

# Node.js
if ! command -v node &>/dev/null; then
  err "Node.js not found. Run setup.sh first."
fi
ok "Node.js $(node --version)"

# npm dependencies
if [ ! -d "node_modules" ]; then
  err "node_modules not found. Run: npm install"
fi
ok "node_modules present"

# .env file
if [ ! -f ".env" ]; then
  warn ".env not found — creating template"
  cat > .env << 'ENVEOF'
GROQ_API_KEY=PASTE_YOUR_GROQ_KEY_HERE
DEFAULT_MODEL=llama-3.3-70b-versatile
FAST_MODEL=llama-3.1-8b-instant
VISION_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
USE_GROQ=true
DISABLE_TELEMETRY=true
ENVEOF
  err ".env created. Edit it and paste your Groq API key, then re-run."
fi
ok ".env found"

# ── Shared: check for placeholder API key ────────────────────
check_api_key() {
  local groq_key
  groq_key=$(grep -E '^GROQ_API_KEY=' .env 2>/dev/null | cut -d'=' -f2- | tr -d '[:space:]')
  if [ -z "$groq_key" ] || [ "$groq_key" = "PASTE_YOUR_GROQ_KEY_HERE" ]; then
    return 1  # placeholder or empty
  fi
  return 0  # real key
}

# ── Shared: check if tests have passed ───────────────────────
TESTS_PASSED_STAMP=".fde-tests-passed"

tests_have_passed() {
  if [ -f "$TESTS_PASSED_STAMP" ]; then
    local stamp_age
    stamp_age=$(( $(date +%s) - $(stat -f %m "$TESTS_PASSED_STAMP" 2>/dev/null || stat -c %Y "$TESTS_PASSED_STAMP" 2>/dev/null || echo 0) ))
    # Stamp is valid for 24 hours (86400 seconds)
    if [ "$stamp_age" -lt 86400 ]; then
      return 0
    fi
  fi
  return 1
}

mark_tests_passed() {
  touch "$TESTS_PASSED_STAMP"
  ok "Test pass stamp written: $TESTS_PASSED_STAMP"
}

# ── MODE: dev ────────────────────────────────────────────────
if [ "$MODE" = "dev" ]; then
  hdr "Starting FDE Copilot in development mode"

  if ! check_api_key; then
    warn "GROQ_API_KEY is not set in .env — app will launch but AI responses will fail."
    warn "Edit .env and paste your key from https://console.groq.com/keys"
    echo ""
  fi

  ok "Launching app..."
  echo -e "${BLUE}Tip: Cmd+H to hide overlay | Cmd+Shift+Enter to screenshot | Cmd+Q to quit${NC}"
  echo ""

  # Load .env into environment
  set -a
  source .env
  set +a

  exec npm start

# ── MODE: test ───────────────────────────────────────────────
elif [ "$MODE" = "test" ]; then
  hdr "Running FDE Copilot E2E tests"

  if ! check_api_key; then
    err "GROQ_API_KEY is not set in .env.\nTests make live API calls — a real key is required.\nEdit .env and paste your key from https://console.groq.com/keys"
  fi

  # Check playwright is installed
  if ! npx playwright --version &>/dev/null 2>&1; then
    info "Installing Playwright..."
    npm install --save-dev @playwright/test
  fi

  # Check playwright.config.ts exists
  if [ ! -f "playwright.config.ts" ]; then
    err "playwright.config.ts not found. Run setup.sh to restore it."
  fi

  # Check test file exists
  if [ ! -f "tests/fde-copilot.spec.ts" ]; then
    err "tests/fde-copilot.spec.ts not found. Run setup.sh to restore it."
  fi

  ok "Running Playwright tests..."
  echo ""

  # Load .env into environment
  set -a
  source .env
  set +a

  # Run tests — exit code propagates
  if npx playwright test --reporter=list; then
    echo ""
    ok "All tests passed!"
    mark_tests_passed
    exit 0
  else
    echo ""
    err "Tests failed. Fix the failures before building dist."
  fi

# ── MODE: dist ───────────────────────────────────────────────
elif [ "$MODE" = "dist" ]; then
  hdr "Building FDE Copilot distributable"

  # Gate 1: API key must be real
  if ! check_api_key; then
    err "GATE BLOCKED: GROQ_API_KEY is still the placeholder in .env.\nA real key is required before building a distributable.\nEdit .env and paste your key from https://console.groq.com/keys"
  fi
  ok "Gate 1 passed: GROQ_API_KEY is set"

  # Gate 2: Tests must have passed (unless SKIP_TESTS=1)
  if [ "${SKIP_TESTS:-0}" = "1" ]; then
    warn "Gate 2 SKIPPED: SKIP_TESTS=1 override active. Build at your own risk."
  elif tests_have_passed; then
    ok "Gate 2 passed: tests passed within the last 24 hours"
  else
    echo ""
    warn "Gate 2 BLOCKED: Tests have not passed in the last 24 hours."
    echo ""
    echo "Run tests first:"
    echo "  bash fde-copilot-config/build.sh test"
    echo ""
    echo "Or skip the gate (not recommended):"
    echo "  SKIP_TESTS=1 bash fde-copilot-config/build.sh dist"
    echo ""
    exit 1
  fi

  # Load .env into environment
  set -a
  source .env
  set +a

  ok "Building distributable..."
  echo ""

  # Build the Electron distributable
  if npm run dist; then
    echo ""
    ok "Build complete! Check the dist/ folder for your .dmg / .exe / .AppImage"
  else
    err "Build failed. Check the output above for errors."
  fi

# ── Unknown mode ─────────────────────────────────────────────
else
  err "Unknown mode: '$MODE'. Use: dev | test | dist"
fi
