import { reportDirectory, browserOptions, qaBaseURL, debugExecutable, connectIsolated, isolatedDirectory } from './qa-support.mjs';
// Native WebView + isolated SQLite acceptance; never use the user's database.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile,copyFile} from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
const root=isolatedDirectory(import.meta.url);
await mkdir(path.join(root,'bin'),{recursive:true});
const executable=path.join(root,'bin','script-collection.exe');
await copyFile(debugExecutable(),executable);
let child,browser,page;
const checks=[],errors=[];
const invoke=(command,args={})=>page.evaluate(({command,args})=>window.__TAURI_INTERNALS__.invoke(command,args),{command,args});
const state=()=>invoke('load_app_state');
const go=hash=>page.evaluate(hash=>{location.hash=hash;},hash);
const surface=()=>page.locator('.asset-canvas,.asset-inner-canvas').first();
const view=()=>page.locator('.canvas-world,.asset-inner-canvas > .inner-canvas-world').first().evaluate(node=>{const m=new DOMMatrix(getComputedStyle(node).transform);return {x:m.e,y:m.f,zoom:m.a};});
const positions=async()=>{const s=await state();return {assets:s.assets.map(a=>[a.id,a.x,a.y,a.width,a.height,a.rotation]),inner:s.innerCanvasObjects.map(a=>[a.objectId,a.x,a.y,a.width,a.height,a.rotation]),text:s.assetTextLayouts.map(a=>[a.elementId,a.viewMode,a.x,a.y,a.width,a.height,a.rotation])};};
const pointOf=async locator=>{const r=await locator.boundingBox();assert.ok(r);return {x:r.x+r.width/2,y:r.y+r.height/2};};
const drag=async(point,button='middle',dx=58,dy=36)=>{await page.mouse.move(point.x,point.y);await page.mouse.down({button});await page.mouse.move(point.x+dx,point.y+dy,{steps:8});await page.mouse.up({button});await page.waitForTimeout(400);};
async function pan(label,point){const before=await view(),objects=await positions();await drag(point);const after=await view();assert.ok(Math.abs(after.x-before.x-58)<1,`${label}: viewport X`);assert.ok(Math.abs(after.y-before.y-36)<1,`${label}: viewport Y`);assert.deepEqual(await positions(),objects,`${label}: object layout preserved`);await page.mouse.move(point.x+85,point.y+70);await page.waitForTimeout(280);assert.deepEqual(await view(),after,`${label}: release ends pan`);checks.push(label);console.log('PASS '+label);return after;}
async function launch(){
  child=spawn(executable,[],{windowsHide:true,stdio:'ignore',env:{...process.env,CREATIVE_CLOTH_TEST_DATA_DIR:root,WEBVIEW2_USER_DATA_FOLDER:path.join(root,'webview'),WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9487'}});
  for(let n=0;n<100;n++){try{browser=await connectIsolated('http://127.0.0.1:9487', root);break;}catch{await new Promise(r=>setTimeout(r,150));}}
  assert.ok(browser,'isolated WebView reachable');page=browser.contexts()[0].pages()[0];page.on('pageerror',e=>errors.push(e.message));
  await page.waitForFunction(()=>window.__TAURI_INTERNALS__&&!document.querySelector('.boot-screen'));
  assert.ok(path.resolve((await state()).databasePath).startsWith(root+path.sep),'test database stays in isolated directory');
  const s=await state();await invoke('save_settings',{item:{...s.settings,theme:'dark',closeBehavior:'exit',uiScale:100,autoSave:true,autoSaveInterval:5}});
}
async function close(){
  const exit=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('isolated app failed to exit normally')),15000);child.once('exit',()=>{clearTimeout(timer);resolve();});});
  await invoke('finish_window_close').catch(()=>{});await exit;await browser.close().catch(()=>{});browser=null;page=null;await new Promise(r=>setTimeout(r,350));
}
try{
  await launch();const now=Date.now();
  await invoke('save_workspace',{item:{id:'pan-w',name:'中键隔离验收',description:'',coverPath:'',notes:'',createdAt:now,updatedAt:now}});
  await invoke('save_category',{item:{id:'pan-c',workspaceId:'pan-w',name:'画布',description:'',icon:'',createdAt:now,updatedAt:now,viewportX:0,viewportY:0,zoom:1,canvasColor:'#000000',canvasPattern:'dots'}});
  const file=path.join(root,'sample.png');await writeFile(file,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAADAAAAAgCAIAAADbtmxLAAAA3ElEQVR42mMMqilkGEyAiWGQgVEHDTkHsdDBjgnRThBGwdJ9A+wguFOQufidNVzS0LnDJ0gNHoLi5DsI4hpi3ESPEEJ2By3cxERhTOFxE67ES7VEjctu6oYTI5GVK0FbjWwt6FcOURgGxLiDhCgj0jXUijgmKlpDFTcxUdcCyt3ERHWjKXQTEy0MpUQ7E42SAtmGMNGulCPPKCbalbnkGchE05qSDGOZaOoaMgxnorVrSHUT83dGRvq0TSXlZQZXN4jIQKJrI58YN9G710HQTQPQDcLvpoHpl+FxEwBsJm/uOTwLbgAAAABJRU5ErkJggg==','base64'));
  const asset={id:'pan-a',categoryId:'pan-c',workspaceId:'pan-w',name:'可移动样图',description:'',storageMode:'reference',selectedFilePath:file,sourceFilePath:file,originalFilePath:'',coverStorageMode:'reference',selectedCoverPath:'',coverSourcePath:'',coverOriginalPath:'',useSourceAsCover:true,filePath:'',tags:[],notes:'',createdAt:now,x:80,y:70,width:300,height:200,zIndex:1,rotation:0,locked:false};
  await invoke('save_asset',{item:asset});await invoke('save_asset',{item:{...asset,id:'pan-locked',name:'锁定样图',x:580,y:70,width:210,height:140,locked:true}});
  await invoke('save_prompt',{item:{id:'pan-p',assetId:'pan-a',promptType:'natural',positivePrompt:'中键专门平移画布',negativePrompt:'',naturalPrompt:'样图',content:'',selectedImagePath:file,sampleStorageMode:'reference',sampleSourcePath:file,sampleOriginalPath:'',sampleImagePath:file,sampleFileName:'sample.png',metadataJson:'',title:'样图',notes:'备注',createdAt:now,updatedAt:now}});
  await invoke('save_asset_detail_view_mode',{assetId:'pan-a',mode:'canvas'});
  await page.reload();await go('assets/pan-w?category=pan-c');await surface().waitFor();
  let r=await surface().boundingBox();await pan('原生外画布中央中键平移',{x:r.x+r.width/2,y:r.y+r.height/2});
  await pan('原生外画布图片上中键平移',await pointOf(page.locator('[data-asset-id="pan-a"] .canvas-asset-image')));
  await pan('原生外画布锁定图片上中键平移',await pointOf(page.locator('[data-asset-id="pan-locked"] .canvas-asset-image')));
  const leftBefore=await view(),before=(await state()).assets.find(a=>a.id==='pan-a');
  await drag(await pointOf(page.locator('[data-asset-id="pan-a"] .canvas-asset-image')),'left',45,30);
  await page.waitForFunction(async x=>(await window.__TAURI_INTERNALS__.invoke('load_app_state')).assets.find(a=>a.id==='pan-a').x!==x,before.x);
  assert.deepEqual(await view(),leftBefore);checks.push('原生外画布左键只移动图片并保存');
  await page.getByRole('button',{name:'添加文字',exact:true}).click();const editor=page.getByLabel('编辑文字块内容');await editor.fill('中键平移验收文字');await editor.press('Control+Enter');await page.waitForTimeout(500);
  const outerText=page.locator('.inner-object-textBlock .text-block-content');await outerText.waitFor();await pan('原生外画布文字上中键平移',await pointOf(outerText));
  const outerSaved=await view();await page.waitForFunction(async v=>{const c=(await window.__TAURI_INTERNALS__.invoke('load_app_state')).categories.find(c=>c.id==='pan-c');return Math.abs(c.viewportX-v.x)<1&&Math.abs(c.viewportY-v.y)<1;},outerSaved);
  await page.screenshot({path:path.join(root,'native-outer.png')});
  await go('asset/pan-w/pan-a');await page.locator('.asset-inner-canvas').waitFor();await page.getByRole('button',{name:'适应全部',exact:true}).click();await page.waitForTimeout(400);
  await pan('原生内画布样图上中键平移',await pointOf(page.locator('.inner-object-sample').first()));
  r=await surface().boundingBox();await pan('原生内画布中央中键平移',{x:r.x+r.width/2,y:r.y+r.height/2});
  await page.getByRole('button',{name:'添加文字',exact:true}).click();await editor.fill('内画布中键验收文字');await editor.press('Control+Enter');await page.waitForTimeout(500);
  await pan('原生内画布文字上中键平移',await pointOf(page.locator('.inner-object-textBlock .text-block-content').first()));
  const innerSaved=await view();await page.waitForFunction(async v=>{const c=(await window.__TAURI_INTERNALS__.invoke('load_app_state')).innerCanvasViewports.find(c=>c.assetId==='pan-a');return c&&Math.abs(c.viewportX-v.x)<1&&Math.abs(c.viewportY-v.y)<1;},innerSaved);
  await page.screenshot({path:path.join(root,'native-inner.png')});const savedPositions=await positions();
  await close();await launch();await go('assets/pan-w?category=pan-c');await surface().waitFor();let restored=await view();assert.ok(Math.abs(restored.x-outerSaved.x)<1&&Math.abs(restored.y-outerSaved.y)<1);
  await go('asset/pan-w/pan-a');await page.locator('.asset-inner-canvas').waitFor();restored=await view();assert.ok(Math.abs(restored.x-innerSaved.x)<1&&Math.abs(restored.y-innerSaved.y)<1);assert.deepEqual(await positions(),savedPositions);checks.push('原生正常退出重启后内外视口和对象布局恢复');
  assert.deepEqual(errors,[]);await writeFile(path.join(root,'result.json'),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}catch(error){if(page)await page.screenshot({path:path.join(root,'failure.png')}).catch(()=>{});console.log(JSON.stringify({checks,errors},null,2));throw error;}finally{if(page&&child?.exitCode===null)await close();}
