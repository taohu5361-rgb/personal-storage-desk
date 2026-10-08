// Serial writes retain the latest failed operation per resource for an explicit retry.
export function createPersistenceQueue(notify = () => {}) {
  let tail = Promise.resolve(), pending = 0;
  const failed = new Map(), versions = new Map();
  const snapshot = () => ({ pending, error: [...failed.values()].map(item => item.error).join('；') });
  const publish = () => notify(snapshot());
  const write = (key, operation, {retainFailure = true} = {}) => {
    const version = (versions.get(key) || 0) + 1;
    versions.set(key, version);
    pending++; publish();
    const task = tail.then(operation).then(value => {
      if (versions.get(key) === version) failed.delete(key);
      return value;
    }).catch(error => {
      if (retainFailure && versions.get(key) === version) failed.set(key, { operation, error: String(error) });
      throw error;
    }).finally(() => { pending--; publish(); });
    tail = task.catch(() => {});
    return task;
  };
  return {
    write, snapshot,
    async flush() { for (;;) { const current = tail; await current; if (current === tail) break; } if (failed.size) throw Error(snapshot().error); },
    async retry() { const jobs = [...failed.entries()].map(([key, item]) => write(key, item.operation)); await Promise.all(jobs); await this.flush(); },
  };
}
