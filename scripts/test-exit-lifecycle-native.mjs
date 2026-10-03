import { reportDirectory, browserOptions, qaBaseURL, debugExecutable, connectIsolated, isolatedDirectory } from './qa-support.mjs';
// Real packaged debug WebView, isolated SQLite, actual titlebar close button.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
const python=(process.env.PYTHON_RUNTIME || 'python');

const root=isolatedDirectory(import.meta.url);await mkdir(root,{recursive:true});
const checks=[],instances=[],errors=[];let current,locker;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function run(exe,args){const p=spawn(exe,args,{windowsHide:true});let out='',err='';p.stdout.on('data',x=>out+=x);p.stderr.on('data',x=>err+=x);assert.equal(await new Promise(r=>p.once('exit',r)),0,err);return out;}
const probe=(pid,icons=[])=>run(python,['scripts/native-window-state.py',String(pid),...icons.flatMap(i=>[String(i.hwnd),String(i.id)])]).then(JSON.parse);
const alive=pid=>{try{process.kill(pid,0);return true;}catch{return false;}};
async function launch(){
 const child=spawn(debugExecutable(),[],{windowsHide:true,stdio:'ignore',env:{...process.env,CREATIVE_CLOTH_TEST_DATA_DIR:root,WEBVIEW2_USER_DATA_FOLDER:path.join(root,'webview'),WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9456'}});
 const exit=new Promise(resolve=>child.once('exit',(code,signal)=>resolve({code,signal})));
 let browser;for(let n=0;n<100;n++){try{browser=await connectIsolated('http://127.0.0.1:9456', root);break;}catch{await delay(150);}}
 assert.ok(browser,'Native WebView unavailable');const page=browser.contexts()[0].pages()[0];
 page.on('pageerror',e=>errors.push(e.message));await page.waitForFunction(()=>window.__TAURI_INTERNALS__&&!document.querySelector('.boot-screen'));
 const invoke=(command,args={})=>page.evaluate(({command,args})=>window.__TAURI_INTERNALS__.invoke(command,args),{command,args});
 const data=await invoke('load_app_state');assert.ok(data.databasePath.startsWith(root+path.sep),data.databasePath);
 const native=await probe(child.pid);assert.equal(native.icons.length,1,'Tray must be registered before close');
 const all=JSON.parse(await run('powershell.exe',['-NoProfile','-Command','Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId | ConvertTo-Json -Compress']));
 const descendants=new Set([child.pid]);for(let n=0;n<8;n++)for(const p of all)if(descendants.has(p.ParentProcessId))descendants.add(p.ProcessId);
 const webviews=[...descendants].filter(pid=>pid!==child.pid);
 current={child,browser,page,invoke,exit,icons:native.icons,webviews};instances.push(current);return current;
}
async function setBehavior(value){const data=await current.invoke('load_app_state');await current.invoke('save_settings',{item:{...data.settings,closeBehavior:value}});}
async function clickClose(){await current.page.locator('.window-actions button[aria-label="关闭"]').click({timeout:5000,noWaitAfter:true}).catch(e=>{if(!/closed/.test(e.message))throw e;});}
async function exited(){
 const result=await Promise.race([current.exit,delay(10000).then(()=>({timeout:true}))]);assert.ok(!result.timeout,'Process remained after actual close');assert.equal(result.code,0);
 const native=await probe(current.child.pid,current.icons);assert.equal(native.windows.length,0);assert.ok(native.knownIcons.every(i=>!i.registered),'Shell tray icon must be removed');
 for(let n=0;n<30&&current.webviews.some(alive);n++)await delay(100);
 assert.ok(current.webviews.every(pid=>!alive(pid)),'Owned WebView processes remained');
 await current.browser.close().catch(()=>{});return result;
}
async function outer(){
 const data=await current.invoke('load_app_state'),now=Date.now();
 if(!data.workspaces.some(x=>x.id==='exit-workspace'))await current.invoke('save_workspace',{item:{id:'exit-workspace',name:'退出隔离验收',description:'',coverPath:'',notes:'',createdAt:now,updatedAt:now}});
 if(!data.categories.some(x=>x.id==='exit-category'))await current.invoke('save_category',{item:{id:'exit-category',workspaceId:'exit-workspace',name:'关闭保存',description:'',icon:'',createdAt:now,updatedAt:now,viewportX:0,viewportY:0,zoom:1,canvasColor:'',canvasPattern:''}});
 await current.page.reload();await current.page.waitForFunction(()=>!document.querySelector('.boot-screen'));
 await current.page.evaluate(()=>location.hash='assets/exit-workspace?category=exit-category');await current.page.waitForSelector('.outer-text-surface');
}
try {
 for(let n=0;n<5;n++){await launch();await setBehavior('exit');await clickClose();await exited();}
 checks.push('五次真实点击 ×：主进程与所属 WebView 退出，Windows Shell 托盘图标注销');
 await launch();await setBehavior('exit');await outer();
 await current.page.getByRole('button',{name:'添加文字',exact:true}).click();await current.page.getByLabel('编辑文字块内容').fill('退出前未提交草稿');
 await current.page.evaluate(()=>{window.exitFlushCount=0;window.addEventListener('asset-text-before-leave',e=>{window.exitFlushCount++;e.detail.promises.push(new Promise(r=>setTimeout(r,1200)));});});
 await clickClose();await clickClose();assert.equal(await current.page.evaluate(()=>window.exitFlushCount),1);await exited();
 await launch();let data=await current.invoke('load_app_state');assert.ok(data.categoryTextBlocks.some(t=>t.content==='退出前未提交草稿'));
 checks.push('编辑中重复点击 × 只执行一次保存流程；退出重启后草稿完整');
 await setBehavior('exit');await outer();await current.page.getByRole('button',{name:'添加文字',exact:true}).click();await current.page.getByLabel('编辑文字块内容').fill('保存失败后重试的草稿');
 data=await current.invoke('load_app_state');
 locker=spawn(python,['-u','-c','import sqlite3,sys;c=sqlite3.connect(sys.argv[1]);c.execute("BEGIN IMMEDIATE");print("LOCKED",flush=True);sys.stdin.readline();c.rollback();c.close()',data.databasePath],{windowsHide:true});
 await new Promise((resolve,reject)=>{locker.stdout.once('data',resolve);locker.once('error',reject);});
 await clickClose();await current.page.getByRole('alert').filter({hasText:'内容尚未保存'}).waitFor({timeout:20000});
 assert.equal(current.child.exitCode,null);assert.equal(await current.invoke('plugin:window|is_visible',{label:'main'}),true);
 const unlocked=new Promise(r=>locker.once('exit',r));locker.stdin.end('\n');await unlocked;locker=null;
 await clickClose();await exited();await launch();data=await current.invoke('load_app_state');assert.ok(data.categoryTextBlocks.some(t=>t.content==='保存失败后重试的草稿'));
 checks.push('SQLite 写锁导致保存失败时，窗口保持可见并提示；解除锁后再次关闭，草稿保存且退出');
 await setBehavior('tray');await clickClose();
 await current.page.waitForFunction(async()=>!await window.__TAURI_INTERNALS__.invoke('plugin:window|is_visible',{label:'main'}),null,{timeout:10000});
 assert.equal(current.child.exitCode,null);assert.equal(await current.invoke('plugin:window|is_visible',{label:'main'}),false);
 assert.equal((await probe(current.child.pid)).icons.length,1);
 await current.invoke('show_main_window');assert.equal(await current.invoke('plugin:window|is_visible',{label:'main'}),true);
 checks.push('托盘模式关闭时保留窗口与图标，共用恢复函数可重新显示窗口');
 await setBehavior('exit');await clickClose();await exited();
 await launch();await current.invoke('plugin:window|destroy',{label:'main'}).catch(e=>{if(!/closed/.test(e.message))throw e;});await exited();
 checks.push('主窗口直接销毁后，进程与 Shell 托盘图标一并退出');
 assert.deepEqual(errors,[]);
 await writeFile(path.join(root,'result.json'),JSON.stringify({checks,errors,pids:instances.map(i=>i.child.pid),trayClickScope:'托盘隐藏/保留/注销已从 Windows Shell 验证；物理图标左右键另行验收'},null,2));
 console.log(JSON.stringify({checks,errors},null,2));
}finally{
 if(locker){locker.stdin.end('\n');}
 for(const instance of instances){if(instance.child.exitCode===null)instance.child.kill();await instance.browser.close().catch(()=>{});}
}
