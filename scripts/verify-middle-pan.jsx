import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {mockIPC} from '@tauri-apps/api/mocks';
import {AssetCanvas} from '../src/components/AssetCanvas';
import {AssetInnerCanvas} from '../src/components/AssetInnerCanvas';
import {createTextBlockItem} from '../src/data/assetText';
import '../src/theme.css';
import '../src/styles.css';
import './verify-middle-pan.css';

document.documentElement.dataset.theme='dark';
document.documentElement.dataset.effectiveTheme='dark';
const illustration=(locked=false)=>'data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="${locked?'#465568':'#4b766d'}"/><stop offset="1" stop-color="#b7c9b8"/></linearGradient></defs><rect width="480" height="320" fill="url(#sky)"/><circle cx="352" cy="88" r="35" fill="#e2d7b3"/><path d="M0 225 110 103 245 261 330 145 480 253V320H0" fill="#263e3c"/><path d="M0 263 100 216 240 272 368 208 480 249V320H0" fill="#142d2c"/><text x="26" y="286" fill="#e5eee7" font-family="sans-serif" font-size="20">${locked?'锁定图片 · 试试中键':'可拖动图片 · 左键移动'}</text></svg>`);
const image=illustration(), lockedImage=illustration(true);
const initialAssets=()=>[
  {id:'image',categoryId:'demo',name:'山间样图',tags:[],x:100,y:70,width:330,height:220,zIndex:1,locked:false,previewUrl:image},
  {id:'locked',categoryId:'demo',name:'锁定图片',tags:[],x:630,y:65,width:240,height:160,zIndex:2,locked:true,previewUrl:lockedImage}
];
const initialObjects=()=>[
  {objectId:'sample',assetId:'inner',objectType:'sample',sourcePromptId:'sample-prompt',x:100,y:70,width:330,height:220,zIndex:1,locked:false},
  {objectId:'locked-sample',assetId:'inner',objectType:'sample',sourcePromptId:'locked-prompt',x:630,y:65,width:240,height:160,zIndex:2,locked:true},
  {objectId:'prompt',assetId:'inner',objectType:'prompt',sourcePromptId:'sample-prompt',fieldKey:'positivePrompt',x:100,y:355,width:330,height:140,zIndex:3,locked:false}
];
const block=(id,category=false)=>{
  const b=createTextBlockItem(category?'demo':'inner',{x:630,y:325},'card',4,{canvas:'#181b20',surface:'#20242a',text:'#e2e5e9',border:'#40454c'});
  return {...b,id,width:240,height:155,content:'在这里按住中键拖动：\n只移动画布。\n\n双击可以编辑，再试中键。',textColor:'#e2e5e9',backgroundColor:'#242b31',backgroundOpacity:100,...(category?{categoryId:'demo'}:{})};
};
const newDrawers=()=>[{id:'demo-note',assetId:'image',text:'备注内容也支持中键平移。\n双击正文进入编辑。',mode:'floating',side:'left',offset:0,width:330,height:145,floatingX:100,floatingY:355,orderIndex:0,locked:false,styleVariant:'default',createdAt:1,updatedAt:1}];
let drawers=newDrawers();
mockIPC(async(command,args)=>{
  if(command==='list_asset_note_drawers')return drawers;
  if(command==='save_asset_note_drawer'){drawers=drawers.map(d=>d.id===args.drawer.id?args.drawer:d);return args.drawer;}
  if(command==='set_asset_text_close_guard')return;
  if(command==='delete_asset_note_drawer'){drawers=drawers.filter(d=>d.id!==args.id);return;}
  throw Error('Demo 未实现命令：'+command);
});
window.__TAURI_INTERNALS__.convertFileSrc=path=>path;
const prompts=[{id:'sample-prompt',title:'山间样图',sampleImagePath:image,positivePrompt:'山间薄雾、松林与傍晚的光线。\n中键平移画布，左键移动这个 Prompt。'},{id:'locked-prompt',title:'锁定图片',sampleImagePath:lockedImage}];

