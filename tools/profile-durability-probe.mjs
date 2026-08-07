// profile-loss-e444d77.mjs — Sten, 2026-08-06.
//
// THE CLAIM THIS FALSIFIES: "the persistent profile Marina wants to protect does
// not exist yet, so we have time to design its container."
//
// It exists. `meta.progress` is a tally that only ever grows and `meta.unlocked`
// is an earned set never re-evaluated (src/model/unlocks.js, its own header says
// so). Both live under META_KEY and ship in 0.4.x. This probe asks the only
// question that matters about a durable artifact: does it survive a bad byte?
//
// Run:  node profile-loss-e444d77.mjs <clone-root>
//   <clone-root> = a checkout of the game repo (measured at dev = e444d77)
// Exit 0 = the profile is protected. Exit 1 = it is not, and each red names how.
//
// Both edges, per the Quality Gate: E1 is the corrupt/zero case (a truncated
// write — quota, crash, or a killed tab mid-save); E2 is the future/max case (a
// profile written by a NEWER build, read by this one).
//
// BOUNDARY: headless Node against the real module with the in-memory storage the
// module itself exports. It exercises save.js's own logic, not a browser's
// localStorage under quota pressure, and not what main.js renders when this
// happens. Nothing here was seen on a screen.

import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const root = process.argv[2];
if (!root) {
  console.error('usage: node profile-loss-e444d77.mjs <clone-root>');
  process.exit(2);
}
const mod = await import(pathToFileURL(join(root, 'src/engine/save.js')).href);
const { createSaveManager, createMemoryStorage, META_KEY, META_BACKUP_KEY, RUN_ARCHIVE_KEY, META_SCHEMA_VERSION } = mod;

let fails = 0;
const check = (name, cond, detail) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  if (!cond) fails++;
};

// A player with history: 2000 runs, 41 wins, three bosses felled, four unlocks.
const storage = createMemoryStorage();
const saves = createSaveManager(storage);
saves.saveMeta({
  settings: { musicVolume: 50 },
  results: [],
  progress: {
    runs: 2000, wins: 41, maxAct: 3,
    bosses: ['bossOmen', 'bossStitchedKing', 'bossValkyrie'],
    wonClasses: ['reaver', 'herald'],
  },
  unlocked: ['weaponMoonveil', 'talismanEmber', 'slot4', 'ashOfWarLion'],
});
check('control: the 2000-run profile is stored',
  JSON.parse(storage.getItem(META_KEY)).progress.runs === 2000);

// ---- E1: one corrupt byte -------------------------------------------------
const good = storage.getItem(META_KEY);
storage.setItem(META_KEY, good.slice(0, good.length - 12)); // truncated write

const afterCorrupt = saves.loadMeta();
check('E1 corrupt profile: progress survives the read', afterCorrupt.progress != null,
  afterCorrupt.progress == null ? 'progress GONE — loadMeta returns a fresh meta' : '');
check('E1 corrupt profile: unlocks survive the read', afterCorrupt.unlocked != null,
  afterCorrupt.unlocked == null ? 'unlocked GONE' : '');
check('E1 corrupt profile: an archive copy is kept', storage.getItem(RUN_ARCHIVE_KEY) != null,
  storage.getItem(RUN_ARCHIVE_KEY) == null
    ? 'NO archive — a corrupt RUN is archived (save.js:34), a corrupt PROFILE is not' : '');

// The very next ordinary settings write — main.js:139's exact shape.
saves.saveMeta({ ...afterCorrupt, settings: { ...(afterCorrupt.settings || {}), uiScale: 1.1 } });
check('E1 after one settings write: the original bytes are still recoverable',
  JSON.parse(storage.getItem(META_KEY)).progress != null,
  JSON.parse(storage.getItem(META_KEY)).progress == null
    ? 'OVERWRITTEN — the 2000 runs are now unrecoverable, silently' : '');

// ---- E2: a profile from a newer build -------------------------------------
const storage2 = createMemoryStorage();
const saves2 = createSaveManager(storage2);
storage2.setItem(META_KEY, JSON.stringify({ schemaVersion: 7, profile: { runs: 2000 } }));
const future = saves2.loadMeta();
// AMENDED BY RUNE, 2026-08-07, and said out loud rather than quietly: Sten's
// original assertion was `future === null || future.schemaVersion === undefined`
// — a SHAPE assertion. loadMeta can no longer return null (main.js reads
// `.settings` on it at boot, so null crashes the boot it is meant to protect),
// and it now always returns a stamped object. His INTENT — refused rather than
// accepted blind — is kept exactly and checked harder: the newer profile's data
// must not come back, refusal must be NAMED, and the bytes must be PRESERVED.
check('E2 a newer schemaVersion is refused rather than accepted blind (Sten, amended)',
  future.profile === undefined && future.schemaVersion === META_SCHEMA_VERSION,
  'accepted as-is: ' + JSON.stringify(future));
