#!/usr/bin/env node
// Observed-red contract: profile-owned starting-kit discovery without spoilers.

import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState, RUN_SCHEMA_VERSION } from '../src/model/state.js';
import { createMemoryStorage, createSaveManager, META_KEY, META_SCHEMA_VERSION } from '../src/engine/save.js';
import { rollArmamentDrop } from '../src/engine/encounters.js';
import { createRng } from '../src/engine/rng.js';
import { createSession, restoreSession } from './session.mjs';

const discovery = await import('../src/model/startingKits.js').catch(() => ({}));
const {
  startingKitProblems,
  startingKitViews,
  recordArmamentDiscovery,
} = discovery;

let passed = 0;
let failed = 0;
function check(ok, label, detail = '') {
  if (ok) { passed += 1; console.log(`PASS ${label}`); }
  else { failed += 1; console.error(`FAIL ${label}${detail ? ` - ${detail}` : ''}`); }
}

const R = createRegistries(contentBundle);
const kits = R.equipment.startingKits || [];
const alternates = {
  reaver: { id: 'reaverGreatsword', rightHand: 'greatsword' },
  starseer: { id: 'starseerStarstone', rightHand: 'starstoneStaff' },
  herald: { id: 'heraldEmberlight', rightHand: 'emberlightSceptre' },
};

check(Array.isArray(R.equipment.startingKits), 'starting kits are a generated equipment table');
check(R.balance.equipment.startingKitDiscovery?.undiscoveredPresentation === 'hidden',
  'no-spoiler policy is data-owned and hides undiscovered kits', JSON.stringify(R.balance.equipment.startingKitDiscovery));
check(typeof startingKitProblems === 'function' && typeof startingKitViews === 'function'
  && typeof recordArmamentDiscovery === 'function', 'one starting-kit model owns validation, views, and discovery receipts');

for (const classId of R.classes.ids()) {
  const cls = R.classes.get(classId);
  const classKits = kits.filter((row) => row.classId === classId);
  const baseline = classKits.filter((row) => row.baseline === true);
  check(Array.isArray(cls.eligibleStartingKitIds) && cls.eligibleStartingKitIds.length >= 2,
    `${classId} lists baseline plus alternate eligible kit ids`, JSON.stringify(cls.eligibleStartingKitIds));
  check(baseline.length === 1 && cls.eligibleStartingKitIds?.includes(baseline[0].id),
    `${classId} has exactly one class-listed baseline`, JSON.stringify(baseline));
  check(classKits.some((row) => row.id === alternates[classId].id && row.rightHand === alternates[classId].rightHand),
    `${classId} authors its representative alternate`, JSON.stringify(classKits));

  if (typeof startingKitViews === 'function') {
    const fresh = startingKitViews(R, classId, { discoveredArmaments: [] });
    check(fresh.length === 1 && fresh[0].baseline === true,
      `${classId} fresh profile sees baseline only`, JSON.stringify(fresh));
    const discovered = startingKitViews(R, classId, { discoveredArmaments: [alternates[classId].rightHand] });
    check(discovered.some((row) => row.id === alternates[classId].id && row.available === true),
      `${classId} alternate appears only after every authored armament is discovered`, JSON.stringify(discovered));
    const foreign = startingKitViews(R, classId, { discoveredArmaments: R.equipment.armaments.map((row) => row.id) });
    check(foreign.every((row) => cls.eligibleStartingKitIds.includes(row.id)),
      `${classId} never gains a kit merely because its pieces were discovered`, JSON.stringify(foreign));
  }
}

if (typeof startingKitProblems === 'function') {
  check(startingKitProblems(R).length === 0, 'shipped starting-kit table validates cleanly', startingKitProblems(R).join(' | '));
  function mutate(mutator) {
    const bundle = {
      ...contentBundle,
      classes: contentBundle.classes.map((row) => ({ ...row, eligibleStartingKitIds: [...(row.eligibleStartingKitIds || [])] })),
      equipment: {
        ...contentBundle.equipment,
        armaments: contentBundle.equipment.armaments.map((row) => ({ ...row })),
        startingKits: (contentBundle.equipment.startingKits || []).map((row) => ({ ...row })),
      },
    };
    mutator(bundle);
    const registries = createRegistries(bundle);
    return startingKitProblems(registries).join(' | ');
  }
  check(/baseline/i.test(mutate((b) => { b.equipment.startingKits.find((k) => k.classId === 'reaver').baseline = false; })),
    'mutant: class without one baseline is refused');
  check(/eligible|class/i.test(mutate((b) => { b.classes.find((c) => c.id === 'reaver').eligibleStartingKitIds.push('starseerStarstone'); })),
    'mutant: cross-class eligible kit is refused');
  check(/notAWeapon|unknown/i.test(mutate((b) => { b.equipment.startingKits[0].rightHand = 'notAWeapon'; })),
    'mutant: dangling kit armament is refused by name');
  check(/dropWeight/i.test(mutate((b) => { b.equipment.armaments.find((a) => a.id === 'greatsword').dropWeight = 0; })),
    'mutant: non-positive armament drop weight is refused');
}

