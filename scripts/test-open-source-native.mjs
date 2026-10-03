// Full acceptance of a fresh synthetic debug profile; never launch release.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { isolatedDirectory, debugExecutable, connectIsolated, qaBaseURL } from './qa-support.mjs';

const output = isolatedDirectory(import.meta.url);
const root = path.join(output, `run-${Date.now()}`);
await mkdir(root, { recursive: true });
const executable = debugExecutable();
const checks = [], errors = [], launches = [];
let child, browser, page;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const invoke = (command, args = {}) => page.evaluate(({ command, args }) => window.__TAURI_INTERNALS__.invoke(command, args), { command, args });
const state = () => invoke('load_app_state');
const block = id => page.locator(`[data-object-id="${id}"]`);
const pass = name => { checks.push(name); console.log(`PASS ${name}`); };
async function observe(predicate) {
  for (let n = 0; n < 100; n++) {
    const current = await state();
    if (predicate(current)) return current;
    await delay(100);
  }
  throw Error('Timed out waiting for a native SQLite save');
}
async function launch() {
  child = spawn(executable, [], {
    windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, CREATIVE_CLOTH_TEST_DATA_DIR: root,
      WEBVIEW2_USER_DATA_FOLDER: path.join(root, 'webview'),
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=9468' },
  });
  const record = { pid: child.pid, output: '' }; launches.push(record);
  child.stdout.on('data', bytes => { record.output += bytes.toString(); });
  child.stderr.on('data', bytes => { record.output += bytes.toString(); });
  let lastError;
  for (let n = 0; n < 100; n++) {
    if (child.exitCode !== null) throw Error(`Debug application exited early: ${record.output}`);
    try { browser = await connectIsolated('http://127.0.0.1:9468', root); break; }
    catch (error) { lastError = error; await delay(150); }
  }
  assert.ok(browser, `Isolated debug WebView unavailable: ${lastError?.message}`);
  page = browser.contexts()[0].pages()[0];
  page.on('pageerror', error => errors.push(error.message));
  assert.ok(page.url().startsWith(qaBaseURL), `Expected configured dev URL ${qaBaseURL}`);
  await page.waitForFunction(() => window.__TAURI_INTERNALS__ && !document.querySelector('.boot-screen'));
  assert.equal(await page.locator('.titlebar-brand').innerText(), '个人收纳台');
  assert.equal(await invoke('plugin:window|title', { label: 'main' }), '个人收纳台');
}
async function closeNormally() {
  const exited = new Promise((resolve, reject) => {
    child.once('exit', resolve); child.once('error', reject);
  });
  await invoke('plugin:window|close', { label: 'main' }).catch(error => {
    if (!/closed|destroyed|Target/i.test(error.message)) throw error;
  });
  const code = await Promise.race([exited, delay(15000).then(() => { throw Error('Normal close did not exit'); })]);
  assert.equal(code, 0);
  await browser.close().catch(() => {}); browser = null;
}
const navigate = async hash => { await page.evaluate(hash => { location.hash = hash; }, hash); };

