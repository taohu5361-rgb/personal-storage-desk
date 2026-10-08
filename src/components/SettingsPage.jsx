import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { call } from "../data/database";
import { resolveCanvasAppearance } from "../canvasAppearance";
import { CanvasAppearanceControls } from "./CanvasAppearanceControls";
import { ShortcutSettingsPage } from "./ShortcutSettingsPage";
import { FontManager } from "./text/FontManager";
import { createSettingsSaveQueue } from "../data/settingsSaveQueue.js";
import { PROPERTY_PANEL_LAYOUT_OPTIONS, resolvePropertyPanelLayout } from "../propertyPanelLayout.js";
import { normalizeSaveInterval } from '../data/fixedAutoSave.js';

const tabs = [["general","常规"],["appearance","外观"],["shortcuts","快捷键"],["storage","资产与存储"],["fonts","字体管理"],["advanced","高级"]];
const searchTerms = {
  general: "启动页面 首页 排列模式 画布模式 上次退出 工作区 自动保存 间隔 手动保存 分钟 秒 预设 删除 窗口 托盘",
  appearance: "外观 界面 主题 缩放 密度 属性 面板 布局 方案一 方案二 右侧 底部 画布 背景 颜色 白色 黑色 无网格 柔和点阵 轻网格 资产名称 标签 阴影 选中边框",
  shortcuts: "快捷键 按键 修改 搜索 撤销 重做 剪切 复制 粘贴 删除 全选 放大 缩小 适应全部 保存 沉浸模式",
  storage: "资产 存储 托管 引用 导入 目录 图片 缓存 预览 缩略图 Thumbnail Preview SQLite 数据库 备份 恢复 样图",
  fonts: "字体 字体管理 导入 删除 TTF OTF WOFF WOFF2 文字 自定义字体",
  advanced: "高级 开发者工具 性能 日志 数据库完整性 失联 孤立 预览 索引 重置 清空画布",
};
const choices = (label, value, options, change) => <label className="settings-row"><span>{label}</span><select aria-label={label} value={value} onChange={e=>change(e.target.value)}>{options.map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>;
const toggle = (label, value, change) => <label className="settings-row"><span>{label}</span><input type="checkbox" checked={value} onChange={e=>change(e.target.checked)}/></label>;
const number = (label, value, min, max, unit, change) => <label className="settings-row"><span>{label}</span><span className="settings-number"><input type="number" min={min} max={max} value={value} onChange={e=>change(Number(e.target.value))}/>{unit}</span></label>;
const group = (title, children) => <section className="settings-group"><h2>{title}</h2>{children}</section>;

export function SettingsPage({store}) {
  const {data, setData, run} = store;
  const [section,setSection] = useState("general");
  const [navigationRevision,setNavigationRevision] = useState(0);
  const mainRef = useRef(null);
  const [query,setQuery] = useState("");
  const [draftPath,setDraftPath] = useState(data.settings?.managedAssetDir || "");
  const [intervalDraft,setIntervalDraft] = useState(String(normalizeSaveInterval(data.settings?.autoSaveInterval)));
  const intervalDraftRef = useRef(intervalDraft);
  intervalDraftRef.current=intervalDraft;
  const [status,setStatus] = useState("");
  const [info,setInfo] = useState(null);
  const [saveState,setSaveState] = useState({pending:0,error:"",failedSnapshot:null});
  const alive = useRef(true);
  const draftPathRef = useRef(draftPath);
  draftPathRef.current = draftPath;
  const currentSettings = useRef(data.settings);
  const confirmedSettings = useRef(data.settings);
  const queue = useRef(null);
  if (!queue.current) queue.current = createSettingsSaveQueue({
    persist: item => call("save_settings",{item}),
    onSaved: item => { confirmedSettings.current=item; },
    onFailed: () => {
      currentSettings.current=confirmedSettings.current;
      setData(d=>({...d,settings:confirmedSettings.current}));
    },
    onState: state => {
      if (!alive.current) return;
      setSaveState(state);
      if (!state.pending && !state.error) setStatus("已自动保存");
    },
  });
  useEffect(()=>{
    currentSettings.current=data.settings;
    const state=queue.current.snapshot();
    if (!state.pending && !state.error) confirmedSettings.current=data.settings;
  },[data.settings]);
  useEffect(()=>{setDraftPath(data.settings?.managedAssetDir || "")},[data.settings?.managedAssetDir]);
  useEffect(()=>{setIntervalDraft(String(normalizeSaveInterval(data.settings?.autoSaveInterval)))},[data.settings?.autoSaveInterval]);
  useEffect(()=>{call("database_info").then(setInfo).catch(()=>{})},[data.databasePath]);
  useLayoutEffect(()=>{
    if (!mainRef.current) return;
    mainRef.current.scrollTop=0;
    if (navigationRevision>0) mainRef.current.focus({preventScroll:true});
  },[navigationRevision]);
  const selectSection = (key) => {
    setSection(key);
    setQuery("");
    setNavigationRevision(value=>value+1);
  };
  const save = (key,value) => {
    if (currentSettings.current?.[key]===value) return;
    const next = {...currentSettings.current,[key]:value};
    currentSettings.current=next;
    setData(d=>({...d,settings:next}));
    setStatus("");
    void queue.current.submit(next);
  };
  const retrySave = () => {
    const failed=queue.current.snapshot().failedSnapshot;
    if (!failed) return;
    currentSettings.current=failed;
    setData(d=>({...d,settings:failed}));
    void queue.current.retry();
  };
  const saveInterval = () => {
    const value=Number(intervalDraftRef.current);
    if (!Number.isInteger(value) || value<5 || value>3600) {
      setStatus('保存间隔请输入 5–3600 秒的整数。');
      setIntervalDraft(String(normalizeSaveInterval(currentSettings.current?.autoSaveInterval)));
      return;
    }
    save('autoSaveInterval',value);
  };
  useEffect(()=>{
    alive.current=true;
    const beforeLeave=event=>{
      const path=draftPathRef.current.trim();
      if (path && path!==currentSettings.current?.managedAssetDir) save("managedAssetDir",path);
      event.detail.promises.push(queue.current.flush());
    };
    window.addEventListener("asset-text-before-leave",beforeLeave);
    return()=>{alive.current=false;window.removeEventListener("asset-text-before-leave",beforeLeave);};
  },[]);
  const action = async (command, message, args) => {
    try {
      await queue.current.flush();
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
    <aside className="settings-nav"><h2>设置</h2><nav className="settings-nav-items" aria-label="设置分类">{tabs.map(([key,name])=><button key={key} className={section===key?"active":""} aria-current={section===key?"page":undefined} onClick={()=>selectSection(key)}>{name}</button>)}</nav></aside>
    <div className="settings-main" ref={mainRef} tabIndex={-1} role="region" aria-label={`设置：${tabs.find(([key])=>key===section)?.[1] || "常规"}`}>{!visible.includes("shortcuts")&&<div className="settings-search"><input data-shortcut-search aria-label="搜索设置" placeholder="搜索设置，例如缩略图" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button onClick={()=>setQuery("")}>清除</button>}</div>}
    {(saveState.pending>0||saveState.error)&&<div className="settings-save-state">
      {saveState.pending>0&&<p className="settings-status" role="status">正在保存设置…</p>}
      {saveState.error&&<div className="asset-text-save-error settings-save-error" role="alert"><span>设置尚未保存：{saveState.error}。当前显示已保存值；重试会恢复并保存你的修改。</span><button className="secondary" disabled={saveState.pending>0} onClick={retrySave}>重试保存</button></div>}
    </div>}
    {visible.length===0&&<p className="settings-help">没有找到相关设置</p>}
    {visible.includes("general")&&<><header><h1>常规</h1></header>
      {group("启动",<>{choices("启动页面",s.startupPage,[["home","首页"],["scripts","排列模式"],["last","上次退出页面"]],v=>save("startupPage",v))}{toggle("启动时恢复上次工作区",s.restoreWorkspace,v=>save("restoreWorkspace",v))}</>)}
      {group("保存",<>
        {choices('保存方式',s.autoSave?'automatic':'manual',[['automatic','按固定间隔自动保存'],['manual','仅手动保存']],value=>save('autoSave',value==='automatic'))}
        <label className="settings-row"><span>保存间隔</span><span className="settings-number"><input aria-label="保存间隔" type="number" min="5" max="3600" step="1" disabled={!s.autoSave} value={intervalDraft} onChange={event=>setIntervalDraft(event.target.value)} onBlur={saveInterval} onKeyDown={event=>{if(event.key==='Enter')event.currentTarget.blur();if(event.key==='Escape'){const restored=String(normalizeSaveInterval(s.autoSaveInterval));intervalDraftRef.current=restored;setIntervalDraft(restored);event.currentTarget.blur();}}}/>秒</span></label>
        <label className="settings-row"><span>常用间隔</span><select aria-label="保存间隔预设" disabled={!s.autoSave} value={[30,60,300,600].includes(normalizeSaveInterval(s.autoSaveInterval))?String(normalizeSaveInterval(s.autoSaveInterval)):'custom'} onChange={event=>{if(event.target.value==='custom')return;setIntervalDraft(event.target.value);save('autoSaveInterval',Number(event.target.value));}}><option value="30">30 秒</option><option value="60">1 分钟</option><option value="300">5 分钟</option><option value="600">10 分钟</option><option value="custom">自定义</option></select></label>
        <p className="settings-save-help">{s.autoSave?`每 ${normalizeSaveInterval(s.autoSaveInterval)} 秒检查一次，有修改才保存。拖动、松手和缩放不会提前保存，也不会重新计时。`:'仅在点击保存或使用保存快捷键时写入。离开时若有未保存修改，会提示先手动保存。'}</p>
      </>)}
      {group('确认',toggle("删除前确认",s.confirmDelete,v=>save("confirmDelete",v)))}
      {group("窗口",choices("关闭窗口行为",s.closeBehavior,[["exit","直接退出"],["tray","最小化到托盘"]],v=>save("closeBehavior",v)))}</>}
    {visible.includes("appearance")&&<><header><h1>外观</h1></header>
      {group("界面",<>{choices("主题",s.theme,[["system","跟随系统"],["light","浅色"],["dark","深色"]],v=>save("theme",v))}{number("界面缩放",s.uiScale,75,150,"%",v=>{if(v>=75&&v<=150)save("uiScale",v)})}{choices("界面密度",s.uiDensity,[["compact","紧凑"],["standard","标准"],["comfortable","宽松"]],v=>save("uiDensity",v))}{choices("属性面板布局",resolvePropertyPanelLayout(s.propertyPanelLayout),PROPERTY_PANEL_LAYOUT_OPTIONS,v=>save("propertyPanelLayout",v))}<p className="settings-help">方案一把属性面板放在右侧，方案二放在底部。两套布局功能相同，外画布、内画布和标准详情统一使用所选位置。</p></>)}
      {group("画布默认值",<><div className="settings-row canvas-appearance-settings"><CanvasAppearanceControls {...resolveCanvasAppearance({},s)} onChange={({color,pattern})=>{if(color!==resolveCanvasAppearance({},s).color)save("canvasBackgroundColor",color);if(pattern!==resolveCanvasAppearance({},s).pattern)save("canvasBackground",pattern)}} /></div><p className="settings-help">画布底色独立于应用主题。分类可单独设置，资产内画布继承所属分类；未单独设置的分类使用这里的默认值。</p>{choices("资产名称显示",s.assetNameDisplay,[["always","始终显示"],["interaction","悬停 / 选中时显示"],["hidden","完全隐藏"]],v=>save("assetNameDisplay",v))}{toggle("显示资产标签",s.showAssetTags,v=>save("showAssetTags",v))}{toggle("显示图片阴影",s.showImageShadow,v=>save("showImageShadow",v))}{toggle("显示选中边框",s.showSelectionBorder,v=>save("showSelectionBorder",v))}{number("新增资产默认最大显示边",s.newAssetMaxEdge,100,1600,"px",v=>{if(v>=100&&v<=1600)save("newAssetMaxEdge",v)})}</>)}</>}
    {visible.includes("shortcuts")&&<ShortcutSettingsPage store={store} />}
    {visible.includes("fonts")&&<><header><h1>字体管理</h1><p>管理文字块可用的自定义字体。</p></header><FontManager fonts={data.customFonts||[]} reload={store.reload}/></>}
    {visible.includes("storage")&&<><header><h1>资产与存储</h1><p>原始文件保存在 Windows 文件系统，业务数据保存在 SQLite。</p></header>
      {group("默认资产导入方式",<><label className="setting-choice"><input type="radio" checked={s.defaultImportMode==="managed"} onChange={()=>save("defaultImportMode","managed")}/><span><strong>托管到资产库</strong><small>完整复制原始文件到管理目录，不压缩、不改格式、不降低质量。</small></span></label><label className="setting-choice"><input type="radio" checked={s.defaultImportMode==="reference"} onChange={()=>save("defaultImportMode","reference")}/><span><strong>仅引用原文件</strong><small>只记录源路径；源文件移动或删除后，资产会显示失联。</small></span></label>{toggle("每次添加资产时询问导入方式",s.askImportMode,v=>save("askImportMode",v))}</>)}
      {group("托管资产目录",<><div className="path-row"><input aria-label="托管资产目录" value={draftPath} onChange={e=>setDraftPath(e.target.value)} onBlur={()=>{if(draftPath.trim()&&draftPath!==s.managedAssetDir)save("managedAssetDir",draftPath.trim())}}/><button className="secondary" onClick={async()=>{const p=await call("pick_directory");if(p){setDraftPath(p);save("managedAssetDir",p)}}}>更改目录</button><button className="secondary" onClick={()=>action("open_directory","已打开资产目录",{path:s.managedAssetDir})}>打开资产目录</button></div><p className="settings-help">更改后用于新导入的资产，已有托管文件保留原路径。</p></>)}
      {group("图片预览缓存",<>{toggle("自动生成 Preview",s.autoPreview,v=>save("autoPreview",v))}{toggle("自动生成 Thumbnail",s.autoThumbnail,v=>save("autoThumbnail",v))}{number("Preview 最大边",s.previewMaxEdge,128,8192,"px",v=>{if(v>=128&&v<=8192)save("previewMaxEdge",v)})}{number("Thumbnail 最大边",s.thumbnailMaxEdge,64,4096,"px",v=>{if(v>=64&&v<=4096)save("thumbnailMaxEdge",v)})}<div className="settings-row"><span>当前缓存占用</span><strong>{(data.cacheBytes/1048576).toFixed(1)} MB</strong></div><div className="button-row"><button className="secondary" onClick={()=>action("clear_preview_cache","缓存已清理")}>清理缓存</button><button className="secondary" onClick={()=>action("regenerate_previews","已重新生成预览")}>重新生成预览</button></div><p className="settings-help">清理范围仅限应用缓存目录，不会删除 original 原图或引用的源文件。</p></>)}
      {group("SQLite 数据库",<><div className="settings-facts"><span>数据库路径</span><strong>{info?.path||data.databasePath}</strong><span>数据库文件大小</span><strong>{((info?.bytes||0)/1048576).toFixed(2)} MB</strong><span>分类数量</span><strong>{info?.categories??data.categories.length}</strong><span>资产数量</span><strong>{info?.assets??data.assets.length}</strong><span>样图案例数量</span><strong>{info?.samples??data.prompts.length}</strong></div><div className="button-row"><button className="secondary" onClick={()=>action("open_directory","已打开数据库目录",{path:data.databasePath.replace(/[\\/][^\\/]+$/,"")})}>打开数据库所在目录</button><button className="secondary" onClick={()=>action("backup_database","备份已保存")}>备份数据库</button><button className="secondary" onClick={()=>{if(window.confirm("恢复数据库备份会替换当前业务数据。程序会先保留恢复前的数据库副本。确认继续？"))action("restore_database","备份已恢复")}}>恢复数据库备份</button></div></>)}</>}
    {visible.includes("advanced")&&<><header><h1>高级</h1></header>
      {group("开发与诊断",<><div className="settings-row"><span>开发者工具</span><button className="secondary" onClick={()=>action("open_devtools","已打开开发者工具")}>打开开发者工具</button></div>{toggle("显示性能信息",s.showPerformance,v=>save("showPerformance",v))}{toggle("启用详细日志",s.verboseLogs,v=>save("verboseLogs",v))}</>)}
      {group("数据维护",<div className="settings-actions"><button className="secondary" onClick={()=>action("check_database","数据库完整性检查")}>检查数据库完整性</button><button className="secondary" onClick={()=>action("check_missing_references","失联引用检查")}>检查失联引用文件</button><button className="secondary" onClick={()=>action("clean_orphan_previews","已清理孤立预览目录")}>清理孤立预览文件</button><button className="secondary" onClick={()=>action("regenerate_previews","已重建图片预览缓存")}>重建图片预览缓存</button><button className="secondary" onClick={()=>action("rebuild_database_indexes","已重建数据库索引")}>重建数据库索引</button></div>)}
      <section className="settings-group settings-danger"><h2>危险操作</h2><p>以下操作会改变现有界面或画布状态，请确认后执行。</p><div className="button-row"><button onClick={()=>{if(window.confirm("重置界面设置？")&&window.confirm("再次确认重置界面设置？"))action("reset_interface_settings","界面设置已重置")}}>重置界面设置</button><button onClick={()=>dangerous("清空全部画布位置与尺寸？","clear_canvas_layout","画布布局已清空")}>清空画布布局</button></div></section></>}
    {!saveState.pending&&status&&<p className="settings-status" role="status">{status}</p>}
    </div>
  </div>;
}
