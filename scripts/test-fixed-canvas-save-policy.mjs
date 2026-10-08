import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser=await chromium.launch({headless:true,channel:'msedge'});
const output=path.resolve('.impeccable/evidence/canvas-save-diagnosis');
await mkdir(output,{recursive:true});
const checks=[],errors=[];
const passed=message=>{checks.push(message);console.log('PASS '+message);};

// Intercept only the production autosave interval. Rendering, IPC delays and
// gesture timing keep their real clocks; this lets 60 seconds pass cheaply.
async function open({group=false,secondGroup=false,autoSave=true,interval=60}={}){
  const page=await browser.newPage({viewport:{width:1600,height:1100}});
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.addInitScript(()=>{
    let now=0,id=100000,registrations=0;
    const timers=new Map(),set=window.setInterval.bind(window),clear=window.clearInterval.bind(window);
    window.setInterval=(fn,delay,...args)=>{
      if(!Error().stack.includes('/src/data/fixedAutoSave.js:'))return set(fn,delay,...args);
      registrations++;timers.set(++id,{fn:()=>fn(...args),delay,next:now+delay});return id;
    };
    window.clearInterval=key=>timers.delete(key)||clear(key);
    window.clockQA={
      reset(){now=0;for(const timer of timers.values())timer.next=timer.delay;},
      advance(ms){now+=ms;for(const timer of [...timers.values()])while(timer.next<=now){timer.next+=timer.delay;timer.fn();}},
      state:()=>({now,registrations,timers:[...timers.values()].map(({delay,next})=>({delay,next}))}),
    };
  });
  await page.goto(`${process.env.UI_TEST_BASE_URL||'http://127.0.0.1:1450'}/scripts/verify-ui-system.html#/assets/w1?category=c1`);
  await page.waitForSelector('.asset-canvas');await page.waitForTimeout(200);
  await page.evaluate(async({group,secondGroup,autoSave,interval})=>{
    const {call}=await import('/src/data/database.js');const state=window.uiQA.state();
    await call('save_settings',{item:{...state.settings,autoSave,autoSaveInterval:interval}});
    if(group){
      await call('save_canvas_groups',{items:[{id:'dg1',categoryId:'c1',name:'测试分组',x:40,y:20,width:520,height:350,zIndex:1,locked:false,collapsed:false,borderColor:'#759bb8',backgroundColor:'#759bb8',backgroundOpacity:4}]});
      if(secondGroup)await call('save_canvas_groups',{items:[{id:'dg2',categoryId:'c1',name:'另一个分组',x:620,y:20,width:430,height:350,zIndex:2,locked:false,collapsed:false,borderColor:'#759bb8',backgroundColor:'#759bb8',backgroundOpacity:4}]});
      await call('save_asset',{item:{...state.assets[0],groupId:'dg1'}});
    }
    location.hash='asset/w1/a1';
  },{group,secondGroup,autoSave,interval});
  await page.waitForSelector('.standard-text-surface');await page.getByRole('button',{name:'内画布',exact:true}).click();await page.waitForSelector('.asset-inner-canvas');
  await page.waitForTimeout(120);await page.evaluate(()=>{location.hash='assets/w1?category=c1';});
  await page.waitForSelector('.asset-canvas');await page.waitForTimeout(250);
  page.diagnosticStart=await page.evaluate(()=>{window.clockQA.reset();return window.uiQA.writes().length;});
  return page;
}
const writes=page=>page.evaluate(start=>window.uiQA.writes().slice(start).filter(write=>/^save_/.test(write.command)&&!['save_last_page','save_settings'].includes(write.command)),page.diagnosticStart);
const advance=async(page,ms)=>{await page.evaluate(ms=>window.clockQA.advance(ms),ms);await page.waitForTimeout(120);};
async function beginDrag(page,selector,{pan=false,dx=72,dy=36}={}){
  const box=await page.locator(selector).first().boundingBox();assert.ok(box);
  const x=box.x+(pan?900:box.width/2),y=box.y+(pan?70:Math.min(30,box.height/2));
  await page.mouse.move(x,y);if(pan)await page.keyboard.down('Space');await page.mouse.down();
  for(let n=1;n<=12;n++){await page.mouse.move(x+dx*n/12,y+dy*n/12);await page.waitForTimeout(8);}
}
async function endDrag(page,pan=false){await page.mouse.up();if(pan)await page.keyboard.up('Space');await page.waitForTimeout(120);}
const manualSave=async page=>{await page.locator('.canvas-header').getByRole('button',{name:'保存',exact:true}).click();await page.waitForTimeout(220);};

