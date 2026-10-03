import test from 'node:test';
import assert from 'node:assert/strict';
import {createCategoryTextController} from './categoryText.js';
import {projectTextItems} from './assetTextModel.js';

const item={objectId:'outer',objectType:'textBlock',textValue:'分类说明',styleType:'card',title:'',fontFamily:'system-ui',fontSize:16,fontWeight:400,textColor:'#ffffff',textAlign:'left',lineHeight:1.5,borderEnabled:true,borderColor:'#ffffff',borderWidth:1,borderRadius:8,backgroundColor:'#000000',backgroundOpacity:100,shadow:false,createdAt:1,x:20,y:-40,width:280,height:160,zIndex:1,locked:false,groupId:null};
test('outer changes carry category ownership and explicit deletes, without asset layouts',async()=>{
  const writes=[],c=createCategoryTextController('category',[],async changes=>writes.push(changes));
  await c.commit('canvas',[item]);await c.flush();
  assert.equal(writes.length,1);assert.equal(writes[0].upserts[0].categoryId,'category');assert.equal(writes[0].upserts[0].y,-40);
  assert.ok(!('assetId' in writes[0].upserts[0]));
  await c.commit('canvas',[]);assert.deepEqual(writes[1],{upserts:[],deleteIds:['outer']});
});
test('slow or failed outer writes keep latest content and position until retry',async()=>{
  let release;const waiting=new Promise(r=>release=r),writes=[];let fail=false;
  const c=createCategoryTextController('category',[],async changes=>{if(!writes.length)await waiting;if(fail)throw Error('locked');writes.push(changes);});
  const saving=c.commit('canvas',[item]);c.draft('canvas',[{...item,textValue:'新草稿',x:80}]);release();await saving;
  assert.equal(writes.length,2);assert.equal(writes[1].upserts[0].content,'新草稿');assert.equal(writes[1].upserts[0].x,80);
  fail=true;await assert.rejects(c.commit('canvas',[{...item,textValue:'重试内容',x:100}]),/locked/);
  assert.equal(projectTextItems(c.snapshot().elements,c.snapshot().layouts,'canvas')[0].textValue,'重试内容');
  fail=false;await c.flush();assert.equal(writes.at(-1).upserts[0].content,'重试内容');
});
test('mixed geometry transactions carry pending text edits and serialize newer geometry; retry is atomic',async()=>{
 const writes=[],regular=[];let fail=true;
 const c=createCategoryTextController('category',[],async changes=>regular.push(changes));
 c.draft('canvas',[{...item,rotation:30}]);
 const persist=async batch=>{if(fail)throw Error('locked');writes.push(batch);};
 await assert.rejects(c.commitGeometry({assets:[{id:'asset',x:80,rotation:30}]},persist),/locked/);
 assert.equal(regular.length,0);assert.equal(projectTextItems(c.snapshot().elements,c.snapshot().layouts,'canvas')[0].rotation,30);
 fail=false;await c.flush();assert.equal(writes[0].textChanges.upserts[0].rotation,30);assert.equal(writes[0].assets[0].x,80);assert.equal(regular.length,0);
 await c.commitGeometry({assets:[{id:'asset',x:100}]},persist);assert.equal(writes.length,2);assert.equal(writes[1].textChanges.upserts.length,0);
});
