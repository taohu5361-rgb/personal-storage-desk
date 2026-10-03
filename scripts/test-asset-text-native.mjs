import { reportDirectory, browserOptions, qaBaseURL, debugExecutable, connectIsolated, isolatedDirectory } from './qa-support.mjs';
// Run against an explicitly isolated debug build, never the normal user database.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import { chromium } from 'playwright';
const root=isolatedDirectory(import.meta.url);
if(process.argv.includes('--launch')) {
  await mkdir(root,{recursive:true});
  const child=spawn(debugExecutable(),[],{windowsHide:true,detached:true,stdio:'ignore',env:{...process.env,CREATIVE_CLOTH_TEST_DATA_DIR:root,WEBVIEW2_USER_DATA_FOLDER:join(root,'webview'),WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9447'}});child.unref();
}
let browser;
for(let i=0;i<30;i++){try{browser=await connectIsolated('http://127.0.0.1:9447', root);break;}catch{await new Promise(r=>setTimeout(r,300));}}
if(!browser)throw Error('isolated native WebView unavailable');
const page=browser.contexts()[0].pages()[0];await page.waitForURL('**1420**');
const errors=[];page.on('pageerror',e=>errors.push(e.message));
let locker;
const invoke=(command,args={})=>page.evaluate(({command,args})=>window.__TAURI_INTERNALS__.invoke(command,args),{command,args});
const state=()=>invoke('load_app_state');
const report=root+'/native-result.json';
const waitSaved=async predicate=>{for(let n=0;n<40;n++){const d=await state();if(predicate(d))return d;await page.waitForTimeout(100);}throw Error('native write was not observed');};
try {
  await page.waitForFunction(()=>!document.querySelector('.boot-screen'));
  const path=(await state()).databasePath;assert.ok(path.startsWith(root+'\\'));
  if(process.argv.includes('--restart')) {
    const expected=JSON.parse(await readFile(report,'utf8'));
    const d=await state();const withoutTimestamp=entries=>entries.map(({updatedAt,...e})=>e);assert.deepEqual(withoutTimestamp(d.assetTextElements),withoutTimestamp(expected.elements));assert.deepEqual(d.assetTextLayouts,expected.layouts);if(expected.innerObjects)assert.deepEqual(d.innerCanvasObjects,expected.innerObjects);
    await page.evaluate(()=>{location.hash='asset/text-workspace/text-asset';});await page.waitForSelector('.asset-inner-detail');
    await page.getByRole('button',{name:'标准详情',exact:true}).click();await page.waitForSelector('.standard-text-surface');
    await page.getByLabel('定位文字').selectOption(expected.id);assert.match(await page.locator(`[data-object-id="${expected.id}"]`).innerText(),/关闭前最新草稿/);
    await page.screenshot({path:root+'/native-restarted.png'});
    console.log('PASS native process restart: shared content, styles, independent layouts and pending close draft restored');
  } else {
    const now=Date.now();
    if((await state()).assets.some(a=>a.id==='text-asset'))await invoke('delete_asset',{id:'text-asset',deleteManaged:false});
    await invoke('save_workspace',{item:{id:'text-workspace',name:'文字隔离验收',description:'',coverPath:'',notes:'',createdAt:now,updatedAt:now}});
    await invoke('save_category',{item:{id:'text-category',workspaceId:'text-workspace',name:'测试分类',description:'',icon:'',createdAt:now,updatedAt:now,viewportX:80,viewportY:70,zoom:1,canvasColor:'#191d21',canvasPattern:'dots'}});
    const sourcePath=path.replace(/script-collection\.sqlite3$/,'isolated-source.bin');await writeFile(sourcePath,'isolated text verification');
    await invoke('save_asset',{item:{id:'text-asset',categoryId:'text-category',workspaceId:'text-workspace',name:'资产级文字验收',description:'真实 SQLite / 隔离数据',storageMode:'reference',selectedFilePath:sourcePath,sourceFilePath:sourcePath,originalFilePath:'',coverStorageMode:'reference',selectedCoverPath:'',coverSourcePath:'',coverOriginalPath:'',useSourceAsCover:false,filePath:'',tags:[],notes:'',createdAt:now,x:90,y:90,width:280,height:210,zIndex:1,locked:false}});
    const imagePath=path.replace(/script-collection\.sqlite3$/,'isolated-sample.png');
    const imageWriter=spawn((process.env.PYTHON_RUNTIME || 'python'),['-c','from PIL import Image; import sys; Image.new("RGB",(32,24),"white").save(sys.argv[1])',imagePath],{windowsHide:true});
    assert.equal(await new Promise(resolve=>imageWriter.once('exit',resolve)),0);
    await invoke('save_prompt',{item:{id:'text-prompt',assetId:'text-asset',promptType:'natural',positivePrompt:'',negativePrompt:'',naturalPrompt:'混合分组验证',content:'混合分组验证',selectedImagePath:imagePath,sampleStorageMode:'reference',sampleSourcePath:imagePath,sampleOriginalPath:'',sampleImagePath:imagePath,sampleFileName:'isolated-sample.png',metadataJson:'',title:'隔离样图',notes:'关联备注',createdAt:now,updatedAt:now}});
    await invoke('save_asset_detail_view_mode',{assetId:'text-asset',mode:'standard'});
    await page.reload();await page.waitForFunction(()=>!document.querySelector('.boot-screen'));await page.evaluate(()=>{location.hash='asset/text-workspace/text-asset';});await page.waitForSelector('.standard-text-surface');
    await page.getByRole('button',{name:'添加文字',exact:true}).click();await page.getByLabel('编辑文字块内容').fill('原生标准详情文字\n中英文 Native');await page.getByLabel('编辑文字块内容').press('Control+Enter');
    let d=await waitSaved(d=>d.assetTextElements.length===1&&d.assetTextElements[0].content.includes('Native'));const id=d.assetTextElements[0].id;
    await page.getByLabel('样式类型').selectOption('panel');
    const fontSize=page.locator('.text-style-toolbar label').filter({hasText:'字号'}).locator('input');await fontSize.fill('28');await fontSize.press('Tab');
    d=await waitSaved(d=>d.assetTextElements[0].styleType==='panel'&&d.assetTextElements[0].fontSize===28);const standard=d.assetTextLayouts.find(l=>l.viewMode==='standard');
    await page.getByRole('button',{name:'内画布',exact:true}).click();await page.waitForSelector('.asset-inner-canvas');
    d=await waitSaved(d=>d.assetTextLayouts.length===2);assert.match(await page.locator(`[data-object-id="${id}"]`).innerText(),/Native/);assert.deepEqual(d.assetTextLayouts.find(l=>l.viewMode==='standard'),standard);
    const prompt=d.innerCanvasObjects.find(o=>o.objectType==='prompt');
    await page.getByRole('button',{name:'适应全部',exact:true}).click();
    const zoom=await page.locator('.inner-canvas-world').evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).a);
    const promptBlock=page.locator(`[data-object-id="${prompt.objectId}"]`),pr=await promptBlock.boundingBox();
    await page.mouse.move(pr.x+30*zoom,pr.y+40*zoom);await page.mouse.down();await page.mouse.move(pr.x+50*zoom,pr.y+50*zoom,{steps:4});await page.mouse.up();
    d=await waitSaved(d=>Math.abs(d.innerCanvasObjects.find(o=>o.objectId===prompt.objectId).x-prompt.x-20)<.2);
    await page.locator(`[data-object-id="${id}"]`).click({position:{x:20,y:20}});await promptBlock.click({position:{x:20,y:40},modifiers:['Control']});await promptBlock.click({button:'right'});
    await page.getByRole('button',{name:'将所选对象创建为分组',exact:true}).click();
    d=await waitSaved(d=>!!d.assetTextLayouts.find(l=>l.viewMode==='canvas').groupId);
    assert.equal(d.assetTextLayouts.find(l=>l.viewMode==='canvas').groupId,d.innerCanvasObjects.find(o=>o.objectId===prompt.objectId).groupId);
    assert.deepEqual(d.assetTextLayouts.find(l=>l.viewMode==='standard'),standard);
    await page.locator(`[data-object-id="${id}"]`).dblclick();await page.getByLabel('信息面板标题').fill('共享标题');await page.getByLabel('编辑文字块内容').fill('内画布更新，标准详情共享');await page.getByLabel('编辑文字块内容').press('Control+Enter');
    await waitSaved(d=>d.assetTextElements[0].content==='内画布更新，标准详情共享');
    await page.getByRole('button',{name:'标准详情',exact:true}).click();await page.waitForSelector('.standard-text-surface');assert.match(await page.locator(`[data-object-id="${id}"]`).innerText(),/共享标题/);
    await page.locator(`[data-object-id="${id}"]`).dblclick();await page.getByLabel('编辑文字块内容').fill('离开详情前保存的草稿');
    await page.getByRole('button',{name:'返回',exact:true}).click();await page.waitForSelector('.asset-layout');await waitSaved(d=>d.assetTextElements[0].content==='离开详情前保存的草稿');
    await page.evaluate(()=>{location.hash='asset/text-workspace/text-asset';});await page.waitForSelector('.standard-text-surface');
    await page.locator(`[data-object-id="${id}"]`).dblclick();await page.getByLabel('编辑文字块内容').fill('IPC 失败保留的草稿');
    // Hold an actual SQLite writer lock in the isolated database. Tauri's five
    // second busy timeout must report a save failure and retain the editor draft.
    locker=spawn((process.env.PYTHON_RUNTIME || 'python'),['-u','-c','import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); c.execute("BEGIN IMMEDIATE"); print("LOCKED",flush=True); sys.stdin.readline(); c.rollback(); c.close()',path],{windowsHide:true});
    await new Promise((resolve,reject)=>{locker.stdout.once('data',resolve);locker.once('error',reject);});
    await page.getByRole('button',{name:'内画布',exact:true}).click();await page.waitForSelector('.asset-text-save-error');assert.equal(await page.locator('.standard-text-surface').count(),1);
    assert.match(await page.locator('.standard-text-surface').innerText(),/IPC 失败保留的草稿/);
    locker.stdin.end('\n');await new Promise(resolve=>locker.once('exit',resolve));locker=null;
    assert.equal((await state()).assetTextElements[0].content,'离开详情前保存的草稿');
    await page.getByRole('button',{name:'重试保存',exact:true}).click();await waitSaved(d=>d.assetTextElements[0].content==='IPC 失败保留的草稿');
    await page.getByRole('button',{name:'内画布',exact:true}).click();await page.waitForSelector('.asset-inner-canvas');
    await page.locator(`[data-object-id="${id}"]`).dblclick();await page.getByLabel('编辑文字块内容').fill('关闭前最新草稿');
    // Native close request while the textarea still owns focus: no blur saves it.
    const current=await state();const expected={id,elements:current.assetTextElements.map(e=>({...e,content:'关闭前最新草稿'})),layouts:current.assetTextLayouts,innerObjects:current.innerCanvasObjects};
    const settings=current.settings;await invoke('save_settings',{item:{...settings,closeBehavior:'exit'}});
    await invoke('plugin:window|close',{label:'main'}).catch(error=>{if(!/closed/i.test(error.message))throw error;});
    if(!page.isClosed())await page.waitForEvent('close',{timeout:10000});
    // Timestamps are read from the final database by the caller before restarting.
    await writeFile(report,JSON.stringify(expected,null,2));console.log('PASS native CRUD, shared styles, view isolation, navigation draft, IPC failure/retry and close flush');
  }
  assert.deepEqual(errors,[]);
} finally {locker?.stdin.end('\n');await browser.close();}
