import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { call, fileUrl, id } from "../data/database";
import { AssetCanvas } from "../components/AssetCanvas";
import { AssetInnerCanvas } from "../components/AssetInnerCanvas";
import { resolveCanvasAppearance } from "../canvasAppearance";
import { AssetStandardTextLayer } from "../components/AssetStandardTextLayer";
import { useAssetTextController } from "../hooks/useAssetTextController";
import { projectTextItems } from "../data/assetTextModel";
import { AssetSidebar } from "../components/AssetSidebar";
import { SidebarToggle } from "../components/SidebarToggle";
import { useSidebarPreference } from "../hooks/useSidebarPreference";
import { useResizablePanel } from "../hooks/useResizablePanel";
import { PanelSplitter } from "../components/ui/PanelSplitter";
import { flushBeforeNavigation } from "../hooks/useHashRoute";
import { createPersistenceQueue } from "../data/persistenceQueue";
import { createLatestValueSave } from "../data/latestValueSave";
import { pasteAssetClipboard } from "../data/assetClipboard";
import { PopupMenu } from "../components/ui/PopupMenu";
import { AssetDialog, ModelDialog, WorkspaceDeleteConfirm, CategoryDialog, ScriptDialog } from "../components/EntityDialogs";
import { Dialog, Confirm, Empty, Field, promptTypeLabel, PromptReadOnly } from "../components/ui/Primitives";
import { now, readImageRatio, initialImageSize, withUrls } from "./pageUtils";
import {
  ArrowRight,
  Check,
  Database,
  FileBox,
  FolderCode,
  Image,
  ImagePlus,
  Layers3,
  MoreHorizontal,
  StickyNote,
  Pencil,
  Play,
  Plus,
  Save,
  Settings as SettingsIcon,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";

export function Assets({ store, workspaceId, initialCategoryId, go, registerShortcutActions, assetClipboardRef }) {
  const { data, setData, run:storeRun, reload } = store;
  const run = async (command,args) => {
    if (!await flushBeforeNavigation()) throw Error('当前画布还有未保存的修改，请先重试保存。');
    return storeRun(command,args);
  };
  const [clipboardNotice,setClipboardNotice] = useState('');
  const sidebar = useSidebarPreference("assets");
  const workspaceRef = useRef(null);
  const sidebarPanel = useResizablePanel({
    storageKey: "creative-cloth.panel-size.sidebar.assets", defaultSize: 224,
    minSize: 176, maxSize: 420, minContentSize: 360,
    axis: "x", direction: 1, containerRef: workspaceRef,
  });
  const sidebarSearchRef = useRef(null);
  const [searchFocusRequest, setSearchFocusRequest] = useState(0);
  const workspace = data.workspaces.find((x) => x.id === workspaceId);
  const categories = data.categories.filter(
    (x) => x.workspaceId === workspaceId,
  );
  const [active, setActive] = useState(initialCategoryId);
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState("");
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingAsset, setEditingAsset] = useState(null);
  const [menuCategoryId, setMenuCategoryId] = useState("");
  const toggleSidebar = () => {
    setMenuCategoryId("");
    sidebar.toggle();
  };
  useEffect(() => {
    if (!searchFocusRequest || !sidebar.expanded) return;
    sidebarSearchRef.current?.focus();
    sidebarSearchRef.current?.select();
    setSearchFocusRequest(0);
  }, [searchFocusRequest, sidebar.expanded]);
  const [pending, setPending] = useState(null);
  const canvas = useRef();
  const [noteMenu,setNoteMenu] = useState(null);
  const latestAssets = useRef(data.assets);
  const latestGroups = useRef(data.groups || []);
  const [saveState, setSaveState] = useState({pending:0,error:''});
  const [viewportError, setViewportError] = useState('');
  const [manualLeaveError,setManualLeaveError] = useState('');
  const settingsRef = useRef(data.settings);
  settingsRef.current = data.settings;
  const pendingMembership = useRef(new Map());
  const confirmedMembership = useRef(new Map());
  const pendingAppearance = useRef(new Map());
  const [layoutDirty, setLayoutDirty] = useState(false);
  const dirtyRevision = useRef(0);
  const savedRevision = useRef(0);
  const saveQueue = useRef(null);
  if (!saveQueue.current) saveQueue.current = createPersistenceQueue(setSaveState);
  const viewportSave = useRef(null);
  if (!viewportSave.current) viewportSave.current = createLatestValueSave(
    value => saveQueue.current.write(`viewport:${value.categoryId}`, () => call('save_viewport',value), {retainFailure:false}),
    {notify: state => setViewportError(state.error)},
  );
  const markDirty = () => { dirtyRevision.current++; setLayoutDirty(true); };
  useEffect(() => {
    latestAssets.current = data.assets;
  }, [data.assets]);
  useEffect(() => {
    latestGroups.current = data.groups || [];
  }, [data.groups]);
  useEffect(() => {
    const next = categories.some(x => x.id === initialCategoryId) ? initialCategoryId : categories[0]?.id || '';
    setActive(next);
    setMenuCategoryId('');
    setNoteMenu(null);
  }, [initialCategoryId, categories.map(x => x.id).join(','), workspaceId]);
  const category = categories.find((x) => x.id === active);
  const shown = useMemo(() => data.assets
    .filter((x) => x.workspaceId === workspaceId && x.categoryId === active)
    .map(withUrls), [data.assets,workspaceId,active]);
  const shownGroups = useMemo(() => (data.groups || []).filter((group) => group.categoryId === active), [data.groups,active]);
  const localAssets = (items, options = {}) => {
    const map = new Map(items.map((x) => [x.id, x]));
    const update = current => current.map(x => {
      const next = map.get(x.id);
      if(!next)return x;
      if(options.preview && ['x','y','width','height','rotation','zIndex','locked','groupId'].every(key => x[key] === next[key]))return x;
      return {...x,...next,previewUrl:undefined};
    });
    // A release can commit before React executes a batched state updater.
    latestAssets.current = update(latestAssets.current);
    setData((d) => {
      const assets = update(d.assets);
      return { ...d, assets };
    });
    if(!options.preview)markDirty();
  };
  const localGroups = (items, options = {}) => {
    const map = new Map(items.map((group) => [group.id, group]));
    const next = (latestGroups.current || []).map((group) => map.get(group.id) ? { ...group, ...map.get(group.id) } : group);
    latestGroups.current = next;
    if(!options.preview)markDirty();
    setData((d) => ({ ...d, groups: (d.groups || []).map((group) => map.get(group.id) ? { ...group, ...map.get(group.id) } : group) }));
  };
  const captureGroups = () => latestGroups.current
      .filter((group) => group.categoryId === active)
      .map((group) => ({
        id: group.id,
        categoryId: group.categoryId,
        name: group.name,
        x: group.x,
        y: group.y,
        width: group.width,
        height: group.height,
        zIndex: group.zIndex,
        locked: group.locked,
        collapsed: group.collapsed,
        borderColor: group.borderColor,
        backgroundColor: group.backgroundColor,
        backgroundOpacity: group.backgroundOpacity,
      }));
  const captureLayout = () => ({
    revision:dirtyRevision.current,
    layoutItems:latestAssets.current.filter(x => x.categoryId === active).map(x => ({assetId:x.id,categoryId:x.categoryId,x:x.x,y:x.y,width:x.width,height:x.height,rotation:x.rotation || 0,zIndex:x.zIndex,locked:x.locked})),
    groupItems:captureGroups(),
    membership:[...pendingMembership.current.values()],
    appearance:[...pendingAppearance.current.values()],
  });
  const commit = async ({snapshot=captureLayout(),flushViewport=true}={}) => {
    const {revision,layoutItems,groupItems,membership,appearance}=snapshot;
    if(flushViewport)await viewportSave.current.flush();
    return saveQueue.current.write(`layout:${active}`, async () => {
      await Promise.all([call('save_canvas_layout',{items:layoutItems}),call('save_canvas_groups',{items:groupItems})]);
      for(const value of membership){
        const previous=confirmedMembership.current.get(value.assetId),target=value.add?value.groupId:null;
        if(previous && previous!==target){
          await call('remove_canvas_group_member',{groupId:previous,assetId:value.assetId});
          confirmedMembership.current.set(value.assetId,null);
        }
        if(target && confirmedMembership.current.get(value.assetId)!==target){
          await call('add_canvas_group_member',{groupId:target,assetId:value.assetId});
          confirmedMembership.current.set(value.assetId,target);
        }
        if(pendingMembership.current.get(value.assetId)===value)pendingMembership.current.delete(value.assetId);
      }
      for(const value of appearance){
        await call('save_canvas_appearance',value);
        if(pendingAppearance.current.get(value.categoryId)===value)pendingAppearance.current.delete(value.categoryId);
      }
    }).then(() => {savedRevision.current=revision;if(dirtyRevision.current===revision)setLayoutDirty(false);});
  };
  const saveAll = async () => {
    setManualLeaveError('');
    await canvas.current?.save();
    await viewportSave.current.flush();
    if(dirtyRevision.current!==savedRevision.current)await commit();
    await saveQueue.current.flush();
  };
  const autoSaveRef=useRef(null),tickRunning=useRef(false);
  autoSaveRef.current=async () => {
    if(tickRunning.current || canvas.current?.hasActiveInteraction())return;
    const layoutPending=dirtyRevision.current!==savedRevision.current;
    const objectPending=canvas.current?.hasPendingChanges();
    const viewPending=viewportSave.current.snapshot().dirty;
    if(!layoutPending&&!objectPending&&!viewPending)return;
    const snapshot=layoutPending?captureLayout():null;
    tickRunning.current=true;
    try {
      const jobs=[canvas.current?.autoSave()];
      if(snapshot)jobs.push(commit({snapshot,flushViewport:false}));
      if(viewPending)jobs.push(viewportSave.current.saveOnce());
      await Promise.all(jobs);
    } finally {tickRunning.current=false;}
  };
  useEffect(()=>{
    const tick=event=>{if(settingsRef.current?.autoSave!==false)event.detail.promises.push(autoSaveRef.current());};
    window.addEventListener('canvas-auto-save',tick);
    return()=>window.removeEventListener('canvas-auto-save',tick);
  },[]);
  const saveAllRef=useRef(saveAll);
  saveAllRef.current=saveAll;
  useEffect(() => {
    const beforeLeave = event => event.detail.promises.push((async () => {
      if(settingsRef.current?.autoSave===false) {
        canvas.current?.cancelInteraction();
        const view=viewportSave.current.snapshot(),queue=saveQueue.current.snapshot();
        if(dirtyRevision.current!==savedRevision.current || view.dirty || view.pending || canvas.current?.hasPendingChanges() || queue.pending || queue.error){
          setManualLeaveError('请手动保存后离开');throw Error('请手动保存后离开');
        }
        return;
      }
      for(;;) {
        await saveAllRef.current();
        canvas.current?.cancelInteraction();
        const view = viewportSave.current.snapshot();
        if(dirtyRevision.current === savedRevision.current && !view.dirty && !view.pending)break;
      }
    })());
    window.addEventListener('asset-text-before-leave', beforeLeave);
    return () => {window.removeEventListener('asset-text-before-leave',beforeLeave);viewportSave.current.stopTimer();};
  }, []);
  const saveAsset = async (form) => {
    const center = canvas.current?.getVisibleCenter() || { x: 100, y: 100 };
    const existingRatio =
      form.width && form.height ? form.width / form.height : 0;
    const coverPath = form.useSourceAsCover
      ? form.selectedFilePath || form.originalFilePath || form.sourceFilePath
      : form.selectedCoverPath ||
        form.coverOriginalPath ||
        form.coverSourcePath;
    const ratio = coverPath
      ? existingRatio || (await readImageRatio(coverPath))
      : 1;
    const initialSize = coverPath
      ? initialImageSize(ratio, data.settings?.newAssetMaxEdge || 420)
      : { width: 220, height: 160 };
    const width = form.width || initialSize.width;
    const height = form.height || initialSize.height;
    const item = {
      id: form.id || id("asset"),
      categoryId: form.categoryId,
      workspaceId,
      name: form.name,
      description: form.description,
      storageMode: form.storageMode,
      selectedFilePath: form.selectedFilePath || "",
      sourceFilePath: form.sourceFilePath || "",
      originalFilePath: form.originalFilePath || "",
      coverStorageMode: form.coverStorageMode || "managed",
      selectedCoverPath: form.selectedCoverPath || "",
      coverSourcePath: form.coverSourcePath || "",
      coverOriginalPath: form.coverOriginalPath || "",
      useSourceAsCover: Boolean(form.useSourceAsCover),
      previewPath: form.previewPath || "",
      thumbnailPath: form.thumbnailPath || "",
      filePath: form.filePath || "",
      tags: form.tags,
      notes: form.notes,
      createdAt: form.createdAt || now(),
      x: form.x ?? center.x - width / 2,
      y: form.y ?? center.y - height / 2,
      width,
      height,
      zIndex: form.zIndex || Math.max(0, ...shown.map((x) => x.zIndex)) + 1,
      locked: Boolean(form.locked),
    };
    await run("save_asset", { item });
    setDialog("");
    setEditingAsset(null);
    await go(`assets/${workspaceId}?category=${item.categoryId}`);
  };
  const relink = async (asset) => {
    const path = await call("pick_asset_file");
    if (path) {
      await run("relink_asset", { id: asset.id, sourceFilePath: path });
    }
  };
  const removeAssets = async (ids) => {
    await canvas.current?.flushNotes();
    for (const assetId of ids) {
      const asset = data.assets.find(x=>x.id===assetId);
      await run("delete_asset", {id:assetId,deleteManaged:asset?.storageMode==="managed"});
    }
  };
  const requestDeleteAssets = (ids) => {
    if (!ids.length) return;
    if (data.settings?.confirmDelete) setPending({ kind: "assets", ids });
    else removeAssets(ids);
  };
  useEffect(() => {
    if (!registerShortcutActions) return;
    const selectedAssets = () => {
      const ids = canvas.current?.getSelectedIds() || [];
      return data.assets.filter((asset) => ids.includes(asset.id) && asset.categoryId === active);
    };
    const copySelected = () => {
      const selected = selectedAssets();
      if (!selected.length) return false;
      assetClipboardRef.current = selected;
      setClipboardNotice(`已复制 ${selected.length} 个资产`);
      return true;
    };
    const actions = {
      search: () => { sidebar.expand(); setSearchFocusRequest(request => request + 1); return true; },
      save: () => saveAll(),
      undo: () => canvas.current?.undo(),
      redo: () => canvas.current?.redo(),
      "select-all": () => canvas.current?.selectAll(),
      "canvas-zoom-in": () => canvas.current?.zoomIn(),
      "canvas-zoom-out": () => canvas.current?.zoomOut(),
      "canvas-zoom-reset": () => canvas.current?.zoomReset(),
      "canvas-fit": () => canvas.current?.fitAll(),
      "canvas-toggle-lock": () => canvas.current?.toggleLockSelected(),
      "canvas-bring-top": () => canvas.current?.bringSelectedToTop(),
      "canvas-send-bottom": () => canvas.current?.sendSelectedToBottom(),
      "canvas-group-selected": () => canvas.current?.createGroupSelected(),
      "asset-add": () => setDialog("asset"),
      "asset-edit": () => {
        const selected = selectedAssets();
        if (selected.length === 1) setEditingAsset(selected[0]);
      },
      "asset-open": () => {
        const selected = selectedAssets();
        if (selected.length === 1) go(`asset/${workspaceId}/${selected[0].id}`);
      },
      delete: () => requestDeleteAssets(selectedAssets().map((asset) => asset.id)),
      "asset-delete": () => requestDeleteAssets(selectedAssets().map((asset) => asset.id)),
      copy: copySelected,
      cut: () => {
        if (!copySelected()) return false;
        assetClipboardRef.current.cutIds = selectedAssets().map(asset => asset.id);
        setClipboardNotice(`已剪切 ${assetClipboardRef.current.length} 个资产，粘贴后移动`);
        return true;
      },
      paste: async () => {
        const clipboard = assetClipboardRef.current;
        if (!clipboard.length || !active) return false;
        if (!await flushBeforeNavigation()) return false;
        const destination = `${workspaceId}:${active}`;
        if (clipboard.moveTarget !== destination) {clipboard.moveTarget = destination;delete clipboard.completedMoves;}
        const createdIds = await pasteAssetClipboard(clipboard, async (asset,index) => {
          const filePath = asset.storageMode === "managed" ? asset.originalFilePath : asset.sourceFilePath;
          const coverPath = asset.coverImagePath || (asset.coverStorageMode === "managed" ? asset.coverOriginalPath : asset.coverSourcePath);
          const copyId = id("asset");
          await call("save_asset", { item: {
            id: copyId,
            categoryId: active,
            workspaceId,
            name: clipboard.cutIds?.length ? asset.name : `${asset.name} 副本`,
            description: asset.description,
            storageMode: asset.storageMode,
            selectedFilePath: filePath,
            sourceFilePath: asset.sourceFilePath,
            originalFilePath: asset.originalFilePath,
            coverStorageMode: asset.coverStorageMode || "managed",
            selectedCoverPath: coverPath || "",
            coverSourcePath: asset.coverSourcePath || "",
            coverOriginalPath: asset.coverOriginalPath || "",
            useSourceAsCover: false,
            filePath: asset.filePath || "",
            tags: asset.tags || [],
            notes: asset.notes || "",
            createdAt: now(),
            x: asset.x + 28,
            y: asset.y + 28,
            width: asset.width,
            height: asset.height,
            zIndex: Math.max(0, ...shown.map((item) => item.zIndex)) + index + 1,
            locked: false,
          } });
          return copyId;
        }, async (asset,index) => {
          const latest = store.data.assets.find(item=>item.id===asset.id) || asset;
          const center = canvas.current?.getVisibleCenter() || {x:100,y:100};
          const x = center.x - clipboard[0].width/2 + asset.x - clipboard[0].x;
          const y = center.y - clipboard[0].height/2 + asset.y - clipboard[0].y;
          await call('save_asset', {item:{...latest,workspaceId,categoryId:active,selectedFilePath:'',selectedCoverPath:'',useSourceAsCover:false,x,y,rotation:latest.rotation||0,zIndex:Math.max(0,...shown.map(item=>item.zIndex))+index+1}});
          return asset.id;
        }).catch(async error => {await reload();throw error;});
        const next = await call('load_app_state');
        setData(next);
        if (clipboard.cutIds?.length) assetClipboardRef.current = next.assets.filter(asset=>createdIds.includes(asset.id));
        setClipboardNotice(`已粘贴 ${createdIds.length} 个资产`);
        canvas.current?.selectIds(createdIds);
      },
      "category-add": () => setDialog("category"),
      "category-edit": () => { if (category) setEditingCategory(category); },
      "category-delete": () => {
        if (!category) return;
        if (data.settings?.confirmDelete || data.assets.some((asset) => asset.categoryId === category.id)) setPending({ kind: "category", ...category });
        else run("delete_category", { id: category.id });
      },
    };
    const textActions=new Set(['save','copy','cut','paste','delete','select-all','canvas-toggle-lock','canvas-bring-top','canvas-send-bottom','canvas-group-selected']);
    registerShortcutActions(Object.fromEntries(Object.entries(actions).map(([action,handler])=>[action,()=>textActions.has(action)&&canvas.current?.textAction(action)?true:handler()])));
    return () => registerShortcutActions({});
  }, [registerShortcutActions, assetClipboardRef, active, category, data.assets, data.settings?.confirmDelete, workspaceId, go, sidebar.expand]);
  if (!workspace)
    return (
      <Empty
        icon={Layers3}
        title="找不到这个模型"
        text="模型可能已被移除。"
        action="返回"
        onAction={() => go("models")}
      />
    );
  return (
    <div ref={workspaceRef} className="asset-layout sidebar-layout ui-workspace" data-sidebar-expanded={sidebar.expanded} data-resizable-sidebar="assets" style={{ "--sidebar-width": `${sidebarPanel.size}px` }}>
      <div id="asset-sidebar" className="sidebar-slot" inert={!sidebar.expanded} aria-hidden={!sidebar.expanded}>
      <AssetSidebar
        searchRef={sidebarSearchRef}
        expanded={sidebar.expanded}
        onToggleSidebar={toggleSidebar}
        active={active}
        search={search}
        onSearch={setSearch}
        onSelect={x => go(`assets/${workspaceId}?category=${x}`)}
        onAdd={() => setDialog("category")}
        categories={categories}
        menuCategoryId={menuCategoryId}
        onToggleMenu={setMenuCategoryId}
        onEdit={setEditingCategory}
        onDelete={(x) => {
          if (!data.settings?.confirmDelete && !data.assets.some(a=>a.categoryId===x.id)) run("delete_category",{id:x.id});
          else setPending({ kind: "category", ...x });
        }}
      />
      <PanelSplitter label="调整分类栏宽度" axis="x" className="ui-sidebar-splitter" aria-controls="asset-sidebar" {...sidebarPanel.splitterProps}/>
      </div>
      <section className="asset-main canvas-page ui-workspace-main">
        <header className="asset-header canvas-header ui-workbar">
          <div className="sidebar-page-heading">
            <SidebarToggle expanded={sidebar.expanded} onToggle={toggleSidebar} controls="asset-sidebar" showLabel hidden={sidebar.expanded} />
            <div className="sidebar-heading-copy">
              <h1>{category?.name || "资产"}</h1>
              {category?.description && <p className="asset-description">{category.description}</p>}
            </div>
          </div>
          {category && <div className="canvas-header-actions">
            <span className="ui-status" role="status">{saveState.pending ? '正在保存…' : layoutDirty ? '布局待保存' : ''}</span>
            <button className="secondary" onClick={() => saveAll().catch(()=>{})} disabled={!!saveState.pending}><Save size={15}/>保存</button>
            <button className="secondary" onClick={() => canvas.current?.addText()}><Plus size={16}/>添加文字</button>
            <button className="secondary" aria-haspopup="menu" aria-expanded={!!noteMenu} onClick={event => setNoteMenu(noteMenu ? null : {anchor:event.currentTarget,attached:(canvas.current?.getSelectedIds() || []).length === 1})}><StickyNote size={16}/>添加备注</button>
            <button className="primary" onClick={() => setDialog("asset")}><Plus size={16} />添加资产</button>
          </div>}
        </header>
        {noteMenu && <PopupMenu anchor={noteMenu.anchor} label="添加备注" onClose={() => setNoteMenu(null)}><button type="button" role="menuitem" onClick={() => {setNoteMenu(null);canvas.current?.addIndependentNote();}}>添加独立备注</button><button type="button" role="menuitem" disabled={!noteMenu.attached} title={noteMenu.attached ? '备注跟随所选资产' : '先选择一个资产'} onClick={() => {setNoteMenu(null);canvas.current?.addAttachedNote();}}>添加附属备注</button></PopupMenu>}
        {clipboardNotice && <div className="ui-clipboard-notice" role="status"><span>{clipboardNotice}</span><button className="ui-icon-button" aria-label="关闭剪贴板反馈" onClick={()=>setClipboardNotice('')}><X size={14}/></button></div>}
        {(saveState.error || viewportError) && <div className="ui-save-error" role="alert"><span>部分修改尚未保存：{[saveState.error,viewportError].filter(Boolean).join('；')}</span><button className="secondary" onClick={() => viewportSave.current.retry().then(() => saveQueue.current.retry()).then(() => layoutDirty ? commit() : undefined).catch(()=>{})}>重试保存</button></div>}
        {manualLeaveError && <div className="ui-save-error ui-manual-save-required" role="alert"><span>{manualLeaveError}</span><button className="secondary" onClick={()=>saveAll().catch(()=>{})}>立即保存</button></div>}
        {category ? (
          <>
            <AssetCanvas
              ref={canvas}
              textBlocks={(data.categoryTextBlocks || []).filter(b=>b.categoryId===active)}
              fonts={data.customFonts}
              onSaveTransform={async ({assets,texts,groups,textChanges})=>{
                await saveQueue.current.write(`transform:${active}`, () => call('save_canvas_transform',{categoryId:active,assets,texts,groups,textChanges}), {retainFailure:false});
                const updates=new Map((textChanges?.upserts || []).map(t=>[t.id,t]));
                for(const t of texts)updates.set(t.id,{...updates.get(t.id),...t});
                setData(d=>{const old=d.categoryTextBlocks||[],known=new Set(old.map(t=>t.id)),removed=new Set(textChanges?.deleteIds||[]);return {...d,categoryTextBlocks:[...old.filter(t=>!removed.has(t.id)).map(t=>updates.has(t.id)?{...t,...updates.get(t.id)}:t),...[...updates.values()].filter(t=>!known.has(t.id))]};});
              }}
              onSaveText={async changes=>{
                await call('save_category_text_changes',{categoryId:active,changes});
                const removed=new Set(changes.deleteIds),updates=new Map(changes.upserts.map(b=>[b.id,b]));
                setData(d=>({...d,categoryTextBlocks:[...(d.categoryTextBlocks || []).filter(b=>!removed.has(b.id)&&!updates.has(b.id)),...updates.values()]}));
              }}
              settings={data.settings}
              assets={shown}
              groups={shownGroups}
              search={search}
              categories={categories}
              activeCategory={category}
              onAssetsChange={localAssets}
              onGroupsChange={localGroups}
              onCreateGroup={(group, assetIds) => run("create_canvas_group", {
                item: { group, assetIds },
              })}
              onChangeGroupMember={(groupId,assetId,add)=>{
                const asset=latestAssets.current.find(item=>item.id===assetId);
                if(!asset)return;
                if(!pendingMembership.current.has(assetId))confirmedMembership.current.set(assetId,asset.groupId || null);
                localAssets([{...asset,groupId:add?groupId:null}]);
                pendingMembership.current.set(assetId,{groupId,assetId,add});
              }}
              onDeleteGroup={(id) => run("delete_canvas_group", { id })}
              onSaveLayout={saveAll}
              onCanvasAppearance={({color,pattern})=>{
                setData(d=>({...d,categories:d.categories.map(item=>item.id===active?{...item,canvasColor:color,canvasPattern:pattern}:item)}));
                pendingAppearance.current.set(active,{categoryId:active,color,pattern});markDirty();
              }}
              onViewportChange={(v, options = {}) => {
                const current = data.categories.find(item => item.id === active);
                if(current && ['viewportX','viewportY','zoom'].every(key => current[key] === v[key]))return;
                if(current)viewportSave.current.seed({categoryId:active,viewportX:current.viewportX,viewportY:current.viewportY,zoom:current.zoom});
                setData((d) => ({
                  ...d,
                  categories: d.categories.map((x) =>
                    x.id === active ? { ...x, ...v } : x,
                  ),
                }));
                viewportSave.current.draft({categoryId:active,...v},{schedule:false});
              }}
              onOpen={(a) => go(`asset/${workspaceId}/${a.id}`)}
              onEdit={setEditingAsset}
              onDelete={requestDeleteAssets}
              onAdd={() => setDialog("asset")}
              onRelink={relink}
              onMoveCategory={(asset, categoryId) =>
                saveAsset({ ...asset, categoryId })
              }
              onImageMetrics={(asset, naturalWidth, naturalHeight) => {
                const height = asset.width / (naturalWidth / naturalHeight);
                localAssets([{ ...asset, height }]);
              }}
            />
          </>
        ) : (
          <Empty
            icon={FolderCode}
            title="暂无分类"
            text="请先新增分类，再开始添加资产。"
            action="新增分类"
            onAction={() => setDialog("category")}
          />
        )}
      </section>
      {dialog === "category" && (
        <CategoryDialog
          title="新增分类"
          onCancel={() => setDialog("")}
          onConfirm={async (v) => {
            const item = {
              id: id("category"),
              workspaceId,
              ...v,
              icon: "",
              createdAt: now(),
              updatedAt: now(),
              viewportX: 80,
              viewportY: 70,
              zoom: 1,
            };
            await run("save_category", { item });
            setDialog("");
            await go(`assets/${workspaceId}?category=${item.id}`);
          }}
        />
      )}
      {editingCategory && (
        <CategoryDialog
          title="编辑分类"
          category={editingCategory}
          onCancel={() => setEditingCategory(null)}
          onConfirm={async (v) => {
            await run("save_category", {
              item: { ...editingCategory, ...v, updatedAt: now() },
            });
            setEditingCategory(null);
          }}
        />
      )}
      {(dialog === "asset" || editingAsset) && (
        <AssetDialog
          settings={data.settings}
          categories={categories}
          initial={editingAsset}
          currentCategoryId={active}
          onCancel={() => {
            setDialog("");
            setEditingAsset(null);
          }}
          onConfirm={saveAsset}
        />
      )}
      {pending?.kind === "category" && (
        <Confirm
          title="删除分类"
          text={
            data.assets.some((x) => x.categoryId === pending.id)
              ? `该分类中仍有 ${data.assets.filter((x) => x.categoryId === pending.id).length} 个资产，必须先移走或删除。`
              : "确定要删除这个分类及其中的独立备注和画布内容吗？"
          }
          disabled={data.assets.some((x) => x.categoryId === pending.id)}
          onCancel={() => setPending(null)}
          onConfirm={async () => {
            await run("delete_category", { id: pending.id });
            setPending(null);
          }}
        />
      )}
      {pending?.kind === "assets" && (
        <Confirm
          title="删除资产"
          text="资产的备注抽屉会保留为原分类中的独立备注。托管模式会同时删除脚本集合器自己的托管副本，引用模式的用户源文件会保留。"
          onCancel={() => setPending(null)}
          onConfirm={async () => {
            await removeAssets(pending.ids);
            setPending(null);
            await reload();
          }}
        />
      )}
    </div>
  );
}
