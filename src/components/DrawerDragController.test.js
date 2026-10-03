import assert from "node:assert/strict";
import test from "node:test";
import { DrawerDragController, DRAWER_MAGNET, drawerRectCenter, hitDrawerSnapZone, screenEventToWorld, drawerVisualRect, overlapsAsset } from "./DrawerDragController.js";
import { drawerWorldRect } from "./DrawerLayoutEngine.js";
import {objectToWorld} from './canvasTransforms.js';
import {drawerAssetFrame} from './DrawerDragController.js';

test('rotated docked drawer slides in local coordinates and free drawers retain world coordinates',()=>{
 globalThis.window={addEventListener(){},removeEventListener(){}};
 for(const rotation of [-90,30,90]){
  const a={...asset,rotation},d={...drawer,mode:'docked-expanded'},rect=drawerWorldRect(a,d),p={x:rect.left+70,y:rect.top+16},toEvent=p=>({clientX:p.x,clientY:p.y,button:0,pointerId:88,preventDefault(){},stopPropagation(){}});
  let preview;const controller=new DrawerDragController({getAsset:()=>a,getDrawers:()=>[d],getWorldPoint:e=>({x:e.clientX,y:e.clientY}),onPreview:v=>preview=v});
  controller.beginMove(toEvent(objectToWorld(p,drawerAssetFrame(a))),d);controller.handlePointerMove(toEvent(objectToWorld({...p,y:p.y+20},drawerAssetFrame(a))));
  assert.equal(controller.active.docked,true);close(preview.placement.offset,d.offset+20);controller.finish(true);
 }
});

const asset = { id: "a", x: 0, y: 0, width: 600, height: 400 };
const drawer = { id: "d", assetId: "a", side: "right", offset: 50, width: 240, height: 150 };
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, actual + " != " + expected);
const sides = ["left", "right", "top", "bottom"];
function harness({ initial = drawer, zoom = 1, uiScale = 1, other = [], grab = { x: 30, y: 16 }, viewport = { x: -53, y: 86 }, surface = { left: 23, top: 44 }, magnet } = {}) {
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  let preview = null;
  const commits = [], drafts = [];
  const controller = new DrawerDragController({
    getAsset: () => asset, getDrawers: () => [initial, ...other], getZoom: () => zoom, magnet,
    getWorldPoint: (e) => screenEventToWorld(e, surface, { ...viewport, zoom }, uiScale),
    onPreview: (p) => { preview = p; }, onDraft: (d) => drafts.push(d), onCommit: (d) => commits.push(d),
  });
  const event = (point, type = "pointermove", pointerId = 1) => ({
    clientX: surface.left + (viewport.x + point.x * zoom) * uiScale,
    clientY: surface.top + (viewport.y + point.y * zoom) * uiScale,
    pointerId, button: 0, type, preventDefault() {}, stopPropagation() {},
  });
  const rect = drawerWorldRect(asset, initial);
  const start = { x: rect.left + grab.x, y: rect.top + grab.y };
  const outward = { x: initial.side === "left" ? -1 : initial.side === "right" ? 1 : 0, y: initial.side === "top" ? -1 : initial.side === "bottom" ? 1 : 0 };
  const begin = () => controller.beginMove(event(start, "pointerdown"), initial);
  const pull = (distance) => controller.handlePointerMove(event({ x: start.x + outward.x * distance, y: start.y + outward.y * distance }));
  const atCenter = (center, type = "pointermove") => {
    const origin = controller.active.freeOrigin;
    assert.ok(origin, "must detach before moving freely");
    return event({
      x: origin.point.x + center.x - origin.rect.left - initial.width / 2,
      y: origin.point.y + center.y - origin.rect.top - initial.height / 2,
    }, type);
  };
  return { controller, commits, drafts, initial, start, event, begin, pull, atCenter, rect, get preview() { return preview; } };
}

test("four independent exterior strips choose exactly their own side", () => {
  for (const [center, side] of [
    [{ x: 300, y: -70 }, "top"], [{ x: 300, y: 470 }, "bottom"],
    [{ x: -70, y: 200 }, "left"], [{ x: 670, y: 200 }, "right"],
    [{ x: 580, y: 420 }, "bottom"],
  ]) assert.equal(hitDrawerSnapZone(center, asset), side);
});

test("asset interior, all four diagonal corners and outside distances are empty", () => {
  for (const center of [
    { x: 300, y: 200 }, { x: 580, y: 380 },
    { x: -1, y: -1 }, { x: 601, y: -1 }, { x: -1, y: 401 }, { x: 630, y: 430 },
    { x: -121, y: 200 }, { x: 721, y: 200 }, { x: 300, y: -121 }, { x: 300, y: 521 },
  ]) assert.equal(hitDrawerSnapZone(center, asset), null);
});

