import { useEffect, useLayoutEffect, useRef } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Lock, StickyNote } from "lucide-react";
import { isDrawerCollapsed } from "./DrawerLayoutEngine.js";

const RESIZE_CORNERS = { right: ["ne", "se"], left: ["nw", "sw"], top: ["nw", "ne"], bottom: ["sw", "se"] };
const EXPAND_ICONS = { left: ChevronLeft, right: ChevronRight, top: ChevronUp, bottom: ChevronDown };
const COLLAPSE_ICONS = { left: ChevronRight, right: ChevronLeft, top: ChevronDown, bottom: ChevronUp };

export function AssetNoteDrawer({
  drawer, rect, handleRect, editing, dragging, selected, resizing, resizeCorner,
  docked = true, onSelect, snapping, fromRect, grab, inverseZoom, textareaRef,
  onMoveStart, onResizeStart, onResizeKeyDown, onEdit, onTextChange, onTextBlur,
  onTextKeyDown, onContextMenu, onToggleCollapsed, onScaleSettings, assetName, onAttachmentSettings, attachmentBusy,
}) {
  const gripCleanup = useRef(null);
  useEffect(() => () => gripCleanup.current?.(), []);
  const beginGrip = (event) => {
    event.stopPropagation();
    if (event.button !== 0) return;
    event.preventDefault();
    gripCleanup.current?.();
    const { clientX: x, clientY: y, pointerId } = event;
    let moved = false;
    const move = (e) => { if (e.pointerId === pointerId && Math.hypot(e.clientX - x, e.clientY - y) >= 5) moved = true; };
    const cleanup = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", cancel);
      window.removeEventListener("keydown", key);
    };
    const up = (e) => {
      if (e.pointerId !== pointerId) return;
      move(e); cleanup();
      if (!moved) onScaleSettings(e, drawer);
    };
    const cancel = () => cleanup();
    const key = (e) => { if (e.key === "Escape") cleanup(); };
    gripCleanup.current = cleanup;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", cancel);
    window.addEventListener("keydown", key);
    onSelect(drawer.id);
    onMoveStart(event, drawer);
  };
  const articleRef = useRef(null);
  const handleRef = useRef(null);
  const toggleRef = useRef(null);
  const collapsed = docked && isDrawerCollapsed(drawer);
  const ExpandIcon = EXPAND_ICONS[drawer.side];
  const CollapseIcon = COLLAPSE_ICONS[drawer.side];
  const contentId = `drawer-content-${drawer.id}`;
  const firstLine = drawer.text.trim().split(/\r?\n/)[0];
  useLayoutEffect(() => {
    if (collapsed && selected) handleRef.current?.focus({ preventScroll: true });
    else if (!collapsed && document.activeElement === handleRef.current) toggleRef.current?.focus({ preventScroll: true });
  }, [collapsed]);
  useLayoutEffect(() => {
    if (!dragging || !articleRef.current) return;
    const body = articleRef.current.querySelector(".asset-note-drawer-text, .asset-note-drawer-editor");
    const selection = window.getSelection();
    if (body && selection) {
      const ownedRanges = [];
      for (let i = 0; i < selection.rangeCount; i++) {
        const range = selection.getRangeAt(i);
        if (range.intersectsNode(body)) ownedRanges.push(range);
      }
      for (const range of ownedRanges) selection.removeRange(range);
    }
    if (body instanceof HTMLTextAreaElement) body.setSelectionRange(body.selectionEnd, body.selectionEnd);
  }, [dragging]);
  useLayoutEffect(() => {
    if (!snapping || !fromRect || !articleRef.current) return;
    const animation = articleRef.current.animate([
      { transform: `translate(${fromRect.left - rect.left}px, ${fromRect.top - rect.top}px) scale(1.02)` },
      { transform: "translate(0, 0) scale(1)" },
    ], { duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 220, easing: "cubic-bezier(0.2, 0.82, 0.25, 1)" });
    return () => animation.cancel();
  }, [snapping, fromRect]);
  const stopControlPointer = (event) => {
    event.stopPropagation();
    // Keep the active editor until the click handler has merged its latest text.
    event.preventDefault();
  };
  const stopControlKey = (event) => {
    if (event.key === " " || event.key === "Enter") event.stopPropagation();
  };
  return (
    <>
      <article
        ref={articleRef}
        className={`asset-note-drawer side-${drawer.side}${drawer.locked ? " locked" : ""}${dragging ? " dragging" : ""}${snapping ? " snapping" : ""}${editing ? " editing" : ""}${selected ? " selected" : ""}${resizing ? " resizing" : ""}${docked ? " docked" : " floating"}${collapsed ? " collapsed" : ""}`}
        data-side={drawer.side}
        data-mode={docked ? drawer.mode || "docked-expanded" : "floating"}
        data-drawer-id={drawer.id}
        inert={collapsed ? true : undefined}
        aria-hidden={collapsed || undefined}
        tabIndex={collapsed ? -1 : 0}
        onFocus={() => onSelect(drawer.id)}
        aria-label="资产备注抽屉"
        style={{
          transformOrigin: grab ? `${grab.x}px ${grab.y}px` : undefined,
          left: rect.left, top: rect.top, width: drawer.width, height: drawer.height,
          zIndex: 200000 + (drawer.orderIndex || 0),
          "--drawer-inverse-zoom": inverseZoom,
          "--drawer-text-scale": drawer.textScale ?? 1,
          "--drawer-retract-x": drawer.side === "left" ? `${drawer.width}px` : drawer.side === "right" ? `${-drawer.width}px` : "0px",
          "--drawer-retract-y": drawer.side === "top" ? `${drawer.height}px` : drawer.side === "bottom" ? `${-drawer.height}px` : "0px",
        }}
        onPointerDown={(event) => { event.stopPropagation(); onSelect(drawer.id); }}
        onDoubleClick={(event) => { event.stopPropagation(); if (!collapsed) onEdit(drawer.id); }}
        onContextMenu={(event) => onContextMenu(event, drawer)}
      >
        <div className="asset-note-drawer-content" id={contentId}>
          <header className="asset-note-drawer-header" onPointerDown={(event) => { onSelect(drawer.id); onMoveStart(event, drawer); }} onDoubleClick={(event) => event.stopPropagation()} title={drawer.locked ? "位置与尺寸已锁定" : "拖动标题栏移动，双击正文编辑"}>
            <button type="button" className="asset-note-attachment-title"
              aria-label={`更换附属资产：${assetName || "独立备注"}`} aria-haspopup="dialog"
              title={assetName ? `附属：${assetName}` : "独立备注"} disabled={drawer.locked || attachmentBusy}
              onPointerDown={stopControlPointer} onKeyDown={stopControlKey}
              onDoubleClick={(event) => event.stopPropagation()}
              onClick={(event) => { event.stopPropagation(); onAttachmentSettings(event, drawer); }}
            ><span>{assetName ? `附属：${assetName}` : "独立备注"}</span><ChevronDown size={12} /></button>
            <span className="asset-note-drawer-header-actions">
              {drawer.locked && <Lock size={12} aria-label="已锁定" />}
              <button type="button" className="asset-note-drawer-grip" aria-label="文字缩放" title="点击调整文字缩放，拖动移动备注" onPointerDown={beginGrip} onDoubleClick={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); if (e.detail === 0) onScaleSettings(e, drawer); }} onKeyDown={stopControlKey}>⠿</button>
              {docked && <button
                ref={toggleRef} type="button" className="asset-note-drawer-toggle"
                aria-label="收起备注" title="收起备注" aria-expanded={!collapsed} aria-controls={contentId}
                onPointerDown={stopControlPointer} onDoubleClick={(event) => event.stopPropagation()}
                onKeyDown={stopControlKey}
                onClick={(event) => { event.stopPropagation(); onToggleCollapsed(drawer); }}
              ><CollapseIcon size={14} /></button>}
            </span>
          </header>
          {editing && !collapsed ? <textarea
            ref={textareaRef} className="asset-note-drawer-editor" aria-label="备注内容"
            value={drawer.text} placeholder="写下备注…" spellCheck="false"
            onPointerDown={(event) => event.stopPropagation()}
            onChange={(event) => onTextChange(drawer, event.target.value)}
            onBlur={() => onTextBlur(drawer)} onKeyDown={(event) => onTextKeyDown(event, drawer)}
          /> : <div className={`asset-note-drawer-text${drawer.text ? "" : " empty"}`}>{drawer.text || "双击填写备注"}</div>}
        </div>
        {!drawer.locked && !collapsed && (docked ? RESIZE_CORNERS[drawer.side] : ["nw", "ne", "sw", "se"]).map((corner) => <button
          key={corner} type="button" className={`asset-note-drawer-resize ${corner}${resizing && resizeCorner === corner ? " active" : ""}`}
          aria-label={`调整备注抽屉大小 ${corner}`} aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
          onDoubleClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => { onSelect(drawer.id); onResizeStart(event, drawer, corner); }}
          onKeyDown={(event) => onResizeKeyDown(event, drawer, corner)}
        />)}
      </article>
      {docked && <button
        ref={handleRef} type="button"
        className={`asset-note-drawer-handle side-${drawer.side}${collapsed ? " visible" : ""}${selected ? " selected" : ""}`}
        data-drawer-id={drawer.id} data-side={drawer.side}
        tabIndex={collapsed ? 0 : -1} aria-hidden={!collapsed || undefined}
        aria-label={firstLine ? `展开备注：${firstLine}` : "展开备注"}
        title={firstLine || "展开备注"} aria-expanded={!collapsed} aria-controls={contentId}
        style={{ left: handleRect.left, top: handleRect.top, width: handleRect.width, height: handleRect.height, "--drawer-inverse-zoom": inverseZoom, zIndex: 200001 + (drawer.orderIndex || 0) }}
        onFocus={() => onSelect(drawer.id)} onPointerDown={stopControlPointer}
        onKeyDown={stopControlKey}
        onDoubleClick={(event) => event.stopPropagation()}
        onClick={(event) => { event.stopPropagation(); onToggleCollapsed(drawer); }}
        onContextMenu={(event) => onContextMenu(event, drawer)}
      ><StickyNote size={12} /><ExpandIcon size={12} /></button>}
    </>
  );
}
