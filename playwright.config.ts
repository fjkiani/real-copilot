/**
 * playwright.config.ts
 * --------------------
 * Playwright configuration for FDE Copilot E2E tests.
 *
 * Tests run against the Electron app directly using @playwright/test's
 * built-in _electron launcher — no separate web server needed.
 *
 * Run:
 *   npx playwright test                  # run all tests
 *   npx playwright test --headed         # show browser (already headful for Electron)
 *   npx playwright test --reporter=list  # verbose output
 *   bash fde-copilot-config/build.sh test  # via build script
 */

import { defineConfig } from '@playwright/test';

export default defineConfig({
  // ── Test discovery ──────────────────────────────────────────
  testDir: './tests',
  testMatch: '**/*.spec.ts',

  // ── Timeouts ────────────────────────────────────────────────
  // 30s per test — accounts for Groq API latency (typically 2–8s)
  // plus Electron startup (~5s) and streaming response time.
  timeout: 30_000,

  // Global setup timeout (beforeAll hooks)
  globalTimeout: 120_000,

  // ── Parallelism ─────────────────────────────────────────────
  // Run tests serially — they share a single Electron app instance.
  // Parallel execution would require separate app instances per worker.
  workers: 1,
  fullyParallel: false,

  // ── Retries ─────────────────────────────────────────────────
  // No retries in CI — flaky tests should be fixed, not hidden.
  retries: 0,

  // ── Reporter ────────────────────────────────────────────────
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],

  // ── Output ──────────────────────────────────────────────────
  outputDir: 'test-results',

  // ── Project: Electron ───────────────────────────────────────
  // No browser projects needed — _electron.launch() handles the runtime.
  // The 'use' block here is intentionally minimal; Electron-specific config
  // lives in the test file (electron.launch options).
  use: {
    // Capture screenshot on failure for debugging
    screenshot: 'only-on-failure',

    // Capture video on failure
    video: 'retain-on-failure',

    // Trace on first retry (none here, but good practice)
    trace: 'on-first-retry',
  },
});
