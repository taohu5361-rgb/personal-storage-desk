import test from 'node:test';
import assert from 'node:assert/strict';
import { createNavigationController, parseRoutePath, createNavigationContext, recordNavigation, contextualBackPath, recentDomainPath, returnRoutePath } from './navigationState.js';

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const data = { workspaces: [{ id: 'w' }], categories: [{ id: 'c', workspaceId: 'w' }], assets: [{ id: 'a', workspaceId: 'w', categoryId: 'c' }] };
function fixture(flush = async () => true) {
  let path = 'assets/w?category=c';
  const writes = [], commits = [];
  const controller = createNavigationController({ initialPath: path, readPath: () => path,
    writePath: (next, options) => { path = next; writes.push({ path: next, ...options }); },
    commit: route => commits.push(route), flush });
  return { controller, writes, commits, path: () => path, external: next => { path = next; return controller.onHashChange(); } };
}

test('route parsing preserves complete queries and accepts existing hash formats', () => {
  const route = parseRoutePath('#/assets/w?category=c&search=%E4%B8%AD%E6%96%87%3F');
  assert.deepEqual(route.parts, ['assets', 'w']);
  assert.equal(route.query.get('search'), '中文?');
  assert.equal(parseRoutePath('').path, 'home');
});

test('program navigation waits for save once, then commits complete path', async () => {
  const gate = deferred(); let saves = 0;
  const f = fixture(() => { saves++; return gate.promise; });
  const navigating = f.controller.go('settings');
  assert.equal(f.path(), 'assets/w?category=c'); assert.equal(f.commits.length, 0);
  gate.resolve(true); assert.equal(await navigating, true);
  assert.equal(saves, 1); assert.equal(f.path(), 'settings');
  assert.deepEqual(f.writes, [{ path: 'settings', replace: false }]);
  assert.equal(f.commits[0].path, 'settings');
});

test('replace navigation does not append a history entry', async () => {
  const f = fixture(); assert.equal(await f.controller.go('scripts', { replace: true }), true);
  assert.deepEqual(f.writes, [{ path: 'scripts', replace: true }]);
});

test('failed program navigation retains current URL and route', async () => {
  const f = fixture(async () => false);
  assert.equal(await f.controller.go('settings'), false);
  assert.equal(f.path(), 'assets/w?category=c'); assert.equal(f.commits.length, 0); assert.equal(f.writes.length, 0);
});

test('failed hash navigation restores accepted URL without committing requested page', async () => {
  const f = fixture(async () => { throw Error('locked'); });
  assert.equal(await f.external('settings'), false);
  assert.equal(f.path(), 'assets/w?category=c');
  assert.deepEqual(f.writes, [{ path: 'assets/w?category=c', replace: true }]);
  assert.equal(f.commits.length, 0);
});

test('accepted browser navigation commits once without rewriting history', async () => {
  const f = fixture(); assert.equal(await f.external('asset/w/a'), true);
  assert.equal(f.writes.length, 0); assert.equal(f.commits.length, 1);
});

test('a slower earlier navigation cannot overwrite the later accepted route', async () => {
  const first = deferred(), second = deferred(); const gates = [first, second];
  const f = fixture(() => gates.shift().promise);
  const older = f.controller.go('settings'), newer = f.controller.go('scripts');
  second.resolve(true); assert.equal(await newer, true);
  first.resolve(true); assert.equal(await older, false);
  assert.equal(f.path(), 'scripts'); assert.equal(f.commits.length, 1);
});

test('rejected newer program request restores a superseded browser URL', async () => {
  const first = deferred(), second = deferred(); const gates = [first, second];
  const f = fixture(() => gates.shift().promise);
  const older = f.external('asset/w/a'), newer = f.controller.go('settings');
  second.resolve(false); assert.equal(await newer, false);
  first.resolve(true); assert.equal(await older, false);
  assert.equal(f.path(), 'assets/w?category=c'); assert.equal(f.commits.length, 0);
});

test('cleanup cancels delayed completion and same-page request adds no history', async () => {
  const gate = deferred(); const f = fixture(() => gate.promise);
  const pending = f.controller.go('settings'); f.controller.cancel(); gate.resolve(true);
  assert.equal(await pending, false); assert.equal(f.commits.length, 0);
  assert.equal(await f.controller.go('assets/w?category=c'), true); assert.equal(f.writes.length, 0);
});

test('React StrictMode effect replay retains startup restoration while a real unmount blocks commits', async () => {
  const gate=deferred(); const f=fixture(()=>gate.promise);
  const restoration=f.controller.go('scripts',{replace:true});
  f.controller.setActive(false); f.controller.setActive(true); gate.resolve(true);
  assert.equal(await restoration,true); assert.equal(f.path(),'scripts');
  const closingGate=deferred(); const unmounted=fixture(()=>closingGate.promise);
  const pending=unmounted.controller.go('settings'); unmounted.controller.setActive(false); closingGate.resolve(true);
  assert.equal(await pending,false); assert.equal(unmounted.commits.length,0);
});

test('settings and detail return retain their actual complete source', () => {
  let context = createNavigationContext();
  context = recordNavigation(context, 'assets/w?category=c&search=cloud', 'asset/w/a');
  context = recordNavigation(context, 'asset/w/a', 'settings');
  assert.equal(contextualBackPath(context, 'settings', data), 'asset/w/a');
  assert.equal(contextualBackPath(context, 'asset/w/a', data), 'assets/w?category=c&search=cloud');
  assert.equal(recentDomainPath(context, 'canvas', data), 'asset/w/a');
  assert.equal(recentDomainPath(context, 'scripts', data), 'scripts');
});

test('direct asset opens derive category while deleted source returns nearest valid parent', () => {
  const context = createNavigationContext();
  assert.equal(contextualBackPath(context, 'asset/w/a', data), 'assets/w?category=c');
  assert.equal(contextualBackPath(context, 'add-example/w/a', data), 'asset/w/a');
  assert.equal(returnRoutePath('asset/w/deleted', 'settings', data), 'assets/w');
  assert.equal(returnRoutePath('asset/deleted/a', 'settings', data), 'models');
});
