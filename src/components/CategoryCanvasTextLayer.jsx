import { useCallback, useEffect, useRef, useState } from 'react';
import { AssetTextSurface } from './AssetTextSurface';
import { createCategoryTextController, categoryTextState } from '../data/categoryText.js';
import { projectTextItems } from '../data/assetTextModel.js';

export function CategoryCanvasTextLayer({categoryId,blocks,fonts,viewport,surfaceApiRef,onSave,onTextContextActive,onMinimapItems,externalCanvas}) {
  const controllerRef=useRef(null),flushRef=useRef(null),saveRef=useRef(onSave);
  saveRef.current=onSave;
  const [snapshot,setSnapshot]=useState(null);
  if (!controllerRef.current) controllerRef.current=createCategoryTextController(categoryId,blocks,changes=>saveRef.current(changes),setSnapshot);
  const controller=controllerRef.current;
  const sourceKey=JSON.stringify(blocks);
  useEffect(()=>controller.refresh(categoryTextState(categoryId,blocks)),[controller,categoryId,sourceKey]);
  const current=snapshot || controller.snapshot();
  const registerFlush=useCallback(fn=>{flushRef.current=fn;return()=>{flushRef.current=null;};},[]);
  useEffect(()=>{
    const beforeLeave=event=>event.detail.promises.push(flushRef.current?.() || controller.flush());
    window.addEventListener('asset-text-before-leave',beforeLeave);
    return()=>{window.removeEventListener('asset-text-before-leave',beforeLeave);};
  },[controller]);
  return <>
    <AssetTextSurface embeddedCanvas assetId={categoryId} surfaceApiRef={surfaceApiRef} onTextContextActive={onTextContextActive} onMinimapItems={onMinimapItems}
      textController={controller} textBlocks={projectTextItems(current.elements,current.layouts,'canvas').map(i=>({...i,id:i.objectId,content:i.textValue}))}
      externalCanvas={externalCanvas} onCommitGeometry={(batch,persist)=>controller.commitGeometry(batch,persist)} fonts={fonts} prompts={[]} initialViewport={{viewportX:viewport.x,viewportY:viewport.y,zoom:viewport.zoom}}
      onSaveViewport={viewport.onChange} onDraft={items=>controller.draft('canvas',items)}
      onSaveObjects={(objects,options)=>controller.commit('canvas',options.textBlocks)} onRegisterFlush={registerFlush}/>
    {current.error && <div className="asset-text-save-error outer-text-save-error" role="alert"><span>文字保存失败：{current.error}</span><button onClick={()=>controller.flush().catch(()=>{})}>重试保存</button></div>}
  </>;
}
