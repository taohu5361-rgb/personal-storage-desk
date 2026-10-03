import { reportDirectory, browserOptions, qaBaseURL, debugExecutable, connectIsolated, isolatedDirectory } from './qa-support.mjs';
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from 'playwright';
const root=isolatedDirectory(import.meta.url);
const output = root;
const phase = process.argv[3] || "exercise";
mkdirSync(output, { recursive: true });
const browser = await connectIsolated(process.env.DRAWER_NATIVE_CDP || "http://127.0.0.1:9237", root);
const page = browser.contexts().flatMap((context) => context.pages()).find((page) => page.url().includes("native=1"));
assert.ok(page, "Use the isolated native fixture, never a normal user window");
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const panel = (side) => page.locator(`article[data-drawer-id="drawer-${side}"]`);
const head = (side) => page.locator(`button.asset-note-drawer-handle[data-drawer-id="drawer-${side}"]`);
const persisted = () => page.evaluate(() => window.drawerQA.readNative());
const waitSave = (side, mode) => page.waitForFunction(async ({ side, mode }) =>
  (await window.drawerQA.readNative()).find((drawer) => drawer.id === `drawer-${side}`)?.mode === mode, { side, mode });
try {
  await page.waitForFunction(() => window.__TAURI_INTERNALS__ && window.drawerQA && document.querySelectorAll("article.asset-note-drawer").length === 4);
  await page.evaluate(() => window.drawerQA.setZoom(0.65));
  await page.waitForFunction(() => window.drawerQA.getViewport().zoom === 0.65);
  if (phase === "exercise") {
    assert.ok((await persisted()).every((drawer) => drawer.mode === "docked-expanded"), "Legacy records migrate to expanded docking");
    for (const side of ["left", "right", "top", "bottom"]) {
      await panel(side).getByRole("button", { name: "收起备注" }).click(); await waitSave(side, "docked-collapsed");
    }
    await head("right").click(); await waitSave("right", "docked-expanded");
    await panel("right").locator(".asset-note-drawer-text").dblclick();
    const editor = panel("right").getByRole("textbox", { name: "备注内容" });
    await editor.fill("真实 Tauri 备注\n重启恢复校验"); await editor.press("Escape");
    await page.waitForFunction(async () => (await window.drawerQA.readNative()).find((drawer) => drawer.id === "drawer-right").text === "真实 Tauri 备注\n重启恢复校验");
    const rect = await panel("right").boundingBox();
    await page.mouse.move(rect.x + 20, rect.y + 12); await page.mouse.down();
    await page.mouse.move(rect.x + 85, rect.y + 12, { steps: 6 });
    await page.mouse.move(1170, 600, { steps: 8 }); await page.mouse.up();
    await waitSave("right", "floating");
    await head("top").focus(); await page.keyboard.press("Space"); await waitSave("top", "docked-expanded");
    const records = await persisted();
    assert.deepEqual(records.map((drawer) => drawer.mode), ["docked-collapsed", "floating", "docked-expanded", "docked-collapsed"]);
    writeFileSync(path.join(output, "expected-after-restart.json"), JSON.stringify(records, null, 2));
    await page.waitForTimeout(240);
    await page.screenshot({ path: path.join(output, "native-three-states.png") });
    writeFileSync(path.join(output, "native-exercise.json"), JSON.stringify({ passed: ["旧记录原生迁移", "四向开合写入 SQLite", "中文编辑写入 SQLite", "鼠标脱离保存自由态", "把手空格展开"], errors }, null, 2));
  } else {
    const expected = JSON.parse(readFileSync(path.join(output, "expected-after-restart.json"), "utf8"));
    assert.deepEqual(await persisted(), expected);
    for (const record of expected) assert.equal(await panel(record.side).getAttribute("data-mode"), record.mode);
    const before = await panel("right").boundingBox();
    await page.evaluate(() => window.drawerQA.moveAsset("asset-right", -80, 40));
    assert.deepEqual(await panel("right").boundingBox(), before);
    await page.screenshot({ path: path.join(output, "native-after-restart.png") });
    writeFileSync(path.join(output, "native-restart.json"), JSON.stringify({ passed: ["原生进程重启后数据库内容完整一致", "三态与自由坐标恢复", "自由卡片不跟随图片移动"], errors }, null, 2));
  }
  assert.deepEqual(errors, []);
  console.log(`PASS native ${phase}; ${output}`);
} catch (error) {
  await page.screenshot({ path: path.join(output, `native-${phase}-failure.png`) }).catch(() => {});
  throw error;
} finally { await browser.close(); }
