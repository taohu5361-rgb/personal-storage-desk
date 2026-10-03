import { CANVAS_COLORS, CANVAS_PATTERNS, normalizeCanvasColor } from '../canvasAppearance';

export function CanvasAppearanceControls({ color, pattern, onChange }) {
  return <div className="canvas-appearance-options">
    <div className="canvas-appearance-row"><span>底色</span>
      <div className="canvas-choice-group" role="group" aria-label="画布底色">
        {CANVAS_COLORS.map(item => <button type="button" key={item.value}
          aria-pressed={normalizeCanvasColor(color) === item.value}
          onClick={() => onChange({ color: item.value, pattern })}>
          <i className={`canvas-tone-swatch ${item.label === '黑色' ? 'dark' : 'light'}`} aria-hidden="true" />{item.label}
        </button>)}
      </div>
    </div>
    <div className="canvas-appearance-row"><span>网格</span>
      <div className="canvas-choice-group" role="group" aria-label="画布网格">
        {CANVAS_PATTERNS.map(item => <button type="button" key={item.value} aria-pressed={pattern === item.value}
          onClick={() => onChange({ color: normalizeCanvasColor(color), pattern: item.value })}>{item.label}</button>)}
      </div>
    </div>
  </div>;
}
