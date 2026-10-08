import { useEffect, useRef, useState } from 'react';
import { RotateCcw, Undo2, Redo2, Magnet } from 'lucide-react';
import './canvasTransforms.css';
import { imageCenter, imageCorners, isImageObject } from './canvasAxisGeometry.js';
import { cornersOf } from './canvasTransforms.js';
import { readGridPreference } from './canvasSnapPreferences.js';
import { CanvasInspectorPortal, useCanvasInspector } from './CanvasEditorLayout';
export const arrangeActions=[['left','左对齐'],['center-x','水平居中'],['right','右对齐'],['top','上对齐'],['center-y','垂直居中'],['bottom','下对齐'],['distribute-x','水平等距'],['distribute-y','垂直等距']];
export function ArrangeCommands({count,locked,reference,onAction,onReference,gap,setGap,axisImage,axisActive,onAxisToggle}) {
  if(count===1&&axisImage)return <button onClick={onAxisToggle}>{axisActive?'关闭中轴线':'显示中轴线'}</button>;
  return <>
    <div className="canvas-arrange-actions">{arrangeActions.map(([key,label])=><button key={key} disabled={locked||count<(key.startsWith('distribute')?3:2)} onClick={()=>onAction(key)}>{label}</button>)}</div>
    <button disabled={count!==1} onClick={onReference}>设为对称参考</button>
    <span className="canvas-reference-label">{reference ? `参考：${reference.name || reference.title || reference.textValue?.slice(0,12) || '已选对象'}`:'未设置对称参考'}</span>
    <label>间隙<input aria-label="对称间隙" type="number" min="0" max="100000" value={gap} onChange={e=>setGap(e.target.value)} onBlur={()=>setGap(Math.max(0,Number(gap)||0))}/></label>
    <div className="canvas-arrange-actions"><button disabled={locked||count!==2||!reference} onClick={()=>onAction('symmetry-x')}>左右对称</button><button disabled={locked||count!==2||!reference} onClick={()=>onAction('symmetry-y')}>上下对称</button></div>
    {locked&&<span role="status">选区包含锁定对象，排列不可用</span>}
  </>;
}
export function CanvasArrangeTools({items,reference,onAction,onReference,gap,setGap,onRotation,onUndo,onRedo,canUndo,canRedo,smart,grid,onSmart,onGrid,axisReference,onAxisToggle,onAxisClear}) {
  const inspector=useCanvasInspector();
  const [expanded,setExpanded]=useState(false);
  const rotationInputRef=useRef(null);
  useEffect(()=>{
    // Commit before a canvas pointer handler clears selection and removes the input.
    const commitBeforePointerDown=event=>{
      const input=rotationInputRef.current;
      if(input&&input.ownerDocument.activeElement===input&&!input.contains(event.target))input.blur();
    };
    document.addEventListener('pointerdown',commitBeforePointerDown,true);
    return()=>document.removeEventListener('pointerdown',commitBeforePointerDown,true);
  },[]);
  const single=items.length===1?items[0]:null,locked=items.some(i=>i.locked);
  const axisImage=isImageObject(single);
  const rotationField=single&&<div className="ui-inspector-rotation"><label><span>角度</span><input ref={rotationInputRef} aria-label="旋转角度" key={`${single.objectId||single.id}:${single.rotation||0}`} type="number" step="1" disabled={single.locked} defaultValue={Number((single.rotation||0).toFixed(2))} onBlur={e=>{const value=Number(e.target.value);if(e.target.value!==''&&Number.isFinite(value)&&value!==Number((single.rotation||0).toFixed(2)))onRotation(value);}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();e.stopPropagation();}}/>°</label><button disabled={single.locked} title="旋转归零" aria-label="旋转归零" onClick={()=>onRotation(0)}><RotateCcw size={14}/></button></div>;
  if(inspector) {
    const number=value=>Number.isFinite(Number(value))?Number(Number(value).toFixed(1)):'—';
    const name=single?.name||single?.title||single?.textValue?.slice(0,48)|| (axisImage?'图片':'对象');
    return <CanvasInspectorPortal section="arrange"><div className="canvas-arrange-toolbar" aria-label="画布排列" data-selection-count={items.length}>
      <div className="ui-inspector-selection"><h3>{single?'所选对象':items.length?`已选择 ${items.length} 个对象`:'画布工具'}</h3><p>{single?`${name}${single.locked?' · 已锁定':''}`:items.length?'对齐和等距排列会作用于当前选区。':'选择对象后可查看位置、尺寸与排列选项。'}</p></div>
      {single&&<section className="ui-inspector-transform" aria-label="位置尺寸与旋转"><h4>位置与尺寸</h4><dl className="ui-inspector-geometry" aria-label="对象几何信息">{[['X',single.x],['Y',single.y],['宽',single.width],['高',single.imageHeight??single.height]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{number(value)}</dd></div>)}</dl>{rotationField}</section>}
      {items.length>0&&<details className="ui-inspector-arrange" open><summary>{axisImage?'图片中轴线':'排列与对称'}</summary><div className="canvas-arrange-panel"><ArrangeCommands count={items.length} locked={locked} reference={reference} onAction={onAction} onReference={onReference} gap={gap} setGap={setGap} axisImage={axisImage} axisActive={!!axisReference&&(axisReference.id||axisReference.objectId)===(single?.id||single?.objectId)} onAxisToggle={onAxisToggle}/></div></details>}
      <section className="ui-inspector-canvas-options" aria-label="吸附与操作历史"><h4>吸附与操作历史</h4>{axisReference&&<button title="清除中轴线；空闲时 Esc" aria-label="清除中轴线" onClick={onAxisClear}>清除中轴线</button>}
      <div className="ui-inspector-snap"><button className={smart?'active':''} aria-pressed={smart} title="智能吸附；Alt 临时取消" onClick={()=>onSmart(!smart)}><Magnet size={14}/>智能吸附</button><label className="canvas-grid-toggle"><input type="checkbox" checked={grid} onChange={e=>onGrid(e.target.checked)}/>网格吸附</label></div>
      <div className="ui-inspector-history"><span>操作历史</span><button disabled={!canUndo} aria-label="撤销画布操作" title="撤销画布操作" onClick={onUndo}><Undo2 size={14}/></button><button disabled={!canRedo} aria-label="重做画布操作" title="重做画布操作" onClick={onRedo}><Redo2 size={14}/></button></div>
      {!items.length&&<p className="ui-inspector-help">选中多个对象可对齐、等距排列。按住 Alt 可临时取消吸附。</p>}</section>
    </div></CanvasInspectorPortal>;
  }
  return <div className="canvas-arrange-toolbar" aria-label="画布排列" onPointerDown={e=>e.stopPropagation()} onWheel={e=>e.stopPropagation()}>
    <button className={smart?'active':''} aria-pressed={smart} title="智能吸附；Alt 临时取消" onClick={()=>onSmart(!smart)}><Magnet size={14}/>吸附</button>
    <label className="canvas-grid-toggle"><input type="checkbox" checked={grid} onChange={e=>onGrid(e.target.checked)}/>网格吸附</label>
    {items.length>0&&<button aria-expanded={axisImage?undefined:expanded} aria-pressed={axisImage?!!axisReference&&(axisReference.id||axisReference.objectId)===(single.id||single.objectId):undefined} title={axisImage?'以图片中心显示十字轴；再次点击关闭':undefined} onClick={()=>{if(axisImage){setExpanded(false);onAxisToggle();}else setExpanded(!expanded);}}>排列 · {items.length}</button>}
    {axisReference&&<button title="清除中轴线；空闲时 Esc" aria-label="清除中轴线" onClick={onAxisClear}>清除中轴线</button>}
    {single&&<><label>角度<input ref={rotationInputRef} aria-label="旋转角度" key={`${single.objectId||single.id}:${single.rotation||0}`} type="number" step="1" disabled={single.locked} defaultValue={Number((single.rotation||0).toFixed(2))} onBlur={e=>{const value=Number(e.target.value);if(e.target.value!==''&&Number.isFinite(value)&&value!==Number((single.rotation||0).toFixed(2)))onRotation(value);}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();e.stopPropagation();}}/>°</label><button disabled={single.locked} title="旋转归零" aria-label="旋转归零" onClick={()=>onRotation(0)}><RotateCcw size={14}/></button></>}
    <button disabled={!canUndo} aria-label="撤销画布操作" onClick={onUndo}><Undo2 size={14}/></button><button disabled={!canRedo} aria-label="重做画布操作" onClick={onRedo}><Redo2 size={14}/></button>
    {expanded&&items.length>0&&!axisImage&&<div className="canvas-arrange-panel"><ArrangeCommands count={items.length} locked={locked} reference={reference} onAction={onAction} onReference={onReference} gap={gap} setGap={setGap}/></div>}
  </div>;
}
export function CanvasAxisGuides({reference,preview,active={},viewport}) {
  if(!reference)return null;
  const origin=imageCenter(reference),x=viewport.x+origin.x*viewport.zoom,y=viewport.y+origin.y*viewport.zoom;
  const project=points=>points.map(p=>`${viewport.x+p.x*viewport.zoom},${viewport.y+p.y*viewport.zoom}`).join(' ');
  return <svg className="canvas-axis-guides" aria-hidden="true" data-axis-reference={reference.realId||reference.objectId||reference.id}>
    <line data-axis="x" className={active.x!==undefined?'axis-ready':''} x1={x} x2={x} y1="0" y2="100%"/>
    <line data-axis="y" className={active.y!==undefined?'axis-ready':''} x1="0" x2="100%" y1={y} y2={y}/>
    <polygon className="axis-origin-mark" points={project(imageCorners(reference))}/>
    {preview&&<polygon className="axis-drop-preview" points={project(cornersOf(preview))}/>}
  </svg>;
}
export function CanvasSnapGuides({guides,viewport}) {
  if(!guides.length)return null;
  const project=(axis,value)=>axis==='x'?viewport.x+value*viewport.zoom:viewport.y+value*viewport.zoom;
  return <svg className="canvas-snap-guides" aria-hidden="true">{guides.map((g,n)=> {
    const horizontal=g.axis==='x',v=project(g.axis,g.value),from=project(horizontal?'y':'x',g.from),to=project(horizontal?'y':'x',g.to);
    return <g key={n}><line x1={horizontal?v:from} x2={horizontal?v:to} y1={horizontal?from:v} y2={horizontal?to:v}/>{g.kind==='gap'&&g.segments.map(([a,b],k)=> {
      const start=project(g.axis,a),end=project(g.axis,b),cross=from-14;
      return <g key={k}><line className="gap-line" x1={horizontal?start:cross} x2={horizontal?end:cross} y1={horizontal?cross:start} y2={horizontal?cross:end}/><text x={horizontal?(start+end)/2:cross-3} y={horizontal?cross-4:(start+end)/2} textAnchor="middle">{Number(g.gap.toFixed(1))}</text></g>;
    })}</g>;
  })}</svg>;
}
export function useSnapPreferences() {
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem('canvas-transform-'+key))??fallback;}catch{return fallback;}};
  const [smart,setSmart]=useState(()=>read('smart',true)),[grid,setGrid]=useState(()=>readGridPreference(localStorage));
  const save=(key,value,set)=>{set(value);try{localStorage.setItem('canvas-transform-'+key,JSON.stringify(value));}catch{}};
  return {smart,grid,onSmart:v=>save('smart',v,setSmart),onGrid:v=>save('grid',v,setGrid)};
}
