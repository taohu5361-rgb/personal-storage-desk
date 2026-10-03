import test from 'node:test';
import assert from 'node:assert/strict';
import {boundsOf,cornersOf,objectToWorld,worldToObject,intersectsRotated,resizeRotated,arrangeObjects,snapMove,rotationFromPointer} from './canvasTransforms.js';
import {resizeInnerObject} from './innerCanvasGeometry.js';
const item=(id,x=0,y=0,width=100,height=80,rotation=0)=>({id,x,y,width,height,rotation});
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('rotated points roundtrip and SAT rejects empty bounding-box corners',()=>{
 const a=item('a',0,0,100,100,45),b=boundsOf(a);close(b.left,50-50*Math.SQRT2);
 const p={x:91,y:-42},r=worldToObject(objectToWorld(p,a),a);close(r.x,p.x);close(r.y,p.y);
 assert.equal(intersectsRotated({left:b.left,top:b.top,right:b.left+5,bottom:b.top+5},a),false);
 assert.equal(intersectsRotated({left:45,top:45,right:55,bottom:55},a),true);
});
for(const angle of [-135,-45,0,30,90])for(const corner of ['nw','ne','sw','se'])test(`rotated resize fixes opposite corner ${angle}/${corner}`,()=>{
 const a={...item('a',-35,20,200,120,angle),objectType:'sample'},b=resizeRotated(a,corner,{x:50,y:40},resizeInnerObject);
 const index={nw:2,ne:3,sw:1,se:0}[corner],old=cornersOf(a)[index],next=cornersOf(b)[index];close(old.x,next.x);close(old.y,next.y);close(b.width/b.height,a.width/a.height);
});
test('symmetry has equal edge gaps, retains angle and does not move reference',()=>{
 const r=item('r',100,100,160,120,20),a=item('a',30,50,80,60,40),b=item('b',500,50,140,90,-30);
 const [left,right]=arrangeObjects([a,b],'symmetry-x',r,24),rb=boundsOf(r);close(rb.left-boundsOf(left).right,24);close(boundsOf(right).left-rb.right,24);close(left.y+left.height/2,r.y+r.height/2);assert.equal(left.rotation,a.rotation);assert.equal(r.x,100);
 assert.deepEqual(arrangeObjects([{...a,locked:true},b],'symmetry-x',r),[{...a,locked:true},b]);
});
test('equal gaps with unequal widths fix the two endpoints',()=>{
 const a=item('a',0,0,80),b=item('b',200,20,100),c=item('c',500,40,160);const result=arrangeObjects([c,a,b],'distribute-x');assert.deepEqual(result[0],c);assert.deepEqual(result[1],a);close(result[2].x-a.x-a.width,c.x-result[2].x-result[2].width);
});
for(const zoom of [.1,.51,1,5])for(const uiScale of [.75,1,1.5])test(`snap screen thresholds and hysteresis ${zoom}/${uiScale}`,()=>{
 const a=item('a'),t=item('t',300),scale=zoom*uiScale;
 const enter=snapMove([a],[t],{x:200-5/scale,y:0},{zoom,uiScale});close(enter.x,200);assert.ok(enter.active.x);
 const retained=snapMove([a],[t],{x:200-9/scale,y:0},{zoom,uiScale,previous:enter.active});close(retained.x,200);
 const free=snapMove([a],[t],{x:200-9/scale,y:0},{zoom,uiScale,alt:true,previous:enter.active});close(free.x,200-9/scale);assert.equal(free.guides.length,0);
});
test('moving a selection preserves offsets and targets equal gaps and fixed world grid',()=>{
 const a=item('a',0,0,40,40),b=item('b',50,50,40,40),t=item('t',300,200);const s=snapMove([a,b],[t],{x:207,y:0});close(s.x,210);
 const spaced=snapMove([item('m',0,0,30,80)],[item('a',0,0,100),item('b',124,0,100)],{x:247,y:0});close(spaced.x,248);assert.ok(spaced.guides.some(g=>g.kind==='gap'));
 const grid=snapMove([a],[],{x:61,y:0},{smart:false,grid:true});close(grid.x,64);
});
test('rotation crosses +/-180 continuously and Shift rounds absolute angle to 15 degrees',()=>{
 const a=item('a',0,0,100,100,10),p=deg=>({x:50+100*Math.cos(deg*Math.PI/180),y:50+100*Math.sin(deg*Math.PI/180)});
 close(rotationFromPointer(a,p(170),p(-170)),30);close(rotationFromPointer(a,p(0),p(28),true),45);
});
