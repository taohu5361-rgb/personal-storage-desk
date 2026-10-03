import test from "node:test";
import assert from "node:assert/strict";
import { centerViewportOn, clientToMinimapWorld, containsMinimapRect, dragMinimapViewport, minimapPolygonItem, minimapTransform, paddedMinimapBounds, projectMinimapRect, unionMinimapRects, viewportWorldRect } from "./minimapGeometry.js";

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);
test("world/client round trips at negative and distant positions, UI zoom, and canvas zoom", () => {
  for (const zoom of [.1, .51, 1, 2, 5]) for (const uiScale of [.75, 1, 1.5, 2]) {
    const size = { width: 1000, height: 700 }, view = { x: -90125, y: 25342, zoom };
    const rect = viewportWorldRect(view, size);
    const objects = [{ x: -12000, y: -19000, width: 320, height: 240 }, { x: 14000, y: 12000, width: 1, height: 1 }];
    const bounds = paddedMinimapBounds([...objects, rect]), mapSize = { width: 218, height: 122 }, transform = minimapTransform(bounds, mapSize);
    assert.ok([...objects, rect].every(item => containsMinimapRect(bounds, item)));
    const world = { x: objects[0].x + 160, y: objects[0].y + 120 };
    const mapped = projectMinimapRect({ ...world, width: 1, height: 1 }, transform);
    const clientRect = { left: 50, top: 80, width: mapSize.width * uiScale, height: mapSize.height * uiScale };
    const result = clientToMinimapWorld({ clientX: 50 + mapped.x * uiScale, clientY: 80 + mapped.y * uiScale }, clientRect, mapSize, transform);
    near(result.x, world.x); near(result.y, world.y);
    const centered = centerViewportOn(result, view, size);
    near(centered.x + world.x * zoom, size.width / 2); near(centered.y + world.y * zoom, size.height / 2);
    assert.equal(centered.zoom, zoom);
    const moved = dragMinimapViewport(view, world, { x: world.x + 320, y: world.y - 150 });
    near(moved.x, view.x - 320 * zoom); near(moved.y, view.y + 150 * zoom); assert.equal(moved.zoom, zoom);
  }
});
test("empty, invalid, and tiny geometry has finite bounds", () => {
  assert.deepEqual(unionMinimapRects([{ x: NaN, y: 0, width: 1, height: 1 }]), { x: 0, y: 0, width: 1, height: 1 });
  const bounds = paddedMinimapBounds([{ x: -4, y: -8, width: .001, height: .001 }]);
  assert.ok(Object.values(minimapTransform(bounds, { width: 158, height: 81 })).every(Number.isFinite));
});
test("CSS zoom rounding and SVG letterboxing do not shift navigation", () => {
  const size = { width: 218, height: 122 }, clientRect = { left: 1095.75, top: 674, width: 163, height: 91 };
  const transform = { x: 25, y: 15, scale: .002 };
  const point = { x: -400, y: -150 }, ratio = 91 / 122;
  const client = { clientX: clientRect.left + (clientRect.width - size.width * ratio) / 2 + (point.x * transform.scale + transform.x) * ratio, clientY: clientRect.top + (point.y * transform.scale + transform.y) * ratio };
  const world = clientToMinimapWorld(client, clientRect, size, transform);
  near(world.x, point.x); near(world.y, point.y);
});
test("rotated color blocks include every world corner in the map bounds", () => {
  const points = [{ x: -20, y: -40 }, { x: 80, y: 60 }, { x: 30, y: 110 }, { x: -70, y: 10 }];
  const item = minimapPolygonItem({ id: 'rotated', x: 0, y: 0, width: 100, height: 50 }, points);
  assert.deepEqual({ x: item.x, y: item.y, width: item.width, height: item.height }, { x: -70, y: -40, width: 150, height: 150 });
  const bounds = paddedMinimapBounds([item]);
  assert.ok(points.every(p => containsMinimapRect(bounds, { ...p, width: .001, height: .001 })));
});
