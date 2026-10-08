import test from 'node:test';
import assert from 'node:assert/strict';
import { createPersistenceQueue } from './persistenceQueue.js';

test('navigation waits for queued writes and rejects a retained failure', async () => {
  let release; const gate = new Promise(resolve => { release = resolve; });
  const queue = createPersistenceQueue(); let saved = false;
  const write = queue.write('layout', async () => { await gate; throw Error('disk full'); });
  const flush = queue.flush().then(() => { saved = true; });
  assert.equal(queue.snapshot().pending, 1); assert.equal(saved, false);
  release(); await assert.rejects(write, /disk full/); await assert.rejects(flush, /disk full/);
  assert.equal(queue.snapshot().pending, 0); assert.match(queue.snapshot().error, /disk full/);
});
test('retry clears a failure only when the write actually succeeds', async () => {
  let fail = true; const queue = createPersistenceQueue();
  await assert.rejects(queue.write('viewport', () => { if (fail) throw Error('offline'); }));
  await assert.rejects(queue.retry(), /offline/); fail = false; await queue.retry();
  await queue.flush(); assert.deepEqual(queue.snapshot(), { pending: 0, error: '' });
});
test('a newer successful snapshot supersedes an older failed resource', async () => {
  const queue = createPersistenceQueue(); const writes = [];
  const first = queue.write('layout', () => { throw Error('old failure'); });
  const last = queue.write('layout', () => { writes.push('latest'); });
  await assert.rejects(first); await last; await queue.flush();
  assert.deepEqual(writes, ['latest']); assert.equal(queue.snapshot().error, '');
});
test('a controller-owned transaction retains its own retry without creating a competing retry', async () => {
  const queue = createPersistenceQueue();
  await assert.rejects(queue.write('transform', () => {throw Error('transaction failed')}, {retainFailure:false}));
  assert.equal(queue.snapshot().error, '');
  await queue.flush();
});
