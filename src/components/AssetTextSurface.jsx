import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlignLeft,
  ArrowDownToLine,
  ArrowUpToLine,
  Copy,
  RotateCw,
  FilePlus2,
  ImagePlus,
  Lock,
  Maximize,
  Minus,
  Pencil,
  Palette,
  Plus,
  Trash2,
  Unlock,
  X,
} from "lucide-react";
import { shortcutFromEvent } from "../shortcuts/registry";
import { resolveCanvasAppearance, canvasSurfaceStyle } from "../canvasAppearance";
import { fileUrl, id } from "../data/database";
import {
  createTextBlockItem,
  toTextSurfaceItem,
  TEXT_BLOCK_STYLES,
} from "../data/assetText";
import { TextBlock } from "./text/TextBlock";
import { CanvasMinimap, MinimapToggle, useMinimapPreference } from "./CanvasMinimap";
import { CanvasAppearanceControls } from "./CanvasAppearanceControls";
import { minimapPolygonItem } from "./minimapGeometry.js";
import { cornersOf } from "./canvasTransforms.js";
import { TextStyleToolbar } from "./text/TextStyleToolbar";
import { syncFontFaces } from "./text/fontFaces";
import { clientToSurface, surfaceToWorld, clientWorldDelta, zoomViewportAt, resizeInnerObject } from "./innerCanvasGeometry.js";
import { axisSnapPreview, isImageObject } from "./canvasAxisGeometry.js";
import { createCanvasFrameQueue } from "./canvasFrameQueue.js";
import { captureMiddleCanvasPan } from "./middleCanvasPan";
import { CanvasEditorLayout, CanvasInspectorPortal } from "./CanvasEditorLayout";

import { geometry, objectId, boundsOf, unionBounds, intersectsRotated, rotationFromPointer, resizeRotated, snapMove, arrangeObjects, visibleObjects, normalizeRotation } from "./canvasTransforms.js";
import { CanvasArrangeTools, ArrangeCommands, CanvasSnapGuides, CanvasAxisGuides, useSnapPreferences } from "./CanvasArrangeTools";

const readUiScale = () => Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ui-scale")) || 1;
const readTextTheme = () => { const style = getComputedStyle(document.documentElement); return { surface: style.getPropertyValue("--bg-surface"), border: style.getPropertyValue("--border-default"), text: style.getPropertyValue("--text-primary"), canvas: style.getPropertyValue("--canvas-inner-bg") || style.getPropertyValue("--bg-app") }; };

const EMPTY_ITEMS = [];
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const detailScrollContainer = surface => surface?.closest('[data-editor-scroll="true"], .asset-detail-main');
const intersects = (a, b) =>
  a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;

function objectLabel(item, prompt) {
  if (item.objectType === "sample") return prompt?.title || "样图";
  if (item.objectType === "note") return "备注";
  if (item.objectType === "text") return "文本";
  return (
    {
      positivePrompt: "正面提示词",
      negativePrompt: "负面提示词",
      naturalPrompt: "自然语言 Prompt",
      content: "Prompt 内容",
    }[item.fieldKey] || "Prompt"
  );
}