// =============================================================================
// EXTENDED BY RUNE (#67) — the five properties, each with its own check.
// Sten's six checks above are his and stand unaltered except the one amendment
// labelled inline. Everything below is new.
// =============================================================================

// ---- P1: schemaVersion is written AND read ---------------------------------
{
  const st = createMemoryStorage();
  const sv = createSaveManager(st);
  sv.saveMeta({ settings: { a: 1 }, results: [] });
  check('P1 the profile is STAMPED on write',
    JSON.parse(st.getItem(META_KEY)).schemaVersion === META_SCHEMA_VERSION);

  // NEWER: refused AND preserved — Marina's kept clause.
  const st2 = createMemoryStorage();
  const sv2 = createSaveManager(st2);
  const newerBytes = JSON.stringify({ schemaVersion: META_SCHEMA_VERSION + 6, profile: { runs: 2000 } });
  st2.setItem(META_KEY, newerBytes);
  sv2.loadMeta();
  check('P1 NEWER profile: refusal is NAMED', sv2.profileStatus().state === 'newer',
    'state=' + sv2.profileStatus().state);
  check('P1 NEWER profile: the bytes are PRESERVED, untouched',
    st2.getItem(META_KEY) === newerBytes,
    'primary was modified — an older build just ate a newer profile');
  const w = sv2.saveMeta({ settings: { uiScale: 1.1 }, results: [] });
  check('P1 NEWER profile: a later ordinary write is REFUSED', w.ok === false, w.reason || '');
  check('P1 NEWER profile: still preserved after that write',
    st2.getItem(META_KEY) === newerBytes);

  // OLDER: migrated, or refused BY NAME.
  const st3 = createMemoryStorage();
  const sv3 = createSaveManager(st3);
  st3.setItem(META_KEY, JSON.stringify({ schemaVersion: 0, settings: { musicVolume: 20 }, results: [], progress: { runs: 7 } }));
  const older = sv3.loadMeta();
  check('P1 OLDER profile with a migration: adopted and re-stamped',
    older.progress && older.progress.runs === 7 && sv3.profileStatus().state === 'migrated',
    'state=' + sv3.profileStatus().state);

  const st4 = createMemoryStorage();
  const sv4 = createSaveManager(st4);
  st4.setItem(META_KEY, JSON.stringify({ schemaVersion: -3, progress: { runs: 9 } }));
  sv4.loadMeta();
  const s4 = sv4.profileStatus();
  check('P1 OLDER profile with NO migration: refused BY NAME',
    s4.state === 'older' && /schemaVersion -3/.test(s4.reason || ''),
    'reason=' + s4.reason);
}

// ---- P2: archives are keyed and appended — the second loss keeps the first --
{
  const st = createMemoryStorage();
  const sv = createSaveManager(st);
  // Two corrupt profiles in a row, with a real profile between them.
  st.setItem(META_KEY, '{"schemaVersion":1,"progress":{"runs":111},');
  sv.loadMeta();
  sv.startNewProfile();
  sv.saveMeta({ settings: {}, results: [], progress: { runs: 222 } });
  st.setItem(META_KEY, '{"schemaVersion":1,"progress":{"runs":222},');
  sv.loadMeta();
  const archives = sv.listArchives().filter((a) => a.kind === 'meta');
  check('P2 two losses produce TWO archives, not one', archives.length === 2,
    'found ' + archives.length);
  check('P2 both archives are still readable (the first was not overwritten)',
    /111/.test(sv.getArchive(archives[0].id).save) && /222/.test(sv.getArchive(archives[1].id).save));
  check('P2 archive ids are distinct and keyed', archives[0].id !== archives[1].id,
    archives.map((a) => a.id).join(' vs '));

  // Runs: slot 2's archive must not land on slot 1's.
  const st2 = createMemoryStorage();
  const sv2 = createSaveManager(st2);
  const reg = { contentVersion: 'x', cards: { has: () => true }, relics: { has: () => true }, flasks: { has: () => true } };
  st2.setItem('sote_run_v1', '{"schemaVersion":1,broken');
  st2.setItem('sote_run_v1_s2', '{"schemaVersion":1,alsobroken');
  sv2.loadRun(reg, 1);
  sv2.loadRun(reg, 2);
  const runArchives = sv2.listArchives().filter((a) => a.kind === 'run');
  check('P2 run archives are keyed BY SLOT and both survive',
    runArchives.length === 2 && runArchives.some((a) => a.slot === 1) && runArchives.some((a) => a.slot === 2),
    'slots: ' + runArchives.map((a) => a.slot).join(','));

  // A pre-#67 archive written by an older build is adopted, not dropped.
  const st3 = createMemoryStorage();
  const sv3 = createSaveManager(st3);
  st3.setItem(RUN_ARCHIVE_KEY, JSON.stringify({ reason: 'old build', save: '{"legacy":true}' }));
  check('P2 a legacy single-entry archive is adopted, not dropped',
    sv3.listArchives().length === 1 && /legacy/.test(sv3.getArchive(sv3.listArchives()[0].id).save));
}