check(META_SCHEMA_VERSION >= 2, 'profile schema version advances for durable discovery', String(META_SCHEMA_VERSION));
const legacyStorage = createMemoryStorage();
legacyStorage.setItem(META_KEY, JSON.stringify({ schemaVersion: 1, settings: {}, results: [], found: ['greatsword', 'greatsword'] }));
const migrated = createSaveManager(legacyStorage).loadMeta();
check(JSON.stringify(migrated.discoveredArmaments) === JSON.stringify(['greatsword']),
  'v1 profile migration preserves prior unique finds as discoveries', JSON.stringify(migrated));

if (typeof recordArmamentDiscovery === 'function') {
  let meta = { discoveredArmaments: [], discoveryReceipts: [] };
  const normal = recordArmamentDiscovery(meta, 'greatsword', { progressionMode: 'normal', source: 'boss', runSeed: 'TEST' });
  meta = normal.meta;
  check(normal.receipt?.first === true && meta.discoveredArmaments.includes('greatsword'),
    'normal first find emits and persists one first-discovery receipt', JSON.stringify(normal));
  const duplicate = recordArmamentDiscovery(meta, 'greatsword', { progressionMode: 'normal', source: 'boss', runSeed: 'TEST' });
  check(duplicate.receipt === null && duplicate.meta.discoveryReceipts.length === 1,
    'repeat find emits no second discovery receipt', JSON.stringify(duplicate));
  for (const mode of ['custom', 'debug', 'showcase']) {
    const denied = recordArmamentDiscovery({ discoveredArmaments: [], discoveryReceipts: [] }, 'greatsword', { progressionMode: mode, source: 'boss' });
    check(denied.receipt === null && denied.meta.discoveredArmaments.length === 0,
      `${mode} find cannot advance discovery`, JSON.stringify(denied));
  }
}

const altMeta = { discoveredArmaments: ['greatsword'] };
let altRun = null;
let altError = '';
try { altRun = createRunState({ seed: 41, classId: 'reaver', registries: R, startingKitId: 'reaverGreatsword', profileMeta: altMeta }); }
catch (error) { altError = error.message; }
check(altRun?.startingKitId === 'reaverGreatsword' && altRun.loadout.sets.rightHand[0] === 'greatsword'
  && altRun.loadout.sets.leftHand[0] === null,
  'authorized alternate creates the exact active loadout and persists kit identity', altError || JSON.stringify(altRun?.loadout));
check(altRun?.deck.filter((c) => c.equipmentRole === 'attack').length === 4
  && altRun?.deck.filter((c) => c.equipmentRole === 'guard').length === 4
  && altRun?.deck.filter((c) => c.equipmentRole === 'technique').length === 1
  && altRun?.deck.filter((c) => !c.equipmentRole).length === 1,
  'alternate resolves through the unchanged 4/4/1/1 deck contract');
let lockedError = '';
try { createRunState({ seed: 42, classId: 'reaver', registries: R, startingKitId: 'reaverGreatsword', profileMeta: { discoveredArmaments: [] } }); }
catch (error) { lockedError = error.message; }
check(/not discovered|unavailable/i.test(lockedError), 'undiscovered alternate fails closed before run creation', lockedError);

if (altRun) {
  const save = createSaveManager(createMemoryStorage());
  save.saveMeta({ schemaVersion: META_SCHEMA_VERSION, settings: {}, results: [], discoveredArmaments: ['greatsword'], discoveryReceipts: [] });
  save.saveRun(altRun);
  const resumed = save.loadRun(R);
  check(resumed?.startingKitId === altRun.startingKitId && resumed.loadout.sets.rightHand[0] === 'greatsword',
    'save resume preserves authoritative kit identity and resolved loadout', JSON.stringify(resumed));
}

