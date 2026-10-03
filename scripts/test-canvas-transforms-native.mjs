import { reportDirectory, browserOptions, qaBaseURL, debugExecutable, connectIsolated, isolatedDirectory } from './qa-support.mjs';
// Isolated real SQLite + WebView2 acceptance. Never touches the user's running app.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {createTextBlockItem} from '../src/data/assetText.js';
import {categoryTextBlock} from '../src/data/categoryText.js';
import {splitTextItem} from '../src/data/assetTextModel.js';
import {cornersOf,objectToWorld,boundsOf} from '../src/components/canvasTransforms.js';
import { chromium } from 'playwright';
const root=isolatedDirectory(import.meta.url);await mkdir(root,{recursive:true});const report=path.join(root,'native-result.json'),checks=[],errors=[];
let child,browser,page,locker;const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function launch(){
 child=spawn(debugExecutable(),[],{windowsHide:true,stdio:'ignore',env:{...process.env,CREATIVE_CLOTH_TEST_DATA_DIR:root,WEBVIEW2_USER_DATA_FOLDER:path.join(root,'webview'),WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9462'}});
 for(let n=0;n<100;n++){try{browser=await connectIsolated('http://127.0.0.1:9462', root);break;}catch{await delay(150);}}
 assert.ok(browser,'isolated WebView unavailable');page=browser.contexts()[0].pages()[0];page.on('pageerror',e=>errors.push(e.message));await page.waitForFunction(()=>window.__TAURI_INTERNALS__&&!document.querySelector('.boot-screen'));assert.ok((await state()).databasePath.startsWith(root+path.sep));console.log('Native URL',page.url(),await page.locator('script[src]').evaluateAll(els=>els.map(e=>e.src)));
}
const invoke=(command,args={})=>page.evaluate(({command,args})=>window.__TAURI_INTERNALS__.invoke(command,args),{command,args});
const state=()=>invoke('load_app_state');
async function waitSaved(predicate){for(let n=0;n<50;n++){const d=await state();if(predicate(d))return d;await delay(100);}throw Error('SQLite write not observed');}
async function stop(){const exited=new Promise(resolve=>child.once('exit',resolve));await page.getByRole('button',{name:'关闭',exact:true}).click();assert.equal(await Promise.race([exited,delay(10000).then(()=>{throw Error('isolated process did not exit');})]),0);await browser.close().catch(()=>{});browser=null;}
const asset=id=>page.locator(`[data-asset-id="${id}"]`),text=id=>page.locator(`[data-object-id="${id}"]`);
async function pick(locator,ctrl=false){const b=await locator.boundingBox();if(ctrl)await page.keyboard.down('Control');await page.mouse.click(b.x+b.width/2,b.y+b.height/2);if(ctrl)await page.keyboard.up('Control');}
async function blank(selector='.asset-canvas'){
 const point=await page.locator(selector).evaluate(surface=>{
  const r=surface.getBoundingClientRect();
  for(let y=r.top+25;y<r.bottom-20;y+=30)for(let x=r.left+25;x<r.right-20;x+=30){
   const hit=document.elementFromPoint(x,y);
   if(hit===surface||hit?.matches('.canvas-world,.inner-canvas-world'))return {x,y};
  }
  throw Error('No unobstructed canvas background');
 });
 await page.mouse.click(point.x,point.y);await page.waitForFunction(()=>!document.querySelector('input[aria-label="旋转角度"]'));
}
async function drag(locator,dx,dy,{alt=true,cancel=false}={}){const b=await locator.boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2;if(alt)await page.keyboard.down('Alt');await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:6});if(cancel)await page.keyboard.press('Escape');await page.mouse.up();if(alt)await page.keyboard.up('Alt');await delay(180);}
try{
 await launch();let d=await state();const settings={...d.settings,closeBehavior:'exit',confirmDelete:false,autoSave:true};await invoke('save_settings',{item:settings});
 const now=Date.now(),source=path.join(root,'source.bin'),image=path.join(root,'sample.png');await writeFile(source,'canvas transform isolated source');
 const painter=spawn((process.env.PYTHON_RUNTIME || 'python'),['-c','from PIL import Image; import sys; Image.new("RGB",(240,160),(113,139,186)).save(sys.argv[1])',image],{windowsHide:true});assert.equal(await new Promise(r=>painter.once('exit',r)),0);
 await invoke('save_workspace',{item:{id:'transform-w',name:'画布变换验收',description:'',coverPath:'',notes:'',createdAt:now,updatedAt:now}});
 await invoke('save_category',{item:{id:'transform-c',workspaceId:'transform-w',name:'布局测试',description:'',icon:'',createdAt:now,updatedAt:now,viewportX:30,viewportY:30,zoom:1,canvasColor:'#000000',canvasPattern:'grid'}});
 for(const [n,id]of ['a','b','c'].entries())await invoke('save_asset',{item:{id,categoryId:'transform-c',workspaceId:'transform-w',name:'卡片 '+id,description:'',storageMode:'reference',selectedFilePath:source,sourceFilePath:source,originalFilePath:'',coverStorageMode:'reference',selectedCoverPath:image,coverSourcePath:image,coverOriginalPath:'',useSourceAsCover:false,filePath:'',tags:[],notes:'',createdAt:now+n,x:100+n*260,y:150+n*220,width:240,height:160,zIndex:n+1,locked:false}});
 const block=categoryTextBlock({...createTextBlockItem('transform-c',{x:160,y:440},'sticky',10),objectId:'outer-text',textValue:'可旋转的外画布文字',width:220,height:100},'transform-c');await invoke('save_category_text_changes',{categoryId:'transform-c',changes:{upserts:[block],deleteIds:[]}});
 const existing=await invoke('list_asset_note_drawers',{assetIds:['a']});await invoke(existing.length?'save_asset_note_drawer':'create_asset_note_drawer',{drawer:{id:'drawer-a',assetId:'a',text:'备注随卡片转动',mode:'docked-expanded',side:'right',offset:10,width:180,height:120,orderIndex:0,locked:false,styleVariant:'default',createdAt:now,updatedAt:now}});
 await page.reload();await page.waitForFunction(()=>!document.querySelector('.boot-screen'));await page.evaluate(()=>location.hash='assets/transform-w?category=transform-c');await page.waitForSelector('[data-asset-id="a"]');
 await pick(asset('a'));await page.getByLabel('旋转角度',{exact:true}).fill('30');await blank();d=await waitSaved(d=>d.assets.find(a=>a.id==='a')?.rotation===30);checks.push('outer blank click commits angle before deselection into SQLite');
 await page.getByLabel('撤销画布操作').click();await waitSaved(d=>d.assets.find(a=>a.id==='a')?.rotation===0);assert.equal(await page.getByLabel('撤销画布操作').isDisabled(),true);await page.getByLabel('重做画布操作').click();await waitSaved(d=>d.assets.find(a=>a.id==='a')?.rotation===30);checks.push('blank click creates exactly one undo step');
 await pick(asset('a'));await page.getByLabel('旋转角度',{exact:true}).fill('60');await pick(asset('b'));await waitSaved(d=>d.assets.find(a=>a.id==='a')?.rotation===60);assert.equal((await state()).assets.find(a=>a.id==='b').rotation,0);checks.push('switching objects commits to original asset');
 await pick(asset('a'));await page.getByLabel('旋转角度',{exact:true}).fill('30');await page.getByLabel('旋转角度',{exact:true}).press('Enter');d=await waitSaved(d=>d.assets.find(a=>a.id==='a')?.rotation===30);
 await pick(text('outer-text'));await page.getByLabel('旋转角度',{exact:true}).fill('-25');await blank();await waitSaved(d=>d.categoryTextBlocks.find(t=>t.id==='outer-text')?.rotation===-25);await page.reload();await page.waitForSelector('[data-asset-id="a"]');assert.equal((await state()).categoryTextBlocks.find(t=>t.id==='outer-text').rotation,-25);checks.push('outer text blank click persists after reload');await pick(text('outer-text'));await page.getByLabel('旋转归零',{exact:true}).click();await waitSaved(d=>d.categoryTextBlocks.find(t=>t.id==='outer-text')?.rotation===0);await pick(asset('a'));
 const before=d.assets.find(a=>a.id==='a');await drag(asset('a'),40,20,{cancel:true});d=await state();assert.equal(d.assets.find(a=>a.id==='a').x,before.x);assert.equal(d.assets.find(a=>a.id==='a').rotation,30);checks.push('Escape cancels without persisting preview');
 // Drag the attached drawer along the rotated local edge using real pointer input.
 const header=page.locator('[data-drawer-id="drawer-a"] .asset-note-drawer-header'),hr=await header.boundingBox(),start={x:hr.x+hr.width/2,y:hr.y+hr.height/2},scale=await page.evaluate(()=>parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-scale'))||1);await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x-10*scale,start.y+17.320508*scale,{steps:6});await page.mouse.up();await delay(250);let drawers=await invoke('list_asset_note_drawers',{assetIds:['a']});assert.equal(drawers[0].side,'right');assert.ok(Math.abs(drawers[0].offset-30)<1,JSON.stringify(drawers[0]));checks.push('rotated drawer local edge drag persists');
 await page.screenshot({path:path.join(root,'outer-rotated.png')});
 await page.getByLabel('旋转归零',{exact:true}).click();await waitSaved(d=>d.assets.find(a=>a.id==='a').rotation===0);await pick(asset('a'));await pick(text('outer-text'),true);assert.match(await page.locator('.canvas-arrange-toolbar').innerText(),/排列 · 2/);
 const old=(await state()).assets.find(a=>a.id==='a'),oldText=(await state()).categoryTextBlocks.find(t=>t.id==='outer-text');await drag(asset('a'),30,20);d=await waitSaved(d=>Math.abs(d.assets.find(a=>a.id==='a').x-old.x-30)<.2&&Math.abs(d.categoryTextBlocks.find(t=>t.id==='outer-text').x-oldText.x-30)<.2);checks.push('mixed asset and text drag committed together');
 await page.getByLabel('撤销画布操作').click();await waitSaved(d=>Math.abs(d.assets.find(a=>a.id==='a').x-old.x)<.2&&Math.abs(d.categoryTextBlocks.find(t=>t.id==='outer-text').x-oldText.x)<.2);await page.getByLabel('重做画布操作').click();await waitSaved(d=>Math.abs(d.assets.find(a=>a.id==='a').x-old.x-30)<.2);checks.push('mixed geometry undo and redo');
 await pick(text('outer-text'),true);await page.getByLabel('旋转角度',{exact:true}).fill('15');await page.getByLabel('旋转角度',{exact:true}).press('Tab');await waitSaved(d=>d.assets.find(a=>a.id==='a').rotation===15);
 // Real writer lock: neither asset nor text may partially commit.
 const dbPath=(await state()).databasePath;locker=spawn((process.env.PYTHON_RUNTIME || 'python'),['-u','-c','import sqlite3,sys;c=sqlite3.connect(sys.argv[1]);c.execute("BEGIN IMMEDIATE");print("LOCKED",flush=True);sys.stdin.readline();c.rollback();c.close()',dbPath],{windowsHide:true});await new Promise((resolve,reject)=>{locker.stdout.once('data',resolve);locker.once('error',reject);});
 await page.getByLabel('旋转角度',{exact:true}).fill('37');await page.getByLabel('旋转角度',{exact:true}).press('Tab');await page.waitForSelector('.canvas-transform-error',{timeout:12000});
 locker.stdin.end('\n');await new Promise(r=>locker.once('exit',r));locker=null;assert.equal((await state()).assets.find(a=>a.id==='a').rotation,15);assert.equal(Number(await page.getByLabel('旋转角度',{exact:true}).inputValue()),37);await page.locator('.canvas-transform-error').getByRole('button',{name:'重试保存'}).click();await waitSaved(d=>d.assets.find(a=>a.id==='a').rotation===37);checks.push('actual SQLite lock preserves draft and retry saves it');
 await invoke('save_prompt',{item:{id:'p',assetId:'a',promptType:'natural',positivePrompt:'',negativePrompt:'',naturalPrompt:'提示词测试',content:'提示词测试',selectedImagePath:image,sampleStorageMode:'reference',sampleSourcePath:image,sampleOriginalPath:'',sampleImagePath:image,sampleFileName:'sample.png',metadataJson:'',title:'样图',notes:'内画布备注',createdAt:now,updatedAt:now}});
 await invoke('ensure_asset_inner_canvas',{assetId:'a'});await invoke('save_asset_detail_view_mode',{assetId:'a',mode:'canvas'});
 const t=createTextBlockItem('a',{x:550,y:300},'panel',30);t.objectId='inner-text';t.textValue='旋转文字 中文 English';t.title='标题';const v=splitTextItem(t,'a','canvas');await invoke('save_asset_text_changes',{assetId:'a',viewMode:'canvas',changes:{creates:[v.element],layouts:[v.layout],updates:[],deleteIds:[],innerObjects:[]}});
 await page.reload();await page.waitForFunction(()=>!document.querySelector('.boot-screen'));await page.evaluate(()=>location.hash='asset/transform-w/a');await page.waitForSelector('.asset-inner-canvas');await page.getByRole('button',{name:'适应全部',exact:true}).click();
 await pick(text('inner-text'));await page.getByLabel('旋转角度',{exact:true}).fill('45');await blank('.asset-inner-canvas');await waitSaved(d=>d.assetTextLayouts.find(l=>l.textId==='inner-text'&&l.viewMode==='canvas')?.rotation===45);checks.push('inner blank click rotation stored independently');
 await text('inner-text').dblclick();await page.getByLabel('编辑文字块内容').fill('旋转后中文编辑保持布局');await page.getByLabel('编辑文字块内容').press('Control+Enter');await waitSaved(d=>d.assetTextElements.find(e=>e.id==='inner-text')?.content==='旋转后中文编辑保持布局');checks.push('rotated editor supports Chinese text');
 await page.getByRole('button',{name:'标准详情',exact:true}).click();await page.waitForSelector('.standard-text-surface');d=await waitSaved(d=>d.assetTextLayouts.some(l=>l.textId==='inner-text'&&l.viewMode==='standard'));const standard=d.assetTextLayouts.find(l=>l.textId==='inner-text'&&l.viewMode==='standard');assert.equal(standard.rotation,0);checks.push('standard detail has independent zero-angle layout');
 await page.getByRole('button',{name:'内画布',exact:true}).click();await page.waitForSelector('.asset-inner-canvas');await page.getByRole('button',{name:'适应全部',exact:true}).click();d=await state();const sample=d.innerCanvasObjects.find(o=>o.objectType==='sample');await pick(text(sample.objectId));await page.getByLabel('旋转角度',{exact:true}).fill('-25');await page.getByLabel('旋转角度',{exact:true}).press('Tab');await waitSaved(d=>d.innerCanvasObjects.find(o=>o.objectId===sample.objectId)?.rotation===-25);checks.push('inner sample rotation persists');
 await page.screenshot({path:path.join(root,'inner-rotated.png')});
 const expected=await state();await writeFile(report,JSON.stringify({checks,errors,expected},null,2));await stop();await launch();d=await state();assert.deepEqual(d.assetTextLayouts,expected.assetTextLayouts);assert.deepEqual(d.innerCanvasObjects,expected.innerCanvasObjects);for(const a of expected.assets){const b=d.assets.find(i=>i.id===a.id);assert.deepEqual([b.x,b.y,b.width,b.height,b.rotation],[a.x,a.y,a.width,a.height,a.rotation]);}assert.deepEqual(d.categoryTextBlocks,expected.categoryTextBlocks);checks.push('real process exit and restart restores layouts and angles');
 assert.deepEqual(errors,[]);await writeFile(report,JSON.stringify({checks,errors,expected},null,2));console.log(`PASS ${checks.length} native canvas transform scenarios; SQLite/restart verified`);await stop();
}finally{if(locker){locker.stdin.end('\n');}if(browser)await browser.close().catch(()=>{});}
