import { reportDirectory, browserOptions, qaBaseURL, debugExecutable, connectIsolated, isolatedDirectory } from './qa-support.mjs';
// Real Tauri/WebView/SQLite acceptance using only the debug build's isolated data override.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
const root = isolatedDirectory(import.meta.url); await mkdir(root, { recursive: true });
const executable = debugExecutable();
let child, browser, page;
const checks = [], errors = [];
const invoke = (command, args = {}) => page.evaluate(({ command, args }) => window.__TAURI_INTERNALS__.invoke(command, args), { command, args });
const state = () => invoke('load_app_state');
const go = async hash => { await page.evaluate(hash => { location.hash = hash; }, hash); };
const map = () => page.locator('.canvas-minimap');
const view = () => page.locator('.canvas-world,.inner-canvas-world').first().evaluate(node => { const m = new DOMMatrix(getComputedStyle(node).transform); return { x: m.e, y: m.f, zoom: m.a }; });
const near = (a, b) => assert.ok(Math.abs(a - b) < 1, `${a} != ${b}`);
async function launch() {
  child = spawn(executable, [], { windowsHide: true, stdio: 'ignore', env: { ...process.env, CREATIVE_CLOTH_TEST_DATA_DIR: root, WEBVIEW2_USER_DATA_FOLDER: path.join(root, 'webview'), WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=9457' } });
  for (let n = 0; n < 100; n++) { try { browser = await connectIsolated('http://127.0.0.1:9457', root); break; } catch { await new Promise(resolve => setTimeout(resolve, 150)); } }
  assert.ok(browser, 'Native isolated WebView not reachable');
  page = browser.contexts()[0].pages()[0]; page.on('pageerror', error => errors.push(error.message));
  await page.waitForFunction(() => window.__TAURI_INTERNALS__ && !document.querySelector('.boot-screen'));
  assert.ok(path.resolve((await state()).databasePath).startsWith(root + path.sep));
}
async function close() {
  const exit = new Promise((resolve, reject) => { const timer = setTimeout(() => reject(Error('Isolated native process did not close')), 15000); child.once('exit', () => { clearTimeout(timer); resolve(); }); });
  await invoke('finish_window_close').catch(() => {}); await exit;
  await browser?.close().catch(() => {}); browser = null; page = null;
  await new Promise(resolve => setTimeout(resolve, 350));
}
try {
  await launch(); const d = await state(), now = Date.now();
  await invoke('save_settings', { item: { ...d.settings, theme: 'dark', closeBehavior: 'exit', uiScale: 100, autoSave: true, autoSaveInterval: 5 } });
  await invoke('save_workspace', { item: { id: 'minimap-w', name: '小地图隔离验收', description: '', coverPath: '', notes: '', createdAt: now, updatedAt: now } });
  await invoke('save_category', { item: { id: 'minimap-c', workspaceId: 'minimap-w', name: '小地图分类', description: '', icon: '', createdAt: now, updatedAt: now, viewportX: 0, viewportY: 0, zoom: .51, canvasColor: '#000000', canvasPattern: 'grid' } });
  const file = path.join(root, 'isolated-source.bin'); await writeFile(file, 'isolated native minimap fixture');
  const imageFile = path.join(root, 'isolated-sample.png');
  await writeFile(imageFile, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7S8AAAAASUVORK5CYII=', 'base64'));
  const asset = { id: 'minimap-a', categoryId: 'minimap-c', workspaceId: 'minimap-w', name: '小地图资产', description: '', storageMode: 'reference', selectedFilePath: file, sourceFilePath: file, originalFilePath: '', coverStorageMode: 'reference', selectedCoverPath: '', coverSourcePath: '', coverOriginalPath: '', useSourceAsCover: false, filePath: '', tags: [], notes: '', createdAt: now, x: -600, y: -300, width: 400, height: 300, zIndex: 1, locked: false };
  await invoke('save_asset', { item: asset });
  await invoke('save_asset', { item: { ...asset, id: 'minimap-far', name: '远处资产', x: 6000, y: 2500 } });
  await invoke('save_prompt', { item: { id: 'minimap-p', assetId: 'minimap-a', promptType: 'natural', positivePrompt: '', negativePrompt: '', naturalPrompt: '小地图原生样例', content: '原生画布', selectedImagePath: imageFile, sampleStorageMode: 'reference', sampleSourcePath: imageFile, sampleOriginalPath: '', sampleImagePath: imageFile, sampleFileName: 'isolated-sample.png', metadataJson: '', title: '原生对象', notes: '关联备注', createdAt: now, updatedAt: now } });
  await invoke('save_asset_detail_view_mode', { assetId: 'minimap-a', mode: 'canvas' });
  await page.reload(); await go('assets/minimap-w?category=minimap-c'); await map().waitFor();
  await page.waitForFunction(() => document.querySelectorAll('.minimap-asset').length === 2);
  const rect = await page.locator('[data-minimap-id="asset:minimap-a"]').boundingBox();
  await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
  const outerView = await view(), size = await page.locator('.asset-canvas').evaluate(node => ({ width: node.clientWidth, height: node.clientHeight }));
  near(outerView.x - 400 * outerView.zoom, size.width / 2); near(outerView.y - 150 * outerView.zoom, size.height / 2);
  await page.waitForFunction(async view => { const c = (await window.__TAURI_INTERNALS__.invoke('load_app_state')).categories.find(item => item.id === 'minimap-c'); return Math.abs(c.viewportX - view.x) < 1 && Math.abs(c.viewportY - view.y) < 1; }, outerView, { timeout: 12000 });
  await page.screenshot({ path: path.join(root, 'native-outer.png') });
  await map().screenshot({ path: path.join(root, 'native-minimap.png') });
  await page.getByRole('button', { name: '收起小地图', exact: true }).click(); assert.equal(await map().count(), 0);
  checks.push('真实外画布点击负坐标色块定位，视口保存到 SQLite，手动收起');
  await go('asset/minimap-w/minimap-a'); await page.waitForSelector('.asset-inner-canvas'); await map().waitFor();
  await page.getByRole('button', { name: '添加文字', exact: true }).click();
  await page.getByLabel('编辑文字块内容').fill('原生小地图文字'); await page.getByLabel('编辑文字块内容').press('Control+Enter');
  await page.waitForFunction(() => document.querySelectorAll('.minimap-text').length >= 1);
  await page.getByRole('button', { name: '适应全部', exact: true }).click(); await page.waitForTimeout(350);
  const hit = await map().locator('.minimap-viewport-hit').boundingBox(), innerBefore = await view();
  await page.mouse.move(hit.x + hit.width / 2, hit.y + hit.height / 2); await page.mouse.down(); await page.mouse.move(hit.x + hit.width / 2 + 12, hit.y + hit.height / 2 + 6, { steps: 5 }); await page.mouse.up();
  const innerView = await view(); assert.notEqual(innerView.x, innerBefore.x); assert.equal(innerView.zoom, innerBefore.zoom);
  await page.waitForFunction(async view => { const v = (await window.__TAURI_INTERNALS__.invoke('load_app_state')).innerCanvasViewports.find(item => item.assetId === 'minimap-a'); return v && Math.abs(v.viewportX - view.x) < 1 && Math.abs(v.viewportY - view.y) < 1; }, innerView);
  await page.screenshot({ path: path.join(root, 'native-inner.png') });
  await page.getByRole('button', { name: '标准详情', exact: true }).click(); await page.waitForSelector('.standard-text-surface'); assert.equal(await map().count(), 0);
  await page.getByRole('button', { name: '内画布', exact: true }).click(); await map().waitFor();
  checks.push('真实内画布新增文字同步，拖动小地图写入 SQLite，标准详情不重复显示');
  await close(); await launch();
  await go('assets/minimap-w?category=minimap-c'); await page.waitForSelector('.asset-canvas'); assert.equal(await map().count(), 0);
  const outerRestored = await view(); near(outerRestored.x, outerView.x); near(outerRestored.y, outerView.y);
  await page.getByRole('button', { name: '小地图', exact: true }).click(); await map().waitFor();
  await go('asset/minimap-w/minimap-a'); await page.waitForSelector('.asset-inner-canvas'); await map().waitFor();
  const innerRestored = await view(); near(innerRestored.x, innerView.x); near(innerRestored.y, innerView.y);
  assert.ok((await state()).assetTextElements.some(item => item.content === '原生小地图文字'));
  await page.screenshot({ path: path.join(root, 'native-restarted.png') });
  checks.push('正常退出并重新启动后，内外开关独立恢复，两个视口和新增文字恢复');
  assert.deepEqual(errors, []); await writeFile(path.join(root, 'result.json'), JSON.stringify({ checks, errors }, null, 2)); console.log(JSON.stringify({ checks, errors }, null, 2));
} finally { if (page && child?.exitCode === null) await close(); }
