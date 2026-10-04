import assert from "node:assert/strict";
import test from "node:test";
import { reconcileDrawerSave, rollbackDrawerLayout } from "./DrawerSaveState.js";

const original = { id: "d", text: "旧备注", mode: "docked-expanded", side: "right", offset: 40, width: 240, height: 150, floatingX: 0, floatingY: 0, locked: false, textScale: 1 };
test("an old save response cannot overwrite new text or a later collapsed state", () => {
  const newerText = { ...original, text: "中文输入后的新备注" };
  assert.equal(reconcileDrawerSave(newerText, original, { ...original, updatedAt: 2 }), newerText);
  const collapsed = { ...original, mode: "docked-collapsed" };
  assert.equal(reconcileDrawerSave(collapsed, original, original), collapsed);
  assert.deepEqual(reconcileDrawerSave(original, original, { ...original, updatedAt: 2 }), { ...original, updatedAt: 2 });
});
test("failed layout saves restore layout while preserving newer text", () => {
  const submitted = { ...original, mode: "floating", floatingX: -50, floatingY: 90 };
  const current = { ...submitted, text: "保留编辑文字" };
  assert.deepEqual(rollbackDrawerLayout(current, submitted, original), { ...original, text: current.text });
});
test("a failed older save does not roll back a newer layout", () => {
  const submitted = { ...original, mode: "docked-collapsed" };
  const current = { ...original, side: "left" };
  assert.equal(rollbackDrawerLayout(current, submitted, original), current);
});

test("scale saves preserve newer text and reject stale scale responses", () => {
  const submitted = { ...original, textScale: 3 };
  const newer = { ...submitted, textScale: 4, text: "新中文备注" };
  assert.equal(reconcileDrawerSave(newer, submitted, submitted), newer);
  assert.equal(rollbackDrawerLayout(newer, submitted, original), newer);
  assert.deepEqual(rollbackDrawerLayout({ ...submitted, text: newer.text }, submitted, original), { ...original, text: newer.text });
});

test("old owner responses cannot undo transfer and failed transfer retains newer text", () => {
  const before = { ...original, assetId: "a", categoryId: "category", orderIndex: 0 };
  const submitted = { ...before, assetId: "b", side: "left" };
  const latest = { ...submitted, text: "转移过程中继续输入的中文" };
  assert.equal(reconcileDrawerSave(latest, before, before), latest);
  assert.deepEqual(rollbackDrawerLayout(latest, submitted, before), { ...before, text: latest.text });
  assert.equal(rollbackDrawerLayout({ ...latest, assetId: null }, submitted, before).assetId, null);
});
