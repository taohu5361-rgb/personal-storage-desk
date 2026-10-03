export const DRAWER_SIDES = Object.freeze(["left", "right", "top", "bottom"]);
export const DRAWER_GAP = 14;
export const DRAWER_DOCK_GAP = 0;
export const DRAWER_MODES = Object.freeze(["floating", "docked-expanded", "docked-collapsed"]);
export const DRAWER_HANDLE_DEPTH = 24;
export const DRAWER_HANDLE_LENGTH = 48;
export const isDrawerDocked = (drawer) => drawer?.mode !== "floating";
export const isDrawerCollapsed = (drawer) => drawer?.mode === "docked-collapsed";
export const DRAWER_MIN_WIDTH = 180;
export const DRAWER_MAX_WIDTH = 4000;
export const DRAWER_MIN_HEIGHT = 100;
export const DRAWER_MAX_HEIGHT = 4000;
export const DRAWER_DEFAULT_WIDTH = 240;
export const DRAWER_DEFAULT_HEIGHT = 150;

const SIDE_ORDER = ["right", "left", "bottom", "top"];
const EPSILON = 0.001;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const isVerticalSide = (side) => side === "left" || side === "right";

export function normalizeDrawer(drawer) {
  const side = DRAWER_SIDES.includes(drawer?.side) ? drawer.side : "right";
  return {
    ...drawer,
    text: typeof drawer?.text === "string" ? drawer.text : "",
    textScale: clamp(finite(drawer?.textScale, 1), 0.5, 20),
    side,
    mode: DRAWER_MODES.includes(drawer?.mode) ? drawer.mode : "docked-expanded",
    floatingX: finite(drawer?.floatingX, 0),
    floatingY: finite(drawer?.floatingY, 0),
    offset: Math.max(0, finite(drawer?.offset, 0)),
    width: clamp(finite(drawer?.width, DRAWER_DEFAULT_WIDTH), DRAWER_MIN_WIDTH, DRAWER_MAX_WIDTH),
    height: clamp(finite(drawer?.height, DRAWER_DEFAULT_HEIGHT), DRAWER_MIN_HEIGHT, DRAWER_MAX_HEIGHT),
    orderIndex: Math.max(0, Math.trunc(finite(drawer?.orderIndex, 0))),
    locked: Boolean(drawer?.locked),
    styleVariant: drawer?.styleVariant || "default",
  };
}

export function edgeLength(asset, side) {
  return Math.max(0, finite(isVerticalSide(side) ? asset?.height : asset?.width, 0));
}

export function drawerAlongLength(drawer, side = drawer?.side) {
  return isVerticalSide(side) ? drawer.height : drawer.width;
}

export function maxDrawerOffset(asset, drawer, side = drawer?.side) {
  return Math.max(0, edgeLength(asset, side) - drawerAlongLength(drawer, side));
}

export function clampDrawerOffset(asset, drawer, offset = drawer?.offset, side = drawer?.side) {
  return clamp(finite(offset, 0), 0, maxDrawerOffset(asset, drawer, side));
}

export function drawerWorldRect(asset, rawDrawer) {
  const drawer = normalizeDrawer(rawDrawer);
  if (!isDrawerDocked(drawer)) {
    const { floatingX: left, floatingY: top, width, height } = drawer;
    return { left, top, width, height, right: left + width, bottom: top + height };
  }
  const offset = clampDrawerOffset(asset, drawer);
  const left = drawer.side === "left"
    ? asset.x - DRAWER_DOCK_GAP - drawer.width
    : drawer.side === "right"
      ? asset.x + asset.width + DRAWER_DOCK_GAP
      : asset.x + offset;
  const top = drawer.side === "top"
    ? asset.y - DRAWER_DOCK_GAP - drawer.height
    : drawer.side === "bottom"
      ? asset.y + asset.height + DRAWER_DOCK_GAP
      : asset.y + offset;
  return { left, top, width: drawer.width, height: drawer.height, right: left + drawer.width, bottom: top + drawer.height };
}

// Storage and collision geometry always use the expanded dimensions. Only the
// visible rect shrinks; toggling never changes another drawer's reserved slot.
export function drawerHandleRect(asset, drawer) {
  const expanded = drawerWorldRect(asset, { ...drawer, mode: "docked-expanded" });
  const vertical = isVerticalSide(drawer.side);
  const edge = edgeLength(asset, drawer.side);
  const alongStart = vertical ? expanded.top - asset.y : expanded.left - asset.x;
  const contactStart = clamp(alongStart, 0, edge);
  const contactEnd = clamp(alongStart + (vertical ? expanded.height : expanded.width), 0, edge);
  const alongLength = Math.min(DRAWER_HANDLE_LENGTH, edge);
  const headStart = clamp((contactStart + contactEnd - alongLength) / 2, 0, Math.max(0, edge - alongLength));
  const width = vertical ? DRAWER_HANDLE_DEPTH : alongLength;
  const height = vertical ? alongLength : DRAWER_HANDLE_DEPTH;
  const left = drawer.side === "left" ? asset.x - width : drawer.side === "right"
    ? asset.x + asset.width : asset.x + headStart;
  const top = drawer.side === "top" ? asset.y - height : drawer.side === "bottom"
    ? asset.y + asset.height : asset.y + headStart;
  return { left, top, width, height, right: left + width, bottom: top + height };
}

