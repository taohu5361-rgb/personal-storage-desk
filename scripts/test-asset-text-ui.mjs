import { reportDirectory, browserOptions, qaBaseURL } from './qa-support.mjs';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import { chromium } from 'playwright';
const reportDir=process.env.ASSET_TEXT_REPORT_DIR || reportDirectory(import.meta.url);
await mkdir(reportDir,{recursive:true});
const browser=await chromium.launch({...browserOptions,headless:true});
const page=await browser.newPage({viewport:{width:1280,height:820}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
let checks=0;
const snapshot=()=>page.evaluate(()=>window.__textVerification.snapshot());
const block=id=>page.locator(`[data-object-id="${id}"]`);
const layout=async(id,mode)=>(await snapshot()).layouts.find(l=>l.textId===id&&l.viewMode===mode);
const settled=()=>page.evaluate(()=>window.__textVerification.controller.flush());
const locate=async id=>{await page.getByLabel('定位文字').selectOption(id);await page.waitForTimeout(60);};
const switchView=async mode=>{await page.getByRole('button',{name:'切换视图',exact:true}).click();await page.waitForFunction(mode=>window.__textVerification.mode===mode,mode);await page.waitForTimeout(100);};
const close=(a,b)=>assert.ok(Math.abs(a-b)<.2,`${a} != ${b}`);
try {
  await page.goto(`${qaBaseURL}/scripts/verify-asset-text.html`);await page.waitForFunction(()=>window.__textVerification?.snapshot().layouts.length===8);await settled();
  await page.getByRole('button',{name:'原有详情按钮',exact:true}).click();assert.equal(await page.getByTestId('clicks').innerText(),'1');checks++;
  const originalCanvas=await layout('card','canvas');
  await locate('card');await block('card').dblclick();await page.getByLabel('编辑文字块内容').fill('标准详情修改\n中文内容 / English');await page.getByLabel('编辑文字块内容').press('Control+Enter');await settled();
  assert.equal((await snapshot()).elements.find(e=>e.id==='card').content,'标准详情修改\n中文内容 / English');checks++;
  const size=page.locator('.text-style-toolbar label').filter({hasText:'字号'}).locator('input');await size.fill('32');await size.press('Tab');await settled();
  await page.getByLabel('样式类型').selectOption('sticky');await settled();assert.equal((await snapshot()).elements.find(e=>e.id==='card').styleType,'sticky');assert.equal((await snapshot()).elements.find(e=>e.id==='card').fontSize,32);checks++;
  const before=await layout('card','standard'),rect=await block('card').boundingBox();
  await page.mouse.move(rect.x+30,rect.y+30);await page.mouse.down();await page.mouse.move(rect.x+110,rect.y+60,{steps:5});await page.mouse.up();await settled();
  const after=await layout('card','standard');close(after.x,before.x+80);close(after.y,before.y+30);assert.deepEqual(await layout('card','canvas'),originalCanvas);checks++;
  const handle=block('card').locator('.inner-resize-handle.se'),hr=await handle.boundingBox();await page.mouse.move(hr.x+10,hr.y+10);await page.mouse.down();await page.mouse.move(hr.x+50,hr.y+30,{steps:4});await page.mouse.up();await settled();
  const resized=await layout('card','standard');close(resized.width,after.width+40);close(resized.height,after.height+20);checks++;
  for(const scale of ['0.75','1','1.5']) {
    await page.getByLabel('界面缩放').selectOption(scale);await locate('card');await block('card').focus();
    const old=await layout('card','standard'),rect=await block('card').boundingBox();const v=Number(scale);
    await page.mouse.move(rect.x+30*v,rect.y+30*v);await page.mouse.down();await page.mouse.move(rect.x+70*v,rect.y+45*v,{steps:4});await page.keyboard.press('Escape');await page.mouse.up();
    assert.deepEqual(await layout('card','standard'),old);checks++;
    for(const corner of ['nw','ne','sw','se']) {
      await block('card').focus();const h=await block('card').locator('.inner-resize-handle.'+corner).boundingBox();
      await page.mouse.move(h.x+10,h.y+10);await page.mouse.down();await page.mouse.move(h.x+10+20*v,h.y+10+15*v,{steps:3});await page.keyboard.press('Escape');await page.mouse.up();
      assert.deepEqual(await layout('card','standard'),old);checks++;
    }
  }
  await page.getByLabel('界面缩放').selectOption('1');await locate('card');await block('card').click({button:'right'});await page.getByRole('button',{name:'锁定',exact:true}).click();await settled();assert.equal(await block('card').locator('.inner-resize-handle').count(),0);assert.equal((await layout('card','canvas')).locked,false);checks++;
  await block('card').click({button:'right'});await page.getByRole('button',{name:'解除锁定',exact:true}).click();await settled();
  await locate('card');await block('plain').scrollIntoViewIfNeeded();await block('plain').click({modifiers:['Control']});await block('plain').click({button:'right'});
  await page.getByRole('button',{name:'将所选对象创建为分组',exact:true}).click();await settled();
  assert.equal((await layout('plain','standard')).groupId,(await layout('card','standard')).groupId);assert.equal((await layout('card','canvas')).groupId,null);checks++;
  await page.locator('.standard-text-surface').focus();await page.keyboard.press('Escape');
  await locate('card');await block('card').focus();await page.keyboard.press('Control+c');await switchView('canvas');
  assert.deepEqual(await layout('card','canvas'),originalCanvas);assert.match(await block('card').innerText(),/标准详情修改/);await block('card').focus();await page.keyboard.press('Control+v');await settled();assert.equal((await snapshot()).elements.length,5);checks++;
  await switchView('standard');await page.getByRole('button',{name:'添加文字',exact:true}).click();await page.getByLabel('编辑文字块内容').fill('新增资产级文字');await page.getByLabel('编辑文字块内容').press('Control+Enter');await settled();
  const added=(await snapshot()).elements.find(e=>e.content==='新增资产级文字');assert.ok(added);await switchView('canvas');assert.match(await block(added.id).innerText(),/新增资产级文字/);checks++;
  await block(added.id).dblclick();await page.getByLabel('编辑文字块内容').fill('失败后保留的最新草稿');await page.getByRole('button',{name:'模拟保存失败：关',exact:true}).click();await page.waitForTimeout(150);
  await page.getByRole('button',{name:'切换视图',exact:true}).click();await page.waitForTimeout(150);assert.equal(await page.getByTestId('mode').innerText(),'canvas');assert.equal((await snapshot()).elements.find(e=>e.id===added.id).content,'失败后保留的最新草稿');checks++;
  await page.getByRole('button',{name:'模拟保存失败：开',exact:true}).click();await page.getByRole('button',{name:'重试保存',exact:true}).click();await settled();await switchView('standard');assert.equal((await snapshot()).error,'');checks++;
  await locate(added.id);await block(added.id).focus();await page.keyboard.press('Delete');await settled();assert.ok(!(await snapshot()).elements.some(e=>e.id===added.id));await switchView('canvas');assert.equal(await block(added.id).count(),0);checks++;
  await switchView('standard');const persisted=await snapshot();await page.reload();await page.waitForFunction(()=>window.__textVerification?.snapshot().layouts.length>0);await settled();assert.deepEqual((await snapshot()).elements,persisted.elements);checks++;
  await page.setViewportSize({width:760,height:700});await locate('card');await block('card').focus();const panel=await page.locator('.text-style-toolbar').boundingBox();assert.ok(panel.y>=0 && panel.y+panel.height<=700);checks++;
  await page.evaluate(async()=>{const {projectTextItems}=await import('/src/data/assetTextModel.js');const c=window.__textVerification.controller,s=c.snapshot();c.draft('standard',projectTextItems(s.elements,s.layouts,'standard').map(i=>i.objectId==='card'?{...i,x:1000}:i));await c.flush();});
  await locate('card');await block('card').focus();assert.ok(await page.locator('.asset-detail-main').evaluate(el=>el.scrollLeft>0));
  const picker=await page.getByLabel('定位文字').boundingBox(),floating=await page.locator('.text-style-toolbar').boundingBox();assert.ok(picker.x>=0&&picker.x+picker.width<=760);assert.ok(floating.x>=0&&floating.x+floating.width<=760);checks++;
  await page.screenshot({path:join(reportDir,'standard-narrow.png')});assert.deepEqual(errors,[]);
  // Existing inner-canvas event suite still exercises the shared surface.
  await page.setViewportSize({width:1600,height:1000});await page.goto(`${qaBaseURL}/scripts/verify-inner-canvas.html`);
  await page.getByRole('button',{name:'运行组合验收'}).click();await page.waitForFunction(()=>document.querySelector('output')?.textContent?.match(/PASS|FAIL/));assert.match(await page.locator('output').innerText(),/^PASS/);checks++;
  await page.getByRole('button',{name:'运行对象验收'}).click();await page.waitForFunction(()=>document.querySelector('output')?.textContent?.match(/对象类型|FAIL/));assert.match(await page.locator('output').innerText(),/^PASS/);checks++;
  assert.deepEqual(errors,[]);
  console.log(`PASS ${checks} browser scenarios; screenshots: ${reportDir}`);
} catch(error) {await page.screenshot({path:join(reportDir,'failure.png')});throw error;} finally {await browser.close();}
