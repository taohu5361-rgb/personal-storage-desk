// Development-only fixture: renders the real canvas and mocks only Tauri IPC.
// Its isolated browser storage never opens the user's SQLite database.
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { mockIPC } from "@tauri-apps/api/mocks";
import { invoke } from "@tauri-apps/api/core";
import { AssetCanvas } from "../src/components/AssetCanvas.jsx";
import "../src/styles.css";
import "../src/theme.css";

const storageKey = "drawer-three-state-qa";
const sides = ["left", "right", "top", "bottom"];
const preview = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="#e5e5e5"/><rect x="12" y="12" width="232" height="276" fill="#f7f7f7"/><rect x="256" y="12" width="132" height="132" fill="#f7f7f7"/><rect x="256" y="156" width="132" height="132" fill="#f7f7f7"/><path d="M65 210L125 115L190 210Z" fill="#bbb"/><circle cx="325" cy="77" r="33" fill="#bbb"/><rect x="296" y="190" width="60" height="60" fill="#bbb"/></svg>')}`;
const initialAssets = sides.map((side, i) => ({
  id: `asset-${side}`, name: `图片 · ${side}`, categoryId: "qa", workspaceId: "qa",
  x: i % 2 ? 1030 : 360, y: i < 2 ? 240 : 690, width: 400, height: 300,
  tags: [], previewUrl: preview, zIndex: i, locked: false,
}));
const initialDrawers = sides.map((side, i) => ({
  id: `drawer-${side}`, assetId: `asset-${side}`, text: `${side} 边备注\n这段文字属于旁边的图片。`,
  mode: "docked-expanded", side, offset: side === "left" || side === "right" ? 75 : 80,
  width: 240, height: 150, floatingX: 0, floatingY: 0, orderIndex: 0,
  locked: false, styleVariant: "default", createdAt: 1, updatedAt: 1,
}));
let stored = JSON.parse(localStorage.getItem(storageKey) || "null") || initialDrawers;
const saveStored = () => localStorage.setItem(storageKey, JSON.stringify(stored));
const qa = window.drawerQA = { saveDelay: 0, failNext: false, calls: [], opens: 0, getStored: () => structuredClone(stored) };
qa.readNative = () => invoke("list_asset_note_drawers", { assetIds: initialAssets.map((asset) => asset.id) });
if (!new URLSearchParams(window.location.search).has("native")) mockIPC(async (command, args) => {
  qa.calls.push({ command, args: structuredClone(args) });
  if (command === "list_asset_note_drawers") return structuredClone(stored.filter((drawer) => args.assetIds.includes(drawer.assetId)));
  if (command === "save_asset_note_drawer") {
    const submitted = structuredClone(args.drawer);
    const fail = qa.failNext; qa.failNext = false;
    if (qa.saveDelay) await new Promise((resolve) => setTimeout(resolve, qa.saveDelay));
    if (fail) throw new Error("隔离验收：模拟保存失败");
    stored = stored.map((drawer) => drawer.id === submitted.id ? submitted : drawer);
    saveStored(); return submitted;
  }
  if (command === "create_asset_note_drawer") { stored = [...stored, args.drawer]; saveStored(); return args.drawer; }
  if (command === "delete_asset_note_drawer") { stored = stored.filter((drawer) => drawer.id !== args.id); saveStored(); return; }
  throw new Error(`Unexpected QA command: ${command}`);
});

document.documentElement.dataset.theme = "dark";
document.documentElement.dataset.effectiveTheme = "dark";
document.documentElement.style.setProperty("--ui-scale", "1");
const fixtureStyle = document.createElement("style");
fixtureStyle.textContent = "html,body,#root{width:100%;height:100%;margin:0}.qa-shell{width:100%;height:100%;position:relative}.qa-shell>.asset-canvas{height:100%;border:0;border-radius:0}";
document.head.appendChild(fixtureStyle);
function Fixture() {
  const [assets, setAssets] = useState(initialAssets);
  const [category, setCategory] = useState({ id: "qa", viewportX: 0, viewportY: 0, zoom: 1, canvasColor: "#f7f7f7", canvasPattern: "dots" });
  const [generation, setGeneration] = useState(0);
  const canvasRef = useRef(null);
  useEffect(() => {
    qa.setZoom = (zoom) => setCategory((current) => ({ ...current, zoom }));
    qa.getAssets = () => assets;
    qa.moveAsset = (id, dx, dy) => setAssets((current) => current.map((asset) => asset.id === id ? { ...asset, x: asset.x + dx, y: asset.y + dy } : asset));
    qa.resizeAsset = (id, width) => setAssets((current) => current.map((asset) => asset.id === id ? { ...asset, width, height: width * 0.75 } : asset));
    qa.seed = (drawers) => { stored = structuredClone(drawers); saveStored(); setGeneration((value) => value + 1); };
    qa.reset = () => { stored = structuredClone(initialDrawers); saveStored(); setAssets(initialAssets); setCategory((current) => ({ ...current, zoom: 1, viewportX: 0, viewportY: 0 })); setGeneration((value) => value + 1); };
    qa.fitAll = () => canvasRef.current.fitAll();
    qa.getViewport = () => category;
  }, [assets, category]);
  return <div className="qa-shell"><AssetCanvas
    key={generation} ref={canvasRef} assets={assets} activeCategory={category} search="" categories={[]}
    settings={{ assetNameDisplay: "always", showImageShadow: true, showSelectionBorder: true, showAssetTags: true, autoSave: true, canvasBackground: "dots" }}
    onAssetsChange={setAssets} onViewportChange={(next) => setCategory((current) => ({ ...current, ...next }))}
    onAssetsCommit={() => {}} onOpen={() => { qa.opens += 1; }} onImageMetrics={() => {}}
  /></div>;
}
createRoot(document.getElementById("root")).render(<Fixture />);