// ---- P3: never silently empty ----------------------------------------------
{
  const st = createMemoryStorage();
  const sv = createSaveManager(st);
  sv.saveMeta({ settings: {}, results: [], progress: { runs: 2000 } });
  st.setItem(META_KEY, 'not json at all');
  st.setItem(META_BACKUP_KEY, 'the mirror is gone too');
  const meta = sv.loadMeta();
  const s = sv.profileStatus();
  check('P3 an unreadable profile leaves a NAMED state, not a silent fresh one',
    s.ok === false && s.state === 'corrupt' && !!s.reason, JSON.stringify(s));
  check('P3 the failure names the archive it wrote', !!s.archiveId && !!sv.getArchive(s.archiveId));
  check('P3 the returned meta is empty but the state says why',
    (meta.progress === undefined) && sv.profileStatus().quarantined === true);

  // A first-ever boot is 'empty' — NOT a failure. The two must never look alike.
  const st2 = createMemoryStorage();
  const sv2 = createSaveManager(st2);
  sv2.loadMeta();
  check('P3 a first-ever boot reads as empty, not as loss',
    sv2.profileStatus().state === 'empty' && sv2.profileStatus().ok === true);
}

// ---- P4: the next write must not destroy the evidence ----------------------
{
  const st = createMemoryStorage();
  const sv = createSaveManager(st);
  sv.saveMeta({ settings: {}, results: [], progress: { runs: 2000 } });
  st.setItem(META_KEY, '{"schemaVersion":1,"progress":{"runs":2000}');   // truncated
  st.setItem(META_BACKUP_KEY, '{"schemaVersion":1,"progress":{"runs":20'); // mirror gone too
  sv.loadMeta();
  const before = st.getItem(META_KEY);
  const res = sv.saveMeta({ settings: { uiScale: 1.1 }, results: [] });
  check('P4 the settings write is refused while quarantined', res.ok === false, res.reason || '');
  check('P4 the original bytes are byte-identical afterwards', st.getItem(META_KEY) === before,
    'the evidence was overwritten');
  check('P4 recordResult cannot sneak past the quarantine either',
    (sv.recordResult({ victory: false }), st.getItem(META_KEY) === before));
}

// ---- P5: the drawer has a handle -------------------------------------------
{
  const st = createMemoryStorage();
  const sv = createSaveManager(st);
  sv.saveMeta({ settings: { musicVolume: 50 }, results: [], progress: { runs: 2000 }, unlocked: ['weaponMoonveil'] });
  const good = st.getItem(META_KEY);
  st.setItem(META_KEY, good.slice(0, good.length - 9));
  st.setItem(META_BACKUP_KEY, 'gone');
  sv.loadMeta();
  const id = sv.profileStatus().archiveId;

  check('P5 the archive is LISTABLE by the person who lost it',
    sv.listArchives().some((a) => a.id === id));
  const listed = sv.listArchives().find((a) => a.id === id);
  check('P5 the listing says when and why, without opening the bytes',
    !!listed.at && !!listed.reason && listed.bytes > 0, JSON.stringify(listed));
  const exported = sv.exportArchive(id);
  check('P5 it can be EXPORTED to something a player can keep',
    typeof exported === 'string' && /weaponMoonveil/.test(exported) && /exportedAt/.test(exported));
  const bad = sv.restoreProfile(id);
  check('P5 restoring genuinely-bad bytes FAILS PLAINLY rather than pretending',
    bad.ok === false && /cannot be read/.test(bad.reason || ''), bad.reason || '');

  // …and a restorable archive really does come back.
  const st2 = createMemoryStorage();
  const sv2 = createSaveManager(st2);
  sv2.saveMeta({ settings: {}, results: [], progress: { runs: 1234 } });
  const goodBytes = st2.getItem(META_KEY);
  st2.setItem(META_KEY, '{"schemaVersion":1,'); // corrupt, mirror still good
  sv2.loadMeta();
  check('P5 a readable mirror means the player never sees the drawer at all',
    sv2.profileStatus().state === 'recovered' && JSON.parse(st2.getItem(META_KEY)).progress.runs === 1234);
  check('P5 recovery still archived the corrupt bytes for inspection',
    sv2.listArchives().some((a) => a.kind === 'meta'));
  check('P5 startNewProfile is the only write out of quarantine, and keeps the archive',
    (() => {
      const st3 = createMemoryStorage();
      const sv3 = createSaveManager(st3);
      st3.setItem(META_KEY, 'broken');
      sv3.loadMeta();
      const archived = sv3.listArchives().length;
      const r = sv3.startNewProfile();
      return r.ok === true && sv3.profileStatus().quarantined === false && sv3.listArchives().length === archived;
    })());
  void goodBytes;
}

console.log(`\n${fails} failing check(s).`);
console.log('BOUNDARY: headless Node on the real module; no browser, no quota, nothing rendered.');
console.log('Sten wrote checks 1-6 (one amendment labelled inline); Rune added P1-P5.');
process.exit(fails ? 1 : 0);
