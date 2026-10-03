// The canvas owns middle-button gestures before scene objects receive them.
export const CANVAS_PAN_CONTROLS = '.canvas-controls, .canvas-context-menu, .canvas-appearance-panel, .canvas-minimap, .canvas-group-editor, .canvas-arrange-toolbar, .canvas-transform-error, .inner-canvas-controls, .inner-canvas-context-menu, .inner-canvas-lightbox, .text-style-toolbar, .outer-text-save-error, .inner-canvas-error';

export function captureMiddleCanvasPan(event, surface, start) {
  if (event.button !== 1 || event.target.closest(CANVAS_PAN_CONTROLS)) return;
  event.preventDefault();
  event.stopPropagation();
  start();
  surface.setPointerCapture(event.pointerId);
}
