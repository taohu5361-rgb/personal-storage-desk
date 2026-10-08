import { useEffect, useRef } from 'react';
import { createFixedAutoSave, normalizeSaveInterval } from '../data/fixedAutoSave.js';

export function useFixedAutoSave({enabled,interval,onSave}) {
  const callback=useRef(onSave);
  callback.current=onSave;
  const seconds=normalizeSaveInterval(interval);
  useEffect(()=>{
    if(!enabled)return;
    const clock=createFixedAutoSave({seconds,onTick:()=>callback.current()});
    clock.start();
    return ()=>clock.stop();
  },[enabled,seconds]);
}
