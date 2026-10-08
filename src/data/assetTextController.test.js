import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssetTextController } from './assetTextController.js';
import { projectTextItems, splitTextItem } from './assetTextModel.js';
const item = {objectId:'text',textValue:'原文',styleType:'card',title:'标题',fontFamily:'system-ui',fontSize:16,fontWeight:400,textColor:'#ffffff',textAlign:'left',lineHeight:1.5,borderEnabled:true,borderColor:'#ffffff',borderWidth:1,borderRadius:8,backgroundColor:'#000000',backgroundOpacity:100,shadow:false,createdAt:1,x:20,y:40,width:280,height:160,zIndex:1,locked:false,groupId:null,objectType:'textBlock'};
const fixture = () => {const {element,layout}=splitTextItem(item,'a','canvas');return {elements:[element],layouts:[layout]};};
test('shared content and independent layouts survive switching; omission in another view is not deletion',async()=>{
  const writes=[];const c=createAssetTextController('a',fixture(),async(mode,changes)=>writes.push({mode,changes}));
  c.initialize('standard',{x:16,y:600});await c.flush();
  const standard=projectTextItems(c.snapshot().elements,c.snapshot().layouts,'standard');
  c.draft('standard',[{...standard[0],textValue:'更新',x:80,width:400,locked:true,groupId:'s'}]);await c.flush();
  const canvas=projectTextItems(c.snapshot().elements,c.snapshot().layouts,'canvas')[0];
  assert.equal(canvas.textValue,'更新');assert.equal(canvas.x,20);assert.equal(canvas.width,280);assert.equal(canvas.locked,false);assert.equal(canvas.groupId,null);
  assert.ok(writes.every(w=>w.changes.deleteIds.length===0));
  c.draft('standard',[]);await c.flush();assert.equal(c.snapshot().layouts.length,0);assert.deepEqual(writes.at(-1).changes.deleteIds,['text']);
});
test('slow acknowledged writes cannot replace more recent drafts and writes remain serialized',async()=>{
  let release;const wait=new Promise(r=>release=r);let active=0,max=0;const writes=[];
  const c=createAssetTextController('a',fixture(),async(mode,changes)=>{max=Math.max(max,++active);writes.push(changes);if(writes.length===1)await wait;active--;});
  c.draft('canvas',[{...item,textValue:'first'}]);const saving=c.flush();
  c.draft('canvas',[{...item,textValue:'latest'}]);c.refresh(fixture());release();await saving;
  assert.equal(max,1);assert.equal(writes.length,2);assert.equal(writes[1].updates[0].content,'latest');assert.equal(c.snapshot().elements[0].content,'latest');
});
test('failed save retains latest draft; retry does not resurrect or duplicate creates',async()=>{
  let fail=true;const writes=[];const c=createAssetTextController('a',fixture(),async(mode,changes)=>{if(fail)throw Error('disk unavailable');writes.push(changes);});
  c.draft('canvas',[{...item,textValue:'未保存'}]);await assert.rejects(c.flush(),/disk unavailable/);
  c.refresh(fixture());assert.equal(c.snapshot().elements[0].content,'未保存');assert.match(c.snapshot().error,/disk/);
  c.draft('canvas',[{...item,textValue:'重试最新内容'}]);fail=false;await c.flush();assert.equal(writes.length,1);assert.equal(writes[0].updates[0].content,'重试最新内容');assert.equal(c.snapshot().error,'');
});
test('new elements are created once and a second layout is persisted independently',async()=>{
  const writes=[];const c=createAssetTextController('a',{elements:[],layouts:[]},async(mode,changes)=>writes.push({mode,changes}));
  await c.commit('standard',[item]);c.initialize('canvas',{x:800,y:70});await c.flush();await c.flush();
  assert.equal(writes.filter(w=>w.changes.creates.length).length,1);assert.equal(writes.length,2);assert.equal(writes[1].changes.layouts[0].viewMode,'canvas');
});
test('save status distinguishes dirty draft, in-flight write, failure and acknowledgement',async()=>{
  let release;const gate=new Promise(resolve=>{release=resolve});let fail=true;const states=[];
  const controller=createAssetTextController('a',fixture(),async()=>{await gate;if(fail)throw Error('disk full')},state=>states.push(state));
  controller.draft('canvas',[{...item,textValue:'changed'}]);assert.equal(controller.snapshot().dirty,true);
  const flush=controller.flush();assert.equal(controller.snapshot().pending,true);
  release();await assert.rejects(flush,/disk full/);assert.equal(controller.snapshot().pending,false);assert.equal(controller.snapshot().dirty,true);
  fail=false;await controller.flush();assert.equal(controller.snapshot().dirty,false);assert.equal(controller.snapshot().pending,false);
  assert.equal(states.at(-1).error,'');
});
test('repeated text edits stay in memory until the fixed clock saves a snapshot',async()=>{
  const writes=[];const controller=createAssetTextController('a',fixture(),async(mode,changes)=>writes.push(changes));
  for(let n=0;n<40;n++)controller.draft('canvas',[{...item,textValue:`draft ${n}`,fontSize:16+n}]);
  assert.equal(writes.length,0);assert.equal(controller.snapshot().dirty,true);
  await controller.saveOnce();assert.equal(writes.length,1);assert.equal(writes[0].updates[0].content,'draft 39');
  assert.equal(controller.snapshot().dirty,false);
});
test('one clock tick freezes current text and leaves later edits for the next tick',async()=>{
  let release;const gate=new Promise(resolve=>{release=resolve});const writes=[];
  const controller=createAssetTextController('a',fixture(),async(mode,changes)=>{writes.push(changes);if(writes.length===1)await gate;});
  controller.draft('canvas',[{...item,textValue:'at clock tick'}]);const saving=controller.saveOnce();
  controller.draft('canvas',[{...item,textValue:'edited during write'}]);release();await saving;
  assert.equal(writes.length,1);assert.equal(writes[0].updates[0].content,'at clock tick');assert.equal(controller.snapshot().dirty,true);
  await controller.saveOnce();assert.equal(writes.length,2);assert.equal(writes[1].updates[0].content,'edited during write');
});
test('an explicit manual flush joins a clock write and drains the latest draft',async()=>{
  let release;const gate=new Promise(resolve=>{release=resolve});const writes=[];
  const controller=createAssetTextController('a',fixture(),async(mode,changes)=>{writes.push(changes);if(writes.length===1)await gate;});
  controller.draft('canvas',[{...item,textValue:'clock snapshot'}]);const tick=controller.saveOnce();
  controller.draft('canvas',[{...item,textValue:'manual latest'}]);const manual=controller.flush();release();await Promise.all([tick,manual]);
  assert.equal(writes.length,2);assert.equal(writes[1].updates[0].content,'manual latest');assert.equal(controller.snapshot().dirty,false);
});
test('a failed clock write keeps the latest draft for the next tick or explicit retry',async()=>{
  let failed=true;const writes=[];
  const controller=createAssetTextController('a',fixture(),async(mode,changes)=>{if(failed)throw Error('disk full');writes.push(changes);});
  controller.draft('canvas',[{...item,textValue:'first'}]);await assert.rejects(controller.saveOnce(),/disk full/);
  controller.draft('canvas',[{...item,textValue:'newest'}]);failed=false;await controller.saveOnce();
  assert.equal(writes.length,1);assert.equal(writes[0].updates[0].content,'newest');assert.equal(controller.snapshot().error,'');
});
test('inner object geometry is drafted without writes and cancellation restores a clean state',async()=>{
  const object={objectId:'sample',objectType:'sample',x:50,y:60,width:200,height:150};const writes=[];
  const controller=createAssetTextController('a',fixture(),async(mode,changes)=>writes.push(changes));
  controller.seedInnerObjects('canvas',[object]);controller.draft('canvas',[item],[{...object,x:90}]);
  assert.equal(writes.length,0);assert.equal(controller.snapshot().dirty,true);
  controller.draft('canvas',[item],[object]);assert.equal(controller.snapshot().dirty,false);
  await controller.saveOnce();assert.equal(writes.length,0);
});
test('derived first-view layouts are clean until a real edit and do not force a read-only save',async()=>{
  const writes=[];const controller=createAssetTextController('a',fixture(),async(mode,changes)=>writes.push(changes));
  controller.initialize('standard',{x:16,y:600});assert.equal(controller.snapshot().dirty,false);
  const projected=projectTextItems(controller.snapshot().elements,controller.snapshot().layouts,'standard');
  controller.draft('standard',projected);assert.equal(controller.snapshot().dirty,false);
  await controller.saveOnce();assert.equal(writes.length,0);
  controller.draft('standard',[{...projected[0],textValue:'real edit'}]);assert.equal(controller.snapshot().dirty,true);
  await controller.saveOnce();assert.equal(writes.length,1);assert.equal(writes[0].layouts[0].viewMode,'standard');
  controller.draft('standard',[{...projected[0],textValue:'real edit',x:80}]);await controller.saveOnce();
  controller.draft('standard',[{...projected[0],textValue:'real edit'}]);assert.equal(controller.snapshot().dirty,true);
});
