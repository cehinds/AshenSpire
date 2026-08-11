// src/engine/save.js — run persistence with schema + content versioning
// (SPEC §3.12)
//
// Storage is injected so the module stays headless: the UI passes
// window.localStorage; tests pass a plain in-memory stub with the same
// getItem/setItem/removeItem shape. Saves that can't be trusted (unknown
// schemaVersion, corrupt JSON, dangling content ids after a content change)
// are ARCHIVED — moved aside, never silently deleted — and load returns null.
//
// PROFILE DURABILITY (#67). The meta record is the durable one: settings, run
// results, and the progress tally the unlocks are earned from — the thing that
// will hold a 2000-run character. It used to be treated as a cache while runs
// were treated as precious, forty lines apart in this file. Five properties now
// hold for it, and each one is a check in tools/profile-durability-probe.mjs:
//
//   1. schemaVersion is WRITTEN AND READ. Older: migrated, or refused BY NAME.
//      Newer: refused AND PRESERVED — an older build must never eat a profile
//      a newer build wrote.
//   2. Archives are KEYED and APPENDED, never overwritten — the second loss
//      must not erase the first.
//   3. A failed load is a NAMED, VISIBLE state (profileStatus()), never a fresh
//      profile wearing the same filename.
//   4. While a profile is unreadable the manager is QUARANTINED: no write may
//      overwrite the original bytes, because those bytes are the evidence for
//      every other failure.
//   5. The drawer has a HANDLE: listArchives / getArchive / exportArchive /
//      restoreProfile — preservation the player cannot reach is a kinder word
//      for lost.

import { serializeRun, deserializeRun } from '../model/state.js';
import { createLoadout, stampDeck } from '../model/loadout.js';

export const RUN_KEY = 'sote_run_v1';
// Legacy name, deliberately NOT renamed: this string is where archives already
// live in players' browsers, and renaming it orphans every archive written
// before today. It is now the archive INDEX for both kinds (run and meta) —
// one home, one key, keyed entries inside it.
export const RUN_ARCHIVE_KEY = 'sote_run_archived';
export const META_KEY = 'sote_meta_v1';
// The last-known-good mirror of META_KEY. Redundancy, not a second home: it is
// only ever written FROM the primary after a verified read-back, never authored
// independently, so the two cannot disagree about anything (Bjorn's rider).
export const META_BACKUP_KEY = 'sote_meta_backup_v1';
export const SLOTS = 3; // save slots, one run each
const HISTORY_LIMIT = 20;
// THE ONE HOME for the meta schema's version (the run schema's one home is
// RUN_SCHEMA_VERSION in model/state.js — two schemas, one home each).
export const META_SCHEMA_VERSION = 1;
const ARCHIVE_LIMIT = 12; // keep the last N RUN archives…
// …and profiles are counted separately, because a run must never evict one
// (Saga's gate). This cap is generous and exists only so the drawer cannot grow
// without bound; reaching it salvages rather than deletes.
const PROFILE_ARCHIVE_LIMIT = 24;
const ARCHIVE_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000; // …and nothing older than ~6 months

// Slot 1 keeps the legacy key (backward compatible: existing saves are slot 1);
// slots 2..N use suffixed keys. All slot-taking methods default to slot 1.
function runKey(slot = 1) {
  return slot === 1 ? RUN_KEY : `${RUN_KEY}_s${slot}`;
}

/**
 * createSaveManager(storage) → { saveRun, loadRun, clearRun, hasRun, slotSummary,
 *                                listSlots, loadMeta, saveMeta, recordResult }
 */