test("zone boundaries are closed outside, open at the asset, with no corner bridges", () => {
  for (const x of [0, 300, 600]) {
    assert.equal(hitDrawerSnapZone({ x, y: -120 }, asset), "top");
    assert.equal(hitDrawerSnapZone({ x, y: 520 }, asset), "bottom");
    assert.equal(hitDrawerSnapZone({ x, y: 0 }, asset), null);
    assert.equal(hitDrawerSnapZone({ x, y: 400 }, asset), null);
  }
  for (const y of [0, 200, 400]) {
    assert.equal(hitDrawerSnapZone({ x: -120, y }, asset), "left");
    assert.equal(hitDrawerSnapZone({ x: 720, y }, asset), "right");
    assert.equal(hitDrawerSnapZone({ x: 0, y }, asset), null);
    assert.equal(hitDrawerSnapZone({ x: 600, y }, asset), null);
  }
  assert.equal(hitDrawerSnapZone({ x: 600.001, y: 400.001 }, asset), null);
  assert.equal(hitDrawerSnapZone({ x: 599.999, y: 400.001 }, asset), "bottom");
});

test("boundary grid has no overlap and matches the hollow-cross definition", () => {
  for (const x of [-121, -120, -1, 0, 1, 599, 600, 601, 720, 721]) {
    for (const y of [-121, -120, -1, 0, 1, 399, 400, 401, 520, 521]) {
      const matches = [
        x >= 0 && x <= 600 && y >= -120 && y < 0 ? "top" : null,
        x >= 0 && x <= 600 && y > 400 && y <= 520 ? "bottom" : null,
        x >= -120 && x < 0 && y >= 0 && y <= 400 ? "left" : null,
        x > 600 && x <= 720 && y >= 0 && y <= 400 ? "right" : null,
      ].filter(Boolean);
      assert.ok(matches.length <= 1);
      assert.equal(hitDrawerSnapZone({ x, y }, asset), matches[0] || null);
    }
  }
});

test("translated assets and custom attachDistance use world geometry", () => {
  const translated = { ...asset, x: -175, y: 265 };
  assert.equal(hitDrawerSnapZone({ x: 405, y: 685 }, translated, 80), "bottom");
  assert.equal(hitDrawerSnapZone({ x: 405, y: 746 }, translated, 80), null);
  assert.equal(hitDrawerSnapZone({ x: 455, y: 695 }, translated, 80), null);
});

test("5px gesture threshold and sticky sliding have no snap preview or early saves", () => {
  const h = harness(); h.begin();
  h.controller.handlePointerMove(h.event({ x: h.start.x + 3, y: h.start.y }));
  assert.equal(h.preview, null);
  h.controller.handlePointerMove(h.event({ x: h.start.x + 23, y: h.start.y + 40 }));
  assert.equal(h.preview.docked, true); close(h.preview.rect.left, 600); close(h.preview.rect.top, 90);
  assert.equal(h.preview.targetRect, null); assert.equal(h.commits.length, 0); assert.equal(h.drafts.length, 0);
  h.controller.handlePointerUp(h.event({ x: h.start.x + 23, y: h.start.y + 40 }, "pointerup"));
  assert.equal(h.commits[0].side, "right"); close(h.commits[0].offset, 90); h.controller.dispose();
});

test("all four sides detach at 60 world pixels and remain continuous at every zoom", () => {
  for (const zoom of [0.83, 1, 1.19]) for (const side of sides) {
    const h = harness({ initial: { ...drawer, side, offset: 100 }, zoom }); h.begin(); h.pull(59);
    assert.equal(h.preview.docked, true); h.pull(60.001); assert.equal(h.preview.docked, false);
    const xDirection = side === "left" ? -1 : side === "right" ? 1 : 0;
    const yDirection = side === "top" ? -1 : side === "bottom" ? 1 : 0;
    close(h.preview.rect.left, h.rect.left + xDirection * 0.001);
    close(h.preview.rect.top, h.rect.top + yDirection * 0.001);
    h.pull(80); close(h.preview.rect.left, h.rect.left + xDirection * 20); close(h.preview.rect.top, h.rect.top + yDirection * 20);
    h.controller.dispose();
  }
});

