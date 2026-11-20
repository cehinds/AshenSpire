// src/engine/saveArchive.js — the archive drawer, split out of save.js (the
// first of the four factories createSaveManager composes). Keyed, appended,
// capped: property 2 in save.js's header. A pure move: behaviour is what it was
// when these were inner functions of createSaveManager.

export const RUN_KEY = 'sote_run_v1';
// Legacy name, deliberately NOT renamed: this string is where archives already
// live in players' browsers, and renaming it orphans every archive written
// before today. It is now the archive INDEX for both kinds (run and meta) —
// one home, one key, keyed entries inside it.
export const RUN_ARCHIVE_KEY = 'sote_run_archived';
export const SLOTS = 3; // save slots, one run each
const ARCHIVE_LIMIT = 12; // keep the last N RUN archives…
// …and profiles are counted separately, because a run must never evict one
// (Saga's gate). This cap is generous and exists only so the drawer cannot grow
// without bound; reaching it salvages rather than deletes.
const PROFILE_ARCHIVE_LIMIT = 24;
const ARCHIVE_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000; // …and nothing older than ~6 months

// Slot 1 keeps the legacy key (backward compatible: existing saves are slot 1);
// slots 2..N use suffixed keys. All slot-taking methods default to slot 1.
export function runKey(slot = 1) {
  return slot === 1 ? RUN_KEY : `${RUN_KEY}_s${slot}`;
}

/**
 * createArchiveStore(storage, { readOnlyProfile, collectProfileCopies }) →
 *   { readArchiveIndex, writeArchiveEntry, makeArchiveId, archive, archiveMeta }
 * `collectProfileCopies` is the shared-profile store's sweep, called after a run
 * is archived (late-bound by the caller so the two stores need not import each other).
 */
export function createArchiveStore(storage, { readOnlyProfile = false, collectProfileCopies = () => 0 } = {}) {
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
        if (!readOnlyProfile) storage.setItem(salvageKey, raw);
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
  // "profiles are never deleted to make room" and the crisis dialog says a
  // profile can come back "any time". The older blanket promise was false:
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
    collectProfileCopies();
    return id;
  }

  // A profile archive NEVER removes the primary: the bytes are the evidence.
  // De-duplicated by content: main.js calls loadMeta() eight times during one
  // boot, and a per-call archive would fill the drawer with eight copies of one
  // loss and push genuine older archives out of the cap. Same bytes → same
  // entry, however many times we are asked.
  function archiveMeta(json, reason) {
    if (readOnlyProfile) return null;
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

  return { readArchiveIndex, writeArchiveEntry, makeArchiveId, archive, archiveMeta };
}
