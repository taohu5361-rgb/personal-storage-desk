import { useMemo, useState } from "react";
import {
  displayShortcut,
  resolveShortcuts,
  SHORTCUT_CATEGORIES,
  shortcutFromEvent,
} from "../shortcuts/registry";
import { call } from "../data/database";

export function ShortcutSettingsPage({ store }) {
  const [query, setQuery] = useState("");
  const [recordingAction, setRecordingAction] = useState("");
  const [captureMessage, setCaptureMessage] = useState("");
  const [conflict, setConflict] = useState(null);
  const [status, setStatus] = useState("");
  const shortcuts = useMemo(
    () => resolveShortcuts(store.data.shortcutBindings),
    [store.data.shortcutBindings],
  );
  const search = query.trim().toLocaleLowerCase();
  const filtered = shortcuts.filter((item) =>
    `${item.label} ${item.category} ${displayShortcut(item.currentShortcut)}`
      .toLocaleLowerCase()
      .includes(search),
  );

  const save = async (action, shortcut, conflictAction) => {
    try {
      const bindings = await call("save_shortcut", {
        actionId: action.actionId,
        shortcut,
        reassign: Boolean(conflictAction),
        conflictActionId: conflictAction?.actionId || null,
      });
      store.setData((data) => ({ ...data, shortcutBindings: bindings }));
      setStatus(`${action.label}快捷键已保存`);
      setConflict(null);
      setRecordingAction("");
      setCaptureMessage("");
    } catch (error) {
      setStatus(`保存快捷键失败：${error}`);
    }
  };

  const startRecording = (action) => {
    setConflict(null);
    setStatus("");
    setRecordingAction(action.actionId);
    setCaptureMessage("按住 Ctrl、Alt 或 Shift 后，再按主键；按 Esc 取消。");
  };

  const handleKeyDown = (event) => {
    if (!recordingAction) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") {
      setRecordingAction("");
      setCaptureMessage("");
      return;
    }
    const shortcut = shortcutFromEvent(event);
    if (!shortcut) {
      setCaptureMessage("请继续按下字母、数字、功能键、方向键或 Delete 等按键。");
      return;
    }
    const action = shortcuts.find((item) => item.actionId === recordingAction);
    if (!action) return;
    const other = shortcuts.find(
      (item) => item.actionId !== action.actionId && item.currentShortcut === shortcut,
    );
    if (other) {
      setConflict({ action, other, shortcut });
      setRecordingAction("");
      setCaptureMessage("");
      return;
    }
    save(action, shortcut, null);
  };

  const restoreOne = async (action) => {
    try {
      const bindings = await call("reset_shortcut", { actionId: action.actionId });
      store.setData((data) => ({ ...data, shortcutBindings: bindings }));
      setStatus(`${action.label}已恢复默认快捷键`);
    } catch (error) {
      setStatus(`恢复失败：${error}`);
    }
  };

  const restoreAll = async () => {
    if (!window.confirm("恢复默认快捷键？这会清除全部自定义快捷键。")) return;
    if (!window.confirm("请再次确认恢复全部默认快捷键。")) return;
    try {
      const bindings = await call("reset_shortcuts");
      store.setData((data) => ({ ...data, shortcutBindings: bindings }));
      setStatus("已恢复默认快捷键");
    } catch (error) {
      setStatus(`恢复失败：${error}`);
    }
  };

  return (
    <section className="shortcuts-page" onKeyDown={handleKeyDown}>
      <header>
        <p className="eyebrow">设置</p>
        <h1>快捷键</h1>
        <p>自定义脚本集合器中的常用操作快捷键。</p>
      </header>
      <div className="shortcuts-toolbar">
        <input
          aria-label="搜索快捷键"
          data-shortcut-search
          placeholder="搜索快捷键……"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button className="secondary" onClick={restoreAll}>恢复默认快捷键</button>
      </div>
      {captureMessage && <p className="settings-help" role="status">{captureMessage}</p>}
      {SHORTCUT_CATEGORIES.map((category) => {
        const items = filtered.filter((item) => item.category === category);
        if (!items.length) return null;
        return (
          <section className="settings-group shortcut-group" key={category}>
            <h2>{category}</h2>
            <div className="shortcut-list">
              {items.map((item) => (
                <div className="shortcut-row" key={item.actionId}>
                  <span>{item.label}</span>
                  <kbd>{displayShortcut(item.currentShortcut)}</kbd>
                  <div className="shortcut-row-actions">
                    <button
                      className="secondary small"
                      onClick={() => startRecording(item)}
                    >
                      {recordingAction === item.actionId ? "请按下新的快捷键" : "修改"}
                    </button>
                    <button
                      className="text-button"
                      onClick={() => restoreOne(item)}
                      disabled={!item.isCustom}
                    >恢复默认</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
      {filtered.length === 0 && <p className="settings-help">没有找到匹配的快捷键</p>}
      {status && <p className="settings-status" role="status">{status}</p>}
      {conflict && (
        <div className="dialog-backdrop shortcut-conflict-backdrop">
          <section className="category-dialog shortcut-conflict" role="dialog" aria-modal="true" aria-labelledby="shortcut-conflict-title">
            <header>
              <h2 id="shortcut-conflict-title">快捷键冲突</h2>
              <p>{displayShortcut(conflict.shortcut)} 已被“{conflict.other.label}”使用。</p>
            </header>
            <footer>
              <button className="secondary" onClick={() => setConflict(null)}>取消</button>
              <button className="primary" onClick={() => save(conflict.action, conflict.shortcut, conflict.other)}>重新分配</button>
            </footer>
          </section>
        </div>
      )}
    </section>
  );
}