try{
  {
    const page=await open();const initialClock=await page.evaluate(()=>window.clockQA.state());
    assert.deepEqual(initialClock.timers,[{delay:60000,next:60000}]);
    await advance(page,59000);await beginDrag(page,'.asset-canvas',{pan:true});await endDrag(page,true);
    assert.equal((await writes(page)).length,0);
    assert.equal(await page.evaluate(()=>window.clockQA.state().registrations),initialClock.registrations);
    await advance(page,1000);assert.deepEqual((await writes(page)).map(w=>w.command),['save_viewport']);
    assert.equal(await page.evaluate(()=>window.uiQA.state().categories.find(c=>c.id==='c1').viewportX),102);
    await advance(page,60000);assert.equal((await writes(page)).length,1);
    passed('pan/release at 59 seconds keeps the fixed 60-second deadline; clean next tick has zero writes');await page.close();
  }
  {
    const page=await open();const box=await page.locator('.asset-canvas').boundingBox();await page.mouse.move(box.x+900,box.y+70);
    for(let n=0;n<24;n++)await page.mouse.wheel(0,-8);
    await page.waitForTimeout(350);assert.equal((await writes(page)).length,0);
    await advance(page,60000);assert.equal((await writes(page)).filter(w=>w.command==='save_viewport').length,1);
    passed('wheel zoom bursts do not save before the fixed tick; tick writes one final viewport');await page.close();
  }
  {
    const page=await open();await beginDrag(page,'.asset-canvas',{pan:true});await advance(page,60000);
    assert.equal((await writes(page)).length,0);await endDrag(page,true);assert.equal((await writes(page)).length,0);
    await advance(page,59999);assert.equal((await writes(page)).length,0);await advance(page,1);
    assert.equal((await writes(page)).filter(w=>w.command==='save_viewport').length,1);
    passed('a tick during an active pan skips saving; release does not save or restart the next fixed tick');await page.close();
  }
  {
    const page=await open();await beginDrag(page,'.canvas-asset');await endDrag(page);assert.equal((await writes(page)).length,0);
    await advance(page,60000);assert.deepEqual((await writes(page)).map(w=>w.command),['save_canvas_transform']);
    passed('ordinary image release only stages geometry; the clock saves one transform');await page.close();
  }
  {
    const page=await open({group:true});await beginDrag(page,'.canvas-group-title');await advance(page,60000);assert.equal((await writes(page)).length,0);
    await endDrag(page);assert.equal((await writes(page)).length,0);await advance(page,60000);
    assert.deepEqual((await writes(page)).map(w=>w.command).sort(),['save_canvas_groups','save_canvas_layout']);
    passed('group preview skips the tick, then its completed asset/group snapshot waits until the next tick');await page.close();
  }
  {
    const page=await open();await beginDrag(page,'.asset-canvas',{pan:true});await page.keyboard.press('Escape');await endDrag(page,true);await advance(page,60000);
    assert.equal((await writes(page)).length,0);assert.equal(await page.evaluate(()=>window.uiQA.state().categories.find(c=>c.id==='c1').viewportX),30);
    passed('canceling a pan returns to acknowledged geometry and keeps the next tick clean');await page.close();
  }
  {
    const page=await open();await beginDrag(page,'.canvas-asset');await endDrag(page);
    const completed=await page.locator('.canvas-asset').first().evaluate(n=>parseFloat(n.style.left));
    await page.evaluate(()=>window.uiQA.delay(1000));await advance(page,60000);
    await beginDrag(page,'.canvas-asset',{dx:35,dy:10});await endDrag(page);await page.waitForTimeout(1100);
    assert.equal((await writes(page)).filter(w=>w.command==='save_canvas_transform').length,1);
    assert.equal((await writes(page))[0].args.assets.find(a=>a.id==='a1').x,completed);
    const latest=await page.locator('.canvas-asset').first().evaluate(n=>parseFloat(n.style.left));
    await page.evaluate(()=>window.uiQA.delay(0));await advance(page,60000);
    assert.equal((await writes(page)).filter(w=>w.command==='save_canvas_transform').length,2);
    assert.equal(await page.evaluate(()=>window.uiQA.state().assets.find(a=>a.id==='a1').x),latest);
    passed('slow automatic transform saves only the tick snapshot; a later completed edit waits for the next tick');await page.close();
  }
  {
    const page=await open({autoSave:false});assert.equal(await page.evaluate(()=>window.clockQA.state().timers.length),0);
    await beginDrag(page,'.canvas-asset');await endDrag(page);await advance(page,120000);
    assert.equal((await writes(page)).length,0);await page.getByRole('button',{name:'设置',exact:true}).click();await page.waitForTimeout(150);
    assert.match(page.url(),/assets\/w1/);assert.equal((await writes(page)).length,0);assert.ok(await page.locator('.ui-manual-save-required').isVisible());
    await manualSave(page);assert.deepEqual((await writes(page)).map(w=>w.command),['save_canvas_transform']);
    await page.getByRole('button',{name:'设置',exact:true}).click();await page.waitForSelector('.settings-layout');
    passed('manual mode has no clock and blocks dirty navigation without implicit writes; explicit save permits leaving');await page.close();
  }
  {
    const page=await open({group:true,autoSave:false});await beginDrag(page,'.canvas-group-title');await endDrag(page);
    await page.getByRole('button',{name:'设置',exact:true}).click();await page.waitForTimeout(150);assert.match(page.url(),/assets\/w1/);assert.equal((await writes(page)).length,0);
    await manualSave(page);assert.deepEqual((await writes(page)).map(w=>w.command).sort(),['save_canvas_groups','save_canvas_layout']);
    passed('manual group edits remain local when navigation is rejected, then manual save commits the completed group');await page.close();
  }
  {
    const page=await open();await beginDrag(page,'.asset-canvas',{pan:true});await endDrag(page,true);
    await page.getByRole('button',{name:'设置',exact:true}).click();await page.waitForSelector('.settings-layout');
    assert.equal((await writes(page)).filter(w=>w.command==='save_viewport').length,1);
    passed('automatic mode still safely flushes a pending viewport before navigation');await page.close();
  }
  {
    const page=await open();await page.evaluate(()=>window.uiQA.fail('save_viewport'));await beginDrag(page,'.asset-canvas',{pan:true});await endDrag(page,true);await advance(page,60000);
    await page.locator('.ui-save-error').waitFor();await page.getByRole('button',{name:'设置',exact:true}).click();await page.waitForTimeout(100);assert.match(page.url(),/assets\/w1/);
    await page.evaluate(()=>window.uiQA.fail(''));await page.locator('.ui-save-error').getByRole('button',{name:'重试保存'}).click();await page.locator('.ui-save-error').waitFor({state:'detached'});
    assert.equal(await page.evaluate(()=>window.uiQA.state().categories.find(c=>c.id==='c1').viewportX),102);
    passed('failed fixed-tick writes retain their draft, block unsafe navigation, and allow explicit retry');await page.close();
  }
  {
    const page=await open({interval:15});assert.deepEqual(await page.evaluate(()=>window.clockQA.state().timers),[{delay:15000,next:15000}]);
    await advance(page,14000);await beginDrag(page,'.asset-canvas',{pan:true});await endDrag(page,true);assert.equal((await writes(page)).length,0);await advance(page,1000);
    assert.equal((await writes(page)).filter(w=>w.command==='save_viewport').length,1);
    passed('custom 15-second setting keeps its own fixed deadline across operations');await page.close();
  }
  {
    const page=await open({group:true});await beginDrag(page,'.canvas-asset[data-asset-id="a3"]',{dx:-270,dy:-80});await endDrag(page);
    assert.equal(await page.evaluate(()=>window.uiQA.state().assets.find(a=>a.id==='a3').groupId),undefined);
    assert.equal(await page.evaluate(start=>window.uiQA.writes().slice(start).filter(w=>w.command.includes('group_member')).length,page.diagnosticStart),0);
    await advance(page,60000);assert.equal(await page.evaluate(()=>window.uiQA.state().assets.find(a=>a.id==='a3').groupId),'dg1');
    assert.deepEqual(await page.evaluate(start=>window.uiQA.writes().slice(start).filter(w=>w.command.includes('group_member')).map(w=>w.command),page.diagnosticStart),['add_canvas_group_member']);
    passed('dropping an asset into a group changes local membership immediately and writes membership only at the tick');await page.close();
  }
  {
    const page=await open({group:true,secondGroup:true});
    await page.locator('.canvas-asset[data-asset-id="a1"]').click({button:'right',position:{x:40,y:30}});
    await page.getByRole('button',{name:'移出分组',exact:true}).click();
    await beginDrag(page,'.canvas-asset[data-asset-id="a1"]',{dx:650,dy:0});await endDrag(page);
    assert.equal(await page.evaluate(()=>window.uiQA.state().assets.find(a=>a.id==='a1').groupId),'dg1');
    await advance(page,60000);
    const membership=await page.evaluate(start=>window.uiQA.writes().slice(start).filter(w=>w.command.includes('group_member')),page.diagnosticStart);
    assert.deepEqual(membership.map(w=>[w.command,w.args.groupId]),[['remove_canvas_group_member','dg1'],['add_canvas_group_member','dg2']]);
    assert.equal(await page.evaluate(()=>window.uiQA.state().assets.find(a=>a.id==='a1').groupId),'dg2');
    passed('remove then drag into a different group in one interval saves the old removal before the final membership');await page.close();
  }
  {
    const page=await open();const asset=page.locator('.canvas-asset[data-asset-id="a1"]');
    await asset.click({button:'right',position:{x:40,y:30}});await page.getByRole('button',{name:'置于顶层',exact:true}).click();
    await asset.click({button:'right',position:{x:40,y:30}});await page.getByRole('button',{name:'锁定位置',exact:true}).click();
    await page.getByRole('button',{name:'画布背景',exact:true}).click();await page.getByRole('button',{name:'白色',exact:true}).click();
    assert.equal((await writes(page)).length,0);await advance(page,60000);
    const state=await page.evaluate(()=>window.uiQA.state());assert.equal(state.assets.find(a=>a.id==='a1').locked,true);assert.equal(state.assets.find(a=>a.id==='a1').zIndex,4);assert.equal(state.categories.find(c=>c.id==='c1').canvasColor,'#ffffff');
    assert.deepEqual((await writes(page)).map(w=>w.command).sort(),['save_canvas_appearance','save_canvas_groups','save_canvas_layout']);
    passed('image lock, layer ordering and canvas background all stage their edits until the fixed tick');await page.close();
  }
  {
    const page=await open();await page.locator('.canvas-asset[data-asset-id="a1"]').click({position:{x:40,y:30}});
    await page.locator('.canvas-asset[data-asset-id="a2"]').click({modifiers:['Control'],position:{x:40,y:30}});
    await page.getByRole('button',{name:'左对齐',exact:true}).click();assert.equal((await writes(page)).length,0);await advance(page,60000);
    const state=await page.evaluate(()=>window.uiQA.state());assert.equal(state.assets.find(a=>a.id==='a1').x,state.assets.find(a=>a.id==='a2').x);
    assert.deepEqual((await writes(page)).map(w=>w.command),['save_canvas_transform']);
    passed('alignment is an in-memory edit and the fixed tick writes its complete geometry once');await page.close();
  }
  assert.deepEqual(errors,[]);passed('fixed-policy scenes have no browser page or console errors');
}finally{
  await writeFile(path.join(output,'fixed-save-policy-result.json'),JSON.stringify({checks,errors},null,2));
  await browser.close();
}
