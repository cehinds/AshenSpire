// src/engine/epochWipe.js — the one-time HARD save wipe for the balance overhaul (owner, 2026-11-21).
//
// Data: content/config/ui/presentation/saves.json → epoch (a number). A browser whose stored epoch stamp is missing
// (counts as epoch 1) or lower than the configured epoch discards EVERY game key, run slots AND meta/profile, once;
// the new stamp is written first, so the wipe never repeats. Raising `epoch` in the config schedules the next one.
// Unlike src/engine/buildWipe.js (run slots only, dev toggle) this wipes profile data too and has no off switch.
// NEVER clears when the new stamp could not be written and read back (quota, blocked storage).
// Runs at boot BEFORE ApplyBuildWipe and before any save is read.

export const EPOCH_STAMP_KEY = 'sote_epoch_v1';

// Every key family the game writes to storage, one comment per key. Matching is by prefix.
export const GAME_KEY_PREFIXES = Object.freeze([
  'sote_run_v1', // run slots: sote_run_v1 (slot 1), sote_run_v1_s2, sote_run_v1_s3 (engine/saveArchive.js runKey)
  'sote_run_archived', // the archive drawer index: archived runs and profiles (engine/saveArchive.js)
  'sote_meta_v1', // meta/profile: settings, unlocks, run history (engine/saveMeta.js META_KEY)
  'sote_meta_backup_v1', // the meta backup mirror (engine/saveMeta.js META_BACKUP_KEY)
  'sote_profile_', // shared-profile copies sote_profile_<hash> that run saves reference (engine/saveSharedProfile.js)
  'sote_profilestamp_', // their stamps sote_profilestamp_<hash> (engine/saveSharedProfile.js)
  'sote_transfer_backup_v1', // the pre-restore backup of the save-transfer screen (engine/saveTransfer.js)
  'sote_build_stamp_v1', // the per-build wipe's stamp (engine/buildWipe.js); a fresh start needs no old stamp
]);

function gameKeys(storage) {
  const keys = [];
  for (let i = 0; i < (storage.length ?? 0); i += 1) {
    const k = storage.key(i);
    if (typeof k === 'string' && k !== EPOCH_STAMP_KEY && GAME_KEY_PREFIXES.some((p) => k.startsWith(p))) keys.push(k);
  }
  return keys;
}

function readEpoch(storage) {
  let raw = null;
  try { raw = storage.getItem(EPOCH_STAMP_KEY); } catch { /* blocked storage */ }
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n >= 1 ? n : 1; // no (or unreadable) stamp: epoch 1
}

/**
 * ApplyEpochWipe(storage, { epoch }) → { cleared: boolean, keys: number, previous: number }
 * `cleared` is true only when at least one key was removed (the notice shows then).
 */
export function ApplyEpochWipe(storage, { epoch }) {
  const previous = readEpoch(storage);
  if (!(Number.isFinite(epoch) && previous < epoch)) return { cleared: false, keys: 0, previous };
  const keys = gameKeys(storage);
  // Stamp FIRST and read it back: only a verified stamp makes the wipe safe (else the next boot would wipe again, or a
  // session that cannot persist would delete saves it cannot mark).
  let stamped = false;
  try { storage.setItem(EPOCH_STAMP_KEY, String(epoch)); stamped = storage.getItem(EPOCH_STAMP_KEY) === String(epoch); } catch { /* full or blocked: no wipe */ }
  if (!stamped) return { cleared: false, keys: 0, previous };
  for (const k of keys) storage.removeItem(k);
  return { cleared: keys.length > 0, keys: keys.length, previous };
}