if (altRun) {
  const storage = createMemoryStorage();
  const save = createSaveManager(storage);
  save.saveMeta({ schemaVersion: META_SCHEMA_VERSION, settings: {}, results: [], discoveredArmaments: ['greatsword'], discoveryReceipts: [] });
  const missing = structuredClone(altRun);
  delete missing.startingKitId;
  save.saveRun(missing);
  check(save.loadRun(R) === null, 'current run missing startingKitId is refused, not silently baselined');

  const mismatched = structuredClone(altRun);
  mismatched.startingKitId = 'reaverBaseline';
  save.saveRun(mismatched);
  check(save.loadRun(R) === null, 'changed startingKitId that disagrees with its snapshot is refused');

  const legacy = structuredClone(altRun);
  legacy.schemaVersion = 1;
  delete legacy.startingKitId;
  delete legacy.startingKitSnapshot;
  save.saveRun(legacy);
  const migratedRun = save.loadRun(R);
  check(RUN_SCHEMA_VERSION >= 2 && migratedRun?.startingKitId === 'reaverBaseline'
    && migratedRun?.startingKitSnapshot?.classId === 'reaver',
    'legacy v1 run receives the class baseline identity through the one migration door', JSON.stringify(migratedRun));
}

let sessionError = '';
try {
  const session = createSession({ registries: R, seedString: 'KITTEST' });
  session.addMember({ id: 'p1', name: 'Rune', classId: 'reaver', startingKitId: 'reaverGreatsword', discoveredArmaments: ['greatsword'] });
  const restored = restoreSession(R, session.serialize());
  const memberRun = restored.serialize()?.members?.find((row) => row.id === 'p1')?.run;
  check(memberRun?.startingKitId === 'reaverGreatsword' && memberRun.loadout.sets.rightHand[0] === 'greatsword',
    'host session add/serialize/restore preserves validated kit identity', JSON.stringify(memberRun));
} catch (error) { sessionError = error.message; }
if (sessionError) check(false, 'host session add/serialize/restore preserves validated kit identity', sessionError);

// Drop weights are behavior, not decorative columns: force one positive row in
// an otherwise-zero rarity cohort and prove the roller selects that row.
const weightedBundle = {
  ...contentBundle,
  balance: {
    ...contentBundle.balance,
    equipment: {
      ...contentBundle.balance.equipment,
      drops: {
        ...contentBundle.balance.equipment.drops,
        chance: { ...contentBundle.balance.equipment.drops.chance },
        rarityWeights: Object.fromEntries(Object.entries(contentBundle.balance.equipment.drops.rarityWeights)
          .map(([key, value]) => [key, { ...value }])),
      },
    },
  },
  equipment: {
    ...contentBundle.equipment,
    armaments: contentBundle.equipment.armaments.map((row) => ({ ...row })),
  },
};
for (const row of weightedBundle.equipment.armaments) row.dropWeight = row.id === 'greatsword' ? 1 : 0;
weightedBundle.balance.equipment.drops.chance.boss = 100;
weightedBundle.balance.equipment.drops.rarityWeights.boss = { common: 0, uncommon: 1, rare: 0 };
const weightedR = createRegistries(weightedBundle);
const weighted = rollArmamentDrop(weightedR, createRng(9), { source: 'boss', found: [], carried: [] });
check(weighted === 'greatsword', 'armament roller consumes authored positive dropWeight', String(weighted));

const customize = readFileSync(new URL('../src/ui/screens/customize.js', import.meta.url), 'utf8');
check(/startingKitViews/.test(customize) && /startingKitId/.test(customize),
  'creation consumes the shared kit view and submits kit identity');
check(!/starstoneStaff|emberlightSceptre|greatsword/.test(customize),
  'creation contains no hard-coded alternate names or stats');

const lan = readFileSync(new URL('./lan.mjs', import.meta.url), 'utf8');
const lobby = readFileSync(new URL('../src/ui/screens/lobby.js', import.meta.url), 'utf8');
check(/startingKitId:\s*cl\.startingKitId/.test(lan) && /discoveredArmaments:\s*cl\.discoveredArmaments/.test(lan),
  'production LAN start forwards main-seat kit identity and entitlement to the host session');
check(/startingKitId:\s*lp\.startingKitId/.test(lan) && /discoveredArmaments:\s*lp\.discoveredArmaments/.test(lan),
  'production LAN start forwards local-seat kit identity and entitlement');
check(/startingKitId/.test(lobby) && /discoveredArmaments/.test(lobby) && /startingKitViews/.test(lobby),
  'lobby requests only profile-visible kits and transports the entitlement claim');

console.log(`\nstarting-kit-discovery: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
