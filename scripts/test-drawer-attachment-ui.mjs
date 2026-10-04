import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
const {chromium}=createRequire(import.meta.url)('playwright');
const output=path.resolve(process.argv[2]);mkdirSync(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1920,height:1200}}),checks=[],errors=[];
page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(15000);
const push=checks.push.bind(checks);checks.push=(message)=>{console.log('PASS '+message);return push(message);};
console.log('attachment browser launched');
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const note=()=>page.locator('article[data-drawer-id="attachment-note"]');
const saved=()=>page.evaluate(()=>window.drawerQA.getStored().find(d=>d.id==='attachment-note'));
const waitOwner=id=>page.waitForFunction(id=>window.drawerQA.getStored().find(d=>d.id==='attachment-note')?.assetId===id,id);
const settle=()=>page.waitForTimeout(350);
async function seed(extra={},other=[]){
 await page.evaluate(({extra,other})=>{
  window.drawerQA.saveDelay=0;window.drawerQA.failNext=false;
  const image=window.drawerQA.getAssets()[0]?.previewUrl;
  window.drawerQA.setAssets([{id:'a',name:'左侧多视图',categoryId:'qa',workspaceId:'qa',x:300,y:300,width:400,height:300,tags:[],previewUrl:image,zIndex:1,locked:false},
    {id:'b',name:'右侧正面',categoryId:'qa',workspaceId:'qa',x:1100,y:300,width:400,height:300,tags:[],previewUrl:image,zIndex:2,locked:false}]);
  window.drawerQA.seed([{id:'attachment-note',assetId:'a',categoryId:'qa',text:'跑的多视图\n中文备注',mode:'docked-expanded',side:'left',offset:75,width:240,height:150,textScale:1.8,floatingX:0,floatingY:0,orderIndex:0,locked:false,styleVariant:'default',createdAt:1,updatedAt:1,...extra},...other]);
  window.drawerQA.setZoom(1);
 },{extra,other});
 await note().waitFor();await settle();
}
const open=()=>note().locator('.asset-note-attachment-title').click();
async function choose(name){await open();await page.getByRole('dialog',{name:'选择附属资产'}).getByRole('button',{name,exact:true}).click();await settle();}
async function dragCenter(center,{cancel=false,detach=true}={}){
 const panel=await note().boundingBox(),grip=await note().getByRole('button',{name:'文字缩放',exact:true}).boundingBox();
 const x=grip.x+grip.width/2,y=grip.y+grip.height/2,dx=x-panel.x,dy=y-panel.y;
 await page.mouse.move(x,y);await page.mouse.down();
 if(detach)await page.mouse.move(x-80,y,{steps:6});
 await page.mouse.move(center.x-panel.width/2+dx,center.y-panel.height/2+dy,{steps:12});
 if(cancel)await page.keyboard.press('Escape');
 const preview=await page.locator('.asset-note-drop-placeholder').getAttribute('data-target-asset-id').catch(()=>null);
 await page.mouse.up();await settle();return preview;
}
try{
 await page.goto(process.env.DRAWER_QA_URL||'http://127.0.0.1:5187/scripts/drawer-qa.html');await page.waitForFunction(()=>window.drawerQA?.seed);await seed();
 assert.match(await note().locator('.asset-note-attachment-title').innerText(),/左侧多视图/);
 await note().locator('.asset-note-attachment-title').focus();await page.keyboard.press('Enter');
 await page.getByLabel('搜索附属资产').fill('正面');assert.equal(await page.getByRole('button',{name:'左侧多视图',exact:true}).count(),0);
 await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
 checks.push('标题归属明确；键盘打开、搜索过滤与 Escape 关闭');
 await note().locator('.asset-note-drawer-text').dblclick();await note().getByLabel('备注内容').fill('切换时仍在编辑的中文末字');
 await choose('右侧正面');await waitOwner('b');assert.equal((await saved()).text,'切换时仍在编辑的中文末字');assert.equal((await saved()).textScale,1.8);
 assert.match(await note().locator('.asset-note-attachment-title').innerText(),/右侧正面/);
 checks.push('编辑过程中选择另一资产，归属、文字、尺寸和比例一起保存');
 const before=await note().boundingBox();await choose('无（独立备注）');await waitOwner(null);
 const after=await note().boundingBox();assert.ok(Math.abs(before.x-after.x)<1&&Math.abs(before.y-after.y)<1);
 assert.equal(await note().getAttribute('data-mode'),'floating');assert.equal(await note().locator('.asset-note-drawer-resize').count(),4);
 checks.push('选择无变成独立备注，位置不跳动且保留四角缩放');
 await page.evaluate(()=>window.drawerQA.setAssets([]));await settle();assert.equal(await note().count(),1);assert.equal((await saved()).assetId,null);
 await page.reload();await note().waitFor();assert.equal((await saved()).text,'切换时仍在编辑的中文末字');
 checks.push('没有资产的画布依然显示独立备注，刷新恢复文字和归属');
 await seed();const original=await saved();
 const preview=await dragCenter({x:1660,y:450});assert.equal(preview,'b');await waitOwner('b');assert.equal((await saved()).side,'right');assert.equal((await saved()).text,original.text);
 checks.push('真实鼠标跨图吸附，预览与落点资产一致，松手后归属转移');
 await seed();await dragCenter({x:1660,y:450},{cancel:true});assert.deepEqual(await saved(),original);
 checks.push('跨图预览中 Escape 取消完整恢复原归属和位置');
 await seed();await dragCenter({x:1000,y:950});assert.equal((await saved()).assetId,'a');assert.equal((await saved()).mode,'floating');
 checks.push('拖到空白处保持原资产归属，悬浮后不误转为独立备注');
 const full=[0,1,2].map(i=>({...original,id:'full-'+i,assetId:'b',mode:'floating',floatingX:20,floatingY:700+i*160}));
 await seed({},full);await choose('右侧正面');assert.equal((await saved()).assetId,'a');assert.match(await page.getByRole('status').innerText(),/3 个/);await page.keyboard.press('Escape');
 assert.equal(await dragCenter({x:1660,y:450}),null);assert.equal((await saved()).assetId,'a');
 checks.push('目标三个备注满额时，下拉与拖动都拒绝转入并说明原因');
 await seed({locked:true});assert.equal(await note().locator('.asset-note-attachment-title').isDisabled(),true);await dragCenter({x:1660,y:450});assert.equal((await saved()).assetId,'a');
 checks.push('锁定备注不能换归属或跨资产拖动');
 await seed();await page.evaluate(()=>{window.drawerQA.failNext=true;});await choose('右侧正面');assert.equal((await saved()).assetId,'a');assert.match(await note().locator('.asset-note-attachment-title').innerText(),/左侧多视图/);await page.keyboard.press('Escape');
 checks.push('模拟保存失败回滚归属与布局，正文保留');
 await seed();await page.evaluate(()=>{window.drawerQA.saveDelay=500;});await note().locator('.asset-note-drawer-text').dblclick();await note().getByLabel('备注内容').fill('延迟文字保存');await note().getByLabel('备注内容').press('Escape');await choose('右侧正面');await waitOwner('b');await page.waitForTimeout(800);assert.equal((await saved()).assetId,'b');assert.equal((await saved()).text,'延迟文字保存');
 checks.push('延迟文字保存与归属切换顺序执行，旧响应不覆盖新归属');
 for(const [side,center] of [['left',{x:920,y:450}],['right',{x:1660,y:450}],['top',{x:1300,y:180}],['bottom',{x:1300,y:730}]]){
  await seed({mode:'floating',assetId:null,floatingX:500,floatingY:800});await dragCenter(center,{detach:false});await waitOwner('b');assert.equal((await saved()).side,side);
 }
 checks.push('独立备注可吸到另一个资产的左、右、上、下四边');
 await seed({mode:'floating',assetId:null,floatingX:300,floatingY:760});await page.evaluate(()=>{window.drawerQA.setAssets(window.drawerQA.getAssets().map(a=>a.id==='b'?{...a,rotation:90}:a));});await settle();
 // b's frame center is (1300,466); its local right-center (1660,450)
 // rotates to (1316,826). This point is outside its rotated image.
 await dragCenter({x:1316,y:826},{detach:false});await waitOwner('b');assert.equal((await saved()).side,'right');await settle();
 await page.screenshot({path:path.join(output,'rotated-attachment.png')});checks.push('旋转资产吸附使用目标本地坐标，真实落点正确');
 await seed({mode:'floating',assetId:null,floatingX:400,floatingY:700});
 for(const zoom of [.5,1,1.6]){await page.evaluate(z=>window.drawerQA.setZoom(z),zoom);await settle();await open();assert.equal(await page.getByLabel('搜索附属资产').isVisible(),true);await page.keyboard.press('Escape');}
 await page.evaluate(()=>document.documentElement.dataset.effectiveTheme='light');await open();assert.equal(await page.getByRole('dialog').evaluate(el=>getComputedStyle(el).overflowX),'visible');await page.screenshot({path:path.join(output,'light-selector.png')});await page.keyboard.press('Escape');
 checks.push('不同缩放与亮色主题下选择器可打开、关闭并保持可读');
 await seed({mode:'floating',assetId:null,floatingX:400,floatingY:700});await page.mouse.click(1820,970,{button:'right'});await page.getByRole('button',{name:'添加独立备注',exact:true}).click();await page.waitForFunction(()=>window.drawerQA.getStored().length===2);assert.equal((await page.evaluate(()=>window.drawerQA.getStored().find(d=>d.id!=='attachment-note'))).assetId,null);
 checks.push('空白处右键添加独立备注，立即可编辑并正确保存分类');
 await page.screenshot({path:path.join(output,'independent-notes.png')});assert.deepEqual(errors,[]);
 writeFileSync(path.join(output,'result.json'),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}catch(e){await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});writeFileSync(path.join(output,'failure.json'),JSON.stringify({checks,errors,error:e.stack},null,2));throw e;}finally{await browser.close();}
