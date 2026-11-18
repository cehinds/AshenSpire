// src/engine/buildWipe.js — dev-only "new build clears old run saves" (owner, 2026-11-18).
//
// Toggle: content/config/ui/presentation/saves.json → behavior.discardOnNewBuild.
// Identifier: BuildSaveId() = BUILD_VERSION plus the source digest when the page
// was stamped. The digest changes with every built change, so it is the most
// reliable "different build" signal; the ordinal alone moves only on a push to test.
//
// CLEARED when ON and the stamp differs (or is absent while run saves exist):
//   every run slot key (sote_run_v1, sote_run_v1_s2, ...).
// KEPT: meta/profile (settings, unlocks, history), meta backup, the archive drawer.
// NEVER cleared when the new stamp could not be written (quota, blocked storage).
// OFF: nothing is deleted and the stamp is still written; the load/migration path is untouched.

import { RUN_KEY } from './saveArchive.js';

export const BUILD_STAMP_KEY = 'sote_build_stamp_v1';

export function BuildSaveId({ version, source }) {
  return source && source !== 'UNSTAMPED' ? `${version}+${source}` : String(version);
}

function runKeys(storage) {
  const keys = [];
  for (let i = 0; i < (storage.length ?? 0); i += 1) {
    const k = storage.key(i);
    if (typeof k === 'string' && (k === RUN_KEY || k.startsWith(`${RUN_KEY}_s`))) keys.push(k);
  }
  return keys;
}

/**
 * ApplyBuildWipe(storage, { enabled, buildId }) → { cleared: boolean, slots: number, previous: string|null }
 * Writes the current stamp afterwards, so saves written from here on carry it.
 */
export function ApplyBuildWipe(storage, { enabled, buildId }) {
  let previous = null;
  try { previous = storage.getItem(BUILD_STAMP_KEY); } catch { /* blocked storage */ }
  const keys = runKeys(storage);
  // The new stamp is written FIRST and read back: if storage refuses it (quota, blocked), nothing is wiped this session, so the same
  // build's saves are never deleted at the next boot for want of a stamp. Only a verified stamp makes the wipe safe.
  let stamped = previous === buildId;
  if (!stamped) {
    try { storage.setItem(BUILD_STAMP_KEY, buildId); stamped = storage.getItem(BUILD_STAMP_KEY) === buildId; } catch { /* full or blocked: no wipe, the next boot retries */ }
  }
  const stale = enabled === true && stamped && keys.length > 0 && previous !== buildId;
  if (stale) for (const k of keys) storage.removeItem(k);
  return { cleared: stale, slots: stale ? keys.length : 0, previous };
}
