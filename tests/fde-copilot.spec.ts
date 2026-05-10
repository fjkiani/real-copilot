/**
 * fde-copilot.spec.ts
 * -------------------
 * Playwright E2E tests for the FDE Copilot Electron app.
 *
 * Run with:  npx playwright test
 * Or via:    bash fde-copilot-config/build.sh test
 *
 * Prerequisites:
 *   1. npm install (done by setup.sh)
 *   2. npm run build:native (done by setup.sh)
 *   3. GROQ_API_KEY set in .env (real key required — tests make live API calls)
 *
 * Tests run headful (visible window) so you can watch them execute.
 * Each test has a 30s timeout to account for Groq API latency.
 *
 * Architecture note:
 *   This is a multi-window Electron app. The main entry is the Launcher window
 *   (?window=launcher). The overlay (?window=overlay) is the meeting assistant.
 *   The GlobalChatOverlay component lives inside the overlay window and uses
 *   input[type="text"] with placeholder "Ask me anything...".
 *
 *   For RRK/CODE tests we send queries via the TopSearchPill or the chat input
 *   in the overlay. If the overlay isn't open, we fall back to page text search.
 */

import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

// ── Load .env so GROQ_API_KEY is available to the Electron process ──────────
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (key && !(key in process.env)) {
      process.env[key] = val;
    }
  }
}

// ── Shared app instance (launched once, reused across tests) ────────────────
let app: ElectronApplication;
let mainPage: Page;

test.beforeAll(async () => {
  // Guard: refuse to run if Groq key is still the placeholder
  const groqKey = process.env.GROQ_API_KEY ?? '';
  if (!groqKey || groqKey === 'PASTE_YOUR_GROQ_KEY_HERE') {
    throw new Error(
      '[FDE Tests] GROQ_API_KEY is not set.\n' +
      'Edit .env and replace PASTE_YOUR_GROQ_KEY_HERE with your key from https://console.groq.com/keys'
    );
  }

  // Launch the Electron app in development mode
  app = await electron.launch({
    args: ['.'],
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      NODE_ENV: 'development',
      GROQ_API_KEY: groqKey,
    },
  });

  // Wait for the first window to appear
  mainPage = await app.firstWindow();

  // Give the app 6 seconds to fully initialise (startup sequence + React hydration)
  await mainPage.waitForTimeout(6_000);
});

test.afterAll(async () => {
  if (app) {
    await app.close();
  }
});

// ── Helper: find the first visible text input on a page ─────────────────────
async function findChatInput(page: Page): Promise<import('@playwright/test').Locator | null> {
  const selectors = [
    'input[placeholder="Ask me anything..."]',
    'input[type="text"]',
    'textarea[placeholder*="Ask"]',
    'textarea[placeholder*="Type"]',
    'textarea',
    '[contenteditable="true"]',
    '[data-testid="chat-input"]',
  ];

  for (const selector of selectors) {
    try {
      const el = page.locator(selector).first();
      await el.waitFor({ state: 'visible', timeout: 2_000 });
      return el;
    } catch {
      // try next
    }
  }
  return null;
}

// ── Helper: wait for new text to appear on page after an action ─────────────
async function waitForNewText(page: Page, timeoutMs: number = 20_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let lastText = await page.evaluate(() => document.body.innerText);
  while (Date.now() < deadline) {
    await page.waitForTimeout(500);
    const currentText = await page.evaluate(() => document.body.innerText);
    if (currentText.length > lastText.length + 20) {
      return currentText;
    }
    lastText = currentText;
  }
  return lastText;
}

// ── Test 1: App launches ─────────────────────────────────────────────────────
test('app launches and window is visible', async () => {
  // The window should exist and have a non-empty title
  const windowCount = await app.evaluate(({ BrowserWindow }) => {
    return BrowserWindow.getAllWindows().length;
  });

  expect(windowCount).toBeGreaterThan(0);

  // The page should have loaded (not a blank white screen)
  const bodyText = await mainPage.evaluate(() => document.body.innerText);
  expect(bodyText.length).toBeGreaterThan(0);

  // Verify the window is visible
  const isVisible = await app.evaluate(({ BrowserWindow }) => {
    const wins = BrowserWindow.getAllWindows();
    return wins.length > 0 ? wins[0].isVisible() : false;
  });
  expect(isVisible).toBe(true);

  console.log(`App launched. Windows open: ${windowCount}`);
  console.log(`Body text (first 100 chars): "${bodyText.slice(0, 100)}"`);
});

