// src/engine/saveReclaim.js — lossless space reclamation, split out of save.js
// (the fourth of the four factories createSaveManager composes). A pure move:
// behaviour is what it was when these were inner functions of createSaveManager.
import { compactRun, expandStoredRun, withLeanCheckpoints } from '../model/runStorage.js';
import { RUN_SCHEMA_VERSION } from '../model/state.js';
import { RUN_ARCHIVE_KEY, SLOTS, runKey } from './saveArchive.js';

// Schemas a stored run may be repacked from: each reads with no migration step
// beyond the stamp, so moving the stamp loses nothing. A future schema joins
// ONLY after its migration from these is proven a no-op and a test says so.
const REPACKABLE_SCHEMAS = new Set([25, 26]);

/**
 * createSpaceReclaimer(storage, { readSharedProfile, ensureSharedProfile, collectProfileCopies }) →
 *   { canonical, recompactedRunJson, swapKey, swapArchiveSave, bootstrapSharedProfile,
 *     reclaimStoredSpace }
 * The three deps are the shared-profile store's functions this section calls.
 */
export function createSpaceReclaimer(storage, { readSharedProfile, ensureSharedProfile, collectProfileCopies }) {
  // ---- RECLAIMING SPACE: LOSSLESS RECOMPACTION ONLY ------------------------
  // A full store gets the bytes the game itself wasted back, and nothing else:
  // every save slot and every archived run written in the older, bigger form
  // (the pinned game profile inline, repeated per saved fight) is rewritten in
  // the stored form model/runStorage.js defines. Nothing is deleted, no slot,
  // archive, profile or backup is dropped (an earlier attempt that removed a
  // stale profile backup was withdrawn as unsafe), and each rewrite is proven
  // lossless first: expanding it must give back exactly the save it replaces.
  const canonical = (value) => JSON.stringify(value, (key, v) => (v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]])) : v));
  function recompactedRunJson(json, { writeCopy = true } = {}) {
    let parsed;
    try { parsed = JSON.parse(json); } catch { return null; }
    // Only a save this build reads without migrating: the stamp moves to the
    // current schema, and nothing older has its migrations skipped by it.
    if (!parsed || typeof parsed !== 'object' || !REPACKABLE_SCHEMAS.has(parsed.schemaVersion)) return null;
    const packed = compactRun(parsed);
    if (packed === parsed) return null;
    const next = JSON.stringify({ ...packed, schemaVersion: RUN_SCHEMA_VERSION });
    if (next.length >= json.length) return null;
    try {
      // The reference may point only at a copy that is written and verified.
      // compactRun also strips the legacy ability context from checkpoint logs, so the original is compared in that lean form.
      if (writeCopy) ensureSharedProfile(parsed.gameProfile);
      if (canonical({ ...expandStoredRun(JSON.parse(next), readSharedProfile), schemaVersion: parsed.schemaVersion }) !== canonical(withLeanCheckpoints(parsed))) return null;
    } catch { return null; }
    return next;
  }
  // The first save after an update on a store that is ALREADY full: the shared
  // copy (~650 KB) cannot be written because the room is held by older saves
  // that carry the very same profile inline. So one of those is converted to a
  // reference FIRST (that frees its ~650 KB), the copy is written and verified
  // from the live run's full profile at once, and if the copy still cannot land
  // the entry is put back to its exact original bytes. Returns true when the copy exists.
  // Every rewrite below is a compare-and-swap: another tab may have saved the same key since this one
  // read it, and writing the older bytes back would undo that save. So a key is written only while it
  // still holds, byte for byte, what the new bytes were made from; otherwise it is skipped.
  function swapKey(key, from, to) {
    if (storage.getItem(key) !== from) return false;
    storage.setItem(key, to);
    return true;
  }
  // Swap one archived run's `save` inside the index, re-reading the index fresh each time.
  function swapArchiveSave(id, from, to) {
    for (let tries = 0; tries < 3; tries++) {
      const raw = storage.getItem(RUN_ARCHIVE_KEY);
      let index = null;
      try { index = raw ? JSON.parse(raw) : null; } catch { return false; }
      const entry = index && Array.isArray(index.entries) ? index.entries.find((e) => e && e.id === id && e.kind === 'run') : null;
      if (!entry || entry.save !== from) return false;
      entry.save = to;
      if (swapKey(RUN_ARCHIVE_KEY, raw, JSON.stringify(index))) return true;
    }
    return false;
  }
  function bootstrapSharedProfile(profile, exceptSlot) {
    if (!profile || typeof profile.hash !== 'string') return false;
    if (readSharedProfile(profile.hash)) return true;
    const sameProfile = (json) => { try { return JSON.parse(json).gameProfile?.hash === profile.hash; } catch { return false; } };
    const attempt = (original, next, swap) => {
      try { if (!swap(original, next)) return false; } catch { return false; }
      try { ensureSharedProfile(profile); return true; } catch { /* roll back below */ }
      // Back to the exact original bytes, but only if the key still holds OUR converted bytes.
      try { swap(next, original); } catch { /* the original fit before, so this cannot be refused */ }
      return false;
    };
    for (let slot = 1; slot <= SLOTS; slot++) {
      if (slot === exceptSlot) continue;
      const original = storage.getItem(runKey(slot));
      const next = original && sameProfile(original) ? recompactedRunJson(original, { writeCopy: false }) : null;
      if (next && attempt(original, next, (from, to) => swapKey(runKey(slot), from, to))) return true;
    }
    let index = null;
    try { const rawIndex = storage.getItem(RUN_ARCHIVE_KEY); index = rawIndex ? JSON.parse(rawIndex) : null; } catch { /* not ours to touch */ }
    if (index && Array.isArray(index.entries)) {
      for (const entry of index.entries) {
        if (!(entry && entry.kind === 'run' && typeof entry.save === 'string' && sameProfile(entry.save))) continue;
        const original = entry.save;
        const next = recompactedRunJson(original, { writeCopy: false });
        if (next && attempt(original, next, (from, to) => swapArchiveSave(entry.id, from, to))) return true;
      }
    }
    return false;
  }
  // Returns the characters freed.
  function reclaimStoredSpace(exceptSlot = null, liveProfile = null) {
    // Run slots and archived RUNS only (never a profile key), so it is not guarded by readOnlyProfile.
    let freed = 0;
    freed += collectProfileCopies() ? 1 : 0; // orphaned copies need no copy of their own
    if (liveProfile) bootstrapSharedProfile(liveProfile, exceptSlot);
    for (let slot = 1; slot <= SLOTS; slot++) {
      if (slot === exceptSlot) continue; // about to be overwritten with the newest bytes
      const json = storage.getItem(runKey(slot));
      const next = json && recompactedRunJson(json);
      if (!next) continue;
      try { if (swapKey(runKey(slot), json, next)) freed += json.length - next.length; } catch { /* a smaller value was refused: leave the original */ }
    }
    // The archive index: compact against a FRESH read and write only if it is unchanged since; a
    // concurrent change means re-reading and re-applying, never writing the stale index.
    for (let tries = 0; tries < 3; tries++) {
      const rawIndex = storage.getItem(RUN_ARCHIVE_KEY);
      if (!rawIndex) break;
      let index = null;
      try { index = JSON.parse(rawIndex); } catch { break; /* an unreadable index is readArchiveIndex's to salvage, not ours to touch */ }
      if (!index || !Array.isArray(index.entries)) break;
      let changed = false;
      for (const entry of index.entries) {
        const next = entry && entry.kind === 'run' && typeof entry.save === 'string' ? recompactedRunJson(entry.save) : null;
        if (next) { entry.save = next; changed = true; }
      }
      if (!changed) break;
      const out = JSON.stringify(index);
      try {
        if (swapKey(RUN_ARCHIVE_KEY, rawIndex, out)) { freed += rawIndex.length - out.length; break; }
      } catch { break; /* leave the index as it was */ }
    }
    return freed;
  }

  return { canonical, recompactedRunJson, swapKey, swapArchiveSave, bootstrapSharedProfile, reclaimStoredSpace };
}
