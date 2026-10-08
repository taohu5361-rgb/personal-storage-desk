import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Lock, StickyNote, Unlock } from "lucide-react";
import { AssetNoteDrawer } from "./AssetNoteDrawer";
import { DrawerAttachmentPanel } from "./DrawerAttachmentPanel.jsx";
import { DrawerDragController, screenEventToWorld, worldDrawerRectToLocal, localDrawerRectToWorld, drawerAssetFrame } from "./DrawerDragController";
import {
  createDefaultDrawerPlacement,
  drawerWorldRect,
  drawerVisibleRect,
  drawerHandleRect,
  assetDrawerDecoration,
  isDrawerDocked,
  isDrawerCollapsed,
  normalizeDrawer,
  maxDrawerOffset,
  normalizeDrawerLayout,
  resolveDrawerPlacement,
  resizeDrawerByDelta,
} from "./DrawerLayoutEngine";
import {
  createAssetNoteDrawer,
  deleteAssetNoteDrawer,
  listCategoryNoteDrawers,
  createIndependentNoteDrawer,
  saveAssetNoteDrawer,
  flushAssetNoteDrawerSaves,
} from "../data/assetNoteDrawerRepository";
import { reconcileDrawerSave, snapshotDirtyDrawers } from "./DrawerSaveState.js";
import { objectToWorld } from "./canvasTransforms.js";
import { minimapPolygonItem } from "./minimapGeometry.js";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const readUiScale = () => Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ui-scale")) || 1;

function DrawerScalePanel({ drawer, position, onChange, onClose }) {
  const [draft, setDraft] = useState(String(Math.round(drawer.textScale * 100)));
  useEffect(() => setDraft(String(Math.round(drawer.textScale * 100))), [drawer.id, drawer.textScale]);
  const commit = () => {
    const percent = draft.trim() === "" ? drawer.textScale * 100 : Number(draft);
    const valid = Number.isFinite(percent) ? clamp(percent, 50, 2000) : drawer.textScale * 100;
    setDraft(String(Math.round(valid))); onChange(drawer.id, valid);
  };
  return <div className="asset-note-scale-panel" role="dialog" aria-label="文字缩放设置" style={{ left: position.x, top: position.y }} onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Escape") onClose(); }}>
    <div className="asset-note-scale-heading"><strong>文字缩放</strong><button type="button" aria-label="关闭文字缩放设置" onClick={onClose}>×</button></div>
    <label className="asset-note-scale-value">比例 <input aria-label="文字缩放百分比" type="number" min="50" max="2000" step="1" value={draft} onChange={(e) => { setDraft(e.target.value); const value = e.target.valueAsNumber; if (value >= 50 && value <= 2000) onChange(drawer.id, value); }} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") { commit(); e.currentTarget.blur(); } }} /> %</label>
    <input aria-label="文字缩放滑条" type="range" min="50" max="2000" step="1" value={drawer.textScale * 100} onChange={(e) => onChange(drawer.id, Number(e.target.value))} />
    <button type="button" onClick={() => onChange(drawer.id, 100)}>恢复 100%</button>
  </div>;
}

export function AssetNoteDockHost({ assetId, onHostChange }) {
  const register = useCallback((node) => onHostChange(assetId, node), [assetId, onHostChange]);
  return <div className="asset-note-dock-host" ref={register} />;
}

