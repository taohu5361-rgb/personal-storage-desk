import { reportDirectory, browserOptions, qaBaseURL, debugExecutable, connectIsolated, isolatedDirectory } from './qa-support.mjs';
// Native acceptance against a dedicated debug database and WebView profile.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {join} from 'node:path';import {tmpdir} from 'node:os';
import { chromium } from 'playwright';
const root=isolatedDirectory(import.meta.url),report=root+'/native-result.json';
if(process.argv.includes('--launch')){
  await mkdir(root,{recursive:true});const child=spawn(debugExecutable(),[],{windowsHide:true,detached:true,stdio:'ignore',env:{...process.env,CREATIVE_CLOTH_TEST_DATA_DIR:root,WEBVIEW2_USER_DATA_FOLDER:join(root,'webview'),WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9451'}});child.unref();
}
let browser;for(let i=0;i<40;i++){try{browser=await connectIsolated('http://127.0.0.1:9451', root);break;}catch{await new Promise(r=>setTimeout(r,300));}}
if(!browser)throw Error('isolated native WebView unavailable');
const page=browser.contexts()[0].pages()[0],errors=[];page.on('pageerror',e=>errors.push(e.message));
const invoke=(command,args={})=>page.evaluate(({command,args})=>window.__TAURI_INTERNALS__.invoke(command,args),{command,args});
const state=()=>invoke('load_app_state');
const observe=async predicate=>{for(let i=0;i<80;i++){const d=await state();if(predicate(d))return d;await page.waitForTimeout(100);}throw Error('native save not observed');};
const block=id=>page.locator(`[data-object-id="${id}"]`);
let locker;
try {
  await page.waitForURL('**1420**');await page.waitForFunction(()=>!document.querySelector('.boot-screen'));
  const d0=await state();assert.ok(d0.databasePath.startsWith(root+'\\'));
  if(process.argv.includes('--restart')){
    const expected=JSON.parse(await readFile(report,'utf8')),d=await state();
    const stripped=items=>items.map(({updatedAt,...i})=>i);assert.deepEqual(stripped(d.categoryTextBlocks),stripped(expected.categoryTextBlocks));assert.deepEqual(stripped(d.assetTextElements),stripped(expected.assetTextElements));
    await page.evaluate(()=>{location.hash='assets/outer-workspace?category=outer-category';});await page.waitForSelector('.outer-text-surface');
    assert.match(await block(expected.id).innerText(),/关闭前外画布最新草稿/);await page.screenshot({path:root+'/native-restarted.png'});
    console.log('PASS native restart: category text, styles, positions and final close draft restored');
    await invoke('plugin:window|close',{label:'main'}).catch(()=>{});if(!page.isClosed())await page.waitForEvent('close',{timeout:10000});
  }else{
    await page.evaluate(()=>{location.hash='models';});await page.waitForTimeout(150);
    if(d0.assets.some(a=>a.id==='outer-asset'))await invoke('delete_asset',{id:'outer-asset',deleteManaged:false});
    if(d0.categories.some(c=>c.id==='outer-category'))await invoke('delete_category',{id:'outer-category'});
    if(d0.categories.some(c=>c.id==='outer-second'))await invoke('delete_category',{id:'outer-second'});
    const now=Date.now();await invoke('save_workspace',{item:{id:'outer-workspace',name:'外画布隔离验收',description:'',coverPath:'',notes:'',createdAt:now,updatedAt:now}});
    for(const [id,name] of [['outer-category','外画布测试'],['outer-second','第二分类']])await invoke('save_category',{item:{id,workspaceId:'outer-workspace',name,description:'',icon:'',createdAt:now,updatedAt:now,viewportX:0,viewportY:0,zoom:1,canvasColor:'#191d21',canvasPattern:'dots'}});
    const image=join(root,'isolated-cover.png');const imageWriter=spawn((process.env.PYTHON_RUNTIME || 'python'),['-c','from PIL import Image;import sys;Image.new("RGB",(320,240),"white").save(sys.argv[1])',image],{windowsHide:true});assert.equal(await new Promise(r=>imageWriter.once('exit',r)),0);
    await invoke('save_asset',{item:{id:'outer-asset',categoryId:'outer-category',workspaceId:'outer-workspace',name:'外画布样图',description:'',storageMode:'reference',selectedFilePath:image,sourceFilePath:image,originalFilePath:'',coverStorageMode:'reference',selectedCoverPath:image,coverSourcePath:image,coverOriginalPath:'',useSourceAsCover:true,filePath:'',tags:[],notes:'',createdAt:now,x:60,y:40,width:320,height:240,zIndex:1,locked:false}});
    await invoke('save_asset_detail_view_mode',{assetId:'outer-asset',mode:'standard'});
    await page.reload();await page.waitForFunction(()=>!document.querySelector('.boot-screen'));await page.evaluate(()=>{location.hash='assets/outer-workspace?category=outer-category';});await page.waitForSelector('.outer-text-surface');
    await page.getByRole('button',{name:'添加文字',exact:true}).click();await page.getByLabel('编辑文字块内容').fill('原生外画布文字 Native 中文');await page.getByLabel('编辑文字块内容').press('Control+Enter');
    let d=await observe(d=>d.categoryTextBlocks.length===1&&d.categoryTextBlocks[0].content.includes('Native')),id=d.categoryTextBlocks[0].id;
    await page.getByLabel('样式类型').selectOption('panel');await block(id).dblclick();await page.getByLabel('信息面板标题').fill('分类说明');await page.getByLabel('编辑文字块内容').press('Control+Enter');
    d=await observe(d=>d.categoryTextBlocks[0].title==='分类说明');const original=d.categoryTextBlocks[0],r=await block(id).boundingBox();
    await page.mouse.move(r.x+20,r.y+20);await page.mouse.down();await page.mouse.move(r.x+70,r.y+50,{steps:5});await page.mouse.up();d=await observe(d=>Math.abs(d.categoryTextBlocks[0].x-original.x-50)<.2);
    await page.getByRole('button',{name:'第二分类',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.asset-header h1')?.textContent==='第二分类');assert.equal(await page.locator('[data-object-id]').count(),0);
    await page.getByRole('button',{name:'外画布测试',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.asset-header h1')?.textContent==='外画布测试');assert.equal(await page.locator('[data-object-id]').count(),1);
    // Outer annotations do not silently become text belonging to an asset.
    await page.locator('.canvas-asset').dblclick({position:{x:30,y:30}});await page.waitForSelector('.asset-detail-main');
    await page.getByRole('button',{name:'标准详情',exact:true}).click();await page.waitForSelector('.standard-text-surface');assert.equal(await page.locator('[data-object-id]').count(),0);
    await page.getByRole('button',{name:'添加文字',exact:true}).click();await page.getByLabel('编辑文字块内容').fill('资产文字仍然独立共享');await page.getByLabel('编辑文字块内容').press('Control+Enter');await observe(d=>d.assetTextElements.length===1);
    await page.getByRole('button',{name:'返回',exact:true}).click();await page.waitForSelector('.outer-text-surface');assert.equal(await page.locator('[data-object-id]').count(),1);
    await block(id).dblclick();await page.getByLabel('编辑文字块内容').fill('数据库锁定期间保留');
    locker=spawn((process.env.PYTHON_RUNTIME || 'python'),['-u','-c','import sqlite3,sys;c=sqlite3.connect(sys.argv[1]);c.execute("BEGIN IMMEDIATE");print("LOCKED",flush=True);sys.stdin.readline();c.rollback();c.close()',d.databasePath],{windowsHide:true});await new Promise((r,j)=>{locker.stdout.once('data',r);locker.once('error',j);});
    await page.getByRole('button',{name:'第二分类',exact:true}).click();await page.waitForSelector('.outer-text-save-error');assert.equal(await page.locator('.asset-header h1').innerText(),'外画布测试');assert.match(await block(id).innerText(),/数据库锁定期间保留/);
    locker.stdin.end('\n');await new Promise(r=>locker.once('exit',r));locker=null;
    await page.getByRole('button',{name:'重试保存',exact:true}).click();await observe(d=>d.categoryTextBlocks[0].content==='数据库锁定期间保留');
    await block(id).dblclick();await page.getByLabel('编辑文字块内容').fill('关闭前外画布最新草稿');
    const current=await state(),expected={id,categoryTextBlocks:current.categoryTextBlocks.map(t=>({...t,content:'关闭前外画布最新草稿'})),assetTextElements:current.assetTextElements};
    await invoke('save_settings',{item:{...current.settings,closeBehavior:'exit'}});await writeFile(report,JSON.stringify(expected,null,2));
    await invoke('plugin:window|close',{label:'main'}).catch(()=>{});if(!page.isClosed())await page.waitForEvent('close',{timeout:10000});
    console.log('PASS native outer creation, styles, world drag, category isolation, asset regression, locked SQLite retry and close flush');
  }
  assert.deepEqual(errors,[]);
} finally {locker?.stdin.end('\n');await browser.close();}
