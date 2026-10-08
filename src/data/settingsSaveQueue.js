// Serial full-snapshot writes keep rapid changes ordered. The last failed
// snapshot remains retryable even after the UI rolls back to confirmed values.
export function createSettingsSaveQueue({ persist, onSaved = () => {}, onFailed = () => {}, onState = () => {} }) {
  let tail = Promise.resolve();
  let version = 0;
  let pending = 0;
  let failure = null;
  const state = () => ({ pending, error: failure ? String(failure.error) : '', failedSnapshot: failure?.snapshot || null });
  const submit = snapshot => {
    const ticket = ++version;
    const savedSnapshot = { ...snapshot };
    failure = null;
    pending++;
    onState(state());
    const task = tail.then(async () => {
      try {
        await persist(savedSnapshot);
        onSaved(savedSnapshot);
        if (ticket === version) failure = null;
        return true;
      } catch (error) {
        if (ticket === version) {
          failure = { snapshot: savedSnapshot, error };
          onFailed(savedSnapshot, error);
        }
        return false;
      } finally {
        pending--;
        onState(state());
      }
    });
    tail = task.then(() => {});
    return task;
  };
  return {
    submit,
    snapshot: state,
    retry: () => failure ? submit(failure.snapshot) : Promise.resolve(true),
    async flush() {
      let observed;
      do { observed = tail; await observed; } while (observed !== tail);
      if (failure) throw failure.error;
      return true;
    },
  };
}
