import { objectToWorld, objectId } from './canvasTransforms.js';

export const isImageObject = item => item?.kind === 'asset' || item?.objectType === 'sample';
export function imageCorners(item) {
  const height=item.imageHeight ?? item.height;
  return [{x:item.x,y:item.y},{x:item.x+item.width,y:item.y},{x:item.x+item.width,y:item.y+height},{x:item.x,y:item.y+height}].map(p=>objectToWorld(p,item));
}
export function imageCenter(item) {
  return objectToWorld({x:item.x+item.width/2,y:item.y+(item.imageHeight ?? item.height)/2},item);
}
export function axisSnapPreview(item,reference,delta,{zoom=1,uiScale=1,previous={},alt=false,enabled=true}={}) {
  const empty={active:{},correction:{x:0,y:0},preview:null};
  if(!reference||!enabled||alt||objectId(item)===objectId(reference))return empty;
  const scale=zoom*uiScale,enter=10/scale,leave=16/scale,origin=imageCenter(reference),points=imageCorners(item);
  const active={},correction={x:0,y:0};
  for(const axis of ['x','y']){
    const values=points.map(p=>p[axis]+delta[axis]),lo=Math.min(...values),hi=Math.max(...values);
    const anchors=[(lo+hi)/2,lo,hi]; // Center wins exact distance ties.
    const retained=previous[axis];
    const index=Number.isInteger(retained)&&Math.abs(origin[axis]-anchors[retained])<=leave?retained:
      anchors.map((value,index)=>({index,distance:Math.abs(origin[axis]-value)})).filter(c=>c.distance<=enter).sort((a,b)=>a.distance-b.distance||a.index-b.index)[0]?.index;
    if(index!==undefined){active[axis]=index;correction[axis]=origin[axis]-anchors[index];}
  }
  return {active,correction,preview:Object.keys(active).length?{...item,x:item.x+delta.x+correction.x,y:item.y+delta.y+correction.y}:null};
}
