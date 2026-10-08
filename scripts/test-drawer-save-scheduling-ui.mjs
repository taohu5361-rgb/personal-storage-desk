import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const output = resolve(process.env.DRAWER_SAVE_REPORT_DIR || '.impeccable/evidence/fixed-save/drawers');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1300, height: 850 } });
// Other agents may edit shared modules during this run. Mock only Vite's HMR
// socket so a full-page hot reload cannot reset the isolated fixture mid-check.
await page.routeWebSocket('**', socket => socket.onMessage(() => {}));
const checks = [], errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('dialog', dialog => dialog.accept());
const note = () => page.locator('article[data-drawer-id="n1"]');
const saves = () => page.evaluate(() => window.noteSaveQA.calls.filter(call => ['save_asset_note_drawer', 'transfer_asset_note_drawer'].includes(call.command)));
const stored = () => page.evaluate(() => window.noteSaveQA.getStored().find(note => note.id === 'n1'));
const status = () => page.evaluate(() => window.noteSaveQA.status());
const passed = message => { checks.push(message); console.log(`PASS ${message}`); };
const edit = async (value, finish = true) => {
  await note().dispatchEvent('dblclick', { button: 0 });
  const editor = note().getByRole('textbox', { name: '备注内容', exact: true });
  await editor.fill(value);
  if (finish) await editor.press('Escape');
};
const move = async (locator, dx, dy) => {
  const rect = await locator.boundingBox();
  const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 8 }); await page.mouse.up();
  await page.waitForTimeout(80);
};
try {
  await page.goto(`${process.env.UI_TEST_BASE_URL || 'http://127.0.0.1:1450'}/scripts/verify-drawer-save.html`);
  await note().waitFor();
  await edit('输入后保持本地草稿', false);
  await page.waitForTimeout(420); assert.equal((await saves()).length, 0);
  await page.evaluate(() => window.noteSaveQA.tick()); assert.equal((await saves()).length, 0);
  assert.equal((await status()).active, true);
  await note().getByRole('textbox', { name: '备注内容', exact: true }).press('Escape');
  await page.waitForTimeout(420); assert.equal((await saves()).length, 0);
  assert.equal((await status()).dirty, true);
  await page.evaluate(() => window.noteSaveQA.tick());
  assert.equal((await saves()).length, 1); assert.equal((await stored()).text, '输入后保持本地草稿');
  assert.equal((await status()).dirty, false);
  passed('typing and blur produce no write; active editing skips the tick; completed text saves on the next tick');

  await move(note().locator('.asset-note-drawer-header'), 35, 25);
  await move(note().getByRole('button', { name: '调整备注抽屉大小 se', exact: true }), 30, 20);
  await note().click({ button: 'right' }); await page.getByRole('button', { name: '锁定备注', exact: true }).click();
  await note().click({ button: 'right' }); await page.getByRole('button', { name: '解锁备注', exact: true }).click();
  await page.waitForTimeout(420); assert.equal((await saves()).length, 1);
  assert.equal((await status()).dirty, true);
  await page.evaluate(() => window.noteSaveQA.tick());
  assert.equal((await saves()).length, 2);
  assert.ok((await stored()).width > 240 && (await stored()).floatingX > 800);
  passed('movement, resizing and locking remain drafts and merge into one completed snapshot at the tick');

  const beforeActive = (await saves()).length;
  const head = await note().locator('.asset-note-drawer-header').boundingBox();
  await page.mouse.move(head.x + head.width / 2, head.y + head.height / 2); await page.mouse.down();
  await page.mouse.move(head.x + head.width / 2 + 40, head.y + head.height / 2 + 35, { steps: 8 });
  assert.equal((await status()).active, true);
  await page.evaluate(() => window.noteSaveQA.tick()); assert.equal((await saves()).length, beforeActive);
  await page.evaluate(() => window.noteSaveQA.mode(false));
  assert.equal((await page.evaluate(() => window.noteSaveQA.leave())).accepted, true);
  await page.mouse.up();
  assert.equal((await status()).dirty, false); assert.equal((await saves()).length, beforeActive);
  await page.evaluate(() => window.noteSaveQA.mode(true));
  passed('an active drag skips autosave and a departure cancels its preview without turning it into a data write');

  await edit('重复保存请求共用一个快照');
  const beforeShared = (await saves()).length;
  await page.evaluate(() => { window.noteSaveQA.hold = true; window.noteSaveQA.startTick(); window.noteSaveQA.explicitPromise = window.noteSaveQA.flush(); });
  await page.waitForFunction(before => window.noteSaveQA.calls.filter(call => call.command === 'save_asset_note_drawer').length === before + 1, beforeShared);
  await page.evaluate(() => window.noteSaveQA.resume());
  await page.evaluate(() => Promise.all([window.noteSaveQA.waitTick(), window.noteSaveQA.explicitPromise]));
  assert.equal((await saves()).length, beforeShared + 1);
  passed('simultaneous owner and parent save requests share one in-flight frozen snapshot');

  await edit('固定时刻快照');
  const beforeFrozen = (await saves()).length;
  await page.evaluate(() => { window.noteSaveQA.hold = true; window.noteSaveQA.startTick(); });
  await page.waitForFunction(before => window.noteSaveQA.calls.filter(call => call.command === 'save_asset_note_drawer').length === before + 1, beforeFrozen);
  await edit('保存进行时的新编辑');
  await page.evaluate(() => { window.noteSaveQA.resume(); });
  await page.evaluate(() => window.noteSaveQA.waitTick());
  assert.equal((await saves()).length, beforeFrozen + 1); assert.equal((await stored()).text, '固定时刻快照');
  assert.equal((await status()).dirty, true);
  assert.equal(await note().locator('.asset-note-drawer-text').innerText(), '保存进行时的新编辑');
  await page.evaluate(() => window.noteSaveQA.tick());
  assert.equal((await saves()).length, beforeFrozen + 2); assert.equal((await stored()).text, '保存进行时的新编辑');
  passed('an asynchronous tick freezes one snapshot and never drains later typing into extra writes');

  await edit('失败也保留的备注');
  await page.evaluate(() => { window.noteSaveQA.fail = true; });
  await page.evaluate(() => window.noteSaveQA.tick().catch(() => {}));
  await page.getByRole('alert').waitFor();
  assert.equal((await status()).dirty, true); assert.equal(await note().locator('.asset-note-drawer-text').innerText(), '失败也保留的备注');
  await page.getByRole('button', { name: '重试保存', exact: true }).click();
  await page.getByRole('alert').waitFor({ state: 'detached' });
  assert.equal((await stored()).text, '失败也保留的备注');
  passed('failed saves retain the complete dirty draft and explicit retry acknowledges the intended value');

  await page.evaluate(() => window.noteSaveQA.mode(false));
  await edit('手动模式未保存');
  const beforeManual = (await saves()).length;
  await page.evaluate(() => window.noteSaveQA.tick());
  const leave = await page.evaluate(() => window.noteSaveQA.leave());
  assert.equal(leave.accepted, false); assert.match(leave.error, /请先点击保存/);
  assert.equal((await saves()).length, beforeManual); assert.equal((await status()).dirty, true);
  await page.getByRole('button', { name: '手动保存备注', exact: true }).click();
  await page.waitForFunction(() => window.noteSaveQA.getStored().find(note => note.id === 'n1').text === '手动模式未保存');
  assert.equal((await page.evaluate(() => window.noteSaveQA.leave())).accepted, true);
  passed('manual mode rejects a dirty departure without writing, and the explicit Save button clears that guard');

  await page.evaluate(() => window.noteSaveQA.mode(true));
  await edit('自动模式安全离页');
  const autoLeave = await page.evaluate(() => window.noteSaveQA.leave());
  assert.equal(autoLeave.accepted, true); assert.equal((await stored()).text, '自动模式安全离页');
  passed('automatic mode still safely flushes a deliberate departure');

  const beforeScale = (await saves()).length;
  await note().getByRole('button', { name: '文字缩放', exact: true }).click();
  await page.getByRole('spinbutton', { name: '文字缩放百分比', exact: true }).fill('185');
  await page.getByRole('button', { name: '关闭文字缩放设置', exact: true }).click();
  await page.waitForTimeout(420); assert.equal((await saves()).length, beforeScale);
  await page.evaluate(() => window.noteSaveQA.tick());
  assert.equal((await saves()).length, beforeScale + 1); assert.equal((await stored()).textScale, 1.85);
  passed('text scale controls leave a dirty local value and write once at the next fixed tick');

  const beforeAttachment = (await saves()).length;
  await note().getByRole('button', { name: '更换附属资产：独立备注', exact: true }).click();
  await page.getByRole('dialog', { name: '选择附属资产', exact: true }).getByRole('button', { name: '参考一', exact: true }).click();
  await note().getByRole('button', { name: '收起备注', exact: true }).click();
  await page.waitForTimeout(420); assert.equal((await saves()).length, beforeAttachment);
  assert.equal((await stored()).assetId, null);
  await page.evaluate(() => window.noteSaveQA.tick());
  assert.equal((await saves()).length, beforeAttachment + 1);
  assert.equal((await stored()).assetId, 'a1'); assert.equal((await stored()).mode, 'docked-collapsed');
  await page.locator('button.asset-note-drawer-handle[data-drawer-id="n1"]').click();
  assert.equal((await saves()).length, beforeAttachment + 1);
  await page.evaluate(() => window.noteSaveQA.tick());
  assert.equal((await stored()).mode, 'docked-expanded');
  passed('attachment transfer and collapse/expand retain identity while waiting for the fixed tick');

  const beforeCreate = (await saves()).length;
  await page.evaluate(() => window.noteSaveQA.add());
  const createdId = await page.evaluate(() => window.noteSaveQA.getStored().find(note => note.id !== 'n1').id);
  const created = page.locator(`article[data-drawer-id="${createdId}"]`);
  await created.getByRole('textbox', { name: '备注内容', exact: true }).fill('新增后尚未保存的文字');
  await created.getByRole('textbox', { name: '备注内容', exact: true }).press('Escape');
  assert.equal((await saves()).length, beforeCreate);
  await created.click({ button: 'right' }); await page.getByRole('button', { name: '删除备注', exact: true }).click();
  await created.waitFor({ state: 'detached' });
  assert.equal((await saves()).length, beforeCreate);
  assert.equal(await page.evaluate(id => window.noteSaveQA.getStored().some(note => note.id === id), createdId), false);
  passed('explicit create/delete use their required commands and do not flush the unsaved editing draft');

  await page.evaluate(() => window.noteSaveQA.mode(false));
  await edit('卸载不得偷写');
  const beforeUnmount = (await saves()).length;
  await page.evaluate(() => window.noteSaveQA.mount(false));
  await note().waitFor({ state: 'detached' }); await page.waitForTimeout(420);
  assert.equal((await saves()).length, beforeUnmount);
  assert.equal((await stored()).text, '自动模式安全离页');
  passed('unmount cleanup cancels interaction resources and performs no hidden manual-mode save');
  assert.deepEqual(errors, []);
  await writeFile(join(output, 'result.json'), JSON.stringify({ checks, errors, calls: await page.evaluate(() => window.noteSaveQA.calls) }, null, 2));
  console.log(`PASS ${checks.length} note scheduling scenarios; console clean; ${output}`);
} catch (error) {
  await page.screenshot({ path: join(output, 'failure.png') }).catch(() => {});
  await writeFile(join(output, 'failure.json'), JSON.stringify({ checks, errors, error: String(error), dom: await page.locator('body').innerText(), calls: await page.evaluate(() => window.noteSaveQA?.calls) }, null, 2));
  throw error;
} finally { await browser.close(); }
