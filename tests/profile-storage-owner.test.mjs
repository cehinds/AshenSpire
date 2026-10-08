import assert from 'node:assert/strict';
import { createProfileStorageOwner } from '../src/engine/profileStorageOwner.js';
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
let current = { receipts: [] };
const order = [], gate = deferred();
let active = 0;
const requestLock = async (name, operation) => {
  assert.equal(name, 'ashen-spire-profile:probe');
  assert.equal(active++, 0);
  try { return await operation(); } finally { active--; }
};
const first = createProfileStorageOwner({ key: 'probe', requestLock });
const second = createProfileStorageOwner({ key: 'probe', requestLock });
const a = first.mutate(async () => {
  order.push('first-read'); const fresh = structuredClone(current);
  await gate.promise; fresh.receipts.push('a'); current = fresh; order.push('first-write');
});
const b = second.mutate(() => {
  order.push('second-read'); const fresh = structuredClone(current);
  fresh.receipts.push('b'); current = fresh; order.push('second-write'); return 'saved';
});
await Promise.resolve(); await Promise.resolve();
assert.deepEqual(order, ['first-read']); gate.resolve();
assert.equal(await b, 'saved'); await a;
assert.deepEqual(current.receipts, ['a', 'b']);
assert.deepEqual(order, ['first-read', 'first-write', 'second-read', 'second-write']);
await assert.rejects(first.mutate(() => { throw new Error('storage unavailable'); }), /storage unavailable/);
assert.equal(await second.mutate(() => current.receipts.length), 2);
await assert.rejects(first.mutate(null), /operation/);
assert.throws(() => createProfileStorageOwner({ key: '' }), /bounded key/);
// Without a browser lock, independent owners in the same storage process
// still serialize. Different profiles do not block one another.
const blocked = deferred(), started = deferred();
const localA = createProfileStorageOwner({ key: 'local' });
const localB = createProfileStorageOwner({ key: 'local' });
let following = false;
const held = localA.mutate(async () => { started.resolve(); await blocked.promise; });
await started.promise;
const followingWrite = localB.mutate(() => { following = true; });
assert.equal(await createProfileStorageOwner({ key: 'other' }).mutate(() => 7), 7);
assert.equal(following, false); blocked.resolve(); await held; await followingWrite;
assert.equal(following, true);
console.log('PASS profile storage ownership: fresh reads inside serialized locks, no lost union updates, rejection releases and independent profile queues');
