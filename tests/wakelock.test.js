import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWakeLock } from '../js/wakelock.js';

function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function fakeSentinel() {
  return {
    released: false,
    release() { this.released = true; this.releases = (this.releases || 0) + 1; return Promise.resolve(); },
  };
}

function fakeNav() {
  const nav = { calls: 0, pending: [] };
  nav.wakeLock = {
    request: () => { nav.calls += 1; const d = deferred(); nav.pending.push(d); return d.promise; },
  };
  return nav;
}

test('release before request resolves releases the late sentinel once', async () => {
  const nav = fakeNav();
  const lock = createWakeLock(nav);
  const acquired = lock.acquire();
  lock.release();
  const s = fakeSentinel();
  nav.pending[0].resolve(s);
  await acquired;
  assert.equal(s.releases, 1);
  assert.equal(lock.held, false);
});

test('two acquire() calls before resolve keep one sentinel and release the other', async () => {
  const nav = fakeNav();
  const lock = createWakeLock(nav);
  const a = lock.acquire();
  const b = lock.acquire();
  assert.equal(nav.calls, 2);
  const s1 = fakeSentinel();
  const s2 = fakeSentinel();
  nav.pending[0].resolve(s1);
  nav.pending[1].resolve(s2);
  await Promise.all([a, b]);
  assert.equal(lock.held, true);
  assert.equal([s1, s2].filter((s) => !s.released).length, 1);
  assert.equal((s1.releases || 0) + (s2.releases || 0), 1);
});

test('acquire, release, acquire all before either resolves holds the second lock', async () => {
  const nav = fakeNav();
  const lock = createWakeLock(nav);
  const first = lock.acquire();
  lock.release();
  const second = lock.acquire();
  assert.equal(nav.calls, 2);
  const s1 = fakeSentinel();
  nav.pending[0].resolve(s1);
  await first;
  assert.equal(s1.releases, 1);
  assert.equal(lock.held, false);
  const s2 = fakeSentinel();
  nav.pending[1].resolve(s2);
  await second;
  assert.equal(lock.held, true);
  assert.equal(s2.releases, undefined);
});

test('acquire, release, acquire again requests a fresh lock', async () => {
  const nav = fakeNav();
  const lock = createWakeLock(nav);
  const first = lock.acquire();
  const s = fakeSentinel();
  nav.pending[0].resolve(s);
  await first;
  assert.equal(lock.held, true);
  lock.release();
  assert.equal(s.releases, 1);
  assert.equal(lock.held, false);
  const second = lock.acquire();
  assert.equal(nav.calls, 2);
  nav.pending[1].resolve(fakeSentinel());
  await second;
  assert.equal(lock.held, true);
});

test('rejected request is ignored', async () => {
  const nav = fakeNav();
  const lock = createWakeLock(nav);
  const p = lock.acquire();
  nav.pending[0].reject(new Error('NotAllowedError'));
  await p;
  assert.equal(lock.held, false);
});

test('navigator without wakeLock is a no-op', async () => {
  const lock = createWakeLock({});
  await lock.acquire();
  assert.equal(lock.held, false);
});

test('system-released sentinel is re-requested on next acquire', async () => {
  const nav = fakeNav();
  const lock = createWakeLock(nav);
  const first = lock.acquire();
  const s = fakeSentinel();
  nav.pending[0].resolve(s);
  await first;
  s.released = true;
  assert.equal(lock.held, false);
  const second = lock.acquire();
  assert.equal(nav.calls, 2);
  nav.pending[1].resolve(fakeSentinel());
  await second;
  assert.equal(lock.held, true);
});
