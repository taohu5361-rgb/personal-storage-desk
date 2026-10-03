import { reportDirectory, browserOptions, qaBaseURL } from './qa-support.mjs';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {imageCenter,axisSnapPreview} from '../src/components/canvasAxisGeometry.js';
import { chromium } from 'playwright';
const output=reportDirectory(import.meta.url);await mkdir(output,{recursive:true});
const browser=await chromium.launch({...browserOptions,headless:true}),page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.addInitScript(()=>{if(!sessionStorage.getItem('grid-migration-seeded')){localStorage.setItem('canvas-transform-grid','true');localStorage.removeItem('canvas-transform-grid-continuous-v1');sessionStorage.setItem('grid-migration-seeded','1');}});
const state=()=>page.evaluate(()=>window.axisQA.state());
const settle=()=>page.waitForTimeout(55);
const el=id=>page.locator(`[data-asset-id="${id}"],[data-object-id="${id}"]`).first();
const close=(a,b)=>assert.ok(Math.abs(a-b)<.001,`${a} != ${b}`);
const scene=async id=>{const d=await state();return d.mode==='outer'?{...d.assets.find(a=>a.id===id),kind:'asset',imageHeight:d.assets.find(a=>a.id===id).height,height:d.assets.find(a=>a.id===id).height+(d.assets.find(a=>a.id===id).tags.length?44:32)}:d.objects.find(a=>a.objectId===id);};
const geometry=async id=>el(id).evaluate(e=>({x:parseFloat(e.style.left),y:parseFloat(e.style.top)}));
async function pointer(type,x,y,extra={}){await page.evaluate(({type,x,y,extra})=>window.dispatchEvent(new PointerEvent(type,{clientX:x,clientY:y,pointerId:61,bubbles:true,cancelable:true,...extra})),{type,x,y,extra});}
async function begin(id){const b=await el(id).boundingBox(),start={x:b.x+b.width/2,y:b.y+b.height/2};await el(id).evaluate((e,p)=>e.dispatchEvent(new PointerEvent('pointerdown',{clientX:p.x,clientY:p.y,button:0,pointerId:61,bubbles:true})),start);await settle();return start;}
async function pick(id){const start=await begin(id);await pointer('pointerup',start.x,start.y);await settle();}
async function activate(){await pick('r');await page.getByRole('button',{name:'排列 · 1',exact:true}).click();await settle();assert.equal(await page.locator('.canvas-axis-guides').count(),1);assert.equal(await page.locator('.canvas-arrange-panel').count(),0);}
async function reset(mode){await page.evaluate(mode=>{window.axisQA.ui('1');window.axisQA.mode(mode);window.axisQA.reset();},mode);await settle();}
try{
 await page.goto(`${qaBaseURL}/scripts/verify-axis-drag.html`);await page.waitForFunction(()=>window.axisQA);await settle();
 assert.equal(await page.getByLabel('网格吸附',{exact:true}).isChecked(),false);await page.getByLabel('网格吸附',{exact:true}).check();await page.reload();await page.waitForFunction(()=>window.axisQA);assert.equal(await page.getByLabel('网格吸附',{exact:true}).isChecked(),true);await page.getByLabel('网格吸附',{exact:true}).uncheck();checks.push('旧网格偏好只重置一次，后续主动选择保留');
 for(const mode of ['outer','inner']){
  await reset(mode);
  await el('r').click({button:'right',position:{x:280,y:210}});assert.ok(await el('r').evaluate(e=>e.classList.contains('selected')));await page.keyboard.press('Escape');checks.push(mode+' 右键图片先选中');
  await activate();const r=await scene('r'),origin=imageCenter(r),line=page.locator('.canvas-axis-guides [data-axis="y"]');close(Number(await line.getAttribute('y1')),origin.y);await pick('t');assert.equal(await page.locator('.canvas-axis-guides').count(),1);checks.push(mode+' 排列直接显示图片中心十字，切换选择仍保留');
  const a=await scene('t');
  for(const axis of ['x','y'])for(const anchor of ['start','center','end']){
   const size=axis==='x'?a.width:(a.imageHeight??a.height),offset={start:0,center:size/2,end:size}[anchor],delta={x:55,y:73};delta[axis]=origin[axis]-a[axis]-offset-7;
   const start=await begin('t');await pointer('pointermove',start.x+delta.x,start.y+delta.y);await settle();const raw=await geometry('t');close(raw.x,a.x+delta.x);close(raw.y,a.y+delta.y);assert.equal(await page.locator('.axis-drop-preview').count(),1);
   const expected=axisSnapPreview(a,r,delta).preview;await pointer('pointerup',start.x+delta.x,start.y+delta.y);await settle();const landed=await geometry('t');close(landed.x,expected.x);close(landed.y,expected.y);
   await page.getByLabel('撤销画布操作').click();await settle();close((await geometry('t')).x,a.x);close((await geometry('t')).y,a.y);
   checks.push(mode+' '+axis+' '+anchor+' 拖动自由、预览、松手吸附及一次撤销');
  }
  // Last release position must override a queued earlier event without waiting for another frame.
  let start=await begin('t'),dx=origin.x-a.x-a.width/2-7,dy=73;await pointer('pointermove',start.x+dx,start.y+dy);await settle();assert.equal(await page.locator('.axis-drop-preview').count(),1);await pointer('pointerup',start.x+dx-80,start.y+dy);await settle();assert.equal(await page.locator('.axis-drop-preview').count(),0);close((await geometry('t')).x,a.x+dx-80);await page.getByLabel('撤销画布操作').click();await settle();checks.push(mode+' 松手最终位置重新检查，拉远取消提示');
  start=await begin('t');await pointer('pointermove',start.x+dx,start.y+dy,{altKey:true});await settle();assert.equal(await page.locator('.axis-drop-preview').count(),0);await pointer('pointerup',start.x+dx,start.y+dy,{altKey:true});await settle();close((await geometry('t')).x,a.x+dx);await page.getByLabel('撤销画布操作').click();await settle();checks.push(mode+' Alt 禁用预览及吸附');
  for(const cancel of ['escape','pointercancel','blur']){start=await begin('t');await pointer('pointermove',start.x+dx,start.y+dy);await settle();if(cancel==='escape')await page.keyboard.press('Escape');else if(cancel==='blur')await page.evaluate(()=>window.dispatchEvent(new Event('blur')));else await pointer('pointercancel',start.x+dx,start.y+dy);await settle();close((await geometry('t')).x,a.x);close((await geometry('t')).y,a.y);assert.equal(await page.locator('.axis-drop-preview').count(),0);assert.equal(await page.locator('.canvas-axis-guides').count(),1);checks.push(mode+' '+cancel+' 恢复几何并保留轴');}
  await pick('r');await page.getByRole('button',{name:'排列 · 1',exact:true}).click();assert.equal(await page.locator('.canvas-axis-guides').count(),0);await activate();await page.getByLabel('清除中轴线').click();assert.equal(await page.locator('.canvas-axis-guides').count(),0);await activate();await page.keyboard.press('Escape');assert.equal(await page.locator('.canvas-axis-guides').count(),0);checks.push(mode+' 重复点击、清除按钮、空闲 Esc 关闭轴');
  // Normal magnetic hold/release vs fully free fractional coordinates.
  await page.evaluate(()=>window.axisQA.patch('t',{x:900,y:220}));await settle();await page.getByRole('button',{name:'吸附',exact:true}).click();start=await begin('t');await pointer('pointermove',start.x+14.125,start.y+9.375);await settle();close((await geometry('t')).x,914.125);close((await geometry('t')).y,229.375);await pointer('pointerup',start.x+14.875,start.y+9.625);await settle();close((await geometry('t')).x,914.875);await page.getByRole('button',{name:'吸附',exact:true}).click();checks.push(mode+' 关闭吸附时小数位移连续、松手处理最后坐标');
  await reset(mode);await activate();await page.evaluate(()=>window.axisQA.patch('r',{locked:true}));await settle();await pick('r');assert.equal(await page.getByLabel('旋转角度',{exact:true}).isDisabled(),true);checks.push(mode+' 锁定图片仍可显示中轴线');
  await reset(mode);start=await begin('t');await pointer('pointermove',start.x-155,start.y+35);await settle();close((await geometry('t')).x,740);await pointer('pointermove',start.x-151,start.y+35);await settle();close((await geometry('t')).x,740);await pointer('pointermove',start.x-147,start.y+35);await settle();close((await geometry('t')).x,753);await pointer('pointercancel',start.x-147,start.y+35);await settle();checks.push(mode+' 普通磁吸 6px 进入、10px 保持、向外拉脱离');
  for(const [ui,zoom]of [[.75,.51],[1,1],[1.5,1.5]]){
   await reset(mode);await page.evaluate(({ui,zoom})=>{window.axisQA.ui(String(ui));window.axisQA.view({...window.axisQA.state().view,zoom});window.axisQA.patch('r',{rotation:30});}, {ui,zoom});await settle();await activate();const ref=await scene('r'),moving=await scene('t'),center=imageCenter(ref),scale=ui*zoom,deltaX=center.x-moving.x-moving.width/2-9/scale,deltaY=73;
   start=await begin('t');await pointer('pointermove',start.x+deltaX*scale,start.y+deltaY*scale);await settle();assert.equal(await page.locator('.axis-drop-preview').count(),1);close((await geometry('t')).x,moving.x+deltaX);await pointer('pointerup',start.x+deltaX*scale,start.y+deltaY*scale);await settle();close((await geometry('t')).x,center.x-moving.width/2);checks.push(mode+` 旋转中心图片 UI ${ui} × 画布 ${zoom} 阈值及落点`);
  }
  await reset(mode);await activate();const initialCenter=imageCenter(await scene('r'));start=await begin('r');await pointer('pointermove',start.x+30,start.y+20);await settle();assert.equal(await page.locator('.axis-drop-preview').count(),0);close(Number(await page.locator('.canvas-axis-guides [data-axis="x"]').getAttribute('x1')),initialCenter.x+30);await pointer('pointercancel',start.x+30,start.y+20);await settle();checks.push(mode+' 移动中心图片轴跟随、不能吸附到自己');
  await page.screenshot({path:output+'/'+mode+'-axis.png'});
 }
 await reset('outer');await activate();await page.getByRole('button',{name:'内画布',exact:true}).click();await settle();assert.equal(await page.locator('.canvas-axis-guides').count(),0);checks.push('切换画布清除临时轴');
 // Real pointer path with the large/small image scene. Record commit cost and burst coalescing.
 await reset('outer');await page.getByRole('button',{name:'吸附',exact:true}).click();await pick('t');await page.evaluate(()=>window.axisQA.resetTimings());const b=await el('t').boundingBox();await page.mouse.move(b.x+100,b.y+120);await page.mouse.down();const beginTime=Date.now();await page.mouse.move(b.x+260,b.y+210,{steps:80});await page.mouse.up();await settle();const costs=await page.evaluate(()=>window.axisQA.timings());await writeFile(output+'/performance.json',JSON.stringify({pointerSteps:80,wallTimeMs:Date.now()-beginTime,commits:costs.length,maxReactCommitMs:Math.max(...costs.map(c=>c.actual)),costs},null,2));checks.push('真实鼠标路径记录拖动帧耗时');
 // 100 synthetic events in one task produce one geometry preview, with the newest coordinate retained.
 await page.evaluate(()=>window.axisQA.resetTimings());let start=await begin('t'),before=await geometry('t');await page.evaluate(({start})=>{for(let n=1;n<=100;n++)window.dispatchEvent(new PointerEvent('pointermove',{clientX:start.x+n*.137,clientY:start.y+n*.081,pointerId:61,bubbles:true,cancelable:true}));},{start});await settle();close((await geometry('t')).x,before.x+13.7);close((await geometry('t')).y,before.y+8.1);const burstCosts=await page.evaluate(()=>window.axisQA.timings());assert.ok(burstCosts.length<10,`${burstCosts.length} commits for one event burst`);await pointer('pointercancel',start.x+13.7,start.y+8.1);checks.push('100 个同帧指针事件合并，最新小数坐标保留');
 assert.deepEqual(errors,[]);await writeFile(output+'/result.json',JSON.stringify({checks,errors},null,2));console.log(`PASS ${checks.length} continuous drag and axis browser checks; console clean`);
}catch(e){await page.screenshot({path:output+'/failure.png'});throw e;}finally{await browser.close();}
