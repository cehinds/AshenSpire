// src/engine/saveMeta.js — the durable profile (meta) record, split out of
// save.js (the third of the four factories createSaveManager composes): read,
// migrate, verified write with a rotating mirror, and the one path that replaces
// the primary. A pure move: behaviour is what it was when these were inner
// functions of createSaveManager. The load-state flags (`status`, `quarantined`)
// live on the ONE `profileState` object createSaveManager owns and passes in.
import { emptyEnemyKnowledge, enemyKnowledgeProblems } from '../model/enemyKnowledgeProfile.js';

export const META_KEY = 'sote_meta_v1';
// The last-known-good mirror of META_KEY. Redundancy, not a second home: it is
// only ever written FROM the primary after a verified read-back, never authored
// independently, so the two cannot disagree about anything (Bjorn's rider).
export const META_BACKUP_KEY = 'sote_meta_backup_v1';
// THE ONE HOME for the meta schema's version (the run schema's one home is
// RUN_SCHEMA_VERSION in model/state.js — two schemas, one home each).
export const META_SCHEMA_VERSION = 4;

/**
 * createMetaStore(storage, { readOnlyProfile, archiveMeta, profileState }) →
 *   { parseMeta, readMetaFrom, migrateMeta, freshMeta, saveMetaInternal,
 *     replacePrimaryWith, ensureProfile }
 * `profileState` is { status, quarantined }: always read and written through
 * the object, never copied.
 */
