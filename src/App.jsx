import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Pencil,
  Play,
  Plus,
  Save,
  Settings as SettingsIcon,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { AppChrome } from "./components/AppChrome";
import { SettingsPage } from "./components/SettingsPage";
import { AssetCanvas } from "./components/AssetCanvas";
import { AssetInnerCanvas } from "./components/AssetInnerCanvas";
import { resolveCanvasAppearance } from "./canvasAppearance";
import { AssetStandardTextLayer } from "./components/AssetStandardTextLayer";
import { useAssetTextController } from "./hooks/useAssetTextController";
import { projectTextItems } from "./data/assetTextModel";
import { AssetSidebar } from "./components/AssetSidebar";
import { SidebarToggle } from "./components/SidebarToggle";
import { useSidebarPreference } from "./hooks/useSidebarPreference";
import { bootDatabase, call, fileUrl, id } from "./data/database";

import { applyTheme } from "./theme";
import { useHashRoute, flushBeforeNavigation } from "./hooks/useHashRoute";
import { listen } from "@tauri-apps/api/event";
import { createCloseRequestHandler } from "./closeLifecycle";
import { isNativeTextShortcut, resolveShortcuts, shortcutFromEvent } from "./shortcuts/registry";
import { getCurrentWindow } from "@tauri-apps/api/window";

const now = () => Date.now();
const readImageRatio = (path) =>
  new Promise((resolve) => {
    if (!path) return resolve(1);
    const image = new window.Image();
    image.onload = () =>
      resolve(
        image.naturalWidth && image.naturalHeight
          ? image.naturalWidth / image.naturalHeight
          : 1,
      );
    image.onerror = () => resolve(1);
    image.src = fileUrl(path);
  });
const initialImageSize = (ratio, maxEdge = 420) =>
  ratio >= 1
    ? { width: maxEdge, height: maxEdge / ratio }
    : { width: maxEdge * ratio, height: maxEdge };
