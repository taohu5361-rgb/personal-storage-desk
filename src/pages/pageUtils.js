import { fileUrl } from "../data/database";
export const now = () => Date.now();
export const readImageRatio = (path) =>
  new Promise((resolve) => {
    if (!path) return resolve(1);
    const image = new window.Image();
    image.onload = () =>
      resolve(
        image.naturalWidth && image.naturalHeight
          ? image.naturalWidth / image.naturalHeight
          : 1,
      );
    image.onerror = () => resolve(1);
    image.src = fileUrl(path);
  });
export const initialImageSize = (ratio, maxEdge = 420) =>
  ratio >= 1
    ? { width: maxEdge, height: maxEdge / ratio }
    : { width: maxEdge * ratio, height: maxEdge };
export const assetNameFromPath = (path) => {
  const fileName =
    String(path || "")
      .split(/[\\/]/)
      .pop() || "";
  const extensionAt = fileName.lastIndexOf(".");
  return extensionAt > 0 ? fileName.slice(0, extensionAt) : fileName;
};
export const withUrls = (asset) => ({
  ...asset,
  previewUrl: fileUrl(
    asset.thumbnailPath || asset.previewPath || asset.coverImagePath,
  ),
});
