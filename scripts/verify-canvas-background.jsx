import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { mockIPC } from '@tauri-apps/api/mocks';
import { AssetCanvas } from '../src/components/AssetCanvas';
import { AssetInnerCanvas } from '../src/components/AssetInnerCanvas';
import { resolveCanvasAppearance } from '../src/canvasAppearance';
import '../src/theme.css';
import '../src/styles.css';

mockIPC(command => (command === 'list_asset_note_drawers' || command === 'list_category_note_drawers') ? [] : undefined);
document.documentElement.dataset.theme = 'dark';
document.documentElement.dataset.effectiveTheme = 'dark';
const key = 'canvas-background-isolated-qa';
const preview = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#d2d8e1"/><circle cx="200" cy="135" r="75" fill="#8291ab"/></svg>')}`;
const initialAssets = [{ id: 'qa-image', categoryId: 'qa', name: '图片与备注的衬底', tags: [], x: 260, y: 160, width: 400, height: 300, previewUrl: preview }];
function Fixture() {
  const [category,setCategory] = useState(() => JSON.parse(localStorage.getItem(key) || 'null') || {id:'qa',canvasColor:'#ffffff',canvasPattern:'dots',viewportX:0,viewportY:0,zoom:1});
  const [mode,setMode] = useState('outer');
  const [assets,setAssets] = useState(initialAssets);
  const update = change => setCategory(current => {const next = {...current,...change};localStorage.setItem(key,JSON.stringify(next));return next;});
  window.canvasQA = {category, setMode, update, setTheme(theme){document.documentElement.dataset.theme=theme;document.documentElement.dataset.effectiveTheme=theme;}};
  return <main className="app-shell" style={{height:'100vh'}}><section style={{flex:1,minHeight:0,display:'flex',padding:16}}>
    {mode === 'outer' ? <AssetCanvas assets={assets} categories={[]} activeCategory={category} search=""
      settings={{autoSave:true,showSelectionBorder:true,showImageShadow:true,showAssetTags:true}}
      onAssetsChange={setAssets} onAssetsCommit={()=>{}} onViewportChange={v=>update(v)} onOpen={()=>{}}
      onCanvasAppearance={({color,pattern})=>update({canvasColor:color,canvasPattern:pattern})} />
      : <AssetInnerCanvas assetId="qa-image" objects={[]} prompts={[]} initialViewport={category}
        canvasAppearance={resolveCanvasAppearance(category)} onSaveObjects={()=>{}} onAddSample={()=>{}}
        onSaveViewport={v=>update({viewportX:v.x,viewportY:v.y,zoom:v.zoom})} onEditPrompt={()=>{}} />}
  </section></main>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
