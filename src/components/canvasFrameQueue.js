// One latest pointer event per paint; release flushes synchronously and cancel discards it.
export function createCanvasFrameQueue(run,request,cancel) {
  let pending=null,frame=null;
  const clear=()=>{if(frame!==null)cancel(frame);frame=null;pending=null;};
  return {
    push(event){pending=event;if(frame===null)frame=request(()=>{frame=null;const value=pending;pending=null;if(value)run(value);});},
    flush(event){const value=event||pending;clear();if(value)run(value);},
    clear,
  };
}