// ── Test 2: RRK mode ─────────────────────────────────────────────────────────
test('RRK mode: response contains sub-topic tag and GCP product', async () => {
  // The overlay window is where the chat lives. Try to find it or use mainPage.
  let targetPage = mainPage;

  // Check if there's an overlay window open
  const pages = app.windows();
  for (const p of pages) {
    const url = p.url();
    if (url.includes('window=overlay')) {
      targetPage = p;
      break;
    }
  }

  // Try to find a chat input
  let chatInput = await findChatInput(targetPage);

  // If not found on current page, try all windows
  if (!chatInput) {
    for (const p of app.windows()) {
      chatInput = await findChatInput(p);
      if (chatInput) {
        targetPage = p;
        break;
      }
    }
  }

  if (!chatInput) {
    // Take a screenshot to help debug selector issues
    await targetPage.screenshot({ path: path.join(__dirname, 'debug-rrk-no-input.png') });
    // Fallback: check if there's a search pill or command bar
    const pageText = await targetPage.evaluate(() => document.body.innerText);
    console.log('Page text (first 500 chars):', pageText.slice(0, 500));
    throw new Error(
      'Could not find chat input. Screenshot saved to tests/debug-rrk-no-input.png.\n' +
      'The overlay window may not be open. Start a meeting first or open the overlay manually.'
    );
  }

  // Type the RRK query
  await chatInput.click();
  await chatInput.fill('RRK: What is RAG and how does it work on GCP?');
  await targetPage.keyboard.press('Enter');

  // Wait for response to stream in (up to 25s for Groq API)
  const responseText = await waitForNewText(targetPage, 25_000);

  console.log('RRK response (first 400 chars):', responseText.slice(0, 400));

  // Assertions — from fde_system_prompt.txt RRK MODE rules:
  // Step 1: Tag the sub-topic in brackets at the top
  expect(responseText).toMatch(/\[(GenAI Concepts|System Design|Consulting|Troubleshooting|App Development|Cloud Technology)\]/);

  // Step 2: Name at least one specific GCP product
  const gcpProducts = [
    'Vertex AI', 'ADK', 'Agent Engine', 'Matching Engine',
    'Cloud Run', 'BigQuery', 'Pub/Sub', 'Document AI',
    'VPC Service Controls', 'Gemini', 'Dataflow', 'Cloud Storage',
    'AlloyDB', 'Spanner', 'GKE'
  ];
  const hasGcpProduct = gcpProducts.some(p => responseText.includes(p));
  expect(hasGcpProduct).toBe(true);

  // Hard rule 1: No filler opener
  expect(responseText).not.toMatch(/^(Certainly|Sure!|Of course|Absolutely|Great question)/i);

  console.log('RRK mode: sub-topic tag and GCP product present, no filler opener');
});

// ── Test 3: CODE mode ────────────────────────────────────────────────────────
test('CODE mode: response contains Pattern, algorithm, and complexity', async () => {
  let targetPage = mainPage;

  // Check if there's an overlay window open
  const pages = app.windows();
  for (const p of pages) {
    const url = p.url();
    if (url.includes('window=overlay')) {
      targetPage = p;
      break;
    }
  }

  let chatInput = await findChatInput(targetPage);

  if (!chatInput) {
    for (const p of app.windows()) {
      chatInput = await findChatInput(p);
      if (chatInput) {
        targetPage = p;
        break;
      }
    }
  }

  if (!chatInput) {
    await targetPage.screenshot({ path: path.join(__dirname, 'debug-code-no-input.png') });
    throw new Error('Could not find chat input. Screenshot saved to tests/debug-code-no-input.png.');
  }

  await chatInput.click();
  await chatInput.fill('CODE: Two Sum — find indices of two numbers that add to target');
  await targetPage.keyboard.press('Enter');

  // Wait for response (coding responses are longer, allow 30s)
  const responseText = await waitForNewText(targetPage, 30_000);

  console.log('CODE response (first 500 chars):', responseText.slice(0, 500));

  // Assertions — from fde_system_prompt.txt CODING MODE format:
  // **Pattern:** [Arrays/Hashing | ...]
  expect(responseText).toContain('Pattern');

  // **Complexity:** Time: O(...) | Space: O(...)
  expect(responseText).toMatch(/O\(n\)/i);

  // Should contain Python code
  expect(responseText).toMatch(/def |return |for |if /);

  // Hard rule 1: No filler opener
  expect(responseText).not.toMatch(/^(Certainly|Sure!|Of course|Absolutely|Great question)/i);

  console.log('CODE mode: Pattern and O(n) complexity present');
});

// ── Test 4: Hide/show overlay ────────────────────────────────────────────────
test('hide overlay: Cmd+H toggles window visibility', async () => {
  // Confirm at least one window is currently visible
  const isVisibleBefore = await app.evaluate(({ BrowserWindow }) => {
    const wins = BrowserWindow.getAllWindows();
    return wins.some(w => w.isVisible());
  });
  expect(isVisibleBefore).toBe(true);

  // Press Cmd+H to hide (macOS standard hide shortcut)
  await mainPage.keyboard.press('Meta+h');
  await mainPage.waitForTimeout(800);

  // Check if any window is now hidden
  // Note: on macOS, Cmd+H hides the app (all windows become invisible)
  const allHidden = await app.evaluate(({ BrowserWindow }) => {
    const wins = BrowserWindow.getAllWindows();
    return wins.every(w => !w.isVisible());
  });

  // The app should have hidden at least the main window
  // (Some windows like tray-only apps may stay "hidden" by design)
  // We accept either: all hidden, or the main window hidden
  const mainHidden = await app.evaluate(({ BrowserWindow }) => {
    const wins = BrowserWindow.getAllWindows();
    return wins.length > 0 ? !wins[0].isVisible() : true;
  });

  expect(allHidden || mainHidden).toBe(true);
  console.log(`After Cmd+H: allHidden=${allHidden}, mainHidden=${mainHidden}`);

  // Restore: show the window again via app.evaluate (page.keyboard won't work on hidden window)
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows().forEach(w => {
      if (!w.isDestroyed()) w.show();
    });
  });
  await mainPage.waitForTimeout(500);

  // Confirm window is visible again
  const isVisibleAfter = await app.evaluate(({ BrowserWindow }) => {
    const wins = BrowserWindow.getAllWindows();
    return wins.some(w => w.isVisible());
  });
  expect(isVisibleAfter).toBe(true);

  console.log('Hide/show overlay: Cmd+H hides window, restore shows it again');
});
