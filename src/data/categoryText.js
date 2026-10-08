import { createAssetTextController } from './assetTextController.js';
import { projectTextItems, splitTextItem } from './assetTextModel.js';

export function categoryTextState(categoryId, blocks) {
  const values = blocks.filter(b => b.categoryId === categoryId).map(b => splitTextItem({ ...b, objectId:b.id,objectType:'textBlock',textValue:b.content },categoryId,'canvas'));
  return {elements:values.map(v=>v.element),layouts:values.map(v=>v.layout)};
}
export function categoryTextBlock(item, categoryId) {
  const {element,layout} = splitTextItem(item,categoryId,'canvas');
  const {assetId, ...appearance} = element;
  const {assetId:layoutOwner,textId,viewMode,...position} = layout;
  return { ...appearance,...position,categoryId };
}
// Both canvases use the same serial draft controller and text interactions.
// Only this persistence adapter knows that outer text belongs to a category.
export function createCategoryTextController(categoryId, blocks, persist, notify) {
  let written = categoryTextState(categoryId,blocks);
  const write=async(changes,writer=persist)=>{
    const elements = new Map(written.elements.map(e=>[e.id,e]));
    const layouts = new Map(written.layouts.map(l=>[l.textId,l]));
    for (const e of [...changes.creates,...changes.updates]) elements.set(e.id,e);
    for (const l of changes.layouts) layouts.set(l.textId,l);
    for (const id of changes.deleteIds) {elements.delete(id);layouts.delete(id);}
    const next = {elements:[...elements.values()],layouts:[...layouts.values()]};
    const touched = new Set([...changes.creates,...changes.updates].map(e=>e.id).concat(changes.layouts.map(l=>l.textId)));
    const upserts = projectTextItems(next.elements,next.layouts,'canvas').filter(i=>touched.has(i.objectId)).map(i=>categoryTextBlock(i,categoryId));
    await writer({upserts,deleteIds:changes.deleteIds});
    written=next;
  };
  const controller=createAssetTextController(categoryId,written,(mode,changes)=>write(changes),notify,['canvas']);
  controller.commitGeometry=(batch,persistBatch,options)=>controller.commitExternal('canvas',changes=>write(changes,textChanges=>persistBatch({...batch,textChanges})),options);
  return controller;
}
