import test from 'node:test';
import assert from 'node:assert/strict';
import { axisSnapPreview,imageCenter,imageCorners } from './canvasAxisGeometry.js';
import { createCanvasFrameQueue } from './canvasFrameQueue.js';
import { readGridPreference } from './canvasSnapPreferences.js';
import { objectToWorld,snapMove,boundsOf } from './canvasTransforms.js';
const item=(id,x=0,y=0,width=100,height=80)=>({id,x,y,width,height,rotation:0,kind:'asset',imageHeight:height-32});
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('axis center and image corners exclude caption, rotating about the full card center',()=>{
 const a={...item('a',40,60),rotation:30};const expected=objectToWorld({x:90,y:84},a),center=imageCenter(a);close(center.x,expected.x);close(center.y,expected.y);assert.equal(imageCorners(a).length,4);
});
for(const zoom of [.1,.51,1,3])for(const uiScale of [.75,1,1.5])test(`six image anchors preview and hysteresis ${zoom}/${uiScale}`,()=>{
 const scale=zoom*uiScale,ref=item('r',250/scale,300/scale),a=item('a',0,0,100/scale,80/scale+32),origin=imageCenter(ref);
 for(const axis of ['x','y'])for(const anchor of [0,1,2]){
   const length=axis==='x'?a.width:a.imageHeight,offset=[length/2,0,length][anchor],delta={x:-100000,y:-100000};delta[axis]=origin[axis]-offset-9/scale;
   const result=axisSnapPreview(a,ref,delta,{zoom,uiScale});assert.ok(result.preview);close(result.preview[axis]-a[axis]-delta[axis],9/scale);
   const further={...delta,[axis]:delta[axis]-6/scale},retained=axisSnapPreview(a,ref,further,{zoom,uiScale,previous:result.active});assert.ok(retained.preview);close(retained.correction[axis],15/scale);
   const outside=axisSnapPreview(a,ref,{...delta,[axis]:delta[axis]-1000/scale},{zoom,uiScale,previous:result.active});assert.equal(outside.preview,null);
 }
});
test('preview supports both axes, Alt and self-reference, without changing source geometry',()=>{
 const a=item('a'),r=item('r',250,300),before=structuredClone(a),delta={x:253.125,y:302.75};
 const result=axisSnapPreview(a,r,delta);assert.deepEqual(a,before);assert.deepEqual(Object.keys(result.active),['x','y']);close(result.preview.x,250);close(result.preview.y,300);
 assert.equal(axisSnapPreview(a,r,delta,{alt:true}).preview,null);assert.equal(axisSnapPreview(a,r,delta,{enabled:false}).preview,null);assert.equal(axisSnapPreview(a,a,delta).preview,null);
});
test('rotated image extrema produce an axis preview while full-card size and angle are retained',()=>{
 const a={...item('a'),rotation:37},r=item('r',250,300),points=imageCorners(a),right=Math.max(...points.map(p=>p.x));const delta={x:imageCenter(r).x-right-5,y:-1000};
 const result=axisSnapPreview(a,r,delta);close(result.correction.x,5);assert.equal(result.preview.rotation,37);assert.equal(result.preview.height,80);
});
test('latest frame queue coalesces burst, flushes last release, and discards cancelled work',()=>{
 const frames=new Map(),calls=[];let id=0;const queue=createCanvasFrameQueue(e=>calls.push(e),cb=>{frames.set(++id,cb);return id;},key=>frames.delete(key));
 for(let n=0;n<100;n++)queue.push(n+1);assert.equal(frames.size,1);assert.equal(calls.length,0);const cb=frames.values().next().value;frames.clear();cb();assert.deepEqual(calls,[100]);
 queue.push(101);queue.flush(102);assert.deepEqual(calls,[100,102]);assert.equal(frames.size,0);queue.push(103);queue.clear();assert.equal(frames.size,0);assert.equal(calls.length,2);
});
test('one-time grid preference reset preserves later explicit opt-in and smart preference',()=>{
 const map=new Map([['canvas-transform-grid','true'],['canvas-transform-smart','false']]),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};
 assert.equal(readGridPreference(storage),false);map.set('canvas-transform-grid','true');assert.equal(readGridPreference(storage),true);assert.equal(map.get('canvas-transform-smart'),'false');
});
test('fractional free movement remains exact and cached targets retain ordinary 6/10px magnetic behavior',()=>{
 const a=item('a'),r=item('r',300),cachedBounds=[{...boundsOf(r),id:r.id}];
 for(let n=1;n<=20;n++){const delta={x:n*.137,y:n*.081},result=snapMove([a],[],delta,{smart:false,grid:false});close(result.x,delta.x);close(result.y,delta.y);}
 const entered=snapMove([a],[],{x:195,y:0},{cachedBounds});close(entered.x,200);const held=snapMove([a],[],{x:191,y:0},{cachedBounds,previous:entered.active});close(held.x,200);
 const released=snapMove([a],[],{x:187,y:13},{cachedBounds,previous:held.active});close(released.x,187);const alt=snapMove([a],[],{x:195,y:0},{cachedBounds,alt:true});close(alt.x,195);
});
test('single-image ordinary snapping can exclude equal-gap candidates while existing multi-object defaults remain',()=>{
 const a=item('a'),targets=[item('r'),item('s',200)];
 close(snapMove([a],targets,{x:405,y:0}).x,400);
 close(snapMove([a],targets,{x:405,y:0},{includeGaps:false}).x,405);
});
