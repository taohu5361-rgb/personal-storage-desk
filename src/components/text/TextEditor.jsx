import { useEffect, useRef } from "react";

export function TextEditor({ item, onChange, onSave }) {
  const rootRef = useRef(null);

  useEffect(() => {
    const editor = rootRef.current?.querySelector("textarea");
    editor?.focus();
    editor?.setSelectionRange(editor.value.length, editor.value.length);
  }, [item.objectId]);

  const handleKeyDown = (event) => {
    if (event.isComposing || event.nativeEvent?.isComposing) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onSave();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      onSave();
      return;
    }
    if (
      (event.ctrlKey || event.metaKey) &&
      ["a", "c", "v", "x", "z", "y"].includes(event.key.toLowerCase())
    ) {
      event.stopPropagation();
    }
  };

  return (
    <div
      ref={rootRef}
      className="text-block-editor"
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.stopPropagation()}
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget)) onSave();
      }}
    >
      {item.styleType === "panel" && (
        <input
          className="text-block-title-input"
          aria-label="信息面板标题"
          placeholder="可选标题"
          value={item.title || ""}
          onChange={(event) => onChange({ title: event.target.value })}
          onKeyDown={handleKeyDown}
        />
      )}
      <textarea
        aria-label="编辑文字块内容"
        placeholder="输入多行文字…"
        value={item.textValue || ""}
        onChange={(event) => onChange({ textValue: event.target.value })}
        onKeyDown={handleKeyDown}
      />
      <footer>
        <span>支持中英文输入 · Esc 完成</span>
        <button type="button" className="secondary small" onClick={onSave}>
          完成
        </button>
      </footer>
    </div>
  );
}
