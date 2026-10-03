export const SHARED_TEXT_FIELDS = ['styleType','title','fontFamily','fontSize','fontWeight','textColor','textAlign','lineHeight','borderEnabled','borderColor','borderWidth','borderRadius','backgroundColor','backgroundOpacity','shadow','createdAt'];
export const TEXT_LAYOUT_FIELDS = ['x','y','width','height','rotation','zIndex','locked','groupId'];
const pick = (item, fields) => Object.fromEntries(fields.map(key => [key, item[key] ?? (key === 'groupId' ? null : key === 'rotation' ? 0 : item[key])]));
export function splitTextItem(item, assetId, viewMode) {
  return {
    element: {id:item.objectId,assetId,content:item.textValue || '',...pick(item,SHARED_TEXT_FIELDS),updatedAt:item.updatedAt || Date.now()},
    layout: {textId:item.objectId,assetId,viewMode,...pick(item,TEXT_LAYOUT_FIELDS)},
  };
}
export function projectTextItems(elements, layouts, viewMode) {
  const byId = new Map(layouts.filter(l => l.viewMode === viewMode).map(l => [l.textId,l]));
  return elements.filter(e => byId.has(e.id)).map(e => ({...e,...byId.get(e.id),objectId:e.id,objectType:'textBlock',textValue:e.content}));
}
export function textChanges(saved, desired, viewMode, innerObjects = []) {
  const oldElements = new Map(saved.elements.map(e => [e.id,e]));
  const oldLayouts = new Map(saved.layouts.filter(l => l.viewMode === viewMode).map(l => [l.textId,l]));
  const sameElement = (a,b) => JSON.stringify([a.content,...SHARED_TEXT_FIELDS.map(k=>a[k])]) === JSON.stringify([b.content,...SHARED_TEXT_FIELDS.map(k=>b[k])]);
  const sameLayout = (a,b) => JSON.stringify(TEXT_LAYOUT_FIELDS.map(k=>a[k])) === JSON.stringify(TEXT_LAYOUT_FIELDS.map(k=>b[k]));
  return {
    creates:desired.elements.filter(e => !oldElements.has(e.id)),
    updates:desired.elements.filter(e => oldElements.has(e.id) && !sameElement(oldElements.get(e.id),e)),
    layouts:desired.layouts.filter(l => l.viewMode === viewMode && (!oldLayouts.has(l.textId) || !sameLayout(oldLayouts.get(l.textId),l))),
    deleteIds:saved.elements.filter(e => !desired.elements.some(n => n.id === e.id)).map(e=>e.id),
    innerObjects,
  };
}
export function initializeTextLayouts(elements, layouts, assetId, viewMode, origin) {
  const existing = new Set(layouts.filter(l => l.viewMode === viewMode).map(l=>l.textId));
  let y = Math.max(origin.y, ...layouts.filter(l=>l.viewMode === viewMode).map(l=>l.y+l.height+24));
  let z = Math.max(0,...layouts.filter(l=>l.viewMode === viewMode).map(l=>l.zIndex));
  return [...elements].sort((a,b)=>a.createdAt-b.createdAt || a.id.localeCompare(b.id)).filter(e=>!existing.has(e.id)).map(e=>{
    const other = layouts.find(l=>l.textId === e.id);
    const l = {textId:e.id,assetId,viewMode,x:origin.x,y,width:other?.width || 280,height:other?.height || 160,zIndex:++z,locked:false,groupId:null};
    y += l.height+24; return l;
  });
}
