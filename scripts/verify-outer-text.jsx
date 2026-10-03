import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {mockIPC} from '@tauri-apps/api/mocks';
import {AssetCanvas} from '../src/components/AssetCanvas';
import {flushBeforeNavigation} from '../src/hooks/useHashRoute';
import {shortcutFromEvent,SHORTCUT_ACTIONS} from '../src/shortcuts/registry';
import '../src/theme.css';import '../src/styles.css';
const key='outer-text-isolated-verification';
let stored=JSON.parse(localStorage.getItem(key)||'[]');
let drawers=[{id:'drawer',assetId:'asset',text:'图片备注',mode:'floating',side:'left',offset:0,width:240,height:150,floatingX:60,floatingY:260,orderIndex:0,locked:false,styleVariant:'default',createdAt:1,updatedAt:1}];
mockIPC(async(command,args)=>{
  if(command==='list_asset_note_drawers')return drawers;
  if(command==='save_asset_note_drawer'){drawers=drawers.map(d=>d.id===args.drawer.id?args.drawer:d);return args.drawer;}
  if(command==='set_asset_text_close_guard')return;
  throw Error('Unexpected mock command '+command);
});
const preview='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#eeeeee"/><text x="90" y="150" font-size="30">测试资产</text></svg>');
function Fixture(){
  const [blocks,setBlocks]=useState(stored),[category,setCategory]=useState({id:'outer-a',name:'外画布',viewportX:0,viewportY:0,zoom:1,canvasColor:'#191d21',canvasPattern:'dots'}),[fail,setFail]=useState(false),[opens,setOpens]=useState(0);
  const [assets,setAssets]=useState([{id:'asset',workspaceId:'w',categoryId:'outer-a',name:'样图资产',x:60,y:30,width:320,height:210,zIndex:1,locked:false,tags:[],previewUrl:preview}]);
  const ref=useRef(null),failure=useRef(false);failure.current=fail;
  useEffect(()=>{const down=e=>{if(e.defaultPrevented||e.isComposing||e.target.closest?.('textarea,input,select'))return;const key=shortcutFromEvent(e);if(!key)return;const action=SHORTCUT_ACTIONS.find(a=>a.defaultShortcut===key);if(action&&ref.current?.textAction(action.actionId))e.preventDefault();};window.addEventListener('keydown',down);return()=>window.removeEventListener('keydown',down);},[]);
  window.outerTextQA={blocks:()=>stored,category:()=>category,assets:()=>assets,opens:()=>opens,fail:()=>setFail(v=>!v),viewport:v=>setCategory(c=>({...c,...v})),flush:flushBeforeNavigation};
  return <main className="app-shell" style={{padding:12,gap:8}}><nav className="canvas-header-actions"><button onClick={()=>ref.current.addText()}>添加文字</button>
    <button onClick={async()=>{if(await flushBeforeNavigation())setCategory(c=>({...c,id:c.id==='outer-a'?'outer-b':'outer-a'}));}}>切换分类</button><output data-testid="category">{category.id}</output>
    <button onClick={()=>setFail(!fail)}>模拟保存失败：{fail?'开':'关'}</button>
    <label>界面缩放<select aria-label="界面缩放" onChange={e=>document.documentElement.style.setProperty('--ui-scale',e.target.value)}>{[1,.75,1.5].map(v=><option key={v}>{v}</option>)}</select></label>
    <output data-testid="opens">{opens}</output></nav>
    <AssetCanvas ref={ref} assets={category.id==='outer-a'?assets:[]} activeCategory={category} groups={[]} search="" categories={[]}
      textBlocks={blocks.filter(b=>b.categoryId===category.id)} fonts={[]}
      settings={{autoSave:true,showImageShadow:true,showSelectionBorder:true,showAssetTags:true}}
      onSaveText={async changes=>{await new Promise(r=>setTimeout(r,40));if(failure.current)throw Error('模拟磁盘失败');const removed=new Set(changes.deleteIds),updates=new Map(changes.upserts.map(b=>[b.id,b]));stored=[...stored.filter(b=>!removed.has(b.id)&&!updates.has(b.id)),...updates.values()];localStorage.setItem(key,JSON.stringify(stored));setBlocks(stored);}}
      onAssetsChange={setAssets} onAssetsCommit={()=>{}} onViewportChange={v=>setCategory(c=>({...c,...v}))} onOpen={()=>setOpens(n=>n+1)} onImageMetrics={()=>{}} onAdd={()=>{}}/>
  </main>;
}
document.documentElement.dataset.theme='dark';document.documentElement.dataset.effectiveTheme='dark';
createRoot(document.getElementById('root')).render(<Fixture/>);