export function createSaveManager(storage) {
  if (!storage || typeof storage.getItem !== 'function') {
    throw new Error('createSaveManager requires a storage with getItem/setItem/removeItem');
  }

  // ---- the archive: keyed, appended, capped (property 2) ------------------
  // Read the index, adopting the pre-#67 shape ({reason, save}) as one entry so
  // an archive written by an older build is never dropped on the floor.
  function readArchiveIndex() {
    const raw = storage.getItem(RUN_ARCHIVE_KEY);
    if (!raw) return { v: 1, entries: [] };
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      // An unreadable INDEX used to silently discard every archive it held —
      // the drawer's own catalogue becoming the thing that loses the drawer
      // (Vira, D4). Set the raw bytes aside under their own key first; a human
      // or a later tool can still pick them apart.
      const salvageKey = `${RUN_ARCHIVE_KEY}_salvage_${Date.now()}`;
      try {
        storage.setItem(salvageKey, raw);
      } catch (e2) {
        /* storage refused the salvage write; the fresh index below still lets the game run */
      }
      return { v: 1, entries: [], salvagedFrom: salvageKey };
    }
    if (parsed && Array.isArray(parsed.entries)) return parsed;
    if (parsed && typeof parsed === 'object' && 'save' in parsed) {
      return { v: 1, entries: [{ id: 'legacy-1', kind: 'run', slot: 1, reason: parsed.reason || 'archived by an earlier build', at: null, save: parsed.save }] };
    }
    return { v: 1, entries: [] };
  }

  // THE DRAWER'S PROMISE (Saga's gate). The calm screen tells every player
  // "They are never deleted to make room for anything else" and the crisis
  // dialog says they can come back "any time". Both were false: this function
  // pruned by age and then by count, and the count prune was KIND-BLIND —
  // `splice(0, len - 12)` drops the oldest entries whether they are a corrupt
  // run or somebody's two thousand evenings. Twelve is not a freak number: a
  // content patch can archive one run per slot, three slots, so four content
  // updates reached it. Silently.
  //
  // Her fix, her preference, and mine: PRUNE RUNS ONLY. A profile is never
  // aged out and never evicted by a run. The cap stays — an unbounded drawer
  // hits quota and would threaten the live profile, which is the thing all of
  // this exists to protect. The defect was never the cap; it was the promise.
  function writeArchiveEntry(entry) {
    const index = readArchiveIndex();
    index.entries.push(entry);
    const cutoff = Date.now() - ARCHIVE_MAX_AGE_MS;
    const runs = index.entries.filter((e) => e.kind !== 'meta');
    const profiles = index.entries.filter((e) => e.kind === 'meta');

    // Runs age out and are capped. A legacy entry with no timestamp is never
    // aged out, because we cannot prove it is old.
    let keptRuns = runs.filter((e) => !e.at || Date.parse(e.at) >= cutoff);
    if (keptRuns.length > ARCHIVE_LIMIT) {
      keptRuns.splice(0, keptRuns.length - ARCHIVE_LIMIT);
    }

    // Profiles do not age out and are not touched by run pressure. If profiles
    // ALONE ever fill the drawer — the case this fix creates, and it needs an
    // answer that is not silent eviction — the oldest is MOVED to its own
    // salvage key (the same courtesy the corrupt-index path already had) and a
    // notice is recorded so the calm screen can say it happened. We never
    // delete a profile; the browser's storage quota is the only real ceiling
    // and that limit is named here rather than hidden.
    let keptProfiles = profiles;
    if (profiles.length > PROFILE_ARCHIVE_LIMIT) {
      const evicted = profiles.slice(0, profiles.length - PROFILE_ARCHIVE_LIMIT);
      keptProfiles = profiles.slice(evicted.length);
      for (const e of evicted) {
        const key = `${RUN_ARCHIVE_KEY}_profile_${e.id}`;
        try {
          storage.setItem(key, e.save);
          index.notices = (index.notices || []).concat({
            at: new Date().toISOString(),
            kind: 'profile-salvaged',
            id: e.id,
            key,
            was: e.at || null,
          });
        } catch (err) {
          // Storage refused the salvage write (quota). Keep the profile in the
          // drawer rather than dropping it: a full drawer is a problem we can
          // tell someone about, a vanished profile is not.
          keptProfiles = [e].concat(keptProfiles);
        }
      }
    }

    index.entries = [...keptRuns, ...keptProfiles].sort((a, b) => Date.parse(a.at || 0) - Date.parse(b.at || 0));
    storage.setItem(RUN_ARCHIVE_KEY, JSON.stringify(index));
    return entry.id;
  }

  let archiveSeq = 0;
  function makeArchiveId(kind, slot) {
    archiveSeq += 1;
    // Keyed by kind, slot and time: slot 2's archive can no longer land on
    // slot 1's, and a second loss can no longer erase the first.
    return `${kind}${kind === 'run' ? `-s${slot}` : ''}-${Date.now()}-${archiveSeq}`;
  }

  function archive(json, reason, slot = 1) {
    const id = makeArchiveId('run', slot);
    writeArchiveEntry({ id, kind: 'run', slot, reason, at: new Date().toISOString(), save: json });
    storage.removeItem(runKey(slot));
    return id;
  }

  // A profile archive NEVER removes the primary: the bytes are the evidence.
  // De-duplicated by content: main.js calls loadMeta() eight times during one
  // boot, and a per-call archive would fill the drawer with eight copies of one
  // loss and push genuine older archives out of the cap. Same bytes → same
  // entry, however many times we are asked.
  function archiveMeta(json, reason) {
    const index = readArchiveIndex();
    const existing = index.entries.find((e) => e.kind === 'meta' && e.save === json);
    if (existing) {
      // Same bytes seen again: keep ONE entry (a boot reads loadMeta eight
      // times), but record that it happened again and when. Merging the events
      // entirely lost the second occurrence's time, which is the one fact a
      // player asking "when did this start?" actually needs (Vira, D5).
      existing.count = (existing.count || 1) + 1;
      existing.lastSeenAt = new Date().toISOString();
      storage.setItem(RUN_ARCHIVE_KEY, JSON.stringify(index));
      return existing.id;
    }
    const id = makeArchiveId('meta', null);
    writeArchiveEntry({ id, kind: 'meta', slot: null, reason, at: new Date().toISOString(), count: 1, save: json });
    return id;
  }

  // ---- profile load state (properties 3 and 4) ----------------------------
  // `status` is the named, visible state a failed load leaves behind, and the
  // quarantine flag is what stops the next ordinary settings write from
  // destroying the original bytes.
  let status = { ok: true, state: 'ok', reason: null, archiveId: null, recoveredFrom: null };
  let quarantined = false;

  function parseMeta(json) {
    const meta = JSON.parse(json);
    if (!meta || typeof meta !== 'object') throw new Error('profile is not an object');
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
    if (v === undefined || v === META_SCHEMA_VERSION) return { json, meta };
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
    if (fromVersion === 0) {
      // v0 = the pre-#67 unversioned/zero profile: shape is already compatible,
      // it simply never carried a stamp. Adopt it and stamp it.
      return { ...meta, schemaVersion: META_SCHEMA_VERSION };
    }
    return null;
  }

  function freshMeta() {
    return { schemaVersion: META_SCHEMA_VERSION, settings: {}, results: [] };
  }

  // The actual write, shared by saveMeta (updates the live profile) and
  // replacePrimaryWith (swaps in a different one). Verify-then-rotate lives here
  // so both paths get it.
  function saveMetaInternal(meta) {
    const json = JSON.stringify({ ...meta, schemaVersion: META_SCHEMA_VERSION });
    storage.setItem(META_KEY, json);
    // Verify the write survived (quota, a killed tab mid-write), then rotate
    // the mirror. Backup AFTER a verified read-back, never before — a mirror
    // of bytes we never proved readable is not a backup.
    const check = readMetaFrom(META_KEY);
    if (check.empty || check.error) {
      const backup = readMetaFrom(META_BACKUP_KEY);
      if (!backup.empty && !backup.error) storage.setItem(META_KEY, backup.json);
      return { ok: false, reason: 'write did not read back cleanly; primary restored from the last known good' };
    }
    storage.setItem(META_BACKUP_KEY, json);
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
    const outgoing = storage.getItem(META_KEY);
    const archiveId = outgoing ? archiveMeta(outgoing, reason) : null;
    quarantined = false; // an explicit, player-driven replacement clears the freeze
    const res = saveMetaInternal(meta);
    if (!res.ok) {
      quarantined = true;
      return { ...res, archiveId };
    }
    return { ok: true, archiveId };
  }

  return {
    /** Persist after every committed choice (SPEC §3.12). Stamps RNG counters. */
    saveRun(run, rng, slot = 1) {
      if (rng) run.streamCounters = rng.getCounters();
      storage.setItem(runKey(slot), serializeRun(run));
    },

    /**
     * loadRun(registries, slot?) → run | null. Refuses and archives: corrupt
     * JSON, unknown schemaVersion, or (on contentVersion mismatch) any deck/
     * relic/flask id that no longer resolves against the current registries.
     */
    loadRun(registries, slot = 1) {
      const json = storage.getItem(runKey(slot));
      if (!json) return null;
      let run;
      try {
        run = deserializeRun(json);
      } catch (e) {
        archive(json, e && e.message ? e.message : 'corrupt save', slot);
        return null;
      }
      if (run.contentVersion !== registries.contentVersion) {
        const dangling =
          (run.deck || []).find((c) => !registries.cards.has(c.cardId)) ||
          (run.relics || []).find((id) => !registries.relics.has(id)) ||
          (run.flasks || []).find((f) => !registries.flasks.has(f.flaskId));
        if (dangling) {
          archive(json, `contentVersion ${run.contentVersion} → ${registries.contentVersion}: dangling id`, slot);
          return null;
        }
        // Ids all still resolve: the run survives the content patch.
        run.contentVersion = registries.contentVersion;
      }
      // A run saved before equipment existed has no loadout. Give it the bare
      // starting one and re-stamp, rather than throwing away someone's climb.
      if (!run.loadout) {
        run.loadout = createLoadout(registries, run.class);
        stampDeck(registries, run);
      }
      // Pre-mana v1 saves remain valid: the absent optional fields mean the
      // climb began before this resource existed, so it enters at its class's
      // authored full pool. Present-but-malformed values were refused earlier.
      if (run.maxMana === undefined && run.mana === undefined) {
        run.maxMana = registries.classes.get(run.class).maxMana;
        run.mana = run.maxMana;
      }
      return run;
    },

    hasRun(slot = 1) {
      return storage.getItem(runKey(slot)) != null;
    },

    clearRun(slot = 1) {
      storage.removeItem(runKey(slot));
    },

    /**
     * slotSummary(slot?) → a cheap descriptor for the slot picker (no content
     * validation), or null if empty/corrupt. Full validation happens on loadRun.
     */
    slotSummary(slot = 1) {
      const json = storage.getItem(runKey(slot));
      if (!json) return null;
      try {
        const r = JSON.parse(json);
        return {
          slot,
          class: r.class,
          actNumber: r.actNumber,
          floor: r.floor,
          seedString: r.seedString,
          hp: r.hp,
          maxHp: r.maxHp,
          customization: r.customization,
        };
      } catch (e) {
        return null;
      }
    },

    /** listSlots() → [{ slot, summary|null }] for every slot. */
    listSlots() {
      const out = [];
      for (let s = 1; s <= SLOTS; s++) out.push({ slot: s, summary: this.slotSummary(s) });
      return out;
    },

    // ---- meta: the durable profile (SPEC §3.12, #67) ------------------------
    /**
     * loadMeta() → meta. ALWAYS returns a usable object so every caller that
     * reads `.settings` keeps working — but when the profile could not be read
     * it returns an empty one AND leaves a named state in profileStatus(),
     * having first archived the bytes and quarantined writes. It never hands
     * back a fresh profile as though nothing happened (property 3).
     */
    loadMeta() {
      const primary = readMetaFrom(META_KEY);

      if (primary.empty) {
        status = { ok: true, state: 'empty', reason: null, archiveId: null, recoveredFrom: null };
        quarantined = false;
        return freshMeta();
      }

      if (!primary.error) {
        status = {
          ok: true,
          state: primary.migratedFrom !== undefined ? 'migrated' : 'ok',
          reason: primary.migratedFrom !== undefined ? `migrated from schemaVersion ${primary.migratedFrom}` : null,
          archiveId: null,
          recoveredFrom: null,
        };
        quarantined = false;
        return primary.meta;
      }

      // A profile written by a NEWER build: refuse AND PRESERVE. Nothing is
      // archived and nothing is moved — the bytes stay exactly where the newer
      // build left them, and quarantine stops this build from overwriting them
      // (Marina's kept clause: opening an old build must not cost the player
      // everything).
      if (primary.kind === 'newer') {
        status = { ok: false, state: 'newer', reason: primary.error, archiveId: null, recoveredFrom: null };
        quarantined = true;
        return freshMeta();
      }

      // Corrupt, or older-with-no-migration: archive the bytes (keyed), then
      // try the last-known-good mirror before giving up on the player.
      const archiveId = archiveMeta(primary.json, primary.error);
      const backup = readMetaFrom(META_BACKUP_KEY);
      if (!backup.empty && !backup.error) {
        // Recovered. Put the good bytes back in the primary so the next
        // ordinary write has something true to build on, and say so.
        storage.setItem(META_KEY, backup.json);
        status = { ok: true, state: 'recovered', reason: primary.error, archiveId, recoveredFrom: META_BACKUP_KEY };
        quarantined = false;
        return backup.meta;
      }

      // Nothing left to recover from: named, visible, and writes are frozen so
      // the evidence survives (property 4).
      status = { ok: false, state: primary.kind === 'older' ? 'older' : 'corrupt', reason: primary.error, archiveId, recoveredFrom: null };
      quarantined = true;
      return freshMeta();
    },

    /**
     * profileStatus() → { ok, state, reason, archiveId, recoveredFrom }.
     * state: 'ok' | 'empty' | 'migrated' | 'recovered' | 'corrupt' | 'older' |
     * 'newer'. This is the named state property 3 requires; the UI speaks it.
     */
    profileStatus() {
      return { ...status, quarantined };
    },

    /**
     * saveMeta(meta) → { ok, reason? }. Refuses while quarantined: the original
     * bytes are the evidence of the failure and the player's only copy, and one
     * ordinary settings write used to destroy them silently.
     */
    saveMeta(meta) {
      if (quarantined) {
        return { ok: false, reason: `profile is quarantined (${status.state}); refusing to overwrite the original bytes` };
      }
      return saveMetaInternal(meta);
    },
    /** Append a run result (victory, floor, seed, class, …), capped at 20. */
    recordResult(result) {
      const meta = this.loadMeta();
      meta.results = meta.results || [];
      meta.results.push(result);
      if (meta.results.length > HISTORY_LIMIT) {
        meta.results.splice(0, meta.results.length - HISTORY_LIMIT);
      }
      this.saveMeta(meta);
      return meta;
    },

    // ---- the handle on the drawer (property 5) ------------------------------
    /**
     * listArchives() → [{ id, kind, slot, reason, at, bytes }] newest last.
     * Descriptors only — the saved bytes stay out of the list so a UI can show
     * "something was set aside, here is when and why" cheaply.
     */
    listArchives() {
      return readArchiveIndex().entries.map((e) => ({
        id: e.id,
        kind: e.kind,
        slot: e.slot,
        reason: e.reason,
        at: e.at,
        bytes: typeof e.save === 'string' ? e.save.length : 0,
      }));
    },

    /**
     * drawerNotices() → [{ at, kind, id, key, was }] — things the drawer had to
     * do to itself, so the calm screen can say them out loud. Today the only
     * notice is 'profile-salvaged'. An empty list is the normal state.
     */
    drawerNotices() {
      return (readArchiveIndex().notices || []).slice();
    },

    /**
     * salvagedProfileKeys() → storage keys holding profiles moved out of the
     * drawer. Nothing here was deleted; it was set further aside.
     */
    salvagedProfileKeys() {
      return (readArchiveIndex().notices || [])
        .filter((n) => n.kind === 'profile-salvaged')
        .map((n) => n.key);
    },

    /** getArchive(id) → the full entry (including `save`), or null. */
    getArchive(id) {
      return readArchiveIndex().entries.find((e) => e.id === id) || null;
    },

    /**
     * exportArchive(id) → a string a player can save to a file, or null.
     * The export is generated FROM the archive, never separately maintained.
     */
    exportArchive(id) {
      const entry = this.getArchive(id);
      if (!entry) return null;
      return JSON.stringify({ exportedAt: new Date().toISOString(), game: 'Ashen Spire', archive: entry }, null, 2);
    },

    /**
     * restoreProfile(id) → { ok, reason? }. Puts an archived profile back as
     * the live one. Restoring may legitimately fail (the bytes were archived
     * because they were bad) and it says so plainly instead of pretending.
     */
    restoreProfile(id) {
      const entry = this.getArchive(id);
      if (!entry) return { ok: false, reason: `no archive with id '${id}'` };
      if (entry.kind !== 'meta') return { ok: false, reason: `archive '${id}' is a ${entry.kind}, not a profile` };
      let meta;
      try {
        meta = parseMeta(entry.save);
      } catch (e) {
        return { ok: false, reason: `that archive still cannot be read: ${e && e.message ? e.message : 'corrupt'}` };
      }
      // Restoring REPLACES the live profile, so it goes through the one path
      // that archives what it overwrites (below). Before this, restore was the
      // path the rule did not cover: the outgoing profile was destroyed while
      // the dialog promised it would be "set aside here in its place".
      const res = replacePrimaryWith(meta, `set aside when you restored ${id}`);
      if (!res.ok) return res;
      status = { ok: true, state: 'ok', reason: `restored from archive ${id}`, archiveId: id, recoveredFrom: id };
      return { ok: true, archiveId: res.archiveId };
    },

    /**
     * startNewProfile() → { ok, archiveId }. The player's explicit consent to
     * leave the old profile behind, and the only way out of quarantine that
     * writes.
     *
     * THE INVARIANT (Vira's gate, D1): **no path may replace the primary
     * without the old bytes being recoverable afterwards.** This used to be
     * true only for `corrupt` — because that state had archived on the way in —
     * and false for every state that had not: `newer` deliberately archives
     * nothing, so consenting here destroyed a perfectly good 2000-run profile
     * with no copy anywhere. The archive now happens HERE, where the
     * replacement happens, so it holds for every state rather than for the one
     * that happened to be tested. Content de-duplication keeps the corrupt path
     * from writing a second copy of what it already archived.
     */
    startNewProfile() {
      const res = replacePrimaryWith(freshMeta(), 'kept when you started a new profile');
      status = { ok: true, state: 'empty', reason: 'player started a new profile', archiveId: res.archiveId, recoveredFrom: null };
      return res;
    },

    /**
     * exportProfile() → a string a player can save to a file, or null when
     * there is no profile at all.
     *
     * Reads the LIVE primary, which is what the `newer` state needs: those
     * bytes are fine, they are just from the future, so nothing was archived
     * and there is no archive to export. Before this existed the UI fell back
     * to "the most recent archive", which in that state is somebody else's —
     * it offered an unrelated old run under the words "save a copy of your
     * profile" (Vira's gate, D2).
     */
    exportProfile() {
      const json = storage.getItem(META_KEY);
      if (!json) return null;
      return JSON.stringify({
        exportedAt: new Date().toISOString(),
        game: 'Ashen Spire',
        note: 'This is your profile exactly as it was stored.',
        state: status.state,
        profile: json,
      }, null, 2);
    },
  };
}

/** Plain in-memory storage stub (tests, or environments without localStorage). */
export function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}
