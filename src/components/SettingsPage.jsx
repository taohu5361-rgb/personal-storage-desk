import { useEffect, useRef, useState } from "react";
import { call } from "../data/database";
import { resolveCanvasAppearance } from "../canvasAppearance";
import { CanvasAppearanceControls } from "./CanvasAppearanceControls";
import { ShortcutSettingsPage } from "./ShortcutSettingsPage";
import { FontManager } from "./text/FontManager";

const tabs = [["general","常规"],["appearance","外观"],["shortcuts","快捷键"],["storage","资产与存储"],["fonts","字体管理"],["advanced","高级"]];
const searchTerms = {
  general: "启动页面 首页 我的脚本 上次退出 工作区 自动保存 间隔 删除 窗口 托盘",
  appearance: "外观 界面 主题 缩放 密度 画布 背景 颜色 白色 黑色 无网格 柔和点阵 轻网格 资产名称 标签 阴影 选中边框",
  shortcuts: "快捷键 按键 修改 搜索 撤销 重做 剪切 复制 粘贴 删除 全选 放大 缩小 适应全部 保存 沉浸模式",
  storage: "资产 存储 托管 引用 导入 目录 图片 缓存 预览 缩略图 Thumbnail Preview SQLite 数据库 备份 恢复 样图",
  fonts: "字体 字体管理 导入 删除 TTF OTF WOFF WOFF2 文字 自定义字体",
  advanced: "高级 开发者工具 性能 日志 数据库完整性 失联 孤立 预览 索引 重置 清空画布",
};
const choices = (label, value, options, change) => <label className="settings-row"><span>{label}</span><select value={value} onChange={e=>change(e.target.value)}>{options.map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>;
const toggle = (label, value, change) => <label className="settings-row"><span>{label}</span><input type="checkbox" checked={value} onChange={e=>change(e.target.checked)}/></label>;
const number = (label, value, min, max, unit, change) => <label className="settings-row"><span>{label}</span><span className="settings-number"><input type="number" min={min} max={max} value={value} onChange={e=>change(Number(e.target.value))}/>{unit}</span></label>;
const group = (title, children) => <section className="settings-group"><h2>{title}</h2>{children}</section>;

export function SettingsPage({store}) {
  const {data, setData, run} = store;
  const [section,setSection] = useState("general");
  const [query,setQuery] = useState("");
  const [draftPath,setDraftPath] = useState(data.settings?.managedAssetDir || "");
  const [status,setStatus] = useState("");
  const [info,setInfo] = useState(null);
  const queue = useRef(Promise.resolve());
  const currentSettings = useRef(data.settings);
  useEffect(()=>{currentSettings.current=data.settings},[data.settings]);
  useEffect(()=>{setDraftPath(data.settings?.managedAssetDir || "")},[data.settings?.managedAssetDir]);
  useEffect(()=>{call("database_info").then(setInfo).catch(()=>{})},[data.databasePath]);
  const save = (key,value) => {
    const previous = currentSettings.current;
    const next = {...previous,[key]:value};
    currentSettings.current=next;
    setData(d=>({...d,settings:next}));
    queue.current = queue.current.catch(()=>{}).then(async()=>{
      try { await call("save_settings",{item:next}); setStatus("已自动保存"); }
      catch(e) { if(currentSettings.current===next){currentSettings.current=previous;setData(d=>({...d,settings:previous}));} setStatus(`保存失败：${e}`); }
    });
  };
  const action = async (command, message, args) => {
    try {
      const result = await run(command,args);
      if (["restore_database","reset_interface_settings"].includes(command) && result !== false) await store.reload();
      if (["backup_database","restore_database"].includes(command) && !result) return;
      setStatus(Array.isArray(result) ? `${message}：${result.length ? result.join("；") : "无失联文件"}` : typeof result === "string" && result ? `${message}：${result}` : `${message}${typeof result === "number" ? `：${result}` : ""}`);
      call("database_info").then(setInfo).catch(()=>{});
    } catch(e) { setStatus(String(e)); }
  };
  const dangerous = (prompt,command,message) => { if (window.confirm(prompt) && window.confirm("请再次确认：此操作会修改当前数据。")) action(command,message); };
  const search = query.trim().toLowerCase();
  const matches = tabs.filter(([key,name])=>`${name} ${searchTerms[key]}`.toLowerCase().includes(search));
  const visible = search ? matches.map(([key])=>key) : [section];
  const s = data.settings;
  if (!s) return null;
  return <div className="settings-layout">
    <aside className="settings-nav"><h2>设置</h2><nav className="settings-nav-items" aria-label="设置分类">{tabs.map(([key,name])=><button key={key} className={section===key?"active":""} aria-current={section===key?"page":undefined} onClick={()=>{setSection(key);setQuery("")}}>{name}</button>)}</nav></aside>
    <div className="settings-main">{!visible.includes("shortcuts")&&<div className="settings-search"><input data-shortcut-search aria-label="搜索设置" placeholder="搜索设置，例如缩略图" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button onClick={()=>setQuery("")}>清除</button>}</div>}
    {visible.length===0&&<p className="settings-help">没有找到相关设置</p>}
    {visible.includes("general")&&<><header><p className="eyebrow">设置</p><h1>常规</h1></header>
      {group("启动",<>{choices("启动页面",s.startupPage,[["home","首页"],["scripts","我的脚本"],["last","上次退出页面"]],v=>save("startupPage",v))}{toggle("启动时恢复上次工作区",s.restoreWorkspace,v=>save("restoreWorkspace",v))}</>)}
      {group("保存与确认",<>{toggle("自动保存",s.autoSave,v=>save("autoSave",v))}{number("自动保存间隔",s.autoSaveInterval,5,3600,"秒",v=>{if(v>=5&&v<=3600)save("autoSaveInterval",v)})}{toggle("删除前确认",s.confirmDelete,v=>save("confirmDelete",v))}</>)}
      {group("窗口",choices("关闭窗口行为",s.closeBehavior,[["exit","直接退出"],["tray","最小化到托盘"]],v=>save("closeBehavior",v)))}</>}
    {visible.includes("appearance")&&<><header><p className="eyebrow">设置</p><h1>外观</h1></header>
      {group("界面",<>{choices("主题",s.theme,[["system","跟随系统"],["light","浅色"],["dark","深色"]],v=>save("theme",v))}{number("界面缩放",s.uiScale,75,150,"%",v=>{if(v>=75&&v<=150)save("uiScale",v)})}{choices("界面密度",s.uiDensity,[["compact","紧凑"],["standard","标准"],["comfortable","宽松"]],v=>save("uiDensity",v))}</>)}
      {group("画布默认值",<><div className="settings-row canvas-appearance-settings"><CanvasAppearanceControls {...resolveCanvasAppearance({},s)} onChange={({color,pattern})=>{if(color!==resolveCanvasAppearance({},s).color)save("canvasBackgroundColor",color);if(pattern!==resolveCanvasAppearance({},s).pattern)save("canvasBackground",pattern)}} /></div><p className="settings-help">画布底色独立于应用主题。分类可单独设置，资产内画布继承所属分类；未单独设置的分类使用这里的默认值。</p>{choices("资产名称显示",s.assetNameDisplay,[["always","始终显示"],["interaction","悬停 / 选中时显示"],["hidden","完全隐藏"]],v=>save("assetNameDisplay",v))}{toggle("显示资产标签",s.showAssetTags,v=>save("showAssetTags",v))}{toggle("显示图片阴影",s.showImageShadow,v=>save("showImageShadow",v))}{toggle("显示选中边框",s.showSelectionBorder,v=>save("showSelectionBorder",v))}{number("新增资产默认最大显示边",s.newAssetMaxEdge,100,1600,"px",v=>{if(v>=100&&v<=1600)save("newAssetMaxEdge",v)})}</>)}</>}
    {visible.includes("shortcuts")&&<ShortcutSettingsPage store={store} />}
    {visible.includes("fonts")&&<><header><p className="eyebrow">设置</p><h1>字体管理</h1><p>管理文字块可用的自定义字体。</p></header><FontManager fonts={data.customFonts||[]} reload={store.reload}/></>}
    {visible.includes("storage")&&<><header><p className="eyebrow">设置</p><h1>资产与存储</h1><p>原始文件保存在 Windows 文件系统，业务数据保存在 SQLite。</p></header>
      {group("默认资产导入方式",<><label className="setting-choice"><input type="radio" checked={s.defaultImportMode==="managed"} onChange={()=>save("defaultImportMode","managed")}/><span><strong>托管到资产库</strong><small>完整复制原始文件到管理目录，不压缩、不改格式、不降低质量。</small></span></label><label className="setting-choice"><input type="radio" checked={s.defaultImportMode==="reference"} onChange={()=>save("defaultImportMode","reference")}/><span><strong>仅引用原文件</strong><small>只记录源路径；源文件移动或删除后，资产会显示失联。</small></span></label>{toggle("每次添加资产时询问导入方式",s.askImportMode,v=>save("askImportMode",v))}</>)}
      {group("托管资产目录",<><div className="path-row"><input aria-label="托管资产目录" value={draftPath} onChange={e=>setDraftPath(e.target.value)} onBlur={()=>{if(draftPath.trim()&&draftPath!==s.managedAssetDir)save("managedAssetDir",draftPath.trim())}}/><button className="secondary" onClick={async()=>{const p=await call("pick_directory");if(p){setDraftPath(p);save("managedAssetDir",p)}}}>更改目录</button><button className="secondary" onClick={()=>action("open_directory","已打开资产目录",{path:s.managedAssetDir})}>打开资产目录</button></div><p className="settings-help">更改后用于新导入的资产，已有托管文件保留原路径。</p></>)}
      {group("图片预览缓存",<>{toggle("自动生成 Preview",s.autoPreview,v=>save("autoPreview",v))}{toggle("自动生成 Thumbnail",s.autoThumbnail,v=>save("autoThumbnail",v))}{number("Preview 最大边",s.previewMaxEdge,128,8192,"px",v=>{if(v>=128&&v<=8192)save("previewMaxEdge",v)})}{number("Thumbnail 最大边",s.thumbnailMaxEdge,64,4096,"px",v=>{if(v>=64&&v<=4096)save("thumbnailMaxEdge",v)})}<div className="settings-row"><span>当前缓存占用</span><strong>{(data.cacheBytes/1048576).toFixed(1)} MB</strong></div><div className="button-row"><button className="secondary" onClick={()=>action("clear_preview_cache","缓存已清理")}>清理缓存</button><button className="secondary" onClick={()=>action("regenerate_previews","已重新生成预览")}>重新生成预览</button></div><p className="settings-help">清理范围仅限应用缓存目录，不会删除 original 原图或引用的源文件。</p></>)}
      {group("SQLite 数据库",<><div className="settings-facts"><span>数据库路径</span><strong>{info?.path||data.databasePath}</strong><span>数据库文件大小</span><strong>{((info?.bytes||0)/1048576).toFixed(2)} MB</strong><span>分类数量</span><strong>{info?.categories??data.categories.length}</strong><span>资产数量</span><strong>{info?.assets??data.assets.length}</strong><span>样图案例数量</span><strong>{info?.samples??data.prompts.length}</strong></div><div className="button-row"><button className="secondary" onClick={()=>action("open_directory","已打开数据库目录",{path:data.databasePath.replace(/[\\/][^\\/]+$/,"")})}>打开数据库所在目录</button><button className="secondary" onClick={()=>action("backup_database","备份已保存")}>备份数据库</button><button className="secondary" onClick={()=>{if(window.confirm("恢复数据库备份会替换当前业务数据。程序会先保留恢复前的数据库副本。确认继续？"))action("restore_database","备份已恢复")}}>恢复数据库备份</button></div></>)}</>}
    {visible.includes("advanced")&&<><header><p className="eyebrow">设置</p><h1>高级</h1></header>
      {group("开发与诊断",<><div className="settings-row"><span>开发者工具</span><button className="secondary" onClick={()=>action("open_devtools","已打开开发者工具")}>打开开发者工具</button></div>{toggle("显示性能信息",s.showPerformance,v=>save("showPerformance",v))}{toggle("启用详细日志",s.verboseLogs,v=>save("verboseLogs",v))}</>)}
      {group("数据维护",<div className="settings-actions"><button className="secondary" onClick={()=>action("check_database","数据库完整性检查")}>检查数据库完整性</button><button className="secondary" onClick={()=>action("check_missing_references","失联引用检查")}>检查失联引用文件</button><button className="secondary" onClick={()=>action("clean_orphan_previews","已清理孤立预览目录")}>清理孤立预览文件</button><button className="secondary" onClick={()=>action("regenerate_previews","已重建图片预览缓存")}>重建图片预览缓存</button><button className="secondary" onClick={()=>action("rebuild_database_indexes","已重建数据库索引")}>重建数据库索引</button></div>)}
      <section className="settings-group settings-danger"><h2>危险操作</h2><p>以下操作会改变现有界面或画布状态，请确认后执行。</p><div className="button-row"><button onClick={()=>{if(window.confirm("重置界面设置？")&&window.confirm("再次确认重置界面设置？"))action("reset_interface_settings","界面设置已重置")}}>重置界面设置</button><button onClick={()=>dangerous("清空全部画布位置与尺寸？","clear_canvas_layout","画布布局已清空")}>清空画布布局</button></div></section></>}
    {status&&<p className="settings-status" role="status">{status}</p>}
    </div>
  </div>;
}
