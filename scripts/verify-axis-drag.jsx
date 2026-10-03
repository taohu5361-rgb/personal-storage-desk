import React,{Profiler,useState,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {mockIPC} from '@tauri-apps/api/mocks';
import {AssetCanvas} from '../src/components/AssetCanvas';
import {AssetInnerCanvas} from '../src/components/AssetInnerCanvas';
import '../src/theme.css';import '../src/styles.css';
const preview='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="560" height="420"><rect width="560" height="420" fill="#ced9e9"/><circle cx="280" cy="160" r="78" fill="#faf6ef"/><path d="M200 220h160l70 185H130z" fill="#557aac"/></svg>');
const previewFor=(width,height)=>'data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 560 420" preserveAspectRatio="none"><rect width="560" height="420" fill="#ced9e9"/><circle cx="280" cy="160" r="78" fill="#faf6ef"/><path d="M200 220h160l70 185H130z" fill="#557aac"/></svg>`);
mockIPC(async command=>{if(command==='list_asset_note_drawers')return [];if(command==='set_asset_text_close_guard')return;throw Error(command);});
window.__TAURI_INTERNALS__.convertFileSrc=path=>path==='t'?previewFor(212,376):path==='c'?previewFor(190,100):preview;
const seed=()=>({assets:[{id:'r',name:'中心图片',x:180,y:180,width:560,height:420,tags:['不计入中心'],rotation:0,zIndex:1},{id:'t',name:'移动图片',x:900,y:220,width:212,height:376,tags:[],rotation:0,zIndex:2},{id:'c',name:'另一张图片',x:700,y:680,width:190,height:100,tags:[],rotation:0,zIndex:3}].map(a=>({...a,categoryId:'axis-qa',workspaceId:'w',previewUrl:previewFor(a.width,a.height),locked:false})),objects:[{objectId:'r',x:180,y:180,width:560,height:420},{objectId:'t',x:900,y:220,width:212,height:376},{objectId:'c',x:700,y:680,width:190,height:100}].map(a=>({...a,objectType:'sample',sourcePromptId:a.objectId,fieldKey:'',rotation:0,zIndex:1,locked:false}))});
let db=JSON.parse(localStorage.getItem('axis-drag-qa')||'null')||seed(),writes=0;
const save=()=>localStorage.setItem('axis-drag-qa',JSON.stringify(db));
const timings=[];
function Fixture(){
 const [assets,setAssets]=useState(db.assets),[objects,setObjects]=useState(db.objects),[mode,setMode]=useState('outer'),[epoch,setEpoch]=useState(0),[view,setView]=useState({id:'axis-qa',name:'连续拖动与中轴线',viewportX:0,viewportY:0,zoom:1});
 const ref=useRef(null);
 window.axisQA={state:()=>({assets,objects,db,writes,mode,view}),reset:()=>{db=seed();save();setAssets(db.assets);setObjects(db.objects);setEpoch(v=>v+1);setView(v=>({...v,viewportX:0,viewportY:0,zoom:1}));},mode:setMode,view:setView,ui:value=>document.documentElement.style.setProperty('--ui-scale',value),timings:()=>timings,resetTimings:()=>timings.splice(0),patch:(id,patch)=>{if(mode==='outer'){db={...db,assets:assets.map(a=>a.id===id?{...a,...patch}:a)};setAssets(db.assets);}else{db={...db,objects:objects.map(a=>a.objectId===id?{...a,...patch}:a)};setObjects(db.objects);}save();},selectBox:()=>ref.current};
 return <main className="app-shell" style={{padding:0}}><nav style={{height:44,display:'flex',gap:8}}><button onClick={()=>setMode('outer')}>外画布</button><button onClick={()=>setMode('inner')}>内画布</button></nav><Profiler id="canvas" onRender={(_,phase,actual)=>timings.push({phase,actual,time:performance.now()})}>
 {mode==='outer'?<AssetCanvas key={'outer:'+epoch} ref={ref} assets={assets} textBlocks={[]} groups={[]} activeCategory={view} search="" categories={[]} fonts={[]} settings={{autoSave:true,showSelectionBorder:true,showAssetTags:true}} onAssetsChange={setAssets} onGroupsChange={()=>{}} onSaveText={()=>{}} onSaveTransform={async batch=>{writes++;db={...db,assets:db.assets.map(a=>({...a,...batch.assets.find(p=>p.id===a.id)}))};save();}} onViewportChange={v=>setView(c=>({...c,...v}))} onOpen={()=>{}} onImageMetrics={()=>{}}/>:<AssetInnerCanvas key={'inner:'+epoch} assetId="axis-qa" objects={objects} textBlocks={[]} prompts={['r','t','c'].map(id=>({id,title:'隔离样图',sampleImagePath:id}))} fonts={[]} initialViewport={view} onSaveObjects={async next=>{writes++;db={...db,objects:next};save();setObjects(next);}} onSaveViewport={()=>{}} onAddSample={()=>{}} onEditPrompt={()=>{}}/>}
 </Profiler></main>;
}
document.documentElement.dataset.theme='dark';document.documentElement.dataset.effectiveTheme='dark';
createRoot(document.getElementById('root')).render(<Fixture/>);
