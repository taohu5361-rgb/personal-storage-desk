import test from 'node:test';
import assert from 'node:assert/strict';
import { createLatestValueSave } from './latestValueSave.js';

const fakeClock = () => {
  const jobs = new Map(); let id = 0;
  return {setTimer:job=>{jobs.set(++id,job);return id},clearTimer:key=>jobs.delete(key),
    fire(){const list=[...jobs.values()];jobs.clear();for(const job of list)job()},count:()=>jobs.size};
};
const settle = () => new Promise(resolve=>setImmediate(resolve));
test('many viewport previews stay in memory, release saves exactly the latest one', async () => {
  const writes=[], clock=fakeClock(), saver=createLatestValueSave(value=>writes.push(value),clock);
  for(let x=0;x<36;x++)saver.draft({x,y:x/2},{schedule:false});
  assert.equal(clock.count(),0);assert.equal(writes.length,0);
  await saver.flush();assert.deepEqual(writes,[{x:35,y:17.5}]);
  await saver.flush();assert.equal(writes.length,1);assert.equal(saver.snapshot().dirty,false);
});
test('wheel bursts debounce and navigation flushes without waiting for the timer', async () => {
  const writes=[],clock=fakeClock(),saver=createLatestValueSave(value=>writes.push(value),clock);
  for(let zoom=1;zoom<30;zoom++)saver.draft({zoom});
  assert.equal(clock.count(),1);assert.equal(writes.length,0);
  await saver.flush();assert.deepEqual(writes,[{zoom:29}]);assert.equal(clock.count(),0);
});
test('a slow in-flight write is followed only by the newest settled snapshot', async () => {
  const writes=[],clock=fakeClock();let release;
  const gate=new Promise(resolve=>{release=resolve});
  const saver=createLatestValueSave(async value=>{writes.push(value);if(writes.length===1)await gate},clock);
  saver.draft({x:1});clock.fire();await settle();
  saver.draft({x:2});saver.draft({x:3});clock.fire();
  assert.deepEqual(writes,[{x:1}]);release();await saver.flush();assert.deepEqual(writes,[{x:1},{x:3}]);
});
test('a failed latest viewport blocks leaving, and explicit retry retains that draft', async () => {
  const writes=[];let failed=true;
  const saver=createLatestValueSave(async value=>{writes.push(value);if(failed)throw Error('disk full')});
  saver.draft({x:200},{schedule:false});
  await assert.rejects(saver.flush(),/disk full/);assert.equal(saver.snapshot().dirty,true);
  await assert.rejects(saver.flush(),/disk full/);assert.equal(writes.length,1);
  failed=false;await saver.retry();assert.deepEqual(writes,[{x:200},{x:200}]);assert.equal(saver.snapshot().error,'');
});
test('identical values do not create additional writes', async () => {
  const writes=[];const saver=createLatestValueSave(value=>writes.push(value));
  saver.draft({x:1});await saver.flush();saver.draft({x:1});await saver.flush();assert.equal(writes.length,1);
});
test('canceling an unsaved pan back to the acknowledged initial view writes nothing', async () => {
  const writes=[];const saver=createLatestValueSave(value=>writes.push(value));
  saver.seed({x:80,y:70});saver.draft({x:250,y:120},{schedule:false});
  saver.draft({x:80,y:70},{schedule:false});await saver.flush();assert.equal(writes.length,0);
});
test('returning to an acknowledged view after a failure clears stale errors without another write', async () => {
  const writes=[],notifications=[];
  const saver=createLatestValueSave(value=>{writes.push(value);throw Error('offline')},{notify:state=>notifications.push(state)});
  saver.seed({x:80});saver.draft({x:250},{schedule:false});await assert.rejects(saver.flush(),/offline/);
  saver.draft({x:80},{schedule:false});await saver.flush();
  assert.deepEqual(saver.snapshot(),{dirty:false,pending:false,error:''});
  assert.deepEqual(notifications.at(-1),saver.snapshot());await saver.retry();
  assert.deepEqual(notifications.at(-1),saver.snapshot());assert.equal(writes.length,1);
});
test('a fixed tick writes one frozen view and does not chase later edits', async () => {
  const writes=[];let release;const gate=new Promise(resolve=>{release=resolve});
  const saver=createLatestValueSave(async value=>{writes.push(value);if(writes.length===1)await gate;});
  saver.draft({x:1},{schedule:false});const saving=saver.saveOnce();await settle();
  saver.draft({x:2},{schedule:false});release();await saving;await settle();
  assert.deepEqual(writes,[{x:1}]);assert.equal(saver.snapshot().dirty,true);
  await saver.saveOnce();assert.deepEqual(writes,[{x:1},{x:2}]);
});
