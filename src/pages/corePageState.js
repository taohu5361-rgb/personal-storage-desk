export function filterScripts(scripts, query) {
  const search=String(query || '').trim().toLocaleLowerCase();
  return scripts.filter(script=>[script.name,script.description,script.filePath,script.launchCommand].some(value=>String(value || '').toLocaleLowerCase().includes(search)));
}

// Repeated navigation/close requests share one discard decision. Refusing it
// rejects the existing navigation guard without changing the current draft.
export function createDraftLeaveGuard({isDirty,isSaving,onRequest,onAccept=()=>{},onResolve=()=>{}}) {
  let pending=null;
  let resolveDecision;
  return {
    request() {
      if (isSaving()) return Promise.reject(new Error('样图正在保存，请等待保存完成。'));
      if (!isDirty()) return Promise.resolve(true);
      if (pending) return pending;
      pending=new Promise(resolve=>{resolveDecision=resolve;});
      onRequest();
      return pending;
    },
    resolve(accepted) {
      if (!pending) return;
      const resolve=resolveDecision;
      pending=null;resolveDecision=null;
      if (accepted) onAccept();
      onResolve();
      resolve(Boolean(accepted));
    },
    dispose() {
      if (resolveDecision) resolveDecision(false);
      pending=null;resolveDecision=null;
    },
  };
}
