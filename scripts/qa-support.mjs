import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const qaBaseURL = (process.env.QA_BASE_URL || 'http://127.0.0.1:1420').replace(/\/$/, '');
export const browserOptions = process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {};

export function reportDirectory(scriptURL) {
  const argument = process.argv[2];
  return path.resolve(argument && !argument.startsWith('--') ? argument :
    path.join(repository, '.test-output', path.basename(fileURLToPath(scriptURL), '.mjs')));
}

export function isolatedDirectory(scriptURL) {
  const root = path.resolve(process.env.CREATIVE_CLOTH_TEST_DATA_DIR || reportDirectory(scriptURL));
  // Reject obvious user-data locations before launching or connecting to a WebView.
  const user = process.env.USERPROFILE;
  const appData = process.env.APPDATA;
  for (const protectedRoot of [repository, user, appData].filter(Boolean)) {
    assert.notEqual(root.toLowerCase(), path.resolve(protectedRoot).toLowerCase(), 'Choose a dedicated synthetic test directory');
  }
  if (appData) assert.ok(!root.toLowerCase().startsWith(path.resolve(appData).toLowerCase() + path.sep), 'Do not test inside application user data');
  return root;
}

export function debugExecutable() {
  const targetDir = process.env.CARGO_TARGET_DIR ? path.resolve(repository, process.env.CARGO_TARGET_DIR) : path.join(repository, 'src-tauri', 'target');
  const executable = path.join(targetDir, 'debug', 'script-collection.exe');
  // This string exists only in the debug_assertions isolation branch. A release
  // executable does not honor the test data directory and must never be launched.
  assert.ok(readFileSync(executable).includes(Buffer.from('CREATIVE_CLOTH_TEST_DATA_DIR')), 'Build the desktop debug executable with isolation enabled before native tests');
  return executable;
}

export async function connectIsolated(url, root) {
  const browser = await chromium.connectOverCDP(url);
  try {
    const pages = browser.contexts().flatMap(context => context.pages());
    assert.ok(pages.length, 'Native debug WebView has no page');
    for (const page of pages) {
      await page.waitForFunction(() => window.__TAURI_INTERNALS__, null, { timeout: 5000 });
      const state = await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('load_app_state'));
      const database = path.resolve(state.databasePath).toLowerCase();
      assert.ok(database.startsWith(path.resolve(root).toLowerCase() + path.sep), 'Refusing a native WebView whose database is outside the synthetic test directory');
    }
    return browser;
  } catch (error) {
    await browser.close().catch(() => {});
    throw error;
  }
}
