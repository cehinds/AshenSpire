// src/engine/saveSharedProfile.js — the shared copies of pinned game profiles
// (sote_profile_<hash>), split out of save.js (the second of the four
// factories createSaveManager composes). A pure move: behaviour is what it was
// when these were inner functions of createSaveManager.
import { RUN_KEY, RUN_ARCHIVE_KEY } from './saveArchive.js';

// The shared copy of a pinned game profile (see model/runStorage.js): one per
// distinct hash, written once, read by every slot, archived run and snapshot
// whose `gameProfileRef` names that hash. The game creates and deletes only
// keys with this exact prefix, and deletes one only when no stored run names it.
export const PROFILE_COPY_PREFIX = 'sote_profile_';
export const profileCopyKey = (hash) => `${PROFILE_COPY_PREFIX}${hash}`;
// When a copy was written (ms since epoch), under its own prefix so it is not itself a copy. Another tab's
// collection spares a copy written inside PROFILE_COPY_GRACE_MS: its slot may not have landed yet.
export const PROFILE_STAMP_PREFIX = 'sote_profilestamp_';
export const PROFILE_COPY_GRACE_MS = 60000;

/**
 * createSharedProfileStore(storage) → the shared-copy reader/writer and the
 * orphan sweep. Owns `verifiedCopies` (the hashes proven readable this session);
 * forgetVerifiedCopy(hash) is the one door save.js uses to drop one.
 */
export function createSharedProfileStore(storage) {
  // ---- THE SHARED PROFILE COPIES (sote_profile_<hash>) ---------------------
  const verifiedCopies = new Set();
  function readSharedProfile(hash) {
    const raw = storage.getItem(profileCopyKey(hash));
    if (!raw) return null;
    try {
      const copy = JSON.parse(raw);
      if (copy && copy.hash === hash) { verifiedCopies.add(hash); return copy; }
    } catch { /* unreadable: not a copy */ }
    return null;
  }
  const hasVerifiedCopy = (hash) => (verifiedCopies.has(hash) && storage.getItem(profileCopyKey(hash)) !== null) || readSharedProfile(hash) !== null;
  // Write the copy once and prove it reads back; a failed write throws (quota)
  // BEFORE any slot is allowed to point at it.
  function touchProfileStamp(hash) {
    const stampKey = `${PROFILE_STAMP_PREFIX}${hash}`;
    const last = Number(storage.getItem(stampKey));
    if (Number.isFinite(last) && last > 0 && Date.now() - last < PROFILE_COPY_GRACE_MS / 6) return; // fresh enough
    try { storage.setItem(stampKey, String(Date.now())); } catch { /* the post-write re-check covers it */ }
  }
  function ensureSharedProfile(profile) {
    const hash = profile && profile.hash;
    if (typeof hash !== 'string') throw new Error('Cannot keep a profile with no hash');
    const key = profileCopyKey(hash);
    // Reusing a copy refreshes its stamp, so a copy a slot is about to name is always inside the
    // grace another tab's collection honours.
    if (verifiedCopies.has(hash) && storage.getItem(key) !== null) { touchProfileStamp(hash); return false; }
    if (readSharedProfile(hash)) { verifiedCopies.add(hash); touchProfileStamp(hash); return false; }
    const json = JSON.stringify(profile);
    storage.setItem(key, json);
    if (storage.getItem(key) !== json) throw new Error('The shared game profile copy did not read back');
    try { storage.setItem(`${PROFILE_STAMP_PREFIX}${hash}`, String(Date.now())); } catch { /* no stamp: the post-write re-check covers it */ }
    verifiedCopies.add(hash);
    return true;
  }
  // Delete only `sote_profile_*` keys that no stored run names. References are
  // found by pattern in every run slot, the archive (index and salvage) and the
  // transfer recovery copy, so an unreadable one still protects its profile.
  const REF_PATTERN = /gameProfileRef\\*"\s*:\s*\{[^}]*?hash\\*"\s*:\s*\\*"([^"\\]+)/g;
  const storageNames = () => {
    const names = [];
    for (let i = 0; i < storage.length; i++) { const name = storage.key(i); if (typeof name === 'string') names.push(name); }
    return names;
  };
  const canEnumerate = () => typeof storage.key === 'function' && Number.isInteger(storage.length);
  function referencedProfileHashes() {
    const referenced = new Set();
    for (const name of storageNames()) {
      if (!(name.startsWith(RUN_KEY) || name.startsWith(RUN_ARCHIVE_KEY) || name === 'sote_transfer_backup_v1')) continue;
      const raw = storage.getItem(name);
      if (typeof raw === 'string') for (const m of raw.matchAll(REF_PATTERN)) referenced.add(m[1]);
    }
    return referenced;
  }
  const stampFresh = (hash) => {
    const stamp = Number(storage.getItem(`${PROFILE_STAMP_PREFIX}${hash}`));
    return Number.isFinite(stamp) && stamp > 0 && Math.abs(Date.now() - stamp) < PROFILE_COPY_GRACE_MS;
  };
  function dropProfileCopy(hash) {
    storage.removeItem(profileCopyKey(hash)); storage.removeItem(`${PROFILE_STAMP_PREFIX}${hash}`); verifiedCopies.delete(hash);
  }
  function collectProfileCopies() {
    // Not guarded by readOnlyProfile: that flag protects the PROFILE (meta) keys, and this touches
    // only run copies the game created, so the browser's run-writing manager must run it.
    if (!canEnumerate()) return 0;
    const names = storageNames();
    const referenced = referencedProfileHashes();
    let removed = 0;
    for (const name of names) {
      if (name.startsWith(PROFILE_STAMP_PREFIX)) {
        // a stamp whose copy is gone is just litter
        if (storage.getItem(profileCopyKey(name.slice(PROFILE_STAMP_PREFIX.length))) === null) storage.removeItem(name);
        continue;
      }
      if (!name.startsWith(PROFILE_COPY_PREFIX)) continue;
      const hash = name.slice(PROFILE_COPY_PREFIX.length);
      if (referenced.has(hash) || stampFresh(hash)) continue; // named, or just written/reused (maybe by another tab)
      // The scan above is already old: another tab may have reused this copy and written its slot
      // since. Look again, right before deleting, and delete only if it is still unreferenced and expired.
      if (referencedProfileHashes().has(hash) || stampFresh(hash)) continue;
      dropProfileCopy(hash); removed++;
    }
    return removed;
  }
  const refHashOf = (raw) => { REF_PATTERN.lastIndex = 0; const m = typeof raw === 'string' ? REF_PATTERN.exec(raw) : null; REF_PATTERN.lastIndex = 0; return m ? m[1] : null; };

  const forgetVerifiedCopy = (hash) => { verifiedCopies.delete(hash); };

  return {
    readSharedProfile, hasVerifiedCopy, touchProfileStamp, ensureSharedProfile, storageNames, canEnumerate,
    referencedProfileHashes, stampFresh, dropProfileCopy, collectProfileCopies, refHashOf, REF_PATTERN, forgetVerifiedCopy,
  };
}