try {
  await launch();
  let current = await state();
  assert.deepEqual(current.workspaces, []); assert.deepEqual(current.assets, []);
  assert.deepEqual(current.categories, []);
  assert.ok(path.resolve(current.databasePath).startsWith(root + path.sep));
  assert.ok(path.resolve(current.settings.managedAssetDir).startsWith(root + path.sep));
  await page.screenshot({ path: path.join(root, '01-first-empty-start.png') });
  pass('fresh SQLite profile starts empty and frontend/window both show 个人收纳台');

  const now = Date.now();
  await invoke('save_workspace', { item: { id: 'open-source-workspace', name: '合成收纳空间', description: '', coverPath: '', notes: '', createdAt: now, updatedAt: now } });
  await invoke('save_category', { item: { id: 'open-source-category', workspaceId: 'open-source-workspace', name: '合成材料分类', description: '', icon: '', createdAt: now, updatedAt: now, viewportX: 0, viewportY: 0, zoom: 1, canvasColor: '#191d21', canvasPattern: 'dots' } });
  const sources = path.join(root, 'synthetic-sources'); await mkdir(sources);
  const managedSource = path.join(sources, 'creative-material.blend');
  const referencedSource = path.join(sources, 'reference.material-demo');
  const managedBytes = Buffer.from('Synthetic arbitrary-extension managed material\n中文材料\n');
  const referencedBytes = Buffer.from('Synthetic arbitrary-extension reference material\n保持源文件\n');
  await writeFile(managedSource, managedBytes); await writeFile(referencedSource, referencedBytes);
  const cover = path.join(sources, 'cover.png');
  await writeFile(cover, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8QAAAABJRU5ErkJggg==', 'base64'));
  const base = { categoryId: 'open-source-category', workspaceId: 'open-source-workspace', description: '仅合成数据', originalFilePath: '', coverStorageMode: 'reference', selectedCoverPath: cover, coverSourcePath: cover, coverOriginalPath: '', useSourceAsCover: false, filePath: '', tags: [], notes: '', createdAt: now, x: 60, y: 60, width: 280, height: 210, zIndex: 1, locked: false };
  const managed = await invoke('save_asset', { item: { ...base, id: 'managed-material', name: '托管合成材料', storageMode: 'managed', selectedFilePath: managedSource, sourceFilePath: '' } });
  const referenced = await invoke('save_asset', { item: { ...base, id: 'reference-material', name: '引用合成材料', x: 430, storageMode: 'reference', selectedFilePath: referencedSource, sourceFilePath: referencedSource } });
  assert.notEqual(managed.originalFilePath, managedSource);
  assert.ok(path.resolve(managed.originalFilePath).startsWith(root + path.sep));
  assert.equal(hash(await readFile(managed.originalFilePath)), hash(managedBytes));
  assert.equal(hash(await readFile(managedSource)), hash(managedBytes));
  assert.equal(referenced.sourceFilePath, referencedSource); assert.equal(referenced.originalFilePath, '');
  assert.equal(hash(await readFile(referencedSource)), hash(referencedBytes));
  await invoke('save_asset_detail_view_mode', { assetId: managed.id, mode: 'standard' });
  current = await state();
  await invoke('save_settings', { item: { ...current.settings, closeBehavior: 'exit' } });
  await page.reload(); await page.waitForFunction(() => !document.querySelector('.boot-screen'));
  pass('managed .blend imports an exact isolated copy; reference .material-demo preserves its source path and bytes');

  await navigate('asset/open-source-workspace/managed-material');
  await page.waitForSelector('.standard-text-surface');
  await page.getByRole('button', { name: '添加文字', exact: true }).click();
  await page.getByLabel('编辑文字块内容').fill('标准详情创建的共享文字 Native 中文');
  await page.getByLabel('编辑文字块内容').press('Control+Enter');
  current = await observe(data => data.assetTextElements.length === 1 && data.assetTextElements[0].content.includes('Native'));
  const textId = current.assetTextElements[0].id;
  const standardLayout = current.assetTextLayouts.find(item => item.viewMode === 'standard');
  assert.ok(standardLayout);
  await page.screenshot({ path: path.join(root, '02-standard-text.png') });
  await page.getByRole('button', { name: '内画布', exact: true }).click();
  await page.waitForSelector('.asset-inner-canvas');
  current = await observe(data => data.assetTextLayouts.some(item => item.viewMode === 'canvas'));
  assert.match(await block(textId).innerText(), /共享文字 Native 中文/);
  assert.deepEqual(current.assetTextLayouts.find(item => item.viewMode === 'standard'), standardLayout);
  await page.getByRole('button', { name: '适应全部', exact: true }).click();
  const canvasLayout = current.assetTextLayouts.find(item => item.viewMode === 'canvas');
  const bounds = await block(textId).boundingBox(); assert.ok(bounds);
  const zoom = await page.locator('.inner-canvas-world').evaluate(element => new DOMMatrix(getComputedStyle(element).transform).a);
  await page.mouse.move(bounds.x + 18, bounds.y + 18); await page.mouse.down();
  await page.mouse.move(bounds.x + 18 + 55 * zoom, bounds.y + 18 + 35 * zoom, { steps: 8 }); await page.mouse.up();
  current = await observe(data => Math.abs(data.assetTextLayouts.find(item => item.viewMode === 'canvas').x - canvasLayout.x) > 5);
  assert.deepEqual(current.assetTextLayouts.find(item => item.viewMode === 'standard'), standardLayout);
  await block(textId).dblclick();
  await page.getByLabel('编辑文字块内容').fill('内画布编辑后标准详情共享同一内容');
  await page.getByLabel('编辑文字块内容').press('Control+Enter');
  current = await observe(data => data.assetTextElements[0].content === '内画布编辑后标准详情共享同一内容');
  const independentLayouts = structuredClone(current.assetTextLayouts);
  await page.screenshot({ path: path.join(root, '03-inner-shared-text-independent-layout.png') });
  await page.getByRole('button', { name: '标准详情', exact: true }).click();
  await page.waitForSelector('.standard-text-surface');
  assert.match(await block(textId).innerText(), /内画布编辑后标准详情共享同一内容/);
  assert.deepEqual((await state()).assetTextLayouts, independentLayouts);
  pass('standard text shares content with inner canvas; inner text drag saves independent layout and preserves standard layout');

  await navigate('assets/open-source-workspace?category=open-source-category');
  await page.waitForSelector('.outer-text-surface');
  await page.getByRole('button', { name: '添加文字', exact: true }).click();
  await page.getByLabel('编辑文字块内容').fill('外画布的分类文字独立保存');
  await page.getByLabel('编辑文字块内容').press('Control+Enter');
  current = await observe(data => data.categoryTextBlocks.length === 1 && data.categoryTextBlocks[0].content === '外画布的分类文字独立保存');
  const outerId = current.categoryTextBlocks[0].id;
  assert.equal(current.assetTextElements[0].content, '内画布编辑后标准详情共享同一内容');
  await page.screenshot({ path: path.join(root, '04-outer-category-text.png') });
  pass('outer category annotation saves through UI and stays separate from asset shared text');
  const expected = { assets: current.assets, elements: current.assetTextElements, layouts: current.assetTextLayouts, outer: current.categoryTextBlocks.map(item => ({ ...item, content: '关闭前未失焦的外画布最新草稿' })) };
  await block(outerId).dblclick(); await page.getByLabel('编辑文字块内容').fill('关闭前未失焦的外画布最新草稿');
  await closeNormally();
  pass('normal desktop close exits process while flushing the focused outer text draft');

  await launch();
  current = await state();
  const withoutTimestamp = items => items.map(({ updatedAt, ...rest }) => rest);
  assert.deepEqual(withoutTimestamp(current.assets), withoutTimestamp(expected.assets));
  assert.deepEqual(withoutTimestamp(current.assetTextElements), withoutTimestamp(expected.elements));
  assert.deepEqual(current.assetTextLayouts, expected.layouts);
  assert.deepEqual(withoutTimestamp(current.categoryTextBlocks), withoutTimestamp(expected.outer));
  assert.equal(hash(await readFile(managed.originalFilePath)), hash(managedBytes));
  assert.equal(hash(await readFile(managedSource)), hash(managedBytes));
  assert.equal(hash(await readFile(referencedSource)), hash(referencedBytes));
  await access(current.databasePath);
  await navigate('assets/open-source-workspace?category=open-source-category'); await page.waitForSelector('.outer-text-surface');
  assert.match(await block(outerId).innerText(), /关闭前未失焦的外画布最新草稿/);
  await page.screenshot({ path: path.join(root, '05-restarted-outer.png') });
  await navigate('asset/open-source-workspace/managed-material'); await page.waitForSelector('.standard-text-surface');
  assert.match(await block(textId).innerText(), /内画布编辑后标准详情共享同一内容/);
  await page.getByRole('button', { name: '内画布', exact: true }).click(); await page.waitForSelector('.asset-inner-canvas');
  assert.match(await block(textId).innerText(), /内画布编辑后标准详情共享同一内容/);
  assert.deepEqual((await state()).assetTextLayouts, expected.layouts);
  await page.screenshot({ path: path.join(root, '06-restarted-inner.png') });
  pass('real process restart restores managed/reference records, exact file bytes, shared text, independent layouts and outer close draft');
  await closeNormally();
  assert.deepEqual(errors, []);
  const report = { passed: true, profile: 'debug_assertions isolated synthetic desktop', root, executable, devURL: qaBaseURL, checks, errors, launches, sourceHashes: { managed: hash(managedBytes), reference: hash(referencedBytes) }, productionRuntime: 'not tested' };
  await writeFile(path.join(root, 'result.json'), JSON.stringify(report, null, 2));
  await writeFile(path.join(output, 'latest-result.json'), JSON.stringify(report, null, 2));
  console.log(`RESULT ${path.join(root, 'result.json')}`);
} catch (error) {
  await page?.screenshot({ path: path.join(root, 'failure.png') }).catch(() => {});
  await writeFile(path.join(root, 'failure.json'), JSON.stringify({ passed: false, root, checks, errors, error: error.stack, launches }, null, 2));
  throw error;
} finally {
  await browser?.close().catch(() => {});
  if (child && child.exitCode === null) child.kill();
}
