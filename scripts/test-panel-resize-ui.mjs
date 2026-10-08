// Exercise real separators in the complete App against isolated in-memory IPC.
// All mouse/keyboard input targets a headless browser; no desktop window opens.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const baseUrl = process.env.UI_TEST_BASE_URL || 'http://127.0.0.1:1450';
const output = resolve(process.env.PANEL_RESIZE_REPORT_DIR || '.impeccable/evidence/panel-resize/interaction');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const checks = [], errors = [], measurements = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
const passed = message => { checks.push(message); console.log(`PASS ${message}`); };
const settle = () => page.waitForTimeout(150);
const state = () => page.evaluate(() => window.uiQA.state());
const pref = key => page.evaluate(key => localStorage.getItem(`creative-cloth.panel-size.${key}`), key);
const size = async locator => Number(await locator.getAttribute('aria-valuenow'));
const right = () => page.getByRole('separator', { name: '调整右侧属性面板宽度', exact: true });
const bottom = () => page.getByRole('separator', { name: '调整底部属性面板高度', exact: true });
const sidebar = domain => page.locator(`[data-resizable-sidebar="${domain}"]`).getByRole('separator', { name: '调整分类栏宽度', exact: true });
const snap = async name => page.screenshot({ path: join(output, `${name}.png`) });
const near = (actual, expected, context) => assert.ok(Math.abs(actual - expected) <= 2, `${context}: ${actual} != ${expected}`);
// Reload reconstructs fixture rows with fresh timestamps. Compare owned values
// and geometry across reloads while resizeEvidence also rejects every data write.
const withoutFixtureDates = rows => rows.map(({ createdAt, updatedAt, ...row }) => row);
const geometry = value => ({
  assets: value.assets.map(({ id, x, y, width, height, rotation, locked, zIndex }) => ({ id, x, y, width, height, rotation, locked, zIndex })),
  texts: withoutFixtureDates(value.categoryTextBlocks),
  elements: withoutFixtureDates(value.assetTextElements),
  layouts: value.assetTextLayouts,
  inner: value.innerCanvasObjects,
  viewports: value.innerCanvasViewports,
});
const dataCommands = new Set(['save_canvas_layout', 'save_canvas_transform', 'save_canvas_groups', 'save_category_text_changes', 'save_asset_text_changes', 'save_viewport', 'save_asset_inner_canvas_viewport', 'save_asset_note_drawer']);
const resizeEvidence = async action => {
  await settle();
  const before = geometry(await state());
  const from = await page.evaluate(() => window.uiQA.writes().length);
  await action();
  await settle();
  assert.deepEqual(geometry(await state()), before, 'resizing changed persisted object geometry/content');
  const writes = await page.evaluate(from => window.uiQA.writes().slice(from), from);
  assert.deepEqual(writes.filter(write => dataCommands.has(write.command)), [], 'resizing issued a data save');
};
const go = async route => {
  await page.evaluate(route => { location.hash = route; }, route);
  await page.waitForFunction(route => location.hash.replace(/^#\/?/, '') === route, route);
  await settle();
};
const openPanel = async () => {
  if (!(await page.locator('.ui-inspector').isVisible())) await page.getByRole('button', { name: '展开属性面板', exact: true }).click();
  await settle();
};
const chooseLayout = async layout => {
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '外观', exact: true }).click();
  await page.getByLabel('属性面板布局', { exact: true }).selectOption(layout);
  await page.waitForFunction(layout => window.uiQA.state().settings.propertyPanelLayout === layout, layout);
  await page.getByRole('button', { name: '返回上一层', exact: true }).click();
  await page.waitForSelector('.asset-canvas');
  await openPanel();
};
const pick = async locator => {
  await locator.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const event = { button: 0, pointerId: 79, clientX: rect.x + 20, clientY: rect.y + 20, bubbles: true };
    element.dispatchEvent(new PointerEvent('pointerdown', event));
    window.dispatchEvent(new PointerEvent('pointerup', event));
  });
  await settle();
};
const startDrag = async (locator, dx, dy) => {
  const box = await locator.boundingBox();
  assert.ok(box?.width > 0 && box?.height > 0, 'splitter is not usable');
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 8 }); await settle();
};
const drag = async (locator, dx, dy) => { await startDrag(locator, dx, dy); await page.mouse.up(); await settle(); };
const bounds = async locator => ({ min: Number(await locator.getAttribute('aria-valuemin')), max: Number(await locator.getAttribute('aria-valuemax')), value: await size(locator) });
const keyContract = async (locator, key, direction) => {
  const before = await size(locator);
  await locator.press(key); near(await size(locator), before + direction * 8, `${key} 8 logical pixels`);
  await locator.press(`Shift+${key}`); near(await size(locator), before + direction * 32, `Shift+${key} 24 logical pixels`);
  await locator.press('Home'); assert.equal(await size(locator), (await bounds(locator)).min);
  await locator.press('End'); assert.equal(await size(locator), (await bounds(locator)).max);
  await locator.dblclick(); await settle();
};

