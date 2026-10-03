export const SHORTCUT_ACTIONS = [
  { actionId: "back", label: "返回", category: "通用", scope: "global", defaultShortcut: "Alt+ArrowLeft" },
  { actionId: "save", label: "保存", category: "通用", scope: "canvas", defaultShortcut: "Ctrl+S" },
  { actionId: "close-window", label: "关闭当前窗口", category: "通用", scope: "global", defaultShortcut: "Ctrl+W" },
  { actionId: "open-settings", label: "打开设置", category: "通用", scope: "global", defaultShortcut: "Ctrl+Comma" },
  { actionId: "search", label: "搜索", category: "通用", scope: "global", defaultShortcut: "Ctrl+F" },

  { actionId: "undo", label: "撤销", category: "编辑", scope: "canvas", defaultShortcut: "Ctrl+Z" },
  { actionId: "redo", label: "重做", category: "编辑", scope: "canvas", defaultShortcut: "Ctrl+Y" },
  { actionId: "cut", label: "剪切", category: "编辑", scope: "asset", defaultShortcut: "Ctrl+X" },
  { actionId: "copy", label: "复制", category: "编辑", scope: "asset", defaultShortcut: "Ctrl+C" },
  { actionId: "paste", label: "粘贴", category: "编辑", scope: "asset", defaultShortcut: "Ctrl+V" },
  { actionId: "delete", label: "删除", category: "编辑", scope: "asset", defaultShortcut: "Delete" },
  { actionId: "select-all", label: "全选", category: "编辑", scope: "canvas", defaultShortcut: "Ctrl+A" },

  { actionId: "canvas-zoom-in", label: "放大", category: "画布", scope: "canvas", defaultShortcut: "Ctrl+Shift+Plus" },
  { actionId: "canvas-zoom-out", label: "缩小", category: "画布", scope: "canvas", defaultShortcut: "Ctrl+Minus" },
  { actionId: "canvas-zoom-reset", label: "恢复 100%", category: "画布", scope: "canvas", defaultShortcut: "Ctrl+0" },
  { actionId: "canvas-fit", label: "适应全部", category: "画布", scope: "canvas", defaultShortcut: "Ctrl+1" },
  { actionId: "canvas-toggle-lock", label: "锁定 / 解锁资产", category: "画布", scope: "asset", defaultShortcut: "Ctrl+L" },
  { actionId: "canvas-bring-top", label: "置于顶层", category: "画布", scope: "asset", defaultShortcut: "Ctrl+Shift+BracketRight" },
  { actionId: "canvas-send-bottom", label: "置于底层", category: "画布", scope: "asset", defaultShortcut: "Ctrl+Shift+BracketLeft" },
  { actionId: "canvas-group-selected", label: "将选中资产分组", category: "画布", scope: "asset", defaultShortcut: "Ctrl+G" },
  { actionId: "canvas-immersive", label: "沉浸模式", category: "画布", scope: "canvas", defaultShortcut: "Tab" },

  { actionId: "asset-add", label: "新增资产", category: "资产", scope: "asset", defaultShortcut: "Ctrl+N" },
  { actionId: "asset-edit", label: "编辑资产", category: "资产", scope: "asset", defaultShortcut: "Ctrl+E" },
  { actionId: "asset-delete", label: "删除资产", category: "资产", scope: "asset", defaultShortcut: "" },
  { actionId: "asset-open", label: "打开详情", category: "资产", scope: "asset", defaultShortcut: "Ctrl+O" },

  { actionId: "category-add", label: "新增分类", category: "分类", scope: "asset", defaultShortcut: "Ctrl+Shift+N" },
  { actionId: "category-edit", label: "编辑分类", category: "分类", scope: "asset", defaultShortcut: "Ctrl+Shift+E" },
  { actionId: "category-delete", label: "删除分类", category: "分类", scope: "asset", defaultShortcut: "Ctrl+Shift+Delete" },
];

export const SHORTCUT_CATEGORIES = ["通用", "编辑", "画布", "资产", "分类"];
const NATIVE_TEXT_SHORTCUTS = new Set(["Ctrl+X", "Ctrl+C", "Ctrl+V", "Ctrl+A", "Ctrl+Z", "Ctrl+Y"]);

export function resolveShortcuts(overrides = []) {
  const saved = new Map(overrides.map((item) => [item.actionId, item]));
  return SHORTCUT_ACTIONS.map((item) => {
    const custom = saved.get(item.actionId);
    return {
      ...item,
      currentShortcut: custom ? custom.shortcut : item.defaultShortcut,
      isCustom: Boolean(custom?.isCustom),
    };
  });
}

const normalizeKey = (key) => {
  if (key === " ") return "Space";
  if (key === "+") return "Plus";
  if (key === ",") return "Comma";
  if (key === "-") return "Minus";
  if (key === "[") return "BracketLeft";
  if (key === "]") return "BracketRight";
  if (/^Arrow(Left|Right|Up|Down)$/.test(key)) return key;
  if (/^F\d{1,2}$/i.test(key)) return key.toUpperCase();
  if (key.length === 1 && /[a-z]/i.test(key)) return key.toUpperCase();
  if (key.length === 1 && /\d/.test(key)) return key;
  return key;
};

export function shortcutFromEvent(event) {
  const key = event.key;
  if (["Control", "Shift", "Alt", "Meta", "AltGraph"].includes(key)) return "";
  const parts = [];
  if (event.ctrlKey || event.metaKey) parts.push("Ctrl");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  const codeKey = event.code === "BracketLeft" ? "BracketLeft" : event.code === "BracketRight" ? "BracketRight" : normalizeKey(key);
  parts.push(codeKey);
  return parts.join("+");
}

export function displayShortcut(shortcut = "") {
  if (!shortcut) return "未设置";
  return shortcut
    .split("+")
    .map((part) => ({
      ArrowLeft: "Left",
      ArrowRight: "Right",
      ArrowUp: "Up",
      ArrowDown: "Down",
      Plus: "+",
      Minus: "-",
      Comma: ",",
      BracketLeft: "[",
      BracketRight: "]",
    })[part] || part)
    .filter((part, index, parts) => !(part === "Shift" && parts.includes("+") && index === parts.indexOf("Shift")))
    .join("+");
}

export function formatShortcutEvent(event) {
  return shortcutFromEvent(event);
}

export function isNativeTextShortcut(shortcut) {
  return NATIVE_TEXT_SHORTCUTS.has(shortcut);
}
