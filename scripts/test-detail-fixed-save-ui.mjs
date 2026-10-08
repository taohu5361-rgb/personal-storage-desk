import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser=await chromium.launch({headless:true,channel:'msedge'});
const checks=[],errors=[];
const passed=message=>{checks.push(message);console.log('PASS '+message);};
const base=process.env.UI_TEST_BASE_URL||'http://127.0.0.1:1450';
async function open(manual=false) {
  const page=await browser.newPage({viewport:{width:1600,height:1100}});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
  await page.goto(`${base}/scripts/verify-ui-system.html#/settings`);
  await page.getByRole('combobox',{name:'保存方式'}).waitFor();
  if(manual)await page.getByRole('combobox',{name:'保存方式'}).selectOption('manual');
  await page.evaluate(()=>{location.hash='asset/w1/a1';});
  await page.waitForSelector('.standard-text-surface');
  await page.getByRole('button',{name:'内画布',exact:true}).click();
  await page.waitForSelector('.asset-inner-canvas');await page.waitForTimeout(180);
  page.start=await page.evaluate(()=>window.uiQA.writes().length);
  return page;
}
const writes=page=>page.evaluate(start=>window.uiQA.writes().slice(start).filter(w=>!['save_last_page','save_settings','save_asset_detail_view_mode'].includes(w.command)),page.start);
const tick=async page=>{
  await page.evaluate(async()=>{const detail={promises:[]};window.dispatchEvent(new CustomEvent('canvas-auto-save',{detail}));await Promise.allSettled(detail.promises);});
  await page.waitForTimeout(100);
};
async function pan(page) {
  const box=await page.locator('.asset-inner-canvas').boundingBox();
  const x=box.x+Math.min(960,box.width-80),y=box.y+80;
  await page.mouse.move(x,y);await page.keyboard.down('Space');await page.mouse.down();
  await page.mouse.move(x+50,y+30,{steps:12});await page.mouse.up();await page.keyboard.up('Space');
  await page.waitForTimeout(320);
}
async function appearance(page) {
  await page.getByRole('button',{name:'画布背景',exact:true}).click();
  await page.locator('.canvas-appearance-panel').getByRole('button',{name:'白色',exact:true}).click();
  await page.waitForTimeout(200);
}
try {
  {
    const page=await open();await pan(page);assert.equal((await writes(page)).length,0);
    await tick(page);const saved=(await writes(page)).filter(w=>w.command==='save_asset_inner_canvas_viewport');
    assert.equal(saved.length,1);assert.equal(saved[0].args.viewportX,70);assert.equal(saved[0].args.viewportY,60);
    await tick(page);assert.equal((await writes(page)).filter(w=>w.command==='save_asset_inner_canvas_viewport').length,1);
    passed('内画布平移松手不写，统一tick保存最终视口，干净tick不重复写');await page.close();
  }
  {
    const page=await open(true);await pan(page);await appearance(page);await tick(page);
    assert.equal((await writes(page)).length,0);
    await page.getByRole('button',{name:'设置',exact:true}).click();await page.waitForTimeout(120);
    assert.match(page.url(),/asset\/w1\/a1/);assert.equal((await writes(page)).length,0);
    passed('仅手动模式内画布视口与背景都不自动写，未保存离页被拦住');
    await page.locator('.asset-inner-canvas').focus();await page.keyboard.press('Control+s');await page.waitForTimeout(200);
    assert.equal((await writes(page)).filter(w=>w.command==='save_asset_inner_canvas_viewport').length,1);
    assert.equal((await writes(page)).filter(w=>w.command==='save_asset_inner_canvas_appearance').length,1);
    assert.equal(await page.evaluate(()=>window.uiQA.state().innerCanvasAppearances[0].color),'#ffffff');
    await page.getByRole('button',{name:'设置',exact:true}).click();await page.waitForSelector('.settings-layout');
    passed('Ctrl+S一次保存详情视口与背景，随后离页不产生重复写入');await page.close();
  }
  {
    const page=await open();await appearance(page);assert.equal((await writes(page)).length,0);
    await tick(page);assert.equal((await writes(page)).filter(w=>w.command==='save_asset_inner_canvas_appearance').length,1);
    passed('背景普通选择只变草稿，自动模式等统一tick写入');await page.close();
  }
  {
    const page=await open(true);await page.getByRole('button',{name:'标准详情',exact:true}).click();
    await page.waitForSelector('.standard-text-surface');
    assert.equal((await writes(page)).filter(w=>w.command==='save_asset_text_changes').length,0);
    await page.getByRole('button',{name:'设置',exact:true}).click();await page.waitForSelector('.settings-layout');
    assert.equal((await writes(page)).filter(w=>w.command==='save_asset_text_changes').length,0);
    passed('manual只读切换详情和离页不会暗存默认文字布局');await page.close();
  }
  assert.deepEqual(errors,[]);
  const out='.impeccable/evidence/fixed-save/detail';await mkdir(out,{recursive:true});
  await writeFile(`${out}/result.json`,JSON.stringify({checks,errors},null,2));
  console.log(`PASS ${checks.length} detail save scenarios; console clean`);
} finally {await browser.close();}
