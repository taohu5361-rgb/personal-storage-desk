export const validMinimapRect = rect => rect && [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) && rect.width > 0 && rect.height > 0;

export function minimapPolygonItem(item, points) {
  if (!points?.length) return item;
  const x = Math.min(...points.map(point => point.x)), y = Math.min(...points.map(point => point.y));
  return { ...item, x, y, width: Math.max(...points.map(point => point.x)) - x, height: Math.max(...points.map(point => point.y)) - y, points };
}

export function viewportWorldRect(view, size) {
  const zoom = Number.isFinite(view.zoom) && view.zoom > 0 ? view.zoom : 1;
  return { x: -view.x / zoom, y: -view.y / zoom, width: size.width / zoom, height: size.height / zoom };
}

export function unionMinimapRects(rects) {
  const valid = rects.filter(validMinimapRect);
  if (!valid.length) return { x: 0, y: 0, width: 1, height: 1 };
  const x = Math.min(...valid.map(rect => rect.x));
  const y = Math.min(...valid.map(rect => rect.y));
  return { x, y, width: Math.max(...valid.map(rect => rect.x + rect.width)) - x, height: Math.max(...valid.map(rect => rect.y + rect.height)) - y };
}

export function paddedMinimapBounds(rects) {
  const bounds = unionMinimapRects(rects);
  const dx = Math.max(bounds.width * .1, 1), dy = Math.max(bounds.height * .1, 1);
  return { x: bounds.x - dx, y: bounds.y - dy, width: bounds.width + dx * 2, height: bounds.height + dy * 2 };
}

export const containsMinimapRect = (outer, inner) => inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;

export function minimapTransform(bounds, size) {
  const scale = Math.min(size.width / bounds.width, size.height / bounds.height);
  return { scale, x: (size.width - bounds.width * scale) / 2 - bounds.x * scale, y: (size.height - bounds.height * scale) / 2 - bounds.y * scale };
}

export function projectMinimapRect(rect, transform) {
  return { x: rect.x * transform.scale + transform.x, y: rect.y * transform.scale + transform.y, width: rect.width * transform.scale, height: rect.height * transform.scale };
}

// SVG logical coordinates are derived from its client rect, including CSS UI zoom.
export function clientToMinimapWorld(point, clientRect, mapSize, transform) {
  // Match SVG's default xMidYMid meet, including rounding under CSS zoom.
  const clientScale = Math.min(clientRect.width / mapSize.width, clientRect.height / mapSize.height);
  const offsetX = (clientRect.width - mapSize.width * clientScale) / 2;
  const offsetY = (clientRect.height - mapSize.height * clientScale) / 2;
  return { x: ((point.clientX - clientRect.left - offsetX) / clientScale - transform.x) / transform.scale, y: ((point.clientY - clientRect.top - offsetY) / clientScale - transform.y) / transform.scale };
}

export function centerViewportOn(point, view, size) {
  return { x: size.width / 2 - point.x * view.zoom, y: size.height / 2 - point.y * view.zoom, zoom: view.zoom };
}

export function dragMinimapViewport(startView, startPoint, point) {
  return { x: startView.x - (point.x - startPoint.x) * startView.zoom, y: startView.y - (point.y - startPoint.y) * startView.zoom, zoom: startView.zoom };
}
