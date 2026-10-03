import { reportDirectory, browserOptions, qaBaseURL } from './qa-support.mjs';
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from 'playwright';
const output = path.resolve(reportDirectory(import.meta.url));
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({...browserOptions,  headless: true });
const context = await browser.newContext({ viewport: { width: 1920, height: 1200 } });
const page = await context.newPage();
const errors = [];
const checks = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
const url = process.env.DRAWER_QA_URL || `${qaBaseURL}/scripts/drawer-qa.html`;
const panel = (side) => page.locator(`article[data-drawer-id="drawer-${side}"]`);
const head = (side) => page.locator(`button.asset-note-drawer-handle[data-drawer-id="drawer-${side}"]`);
const waitMode = async (side, mode) => {
  await page.waitForFunction(({ side, mode }) => document.querySelector(`article[data-drawer-id="drawer-${side}"]`)?.dataset.mode === mode, { side, mode });
};
const savedMode = async (side, mode) => {
  await page.waitForFunction(({ side, mode }) => window.drawerQA.getStored().find((drawer) => drawer.id === `drawer-${side}`)?.mode === mode, { side, mode });
};
const reset = async () => {
  await page.evaluate(() => { window.drawerQA.saveDelay = 0; window.drawerQA.failNext = false; window.drawerQA.reset(); });
  await page.waitForFunction(() => document.querySelectorAll('article.asset-note-drawer[data-mode="docked-expanded"]').length === 4);
};
const geometry = async () => page.evaluate(() => {
  const plain = (element) => { const r = element.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
  return [...document.querySelectorAll("article.asset-note-drawer")].map((article) => {
    const image = article.closest(".canvas-asset-image")?.querySelector("img");
    const handle = document.querySelector(`button.asset-note-drawer-handle[data-drawer-id="${article.dataset.drawerId}"]`);
    const styles = getComputedStyle(article);
    return { side: article.dataset.side, mode: article.dataset.mode, rect: plain(article), image: image && plain(image),
      handle: handle && plain(handle), corners: styles.borderRadius, inert: article.inert, clip: styles.clipPath };
  });
});
const gap = ({ side, rect, image }) => side === "left" ? image.left - rect.right : side === "right" ? rect.left - image.right : side === "top" ? image.top - rect.bottom : rect.top - image.bottom;

try {
  await page.goto(url);
  await page.waitForFunction(() => window.drawerQA && document.querySelectorAll("article.asset-note-drawer").length === 4);
  for (const item of await geometry()) assert.ok(Math.abs(gap(item)) < 0.01, JSON.stringify(item));
  await page.screenshot({ path: path.join(output, "dark-expanded.png") });
  checks.push("四边展开零间隙与图片挂载层");

  await panel("right").getByRole("button", { name: "收起备注" }).click();
  await page.waitForTimeout(50);
  assert.notEqual(await panel("right").locator(".asset-note-drawer-content").evaluate((node) => getComputedStyle(node).transform), "none");
  await head("right").click(); await waitMode("right", "docked-expanded"); await savedMode("right", "docked-expanded");
  await page.waitForTimeout(240);
  const reversed = (await geometry()).find((item) => item.side === "right");
  assert.ok(Math.abs(gap(reversed)) < 0.01);
  checks.push("收起中反向展开，文字保持完整尺寸且最终仍贴边");

  for (const side of ["left", "right", "top", "bottom"]) {
    await panel(side).getByRole("button", { name: "收起备注" }).click();
    await waitMode(side, "docked-collapsed"); await savedMode(side, "docked-collapsed");
    assert.equal(await panel(side).getAttribute("inert"), "");
    assert.equal(await panel(side).locator(".asset-note-drawer-resize").count(), 0);
    assert.equal(await head(side).getAttribute("aria-expanded"), "false");
  }
  await page.waitForTimeout(240);
  for (const item of await geometry()) {
    assert.ok(Math.abs(gap({ ...item, rect: item.handle })) < 0.01);
    assert.equal(Math.round(item.handle.width * item.handle.height), 24 * 48);
    assert.equal(item.inert, true);
  }
  assert.equal(await page.evaluate(() => [...document.querySelectorAll("article.asset-note-drawer.collapsed")].some((article) => {
    const r = article.getBoundingClientRect();
    return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest("article.asset-note-drawer") === article;
  })), false);
  await page.screenshot({ path: path.join(output, "dark-collapsed.png") });
  const caption = await page.locator(".canvas-asset-caption").last().boundingBox();
  const bottomHead = await head("bottom").boundingBox();
  assert.ok(caption.y >= bottomHead.y + bottomHead.height);
  checks.push("四边收起小把手、正文不可交互与底部名称避让");

  for (const theme of ["light", "dark"]) for (const zoom of [0.5, 0.83, 1, 2]) {
    await page.evaluate(({ theme, zoom }) => {
      document.documentElement.dataset.theme = theme; document.documentElement.dataset.effectiveTheme = theme;
      window.drawerQA.setZoom(zoom);
    }, { theme, zoom });
    await page.waitForFunction((zoom) => window.drawerQA.getViewport().zoom === zoom, zoom);
    for (const item of await geometry()) {
      assert.ok(Math.abs(gap({ ...item, rect: item.handle })) < 0.05);
      assert.ok(Math.abs(item.handle.width * item.handle.height - 24 * 48 * zoom * zoom) < 0.05);
    }
  }
  await page.evaluate(() => { document.documentElement.dataset.theme = "light"; document.documentElement.dataset.effectiveTheme = "light"; window.drawerQA.setZoom(1); });
  await page.screenshot({ path: path.join(output, "light-collapsed.png") });
  checks.push("深浅主题四种缩放下的收起把手保持贴边");

  for (const side of ["left", "right", "top", "bottom"]) {
    await head(side).focus(); await page.keyboard.press("Enter");
    await waitMode(side, "docked-expanded"); await savedMode(side, "docked-expanded");
  }
  assert.equal(await page.evaluate(() => window.drawerQA.opens), 0);
  checks.push("四向键盘展开，按钮不触发图片打开");

  for (const theme of ["light", "dark"]) for (const zoom of [0.5, 0.83, 1, 2]) {
    await page.evaluate(({ theme, zoom }) => {
      document.documentElement.dataset.theme = theme; document.documentElement.dataset.effectiveTheme = theme;
      window.drawerQA.setZoom(zoom);
    }, { theme, zoom });
    await page.waitForFunction((zoom) => window.drawerQA.getViewport().zoom === zoom, zoom);
    for (const item of await geometry()) assert.ok(Math.abs(gap(item)) < 0.05, `${theme}/${zoom}/${JSON.stringify(item)}`);
  }
  await page.evaluate(() => { document.documentElement.dataset.theme = "light"; document.documentElement.dataset.effectiveTheme = "light"; window.drawerQA.setZoom(1); });
  await page.screenshot({ path: path.join(output, "light-expanded.png") });
  checks.push("深浅主题及 50%、83%、100%、200% 缩放接缝");

  await panel("right").locator(".asset-note-drawer-text").dblclick();
  const editor = panel("right").getByRole("textbox", { name: "备注内容" });
  await page.evaluate(() => { window.drawerQA.saveDelay = 180; });
  await editor.fill("第一轮编辑"); await page.waitForTimeout(350);
  await editor.fill("中文输入后的最新备注\n第二行保留");
  // Simulate an IME's final DOM value before composition-end/change delivery.
  await editor.evaluate((node) => { node.value += "，组合输入末字"; });
  await panel("right").getByRole("button", { name: "收起备注" }).click();
  await page.waitForFunction(() => {
    const d = window.drawerQA.getStored().find((drawer) => drawer.id === "drawer-right");
    return d.mode === "docked-collapsed" && d.text.endsWith("组合输入末字");
  });
  await head("right").click(); await waitMode("right", "docked-expanded"); await savedMode("right", "docked-expanded");
  assert.match(await panel("right").locator(".asset-note-drawer-text").innerText(), /组合输入末字/);
  await page.evaluate(() => { window.drawerQA.saveDelay = 0; });
  checks.push("编辑与延迟保存竞态、收起保留组合输入末字");

  await panel("left").locator(".asset-note-drawer-text").dblclick();
  await panel("left").getByRole("textbox").fill("保存失败后也必须保留文字");
  await page.evaluate(() => { window.drawerQA.failNext = true; });
  await panel("left").getByRole("button", { name: "收起备注" }).click();
  await page.getByRole("status").filter({ hasText: "模拟保存失败" }).waitFor();
  await waitMode("left", "docked-expanded");
  assert.equal(await panel("left").locator(".asset-note-drawer-text").innerText(), "保存失败后也必须保留文字");
  checks.push("失败回滚布局并保留最新文字");

  await reset();
  const before = await panel("right").boundingBox();
  await page.mouse.move(before.x + 30, before.y + 18); await page.mouse.down();
  await page.mouse.move(before.x + 110, before.y + 18, { steps: 6 });
  await page.mouse.move(1820, 500, { steps: 8 }); await page.mouse.up();
  await waitMode("right", "floating"); await savedMode("right", "floating");
  assert.equal(await panel("right").evaluate((node) => !!node.closest(".asset-note-dock-host")), false);
  const free = await panel("right").boundingBox();
  await page.evaluate(() => window.drawerQA.moveAsset("asset-right", -200, 60));
  assert.deepEqual(await panel("right").boundingBox(), free);
  await page.reload(); await waitMode("right", "floating");
  assert.deepEqual(await panel("right").boundingBox(), free);
  checks.push("真实鼠标脱离后保存自由位置，移动图片及刷新均不改变自由位置");

  const targetImage = await page.locator(".canvas-asset-image").nth(1).boundingBox();
  await panel("right").click();
  assert.equal(await panel("right").locator(".asset-note-drawer-resize").count(), 4);
  const start = await panel("right").boundingBox();
  await page.mouse.move(start.x + 30, start.y + 18); await page.mouse.down();
  await page.mouse.move(targetImage.x + targetImage.width + 160 + 30 - start.width / 2, targetImage.y + 160 + 18 - start.height / 2, { steps: 10 }); await page.mouse.up();
  await waitMode("right", "docked-expanded"); await savedMode("right", "docked-expanded");
  await page.waitForTimeout(240);
  assert.equal(await panel("right").evaluate((node) => !!node.closest(".asset-note-dock-host")), true);
  checks.push("自由卡片四角缩放入口及鼠标重新停靠");

  await page.evaluate(() => {
    const records = window.drawerQA.getStored(); records.find((drawer) => drawer.id === "drawer-left").locked = true;
    window.drawerQA.seed(records);
  });
  await panel("left").getByRole("button", { name: "收起备注" }).click(); await savedMode("left", "docked-collapsed");
  await head("left").focus(); await page.keyboard.press("Space"); await savedMode("left", "docked-expanded");
  assert.equal(await panel("left").locator(".asset-note-drawer-resize").count(), 0);
  checks.push("锁定抽屉仍可鼠标收起与键盘展开");

  await reset();
  await page.evaluate(() => {
    const records = window.drawerQA.getStored();
    const right = records.find((drawer) => drawer.id === "drawer-right");
    right.height = 100; right.offset = 20;
    records.push({ ...right, id: "drawer-right-2", offset: 160, orderIndex: 1 });
    window.drawerQA.seed(records);
  });
  await page.waitForFunction(() => document.querySelectorAll("article.asset-note-drawer").length === 5);
  const second = page.locator('article[data-drawer-id="drawer-right-2"]');
  const secondBefore = await second.boundingBox();
  await panel("right").getByRole("button", { name: "收起备注" }).click(); await savedMode("right", "docked-collapsed");
  assert.deepEqual(await second.boundingBox(), secondBefore);
  await head("right").click(); await savedMode("right", "docked-expanded");
  assert.deepEqual(await second.boundingBox(), secondBefore);
  checks.push("同边多抽屉开合保留位置，不重新排布");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await panel("bottom").getByRole("button", { name: "收起备注" }).click(); await savedMode("bottom", "docked-collapsed");
  assert.equal(await panel("bottom").evaluate((node) => getComputedStyle(node).transitionDuration), "0s");
  await page.evaluate(() => {
    const records = window.drawerQA.getStored();
    const top = records.find((drawer) => drawer.id === "drawer-top");
    top.mode = "floating"; top.floatingX = 2600; top.floatingY = 1800;
    window.drawerQA.seed(records);
  });
  await waitMode("top", "floating");
  await page.evaluate(() => window.drawerQA.fitAll());
  for (const item of await geometry()) {
    const r = item.mode === "docked-collapsed" ? item.handle : item.rect;
    assert.ok(r.left >= 49 && r.top >= 49 && r.right <= 1871 && r.bottom <= 1151, JSON.stringify(item));
  }
  await page.screenshot({ path: path.join(output, "light-fit-all.png") });
  checks.push("减少动态效果与适应全部包含自由卡片、展开正文及收起把手");

  assert.deepEqual(errors, []);
  writeFileSync(path.join(output, "result.json"), JSON.stringify({ passed: checks, errors }, null, 2));
  console.log(JSON.stringify({ passed: checks, errors, output }, null, 2));
} catch (error) {
  await page.screenshot({ path: path.join(output, "failure.png") }).catch(() => {});
  writeFileSync(path.join(output, "failure.json"), JSON.stringify({ passed: checks, errors, failure: error.stack }, null, 2));
  throw error;
} finally { await browser.close(); }
