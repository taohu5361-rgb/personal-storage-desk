import { fileUrl } from "../../data/database";

const cssString = (value) =>
  '"' + String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]/g, "") + '"';

const cssFormat = {
  ttf: "truetype",
  otf: "opentype",
  woff: "woff",
  woff2: "woff2",
};

export function syncFontFaces(fonts = []) {
  let style = document.getElementById("managed-canvas-font-faces");
  if (!style) {
    style = document.createElement("style");
    style.id = "managed-canvas-font-faces";
    document.head.appendChild(style);
  }
  style.textContent = fonts
    .filter((font) => font.family && font.filePath && cssFormat[font.format])
    .map((font) =>
      "@font-face{font-family:" +
      cssString(font.family) +
      ";src:url(" +
      cssString(fileUrl(font.filePath)) +
      ") format(" +
      cssString(cssFormat[font.format]) +
      ");font-style:normal;font-weight:100 900;font-display:swap;}",
    )
    .join("\n");
}
