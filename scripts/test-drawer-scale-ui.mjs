import { reportDirectory, browserOptions, qaBaseURL } from './qa-support.mjs';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
const output=path.resolve(reportDirectory(import.meta.url));mkdirSync(output,{recursive:true});
const browser=await chromium.launch({...browserOptions,headless:true}),page=await browser.newPage({viewport:{width:1600,height:1000}}),checks=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
const panel=()=>page.locator('article[data-drawer-id="drawer-right"]');
const saved=()=>page.evaluate(()=>window.drawerQA.getStored()[0]);
const seed=async(extra={})=>{await page.evaluate(extra=>{window.drawerQA.seed([{...window.drawerQA.getStored().find(d=>d.id==='drawer-right'),mode:'floating',text:'中文缩放测试',width:240,height:150,floatingX:500,floatingY:300,textScale:1,locked:false,...extra}]);},extra);await page.waitForSelector('article[data-drawer-id="drawer-right"]');};
const scale=async(percent)=>{const input=page.getByLabel('文字缩放百分比');await input.fill(String(percent));await input.press('Tab');await page.waitForFunction(p=>Math.abs(window.drawerQA.getStored()[0].textScale-p/100)<1e-8,Math.min(2000,Math.max(50,percent)));};
const open=()=>panel().getByRole('button',{name:'文字缩放',exact:true}).click();
async function drag(locator,dx,dy,cancel=false){const b=await locator.boundingBox();const x=b.x+b.width/2,y=b.y+b.height/2;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:8});if(cancel)await page.keyboard.press('Escape');await page.mouse.up();await page.waitForTimeout(400);}
try{
 await page.goto(`${qaBaseURL}/scripts/drawer-qa.html`);await page.waitForFunction(()=>window.drawerQA?.seed);await seed();
 await open();await scale(250);assert.equal(await panel().locator('.asset-note-drawer-text').evaluate(el=>getComputedStyle(el).fontSize),'32.5px');checks.push('six-dot click opens settings and persists 250%');
 await page.keyboard.press("Escape");await panel().locator('.asset-note-drawer-text').dblclick();const editor=panel().getByLabel('备注内容');await editor.fill('中文编辑内容保留');assert.equal(await editor.evaluate(el=>getComputedStyle(el).fontSize),'32.5px');await editor.press('Escape');await page.waitForTimeout(400);checks.push('editing and rendered text share font scale');
 await open();await scale(10);assert.equal((await saved()).textScale,.5);await scale(3000);assert.equal((await saved()).textScale,20);await page.getByText('恢复 100%',{exact:true}).click();await page.waitForTimeout(400);assert.equal((await saved()).textScale,1);checks.push('numeric boundaries and reset preserve text and size');
 await page.keyboard.press('Escape');await panel().click({position:{x:15,y:15}});await drag(panel().getByLabel('调整备注抽屉大小 se'),240,150);let d=await saved();assert.ok(Math.abs(d.width-480)<.01);assert.ok(Math.abs(d.textScale-2)<.001);checks.push('uniform resize doubles font');
 await drag(panel().getByLabel('调整备注抽屉大小 se'),100,0);d=await saved();assert.ok(Math.abs(d.textScale-Math.sqrt(d.width*d.height/(240*150)))<1e-8);checks.push('width-only resize follows area');
 await drag(panel().getByLabel('调整备注抽屉大小 se'),0,100);d=await saved();assert.ok(Math.abs(d.textScale-Math.sqrt(d.width*d.height/(240*150)))<1e-8);checks.push('height-only resize follows area');
 const before=await saved();await drag(panel().getByLabel('调整备注抽屉大小 se'),80,80,true);assert.deepEqual(await saved(),before);checks.push('Escape restores size and scale');
 await panel().getByLabel('调整备注抽屉大小 se').focus();await page.keyboard.press('ArrowRight');await page.waitForTimeout(400);d=await saved();assert.ok(Math.abs(d.textScale-Math.sqrt(d.width*d.height/(240*150)))<1e-8);checks.push('keyboard resizing uses same scale rule');
 await drag(panel().getByRole('button',{name:'文字缩放',exact:true}),80,30);assert.equal(await page.getByRole('dialog').count(),0);checks.push('dragging six dots moves card without opening dialog');
 await seed({locked:true});await open();await scale(175);assert.equal((await saved()).locked,true);checks.push('locked drawers permit scale changes');
 await page.keyboard.press('Escape');await seed();await open();await page.evaluate(()=>window.drawerQA.failNext=true);await page.getByLabel('文字缩放百分比').fill('300');await page.waitForTimeout(700);assert.equal(await panel().locator('.asset-note-drawer-text').evaluate(el=>getComputedStyle(el).fontSize),'13px');assert.equal((await saved()).textScale,1);checks.push('failed save rolls back scale');
 await scale(300);checks.push('scale change retries after failure');
 await page.reload();await page.waitForSelector('article[data-drawer-id="drawer-right"]');assert.equal(await panel().locator('.asset-note-drawer-text').evaluate(el=>getComputedStyle(el).fontSize),'39px');checks.push('browser reload retains scale');
 await seed({width:1000,height:700,textScale:4});assert.equal(await panel().evaluate(el=>el.style.width),'1000px');await open();await scale(400);checks.push('large dimensions survive subsequent saves');
 await page.keyboard.press("Escape");await seed({width:240,height:150,floatingX:300,floatingY:200,textScale:4});
 for(const zoom of [.5,2]){await page.evaluate(z=>window.drawerQA.setZoom(z),zoom);await page.waitForTimeout(100);await open();const b=await page.getByRole('dialog').boundingBox();assert.ok(b.x>=0&&b.y>=0&&b.x+b.width<=1600&&b.y+b.height<=1000);assert.equal((await saved()).textScale,4);await page.keyboard.press('Escape');}checks.push('screen-space panel remains in window at canvas zoom extremes');
 await page.evaluate(()=>window.drawerQA.setZoom(.65));await page.waitForTimeout(100);await open();await page.screenshot({path:path.join(output,'scale-settings.png')});assert.deepEqual(errors,[]);
 console.log(JSON.stringify({checks,errors}));writeFileSync(path.join(output,'scale-result.json'),JSON.stringify({checks,errors},null,2));
}catch(e){await page.screenshot({path:path.join(output,'scale-failure.png')});throw e;}finally{await browser.close();}
