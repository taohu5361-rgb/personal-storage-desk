import { splitTextItem, projectTextItems, textChanges, initializeTextLayouts } from './assetTextModel.js';

// One controller survives view switches. Only acknowledged writes advance saved;
// a failed transaction keeps the latest draft and can be retried without replays.
export function createAssetTextController(assetId, initial, persist, notify = () => {}, viewModes = ['canvas','standard']) {
  let saved = structuredClone(initial), desired = structuredClone(initial);
  let running = null, error = '', currentMode = 'canvas', externalPending = null;
  const innerPending = new Map();
  const publish = () => notify({ ...desired, error });
  const initialize = (mode, origin) => {
    const added = initializeTextLayouts(desired.elements,desired.layouts,assetId,mode,origin);
    if (added.length) { desired = {...desired,layouts:[...desired.layouts,...added]}; publish(); }
    return added.length;
  };
  const draft = (mode, items) => {
    currentMode = mode;
    const oldIds = new Set(projectTextItems(desired.elements,desired.layouts,mode).map(i=>i.objectId));
    const texts = items.filter(i=>i.objectType === 'textBlock');
    const nextIds = new Set(texts.map(i=>i.objectId));
    const removed = new Set([...oldIds].filter(id=>!nextIds.has(id)));
    const elements = new Map(desired.elements.filter(e=>!removed.has(e.id)).map(e=>[e.id,e]));
    const layouts = new Map(desired.layouts.filter(l=>!removed.has(l.textId)).map(l=>[l.viewMode+':'+l.textId,l]));
    for (const item of texts) {
      const value = splitTextItem(item,assetId,mode);
      elements.set(value.element.id,value.element); layouts.set(mode+':'+value.element.id,value.layout);
    }
    desired = {elements:[...elements.values()],layouts:[...layouts.values()]}; publish();
  };
  const flush = () => {
    if (running) return running;
    running = (async () => {
      error = ''; publish();
      for (;;) {
        let wrote = false;
        for (const mode of [currentMode,...viewModes.filter(m=>m!==currentMode)]) {
          const target = structuredClone(desired);
          const innerObjects = innerPending.get(mode) || [];
          const changes = textChanges(saved,target,mode,innerObjects);
          const external=externalPending?.mode===mode?externalPending:null;
          if (!external && ![changes.creates,changes.updates,changes.layouts,changes.deleteIds,changes.innerObjects].some(a=>a.length)) continue;
          if(external)await external.write(changes);else await persist(mode,changes);
          if(externalPending===external)externalPending=null;
          saved = {elements:target.elements,layouts:[...saved.layouts.filter(l=>l.viewMode !== mode && target.elements.some(e=>e.id === l.textId)),...target.layouts.filter(l=>l.viewMode === mode)]};
          if (innerPending.get(mode) === innerObjects) innerPending.delete(mode);
          wrote = true;
        }
        if (!wrote) break;
      }
    })().catch(reason => {error = String(reason); publish(); throw reason;}).finally(()=>{running=null;});
    return running;
  };
  return {
    clipboard:[], initialize,draft,flush,
    commitExternal(mode,write) {currentMode=mode;externalPending={mode,write};return flush();},
    snapshot:()=>({...desired,error}),
    commit(mode,items,innerObjects=[]) {draft(mode,items);if(innerObjects.length)innerPending.set(mode,innerObjects);return flush();},
    refresh(next) {if (!running && !error && !viewModes.map(mode=>textChanges(saved,desired,mode)).some(c=>[c.creates,c.updates,c.layouts,c.deleteIds].some(a=>a.length))) {saved=structuredClone(next);desired=structuredClone(next);publish();}},
  };
}
