import { useEffect, useState } from "react";
import { AlignCenter, AlignLeft, AlignRight } from "lucide-react";
import { applyTextBlockStyle, TEXT_BLOCK_STYLES } from "../../data/assetText";
import "./textBlocks.css";

const builtInFonts = [
  ["system-ui", "系统默认"],
  ["Segoe UI", "Segoe UI"],
  ["Arial", "Arial"],
  ["Georgia", "Georgia"],
  ["Consolas", "Consolas"],
  ["serif", "衬线体"],
  ["monospace", "等宽字体"],
];

function NumberField({ value, min, max, step = 1, onCommit }) {
  const current = Number.isFinite(Number(value)) ? Number(value) : min;
  const [draft, setDraft] = useState(String(current));

  useEffect(() => setDraft(String(current)), [current]);

  const commit = () => {
    const parsed = Number(draft);
    if (!draft.trim() || !Number.isFinite(parsed)) {
      setDraft(String(current));
      return;
    }
    const bounded = Math.min(max, Math.max(min, parsed));
    const next = step >= 1 ? Math.round(bounded) : Number(bounded.toFixed(2));
    setDraft(String(next));
    if (next !== current) onCommit(next);
  };

  return (
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
    />
  );
}

export function TextStyleToolbar({ item, fonts = [], theme, dockSide = 'right', onChange }) {
  const update = (key, value) => onChange({ [key]: value });
  const stopCanvas = (event) => event.stopPropagation();

  return (
    <aside
      className="text-style-toolbar"
      data-dock={dockSide}
      aria-label="文字样式"
      onPointerDown={stopCanvas}
      onContextMenu={stopCanvas}
      onKeyDown={stopCanvas}
    >
      <header>
        <strong>文字样式</strong>
        <select
          aria-label="样式类型"
          value={item.styleType || "plain"}
          onChange={(event) => onChange(applyTextBlockStyle(item, event.target.value, theme))}
        >
          {TEXT_BLOCK_STYLES.map((style) => (
            <option key={style.id} value={style.id}>
              {style.label}
            </option>
          ))}
        </select>
      </header>
      <div className="text-style-toolbar-row">
        <label>
          <span>字体</span>
          <select
            value={item.fontFamily || "system-ui"}
            onChange={(event) => update("fontFamily", event.target.value)}
          >
            {builtInFonts.map(([family, label]) => (
              <option key={family} value={family}>
                {label}
              </option>
            ))}
            {fonts.map((font) => (
              <option key={font.id} value={font.family}>
                {font.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-style-small-number">
          <span>字号</span>
          <NumberField
            min={8}
            max={128}
            value={item.fontSize || 16}
            onCommit={(value) => update("fontSize", value)}
          />
        </label>
      </div>
      <div className="text-style-toolbar-row">
        <label>
          <span>字重</span>
          <select
            value={item.fontWeight || 400}
            onChange={(event) => update("fontWeight", Number(event.target.value))}
          >
            {[400, 500, 600, 700, 800, 900].map((weight) => (
              <option key={weight} value={weight}>
                {weight === 400 ? "常规" : weight === 700 ? "粗体" : weight}
              </option>
            ))}
          </select>
        </label>
        <label className="text-style-color">
          <span>文字颜色</span>
          <input
            type="color"
            aria-label="文字颜色"
            value={item.textColor || "#334155"}
            onChange={(event) => update("textColor", event.target.value)}
          />
        </label>
      </div>
      <div className="text-style-align" role="group" aria-label="文字对齐">
        {[
          ["left", AlignLeft, "左对齐"],
          ["center", AlignCenter, "居中"],
          ["right", AlignRight, "右对齐"],
        ].map(([align, Icon, label]) => (
          <button
            key={align}
            type="button"
            aria-label={label}
            aria-pressed={(item.textAlign || "left") === align}
            className={(item.textAlign || "left") === align ? "active" : ""}
            onClick={() => update("textAlign", align)}
          >
            <Icon size={15} />
          </button>
        ))}
      </div>
      <details>
        <summary>容器与行距</summary>
        <div className="text-style-advanced">
          <label className="text-style-number">
            <span>行高</span>
            <NumberField
              min={0.8}
              max={3}
              step={0.1}
              value={item.lineHeight || 1.5}
              onCommit={(value) => update("lineHeight", value)}
            />
          </label>
          <label className="text-style-color">
            <span>背景色</span>
            <input
              type="color"
              aria-label="背景颜色"
              value={item.backgroundColor || "#ffffff"}
              onChange={(event) => update("backgroundColor", event.target.value)}
            />
          </label>
          <label className="text-style-number">
            <span>背景透明度</span>
            <NumberField
              min={0}
              max={100}
              value={item.backgroundOpacity ?? 0}
              onCommit={(value) => update("backgroundOpacity", value)}
            />
          </label>
          <label className="text-style-check">
            <span>显示边框</span>
            <input
              type="checkbox"
              checked={Boolean(item.borderEnabled)}
              onChange={(event) => update("borderEnabled", event.target.checked)}
            />
          </label>
          <label className="text-style-color">
            <span>边框颜色</span>
            <input
              type="color"
              aria-label="边框颜色"
              value={item.borderColor || "#d6dbe3"}
              onChange={(event) => update("borderColor", event.target.value)}
            />
          </label>
          <label className="text-style-number">
            <span>边框粗细</span>
            <NumberField
              min={0}
              max={12}
              step={0.5}
              value={item.borderWidth ?? 1}
              onCommit={(value) => update("borderWidth", value)}
            />
          </label>
          <label className="text-style-number">
            <span>圆角</span>
            <NumberField
              min={0}
              max={64}
              value={item.borderRadius ?? 0}
              onCommit={(value) => update("borderRadius", value)}
            />
          </label>
          <label className="text-style-check text-style-wide">
            <span>轻阴影</span>
            <input
              type="checkbox"
              checked={Boolean(item.shadow)}
              onChange={(event) => update("shadow", event.target.checked)}
            />
          </label>
        </div>
      </details>
    </aside>
  );
}
