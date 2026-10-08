import test from 'node:test';
import assert from 'node:assert/strict';
import {createFixedAutoSave,normalizeSaveInterval} from './fixedAutoSave.js';

const fakeClock=()=>{
  let time=0,id=0;const timers=new Map();
  return {setIntervalFn(fn,delay){timers.set(++id,{fn,delay,next:time+delay});return id;},clearIntervalFn:key=>timers.delete(key),
    advance(ms){const end=time+ms;for(;;){const next=[...timers.values()].sort((a,b)=>a.next-b.next)[0];if(!next||next.next>end)break;time=next.next;next.next+=next.delay;next.fn();}time=end;},count:()=>timers.size};
};
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('one-minute cadence stays fixed across repeated operations and callback completion',async()=>{
  const clock=fakeClock();let ticks=0;const saver=createFixedAutoSave({...clock,seconds:60,onTick:()=>{ticks++;}});
  saver.start();clock.advance(30000);assert.equal(ticks,0);
  for(let n=0;n<29;n++){clock.advance(1000);await settle();}
  assert.equal(ticks,0);clock.advance(1000);await settle();assert.equal(ticks,1);
  clock.advance(60000);await settle();assert.equal(ticks,2);saver.stop();assert.equal(clock.count(),0);
});
test('disabled or stopped clock never saves and starting twice creates one timer',async()=>{
  const clock=fakeClock();let ticks=0;const saver=createFixedAutoSave({...clock,onTick:()=>{ticks++;}});
  clock.advance(120000);assert.equal(ticks,0);saver.start();saver.start();assert.equal(clock.count(),1);
  saver.stop();clock.advance(120000);await settle();assert.equal(ticks,0);
});
test('a slow save skips overlapping fixed ticks without adding a catch-up save',async()=>{
  const clock=fakeClock();let ticks=0,release;const gate=new Promise(resolve=>{release=resolve;});
  const saver=createFixedAutoSave({...clock,onTick:async()=>{ticks++;if(ticks===1)await gate;}});
  saver.start();clock.advance(180000);assert.equal(ticks,1);release();await settle();assert.equal(ticks,1);
  clock.advance(60000);await settle();assert.equal(ticks,2);saver.stop();
});
test('custom interval uses seconds with a safe one-minute fallback',()=>{
  assert.equal(normalizeSaveInterval(300),300);assert.equal(normalizeSaveInterval('120'),120);
  for(const value of [undefined,0,4,3601,NaN])assert.equal(normalizeSaveInterval(value),60);
});
