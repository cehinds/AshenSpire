import { createSaveManager, META_KEY } from './save.js';
import { createProfileStorageOwner } from './profileStorageOwner.js';
import { bankRunEnemyKnowledge } from './enemyKnowledgeSave.js';
const profileBase = Symbol('profile read baseline');
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
function applyChanges(incoming, baseline, current) {
  const next = structuredClone(current);
  for (const key of new Set([...Object.keys(baseline || {}), ...Object.keys(incoming)])) {
    if (JSON.stringify(incoming[key]) === JSON.stringify(baseline?.[key])) continue;
    if (!Object.hasOwn(incoming, key)) delete next[key];
    else next[key] = plain(incoming[key]) && plain(baseline?.[key]) && plain(current[key])
      ? applyChanges(incoming[key], baseline[key], current[key]) : structuredClone(incoming[key]);
  }
  return next;
}

// Synchronous run storage and profile reads use a manager that cannot write a
// profile. Every profile mutation, including recovery and replacement, enters
// the same origin-wide owner before its fresh read/merge/write operation.
export function createBrowserSaveManager(storage, { locks = null } = {}) {
  const reader = createSaveManager(storage, { readOnlyProfile: true });
  const writer = createSaveManager(storage);
  const owner = createProfileStorageOwner({ key: META_KEY,
    requestLock: locks?.request ? (name, operation) => locks.request(name, operation) : null });
  const facade = { ...reader,
    loadMeta: () => { const meta = reader.loadMeta(); meta[profileBase] = structuredClone(meta); return meta; },
    saveMeta: incoming => {
      const captured = structuredClone(incoming), baseline = incoming[profileBase];
      return owner.mutate(() => {
        const current = writer.loadMeta();
        const next = baseline ? applyChanges(captured, baseline, current) : captured;
        for (const key of ['found', 'discoveredArmaments', 'unlocked', 'seen']) if (Array.isArray(captured[key])) next[key] = [...new Set([...(current[key] || []), ...captured[key]])];
        for (const [key, identity, limit] of [['discoveryReceipts', row => row.pieceId, 64], ['results', row => row.finishId || JSON.stringify(row), 20]]) {
          if (!Array.isArray(captured[key])) continue;
          next[key] = [...new Map([...(current[key] || []), ...captured[key]].map(row => [identity(row), row])).values()].slice(-limit);
        }
        return writer.saveMeta(next);
      }).catch(error => ({ ok: false, reason: error.message }));
    },
    withProfile: operation => owner.mutate(() => operation(writer)),
    bankEnemyKnowledge: run => bankRunEnemyKnowledge(writer, owner, run),
    ready: owner.mutate(() => { writer.loadMeta(); return writer.hasRun() ? writer.ensureProfile() : { ok: true }; }).catch(error => ({ ok: false, reason: error.message })),
  };
  for (const name of ['ensureProfile', 'bankClassMastery', 'recordResult', 'restoreProfile', 'startNewProfile']) {
    facade[name] = (...args) => owner.mutate(() => {
      writer.loadMeta();
      return writer[name](...args);
    }).catch(error => ({ ok: false, reason: error.message }));
  }
  return facade;
}
