const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
export const validScale = value => Number.isFinite(value) && value > 0 ? value : 1;
export function clientToSurface(point, rect, uiScale = 1) {
  const scale = validScale(uiScale);
  return { x: (point.clientX - rect.left) / scale, y: (point.clientY - rect.top) / scale };
}
export function surfaceToWorld(point, view) {
  const zoom = validScale(view.zoom);
  return { x: (point.x - view.x) / zoom, y: (point.y - view.y) / zoom };
}
export function clientWorldDelta(point, start, view, uiScale = 1) {
  const scale = validScale(view.zoom) * validScale(uiScale);
  return { x: (point.clientX - start.startX) / scale, y: (point.clientY - start.startY) / scale };
}
export function zoomViewportAt(view, zoom, point) {
  const world = surfaceToWorld(point, view);
  return { x: point.x - world.x * zoom, y: point.y - world.y * zoom, zoom };
}
export function resizeInnerObject(target, corner, dx, dy) {
  let width = target.width + (corner.includes("e") ? dx : -dx);
  let height = target.height + (corner.includes("s") ? dy : -dy);
  if (target.objectType === "sample") {
    const sx = width / target.width, sy = height / target.height;
    const scale = Math.abs(sx - 1) > Math.abs(sy - 1) ? sx : sy;
    width = clamp(target.width * scale, 80, 3000);
    height = width * target.height / target.width;
  } else { width = clamp(width, 80, 3000); height = clamp(height, 60, 3000); }
  return { ...target, width, height,
    x: corner.includes("w") ? target.x + target.width - width : target.x,
    y: corner.includes("n") ? target.y + target.height - height : target.y };
}
