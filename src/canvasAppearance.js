// Appearance belongs to the canvas, independently of the application theme.
export const DEFAULT_CANVAS_COLOR = '#ffffff';
export const DEFAULT_GROUP_COLOR = '#6A8CC7';
export const CANVAS_COLORS = [
  { value: '#ffffff', label: '白色' },
  { value: '#000000', label: '黑色' },
];
export const CANVAS_PATTERNS = [
  { value: 'solid', label: '无网格' },
  { value: 'dots', label: '柔和点阵' },
  { value: 'grid', label: '轻网格' },
];
export function normalizeCanvasColor(color) {
  if (!/^#[0-9a-f]{6}$/i.test(color || '')) return DEFAULT_CANVAS_COLOR;
  const channels = [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16));
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722 < 128
    ? '#000000' : '#ffffff';
}
export function resolveCanvasAppearance(category = {}, settings = {}) {
  const pattern = category?.canvasPattern || settings?.canvasBackground;
  return {
    color: normalizeCanvasColor(category?.canvasColor || settings?.canvasBackgroundColor),
    pattern: CANVAS_PATTERNS.some(item => item.value === pattern) ? pattern : 'dots',
  };
}
// Paint on the stationary viewport, anchored to the same origin as the world.
// Select coarser/finer powers of two to keep visible spacing between 40 and 80px.
export function canvasSurfaceStyle({ color }, viewport = {}) {
  const zoom = Number.isFinite(viewport.zoom) && viewport.zoom > 0 ? viewport.zoom : 1;
  const spacing = 64 * 2 ** Math.ceil(Math.log2(40 / (64 * zoom))) * zoom;
  const phase = value => ((Number.isFinite(value) ? value : 0) % spacing + spacing) % spacing;
  const tone = normalizeCanvasColor(color) === '#000000' ? 'dark' : 'light';
  return {
    '--canvas-background': `var(--canvas-${tone}-bg)`,
    '--canvas-dot-color': `var(--canvas-${tone}-dot)`,
    '--canvas-line-color': `var(--canvas-${tone}-line)`,
    '--canvas-foreground': `var(--canvas-${tone}-text)`,
    '--canvas-muted': `var(--canvas-${tone}-muted)`,
    '--canvas-selection': `var(--canvas-${tone}-selection)`,
    '--canvas-selection-fill': `var(--canvas-${tone}-selection-fill)`,
    backgroundSize: `${spacing}px ${spacing}px`,
    backgroundPosition: `${phase(viewport.x)}px ${phase(viewport.y)}px`,
  };
}
export function canvasColorWithOpacity(color, opacity) {
  const validColor = /^#[0-9a-f]{6}$/i.test(color || '') ? color : DEFAULT_GROUP_COLOR;
  const alpha = Math.min(100, Math.max(0, Number(opacity) || 0));
  return `color-mix(in srgb, ${validColor} ${alpha}%, transparent)`;
}
