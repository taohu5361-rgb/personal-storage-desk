import { TextEditor } from "./TextEditor";
import "./textBlocks.css";
import { placeholderColor } from "../../data/textBlockAppearance.js";

const rgba = (color, opacity) => {
  const value = String(color || "#ffffff").replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(value)) return "transparent";
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return "rgba(" + red + ", " + green + ", " + blue + ", " + Math.min(100, Math.max(0, opacity)) / 100 + ")";
};

const genericFonts = new Set(["system-ui", "sans-serif", "serif", "monospace"]);
const fontStack = (family) => {
  const name = String(family || "system-ui");
  if (genericFonts.has(name)) return name;
  return '"' + name.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '", system-ui, sans-serif';
};

export function TextBlock({ item, editing, theme = {}, onChange, onSave }) {
  const style = {
    "--text-line-height": item.lineHeight || 1.5,
    "--text-placeholder-color": placeholderColor(item, theme.canvas),
    color: item.textColor || "#334155",
    fontFamily: fontStack(item.fontFamily),
    fontSize: (item.fontSize || 16) + "px",
    fontWeight: item.fontWeight || 400,
    lineHeight: item.lineHeight || 1.5,
    textAlign: item.textAlign || "left",
    backgroundColor: rgba(item.backgroundColor, item.backgroundOpacity),
    border: item.borderEnabled
      ? (item.borderWidth || 1) + "px solid " + (item.borderColor || "#d6dbe3")
      : "1px solid transparent",
    borderRadius: (item.borderRadius || 0) + "px",
    boxShadow: item.shadow ? "0 2px 8px rgba(0, 0, 0, .12)" : "none",
  };

  return (
    <div
      className={
        "text-block-surface text-block-style-" +
        (item.styleType || "plain") +
        (editing ? " is-editing" : "")
      }
      style={style}
    >
      {editing ? (
        <TextEditor item={item} onChange={onChange} onSave={onSave} />
      ) : (
        <>
          {item.styleType === "panel" && (
            <header className="text-block-panel-title">{item.title}</header>
          )}
          <div className="text-block-content">
            {item.textValue || (
              <span className="text-block-placeholder"><span className="text-placeholder-idle">文字</span><span className="text-placeholder-active">双击编辑</span></span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