test("inward movement toward another edge cannot bypass sticky detachment", () => {
  const h = harness(); h.begin();
  h.controller.handlePointerMove(h.event({ x: 520, y: -60 }));
  assert.equal(h.preview.docked, true); assert.equal(h.preview.targetRect, null); close(h.preview.rect.left, 600);
  h.controller.dispose();
});

test("actual floating center selects bottom and immediately clears diagonal, inner and far targets", () => {
  const h = harness(); h.begin(); h.pull(80);
  h.controller.handlePointerMove(h.atCenter({ x: 760, y: 200 })); assert.equal(h.preview.side, "right");
  h.controller.handlePointerMove(h.atCenter({ x: 580, y: 505 })); assert.equal(h.preview.side, "bottom");
  assert.equal(h.preview.targetRect.top, 400);
  assert.deepEqual(drawerRectCenter(h.preview.rect), { x: 580, y: 505 });
  for (const center of [{ x: 630, y: 430 }, { x: 580, y: 380 }, { x: 580, y: 596 }]) {
    h.controller.handlePointerMove(h.atCenter(center)); assert.equal(h.preview.side, undefined); assert.equal(h.preview.targetRect, null);
  }
  h.controller.dispose();
});

test("size compensation preserves 120px edge gaps across canvas and UI scales", () => {
  for (const zoom of [0.83, 1, 1.19]) for (const uiScale of [0.75, 1, 1.5])
    for (const [width, height] of [[180, 100], [240, 150], [420, 320]])
      for (const grabX of [12, width / 2, width - 12]) {
        const h = harness({ initial: { ...drawer, width, height }, zoom, uiScale, grab: { x: grabX, y: 16 } });
        h.begin(); h.pull(80);
        for (const gap of [12, 60, 119, 120, 121]) for (const side of sides) {
          const center = side === "left" ? { x: -width / 2 - gap, y: 200 }
            : side === "right" ? { x: 600 + width / 2 + gap, y: 200 }
            : side === "top" ? { x: 300, y: -height / 2 - gap }
            : { x: 580, y: 400 + height / 2 + gap };
          h.controller.handlePointerMove(h.atCenter(center));
          const actual = drawerRectCenter(h.preview.rect); close(actual.x, center.x); close(actual.y, center.y);
          assert.equal(h.preview.side || null, gap <= 120 ? side : null);
        }
        for (const center of [{ x: 630, y: 430 }, { x: 300, y: 200 }, { x: 580, y: 420 }]) {
          h.controller.handlePointerMove(h.atCenter(center)); assert.equal(h.preview.targetRect, null);
        }
        h.controller.dispose();
      }
});

test("release recomputes the final center and commits only the actual hit side", () => {
  const h = harness(); h.begin(); h.pull(80);
  h.controller.handlePointerMove(h.atCenter({ x: 760, y: 200 }));
  h.controller.handlePointerUp(h.atCenter({ x: 580, y: 505 }, "pointerup"));
  assert.equal(h.commits[0].side, "bottom"); assert.equal(h.preview.snapping, true);
  close(drawerRectCenter(h.preview.fromRect).x, 580); close(drawerRectCenter(h.preview.fromRect).y, 505);
  h.controller.dispose();
});

test("release outside a valid target saves the free card without committing the prior right target", () => {
  const h = harness(); h.begin(); h.pull(80);
  h.controller.handlePointerMove(h.atCenter({ x: 760, y: 200 }));
  h.controller.handlePointerUp(h.atCenter({ x: 630, y: 430 }, "pointerup"));
  assert.equal(h.commits.length, 1); assert.equal(h.commits[0].mode, "floating");
  close(h.commits[0].floatingX, 510); close(h.commits[0].floatingY, 355);
  assert.equal(h.preview, null); h.controller.dispose();
});

test("occupied hit edge never silently falls back to another edge", () => {
  const blockers = [0, 164].map((offset, index) => ({ ...drawer, id: "blocker-" + index, side: "bottom", width: 420, offset }));
  const h = harness({ other: blockers }); h.begin(); h.pull(80);
  h.controller.handlePointerMove(h.atCenter({ x: 300, y: 505 }));
  assert.equal(h.controller.active.hitZone, "bottom"); assert.equal(h.preview.targetRect, null);
  h.controller.handlePointerUp(h.atCenter({ x: 300, y: 505 }, "pointerup"));
  assert.equal(h.commits.length, 1); assert.equal(h.commits[0].mode, "floating"); h.controller.dispose();
});