try {
  await page.goto(`${baseUrl}/scripts/verify-ui-system.html#assets/w1?category=c1`);
  await page.waitForSelector('[data-asset-id="a1"]'); await settle();
  const initial = geometry(await state());
  assert.equal(await right().getAttribute('aria-orientation'), 'vertical');
  await resizeEvidence(async () => {
    const before = await size(right());
    await drag(right(), -64, 0); near(await size(right()), before + 64, 'right mouse drag');
    assert.equal(Number(await pref('inspector.right')), await size(right()));
  });
  await snap('right-dragged'); passed('right border uses real pointer drag and saves only its UI size');

  await resizeEvidence(async () => {
    const before = await size(right()), saved = await pref('inspector.right');
    await startDrag(right(), -48, 0); assert.ok((await size(right())) > before);
    assert.equal(await pref('inspector.right'), saved, 'preview saved before mouse release');
    await page.keyboard.press('Escape'); await page.mouse.up(); await settle();
    assert.equal(await size(right()), before); assert.equal(await pref('inspector.right'), saved);
    assert.equal(await page.evaluate(() => document.documentElement.style.cursor), '');
    assert.equal(await page.evaluate(() => document.documentElement.style.userSelect), '');
  });
  passed('Escape cancels a live drag, retains the old preference and restores the cursor');

  const savedRight = await size(right());
  await page.reload(); await page.waitForSelector('[data-asset-id="a1"]'); await settle();
  near(await size(right()), savedRight, 'right reload');
  await resizeEvidence(() => keyContract(right(), 'ArrowLeft', 1));
  assert.equal(await pref('inspector.right'), null); near(await size(right()), 280, 'right reset');
  passed('right size survives reload; arrows, Shift, Home, End and double-click obey the accessible contract');

  await chooseLayout('bottom');
  assert.equal(await bottom().getAttribute('aria-orientation'), 'horizontal');
  near(await size(bottom()), 96, 'compact empty default');
  const emptyRect = await page.locator('.ui-inspector').boundingBox();
  measurements.push({ name: 'bottom-empty-default', ...emptyRect, aria: await size(bottom()) });
  assert.ok(emptyRect.height <= 100, JSON.stringify(emptyRect));
  await snap('bottom-empty-default');
  await pick(page.locator('[data-asset-id="a1"]'));
  near(await size(bottom()), 156, 'selection default');
  await snap('bottom-selected-default');
  passed('bottom defaults to a compact 96px empty strip and 156px for a selected object');

  await resizeEvidence(async () => {
    const before = await size(bottom());
    await drag(bottom(), 0, -88); near(await size(bottom()), before + 88, 'bottom upward mouse drag');
    assert.equal(Number(await pref('inspector.bottom')), await size(bottom()));
    assert.match(await page.locator('[data-asset-id="a1"]').getAttribute('class'), /selected/);
    await snap('bottom-dragged-larger');
  });
  passed('bottom shared border drags upward, preserves selection and keeps all object geometry unchanged');
  await page.getByRole('button', { name: '显示中轴线', exact: true }).click();
  assert.equal(await page.locator('.canvas-axis-guides').count(), 1);
  await resizeEvidence(async () => {
    const before = await size(bottom());
    await startDrag(bottom(), 0, -48);
    measurements.push({ name: 'axis-before-resize-escape', focusedRole: await page.evaluate(() => document.activeElement?.getAttribute('role')), activeAxis: await page.locator('.canvas-axis-guides').count(), size: await size(bottom()) });
    await page.keyboard.press('Escape'); await page.mouse.up(); await settle();
    assert.equal(await size(bottom()), before);
    assert.equal(await page.locator('.canvas-axis-guides').count(), 1, 'Escape during resize cleared canvas image axes');
  });
  await page.getByRole('button', { name: '关闭中轴线', exact: true }).click();
  passed('Escape during a panel drag preserves the active image axis and cancels only panel resizing');
  const savedBottom = await size(bottom());
  await page.reload(); await page.waitForSelector('[data-asset-id="a1"]'); await chooseLayout('bottom');
  near(await size(bottom()), savedBottom, 'bottom reload');
  await resizeEvidence(() => keyContract(bottom(), 'ArrowUp', 1));
  assert.equal(await pref('inspector.bottom'), null); near(await size(bottom()), 96, 'bottom reset empty');
  passed('bottom size persists independently and keyboard/reset behavior matches the right border');

  await pick(page.locator('[data-object-id="ct1"]'));
  await page.getByText('容器与行距', { exact: true }).click();
  await page.getByLabel('圆角', { exact: true }).scrollIntoViewIfNeeded();
  assert.equal(await page.getByLabel('圆角', { exact: true }).isVisible(), true);
  const fieldRect = await page.getByLabel('圆角', { exact: true }).boundingBox();
  const panelRect = await page.locator('.ui-inspector').boundingBox();
  assert.ok(fieldRect.y >= panelRect.y && fieldRect.y + fieldRect.height <= panelRect.y + panelRect.height + 1, JSON.stringify({ fieldRect, panelRect }));
  await page.getByLabel('圆角', { exact: true }).focus();
  await snap('bottom-text-advanced');
  assert.match(await page.locator('[data-object-id="ct1"]').getAttribute('class'), /selected/);
  passed('compact bottom retains scrollable advanced text controls without clearing the selected text');

  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.evaluate(() => document.documentElement.style.setProperty('--ui-scale', '1.5')); await settle();
  await openPanel();
  await resizeEvidence(async () => {
    const before = await size(bottom()); await drag(bottom(), 0, -60);
    near(await size(bottom()), before + 40, '150% drag converts physical to logical pixels');
  });
  await snap('bottom-scale150'); passed('150% UI scaling converts a 60 screen-pixel drag into 40 UI pixels');

  await page.setViewportSize({ width: 800, height: 640 }); await settle();
  assert.equal(await page.locator('.ui-inspector').isVisible(), false);
  assert.equal(await bottom().count(), 0);
  const stageBefore = await page.locator('.ui-editor-stage').boundingBox();
  await openPanel();
  const small = await bounds(bottom()), smallPanel = await page.locator('.ui-inspector').boundingBox();
  const stageAfter = await page.locator('.ui-editor-stage').boundingBox();
  assert.ok(small.value >= small.min && small.value <= small.max);
  assert.ok(smallPanel.y >= 0 && smallPanel.y + smallPanel.height <= 641);
  near(stageAfter.width, stageBefore.width, 'small overlay stage width'); near(stageAfter.height, stageBefore.height, 'small overlay stage height');
  await resizeEvidence(async () => { await bottom().press('End'); assert.equal(await size(bottom()), (await bounds(bottom())).max); });
  await snap('bottom-small-window');
  measurements.push({ name: 'bottom-small-window', bounds: small, panel: smallPanel, stage: stageAfter });
  passed('small windows clamp the panel and overlay it without changing measured canvas size');

  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.evaluate(() => document.documentElement.style.setProperty('--ui-scale', '1')); await settle();
  await openPanel(); await bottom().dblclick(); await settle();
  await resizeEvidence(async () => {
    await page.getByRole('button', { name: '收起属性面板', exact: true }).click();
    assert.equal(await bottom().count(), 0);
    await openPanel(); assert.equal(await bottom().isVisible(), true);
    await page.locator('.asset-canvas').focus(); await page.keyboard.press('Tab');
    await page.getByRole('button', { name: '返回界面', exact: true }).waitFor();
    assert.equal(await page.getByRole('separator').count(), 0);
    await page.getByRole('button', { name: '返回界面', exact: true }).click(); await settle();
    assert.equal(await bottom().isVisible(), true);
  });
  passed('collapsed and immersive UI expose no draggable invisible borders; exiting restores them');

  // Assets and scripts have separate left-border preferences and real content.
  await sidebar('assets').waitFor();
  await resizeEvidence(async () => {
    const before = await size(sidebar('assets')); await drag(sidebar('assets'), 72, 0);
    near(await size(sidebar('assets')), before + 72, 'asset left mouse drag');
    assert.equal(Number(await pref('sidebar.assets')), await size(sidebar('assets')));
  });
  const savedAssetSidebar = await size(sidebar('assets'));
  await page.reload(); await page.waitForSelector('[data-asset-id="a1"]'); await settle();
  near(await size(sidebar('assets')), savedAssetSidebar, 'asset sidebar reload');
  await resizeEvidence(() => keyContract(sidebar('assets'), 'ArrowRight', 1));
  assert.equal(await pref('sidebar.assets'), null); near(await size(sidebar('assets')), 224, 'asset sidebar reset');
  await resizeEvidence(async () => {
    await page.getByRole('button', { name: '收起侧边栏', exact: true }).click();
    assert.equal(await sidebar('assets').count(), 0);
    await page.getByRole('button', { name: '展开侧边栏', exact: true }).click();
    assert.equal(await sidebar('assets').isVisible(), true);
  });
  passed('asset left border drags, persists, supports keyboard/reset and hides on collapse');

  await go('scripts'); await page.waitForSelector('.core-script-list');
  near(await size(sidebar('scripts')), 224, 'script sidebar independent default');
  await resizeEvidence(async () => {
    await drag(sidebar('scripts'), 48, 0); near(await size(sidebar('scripts')), 272, 'script left mouse drag');
  });
  await page.reload(); await page.waitForSelector('.core-script-list'); await settle();
  near(await size(sidebar('scripts')), 272, 'script sidebar reload');
  await page.evaluate(() => document.documentElement.style.setProperty('--ui-scale', '1.5')); await settle();
  await resizeEvidence(async () => {
    const before = await size(sidebar('scripts')); await drag(sidebar('scripts'), 60, 0);
    near(await size(sidebar('scripts')), before + 40, '150% left border drag');
  });
  assert.equal(await pref('sidebar.assets'), null);
  passed('script left border has independent saved width and correct 150% drag geometry');

  assert.deepEqual(geometry(await state()), initial, 'resize-only flow altered application records');
  await page.evaluate(() => document.documentElement.style.setProperty('--ui-scale', '1'));
  await go('assets/w1?category=c1'); await chooseLayout('bottom');
  await resizeEvidence(() => drag(bottom(), 0, -64));
  const sharedBottom = await size(bottom());
  await go('asset/w1/a1'); await page.waitForSelector('.standard-text-surface'); await openPanel();
  near(await size(bottom()), sharedBottom, 'standard detail shared bottom height');
  await resizeEvidence(() => drag(bottom(), 0, -32));
  const detailBottom = await size(bottom());
  await page.getByRole('button', { name: '内画布', exact: true }).click();
  await page.waitForSelector('.asset-inner-canvas'); await openPanel();
  near(await size(bottom()), detailBottom, 'inner canvas shared bottom height');
  await resizeEvidence(() => drag(bottom(), 0, 24));
  const innerBottom = await size(bottom());
  await go('assets/w1?category=c1'); await openPanel();
  near(await size(bottom()), innerBottom, 'outer canvas shared bottom height');
  passed('outer, standard detail and inner canvas share the saved bottom height and resizing never changes their records');
  assert.deepEqual(errors, []);
  await writeFile(join(output, 'result.json'), JSON.stringify({ baseUrl, checks, errors, measurements, preferences: await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.startsWith('creative-cloth.panel-size.')))) }, null, 2));
  console.log(`PASS ${checks.length} real App panel resize scenarios; console clean; ${output}`);
} catch (error) {
  await snap('failure').catch(() => {});
  await writeFile(join(output, 'failure.json'), JSON.stringify({ checks, errors, measurements, error: String(error), dom: await page.locator('body').innerText().catch(() => ''), preferences: await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.startsWith('creative-cloth.panel-size.')))).catch(() => ({})) }, null, 2));
  throw error;
} finally { await browser.close(); }
