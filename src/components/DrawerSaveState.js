export const DRAWER_LAYOUT_FIELDS = Object.freeze([
  "mode", "side", "offset", "width", "height", "floatingX", "floatingY", "locked", "textScale",
]);

export function sameDrawerLayout(a, b) {
  return DRAWER_LAYOUT_FIELDS.every((field) => a?.[field] === b?.[field]);
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
  for (const field of DRAWER_LAYOUT_FIELDS) restored[field] = previous[field];
  return restored;
}
