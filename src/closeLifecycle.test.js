import test from 'node:test';
import assert from 'node:assert/strict';
import { createCloseRequestHandler } from './closeLifecycle.js';

test('overlapping close requests flush and finish once, in that order', async () => {
  let release; const gate = new Promise(resolve => { release = resolve; });
  const calls = [];
  const close = createCloseRequestHandler({
    flush: async () => { calls.push('flush'); await gate; return true; },
    finish: async () => { calls.push('finish'); }, onError: () => {},
  });
  const first = close(); const second = close();
  assert.equal(first, second); await Promise.resolve();
  assert.deepEqual(calls, ['flush']); release();
  assert.equal(await first, true); assert.deepEqual(calls, ['flush', 'finish']);
});

test('failed save keeps the window and permits retry', async () => {
  let saved = false, finishes = 0; const errors = [];
  const close = createCloseRequestHandler({ flush: async () => saved,
    finish: async () => { finishes++; }, onError: error => errors.push(error) });
  assert.equal(await close(), false); assert.equal(finishes, 0); assert.match(errors[0], /尚未保存/);
  saved = true; assert.equal(await close(), true); assert.equal(finishes, 1); assert.equal(errors.at(-1), '');
});

test('native close errors stay visible and a later request retries', async () => {
  let failed = true; const errors = [];
  const close = createCloseRequestHandler({ flush: async () => true,
    finish: async () => { if (failed) throw new Error('database is locked'); }, onError: error => errors.push(error) });
  assert.equal(await close(), false); assert.match(errors[0], /database is locked/);
  failed = false; assert.equal(await close(), true);
});
