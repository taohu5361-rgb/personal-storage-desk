import { useEffect, useMemo, useRef, useState } from "react";
import { Map, Minus } from "lucide-react";
import "./canvasMinimap.css";
import { centerViewportOn, clientToMinimapWorld, containsMinimapRect, dragMinimapViewport, minimapTransform, paddedMinimapBounds, projectMinimapRect, validMinimapRect, viewportWorldRect } from "./minimapGeometry.js";

export function useMinimapPreference(mode) {
  const key = `creative-cloth:minimap:${mode}:expanded`;
  const [expanded, setExpanded] = useState(() => {
    try { return localStorage.getItem(key) !== "false"; } catch { return true; }
  });
  const toggle = () => setExpanded(current => {
    const next = !current;
    try { localStorage.setItem(key, String(next)); } catch { /* Navigation still works without storage. */ }
    return next;
  });
  return { expanded, toggle };
}

export function MinimapToggle({ expanded, toggle }) {
  return <button type="button" aria-label="小地图" aria-expanded={expanded} onClick={toggle} title={expanded ? "收起小地图" : "展开小地图"}><Map size={15} />小地图</button>;
}

export function CanvasMinimap({ sceneKey, items, viewport, surfaceRef, onViewportChange, expanded, onCollapse, suppressed = false }) {
  const panelRef = useRef(null);
  const svgRef = useRef(null);
  const gestureRef = useRef(null);
  const viewRef = useRef(viewport);
  const changeRef = useRef(onViewportChange);
  viewRef.current = viewport;
  changeRef.current = onViewportChange;
  const [layout, setLayout] = useState(null);
  const [domain, setDomain] = useState(null);
  const [dragging, setDragging] = useState(false);
  const rects = items.filter(validMinimapRect);
  const contentKey = JSON.stringify(rects.map(({ id, x, y, width, height, points }) => [id, x, y, width, height, points]));
  const sorted = [...rects].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const controls = surface.querySelector(":scope > .canvas-controls, :scope > .inner-canvas-controls");
    const measure = () => {
      const width = surface.clientWidth, height = surface.clientHeight;
      const mapWidth = width < 600 ? 160 : 220;
      const mapHeight = mapWidth * 150 / 220;
      const bottom = controls ? height - controls.offsetTop + 12 : 60;
      const right = controls ? width - controls.offsetLeft - controls.offsetWidth : 14;
      const next = { width, height, mapWidth, mapHeight, bottom, right, fits: width >= mapWidth + 28 && height >= bottom + mapHeight + 14 };
      setLayout(current => JSON.stringify(current) === JSON.stringify(next) ? current : next);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(surface);
    if (controls) observer.observe(controls);
    const rootObserver = new MutationObserver(measure);
    rootObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
    measure();
    return () => { observer.disconnect(); rootObserver.disconnect(); };
  }, [surfaceRef]);

  useEffect(() => {
    if (!layout?.width || !layout.height || gestureRef.current) return;
    const viewRect = viewportWorldRect(viewport, layout);
    setDomain(current => {
      if (!current || current.sceneKey !== sceneKey || current.contentKey !== contentKey) return { sceneKey, contentKey, bounds: paddedMinimapBounds([...rects, viewRect]) };
      if (containsMinimapRect(current.bounds, viewRect)) return current;
      return { ...current, bounds: paddedMinimapBounds([current.bounds, viewRect]) };
    });
  }, [sceneKey, contentKey, viewport.x, viewport.y, viewport.zoom, layout, dragging]);

  const finishGesture = (cancel = false) => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    gestureRef.current = null;
    if (cancel) changeRef.current(gesture.view);
    if (svgRef.current?.hasPointerCapture(gesture.pointerId)) svgRef.current.releasePointerCapture(gesture.pointerId);
    setDragging(false);
  };
  useEffect(() => {
    // A scene switch or disappearing overlay must not leave captured pointer state behind.
    finishGesture();
  }, [sceneKey, expanded, suppressed, layout?.fits, layout?.width, layout?.height, layout?.mapWidth]);
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const wheel = event => { event.preventDefault(); event.stopPropagation(); };
    panel.addEventListener("wheel", wheel, { passive: false });
    return () => panel.removeEventListener("wheel", wheel);
  }, [expanded, suppressed, layout?.fits, Boolean(domain)]);

  const mapSize = { width: Math.max((layout?.mapWidth || 220) - 2, 1), height: Math.max((layout?.mapHeight || 150) - 28, 1) };
  const transform = useMemo(() => domain ? minimapTransform(domain.bounds, mapSize) : null, [domain, mapSize.width, mapSize.height]);
  if (!expanded || suppressed || !layout?.fits || !transform) return null;
  const viewRect = projectMinimapRect(viewportWorldRect(viewport, layout), transform);
  // One extra SVG unit keeps the target >=24 logical px after CSS zoom rounding.
  const hitWidth = Math.max(25, viewRect.width), hitHeight = Math.max(25, viewRect.height);
  const stop = event => event.stopPropagation();
  const begin = event => {
    event.stopPropagation();
    event.preventDefault();
    if (event.button !== 0 || !event.isPrimary || gestureRef.current) return;
    const clientRect = svgRef.current.getBoundingClientRect();
    const point = clientToMinimapWorld(event, clientRect, mapSize, transform);
    const view = { ...viewRef.current };
    const drag = Boolean(event.target.closest(".minimap-viewport-hit"));
    gestureRef.current = { pointerId: event.pointerId, point, view, transform, clientRect, mapSize, drag };
    svgRef.current.setPointerCapture(event.pointerId);
    svgRef.current.focus();
    setDragging(true);
    if (!drag) changeRef.current(centerViewportOn(point, view, layout));
  };
  const move = event => {
    event.stopPropagation();
    const gesture = gestureRef.current;
    if (!gesture?.drag || gesture.pointerId !== event.pointerId) return;
    const point = clientToMinimapWorld(event, gesture.clientRect, gesture.mapSize, gesture.transform);
    changeRef.current(dragMinimapViewport(gesture.view, gesture.point, point));
  };
  return <section ref={panelRef} className={`canvas-minimap${dragging ? " is-dragging" : ""}`} aria-label="画布小地图"
    style={{ width: layout.mapWidth, height: layout.mapHeight, right: layout.right, bottom: layout.bottom }}
    onPointerDown={stop} onPointerMove={stop} onClick={stop} onDoubleClick={stop} onAuxClick={event => { event.preventDefault(); stop(event); }} onContextMenu={event => { event.preventDefault(); stop(event); }} onKeyDown={stop} onKeyUp={stop}>
    <header><span>小地图</span><button type="button" aria-label="收起小地图" title="收起小地图" onClick={onCollapse}><Minus size={13} /></button></header>
    <svg ref={svgRef} viewBox={`0 0 ${mapSize.width} ${mapSize.height}`} role="application" tabIndex="0" aria-label="小地图导航，点击定位，拖动视口框平移，方向键移动"
      onPointerDown={begin} onPointerMove={move} onPointerUp={event => { stop(event); if (gestureRef.current?.pointerId === event.pointerId) finishGesture(); }}
      onPointerCancel={event => { stop(event); if (gestureRef.current?.pointerId === event.pointerId) finishGesture(true); }} onLostPointerCapture={() => finishGesture()}
      onKeyDown={event => {
        event.stopPropagation();
        if (event.key === "Escape") { event.preventDefault(); finishGesture(true); return; }
        const delta = { ArrowLeft: [-40, 0], ArrowRight: [40, 0], ArrowUp: [0, -40], ArrowDown: [0, 40] }[event.key];
        if (delta) { event.preventDefault(); const view = viewRef.current; changeRef.current({ ...view, x: view.x - delta[0], y: view.y - delta[1] }); }
      }}>
      {sorted.map(item => {
        const props = { "data-minimap-id": item.id, className: `minimap-object minimap-${item.kind || "asset"}${item.selected ? " selected" : ""}`, style: item.kind === "group" && item.color ? { stroke: item.color } : undefined };
        return item.points ? <polygon key={item.id} {...props} points={item.points.map(point => `${point.x * transform.scale + transform.x},${point.y * transform.scale + transform.y}`).join(" ")} /> : <rect key={item.id} {...props} {...projectMinimapRect(item, transform)} />;
      })}
      <rect className="minimap-viewport" {...viewRect} />
      <rect className="minimap-viewport-hit" x={viewRect.x + (viewRect.width - hitWidth) / 2} y={viewRect.y + (viewRect.height - hitHeight) / 2} width={hitWidth} height={hitHeight} />
    </svg>
    {!rects.length && <span className="minimap-empty">暂无内容</span>}
  </section>;
}
