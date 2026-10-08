// Full product UI with isolated in-memory IPC. No native/file/process operations.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { mockIPC, mockWindows } from '@tauri-apps/api/mocks';
import App from '../src/App';
import { applyTheme } from '../src/theme';
import { createTextBlockItem } from '../src/data/assetText';
import { categoryTextBlock } from '../src/data/categoryText';
import { splitTextItem } from '../src/data/assetTextModel';
import '../src/theme.css';
import '../src/styles.css';
import '../src/styles/ui-system.css';
import '../src/styles/pages-editor.css';

const picture = (label, colors) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="440"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="${colors[0]}"/><stop offset="1" stop-color="${colors[1]}"/></linearGradient></defs><rect width="640" height="440" fill="url(#g)"/><circle cx="340" cy="150" r="70" fill="${colors[2]}"/><path d="M0 440 L160 200 L320 420 L475 245 L640 440Z" fill="${colors[3]}"/><text x="32" y="55" fill="white" font-family="Microsoft YaHei UI" font-size="24">${label}</text></svg>`);
const images = [picture('视觉探索', ['#73828c','#adb8bb','#e9d4a1','#495b66']), picture('构图参考', ['#bfa689','#d8c7b0','#f5e0bb','#6e7974']), picture('材质研究', ['#759394','#adc0bc','#dccb95','#425e59'])];
const at = Date.now();
const outerText = categoryTextBlock({...createTextBlockItem('c1',{x:50,y:380},'sticky',8),objectId:'ct1',textValue:'制作方向\n保留柔和的光线与材质细节',width:280,height:120},'c1');
const innerText = splitTextItem({...createTextBlockItem('a1',{x:510,y:70},'panel',9),objectId:'it1',textValue:'质感说明\n冷暖对比，保留细微颗粒',width:280,height:140},'a1','canvas');
let data = {
  workspaces:[{id:'w1',name:'视觉素材库',description:'样图、参数与创作记录',coverPath:images[0],notes:'',createdAt:at,updatedAt:at},{id:'w2',name:'参考资料',description:'收纳日常参考与文件',coverPath:images[1],notes:'',createdAt:at,updatedAt:at}],
  scriptCategories:[{id:'sc1',name:'日常工具',description:'常用脚本与应用入口',scripts:[{id:'s1',name:'图像批处理',description:'批量调整图片尺寸',filePath:'D:/Tools/image-batch.py',launchCommand:'',launchArgs:''},{id:'s2',name:'整理下载目录',description:'归档已下载的文件',filePath:'D:/Tools/archive.ps1',launchCommand:'',launchArgs:''}]},{id:'sc2',name:'实验工具',description:'',scripts:[]}],
  categories:[{id:'c1',workspaceId:'w1',name:'灵感参考',description:'图像与创作笔记',viewportX:30,viewportY:35,zoom:1,canvasColor:'#000000',canvasPattern:'grid',createdAt:at,updatedAt:at},{id:'c2',workspaceId:'w1',name:'待整理',description:'',viewportX:40,viewportY:40,zoom:1,canvasColor:'#ffffff',canvasPattern:'dots',createdAt:at,updatedAt:at}],
  assets:images.map((previewPath,n)=>({id:`a${n+1}`,categoryId:'c1',workspaceId:'w1',name:['建筑氛围','自然光线','材质纹理'][n],description:'图像参考与相关提示词',storageMode:'reference',sourceFilePath:'D:/Reference/source.png',originalFilePath:'',coverStorageMode:'reference',coverSourcePath:previewPath,previewPath,thumbnailPath:previewPath,tags:['参考'],notes:'',createdAt:at,x:60+n*250,y:50+n*70,width:230,height:158,zIndex:n+1,locked:false,rotation:0,detailViewMode:'standard'})),
  groups:[],prompts:[{id:'p1',assetId:'a1',title:'清晨的建筑',promptType:'positive-negative',sampleImagePath:images[0],sampleFileName:'architecture.png',positivePrompt:'自然光线，柔和色调，建筑细节，film grain',negativePrompt:'模糊，过曝',naturalPrompt:'',content:'',notes:'优先保留清晨光线',createdAt:at}],
  innerCanvasObjects:[{id:'o1',objectId:'o1',objectType:'sample',assetId:'a1',sourcePromptId:'p1',x:50,y:50,width:410,height:310,zIndex:1,locked:false,rotation:0,fontSize:14},{id:'op1',objectId:'op1',objectType:'prompt',assetId:'a1',sourcePromptId:'p1',fieldKey:'positivePrompt',x:50,y:400,width:410,height:140,zIndex:2,locked:false,rotation:0,fontSize:14},{id:'op2',objectId:'op2',objectType:'prompt',assetId:'a1',sourcePromptId:'p1',fieldKey:'negativePrompt',x:510,y:270,width:280,height:130,zIndex:3,locked:false,rotation:0,fontSize:14}],
  innerCanvasViewports:[{assetId:'a1',viewportX:20,viewportY:30,zoom:1}],innerCanvasAppearances:[],categoryTextBlocks:[outerText],assetTextElements:[innerText.element],assetTextLayouts:[innerText.layout],customFonts:[],shortcutBindings:[],cacheBytes:0,databasePath:'memory://ui-qa',
  settings:{startupPage:'home',restoreWorkspace:true,lastPage:'home',autoSave:true,autoSaveInterval:60,confirmDelete:true,closeBehavior:'exit',theme:'dark',uiScale:100,uiDensity:'standard',propertyPanelLayout:'right',canvasBackground:'grid',canvasBackgroundColor:'#000000',backgroundOpacity:100,assetNameDisplay:'hover',showAssetTags:true,showImageShadow:true,showSelectionBorder:true,newAssetMaxEdge:420,showPerformance:false,verboseLogs:false,defaultImportMode:'reference',askImportMode:true,managedAssetDir:'D:/Isolated/Assets',autoPreview:true,autoThumbnail:true,previewMaxEdge:1600,thumbnailMaxEdge:320,migrationCompleted:true},
};
let failure = '', delay = 0, writes = [];
const drawers = [{id:'nd1',assetId:'a1',categoryId:'c1',text:'观察光线方向',mode:'floating',floatingX:620,floatingY:350,width:210,height:130,side:'right',offset:0,orderIndex:0,locked:false,textScale:1,styleVariant:'default',createdAt:at,updatedAt:at}];
const currentDrawers = () => drawers.map(item => ({...item,categoryId:item.assetId ? data.assets.find(asset=>asset.id===item.assetId)?.categoryId || item.categoryId : item.categoryId}));
const upsert = (key, items) => { const changed = new Map(items.map(item => [item.id || item.textId, item])); data[key] = data[key].map(item => changed.has(item.id || item.textId) ? {...item,...changed.get(item.id || item.textId)} : item); for(const item of items) if(!data[key].some(old => (old.id || old.textId) === (item.id || item.textId))) data[key].push(item); };
mockWindows('main');
mockIPC(async (command, args = {}) => {
  if(command === 'load_app_state') return structuredClone(data);
  if(command === 'get_startup_theme') return data.settings.theme;
  if(command === 'database_info') return {databasePath:data.databasePath,integrity:'ok',databaseBytes:0,cacheBytes:0};
  if(command === 'list_asset_note_drawers') return structuredClone(currentDrawers().filter(item => args.assetIds?.includes(item.assetId)));
  if(command === 'list_category_note_drawers') return structuredClone(currentDrawers().filter(item => item.categoryId === args.categoryId));
  if(['set_asset_text_close_guard','diagnostic_log','ensure_asset_inner_canvas','finish_window_close'].includes(command)) return true;
  if(command.startsWith('plugin:')) return null;
  if(command.startsWith('pick_')) return null;
  if(delay) await new Promise(resolve => setTimeout(resolve, delay));
  if(failure && command === failure) throw Error('隔离测试：磁盘写入失败');
  writes.push({command,args:structuredClone(args)});
  if(command === 'save_settings') data.settings=structuredClone(args.item);
  else if(command === 'save_last_page') data.settings.lastPage=args.page;
  else if(command === 'save_asset_detail_view_mode') upsert('assets',[{id:args.assetId,detailViewMode:args.mode}]);
  else if(command === 'save_script_category') upsert('scriptCategories',[args.item]);
  else if(command === 'save_workspace') upsert('workspaces',[args.item]);
  else if(command === 'save_category') upsert('categories',[args.item]);
  else if(command === 'save_asset') upsert('assets',[args.item]);
  else if(command === 'save_canvas_layout') upsert('assets',args.items.map(item=>({...item,id:item.assetId})));
  else if(command === 'save_canvas_groups') upsert('groups',args.items);
  else if(command === 'add_canvas_group_member') upsert('assets',[{id:args.assetId,groupId:args.groupId}]);
  else if(command === 'remove_canvas_group_member') {const asset=data.assets.find(item=>item.id===args.assetId);if(asset?.groupId===args.groupId)upsert('assets',[{id:args.assetId,groupId:null}]);}
  else if(command === 'save_viewport') upsert('categories',[{id:args.categoryId,...args}]);
  else if(command === 'save_canvas_appearance') upsert('categories',[{id:args.categoryId,canvasColor:args.color,canvasPattern:args.pattern}]);
  else if(command === 'save_asset_inner_canvas_viewport') {data.innerCanvasViewports=[...data.innerCanvasViewports.filter(item=>item.assetId!==args.assetId),args];}
  else if(command === 'save_asset_inner_canvas_appearance') {data.innerCanvasAppearances=data.innerCanvasAppearances.filter(item=>item.assetId!==args.assetId);if(args.color!=null||args.pattern!=null)data.innerCanvasAppearances.push({assetId:args.assetId,color:args.color,pattern:args.pattern});}
  else if(command === 'save_asset_text_changes') { const changes=args.changes;upsert('assetTextElements',[...(changes.creates||[]),...(changes.updates||[])]);for(const layout of changes.layouts||[]){data.assetTextLayouts=data.assetTextLayouts.filter(old=>!(old.textId===layout.textId&&old.viewMode===layout.viewMode));data.assetTextLayouts.push(layout);}data.assetTextElements=data.assetTextElements.filter(item=>!changes.deleteIds?.includes(item.id));data.assetTextLayouts=data.assetTextLayouts.filter(item=>!changes.deleteIds?.includes(item.textId));upsert('innerCanvasObjects',changes.innerObjects||[]); }
  else if(command === 'save_category_text_changes') {upsert('categoryTextBlocks',args.changes.upserts);data.categoryTextBlocks=data.categoryTextBlocks.filter(item=>!args.changes.deleteIds.includes(item.id));}
  else if(command === 'save_canvas_transform') {upsert('assets',args.assets);upsert('groups',args.groups);upsert('categoryTextBlocks',[...(args.textChanges?.upserts||[]),...args.texts]);}
  else if(command === 'update_prompt_content') upsert('prompts',[args.item]);
  else if(command === 'launch_script') return true;
  else if(command === 'create_asset_note_drawer') {drawers.push(structuredClone(args.drawer));return structuredClone(args.drawer);}
  else if(command === 'save_asset_note_drawer' || command === 'transfer_asset_note_drawer') {const at=drawers.findIndex(item=>item.id===args.drawer.id);if(at<0)throw Error('备注不存在');if(command==='transfer_asset_note_drawer'&&(drawers[at].assetId??null)!==(args.expectedAssetId??null))throw Error('备注关联已经变化');drawers[at]=structuredClone(args.drawer);return structuredClone(drawers[at]);}
  else if(command === 'delete_asset_note_drawer') {const at=drawers.findIndex(item=>item.id===args.id);if(at>=0)drawers.splice(at,1);}
  else if(command === 'delete_asset') data.assets=data.assets.filter(item=>item.id!==args.id);
  else if(command === 'delete_category') data.categories=data.categories.filter(item=>item.id!==args.id);
  else if(command === 'delete_workspace') {data.workspaces=data.workspaces.filter(item=>item.id!==args.id);data.assets=data.assets.filter(item=>item.workspaceId!==args.id);data.categories=data.categories.filter(item=>item.workspaceId!==args.id);}
  else throw Error(`未实现的隔离IPC：${command}`);
  return true;
}, {shouldMockEvents:true});
window.__TAURI_INTERNALS__.convertFileSrc = file => file.startsWith('data:') ? file : images[0];
window.uiQA = {state:()=>structuredClone(data),drawers:()=>structuredClone(currentDrawers()),writes:()=>structuredClone(writes),fail:command=>{failure=command},delay:value=>{delay=value},theme:applyTheme};
applyTheme('dark');
createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
