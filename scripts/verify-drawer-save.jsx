// Real note owner with in-memory IPC. This fixture has no native/filesystem path.
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { mockIPC } from '@tauri-apps/api/mocks';
import { AssetNoteDrawerLayer } from '../src/components/AssetNoteDrawerLayer.jsx';
import '../src/theme.css';
import '../src/styles.css';

const assets = [{ id: 'a1', name: '参考一', categoryId: 'notes', x: 80, y: 180, width: 220, height: 160, rotation: 0, tags: [] }, { id: 'a2', name: '参考二', categoryId: 'notes', x: 450, y: 180, width: 220, height: 160, rotation: 0, tags: [] }];
let stored = [{ id: 'n1', assetId: null, categoryId: 'notes', text: '已保存的原备注', mode: 'floating', side: 'right', offset: 0, floatingX: 800, floatingY: 260, width: 240, height: 150, orderIndex: 0, locked: false, textScale: 1, styleVariant: 'default', createdAt: 1, updatedAt: 1 }];
const qa = window.noteSaveQA = { calls: [], fail: false, hold: false, getStored: () => structuredClone(stored) };
mockIPC(async (command, args = {}) => {
  qa.calls.push({ command, args: structuredClone(args) });
  if (command === 'list_category_note_drawers') return structuredClone(stored.filter(note => note.categoryId === args.categoryId));
  if (command === 'save_asset_note_drawer' || command === 'transfer_asset_note_drawer') {
    const submitted = structuredClone(args.drawer);
    if (qa.hold) await new Promise(resolve => { qa.release = resolve; });
    if (qa.fail) { qa.fail = false; throw new Error('隔离测试：备注保存失败'); }
    if (command === 'transfer_asset_note_drawer' && (stored.find(note => note.id === submitted.id)?.assetId ?? null) !== args.expectedAssetId) throw new Error('附属资产已经变化');
    stored = stored.map(note => note.id === submitted.id ? submitted : note);
    return submitted;
  }
  if (command === 'create_asset_note_drawer') { stored.push(structuredClone(args.drawer)); return structuredClone(args.drawer); }
  if (command === 'delete_asset_note_drawer') { stored = stored.filter(note => note.id !== args.id); return true; }
  throw new Error(`未实现的备注隔离 IPC：${command}`);
});
document.documentElement.dataset.effectiveTheme = 'dark';
document.documentElement.style.setProperty('--ui-scale', '1');
const style = document.createElement('style');
style.textContent = 'html,body,#root{width:100%;height:100%;margin:0}.note-save-fixture{width:100%;height:100%;position:relative;background:var(--bg-canvas)}.note-save-world{position:absolute;inset:0}.note-save-asset{position:absolute;border:1px solid var(--border-default);background:var(--bg-surface)}.note-save-fixture>button{position:absolute;top:12px;left:12px;z-index:300000}';
document.head.appendChild(style);
function Fixture() {
  const surfaceRef = useRef(null), worldRef = useRef(null), layerRef = useRef(null), dockHosts = useRef(new Map());
  const [settings, setSettings] = useState({ autoSave: true, autoSaveInterval: 60 });
  const [mounted, setMounted] = useState(true);
  useEffect(() => {
    qa.mode = autoSave => setSettings(current => ({ ...current, autoSave }));
    qa.status = () => ({ dirty: !!layerRef.current?.hasPendingChanges(), active: !!layerRef.current?.hasActiveInteraction() });
    qa.tick = () => layerRef.current?.autoSave();
    qa.flush = () => layerRef.current?.flush();
    qa.cancel = () => layerRef.current?.cancelInteraction();
    qa.startTick = () => { qa.tickPromise = qa.tick(); qa.tickPromise?.catch(() => {}); };
    qa.resume = () => { qa.hold = false; qa.release?.(); };
    qa.waitTick = () => qa.tickPromise;
    qa.leave = async () => {
      const detail = { promises: [] };
      window.dispatchEvent(new CustomEvent('asset-text-before-leave', { detail }));
      try { await Promise.all(detail.promises); return { accepted: true }; }
      catch (error) { return { accepted: false, error: String(error.message) }; }
    };
    qa.add = () => layerRef.current?.addIndependent({ x: 720, y: 550 });
    qa.mount = setMounted;
  }, []);
  return <div className="note-save-fixture" ref={surfaceRef}>
    <button type="button" onClick={() => layerRef.current?.flush().catch(() => {})}>手动保存备注</button>
    <div className="note-save-world" ref={worldRef}>{assets.map(asset => <div key={asset.id} className="note-save-asset" style={{ left: asset.x, top: asset.y, width: asset.width, height: asset.height }}><span>{asset.name}</span><div className="asset-note-dock-host" ref={node => { if (node) dockHosts.current.set(asset.id, node); else dockHosts.current.delete(asset.id); }} /></div>)}</div>
    {mounted && <AssetNoteDrawerLayer ref={layerRef} assets={assets} displayAssets={assets} activeCategoryId="notes" viewport={{ x: 0, y: 0, zoom: 1 }} surfaceRef={surfaceRef} worldRef={worldRef} dockHosts={dockHosts.current} settings={settings} />}
  </div>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
