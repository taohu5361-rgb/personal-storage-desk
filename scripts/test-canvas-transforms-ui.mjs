import { reportDirectory, browserOptions, qaBaseURL } from './qa-support.mjs';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import { chromium } from 'playwright';
const output=process.env.CANVAS_TRANSFORM_REPORT_DIR || reportDirectory(import.meta.url);
await mkdir(output,{recursive:true});
const browser=await chromium.launch({...browserOptions,headless:true,}),page=await browser.newPage({viewport:{width:1500,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});let checks=0;
const state=()=>page.evaluate(()=>window.transformQA.state());
const settle=()=>page.waitForTimeout(150);
const asset=id=>page.locator(`[data-asset-id="${id}"]`),text=id=>page.locator(`[data-object-id="${id}"]`);
async function pick(locator,ctrl=false){const r=await locator.boundingBox();await page.mouse.click(r.x+r.width/2,r.y+r.height/2,{modifiers:[]});}
async function blank(selector='.asset-canvas'){await page.locator(selector).click({position:{x:30,y:100}});await settle();assert.equal(await page.getByLabel('旋转角度',{exact:true}).count(),0);}
async function down(locator,{ctrl=false}={}){
 await locator.evaluate((el,ctrl)=>{const b=el.getBoundingClientRect();el.dispatchEvent(new PointerEvent('pointerdown',{clientX:b.x+b.width/2,clientY:b.y+b.height/2,button:0,pointerId:77,bubbles:true,ctrlKey:ctrl}));},ctrl);await settle();
}
async function drag(locator,dx,dy,{alt=true,cancel=false}={}){
 const r=await locator.boundingBox();await locator.evaluate(el=>{const b=el.getBoundingClientRect();el.dispatchEvent(new PointerEvent('pointerdown',{clientX:b.x+b.width/2,clientY:b.y+b.height/2,button:0,pointerId:77,bubbles:true}));});
 await page.evaluate(({x,y,dx,dy,alt})=>window.dispatchEvent(new PointerEvent('pointermove',{clientX:x+dx,clientY:y+dy,pointerId:77,altKey:alt,bubbles:true,cancelable:true})),{x:r.x+r.width/2,y:r.y+r.height/2,dx,dy,alt});await settle();
 await page.evaluate(({x,y,dx,dy,alt,cancel})=>window.dispatchEvent(new PointerEvent(cancel?'pointercancel':'pointerup',{clientX:x+dx,clientY:y+dy,pointerId:77,altKey:alt,bubbles:true})),{x:r.x+r.width/2,y:r.y+r.height/2,dx,dy,alt,cancel});await settle();
}
try{
 await page.goto(`${qaBaseURL}/scripts/verify-canvas-transforms.html`);await page.waitForFunction(()=>window.transformQA);await page.evaluate(()=>{localStorage.clear();window.transformQA.reset();});await page.waitForFunction(()=>window.transformQA);await settle();
 assert.deepEqual(errors,[]);
 await pick(asset('a'));await page.getByLabel('旋转角度',{exact:true}).fill('30');await blank();let d=await state();assert.equal(d.assets[0].rotation,30);assert.equal(d.db.assets[0].rotation,30);checks++;
 await page.getByLabel('撤销画布操作').click();await settle();assert.equal((await state()).assets[0].rotation,0);assert.equal(await page.getByLabel('撤销画布操作').isDisabled(),true);await page.getByLabel('重做画布操作').click();await settle();assert.equal((await state()).assets[0].rotation,30);checks++;
 await pick(asset('a'));await page.getByLabel('旋转角度',{exact:true}).fill('60');await pick(asset('b'));d=await state();assert.equal(d.assets[0].rotation,60);assert.equal(d.assets[1].rotation,0);assert.equal(Number(await page.getByLabel('旋转角度',{exact:true}).inputValue()),0);checks++;
 await pick(asset('a'));await page.getByLabel('旋转角度',{exact:true}).fill('30');await page.getByLabel('旋转角度',{exact:true}).press('Enter');await settle();assert.equal((await state()).assets[0].rotation,30);checks++;
 const writesBefore=(await state()).writes.length;await page.getByLabel('旋转角度',{exact:true}).fill('');await blank();assert.equal((await state()).assets[0].rotation,30);assert.equal((await state()).writes.length,writesBefore);checks++;
 await pick(asset('a'));await page.getByLabel('旋转角度',{exact:true}).fill('');await page.getByLabel('旋转角度',{exact:true}).press('e');assert.equal(await page.getByLabel('旋转角度',{exact:true}).evaluate(el=>el.validity.badInput),true);await blank();assert.equal((await state()).assets[0].rotation,30);assert.equal((await state()).writes.length,writesBefore);checks++;
 await pick(text('t1'));await page.getByLabel('旋转角度',{exact:true}).fill('-25');await blank();d=await state();assert.equal(d.texts[0].rotation,-25);assert.equal(d.db.texts[0].rotation,-25);await page.reload();await page.waitForFunction(()=>window.transformQA);assert.equal((await state()).texts[0].rotation,-25);checks++;
 await pick(text('t1'));await page.getByLabel('旋转归零',{exact:true}).click();await settle();await pick(asset('a'));
 const angle=page.getByLabel('旋转角度',{exact:true});await angle.fill('31');await angle.click();assert.equal(await angle.evaluate(el=>el===document.activeElement),true);assert.equal((await state()).assets[0].rotation,30);await angle.press('ArrowUp');assert.equal(Number(await angle.inputValue()),32);assert.equal((await state()).assets[0].rotation,30);await angle.fill('30');await angle.press('Tab');await settle();checks++;
 const drawerMatrix=await page.locator('[data-drawer-id="d"].asset-note-drawer').evaluate(el=>new DOMMatrix(getComputedStyle(el.closest('[data-asset-id]')).transform).a);assert.ok(Math.abs(drawerMatrix-Math.cos(Math.PI/6))<1e-5);checks++;
 const before=d.assets[0];await drag(asset('a'),40,30,{cancel:true});d=await state();assert.equal(d.assets[0].x,before.x);assert.equal(d.assets[0].y,before.y);assert.equal(d.assets[0].rotation,30);checks++;
 await page.getByLabel('旋转归零',{exact:true}).click();await settle();
 await down(asset('a'));await down(text('t1'),{ctrl:true});assert.match(await page.locator('.canvas-arrange-toolbar').innerText(),/排列 · 2/);checks++;
 d=await state();const oldA=d.assets[0],oldT=d.texts[0];await drag(asset('a'),33,27);d=await state();assert.equal(d.assets[0].x,oldA.x+33);assert.equal(d.texts[0].x,oldT.x+33);assert.equal(d.texts[0].y,oldT.y+27);assert.equal(d.db.texts[0].x,d.texts[0].x);checks++;
 await page.getByLabel('撤销画布操作').click();await settle();d=await state();assert.equal(d.assets[0].x,oldA.x);assert.equal(d.texts[0].x,oldT.x);await page.getByLabel('重做画布操作').click();await settle();assert.equal((await state()).texts[0].x,oldT.x+33);checks++;
 await page.getByRole('button',{name:'排列 · 2',exact:true}).click();await page.getByRole('button',{name:'上对齐',exact:true}).click();await settle();d=await state();assert.equal(d.assets[0].y,d.texts[0].y);checks++;
 await down(text('t1'),{ctrl:true});await down(asset('a'));await page.getByRole('button',{name:'排列 · 1',exact:true}).click();assert.equal(await page.locator('.canvas-axis-guides').count(),1);await down(asset('b'));assert.equal(await page.locator('.canvas-axis-guides').count(),1);await page.getByLabel('清除中轴线').click();assert.equal(await page.locator('.canvas-axis-guides').count(),0);checks++;
 await page.evaluate(()=>window.transformQA.failure(true));await down(asset('c'));await drag(asset('c'),25,15);await page.waitForSelector('.canvas-transform-error');d=await state();assert.notEqual(d.assets[2].x,d.db.assets[2].x);await page.evaluate(()=>window.transformQA.failure(false));await page.locator('.canvas-transform-error').getByRole('button',{name:'重试保存'}).click();await settle();d=await state();assert.equal(d.assets[2].x,d.db.assets[2].x);assert.equal(await page.locator('.canvas-transform-error').count(),0);checks++;
 await page.screenshot({path:output+'/outer-transforms.png'});await page.reload();await page.waitForFunction(()=>window.transformQA);assert.equal((await state()).assets[2].x,d.assets[2].x);checks++;
 await page.evaluate(()=>{const saved=JSON.parse(localStorage.getItem('transform-qa'));saved.assets.find(a=>a.id==='b').locked=true;localStorage.setItem('transform-qa',JSON.stringify(saved));});await page.reload();await page.waitForFunction(()=>window.transformQA);await pick(asset('b'));assert.equal(await page.getByLabel('旋转角度',{exact:true}).isDisabled(),true);await blank();assert.equal((await state()).db.assets[1].rotation,0);checks++;
 await page.getByRole('button',{name:'内画布',exact:true}).click();await settle();await down(text('t1'));await page.getByLabel('旋转角度',{exact:true}).fill('45');await blank('.asset-inner-canvas');assert.equal((await state()).inner[0].rotation,45);await down(text('t1'));checks++;
 await drag(text('t1'),60,40,{cancel:true});assert.equal((await state()).inner[0].rotation,45);checks++;
 await page.getByLabel('撤销画布操作').click();await settle();assert.equal((await state()).inner[0].rotation,0);await page.getByLabel('重做画布操作').click();await settle();assert.equal((await state()).inner[0].rotation,45);checks++;
 await page.screenshot({path:output+'/inner-transforms.png'});
 assert.deepEqual(errors,[]);await writeFile(output+'/browser-result.json',JSON.stringify({checks,errors,state:await state()},null,2));console.log(`PASS ${checks} canvas transform browser scenarios; console clean`);
}finally{await browser.close();}
