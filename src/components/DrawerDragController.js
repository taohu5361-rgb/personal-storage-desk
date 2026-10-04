import {
  drawerWorldRect,
  projectPointOnSide,
  resolveDrawerPlacement,
  resizeDrawerByDelta,
  isDrawerDocked,
  isDrawerCollapsed,
} from "./DrawerLayoutEngine.js";
import { objectToWorld, worldToObject, boundsOf, intersectsRotated } from './canvasTransforms.js';

export const drawerAssetFrame=asset=>({...asset,height:asset.height+(asset.tags?.length?44:32)});
export function localDrawerRectToWorld(rect,asset) {
  const center=objectToWorld({x:rect.left+rect.width/2,y:rect.top+rect.height/2},drawerAssetFrame(asset));
  return {...rect,left:center.x-rect.width/2,top:center.y-rect.height/2};
}
export function worldDrawerRectToLocal(rect,asset) {
  const center=worldToObject({x:rect.left+rect.width/2,y:rect.top+rect.height/2},drawerAssetFrame(asset));
  return {...rect,left:center.x-rect.width/2,top:center.y-rect.height/2};
}

// Magnetic geometry uses world pixels; canvas and UI scales are undone only at input.
export const DRAWER_MAGNET = Object.freeze({ attachDistance: 120, detachDistance: 60 });
const vertical = (side) => side === "left" || side === "right";

export function screenEventToWorld(event, rect, viewport, uiScale = 1) {
  const zoom = viewport?.zoom > 0 ? viewport.zoom : 1;
  const scale = Number.isFinite(uiScale) && uiScale > 0 ? uiScale : 1;
  return {
    x: ((event.clientX - rect.left) / scale - (viewport?.x || 0)) / zoom,
    y: ((event.clientY - rect.top) / scale - (viewport?.y || 0)) / zoom,
  };
}

// Four disjoint exterior strips. The asset body and all diagonal corners are empty.
export function hitDrawerSnapZone(center, asset, attachDistance = DRAWER_MAGNET.attachDistance, noteSize = {}) {
  // Only absorb coordinate-conversion rounding at the closed outer boundary.
  const horizontalDistance = attachDistance + (noteSize.width || 0) / 2 + 1e-9;
  const verticalDistance = attachDistance + (noteSize.height || 0) / 2 + 1e-9;
  const left = asset.x, right = asset.x + asset.width;
  const top = asset.y, bottom = asset.y + asset.height;
  if (center.x >= left && center.x <= right) {
    if (center.y >= top - verticalDistance && center.y < top) return "top";
    if (center.y > bottom && center.y <= bottom + verticalDistance) return "bottom";
  }
  if (center.y >= top && center.y <= bottom) {
    if (center.x >= left - horizontalDistance && center.x < left) return "left";
    if (center.x > right && center.x <= right + horizontalDistance) return "right";
  }
  return null;
}

