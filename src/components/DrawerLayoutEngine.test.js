import assert from "node:assert/strict";
import test from "node:test";
import {
  createDefaultDrawerPlacement,
  DRAWER_DOCK_GAP,
  drawerAlongLength,
  drawerWorldRect,
  normalizeDrawerLayout,
  resolveDrawerPlacement,
  resizeDrawerByDelta,
  drawerHandleRect,
  drawerVisibleRect,
  assetDrawerDecoration,
  normalizeDrawer,
} from "./DrawerLayoutEngine.js";
import { screenEventToWorld } from "./DrawerDragController.js";

const asset = { id: "asset-a", x: 120, y: 80, width: 1000, height: 800 };
const makeDrawer = (id, side = "right", offset = 0, width = 240, height = 150) => ({
  id,
  assetId: asset.id,
  text: "",
  side,
  offset,
  width,
  height,
  orderIndex: Number(id.split("-").at(-1)) || 0,
  locked: false,
  styleVariant: "default",
});

test("new drawers prefer the right edge and keep the requested world gap", () => {
  const first = { ...createDefaultDrawerPlacement(asset, []), id: "drawer-1" };
  const second = { ...createDefaultDrawerPlacement(asset, [first]), id: "drawer-2" };
  const third = { ...createDefaultDrawerPlacement(asset, [first, second]), id: "drawer-3" };

  assert.deepEqual([first.side, second.side, third.side], ["right", "right", "right"]);
  const positions = [first, second, third].map((drawer) => drawer.offset).sort((a, b) => a - b);
  assert.ok(positions[1] - positions[0] >= drawerAlongLength(first) + 14);
  assert.ok(positions[2] - positions[1] >= drawerAlongLength(first) + 14);
});

test("dragging into another drawer finds the nearest open interval without moving it", () => {
  const fixed = makeDrawer("drawer-1", "right", 240);
  const moved = makeDrawer("drawer-2", "right", 245);
  const result = resolveDrawerPlacement(asset, moved, [fixed], { preferredSide: "right" });

  assert.equal(fixed.offset, 240);
  assert.ok(result.offset + 14 <= fixed.offset || result.offset >= fixed.offset + fixed.height + 14);
});

test("a full edge falls back to another edge while preserving attachment", () => {
  const shortAsset = { ...asset, height: 150 };
  const fixed = makeDrawer("drawer-1", "right", 0);
  const moved = makeDrawer("drawer-2", "right", 0);
  const result = resolveDrawerPlacement(shortAsset, moved, [fixed], {
    preferredSide: "right",
    point: { x: shortAsset.x + shortAsset.width + 1, y: shortAsset.y + 50 },
  });

  assert.ok(result);
  assert.notEqual(result.side, "right");
});

test("resizing keeps the drawer attached and preserves the opposite along-edge anchor", () => {
  const original = makeDrawer("drawer-1", "right", 220);
  const resized = resizeDrawerByDelta(asset, original, "nw", 35, -25);
  const rect = drawerWorldRect(asset, resized);
  const oldBottom = original.offset + original.height;

  assert.equal(resized.width, 275);
  assert.equal(resized.height, 175);
  assert.equal(resized.offset + resized.height, oldBottom);
  assert.equal(rect.left, asset.x + asset.width + DRAWER_DOCK_GAP);
  assert.equal(rect.top, asset.y + resized.offset);
});

test("corner resize grows along the dragged outward edge on all four sides", () => {
  const right = resizeDrawerByDelta(asset, makeDrawer("drawer-1", "right", 100), "se", 0, 20);
  const top = resizeDrawerByDelta(asset, makeDrawer("drawer-2", "top", 100), "nw", 0, -20);
  const bottom = resizeDrawerByDelta(asset, makeDrawer("drawer-3", "bottom", 100), "se", 0, 20);

  assert.equal(right.height, 170);
  assert.equal(top.height, 170);
  assert.equal(bottom.height, 170);
});

test("stale blocker offsets are clamped before collision checks", () => {
  const shortAsset = { ...asset, height: 300 };
  const fixed = makeDrawer("drawer-1", "right", 320);
  const moved = makeDrawer("drawer-2", "right", 0);
  const result = resolveDrawerPlacement(shortAsset, moved, [fixed], {
    preferredSide: "right",
    allowFallbackSide: false,
  });

  assert.equal(result, null);
});

test("asset shrink clamps offsets and normalizes crowded drawers without overlap", () => {
  const smaller = { ...asset, height: 300 };
  const input = [
    makeDrawer("drawer-1", "right", 0),
    makeDrawer("drawer-2", "right", 320),
    makeDrawer("drawer-3", "right", 600),
  ];
  const normalized = normalizeDrawerLayout(smaller, input);

  assert.equal(normalized.length, 3);
  for (const drawer of normalized) {
    const rect = drawerWorldRect(smaller, drawer);
    if (drawer.side === "right") assert.equal(rect.left, smaller.x + smaller.width + DRAWER_DOCK_GAP);
    if (drawer.side === "left") assert.equal(rect.right, smaller.x - DRAWER_DOCK_GAP);
    if (drawer.side === "top") assert.equal(rect.bottom, smaller.y - DRAWER_DOCK_GAP);
    if (drawer.side === "bottom") assert.equal(rect.top, smaller.y + smaller.height + DRAWER_DOCK_GAP);
  }
  for (const side of ["left", "right", "top", "bottom"]) {
    const onSide = normalized.filter((drawer) => drawer.side === side).sort((a, b) => a.offset - b.offset);
    for (let i = 1; i < onSide.length; i++) {
      assert.ok(onSide[i].offset >= onSide[i - 1].offset + drawerAlongLength(onSide[i - 1], side) + 14);
    }
  }
});

