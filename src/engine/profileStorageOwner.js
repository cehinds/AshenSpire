// Serialize complete read/merge/write operations. The browser supplies its
// per-profile Web Lock; engine callers supply a lock or share this owner queue.
// Fresh profile reads belong INSIDE the supplied operation, after lock entry.
const tails = new Map();

export function createProfileStorageOwner({ key, requestLock = null } = {}) {
  if (typeof key !== 'string' || !key || key.length > 256) throw new Error('A profile storage owner requires a bounded key');
  if (requestLock !== null && typeof requestLock !== 'function') throw new Error('Profile locking requires a request function');
  return {
    mutate(operation) {
      if (typeof operation !== 'function') return Promise.reject(new Error('Profile mutation requires an operation'));
      const previous = tails.get(key) || Promise.resolve();
      const run = previous.catch(() => {}).then(() => requestLock
        ? requestLock(`ashen-spire-profile:${key}`, operation)
        : operation());
      // Failed writes release ownership; the next writer still gets a fresh
      // read and may retry its independently captured pending receipts.
      const settled = run.catch(() => {});
      tails.set(key, settled);
      settled.then(() => { if (tails.get(key) === settled) tails.delete(key); });
      return run;
    },
  };
}