function Demo(){
  const [mode,setMode]=useState('outer'),[generation,setGeneration]=useState(0),[gesture,setGesture]=useState('待操作');
  const [assets,setAssets]=useState(initialAssets),[outerTexts,setOuterTexts]=useState(()=>[block('outer-text',true)]);
  const [objects,setObjects]=useState(initialObjects),[innerTexts,setInnerTexts]=useState(()=>[block('inner-text')]);
  const [outerView,setOuterView]=useState({x:0,y:0,zoom:1}),[innerView,setInnerView]=useState({x:0,y:0,zoom:1});
  const stage=useRef(null), generationRef=useRef(0);
  const view=mode==='outer'?outerView:innerView;
  const reset=()=>{generationRef.current+=1;drawers=newDrawers();setAssets(initialAssets());setOuterTexts([block('outer-text',true)]);setObjects(initialObjects());setInnerTexts([block('inner-text')]);setOuterView({x:0,y:0,zoom:1});setInnerView({x:0,y:0,zoom:1});setGesture('待操作');setGeneration(generationRef.current);};
  useEffect(()=>{
    const down=e=>{if(stage.current?.contains(e.target))setGesture(e.button===1?'中键 · 平移画布':e.button===0?'左键 · 操作对象':'右键 · 菜单');};
    const up=()=>setGesture('已松开 · 待操作');
    window.addEventListener('pointerdown',down,true);window.addEventListener('pointerup',up,true);window.addEventListener('blur',up);
    return()=>{window.removeEventListener('pointerdown',down,true);window.removeEventListener('pointerup',up,true);window.removeEventListener('blur',up);};
  },[]);
  window.panDemo={mode,assets,objects,outerTexts,innerTexts,outerView,innerView,setMode,reset,setView:(v)=>mode==='outer'?setOuterView(v):setInnerView(v),setEmpty:()=>{generationRef.current+=1;setAssets([]);setOuterTexts([]);setObjects([]);setInnerTexts([]);drawers=[];setGeneration(generationRef.current);}};
  const saveOuter=async changes=>setOuterTexts(current=>[...current.filter(b=>!changes.deleteIds.includes(b.id)&&!changes.upserts.some(u=>u.id===b.id)),...changes.upserts]);
  return <main className="demo-shell">
    <header className="demo-header"><div><div className="demo-eyebrow">独立交互 DEMO</div><h1>中键移画布，左键移对象</h1></div><div className="demo-tabs" role="group" aria-label="画布模式">{[['outer','外画布'],['inner','内画布']].map(([key,label])=><button key={key} aria-pressed={mode===key} onClick={()=>{setMode(key);setGesture('待操作');}}>{label}</button>)}</div><button className="demo-reset" onClick={reset}>重置演示</button></header>
    <div className="demo-body"><aside className="demo-guide"><span className="demo-mode-label">{mode==='outer'?'分类 · 外画布':'单个资产 · 内画布'}</span><h2>试着拖一下</h2><div className="demo-instruction"><kbd>中键</kbd><strong>移动整张画布</strong><p>按住滚轮拖动。空白、图片、文字和备注上都可以。</p></div><div className="demo-instruction"><kbd>左键</kbd><strong>移动单个对象</strong><p>拖动图片或文字块。锁定图片保持原位。</p></div><p className="demo-extra">中央十字标记是固定参照。<br/>滚轮缩放；空格＋左键也可平移。</p><div className="demo-status" aria-live="polite"><span>当前操作</span><strong data-testid="gesture">{gesture}</strong><div><span>画布 X / Y</span><output data-testid="viewport">{Math.round(view.x)} / {Math.round(view.y)}</output></div><div><span>缩放</span><output>{Math.round(view.zoom*100)}%</output></div></div><p className="demo-scope">演示数据仅在本页内使用。<br/>刷新或重置即可还原。</p></aside>
    <section className="demo-stage" ref={stage} aria-label={`${mode==='outer'?'外':'内'}画布演示`}>
      {mode==='outer'?<AssetCanvas key={`outer-${generation}`} assets={assets} activeCategory={{id:'demo',name:'演示分类',viewportX:outerView.x,viewportY:outerView.y,zoom:outerView.zoom,canvasColor:'#000000',canvasPattern:'dots'}} groups={[]} categories={[]} search="" textBlocks={outerTexts} fonts={[]}
        settings={{autoSave:true,showImageShadow:true,showSelectionBorder:true,showAssetTags:true}}
        onAssetsChange={setAssets} onAssetsCommit={()=>{}} onSaveTransform={async batch=>{setAssets(current=>current.map(a=>({...a,...batch.assets.find(p=>p.id===a.id)})));setOuterTexts(current=>current.map(t=>({...t,...batch.texts.find(p=>p.id===t.id)})));}} onViewportChange={v=>setOuterView({x:v.viewportX,y:v.viewportY,zoom:v.zoom})} onSaveText={saveOuter} onOpen={()=>setMode('inner')} onImageMetrics={()=>{}} onAdd={()=>{}} onCanvasAppearance={()=>{}}/>
      :<AssetInnerCanvas key={`inner-${generation}`} assetId="inner" objects={objects} textBlocks={innerTexts} fonts={[]} prompts={prompts} initialViewport={{viewportX:innerView.x,viewportY:innerView.y,zoom:innerView.zoom}} canvasAppearance={{color:'#000000',pattern:'dots'}}
        onDraft={items=>{setObjects(items.filter(i=>i.objectType!=='textBlock'));setInnerTexts(items.filter(i=>i.objectType==='textBlock').map(i=>({...i,id:i.objectId,content:i.textValue})));}}
        onSaveObjects={async(items,options)=>{setObjects(items);setInnerTexts((options.textBlocks||[]).map(i=>({...i,id:i.objectId,content:i.textValue})));}}
        onSaveViewport={v=>{if(generation===generationRef.current)setInnerView(v);}} onAddSample={()=>{}} onEditPrompt={()=>{}}/>}
      <div className="demo-center" aria-hidden="true"><i/><span>画布中央</span></div>
    </section></div>
    <footer className="demo-footer"><span>中键只改变视图位置；对象在画布中的坐标保持不变。</span><span>独立副本 · 尚未合并到软件</span></footer>
  </main>;
}
createRoot(document.getElementById('root')).render(<Demo/>);
