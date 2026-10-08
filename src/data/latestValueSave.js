// A view's intermediate positions are replaceable; acknowledged writes are not.
// Keep only the latest draft, retain failed drafts, and drain synchronously for leave.
export function createLatestValueSave(persist, {
  delay = 220,
  notify = () => {},
  equal = (a, b) => JSON.stringify(a) === JSON.stringify(b),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  let value, acknowledgedValue, initialized = false, revision = 0, savedRevision = 0, running = null, timer = null;
  let ready = false, error = '', failedRevision = -1;
  const snapshot = () => ({dirty: revision !== savedRevision, pending: !!running, error});
  const publish = () => notify(snapshot());
  const cancelTimer = () => {if (timer !== null) clearTimer(timer); timer = null;};
  const save = () => {
    if (running) return running;
    if (revision === savedRevision) return Promise.resolve();
    if (error && failedRevision === revision) return Promise.reject(Error(error));
    const target = value, targetRevision = revision;
    error = ''; failedRevision = -1;
    running = Promise.resolve().then(() => persist(target)).then(() => {
      acknowledgedValue = target;
      savedRevision = equal(value,target) ? revision : targetRevision;
    }).catch(reason => {
      error = String(reason); failedRevision = targetRevision; throw reason;
    }).finally(() => {
      running = null; publish();
      if (ready && timer === null && revision !== savedRevision && failedRevision !== revision) {
        void save().catch(() => {});
      }
    });
    publish();
    return running;
  };
  const draft = (next, {schedule = true} = {}) => {
    if (initialized && equal(value, next)) return;
    value = structuredClone(next); initialized = true; revision++; ready = false;
    if (!running && acknowledgedValue !== undefined && equal(value,acknowledgedValue)) {
      savedRevision = revision; error = ''; failedRevision = -1;
    }
    cancelTimer();
    if (schedule && revision !== savedRevision) timer = setTimer(() => {timer = null; ready = true; void save().catch(() => {});}, delay);
    publish();
  };
  const flush = async () => {
    cancelTimer(); ready = true;
    while (revision !== savedRevision || running) await save();
  };
  const saveOnce = () => {cancelTimer();ready=false;return save();};
  return {
    draft, flush, saveOnce, flushOnce:saveOnce, snapshot,
    seed(initial) {if (!running && revision === savedRevision) {value = structuredClone(initial); acknowledgedValue = value; initialized = true;}},
    retry() {error = ''; failedRevision = -1; publish(); return flush();},
    stopTimer: cancelTimer,
  };
}