export function drawerVisibleRect(asset, drawer) {
  return isDrawerCollapsed(drawer) ? drawerHandleRect(asset, drawer) : drawerWorldRect(asset, drawer);
}

export function assetDrawerDecoration(asset, drawers) {
  const corners = { nw: false, ne: false, sw: false, se: false };
  let bottomInset = 0;
  for (const drawer of drawers.filter(isDrawerDocked)) {
    const rect = drawerVisibleRect(asset, drawer);
    if (drawer.side === "bottom") bottomInset = Math.max(bottomInset, rect.height);
    const start = isVerticalSide(drawer.side) ? rect.top - asset.y : rect.left - asset.x;
    const end = start + (isVerticalSide(drawer.side) ? rect.height : rect.width);
    const pairs = { left: ["nw", "sw"], right: ["ne", "se"], top: ["nw", "ne"], bottom: ["sw", "se"] };
    if (start <= EPSILON) corners[pairs[drawer.side][0]] = true;
    if (end >= edgeLength(asset, drawer.side) - EPSILON) corners[pairs[drawer.side][1]] = true;
  }
  return { corners, bottomInset };
}

export function nearestAssetSide(point, asset) {
  const distances = {
    left: Math.abs(point.x - asset.x),
    right: Math.abs(point.x - (asset.x + asset.width)),
    top: Math.abs(point.y - asset.y),
    bottom: Math.abs(point.y - (asset.y + asset.height)),
  };
  return DRAWER_SIDES.reduce((best, side) => distances[side] < distances[best] ? side : best, DRAWER_SIDES[0]);
}

export function projectPointOnSide(point, asset, side) {
  return isVerticalSide(side) ? point.y - asset.y : point.x - asset.x;
}

function intervalOverlaps(offset, length, blockerOffset, blockerLength, gap) {
  return offset < blockerOffset + blockerLength + gap - EPSILON &&
    offset + length + gap > blockerOffset + EPSILON;
}

export function nearestFreeOffset(asset, drawer, desiredOffset, blockers = [], gap = DRAWER_GAP) {
  const length = drawerAlongLength(drawer);
  const maxOffset = Math.max(0, edgeLength(asset, drawer.side) - length);
  const sameSideBlockers = blockers
    .filter((blocker) => isDrawerDocked(blocker) && blocker.assetId === drawer.assetId && blocker.side === drawer.side && blocker.id !== drawer.id)
    .map((blocker) => ({
      ...blocker,
      offset: clampDrawerOffset(asset, blocker),
    }));
  const candidates = new Set([
    clamp(finite(desiredOffset, 0), 0, maxOffset),
    0,
    maxOffset,
  ]);
  for (const blocker of sameSideBlockers) {
    const blockerLength = drawerAlongLength(blocker);
    candidates.add(clamp(blocker.offset - length - gap, 0, maxOffset));
    candidates.add(clamp(blocker.offset + blockerLength + gap, 0, maxOffset));
  }

  return [...candidates]
    .filter((offset) => sameSideBlockers.every((blocker) =>
      !intervalOverlaps(offset, length, blocker.offset, drawerAlongLength(blocker), gap),
    ))
    .sort((a, b) => Math.abs(a - desiredOffset) - Math.abs(b - desiredOffset) || a - b)[0] ?? null;
}

function sideOrderFor(point, asset, preferredSide) {
  if (!point) return [preferredSide, ...SIDE_ORDER.filter((side) => side !== preferredSide)];
  const distance = {
    left: Math.abs(point.x - asset.x),
    right: Math.abs(point.x - (asset.x + asset.width)),
    top: Math.abs(point.y - asset.y),
    bottom: Math.abs(point.y - (asset.y + asset.height)),
  };
  return DRAWER_SIDES.slice().sort((a, b) =>
    (a === preferredSide ? -1 : b === preferredSide ? 1 : distance[a] - distance[b]),
  );
}

