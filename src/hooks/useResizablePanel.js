import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

const readSize = key => {
  try { const value=JSON.parse(localStorage.getItem(key)); return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null; }
  catch { return null; }
};
const uiScale = () => Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-scale')) || 1;
let currentDrag = null;

// Panel dimensions are UI preferences. Preview stays local; release persists
// once. Escape, pointer cancellation and window blur restore the original size.
export function useResizablePanel({ storageKey, defaultSize, minSize, maxSize, minContentSize=0, axis='x', direction=1, containerRef }) {
  const [preference,setPreference] = useState(() => readSize(storageKey));
  const [limits,setLimits] = useState({min:minSize,max:maxSize});
  const [resizing,setResizing] = useState(false);
  const clamp = value => Math.round(Math.max(limits.min,Math.min(limits.max,value)));
  const size = clamp(preference ?? defaultSize);
  const latest = useRef(null), drag = useRef(null);
  latest.current={size,preference,limits,storageKey,axis,direction};
  const endRef = useRef(null);
  useLayoutEffect(() => {
    const container=containerRef.current;
    if (!container) return;
    const measure=()=>{
      const extent=axis === 'x' ? container.clientWidth : container.clientHeight;
      const max=Math.max(48,Math.min(maxSize,extent-minContentSize));
      const min=Math.min(minSize,max);
      setLimits(previous=>previous.min===min&&previous.max===max ? previous : {min,max});
    };
    const observer=new ResizeObserver(measure);
    observer.observe(container);measure();
    return ()=>observer.disconnect();
  },[containerRef,axis,minSize,maxSize,minContentSize]);
  const persist=useCallback(value=>{
    setPreference(value);
    try { if (value===null) localStorage.removeItem(storageKey); else localStorage.setItem(storageKey,JSON.stringify(value)); } catch {}
  },[storageKey]);
  const reset=useCallback(()=>persist(null),[persist]);
  const onPointerDown=event=>{
    if (event.button!==0 || event.isPrimary===false || currentDrag) return;
    event.preventDefault();event.stopPropagation();
    const target=event.currentTarget, value=latest.current;
    target.focus({preventScroll:true});
    const state={target,pointerId:event.pointerId,start:event[axis==='x'?'clientX':'clientY'],startSize:value.size,preference:value.preference,scale:uiScale(),cursor:document.documentElement.style.cursor,selection:document.documentElement.style.userSelect,frame:null,event:null};
    drag.current=state;currentDrag=state;setResizing(true);
    document.documentElement.style.cursor=axis==='x'?'col-resize':'row-resize';
    document.documentElement.style.userSelect='none';
    try { target.setPointerCapture(event.pointerId); } catch {}
    const preview=e=>{
      const {limits}=latest.current;
      const coordinate=e[axis==='x'?'clientX':'clientY'];
      const next=state.startSize+(coordinate-state.start)/state.scale*direction;
      return Math.round(Math.max(limits.min,Math.min(limits.max,next)));
    };
    const move=e=>{
      if (e.pointerId!==state.pointerId) return;
      e.preventDefault();e.stopPropagation();state.event=e;
      if (state.frame===null) state.frame=requestAnimationFrame(()=>{state.frame=null;setPreference(preview(state.event));});
    };
    const finish=(cancel,e)=>{
      if (drag.current!==state) return;
      if (state.frame!==null) cancelAnimationFrame(state.frame);
      window.removeEventListener('pointermove',move,true);window.removeEventListener('pointerup',up,true);
      window.removeEventListener('pointercancel',cancelPointer,true);window.removeEventListener('blur',blur);window.removeEventListener('keydown',escape,true);
      drag.current=null;currentDrag=null;endRef.current=null;setResizing(false);
      document.documentElement.style.cursor=state.cursor;document.documentElement.style.userSelect=state.selection;
      const final=e ? preview(e) : state.event ? preview(state.event) : state.startSize;
      if (cancel || final===state.startSize) setPreference(state.preference); else persist(final);
      try { if(target.hasPointerCapture(state.pointerId))target.releasePointerCapture(state.pointerId); } catch {}
    };
    const up=e=>{if(e.pointerId===state.pointerId){e.preventDefault();e.stopPropagation();finish(false,e);}};
    const cancelPointer=e=>{if(e.pointerId===state.pointerId)finish(true);};
    const blur=()=>finish(true);
    const escape=e=>{if(e.key==='Escape'&&!e.isComposing){e.preventDefault();e.stopPropagation();finish(true);}};
    endRef.current=()=>finish(true);
    window.addEventListener('pointermove',move,{capture:true,passive:false});window.addEventListener('pointerup',up,true);
    window.addEventListener('pointercancel',cancelPointer,true);window.addEventListener('blur',blur);window.addEventListener('keydown',escape,true);
  };
  const onKeyDown=event=>{
    if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    const negative=axis==='x'?'ArrowLeft':'ArrowUp',positive=axis==='x'?'ArrowRight':'ArrowDown';
    if (![negative,positive,'Home','End'].includes(event.key)) return;
    event.preventDefault();event.stopPropagation();
    const next=event.key==='Home'?limits.min:event.key==='End'?limits.max:size+(event.key===negative?-1:1)*(event.shiftKey?24:8)*direction;
    persist(clamp(next));
  };
  useEffect(()=>()=>endRef.current?.(),[]);
  return {size,isCustom:preference!==null,reset,splitterProps:{onPointerDown,onKeyDown,onDoubleClick:reset,onLostPointerCapture:()=>endRef.current?.(),resizing,'aria-valuenow':size,'aria-valuemin':Math.round(limits.min),'aria-valuemax':Math.round(limits.max)}};
}
