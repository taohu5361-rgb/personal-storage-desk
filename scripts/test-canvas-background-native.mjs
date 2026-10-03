import { reportDirectory, browserOptions, qaBaseURL, debugExecutable, connectIsolated, isolatedDirectory } from './qa-support.mjs';
// Debug packaged app, isolated SQLite and isolated WebView profile only.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
const root=isolatedDirectory(import.meta.url);await mkdir(root,{recursive:true});
const executable=debugExecutable();
const checks=[];const errors=[];let child,browser,page;
async function launch(){
  child=spawn(executable,[],{windowsHide:true,stdio:'ignore',env:{...process.env,CREATIVE_CLOTH_TEST_DATA_DIR:root,WEBVIEW2_USER_DATA_FOLDER:path.join(root,'webview'),WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9453'}});
  for(let n=0;n<100;n++){try{browser=await connectIsolated('http://127.0.0.1:9453', root);break;}catch{await new Promise(r=>setTimeout(r,150));}}
  assert.ok(browser,'Native debug WebView unavailable');page=browser.contexts()[0].pages()[0];
  page.on('pageerror',e=>errors.push(e.message));await page.waitForFunction(()=>window.__TAURI_INTERNALS__ && !document.querySelector('.boot-screen'));
  const d=await state();assert.ok(path.resolve(d.databasePath).startsWith(root+path.sep),d.databasePath);
}
const invoke=(command,args={})=>page.evaluate(({command,args})=>window.__TAURI_INTERNALS__.invoke(command,args),{command,args});
const state=()=>invoke('load_app_state');
const go=async hash=>{await page.evaluate(hash=>location.hash=hash,hash);};
const color=selector=>page.locator(selector).evaluate(node=>getComputedStyle(node).backgroundColor);
async function close(){
  const exit=new Promise(resolve=>child.once('exit',resolve));await invoke('finish_window_close').catch(()=>{});
  await exit;browser=null;await new Promise(r=>setTimeout(r,400));
}
try{
  await launch();const d=await state();await invoke('save_settings',{item:{...d.settings,theme:'dark',closeBehavior:'exit',canvasBackgroundColor:'#ffffff',canvasBackground:'solid'}});
  const now=Date.now();
  await invoke('save_workspace',{item:{id:'background-workspace',name:'背景隔离验收',description:'',coverPath:'',notes:'',createdAt:now,updatedAt:now}});
  await invoke('save_category',{item:{id:'background-category',workspaceId:'background-workspace',name:'背景分类',description:'',icon:'',createdAt:now,updatedAt:now,viewportX:0,viewportY:0,zoom:1,canvasColor:'',canvasPattern:''}});
  const file=path.join(root,'isolated-source.bin');await writeFile(file,'canvas background isolated fixture');
  await invoke('save_asset',{item:{id:'background-asset',categoryId:'background-category',workspaceId:'background-workspace',name:'背景继承验收',description:'',storageMode:'reference',selectedFilePath:file,sourceFilePath:file,originalFilePath:'',coverStorageMode:'reference',selectedCoverPath:'',coverSourcePath:'',coverOriginalPath:'',useSourceAsCover:false,filePath:'',tags:[],notes:'',createdAt:now,x:160,y:120,width:280,height:210,zIndex:1,locked:false}});
  await invoke('save_asset_detail_view_mode',{assetId:'background-asset',mode:'canvas'});
  await page.reload();await go('assets/background-workspace?category=background-category');await page.waitForSelector('.asset-canvas');
  assert.equal(await color('.asset-canvas'),'rgb(255, 255, 255)');checks.push('原生深色应用主题下，分类继承默认白底与无网格');
  await page.getByRole('button',{name:'画布背景',exact:true}).click();
  await page.getByRole('button',{name:'黑色',exact:true}).click();
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.asset-canvas')).backgroundColor==='rgb(24, 27, 32)');
  await page.getByRole('button',{name:'轻网格',exact:true}).click();
  for(let n=0;n<40;n++){const c=(await state()).categories.find(c=>c.id==='background-category');if(c.canvasPattern==='grid' && c.canvasColor==='#000000')break;await page.waitForTimeout(100);}
  const c=(await state()).categories.find(c=>c.id==='background-category');assert.equal(c.canvasColor,'#000000');assert.equal(c.canvasPattern,'grid');
  await page.screenshot({path:path.join(root,'native-black-grid.png')});checks.push('真实按钮操作写入 SQLite 分类底色与网格');
  await go('asset/background-workspace/background-asset');await page.waitForSelector('.asset-inner-canvas');
  assert.equal(await color('.asset-inner-canvas'),'rgb(24, 27, 32)');assert.match(await page.locator('.asset-inner-canvas').evaluate(n=>getComputedStyle(n).backgroundImage),/linear-gradient/);
  checks.push('原生资产内画布继承所属分类的黑底与轻网格');
  await go('settings');await page.getByRole('button',{name:'外观',exact:true}).click();
  await page.getByRole('button',{name:'黑色',exact:true}).click();
  await page.getByRole('button',{name:'柔和点阵',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.settings-status')?.textContent.includes('已自动保存'));
  for(let n=0;n<40;n++){if((await state()).settings.canvasBackground==='dots')break;await page.waitForTimeout(100);}
  const defaults=(await state()).settings;assert.equal(defaults.canvasBackgroundColor,'#000000');assert.equal(defaults.canvasBackground,'dots');
  checks.push('原生设置页简化控件写入全局默认值');
  await close();await launch();
  const saved=(await state()).categories.find(c=>c.id==='background-category');assert.equal(saved.canvasColor,'#000000');assert.equal(saved.canvasPattern,'grid');
  await go('assets/background-workspace?category=background-category');await page.waitForSelector('.asset-canvas');assert.equal(await color('.asset-canvas'),'rgb(24, 27, 32)');
  await go('asset/background-workspace/background-asset');await page.waitForSelector('.asset-inner-canvas');assert.equal(await color('.asset-inner-canvas'),'rgb(24, 27, 32)');
  checks.push('正常退出并重新启动，SQLite 设置与内外画布渲染恢复');
  assert.deepEqual(errors,[]);await writeFile(path.join(root,'result.json'),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{if(child && child.exitCode===null && page)await close();}
