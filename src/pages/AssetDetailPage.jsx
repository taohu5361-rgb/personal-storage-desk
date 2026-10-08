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
import { flushBeforeNavigation } from "../hooks/useHashRoute";
import { createPersistenceQueue } from "../data/persistenceQueue";
import { createLatestValueSave } from '../data/latestValueSave';
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
  Pencil,
  Play,
  Plus,
  Save,
  Settings as SettingsIcon,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";

export function Detail({ store, workspaceId, assetId, go, registerShortcutActions, shortcuts }) {
  const text = useAssetTextController(assetId,store);
  const [saveState, setSaveState] = useState({pending:0,error:''});
  const persistence = useRef(null);
  if (!persistence.current) persistence.current = createPersistenceQueue(setSaveState);
  const surfaceApiRef = useRef(null);
  const autoSaveRef = useRef(true);
  autoSaveRef.current=store.data.settings?.autoSave!==false;
  const [appearanceState,setAppearanceState]=useState({dirty:false,pending:false,error:''});
  const appearanceSave=useRef(null);
  if(!appearanceSave.current)appearanceSave.current=createLatestValueSave(value=>persistence.current.write('appearance',()=>call('save_asset_inner_canvas_appearance',value),{retainFailure:false}),{notify:setAppearanceState});
  const flushRef = useRef(() => text.controller.flush());
  const registerFlush = useCallback((flush) => {flushRef.current=flush;return () => {flushRef.current=()=>text.controller.flush();};},[text.controller]);
  const hasPendingChanges=()=>!!(surfaceApiRef.current?.hasPendingChanges() || text.controller.snapshot().dirty || appearanceSave.current.snapshot().dirty || persistence.current.snapshot().pending || persistence.current.snapshot().error);
  const flush = async () => {
    await (surfaceApiRef.current?.flush() || text.controller.flush());
    await appearanceSave.current.flush();
    await persistence.current.flush();
  };
  const flushCurrent=useRef(flush),hasPendingCurrent=useRef(hasPendingChanges);
  flushCurrent.current=flush;hasPendingCurrent.current=hasPendingChanges;
  useEffect(() => {
    const beforeLeave = event => event.detail.promises.push((async()=>{
      surfaceApiRef.current?.cancelInteraction();
      if(!autoSaveRef.current && hasPendingCurrent.current()) {
        setModeError('有未保存的修改，请先点击保存后离开。');
        throw Error('请手动保存后离开');
      }
      if(autoSaveRef.current)await flushCurrent.current();
    })());
    const tick=event=>{
      if(!autoSaveRef.current || surfaceApiRef.current?.hasActiveInteraction())return;
      event.detail.promises.push(appearanceSave.current.saveOnce());
    };
    window.addEventListener('asset-text-before-leave',beforeLeave);
    window.addEventListener('canvas-auto-save',tick);
    return ()=>{window.removeEventListener('asset-text-before-leave',beforeLeave);window.removeEventListener('canvas-auto-save',tick);};
  },[text.controller]);

  const a = store.data.assets.find((x) => x.id === assetId);
  const prompts = store.data.prompts.filter((x) => x.assetId === assetId);
  const canvasObjects = useMemo(()=>store.data.innerCanvasObjects.filter(item=>item.assetId===assetId),[store.data.innerCanvasObjects,assetId]);
  const [viewMode, setViewMode] = useState(a?.detailViewMode || "");
  const [canvasReady, setCanvasReady] = useState(false);
  const [prepareError, setPrepareError] = useState('');
  const [prepareAttempt, setPrepareAttempt] = useState(0);
  const [modeError, setModeError] = useState('');
  const [modeSaving, setModeSaving] = useState(false);
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
    setPrepareError('');
    store.run("ensure_asset_inner_canvas", { assetId })
      .then(() => { if (active) setCanvasReady(true); })
      .catch(reason => { if (active) setPrepareError(String(reason)); });
    return () => { active = false; };
  }, [assetId, viewMode, prepareAttempt]);
  useEffect(() => () => clearTimeout(copyTimer.current), []);
  const changeViewMode = async (mode) => {
    if (mode === viewMode || modeSaving) return;
    setModeSaving(true);setModeError('');
    try {
      if(!autoSaveRef.current && hasPendingChanges())throw Error('请先点击保存，再切换显示方式。');
      if(autoSaveRef.current)await flush();
      await store.run("save_asset_detail_view_mode", { assetId, mode });
      setViewMode(mode);
    } catch (reason) {setModeError(`显示方式尚未切换：${String(reason)}`);}
    finally {setModeSaving(false);}
  };
  const textProps = {
    surfaceApiRef,
    autoSave:store.data.settings?.autoSave!==false,
    settings:store.data.settings,
    onManualSave:async()=>{await flushCurrent.current();setModeError('');},
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
        {modeError && <p className="form-error" role="alert">{modeError}</p>}
      </section>
    );
  if (viewMode === "canvas") {
    const canvasViewport = store.data.innerCanvasViewports.find((item) => item.assetId === assetId);
    const ownAppearance = (store.data.innerCanvasAppearances || []).find(item => item.assetId === assetId);
    const inheritedAppearance = resolveCanvasAppearance(store.data.categories.find(item => item.id === a.categoryId), store.data.settings);
    const saveAppearance = async appearance => {
      const update = value => store.setData(d => ({...d, innerCanvasAppearances: [...(d.innerCanvasAppearances || []).filter(item => item.assetId !== assetId), ...(value ? [{assetId, ...value}] : [])]}));
      appearanceSave.current.seed({assetId,color:ownAppearance?.color??null,pattern:ownAppearance?.pattern??null});
      update(appearance);
      appearanceSave.current.draft({assetId,color:appearance?.color??null,pattern:appearance?.pattern??null},{schedule:false});
    };
    const saveObjects = (items,options={}) => text.controller.commit('canvas',[...items,...(options.textBlocks || [])],items);
    const addSample = (center) => {
      const params = new URLSearchParams({ inner: "1", centerX: String(center.x), centerY: String(center.y) });
      go(`add-example/${workspaceId}/${assetId}?${params.toString()}`);
    };
    return (
      <section className="asset-inner-detail ui-detail-page">
        <header className="inner-detail-header ui-workbar">
          <div>
            <h1>{a.name}</h1>
            {a.description && <p className="inner-detail-description">{a.description}</p>}
          </div>
          <div className="detail-view-toggle" aria-label="资产详情显示方式">
            <button className="" onClick={() => changeViewMode("standard")}>标准详情</button>
            <button className="active" aria-current="page">内画布</button>
          </div>
          <button className="secondary" onClick={()=>flush().then(()=>setModeError('')).catch(error=>setModeError(String(error)))}><Save size={16}/>保存</button>
          <span className="ui-status" role="status">{text.pending || saveState.pending ? '正在保存…' : text.dirty || appearanceState.dirty ? '待保存' : ''}</span>
        </header>
        {text.error && <div className="asset-text-save-error" role="alert"><span>文字尚未保存：{text.error}</span><button className="secondary" onClick={()=>flush().catch(()=>{})}>重试保存</button></div>}
        {modeError && <div className="ui-save-error" role="alert">{modeError}</div>}
        {appearanceState.error && <div className="ui-save-error" role="alert"><span>背景尚未保存：{appearanceState.error}</span><button onClick={()=>appearanceSave.current.retry().catch(()=>{})}>重试保存</button></div>}
        {saveState.error && <div className="ui-save-error" role="alert"><span>画布状态尚未保存：{saveState.error}</span><button className="secondary" onClick={()=>persistence.current.retry().catch(()=>{})}>重试保存</button></div>}
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
            onSaveViewport={(viewport) => persistence.current.write('viewport', () => call("save_asset_inner_canvas_viewport", { assetId, viewportX: viewport.x, viewportY: viewport.y, zoom: viewport.zoom }))}
            onAddSample={addSample}
            onEditPrompt={(promptId) => setEditingPrompt(prompts.find((prompt) => prompt.id === promptId) || null)}
          />
        ) : (
          prepareError ? <div className="ui-save-error" role="alert"><span>无法准备内画布：{prepareError}</span><button className="secondary" onClick={()=>setPrepareAttempt(value=>value+1)}>重试</button></div> : <div className="inner-canvas-loading" role="status">正在准备资产内画布…</div>
        )}
        {editingPrompt && <PromptEditDialog store={store} prompt={editingPrompt} onClose={() => setEditingPrompt(null)} />}
        {copyNotice && <div className="toast copy-toast">{copyNotice}</div>}
      </section>
    );
  }
  return (
    <section className="asset-detail-main ui-detail-page">
      <header className="asset-detail-header ui-workbar">
        <div>
          <h1>{a.name}</h1>
          <p>{a.description || "暂无简介。"}</p>
          <details className="asset-metadata"><summary>文件信息</summary>
            <span>
              存储方式：{a.storageMode === "managed" ? "托管" : "引用"}
            </span>
            <span>文件：{a.originalFilePath || a.sourceFilePath}</span>
          </details>
        </div>
        <div className="detail-header-actions">
          <div className="detail-view-toggle" aria-label="资产详情显示方式">
            <button className="active" aria-current="page">标准详情</button>
            <button onClick={() => changeViewMode("canvas")}>内画布</button>
          </div>
          <button className="secondary" onClick={()=>flush().then(()=>setModeError('')).catch(error=>setModeError(String(error)))}><Save size={16}/>保存</button>
          <span className="ui-status" role="status">{text.pending ? '正在保存…' : text.dirty ? '文字待保存' : ''}</span>
        </div>
      </header>
      {text.error && <div className="asset-text-save-error" role="alert"><span>文字尚未保存：{text.error}</span><button className="secondary" onClick={()=>flush().catch(()=>{})}>重试保存</button></div>}
      {modeError && <div className="ui-save-error" role="alert">{modeError}</div>}
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
