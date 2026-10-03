import { useEffect, useRef, useState } from 'react';
import { arrangeObjects, boundsOf, geometry, normalizeRotation, resizeRotated, rotationFromPointer, snapMove, visibleObjects } from './canvasTransforms.js';
import { resizeInnerObject } from './innerCanvasGeometry.js';
import { useSnapPreferences } from './CanvasArrangeTools';
import { axisSnapPreview, isImageObject } from './canvasAxisGeometry.js';
import { createCanvasFrameQueue } from './canvasFrameQueue.js';

export function useOuterCanvasTransforms(options) {
  const {assets,groups,selected,setSelected,textLayerRef,surfaceRef,viewport,onAssetsChange,onGroupsChange,onSaveTransform,expandGroupsToFit,readUiScale}=options;
  const prefs=useSnapPreferences();
  const [textSelection,setTextSelection]=useState([]),[referenceKey,setReferenceKey]=useState(''),[gap,setGap]=useState(24),[guides,setGuides]=useState([]),[activity,setActivity]=useState(null),[error,setError]=useState(''),[,tick]=useState(0);
  const active=useRef(null),pending=useRef(null),running=useRef(null),history=useRef({undo:[],redo:[]}),revision=useRef(0);
  const refs=useRef({}),frameQueue=useRef(null);
  const [axisKey,setAxisKey]=useState(''),[axisPreview,setAxisPreview]=useState(null);
  const caption=a=>a.tags?.length?44:32;
  const scene=()=>[...refs.current.assets.map(a=>({...a,id:'asset:'+a.id,realId:a.id,kind:'asset',imageHeight:a.height,height:a.height+caption(a),caption:caption(a)})),...(textLayerRef.current?.items() || []).map(t=>({...t,id:'text:'+t.objectId,objectId:undefined,realId:t.objectId,kind:'text'}))];
  const selectedKeys=useRef([]);
  selectedKeys.current=[...selected.map(id=>'asset:'+id),...textSelection.map(id=>'text:'+id)];
  refs.current={...options,prefs,textSelection,referenceKey,gap,assets,groups,axisKey};
  const choose=keys=>{selectedKeys.current=keys;refs.current.setSelected(keys.filter(k=>k.startsWith('asset:')).map(k=>k.slice(6)));const texts=keys.filter(k=>k.startsWith('text:')).map(k=>k.slice(5));setTextSelection(texts);textLayerRef.current?.selectIds(texts);};
  const selectedItems=scene().filter(i=>selectedKeys.current.includes(i.id));
  const visibleScene=()=>{
    const r=refs.current,collapsed=new Set(r.groups.filter(g=>g.collapsed).map(g=>g.id)),display=new Set((r.displayAssets || r.assets).map(a=>a.id));
    return visibleObjects(scene().filter(i=>i.kind==='text'||(display.has(i.realId)&&!collapsed.has(i.groupId))),r.viewport,{width:surfaceRef.current?.clientWidth||0,height:surfaceRef.current?.clientHeight||0});
  };
  const snapshot=()=>({items:scene().map(i=>({id:i.id,...geometry(i)})),groups:refs.current.groups.map(g=>({id:g.id,...geometry(g)}))});
  const apply=(patches,groupPatches)=>{
    const r=refs.current,updates=new Map(patches.map(p=>[p.id,p]));
    let assetsChanged=false;
    const nextAssets=r.assets.map(a=>{const p=updates.get('asset:'+a.id);if(!p)return a;const next={...a,...geometry(p),height:p.height-caption(a)};if(['x','y','width','height','rotation'].every(k=>(a[k]||0)===(next[k]||0)))return a;assetsChanged=true;return next;});
    if(assetsChanged){refs.current.assets=nextAssets;r.onAssetsChange(nextAssets,{preview:true});}
    const textPatches=patches.filter(p=>p.id.startsWith('text:')).map(p=>({...p,objectId:p.id.slice(5)}));
    if(textPatches.length)textLayerRef.current?.patchGeometry(textPatches);
    let nextGroups=groupPatches?r.groups.map(g=>{const p=groupPatches.find(p=>p.id===g.id);return p?{...g,x:p.x,y:p.y,width:p.width,height:p.height}:g;}):r.expandGroupsToFit(r.groups,nextAssets,patches.filter(p=>p.id.startsWith('asset:')).map(p=>p.id.slice(6)));
    if(nextGroups.some((g,n)=>!r.groups[n]||['x','y','width','height'].some(k=>g[k]!==r.groups[n][k]))){refs.current.groups=nextGroups;r.onGroupsChange?.(nextGroups);}
  };
  const record=before=>{const after=snapshot();if(JSON.stringify(before)===JSON.stringify(after))return;history.current.undo.push(before);if(history.current.undo.length>100)history.current.undo.shift();history.current.redo=[];tick(v=>v+1);};
  const batch=()=>({assets:refs.current.assets.map(a=>({id:a.id,...geometry(a)})),texts:(textLayerRef.current?.items()||[]).map(t=>({id:t.objectId,...geometry(t)})),groups:refs.current.groups.map(g=>({id:g.id,...geometry(g)}))});
  const persistBatch=async enriched=>{
    if(refs.current.onSaveTransform)await refs.current.onSaveTransform(enriched);else {await refs.current.onSaveText?.(enriched.textChanges);await refs.current.onAssetsCommit?.();await refs.current.onGroupsCommit?.();}
    if(pending.current?._revision===enriched._revision)pending.current=null;
  };
  const flush=()=>{
    if(running.current){if(pending.current)textLayerRef.current?.commitGeometry(pending.current,persistBatch).catch(()=>{});return running.current;}
    if(!pending.current)return Promise.resolve();
    running.current=(async()=>{
      setError('');
      while(pending.current){
        const value=pending.current;
        if(textLayerRef.current?.commitGeometry)await textLayerRef.current.commitGeometry(value,persistBatch);else await persistBatch(value);
        if(pending.current===value)pending.current=null;
      }
    })().catch(e=>{setError(String(e));throw e;}).finally(()=>{running.current=null;});return running.current;
  };
  const commit=()=>{pending.current={...batch(),_revision:++revision.current};if(refs.current.settings?.autoSave!==false)flush().catch(()=>{});};
  const point=event=>refs.current.screenToWorld(refs.current.getSurfacePoint(event));
  const finish=cancel=>{
    frameQueue.current?.clear();
    const a=active.current;if(!a)return;active.current=null;setGuides([]);setActivity(null);setAxisPreview(null);
    if(!cancel&&a.moved&&a.axisPreview?.preview)apply([a.axisPreview.preview]);
    if(cancel){apply(a.before.items,a.before.groups);return;}
    if(a.moved){record(a.before);commit();
      if(a.kind==='move'&&a.originals.length===1&&a.originals[0].kind==='asset'&&!a.originals[0].groupId){const item=scene().find(i=>i.id===a.originals[0].id),c={x:item.x+item.width/2,y:item.y+item.height/2};const target=refs.current.groups.find(g=>!g.locked&&c.x>=g.x&&c.x<=g.x+g.width&&c.y>=g.y&&c.y<=g.y+g.height);if(target)refs.current.onChangeGroupMember?.(target.id,item.realId,true);}
    }
  };
  const beginMove=(event,key)=>{
    if(event.button!==0)return;
    let keys=selectedKeys.current;
    if(event.ctrlKey||event.metaKey)keys=keys.includes(key)?keys.filter(k=>k!==key):[...keys,key];else if(!keys.includes(key))keys=[key];
    choose(keys);if(!keys.includes(key))return;
    const current=scene(),textGroups=new Set(current.filter(i=>i.kind==='text'&&keys.includes(i.id)&&i.groupId).map(i=>i.groupId));
    const items=current.filter(i=>keys.includes(i.id)||(i.kind==='text'&&textGroups.has(i.groupId)));if(items.some(i=>i.locked))return;
    const ids=new Set(items.map(i=>i.id)),targets=visibleScene().filter(i=>!ids.has(i.id));
    const origin=current.find(i=>i.id===refs.current.axisKey);
    active.current={kind:'move',pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,originals:items,before:snapshot(),view:{...refs.current.viewport},snap:{},snapBounds:targets.map(i=>({...boundsOf(i),id:i.id})),axisReference:items.length===1&&isImageObject(items[0])?origin:null};
  };
  const beginResize=(event,key,corner)=>{
    const item=scene().find(i=>i.id===key);if(!item||item.locked||event.button!==0)return;
    choose([key]);active.current={kind:'resize',pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,item,corner,before:snapshot(),view:{...refs.current.viewport}};
  };
  const beginRotate=(event,key)=>{
    const item=scene().find(i=>i.id===key);if(!item||item.locked||event.button!==0)return;
    choose([key]);active.current={kind:'rotate',pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,startPoint:point(event),item,before:snapshot(),view:{...refs.current.viewport}};
  };
  const move=event=>{
    const a=active.current;if(!a||a.pointerId!==event.pointerId)return;
    if(!a.moved&&Math.hypot(event.clientX-a.startX,event.clientY-a.startY)<5)return;
    event.preventDefault();if(!a.moved)setActivity({kind:a.kind,key:a.item?.id,ids:a.originals?.map(i=>i.id)});a.moved=true;
    const delta={x:(event.clientX-a.startX)/(a.view.zoom*readUiScale()),y:(event.clientY-a.startY)/(a.view.zoom*readUiScale())};
    if(a.kind==='move'){
      let movement=delta;
      if(a.axisReference){
        const candidate=axisSnapPreview(a.originals[0],a.axisReference,delta,{zoom:a.view.zoom,uiScale:readUiScale(),alt:event.altKey,enabled:refs.current.prefs.smart,previous:a.snap});
        a.snap=candidate.active;a.axisPreview=candidate;setAxisPreview(candidate);
      }else{
        movement=snapMove(a.originals,[],delta,{...refs.current.prefs,zoom:a.view.zoom,uiScale:readUiScale(),alt:event.altKey,previous:a.snap,cachedBounds:a.snapBounds,includeGaps:a.originals.length>1||!isImageObject(a.originals[0])});a.snap=movement.active;setGuides(movement.guides);
      }
      apply(a.originals.map(i=>({...i,x:i.x+movement.x,y:i.y+movement.y})));
    }else if(a.kind==='rotate')apply([{...a.item,rotation:rotationFromPointer(a.item,a.startPoint,point(event),event.shiftKey)}]);
    else {
      const resize=(item,corner,dx,dy)=>{
        if(item.kind==='text')return resizeInnerObject(item,corner,dx,dy);
        const img={...item,height:item.imageHeight,objectType:'sample'};
        const next=resizeInnerObject(img,corner,dx,dy),width=Math.min(2000,next.width),height=width*item.imageHeight/item.width+item.caption;
        return {...item,width,height,x:corner.includes('w')?item.x+item.width-width:item.x,y:corner.includes('n')?item.y+item.height-height:item.y};
      };
      apply([resizeRotated(a.item,a.corner,delta,resize)]);
    }
  };
  const api=useRef({});api.current={move,finish,flush};
  useEffect(()=>{
    const queue=createCanvasFrameQueue(e=>api.current.move(e),requestAnimationFrame,cancelAnimationFrame);frameQueue.current=queue;
    const onMove=e=>{if(active.current?.pointerId===e.pointerId){e.preventDefault();queue.push(e);}},up=e=>{if(active.current?.pointerId===e.pointerId){queue.flush(e);api.current.finish(false);}},cancel=e=>{if(!e.pointerId||active.current?.pointerId===e.pointerId)api.current.finish(true);},escape=e=>{if(e.key!=='Escape'||e.isComposing||e.target?.closest?.('input,textarea,select,[contenteditable=true]'))return;if(active.current){e.preventDefault();api.current.finish(true);}else setAxisKey('');};
    const leave=e=>{api.current.finish(true);if(pending.current)e.detail.promises.push(api.current.flush());};
    window.addEventListener('pointermove',onMove,{passive:false});window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);window.addEventListener('blur',cancel);window.addEventListener('keydown',escape,true);window.addEventListener('asset-text-before-leave',leave);
    return()=>{queue.clear();window.removeEventListener('pointermove',onMove);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);window.removeEventListener('blur',cancel);window.removeEventListener('keydown',escape,true);window.removeEventListener('asset-text-before-leave',leave);};
  },[]);
  useEffect(()=>{frameQueue.current?.clear();choose([]);setReferenceKey('');setAxisKey('');setAxisPreview(null);history.current={undo:[],redo:[]};pending.current=null;setError('');setGuides([]);},[options.categoryId]);
  const arrange=action=>{const chosen=scene().filter(i=>selectedKeys.current.includes(i.id));const reference=scene().find(i=>i.id===referenceKey);const before=snapshot();apply(arrangeObjects(chosen,action,reference,gap));record(before);commit();};
  const rotate=angle=>{const chosen=scene().filter(i=>selectedKeys.current.includes(i.id));if(chosen.length!==1||chosen[0].locked)return;const before=snapshot();apply([{...chosen[0],rotation:normalizeRotation(angle)}]);record(before);commit();};
  const undo=redo=>{const h=history.current,from=redo?h.redo:h.undo,to=redo?h.undo:h.redo;if(!from.length)return false;const value=from.pop();to.push(snapshot());apply(value.items,value.groups);commit();return true;};
  const selectForMenu=key=>{if(!selectedKeys.current.includes(key))choose([key]);};
  const reference=scene().find(i=>i.id===referenceKey),axisReference=scene().find(i=>i.id===axisKey);
  const toggleAxis=()=>{const chosen=scene().filter(i=>selectedKeys.current.includes(i.id));if(chosen.length===1&&isImageObject(chosen[0]))setAxisKey(k=>k===chosen[0].id?'':chosen[0].id);};
  const axisProps={axisImage:selectedItems.length===1&&isImageObject(selectedItems[0]),axisActive:selectedItems[0]?.id===axisKey,onAxisToggle:toggleAxis};
  return {
    beginMove,beginResize,beginRotate,chooseBox:(assets,texts)=>choose([...assets.map(id=>'asset:'+id),...texts.map(id=>'text:'+id)]),clear:()=>choose([]),selectTexts:ids=>choose([...selectedKeys.current.filter(k=>k.startsWith('asset:')),...ids.map(id=>'text:'+id)]),selectForMenu,
    undo:()=>undo(false),redo:()=>undo(true),flush,error,guides,activity,scene,visibleScene,axisReference,axisPreview,
    arrangeProps:{...axisProps,count:selectedItems.length,locked:selectedItems.some(i=>i.locked),reference,onAction:arrange,onReference:()=>setReferenceKey(selectedKeys.current[0]),gap,setGap},
    toolbarProps:{axisReference,onAxisToggle:toggleAxis,onAxisClear:()=>setAxisKey(''),items:selectedItems,reference,onAction:arrange,onReference:()=>setReferenceKey(selectedKeys.current[0]),gap,setGap,onRotation:rotate,onUndo:()=>undo(false),onRedo:()=>undo(true),canUndo:!!history.current.undo.length,canRedo:!!history.current.redo.length,...prefs},
    externalCanvas:{hasDraft:()=>!!active.current||!!pending.current,selectionCount:selectedItems.length,beginMove:(e,id)=>beginMove(e,'text:'+id),beginResize:(e,id,c)=>beginResize(e,'text:'+id,c),beginRotate:(e,id)=>beginRotate(e,'text:'+id),selectForMenu:id=>selectForMenu('text:'+id),arrange:{count:selectedItems.length,locked:selectedItems.some(i=>i.locked),reference,onAction:arrange,onReference:()=>setReferenceKey(selectedKeys.current[0]),gap,setGap}},
  };
}
