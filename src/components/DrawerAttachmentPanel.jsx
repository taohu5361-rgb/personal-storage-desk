import { useEffect, useRef, useState } from "react";

export function DrawerAttachmentPanel({ drawer, assets, position, busy, onChoose, onClose }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);
  const dialogRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  const filtered = assets.filter((asset) => asset.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const keyDown = (event) => {
    event.stopPropagation();
    if (event.key === "Escape") { event.preventDefault(); onClose(); }
    if (event.key === "Tab") {
      const items = [...dialogRef.current.querySelectorAll('button:not(:disabled), input')];
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  };
  return <div ref={dialogRef} className="asset-note-attachment-panel" role="dialog" aria-modal="true" aria-label="选择附属资产"
    style={{ left: position.x, top: position.y }} onPointerDown={(event) => event.stopPropagation()} onKeyDown={keyDown} aria-busy={busy}>
    <div className="asset-note-attachment-heading"><strong>附属资产</strong><button type="button" aria-label="关闭附属资产选择" onClick={onClose}>×</button></div>
    <input ref={inputRef} type="search" aria-label="搜索附属资产" placeholder="搜索当前分类的资产…" value={query} onChange={(event) => setQuery(event.target.value)} />
    <div className="asset-note-attachment-options">
      <button type="button" disabled={busy} aria-pressed={!drawer.assetId} onClick={() => onChoose(null)}>无（独立备注）{!drawer.assetId && <span>✓</span>}</button>
      {filtered.map((asset) => <button key={asset.id} type="button" title={asset.name} disabled={busy} aria-pressed={drawer.assetId === asset.id} onClick={() => onChoose(asset.id)}><span>{asset.name}</span>{drawer.assetId === asset.id && <span>✓</span>}</button>)}
      {!filtered.length && <p>没有匹配的资产</p>}
    </div>
    <p className="asset-note-attachment-help">选择资产会同时更换归属与吸附位置。</p>
  </div>;
}
