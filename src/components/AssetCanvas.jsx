import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChevronDown, ChevronRight, FileBox, Lock, Maximize, Minus, Palette, Plus, StickyNote, RotateCw, Unlock } from "lucide-react";
import { DEFAULT_GROUP_COLOR, canvasColorWithOpacity, resolveCanvasAppearance, canvasSurfaceStyle } from "../canvasAppearance";
import { CanvasAppearanceControls } from "./CanvasAppearanceControls";
import { CanvasMinimap, MinimapToggle, useMinimapPreference } from "./CanvasMinimap";
import { minimapPolygonItem } from "./minimapGeometry.js";
import { objectToWorld } from "./canvasTransforms.js";
import { AssetNoteDrawerLayer, AssetNoteDockHost } from "./AssetNoteDrawerLayer";
import { CategoryCanvasTextLayer } from "./CategoryCanvasTextLayer";
import { TEXT_BLOCK_STYLES } from "../data/assetText";
import { captureMiddleCanvasPan } from "./middleCanvasPan";

import { boundsOf, unionBounds, intersectsRotated } from "./canvasTransforms.js";
import { CanvasArrangeTools, ArrangeCommands, CanvasSnapGuides, CanvasAxisGuides } from "./CanvasArrangeTools";
import { useOuterCanvasTransforms } from "./useOuterCanvasTransforms";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const MIN_WIDTH = 80;
const MAX_WIDTH = 2000;
const GROUP_PADDING = 24;
const GROUP_HEADER_SPACE = 34;
const MIN_GROUP_WIDTH = 120;
const MIN_GROUP_HEIGHT = 90;

const readUiScale = () => Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ui-scale")) || 1;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const intersects = (a, b) =>
  a.left <= b.right &&
  a.right >= b.left &&
  a.top <= b.bottom &&
  a.bottom >= b.top;
const assetOuterHeight = (asset) =>
  asset.height + (asset.tags?.length ? 44 : 32);
const expandGroupsToFit = (groupItems, assetItems, movedIds) => {
  const moved = new Set(movedIds);
  let changed = false;
  const next = groupItems.map((group) => {
    const members = assetItems.filter(
      (asset) => asset.groupId === group.id && moved.has(asset.id),
    );
    if (!members.length) return group;
    const boxes=members.map(asset=>boundsOf({...asset,height:assetOuterHeight(asset)}));
    const left=Math.min(...boxes.map(b=>b.left))-GROUP_PADDING,top=Math.min(...boxes.map(b=>b.top))-GROUP_HEADER_SPACE;
    const right=Math.max(...boxes.map(b=>b.right))+GROUP_PADDING,bottom=Math.max(...boxes.map(b=>b.bottom))+GROUP_PADDING;
    const x = Math.min(group.x, left);
    const y = Math.min(group.y, top);
    const maxX = Math.max(group.x + group.width, right);
    const maxY = Math.max(group.y + group.height, bottom);
    if (x === group.x && y === group.y && maxX === group.x + group.width && maxY === group.y + group.height) return group;
    changed = true;
    return { ...group, x, y, width: maxX - x, height: maxY - y };
  });
  return changed ? next : groupItems;
};