export function resolveDrawerPlacement(asset, rawCandidate, existing = [], options = {}) {
  const candidate = normalizeDrawer(rawCandidate);
  const preferredSide = DRAWER_SIDES.includes(options.preferredSide) ? options.preferredSide : candidate.side;
  const sides = options.allowFallbackSide === false
    ? [preferredSide]
    : sideOrderFor(options.point, asset, preferredSide);
  const blockers = existing.filter((item) => item.id !== candidate.id && item.assetId === candidate.assetId && isDrawerDocked(item)).map(normalizeDrawer);

  for (const side of sides) {
    const next = { ...candidate, side };
    let desiredOffset = candidate.offset;
    if (side !== candidate.side) {
      if (options.point) {
        const along = drawerAlongLength(next, side);
        desiredOffset = projectPointOnSide(options.point, asset, side) - clamp(options.grabRatio ?? 0.5, 0, 1) * along;
      } else {
        const oldMax = maxDrawerOffset(asset, candidate);
        const ratio = oldMax > 0 ? clamp(candidate.offset / oldMax, 0, 1) : 0.5;
        desiredOffset = ratio * maxDrawerOffset(asset, next, side);
      }
    }
    const offset = nearestFreeOffset(asset, next, desiredOffset, blockers, options.gap ?? DRAWER_GAP);
    if (offset !== null) return { ...next, offset };
  }
  return null;
}

export function createDefaultDrawerPlacement(asset, existing = []) {
  const orderIndex = existing.filter((item) => item.assetId === asset.id).length;
  const base = normalizeDrawer({
    assetId: asset.id,
    text: "",
    side: "right",
    offset: 0,
    width: DRAWER_DEFAULT_WIDTH,
    height: DRAWER_DEFAULT_HEIGHT,
    orderIndex,
    locked: false,
    styleVariant: "default",
  });

  for (const side of SIDE_ORDER) {
    const candidate = { ...base, side };
    const desiredOffset = maxDrawerOffset(asset, candidate, side) / 2;
    const placement = resolveDrawerPlacement(asset, { ...candidate, offset: desiredOffset }, existing, {
      preferredSide: side,
      allowFallbackSide: false,
    });
    if (placement) return placement;
  }
  return null;
}

export function resizeDrawerByDelta(asset, rawDrawer, corner, deltaX, deltaY) {
  const drawer = normalizeDrawer(rawDrawer);
  if (!isDrawerDocked(drawer)) {
    const width = clamp(drawer.width + (corner.includes("e") ? deltaX : -deltaX), DRAWER_MIN_WIDTH, DRAWER_MAX_WIDTH);
    const height = clamp(drawer.height + (corner.includes("s") ? deltaY : -deltaY), DRAWER_MIN_HEIGHT, DRAWER_MAX_HEIGHT);
    return { ...drawer, width, height, textScale: clamp(drawer.textScale * Math.sqrt(width * height / (drawer.width * drawer.height)), 0.5, 20),
      floatingX: drawer.floatingX + (corner.includes("w") ? drawer.width - width : 0),
      floatingY: drawer.floatingY + (corner.includes("n") ? drawer.height - height : 0) };
  }
  const verticalEdge = isVerticalSide(drawer.side);
  const widthDelta = drawer.side === "right" ? deltaX : drawer.side === "left" ? -deltaX : corner.includes("e") ? deltaX : -deltaX;
  const heightDelta = verticalEdge
    ? corner.includes("s") ? deltaY : -deltaY
    : drawer.side === "bottom" ? deltaY : -deltaY;
  const width = clamp(drawer.width + widthDelta, DRAWER_MIN_WIDTH, DRAWER_MAX_WIDTH);
  const height = clamp(drawer.height + heightDelta, DRAWER_MIN_HEIGHT, DRAWER_MAX_HEIGHT);
  let offset = drawer.offset;
  if (verticalEdge && corner.includes("n")) offset += drawer.height - height;
  if (!verticalEdge && corner.includes("w")) offset += drawer.width - width;
  return normalizeDrawer({ ...drawer, width, height, offset, textScale: drawer.textScale * Math.sqrt(width * height / (drawer.width * drawer.height)) });
}

export function normalizeDrawerLayout(asset, rawDrawers) {
  const input = rawDrawers.map(normalizeDrawer);
  const ordered = input.filter(isDrawerDocked).sort((a, b) =>
    a.side.localeCompare(b.side) || a.offset - b.offset || a.orderIndex - b.orderIndex || String(a.id).localeCompare(String(b.id)),
  );
  const placed = [];
  for (const drawer of ordered) {
    const placement = resolveDrawerPlacement(asset, drawer, placed, {
      preferredSide: drawer.side,
      allowFallbackSide: true,
      point: drawerWorldCenter(asset, drawer),
    });
    if (placement) placed.push(placement);
  }
  return [...placed, ...input.filter((drawer) => !isDrawerDocked(drawer))].sort((a, b) => a.orderIndex - b.orderIndex || String(a.id).localeCompare(String(b.id)));
}

export function drawerWorldCenter(asset, drawer) {
  const rect = drawerWorldRect(asset, drawer);
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}
