// A SANDBOXED FRAME CAN START A RUN (owner, 2026-10-11: "can't start game on
// the review page"). The branch preview runs the build in a sandboxed iframe
// that refuses localStorage and the Web Locks API; the game falls back to
// memory storage, and that storage must not ask for the cross-tab profile
// lock, whose SecurityError failed every run start. A real browser profile
// (localStorage) keeps the lock.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createBrowserSaveManager } from '../src/engine/browserSave.js';

const memory = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), key: i => [...m.keys()][i] ?? null, get length() { return m.size; } }; };
const deniedLocks = { request: () => Promise.reject(Object.assign(new Error('Access to the Locks API is denied in this context.'), { name: 'SecurityError' })) };

test('a denied Web Lock fails the profile write, which is why memory storage must not ask for one', async () => {
  const locked = await createBrowserSaveManager(memory(), { locks: deniedLocks }).ensureProfile();
  assert.equal(locked.ok, false);
  const unlocked = await createBrowserSaveManager(memory(), { locks: null }).ensureProfile();
  assert.equal(unlocked.ok, true, 'memory storage with no lock creates the profile');
});

test('main.js hands the profile lock only to persistent (localStorage) saves', () => {
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(source, /persistentStorage = bootStorage === window\.localStorage/);
  assert.match(source, /createBrowserSaveManager\(bootStorage, \{ locks: persistentStorage \? navigator\.locks : null \}\)/);
});