export const AssetCanvas = forwardRef(function AssetCanvas(
  {
    assets,
    groups = [],
    textBlocks = [],
    fonts = [],
    onSaveText,
    onSaveTransform,
    settings,
    search,
    categories,
    activeCategory,
    onAssetsChange,
    onAssetsCommit,
    onGroupsChange,
    onGroupsCommit,
    onGroupSave,
    onCreateGroup,
    onChangeGroupMember,
    onDeleteGroup,
    onSaveLayout,
    onViewportChange,
    onOpen,
    onEdit,
    onDelete,
    onAdd,
    onRelink,
    onMoveCategory,
    onImageMetrics,
    onCanvasAppearance,
  },
  ref,
) {
  const surfaceRef = useRef(null);
  const worldRef = useRef(null);
  const drawerLayerRef = useRef(null);
  const textLayerRef = useRef(null);
  const minimap = useMinimapPreference("outer");
  const [minimapDrawers, setMinimapDrawers] = useState([]);
  const [minimapTexts, setMinimapTexts] = useState([]);
  const [collapsedGroupSizes, setCollapsedGroupSizes] = useState({});
  const updateMinimapDrawers = useCallback(next => setMinimapDrawers(current => JSON.stringify(current) === JSON.stringify(next) ? current : next), []);
  const updateMinimapTexts = useCallback(next => setMinimapTexts(current => JSON.stringify(current) === JSON.stringify(next) ? current : next), []);
  useEffect(() => {
    const nodes = [...(worldRef.current?.querySelectorAll('.canvas-group.collapsed') || [])];
    const measure = () => {
      const next = Object.fromEntries(nodes.map(node => [node.dataset.groupId, { width: node.offsetWidth, height: node.offsetHeight }]));
      setCollapsedGroupSizes(current => JSON.stringify(current) === JSON.stringify(next) ? current : next);
    };
    const observer = new ResizeObserver(measure);
    nodes.forEach(node => observer.observe(node));
    measure();
    return () => observer.disconnect();
  }, [groups]);
  const transformsRef=useRef(null);
  const clearAssetSelection = useCallback(() => {transformsRef.current?.clear();setSelected([]);setSelectedGroupId("");setMenu(null);},[]);
  const [drawerDockHosts, setDrawerDockHosts] = useState(() => new Map());
  const [drawerDecorations, setDrawerDecorations] = useState({});
  const registerDrawerHost = useCallback((assetId, node) => {
    setDrawerDockHosts((current) => {
      if ((current.get(assetId) || null) === node) return current;
      const next = new Map(current);
      if (node) next.set(assetId, node); else next.delete(assetId);
      return next;
    });
  }, []);
  const updateDrawerDecorations = useCallback((next) => {
    setDrawerDecorations((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next);
  }, []);
  const interactionRef = useRef(null);
  const cancelNativeRef=useRef(null);
  const [middlePanning, setMiddlePanning] = useState(false);
  const spaceRef = useRef(false);
  const [selected, setSelected] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectionBox, setSelectionBox] = useState(null);
  const [menu, setMenu] = useState(null);
  const [editingGroupId, setEditingGroupId] = useState("");
  const [editingGroupName, setEditingGroupName] = useState("");
  const [groupEditor, setGroupEditor] = useState(null);
  const [hoveredGroupId, setHoveredGroupId] = useState("");
  const groupNameInputRef = useRef(null);
  const skipGroupNameBlurRef = useRef(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [fps, setFps] = useState(0);
  const assetsRef = useRef(assets);
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  useEffect(() => { assetsRef.current = assets; }, [assets]);
  useEffect(() => {
    if (!settings?.showPerformance) return;
    let frame, count = 0, start = performance.now();
    const tick = (time) => {
      count++;
      if (time - start >= 1000) { setFps(Math.round(count * 1000 / (time - start))); count = 0; start = time; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [settings?.showPerformance]);
  const metadataMode = settings?.assetNameDisplay || "always";
  const appearance = resolveCanvasAppearance(activeCategory, settings);
  const { color: canvasColor, pattern: canvasPattern } = appearance;
  const reportedMetricsRef = useRef(new Map());
  const viewport = {
    x: Number.isFinite(activeCategory.viewportX)
      ? activeCategory.viewportX
      : 80,
    y: Number.isFinite(activeCategory.viewportY)
      ? activeCategory.viewportY
      : 70,
    zoom: Number.isFinite(activeCategory.zoom) ? activeCategory.zoom : 1,
  };

  const assetMap = useMemo(
    () => new Map(assets.map((asset) => [asset.id, asset])),
    [assets],
  );
  const groupMap = useMemo(
    () => new Map(groups.map((group) => [group.id, group])),
    [groups],
  );
  const displayAssets = useMemo(
    () =>
      assets.filter((asset) =>
        asset.name.toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [assets, search],
  );
  const setViewport = (next) =>
    onViewportChange({ viewportX: next.x, viewportY: next.y, zoom: next.zoom });
  const getSurfacePoint = (event) => {
    const rect = surfaceRef.current.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / readUiScale(), y: (event.clientY - rect.top) / readUiScale() };
  };
  const screenToWorld = (point) => ({
    x: (point.x - viewport.x) / viewport.zoom,
    y: (point.y - viewport.y) / viewport.zoom,
  });

  const transforms=useOuterCanvasTransforms({assets,groups,selected,setSelected,textLayerRef,surfaceRef,viewport,onAssetsChange,onGroupsChange,onSaveTransform,onSaveText,onAssetsCommit,onGroupsCommit,onChangeGroupMember,expandGroupsToFit,readUiScale,displayAssets,screenToWorld,getSurfacePoint,settings,categoryId:activeCategory.id});
  transformsRef.current=transforms;
  useImperativeHandle(ref, () => ({
    getVisibleCenter() {
      const rect = surfaceRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return screenToWorld({ x: surfaceRef.current.clientWidth / 2, y: surfaceRef.current.clientHeight / 2 });
    },
    getSelectedIds() { return [...selected]; },
    saveTransforms() {return transforms.flush();},
    addText() { textLayerRef.current?.addText(); },
    textAction(action) {
      if(action==='undo')return transforms.undo();
      if(action==='redo')return transforms.redo();
      if(action==='save'){transforms.flush().then(()=>textLayerRef.current?.flush()).then(()=>onSaveLayout?.()).catch(()=>{});return true;}
      if(action==='select-all')return false;
      return selected.length ? false : textLayerRef.current?.action(action) || false;
    },
    selectIds(ids) { setSelected(ids.filter((id) => assetMap.has(id))); surfaceRef.current?.focus(); },
    selectAll() { transforms.chooseBox(displayAssets.filter(a=>!groupMap.get(a.groupId)?.collapsed).map(a=>a.id),(textLayerRef.current?.items()||[]).map(t=>t.objectId)); surfaceRef.current?.focus(); },
    createGroupSelected() { createGroup(selected); },
    zoomIn() { zoomCenter(1.25); },
    zoomOut() { zoomCenter(0.8); },
    zoomReset() { zoomAt(1, { x: surfaceRef.current.clientWidth / 2, y: surfaceRef.current.clientHeight / 2 }); },
    fitAll() { fitAll(); },
    toggleLockSelected() { toggleLock(selected); },
    bringSelectedToTop() { changeLayer(selected, "top"); },
    sendSelectedToBottom() { changeLayer(selected, "bottom"); },
    undo() { if(!transforms.undo())applyHistory(undoStack.current, redoStack.current); },
    redo() { if(!transforms.redo())applyHistory(redoStack.current, undoStack.current); },
  }));

  useEffect(() => {
    setSelected([]);
    setSelectedGroupId("");
    setMenu(null);
    undoStack.current = [];
    redoStack.current = [];
  }, [activeCategory.id]);

  useEffect(() => {
    if (editingGroupId) groupNameInputRef.current?.focus();
  }, [editingGroupId]);

  useEffect(() => {
    const keydown = (event) => {
      if(event.isComposing)return;
      if (
        event.code === "Space" &&
        !event.repeat &&
        !event.target?.closest?.('button,a,input,textarea,select,[role="button"],[contenteditable]:not([contenteditable="false"]),[role="textbox"]')
      ) {
        spaceRef.current = true;
        event.preventDefault();
      }
      if (event.key === "Escape" && !event.defaultPrevented) {
        cancelNativeRef.current?.();
        setSelected([]);
        setMenu(null);
        setSelectionBox(null);
        setEditingGroupId("");
        setGroupEditor(null);
      }
    };
    const keyup = (event) => {
      if (event.code === "Space") spaceRef.current = false;
    };
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    return () => {
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
    };
  }, [selected]);

  useEffect(() => {
    const pointerMove = (event) => {
      const interaction = interactionRef.current;
      if (!interaction) return;
      if (interaction.middleButton) {
        if (event.pointerId !== interaction.pointerId) return;
        if (!(event.buttons & 4)) { pointerUp(event); return; }
      }
      if (interaction.kind === "pan") {
        setViewport({
          x: interaction.viewport.x + (event.clientX - interaction.startX) / readUiScale(),
          y: interaction.viewport.y + (event.clientY - interaction.startY) / readUiScale(),
          zoom: interaction.viewport.zoom,
        });
      }
      if (interaction.kind === "select") {
        const point = getSurfacePoint(event);
        const box = {
          left: Math.min(interaction.start.x, point.x),
          top: Math.min(interaction.start.y, point.y),
          right: Math.max(interaction.start.x, point.x),
          bottom: Math.max(interaction.start.y, point.y),
        };
        setSelectionBox(box);
        const texts=textLayerRef.current?.selectBox(box)||[];
        const worldBox={left:(box.left-viewport.x)/viewport.zoom,top:(box.top-viewport.y)/viewport.zoom,right:(box.right-viewport.x)/viewport.zoom,bottom:(box.bottom-viewport.y)/viewport.zoom};
        const ids=displayAssets.filter(asset=>!groupMap.get(asset.groupId)?.collapsed&&intersectsRotated(worldBox,{...asset,height:assetOuterHeight(asset)})).map(a=>a.id);
        transforms.chooseBox(ids,texts);
      }
      if (interaction.kind === "move") {
        const dx = (event.clientX - interaction.startX) / (viewport.zoom * readUiScale());
        const dy = (event.clientY - interaction.startY) / (viewport.zoom * readUiScale());
        const nextAssets = assets.map((asset) =>
            interaction.positions.has(asset.id) && !asset.locked
              ? {
                  ...asset,
                  x: interaction.positions.get(asset.id).x + dx,
                  y: interaction.positions.get(asset.id).y + dy,
                }
              : asset,
          );
        assetsRef.current = nextAssets;
        onAssetsChange(nextAssets);
        const expanded = expandGroupsToFit(groups, nextAssets, interaction.positions.keys());
        if (expanded !== groups) {
          interaction.groupsChanged = true;
          onGroupsChange?.(expanded);
        }
        if (interaction.positions.size === 1) {
          const movedAsset = nextAssets.find((asset) => interaction.positions.has(asset.id));
          const surfacePoint = getSurfacePoint(event);
          const worldPoint = screenToWorld(surfacePoint);
          const target = movedAsset?.groupId
            ? null
            : [...groups].sort((a, b) => b.zIndex - a.zIndex).find((group) =>
                worldPoint.x >= group.x && worldPoint.x <= group.x + (group.collapsed ? 190 : group.width) &&
                worldPoint.y >= group.y && worldPoint.y <= group.y + (group.collapsed ? 38 : group.height) &&
                group.id !== movedAsset?.groupId,
              );
          interaction.dropGroupId = target?.id || "";
          setHoveredGroupId(interaction.dropGroupId);
        } else {
          interaction.dropGroupId = "";
          setHoveredGroupId("");
        }
      }
      if (interaction.kind === "resize") {
        const asset = assetMap.get(interaction.assetId);
        if (!asset || asset.locked) return;
        const dx = (event.clientX - interaction.startX) / (viewport.zoom * readUiScale());
        const dy = (event.clientY - interaction.startY) / (viewport.zoom * readUiScale());
        const horizontal =
          (interaction.width + (interaction.corner.includes("e") ? dx : -dx)) /
          interaction.width;
        const vertical =
          (interaction.height + (interaction.corner.includes("s") ? dy : -dy)) /
          interaction.height;
        const scale =
          Math.abs(horizontal - 1) > Math.abs(vertical - 1)
            ? horizontal
            : vertical;
        const width = clamp(interaction.width * scale, MIN_WIDTH, MAX_WIDTH);
        const height = width / interaction.ratio;
        const nextAssets = assets.map((item) =>
            item.id === asset.id
              ? {
                  ...item,
                  width,
                  height,
                  x: interaction.corner.includes("w")
                    ? interaction.x + interaction.width - width
                    : interaction.x,
                  y: interaction.corner.includes("n")
                    ? interaction.y + interaction.height - height
                    : interaction.y,
              }
              : item,
          );
        assetsRef.current = nextAssets;
        onAssetsChange(nextAssets);
        const expanded = expandGroupsToFit(groups, nextAssets, [asset.id]);
        if (expanded !== groups) {
          interaction.groupsChanged = true;
          onGroupsChange?.(expanded);
        }
      }
      if (interaction.kind === "group-move") {
        const dx = (event.clientX - interaction.startX) / (viewport.zoom * readUiScale());
        const dy = (event.clientY - interaction.startY) / (viewport.zoom * readUiScale());
        const nextAssets = assets.map((asset) =>
          asset.groupId === interaction.groupId
            ? { ...asset, x: interaction.positions.get(asset.id).x + dx, y: interaction.positions.get(asset.id).y + dy }
            : asset,
        );
        assetsRef.current = nextAssets;
        onAssetsChange(nextAssets);
        onGroupsChange?.(groups.map((group) =>
          group.id === interaction.groupId
            ? { ...group, x: interaction.group.x + dx, y: interaction.group.y + dy }
            : group,
        ));
      }
      if (interaction.kind === "group-resize") {
        const dx = (event.clientX - interaction.startX) / (viewport.zoom * readUiScale());
        const dy = (event.clientY - interaction.startY) / (viewport.zoom * readUiScale());
        let { x, y, width, height } = interaction.group;
        if (interaction.edge.includes("w")) {
          width = clamp(interaction.group.width - dx, MIN_GROUP_WIDTH, 100_000);
          x = interaction.group.x + interaction.group.width - width;
        }
        if (interaction.edge.includes("e")) width = clamp(interaction.group.width + dx, MIN_GROUP_WIDTH, 100_000);
        if (interaction.edge.includes("n")) {
          height = clamp(interaction.group.height - dy, MIN_GROUP_HEIGHT, 100_000);
          y = interaction.group.y + interaction.group.height - height;
        }
        if (interaction.edge.includes("s")) height = clamp(interaction.group.height + dy, MIN_GROUP_HEIGHT, 100_000);
        const resized = groups.map((group) => group.id === interaction.groupId ? { ...group, x, y, width, height } : group);
        onGroupsChange?.(expandGroupsToFit(resized, assets, assets.filter((asset) => asset.groupId === interaction.groupId).map((asset) => asset.id)));
      }
    };
    const pointerUp = (event) => {
      const interaction = interactionRef.current;
      if (interaction?.middleButton && event?.pointerId != null && event.pointerId !== interaction.pointerId) return;
      const changed = ["move", "resize", "group-move", "group-resize"].includes(interaction?.kind);
      interactionRef.current = null;
      setMiddlePanning(false);
      setSelectionBox(null);
      setHoveredGroupId("");
      if (changed) {
        recordHistory(interaction.before, historySnapshot(assetsRef.current, groups));
        if (["move", "resize", "group-move"].includes(interaction.kind)) {
          onAssetsCommit?.();
        }
        if (interaction.kind === "group-resize" && !interaction.groupsChanged) onGroupsCommit?.();
        if (interaction.kind === "move" && interaction.dropGroupId) {
          const assetId = [...interaction.positions.keys()][0];
          onChangeGroupMember?.(interaction.dropGroupId, assetId, true);
        }
      }
    };
    const cancelNative = (event) => {
      const interaction = interactionRef.current;
      if (event?.pointerId != null && interaction?.pointerId != null && event.pointerId !== interaction.pointerId) return;
      interactionRef.current = null;
      spaceRef.current = false;
      setMiddlePanning(false);
      setSelectionBox(null);
      setHoveredGroupId("");
      if (interaction?.before) restoreHistory(interaction.before);
      if (interaction?.kind === "pan") setViewport(interaction.viewport);
    };
    cancelNativeRef.current = cancelNative;
    window.addEventListener("pointermove", pointerMove);
    window.addEventListener("pointerup", pointerUp);
    window.addEventListener("pointercancel", cancelNative);
    window.addEventListener("blur",cancelNative);
    return () => {
      window.removeEventListener("pointermove", pointerMove);
      window.removeEventListener("pointerup", pointerUp);
      window.removeEventListener("pointercancel", cancelNative);
      window.removeEventListener("blur",cancelNative);
    };
  }, [
    assets,
    displayAssets,
    assetMap,
    viewport.x,
    viewport.y,
    viewport.zoom,
    onAssetsChange,
    onAssetsCommit,
    groups,
    onGroupsChange,
    onGroupsCommit,
    onChangeGroupMember,
  ]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const wheel = (event) => {
      if(event.target.closest('.canvas-arrange-toolbar, .canvas-minimap, .text-style-toolbar, .text-block-editor, .text-block-content, .inner-canvas-context-menu, .outer-text-save-error')) return;
      if(transforms.activity)return;
      event.preventDefault();
      const rect = surface.getBoundingClientRect();
      const point = {
        x: (event.clientX - rect.left) / readUiScale(),
        y: (event.clientY - rect.top) / readUiScale(),
      };
      const world = {
        x: (point.x - viewport.x) / viewport.zoom,
        y: (point.y - viewport.y) / viewport.zoom,
      };
      const zoom = clamp(
        viewport.zoom * Math.exp(-event.deltaY * 0.0015),
        MIN_ZOOM,
        MAX_ZOOM,
      );
      setViewport({
        x: point.x - world.x * zoom,
        y: point.y - world.y * zoom,
        zoom,
      });
    };
    surface.addEventListener("wheel", wheel, { passive: false });
    return () => surface.removeEventListener("wheel", wheel);
  }, [viewport.x, viewport.y, viewport.zoom]);

  const beginSurfaceInteraction = (event) => {
    if (event.button === 1) return;
    if (
      event.target.closest(
        ".canvas-arrange-toolbar, .canvas-asset, .canvas-controls, .canvas-context-menu, .canvas-appearance-panel, .outer-text-shell, .outer-text-save-error",
      )
    )
      return;
    setMenu(null);
    transforms.clear();
    textLayerRef.current?.clearSelection();
    const point = getSurfacePoint(event);
    if (event.button === 0 && spaceRef.current) {
      event.preventDefault();
      interactionRef.current = {
        kind: "pan",
        startX: event.clientX,
        startY: event.clientY,
        viewport,
      };
      return;
    }
    if (event.button === 0) {
      setSelected([]);
      setSelectedGroupId("");
      interactionRef.current = { kind: "select", start: point };
      setSelectionBox({
        left: point.x,
        top: point.y,
        right: point.x,
        bottom: point.y,
      });
    }
  };

  const beginAssetMove = (event,asset)=>{
    if(event.button!==0||event.target.closest('button,input,textarea'))return;
    event.stopPropagation();setMenu(null);setSelectedGroupId('');
    if(spaceRef.current){event.preventDefault();interactionRef.current={kind:'pan',startX:event.clientX,startY:event.clientY,viewport};return;}
    transforms.beginMove(event,'asset:'+asset.id);
  };
  const beginResize=(event,asset,corner)=>{event.preventDefault();event.stopPropagation();transforms.beginResize(event,'asset:'+asset.id,corner);};
  const beginGroupMove = (event, group) => {
    if (event.button !== 0 || event.target.closest("button, input")) return;
    event.preventDefault();
    event.stopPropagation();
    setMenu(null);
    setSelectedGroupId(group.id);
    if (spaceRef.current) {
      interactionRef.current = { kind: "pan", startX: event.clientX, startY: event.clientY, viewport };
      return;
    }
    if (group.locked) return;
    const positions = new Map(
      assets.filter((asset) => asset.groupId === group.id).map((asset) => [asset.id, { x: asset.x, y: asset.y }]),
    );
    interactionRef.current = {
      kind: "group-move",
      groupId: group.id,
      group: { ...group },
      startX: event.clientX,
      startY: event.clientY,
      positions,
      before: historySnapshot(assets, groups),
    };
  };

  const beginGroupResize = (event, group, edge) => {
    event.preventDefault();
    event.stopPropagation();
    setMenu(null);
    setSelectedGroupId(group.id);
    if (group.locked) return;
    interactionRef.current = {
      kind: "group-resize",
      groupId: group.id,
      group: { ...group },
      edge,
      startX: event.clientX,
      startY: event.clientY,
      before: historySnapshot(assets, groups),
    };
  };

  const zoomAt = (nextZoom, point) => {
    const world = screenToWorld(point);
    const zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    setViewport({
      x: point.x - world.x * zoom,
      y: point.y - world.y * zoom,
      zoom,
    });
  };
  const zoomCenter = (factor) => {
    const rect = surfaceRef.current.getBoundingClientRect();
    zoomAt(viewport.zoom * factor, { x: surfaceRef.current.clientWidth / 2, y: surfaceRef.current.clientHeight / 2 });
  };
  const resetView = () => setViewport({ x: 80, y: 70, zoom: 1 });
  const fitAll = () => {
    const rect = {width:surfaceRef.current.clientWidth,height:surfaceRef.current.clientHeight};
    const texts=textLayerRef.current?.items() || [];
    if (!displayAssets.length && !texts.length) {
      resetView();
      return;
    }
    const rects=[...(drawerLayerRef.current?.getVisibleRects() || []),...texts.map(boundsOf),...displayAssets.filter(a=>!groupMap.get(a.groupId)?.collapsed).map(a=>boundsOf({...a,height:assetOuterHeight(a)}))];
    const minX=Math.min(...rects.map(b=>b.left)),minY=Math.min(...rects.map(b=>b.top)),maxX=Math.max(...rects.map(b=>b.right)),maxY=Math.max(...rects.map(b=>b.bottom));
    if(!rects.length){resetView();return;}
    const zoom = clamp(
      Math.min(
        (rect.width - 100) / Math.max(maxX - minX, 1),
        (rect.height - 100) / Math.max(maxY - minY, 1),
      ),
      MIN_ZOOM,
      1.5,
    );
    setViewport({
      x: (rect.width - (maxX - minX) * zoom) / 2 - minX * zoom,
      y: (rect.height - (maxY - minY) * zoom) / 2 - minY * zoom,
      zoom,
    });
  };

  const layoutSnapshot = (items) => items.map(({ id, x, y, width, height, rotation=0, zIndex, locked }) => ({ id, x, y, width, height, rotation, zIndex, locked }));
  const historySnapshot = (items = assets, groupItems = groups) => ({
    assets: layoutSnapshot(items),
    groups: groupItems.map(({id,x,y,width,height,zIndex,locked}) => ({id,x,y,width,height,zIndex,locked})),
  });
  const recordHistory = (before, after) => {
    if (JSON.stringify(before) === JSON.stringify(after)) return;
    undoStack.current.push(before);
    if (undoStack.current.length > 100) undoStack.current.shift();
    redoStack.current = [];
  };
  const applyHistory = (from, to) => {
    if (!from.length) return;
    const snapshot = from.pop();
    to.push(historySnapshot(assetsRef.current, groups));
    const layouts = new Map(snapshot.assets.map((item) => [item.id, item]));
    const next = assetsRef.current.map((asset) => layouts.has(asset.id) ? { ...asset, ...layouts.get(asset.id) } : asset);
    assetsRef.current = next;
    onAssetsChange(next);
    const groupStates = new Map(snapshot.groups.map((group) => [group.id, group]));
    onGroupsChange?.(groups.map((group) => groupStates.has(group.id) ? {...group,...groupStates.get(group.id)} : group));
    queueMicrotask(() => onAssetsCommit?.());
    queueMicrotask(() => onGroupsCommit?.());
  };
  const changeLayer = (assetIds, action) => {
    const ids = new Set(Array.isArray(assetIds) ? assetIds : [assetIds]);
    if (!ids.size || ![...ids].some((assetId) => assetMap.has(assetId))) return;
    const ordered = [...assets].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
    const selectedOrdered = ordered.filter((asset) => ids.has(asset.id));
    const updates = new Map();
    if (action === "up" || action === "down") {
      for (const asset of selectedOrdered) {
        const index = ordered.findIndex((item) => item.id === asset.id);
        const other = ordered[index + (action === "up" ? 1 : -1)];
        if (other && !ids.has(other.id)) {
          updates.set(asset.id, other.zIndex ?? index);
          updates.set(other.id, asset.zIndex ?? index + (action === "up" ? 1 : -1));
        }
      }
    }
    if (action === "top") {
      let nextZ = Math.max(...ordered.map((asset) => asset.zIndex ?? 0), 0) + 1;
      selectedOrdered.forEach((asset) => updates.set(asset.id, nextZ++));
    }
    if (action === "bottom") {
      let nextZ = Math.min(...ordered.map((asset) => asset.zIndex ?? 0), 0) - selectedOrdered.length;
      selectedOrdered.forEach((asset) => updates.set(asset.id, nextZ++));
    }
    const before = historySnapshot(assets, groups);
    const next = assets.map((asset) => updates.has(asset.id) ? { ...asset, zIndex: updates.get(asset.id) } : asset);
    onAssetsChange(next);
    recordHistory(before, historySnapshot(next, groups));
    queueMicrotask(() => onAssetsCommit?.());
    setMenu(null);
  };
  const toggleLock = (assetIds) => {
    const ids = new Set(Array.isArray(assetIds) ? assetIds : [assetIds]);
    if (!ids.size) return;
    const allLocked = assets.filter((asset) => ids.has(asset.id)).every((asset) => asset.locked);
    const before = historySnapshot(assets, groups);
    const next = assets.map((asset) => ids.has(asset.id) ? { ...asset, locked: !allLocked } : asset);
    onAssetsChange(next);
    recordHistory(before, historySnapshot(next, groups));
    queueMicrotask(() => onAssetsCommit?.());
    setMenu(null);
  };
  const updateGroup = (groupId, patch, persist = false) => {
    const next = groups.map((group) => group.id === groupId ? { ...group, ...patch } : group);
    onGroupsChange?.(next);
    if (persist) {
      const updated = next.find((group) => group.id === groupId);
      if (updated) queueMicrotask(() => onGroupSave?.(updated));
    }
  };
  function createGroup(assetIds = selected) {
    const uniqueIds = [...new Set(assetIds)];
    const members = uniqueIds.map((id) => assetMap.get(id)).filter(Boolean);
    if (members.length < 2) return;
    if (members.some((asset) => asset.groupId)) {
      window.alert("所选资产包含已有分组成员，请先移出原分组。");
      return;
    }
    if (members.some((asset) => asset.categoryId !== activeCategory.id)) {
      window.alert("只能将同一张画布中的资产放入分组。");
      return;
    }
    const left = Math.min(...members.map((asset) => asset.x));
    const top = Math.min(...members.map((asset) => asset.y));
    const right = Math.max(...members.map((asset) => asset.x + asset.width));
    const bottom = Math.max(...members.map((asset) => asset.y + assetOuterHeight(asset)));
    const group = {
      id: `group-${crypto.randomUUID()}`,
      categoryId: activeCategory.id,
      name: "新分组",
      x: left - GROUP_PADDING,
      y: top - GROUP_HEADER_SPACE,
      width: Math.max(MIN_GROUP_WIDTH, right - left + GROUP_PADDING * 2),
      height: Math.max(MIN_GROUP_HEIGHT, bottom - top + GROUP_HEADER_SPACE + GROUP_PADDING),
      zIndex: Math.max(...groups.map((item) => item.zIndex ?? 0), 0) + 1,
      locked: false,
      collapsed: false,
      borderColor: DEFAULT_GROUP_COLOR,
      backgroundColor: DEFAULT_GROUP_COLOR,
      backgroundOpacity: 0,
    };
    Promise.resolve(onCreateGroup?.(group, uniqueIds)).then(() => {
      setSelected([]);
      setSelectedGroupId(group.id);
      setEditingGroupName(group.name);
      setEditingGroupId(group.id);
      setMenu(null);
    }).catch((error) => window.alert(String(error)));
  }
  const saveGroupName = (groupId) => {
    const name = editingGroupName.trim() || "新分组";
    updateGroup(groupId, { name }, true);
    skipGroupNameBlurRef.current = true;
    setEditingGroupId("");
  };
  const setGroupLayer = (groupId, action) => {
    const ordered = [...groups].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
    const index = ordered.findIndex((group) => group.id === groupId);
    let zIndex = groupMap.get(groupId)?.zIndex ?? 0;
    if (action === "top") zIndex = Math.max(...ordered.map((group) => group.zIndex ?? 0), 0) + 1;
    if (action === "bottom") zIndex = Math.min(...ordered.map((group) => group.zIndex ?? 0), 0) - 1;
    if (action === "up" && index < ordered.length - 1) zIndex = (ordered[index + 1].zIndex ?? index + 1) + 1;
    if (action === "down" && index > 0) zIndex = (ordered[index - 1].zIndex ?? index - 1) - 1;
    updateGroup(groupId, { zIndex }, true);
    setMenu(null);
  };
  const openGroupContextMenu = (event, group) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedGroupId(group.id);
    const rect = surfaceRef.current.getBoundingClientRect();
    setMenu({
      groupId: group.id,
      x: clamp((event.clientX - rect.left) / readUiScale(), 8, Math.max(8, rect.width / readUiScale() - 200)),
      y: clamp((event.clientY - rect.top) / readUiScale(), 8, Math.max(8, rect.height / readUiScale() - 390)),
    });
  };
  const beginRenameGroup = (group) => {
    setEditingGroupName(group.name);
    setEditingGroupId(group.id);
    setMenu(null);
  };
  const cancelCanvasGroup = (group) => {
    onDeleteGroup?.(group.id);
    setMenu(null);
    setSelectedGroupId("");
    setSelected([]);
  };
  const editCanvasGroupStyle = (group, event) => {
    const rect = surfaceRef.current.getBoundingClientRect();
    setGroupEditor({
      groupId: group.id,
      x: clamp((event.clientX - rect.left) / readUiScale(), 8, Math.max(8, rect.width / readUiScale() - 260)),
      y: clamp((event.clientY - rect.top) / readUiScale(), 8, Math.max(8, rect.height / readUiScale() - 190)),
      borderColor: group.borderColor || DEFAULT_GROUP_COLOR,
      backgroundColor: group.backgroundColor || DEFAULT_GROUP_COLOR,
      backgroundOpacity: group.backgroundOpacity ?? 0,
    });
    setMenu(null);
  };
  const moveToCategory = (assetId, categoryId) => {
    if (!categoryId) return;
    onAssetsChange(
      assets.map((asset) =>
        asset.id === assetId ? { ...asset, categoryId } : asset,
      ),
    );
    onMoveCategory?.(assetMap.get(assetId), categoryId);
    setSelected(selected.filter((id) => id !== assetId));
    setMenu(null);
  };

  const openContextMenu = (event, assetId = "") => {
    event.preventDefault();
    event.stopPropagation();
    const rect = surfaceRef.current.getBoundingClientRect();
    const assetIds = assetId && !selected.includes(assetId) ? [assetId] : [...selected];
    if(assetId)transforms.selectForMenu('asset:'+assetId);
    setMenu({
      assetId,
      assetIds,
      worldPoint: screenToWorld(getSurfacePoint(event)),
      x: clamp((event.clientX - rect.left) / readUiScale(), 8, Math.max(8, rect.width / readUiScale() - 190)),
      y: clamp((event.clientY - rect.top) / readUiScale(), 8, Math.max(8, rect.height / readUiScale() - (assetId ? 420 : 370))),
    });
  };
  const menuAsset = menu?.assetId ? assetMap.get(menu.assetId) : null;
  const menuGroup = menu?.groupId ? groupMap.get(menu.groupId) : null;

  return (
    <div
      ref={surfaceRef}
      className={`asset-canvas background-${canvasPattern} ${settings?.showImageShadow ? "" : "no-shadow"} ${settings?.showSelectionBorder ? "" : "no-selection-border"} ${settings?.showAssetTags ? "" : "no-tags"} ${middlePanning || interactionRef.current?.kind === "pan" ? "is-panning" : ""}`}
      style={canvasSurfaceStyle(appearance, viewport)}
      tabIndex="0"
      onPointerDownCapture={event => captureMiddleCanvasPan(event, surfaceRef.current, () => {
        setMenu(null);
        interactionRef.current = { kind: "pan", middleButton: true, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, viewport };
        setMiddlePanning(true);
      })}
      onLostPointerCapture={event => {
        if (interactionRef.current?.middleButton && interactionRef.current.pointerId === event.pointerId) {
          interactionRef.current = null;
          setMiddlePanning(false);
        }
      }}
      onPointerDown={beginSurfaceInteraction}
      onAuxClick={(event) => event.preventDefault()}
      onContextMenu={(event) => openContextMenu(event)}
      onDoubleClick={(event) => {
        if(event.target.closest('.canvas-arrange-toolbar, .canvas-asset, .canvas-group, .canvas-controls, .canvas-context-menu, .canvas-appearance-panel, .outer-text-shell, .asset-note-drawer, button, input, textarea'))return;
        textLayerRef.current?.addText('plain',screenToWorld(getSurfacePoint(event)));
      }}
    >
      <div
        ref={worldRef}
        className="canvas-world"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        }}
      >
        {groups.map((group) => (
          <div
            key={group.id}
            data-group-id={group.id}
            className={`canvas-group ${group.collapsed ? "collapsed" : ""} ${group.locked ? "locked" : ""} ${selectedGroupId === group.id ? "selected" : ""} ${hoveredGroupId === group.id ? "drop-target" : ""}`}
            style={{
              left: group.x,
              top: group.y,
              ...(group.collapsed ? {} : { width: group.width, height: group.height }),
              zIndex: 100000 + (group.zIndex ?? 0),
              borderColor: group.borderColor || DEFAULT_GROUP_COLOR,
              backgroundColor: canvasColorWithOpacity(group.backgroundColor || DEFAULT_GROUP_COLOR, group.backgroundOpacity ?? 0),
              "--group-color": group.borderColor || DEFAULT_GROUP_COLOR,
              "--group-label-bg": "var(--canvas-background)",
            }}
            onPointerDown={(event) => { if (group.collapsed) beginGroupMove(event, group); }}
            onContextMenu={(event) => openGroupContextMenu(event, group)}
          >
            <div className="canvas-group-frame" aria-hidden="true" />
            {["top", "right", "bottom", "left"].map((edge) => (
              <div
                key={edge}
                className={`canvas-group-hit ${edge}`}
                role="presentation"
                onPointerDown={(event) => beginGroupMove(event, group)}
                onContextMenu={(event) => openGroupContextMenu(event, group)}
              />
            ))}
            <div
              className="canvas-group-title"
              onPointerDown={(event) => beginGroupMove(event, group)}
              onContextMenu={(event) => openGroupContextMenu(event, group)}
            >
              <button
                type="button"
                className="canvas-group-collapse"
                aria-label={group.collapsed ? "展开分组" : "折叠分组"}
                title={group.collapsed ? "展开分组" : "折叠分组"}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  updateGroup(group.id, { collapsed: !group.collapsed }, true);
                }}
              >
                {group.collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
              </button>
              {editingGroupId === group.id ? (
                <input
                  ref={groupNameInputRef}
                  aria-label="分组名称"
                  value={editingGroupName}
                  onPointerDown={(event) => event.stopPropagation()}
                  onChange={(event) => setEditingGroupName(event.target.value)}
                  onBlur={() => {
                    if (skipGroupNameBlurRef.current) {
                      skipGroupNameBlurRef.current = false;
                      return;
                    }
                    saveGroupName(group.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      saveGroupName(group.id);
                    }
                    if (event.key === "Escape") {
                      skipGroupNameBlurRef.current = true;
                      setEditingGroupName(group.name);
                      setEditingGroupId("");
                    }
                  }}
                />
              ) : (
                <span
                  className="canvas-group-name"
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    beginRenameGroup(group);
                  }}
                  title="双击重命名"
                >
                  {group.name}
                </span>
              )}
              {group.locked && <Lock size={12} aria-label="分组已锁定" />}
              {hoveredGroupId === group.id && <small>加入分组</small>}
            </div>
            {selectedGroupId === group.id && !group.locked && !group.collapsed && ["nw", "n", "ne", "e", "se", "s", "sw", "w"].map((edge) => (
              <button
                key={edge}
                type="button"
                className={`canvas-group-resize ${edge}`}
                aria-label={`调整分组${group.name}大小`}
                onPointerDown={(event) => beginGroupResize(event, group, edge)}
                onContextMenu={(event) => openGroupContextMenu(event, group)}
              />
            ))}
          </div>
        ))}
        {displayAssets.map((asset) => (
          <article
            key={asset.id}
            className={`canvas-asset metadata-${metadataMode} ${selected.includes(asset.id) ? "selected" : ""} ${asset.locked ? "locked" : ""}`}
            hidden={Boolean(groupMap.get(asset.groupId)?.collapsed)}
            style={{
              left: asset.x,
              top: asset.y,
              width: asset.width,
              height: assetOuterHeight(asset),
              transform:asset.rotation?`rotate(${asset.rotation}deg)`:undefined,transformOrigin:"center center",
              "--inner-control-scale":1/(viewport.zoom*readUiScale()),
              zIndex: asset.zIndex ?? 0,
              "--asset-radius-nw": drawerDecorations[asset.id]?.corners.nw ? "0px" : "3px",
              "--asset-radius-ne": drawerDecorations[asset.id]?.corners.ne ? "0px" : "3px",
              "--asset-radius-sw": drawerDecorations[asset.id]?.corners.sw ? "0px" : "3px",
              "--asset-radius-se": drawerDecorations[asset.id]?.corners.se ? "0px" : "3px",
            }}
            data-asset-id={asset.id}
            onPointerDown={(event) => beginAssetMove(event, asset)}
            onDoubleClick={() => onOpen(asset)}
            onContextMenu={(event) => openContextMenu(event, asset.id)}
          >
            {selected.includes(asset.id)&&transforms.toolbarProps.items.length===1&&!asset.locked&&transforms.activity?.kind!=='move'&&transforms.activity?.kind!=='resize'&&<button className="canvas-rotate-handle" aria-label="旋转资产卡片" title="拖动旋转；Shift 每次 15°" onPointerDown={event=>{event.preventDefault();event.stopPropagation();transforms.beginRotate(event,'asset:'+asset.id);}} onDoubleClick={e=>e.stopPropagation()}><RotateCw size={12}/></button>}
            {transforms.activity?.kind==='rotate'&&transforms.activity.key==='asset:'+asset.id&&<span className="canvas-angle-live">{Number((asset.rotation||0).toFixed(1))}°</span>}
            <div className="canvas-asset-image">
              <AssetNoteDockHost assetId={asset.id} onHostChange={registerDrawerHost} />
              {asset.previewUrl ? (
                <img
                  src={asset.previewUrl}
                  alt=""
                  draggable="false"
                  onLoad={(event) => {
                    const { naturalWidth, naturalHeight } = event.currentTarget;
                    if (!naturalWidth || !naturalHeight) return;
                    const ratio = naturalWidth / naturalHeight;
                    if (reportedMetricsRef.current.get(asset.id) === ratio)
                      return;
                    reportedMetricsRef.current.set(asset.id, ratio);
                    if (Math.abs(asset.height - asset.width / ratio) > 0.5) {
                      onImageMetrics?.(asset, naturalWidth, naturalHeight);
                    }
                  }}
                />
              ) : (
                <span style={{ height: asset.height }}>
                  <FileBox size={32} />
                </span>
              )}
              {asset.missing && (
                <span className="asset-missing">原文件已丢失</span>
              )}
              {asset.locked && (
                <i className="asset-lock">
                  <Lock size={13} />
                </i>
              )}

            </div>
              {selected.includes(asset.id) &&
                transforms.toolbarProps.items.length===1 && !asset.locked && !transforms.activity &&
                ["nw", "ne", "sw", "se"].map((corner) => (
                  <button
                    key={corner}
                    aria-label={`从${corner}角调整 ${asset.name}`}
                    className={`resize-handle ${corner}`}
                    onPointerDown={(event) => beginResize(event, asset, corner)}
                  />
                ))}
            <div
              className="canvas-asset-caption"
              style={{ marginTop: drawerDecorations[asset.id]?.bottomInset || 0 }}
              aria-hidden={metadataMode === "hidden"}
            >
              <strong>{asset.name}</strong>
              {asset.tags?.length > 0 && (
                <small>{asset.tags.join(" · ")}</small>
              )}
            </div>
          </article>
        ))}
      </div>
      <AssetNoteDrawerLayer
        ref={drawerLayerRef}
        assets={assets}
        displayAssets={displayAssets}
        groups={groups}
        activeCategoryId={activeCategory.id}
        viewport={viewport}
        surfaceRef={surfaceRef}
        worldRef={worldRef}
        dockHosts={drawerDockHosts}
        onDecorationChange={updateDrawerDecorations}
        onMinimapItems={updateMinimapDrawers}
      />
      {selectionBox && (
        <div
          className="canvas-selection-box"
          style={{
            left: selectionBox.left,
            top: selectionBox.top,
            width: selectionBox.right - selectionBox.left,
            height: selectionBox.bottom - selectionBox.top,
          }}
        />
      )}
      <CategoryCanvasTextLayer key={activeCategory.id} categoryId={activeCategory.id} blocks={textBlocks} fonts={fonts} surfaceApiRef={textLayerRef} onTextContextActive={clearAssetSelection} onSave={onSaveText} externalCanvas={transforms.externalCanvas}
        viewport={{...viewport,onChange:setViewport}} onMinimapItems={updateMinimapTexts}/>
      <CanvasSnapGuides guides={transforms.guides} viewport={viewport}/>
      <CanvasAxisGuides reference={transforms.axisReference} preview={transforms.axisPreview?.preview} active={transforms.axisPreview?.active} viewport={viewport}/>
      <CanvasArrangeTools {...transforms.toolbarProps}/>
      {transforms.error&&<div className="canvas-transform-error" role="alert"><span>布局尚未保存：{transforms.error}</span><button onClick={()=>transforms.flush().catch(()=>{})}>重试保存</button></div>}
      {settings?.showPerformance && <output className="canvas-performance">{fps} FPS · {displayAssets.length} 资产</output>}
      {displayAssets.length === 0 && textBlocks.length === 0 && (
        <div className="canvas-empty">
          <FileBox size={27} />
          <strong>{assets.length ? "没有匹配的资产" : "此分类暂无资产"}</strong>
          <span>
            {assets.length
              ? "请尝试其他搜索关键词"
              : "右键画布或点击上方按钮添加资产"}
          </span>
        </div>
      )}
      <div className="canvas-controls" aria-label="画布缩放">
        {!settings?.autoSave && <button onClick={()=>transforms.flush().then(()=>onSaveLayout?.()).catch(()=>{})}>保存布局</button>}
        <button aria-label="缩小" onClick={() => zoomCenter(0.8)}>
          <Minus size={15} />
        </button>
        <span>{Math.round(viewport.zoom * 100)}%</span>
        <button aria-label="放大" onClick={() => zoomCenter(1.25)}>
          <Plus size={15} />
        </button>
        <button
          onClick={() =>
            zoomAt(1, {
              x: surfaceRef.current.clientWidth / 2,
              y: surfaceRef.current.clientHeight / 2,
            })
          }
        >
          100%
        </button>
        <button aria-label="适应全部资产" onClick={fitAll}>
          <Maximize size={15} />
          适应全部
        </button>
        <MinimapToggle {...minimap} />
        <button aria-label="画布背景" aria-expanded={appearanceOpen} onClick={()=>setAppearanceOpen(v=>!v)}><Palette size={15}/>背景</button>
      </div>
      <CanvasMinimap sceneKey={`${activeCategory.id}:${search}`} surfaceRef={surfaceRef} viewport={viewport} onViewportChange={setViewport}
        expanded={minimap.expanded} onCollapse={minimap.toggle} suppressed={appearanceOpen}
        items={[
          ...displayAssets.filter(asset => !groupMap.get(asset.groupId)?.collapsed).map(asset => minimapPolygonItem({ id: `asset:${asset.id}`, kind: "asset", x: asset.x, y: asset.y, width: asset.width, height: asset.height, zIndex: asset.zIndex, selected: selected.includes(asset.id) }, asset.rotation ? [{ x: asset.x, y: asset.y }, { x: asset.x + asset.width, y: asset.y }, { x: asset.x + asset.width, y: asset.y + asset.height }, { x: asset.x, y: asset.y + asset.height }].map(point => objectToWorld(point, { ...asset, height: assetOuterHeight(asset) })) : null)),
          ...groups.map(group => ({ id: `group:${group.id}`, kind: "group", x: group.x, y: group.y, width: group.collapsed ? collapsedGroupSizes[group.id]?.width || 130 : group.width, height: group.collapsed ? collapsedGroupSizes[group.id]?.height || 34 : group.height, zIndex: 100000 + (group.zIndex || 0), color: group.borderColor || DEFAULT_GROUP_COLOR, selected: selectedGroupId === group.id })),
          ...minimapDrawers,
          ...minimapTexts,
        ]} />
      {appearanceOpen && <div className="canvas-appearance-panel" onPointerDown={event=>event.stopPropagation()}>
        <CanvasAppearanceControls color={canvasColor} pattern={canvasPattern} onChange={onCanvasAppearance} />
      </div>}
      {groupEditor && (
        <div
          className="canvas-group-editor"
          style={{ left: groupEditor.x, top: groupEditor.y }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <strong>编辑分组样式</strong>
          <label>边框颜色<input type="color" value={groupEditor.borderColor} onChange={(event) => setGroupEditor({ ...groupEditor, borderColor: event.target.value })} /></label>
          <label>背景颜色<input type="color" value={groupEditor.backgroundColor} onChange={(event) => setGroupEditor({ ...groupEditor, backgroundColor: event.target.value })} /></label>
          <label>背景透明度 <span>{groupEditor.backgroundOpacity}%</span><input aria-label="分组背景透明度" type="range" min="0" max="30" value={groupEditor.backgroundOpacity} onChange={(event) => setGroupEditor({ ...groupEditor, backgroundOpacity: Number(event.target.value) })} /></label>
          <div className="canvas-group-editor-actions">
            <button onClick={() => setGroupEditor(null)}>取消</button>
            <button className="primary" onClick={() => {
            updateGroup(groupEditor.groupId, {
                borderColor: groupEditor.borderColor,
                backgroundColor: groupEditor.backgroundColor,
                backgroundOpacity: groupEditor.backgroundOpacity,
              }, true);
              setGroupEditor(null);
            }}>保存</button>
          </div>
        </div>
      )}
      {menu && (
        <div
          className="canvas-context-menu"
          style={{ left: menu.x, top: menu.y }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {!menuGroup&&menu.assetIds?.length>0&&<details className="canvas-transform-menu"><summary>排列与对称</summary><ArrangeCommands {...transforms.arrangeProps}/></details>}
          {menuGroup ? (
            <>
              <button onClick={() => {
                setSelectedGroupId(menuGroup.id);
                setSelected(assets.filter((asset) => asset.groupId === menuGroup.id).map((asset) => asset.id));
                setMenu(null);
              }}>打开 / 选中分组</button>
              <button onClick={() => beginRenameGroup(menuGroup)}>重命名</button>
              <button onClick={(event) => editCanvasGroupStyle(menuGroup, event)}>编辑分组</button>
              <button onClick={() => {
                updateGroup(menuGroup.id, { locked: !menuGroup.locked }, true);
                setMenu(null);
              }}>
                {menuGroup.locked ? <Unlock size={14} /> : <Lock size={14} />}
                {menuGroup.locked ? "解锁分组" : "锁定分组"}
              </button>
              <button onClick={() => setGroupLayer(menuGroup.id, "top")}>置于顶层</button>
              <button onClick={() => setGroupLayer(menuGroup.id, "bottom")}>置于底层</button>
              <hr />
              <button onClick={() => cancelCanvasGroup(menuGroup)}>取消分组</button>
              <button className="danger" onClick={() => {
                if (window.confirm("仅删除分组框并保留组内全部资产？")) cancelCanvasGroup(menuGroup);
              }}>仅删除分组</button>
            </>
          ) : menuAsset ? (
            <>
              {menu.assetIds?.length >= 2 && <button onClick={() => createGroup(menu.assetIds)}>创建分组</button>}
              {menuAsset.groupId && <button onClick={() => {
                onChangeGroupMember?.(menuAsset.groupId, menuAsset.id, false);
                setMenu(null);
              }}>移出分组</button>}
              {(menu.assetIds?.length >= 2 || menuAsset.groupId) && <hr />}
              <button onClick={() => onOpen(menuAsset)}>打开详情</button>
              <button
                onClick={() => {
                  onEdit(menuAsset);
                  setMenu(null);
                }}
              >
                编辑资产
              </button>
              <hr />
              <button onClick={() => {
                const assetId = menuAsset.id;
                setMenu(null);
                drawerLayerRef.current?.addForAsset(assetId);
              }}>
                <StickyNote size={14} />
                添加备注抽屉
              </button>
              {menuAsset.missing && (
                <button
                  onClick={() => {
                    onRelink?.(menuAsset);
                    setMenu(null);
                  }}
                >
                  重新定位
                </button>
              )}
              <hr />
              <button onClick={() => changeLayer(menuAsset.id, "top")}>
                置于顶层
              </button>
              <button onClick={() => changeLayer(menuAsset.id, "up")}>
                上移一层
              </button>
              <button onClick={() => changeLayer(menuAsset.id, "down")}>
                下移一层
              </button>
              <button onClick={() => changeLayer(menuAsset.id, "bottom")}>
                置于底层
              </button>
              <button onClick={() => toggleLock(menuAsset.id)}>
                {menuAsset.locked ? <Unlock size={14} /> : <Lock size={14} />}
                {menuAsset.locked ? "解除锁定" : "锁定位置"}
              </button>
              <label className="context-select">
                <span>移动到其他分类</span>
                <select
                  value=""
                  onChange={(event) =>
                    moveToCategory(menuAsset.id, event.target.value)
                  }
                >
                  <option value="">选择分类…</option>
                  {categories
                    .filter((category) => category.id !== activeCategory.id)
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </select>
              </label>
              <hr />
              <button
                className="danger"
                onClick={() => {
                  onDelete([menuAsset.id]);
                  setMenu(null);
                }}
              >
                删除资产
              </button>
            </>
          ) : (
            <>
              {TEXT_BLOCK_STYLES.map(style=><button key={style.id} onClick={()=>{textLayerRef.current?.addText(style.id,menu.worldPoint);setMenu(null);}}>添加{style.label}</button>)}
              <hr />
              {menu.assetIds?.length >= 2 && <button onClick={() => createGroup(menu.assetIds)}>创建分组</button>}
              <button
                onClick={() => {
                  onAdd(screenToWorld({ x: menu.x, y: menu.y }));
                  setMenu(null);
                }}
              >
                添加资产
              </button>
              <button
                onClick={() => {
                  setSelected(displayAssets.map((asset) => asset.id));
                  setMenu(null);
                }}
              >
                全选
              </button>
              <button
                onClick={() => {
                  fitAll();
                  setMenu(null);
                }}
              >
                适应全部资产
              </button>
              <button
                onClick={() => {
                  resetView();
                  setMenu(null);
                }}
              >
                重置视图
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
});
