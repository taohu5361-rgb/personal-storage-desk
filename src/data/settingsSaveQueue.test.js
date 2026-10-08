import test from 'node:test';
import assert from 'node:assert/strict';
import { createSettingsSaveQueue } from './settingsSaveQueue.js';
import { createCloseRequestHandler } from '../closeLifecycle.js';
import { createNavigationController } from '../hooks/navigationState.js';
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

test('rapid full-setting changes remain serialized and flush waits for every queued write', async () => {
  const gate = deferred(); const writes = []; let active = 0, maximum = 0;
  const queue = createSettingsSaveQueue({ persist: async snapshot => {
    maximum = Math.max(maximum, ++active); writes.push(snapshot);
    if (writes.length === 1) await gate.promise;
    active--;
  } });
  void queue.submit({ theme: 'dark', uiScale: 100 });
  void queue.submit({ theme: 'dark', uiScale: 125 });
  let flushed = false; const flushing = queue.flush().then(() => { flushed = true; });
  await Promise.resolve(); assert.equal(flushed, false); assert.equal(queue.snapshot().pending, 2);
  gate.resolve(); await flushing;
  assert.equal(maximum, 1); assert.deepEqual(writes, [{ theme: 'dark', uiScale: 100 }, { theme: 'dark', uiScale: 125 }]);
  assert.equal(queue.snapshot().pending, 0);
});

test('flush also waits for edits added while a prior save is still running', async () => {
  const gate = deferred(); const writes = [];
  const queue = createSettingsSaveQueue({ persist: async value => { writes.push(value); if (writes.length === 1) await gate.promise; } });
  void queue.submit({ theme: 'dark' }); const flushing = queue.flush();
  void queue.submit({ theme: 'light' }); gate.resolve(); await flushing;
  assert.deepEqual(writes, [{ theme: 'dark' }, { theme: 'light' }]);
});

test('last failed snapshot survives rollback and retry persists exact requested values', async () => {
  let fail = true; const writes = [], failures = [];
  const queue = createSettingsSaveQueue({ persist: async value => { if (fail) throw Error('disk locked'); writes.push(value); }, onFailed: value => failures.push(value) });
  assert.equal(await queue.submit({ theme: 'dark', uiScale: 125 }), false);
  await assert.rejects(queue.flush(), /disk locked/);
  assert.deepEqual(queue.snapshot().failedSnapshot, { theme: 'dark', uiScale: 125 });
  assert.equal(failures.length, 1);
  fail = false; assert.equal(await queue.retry(), true); assert.equal(await queue.flush(), true);
  assert.deepEqual(writes, [{ theme: 'dark', uiScale: 125 }]); assert.equal(queue.snapshot().error, '');
});

test('an obsolete failed write does not roll back a newer successfully persisted snapshot', async () => {
  const writes = [], failures = [];
  const queue = createSettingsSaveQueue({ persist: async value => { writes.push(value); if (writes.length === 1) throw Error('transient'); }, onFailed: value => failures.push(value) });
  void queue.submit({ theme: 'dark', uiScale: 100 });
  void queue.submit({ theme: 'dark', uiScale: 125 });
  await queue.flush(); assert.equal(failures.length, 0); assert.equal(queue.snapshot().error, '');
  assert.deepEqual(writes.at(-1), { theme: 'dark', uiScale: 125 });
});

test('settings failure blocks native close and explicit retry permits closing afterwards', async () => {
  let fail = true, finishes = 0; const errors = [];
  const queue = createSettingsSaveQueue({ persist: async () => { if (fail) throw Error('locked'); } });
  await queue.submit({ theme: 'dark' });
  const close = createCloseRequestHandler({ flush: async () => { try { await queue.flush(); return true; } catch { return false; } }, finish: async () => { finishes++; }, onError: error => errors.push(error) });
  assert.equal(await close(), false); assert.equal(finishes, 0); assert.match(errors.at(-1), /尚未保存/);
  fail = false; await queue.retry(); assert.equal(await close(), true); assert.equal(finishes, 1);
});

test('leaving settings waits for IPC persistence and failed persistence retains the settings route', async () => {
  const gate=deferred(); let path='settings'; const commits=[];
  const queue=createSettingsSaveQueue({persist:()=>gate.promise});
  void queue.submit({theme:'dark'});
  const navigation=createNavigationController({initialPath:path,readPath:()=>path,writePath:next=>{path=next;},commit:route=>commits.push(route.path),flush:()=>queue.flush()});
  const leaving=navigation.go('assets/w?category=c');
  await Promise.resolve(); assert.equal(path,'settings'); assert.deepEqual(commits,[]);
  gate.resolve(); assert.equal(await leaving,true); assert.equal(path,'assets/w?category=c');

  const failedQueue=createSettingsSaveQueue({persist:async()=>{throw Error('IPC failed');}});
  await failedQueue.submit({theme:'light'}); path='settings';
  const protectedNavigation=createNavigationController({initialPath:path,readPath:()=>path,writePath:next=>{path=next;},commit:()=>{},flush:()=>failedQueue.flush()});
  assert.equal(await protectedNavigation.go('home'),false); assert.equal(path,'settings');
});

test('layout changes keep every other setting while rapid choices persist in order', async () => {
  const gate = deferred(); const writes = [];
  const original = { theme: 'dark', uiScale: 125, confirmDelete: true, managedAssetDir: 'fixture-assets', lastPage: 'assets/w?category=c', propertyPanelLayout: 'right' };
  const queue = createSettingsSaveQueue({ persist: async snapshot => { writes.push(snapshot); if (writes.length === 1) await gate.promise; } });
  void queue.submit({ ...original, propertyPanelLayout: 'bottom' });
  void queue.submit({ ...original, propertyPanelLayout: 'right' });
  gate.resolve(); await queue.flush();
  assert.deepEqual(writes, [{ ...original, propertyPanelLayout: 'bottom' }, original]);
});

test('failed layout save rolls back the visible choice, blocks leaving and retries the complete snapshot', async () => {
  let fail = true, route = 'settings';
  const original = { theme: 'light', uiScale: 100, autoSave: false, askImportMode: true, propertyPanelLayout: 'right' };
  const requested = { ...original, propertyPanelLayout: 'bottom' };
  let visible = requested, confirmed = original; const writes = [];
  const queue = createSettingsSaveQueue({
    persist: async snapshot => { if (fail) throw Error('settings locked'); writes.push(snapshot); },
    onSaved: snapshot => { confirmed = snapshot; },
    onFailed: () => { visible = confirmed; },
  });
  assert.equal(await queue.submit(requested), false);
  assert.deepEqual(visible, original);
  assert.deepEqual(queue.snapshot().failedSnapshot, requested);
  const navigation = createNavigationController({ initialPath: route, readPath: () => route, writePath: next => { route = next; }, commit: () => {}, flush: () => queue.flush() });
  assert.equal(await navigation.go('assets/w?category=c'), false);
  assert.equal(route, 'settings');
  fail = false; visible = queue.snapshot().failedSnapshot;
  assert.equal(await queue.retry(), true);
  assert.deepEqual(writes, [requested]); assert.deepEqual(visible, confirmed);
  assert.equal(await navigation.go('assets/w?category=c'), true);
});