export function createMetaStore(storage, { readOnlyProfile = false, archiveMeta, profileState }) {
  function parseMeta(json) {
    const meta = JSON.parse(json);
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) throw new Error('profile is not an object');
    return meta;
  }

  // Returns { meta } on success, or { error } naming what was wrong.
  function readMetaFrom(key) {
    const json = storage.getItem(key);
    if (!json) return { empty: true };
    let meta;
    try {
      meta = parseMeta(json);
    } catch (e) {
      return { json, error: e && e.message ? e.message : 'corrupt profile', kind: 'corrupt' };
    }
    const v = meta.schemaVersion;
    if (v === META_SCHEMA_VERSION) {
      const problems = enemyKnowledgeProblems(meta.enemyKnowledge);
      return problems.length ? { json, meta, error: problems.join('; '), kind: 'corrupt' } : { json, meta };
    }
    if (typeof v === 'number' && v > META_SCHEMA_VERSION) {
      return { json, meta, error: `profile schemaVersion ${v} is newer than this build (${META_SCHEMA_VERSION})`, kind: 'newer' };
    }
    // Older: migrate here when a migration exists; until one does, refuse BY
    // NAME rather than guessing at a shape nobody wrote.
    const migrated = migrateMeta(meta, v);
    if (migrated) return { json, meta: migrated, migratedFrom: v };
    return { json, meta, error: `profile schemaVersion ${v} is older than this build (${META_SCHEMA_VERSION}) and has no migration`, kind: 'older' };
  }

  // migrateMeta(meta, fromVersion) → meta | null. One switch, one home; every
  // arm must be able to state what it changed.
  function migrateMeta(meta, fromVersion) {
    if (fromVersion === 3) return { ...meta, schemaVersion: META_SCHEMA_VERSION, enemyKnowledge: emptyEnemyKnowledge() };
    if (fromVersion === undefined || fromVersion === 0 || fromVersion === 1 || fromVersion === 2) {
      return {
        ...meta,
        ...(meta.progress ? { progress: { ...meta.progress, maxClassLevel: 0 } } : {}),
        schemaVersion: META_SCHEMA_VERSION,
        discoveredArmaments: [...new Set(meta.discoveredArmaments || meta.found || [])],
        discoveryReceipts: [...(meta.discoveryReceipts || [])],
        enemyKnowledge: emptyEnemyKnowledge(),
      };
    }
    return null;
  }

  function freshMeta() {
    return { schemaVersion: META_SCHEMA_VERSION, settings: {}, results: [], discoveredArmaments: [], discoveryReceipts: [], enemyKnowledge: emptyEnemyKnowledge() };
  }

  // The actual write, shared by saveMeta (updates the live profile) and
  // replacePrimaryWith (swaps in a different one). Verify-then-rotate lives here
  // so both paths get it.
  // Keys the profile no longer writes (SPEC §13.4q, 2026-11-07). An old profile
  // still loads with them; the write drops them so they never come back.
  const RETIRED_META_KEYS = ['classMastery', 'classMasteryReceipts'];

  function saveMetaInternal(meta) {
    if (readOnlyProfile) return { ok: false, reason: 'Profile writes require the shared storage owner' };
    const canonical = { ...meta, enemyKnowledge: meta.enemyKnowledge || emptyEnemyKnowledge() };
    for (const key of RETIRED_META_KEYS) delete canonical[key];
    const problems = enemyKnowledgeProblems(canonical.enemyKnowledge);
    if (problems.length) return { ok: false, reason: problems.join('; ') };
    const json = JSON.stringify({ ...canonical, schemaVersion: META_SCHEMA_VERSION });
    storage.setItem(META_KEY, json);
    // Verify the write survived (quota, a killed tab mid-write), then rotate
    // the mirror. Backup AFTER a verified read-back, never before — a mirror
    // of bytes we never proved readable is not a backup.
    const check = readMetaFrom(META_KEY);
    if (check.empty || check.error || check.json !== json) {
      const backup = readMetaFrom(META_BACKUP_KEY);
      if (!backup.empty && !backup.error) storage.setItem(META_KEY, backup.json);
      return { ok: false, reason: 'write did not read back cleanly; primary restored from the last known good' };
    }
    try {
      storage.setItem(META_BACKUP_KEY, json);
    } catch (error) {
      // Primary read-back already committed the XP and receipt. A retry is
      // idempotent, but must not report that committed progress was lost.
      return { ok: true, warning: `profile saved; backup could not rotate: ${error.message}` };
    }
    return { ok: true };
  }

  // ---- THE ONE PATH THAT REPLACES THE PRIMARY -----------------------------
  // The rule is "no path may replace the primary without the old bytes being
  // recoverable", and it has now been broken twice by the same mistake: the
  // rule written in prose, enforced per-function, and the next path to arrive
  // walks the gap. First startNewProfile (Vira's D1), then restoreProfile
  // (Sunna's D12) — which destroyed the outgoing profile while its dialog
  // promised it would be "set aside here in its place".
  //
  // So the rule stops being prose. Any code that replaces the live profile
  // calls THIS, and archiving is not a step a caller can forget because it is
  // not a caller's step. A new path that writes META_KEY directly is a defect
  // findable by grep: this and saveMeta are the only two writers, and saveMeta
  // never replaces a DIFFERENT profile — it updates the one already live.
  function replacePrimaryWith(meta, reason) {
    if (readOnlyProfile) return { ok: false, reason: 'Profile replacement requires the shared storage owner' };
    const outgoing = storage.getItem(META_KEY);
    const archiveId = outgoing ? archiveMeta(outgoing, reason) : null;
    profileState.quarantined = false; // an explicit, player-driven replacement clears the freeze
    const res = saveMetaInternal(meta);
    if (!res.ok) {
      profileState.quarantined = true;
      return { ...res, archiveId };
    }
    return { ok: true, archiveId };
  }

  // ---- THE PROFILE EXISTS BEFORE THE FIRST RUN DOES (M7) -------------------
  // His ask: "profile should be able to be created before first run, not after".
  // What shipped did the opposite. `loadMeta()` SYNTHESIZES a profile in memory
  // for every caller (freshMeta) and writes nothing, so a player who cleared
  // storage, picked a class and pressed BEGIN THE CLIMB had `sote_run_v1` and no
  // `sote_meta_v1` — a run with no player behind it — and Title → Profile
  // printed his own sentence back at him as the behaviour (Bjorn's M7 walk,
  // 2026-08-08). Two states for one concept: the profile that exists because
  // every read gets an object, and the profile that exists on disk.
  //
  // This is the collapse. `ensureProfile()` is the only way a profile comes into
  // being unasked, it is idempotent, and it never touches one that is already
  // there. It is called at two places and they are one rule each:
  //
  //   · at the class-pick commit (main.js newRun) — HIS ask, and it lands
  //     BEFORE the run is created, so the profile is older than the climb.
  //   · inside saveRun/loadRun below — A STORED RUN IMPLIES A STORED PROFILE.
  //     That is the structural half: it cannot be forgotten by a future start
  //     path the way the first one was, and it is what repairs the players who
  //     ALREADY have runs and no profile, with no migration to write.
  //
  // It refuses while quarantined for the same reason every other write does:
  // those bytes are the evidence (property 4).
  function ensureProfile() {
    if (storage.getItem(META_KEY) != null) return { created: false, ok: true };
    if (readOnlyProfile) return { created: false, ok: false, reason: 'Profile creation requires the shared storage owner' };
    if (profileState.quarantined) {
      return { created: false, ok: false, reason: `profile is quarantined (${profileState.status.state}); refusing to write` };
    }
    const res = saveMetaInternal(freshMeta());
    if (!res.ok) return { created: false, ...res };
    profileState.status = { ok: true, state: 'ok', reason: 'created before the first run', archiveId: null, recoveredFrom: null };
    return { created: true, ok: true };
  }

  return { parseMeta, readMetaFrom, migrateMeta, freshMeta, saveMetaInternal, replacePrimaryWith, ensureProfile };
}
