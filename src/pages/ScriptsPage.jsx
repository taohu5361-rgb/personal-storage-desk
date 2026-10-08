import { useEffect, useRef, useState } from "react";
import { Check, FolderCode, Pencil, Play, Plus, Search, Trash2, X } from "lucide-react";
import { call, id } from "../data/database";
import { SidebarToggle } from "../components/SidebarToggle";
import { useSidebarPreference } from "../hooks/useSidebarPreference";
import { useResizablePanel } from "../hooks/useResizablePanel";
import { PanelSplitter } from "../components/ui/PanelSplitter";
import { CategoryDialog, ScriptDialog } from "../components/EntityDialogs";
import { Button, Confirm, Empty } from "../components/ui/Primitives";
import { now } from "./pageUtils";
import { filterScripts } from "./corePageState.js";
import "../styles/pages-core.css";

export function Scripts({ store }) {
  const { data, run } = store;
  const sidebar = useSidebarPreference("scripts");
  const workspaceRef = useRef(null);
  const sidebarPanel = useResizablePanel({
    storageKey: "creative-cloth.panel-size.sidebar.scripts", defaultSize: 224,
    minSize: 176, maxSize: 420, minContentSize: 360,
    axis: "x", direction: 1, containerRef: workspaceRef,
  });
  const [active, setActive] = useState("");
  const [search, setSearch] = useState("");
  const [categoryDialog, setCategoryDialog] = useState(false);
  const [scriptDialog, setScriptDialog] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [launching, setLaunching] = useState([]);
  const launchingRef = useRef(new Set());
  const [deleting, setDeleting] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const current = data.scriptCategories.find(item => item.id === active) || data.scriptCategories[0];
  const scripts = Array.isArray(current?.scripts) ? current.scripts : [];
  const shown = filterScripts(scripts, search);
  useEffect(() => setSearch(""), [current?.id]);
  const saveScripts = async nextScripts => {
    await run("save_script_category", { item: { ...current, scripts: nextScripts, updatedAt: now() } });
  };
  const removeScript = async script => {
    setDeleting(script.id); setError(""); setNotice("");
    try {
      await saveScripts(scripts.filter(item => item.id !== script.id));
      setNotice(`已删除“${script.name}”的管理记录。`);
    } catch (reason) {
      setError(`删除失败：${String(reason)}`);
      throw reason;
    } finally { setDeleting(""); }
  };
  const launch = async script => {
    if (launchingRef.current.has(script.id)) return;
    launchingRef.current.add(script.id); setLaunching([...launchingRef.current]);
    setError(""); setNotice("");
    try {
      await call("launch_script", { filePath: script.filePath || "", launchCommand: script.launchCommand || "", launchArgs: script.launchArgs || "" });
      setNotice(`已发送“${script.name}”的启动请求。`);
    } catch (reason) {
      setError(`“${script.name}”启动失败：${String(reason)}。请检查文件路径与启动命令。`);
    } finally {
      launchingRef.current.delete(script.id); setLaunching([...launchingRef.current]);
    }
  };
  return <div ref={workspaceRef} className="workspace-layout sidebar-layout ui-workspace scripts-workspace" data-sidebar-expanded={sidebar.expanded} data-resizable-sidebar="scripts" style={{ "--sidebar-width": `${sidebarPanel.size}px` }}>
    <div id="script-sidebar" className="sidebar-slot" inert={!sidebar.expanded} aria-hidden={!sidebar.expanded}>
      <aside className="script-sidebar ui-sidebar">
        <div className="sidebar-topbar script-sidebar-topbar"><h2 className="sidebar-title">分类</h2><SidebarToggle expanded={sidebar.expanded} onToggle={sidebar.toggle} controls="script-sidebar" showLabel/></div>
        <nav aria-label="脚本分类">{data.scriptCategories.map(category => <button type="button" className={category.id === current?.id ? "active" : ""} aria-current={category.id === current?.id ? "page" : undefined} key={category.id} onClick={() => setActive(category.id)}>
          <span>{category.name}</span><small>{category.scripts?.length || 0}</small>
        </button>)}</nav>
        <Button className="add-category" onClick={() => setCategoryDialog(true)}><Plus size={16}/>新增分类</Button>
      </aside>
      <PanelSplitter label="调整分类栏宽度" axis="x" className="ui-sidebar-splitter" aria-controls="script-sidebar" {...sidebarPanel.splitterProps}/>
    </div>
    <section className="workspace-main ui-workspace-main">
      <header className="ui-workbar scripts-workbar">
        <div className="core-workbar-title"><SidebarToggle expanded={sidebar.expanded} onToggle={sidebar.toggle} controls="script-sidebar" showLabel hidden={sidebar.expanded}/><div><h1>{current?.name || "排列模式"}</h1>{current?.description && <p title={current.description}>{current.description}</p>}</div></div>
        <div className="core-workbar-actions">{current && <><label className="core-search"><Search size={16} aria-hidden="true"/><span className="sr-only">搜索当前分类</span><input data-shortcut-search value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索当前分类"/>{search && <button type="button" aria-label="清除搜索" onClick={() => setSearch("")}><X size={14}/></button>}</label><Button variant="primary" className="primary" disabled={Boolean(deleting)} onClick={() => setScriptDialog({ mode: "create" })}><Plus size={16}/>新增脚本</Button></>}</div>
      </header>
      {(error || notice || launching.length > 0) && <div className="core-page-feedback">
        {error ? <p className="core-error" role="alert">{error}</p> : <p role="status">{launching.length ? "正在发送启动请求…" : <><Check size={14}/>{notice}</>}</p>}
        {!launching.length && <button type="button" aria-label="关闭反馈" onClick={() => {setError("");setNotice("");}}><X size={14}/></button>}
      </div>}
      <div className="core-script-content">
        {current ? scripts.length ? shown.length ? <div className="script-list core-script-list">{shown.map(script => <article className="script-row core-script-row" key={script.id}>
          <span className="file-glyph">{(String(script.filePath || "").split(".").pop() || "FILE").slice(0,4).toUpperCase()}</span>
          <div className="script-info"><strong>{script.name}</strong><small title={script.filePath || script.launchCommand}>{script.description || script.filePath || script.launchCommand || "尚未配置路径"}</small></div>
          <div className="script-actions"><Button className="secondary small" aria-label={`编辑 ${script.name}`} disabled={Boolean(deleting)} onClick={() => setScriptDialog({ mode:"edit",script })}><Pencil size={14}/>编辑</Button><Button className="secondary small danger" aria-label={`删除 ${script.name}`} disabled={Boolean(deleting) || launching.includes(script.id)} onClick={() => data.settings?.confirmDelete ? setPendingDelete(script) : void removeScript(script).catch(() => {})}><Trash2 size={14}/>{deleting === script.id ? "删除中…" : "删除"}</Button><Button variant="primary" className="primary small" disabled={launching.includes(script.id) || deleting === script.id} onClick={() => launch(script)}><Play size={14}/>{launching.includes(script.id) ? "启动中…" : "启动"}</Button></div>
        </article>)}</div> : <Empty icon={Search} title="没有匹配的脚本" text="搜索范围为当前分类的名称、简介和文件路径。" action="清除搜索" onAction={() => setSearch("")}/> : <Empty icon={FolderCode} title="此分类暂无脚本" text="添加脚本文件或启动命令，即可在这里快速启动。" action="新增脚本" onAction={() => setScriptDialog({ mode:"create" })}/> : <Empty icon={FolderCode} title="暂无分类" text="先创建一个分类，再添加需要启动的脚本。" action="新增分类" onAction={() => setCategoryDialog(true)}/>}
      </div>
      {current && <footer className="core-list-status" role="status">{search ? `${shown.length} / ${scripts.length} 个脚本` : `${scripts.length} 个脚本`}</footer>}
    </section>
    {categoryDialog && <CategoryDialog title="新增分类" onCancel={() => setCategoryDialog(false)} onConfirm={async values => {const categoryId=id("script-category");await run("save_script_category",{item:{id:categoryId,...values,scripts:[],createdAt:now(),updatedAt:now()}});setActive(categoryId);setCategoryDialog(false);}}/>}
    {scriptDialog && current && <ScriptDialog script={scriptDialog.script} onCancel={() => setScriptDialog(null)} onConfirm={async values => {const nextScript=scriptDialog.script ? {...scriptDialog.script,...values,updatedAt:now()} : {id:id("script"),...values,createdAt:now(),updatedAt:now()};await saveScripts(scriptDialog.script ? scripts.map(item=>item.id===nextScript.id ? nextScript:item) : [...scripts,nextScript]);setScriptDialog(null);}}/>}
    {pendingDelete && <Confirm title="删除脚本" text={`确定删除“${pendingDelete.name}”的管理记录？硬盘上的脚本文件会保留。`} onCancel={() => setPendingDelete(null)} onConfirm={async()=>{await removeScript(pendingDelete);setPendingDelete(null);}}/>}
  </div>;
}
