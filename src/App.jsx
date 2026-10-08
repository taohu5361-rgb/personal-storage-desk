import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Database, X } from "lucide-react";
import { AppChrome } from "./components/AppChrome";
import { CanvasPanelLayoutProvider } from "./components/CanvasEditorLayout";
import { Empty } from "./components/ui/Primitives";
import { call } from "./data/database";

import { applyTheme } from "./theme";
import { useHashRoute, flushBeforeNavigation } from "./hooks/useHashRoute";
import { listen } from "@tauri-apps/api/event";
import { createCloseRequestHandler } from "./closeLifecycle";
import { isNativeTextShortcut, resolveShortcuts, shortcutFromEvent } from "./shortcuts/registry";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { useStore } from "./hooks/useAppStore";
import { useFixedAutoSave } from "./hooks/useFixedAutoSave";
import { Home } from "./pages/HomePage";
import { createNavigationContext, recordNavigation, contextualBackPath, recentDomainPath, routeDomain } from "./hooks/navigationState";
const Scripts = lazy(() => import('./pages/ScriptsPage').then(module => ({default:module.Scripts})));
const Models = lazy(() => import('./pages/WorkspacesPage').then(module => ({default:module.Models})));
const Assets = lazy(() => import('./pages/AssetsPage').then(module => ({default:module.Assets})));
const Detail = lazy(() => import('./pages/AssetDetailPage').then(module => ({default:module.Detail})));
const Example = lazy(() => import('./pages/SampleEditorPage').then(module => ({default:module.Example})));
const SettingsPage = lazy(() => import('./components/SettingsPage').then(module => ({default:module.SettingsPage})));

export default function App() {
  const store = useStore();
  useFixedAutoSave({
    enabled:!store.loading && store.data.settings?.autoSave === true,
    interval:store.data.settings?.autoSaveInterval,
    onSave:async()=>{
      const detail={promises:[]};
      window.dispatchEvent(new CustomEvent('canvas-auto-save',{detail}));
      await Promise.allSettled(detail.promises);
    },
  });
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
  const { path, parts, query, go } = useHashRoute();
  const navigationContext = useRef(createNavigationContext());
  const previousPath = useRef(path);
  useEffect(() => {
    if (path === previousPath.current) return;
    navigationContext.current = recordNavigation(navigationContext.current, previousPath.current, path);
    previousPath.current = path;
    setImmersive(false);
  }, [path]);
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
  const back = () => go(contextualBackPath(navigationContext.current, path, store.data));
  const navigate = target => go(['scripts', 'canvas'].includes(target) ? recentDomainPath(navigationContext.current, target, store.data) : target);
  const workspace = store.data.workspaces.find(item => item.id === parts[1]);
  const asset = store.data.assets.find(item => item.id === parts[2]);
  const category = store.data.categories.find(item => item.id === (asset?.categoryId || query.get('category'))) || (page === 'assets' ? store.data.categories.find(item => item.workspaceId === parts[1]) : null);
  const breadcrumbs = page === 'home' ? [] : page === 'settings' ? [{label:'设置'}] : page === 'scripts' ? [{label:'排列模式'}] : [
    {label:'画布模式', ...(page !== 'models' ? {path:'models'} : {})},
    ...(workspace ? [{label:workspace.name, ...(page !== 'assets' ? {path:`assets/${workspace.id}${category ? `?category=${category.id}` : ''}`} : {})}] : []),
    ...(category ? [{label:category.name, ...(page !== 'assets' ? {path:`assets/${workspace.id}?category=${category.id}`} : {})}] : []),
    ...(asset ? [{label:asset.name, ...(page === 'add-example' ? {path:`asset/${workspace.id}/${asset.id}`} : {})}] : []),
    ...(page === 'add-example' ? [{label:'新增样图'}] : []),
  ];
  const performAction = async (actionId) => {
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
  const executeAction = async actionId => {
    try {return await performAction(actionId)}
    catch (error) {store.reportError(`操作未完成：${String(error)}`);return false;}
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
      if (action.actionId === "canvas-immersive" && event.key === "Tab" && !event.target?.closest?.('.asset-canvas,.asset-inner-canvas,.outer-text-surface')) return;
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
  if (!store.data.settings) return <AppChrome page="home"><Empty icon={Database} title="本地数据库尚未加载" text={store.error || '暂时无法读取应用数据。'} action="重新加载" onAction={store.retryBoot}/></AppChrome>;
  return (
    <>
      <CanvasPanelLayoutProvider value={store.data.settings.propertyPanelLayout}><AppChrome
        immersive={immersive && page==="assets"}
        canBack={page !== "home"}
        onBack={back}
        onSettings={() => go("settings")}
        shortcuts={shortcuts}
        onAction={dispatchMenuAction}
        page={page}
        activeDomain={routeDomain(path)}
        breadcrumbs={breadcrumbs}
        onNavigate={navigate}
        canAction={action => Boolean(shortcutActionsRef.current[action]) || Boolean(document.activeElement?.closest?.('input,textarea,[contenteditable="true"]'))}
      >
        <Suspense fallback={<div className="ui-page-loading" role="status">正在打开页面…</div>}>{content}</Suspense>
      </AppChrome></CanvasPanelLayoutProvider>
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

