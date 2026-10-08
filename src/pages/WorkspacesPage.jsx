import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Layers3, MoreHorizontal, Plus, Search, X } from "lucide-react";
import { fileUrl, id } from "../data/database";
import { ModelDialog, WorkspaceDeleteConfirm } from "../components/EntityDialogs";
import { Button, Empty } from "../components/ui/Primitives";
import { now } from "./pageUtils";
import "../styles/pages-core.css";

export function Models({ store, go }) {
  const { data, run } = store;
  const [search,setSearch] = useState("");
  const [dialog,setDialog] = useState("");
  const [editing,setEditing] = useState(null);
  const [menu,setMenu] = useState(null);
  const [pendingDelete,setPendingDelete] = useState(null);
  const menuRef=useRef(null), triggerRef=useRef(null);
  const term=search.trim().toLocaleLowerCase();
  const shown=data.workspaces.filter(item => `${item.name} ${item.description || ""}`.toLocaleLowerCase().includes(term));
  useEffect(()=>{
    if (!menu) return;
    menuRef.current?.querySelector("button")?.focus();
    const close=event=>{
      if (menuRef.current?.contains(event.target)) return;
      setMenu(null);
    };
    const keydown=event=>{
      if (event.key==="Escape") {event.preventDefault();setMenu(null);triggerRef.current?.focus();}
      if (event.key==="Tab") setMenu(null);
      if (["ArrowUp","ArrowDown"].includes(event.key)) {
        event.preventDefault();
        const items=[...(menuRef.current?.querySelectorAll("button") || [])];
        const index=items.indexOf(document.activeElement);
        items[(index+(event.key==="ArrowDown" ? 1:items.length-1))%items.length]?.focus();
      }
    };
    const blur=()=>setMenu(null);
    window.addEventListener("pointerdown",close);
    window.addEventListener("keydown",keydown);
    window.addEventListener("blur",blur);
    return()=>{window.removeEventListener("pointerdown",close);window.removeEventListener("keydown",keydown);window.removeEventListener("blur",blur);};
  },[menu]);
  const openMenu=(event,model)=>{
    event.preventDefault();event.stopPropagation();
    triggerRef.current=event.currentTarget;
    const rect=event.currentTarget.getBoundingClientRect();
    const context=event.type==="contextmenu";
    setMenu({model,x:Math.max(8,Math.min(context ? event.clientX:rect.right-184,window.innerWidth-192)),y:Math.max(8,Math.min(context ? event.clientY:rect.bottom+4,window.innerHeight-96))});
  };
  const updateModel=async values=>{
    const item=editing ? {...editing,...values,updatedAt:now()} : {id:id("workspace"),...values,createdAt:now(),updatedAt:now()};
    await run("save_workspace",{item});setDialog("");setEditing(null);
  };
  const editMenuModel=()=>{
    triggerRef.current?.focus();
    setEditing(menu.model);setDialog("edit");setMenu(null);
  };
  const deleteMenuModel=()=>{
    triggerRef.current?.focus();
    setPendingDelete(menu.model);setMenu(null);
  };
  return <section className="models-page core-models-page ui-workspace-main">
    <header className="ui-workbar core-models-workbar">
      <div className="core-workbar-title"><div><h1>生图资产模型</h1><p>每个模型拥有独立的资产库。</p></div></div>
      <div className="core-workbar-actions">{data.workspaces.length>0&&<><label className="core-search"><Search size={16} aria-hidden="true"/><span className="sr-only">搜索模型</span><input data-shortcut-search value={search} onChange={event=>setSearch(event.target.value)} placeholder="搜索模型"/>{search&&<button type="button" aria-label="清除搜索" onClick={()=>setSearch("")}><X size={14}/></button>}</label><Button variant="primary" className="primary" onClick={()=>{setEditing(null);setDialog("create");}}><Plus size={16}/>添加模型</Button></>}</div>
    </header>
    <div className="core-models-content">
      {data.workspaces.length ? shown.length ? <div className="model-strip core-workspace-list">{shown.map(model=><article className="core-workspace-row" key={model.id} onContextMenu={event=>openMenu(event,model)}>
        <button type="button" className="core-workspace-open" onClick={()=>go(`assets/${model.id}`)} aria-label={`打开模型 ${model.name}`}>
          {model.coverPath ? <img className="core-workspace-cover" src={fileUrl(model.coverPath)} alt=""/> : <span className="core-workspace-cover core-workspace-placeholder"><Layers3 size={28} strokeWidth={1.5} aria-hidden="true"/></span>}
          <span className="core-workspace-copy"><strong>{model.name}</strong><small>{model.description || "暂无简介"}</small></span><ArrowRight size={17} aria-hidden="true"/>
        </button>
        <button type="button" className="ui-icon-button core-workspace-more" aria-label={`管理模型 ${model.name}`} aria-haspopup="menu" aria-expanded={menu?.model.id===model.id} onClick={event=>openMenu(event,model)}><MoreHorizontal size={18}/></button>
      </article>)}</div> : <Empty icon={Search} title="没有匹配的模型" text="尝试搜索模型名称或简介。" action="清除搜索" onAction={()=>setSearch("")}/> : <Empty icon={Layers3} title="暂无模型" text="添加模型，建立独立的分类与资产库。" action="添加模型" onAction={()=>{setEditing(null);setDialog("create");}}/>}
    </div>
    {data.workspaces.length>0&&<footer className="core-list-status" role="status">{search ? `${shown.length} / ${data.workspaces.length} 个模型` : `${data.workspaces.length} 个模型`}</footer>}
    {menu&&createPortal(<div ref={menuRef} className="model-context-menu core-workspace-menu" role="menu" aria-label={`管理模型 ${menu.model.name}`} style={{left:menu.x,top:menu.y}}>
      <button type="button" role="menuitem" onClick={editMenuModel}>编辑模型</button><button type="button" role="menuitem" className="danger" onClick={deleteMenuModel}>删除模型</button>
    </div>,document.body)}
    {dialog&&<ModelDialog title={dialog==="edit" ? "编辑模型":"添加模型"} model={editing} onCancel={()=>{setDialog("");setEditing(null);}} onConfirm={updateModel}/>}
    {pendingDelete&&<WorkspaceDeleteConfirm workspace={pendingDelete} categories={data.categories.filter(item=>item.workspaceId===pendingDelete.id)} assets={data.assets.filter(item=>item.workspaceId===pendingDelete.id)} onCancel={()=>setPendingDelete(null)} onConfirm={async deleteManaged=>{await run("delete_workspace",{id:pendingDelete.id,deleteManaged});setPendingDelete(null);}}/>}
  </section>;
}
