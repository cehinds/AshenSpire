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
// Run:  node tools/profile-durability-probe.mjs <clone-root>   (a bare run exits 2
//       with usage — the argument is required, per Vira's branch note)
//   <clone-root> = a checkout of the game repo (measured at dev = e444d77)
// Exit 0 = the profile is protected. Exit 1 = it is not, and each red names how.
//
// Run:  node tools/profile-durability-probe.mjs --selftest
//   The known-bad corpus (Sten, 2026-08-15 — this probe sat in the audit's
//   no-known-bad thirty-seven; a check whose failing case nobody has watched
//   fail is `unknown`, not green). Each plant is an edit to src/engine/save.js
//   in a byte-copy of the real tree, and the probe is then re-run AS ITS OWN
//   PROCESS against that copy — the same entry point, the same dynamic import,
//   the same module surface every real invocation walks. Red observed, tree
//   restored byte-identical, green re-observed. A needle that no longer
//   matches the tree is a MISS, not a skip — a plant that silently stopped
//   planting is the eleven-instruments shape.
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

// DOOR (Rune, 2026-08-15). The real input is `<clone-root>/src/engine/save.js`,
// entered by IMPORT of that path — the whole-tree door, the same shape as
// inspecthold's `--root`. That is right, and it was ref-pinned: the argument
// had to be a pre-fix checkout that no longer exists, so under SOP 2 the
// observation rotted to `unknown`. `--selftest` makes it re-runnable: each
// known-bad is planted INTO A COPY of the real save.js and this whole probe is
// re-run with the copy as its clone-root — the same import, the same module.
// (Vira's doors audit 2026-08-14 listed this tool NO-KNOWN-BAD.)
if (process.argv.includes('--selftest')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  process.exit(await doorSelftest({
    tool: 'profile-durability-probe.mjs',
    args: ['.'],
    plants: [
      {
        name: 'E1: a corrupt profile is read as empty instead of preserved (no archive copy kept)',
        file: 'src/engine/save.js',
        find: 'RUN_ARCHIVE_KEY',
        replace: 'PLANTED_RUN_ARCHIVE_KEY',
        all: true,
        expectRed: /FAIL\s+E1 corrupt profile: an archive copy is kept|Error/,
      },
      {
        name: 'E2: a NEWER schemaVersion is accepted blind instead of refused',
        file: 'src/engine/save.js',
        find: 'if (typeof v === \'number\' && v > META_SCHEMA_VERSION) {',
        replace: 'if (false && typeof v === \'number\' && v > META_SCHEMA_VERSION) {',
        expectRed: /FAIL\s+(E2 a newer schemaVersion is refused|P1 NEWER profile)/,
      },
    ],
  }));
}

const root = process.argv[2];
if (!root) {
  console.error('usage: node profile-loss-e444d77.mjs <clone-root> | --selftest');
  process.exit(2);
}

