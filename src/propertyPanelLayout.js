export const PROPERTY_PANEL_LAYOUT_OPTIONS = Object.freeze([
  Object.freeze(['right', '方案一 · 右侧']),
  Object.freeze(['bottom', '方案二 · 底部']),
]);

// Existing installations and older settings snapshots keep the original layout.
export function resolvePropertyPanelLayout(value) {
  return value === 'bottom' ? 'bottom' : 'right';
}
