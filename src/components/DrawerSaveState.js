export const DRAWER_LAYOUT_FIELDS = Object.freeze([
  "assetId", "categoryId", "orderIndex",
  "mode", "side", "offset", "width", "height", "floatingX", "floatingY", "locked", "textScale",
]);

export function sameDrawerLayout(a, b) {
  return DRAWER_LAYOUT_FIELDS.every((field) => a?.[field] === b?.[field]);
}

// Database timestamps do not make a UI draft dirty. Keep content and placement
// comparisons explicit so a save response cannot erase later local edits.
export function sameDrawerContent(a, b) {
  return !!a && !!b && a.id === b.id && (a.text ?? "") === (b.text ?? "")
    && (a.styleVariant ?? "default") === (b.styleVariant ?? "default") && sameDrawerLayout(a, b);
}

export function snapshotDirtyDrawers(drawers, confirmed, excludedIds = new Set()) {
  return drawers.filter(drawer => !excludedIds.has(drawer.id) && !sameDrawerContent(drawer, confirmed.get(drawer.id)))
    .map(drawer => ({ ...drawer }));
}

// Ignore stale responses, including responses to saves submitted before typing
// or a mode switch. Timestamps are not an ordering mechanism for UI updates.
export function reconcileDrawerSave(current, submitted, saved) {
  if (!current || current.id !== submitted.id || current.text !== submitted.text || !sameDrawerLayout(current, submitted)) return current;
  return { ...current, ...saved };
}

export function rollbackDrawerLayout(current, submitted, previous) {
  if (!previous || !sameDrawerLayout(current, submitted)) return current;
  const restored = { ...current };
  for (const field of DRAWER_LAYOUT_FIELDS) {
    if (Object.hasOwn(previous, field)) restored[field] = previous[field];
    else delete restored[field];
  }
  return restored;
}