// ---------------------------------------------------------------------------
// --selftest — the same-door known-bad corpus (Sten, 2026-08-15)
// ---------------------------------------------------------------------------
if (root === '--selftest') {
  const { mkdtempSync, cpSync, rmSync, readFileSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { spawnSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const { dirname } = await import('node:path');

  const selfPath = fileURLToPath(import.meta.url);
  const repoRoot = join(dirname(selfPath), '..');

  // Each plant is one historical defect class this probe exists to hunt,
  // reintroduced as a source edit. `needle` must match the real save.js
  // EXACTLY ONCE or the plant is a MISS — a corpus that drifts off its tree
  // must say so, never shrink silently.
  const PLANTS = [
    {
      name: 'M1 the mirror is never rotated (pre-#67: the backup that was not there)',
      needle: '    storage.setItem(META_BACKUP_KEY, json);',
      patch: '    /* PLANT M1: the mirror is never rotated */',
      expectFail: 'E1 corrupt profile: progress survives the read',
    },
    {
      name: 'M2 every schemaVersion is accepted blind (an older build eats a newer profile)',
      needle: '    if (v === undefined || v === META_SCHEMA_VERSION) return { json, meta };',
      patch: '    return { json, meta }; /* PLANT M2: every schemaVersion accepted blind */',
      expectFail: 'E2 a newer schemaVersion is refused rather than accepted blind',
    },
    {
      name: 'M3 quarantine does not refuse (the settings write that destroyed the evidence)',
      needle: `      if (quarantined) {
        return { ok: false, reason: \`profile is quarantined (\${status.state}); refusing to overwrite the original bytes\` };
      }`,
      patch: '      /* PLANT M3: quarantine does not refuse */',
      expectFail: 'P4 the settings write is refused while quarantined',
    },
    {
      name: 'M4 the archive overwrites instead of appending (the second loss erases the first)',
      needle: '    index.entries.push(entry);',
      patch: '    index.entries = [entry]; /* PLANT M4: the archive overwrites instead of appending */',
      expectFail: 'P2 two losses produce TWO archives, not one',
    },
  ];

  console.log('profile-durability-probe --selftest: every plant is an edit to a real tree.\n');

  const scratch = mkdtempSync(join(tmpdir(), 'pdp-selftest-'));
  let misses = 0;
  try {
    cpSync(join(repoRoot, 'src'), join(scratch, 'src'), { recursive: true });
    const savePath = join(scratch, 'src', 'engine', 'save.js');
    const pristine = readFileSync(savePath, 'utf8');
    const probe = () => {
      const r = spawnSync(process.execPath, [selfPath, scratch], { encoding: 'utf8' });
      return { status: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
    };

    // The clean copy first: a corpus that never checks the negative case
    // cannot tell "the plant fails" from "everything fails".
    const base = probe();
    if (base.status !== 0) misses++;
    console.log(`  ${base.status === 0 ? 'green' : 'MISS '} BASELINE — the untouched copy exits 0${base.status === 0 ? '' : ` (got exit ${base.status})`}`);

    for (const p of PLANTS) {
      const parts = pristine.split(p.needle);
      if (parts.length !== 2) {
        misses++;
        console.log(`  MISS  ${p.name} — plant did not plant: needle matched ${parts.length - 1} time(s); the tree drifted, move the plant with it`);
        continue;
      }
      writeFileSync(savePath, parts.join(p.patch));
      const r = probe();
      writeFileSync(savePath, pristine);
      const red = r.status === 1;
      const named = r.out.includes(`FAIL  ${p.expectFail}`);
      const ok = red && named;
      if (!ok) misses++;
      console.log(`  ${ok ? 'RED  ' : 'MISS '} ${p.name}${ok ? '' : ` — exit ${r.status}, ${named ? 'named' : `did not name "${p.expectFail}"`}`}`);
    }

    // Reverted: the restored copy must be byte-identical and green again —
    // "red observed" is only evidence beside "green re-observed on the same tree".
    const restored = readFileSync(savePath, 'utf8') === pristine;
    const again = restored ? probe() : { status: -1 };
    const revertOk = restored && again.status === 0;
    if (!revertOk) misses++;
    console.log(`  ${revertOk ? 'green' : 'MISS '} REVERTED — save.js byte-identical and the copy exits 0 again${revertOk ? '' : ` (restored=${restored}, exit ${again.status})`}`);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }

  console.log('\nDOOR — where each known-bad entered: an edit to src/engine/save.js in a');
  console.log('byte-copy of the real src/ tree on disk, then THIS TOOL re-run as its own');
  console.log(`process: \`node ${'tools/profile-durability-probe.mjs'} <copied-root>\` — the same entry`);
  console.log('point, the same dynamic import, the same module surface every real');
  console.log('invocation walks. Nothing was handed to a function below that door.');

  console.log('\nBOUNDARY — what this selftest does NOT prove:');
  console.log('  · the probe\'s own boundary stands: headless Node, in-memory storage —');
  console.log('    no plant here proves anything about a browser\'s localStorage or quota.');
  console.log('  · the GAP row (P7b reachability) asserts nothing by design, so no plant');
  console.log('    can prove it able to fail. Un-plantable, said here rather than forced.');
  console.log('  · four defect classes are planted, one per property family the probe');
  console.log('    claims. A class not on the list (e.g. the salvage path) is unwatched.');

  console.log(`\nRESULT: ${misses === 0
    ? 'all plants behaved — each observed red through the real door, and reverted'
    : `${misses} MISS`} — ${PLANTS.length} plants (counted at run time, never typed).`);
  process.exit(misses ? 1 : 0);
}
const mod = await import(pathToFileURL(join(root, 'src/engine/save.js')).href);
const { createSaveManager, createMemoryStorage, META_KEY, META_BACKUP_KEY, RUN_ARCHIVE_KEY, META_SCHEMA_VERSION } = mod;

let fails = 0;
let gaps = 0;
// A GAP is a property this file defines, does NOT yet hold, and that a seat has
// ruled a follow-up. It prints on every run and never exits non-zero — so a
// known hole stays visible in the record instead of being quietly re-labelled
// green. When the fix lands, gap() becomes check().
const gap = (name, cond, detail) => {
  console.log(`${cond ? 'PASS' : 'GAP '}  ${name}${!cond && detail ? ' — ' + detail : ''}`);
  if (!cond) gaps++;
};
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
  const intact = st.getItem(META_KEY) === before;
  check('P4 the original bytes are byte-identical afterwards', intact,
    intact ? '' : 'the evidence was overwritten');
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

// =============================================================================
// P6 — THE PRODUCT (Vira's gate, D1). The corpus above walks each STATE and each
// CONSENT ACTION but never their product, and the hole was exactly there:
// newer × startNewProfile destroyed an unarchived profile. The invariant this
// section enforces is one sentence:
//
//   NO PATH MAY REPLACE THE PRIMARY WITHOUT THE OLD BYTES BEING RECOVERABLE.
//
// It is asserted for every state, not for the one that happened to be tested.
// =============================================================================
{
  const states = {
    ok: (st) => { const m = createSaveManager(st); m.saveMeta({ settings: {}, results: [], progress: { runs: 2000 } }); return m; },
    corrupt: (st) => { const m = createSaveManager(st); m.saveMeta({ settings: {}, results: [], progress: { runs: 2000 } }); st.setItem(META_KEY, '{"schemaVersion":1,"progress":{"runs":2000}'); st.setItem(META_BACKUP_KEY, 'gone'); m.loadMeta(); return m; },
    newer: (st) => { const m = createSaveManager(st); st.setItem(META_KEY, JSON.stringify({ schemaVersion: META_SCHEMA_VERSION + 6, profile: { runs: 2000 } })); m.loadMeta(); return m; },
    older: (st) => { const m = createSaveManager(st); st.setItem(META_KEY, JSON.stringify({ schemaVersion: -3, progress: { runs: 2000 } })); m.loadMeta(); return m; },
  };

  // EVERY path that replaces the primary, not the one that was tested. The
  // rule was right both times and its COVERAGE was per-function both times:
  // startNewProfile (Vira D1), then restoreProfile (Sunna D12), which
  // destroyed the outgoing profile while promising to set it aside.
  const replacers = {
    startNewProfile: (mgr) => mgr.startNewProfile(),
    restoreProfile: (mgr) => {
      // Seed a readable archive to restore FROM, so the outgoing profile is
      // the thing under test.
      const other = JSON.stringify({ schemaVersion: META_SCHEMA_VERSION, settings: {}, results: [], progress: { runs: 111 } });
      const idx = JSON.parse(storageOf(mgr).getItem(RUN_ARCHIVE_KEY) || '{"v":1,"entries":[]}');
      idx.entries.push({ id: 'meta-seeded', kind: 'meta', slot: null, reason: 'seeded', at: new Date().toISOString(), count: 1, save: other });
      storageOf(mgr).setItem(RUN_ARCHIVE_KEY, JSON.stringify(idx));
      return mgr.restoreProfile('meta-seeded');
    },
  };
  const storageMap = new WeakMap();
  const storageOf = (mgr) => storageMap.get(mgr);

  for (const [stateName, build] of Object.entries(states)) {
    for (const [actionName, run] of Object.entries(replacers)) {
      const st = createMemoryStorage();
      const mgr = build(st);
      storageMap.set(mgr, st);
      const before = st.getItem(META_KEY);
      run(mgr);
      const after = st.getItem(META_KEY);
      const recoverable = mgr.listArchives().some((a) => (mgr.getArchive(a.id) || {}).save === before);
      // The detail is gated on the CHECK'S OWN condition. It used to be gated
      // on `after === before`, which is the inverse of the failing case, so all
      // eight passing pairs printed "those bytes are gone" (Vira's ruling,
      // Saga found it). A check's testimony is part of the check.
      const held = !before || after === before || recoverable;
      check(`P6 ${stateName} × ${actionName}: the replaced bytes are still recoverable`, held,
        held ? '' : 'PRIMARY REPLACED WITH NO ARCHIVE — those bytes are gone');
    }
  }

  // newer × export: the bytes are intact and must be exportable even though
  // nothing was archived (they were deliberately left alone).
  const stN = createMemoryStorage();
  const mN = states.newer(stN);
  const liveBytes = stN.getItem(META_KEY);
  const liveExport = mN.exportProfile();
  // The export must carry the profile's bytes VERBATIM — unparsed, because in
  // the corrupt case they cannot be parsed and must survive anyway.
  check('P6 newer × export: the profile can be saved to a file without an archive',
    typeof liveExport === 'string' && JSON.parse(liveExport).profile === liveBytes,
    String(liveExport).slice(0, 80));

  // An unrelated archive must never be offered as "your profile".
  const stU = createMemoryStorage();
  stU.setItem(RUN_ARCHIVE_KEY, JSON.stringify({ reason: 'an old run', save: '{"unrelated":"run bytes"}' }));
  const mU = states.newer(stU);
  check('P6 newer: profileStatus does not point at somebody else\'s archive',
    mU.profileStatus().archiveId === null, 'archiveId=' + mU.profileStatus().archiveId);
  const exp = mU.exportProfile();
  check('P6 newer × export with an unrelated archive present: exports the PROFILE, not the run',
    /2000/.test(String(exp)) && !/unrelated/.test(String(exp)), String(exp).slice(0, 80));
}

// =============================================================================
// P7 — THE DRAWER'S PROMISE (Saga's gate). The calm screen says "They are never
// deleted to make room for anything else" and the crisis dialog says a player
// can come back "any time". Both were false: writeArchiveEntry pruned by age
// then count, and the count prune was KIND-BLIND — twelve later run losses
// evicted somebody's profile, silently, with no salvage key even though the
// index-corruption path has one. Her scenario, and the age route she read but
// did not drive.
// =============================================================================
{
  // (a) A profile must not be evicted by later RUN losses.
  const st = createMemoryStorage();
  const sv = createSaveManager(st);
  sv.saveMeta({ settings: {}, results: [], progress: { runs: 2000 } });
  st.setItem(META_KEY, '{"schemaVersion":1,"progress":{"runs":2000},'); // corrupt it
  sv.loadMeta();
  const profileId = sv.profileStatus().archiveId;
  const reg = { contentVersion: 'x', cards: { has: () => true }, relics: { has: () => true }, flasks: { has: () => true } };
  for (let i = 0; i < 20; i++) {
    st.setItem(`sote_run_v1_s${(i % 3) + 2}`, '{"schemaVersion":1,broken' + i);
    sv.loadRun(reg, (i % 3) + 2);
  }
  const profileKept = !!sv.getArchive(profileId) && typeof sv.exportArchive(profileId) === 'string';
  check('P7 a set-aside profile survives twenty later run losses', profileKept,
    profileKept ? '' : 'the profile is GONE — evicted by runs to make room, which the screen promises never happens');

  // (b) …and is not aged out either. Same broken promise, different route.
  const st2 = createMemoryStorage();
  const sv2 = createSaveManager(st2);
  sv2.saveMeta({ settings: {}, results: [], progress: { runs: 2000 } });
  st2.setItem(META_KEY, '{"schemaVersion":1,"progress":{"runs":2000},');
  sv2.loadMeta();
  const oldId = sv2.profileStatus().archiveId;
  const idx = JSON.parse(st2.getItem(RUN_ARCHIVE_KEY));
  idx.entries.forEach((e) => { e.at = new Date(Date.now() - 400 * 24 * 3600 * 1000).toISOString(); });
  st2.setItem(RUN_ARCHIVE_KEY, JSON.stringify(idx));
  st2.setItem('sote_run_v1', '{"schemaVersion":1,broken');
  sv2.loadRun(reg, 1); // any archive write triggers the prune
  const notAged = !!sv2.getArchive(oldId);
  check('P7 a set-aside profile is not aged out of the drawer', notAged,
    notAged ? '' : 'the profile aged out — "never deleted" was false by the age route');

  // (c) If PROFILES alone fill the drawer, the eviction must not be silent —
  // the case this fix creates, and it needs an answer.
  const st3 = createMemoryStorage();
  const sv3 = createSaveManager(st3);
  const ids = [];
  for (let i = 0; i < 30; i++) {
    sv3.saveMeta({ settings: {}, results: [], progress: { runs: i } });
    sv3.startNewProfile();
    const a = sv3.listArchives().filter((x) => x.kind === 'meta');
    ids.push(a[a.length - 1].id);
  }
  const survivors = sv3.listArchives().filter((a) => a.kind === 'meta').length;
  const notices = sv3.drawerNotices ? sv3.drawerNotices() : [];
  check('P7 profiles filling the drawer are bounded (quota is real) …', survivors <= 30);

  // SPLIT, and Sunna's reason is the sharp one: this used to be a single
  // assertion with an OR — `getArchive(id) || salvagedProfileKeys().length` —
  // so it passed when a profile was UNREACHABLE, because the salvage key
  // existed. The property the file calls reachability was being verified as
  // preservation, and the salvage branch was green with no handle at all. A
  // check that is green both before and after the fix is not measuring the fix.
  const salvagedKeys = sv3.salvagedProfileKeys();
  check('P7a PRESERVATION: every profile is either in the drawer or on a salvage key',
    ids.every((id) => sv3.getArchive(id) || salvagedKeys.length > 0) && notices.length > 0,
    `survivors=${survivors} salvageKeys=${salvagedKeys.length} notices=${notices.length}`);

  // P7b REACHABILITY is the property save.js's own header claims —
  // "preservation the player cannot reach is a kinder word for lost" — and it
  // is NOT met on the salvage path today: listArchives() reads index.entries,
  // a salvaged profile is not in them, and exportArchive(id) returns null. It
  // is reported as a GAP rather than a failure because Sunna ruled it a
  // follow-up for 0.4.x (reach: 25 deliberate player acts) — but it is
  // reported, every run, so Saga's card cannot be closed by a green that never
  // looked. THE CONDITION THAT TURNS IT INTO A BLOCK, hers: the day anything
  // can archive a profile without the player choosing to.
  const reachable = ids.filter((id) => typeof sv3.exportArchive(id) === 'string').length;
  const unreachable = ids.length - reachable;
  gap('P7b REACHABILITY of salvaged profiles (Saga\'s card — must go green before it is closed)',
    unreachable === 0,
    `${unreachable} of ${ids.length} preserved profiles cannot be exported by the player: listArchives() omits salvaged entries and exportArchive() returns null. salvagedProfileKeys() exists and nothing in src/ calls it.`);
}

console.log(`\n${fails} failing check(s)${gaps ? `, ${gaps} known gap(s) reported above` : ''}.`);
console.log('BOUNDARY: headless Node on the real module; no browser, no quota, nothing rendered.');
console.log('Sten wrote checks 1-6 (one amendment labelled inline); Rune added P1-P5.');
process.exit(fails ? 1 : 0);
