// Pure geometry shared by both canvas surfaces. All distances here are world units.
import { validScale } from './innerCanvasGeometry.js';
export const geometryFields = ['x','y','width','height','rotation'];
export const objectId = item => item.objectId || item.id;
export const geometry = item => Object.fromEntries(geometryFields.map(k => [k, k === 'rotation' ? item[k] || 0 : item[k]]));
export const normalizeRotation = angle => ((angle + 180) % 360 + 360) % 360 - 180;
export function rotateVector(point, degrees) {
  const a = degrees * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  return {x:point.x*c-point.y*s,y:point.x*s+point.y*c};
}
export const centerOf = item => ({x:item.x+item.width/2,y:item.y+item.height/2});
export function worldToObject(point, item) {
  const c=centerOf(item), p=rotateVector({x:point.x-c.x,y:point.y-c.y},-(item.rotation || 0));
  return {x:p.x+c.x,y:p.y+c.y};
}
export function objectToWorld(point, item) {
  const c=centerOf(item), p=rotateVector({x:point.x-c.x,y:point.y-c.y},item.rotation || 0);
  return {x:p.x+c.x,y:p.y+c.y};
}
export function cornersOf(item) {
  return [{x:item.x,y:item.y},{x:item.x+item.width,y:item.y},{x:item.x+item.width,y:item.y+item.height},{x:item.x,y:item.y+item.height}].map(p=>objectToWorld(p,item));
}
export function boundsOf(item) {
  const ps=cornersOf(item),xs=ps.map(p=>p.x),ys=ps.map(p=>p.y);
  return {left:Math.min(...xs),right:Math.max(...xs),top:Math.min(...ys),bottom:Math.max(...ys)};
}
export function unionBounds(items) {
  const bs=items.map(boundsOf);
  return {left:Math.min(...bs.map(b=>b.left)),right:Math.max(...bs.map(b=>b.right)),top:Math.min(...bs.map(b=>b.top)),bottom:Math.max(...bs.map(b=>b.bottom))};
}
// Separating-axis intersection avoids selecting the empty AABB corners of a rotated card.
export function intersectsRotated(box,item) {
  const a=cornersOf(item),b=[{x:box.left,y:box.top},{x:box.right,y:box.top},{x:box.right,y:box.bottom},{x:box.left,y:box.bottom}];
  for(const poly of [a,b]) for(let n=0;n<2;n++) {
    const p=poly[n],q=poly[n+1],axis={x:-(q.y-p.y),y:q.x-p.x};
    const ap=a.map(p=>p.x*axis.x+p.y*axis.y),bp=b.map(p=>p.x*axis.x+p.y*axis.y);
    if(Math.max(...ap)<Math.min(...bp)-1e-8 || Math.max(...bp)<Math.min(...ap)-1e-8)return false;
  }
  return true;
}
export function rotationFromPointer(item,start,current,shift=false) {
  const c=centerOf(item),angle=p=>Math.atan2(p.y-c.y,p.x-c.x)*180/Math.PI;
  const value=(item.rotation || 0)+normalizeRotation(angle(current)-angle(start));
  return normalizeRotation(shift?Math.round(value/15)*15:value);
}
export function resizeRotated(item,corner,worldDelta,resize) {
  const d=rotateVector(worldDelta,-(item.rotation || 0));
  const next=resize(item,corner,d.x,d.y);
  const anchor=o=>({x:o.x+(corner.includes('w')?o.width:0),y:o.y+(corner.includes('n')?o.height:0)});
  const oldAnchor=objectToWorld(anchor(item),item),newAnchor=objectToWorld(anchor(next),next);
  return {...next,x:next.x+oldAnchor.x-newAnchor.x,y:next.y+oldAnchor.y-newAnchor.y};
}
export function arrangeObjects(items,action,reference,gap=24) {
  if(!items.length || items.some(i=>i.locked))return items;
  const boxes=items.map(boundsOf),all=unionBounds(items);
  const move=(item,dx,dy)=>({...item,x:item.x+dx,y:item.y+dy});
  if(action==='symmetry-x'||action==='symmetry-y') {
    if(items.length!==2 || !reference || items.some(i=>objectId(i)===objectId(reference)))return items;
    const horizontal=action==='symmetry-x',r=boundsOf(reference),a=horizontal?'left':'top',z=horizontal?'right':'bottom';
    const order=items.map((i,n)=>({i,b:boxes[n]})).sort((u,v)=>(u.b[a]+u.b[z])-(v.b[a]+v.b[z]) || objectId(u.i).localeCompare(objectId(v.i)));
    const rc=centerOf(reference),g=Math.max(0,Number(gap)||0);
    const result=new Map(order.map(({i,b},n)=> {
      const along=n===0?r[a]-g-b[z]:r[z]+g-b[a],cross=horizontal?rc.y-centerOf(i).y:rc.x-centerOf(i).x;
      return [objectId(i),move(i,horizontal?along:cross,horizontal?cross:along)];
    }));return items.map(i=>result.get(objectId(i)));
  }
  if(action==='distribute-x'||action==='distribute-y') {
    if(items.length<3)return items;
    const horizontal=action==='distribute-x',a=horizontal?'left':'top',z=horizontal?'right':'bottom';
    const sorted=items.map((i,n)=>({i,b:boxes[n]})).sort((u,v)=>u.b[a]-v.b[a] || objectId(u.i).localeCompare(objectId(v.i)));
    const space=(sorted.at(-1).b[z]-sorted[0].b[a]-sorted.reduce((s,o)=>s+o.b[z]-o.b[a],0))/(items.length-1);
    let position=sorted[0].b[a];const result=new Map();
    sorted.forEach(({i,b},n)=>{const delta=position-b[a];result.set(objectId(i),n===0||n===sorted.length-1?i:move(i,horizontal?delta:0,horizontal?0:delta));position+=b[z]-b[a]+space;});
    return items.map(i=>result.get(objectId(i)));
  }
  return items.map((i,n)=> {
    const b=boxes[n];let dx=0,dy=0;
    if(action==='left')dx=all.left-b.left;if(action==='right')dx=all.right-b.right;
    if(action==='center-x')dx=(all.left+all.right-b.left-b.right)/2;
    if(action==='top')dy=all.top-b.top;if(action==='bottom')dy=all.bottom-b.bottom;
    if(action==='center-y')dy=(all.top+all.bottom-b.top-b.bottom)/2;
    return move(i,dx,dy);
  });
}
export function visibleObjects(items,view,size) {
  const box={left:-view.x/view.zoom,top:-view.y/view.zoom,right:(size.width-view.x)/view.zoom,bottom:(size.height-view.y)/view.zoom};
  return items.filter(i=>intersectsRotated(box,i));
}
// Hysteresis is keyed by candidate identity; never by the evolving draft position.
export function snapMove(moving,targets,delta,{zoom=1,uiScale=1,smart=true,grid=false,step=64,alt=false,previous={},cachedBounds,includeGaps=true}={}) {
  if(alt || (!smart&&!grid))return {...delta,guides:[],active:{}};
  const scale=validScale(zoom)*validScale(uiScale),enter=6/scale,leave=10/scale;
  const original=unionBounds(moving),box={left:original.left+delta.x,right:original.right+delta.x,top:original.top+delta.y,bottom:original.bottom+delta.y};
  const targetBoxes=cachedBounds || targets.map(i=>({...boundsOf(i),id:objectId(i)}));
  const active={},guides=[];const result={...delta};
  for(const axis of ['x','y']) {
    const horizontal=axis==='x',lo=horizontal?'left':'top',hi=horizontal?'right':'bottom',otherLo=horizontal?'top':'left',otherHi=horizontal?'bottom':'right';
    const anchors=[box[lo],(box[lo]+box[hi])/2,box[hi]],candidates=[];
    const add=(key,correction,rank,guide)=>candidates.push({key,correction,rank,guide});
    if(smart) {
      for(const t of targetBoxes) [t[lo],(t[lo]+t[hi])/2,t[hi]].forEach((value,n)=>anchors.forEach((v,m)=>add(`align:${t.id}:${n}:${m}`,value-v,0,{axis,value,from:Math.min(box[otherLo],t[otherLo]),to:Math.max(box[otherHi],t[otherHi]),kind:'align'})));
      // Adjacent pairs only: avoid quadratic candidate explosions on large canvases.
      const row=includeGaps?targetBoxes.filter(t=>Math.min(t[otherHi],box[otherHi])>=Math.max(t[otherLo],box[otherLo])).sort((a,b)=>a[lo]-b[lo]):[];
      const size=box[hi]-box[lo];
      for(let n=0;n<row.length-1;n++) {
        const a=row[n],b=row[n+1],distance=b[lo]-a[hi];if(distance<0)continue;
        const placements=[b[hi]+distance,a[lo]-distance-size,(a[hi]+b[lo]-size)/2];
        placements.forEach((value,k)=> {
          if(k===2&&b[lo]-a[hi]<size)return;
          const gap=k===2?(distance-size)/2:distance;
          const segments=k===0?[[a[hi],b[lo]],[b[hi],value]]:k===1?[[value+size,a[lo]],[a[hi],b[lo]]]:[[a[hi],value],[value+size,b[lo]]];
          add(`gap:${a.id}:${b.id}:${k}`,value-box[lo],1,{axis,value,from:Math.min(box[otherLo],a[otherLo],b[otherLo]),to:Math.max(box[otherHi],a[otherHi],b[otherHi]),kind:'gap',gap,segments});
        });
      }
    }
    if(grid)anchors.forEach((v,n)=> {const value=Math.round(v/step)*step;add(`grid:${n}:${value}`,value-v,2,{axis,value,from:box[otherLo],to:box[otherHi],kind:'grid'});});
    const retained=candidates.find(c=>c.key===previous[axis]&&Math.abs(c.correction)<=leave);
    const candidate=retained || candidates.filter(c=>Math.abs(c.correction)<=enter).sort((a,b)=>Math.abs(a.correction)-Math.abs(b.correction)||a.rank-b.rank||a.key.localeCompare(b.key))[0];
    if(candidate){result[axis]+=candidate.correction;active[axis]=candidate.key;guides.push(candidate.guide);}
  }
  return {...result,active,guides};
}
