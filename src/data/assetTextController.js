import { splitTextItem, projectTextItems, textChanges, initializeTextLayouts, TEXT_LAYOUT_FIELDS } from './assetTextModel.js';

// One controller survives view switches. Only acknowledged writes advance saved;
// a failed transaction keeps the latest draft and can be retried without replays.
export function createAssetTextController(assetId, initial, persist, notify = () => {}, viewModes = ['canvas','standard']) {
  let saved = structuredClone(initial), desired = structuredClone(initial);
  let running = null, saving = false, error = '', currentMode = 'canvas', externalPending = null;
  const innerPending = new Map();
  const acknowledgedInner = new Map();
  const derivedLayouts = new Map();
  const layoutKey = layout => `${layout.viewMode}:${layout.textId}`;
  const layoutValues = layout => TEXT_LAYOUT_FIELDS.map(key=>layout[key] ?? (key==='rotation' ? 0 : key==='groupId' ? null : undefined));
  const dirty = () => Boolean(externalPending || innerPending.size || viewModes.some(mode => {
    const changes = textChanges(saved,desired,mode);
    return [changes.creates,changes.updates,changes.deleteIds].some(items=>items.length) || changes.layouts.some(layout=>!derivedLayouts.has(layoutKey(layout)) || JSON.stringify(layoutValues(derivedLayouts.get(layoutKey(layout))))!==JSON.stringify(layoutValues(layout)));
  }));
  const snapshot = () => ({ ...desired, error, pending: saving, dirty: dirty() });
  const publish = () => notify(snapshot());
  const initialize = (mode, origin) => {
    const added = initializeTextLayouts(desired.elements,desired.layouts,assetId,mode,origin);
    if (added.length) {for(const layout of added)derivedLayouts.set(layoutKey(layout),structuredClone(layout));desired = {...desired,layouts:[...desired.layouts,...added]}; publish(); }
    return added.length;
  };
  const draft = (mode, items, innerObjects) => {
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
    desired = {elements:[...elements.values()],layouts:[...layouts.values()]};
    if (innerObjects !== undefined) {
      const next = structuredClone(innerObjects);
      if (!next.length || (!running && acknowledgedInner.has(mode) && JSON.stringify(next) === JSON.stringify(acknowledgedInner.get(mode)))) innerPending.delete(mode);
      else if (!innerPending.has(mode) || JSON.stringify(next) !== JSON.stringify(innerPending.get(mode))) innerPending.set(mode,next);
    }
    if (!running && !dirty()) error='';
    publish();
  };
  const flush = ({once = false} = {}) => {
    if (running) return once ? running : running.then(() => snapshot().dirty ? flush() : undefined);
    saving = true;
    const frozen = once ? structuredClone(desired) : null;
    const frozenInner = once ? new Map(innerPending) : null;
    const frozenExternal = once ? externalPending : null;
    const modes = [currentMode,...viewModes.filter(m=>m!==currentMode)];
    running = (async () => {
      error = ''; publish();
      for (;;) {
        let wrote = false;
        for (const mode of modes) {
          const target = frozen || structuredClone(desired);
          const pendingObjects = (frozenInner || innerPending).get(mode);
          const innerObjects = pendingObjects || [];
          const changes = textChanges(saved,target,mode,innerObjects);
          const externalValue = once ? frozenExternal : externalPending;
          const external=externalValue?.mode===mode?externalValue:null;
          if (!external && ![changes.creates,changes.updates,changes.layouts,changes.deleteIds,changes.innerObjects].some(a=>a.length)) continue;
          if(external)await external.write(changes);else await persist(mode,changes);
          if(externalPending===external)externalPending=null;
          saved = {elements:target.elements,layouts:[...saved.layouts.filter(l=>l.viewMode !== mode && target.elements.some(e=>e.id === l.textId)),...target.layouts.filter(l=>l.viewMode === mode)]};
          for (const layout of changes.layouts) derivedLayouts.delete(layoutKey(layout));
          if (pendingObjects !== undefined) {
            acknowledgedInner.set(mode,structuredClone(innerObjects));
            const current = innerPending.get(mode);
            if (current === pendingObjects || (current && JSON.stringify(current) === JSON.stringify(innerObjects))) innerPending.delete(mode);
          }
          wrote = true;
        }
        if (once || !wrote) break;
      }
    })().catch(reason => {error = String(reason); publish(); throw reason;}).finally(()=>{running=null;saving=false;publish();});
    return running;
  };
  return {
    clipboard:[], initialize,draft,flush,
    saveOnce() {return dirty() ? flush({once:true}) : Promise.resolve();},
    seedInnerObjects(mode,objects) {if (!running && !innerPending.has(mode)) acknowledgedInner.set(mode,structuredClone(objects));},
    commitExternal(mode,write,options) {currentMode=mode;externalPending={mode,write};return flush(options);},
    snapshot,
    commit(mode,items,innerObjects) {draft(mode,items,innerObjects);return flush();},
    refresh(next) {if (!running && !error && !viewModes.map(mode=>textChanges(saved,desired,mode)).some(c=>[c.creates,c.updates,c.layouts,c.deleteIds].some(a=>a.length))) {saved=structuredClone(next);desired=structuredClone(next);publish();}},
  };
}
