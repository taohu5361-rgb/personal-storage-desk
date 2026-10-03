import { reportDirectory, browserOptions, qaBaseURL } from './qa-support.mjs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const output=reportDirectory(import.meta.url);mkdirSync(output,{recursive:true});
const browser=await chromium.launch({...browserOptions,headless:true});
const page=await browser.newPage({viewport:{width:1500,height:960}});
const errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
const surface=()=>page.locator('.demo-stage > .asset-canvas, .demo-stage .asset-inner-canvas');
const snapshot=()=>page.evaluate(()=>{
  const d=window.panDemo;
  return {mode:d.mode,view:d.mode==='outer'?d.outerView:d.innerView,positions:d.mode==='outer'?d.assets.map(a=>[a.id,a.x,a.y,a.width,a.height]):d.objects.map(a=>[a.objectId,a.x,a.y,a.width,a.height]),selection:[...document.querySelectorAll('.canvas-asset.selected,.inner-canvas-object.selected')].map(n=>n.dataset.objectId||n.dataset.assetId||n.textContent)};
});
const reset=async mode=>{
  await page.evaluate(m=>{window.panDemo.reset();window.panDemo.setMode(m);},mode);
  await page.waitForTimeout(300);
  await surface().waitFor();
};
const drag=async(point,button='middle',dx=68,dy=44)=>{
  await page.mouse.move(point.x,point.y);await page.mouse.down({button});
  await page.mouse.move(point.x+dx,point.y+dy,{steps:8});await page.mouse.up({button});
  await page.waitForTimeout(320);
};
const pointOf=async locator=>{const r=await locator.boundingBox();assert.ok(r,'target exists');return {x:r.x+r.width/2,y:r.y+r.height/2};};
const assertPan=async(label,point)=>{
  const before=await snapshot();await drag(point);const after=await snapshot();
  assert.ok(Math.abs(after.view.x-before.view.x-68)<1,`${label}: X delta`);
  assert.ok(Math.abs(after.view.y-before.view.y-44)<1,`${label}: Y delta`);
  assert.deepEqual(after.positions,before.positions,`${label}: object coordinates unchanged`);
  assert.deepEqual(after.selection,before.selection,`${label}: selection unchanged`);
  const settled=after.view;await page.mouse.move(point.x+95,point.y+80);await page.waitForTimeout(280);
  assert.deepEqual((await snapshot()).view,settled,`${label}: released middle stops pan`);
  checks.push(label);
  console.log('PASS '+label);
};
try{
  await page.goto(`${qaBaseURL}/scripts/verify-middle-pan.html`);await surface().waitFor();
  for(const mode of ['outer','inner']){
    await reset(mode);
    const r=await surface().boundingBox();
    await assertPan(`${mode}: 中央空白中键平移`,{x:r.x+r.width/2,y:r.y+r.height/2});
    await reset(mode);
    const targets=mode==='outer'?['.canvas-asset:not(.locked) .canvas-asset-image','.canvas-asset.locked .canvas-asset-image','.inner-object-textBlock .text-block-content','.asset-note-drawer-text']:['.inner-object-sample:not(.locked)','.inner-object-sample.locked','.inner-object-textBlock .text-block-content','.inner-object-prompt .inner-object-content'];
    for(const selector of targets){
      await reset(mode);
      await assertPan(`${mode}: ${selector} 上中键平移`,await pointOf(page.locator(selector).first()));
    }
    await reset(mode);
    const picture=page.locator(mode==='outer'?'.canvas-asset:not(.locked) .canvas-asset-image':'.inner-object-sample:not(.locked)');
    const before=await snapshot();await drag(await pointOf(picture),'left',48,35);const moved=await snapshot();
    assert.deepEqual(moved.view,before.view,`${mode}: left drag does not pan`);
    assert.ok(moved.positions.some((p,i)=>p[1]!==before.positions[i][1]),`${mode}: left drag moves image`);
    checks.push(`${mode}: 左键只移动图片`);
    const handle=page.locator(mode==='outer'?'.canvas-asset.selected .resize-handle':'.inner-object-sample.selected .inner-resize-handle').first();
    await assertPan(`${mode}: 缩放手柄中键平移不缩放`,await pointOf(handle));
    await reset(mode);const lockedBefore=await snapshot();
    await drag(await pointOf(page.locator(mode==='outer'?'.canvas-asset.locked .canvas-asset-image':'.inner-object-sample.locked')),'left');
    assert.deepEqual((await snapshot()).positions,lockedBefore.positions);assert.deepEqual((await snapshot()).view,lockedBefore.view);checks.push(`${mode}: 锁定图片左键不移动`);
    await reset(mode);
    await page.locator('.inner-object-textBlock .text-block-content').dblclick();
    const editor=page.locator('.text-block-editor textarea');await editor.waitFor();
    const value=await editor.inputValue();await assertPan(`${mode}: 编辑文字时中键仍平移`,await pointOf(editor));
    assert.equal(await editor.inputValue(),value,`${mode}: middle pan keeps draft`);
    await reset(mode);const rr=await surface().boundingBox();
    const start={x:rr.x+rr.width/2,y:rr.y+rr.height/2};
    await page.mouse.move(start.x,start.y);await page.mouse.down({button:'middle'});await page.mouse.move(start.x+40,start.y+30);
    await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.mouse.up({button:'middle'});await page.waitForTimeout(320);
    const blurred=(await snapshot()).view;await page.mouse.move(start.x+80,start.y+60);await page.waitForTimeout(280);assert.deepEqual((await snapshot()).view,blurred);checks.push(`${mode}: 失焦后结束平移`);
    await reset(mode);await page.keyboard.down('Space');const spaceBefore=await snapshot();await drag(await pointOf(page.locator(mode==='outer'?'.canvas-asset:not(.locked) .canvas-asset-image':'.inner-object-sample:not(.locked)')),'left');await page.keyboard.up('Space');
    const spaceAfter=await snapshot();assert.notEqual(spaceBefore.view.x,spaceAfter.view.x);assert.deepEqual(spaceBefore.positions,spaceAfter.positions);checks.push(`${mode}: 空格加左键平移保留`);
    await reset(mode);
    await page.screenshot({path:`${output}/${mode}.png`});
  }
  await reset('inner');
  await assertPan('inner: Prompt 复制按钮中键平移',await pointOf(page.locator('.inner-object-heading button')));
  for(const mode of ['outer','inner'])for(const zoom of [.5,2]){
    await reset(mode);await page.evaluate(z=>window.panDemo.setView({x:0,y:0,zoom:z}),zoom);await page.waitForTimeout(280);
    await assertPan(`${mode}: ${zoom*100}% 缩放图片上中键平移`,await pointOf(page.locator(mode==='outer'?'.canvas-asset:not(.locked) .canvas-asset-image':'.inner-object-sample:not(.locked)')));
  }
  for(const mode of ['outer','inner']){
    await reset(mode);await page.evaluate(()=>window.panDemo.setEmpty());await page.waitForTimeout(280);const r=await surface().boundingBox();
    await assertPan(`${mode}: 空画布中央提示中键平移`,{x:r.x+r.width/2,y:r.y+r.height/2});
  }
  for(const width of [800,540]){
    await page.setViewportSize({width,height:900});await reset('outer');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${width}px: no horizontal page overflow`);checks.push(`${width}px 页面无横向溢出`);
  }
  assert.deepEqual(errors,[]);
  writeFileSync(`${output}/result.json`,JSON.stringify({checks,errors},null,2));
  console.log(JSON.stringify({checks,errors},null,2));
}catch(error){await page.screenshot({path:`${output}/failure.png`});console.log(JSON.stringify({checks,errors,snapshot:await snapshot()},null,2));throw error;}finally{await browser.close();}
