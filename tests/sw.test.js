import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Minimal service-worker globals; sw.js registers its handlers on import.
const handlers = new Map();
const fake = { existing: [], deleted: [], added: [], claimed: 0, skipped: 0, matchFor: () => undefined };
globalThis.self = globalThis;
globalThis.addEventListener = (type, fn) => handlers.set(type, fn);
globalThis.skipWaiting = () => { fake.skipped += 1; return Promise.resolve(); };
globalThis.clients = { claim: () => { fake.claimed += 1; return Promise.resolve(); } };
globalThis.location = { origin: 'http://127.0.0.1:8000' };
globalThis.caches = {
  keys: () => Promise.resolve([...fake.existing]),
  delete: (name) => { fake.deleted.push(name); return Promise.resolve(true); },
  open: () => Promise.resolve({
    addAll: (list) => { fake.added.push(list); return Promise.resolve(); },
    put: () => Promise.resolve(),
  }),
  match: (req) => Promise.resolve(fake.matchFor(req)),
};

await import('../sw.js');

// No skipWaiting/clients.claim (F012): taking over open tabs mid-navigation could mix
// HTML from one cache version with modules from another.

function dispatch(type, extra = {}) {
  let waited;
  let responded;
  handlers.get(type)({
    ...extra,
    waitUntil: (p) => { waited = p; },
    respondWith: (p) => { responded = p; },
  });
  return { waited, responded };
}

test('activate deletes only older just-breathe caches', async () => {
  fake.existing = ['just-breathe-v0', 'just-breathe-v1', 'just-breathe-v4', 'other-app-v4', 'unrelated'];
  fake.deleted = [];
  fake.claimed = 0;
  await dispatch('activate').waited;
  assert.deepEqual(fake.deleted, ['just-breathe-v0', 'just-breathe-v1']);
  assert.equal(fake.claimed, 0);
});

test('install precaches every asset and each exists on disk', async () => {
  fake.added = [];
  fake.skipped = 0;
  await dispatch('install').waited;
  assert.equal(fake.skipped, 0);
  assert.equal(fake.added.length, 1);
  const assets = fake.added[0];
  assert.ok(assets.includes('./js/wakelock.js'));
  assert.ok(assets.includes('./js/patterns.js'));
  for (const a of assets) {
    const rel = a === './' ? 'index.html' : a.replace(/^\.\//, '');
    assert.ok(existsSync(join(ROOT, rel)), `missing on disk: ${a}`);
  }
});

test('offline navigation falls back to cached index.html', async () => {
  const sentinel = new Response('shell');
  fake.matchFor = (req) => (req === './index.html' ? sentinel : undefined);
  const realFetch = globalThis.fetch;
  globalThis.fetch = () => Promise.reject(new TypeError('offline'));
  try {
    // Node's Request rejects mode 'navigate', so a plain request-shaped object stands in.
    const request = { method: 'GET', url: 'http://127.0.0.1:8000/', mode: 'navigate' };
    const res = await dispatch('fetch', { request }).responded;
    assert.equal(res, sentinel);
  } finally {
    globalThis.fetch = realFetch;
    fake.matchFor = () => undefined;
  }
});