export const AssetNoteDrawerLayer = forwardRef(function AssetNoteDrawerLayer(
  { assets, displayAssets, groups = [], activeCategoryId, viewport, surfaceRef, worldRef, dockHosts, onDecorationChange, onMinimapItems, settings },
  ref,
) {
  const [drawers, setDrawers] = useState([]);
  const [loadedAssetKey, setLoadedAssetKey] = useState("");
  const [loadError, setLoadError] = useState("");
  const [preview, setPreview] = useState(null);
  const [editingId, setEditingId] = useState("");
  const [selectedDrawerId, setSelectedDrawerId] = useState("");
  const [uiScale, setUiScale] = useState(readUiScale);
  useEffect(() => {
    const syncScale = () => setUiScale(readUiScale());
    const observer = new MutationObserver(syncScale);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
    syncScale();
    return () => observer.disconnect();
  }, []);
  const [notice, setNotice] = useState("");
  const [saveError, setSaveError] = useState("");
  const [drawerMenu, setDrawerMenu] = useState(null);
  const [scaleMenu, setScaleMenu] = useState(null);
  const [attachmentMenu, setAttachmentMenu] = useState(null);
  const [attachmentBusy, setAttachmentBusy] = useState(new Set());
  const attachmentBusyRef = useRef(new Set());
  const visibleAssetsRef = useRef([]);
  const textareaRef = useRef(null);
  const drawersRef = useRef(drawers);
  const assetsRef = useRef(assets);
  const viewportRef = useRef(viewport);
  const savingCountRef = useRef(0);
  const saveBatchesRef = useRef(new Map());
  const autoSaveRef = useRef(null);
  const interactionStateRef = useRef({});
  const noticeTimerRef = useRef(null);
  const portalRef = useRef(null);
  const controllerRef = useRef(null);
  const creatingAssetIdsRef = useRef(new Set());
  const confirmedRef = useRef(new Map());
  const loadEpochRef = useRef(0);
  const deletingRef = useRef(new Set());

  if (!portalRef.current) {
    portalRef.current = document.createElement("div");
    portalRef.current.className = "asset-note-drawer-layer-portal";
  }
  assetsRef.current = assets;
  viewportRef.current = viewport;
  interactionStateRef.current = { editingId, scaleMenu, settings };

  const assetIds = useMemo(() => assets.map((asset) => asset.id), [assets]);
  const assetKey = activeCategoryId + "\u0000" + assetIds.slice().sort().join("\u0000");
  const assetSizeKey = assets.map((asset) => `${asset.id}:${asset.width}:${asset.height}`).join("|");
  const drawerById = useMemo(() => new Map(drawers.map((drawer) => [drawer.id, drawer])), [drawers]);
  const drawersByAsset = useMemo(() => {
    const grouped = new Map();
    for (const drawer of drawers) {
      if (!grouped.has(drawer.assetId)) grouped.set(drawer.assetId, []);
      grouped.get(drawer.assetId).push(drawer);
    }
    return grouped;
  }, [drawers]);
  const collapsedGroupIds = useMemo(() => new Set(groups.filter((group) => group.collapsed).map((group) => group.id)), [groups]);
  const visibleAssets = displayAssets.filter((asset) => !collapsedGroupIds.has(asset.groupId));
  visibleAssetsRef.current = visibleAssets;
  const visibleAssetIds = new Set(visibleAssets.map((asset) => asset.id));
  const visibleDrawers = drawers.filter((drawer) => !drawer.assetId || visibleAssetIds.has(drawer.assetId));
  const assetForDrawer = (drawer) => assetsRef.current.find((asset) => asset.id === drawer.assetId) || { id: null, x: 0, y: 0, width: 0, height: 0, rotation: 0 };
  const setBusy = (id, busy) => {
    if (busy) attachmentBusyRef.current.add(id); else attachmentBusyRef.current.delete(id);
    setAttachmentBusy(new Set(attachmentBusyRef.current));
  };

  const updateDrawerList = (update) => {
    const next = typeof update === "function" ? update(drawersRef.current) : update;
    drawersRef.current = next;
    setDrawers(next);
  };
  const announce = (message) => {
    setNotice(String(message || "备注抽屉操作失败"));
    clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(""), 2800);
  };
  const persistDrawer = async (drawer, previous) => {
    if (deletingRef.current.has(drawer.id)) return;
    // The tick/explicit save owns this exact snapshot. Later typing remains a
    // separate dirty draft and waits for the next tick or manual save.
    const submitted = normalizeDrawer({ ...drawer, categoryId: drawer.categoryId || activeCategoryId });
    const epoch = loadEpochRef.current;
    const baseline = previous || confirmedRef.current.get(drawer.id);
    const changingOwner = (baseline?.assetId ?? null) !== (submitted.assetId ?? null);
    if (changingOwner) setBusy(drawer.id, true);
    savingCountRef.current += 1;
    try {
      const saved = await saveAssetNoteDrawer(submitted, baseline);
      if (epoch !== loadEpochRef.current) return saved;
      confirmedRef.current.set(saved.id, saved);
      updateDrawerList((current) => current.map((item) => item.id === saved.id ? reconcileDrawerSave(item, submitted, saved) : item));
      return saved;
    } finally {
      savingCountRef.current -= 1;
      if (changingOwner) setBusy(drawer.id, false);
    }
  };
  const hasPendingChanges = () => savingCountRef.current > 0 || snapshotDirtyDrawers(drawersRef.current, confirmedRef.current, deletingRef.current).length > 0;
  const hasActiveInteraction = () => !!controllerRef.current?.active || !!interactionStateRef.current.editingId
    || !!interactionStateRef.current.scaleMenu || attachmentBusyRef.current.size > 0 || creatingAssetIdsRef.current.size > 0;
  const flushAllSaves = () => {
    if (controllerRef.current?.active) return Promise.reject(new Error("请先结束备注拖动或调整尺寸，再保存"));
    const changed = snapshotDirtyDrawers(drawersRef.current, confirmedRef.current, deletingRef.current);
    const epoch = loadEpochRef.current;
    const key = `${epoch}:${JSON.stringify(changed)}`;
    // Parent departure safety and this owner's departure listener may request
    // the same snapshot together. Share that write instead of duplicating it.
    if (saveBatchesRef.current.has(key)) return saveBatchesRef.current.get(key);
    const batch = (async () => {
      try {
        await Promise.all(changed.map((drawer) => persistDrawer(drawer)));
        await flushAssetNoteDrawerSaves();
        if (epoch === loadEpochRef.current) setSaveError("");
      } catch (error) {
        if (epoch === loadEpochRef.current) setSaveError(String(error?.message || error));
        throw error;
      }
    })();
    saveBatchesRef.current.set(key, batch);
    void batch.finally(() => { if (saveBatchesRef.current.get(key) === batch) saveBatchesRef.current.delete(key); }).catch(() => {});
    return batch;
  };
  const autoSave = () => {
    if (interactionStateRef.current.settings?.autoSave === false || hasActiveInteraction()) return Promise.resolve();
    if (autoSaveRef.current) return autoSaveRef.current;
    const pending = flushAllSaves();
    autoSaveRef.current = pending;
    void pending.finally(() => { if (autoSaveRef.current === pending) autoSaveRef.current = null; }).catch(() => {});
    return pending;
  };
  const flushRef = useRef(flushAllSaves);
  flushRef.current = flushAllSaves;
  useEffect(() => {
    const beforeLeave = (event) => {
      controllerRef.current?.finish(true);
      if (interactionStateRef.current.settings?.autoSave === false && hasPendingChanges()) {
        const message = "备注尚未保存，请先点击保存，再离开当前画布";
        announce(message);
        event.detail.promises.push(Promise.reject(new Error(message)));
      } else event.detail.promises.push(flushRef.current());
    };
    window.addEventListener("asset-text-before-leave", beforeLeave);
    return () => window.removeEventListener("asset-text-before-leave", beforeLeave);
  }, []);

  useEffect(() => {
    const portal = portalRef.current;
    const world = worldRef.current;
    if (!world || !portal) return undefined;
    world.appendChild(portal);
    return () => portal.remove();
  }, [worldRef]);

  useEffect(() => {
    drawersRef.current = drawers;
  }, [drawers]);

  useEffect(() => {
    let cancelled = false;
    loadEpochRef.current += 1;
    controllerRef.current?.finish(true);
    setPreview(null);
    setLoadedAssetKey("");
    setScaleMenu(null);
    setAttachmentMenu(null);
    setLoadError("");
    setSaveError("");
    setEditingId("");
    setSelectedDrawerId("");
    setDrawerMenu(null);
    updateDrawerList([]);
    listCategoryNoteDrawers(activeCategoryId)
      .then((items) => {
        if (cancelled) return;
        const normalized = items.map(normalizeDrawer);
        confirmedRef.current = new Map(normalized.map((item) => [item.id, item]));
        updateDrawerList(normalized);
        setLoadedAssetKey(assetKey);
      })
      .catch((error) => {
        if (cancelled) return;
        const message = String(error?.message || error);
        setLoadError(message);
        setLoadedAssetKey(assetKey);
        announce(message);
      });
    return () => { cancelled = true; };
  }, [activeCategoryId, assetKey]);

  useEffect(() => {
    if (loadedAssetKey !== assetKey) return;
    let next = drawersRef.current;
    const changed = [];
    for (const asset of assets) {
      const current = next.filter((drawer) => drawer.assetId === asset.id);
      if (!current.length) continue;
      const normalized = normalizeDrawerLayout(asset, current);
      const byId = new Map(normalized.map((drawer) => [drawer.id, drawer]));
      next = next.map((drawer) => {
        const repaired = byId.get(drawer.id);
        if (!repaired) return drawer;
        if (repaired.side === drawer.side &&
          Math.abs(repaired.offset - drawer.offset) < 0.01 &&
          repaired.width === drawer.width && repaired.height === drawer.height) return drawer;
        changed.push(repaired);
        return repaired;
      });
    }
    if (changed.length) {
      updateDrawerList(next);
    }
  }, [assetSizeKey, assetKey, loadedAssetKey]);

  useEffect(() => {
    if (editingId) textareaRef.current?.focus();
  }, [editingId]);

  useEffect(() => {
    const closeDrawerMenu = (event) => {
      if (!event.target.closest?.(".asset-note-drawer-context-menu")) setDrawerMenu(null);
      if (!event.target.closest?.(".asset-note-scale-panel, .asset-note-drawer-grip")) setScaleMenu(null);
      if (!event.target.closest?.(".asset-note-attachment-panel, .asset-note-attachment-title")) setAttachmentMenu(null);
    };
    document.addEventListener("pointerdown", closeDrawerMenu);
    return () => document.removeEventListener("pointerdown", closeDrawerMenu);
  }, []);

  if (!controllerRef.current) controllerRef.current = new DrawerDragController();
  controllerRef.current.configure({
    getWorldPoint: (event) => {
      const surface = surfaceRef.current;
      if (!surface) return { x: 0, y: 0 };
      return screenEventToWorld(event, surface.getBoundingClientRect(), viewportRef.current, Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ui-scale")) || 1);
    },
    getZoom: () => viewportRef.current.zoom,
    getUiScale: () => Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ui-scale")) || 1,
    debugMagnet: import.meta.env.DEV && new URLSearchParams(window.location.search).get("drawerSnapDebug") === "1",
    getAsset: (assetId) => assetsRef.current.find((asset) => asset.id === assetId),
    getDrawers: () => drawersRef.current,
    getAssets: () => visibleAssetsRef.current,
    onDraft: (drawer) => updateDrawerList((current) => current.map((item) => item.id === drawer.id ? { ...drawer, text: item.text } : item)),
    onCommit: () => {},
    onPreview: setPreview,
    onError: (error) => announce(error?.message || error),
  });

  useImperativeHandle(ref, () => ({
    flush: () => flushRef.current(),
    cancelInteraction: () => controllerRef.current?.finish(true),
    hasPendingChanges,
    hasActiveInteraction,
    autoSave,
    getVisibleRects() {
      return drawersRef.current.filter((drawer) => !drawer.assetId || visibleAssetIds.has(drawer.assetId))
        .map((drawer) => drawerVisibleRect(assetForDrawer(drawer), drawer));
    },
    async addIndependent(point) {
      if (loadedAssetKey !== assetKey || loadError) { announce("备注正在读取或读取失败，无法安全新增"); return; }
      const epoch = loadEpochRef.current;
      try {
        const created = await createIndependentNoteDrawer(activeCategoryId, point);
        if (epoch !== loadEpochRef.current) return;
        confirmedRef.current.set(created.id, created);
        updateDrawerList((current) => [...current, created]);
        setSelectedDrawerId(created.id); setEditingId(created.id);
      } catch (error) { announce(error?.message || error); }
    },
    async addForAsset(assetId) {
      const asset = assetsRef.current.find((item) => item.id === assetId);
      if (!asset) return;
      if (loadedAssetKey !== assetKey) {
        announce("正在读取备注抽屉，请稍后重试");
        return;
      }
      if (loadError) {
        announce("备注抽屉读取失败，无法安全新增");
        return;
      }
      if (creatingAssetIdsRef.current.has(assetId)) return;
      const existing = drawersRef.current.filter((drawer) => drawer.assetId === assetId);
      if (existing.length >= 3) {
        announce("最多允许 3 个备注抽屉");
        return;
      }
      const placement = createDefaultDrawerPlacement(asset, drawersRef.current);
      if (!placement) {
        announce("当前各边空间不足，请先移动或缩小现有抽屉");
        return;
      }
      creatingAssetIdsRef.current.add(assetId);
      const createEpoch = loadEpochRef.current;
      try {
        const created = await createAssetNoteDrawer(asset, placement);
        if (createEpoch !== loadEpochRef.current) return;
        confirmedRef.current.set(created.id, created);
        updateDrawerList((current) => [...current, created]);
      } catch (error) {
        announce(error?.message || error);
      } finally {
        creatingAssetIdsRef.current.delete(assetId);
      }
    },
  }), [assetKey, loadedAssetKey, loadError, displayAssets, groups]);

  const editDrawer = (id) => {
    const drawer = drawersRef.current.find((item) => item.id === id);
    if (drawer && isDrawerCollapsed(drawer)) {
      const expanded = { ...drawer, mode: "docked-expanded" };
      updateDrawerList((current) => current.map((item) => item.id === id ? expanded : item));
    }
    setSelectedDrawerId(id); setEditingId(id);
  };
  const changeText = (drawer, text) => {
    const updated = { ...(drawersRef.current.find((item) => item.id === drawer.id) || drawer), text };
    updateDrawerList((current) => current.map((item) => item.id === drawer.id ? updated : item));
  };
  const finishEdit = (drawer) => {
    setEditingId((currentId) => currentId === drawer.id ? "" : currentId);
  };
  const handleTextKeyDown = (event, drawer) => {
    if (event.key === "Escape" && !event.isComposing && !event.nativeEvent?.isComposing) {
      event.preventDefault();
      finishEdit(drawer);
    }
  };
  const handleResizeKeyDown = (event, drawer, corner) => {
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const asset = assetForDrawer(drawer);
    if (drawer.locked || isDrawerCollapsed(drawer) || attachmentBusyRef.current.has(drawer.id)) return;
    const deltaX = event.key === "ArrowRight" ? 10 : event.key === "ArrowLeft" ? -10 : 0;
    const deltaY = event.key === "ArrowDown" ? 10 : event.key === "ArrowUp" ? -10 : 0;
    const candidate = resizeDrawerByDelta(asset, drawer, corner, deltaX, deltaY);
    const resized = isDrawerDocked(candidate) ? resolveDrawerPlacement(asset, candidate, drawersRef.current, {
      preferredSide: candidate.side,
      allowFallbackSide: false,
    }) : candidate;
    if (!resized) {
      announce("该边空间不足，无法继续调整尺寸");
      return;
    }
    updateDrawerList((current) => current.map((item) => item.id === drawer.id ? resized : item));
  };
  const moveDrawerToSide = (drawer, side) => {
    const asset = assetsRef.current.find((item) => item.id === drawer.assetId);
    if (!asset || drawer.locked) return;
    const oldMax = maxDrawerOffset(asset, drawer);
    const newMax = maxDrawerOffset(asset, drawer, side);
    const ratio = oldMax > 0 ? drawer.offset / oldMax : 0.5;
    const placement = resolveDrawerPlacement(
      asset,
      { ...drawer, mode: isDrawerCollapsed(drawer) ? "docked-collapsed" : "docked-expanded", side, offset: ratio * newMax },
      drawersRef.current,
      { preferredSide: side, allowFallbackSide: false },
    );
    setDrawerMenu(null);
    if (!placement) {
      announce("该边空间不足，请先移动或缩小其他抽屉");
      return;
    }
    updateDrawerList((current) => current.map((item) => item.id === drawer.id ? placement : item));
  };
  const removeDrawer = async (drawer) => {
    if (!window.confirm("删除这个备注抽屉及其文字？")) return;
    deletingRef.current.add(drawer.id);
    try {
      await deleteAssetNoteDrawer(drawer);
      confirmedRef.current.delete(drawer.id);
      updateDrawerList((current) => current.filter((item) => item.id !== drawer.id));
      if (editingId === drawer.id) setEditingId("");
      if (selectedDrawerId === drawer.id) setSelectedDrawerId("");
      setDrawerMenu(null);
    } catch (error) {
      announce(error?.message || error);
    } finally {
      deletingRef.current.delete(drawer.id);
    }
  };
  const openContextMenu = (event, drawer) => {
    setSelectedDrawerId(drawer.id);
    event.preventDefault();
    event.stopPropagation();
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDrawerMenu({
      drawerId: drawer.id,
      x: clamp(event.clientX - rect.left, 8, Math.max(8, rect.width - 210)),
      y: clamp(event.clientY - rect.top, 8, Math.max(8, rect.height - 360)),
    });
  };
  const openScaleSettings = (event, drawer) => {
    const button = document.querySelector(`article[data-drawer-id="${CSS.escape(drawer.id)}"] .asset-note-drawer-grip`);
    const rect = button?.getBoundingClientRect();
    setDrawerMenu(null);
    setSelectedDrawerId(drawer.id);
    setScaleMenu({ drawerId: drawer.id,
      x: clamp((rect?.right ?? event.clientX) - 260, 8, Math.max(8, window.innerWidth - 268)),
      y: clamp((rect?.bottom ?? event.clientY) + 6, 8, Math.max(8, window.innerHeight - 170)) });
  };
  const closeAttachmentSettings = () => {
    const id = attachmentMenu?.drawerId;
    setAttachmentMenu(null);
    if (id) requestAnimationFrame(() => document.querySelector(`article[data-drawer-id="${CSS.escape(id)}"] .asset-note-attachment-title`)?.focus());
  };
  const openAttachmentSettings = (event, drawer) => {
    if (drawer.locked || attachmentBusyRef.current.has(drawer.id)) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setScaleMenu(null); setDrawerMenu(null); setSelectedDrawerId(drawer.id);
    setAttachmentMenu({ drawerId: drawer.id,
      x: clamp(rect.left, 8, Math.max(8, window.innerWidth - 308)),
      y: clamp(rect.bottom + 6, 8, Math.max(8, window.innerHeight - 340)) });
  };
  const chooseAttachment = async (assetId) => {
    let latest = drawersRef.current.find((item) => item.id === attachmentMenu?.drawerId);
    if (!latest || latest.locked || attachmentBusyRef.current.has(latest.id)) return;
    if ((latest.assetId ?? null) === assetId && (assetId === null || isDrawerDocked(latest))) { closeAttachmentSettings(); return; }
    if (editingId === latest.id && textareaRef.current) latest = { ...latest, text: textareaRef.current.value };
    let updated;
    if (!assetId) {
      const asset = assetForDrawer(latest);
      const rect = isDrawerDocked(latest) ? localDrawerRectToWorld(drawerWorldRect(asset, latest), asset) : drawerWorldRect(asset, latest);
      updated = { ...latest, assetId: null, categoryId: activeCategoryId, mode: "floating", floatingX: rect.left, floatingY: rect.top };
    } else {
      const asset = assetsRef.current.find((item) => item.id === assetId);
      if (!asset) { announce("附属资产不存在"); return; }
      if (drawersRef.current.filter((item) => item.assetId === assetId && item.id !== latest.id).length >= 3) { announce("该资产已有 3 个备注抽屉"); return; }
      updated = resolveDrawerPlacement(asset, { ...latest, assetId, categoryId: activeCategoryId, mode: "docked-expanded" }, drawersRef.current);
      if (!updated) { announce("目标资产各边空间不足，请先移动或缩小其他抽屉"); return; }
    }
    updateDrawerList((current) => current.map((item) => item.id === latest.id ? updated : item));
    setEditingId("");
    closeAttachmentSettings();
  };
  const changeScale = (id, percent) => {
    if (!Number.isFinite(percent)) return;
    const latest = drawersRef.current.find((item) => item.id === id);
    if (!latest) return;
    const updated = { ...latest, textScale: clamp(percent / 100, 0.5, 20) };
    updateDrawerList((current) => current.map((item) => item.id === id ? updated : item));
  };
  const toggleLock = (drawer) => {
    const updated = { ...drawer, locked: !drawer.locked };
    updateDrawerList((current) => current.map((item) => item.id === drawer.id ? updated : item));
    setDrawerMenu(null);
  };

  const toggleCollapsed = (drawer) => {
    let latest = drawersRef.current.find((item) => item.id === drawer.id) || drawer;
    if (editingId === latest.id && textareaRef.current) latest = { ...latest, text: textareaRef.current.value };
    if (!isDrawerDocked(latest) || controllerRef.current?.active || attachmentBusyRef.current.has(latest.id)) return;
    const updated = { ...latest, mode: isDrawerCollapsed(latest) ? "docked-expanded" : "docked-collapsed" };
    if (editingId === latest.id) setEditingId("");
    setSelectedDrawerId(latest.id);
    setDrawerMenu(null);
    updateDrawerList((current) => current.map((item) => item.id === latest.id ? updated : item));
  };

  const decorations = useMemo(() => Object.fromEntries(assets.map((asset) => {
    const attached = (drawersByAsset.get(asset.id) || []).map((drawer) => {
      if (preview?.drawerId !== drawer.id || preview.kind !== "move") return drawer;
      return preview.docked ? preview.placement || drawer : { ...drawer, mode: "floating" };
    });
    return [asset.id, assetDrawerDecoration(asset, attached)];
  })), [assets, drawersByAsset, preview]);
  useEffect(() => { onDecorationChange?.(decorations); }, [decorations, onDecorationChange]);

  const minimapItems = visibleDrawers.map(storedDrawer => {
    const asset = assetForDrawer(storedDrawer);
    const active = preview?.drawerId === storedDrawer.id ? preview : null;
    const drawer = active?.placement || storedDrawer;
    const rect = active?.rect || drawerVisibleRect(asset, drawer);
    const docked = active?.kind === "move" ? active.docked : isDrawerDocked(drawer);
    const points = docked && asset.rotation ? [{ x: rect.left, y: rect.top }, { x: rect.right, y: rect.top }, { x: rect.right, y: rect.bottom }, { x: rect.left, y: rect.bottom }].map(point => objectToWorld(point, { ...asset, height: asset.height + (asset.tags?.length ? 44 : 32) })) : null;
    return minimapPolygonItem({ id: `drawer:${drawer.id}`, kind: "note", x: rect.left, y: rect.top, width: rect.right - rect.left, height: rect.bottom - rect.top, zIndex: 200000 + (drawer.orderIndex || 0), selected: selectedDrawerId === drawer.id }, points);
  });
  const minimapKey = JSON.stringify(minimapItems);
  useEffect(() => { onMinimapItems?.(minimapItems); }, [minimapKey, onMinimapItems]);

  const renderedDrawers = visibleDrawers.map((storedDrawer) => {
    const asset = assetForDrawer(storedDrawer);
    const activePreview = preview?.drawerId === storedDrawer.id ? preview : null;
    const drawer = activePreview?.placement || storedDrawer;
    const docked = activePreview?.kind === "move" ? activePreview.docked : isDrawerDocked(drawer);
    const host = docked ? dockHosts?.get(asset.id) : null;
    if (docked && !host) return null;
    const worldRect = activePreview?.rect || drawerWorldRect(asset, drawer);
    const localize = (rect) => rect && ({ ...rect, left: rect.left - (docked ? asset.x : 0), top: rect.top - (docked ? asset.y : 0) });
    const content = (
    <AssetNoteDrawer
      key={drawer.id}
      drawer={drawer}
      assetName={drawer.assetId ? assetsRef.current.find((item) => item.id === drawer.assetId)?.name : ""}
      onAttachmentSettings={openAttachmentSettings}
      attachmentBusy={attachmentBusy.has(drawer.id)}
      rect={localize(worldRect)}
      handleRect={localize(drawerHandleRect(asset, drawer))}
      fromRect={localize(activePreview?.fromRect && !activePreview.fromRectLocal && docked ? worldDrawerRectToLocal(activePreview.fromRect,asset) : activePreview?.fromRect)}
      grab={activePreview?.grab}
      editing={editingId === drawer.id}
      dragging={preview?.drawerId === drawer.id && preview.kind === "move" && preview.dragging}
      resizing={preview?.drawerId === drawer.id && preview.resizing}
      resizeCorner={preview?.drawerId === drawer.id ? preview.corner : null}
      docked={docked}
      selected={selectedDrawerId === drawer.id}
      onSelect={setSelectedDrawerId}
      snapping={preview?.drawerId === drawer.id && preview.snapping}
      inverseZoom={1 / (viewport.zoom * uiScale)}
      textareaRef={editingId === drawer.id ? textareaRef : null}
      onMoveStart={(event, item) => { if (attachmentBusyRef.current.has(item.id)) return; setScaleMenu(null); setAttachmentMenu(null); controllerRef.current.beginMove(event, item); }}
      onResizeStart={(event, item, corner) => { if (!attachmentBusyRef.current.has(item.id)) controllerRef.current.beginResize(event, item, corner); }}
      onResizeKeyDown={handleResizeKeyDown}
      onEdit={editDrawer}
      onTextChange={changeText}
      onTextBlur={finishEdit}
      onTextKeyDown={handleTextKeyDown}
      onContextMenu={openContextMenu}
      onToggleCollapsed={toggleCollapsed}
      onScaleSettings={openScaleSettings}
    />
    );
    return docked ? createPortal(content, host, drawer.id) : content;
  });
  const portalContent = (
    <>
      {renderedDrawers}
      {preview?.dragging && !preview.docked && preview.targetRect && (
        <div className={`asset-note-drop-placeholder side-${preview.side}`} aria-hidden="true" data-target-asset-id={preview.assetId} style={{ left: preview.targetRect.left, top: preview.targetRect.top, width: preview.targetRect.width, height: preview.targetRect.height, transform:`rotate(${assetsRef.current.find(a=>a.id===preview.assetId)?.rotation || 0}deg)`,transformOrigin:`${(assetsRef.current.find(a=>a.id===preview.assetId)?.x || 0)+(assetsRef.current.find(a=>a.id===preview.assetId)?.width || 0)/2-preview.targetRect.left}px ${(assetsRef.current.find(a=>a.id===preview.assetId)?.y || 0)+(drawerAssetFrame(assetsRef.current.find(a=>a.id===preview.assetId)||{height:0}).height)/2-preview.targetRect.top}px`, zIndex: 199999 }} />
      )}
    </>
  );
  const attachmentDrawer = attachmentMenu ? drawerById.get(attachmentMenu.drawerId) : null;
  const scaleDrawer = scaleMenu ? drawerById.get(scaleMenu.drawerId) : null;
  const menuDrawer = drawerMenu ? drawerById.get(drawerMenu.drawerId) : null;

  useEffect(() => {
    const deselect = (event) => {
      if (!event.target.closest?.(".asset-note-drawer, .asset-note-drawer-handle,  .asset-note-drawer-context-menu, .asset-note-scale-panel, .asset-note-attachment-panel")) setSelectedDrawerId("");
    };
    const escape = (event) => {
      if (event.key === "Escape") { setScaleMenu(null); setAttachmentMenu(null); }
      if (event.key === "Escape" && !event.defaultPrevented && !editingId && !controllerRef.current?.active) setSelectedDrawerId("");
    };
    document.addEventListener("pointerdown", deselect, true);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", deselect, true); document.removeEventListener("keydown", escape); };
  }, [editingId]);
  useEffect(() => () => {
    controllerRef.current?.dispose();
    clearTimeout(noticeTimerRef.current);
  }, []);

  return (
    <>
      {createPortal(portalContent, portalRef.current)}
      {menuDrawer && drawerMenu && (
        <div
          className="canvas-context-menu asset-note-drawer-context-menu"
          style={{ left: drawerMenu.x, top: drawerMenu.y }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button onClick={() => { editDrawer(menuDrawer.id); setDrawerMenu(null); }}>编辑备注</button>
          {isDrawerDocked(menuDrawer) && <button onClick={() => toggleCollapsed(menuDrawer)}>{isDrawerCollapsed(menuDrawer) ? "展开备注" : "收起备注"}</button>}
          <button className="danger" onClick={() => removeDrawer(menuDrawer)}>删除备注</button>
          <hr />
          <button onClick={() => toggleLock(menuDrawer)}>
            {menuDrawer.locked ? <Unlock size={14} /> : <Lock size={14} />}
            {menuDrawer.locked ? "解锁备注" : "锁定备注"}
          </button>
          <hr />
          <button disabled={menuDrawer.locked || !menuDrawer.assetId || attachmentBusy.has(menuDrawer.id)} onClick={() => moveDrawerToSide(menuDrawer, "left")}>移到左侧</button>
          <button disabled={menuDrawer.locked || !menuDrawer.assetId || attachmentBusy.has(menuDrawer.id)} onClick={() => moveDrawerToSide(menuDrawer, "right")}>移到右侧</button>
          <button disabled={menuDrawer.locked || !menuDrawer.assetId || attachmentBusy.has(menuDrawer.id)} onClick={() => moveDrawerToSide(menuDrawer, "top")}>移到顶部</button>
          <button disabled={menuDrawer.locked || !menuDrawer.assetId || attachmentBusy.has(menuDrawer.id)} onClick={() => moveDrawerToSide(menuDrawer, "bottom")}>移到底部</button>
        </div>
      )}
      {attachmentDrawer && attachmentMenu && createPortal(
        <DrawerAttachmentPanel key={attachmentDrawer.id} drawer={attachmentDrawer} assets={assets}
          position={attachmentMenu} busy={attachmentBusy.has(attachmentDrawer.id)} onChoose={chooseAttachment} onClose={closeAttachmentSettings} />, document.body)}
      {scaleDrawer && scaleMenu && createPortal(
        <DrawerScalePanel key={scaleDrawer.id} drawer={scaleDrawer} position={scaleMenu} onChange={changeScale} onClose={() => setScaleMenu(null)} />, document.body)}
      {notice && <output className="asset-note-drawer-notice" role="status">{notice}</output>}
      {saveError && <div className="asset-note-drawer-notice" role="alert" style={{ pointerEvents: "auto" }} onPointerDown={event => event.stopPropagation()}><span>备注尚未保存：{saveError}</span><button type="button" onClick={() => flushRef.current().catch(() => {})}>重试保存</button></div>}
    </>
  );
});
