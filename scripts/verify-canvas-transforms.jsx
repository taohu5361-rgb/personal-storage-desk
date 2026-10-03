import React,{useState,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {mockIPC} from '@tauri-apps/api/mocks';
import {AssetCanvas} from '../src/components/AssetCanvas';
import {AssetInnerCanvas} from '../src/components/AssetInnerCanvas';
import {createTextBlockItem} from '../src/data/assetText';
import {toTextSurfaceItem} from '../src/data/assetText';
import {categoryTextBlock} from '../src/data/categoryText';
import {flushBeforeNavigation} from '../src/hooks/useHashRoute';
import '../src/theme.css';import '../src/styles.css';
const preview='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160"><rect width="240" height="160" fill="#8497c0"/><text x="50" y="90" font-size="25">测试资产</text></svg>');
const seed=()=>({assets:['a','b','c'].map((id,n)=>({id,categoryId:'qa',workspaceId:'w',name:'资产 '+id,x:200+n*270,y:180+n*20,width:240,height:160,rotation:0,tags:[],zIndex:n+1,previewUrl:preview,locked:false})),texts:['t1','t2'].map((id,n)=>categoryTextBlock({...createTextBlockItem('qa',{x:240+n*360,y:500},'sticky',10+n),objectId:id,textValue:'文字 '+id,width:220,height:100},'qa')),groups:[]});
let db=JSON.parse(localStorage.getItem('transform-qa')||'null')||seed(),failure=false,writes=[];
let drawers=[{id:'d',assetId:'a',mode:'docked-expanded',side:'right',offset:0,width:180,height:120,orderIndex:0,locked:false,text:'跟随资产旋转',createdAt:1,updatedAt:1}];
mockIPC(async command=>{if(command==='list_asset_note_drawers')return drawers;if(command==='set_asset_text_close_guard')return;throw Error(command);});
const store=next=>{db=next;localStorage.setItem('transform-qa',JSON.stringify(db));};
function Fixture(){
 const [assets,setAssets]=useState(db.assets),[texts,setTexts]=useState(db.texts),[groups,setGroups]=useState(db.groups),[mode,setMode]=useState('outer'),[view,setView]=useState({id:'qa',name:'验收',viewportX:0,viewportY:0,zoom:1,canvasColor:'#000000',canvasPattern:'grid'});
 const [inner,setInner]=useState(db.texts.map(t=>({...t,id:t.id,assetId:'qa'}))),ref=useRef(null);
 const saveText=async changes=>{if(failure)throw Error('模拟保存失败');const removed=new Set(changes.deleteIds),updates=new Map(changes.upserts.map(t=>[t.id,t]));const next=[...db.texts.filter(t=>!removed.has(t.id)&&!updates.has(t.id)),...updates.values()];store({...db,texts:next});setTexts(next);};
 const saveTransform=async batch=>{if(failure)throw Error('模拟保存失败');writes.push(batch);const patch=(old,values)=>old.map(i=>({...i,...values.find(v=>v.id===i.id)}));let nextTexts=[...db.texts];for(const t of batch.textChanges?.upserts||[]){const index=nextTexts.findIndex(i=>i.id===t.id);if(index>=0)nextTexts[index]=t;else nextTexts.push(t);}const next={assets:patch(assets,batch.assets),texts:patch(nextTexts,batch.texts),groups:patch(groups,batch.groups)};store(next);setTexts(next.texts);};
 window.transformQA={state:()=>({assets,texts,groups,inner,db,writes}),failure:v=>{failure=v;},view:zoom=>setView(v=>({...v,zoom})),mode:setMode,flush:flushBeforeNavigation,api:()=>ref.current,reset:()=>{store(seed());location.reload();}};
 return <main className="app-shell" style={{padding:0}}><nav style={{height:44,display:'flex',gap:8}}><button onClick={()=>setMode('outer')}>外画布</button><button onClick={()=>setMode('inner')}>内画布</button></nav>{mode==='outer'?<AssetCanvas ref={ref} assets={assets} textBlocks={texts} groups={groups} activeCategory={view} search="" categories={[]} fonts={[]} settings={{autoSave:true,showSelectionBorder:true,showAssetTags:true}} onAssetsChange={setAssets} onGroupsChange={setGroups} onSaveText={saveText} onSaveTransform={saveTransform} onViewportChange={v=>setView(c=>({...c,...v}))} onOpen={()=>{}} onImageMetrics={()=>{}}/>:<AssetInnerCanvas assetId="qa" textBlocks={inner} objects={[]} prompts={[]} fonts={[]} initialViewport={view} canvasAppearance={{color:'#000000',pattern:'grid'}} onSaveObjects={async(objects,{textBlocks})=>{if(failure)throw Error('模拟保存失败');const next=textBlocks.map(t=>({...t,id:t.objectId,content:t.textValue}));setInner(next);}} onSaveViewport={()=>{}} onEditPrompt={()=>{}} onAddSample={()=>{}}/>}</main>;
}
document.documentElement.dataset.theme='dark';document.documentElement.dataset.effectiveTheme='dark';
createRoot(document.getElementById('root')).render(<Fixture/>);