export function AssetTextSurface({
  assetId,
  canvasAppearance,
  hasOwnAppearance = false,
  onSaveAppearance,
  embeddedCanvas = false,
  surfaceApiRef,
  onTextContextActive,
  externalCanvas,
  onCommitGeometry,
  onMinimapItems,
  viewMode = "canvas",
  children,
  textController,
  autoSave = true,
  onManualSave,
  onDraft,
  onRegisterFlush,
  registerShortcutActions,
  shortcuts = EMPTY_ITEMS,
  objects: initialObjects = EMPTY_ITEMS,
  textBlocks: initialTextBlocks = EMPTY_ITEMS,
  fonts = EMPTY_ITEMS,
  prompts,
  initialViewport,
  onSaveObjects,
  onSaveViewport,
  onAddSample,
  onEditPrompt,
}) {
  const standard = viewMode === "standard";
  const externalRef=useRef(externalCanvas);externalRef.current=externalCanvas;
  const snapPrefs=useSnapPreferences(),snapPrefsRef=useRef(snapPrefs);snapPrefsRef.current=snapPrefs;
  const [guides,setGuides]=useState([]),[referenceId,setReferenceId]=useState(''),[symmetryGap,setSymmetryGap]=useState(24);
  const [axisId,setAxisId]=useState(''),[axisPreview,setAxisPreview]=useState(null);
  const axisIdRef=useRef(axisId);axisIdRef.current=axisId;
  const frameQueueRef=useRef(null),finishInteractionRef=useRef(null);
  const historyRef=useRef({undo:[],redo:[]}),[,setHistoryTick]=useState(0);
  const geometrySnapshot=values=>values.map(i=>({objectId:i.objectId,...geometry(i)}));
  const recordGeometry=(before,after)=>{const ids=new Set(before.map(i=>i.objectId));const a=geometrySnapshot(before),b=geometrySnapshot(after.filter(i=>ids.has(i.objectId)));if(JSON.stringify(a)!==JSON.stringify(b)){historyRef.current.undo.push(a);if(historyRef.current.undo.length>100)historyRef.current.undo.shift();historyRef.current.redo=[];setHistoryTick(v=>v+1);}};
  const restoreGeometry=patches=>replaceItemsRef.current(current=>{const byId=new Map(patches.map(i=>[i.objectId||i.id,i]));return current.map(i=>byId.has(i.objectId)?{...i,...geometry(byId.get(i.objectId))}:i);});
  const applyGeometryHistory=redo=>{const h=historyRef.current,from=redo?h.redo:h.undo,to=redo?h.undo:h.redo;if(!from.length)return;const patches=from.pop(),ids=new Set(patches.map(i=>i.objectId));to.push(geometrySnapshot(itemsRef.current.filter(i=>ids.has(i.objectId))));const next=restoreGeometry(patches);commitItemsRef.current(next);setHistoryTick(v=>v+1);};
  const geometryHistoryRef=useRef(applyGeometryHistory);geometryHistoryRef.current=applyGeometryHistory;
  const baseRef = useRef(null);
  const shellRef = useRef(null);
  const [baseHeight,setBaseHeight] = useState(0);
  const [contentWidth,setContentWidth] = useState(0);
  const [horizontalScroll,setHorizontalScroll] = useState(0);
  const initialItems = [
    ...initialObjects.filter((item) => item.objectType !== "text"),
    ...initialTextBlocks.map(toTextSurfaceItem),
  ];
  const surfaceRef = useRef(null);
  const minimap = useMinimapPreference("inner");
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [appearanceSaving, setAppearanceSaving] = useState(false);
  const [appearanceError, setAppearanceError] = useState("");
  const appearanceSavingRef = useRef(false);
  const saveAppearance = async value => {
    if (!onSaveAppearance || appearanceSavingRef.current) return;
    appearanceSavingRef.current = true;
    setAppearanceSaving(true);
    setAppearanceError("");
    try { await onSaveAppearance(value); }
    catch (error) { setAppearanceError(`背景保存失败：${String(error)}`); }
    finally { appearanceSavingRef.current = false; setAppearanceSaving(false); }
  };
  const interactionRef = useRef(null);
  const cancelInteractionRef = useRef(null);
  const [activity, setActivity] = useState(null);
  const [controlId, setControlId] = useState("");
  const [focusedControlId, setFocusedControlId] = useState("");
  const [uiScale, setUiScale] = useState(readUiScale);
  const [textTheme, setTextTheme] = useState(readTextTheme);
  useEffect(() => {
    const sync = () => { setUiScale(readUiScale()); setTextTheme(readTextTheme()); };
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["style", "data-theme", "data-effective-theme"] });
    sync();
    return () => observer.disconnect();
  }, []);
  const spaceRef = useRef(false);
  const clipboardRef = useRef([]);
  if (textController) clipboardRef.current = textController.clipboard;
  const commitItemsRef = useRef(null);
  const editingTextIdRef = useRef("");
  const selectedRef = useRef([]);
  const keyHandlerRef = useRef(null);
  const viewportSaveRef = useRef(onSaveViewport);
  const pendingDraftRef = useRef(null);
  const composingRef = useRef(false);
  const flushSurfaceRef = useRef(null);
  const autoSaveRef = useRef(null);
  const manualSaveRef = useRef(null);
  const itemsRef = useRef(initialItems);
  const sourceObjectsRef = useRef({assetId,objects:initialObjects});
  const viewportRef = useRef({
    x: standard ? 0 : initialViewport?.viewportX ?? 80,
    y: standard ? 0 : initialViewport?.viewportY ?? 70,
    zoom: standard ? 1 : initialViewport?.zoom ?? 1,
  });
  const savedViewportRef = useRef({...viewportRef.current});
  const viewportOwnerRef = useRef(assetId);
  const replaceItemsRef = useRef(null);
  const setViewRef = useRef(null);
  const [items, setItems] = useState(initialItems);
  const [viewport, setViewportState] = useState(viewportRef.current);
  const [selected, setSelected] = useState([]);
  const [selectionBox, setSelectionBox] = useState(null);
  const [menu, setMenu] = useState(null);
  const [editingTextId, setEditingTextId] = useState("");
  const [textDraft, setTextDraft] = useState("");
  const [lightbox, setLightbox] = useState(null);
  const lightboxRef = useRef(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!lightbox) return;
    const previous = document.activeElement;
    const closeButton = lightboxRef.current?.querySelector('button');
    closeButton?.focus({ preventScroll: true });
    const keydown = event => {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation();
        setLightbox(null);
      } else if (event.key === 'Tab') {
        event.preventDefault(); event.stopPropagation();
        closeButton?.focus({ preventScroll: true });
      }
    };
    window.addEventListener('keydown', keydown, true);
    return () => {
      window.removeEventListener('keydown', keydown, true);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [lightbox]);
  selectedRef.current = selected;
  editingTextIdRef.current = editingTextId;
  const promptMap = new Map(prompts.map((prompt) => [prompt.id, prompt]));
  const itemMap = new Map(items.map((item) => [item.objectId, item]));
  const groupFrames = new Map();
  for (const item of items) {
    if (!item.groupId) continue;
    const box=boundsOf(item);
    const frame = groupFrames.get(item.groupId) || { left: item.x, top: item.y, right: item.x + item.width, bottom: item.y + item.height, count: 0, zIndex: item.zIndex };
    frame.left = Math.min(frame.left, box.left);
    frame.top = Math.min(frame.top, box.top);
    frame.right = Math.max(frame.right, box.right);
    frame.bottom = Math.max(frame.bottom, box.bottom);
    frame.count += 1;
    frame.zIndex = Math.min(frame.zIndex, item.zIndex);
    groupFrames.set(item.groupId, frame);
  }
  const minimapItems = [
    ...[...groupFrames].map(([groupId, frame]) => ({ id: `text-group:${groupId}`, kind: "group", x: frame.left - 16, y: frame.top - 28, width: frame.right - frame.left + 32, height: frame.bottom - frame.top + 44, zIndex: frame.zIndex })),
    ...items.map(item => minimapPolygonItem({ id: `item:${item.objectId}`, kind: item.objectType === "sample" ? "asset" : item.objectType === "note" ? "note" : "text", x: item.x, y: item.y, width: item.width, height: item.height, zIndex: item.zIndex, selected: selected.includes(item.objectId) }, item.rotation ? cornersOf(item) : null)),
  ];
  useEffect(() => { onMinimapItems?.(minimapItems); }, [items, selected, onMinimapItems]);

  useEffect(() => {
    frameQueueRef.current?.clear();interactionRef.current = null;
    setAxisId('');setAxisPreview(null);
    setActivity(null);
    setSelectionBox(null);
    selectedRef.current = [];
    setSelected([]);
    setMenu(null);
    setEditingTextId("");
    setReferenceId('');setGuides([]);historyRef.current={undo:[],redo:[]};
    pendingDraftRef.current=null;
  }, [assetId]);

  useEffect(() => {
    const sourceChanged = sourceObjectsRef.current.assetId !== assetId || sourceObjectsRef.current.objects !== initialObjects;
    const liveObjects = sourceChanged && !interactionRef.current && !pendingDraftRef.current && !textController?.snapshot().dirty ? initialObjects : itemsRef.current.filter(item => item.objectType !== 'textBlock');
    sourceObjectsRef.current = {assetId,objects:initialObjects};
    const next = [
      ...liveObjects.filter((item) => item.objectType !== "text"),
      ...initialTextBlocks.map(block=>{
        const next=toTextSurfaceItem(block),live=itemsRef.current.find(i=>i.objectId===next.objectId);
        return live&&(interactionRef.current||externalRef.current?.hasDraft?.())?{...next,...geometry(live)}:next;
      }),
    ];
    if(next.length===itemsRef.current.length&&next.every((item,n)=>item===itemsRef.current[n]))return;
    itemsRef.current = next;
    setItems(next);
  }, [assetId, initialObjects, initialTextBlocks]);
  useEffect(() => {
    const changedOwner = viewportOwnerRef.current !== assetId;
    viewportOwnerRef.current=assetId;
    if (!changedOwner && (interactionRef.current || JSON.stringify(viewportRef.current)!==JSON.stringify(savedViewportRef.current))) return;
    const next = {
      x: standard ? 0 : initialViewport?.viewportX ?? 80,
      y: standard ? 0 : initialViewport?.viewportY ?? 70,
      zoom: standard ? 1 : initialViewport?.zoom ?? 1,
    };
    viewportRef.current = next;
    savedViewportRef.current = {...next};
    setViewportState(next);
  }, [assetId, initialViewport?.viewportX, initialViewport?.viewportY, initialViewport?.zoom]);
  useEffect(() => {
    viewportSaveRef.current = onSaveViewport;
  }, [onSaveViewport]);
  useEffect(() => {
    syncFontFaces(fonts);
  }, [fonts]);

  const stageItems = useCallback((next, extraOptions = {}) => {
    pendingDraftRef.current = {next,options:extraOptions};
    if (textController) textController.draft(viewMode,next,standard ? undefined : next.filter(item=>item.objectType !== 'textBlock'));
    else onDraft?.(next);
    return next;
  },[textController,viewMode,standard,onDraft]);
  const replaceItems = useCallback((nextOrUpdater, {draft=true} = {}) => {
    const next = typeof nextOrUpdater === "function" ? nextOrUpdater(itemsRef.current) : nextOrUpdater;
    if(next.length===itemsRef.current.length&&next.every((item,n)=>item===itemsRef.current[n]))return itemsRef.current;
    itemsRef.current = next;
    setItems(next);
    if(draft)stageItems(next);
    return next;
  }, [stageItems]);
  replaceItemsRef.current = replaceItems;

  const setView = useCallback((next) => {
    const value = typeof next === "function" ? next(viewportRef.current) : next;
    viewportRef.current = value;
    setViewportState(value);
    if (embeddedCanvas) viewportSaveRef.current?.(value,{preview:true});
  }, [embeddedCanvas]);
  setViewRef.current = setView;

  // Completing an edit changes the draft. Only the fixed clock or an explicit
  // save action writes it, so a frequent gesture cannot move the save schedule.
  const commitItems = useCallback(async (next, extraOptions = {}) => stageItems(next,extraOptions), [stageItems]);
  commitItemsRef.current = commitItems;
  const hasActiveInteraction = () => !!interactionRef.current || !!editingTextIdRef.current || composingRef.current;
  const hasPendingChanges = () => !!(textController ? textController.snapshot().dirty : pendingDraftRef.current) || (!standard && !embeddedCanvas && JSON.stringify(viewportRef.current)!==JSON.stringify(savedViewportRef.current));
  const persistDrafts = async ({once=false} = {}) => {
    if (once && hasActiveInteraction()) return false;
    if (!once) {
      finishInteractionRef.current?.(true);
      editingTextIdRef.current='';setEditingTextId('');
    }
    const viewportTarget = {...viewportRef.current};
    try {
      setError('');
      const pending = pendingDraftRef.current;
      if (textController) {
        if (once) await textController.saveOnce(); else await textController.flush();
      } else if (pending) {
        await onSaveObjects(pending.next.filter(item=>item.objectType!=='textBlock'),{...pending.options,textBlocks:pending.next.filter(item=>item.objectType==='textBlock')});
      }
      if (pendingDraftRef.current===pending) pendingDraftRef.current=null;
      if (!standard && !embeddedCanvas && JSON.stringify(viewportTarget)!==JSON.stringify(savedViewportRef.current)) {
        await viewportSaveRef.current?.(viewportTarget);
        savedViewportRef.current=viewportTarget;
      }
      if (!once && hasPendingChanges()) return persistDrafts();
      return true;
    } catch (reason) {setError(String(reason));throw reason;}
  };
  flushSurfaceRef.current = () => persistDrafts();
  manualSaveRef.current = () => onManualSave ? onManualSave() : flushSurfaceRef.current();
  autoSaveRef.current = () => autoSave ? persistDrafts({once:true}) : Promise.resolve(false);
  useEffect(() => {
    textController?.seedInnerObjects(viewMode,standard ? [] : initialObjects.filter(item=>item.objectType!=='text'));
  },[textController,viewMode,standard,initialObjects]);
  useEffect(() => {
    if (embeddedCanvas) return;
    const tick = event => event.detail.promises.push(autoSaveRef.current());
    window.addEventListener('canvas-auto-save',tick);
    return ()=>window.removeEventListener('canvas-auto-save',tick);
  },[embeddedCanvas]);

  const surfacePoint = (event) => {
    const rect = surfaceRef.current.getBoundingClientRect();
    return clientToSurface(event, rect, readUiScale());
  };
  const screenToWorld = (point) => {
    const view = viewportRef.current;
    return surfaceToWorld(point, view);
  };
  const zoomAt = (nextZoom, point) => {
    const view = viewportRef.current;
    const zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    setView(zoomViewportAt(view, zoom, point));
  };
  const zoomCenter = (factor) => {
    const surface = surfaceRef.current;
    if (!surface) return;
    zoomAt(viewportRef.current.zoom * factor, { x: surface.clientWidth / 2, y: surface.clientHeight / 2 });
  };
  const fitAll = () => {
    const surface = surfaceRef.current;
    const all = itemsRef.current;
    if (!surface || !all.length) {
      if (surface) setView({ x: 80, y: 70, zoom: 1 });
      return;
    }
    const {left:minX,top:minY,right:maxX,bottom:maxY}=unionBounds(all);
    const zoom = clamp(Math.min((surface.clientWidth - 100) / Math.max(maxX - minX, 1), (surface.clientHeight - 100) / Math.max(maxY - minY, 1)), MIN_ZOOM, 1.5);
    setView({ x: (surface.clientWidth - (maxX - minX) * zoom) / 2 - minX * zoom, y: (surface.clientHeight - (maxY - minY) * zoom) / 2 - minY * zoom, zoom });
  };

  const finishInteraction = useCallback((cancelled, pointerId) => {
    const interaction = interactionRef.current;
    if (!interaction || (pointerId != null && pointerId !== interaction.pointerId)) return;
    frameQueueRef.current?.clear();interactionRef.current = null;
    setActivity(null);setAxisPreview(null);
    setGuides([]);
    if(!cancelled&&interaction.moved&&interaction.axisPreview?.preview){const preview=interaction.axisPreview.preview;replaceItems(current=>current.map(i=>i.objectId===preview.objectId?{...i,...geometry(preview)}:i),{draft:false});}
    setSelectionBox(null);
    if (cancelled) {
      if (interaction.originals) replaceItems((current) => current.map(item => {
        const original = interaction.originals.get(item.objectId);
        return original ? { ...item, ...geometry(original) } : item;
      }));
      if (interaction.kind === "pan") setView(interaction.viewport);
      if (interaction.kind === "select") { selectedRef.current = interaction.selected; setSelected(interaction.selected); }
    } else if (["move", "resize", "rotate"].includes(interaction.kind) && interaction.moved) {recordGeometry([...interaction.originals.values()],itemsRef.current);commitItems(itemsRef.current);}
  }, [commitItems, replaceItems, setView]);
  finishInteractionRef.current=finishInteraction;
  cancelInteractionRef.current = () => finishInteractionRef.current(true);

  useEffect(() => {
    const replaceGeometryDraft=updater=>replaceItemsRef.current(updater,{draft:false});
    const pointerMove = (event) => {
      const interaction = interactionRef.current;
      if (!interaction || event.pointerId !== interaction.pointerId) return;
      if (interaction.middleButton && !(event.buttons & 4)) { finishInteractionRef.current(false, event.pointerId); return; }
      const view = viewportRef.current;
      const delta = clientWorldDelta(event, interaction, view, readUiScale());
      if (standard && interaction.kind !== 'select') {
        const scroll = detailScrollContainer(surfaceRef.current);
        delta.x += (scroll?.scrollLeft || 0) - (interaction.scrollX || 0);
        delta.y += (scroll?.scrollTop || 0) - (interaction.scrollY || 0);
        if (interaction.kind === 'move') {delta.x=Math.max(delta.x,-Math.min(...[...interaction.originals.values()].map(i=>i.x)));delta.y=Math.max(delta.y,-Math.min(...[...interaction.originals.values()].map(i=>i.y)));}
      }
      if (interaction.kind === "pan") {
        setViewRef.current({ ...interaction.viewport,
          x: interaction.viewport.x + (event.clientX - interaction.startX) / readUiScale(),
          y: interaction.viewport.y + (event.clientY - interaction.startY) / readUiScale() });
      } else if (interaction.kind === "select") {
        const point = clientToSurface(event, surfaceRef.current.getBoundingClientRect(), readUiScale());
        const box = { left: Math.min(interaction.start.x, point.x), top: Math.min(interaction.start.y, point.y),
          right: Math.max(interaction.start.x, point.x), bottom: Math.max(interaction.start.y, point.y) };
        setSelectionBox(box);
        const worldBox={left:(box.left-view.x)/view.zoom,top:(box.top-view.y)/view.zoom,right:(box.right-view.x)/view.zoom,bottom:(box.bottom-view.y)/view.zoom};
        const ids=itemsRef.current.filter(item=>intersectsRotated(worldBox,item)).map(item=>item.objectId);
        selectedRef.current = ids; setSelected(ids);
      } else {
        if (!interaction.moved && Math.hypot(event.clientX - interaction.startX, event.clientY - interaction.startY) < 5) return;
        event.preventDefault();
        if (!interaction.moved) {
          setActivity({ kind: interaction.kind, ids: [...interaction.originals.keys()], corner: interaction.corner });
          if (interaction.kind === "move") {
            const selection = window.getSelection();
            for (const element of surfaceRef.current.querySelectorAll("[data-object-id]")) {
              if (!interaction.originals.has(element.dataset.objectId)) continue;
              for (let i = (selection?.rangeCount || 0) - 1; i >= 0; i--) {
                const range = selection.getRangeAt(i);
                if (range.intersectsNode(element)) selection.removeRange(range);
              }
            }
          }
        }
        interaction.moved = true;
        if (interaction.kind === "move") {
          let movement=delta;
          if(!standard){
            const originals=[...interaction.originals.values()];
            if(interaction.axisReference){
              const candidate=axisSnapPreview(originals[0],interaction.axisReference,delta,{zoom:view.zoom,uiScale:readUiScale(),alt:event.altKey,enabled:snapPrefsRef.current.smart,previous:interaction.snap});
              interaction.snap=candidate.active;interaction.axisPreview=candidate;setAxisPreview(candidate);
            }else{
              movement=snapMove(originals,[],delta,{...snapPrefsRef.current,zoom:view.zoom,uiScale:readUiScale(),alt:event.altKey,previous:interaction.snap,cachedBounds:interaction.snapBounds,includeGaps:originals.length>1||!isImageObject(originals[0])});interaction.snap=movement.active;setGuides(movement.guides);
            }
          }
          replaceGeometryDraft(current => current.map(item => {const start=interaction.originals.get(item.objectId);if(!start||item.locked)return item;const x=standard?Math.max(0,start.x+movement.x):start.x+movement.x,y=standard?Math.max(0,start.y+movement.y):start.y+movement.y;return item.x===x&&item.y===y?item:{...item,x,y};}));
        } else if(interaction.kind==='rotate') {
          const point=surfaceToWorld(clientToSurface(event,surfaceRef.current.getBoundingClientRect(),readUiScale()),view);
          const rotation=rotationFromPointer(interaction.item,interaction.startPoint,point,event.shiftKey);
          replaceGeometryDraft(current=>current.map(item=>item.objectId===interaction.item.objectId?{...item,rotation}:item));
        } else replaceGeometryDraft(current=>current.map(item=>item.objectId===interaction.item.objectId?{...item,...(standard?resizeInnerObject(interaction.item,interaction.corner,interaction.corner.includes("w")?Math.max(delta.x,-interaction.item.x):delta.x,interaction.corner.includes("n")?Math.max(delta.y,-interaction.item.y):delta.y):resizeRotated(interaction.item,interaction.corner,delta,resizeInnerObject))}:item));
      }
    };
    const queue=createCanvasFrameQueue(pointerMove,requestAnimationFrame,cancelAnimationFrame);frameQueueRef.current=queue;
    const queuedMove=event=>{if(interactionRef.current?.pointerId===event.pointerId){event.preventDefault();queue.push(event);}};
    const pointerUp = event => {if(interactionRef.current?.pointerId!==event.pointerId)return;queue.flush(event);finishInteractionRef.current(false, event.pointerId);};
    const pointerCancel = event => finishInteractionRef.current(true, event.pointerId);
    const blur = () => finishInteractionRef.current(true);
    window.addEventListener("pointermove", queuedMove, { passive: false });
    window.addEventListener("pointerup", pointerUp);
    window.addEventListener("pointercancel", pointerCancel);
    window.addEventListener("blur", blur);
    return () => {queue.clear();window.removeEventListener("pointermove", queuedMove); window.removeEventListener("pointerup", pointerUp);
      window.removeEventListener("pointercancel", pointerCancel); window.removeEventListener("blur", blur); };
  }, [standard,embeddedCanvas]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    if (standard || embeddedCanvas) return;
    const wheel = (event) => {
      if (event.target.closest(".canvas-appearance-panel, .canvas-minimap, .inner-object-content, .inner-text-content, .text-block-editor, .text-style-toolbar, .inner-canvas-context-menu, textarea")) return;
      event.preventDefault();
      const rect = surface.getBoundingClientRect();
      if (!interactionRef.current) zoomAt(viewportRef.current.zoom * Math.exp(-event.deltaY * 0.0015), clientToSurface(event, rect, readUiScale()));
    };
    surface.addEventListener("wheel", wheel, { passive: false });
    return () => surface.removeEventListener("wheel", wheel);
  }, []);

  useEffect(() => {
    const keydown = (event) => {
      if (event.defaultPrevented || event.isComposing) return;
      if (lightboxRef.current) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      const typing = Boolean(target?.closest("input, textarea, select, [contenteditable='true']"));
      if (!standard && !embeddedCanvas && event.code === "Space" && !event.repeat && !typing && !target?.closest('button,a,[role="button"]')) {
        spaceRef.current = true;
        event.preventDefault();
      }
      if (event.key === "Escape" && interactionRef.current) { event.preventDefault(); cancelInteractionRef.current?.(); return; }
      if (typing) return;
      if (embeddedCanvas && !event.textAction && event.key !== "Escape") return;
      let commandKey = event.ctrlKey || event.metaKey;
      let key = event.key.toLowerCase();
      if (event.isComposing || event.nativeEvent?.isComposing) return;
      if (event.target?.closest?.('.text-style-toolbar, [role="dialog"]')) return;
      if (!event.textAction && !surfaceRef.current?.contains(document.activeElement) && !(event.target instanceof Node && surfaceRef.current?.contains(event.target))) return;
      if (shortcuts.length || event.textAction) {
        const action = event.textAction || shortcuts.find(action => action.currentShortcut === shortcutFromEvent(event))?.actionId;
        key = ({copy:'c',cut:'x',paste:'v',delete:'delete',save:'save','select-all':'all','canvas-toggle-lock':'lock','canvas-bring-top':'top','canvas-send-bottom':'bottom','canvas-group-selected':'group',undo:'undo',redo:'redo'})[action] || '';
        commandKey = true;
      }
      if(commandKey&&((key==='z')||key==='undo'||key==='redo'||key==='y')){event.preventDefault();geometryHistoryRef.current(key==='redo'||key==='y'||event.shiftKey);return;}
      if (key === 'save') {event.preventDefault();manualSaveRef.current?.().catch(()=>{});return;}
      if (key === 'all') {event.preventDefault();const ids=itemsRef.current.map(i=>i.objectId);selectedRef.current=ids;setSelected(ids);return;}
      if (['lock','top','bottom','group'].includes(key) && selectedRef.current.length) {
        event.preventDefault(); const ids=new Set(selectedRef.current);
        const groupId=id('text-group');
        const z=key==='bottom'?Math.min(0,...itemsRef.current.map(i=>i.zIndex))-ids.size:Math.max(0,...itemsRef.current.map(i=>i.zIndex))+1;
        let offset=0;
        const next=replaceItemsRef.current(current=>current.map(i=>!ids.has(i.objectId)?i:key==='lock'?{...i,locked:!i.locked}:key==='group'?{...i,groupId}:{...i,zIndex:z+offset++}));
        commitItemsRef.current?.(next);return;
      }
      if (commandKey && (key === "c" || key === "x")) {
        const selectedIds = selectedRef.current;
        const copied = itemsRef.current.filter(
          (item) => selectedIds.includes(item.objectId) && item.objectType === "textBlock",
        );
        if (copied.length) {
          clipboardRef.current = copied.map((item) => ({ ...item }));
          if (textController) textController.clipboard = clipboardRef.current;
          event.preventDefault();
          if (key === "x") {
            const copiedIds = new Set(copied.map((item) => item.objectId));
            const next = itemsRef.current.filter((item) => !copiedIds.has(item.objectId));
            replaceItemsRef.current(next);
            const remaining = selectedIds.filter((selectedId) => !copiedIds.has(selectedId));
            selectedRef.current = remaining;
            setSelected(remaining);
            commitItemsRef.current?.(next);
          }
          return;
        }
      }
      if (commandKey && key === "v" && clipboardRef.current.length) {
        event.preventDefault();
        const current = itemsRef.current;
        const maxZ = Math.max(0, ...current.map((item) => item.zIndex));
        const timestamp = Date.now();
        const pasted = clipboardRef.current.map((item, index) => ({
          ...item,
          objectId: id("canvas-text"),
          x: standard ? Math.max(0,item.x+24) : item.x+24,
          y: standard ? Math.max(0,item.y+24) : item.y+24,
          zIndex: maxZ + index + 1,
          locked: false,
          groupId: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        }));
        const next = [...current, ...pasted];
        replaceItemsRef.current(next);
        const pastedIds = pasted.map((item) => item.objectId);
        selectedRef.current = pastedIds;
        setSelected(pastedIds);
        commitItemsRef.current?.(next);
        return;
      }
      if (key === "delete") {
        const selectedIds = selectedRef.current;
        const deletable = itemsRef.current.filter(
          (item) => selectedIds.includes(item.objectId) && item.objectType === "textBlock",
        );
        if (deletable.length) {
          event.preventDefault();
          const deletedIds = new Set(deletable.map((item) => item.objectId));
          const next = itemsRef.current.filter((item) => !deletedIds.has(item.objectId));
          replaceItemsRef.current(next);
          const remaining = selectedIds.filter((selectedId) => !deletedIds.has(selectedId));
          selectedRef.current = remaining;
          setSelected(remaining);
          commitItemsRef.current?.(next);
          return;
        }
      }
      if (event.key === "Escape") {
        setAxisId('');
        selectedRef.current = [];
        setSelected([]);
        setMenu(null);
        setLightbox(null);
        if (editingTextIdRef.current) {
          editingTextIdRef.current = "";
        }
        setEditingTextId("");
      }
    };
    keyHandlerRef.current=keydown;
    const keyup = (event) => { if (event.code === "Space") spaceRef.current = false; };
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    return () => {
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
    };
  }, [shortcuts, embeddedCanvas]);
  useEffect(() => {
    if(!registerShortcutActions)return;
    const actions={};
    for(const action of ['undo','redo','save','copy','cut','paste','delete','select-all','canvas-toggle-lock','canvas-bring-top','canvas-send-bottom','canvas-group-selected']) {
      actions[action]=()=>{
        keyHandlerRef.current?.({textAction:action,key:'',target:surfaceRef.current,preventDefault(){},stopPropagation(){}});
        return true;
      };
    }
    registerShortcutActions(actions);
    return ()=>registerShortcutActions({});
  },[registerShortcutActions]);

  const beginSurfaceInteraction = (event) => {
    if (event.button === 1) return;
    if (event.target.closest(".inner-canvas-object, .inner-canvas-toolbar, .inner-canvas-controls, .inner-canvas-context-menu, .inner-canvas-lightbox, .text-style-toolbar, button, input, textarea, select, a, .sample-case-row, .prompt-readonly")) return;
    setMenu(null);
    const point = surfacePoint(event);
    const previousSelection = [...selectedRef.current];
    if (!standard && event.button === 0 && spaceRef.current) {
      event.preventDefault();
      interactionRef.current = { kind: "pan", pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, viewport: viewportRef.current };
    } else if (event.button === 0) {
      surfaceRef.current.focus({preventScroll:true});
      selectedRef.current = [];
      setSelected([]);
      interactionRef.current = { kind: "select", pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, start: point, selected: previousSelection };
      setSelectionBox({ left: point.x, top: point.y, right: point.x, bottom: point.y });
    }
  };

  const beginObjectMove = (event, item) => {
    if (event.button !== 0 || event.target.closest("button, textarea, input, .inner-resize-handle")) return;
    event.stopPropagation();
    if(externalRef.current){externalRef.current.beginMove(event,item.objectId);return;}
    onTextContextActive?.();
    setMenu(null);
    if (!standard && spaceRef.current) {
      event.preventDefault();
      interactionRef.current = { kind: "pan", pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, viewport: viewportRef.current };
      return;
    }
    let ids = selected;
    if (event.ctrlKey || event.metaKey) {
      ids = selected.includes(item.objectId) ? selected.filter((key) => key !== item.objectId) : [...selected, item.objectId];
      selectedRef.current = ids;
      setSelected(ids);
    } else if (!selected.includes(item.objectId)) {
      ids = [item.objectId];
      selectedRef.current = ids;
      setSelected(ids);
    }
    if (item.locked || !ids.includes(item.objectId)) return;
    const selectedItems = itemsRef.current.filter((entry) => ids.includes(entry.objectId));
    const groupIds = new Set(selectedItems.map((entry) => entry.groupId).filter(Boolean));
    const moving = itemsRef.current.filter((entry) => ids.includes(entry.objectId) || (entry.groupId && groupIds.has(entry.groupId)));
    interactionRef.current = {
      kind: "move", pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollX: detailScrollContainer(surfaceRef.current)?.scrollLeft || 0,
      scrollY: detailScrollContainer(surfaceRef.current)?.scrollTop || 0,
      originals: new Map(moving.filter((entry) => !entry.locked).map((entry) => [entry.objectId, { ...entry }])),
      snapBounds:visibleObjects(itemsRef.current.filter(entry=>!moving.includes(entry)),viewportRef.current,{width:surfaceRef.current.clientWidth,height:surfaceRef.current.clientHeight}).map(entry=>({...boundsOf(entry),id:objectId(entry)})),
      axisReference:moving.length===1&&isImageObject(item)?itemsRef.current.find(entry=>entry.objectId===axisIdRef.current):null,
    };
  };

  const beginResize = (event, item, corner) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.button !== 0 || item.locked) return;
    if(externalRef.current){externalRef.current.beginResize(event,item.objectId,corner);return;}
    interactionRef.current = { kind: "resize", pointerId: event.pointerId, item: { ...item }, originals: new Map([[item.objectId, { ...item }]]), corner, startX: event.clientX, startY: event.clientY, scrollX: detailScrollContainer(surfaceRef.current)?.scrollLeft || 0, scrollY: detailScrollContainer(surfaceRef.current)?.scrollTop || 0 };
  };

  const beginRotation=(event,item)=>{
    event.preventDefault();event.stopPropagation();if(event.button!==0||item.locked||standard)return;
    if(externalRef.current){externalRef.current.beginRotate(event,item.objectId);return;}
    interactionRef.current={kind:'rotate',pointerId:event.pointerId,item:{...item},originals:new Map([[item.objectId,{...item}]]),startPoint:screenToWorld(surfacePoint(event)),startX:event.clientX,startY:event.clientY};
  };
  const toggleAxis=()=>{if(selectedRef.current.length!==1)return;const item=itemsRef.current.find(i=>i.objectId===selectedRef.current[0]);if(isImageObject(item))setAxisId(current=>current===item.objectId?'':item.objectId);};
  const arrangeSelected=action=>{const current=itemsRef.current,chosen=current.filter(i=>selectedRef.current.includes(i.objectId)),reference=current.find(i=>i.objectId===referenceId),next=arrangeObjects(chosen,action,reference,symmetryGap),updates=new Map(next.map(i=>[i.objectId,i]));recordGeometry(chosen,next);replaceItems(current.map(i=>updates.get(i.objectId)||i));commitItems(itemsRef.current);setMenu(null);};
  const rotateSelected=rotation=>{if(selectedRef.current.length!==1)return;const item=itemsRef.current.find(i=>i.objectId===selectedRef.current[0]);if(!item||item.locked)return;const next={...item,rotation:normalizeRotation(rotation)};recordGeometry([item],[next]);replaceItems(current=>current.map(i=>i.objectId===item.objectId?next:i));commitItems(itemsRef.current);};
  const openMenu = (event, objectId = "") => {
    event.preventDefault();
    event.stopPropagation();
    const surface = surfaceRef.current;
    const point = surfacePoint(event);
    const visible = standard ? detailScrollContainer(surface)?.getBoundingClientRect() : null;
    const rect = surface.getBoundingClientRect(), scale = readUiScale();
    const bounds = visible ? {left:Math.max(8,(visible.left-rect.left)/scale+8),top:Math.max(8,(visible.top-rect.top)/scale+8),right:Math.min(surface.clientWidth,(visible.right-rect.left)/scale),bottom:Math.min(surface.clientHeight,(visible.bottom-rect.top)/scale)} : {left:8,top:8,right:surface.clientWidth,bottom:surface.clientHeight};
    const selection = objectId && selected.includes(objectId) ? selected : objectId ? [objectId] : selected;
    if (objectId && !selected.includes(objectId)) {
      selectedRef.current = [objectId];
      setSelected([objectId]);
    }
    if(externalRef.current)externalRef.current.selectForMenu(objectId);
    setMenu({
      objectId,
      selection,
      worldPoint: screenToWorld(point),
      x: clamp(point.x,bounds.left,Math.max(bounds.left,bounds.right-208)),
      y: clamp(point.y,bounds.top,Math.max(bounds.top,bounds.bottom-420)),
    });
  };

  const updateAndCommit = (updater, options) => {
    const before=itemsRef.current;
    const next = replaceItems(updater);
    recordGeometry(before,next);
    commitItems(next, options);
  };
  const addText = (styleType, point, centered = false) => {
    const item = createTextBlockItem(
      assetId,
      point,
      styleType,
      Math.max(0, ...itemsRef.current.map((entry) => entry.zIndex)) + 1,
      readTextTheme(),
    );
    if (centered) {
      item.x -= item.width / 2;
      item.y -= item.height / 2;
    }
    if (standard) {item.x=Math.max(0,item.x);item.y=Math.max(0,item.y);}
    const next = replaceItems((current) => [...current, item]);
    selectedRef.current = [item.objectId];
    setSelected([item.objectId]);
    externalRef.current?.selectForMenu(item.objectId);
    editingTextIdRef.current = item.objectId;
    setEditingTextId(item.objectId);
    setMenu(null);
    commitItems(next);
  };
  const addTextAtCenter = (styleType = "plain") => {
    const surface = surfaceRef.current;
    const rect = surface.getBoundingClientRect();
    const scroll = detailScrollContainer(surface);
    const visible = scroll?.getBoundingClientRect();
    const center = standard && visible ? surfacePoint({clientX:Math.max(rect.left,visible.left)+(Math.min(rect.right,visible.right)-Math.max(rect.left,visible.left))/2,clientY:Math.max(rect.top,visible.top)+(Math.min(rect.bottom,visible.bottom)-Math.max(rect.top,visible.top))/2}) : screenToWorld({x:surface.clientWidth/2,y:surface.clientHeight/2});
    addText(styleType, center, true);
  };
  const addSampleAtCenter = () => {
    const surface = surfaceRef.current;
    onAddSample(screenToWorld({ x: surface.clientWidth / 2, y: surface.clientHeight / 2 }));
  };
  const saveText = (item) => {
    updateAndCommit((current) => current.map((entry) => entry.objectId === item.objectId ? { ...entry, textValue: textDraft } : entry));
    editingTextIdRef.current = "";
    setEditingTextId("");
    flushSurfaceRef.current?.().catch(()=>{});
  };
  const startTextBlockEditing = (item) => {
    editingTextIdRef.current = item.objectId;
    setEditingTextId(item.objectId);
  };
  const finishTextBlockEditing = (objectId) => {
    if (editingTextIdRef.current !== objectId) return;
    editingTextIdRef.current = "";
    setEditingTextId("");
    commitItems(itemsRef.current);
  };
  const updateTextBlockDraft = (item, change) => {
    replaceItems((current) =>
      current.map((entry) =>
        entry.objectId === item.objectId ? { ...entry, ...change } : entry,
      ),
    );
  };
  const changeLayer = (item, direction) => {
    const ordered = [...itemsRef.current].sort((a, b) => a.zIndex - b.zIndex);
    const index = ordered.findIndex((entry) => entry.objectId === item.objectId);
    const swapIndex = direction === "top" ? ordered.length - 1 : direction === "bottom" ? 0 : index + (direction === "up" ? 1 : -1);
    const updates = new Map();
    if (direction === "top") updates.set(item.objectId, Math.max(...ordered.map((entry) => entry.zIndex), 0) + 1);
    else if (direction === "bottom") updates.set(item.objectId, Math.min(...ordered.map((entry) => entry.zIndex), 0) - 1);
    else if (ordered[swapIndex]) {
      updates.set(item.objectId, ordered[swapIndex].zIndex);
      updates.set(ordered[swapIndex].objectId, item.zIndex);
    }
    updateAndCommit((current) => current.map((entry) => updates.has(entry.objectId) ? { ...entry, zIndex: updates.get(entry.objectId) } : entry));
    setMenu(null);
  };
  const focusObject = (item) => {
    if (standard) { const el=surfaceRef.current.querySelector(`[data-object-id="${CSS.escape(item.objectId)}"]`); el?.scrollIntoView({block:"center",inline:"center"}); el?.focus(); setMenu(null); return; }
    const surface = surfaceRef.current;
    const view = viewportRef.current;
    setView({ x: surface.clientWidth / 2 - (item.x + item.width / 2) * view.zoom, y: surface.clientHeight / 2 - (item.y + item.height / 2) * view.zoom, zoom: view.zoom });
    setMenu(null);
  };
  const placePromptBesideImage = (item) => {
    const sample = itemsRef.current.find((entry) => entry.sourcePromptId === item.sourcePromptId && entry.objectType === "sample");
    if (!sample) return;
    updateAndCommit((current) => current.map((entry) => entry.objectId === item.objectId ? { ...entry, x: sample.x + sample.width + 48, y: sample.y + (entry.fieldKey === "negativePrompt" ? 250 : 0) } : entry));
    setMenu(null);
  };
  const groupSelection = (ids) => {
    if (ids.length < 2) return;
    const groupId = id("inner-group");
    updateAndCommit((current) => current.map((entry) => ids.includes(entry.objectId) ? { ...entry, groupId } : entry));
    setMenu(null);
  };
  const joinGroup = (ids, groupId) => {
    updateAndCommit((current) =>
      current.map((entry) => ids.includes(entry.objectId) ? { ...entry, groupId } : entry),
    );
    setMenu(null);
  };
  const toggleLock = (item) => {
    updateAndCommit((current) => current.map((entry) => entry.objectId === item.objectId ? { ...entry, locked: !entry.locked } : entry));
    setMenu(null);
  };
  const updateTextStyle = (item, change) => {
    updateAndCommit((current) => current.map((entry) => entry.objectId === item.objectId ? { ...entry, ...change } : entry));
    setMenu(null);
  };
  const removeText = async (item) => {
    if (!["text", "textBlock"].includes(item.objectType)) return;
    try {
      const next = itemsRef.current.filter((entry) => entry.objectId !== item.objectId);
      replaceItems(next);
      const remaining = selectedRef.current.filter((key) => key !== item.objectId);
      selectedRef.current = remaining;
      setSelected(remaining);
      setMenu(null);
      if (editingTextIdRef.current === item.objectId) {
        editingTextIdRef.current = "";
        setEditingTextId("");
      }
      await commitItems(next, item.objectType === "text" ? { deleteObjectId: item.objectId } : {});
    } catch (reason) {
      setError(String(reason));
    }
  };

  const menuItem = menu?.objectId ? itemMap.get(menu.objectId) : null;
  const selectedTextBlock =
    selected.length === 1 && itemMap.get(selected[0])?.objectType === "textBlock"
      ? itemMap.get(selected[0])
      : null;
  useEffect(() => {
    if (!standard || !baseRef.current) return;
    const base = baseRef.current, shell = shellRef.current;
    const sync = () => { if (!base.isConnected || !shell.isConnected) return; setBaseHeight(base.offsetHeight); setContentWidth(shell.clientWidth); };
    const observer = new ResizeObserver(sync); observer.observe(base); observer.observe(shell); sync();
    const scroll = detailScrollContainer(surfaceRef.current);
    const syncScroll = () => setHorizontalScroll(scroll?.scrollLeft || 0);
    scroll?.addEventListener('scroll',syncScroll,{passive:true});syncScroll();
    return () => {observer.disconnect();scroll?.removeEventListener('scroll',syncScroll);};
  }, [standard]);
  useEffect(() => {
    if (!textController || embeddedCanvas) return;
    const origin = standard ? {x:16,y:baseHeight+32} : {x:Math.max(0,...initialObjects.map(i=>i.x+i.width))+48,y:70};
    if (standard && !baseHeight) return;
    textController.initialize(viewMode,origin);
  }, [textController,viewMode,baseHeight,embeddedCanvas]);
  useEffect(() => onRegisterFlush?.(() => {
    finishInteraction(true);
    editingTextIdRef.current='';setEditingTextId('');
    if (!autoSave && hasPendingChanges()) {
      const message='有未保存的画布修改，请点击“保存”后再离开。';setError(message);return Promise.reject(Error(message));
    }
    return flushSurfaceRef.current();
  }), [onRegisterFlush,textController,finishInteraction,autoSave]);
  const stylePanel = selectedTextBlock && <TextStyleToolbar item={selectedTextBlock} theme={textTheme} fonts={fonts} onChange={(change)=>updateAndCommit(current=>current.map(item=>item.objectId===selectedTextBlock.objectId?{...item,...change}:item))}/>;
  const right = Math.max(contentWidth || 0,...items.map(i=>i.x+i.width+24));
  const bottom = Math.max(baseHeight+64,...items.map(i=>i.y+i.height+24));
  const createAtMenuPoint = (styleType) => {
    addText(styleType, menu.worldPoint);
  };
  useImperativeHandle(surfaceApiRef, () => ({
    addText(styleType = 'plain', point) { onTextContextActive?.(); if (point) addText(styleType,point,true); else addTextAtCenter(styleType); },
    items: () => itemsRef.current,
    selectIds(ids) {selectedRef.current=ids;setSelected(ids);},
    patchGeometry(patches) {const byId=new Map(patches.map(i=>[i.objectId||i.id,i]));return replaceItemsRef.current(current=>current.map(i=>{const p=byId.get(i.objectId);if(!p||['x','y','width','height','rotation'].every(k=>(i[k]||0)===(p[k]||0)))return i;return {...i,...geometry(p)};}),{draft:false});},
    commitGeometry(batch,persist,options) {textController?.draft('canvas',itemsRef.current);return onCommitGeometry ? onCommitGeometry(batch,persist,options) : flushSurfaceRef.current();},
    autoSave() {return autoSaveRef.current();},
    hasActiveInteraction,
    hasPendingChanges,
    cancelInteraction() {cancelInteractionRef.current?.();},
    flush() {return flushSurfaceRef.current();},
    clearSelection() { cancelInteractionRef.current?.(); selectedRef.current=[];setSelected([]);setMenu(null);if(editingTextIdRef.current)finishTextBlockEditing(editingTextIdRef.current); },
    selectBox(box) {const view=viewportRef.current;const worldBox={left:(box.left-view.x)/view.zoom,top:(box.top-view.y)/view.zoom,right:(box.right-view.x)/view.zoom,bottom:(box.bottom-view.y)/view.zoom};const ids=itemsRef.current.filter(i=>intersectsRotated(worldBox,i)).map(i=>i.objectId);selectedRef.current=ids;setSelected(ids);return ids;},
    action(action) { if (!selectedRef.current.length && !(action==='paste' && clipboardRef.current.length)) return false; keyHandlerRef.current?.({textAction:action,key:'',target:surfaceRef.current,preventDefault(){},stopPropagation(){}});return true; },
  }));

  const surface = (
    <div ref={shellRef} className={embeddedCanvas ? "outer-text-shell" : standard ? "standard-text-shell" : "inner-canvas-shell"} onCompositionStartCapture={()=>{composingRef.current=true;}} onCompositionEndCapture={()=>{composingRef.current=false;}}>
      {!embeddedCanvas && <div className="inner-canvas-toolbar" style={standard ? {transform:`translateX(${horizontalScroll}px)`} : undefined}>
        <div>
          <button className="secondary" onClick={addSampleAtCenter}><ImagePlus size={15} />新增样图</button>
          <button className="secondary" onClick={() => addTextAtCenter("plain")}><FilePlus2 size={15} />添加文字</button>
        </div>
        {standard ? <select aria-label="定位文字" value="" onChange={event=>{const item=items.find(i=>i.objectId===event.target.value);if(item)focusObject(item);}}><option value="">定位文字（{items.length}）</option>{items.map((item,index)=><option key={item.objectId} value={item.objectId}>{item.title || item.textValue?.slice(0,24) || `文字 ${index+1}`}</option>)}</select> : <span>滚轮缩放 · 空格或中键平移 · 拖动空白处框选</span>}
      </div>}
      {stylePanel && <CanvasInspectorPortal section="text">{stylePanel}</CanvasInspectorPortal>}
      <div
        style={standard ? {minWidth:right,minHeight:bottom} : embeddedCanvas ? undefined : canvasSurfaceStyle(canvasAppearance || resolveCanvasAppearance(), viewport)}
        ref={surfaceRef}
        className={`${embeddedCanvas ? "outer-text-surface" : standard ? "standard-text-surface" : `asset-inner-canvas background-${(canvasAppearance || resolveCanvasAppearance()).pattern}`} ${interactionRef.current?.kind === "pan" ? "is-panning" : ""}`}
        tabIndex="0"
        onPointerDownCapture={event => {
          if (event.target.closest('.ui-inspector, .inner-canvas-lightbox')) return;
          if (standard || embeddedCanvas) return;
          captureMiddleCanvasPan(event, surfaceRef.current, () => {
            setMenu(null);
            interactionRef.current = { kind: "pan", middleButton: true, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, viewport: viewportRef.current };
            setActivity({kind:"pan",ids:[]});
          });
        }}
        onLostPointerCapture={event => {
          if (interactionRef.current?.middleButton) finishInteraction(false, event.pointerId);
        }}
        onPointerDown={beginSurfaceInteraction}
        onAuxClick={(event) => event.preventDefault()}
        onContextMenu={(event) => {if(standard && event.target.closest(".standard-detail-content button, .sample-case-row, textarea, input"))return;openMenu(event);}}
        onDoubleClick={(event) => {
          if (event.target.closest(".inner-canvas-object, .inner-canvas-toolbar, .inner-canvas-controls, .inner-canvas-context-menu, .text-style-toolbar")) return;
          if(standard && event.target.closest(".standard-detail-content"))return;
          const center = screenToWorld(surfacePoint(event));
          addText("plain", center, true);
        }}
      >
        {standard && <div ref={baseRef} className="standard-detail-content" style={{width:contentWidth || "100%"}}>{children}</div>}
        <div className="inner-canvas-world" style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})` }}>
          {[...groupFrames].map(([groupId, frame]) => (
            <div key={groupId} className="inner-canvas-group-frame" style={{ left: frame.left - 16, top: frame.top - 28, width: frame.right - frame.left + 32, height: frame.bottom - frame.top + 44, zIndex: frame.zIndex }}>
              <span>分组 · {frame.count} 项</span>
            </div>
          ))}
          {items.map((item) => {
            const prompt = item.sourcePromptId ? promptMap.get(item.sourcePromptId) : null;
            const isSelected = selected.includes(item.objectId);
            const active = activity?.ids.includes(item.objectId);
            const moving = active && activity.kind === "move";
            const resizing = active && activity.kind === "resize";
            const editing = editingTextId === item.objectId;
            const showControls = isSelected && (resizing || (externalCanvas?.selectionCount ?? selected.length) === 1 || (controlId || focusedControlId) === item.objectId) && !editing && !moving && activity?.kind!=='rotate';
            const imagePath = prompt?.sampleImagePath || "";
            const value = item.objectType === "text" ? item.textValue : prompt?.[item.fieldKey] || "";
            return (
              <article
                key={item.objectId}
                className={`inner-canvas-object inner-object-${item.objectType} ${isSelected ? "selected" : ""} ${item.groupId ? "grouped" : ""} ${item.locked ? "locked" : ""} ${moving ? "moving" : ""} ${resizing ? "resizing" : ""} ${editing ? "editing" : ""}`}
                style={{ left: item.x, top: item.y, width: item.width, height: item.height, transform: item.rotation ? `rotate(${item.rotation}deg)` : undefined, transformOrigin:"center center", zIndex: item.zIndex, "--inner-font-size": `${item.fontSize || 14}px`, "--inner-control-scale": 1 / (viewport.zoom * uiScale) }}
                data-object-id={item.objectId}
                onDragStart={(event) => event.preventDefault()}
                tabIndex={0}
                onPointerEnter={() => setControlId(item.objectId)}
                onPointerLeave={() => setControlId((current) => current === item.objectId ? "" : current)}
                onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocusedControlId(""); }}
                onFocus={() => { if(externalRef.current)return;onTextContextActive?.(); setFocusedControlId(item.objectId); if (!selectedRef.current.includes(item.objectId)) { selectedRef.current = [item.objectId]; setSelected([item.objectId]); } }}
                onPointerDown={(event) => beginObjectMove(event, item)}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  if (item.objectType === "sample" && imagePath) setLightbox({ src: fileUrl(imagePath), title: prompt?.title || "样图" });
                  else if (item.objectType === "textBlock") startTextBlockEditing(item);
                  else if (item.objectType === "text") { editingTextIdRef.current = item.objectId; setEditingTextId(item.objectId); setTextDraft(item.textValue); }
                  else if (item.sourcePromptId) onEditPrompt(item.sourcePromptId, item.fieldKey);
                }}
                onContextMenu={(event) => openMenu(event, item.objectId)}
              >
                {item.objectType === "sample" && (
                  <>
                    {imagePath ? <img className="inner-sample-image" src={fileUrl(imagePath)} alt={prompt?.title || "样图"} draggable="false" /> : <div className="inner-sample-missing">样图文件不可用</div>}
                    <span className="inner-sample-title">{prompt?.title || "样图"}</span>
                  </>
                )}
                {item.objectType === "prompt" && (
                  <>
                    <header className="inner-object-heading">
                      <strong>{objectLabel(item, prompt)}</strong>
                      <button title="复制内容" onPointerDown={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); navigator.clipboard.writeText(value).catch(() => {}); }}><Copy size={13} /></button>
                    </header>
                    <div className="inner-object-content">{value || <span className="inner-object-placeholder">双击编辑 Prompt</span>}</div>
                  </>
                )}
                {item.objectType === "note" && (
                  <>
                    <header className="inner-object-heading"><strong>备注 · {prompt?.title || "样图"}</strong><Pencil size={12} /></header>
                    <div className="inner-object-content">{value || <span className="inner-object-placeholder">双击添加备注</span>}</div>
                  </>
                )}
                {item.objectType === "text" && (
                  editingTextId === item.objectId ? (
                    <div className="inner-text-editor" onPointerDown={(event) => event.stopPropagation()}>
                      <textarea autoFocus value={textDraft} onChange={(event) => setTextDraft(event.target.value)} onDoubleClick={(event) => event.stopPropagation()} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") saveText(item); if (event.key === "Escape") setEditingTextId(""); }} />
                      <div><button className="secondary" onClick={() => setEditingTextId("")}>取消</button><button className="primary" onClick={() => saveText(item)}>保存</button></div>
                    </div>
                  ) : (
                    <div className="inner-text-content" style={{ fontSize: item.fontSize || 14, fontWeight: item.bold ? 700 : 400 }}>{item.textValue || <span className="inner-object-placeholder">双击编辑文字</span>}</div>
                  )
                )}
                {item.objectType === "textBlock" && (
                  <TextBlock
                    item={item}
                    editing={editingTextId === item.objectId}
                    theme={textTheme}
                    onChange={(change) => updateTextBlockDraft(item, change)}
                    onSave={() => finishTextBlockEditing(item.objectId)}
                  />
                )}
                <span className="inner-object-outline" aria-hidden="true" />
                {showControls && !item.locked && ["nw", "ne", "sw", "se"].map((corner) => <button key={corner} className={`inner-resize-handle ${corner}${resizing && activity.corner !== corner ? " inactive" : ""}`} aria-label={`调整大小${{ nw: "左上角", ne: "右上角", sw: "左下角", se: "右下角" }[corner]}`} aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight" onDoubleClick={(event) => event.stopPropagation()} onKeyDown={(event) => {
                  if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
                  event.preventDefault(); event.stopPropagation();
                  updateAndCommit(current => current.map(entry => entry.objectId === item.objectId ? resizeInnerObject(entry, corner, event.key === "ArrowRight" ? 10 : event.key === "ArrowLeft" ? (standard && corner.includes("w") ? Math.max(-10,-entry.x) : -10) : 0, event.key === "ArrowDown" ? 10 : event.key === "ArrowUp" ? (standard && corner.includes("n") ? Math.max(-10,-entry.y) : -10) : 0) : entry));
                }} onPointerDown={(event) => beginResize(event, item, corner)} />)}
                {!standard&&isSelected&&(externalCanvas?.selectionCount ?? selected.length)===1&&!item.locked&&!editing&&!moving&&!resizing&&<button className="canvas-rotate-handle" aria-label="旋转对象" title="拖动旋转；Shift 每次 15°" onPointerDown={event=>beginRotation(event,item)} onDoubleClick={event=>event.stopPropagation()}><RotateCw size={12}/></button>}
                {activity?.kind==='rotate'&&active&&<span className="canvas-angle-live">{Number((item.rotation||0).toFixed(1))}°</span>}
                {item.locked && <span className="inner-object-lock"><Lock size={12} /></span>}
              </article>
            );
          })}
        </div>
        {!standard&&!embeddedCanvas&&<><CanvasSnapGuides guides={guides} viewport={viewport}/><CanvasAxisGuides reference={items.find(i=>i.objectId===axisId)} preview={axisPreview?.preview} active={axisPreview?.active} viewport={viewport}/><CanvasArrangeTools axisReference={items.find(i=>i.objectId===axisId)} onAxisToggle={toggleAxis} onAxisClear={()=>setAxisId('')} items={items.filter(i=>selected.includes(i.objectId))} reference={items.find(i=>i.objectId===referenceId)} onAction={arrangeSelected} onReference={()=>setReferenceId(selected[0])} gap={symmetryGap} setGap={setSymmetryGap} onRotation={rotateSelected} onUndo={()=>applyGeometryHistory(false)} onRedo={()=>applyGeometryHistory(true)} canUndo={!!historyRef.current.undo.length} canRedo={!!historyRef.current.redo.length} {...snapPrefs}/></>}
        {selectionBox && <div className="inner-canvas-selection" style={{ left: selectionBox.left, top: selectionBox.top, width: selectionBox.right - selectionBox.left, height: selectionBox.bottom - selectionBox.top }} />}
        {!standard && !embeddedCanvas && !items.length && <div className="inner-canvas-empty"><AlignLeft size={27} /><strong>这个资产还没有样图</strong><span>右键画布或点击“新增样图”开始</span></div>}
        {!standard && !embeddedCanvas && <div className="inner-canvas-controls">
          <button aria-label="缩小" onClick={() => zoomCenter(0.8)}><Minus size={15} /></button>
          <span>{Math.round(viewport.zoom * 100)}%</span>
          <button aria-label="放大" onClick={() => zoomCenter(1.25)}><Plus size={15} /></button>
          <button title="恢复100%缩放" onClick={() => zoomAt(1, { x: surfaceRef.current.clientWidth / 2, y: surfaceRef.current.clientHeight / 2 })}>1:1</button>
          <button onClick={fitAll}><Maximize size={14} />适应全部</button>
          <MinimapToggle {...minimap} />
          <button aria-label="画布背景" aria-expanded={appearanceOpen} onClick={() => setAppearanceOpen(value => !value)}><Palette size={15} />背景</button>
        </div>}
        {!standard && !embeddedCanvas && <CanvasMinimap sceneKey={assetId} surfaceRef={surfaceRef} viewport={viewport} onViewportChange={setView}
          expanded={minimap.expanded} onCollapse={minimap.toggle} suppressed={appearanceOpen}
          items={minimapItems} />}
        {!standard && !embeddedCanvas && appearanceOpen && <div className="canvas-appearance-panel" onPointerDown={event => event.stopPropagation()} onWheel={event => event.stopPropagation()}>
          <fieldset disabled={appearanceSaving} style={{border:0,padding:0,margin:0,minWidth:0}}>
            <CanvasAppearanceControls {...(canvasAppearance || resolveCanvasAppearance())} onChange={saveAppearance} />
            <button type="button" className="secondary" disabled={!hasOwnAppearance} onClick={() => saveAppearance(null)}>恢复继承</button>
          </fieldset>
          <p>{appearanceSaving ? "正在保存…" : hasOwnAppearance ? "仅当前资产内画布" : "继承外画布背景"}</p>
          {appearanceError && <p role="alert">{appearanceError}</p>}
        </div>}
        {menu && (
          <div className="inner-canvas-context-menu" style={{ left: menu.x, top: menu.y }} onPointerDown={(event) => event.stopPropagation()}>
            {!standard&&menuItem&&<details className="canvas-transform-menu"><summary>排列与对称</summary><ArrangeCommands {...(externalCanvas?.arrange || {axisImage:selected.length===1&&isImageObject(menuItem),axisActive:menuItem.objectId===axisId,onAxisToggle:()=>{setMenu(null);toggleAxis();},count:selected.length,locked:items.filter(i=>selected.includes(i.objectId)).some(i=>i.locked),reference:items.find(i=>i.objectId===referenceId),onAction:arrangeSelected,onReference:()=>setReferenceId(selected[0]),gap:symmetryGap,setGap:setSymmetryGap})}/></details>}
            {menuItem ? <>
              {menuItem.objectType === "textBlock" ? <button onClick={() => { startTextBlockEditing(menuItem); setMenu(null); }}><Pencil size={14} />编辑文字</button> : menuItem.objectType === "text" ? <button onClick={() => { editingTextIdRef.current = menuItem.objectId; setEditingTextId(menuItem.objectId); setTextDraft(menuItem.textValue); setMenu(null); }}><Pencil size={14} />编辑文字</button> : menuItem.sourcePromptId && menuItem.objectType !== "sample" ? <button onClick={() => { onEditPrompt(menuItem.sourcePromptId, menuItem.fieldKey); setMenu(null); }}><Pencil size={14} />编辑关联案例</button> : null}
              {menuItem.objectType === "sample" && <button onClick={() => { const related = itemsRef.current.find((item) => item.sourcePromptId === menuItem.sourcePromptId && item.objectType === "prompt"); if (related) focusObject(related); else setMenu(null); }}><AlignLeft size={14} />定位关联 Prompt</button>}
              {menuItem.objectType === "prompt" && <button onClick={() => placePromptBesideImage(menuItem)}><AlignLeft size={14} />将 Prompt 放到图片旁边</button>}
              {menuItem.objectType === "text" && <><button onClick={() => updateTextStyle(menuItem, { fontSize: clamp((menuItem.fontSize || 14) - 2, 10, 64) })}>缩小字号</button><button onClick={() => updateTextStyle(menuItem, { fontSize: clamp((menuItem.fontSize || 14) + 2, 10, 64) })}>增大字号</button><button onClick={() => updateTextStyle(menuItem, { bold: !menuItem.bold })}>{menuItem.bold ? "取消粗体" : "粗体"}</button></>}
              {menuItem.objectType === "textBlock" && (
                <button onClick={() => { clipboardRef.current = menu.selection.map((key) => itemMap.get(key)).filter((item) => item?.objectType === "textBlock").map((item) => ({ ...item })); if(textController) textController.clipboard=clipboardRef.current; setMenu(null); }}>
                  <Copy size={14} />复制文字块
                </button>
              )}
              <hr />
              <button onClick={() => changeLayer(menuItem, "top")}><ArrowUpToLine size={14} />置于顶层</button>
              <button onClick={() => changeLayer(menuItem, "bottom")}><ArrowDownToLine size={14} />置于底层</button>
              <button onClick={() => toggleLock(menuItem)}>{menuItem.locked ? <Unlock size={14} /> : <Lock size={14} />}{menuItem.locked ? "解除锁定" : "锁定"}</button>
              {menuItem.groupId ? <button onClick={() => { const groupId = menuItem.groupId; updateAndCommit((current) => current.map((item) => item.groupId === groupId ? { ...item, groupId: null } : item)); setMenu(null); }}>取消分组</button> : menu.selection.length > 1 ? <button onClick={() => groupSelection(menu.selection)}><Plus size={14} />将所选对象创建为分组</button> : null}
              {menuItem.objectType === "textBlock" && [...groupFrames].some(([groupId]) => groupId !== menuItem.groupId) && (
                <details className="inner-canvas-join-group">
                  <summary>加入现有分组</summary>
                  {[...groupFrames].map(([groupId, frame], index) => groupId !== menuItem.groupId && (
                    <button key={groupId} onClick={() => joinGroup(menu.selection, groupId)}>
                      分组 {index + 1} · {frame.count} 项
                    </button>
                  ))}
                </details>
              )}
              {["text", "textBlock"].includes(menuItem.objectType) && <><hr /><button className="danger" onClick={() => removeText(menuItem)}><Trash2 size={14} />删除文字块</button></>}
            </> : <>
              <button onClick={() => { addSampleAtCenter(); setMenu(null); }}><ImagePlus size={14} />新增样图</button>
              {TEXT_BLOCK_STYLES.map((style) => (
                <button key={style.id} onClick={() => createAtMenuPoint(style.id)}>
                  <FilePlus2 size={14} />添加{style.label}
                </button>
              ))}
              {menu.selection.length > 1 && <button onClick={() => groupSelection(menu.selection)}><Plus size={14} />将所选对象创建为分组</button>}
              {!standard && <><hr />
              <button onClick={fitAll}><Maximize size={14} />适应全部内容</button>
              <button onClick={() => { setView({ x: 80, y: 70, zoom: 1 }); setMenu(null); }}>重置视图</button></>}
            </>}
          </div>
        )}
        {error && <div className="inner-canvas-error"><span>{error}</span><button onClick={()=>flushSurfaceRef.current().catch(()=>{})}>重试保存</button><button onClick={() => setError("")}><X size={13} /></button></div>}
      </div>
      {lightbox && createPortal(<div ref={lightboxRef} className="inner-canvas-lightbox" role="dialog" aria-modal="true" aria-label={lightbox.title || '样图预览'} onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); setLightbox(null); }} onContextMenu={event => event.stopPropagation()}><button type="button" aria-label="关闭" onClick={() => setLightbox(null)}><X size={20} /></button><img src={lightbox.src} alt={lightbox.title} /><span>{lightbox.title}</span></div>, document.body)}
    </div>
  );
  return embeddedCanvas ? surface : <CanvasEditorLayout surface={standard ? 'standard' : 'inner'}>{surface}</CanvasEditorLayout>;
}