test("pointer coordinates convert to world coordinates at low and high zoom", () => {
  const rect = { left: 20, top: 40 };
  const event = { clientX: 270, clientY: 240 };
  for (const zoom of [0.25, 0.5, 1, 2, 4]) {
    const result = screenEventToWorld(event, rect, { x: 50, y: 25, zoom });
    assert.ok(Math.abs(result.x * zoom + 50 - 250) < 0.001);
    assert.ok(Math.abs(result.y * zoom + 25 - 200) < 0.001);
  }
});

test("all four attached bodies and collapsed heads touch the image with zero gap", () => {
  for (const side of ["left", "right", "top", "bottom"]) {
    const drawer = { ...makeDrawer("drawer-1", side, 80), mode: "docked-collapsed" };
    const body = drawerWorldRect(asset, drawer), head = drawerVisibleRect(asset, drawer);
    if (side === "left") { assert.equal(body.right, asset.x); assert.equal(head.right, asset.x); }
    if (side === "right") { assert.equal(body.left, asset.x + asset.width); assert.equal(head.left, asset.x + asset.width); }
    if (side === "top") { assert.equal(body.bottom, asset.y); assert.equal(head.bottom, asset.y); }
    if (side === "bottom") { assert.equal(body.top, asset.y + asset.height); assert.equal(head.top, asset.y + asset.height); }
    assert.equal(head.width * head.height, 24 * 48);
    assert.equal(drawer.width, 240); assert.equal(drawer.height, 150);
    assert.deepEqual(head, drawerHandleRect(asset, drawer));
  }
});
test("free cards stay at independent world coordinates as their image moves or shrinks", () => {
  const floating = normalizeDrawer({ ...makeDrawer("drawer-1"), mode: "floating", floatingX: -220, floatingY: 650 });
  const moved = { ...asset, x: 900, y: 1000, height: 90 };
  assert.deepEqual(drawerWorldRect(moved, floating), drawerWorldRect(asset, floating));
  assert.deepEqual(normalizeDrawerLayout(moved, [floating]), [floating]);
  const resized = resizeDrawerByDelta(moved, floating, "nw", -30, -20);
  assert.equal(resized.floatingX + resized.width, floating.floatingX + floating.width);
  assert.equal(resized.floatingY + resized.height, floating.floatingY + floating.height);
});
test("collapsed drawers reserve full slots, but free and foreign drawers never reserve an edge", () => {
  const smaller = { ...asset, height: 300 };
  const reserved = { ...makeDrawer("drawer-1", "right", 0), mode: "docked-collapsed" };
  const candidate = makeDrawer("drawer-2", "right", 10);
  assert.equal(resolveDrawerPlacement(smaller, candidate, [reserved], { allowFallbackSide: false }), null);
  const floating = { ...reserved, mode: "floating" };
  const foreign = { ...reserved, assetId: "another-asset" };
  assert.equal(resolveDrawerPlacement(smaller, candidate, [floating, foreign], { allowFallbackSide: false }).offset, 10);
});
test("only touched image corners are squared; bottom metadata clears the visible shape", () => {
  const bottom = { ...makeDrawer("drawer-1", "bottom", 0), mode: "docked-expanded" };
  assert.deepEqual(assetDrawerDecoration(asset, [bottom]), { corners: { nw: false, ne: false, sw: true, se: false }, bottomInset: 150 });
  const collapsed = assetDrawerDecoration(asset, [{ ...bottom, mode: "docked-collapsed" }]);
  assert.equal(collapsed.bottomInset, 24); assert.equal(collapsed.corners.sw, false);
  assert.equal(assetDrawerDecoration(asset, [{ ...bottom, mode: "floating" }]).bottomInset, 0);
});

test("collapsed handles stay on the actual contact segment when an image is smaller than the expanded drawer", () => {
  const tiny = { ...asset, width: 80, height: 30 };
  for (const side of ["left", "right", "top", "bottom"]) {
    const drawer = { ...makeDrawer("drawer-1", side, 900), mode: "docked-collapsed" };
    const head = drawerVisibleRect(tiny, drawer);
    if (side === "top" || side === "bottom") {
      assert.ok(head.left >= tiny.x && head.right <= tiny.x + tiny.width);
      assert.equal(head.width, 48);
    } else {
      assert.ok(head.top >= tiny.y && head.bottom <= tiny.y + tiny.height);
      assert.equal(head.height, 30);
    }
  }
});

test("text scale follows area without distorting text and sizes reach 4000", () => {
  const original = normalizeDrawer({ ...makeDrawer("scale"), mode: "floating", textScale: 2 });
  const double = resizeDrawerByDelta(asset, original, "se", original.width, original.height);
  assert.equal(double.textScale, 4);
  for (const [dx,dy] of [[100,0],[0,100]]) {
    const result = resizeDrawerByDelta(asset, original, "se", dx, dy);
    assert.ok(Math.abs(result.textScale - 2*Math.sqrt(result.width*result.height/(original.width*original.height))) < 1e-10);
    const back = resizeDrawerByDelta(asset, result, "se", -dx, -dy);
    assert.ok(Math.abs(back.textScale-2) < 1e-10);
  }
  const huge = resizeDrawerByDelta(asset, original, "se", 10000, 10000);
  assert.deepEqual([huge.width,huge.height,huge.textScale], [4000,4000,20]);
  assert.equal(normalizeDrawer({}).textScale, 1);
  assert.equal(normalizeDrawer({textScale:Infinity}).textScale, 1);
  assert.equal(normalizeDrawer({textScale:0}).textScale, 0.5);
});
