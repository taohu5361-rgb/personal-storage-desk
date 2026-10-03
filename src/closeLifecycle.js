// A second close request shares the active save/close operation. Failed saves
// leave the window intact and allow the next request to retry.
export function createCloseRequestHandler({ flush, finish, onError }) {
  let pending = null;
  return () => {
    if (pending) return pending;
    pending = Promise.resolve().then(async () => {
      if (!await flush()) {
        onError('内容尚未保存，窗口已保留。请重试保存后再次关闭。');
        return false;
      }
      await finish();
      onError('');
      return true;
    }).catch(error => {
      onError(`无法关闭窗口：${String(error)}。窗口已保留，请重试。`);
      return false;
    }).finally(() => { pending = null; });
    return pending;
  };
}