const assetNameFromPath = (path) => {
  const fileName =
    String(path || "")
      .split(/[\\/]/)
      .pop() || "";
  const extensionAt = fileName.lastIndexOf(".");
  return extensionAt > 0 ? fileName.slice(0, extensionAt) : fileName;
};
const blank = {
  workspaces: [],
  scriptCategories: [],
  categories: [],
  assets: [],
  groups: [],
  prompts: [],
  innerCanvasObjects: [],
  innerCanvasViewports: [],
  innerCanvasAppearances: [],
  assetTextElements: [],
  assetTextLayouts: [],
  categoryTextBlocks: [],
  customFonts: [],
  settings: null,
  shortcutBindings: [],
  cacheBytes: 0,
  databasePath: "",
};
function useStore() {
  const [data, setData] = useState(blank);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reload = async () => {
    try {
      setData(await call("load_app_state"));
    } catch (e) {
      setError(String(e));
    }
  };
  useEffect(() => {
    bootDatabase()
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);
  const run = async (command, args) => {
    try {
      const result = await call(command, args);
      call("diagnostic_log", {event:`${command}:ok`}).catch(()=>{});
      await reload();
      return result;
    } catch (e) {
      call("diagnostic_log", {event:`${command}:error`}).catch(()=>{});
      setError(String(e));
      throw e;
    }
  };
  return {
    data,
    setData,
    loading,
    error,
    clearError: () => setError(""),
    run,
    reload,
  };
}
const withUrls = (asset) => ({
  ...asset,
  previewUrl: fileUrl(
    asset.thumbnailPath || asset.previewPath || asset.coverImagePath,
  ),
});

function Home({ go }) {
  return (
    <section className="home-page">
      <div className="home-heading">
        <h1>选择你的组织方式</h1>
      </div>
      <div className="home-actions">
        {[
          [FolderCode, "排列模式", "有序排列，分类整理你的内容", "scripts"],
          [Image, "画布模式", "自由布局，直观组织你的内容", "models"],
        ].map(([Icon, title, caption, to]) => (
          <button className="entry-card" key={to} onClick={() => go(to)}>
            <span className="entry-icon">
              <Icon size={27} />
            </span>
            <span>
              <strong>{title}</strong>
              <small>{caption}</small>
            </span>
            <ArrowRight className="entry-arrow" size={20} />
          </button>
        ))}
      </div>
    </section>
  );
}

function Scripts({ store }) {
  const { data, run } = store;
  const sidebar = useSidebarPreference("scripts");
  const [active, setActive] = useState("");
  const [categoryDialog, setCategoryDialog] = useState(false);
  const [scriptDialog, setScriptDialog] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [launching, setLaunching] = useState("");
  const current =
    data.scriptCategories.find((x) => x.id === active) ||
    data.scriptCategories[0];
  const scripts = Array.isArray(current?.scripts) ? current.scripts : [];
  const saveScripts = async (nextScripts) => {
    await run("save_script_category", {
      item: { ...current, scripts: nextScripts, updatedAt: now() },
    });
  };
  const launch = async (script) => {
    setLaunching(script.id);
    try {
      await call("launch_script", {
        filePath: script.filePath || "",
        launchCommand: script.launchCommand || "",
        launchArgs: script.launchArgs || "",
      });
    } catch (error) {
      alert(String(error));
    } finally {
      setLaunching("");
    }
  };
  return (
    <div className="workspace-layout sidebar-layout" data-sidebar-expanded={sidebar.expanded}>
      <div id="script-sidebar" className="sidebar-slot" inert={!sidebar.expanded} aria-hidden={!sidebar.expanded}>
      <aside className="script-sidebar">
        <div className="sidebar-topbar script-sidebar-topbar">
          <div className="sidebar-title">分类</div>
          <SidebarToggle expanded={sidebar.expanded} onToggle={sidebar.toggle} controls="script-sidebar" showLabel />
        </div>
        <nav>
          {data.scriptCategories.map((x) => (
            <button
              className={x.id === current?.id ? "active" : ""}
              key={x.id}
              onClick={() => setActive(x.id)}
            >
              <span>{x.name}</span>
              <small>{x.scripts?.length || 0}</small>
            </button>
          ))}
        </nav>
        <button
          className="add-category"
          onClick={() => setCategoryDialog(true)}
        >
          <Plus size={17} />
          新增分类
        </button>
      </aside>
      </div>
      <section className="workspace-main">
        <div className="script-section-header">
          <div className="sidebar-page-heading">
            <SidebarToggle expanded={sidebar.expanded} onToggle={sidebar.toggle} controls="script-sidebar" showLabel hidden={sidebar.expanded} />
            <header className="content-header">
              <p className="eyebrow">脚本分类</p>
              <h1>{current?.name || "脚本"}</h1>
              {current && <p>{current.description || "暂无分类简介。"}</p>}
            </header>
          </div>
          {scripts.length > 0 && (
            <button className="primary" onClick={() => setScriptDialog({ mode: "create" })}>
              <Plus size={16} />新增脚本
            </button>
          )}
        </div>
        {current ? (
          <>
            {scripts.length ? (
              <div className="script-list">
                {scripts.map((script) => (
                  <article className="script-row" key={script.id}>
                    <span className="file-glyph">
                      {(
                        String(script.filePath || "")
                          .split(".")
                          .pop() || "FILE"
                      )
                        .slice(0, 4)
                        .toUpperCase()}
                    </span>
                    <span className="script-info">
                      <strong>{script.name}</strong>
                      <small>
                        {script.description ||
                          script.filePath ||
                          "尚未配置路径"}
                      </small>
                    </span>
                    <div className="script-actions">
                      <button
                        className="secondary small"
                        aria-label={`编辑 ${script.name}`}
                        onClick={() =>
                          setScriptDialog({ mode: "edit", script })
                        }
                      >
                        <Pencil size={15} />
                        编辑
                      </button>
                      <button
                        className="secondary small danger"
                        aria-label={`删除 ${script.name}`}
                        onClick={() => data.settings?.confirmDelete ? setPendingDelete(script) : saveScripts(scripts.filter(item=>item.id!==script.id))}
                      >
                        <Trash2 size={15} />
                        删除
                      </button>
                      <button
                        className="primary small"
                        disabled={launching === script.id}
                        onClick={() => launch(script)}
                      >
                        <Play size={15} />
                        {launching === script.id ? "启动中…" : "启动"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <Empty
                icon={FolderCode}
                title="此分类暂无脚本"
                text="添加第一个脚本开始使用"
                action="新增脚本"
                onAction={() => setScriptDialog({ mode: "create" })}
              />
            )}
          </>
        ) : (
          <Empty
            icon={FolderCode}
            title="暂无分类"
            text="点击新增分类开始整理你的脚本。"
            action="新增分类"
            onAction={() => setCategoryDialog(true)}
          />
        )}
      </section>
      {categoryDialog && (
        <CategoryDialog
          title="新增分类"
          onCancel={() => setCategoryDialog(false)}
          onConfirm={async (v) => {
            const categoryId = id("script-category");
            await run("save_script_category", {
              item: {
                id: categoryId,
                ...v,
                scripts: [],
                createdAt: now(),
                updatedAt: now(),
              },
            });
            setActive(categoryId);
            setCategoryDialog(false);
          }}
        />
      )}
      {scriptDialog && current && (
        <ScriptDialog
          script={scriptDialog.script}
          onCancel={() => setScriptDialog(null)}
          onConfirm={async (values) => {
            const nextScript = scriptDialog.script
              ? { ...scriptDialog.script, ...values, updatedAt: now() }
              : {
                  id: id("script"),
                  ...values,
                  createdAt: now(),
                  updatedAt: now(),
                };
            await saveScripts(
              scriptDialog.script
                ? scripts.map((item) =>
                    item.id === nextScript.id ? nextScript : item,
                  )
                : [...scripts, nextScript],
            );
            setScriptDialog(null);
          }}
        />
      )}
      {pendingDelete && (
        <Confirm
          title="删除脚本"
          text={`确定要删除脚本“${pendingDelete.name}”吗？只会删除脚本集合器中的记录，不会删除硬盘上的脚本文件。`}
          onCancel={() => setPendingDelete(null)}
          onConfirm={async () => {
            await saveScripts(
              scripts.filter((item) => item.id !== pendingDelete.id),
            );
            setPendingDelete(null);
          }}
        />
      )}
    </div>
  );
}

function Models({ store, go }) {
  const { data, run } = store;
  const [dialog, setDialog] = useState("");
  const [editing, setEditing] = useState(null);
  const [menu, setMenu] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  useEffect(() => {
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("blur", close);
    };
  }, []);
  const openMenu = (event, model) => {
    event.preventDefault();
    event.stopPropagation();
    setMenu({ model, x: event.clientX, y: event.clientY });
  };
  const updateModel = async (values) => {
    const item = editing
      ? { ...editing, ...values, updatedAt: now() }
      : { id: id("workspace"), ...values, createdAt: now(), updatedAt: now() };
    await run("save_workspace", { item });
    setDialog("");
    setEditing(null);
  };
  return (
    <section
      className="models-page"
      onContextMenu={(event) => event.preventDefault()}
    >
      <header className="page-header model-page-header">
        <div>
          <p className="eyebrow">生成工作区</p>
          <h1>生图资产模型</h1>
          <p>每个模型拥有独立的资产库。</p>
        </div>
        {data.workspaces.length > 0 && (
          <button className="primary" onClick={() => setDialog("create")}>
            <Plus size={16} />
            添加模型
          </button>
        )}
      </header>
      {data.workspaces.length ? (
        <div className="model-strip">
          {data.workspaces.map((x, i) => (
            <article
              className="model-card"
              key={x.id}
              role="button"
              tabIndex={0}
              onClick={() => go(`assets/${x.id}`)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ")
                  go(`assets/${x.id}`);
              }}
              onContextMenu={(event) => openMenu(event, x)}
            >
              {x.coverPath ? (
                <img className="model-cover" src={fileUrl(x.coverPath)} />
              ) : (
                <span className="model-cover-placeholder">
                  <Layers3 />
                </span>
              )}
              <span className="model-index">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="model-copy">
                <strong>{x.name}</strong>
                <small>{x.description || "暂无简介"}</small>
              </span>
              <button
                className="model-menu-button"
                aria-label={`管理模型 ${x.name}`}
                onClick={(event) => openMenu(event, x)}
              >
                <MoreHorizontal size={20} />
              </button>
              <ArrowRight size={20} />
            </article>
          ))}
        </div>
      ) : (
        <Empty
          icon={Layers3}
          title="暂无模型"
          text="点击添加模型开始建立你的资产库"
          action="添加模型"
          onAction={() => setDialog("create")}
        />
      )}
      {menu && (
        <div
          className="model-context-menu"
          style={{ left: menu.x, top: menu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            onClick={() => {
              setEditing(menu.model);
              setDialog("edit");
              setMenu(null);
            }}
          >
            编辑模型
          </button>
          <button
            className="danger"
            onClick={() => {
              setPendingDelete(menu.model);
              setMenu(null);
            }}
          >
            删除模型
          </button>
        </div>
      )}
      {dialog && (
        <ModelDialog
          title={dialog === "edit" ? "编辑模型" : "添加模型"}
          model={editing}
          onCancel={() => setDialog(false)}
          onConfirm={updateModel}
        />
      )}
      {pendingDelete && (
        <WorkspaceDeleteConfirm
          workspace={pendingDelete}
          categories={data.categories.filter(
            (x) => x.workspaceId === pendingDelete.id,
          )}
          assets={data.assets.filter((x) => x.workspaceId === pendingDelete.id)}
          onCancel={() => setPendingDelete(null)}
          onConfirm={async (deleteManaged) => {
            await run("delete_workspace", {
              id: pendingDelete.id,
              deleteManaged,
            });
            setPendingDelete(null);
          }}
        />
      )}
    </section>
  );
}

function Assets({ store, workspaceId, initialCategoryId, go, registerShortcutActions, assetClipboardRef }) {
  const { data, setData, run, reload } = store;
  const sidebar = useSidebarPreference("assets");
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
  const saveTimer = useRef(null);
  const latestAssets = useRef(data.assets);
  const latestGroups = useRef(data.groups || []);
  useEffect(() => {
    latestAssets.current = data.assets;
  }, [data.assets]);
  useEffect(() => {
    latestGroups.current = data.groups || [];
  }, [data.groups]);
  useEffect(() => {
    if (!categories.some((x) => x.id === active))
      setActive(categories[0]?.id || "");
  }, [categories.length, workspaceId]);
  const category = categories.find((x) => x.id === active);
  const shown = data.assets
    .filter((x) => x.workspaceId === workspaceId && x.categoryId === active)
    .map(withUrls);
  const shownGroups = (data.groups || []).filter((group) => group.categoryId === active);
  const localAssets = (items, options = {}) => {
    const map = new Map(items.map((x) => [x.id, x]));
    setData((d) => {
      const assets = d.assets.map((x) =>
        map.get(x.id) ? { ...x, ...map.get(x.id), previewUrl: undefined } : x,
      );
      latestAssets.current = assets;
      return { ...d, assets };
    });
    if(!options.preview)scheduleCommit();
  };
  const localGroups = (items) => {
    const map = new Map(items.map((group) => [group.id, group]));
    const next = (latestGroups.current || []).map((group) => map.get(group.id) ? { ...group, ...map.get(group.id) } : group);
    latestGroups.current = next;
    setData((d) => ({ ...d, groups: (d.groups || []).map((group) => map.get(group.id) ? { ...group, ...map.get(group.id) } : group) }));
  };
  const saveGroups = () => call("save_canvas_groups", {
    items: latestGroups.current
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
      })),
  });
  const saveGroup = (group) => call("save_canvas_groups", {
    items: [{
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
    }],
  }).catch((e) => store.clearError() || alert(e));
  const commitGroups = () => saveGroups().catch((e) => store.clearError() || alert(e));
  const commit = () => {
    if(saveTimer.current){window.clearTimeout(saveTimer.current);saveTimer.current=null;}
    return Promise.all([call("save_canvas_layout", {
      items: latestAssets.current
        .filter((x) => x.categoryId === active)
        .map((x) => ({
          assetId: x.id,
          categoryId: x.categoryId,
          x: x.x,
          y: x.y,
          width: x.width,
          height: x.height,
          rotation: x.rotation || 0,
          zIndex: x.zIndex,
          locked: x.locked,
        })),
    }), saveGroups()]).catch((e) => store.clearError() || alert(e));
  };
  const scheduleCommit = () => {
    if (!data.settings?.autoSave) return;
    if (saveTimer.current) return;
    saveTimer.current = window.setTimeout(() => { saveTimer.current=null; commit(); },(data.settings.autoSaveInterval||30)*1000);
  };
  useEffect(()=>()=>{if(saveTimer.current){window.clearTimeout(saveTimer.current);commit()}},[active,workspaceId]);
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
    setActive(item.categoryId);
    go(`assets/${workspaceId}?category=${item.categoryId}`);
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
      return true;
    };
    const actions = {
      search: () => { sidebar.expand(); setSearchFocusRequest(request => request + 1); return true; },
      save: () => commit(),
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
        requestDeleteAssets(selectedAssets().map((asset) => asset.id));
      },
      paste: async () => {
        const clipboard = assetClipboardRef.current;
        if (!clipboard.length || !active) return false;
        const createdIds = [];
        for (const asset of clipboard) {
          const filePath = asset.storageMode === "managed" ? asset.originalFilePath : asset.sourceFilePath;
          const coverPath = asset.coverImagePath || (asset.coverStorageMode === "managed" ? asset.coverOriginalPath : asset.coverSourcePath);
          const copyId = id("asset");
          await call("save_asset", { item: {
            id: copyId,
            categoryId: active,
            workspaceId,
            name: `${asset.name} 副本`,
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
            zIndex: Math.max(0, ...shown.map((item) => item.zIndex)) + createdIds.length + 1,
            locked: false,
          } });
          createdIds.push(copyId);
        }
        await reload();
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
    <div className="asset-layout sidebar-layout" data-sidebar-expanded={sidebar.expanded}>
      <div id="asset-sidebar" className="sidebar-slot" inert={!sidebar.expanded} aria-hidden={!sidebar.expanded}>
      <AssetSidebar
        searchRef={sidebarSearchRef}
        expanded={sidebar.expanded}
        onToggleSidebar={toggleSidebar}
        active={active}
        search={search}
        onSearch={setSearch}
        onSelect={async (x) => {
          if (!await flushBeforeNavigation()) return;
          setActive(x);
          go(`assets/${workspaceId}?category=${x}`);
        }}
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
      </div>
      <section className="asset-main canvas-page">
        <header className="asset-header canvas-header">
          <div className="sidebar-page-heading">
            <SidebarToggle expanded={sidebar.expanded} onToggle={toggleSidebar} controls="asset-sidebar" showLabel hidden={sidebar.expanded} />
            <div className="sidebar-heading-copy">
              <p className="eyebrow">{workspace.name}</p>
              <h1>{category?.name || "资产"}</h1>
              {category?.description && <p className="asset-description">{category.description}</p>}
            </div>
          </div>
          {category && <div className="canvas-header-actions">
            <button className="secondary" onClick={() => canvas.current?.addText()}><Plus size={16}/>添加文字</button>
            <button className="primary" onClick={() => setDialog("asset")}><Plus size={16} />添加资产</button>
          </div>}
        </header>
        {category ? (
          <>
            <AssetCanvas
              ref={canvas}
              textBlocks={(data.categoryTextBlocks || []).filter(b=>b.categoryId===active)}
              fonts={data.customFonts}
              onSaveTransform={async ({assets,texts,groups,textChanges})=>{
                if(saveTimer.current){window.clearTimeout(saveTimer.current);saveTimer.current=null;}
                await call('save_canvas_transform',{categoryId:active,assets,texts,groups,textChanges});
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
              onGroupsCommit={data.settings?.autoSave ? commitGroups : undefined}
              onGroupSave={saveGroup}
              onCreateGroup={(group, assetIds) => run("create_canvas_group", {
                item: { group, assetIds },
              })}
              onChangeGroupMember={(groupId, assetId, add) => run(
                add ? "add_canvas_group_member" : "remove_canvas_group_member",
                { groupId, assetId },
              )}
              onDeleteGroup={(id) => run("delete_canvas_group", { id })}
              onAssetsCommit={data.settings?.autoSave ? commit : undefined}
              onSaveLayout={commit}
              onCanvasAppearance={({color,pattern})=>{
                setData(d=>({...d,categories:d.categories.map(item=>item.id===active?{...item,canvasColor:color,canvasPattern:pattern}:item)}));
                call("save_canvas_appearance",{categoryId:active,color,pattern}).catch(e=>{store.reload();alert(String(e))});
              }}
              onViewportChange={(v) => {
                setData((d) => ({
                  ...d,
                  categories: d.categories.map((x) =>
                    x.id === active ? { ...x, ...v } : x,
                  ),
                }));
                call("save_viewport", { categoryId: active, ...v }).catch(
                  () => {},
                );
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
                call("save_canvas_layout", {
                  items: [
                    {
                      assetId: asset.id,
                      categoryId: asset.categoryId,
                      x: asset.x,
                      y: asset.y,
                      width: asset.width,
                      height,
                      zIndex: asset.zIndex,
                      locked: asset.locked,
                    },
                  ],
                }).catch(() => {});
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
            setActive(item.id);
            setDialog("");
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

function Detail({ store, workspaceId, assetId, go, registerShortcutActions, shortcuts }) {
  const text = useAssetTextController(assetId,store);
  const flushRef = useRef(() => text.controller.flush());
  const registerFlush = useCallback((flush) => {flushRef.current=flush;return () => {flushRef.current=()=>text.controller.flush();};},[text.controller]);
  const flush = () => flushRef.current();
  useEffect(() => {
    const beforeLeave = event => event.detail.promises.push(flushRef.current());
    window.addEventListener('asset-text-before-leave',beforeLeave);
    return ()=>{window.removeEventListener('asset-text-before-leave',beforeLeave);};
  },[text.controller]);

  const a = store.data.assets.find((x) => x.id === assetId);
  const prompts = store.data.prompts.filter((x) => x.assetId === assetId);
  const canvasObjects = useMemo(()=>store.data.innerCanvasObjects.filter(item=>item.assetId===assetId),[store.data.innerCanvasObjects,assetId]);
  const [viewMode, setViewMode] = useState(a?.detailViewMode || "");
  const [canvasReady, setCanvasReady] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState(null);
  const [copyNotice, setCopyNotice] = useState("");
  const copyTimer = useRef();
  useEffect(() => setViewMode(a?.detailViewMode || ""), [assetId, a?.detailViewMode]);
  useEffect(() => {
    if (viewMode !== "canvas" || !a) {
      setCanvasReady(false);
      return;
    }
    let active = true;
    setCanvasReady(false);
    store.run("ensure_asset_inner_canvas", { assetId })
      .then(() => { if (active) setCanvasReady(true); })
      .catch(() => { if (active) setCanvasReady(true); });
    return () => { active = false; };
  }, [assetId, viewMode]);
  useEffect(() => () => clearTimeout(copyTimer.current), []);
  const changeViewMode = async (mode) => {
    if (mode === viewMode) return;
    try {await flush();} catch {return;}
    await store.run("save_asset_detail_view_mode", { assetId, mode });
    setViewMode(mode);
  };
  const textProps = {
    textController:text.controller,
    textBlocks:projectTextItems(text.elements,text.layouts,viewMode).map(i=>({...i,id:i.objectId,content:i.textValue})),
    fonts:store.data.customFonts,
    onDraft:items=>text.controller.draft(viewMode,items),
    onRegisterFlush:registerFlush,
    registerShortcutActions,shortcuts,
  };
  const copy = async (text) => {
    if (!text?.trim()) {
      setCopyNotice("暂无内容");
    } else {
      try {
        await navigator.clipboard.writeText(text);
        setCopyNotice("已复制");
      } catch {
        const area = document.createElement("textarea");
        area.value = text;
        area.style.cssText = "position:fixed;opacity:0;pointer-events:none";
        document.body.appendChild(area);
        area.select();
        const copied = document.execCommand("copy");
        area.remove();
        setCopyNotice(copied ? "已复制" : "复制失败");
      }
    }
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopyNotice(""), 1600);
  };
  if (!a)
    return (
      <Empty
        icon={FileBox}
        title="找不到这个资产"
        text="资产可能已删除。"
        action="返回"
        onAction={() => go(`assets/${workspaceId}`)}
      />
    );
  if (!viewMode)
    return (
      <section className="detail-mode-chooser">
        <header>
          <p className="eyebrow">{a.name}</p>
          <h1>选择资产详情显示方式</h1>
        </header>
        <div className="detail-mode-cards">
          <button className="detail-mode-card" onClick={() => changeViewMode("standard")}>
            <span><Image size={20} /></span>
            <strong>标准详情</strong>
            <small>按顺序查看样图、Prompt 和参数</small>
          </button>
          <button className="detail-mode-card" onClick={() => changeViewMode("canvas")}>
            <span><Layers3 size={20} /></span>
            <strong>内画布</strong>
            <small>自由摆放样图、Prompt 和笔记</small>
          </button>
        </div>
        <p className="detail-mode-footnote">以后仍可在详情页中切换</p>
      </section>
    );
  if (viewMode === "canvas") {
    const canvasViewport = store.data.innerCanvasViewports.find((item) => item.assetId === assetId);
    const ownAppearance = (store.data.innerCanvasAppearances || []).find(item => item.assetId === assetId);
    const inheritedAppearance = resolveCanvasAppearance(store.data.categories.find(item => item.id === a.categoryId), store.data.settings);
    const saveAppearance = async appearance => {
      const update = value => store.setData(d => ({...d, innerCanvasAppearances: [...(d.innerCanvasAppearances || []).filter(item => item.assetId !== assetId), ...(value ? [{assetId, ...value}] : [])]}));
      update(appearance);
      try { await call("save_asset_inner_canvas_appearance", {assetId, color: appearance?.color ?? null, pattern: appearance?.pattern ?? null}); }
      catch (error) { update(ownAppearance); throw error; }
    };
    const saveObjects = (items,options={}) => text.controller.commit('canvas',[...items,...(options.textBlocks || [])],items);
    const addSample = (center) => {
      const params = new URLSearchParams({ inner: "1", centerX: String(center.x), centerY: String(center.y) });
      go(`add-example/${workspaceId}/${assetId}?${params.toString()}`);
    };
    return (
      <section className="asset-inner-detail">
        <header className="inner-detail-header">
          <div>
            <p className="eyebrow">资产内画布</p>
            <h1>{a.name}</h1>
            {a.description && <p className="inner-detail-description">{a.description}</p>}
          </div>
          <div className="detail-view-toggle" aria-label="资产详情显示方式">
            <button className="" onClick={() => changeViewMode("standard")}>标准详情</button>
            <button className="active" aria-current="page">内画布</button>
          </div>
        </header>
        {text.error && <div className="asset-text-save-error" role="alert"><span>文字尚未保存：{text.error}</span><button className="secondary" onClick={()=>flush().catch(()=>{})}>重试保存</button></div>}
        {canvasReady ? (
          <AssetInnerCanvas
            key={assetId}
            assetId={assetId}
            canvasAppearance={ownAppearance || inheritedAppearance}
            hasOwnAppearance={!!ownAppearance}
            onSaveAppearance={saveAppearance}
            objects={canvasObjects}
            {...textProps}
            prompts={prompts}
            initialViewport={canvasViewport}
            onSaveObjects={saveObjects}
            onSaveViewport={(viewport) => call("save_asset_inner_canvas_viewport", { assetId, viewportX: viewport.x, viewportY: viewport.y, zoom: viewport.zoom }).catch(() => {})}
            onAddSample={addSample}
            onEditPrompt={(promptId) => setEditingPrompt(prompts.find((prompt) => prompt.id === promptId) || null)}
          />
        ) : (
          <div className="inner-canvas-loading">正在准备资产内画布…</div>
        )}
        {editingPrompt && <PromptEditDialog store={store} prompt={editingPrompt} onClose={() => setEditingPrompt(null)} />}
        {copyNotice && <div className="toast copy-toast">{copyNotice}</div>}
      </section>
    );
  }
  return (
    <section className="asset-detail-main">
      <header className="asset-detail-header">
        <div>
          <p className="eyebrow">资产详情</p>
          <h1>{a.name}</h1>
          <p>{a.description || "暂无简介。"}</p>
          <div className="asset-metadata">
            <span>
              存储方式：{a.storageMode === "managed" ? "托管" : "引用"}
            </span>
            <span>文件：{a.originalFilePath || a.sourceFilePath}</span>
          </div>
        </div>
        <div className="detail-header-actions">
          <div className="detail-view-toggle" aria-label="资产详情显示方式">
            <button className="active" aria-current="page">标准详情</button>
            <button onClick={() => changeViewMode("canvas")}>内画布</button>
          </div>
          <button className="primary" onClick={() => go(`add-example/${workspaceId}/${assetId}`)}>
            <Plus size={16} />
            新增样图
          </button>
        </div>
      </header>
      {text.error && <div className="asset-text-save-error" role="alert"><span>文字尚未保存：{text.error}</span><button className="secondary" onClick={()=>flush().catch(()=>{})}>重试保存</button></div>}
      <AssetStandardTextLayer assetId={assetId} {...textProps} prompts={prompts} onSaveObjects={(items,options={})=>text.controller.commit('standard',options.textBlocks || [])} onAddSample={()=>go(`add-example/${workspaceId}/${assetId}`)} onEditPrompt={promptId=>setEditingPrompt(prompts.find(p=>p.id===promptId)||null)}>
      {prompts.length ? (
        <div className="sample-case-list">
          {prompts.map((p) => {
            const fivePoints = p.content.split(/\r?\n/).filter((x) => x.trim());
            const copyAll =
              p.promptType === "positive-negative"
                ? `正面提示词：\n${p.positivePrompt}\n\n负面提示词：\n${p.negativePrompt}`
                : p.content;
            return (
              <article className="sample-case-row" key={p.id}>
                <div className="sample-case-image">
                  {p.sampleImagePath ? (
                    <img src={fileUrl(p.sampleImagePath)} alt={p.title} />
                  ) : (
                    <div className="sample-image-missing">样图文件不可用</div>
                  )}
                  {p.sampleFileName && <small>{p.sampleFileName}</small>}
                </div>
                <div className="sample-case-content">
                  <div className="sample-case-heading">
                    <div>
                      <p className="eyebrow">样图案例</p>
                      <h2>{p.title}</h2>
                    </div>
                    <div className="sample-case-actions">
                      {(p.promptType === "positive-negative" ||
                        p.promptType === "five-point") && (
                        <button
                          className="copy-button"
                          disabled={!copyAll.trim()}
                          onClick={() => copy(copyAll)}
                        >
                          复制全部
                        </button>
                      )}
                      <button className="copy-button" onClick={() => setEditingPrompt(p)}>编辑</button>
                      <span>{promptTypeLabel(p.promptType)}</span>
                    </div>
                  </div>
                  {p.promptType === "positive-negative" && (
                    <>
                      <PromptReadOnly
                        label="正面提示词"
                        value={p.positivePrompt}
                        onCopy={() => copy(p.positivePrompt)}
                      />
                      <PromptReadOnly
                        label="负面提示词"
                        value={p.negativePrompt}
                        muted
                        onCopy={() => copy(p.negativePrompt)}
                      />
                    </>
                  )}
                  {p.promptType === "natural" && (
                    <PromptReadOnly
                      label="自然语言提示词"
                      value={p.naturalPrompt}
                      onCopy={() => copy(p.naturalPrompt)}
                    />
                  )}
                  {p.promptType === "five-point" &&
                    (fivePoints.length ? fivePoints : [p.content]).map(
                      (value, index) => (
                        <PromptReadOnly
                          key={index}
                          label={`第 ${index + 1} 项`}
                          value={value}
                          onCopy={() => copy(value)}
                        />
                      ),
                    )}
                  {p.promptType === "none" && (
                    <div className="no-prompt compact">
                      <Check size={16} />
                      此案例没有 Prompt
                    </div>
                  )}
                  {p.notes && <p className="sample-notes">备注：{p.notes}</p>}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <Empty
          icon={ImagePlus}
          title="暂无样图案例"
          text="点击新增样图开始记录。"
          action="新增样图"
          onAction={() => go(`add-example/${workspaceId}/${assetId}`)}
        />
      )}
      </AssetStandardTextLayer>
      {copyNotice && <div className="toast copy-toast">{copyNotice}</div>}
      {editingPrompt && <PromptEditDialog store={store} prompt={editingPrompt} onClose={() => setEditingPrompt(null)} />}
    </section>
  );
}

function PromptEditDialog({ store, prompt, onClose }) {
  const type = prompt.promptType;
  const [form, setForm] = useState({
    title: prompt.title || "",
    positivePrompt: prompt.positivePrompt || "",
    negativePrompt: prompt.negativePrompt || "",
    naturalPrompt: prompt.naturalPrompt || "",
    content: prompt.content || "",
    notes: prompt.notes || "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  return (
    <Dialog
      title="编辑样图案例"
      canSubmit={!saving && Boolean(form.title.trim())}
      onCancel={onClose}
      onSubmit={async () => {
        setSaving(true);
        setError("");
        try {
          await store.run("update_prompt_content", { item: { id: prompt.id, promptType: type, ...form } });
          onClose();
        } catch (reason) {
          setError(String(reason));
        } finally {
          setSaving(false);
        }
      }}
    >
      <Field label="标题"><input required value={form.title} onChange={(event) => set("title", event.target.value)} /></Field>
      <Field label="Prompt 类型"><span className="detail-prompt-type">{promptTypeLabel(type)}</span></Field>
      {type === "positive-negative" && <div className="two-columns">
        <Field label="正面提示词"><textarea rows="6" value={form.positivePrompt} onChange={(event) => set("positivePrompt", event.target.value)} /></Field>
        <Field label="负面提示词"><textarea rows="6" value={form.negativePrompt} onChange={(event) => set("negativePrompt", event.target.value)} /></Field>
      </div>}
      {type === "natural" && <Field label="自然语言 Prompt"><textarea rows="7" value={form.naturalPrompt} onChange={(event) => set("naturalPrompt", event.target.value)} /></Field>}
      {type === "five-point" && <Field label="Prompt 内容"><textarea rows="7" value={form.content} onChange={(event) => set("content", event.target.value)} /></Field>}
      <Field label="备注"><textarea rows="3" value={form.notes} onChange={(event) => set("notes", event.target.value)} /></Field>
      {error && <div className="form-error" role="alert">{error}</div>}
      {saving && <small className="dialog-status">正在保存…</small>}
    </Dialog>
  );
}

function Example({ store, workspaceId, assetId, go, query }) {
  const asset = store.data.assets.find((item) => item.id === assetId);
  const [type, setType] = useState("positive-negative");
  const [sample, setSample] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    positivePrompt: "",
    negativePrompt: "",
    naturalPrompt: "",
    content: "",
    notes: "",
  });
  const set = (k, v) => setForm((x) => ({ ...x, [k]: v }));
  const acceptImagePath = (path, name = "") => {
    if (!path) return;
    const fileName = name || path.split(/[\\/]/).pop() || "样图";
    if (!/\.(png|jpe?g|webp)$/i.test(fileName)) {
      setError("请选择 PNG、JPG、JPEG 或 WEBP 图片。");
      return;
    }
    setError("");
    setSample({ path, name: fileName, previewUrl: fileUrl(path) });
  };
  const importImageBytes = async (file) => {
    if (
      !file?.type?.startsWith("image/") ||
      !/\.(png|jpe?g|webp)$/i.test(
        file.name || `image.${file.type.split("/")[1]}`,
      )
    ) {
      setError("请选择 PNG、JPG、JPEG 或 WEBP 图片。");
      return;
    }
    const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
    const extension =
      file.name?.split(".").pop() || file.type.split("/")[1] || "png";
    const path = await call("save_clipboard_sample_image", {
      bytes,
      extension,
    });
    acceptImagePath(path, file.name || `clipboard.${extension}`);
  };
  const chooseImage = async () => {
    const path = await call("pick_cover_image");
    if (path) acceptImagePath(path);
  };

  useEffect(() => {
    const paste = async (event) => {
      const image = [...(event.clipboardData?.items || [])].find((item) =>
        item.type.startsWith("image/"),
      );
      if (!image) return;
      event.preventDefault();
      try {
        await importImageBytes(image.getAsFile());
      } catch (reason) {
        setError(String(reason));
      }
    };
    window.addEventListener("paste", paste);
    let unlisten;
    if (window.__TAURI_INTERNALS__) {
      getCurrentWebview()
        .onDragDropEvent((event) => {
          if (event.payload.type === "over") setDragging(true);
          if (event.payload.type === "leave") setDragging(false);
          if (event.payload.type === "drop") {
            setDragging(false);
            const path = event.payload.paths?.find((item) =>
              /\.(png|jpe?g|webp)$/i.test(item),
            );
            if (path) acceptImagePath(path);
            else setError("拖入的文件不是受支持的图片。");
          }
        })
        .then((dispose) => {
          unlisten = dispose;
        })
        .catch((reason) => setError(`拖拽监听启动失败：${String(reason)}`));
    }
    return () => {
      window.removeEventListener("paste", paste);
      unlisten?.();
    };
  }, []);

  return (
    <form
      className="editor-page"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!sample) {
          setError("请先选择一张样图图片。");
          return;
        }
        setSaving(true);
        setError("");
        try {
          const promptId = id("prompt");
          await store.run("save_prompt", {
            item: {
              id: promptId,
              assetId,
              promptType: type,
              selectedImagePath: sample.path,
              sampleStorageMode: asset?.storageMode || "reference",
              sampleSourcePath: "",
              sampleOriginalPath: "",
              sampleImagePath: "",
              sampleFileName: sample.name,
              metadataJson: JSON.stringify({
                schemaVersion: 1,
                comfyUi: null,
                seed: null,
                steps: null,
                cfg: null,
                sampler: null,
                scheduler: null,
                loras: [],
                workflow: null,
              }),
              ...form,
              createdAt: now(),
              updatedAt: now(),
            },
          });
          if (query.get("inner") === "1") {
            await call("ensure_asset_inner_canvas", { assetId });
            const state = await call("load_app_state");
            const caseObjects = state.innerCanvasObjects.filter((item) => item.assetId === assetId && item.sourcePromptId === promptId);
            const sampleObject = caseObjects.find((item) => item.objectType === "sample");
            const centerX = Number(query.get("centerX"));
            const centerY = Number(query.get("centerY"));
            if (sampleObject && Number.isFinite(centerX) && Number.isFinite(centerY)) {
              const dx = centerX - sampleObject.x - sampleObject.width / 2;
              const dy = centerY - sampleObject.y - sampleObject.height / 2;
              await call("save_asset_inner_canvas_layout", {
                assetId,
                objects: caseObjects.map((item) => ({ ...item, x: item.x + dx, y: item.y + dy })),
              });
            }
          }
          go(`asset/${workspaceId}/${assetId}`);
        } catch (reason) {
          setError(String(reason));
        } finally {
          setSaving(false);
        }
      }}
    >
      <header className="editor-header">
        <p className="eyebrow">资产案例</p>
        <h1>新增样图案例</h1>
        <p>为当前资产保存一张样图及其生成提示词。</p>
      </header>
      <div className="sample-editor-upper">
        <section
          className={`sample-upload ${dragging ? "is-dragging" : ""} ${sample ? "has-image" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={async (e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) {
              try {
                await importImageBytes(file);
              } catch (reason) {
                setError(String(reason));
              }
            }
          }}
        >
          <div className="sample-upload-label">
            <span>样图图片</span>
            <small>必填</small>
          </div>
          {sample ? (
            <>
              <div className="sample-preview">
                <img src={sample.previewUrl} alt="样图预览" />
              </div>
              <div className="sample-file-row">
                <span title={sample.name}>{sample.name}</span>
                <div>
                  <button
                    type="button"
                    className="secondary"
                    onClick={chooseImage}
                  >
                    更换图片
                  </button>
                  <button
                    type="button"
                    className="secondary danger"
                    onClick={() => setSample(null)}
                  >
                    移除图片
                  </button>
                </div>
              </div>
            </>
          ) : (
            <button
              type="button"
              className="sample-drop-target"
              onClick={chooseImage}
            >
              <span className="upload-icon">
                <UploadCloud size={26} />
              </span>
              <strong>点击选择或拖拽图片到这里</strong>
              <small>支持 PNG、JPG、JPEG、WEBP，也可直接粘贴剪贴板图片</small>
            </button>
          )}
        </section>
        <section className="sample-basic-fields">
          <Field label="标题">
            <input
              required
              autoFocus
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="为这个案例填写一个标题"
            />
          </Field>
          <Field label="Prompt 类型">
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="positive-negative">正面 + 负面</option>
              <option value="natural">自然语言</option>
              <option value="five-point">五点式</option>
              <option value="none">无提示词</option>
            </select>
          </Field>
          <div className="sample-storage-note">
            <FileBox size={17} />
            <span>
              样图将按照当前资产的“
              {asset?.storageMode === "managed" ? "托管" : "引用"}
              ”方式保存。剪贴板图片会自动托管。
            </span>
          </div>
        </section>
      </div>
      <section className="prompt-editor">
        <div className="section-heading">
          <div>
            <h2>Prompt 内容</h2>
            <p>根据选择的记录方式填写对应内容。</p>
          </div>
        </div>
        {type === "positive-negative" ? (
          <div className="two-columns">
            <Field label="正面提示词">
              <textarea
                rows="7"
                onChange={(e) => set("positivePrompt", e.target.value)}
              />
            </Field>
            <Field label="负面提示词">
              <textarea
                rows="7"
                onChange={(e) => set("negativePrompt", e.target.value)}
              />
            </Field>
          </div>
        ) : type === "natural" ? (
          <Field label="自然语言提示词">
            <textarea
              rows="7"
              onChange={(e) => set("naturalPrompt", e.target.value)}
            />
          </Field>
        ) : type === "none" ? null : (
          <Field label="五点式内容">
            <textarea
              rows="8"
              onChange={(e) => set("content", e.target.value)}
            />
          </Field>
        )}
        <Field label="备注 / 使用建议">
          <textarea rows="3" onChange={(e) => set("notes", e.target.value)} />
        </Field>
      </section>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      <footer className="editor-actions">
        <button
          type="button"
          className="secondary"
          onClick={() => go(`asset/${workspaceId}/${assetId}`)}
        >
          取消
        </button>
        <button className="primary" disabled={saving || !sample}>
          <Save size={16} />
          {saving ? "正在保存…" : "保存"}
        </button>
      </footer>
    </form>
  );
}

function AssetDialog({
  settings,
  categories,
  currentCategoryId,
  initial,
  onCancel,
  onConfirm,
}) {
  const [form, setForm] = useState({
    name: initial?.name || "",
    description: initial?.description || "",
    categoryId: initial?.categoryId || currentCategoryId,
    storageMode: initial?.storageMode || settings.defaultImportMode,
    selectedFilePath: "",
    coverStorageMode: initial?.coverStorageMode || "managed",
    selectedCoverPath: "",
    useSourceAsCover: false,
    filePath: initial?.filePath || "",
    tags: (initial?.tags || []).join(", "),
    notes: initial?.notes || "",
  });
  // Existing assets already have a user-visible name.  Treat that value as
  // manual so choosing a replacement file cannot unexpectedly rename it.
  const [nameWasManuallyEdited, setNameWasManuallyEdited] = useState(
    Boolean(initial?.name),
  );
  const set = (k, v) => setForm((x) => ({ ...x, [k]: v }));
  return (
    <Dialog
      title={initial ? "编辑资产" : "新增资产"}
      canSubmit={Boolean(
        form.name.trim() && (initial || form.selectedFilePath),
      )}
      onCancel={onCancel}
      onSubmit={() =>
        onConfirm({
          ...initial,
          ...form,
          name: form.name.trim(),
          tags: form.tags
            .split(/[,，]/)
            .map((x) => x.trim())
            .filter(Boolean),
        })
      }
    >
      <div className="dialog-field-grid">
        <Field label="名称">
          <input
            autoFocus
            value={form.name}
            onChange={(e) => {
              const name = e.target.value;
              set("name", name);
              // Clearing a name deliberately re-enables file-name generation.
              setNameWasManuallyEdited(Boolean(name));
            }}
          />
        </Field>
        <Field label="所属分类">
          <select
            value={form.categoryId}
            onChange={(e) => set("categoryId", e.target.value)}
          >
            {categories.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="存储方式">
          <select
            value={form.storageMode}
            onChange={(e) => set("storageMode", e.target.value)}
          >
            <option value="managed">托管到资产库</option>
            <option value="reference">仅引用原文件</option>
          </select>
        </Field>
        <Field label="原始文件（任意格式）">
          <div className="path-row">
            <input
              readOnly
              value={
                form.selectedFilePath ||
                initial?.originalFilePath ||
                initial?.sourceFilePath ||
                ""
              }
            />
            <button
              type="button"
              className="secondary"
              onClick={async () => {
                const p = await call("pick_asset_file");
                if (p) {
                  const generatedName = assetNameFromPath(p);
                  setForm((current) => ({
                    ...current,
                    selectedFilePath: p,
                    name:
                      !current.name.trim() || !nameWasManuallyEdited
                        ? generatedName
                        : current.name,
                  }));
                }
              }}
            >
              选择
            </button>
          </div>
        </Field>
        <Field label="封面图片（可选）">
          <div className="path-row">
            <input
              readOnly
              value={
                form.selectedCoverPath ||
                initial?.coverOriginalPath ||
                initial?.coverSourcePath ||
                ""
              }
              placeholder="未选择时使用通用文件图标"
            />
            <button
              type="button"
              className="secondary"
              disabled={form.useSourceAsCover}
              onClick={async () => {
                const p = await call("pick_cover_image");
                if (p) set("selectedCoverPath", p);
              }}
            >
              选择图片
            </button>
          </div>
        </Field>
        <Field label="封面存储方式">
          <select
            value={form.coverStorageMode}
            onChange={(e) => set("coverStorageMode", e.target.value)}
            disabled={form.useSourceAsCover && form.storageMode === "managed"}
          >
            <option value="managed">托管封面</option>
            <option value="reference">引用封面原文件</option>
          </select>
        </Field>
        <label className="check-row dialog-check-row">
          <input
            type="checkbox"
            checked={form.useSourceAsCover}
            onChange={(e) => set("useSourceAsCover", e.target.checked)}
          />
          <span>使用原始资产文件作为封面（仅当原始文件是图片时）</span>
        </label>
        <Field label="简介">
          <textarea
            rows="3"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </Field>
        <Field label="标签">
          <input
            value={form.tags}
            onChange={(e) => set("tags", e.target.value)}
          />
        </Field>
        <Field label="备注">
          <textarea
            rows="3"
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </Field>
      </div>
    </Dialog>
  );
}
function ModelDialog({ title, model, onCancel, onConfirm }) {
  const [f, setF] = useState(() => ({
    name: model?.name || "",
    description: model?.description || "",
    coverPath: model?.coverPath || "",
    notes: model?.notes || "",
  }));
  return (
    <Dialog
      title={title}
      canSubmit={Boolean(f.name.trim())}
      onCancel={onCancel}
      onSubmit={() => onConfirm({ ...f, name: f.name.trim() })}
    >
      <Field label="模型名称">
        <input
          autoFocus
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
        />
      </Field>
      <Field label="简介">
        <textarea
          rows="3"
          value={f.description}
          onChange={(e) => setF({ ...f, description: e.target.value })}
        />
      </Field>
      <Field label="封面（可选）">
        <div className="path-row">
          <input readOnly value={f.coverPath} placeholder="未选择封面" />
          <button
            type="button"
            className="secondary"
            onClick={async () => {
              const coverPath = await call("pick_cover_image");
              if (coverPath) setF({ ...f, coverPath });
            }}
          >
            选择封面
          </button>
        </div>
        {f.coverPath && (
          <>
            <img
              className="model-cover-preview"
              src={fileUrl(f.coverPath)}
              alt="模型封面预览"
            />
            <button
              type="button"
              className="link-button"
              onClick={() => setF({ ...f, coverPath: "" })}
            >
              清除封面
            </button>
          </>
        )}
      </Field>
      <Field label="备注">
        <textarea
          rows="3"
          value={f.notes}
          onChange={(e) => setF({ ...f, notes: e.target.value })}
        />
      </Field>
    </Dialog>
  );
}
function WorkspaceDeleteConfirm({
  workspace,
  categories,
  assets,
  onCancel,
  onConfirm,
}) {
  const [deleteManaged, setDeleteManaged] = useState(false);
  const managed = assets.filter((x) => x.storageMode === "managed").length;
  const empty = !categories.length && !assets.length;
  return (
    <div className="dialog-backdrop">
      <form
        className="category-dialog wide"
        role="dialog"
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm(deleteManaged);
        }}
      >
        <header>
          <h2>删除模型</h2>
          <p>此操作会清理脚本集合器中的模型管理数据。</p>
        </header>
        <div className="dialog-fields confirm-copy">
          <p>
            {empty
              ? `确定删除模型 “${workspace.name}” 吗？`
              : `该模型中包含：\n${categories.length} 个分类\n${assets.length} 个资产`}
          </p>
          {!empty && (
            <small>
              删除模型将同时删除这些分类、资产记录、提示词和画布布局。
            </small>
          )}
          {managed > 0 && (
            <div className="managed-delete-choice">
              <strong>其中有 {managed} 个托管模式资产</strong>
              <label>
                <input
                  type="radio"
                  checked={!deleteManaged}
                  onChange={() => setDeleteManaged(false)}
                />
                仅删除模型和数据库记录，保留托管文件
              </label>
              <label>
                <input
                  type="radio"
                  checked={deleteManaged}
                  onChange={() => setDeleteManaged(true)}
                />
                同时删除脚本集合器管理的托管文件
              </label>
            </div>
          )}
          <small>引用模式资产指向的用户硬盘原文件无论如何都不会删除。</small>
        </div>
        <footer>
          <button type="button" className="secondary" onClick={onCancel}>
            取消
          </button>
          <button className="danger-button">删除</button>
        </footer>
      </form>
    </div>
  );
}
function CategoryDialog({ title, category, onCancel, onConfirm }) {
  const [name, setName] = useState(category?.name || "");
  const [description, setDescription] = useState(category?.description || "");
  return (
    <Dialog
      title={title}
      canSubmit={Boolean(name.trim())}
      onCancel={onCancel}
      onSubmit={() =>
        onConfirm({ name: name.trim(), description: description.trim() })
      }
    >
      <Field label="分类名称">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field label="分类简介（可选）">
        <textarea
          rows="3"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
    </Dialog>
  );
}
function ScriptDialog({ script, onCancel, onConfirm }) {
  const [form, setForm] = useState({
    name: script?.name || "",
    description: script?.description || "",
    filePath: script?.filePath || "",
    launchCommand: script?.launchCommand || "",
    launchArgs: script?.launchArgs || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  return (
    <Dialog
      title={script ? "编辑脚本" : "新增脚本"}
      canSubmit={Boolean(
        !saving &&
        form.name.trim() &&
        (form.filePath.trim() || form.launchCommand.trim()),
      )}
      onCancel={onCancel}
      onSubmit={async () => {
        setSaving(true);
        setError("");
        try {
          await onConfirm({
            ...form,
            name: form.name.trim(),
            description: form.description.trim(),
            filePath: form.filePath.trim(),
            launchCommand: form.launchCommand.trim(),
            launchArgs: form.launchArgs.trim(),
          });
        } catch (reason) {
          setError(String(reason));
          setSaving(false);
        }
      }}
    >
      <Field label="脚本名称">
        <input
          autoFocus
          value={form.name}
          onChange={(event) => set("name", event.target.value)}
        />
      </Field>
      <Field label="脚本简介">
        <textarea
          rows="3"
          value={form.description}
          onChange={(event) => set("description", event.target.value)}
        />
      </Field>
      <Field label="脚本文件路径">
        <div className="path-row">
          <input
            value={form.filePath}
            onChange={(event) => set("filePath", event.target.value)}
            placeholder="选择 .ps1、.bat、.cmd、.py、.exe 或其他文件"
          />
          <button
            type="button"
            className="secondary"
            onClick={async () => {
              const path = await call("pick_script_file");
              if (!path) return;
              setForm((current) => ({
                ...current,
                filePath: path,
                name: current.name || assetNameFromPath(path),
              }));
            }}
          >
            浏览
          </button>
        </div>
      </Field>
      <Field label="启动文件 / 启动命令">
        <input
          value={form.launchCommand}
          onChange={(event) => set("launchCommand", event.target.value)}
          placeholder="可留空，默认直接启动上方文件"
        />
      </Field>
      <Field label="启动参数（可选）">
        <input
          value={form.launchArgs}
          onChange={(event) => set("launchArgs", event.target.value)}
          placeholder='例如：--port 8080 或 "D:\工作目录"'
        />
      </Field>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {saving && <small className="dialog-status">正在保存…</small>}
    </Dialog>
  );
}
function Dialog({ title, children, canSubmit, onSubmit, onCancel }) {
  return (
    <div className="dialog-backdrop">
      <form
        className="category-dialog wide"
        role="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) onSubmit();
        }}
      >
        <header>
          <h2>{title}</h2>
          <p>填写信息后保存到本地。</p>
        </header>
        <div className="dialog-fields">{children}</div>
        <footer>
          <button type="button" className="secondary" onClick={onCancel}>
            取消
          </button>
          <button className="primary" disabled={!canSubmit}>
            保存
          </button>
        </footer>
      </form>
    </div>
  );
}
function Confirm({ title, text, disabled, onCancel, onConfirm }) {
  return (
    <Dialog
      title={title}
      canSubmit={!disabled}
      onCancel={onCancel}
      onSubmit={onConfirm}
    >
      <p>{text}</p>
    </Dialog>
  );
}
function Empty({ icon: Icon, title, text, action, onAction }) {
  return (
    <div className="empty-workspace">
      <span className="empty-icon">
        <Icon size={27} />
      </span>
      <h2>{title}</h2>
      <p>{text}</p>
      {action && (
        <button className="primary" onClick={onAction}>
          <Plus size={16} />
          {action}
        </button>
      )}
    </div>
  );
}
function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function promptTypeLabel(type) {
  return (
    {
      "positive-negative": "正面 + 负面",
      natural: "自然语言",
      "five-point": "五点式",
      none: "无提示词",
    }[type] || "Prompt"
  );
}
function PromptReadOnly({ label, value, muted = false, onCopy }) {
  return (
    <div className={`prompt-block ${muted ? "muted" : ""}`}>
      <div>
        <span>{label}</span>
        {onCopy && (
          <button
            className="copy-button"
            disabled={!value?.trim()}
            onClick={onCopy}
          >
            复制
          </button>
        )}
      </div>
      <p>{value || "未填写"}</p>
    </div>
  );
}
function SettingsGroup({ title, children }) {
  return (
    <section className="settings-group">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
function Radio({ checked, onChange, title, text }) {
  return (
    <label className="setting-choice">
      <input type="radio" checked={checked} onChange={onChange} />
      <span>
        <strong>{title}</strong>
        <small>{text}</small>
      </span>
    </label>
  );
}
function CheckRow({ checked, onChange, label }) {
  return (
    <label className="check-row">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
function NumberRow({ label, value, onChange }) {
  return (
    <label className="number-row">
      <span>{label}</span>
      <input
        type="number"
        min="100"
        max="8192"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <small>px</small>
    </label>
  );
}

export default function App() {
  const store = useStore();
  const [closeError, setCloseError] = useState('');
  useEffect(() => {
    if(!window.__TAURI_INTERNALS__)return;
    let active=true,unlisten;
    const close = createCloseRequestHandler({
      flush: flushBeforeNavigation,
      finish: () => call('finish_window_close'),
      onError: error => { if(active)setCloseError(error); },
    });
    listen('app-close-requested',close).then(async stop=>{
      if(!active){stop();return;}
      unlisten=stop;
      await call('set_asset_text_close_guard',{enabled:true});
    }).catch(error=>{if(active)setCloseError(`关闭保护初始化失败：${String(error)}`);});
    return ()=>{
      active=false;
      if(unlisten){unlisten();call('set_asset_text_close_guard',{enabled:false}).catch(()=>{});}
    };
  },[]);
  const { parts, query, go } = useHashRoute();
  const page = parts[0] || "home";
  const [immersive,setImmersive] = useState(false);
  const shortcutActionsRef = useRef({});
  const assetClipboardRef = useRef([]);
  const shortcuts = useMemo(() => resolveShortcuts(store.data.shortcutBindings || []), [store.data.shortcutBindings]);
  const registerShortcutActions = useCallback((actions) => { shortcutActionsRef.current = actions; }, []);
  const didRestore = useRef(false);
  const skipInitialPageSave = useRef(true);
  useEffect(()=>{
    if (store.loading || !store.data.settings || didRestore.current) return;
    didRestore.current = true;
    const s=store.data.settings;
    let destination=s.startupPage==="last" ? s.lastPage : s.startupPage;
    if (!s.restoreWorkspace && /^(assets|asset|add-example)\//.test(destination||"")) destination="models";
    if (destination && destination!=="home") go(destination);
    else call("save_last_page",{page:"home"}).catch(()=>{});
  },[store.loading,store.data.settings]);
  useEffect(()=>{
    if (!didRestore.current || store.loading) return;
    if(skipInitialPageSave.current){skipInitialPageSave.current=false;return;}
    call("save_last_page",{page:window.location.hash.replace(/^#\/?/,"")||"home"}).catch(()=>{});
  },[parts.join("/"),query.toString(),store.loading]);
  useEffect(()=>{
    const s=store.data.settings;
    if (!s) return;
    applyTheme(s.theme);
    document.documentElement.dataset.density=s.uiDensity;
    document.documentElement.style.setProperty("--ui-scale",(s.uiScale||100)/100);
  },[store.data.settings?.theme,store.data.settings?.uiScale,store.data.settings?.uiDensity]);
  let content = <Home go={go} />;
  if (page === "scripts") content = <Scripts store={store} />;
  if (page === "models") content = <Models store={store} go={go} />;
  if (page === "assets")
    content = (
      <Assets
        store={store}
        workspaceId={parts[1]}
        initialCategoryId={query.get("category") || ""}
        go={go}
        registerShortcutActions={registerShortcutActions}
        assetClipboardRef={assetClipboardRef}
      />
    );
  if (page === "asset")
    content = (
      <Detail key={parts[2]} store={store} workspaceId={parts[1]} assetId={parts[2]} go={go} registerShortcutActions={registerShortcutActions} shortcuts={shortcuts} />
    );
  if (page === "add-example")
    content = (
      <Example
        store={store}
        workspaceId={parts[1]}
        assetId={parts[2]}
        query={query}
        go={go}
      />
    );
  if (page === "settings") content = <SettingsPage store={store} />;
  const back = () =>
    page === "assets"
      ? go("models")
      : page === "asset"
        ? go(`assets/${parts[1]}`)
        : page === "add-example"
          ? go(`asset/${parts[1]}/${parts[2]}`)
          : go("home");
  const executeAction = async (actionId) => {
    if (actionId === "back") { back(); return true; }
    if (actionId === "open-settings") { go("settings"); return true; }
    if (actionId === "close-window") {
      if (!window.__TAURI_INTERNALS__) return false;
      await getCurrentWindow().close();
      return true;
    }
    if (actionId === "search") {
      if (page === "assets" && shortcutActionsRef.current.search) {
        setImmersive(false);
        return shortcutActionsRef.current.search();
      }
      const field = document.querySelector("[data-shortcut-search]");
      field?.focus();
      field?.select?.();
      return Boolean(field);
    }
    if (actionId === "canvas-immersive") {
      if (page !== "assets") return false;
      setImmersive((value) => !value);
      return true;
    }
    const handler = shortcutActionsRef.current[actionId];
    return typeof handler === "function" ? (await handler()) !== false : false;
  };
  const dispatchMenuAction = (actionId) => {
    const activeElement = document.activeElement;
    const editable = activeElement?.closest?.('input,textarea,[contenteditable]:not([contenteditable="false"]),[role="textbox"]');
    if (editable) {
      const command = { undo: "undo", redo: "redo", cut: "cut", copy: "copy", paste: "paste", delete: "delete", "select-all": "selectAll" }[actionId];
      if (actionId === "select-all" && typeof editable.select === "function") { editable.select(); return true; }
      if (command) return document.execCommand(command);
    }
    return executeAction(actionId);
  };
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.defaultPrevented || event.isComposing || event.repeat && event.key === "Tab") return;
      if (document.querySelector('[role="dialog"]')) return;
      const key = shortcutFromEvent(event);
      if (!key) return;
      const editable = event.target?.closest?.('input,textarea,[contenteditable]:not([contenteditable="false"]),[role="textbox"]');
      const runtimeScope = editable ? "text" : ["assets","asset"].includes(page) ? "canvas" : "global";
      if (editable) {
        if (!event.ctrlKey && !event.metaKey && !event.altKey) return;
        if (isNativeTextShortcut(key)) return;
      }
      const action = shortcuts.find((item) => item.currentShortcut && item.currentShortcut === key);
      if (!action) return;
      if ((action.scope === "canvas" || action.scope === "asset") && !["canvas", "text"].includes(runtimeScope)) return;
      if (action.actionId === "canvas-immersive" && page !== "assets") return;
      if (!["back", "open-settings", "close-window", "search", "canvas-immersive"].includes(action.actionId) && !shortcutActionsRef.current[action.actionId]) return;
      event.preventDefault();
      void executeAction(action.actionId);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shortcuts, page, parts.join("/"), store.data.assets, store.data.settings]);
  if (store.loading)
    return (
      <div className="boot-screen">
        <Database />
        <span>正在准备本地数据库…</span>
      </div>
    );
  return (
    <>
      <AppChrome
        immersive={immersive && page==="assets"}
        canBack={page !== "home"}
        onBack={back}
        onSettings={() => go("settings")}
        shortcuts={shortcuts}
        onAction={dispatchMenuAction}
      >
        {content}
      </AppChrome>
      {closeError && (
        <div className="toast error" role="alert">
          <X size={16} /><span>{closeError}</span>
          <button onClick={()=>setCloseError('')}>知道了</button>
        </div>
      )}
      {store.error && (
        <div className="toast error">
          <X size={16} />
          <span>{store.error}</span>
          <button onClick={store.clearError}>关闭</button>
        </div>
      )}
    </>
  );
}

