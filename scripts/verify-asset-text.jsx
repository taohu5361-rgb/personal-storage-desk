import React,{useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {AssetInnerCanvas} from '../src/components/AssetInnerCanvas';
import {AssetStandardTextLayer} from '../src/components/AssetStandardTextLayer';
import {createAssetTextController} from '../src/data/assetTextController.js';
import {splitTextItem,projectTextItems} from '../src/data/assetTextModel.js';
import {createTextBlockItem} from '../src/data/innerCanvasText.js';
import '../src/theme.css';import '../src/styles.css';
const key='asset-text-isolated-verification';
const seed=['plain','card','sticky','panel'].map((type,i)=>splitTextItem({...createTextBlockItem('test',{x:40+i*310,y:120},type,i+1,{surface:'#20252b',text:'#e8edf2',border:'#363e47'}),objectId:type,textValue:'共享文字 '+type,title:type==='panel'?'标题':''},'test','canvas'));
const initial=()=>JSON.parse(localStorage.getItem(key)||'null')||{elements:seed.map(s=>s.element),layouts:seed.map(s=>s.layout)};
function Fixture(){
  const [data,setData]=useState(initial),[mode,setMode]=useState('standard'),[fail,setFail]=useState(false),[clicks,setClicks]=useState(0);
  const failure=useRef(false);failure.current=fail;
  const flushRef=useRef(()=>Promise.resolve());
  const controllerRef=useRef(null);
  if(!controllerRef.current)controllerRef.current=createAssetTextController('test',data,async(view,changes)=>{
    await new Promise(r=>setTimeout(r,30));if(failure.current)throw Error('模拟写入失败');
    const db=JSON.parse(localStorage.getItem(key)||'null')||initial();
    const elements=new Map(db.elements.map(e=>[e.id,e]));const layouts=new Map(db.layouts.map(l=>[l.viewMode+':'+l.textId,l]));
    for(const e of [...changes.creates,...changes.updates])elements.set(e.id,e);
    for(const l of changes.layouts)layouts.set(l.viewMode+':'+l.textId,l);
    for(const id of changes.deleteIds){elements.delete(id);for(const [k,l] of layouts)if(l.textId===id)layouts.delete(k);}
    localStorage.setItem(key,JSON.stringify({elements:[...elements.values()],layouts:[...layouts.values()]}));
  },setData);
  const c=controllerRef.current;
  window.__textVerification={controller:c,snapshot:()=>c.snapshot(),mode,clicks};
  const props={assetId:'test',textController:c,textBlocks:projectTextItems(data.elements,data.layouts,mode).map(i=>({...i,id:i.objectId,content:i.textValue})),prompts:[],onDraft:items=>c.draft(mode,items),onSaveObjects:(objects,options)=>c.commit(mode,options.textBlocks),onRegisterFlush:fn=>{flushRef.current=fn;return()=>{flushRef.current=()=>c.flush();};},onAddSample:()=>setClicks(n=>n+1),onEditPrompt:()=>{}};
  return <main className="app-shell"><nav style={{display:'flex',gap:12,padding:12,flexWrap:'wrap'}}>
    <button onClick={async()=>{try{await flushRef.current();setMode(mode==='standard'?'canvas':'standard');}catch{}}}>切换视图</button><span data-testid="mode">{mode}</span>
    <button onClick={()=>setFail(!fail)}>模拟保存失败：{fail?'开':'关'}</button><button onClick={()=>c.flush().catch(()=>{})}>重试保存</button>
    <label>UI 缩放<select aria-label="界面缩放" onChange={e=>document.documentElement.style.setProperty('--ui-scale',e.target.value)}>{[1,.75,1.5].map(v=><option key={v}>{v}</option>)}</select></label>
    <button onClick={()=>{localStorage.removeItem(key);location.reload();}}>重置测试数据</button><output>{data.error || '就绪'}</output>
  </nav><section className={mode==='standard'?'asset-detail-main':'asset-inner-detail'} style={{flex:1,minHeight:0}}>
    {mode==='standard'?<AssetStandardTextLayer {...props}><article className="sample-case-row" style={{height:440}}><div>下层样图</div><div><p>下层 Prompt / 原有排版</p><button onClick={()=>setClicks(n=>n+1)}>原有详情按钮</button><output data-testid="clicks">{clicks}</output></div></article></AssetStandardTextLayer>:<AssetInnerCanvas {...props} objects={[]} initialViewport={{viewportX:20,viewportY:20,zoom:1}}/>}
  </section></main>;
}
document.documentElement.dataset.theme='dark';document.documentElement.dataset.effectiveTheme='dark';
createRoot(document.getElementById('root')).render(<Fixture/>);