export function drawerRectCenter(rect) {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

export function drawerVisualRect(rect, grab, scale = 1.02) {
  return { left: rect.left + (1 - scale) * grab.x, top: rect.top + (1 - scale) * grab.y,
    width: rect.width * scale, height: rect.height * scale };
}

export function overlapsAsset(rect, asset) {
  return rect.left < asset.x + asset.width && rect.left + rect.width > asset.x
    && rect.top < asset.y + asset.height && rect.top + rect.height > asset.y;
}

export function outwardPull(side, dx, dy) {
  return side === "left" ? -dx : side === "right" ? dx : side === "top" ? -dy : dy;
}

export function findDrawerSnapTarget(rect, grab, drawer, assets, existing, attachDistance = DRAWER_MAGNET.attachDistance) {
  const candidates = [], blocked = [];
  const visual = drawerVisualRect(rect, grab);
  for (const asset of assets) {
    const center = worldToObject(drawerRectCenter(rect), drawerAssetFrame(asset));
    const localRect = worldDrawerRectToLocal(rect, asset);
    const localBounds = boundsOf({ x: localRect.left, y: localRect.top, width: localRect.width, height: localRect.height, rotation: -(asset.rotation || 0) });
    const imageCenter = objectToWorld({ x: asset.x + asset.width / 2, y: asset.y + asset.height / 2 }, drawerAssetFrame(asset));
    if (intersectsRotated({ left: visual.left, top: visual.top, right: visual.left + visual.width, bottom: visual.top + visual.height }, { ...asset, x: imageCenter.x - asset.width / 2, y: imageCenter.y - asset.height / 2 })) continue;
    const side = hitDrawerSnapZone(center, asset, attachDistance, { width: localBounds.right - localBounds.left, height: localBounds.bottom - localBounds.top });
    if (!side) continue;
    const targetDrawers = existing.filter((item) => item.assetId === asset.id && item.id !== drawer.id);
    if (targetDrawers.length >= 3) { blocked.push({ assetId: asset.id, reason: "该资产已有 3 个备注抽屉" }); continue; }
    const placement = resolveDrawerPlacement(asset, {
      ...drawer, assetId: asset.id, categoryId: asset.categoryId ?? drawer.categoryId, mode: "docked-expanded", side,
      offset: projectPointOnSide(center, asset, side) - (vertical(side) ? drawer.height : drawer.width) / 2,
    }, existing, { preferredSide: side, allowFallbackSide: false });
    if (!placement) { blocked.push({ assetId: asset.id, reason: "目标边空间不足" }); continue; }
    const gap = side === "left" ? asset.x - localBounds.right : side === "right" ? localBounds.left - asset.x - asset.width
      : side === "top" ? asset.y - localBounds.bottom : localBounds.top - asset.y - asset.height;
    candidates.push({ asset, placement, distance: Math.max(0, gap) });
  }
  candidates.sort((a, b) => a.distance - b.distance || (b.asset.zIndex || 0) - (a.asset.zIndex || 0) || a.asset.id.localeCompare(b.asset.id));
  return { candidate: candidates[0] || null, blocked: candidates.length ? null : blocked[0] || null };
}

export class DrawerDragController {
  constructor(options = {}) {
    this.options = options;
    this.active = null;
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handleCancel = () => this.finish(true);
    this.handleKeyDown = (event) => {
      if (event.key === "Escape") this.finish(true);
    };
  }

  configure(options) { this.options = options; }
  beginMove(event, drawer) { this.begin(event, drawer, "move"); }
  beginResize(event, drawer, corner) { this.begin(event, drawer, "resize", corner); }

  begin(event, drawer, kind, corner) {
    event.stopPropagation();
    if (event.button !== 0 || drawer.locked || isDrawerCollapsed(drawer)) return;
    event.preventDefault();
    const asset = this.options.getAsset(drawer.assetId);
    if (!asset && isDrawerDocked(drawer)) return;
    if (this.active) this.finish(true);
    clearTimeout(this.settleTimer);
    this.options.onPreview?.(null);
    const worldPoint=this.options.getWorldPoint(event);
    const point=isDrawerDocked(drawer)?worldToObject(worldPoint,drawerAssetFrame(asset)):worldPoint;
    const rect = drawerWorldRect(asset, drawer);
    this.active = {
      kind, corner, assetId: drawer.assetId, drawerId: drawer.id,
      initial: { ...drawer }, last: { ...drawer }, dockedPlacement: { ...drawer }, snapTarget: null, hitZone: null,
      startPoint: point, startRect: rect, floatingRect: rect,
      grab: { x: point.x - rect.left, y: point.y - rect.top },
      startX: event.clientX, startY: event.clientY, pointerId: event.pointerId,
      didMove: false, docked: isDrawerDocked(drawer),
      freeOrigin: isDrawerDocked(drawer) ? null : { point, rect },
    };
    window.addEventListener("pointermove", this.handlePointerMove, { passive: false });
    window.addEventListener("pointerup", this.handlePointerUp);
    window.addEventListener("pointercancel", this.handlePointerUp);
    window.addEventListener("blur", this.handleCancel);
    window.addEventListener("keydown", this.handleKeyDown);
  }

  placement(asset, active, point, side, existing) {
    if (!side) return null;
    return resolveDrawerPlacement(asset, {
      ...active.initial, side, mode: "docked-expanded",
      offset: projectPointOnSide(point, asset, side) - (vertical(side) ? active.grab.y : active.grab.x),
    }, existing, { preferredSide: side, allowFallbackSide: false });
  }

  handlePointerMove(event) {
    const active = this.active;
    if (!active || event.pointerId !== active.pointerId) return;
    if (!active.didMove && Math.hypot(event.clientX - active.startX, event.clientY - active.startY) < 5) return;
    active.didMove = true;
    event.preventDefault();
    const asset = this.options.getAsset(active.assetId);
    if (!asset && active.docked) { this.finish(true); return; }
    const worldPoint=this.options.getWorldPoint(event);
    const point=active.docked?worldToObject(worldPoint,drawerAssetFrame(asset)):worldPoint;
    const dx = point.x - active.startPoint.x;
    const dy = point.y - active.startPoint.y;
    const existing = this.options.getDrawers().filter((drawer) => drawer.assetId === active.assetId);

    if (active.kind === "resize") {
      const candidate = resizeDrawerByDelta(asset, active.initial, active.corner, dx, dy);
      const next = isDrawerDocked(candidate) ? resolveDrawerPlacement(asset, candidate, existing, { preferredSide: candidate.side, allowFallbackSide: false }) : candidate;
      if (next) {
        active.resizeBlocked = false;
        active.last = next;
        this.options.onDraft?.(next);
        this.options.onPreview?.({ assetId: active.assetId, drawerId: active.drawerId, kind: active.kind, resizing: true, corner: active.corner });
      } else if (!active.resizeBlocked) {
        active.resizeBlocked = true;
        this.options.onError?.("该边空间不足，无法继续调整尺寸");
      }
      return;
    }

    const tuning = { ...DRAWER_MAGNET, ...this.options.magnet };
    if (active.docked) {
      if (outwardPull(active.initial.side, dx, dy) >= tuning.detachDistance) {
        active.docked = false;
        // Rebase at the exact threshold crossing, without a jump in card position.
        const ratio = Math.min(1, tuning.detachDistance / outwardPull(active.initial.side, dx, dy));
        const crossing = { x: active.startPoint.x + dx * ratio, y: active.startPoint.y + dy * ratio };
        const placement = this.placement(asset, active, crossing, active.initial.side, existing) || active.dockedPlacement;
        const freePoint=objectToWorld(crossing,drawerAssetFrame(asset)),freeRect=localDrawerRectToWorld(drawerWorldRect(asset,placement),asset);
        active.freeOrigin={point:freePoint,rect:freeRect};active.grab={x:worldPoint.x-freeRect.left,y:worldPoint.y-freeRect.top};
      } else {
        active.dockedPlacement = this.placement(asset, active, point, active.initial.side, existing) || active.dockedPlacement;
        active.floatingRect = drawerWorldRect(asset, active.dockedPlacement);
      }
    }
    if (!active.docked) {
      const origin = active.freeOrigin;
      active.floatingRect = {
        ...origin.rect,
        left: origin.rect.left + worldPoint.x - origin.point.x,
        top: origin.rect.top + worldPoint.y - origin.point.y,
      };
    }
    // Compute the actual visible card's logical center AFTER updating its position.
    const center = active.docked?drawerRectCenter(active.floatingRect):asset ? worldToObject(drawerRectCenter(active.floatingRect),drawerAssetFrame(asset)) : drawerRectCenter(active.floatingRect);
    if (!active.docked && this.options.getAssets) {
      const { candidate, blocked } = findDrawerSnapTarget(active.floatingRect, active.grab, active.initial, this.options.getAssets(), this.options.getDrawers(), tuning.attachDistance);
      active.snapTarget = candidate?.placement || null;
      active.hitZone = candidate?.placement.side || null;
      active.snapAsset = candidate?.asset || null;
      active.blockedTarget = blocked;
      this.options.onPreview?.({ assetId: candidate?.asset.id || active.assetId, drawerId: active.drawerId, kind: "move", dragging: true,
        docked: false, rect: active.floatingRect, grab: active.grab, side: candidate?.placement.side,
        targetRect: candidate ? drawerWorldRect(candidate.asset, candidate.placement) : null,
        targetName: candidate?.asset.name, blockedReason: blocked?.reason });
      return;
    }
    const localRect=active.docked?active.floatingRect:worldDrawerRectToLocal(active.floatingRect,asset);
    const localBounds=boundsOf({x:localRect.left,y:localRect.top,width:localRect.width,height:localRect.height,rotation:-(asset.rotation||0)});
    const imageCenter=objectToWorld({x:asset.x+asset.width/2,y:asset.y+asset.height/2},drawerAssetFrame(asset));
    const visual=drawerVisualRect(active.floatingRect,active.grab);
    active.overlapBlocked=active.docked?overlapsAsset(visual,asset):intersectsRotated({left:visual.left,top:visual.top,right:visual.left+visual.width,bottom:visual.top+visual.height},{...asset,x:imageCenter.x-asset.width/2,y:imageCenter.y-asset.height/2});
    active.hitZone=active.overlapBlocked?null:hitDrawerSnapZone(center,asset,tuning.attachDistance,{width:localBounds.right-localBounds.left,height:localBounds.bottom-localBounds.top});
    active.snapTarget = !active.docked && active.hitZone ? resolveDrawerPlacement(asset, {
      ...active.initial, mode: "docked-expanded",
      side: active.hitZone,
      offset: projectPointOnSide(center, asset, active.hitZone) - (vertical(active.hitZone) ? active.initial.height : active.initial.width) / 2,
    }, existing, { preferredSide: active.hitZone, allowFallbackSide: false }) : null;
    this.logSnapDebug(active, asset, "move");
    this.options.onPreview?.({
      assetId: active.assetId, drawerId: active.drawerId, kind: "move", dragging: true,
      docked: active.docked, rect: active.floatingRect, grab: active.grab,
      placement: active.docked ? active.dockedPlacement : null,
      side: active.snapTarget?.side,
      targetRect: active.snapTarget ? drawerWorldRect(asset, active.snapTarget) : null,
    });
  }

  logSnapDebug(active, asset, phase) {
    if (!import.meta.env?.DEV || !this.options.debugMagnet || active.kind !== "move") return;
    const now = performance.now();
    const state = [active.docked, active.hitZone, active.snapTarget?.side, active.overlapBlocked].join(":");
    if (phase === "move" && state === active.debugState && now - active.debugTime < 100) return;
    active.debugState = state;
    active.debugTime = now;
    console.debug("[drawer-snap]", {
      phase,
      assetRectWorld: { left: asset.x, right: asset.x + asset.width, top: asset.y, bottom: asset.y + asset.height },
      noteCenterWorld: drawerRectCenter(active.floatingRect),
      zoom: this.options.getZoom?.() || 1,
      uiScale: this.options.getUiScale?.() || 1,
      noteSizeWorld: { width: active.floatingRect.width, height: active.floatingRect.height },
      edgeGapsWorld: {
        left: asset.x - active.floatingRect.left - active.floatingRect.width,
        right: active.floatingRect.left - asset.x - asset.width,
        top: asset.y - active.floatingRect.top - active.floatingRect.height,
        bottom: active.floatingRect.top - asset.y - asset.height,
      },
      blockedReason: active.overlapBlocked ? "asset-overlap" : active.docked ? "docked"
        : !active.hitZone ? "outside-zone" : !active.snapTarget ? "edge-full" : null,
      hitZone: active.hitZone || "none",
      attachDistance: this.options.magnet?.attachDistance ?? DRAWER_MAGNET.attachDistance,
      selectedSnapSide: active.snapTarget?.side || "none",
      state: active.docked ? "docked" : "free",
    });
  }

  handlePointerUp(event) {
    if (!this.active || event.pointerId !== this.active.pointerId) return;
    if (event.type !== "pointercancel") this.handlePointerMove(event);
    this.finish(event.type === "pointercancel");
  }

  finish(cancelled) {
    const active = this.active;
    if (!active) return;
    const asset = this.options.getAsset(active.assetId);
    if (asset) this.logSnapDebug(active, asset, cancelled ? "cancel" : "release");
    this.active = null;
    window.removeEventListener("pointermove", this.handlePointerMove);
    window.removeEventListener("pointerup", this.handlePointerUp);
    window.removeEventListener("pointercancel", this.handlePointerUp);
    window.removeEventListener("blur", this.handleCancel);
    window.removeEventListener("keydown", this.handleKeyDown);
    if (!active.didMove) { this.options.onPreview?.(null); return; }
    const destination = cancelled ? active.initial : active.kind === "move"
      ? (active.docked ? active.dockedPlacement : active.snapTarget || {
        ...active.initial, mode: "floating", floatingX: active.floatingRect.left, floatingY: active.floatingRect.top,
      })
      : active.last;
    this.options.onDraft?.(destination);
    if (!cancelled) {
      if (active.blockedTarget && !active.snapTarget) this.options.onError?.(active.blockedTarget.reason);
      this.options.onCommit?.(destination, active.initial)?.catch?.((error) => this.options.onError?.(error));
    }
    if (active.kind === "move" && (cancelled || active.docked || active.snapTarget)) {
      this.options.onPreview?.({ assetId: destination.assetId, drawerId: active.drawerId, snapping: true, fromRect: active.floatingRect, fromRectLocal:active.docked, grab: active.grab });
      this.settleTimer = setTimeout(() => this.options.onPreview?.(null), 230);
    } else this.options.onPreview?.(null);
  }

  dispose() {
    this.finish(true);
    clearTimeout(this.settleTimer);
  }
}
