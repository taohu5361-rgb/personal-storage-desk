import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';

export function PopupMenu({anchor,label,onClose,children}) {
  const ref=useRef(null);
  const close=useRef(onClose);close.current=onClose;
  const [position,setPosition]=useState(null);
  const scale=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-scale')) || 1;
  useLayoutEffect(()=>{
    if(!anchor || !ref.current)return;
    const menu=ref.current;
    const place=()=>{
      const box=anchor.getBoundingClientRect(),width=menu.offsetWidth,height=menu.offsetHeight;
      const left=Math.max(8,Math.min(box.right/scale-width,innerWidth/scale-width-8));
      const below=box.bottom/scale+4;
      const top=Math.max(8,below+height<innerHeight/scale-8?below:box.top/scale-height-4);
      setPosition({left,top});
    };
    place();menu.querySelector('button:not(:disabled)')?.focus();
    window.addEventListener('resize',place);
    return()=>{window.removeEventListener('resize',place);if(anchor.isConnected)anchor.focus({preventScroll:true});};
  },[anchor,scale]);
  useEffect(()=>{
    const outside=event=>{if(!ref.current?.contains(event.target)&&!anchor?.contains(event.target))close.current?.()};
    window.addEventListener('pointerdown',outside);
    return()=>window.removeEventListener('pointerdown',outside);
  },[anchor]);
  const keydown=event=>{
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close.current?.();return}
    if(event.key==='Tab'){close.current?.();return}
    if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
    event.preventDefault();event.stopPropagation();
    const nodes=[...ref.current.querySelectorAll('button:not(:disabled)')],index=nodes.indexOf(document.activeElement);
    const next=event.key==='Home'?0:event.key==='End'?nodes.length-1:(index+(event.key==='ArrowUp'?-1:1)+nodes.length)%nodes.length;
    nodes[next]?.focus();
  };
  return createPortal(<div ref={ref} className="ui-menu ui-popup-menu" role="menu" aria-label={label} style={{...position,zoom:scale,visibility:position?'visible':'hidden'}} onKeyDown={keydown}>{children}</div>,document.body);
}
