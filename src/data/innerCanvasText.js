// Compatibility adapters for the original inner-canvas verification fixture.
export { TEXT_BLOCK_STYLES, applyTextBlockStyle, createTextBlockItem, toTextSurfaceItem as fromCanvasTextBlock } from "./assetText.js";

export function toCanvasTextBlock(item, assetId = item.assetId) {
  return {
    id: item.objectId,
    canvasId: assetId,
    assetId,
    styleType: item.styleType || "plain",
    title: item.title || "",
    content: item.textValue || "",
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    rotation: item.rotation || 0,
    zIndex: item.zIndex,
    locked: Boolean(item.locked),
    groupId: item.groupId || null,
    fontFamily: item.fontFamily || "system-ui",
    fontSize: Number(item.fontSize) || 16,
    fontWeight: Number(item.fontWeight) || 400,
    textColor: item.textColor || "#334155",
    textAlign: item.textAlign || "left",
    lineHeight: Number(item.lineHeight) || 1.5,
    borderEnabled: Boolean(item.borderEnabled),
    borderColor: item.borderColor || "#d6dbe3",
    borderWidth: Number(item.borderWidth) || 0,
    borderRadius: Number(item.borderRadius) || 0,
    backgroundColor: item.backgroundColor || "#ffffff",
    backgroundOpacity: Number(item.backgroundOpacity) || 0,
    shadow: Boolean(item.shadow),
    createdAt: item.createdAt || Date.now(),
    updatedAt: Date.now(),
  };
}
