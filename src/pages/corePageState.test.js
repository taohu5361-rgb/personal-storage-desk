import test from 'node:test';
import assert from 'node:assert/strict';
import { createDraftLeaveGuard, filterScripts } from './corePageState.js';
import { createNavigationController } from '../hooks/navigationState.js';

test('script search uses real current-category records and handles missing fields',()=>{
  const scripts=[{id:'a',name:'启动',filePath:'D:\\中文\\run.ps1'},{id:'b',name:'另一个',launchCommand:'python server.py'},{id:'c'}];
  assert.deepEqual(filterScripts(scripts,'中文').map(s=>s.id),['a']);
  assert.deepEqual(filterScripts(scripts,'PYTHON').map(s=>s.id),['b']);
  assert.equal(filterScripts(scripts,'  ').length,3);
});

test('repeated dirty navigation requests share a decision and cancellation retains the draft',async()=>{
  let dirty=true,requests=0;
  const guard=createDraftLeaveGuard({isDirty:()=>dirty,isSaving:()=>false,onRequest:()=>requests++,onAccept:()=>{dirty=false;}});
  const one=guard.request(),two=guard.request();assert.equal(one,two);assert.equal(requests,1);
  guard.resolve(false);assert.equal(await one,false);assert.equal(dirty,true);
  const retry=guard.request();guard.resolve(true);assert.equal(await retry,true);assert.equal(dirty,false);
});

test('dirty guard rejects navigation on cancellation and accepts the target only after discard',async()=>{
  let path='add-example/w/a?inner=1&centerX=20&centerY=30',dirty=true;
  const guard=createDraftLeaveGuard({isDirty:()=>dirty,isSaving:()=>false,onRequest:()=>{},onAccept:()=>{dirty=false;}});
  const navigation=createNavigationController({initialPath:path,readPath:()=>path,writePath:next=>{path=next;},commit:()=>{},flush:async()=>await guard.request()});
  const first=navigation.go('settings');guard.resolve(false);assert.equal(await first,false);assert.match(path,/inner=1/);
  const second=navigation.go('asset/w/a');guard.resolve(true);assert.equal(await second,true);assert.equal(path,'asset/w/a');
});

test('saving prevents early navigation and disposal resolves outstanding close requests',async()=>{
  let saving=true;
  const guard=createDraftLeaveGuard({isDirty:()=>true,isSaving:()=>saving,onRequest:()=>{}});
  await assert.rejects(guard.request(),/正在保存/);saving=false;
  const pending=guard.request();guard.dispose();assert.equal(await pending,false);
});
