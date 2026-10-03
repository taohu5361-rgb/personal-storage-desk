export function readGridPreference(storage) {
  try {
    if(storage.getItem('canvas-transform-grid-continuous-v1')!=='1'){
      storage.setItem('canvas-transform-grid','false');
      storage.setItem('canvas-transform-grid-continuous-v1','1');
      return false;
    }
    return JSON.parse(storage.getItem('canvas-transform-grid'))??false;
  }catch{return false;}
}