test("pointer cancel, Escape and lost focus restore original docking", () => {
  for (const cancel of ["pointercancel", "escape", "blur"]) {
    const h = harness(); h.begin(); h.pull(80); h.controller.handlePointerMove(h.atCenter({ x: 580, y: 505 }));
    if (cancel === "pointercancel") h.controller.handlePointerUp(h.atCenter({ x: 580, y: 505 }, cancel));
    if (cancel === "escape") h.controller.handleKeyDown({ key: "Escape" });
    if (cancel === "blur") h.controller.handleCancel();
    assert.equal(h.commits.length, 0); assert.deepEqual(h.drafts[0], drawer); h.controller.dispose();
  }
});

test("resize still persists attached dimensions; locked drawers and foreign pointers do not drag", () => {
  const h = harness(); h.controller.beginResize(h.event(h.start, "pointerdown"), drawer, "se");
  h.controller.handlePointerMove(h.event({ x: h.start.x + 20, y: h.start.y + 20 }));
  assert.equal(h.preview.resizing, true); assert.equal(h.preview.corner, "se"); assert.equal(h.preview.dragging, undefined);
  h.controller.handlePointerUp(h.event({ x: h.start.x + 20, y: h.start.y + 20 }, "pointerup"));
  assert.equal(h.commits[0].width, 260); assert.equal(h.commits[0].height, 170); h.controller.dispose();
  const locked = harness({ initial: { ...drawer, locked: true } }); locked.begin(); assert.equal(locked.controller.active, null);
  const foreign = harness(); foreign.begin(); foreign.controller.handlePointerMove(foreign.event({ x: 900, y: 200 }, "pointermove", 2));
  assert.equal(foreign.preview, null); foreign.controller.dispose();
});

test("defaults are world distances without target hysteresis", () => {
  assert.deepEqual(DRAWER_MAGNET, { attachDistance: 120, detachDistance: 60 });
});

test("visual overlap includes scale around the actual title grab origin", () => {
  const rect = { left: 601, top: 80, width: 420, height: 320 };
  assert.equal(overlapsAsset(rect, asset), false);
  assert.equal(overlapsAsset(drawerVisualRect(rect, { x: 400, y: 16 }), asset), true);
  const h = harness({ initial: { ...drawer, width: 420, height: 320 }, grab: { x: 400, y: 16 } });
  h.begin(); h.pull(80);
  h.controller.handlePointerMove(h.atCenter({ x: 811, y: 240 }));
  assert.equal(h.preview.targetRect, null); assert.equal(h.controller.active.overlapBlocked, true);
  h.controller.dispose();
});

test("persisted floating cards drag immediately and can redock on any image edge", () => {
  for (const side of sides) {
    const initial = { ...drawer, mode: "floating", floatingX: 900, floatingY: 700 };
    const h = harness({ initial }); h.begin();
    assert.equal(h.controller.active.docked, false);
    const center = side === "right" ? { x: 800, y: 200 } : side === "left" ? { x: -200, y: 200 }
      : side === "top" ? { x: 300, y: -150 } : { x: 300, y: 550 };
    h.controller.handlePointerMove(h.atCenter(center));
    assert.equal(h.preview.side, side);
    h.controller.handlePointerUp(h.atCenter(center, "pointerup"));
    assert.equal(h.commits[0].mode, "docked-expanded"); assert.equal(h.commits[0].side, side);
    h.controller.dispose();
  }
});
test("collapsed heads cannot initiate drag or resize", () => {
  const initial = { ...drawer, mode: "docked-collapsed" };
  const h = harness({ initial }); h.begin(); assert.equal(h.controller.active, null);
  h.controller.beginResize(h.event(h.start, "pointerdown"), initial, "se");
  assert.equal(h.controller.active, null); h.controller.dispose();
});
test("cancelling free movement restores the original free position; free resize has no edge collision", () => {
  const initial = { ...drawer, mode: "floating", floatingX: -600, floatingY: -500 };
  const h = harness({ initial }); h.begin();
  h.controller.handlePointerMove(h.atCenter({ x: 300, y: 550 }));
  h.controller.handleCancel(); assert.deepEqual(h.drafts[0], initial); assert.equal(h.commits.length, 0); h.controller.dispose();
  const r = harness({ initial }); r.controller.beginResize(r.event(r.start, "pointerdown"), initial, "nw");
  r.controller.handlePointerMove(r.event({ x: r.start.x - 30, y: r.start.y - 20 }));
  r.controller.handlePointerUp(r.event({ x: r.start.x - 30, y: r.start.y - 20 }, "pointerup"));
  assert.equal(r.commits[0].floatingX, -630); assert.equal(r.commits[0].floatingY, -520);
  assert.equal(r.commits[0].width, 270); assert.equal(r.commits[0].height, 170); r.controller.dispose();
});
