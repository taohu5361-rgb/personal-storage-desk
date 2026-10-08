import { useEffect, useRef, useState } from "react";
import { ArrowLeft, FileBox, ImagePlus, Save, UploadCloud } from "lucide-react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { call, fileUrl, id } from "../data/database";
import { Button, Dialog, Empty, Field } from "../components/ui/Primitives";
import { now } from "./pageUtils";
import { createDraftLeaveGuard } from "./corePageState.js";
import "../styles/pages-core.css";

const blankForm=()=>({title:"",positivePrompt:"",negativePrompt:"",naturalPrompt:"",content:"",notes:""});

export function Example({ store, workspaceId, assetId, go, query }) {
  const asset=store.data.assets.find(item=>item.id===assetId);
  const [type,setType]=useState("positive-negative");
  const [sample,setSample]=useState(null);
  const [dragging,setDragging]=useState(false);
  const [error,setError]=useState("");
  const [saving,setSaving]=useState(false);
  const [importing,setImporting]=useState(false);
  const [dirty,setDirty]=useState(false);
  const [leaveRequested,setLeaveRequested]=useState(false);
  const [form,setForm]=useState(blankForm);
  const dirtyRef=useRef(false),savingRef=useRef(false),importingRef=useRef(false),aliveRef=useRef(true),promptIdRef=useRef(""),createdAtRef=useRef(0);
  const guardRef=useRef(null);
  const markDirty=()=>{dirtyRef.current=true;setDirty(true);};
  if (!guardRef.current) guardRef.current=createDraftLeaveGuard({
    isDirty:()=>dirtyRef.current,isSaving:()=>savingRef.current || importingRef.current,
    onRequest:()=>setLeaveRequested(true),
    onAccept:()=>{dirtyRef.current=false;setDirty(false);},
    onResolve:()=>{if(aliveRef.current)setLeaveRequested(false);},
  });
  const set=(key,value)=>{markDirty();setForm(current=>({...current,[key]:value}));};
  const acceptImagePath=(path,name="")=>{
    if (!path || !aliveRef.current) return;
    const fileName=name || path.split(/[\\/]/).pop() || "样图";
    if (!/\.(png|jpe?g|webp)$/i.test(fileName)) {setError("请选择 PNG、JPG、JPEG 或 WEBP 图片。");return;}
    setError("");markDirty();setSample({path,name:fileName,previewUrl:fileUrl(path)});
  };
  const importImageBytes=async file=>{
    if (importingRef.current || savingRef.current) return;
    if (!file?.type?.startsWith("image/") || !/\.(png|jpe?g|webp)$/i.test(file.name || `image.${file.type.split("/")[1]}`)) {
      setError("请选择 PNG、JPG、JPEG 或 WEBP 图片。");return;
    }
    importingRef.current=true;setImporting(true);
    try {
      const bytes=Array.from(new Uint8Array(await file.arrayBuffer()));
      const extension=file.name?.split(".").pop() || file.type.split("/")[1] || "png";
      const path=await call("save_clipboard_sample_image",{bytes,extension});
      acceptImagePath(path,file.name || `clipboard.${extension}`);
    } catch(reason) {if(aliveRef.current)setError(`图片导入失败：${String(reason)}`);}
    finally {importingRef.current=false;if(aliveRef.current)setImporting(false);}
  };
  const chooseImage=async()=>{
    try {const path=await call("pick_cover_image");if(path)acceptImagePath(path);}
    catch(reason){setError(`无法选择图片：${String(reason)}`);}
  };
  useEffect(()=>{
    aliveRef.current=true;
    const beforeLeave=event=>event.detail.promises.push(guardRef.current.request().then(accepted=>{
      if(!accepted)throw new Error("样图编辑仍未保存。");return true;
    }));
    window.addEventListener("asset-text-before-leave",beforeLeave);
    return()=>{aliveRef.current=false;guardRef.current.dispose();window.removeEventListener("asset-text-before-leave",beforeLeave);};
  },[]);
  useEffect(()=>{
    setType("positive-negative");setSample(null);setForm(blankForm());setDirty(false);dirtyRef.current=false;promptIdRef.current="";createdAtRef.current=0;setError("");
  },[assetId,workspaceId]);
  useEffect(()=>{
    let disposed=false,unlisten;
    const paste=async event=>{
      if (savingRef.current) return;
      const image=[...(event.clipboardData?.items || [])].find(item=>item.type.startsWith("image/"));
      if(!image)return;event.preventDefault();await importImageBytes(image.getAsFile());
    };
    window.addEventListener("paste",paste);
    if(window.__TAURI_INTERNALS__)getCurrentWebview().onDragDropEvent(event=>{
      if(savingRef.current)return;
      if(event.payload.type==="over")setDragging(true);
      if(event.payload.type==="leave")setDragging(false);
      if(event.payload.type==="drop"){
        setDragging(false);
        const path=event.payload.paths?.find(item=>/\.(png|jpe?g|webp)$/i.test(item));
        if(path)acceptImagePath(path);else setError("拖入的文件不是受支持的图片。");
      }
    }).then(dispose=>{if(disposed)dispose();else unlisten=dispose;}).catch(reason=>{if(!disposed)setError(`拖拽监听启动失败：${String(reason)}`);});
    return()=>{disposed=true;window.removeEventListener("paste",paste);unlisten?.();};
  },[]);
  const save=async event=>{
    event.preventDefault();
    if(savingRef.current || importing)return;
    if(!sample){setError("请先选择一张样图图片。");return;}
    if(!form.title.trim()){setError("请填写样图标题。");return;}
    savingRef.current=true;setSaving(true);setError("");
    try {
      const promptId=promptIdRef.current || (promptIdRef.current=id("prompt"));
      const createdAt=createdAtRef.current || (createdAtRef.current=now());
      await store.run("save_prompt",{item:{
        id:promptId,assetId,promptType:type,selectedImagePath:sample.path,
        sampleStorageMode:asset?.storageMode || "reference",sampleSourcePath:"",sampleOriginalPath:"",
        sampleImagePath:"",sampleFileName:sample.name,
        metadataJson:JSON.stringify({schemaVersion:1,comfyUi:null,seed:null,steps:null,cfg:null,sampler:null,scheduler:null,loras:[],workflow:null}),
        ...form,title:form.title.trim(),createdAt,updatedAt:now(),
      }});
      if(query.get("inner")==="1"){
        await call("ensure_asset_inner_canvas",{assetId});
        const state=await call("load_app_state");
        const caseObjects=state.innerCanvasObjects.filter(item=>item.assetId===assetId&&item.sourcePromptId===promptId);
        const sampleObject=caseObjects.find(item=>item.objectType==="sample");
        const centerX=Number(query.get("centerX")),centerY=Number(query.get("centerY"));
        if(sampleObject&&Number.isFinite(centerX)&&Number.isFinite(centerY)){
          const dx=centerX-sampleObject.x-sampleObject.width/2,dy=centerY-sampleObject.y-sampleObject.height/2;
          await call("save_asset_inner_canvas_layout",{assetId,objects:caseObjects.map(item=>({...item,x:item.x+dx,y:item.y+dy}))});
        }
      }
      dirtyRef.current=false;setDirty(false);savingRef.current=false;
      const accepted=await go(`asset/${workspaceId}/${assetId}`);
      if(!accepted&&aliveRef.current)setError("样图已保存，但页面暂未离开。请重试返回详情。");
    }catch(reason){if(aliveRef.current)setError(`保存失败：${String(reason)}。编辑内容已保留，可以重试。`);}
    finally {savingRef.current=false;if(aliveRef.current)setSaving(false);}
  };
  if(!asset)return <Empty icon={FileBox} title="找不到这个资产" text="资产可能已被移除。" action="返回画布" onAction={()=>go(`assets/${workspaceId}`)}/>;
  return <>
    <form className="editor-page core-sample-editor" onSubmit={save} aria-busy={saving || importing}>
      <header className="ui-workbar core-sample-workbar">
        <div className="core-workbar-title"><Button className="secondary" disabled={saving} onClick={()=>go(`asset/${workspaceId}/${assetId}`)}><ArrowLeft size={16}/>返回详情</Button><div><h1>新增样图案例</h1><p title={asset.name}>{asset.name}</p></div></div>
        <div className="core-workbar-actions"><span className="core-draft-status" role="status">{saving ? "正在保存…" : importing ? "正在导入图片…" : !sample && !form.title.trim() ? "请选择样图并填写标题" : !sample ? "请选择样图" : !form.title.trim() ? "请填写标题" : dirty ? "未保存" : ""}</span><Button type="submit" variant="primary" className="primary" disabled={saving || importing || !sample || !form.title.trim()}><Save size={16}/>{saving ? "正在保存…" : "保存样图"}</Button></div>
      </header>
      {error&&<div className="core-page-feedback"><p className="core-error" role="alert">{error}</p></div>}
      <fieldset className="core-sample-fields" disabled={saving || importing}>
        <div className="core-sample-layout">
          <section className="core-sample-media">
            <div className={`sample-upload core-sample-upload ${dragging ? "is-dragging":""} ${sample ? "has-image":""}`}
              onDragOver={event=>{event.preventDefault();if(!savingRef.current)setDragging(true);}}
              onDragLeave={()=>setDragging(false)}
              onDrop={async event=>{event.preventDefault();setDragging(false);if(!savingRef.current&&event.dataTransfer.files?.[0])await importImageBytes(event.dataTransfer.files[0]);}}>
              <div className="sample-upload-label"><h2>样图图片</h2><small>必填</small></div>
              {sample ? <><div className="sample-preview"><img src={sample.previewUrl} alt={sample.name}/></div><div className="sample-file-row"><span title={sample.name}>{sample.name}</span><div><Button className="secondary" onClick={chooseImage}>更换图片</Button><Button className="secondary danger" onClick={()=>{markDirty();setSample(null);}}>移除</Button></div></div></> : <button type="button" className="sample-drop-target" onClick={chooseImage}><UploadCloud size={30} strokeWidth={1.5} aria-hidden="true"/><strong>选择或拖入样图</strong><small>PNG、JPG、JPEG、WEBP<br/>也可以直接粘贴剪贴板图片</small></button>}
            </div>
            <p className="sample-storage-note"><FileBox size={16} aria-hidden="true"/><span>样图按照当前资产的“{asset.storageMode==="managed" ? "托管":"引用"}”方式保存；剪贴板图片会自动托管。</span></p>
          </section>
          <section className="core-sample-prompt">
            <div className="core-sample-basics"><Field label="标题（必填）"><input required autoFocus value={form.title} onChange={event=>set("title",event.target.value)} placeholder="为这个案例填写标题"/></Field><Field label="Prompt 类型"><select value={type} onChange={event=>{markDirty();setType(event.target.value);}}><option value="positive-negative">正面 + 负面</option><option value="natural">自然语言</option><option value="five-point">五点式</option><option value="none">无提示词</option></select></Field></div>
            <div className="core-prompt-fields">
              {type==="positive-negative" ? <><Field label="正面提示词"><textarea rows={7} value={form.positivePrompt} onChange={event=>set("positivePrompt",event.target.value)}/></Field><Field label="负面提示词"><textarea rows={4} value={form.negativePrompt} onChange={event=>set("negativePrompt",event.target.value)}/></Field></> : type==="natural" ? <Field label="自然语言提示词"><textarea rows={10} value={form.naturalPrompt} onChange={event=>set("naturalPrompt",event.target.value)}/></Field> : type==="five-point" ? <Field label="五点式内容"><textarea rows={10} value={form.content} onChange={event=>set("content",event.target.value)}/></Field> : <p className="core-no-prompt"><ImagePlus size={18} aria-hidden="true"/>此案例仅记录样图与备注。</p>}
              <Field label="备注 / 使用建议"><textarea rows={3} value={form.notes} onChange={event=>set("notes",event.target.value)}/></Field>
            </div>
          </section>
        </div>
      </fieldset>
    </form>
    {leaveRequested&&<Dialog title="离开样图编辑" description="还有未保存的样图和提示词。放弃修改后将离开当前页面。" onCancel={()=>guardRef.current.resolve(false)} onSubmit={()=>guardRef.current.resolve(true)} submitLabel="放弃修改" danger protectDraft={false}><p>选择“取消”继续编辑，或放弃本次修改。</p></Dialog>}
  </>;
}
