export const DEFAULT_SAVE_INTERVAL = 60;
export const normalizeSaveInterval = value => {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 5 && seconds <= 3600 ? Math.round(seconds) : DEFAULT_SAVE_INTERVAL;
};

// This clock has no edit/drag input. Only changing the setting starts a new cadence.
export function createFixedAutoSave({ seconds=DEFAULT_SAVE_INTERVAL, onTick, setIntervalFn=setInterval, clearIntervalFn=clearInterval }) {
  let timer=null, running=false;
  const tick=async () => {
    if(running)return;
    running=true;
    try {await onTick();} finally {running=false;}
  };
  return {
    start() {if(timer===null)timer=setIntervalFn(()=>{void tick().catch(()=>{});},normalizeSaveInterval(seconds)*1000);},
    stop() {if(timer!==null)clearIntervalFn(timer);timer=null;},
  };
}
