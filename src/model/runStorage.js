// The run's STORED form: the bytes under `sote_run_v1`. A configured (Core) run
// pins its whole game profile (~650 KB of cards, enemies, schemas and lock) and
// every saved fight repeats it, so one slot weighed 0.7 MB at rest and 1.5 MB
// mid-fight, and three slots plus the archive overran the ~5 MB origin quota.
// Nothing in that profile is the player's: it is a pure function of the build's
// catalog, and the run's `hash` already proves it. So the stored form keeps
// only a reference ({ id, hash }) when THIS build's catalog holds that exact
// profile, and the full profile when it does not (a run pinned by an older
// build keeps its own snapshot, as FIXED_EVASION_RUNTIME's pattern requires).
// A saved fight's copy of the profile is dropped when it is the run's own.
//
//   compactRun(run)    → a plain object ready for JSON.stringify (never mutates `run`)
//   expandStoredRun(o) → the object a run save means (mutates and returns `o`)
//
// Both are lossless but for the per-event evaluation context in a checkpoint's event log
// (dropped on write, see persistedEventLog): expandStoredRun(compactRun(run)) deep-equals run.
//
// A reference is only as durable as the catalog behind it, and a content edit
// changes the profile's hash (the runtime hash, which gates saves, stays). So
// the save manager also keeps ONE shared copy per hash under
// `sote_profile_<hash>` (engine/save.js), and a reference resolves from the
// catalog first and from that copy second. `lookup(hash)` is that second door.
import { resolveGameProfile } from './gameProfile.js';

const SNAPSHOT_HOLDERS = ['combatEntered', 'combatPendingOutcome'];
const catalogHashById = new Map();

// The hash this build's catalog gives an id, or null (unknown id / not a catalog profile).
function catalogHash(id) {
  if (typeof id !== 'string') return null;
  if (!catalogHashById.has(id)) {
    let hash = null;
    try { hash = resolveGameProfile(id).hash ?? null; } catch { /* not in this build's catalog */ }
    catalogHashById.set(id, hash);
  }
  return catalogHashById.get(id);
}

// The per-event evaluation context (see combatSnapshot.js) is read only while an
// event is scanned, never from a stored log. Pure data: returns the same array
// when no row carries it, else copies the rows that do; never mutates its input.
const EVENT_EVALUATION_CONTEXT = ['abilityBefore', 'abilityEntities'];
export function persistedEventLog(eventLog) {
  if (!Array.isArray(eventLog)) return eventLog;
  if (!eventLog.some((e) => e && typeof e === 'object' && EVENT_EVALUATION_CONTEXT.some((k) => k in e))) return eventLog;
  return eventLog.map((event) => {
    if (!event || typeof event !== 'object' || !EVENT_EVALUATION_CONTEXT.some((k) => k in event)) return event;
    const row = { ...event };
    for (const k of EVENT_EVALUATION_CONTEXT) delete row[k];
    return row;
  });
}

// A checkpoint written by an older build (or resumed from one) still carries the
// context in its log; strip it on every write so a knowledge-only autosave, which
// never re-serializes the checkpoint, cannot keep a legacy save over the quota.
export function withLeanCheckpoints(run) {
  let out = run;
  for (const key of SNAPSHOT_HOLDERS) {
    const snapshot = run[key] && run[key].snapshot;
    if (!snapshot) continue;
    const eventLog = persistedEventLog(snapshot.eventLog);
    if (eventLog === snapshot.eventLog) continue;
    if (out === run) out = { ...run };
    out[key] = { ...run[key], snapshot: { ...snapshot, eventLog } };
  }
  return out;
}

export function compactRun(run, hasCopy = null) {
  if (run && typeof run === 'object') run = withLeanCheckpoints(run);
  const profile = run && run.gameProfile;
  if (!profile || typeof profile !== 'object' || typeof profile.hash !== 'string') return run;
  const out = { ...run };
  // A reference is kept when the catalog holds the profile OR a verified shared copy does
  // (a run resumed after a content update): re-inlining it would be a ~650 KB write.
  if (catalogHash(profile.id) === profile.hash || (typeof hasCopy === 'function' && hasCopy(profile.hash))) {
    delete out.gameProfile;
    out.gameProfileRef = { id: profile.id, hash: profile.hash };
  }
  for (const key of SNAPSHOT_HOLDERS) {
    const snapshot = run[key] && run[key].snapshot;
    if (snapshot && snapshot.gameProfile && snapshot.gameProfile.hash === profile.hash) {
      const { gameProfile, ...rest } = snapshot;
      out[key] = { ...run[key], snapshot: { ...rest, gameProfileFromRun: true } };
    }
  }
  return out;
}

/**
 * storedGameProfile(parsed) → the profile a stored run pins (resolved from the
 * catalog for a reference, else the inline one), or undefined. Throws, naming
 * the profile, when a reference cannot be resolved by THIS build.
 */
export function storedGameProfile(parsed, lookup = null) {
  if (!parsed || typeof parsed !== 'object') return undefined;
  if (parsed.gameProfile) return parsed.gameProfile;
  const ref = parsed.gameProfileRef;
  if (!ref) return undefined;
  let profile = null;
  try { profile = resolveGameProfile(ref.id); } catch { /* the shared copy is next */ }
  if ((!profile || profile.hash !== ref.hash) && typeof lookup === 'function') {
    let shared = null;
    try { shared = lookup(ref.hash); } catch { /* reported below */ }
    profile = shared && shared.hash === ref.hash ? shared : null;
  }
  if (!profile || profile.hash !== ref.hash) {
    throw new Error(`Pinned game profile '${ref.id}' (${String(ref.hash).slice(0, 19)}) is neither in this build nor kept on this device`);
  }
  return profile;
}

export function expandStoredRun(parsed, lookup = null) {
  if (!parsed || typeof parsed !== 'object') return parsed;
  if (parsed.gameProfileRef) {
    parsed.gameProfile = structuredClone(storedGameProfile(parsed, lookup));
    delete parsed.gameProfileRef;
  }
  for (const key of SNAPSHOT_HOLDERS) {
    const snapshot = parsed[key] && parsed[key].snapshot;
    if (snapshot && snapshot.gameProfileFromRun) {
      delete snapshot.gameProfileFromRun;
      if (parsed.gameProfile) snapshot.gameProfile = structuredClone(parsed.gameProfile);
    }
  }
  return parsed;
}
