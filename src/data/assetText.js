import { id } from "./database.js";
import { textBlockPreset } from "./textBlockAppearance.js";

export const TEXT_BLOCK_STYLES = [
  { id: "plain", label: "无框文字" },
  { id: "card", label: "卡片文字框" },
  { id: "sticky", label: "便签" },
  { id: "panel", label: "信息面板" },
];

export function applyTextBlockStyle(item, styleType, theme) {
  const { width, height, ...appearance } = textBlockPreset(styleType, theme);
  return { ...appearance, styleType };
}

export function createTextBlockItem(assetId, point, styleType = "plain", zIndex = 1, theme) {
  const defaults = textBlockPreset(styleType, theme);
  const timestamp = Date.now();
  const objectId = id("canvas-text");
  return {
    assetId,
    objectId,
    objectType: "textBlock",
    sourcePromptId: null,
    fieldKey: "",
    textValue: "",
    title: "",
    x: point.x,
    y: point.y,
    rotation: 0,
    zIndex,
    locked: false,
    groupId: null,
    styleType,
    fontFamily: "system-ui",
    fontSize: 16,
    fontWeight: 400,
    textColor: "#334155",
    textAlign: "left",
    lineHeight: 1.5,
    ...defaults,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function toTextSurfaceItem(block) {
  return {
    assetId: block.assetId,
    objectId: block.id,
    objectType: "textBlock",
    sourcePromptId: null,
    fieldKey: "",
    textValue: block.content,
    title: block.title,
    x: block.x,
    y: block.y,
    width: block.width,
    height: block.height,
    rotation: block.rotation || 0,
    zIndex: block.zIndex,
    locked: block.locked,
    groupId: block.groupId,
    styleType: block.styleType,
    fontFamily: block.fontFamily,
    fontSize: block.fontSize,
    fontWeight: block.fontWeight,
    textColor: block.textColor,
    textAlign: block.textAlign,
    lineHeight: block.lineHeight,
    borderEnabled: block.borderEnabled,
    borderColor: block.borderColor,
    borderWidth: block.borderWidth,
    borderRadius: block.borderRadius,
    backgroundColor: block.backgroundColor,
    backgroundOpacity: block.backgroundOpacity,
    shadow: block.shadow,
    createdAt: block.createdAt,
    updatedAt: block.updatedAt,
  };
}

