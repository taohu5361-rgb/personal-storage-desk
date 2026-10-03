export function colorHex(value, fallback = "#ffffff", backdrop) {
  const s = String(value || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(s)) return s.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(s)) return "#" + [...s.slice(1)].map(c => c + c).join("").toLowerCase();
  const rgb = s.match(/^rgba?\(\s*(\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)/i);
  if (!rgb) return fallback;
  let channels = rgb.slice(1, 4).map(n => Math.min(255, +n));
  const alpha = s.match(/^rgba\([^)]*,\s*([\d.]+)\s*\)$/i);
  if (alpha && backdrop) {
    const bg = colorHex(backdrop), opacity = Math.min(1, Math.max(0, +alpha[1]));
    channels = channels.map((n,i) => Math.round(n * opacity + parseInt(bg.slice(1+i*2,3+i*2),16) * (1-opacity)));
  }
  return "#" + channels.map(n => n.toString(16).padStart(2, "0")).join("");
}
export function textBlockPreset(styleType, theme = {}) {
  const sizes = { plain: [280,160], card: [320,180], sticky: [280,190], panel: [360,240] };
  const type = sizes[styleType] ? styleType : "plain";
  return { width: sizes[type][0], height: sizes[type][1],
    borderEnabled: type === "card" || type === "panel", borderWidth: 1,
    borderColor: colorHex(theme.border, "#d6dbe3", theme.surface), borderRadius: type === "plain" ? 0 : 8,
    backgroundColor: type === "sticky" ? "#f6e9ad" : colorHex(theme.surface, "#ffffff"),
    backgroundOpacity: type === "plain" ? 0 : 100,
    textColor: type === "sticky" ? "#3d392b" : colorHex(theme.text, "#272a2e"), shadow: type !== "plain" };
}
export function placeholderColor(item, canvas = "#191d21") {
  const bg = colorHex(item.backgroundColor), under = colorHex(canvas, "#191d21");
  const alpha = Math.min(100, Math.max(0, Number(item.backgroundOpacity) || 0)) / 100;
  if (!alpha) return "var(--text-muted)";
  const rgb = [1,3,5].map(i => parseInt(bg.slice(i,i+2),16) * alpha + parseInt(under.slice(i,i+2),16) * (1-alpha));
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722 > 145 ? "#625d4c" : "#bbc3ce";
}
