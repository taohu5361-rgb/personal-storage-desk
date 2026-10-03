import { reportDirectory, browserOptions, qaBaseURL } from './qa-support.mjs';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import { chromium } from 'playwright';
const output=process.env.OUTER_TEXT_REPORT_DIR || reportDirectory(import.meta.url);
await mkdir(output,{recursive:true});
const browser=await chromium.launch({...browserOptions,headless:true});
const page=await browser.newPage({viewport:{width:1280,height:820}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
let checks=0;
const saved=()=>page.evaluate(()=>window.outerTextQA.blocks());
const block=id=>page.locator(`[data-object-id="${id}"]`);
const settle=async()=>{assert.equal(await page.evaluate(()=>window.outerTextQA.flush()),true);};
const close=(a,b)=>assert.ok(Math.abs(a-b)<.3,`${a} != ${b}`);
const drag=async(el,dx,dy,cancel=false)=>{const r=await el.boundingBox();await page.keyboard.down('Alt');await page.mouse.move(r.x+20,r.y+20);await page.mouse.down();await page.mouse.move(r.x+20+dx,r.y+20+dy,{steps:5});if(cancel){await page.keyboard.press('Escape');await page.waitForTimeout(40);}await page.mouse.up();await page.keyboard.up('Alt');};
try {
  await page.goto(process.env.OUTER_TEXT_QA_URL || `${qaBaseURL}/scripts/verify-outer-text.html`);await page.waitForFunction(()=>window.outerTextQA);
  // All three creation entrances operate on the actual outer canvas component.
  await page.getByRole('button',{name:'添加文字',exact:true}).click();await page.getByLabel('编辑文字块内容').fill('外画布通用文字\n中文 / English');await page.getByLabel('编辑文字块内容').press('Control+Enter');await settle();
  let texts=await saved(),id=texts[0].id;assert.equal(texts[0].categoryId,'outer-a');assert.match(texts[0].content,/中文/);checks++;
  await page.mouse.dblclick(900,550);await page.getByLabel('编辑文字块内容').fill('空白处双击');await page.getByLabel('编辑文字块内容').press('Control+Enter');await settle();assert.equal((await saved()).length,2);checks++;
  await page.mouse.click(600,600,{button:'right'});await page.getByRole('button',{name:'添加便签',exact:true}).click();await page.getByLabel('编辑文字块内容').fill('便签入口');await page.getByLabel('编辑文字块内容').press('Control+Enter');await settle();assert.equal((await saved()).at(-1).styleType,'sticky');checks++;
  await page.mouse.click(950,300,{button:'right'});await page.getByRole('button',{name:'添加信息面板',exact:true}).click();await page.getByLabel('信息面板标题').fill('外画布标题');await page.getByLabel('编辑文字块内容').fill('信息面板正文');await page.getByLabel('编辑文字块内容').press('Control+Enter');await settle();assert.equal((await saved()).at(-1).title,'外画布标题');checks++;
  await block(id).click({position:{x:15,y:15}});await page.getByLabel('样式类型').selectOption('card');const size=page.locator('.text-style-toolbar label').filter({hasText:'字号'}).locator('input');await size.fill('28');await size.press('Tab');await settle();assert.equal((await saved()).find(t=>t.id===id).fontSize,28);assert.equal((await saved()).find(t=>t.id===id).styleType,'card');checks++;
  // Three UI scales and three world zooms must preserve unscaled world deltas.
  const minimapToggle=page.getByRole('button',{name:'小地图',exact:true});if(await minimapToggle.getAttribute('aria-expanded')==='true')await minimapToggle.click();
  for(const [scale,zoom] of [[1,1],[.75,.8],[1.5,1.2]]) {
    await page.getByLabel('界面缩放').selectOption(String(scale));
    await page.evaluate(zoom=>window.outerTextQA.viewport({viewportX:0,viewportY:0,zoom}),zoom);await page.waitForTimeout(70);
    const before=(await saved()).find(t=>t.id===id);await drag(block(id),30*scale*zoom,20*scale*zoom);await settle();const after=(await saved()).find(t=>t.id===id);close(after.x,before.x+30);close(after.y,before.y+20);checks++;
  }
  await page.getByLabel('界面缩放').selectOption('1');await page.evaluate(()=>window.outerTextQA.viewport({viewportX:0,viewportY:0,zoom:1}));await page.waitForTimeout(60);
  await block(id).click({position:{x:15,y:15}});
  const original=(await saved()).find(t=>t.id===id);await drag(block(id),70,40,true);await settle();const cancelled=(await saved()).find(t=>t.id===id);close(cancelled.x,original.x);close(cancelled.y,original.y);checks++;
  await block(id).click({button:'right',position:{x:15,y:15}});await page.getByRole('button',{name:'置于顶层',exact:true}).click();await settle();checks++;
  for(const corner of ['nw','ne','sw','se']) {
    await block(id).click({position:{x:15,y:15}});const handle=block(id).locator('.inner-resize-handle.'+corner),r=await handle.boundingBox(),before=(await saved()).find(t=>t.id===id);
    await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(r.x+r.width/2+(corner.includes('w')?-15:15),r.y+r.height/2+(corner.includes('n')?-10:10),{steps:4});await page.mouse.up();await settle();const after=(await saved()).find(t=>t.id===id);close(after.width,before.width+15);close(after.height,before.height+10);checks++;
  }
  await block(id).click({button:'right',position:{x:15,y:15}});await page.getByRole('button',{name:'锁定',exact:true}).click();await settle();const locked=(await saved()).find(t=>t.id===id);await drag(block(id),30,20);await settle();close((await saved()).find(t=>t.id===id).x,locked.x);checks++;
  await block(id).click({button:'right',position:{x:15,y:15}});await page.getByRole('button',{name:'解除锁定',exact:true}).click();await settle();
  // Keyboard routing must choose text operations instead of deleting assets.
  await block(id).click({position:{x:15,y:15}});await page.keyboard.press('Control+c');await page.keyboard.press('Control+v');await settle();const copy=(await saved()).at(-1);assert.notEqual(copy.id,id);assert.equal(copy.content,locked.content);assert.equal((await page.evaluate(()=>window.outerTextQA.assets())).length,1);checks++;
  await page.keyboard.press('Delete');await settle();assert.ok(!(await saved()).some(t=>t.id===copy.id));checks++;
  // Ctrl+A now selects assets and text together; exercise the existing text-only group command explicitly.
  await block(id).click({position:{x:15,y:15}});for(const item of await saved())if(item.id!==id)await block(item.id).evaluate(el=>{const b=el.getBoundingClientRect();el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerId:73,ctrlKey:true,clientX:b.x+15,clientY:b.y+15}));window.dispatchEvent(new PointerEvent('pointerup',{pointerId:73,clientX:b.x+15,clientY:b.y+15}));});await page.keyboard.press('Control+g');await settle();const grouped=await saved();assert.ok(grouped[0].groupId);assert.ok(grouped.every(t=>t.groupId===grouped[0].groupId));checks++;
  await drag(block(id),20,15);await settle();const moved=await saved();for(const before of grouped){const after=moved.find(t=>t.id===before.id);close(after.x,before.x+20);close(after.y,before.y+15);}checks++;
  await block(id).click({button:'right',position:{x:15,y:15}});await page.getByRole('button',{name:'取消分组',exact:true}).click();await settle();assert.ok((await saved()).every(t=>!t.groupId));checks++;
  // Page overlay passes clicks through to existing assets and note drawers.
  await page.locator('.canvas-asset').dblclick({position:{x:40,y:40}});assert.equal(await page.getByTestId('opens').innerText(),'1');checks++;
  await page.locator('[data-drawer-id="drawer"] .asset-note-drawer-text').dblclick();await page.getByLabel('备注内容').fill('原有备注仍可编辑');await page.getByLabel('备注内容').press('Control+Enter');checks++;
  const viewportBefore=await page.evaluate(()=>window.outerTextQA.category());await page.mouse.move(450,700);await page.mouse.wheel(0,-100);await page.waitForTimeout(80);assert.ok((await page.evaluate(()=>window.outerTextQA.category())).zoom>viewportBefore.zoom);checks++;
  await page.getByRole('button',{name:'适应全部资产',exact:true}).click();await page.waitForTimeout(80);checks++;
  // Unsaved text cannot be lost by a classification switch, including failures.
  await block(id).dblclick({position:{x:15,y:15}});await page.getByLabel('编辑文字块内容').fill('保存失败时保留');await page.evaluate(()=>window.outerTextQA.fail());await page.getByRole('button',{name:'切换分类',exact:true}).click();await page.waitForSelector('.outer-text-save-error');assert.equal(await page.getByTestId('category').innerText(),'outer-a');assert.match(await block(id).innerText(),/保存失败时保留/);checks++;
  await page.evaluate(()=>window.outerTextQA.fail());await page.getByRole('button',{name:'重试保存',exact:true}).click();await settle();assert.equal((await saved()).find(t=>t.id===id).content,'保存失败时保留');checks++;
  await page.getByRole('button',{name:'切换分类',exact:true}).click();await page.waitForFunction(()=>window.outerTextQA.category().id==='outer-b');assert.equal(await page.locator('[data-object-id]').count(),0);checks++;
  await page.getByRole('button',{name:'切换分类',exact:true}).click();await page.waitForFunction(()=>window.outerTextQA.category().id==='outer-a');assert.equal(await page.locator('[data-object-id]').count(),4);checks++;
  await page.reload();await page.waitForFunction(()=>window.outerTextQA);assert.equal(await page.locator('[data-object-id]').count(),4);checks++;
  await page.setViewportSize({width:720,height:700});await page.getByRole('button',{name:'适应全部资产',exact:true}).click();await block(id).click({position:{x:15,y:15}});await page.screenshot({path:output+'/outer-narrow.png'});assert.ok(await page.getByLabel('文字样式').isVisible());checks++;
  assert.deepEqual(errors,[]);await writeFile(output+'/browser-result.json',JSON.stringify({checks,errors,texts:await saved()},null,2));console.log(`PASS ${checks} outer text browser scenarios; console clean`);
} finally {await browser.close();}
