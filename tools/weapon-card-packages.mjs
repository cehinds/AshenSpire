import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { equipmentSurfaceReceipt } from '../src/model/equipmentPresentation.js';
import {
  WeaponDeckCompositionService,
  buildEquippedWeaponCardPlan,
  cycleSet,
  equipPiece,
  stampDeck,
} from '../src/model/loadout.js';
import { createSaveManager, createMemoryStorage, RUN_ARCHIVE_KEY, RUN_KEY } from '../src/engine/save.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { createRng } from '../src/engine/rng.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const baseRegistries = createRegistries(contentBundle);
const ownsEverything = { has: () => true };
const atCamp = { inCombat: false, classId: 'reaver', attributes: { strength: 20, dexterity: 20, constitution: 20, wisdom: 20, intelligence: 20 } };
let failed = 0;
let checks = 0;

function check(ok, name, detail = '') {
  checks += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed += 1;
}

function throwsNamed(fn, pattern) {
  try { fn(); } catch (error) { return pattern.test(error.message); }
  return false;
}

function registriesWith({ armamentPatches = {}, extraCards = [], attackCopies = undefined } = {}) {
  const armaments = contentBundle.equipment.armaments.map((piece) => ({ ...piece, ...(armamentPatches[piece.id] || {}) }));
  const balance = attackCopies === undefined ? contentBundle.balance : {
    ...contentBundle.balance,
    startingDeckSize: contentBundle.balance.startingDeckSize + attackCopies - contentBundle.balance.equipment.roleCopies.attack,
    equipment: {
      ...contentBundle.balance.equipment,
      roleCopies: { ...contentBundle.balance.equipment.roleCopies, attack: attackCopies },
    },
  };
  return createRegistries({
    ...contentBundle,
    cards: [...contentBundle.cards, ...extraCards],
    balance,
    equipment: { ...contentBundle.equipment, armaments },
  });
}

function makeRun(registries, rightHand, leftHand) {
  const run = createRunState({
    seed: 0x1e57,
    classId: 'reaver',
    registries,
  });
  run.loadout.sets.rightHand[0] = rightHand;
  run.loadout.sets.leftHand[0] = leftHand;
  run.loadout.storage = [];
  stampDeck(registries, run);
  return run;
}

const attacks = (run) => run.deck.filter((card) => card.equipmentRole === 'attack');
const profiles = (run) => attacks(run).map((card) => card.profileId);
const hands = (run) => attacks(run).map((card) => card.sourceHand || null);
const pileNames = ['draw', 'hand', 'discard', 'exhaust'];

function makeCombatFromRun(registries, run, seed = 0x5157) {
  return createCombat({
    registries,
    rng: createRng(seed),
    player: {
      classId: run.class,
      attributes: run.attributes,
      maxHp: run.maxHp,
      hp: run.hp,
      maxMana: run.maxMana,
      mana: run.mana,
      maxStamina: run.maxStamina,
      stamina: run.stamina,
      energyMax: run.energyMax,
      drawPerTurn: run.drawPerTurn,
      deck: run.deck,
      relicIds: run.relics,
      loadout: run.loadout,
      equipmentProfileRuleSnapshot: run.equipmentProfileRuleSnapshot,
    },
    enemyIds: ['fellWarden'],
  });
}

function spreadGeneratedAttacksAcrossPiles(combat) {
  const generated = pileNames.flatMap((name) => combat.piles[name]).filter((card) => card.equipmentRole === 'attack');
  for (const name of pileNames) combat.piles[name] = combat.piles[name].filter((card) => card.equipmentRole !== 'attack');
  generated.forEach((card, index) => combat.piles[pileNames[index % pileNames.length]].push(card));
  return generated;
}

function snapshotAttackRows(snapshot) {
  return pileNames.flatMap((pile) => (snapshot.piles[pile] || [])
    .filter((card) => card.equipmentRole === 'attack')
    .map((card) => ({ pile, card })));
}

function snapshotIdentity(snapshot) {
  return snapshotAttackRows(snapshot).map(({ pile, card }) => ({
    pile,
    instanceId: card.instanceId,
    upgraded: card.upgraded,
    acquiredAt: card.acquiredAt,
  }));
}

function activeSnapshotRun(registries, snapshotRight, snapshotLeft, topRight = snapshotRight, topLeft = snapshotLeft) {
  const source = makeRun(registries, snapshotRight, snapshotLeft);
  attacks(source).forEach((card, index) => {
    card.upgraded = index % 2 === 0;
    card.acquiredAt = `snapshot-floor-${index}`;
  });
  const combat = makeCombatFromRun(registries, source);
  spreadGeneratedAttacksAcrossPiles(combat);
  const run = makeRun(registries, topRight, topLeft);
  run.combatEntered = {
    nodeId: 'weapon-snapshot-node',
    encounterId: 'weapon-snapshot-encounter',
    snapshot: serializeCombatSnapshot(combat),
  };
  return run;
}

function loadStoredRun(registries, run) {
  const storage = createMemoryStorage();
  const saves = createSaveManager(storage);
  const raw = JSON.stringify(run);
  storage.setItem(RUN_KEY, raw);
  const loaded = saves.loadRun(registries);
  const archive = JSON.parse(storage.getItem(RUN_ARCHIVE_KEY) || '{"entries":[]}');
  const archivedRaw = (archive.entries || []).some((entry) => entry.save === raw);
  return { storage, saves, loaded, raw, archivedRaw };
}

function rejectedWithPreservedRaw(receipt, reason) {
  return receipt.loaded === null
    && receipt.archivedRaw
    && reason.test(receipt.saves.runStatus().reason || '');
}

function sameCombatProjection(left, right) {
  const project = (card) => ({
    cardId: card.cardId,
    profileId: card.profileId,
    profileReceipt: card.profileReceipt,
    damageSchool: card.damageSchool,
    exposureBuildupPerHit: card.exposureBuildupPerHit,
    mods: card.mods,
  });
  return JSON.stringify(attacks(left).map(project)) === JSON.stringify(attacks(right).map(project));
}

async function runKnownBadPlant() {
  const sourcePath = resolve(root, 'src/model/loadout.js');
  const source = readFileSync(sourcePath, 'utf8');
  const anchor = 'const eligible = [right, left].filter((source) => source.package);';
  if (!source.includes(anchor)) {
    check(false, 'known-bad right-only plant is armed', 'source anchor drifted');
    return;
  }
  const mutantPath = resolve(root, `src/model/.weapon-card-package-mutant-${process.pid}.mjs`);
  writeFileSync(mutantPath, source.replace(anchor, 'const eligible = [right].filter((source) => source.package);'));
  try {
    const mutant = await import(`${pathToFileURL(mutantPath).href}?mutant=${Date.now()}`);
    const leftOnly = makeRun(baseRegistries, null, 'straightSword');
    const plan = mutant.buildEquippedWeaponCardPlan(baseRegistries, leftOnly.loadout, 'reaver');
    check(plan.slots.every((slot) => slot.profileId !== 'bladeAttack'), 'known-bad right-only lookup turns the left-only fixture RED');
  } finally {
    unlinkSync(mutantPath);
  }
}

if (process.argv.includes('--selftest')) {
  await runKnownBadPlant();
  console.log(`RESULT: ${failed ? `${failed}/${checks} known-bad plant check(s) failed.` : `${checks}/${checks} known-bad plant check(s) passed.`}`);
  process.exit(failed ? 1 : 0);
}

const empty = makeRun(baseRegistries, null, null);
const shieldRight = makeRun(baseRegistries, 'roundShield', null);
const swordRight = makeRun(baseRegistries, 'straightSword', null);
const swordLeft = makeRun(baseRegistries, null, 'straightSword');
const daggerLeft = makeRun(baseRegistries, null, 'dagger');
const dual = makeRun(baseRegistries, 'straightSword', 'dagger');
const creationLeft = createRunState({
  seed: 0xc2ea,
  classId: 'reaver',
  registries: baseRegistries,
  startingHands: { rightHand: null, leftHand: 'straightSword' },
});

check(profiles(empty).every((id) => id === 'unarmedAttack'), 'zero weapons produce Unarmed in all authored attack slots', profiles(empty).join(','));
check(profiles(shieldRight).every((id) => id === 'unarmedAttack'), 'a right-hand shield consumes zero attack slots', profiles(shieldRight).join(','));
check(profiles(swordRight).every((id) => id === 'bladeAttack'), 'right-only Straight Sword owns all authored attack slots', profiles(swordRight).join(','));
check(profiles(swordLeft).every((id) => id === 'bladeAttack'), 'left-only Straight Sword owns all authored attack slots', profiles(swordLeft).join(','));
check(profiles(creationLeft).every((id) => id === 'bladeAttack'), 'run creation invokes the same left-hand composition service');
check(sameCombatProjection(swordLeft, swordRight), 'left-only and right-only outputs are combat-identical except provenance');
check(hands(swordLeft).every((hand) => hand === 'left') && hands(swordRight).every((hand) => hand === 'right'), 'single-weapon provenance records the owning hand');
check(profiles(daggerLeft).every((id) => id === 'daggerPierceAttack'), 'left-only Dagger owns all authored attack slots', profiles(daggerLeft).join(','));
check(JSON.stringify(profiles(dual)) === JSON.stringify(['bladeAttack', 'bladeAttack', 'daggerPierceAttack', 'daggerPierceAttack']), 'dual wield is a deterministic right/left 2+2 split', profiles(dual).join(','));
check(attacks(dual).slice(0, 2).every((card) => !(card.mods || []).includes('hits=2'))
  && attacks(dual).slice(2).every((card) => (card.mods || []).includes('hits=2')), 'weapon-specific effects stay on their source package');
const preview = equipmentSurfaceReceipt(baseRegistries, swordRight, {
  candidate: { slotId: 'leftHand', setIndex: 0, pieceId: 'dagger' },
}).candidate;
check(JSON.stringify(preview.attackPackageChanges.map((row) => [row.name, row.beforeCount, row.afterCount]))
  === JSON.stringify([['Slashing Strike', 4, 2], ['Piercing Flurry', 0, 2]]), 'Armoury comparison exposes exact before/after package counts');

const oddPlan = buildEquippedWeaponCardPlan(baseRegistries, dual.loadout, 'reaver', { attackSlotCount: 5 });
check(JSON.stringify(oddPlan.slots.map((slot) => slot.sourceHand)) === JSON.stringify(['right', 'right', 'right', 'left', 'left']), 'odd N favors right by exactly one slot');
const oddLeftPlan = buildEquippedWeaponCardPlan(baseRegistries, swordLeft.loadout, 'reaver', { attackSlotCount: 5 });
check(oddLeftPlan.slots.length === 5 && oddLeftPlan.slots.every((slot) => slot.sourceHand === 'left'), 'left-only owns every odd-N slot');

const strike = contentBundle.cards.find((card) => card.id === 'strike');
const uniqueRegistries = registriesWith({
  extraCards: [{ ...strike, id: 'testLunge', name: 'Lunge' }],
  armamentPatches: {
    straightSword: {
      weaponCardPackage: {
        handsRequired: 1,
        priorityAttackRefs: ['testLunge'],
        fillerAttackProfileId: 'bladeAttack',
        compatibility: 'attack-v1',
      },
    },
  },
});
const uniqueDual = makeRun(uniqueRegistries, 'straightSword', 'dagger');
check(JSON.stringify(attacks(uniqueDual).map((card) => card.cardId)) === JSON.stringify(['testLunge', 'strike', 'strike', 'strike']), 'right unique ref precedes right filler, then left filler');

const twoHandedRegistries = registriesWith({ armamentPatches: { greatsword: { handsRequired: 2 } } });
const twoHanded = makeRun(twoHandedRegistries, 'greatsword', null);
check(profiles(twoHanded).every((id) => id === 'bladeAttack') && hands(twoHanded).every((hand) => hand === 'right'), 'explicit two-handed weapon receives every attack slot');
const invalidTwoHanded = structuredClone(twoHanded.loadout);
invalidTwoHanded.sets.leftHand[0] = 'dagger';
check(throwsNamed(() => buildEquippedWeaponCardPlan(twoHandedRegistries, invalidTwoHanded, 'reaver'), /two-handed weapon conflicts/), 'restored two-handed plus offhand state fails closed');
const greatsword = baseRegistries.equipment.armaments.find((piece) => piece.id === 'greatsword');
check(greatsword.handsRequired === undefined && WeaponDeckCompositionService.buildEquippedWeaponCardPlan(baseRegistries, makeRun(baseRegistries, 'greatsword', null).loadout, 'reaver').slots.length === 4, 'Greatsword stays one-handed/either unless handsRequired is explicit');

const duplicate = structuredClone(swordRight.loadout);
duplicate.sets.leftHand[0] = 'straightSword';
check(throwsNamed(() => buildEquippedWeaponCardPlan(baseRegistries, duplicate, 'reaver'), /duplicate equipped armament/), 'same piece id in both hands fails without equipment-instance identity');
const corruptRegistries = registriesWith({ armamentPatches: { straightSword: { weaponCardPackage: { handsRequired: 1, priorityAttackRefs: [], fillerAttackProfileId: 'missingProfile', compatibility: 'attack-v1' } } } });
check(throwsNamed(() => makeRun(corruptRegistries, 'straightSword', null), /missing attack profile/), 'claimed package with missing filler/profile is content-invalid, never Unarmed');

const mutable = makeRun(baseRegistries, 'straightSword', null);
const unrelatedBefore = JSON.stringify(mutable.deck.filter((card) => card.equipmentRole !== 'attack'));
const attackIdentityBefore = attacks(mutable).map((card, index) => {
  card.upgraded = index === 0;
  card.acquiredAt = `floor-${index}`;
  return { instanceId: card.instanceId, equipmentAttackSlotId: card.equipmentAttackSlotId, upgraded: card.upgraded, acquiredAt: card.acquiredAt };
});
const events = [];
mutable.loadout.storage.push('dagger');
check(equipPiece(baseRegistries, mutable.loadout, 'leftHand', 0, 'dagger', ownsEverything, { ...atCamp, onEquipmentChanged: (event) => events.push(event) }), 'equip commits through the loadout mutation gate');
const mutablePlan = WeaponDeckCompositionService.buildEquippedWeaponCardPlan(baseRegistries, mutable.loadout, mutable.class);
WeaponDeckCompositionService.applyEquippedWeaponCardPlan(mutablePlan, mutable.deck);
check(JSON.stringify(mutable.deck.filter((card) => card.equipmentRole !== 'attack')) === unrelatedBefore, 'weapon-plan apply leaves signature/guard/technique bytes unchanged');
stampDeck(baseRegistries, mutable);
const once = JSON.stringify(mutable.deck);
stampDeck(baseRegistries, mutable);
check(JSON.stringify(mutable.deck) === once, 'compose/apply twice is byte-identical after the first pass');
check(mutable.deck.length === 10 && attacks(mutable).length === 4, 'equip preserves deck size and authored attack count');
check(JSON.stringify(attacks(mutable).map((card) => ({ instanceId: card.instanceId, equipmentAttackSlotId: card.equipmentAttackSlotId, upgraded: card.upgraded, acquiredAt: card.acquiredAt }))) === JSON.stringify(attackIdentityBefore), 'slot ids, instance ids, upgrades, and acquisition metadata survive rebind');
check(events.length === 1 && events[0].reason === 'equip' && events[0].changedPositions.length > 0, 'equip emits one post-commit equipmentChanged receipt');

check(equipPiece(baseRegistries, mutable.loadout, 'rightHand', 0, null, ownsEverything, { ...atCamp, onEquipmentChanged: (event) => events.push(event) }), 'unequip commits through the same gate');
stampDeck(baseRegistries, mutable);
check(profiles(mutable).every((id) => id === 'daggerPierceAttack'), 'removing one of two gives every slot to the survivor');
check(equipPiece(baseRegistries, mutable.loadout, 'leftHand', 0, null, ownsEverything, atCamp), 'removing the last weapon commits');
stampDeck(baseRegistries, mutable);
check(profiles(mutable).every((id) => id === 'unarmedAttack'), 'removing the last weapon clears stale refs to Unarmed');

const moved = makeRun(baseRegistries, null, 'dagger');
const moveEvents = [];
check(equipPiece(baseRegistries, moved.loadout, 'rightHand', 0, 'dagger', ownsEverything, { ...atCamp, onEquipmentChanged: (event) => moveEvents.push(event) }), 'hand move commits atomically');
stampDeck(baseRegistries, moved);
check(hands(moved).every((hand) => hand === 'right') && moveEvents.length === 1 && moveEvents[0].reason === 'move', 'hand move recomposes provenance and emits move');

const swapped = makeRun(baseRegistries, 'straightSword', null);
swapped.loadout.sets.rightHand[1] = 'dagger';
const swapEvents = [];
check(cycleSet(baseRegistries, swapped.loadout, 'rightHand', 1, { meta: {}, inCombat: false, classId: 'reaver', onEquipmentChanged: (event) => swapEvents.push(event) }), 'active-set swap commits');
stampDeck(baseRegistries, swapped);
check(profiles(swapped).every((id) => id === 'daggerPierceAttack') && swapEvents.length === 1 && swapEvents[0].reason === 'swapSet', 'active-set swap recomposes and emits one swapSet receipt');

const storage = createMemoryStorage();
const saves = createSaveManager(storage);
const legacy = makeRun(baseRegistries, null, 'dagger');
for (const card of attacks(legacy)) {
  delete card.equipmentAttackSlotId;
  delete card.equipmentPlanFingerprint;
  delete card.sourceHand;
  delete card.weaponId;
  card.cardId = 'strike';
  card.profileId = 'unarmedAttack';
}
storage.setItem(RUN_KEY, JSON.stringify(legacy));
const loaded = saves.loadRun(baseRegistries);
check(loaded && JSON.stringify(attacks(loaded).map((card) => card.equipmentAttackSlotId)) === JSON.stringify(['attack:0', 'attack:1', 'attack:2', 'attack:3']), 'legacy role-only attacks migrate once in deck order without append');
check(profiles(loaded).every((id) => id === 'daggerPierceAttack'), 'load/continue recomposes from the restored left-hand weapon');
saves.saveRun(loaded);
const loadedAgain = saves.loadRun(baseRegistries);
check(JSON.stringify(loadedAgain) === JSON.stringify(loaded), 'save round-trip is deterministic after migration');

const combatRun = makeRun(baseRegistries, 'straightSword', null);
combatRun.loadout.sets.rightHand[1] = 'dagger';
const combat = createCombat({
  registries: baseRegistries,
  rng: createRng(0x5157),
  player: {
    classId: combatRun.class,
    attributes: combatRun.attributes,
    maxHp: combatRun.maxHp,
    hp: combatRun.hp,
    maxMana: combatRun.maxMana,
    mana: combatRun.mana,
    maxStamina: combatRun.maxStamina,
    stamina: combatRun.stamina,
    energyMax: combatRun.energyMax,
    drawPerTurn: combatRun.drawPerTurn,
    deck: combatRun.deck,
    relicIds: combatRun.relics,
    loadout: combatRun.loadout,
    equipmentProfileRuleSnapshot: combatRun.equipmentProfileRuleSnapshot,
  },
  enemyIds: ['fellWarden'],
});
const generated = pileNames.flatMap((name) => combat.piles[name]).filter((card) => card.equipmentRole === 'attack');
for (const name of pileNames) combat.piles[name] = combat.piles[name].filter((card) => card.equipmentRole !== 'attack');
generated.forEach((card, index) => combat.piles[pileNames[index % pileNames.length]].push(card));
const swapResult = dispatch(combat, { type: 'swapArmament', slotId: 'rightHand', setIndex: 1 });
const liveAttacks = pileNames.flatMap((name) => combat.piles[name]).filter((card) => card.equipmentRole === 'attack');
check(liveAttacks.length === 4 && liveAttacks.every((card) => card.profileId === 'daggerPierceAttack'), 'combat swap rebinds stable attacks in hand/draw/discard/exhaust');
check(swapResult.events.filter((event) => event.type === 'equipmentChanged').length === 1, 'combat swap emits exactly one equipmentChanged event');
check(liveAttacks.every((card) => resolveCard(baseRegistries, card).name === 'Piercing Flurry'), 'live pile cards resolve through their new package immediately after swap');

const currentSnapshotRun = activeSnapshotRun(baseRegistries, 'straightSword', 'dagger');
currentSnapshotRun.streamCounters.enemyAI = 7;
currentSnapshotRun.streamCounters.shuffle = 11;
const currentCountersBefore = JSON.stringify(currentSnapshotRun.streamCounters);
const currentSnapshotBefore = JSON.stringify(currentSnapshotRun.combatEntered.snapshot);
const currentSnapshotIdentity = JSON.stringify(snapshotIdentity(currentSnapshotRun.combatEntered.snapshot));
check(JSON.stringify(snapshotAttackRows(currentSnapshotRun.combatEntered.snapshot).map(({ card }) => card.acquiredAt).sort())
  === JSON.stringify(['snapshot-floor-0', 'snapshot-floor-1', 'snapshot-floor-2', 'snapshot-floor-3']), 'combat creation carries acquisition metadata into live generated attack piles');
const currentSnapshotLoad = loadStoredRun(baseRegistries, currentSnapshotRun);
check(!!currentSnapshotLoad.loaded, 'current combat snapshot passes the ordinary load/continue door');
if (currentSnapshotLoad.loaded) {
  const loadedSnapshot = currentSnapshotLoad.loaded.combatEntered.snapshot;
  check(JSON.stringify(loadedSnapshot) === currentSnapshotBefore, 'current combat snapshot migration is byte-identical on first pass');
  check(JSON.stringify(snapshotIdentity(loadedSnapshot)) === currentSnapshotIdentity, 'current snapshot preserves pile, instance, upgrade, and acquisition identity');
  check(JSON.stringify(currentSnapshotLoad.loaded.streamCounters) === currentCountersBefore, 'snapshot migration preserves every named RNG stream counter');
  const restoredRng = createRng(currentSnapshotLoad.loaded.seed, currentSnapshotLoad.loaded.streamCounters);
  const controlRng = createRng(currentSnapshotLoad.loaded.seed, currentSnapshotLoad.loaded.streamCounters);
  const normalizedCountersBeforeRestore = JSON.stringify(controlRng.getCounters());
  const restored = restoreCombatSnapshot({ registries: baseRegistries, rng: restoredRng, snapshot: loadedSnapshot });
  check(JSON.stringify(serializeCombatSnapshot(restored)) === currentSnapshotBefore, 'current snapshot restores without replaying combat or consuming state');
  const countersAfterRestore = JSON.stringify(restoredRng.getCounters());
  const restoredNextEnemyAi = restoredRng.float('enemyAI');
  const controlNextEnemyAi = controlRng.float('enemyAI');
  check(countersAfterRestore === normalizedCountersBeforeRestore && restoredNextEnemyAi === controlNextEnemyAi,
    'snapshot restore consumes no RNG and preserves the next deterministic result',
    `counters=${countersAfterRestore} next=${restoredNextEnemyAi}/${controlNextEnemyAi}`);
  currentSnapshotLoad.saves.saveRun(currentSnapshotLoad.loaded);
  const loadedAgain = currentSnapshotLoad.saves.loadRun(baseRegistries);
  check(JSON.stringify(loadedAgain?.combatEntered?.snapshot) === JSON.stringify(loadedSnapshot), 'current snapshot composition is idempotent across a second save/load');
}

const legacySnapshotRun = activeSnapshotRun(baseRegistries, null, 'dagger', 'straightSword', null);
const legacySnapshot = legacySnapshotRun.combatEntered.snapshot;
const legacyStableState = JSON.stringify({
  turn: legacySnapshot.turn,
  phase: legacySnapshot.phase,
  result: legacySnapshot.result,
  player: legacySnapshot.player,
  enemies: legacySnapshot.enemies,
  eventLog: legacySnapshot.eventLog,
  triggerState: legacySnapshot.triggerState,
  idCounter: legacySnapshot.idCounter,
});
const legacyIdentity = JSON.stringify(snapshotIdentity(legacySnapshot));
for (const { card } of snapshotAttackRows(legacySnapshot)) {
  delete card.equipmentAttackSlotId;
  delete card.equipmentPlanFingerprint;
  delete card.sourceHand;
  delete card.weaponId;
  card.cardId = 'strike';
  card.profileId = 'unarmedAttack';
}
const legacySnapshotLoad = loadStoredRun(baseRegistries, legacySnapshotRun);
check(!!legacySnapshotLoad.loaded, 'legacy left-only combat snapshot migrates through load/continue');
if (legacySnapshotLoad.loaded) {
  const migrated = legacySnapshotLoad.loaded.combatEntered.snapshot;
  const rows = snapshotAttackRows(migrated);
  check(JSON.stringify(rows.map(({ card }) => card.equipmentAttackSlotId)) === JSON.stringify(['attack:0', 'attack:1', 'attack:2', 'attack:3']), 'legacy snapshot slots map once in draw/hand/discard/exhaust order');
  check(rows.every(({ card }) => card.profileId === 'daggerPierceAttack' && card.sourceHand === 'left'), 'legacy snapshot uses its authoritative left-hand Dagger instead of stale top-level loadout');
  check(JSON.stringify(snapshotIdentity(migrated)) === legacyIdentity, 'legacy snapshot keeps pile, instance, upgrade, and acquisition identity');
  check(JSON.stringify({
    turn: migrated.turn,
    phase: migrated.phase,
    result: migrated.result,
    player: migrated.player,
    enemies: migrated.enemies,
    eventLog: migrated.eventLog,
    triggerState: migrated.triggerState,
    idCounter: migrated.idCounter,
  }) === legacyStableState, 'snapshot migration preserves turn, combatants, events, triggers, and id counter');
  check(JSON.stringify(legacySnapshotLoad.loaded.loadout) === JSON.stringify(migrated.loadout), 'authoritative active snapshot loadout replaces the stale top-level run loadout');
}

const invalidTwoHandedSnapshot = activeSnapshotRun(twoHandedRegistries, 'greatsword', null);
invalidTwoHandedSnapshot.combatEntered.snapshot.loadout.sets.leftHand[0] = 'dagger';
const invalidTwoHandedLoad = loadStoredRun(twoHandedRegistries, invalidTwoHandedSnapshot);
check(invalidTwoHandedLoad.loaded === null && /two-handed weapon conflicts/.test(invalidTwoHandedLoad.saves.runStatus().reason || ''), 'invalid two-handed plus offhand snapshot fails closed by name');

const invalidDuplicateSnapshot = activeSnapshotRun(baseRegistries, 'straightSword', null);
invalidDuplicateSnapshot.combatEntered.snapshot.loadout.sets.leftHand[0] = 'straightSword';
const invalidDuplicateLoad = loadStoredRun(baseRegistries, invalidDuplicateSnapshot);
check(invalidDuplicateLoad.loaded === null && /duplicate equipped armament/.test(invalidDuplicateLoad.saves.runStatus().reason || ''), 'invalid duplicate snapshot loadout fails closed by name');

const danglingSnapshotRun = activeSnapshotRun(baseRegistries, null, 'dagger');
snapshotAttackRows(danglingSnapshotRun.combatEntered.snapshot)[0].card.cardId = 'removedByContentPatch';
const danglingSnapshotLoad = loadStoredRun(baseRegistries, danglingSnapshotRun);
check(danglingSnapshotLoad.loaded === null && /piles\.draw\.cardId/.test(danglingSnapshotLoad.saves.runStatus().reason || ''), 'existing d163 snapshot reference validation runs before composition can mask an unknown card');

const unknownArmamentSnapshot = activeSnapshotRun(baseRegistries, 'straightSword', null);
unknownArmamentSnapshot.combatEntered.snapshot.loadout.sets.rightHand[0] = 'noSuchArmament';
const unknownArmamentLoad = loadStoredRun(baseRegistries, unknownArmamentSnapshot);
check(rejectedWithPreservedRaw(unknownArmamentLoad, /loadout\.sets\.rightHand\[0\].*noSuchArmament/),
  'unknown active snapshot armament fails closed and archives exact raw bytes', unknownArmamentLoad.saves.runStatus().reason || 'loaded');

const missingRightHandSnapshot = activeSnapshotRun(baseRegistries, 'straightSword', null);
delete missingRightHandSnapshot.combatEntered.snapshot.loadout.sets.rightHand;
const missingRightHandLoad = loadStoredRun(baseRegistries, missingRightHandSnapshot);
check(rejectedWithPreservedRaw(missingRightHandLoad, /loadout\.sets\.rightHand must be an array/),
  'missing snapshot rightHand set fails closed and archives exact raw bytes', missingRightHandLoad.saves.runStatus().reason || 'loaded');

const activeIndexSnapshot = activeSnapshotRun(baseRegistries, 'straightSword', null);
activeIndexSnapshot.combatEntered.snapshot.loadout.active.rightHand = 99;
const activeIndexLoad = loadStoredRun(baseRegistries, activeIndexSnapshot);
check(rejectedWithPreservedRaw(activeIndexLoad, /loadout\.active\.rightHand.*in range/),
  'out-of-range snapshot active index fails closed and archives exact raw bytes', activeIndexLoad.saves.runStatus().reason || 'loaded');

const rolelessAttackSnapshot = activeSnapshotRun(baseRegistries, 'straightSword', null);
for (const { card } of snapshotAttackRows(rolelessAttackSnapshot.combatEntered.snapshot)) {
  for (const field of ['equipmentRole', 'equipmentAttackSlotId', 'equipmentPlanFingerprint', 'sourceHand', 'sourceEquipmentInstanceId', 'weaponId', 'profileId', 'profileReceipt']) {
    delete card[field];
  }
}
const rolelessAttackLoad = loadStoredRun(baseRegistries, rolelessAttackSnapshot);
check(rejectedWithPreservedRaw(rolelessAttackLoad, /attack instance count 0 does not match authored 4/),
  'snapshot attacks stripped of role/package fields fail closed and archive exact raw bytes', rolelessAttackLoad.saves.runStatus().reason || 'loaded');

const missingAttackSnapshot = activeSnapshotRun(baseRegistries, 'straightSword', null);
for (const pile of pileNames) {
  missingAttackSnapshot.combatEntered.snapshot.piles[pile] = missingAttackSnapshot.combatEntered.snapshot.piles[pile]
    .filter((card) => card.equipmentRole !== 'attack');
}
const missingAttackLoad = loadStoredRun(baseRegistries, missingAttackSnapshot);
check(rejectedWithPreservedRaw(missingAttackLoad, /attack instance count 0 does not match authored 4/),
  'snapshot with all generated attacks removed fails closed and archives exact raw bytes', missingAttackLoad.saves.runStatus().reason || 'loaded');

const wrongClassGrantSnapshot = activeSnapshotRun(baseRegistries, 'straightSword', null);
wrongClassGrantSnapshot.combatEntered.snapshot.loadout.creationArmourGrant = { classId: 'rogue', id: 'default' };
const wrongClassGrantLoad = loadStoredRun(baseRegistries, wrongClassGrantSnapshot);
check(rejectedWithPreservedRaw(wrongClassGrantLoad, /loadout\.creationArmourGrant\.classId.*rogue.*player\.classId.*reaver/),
  'wrong-class snapshot creationArmourGrant fails closed and archives exact raw bytes', wrongClassGrantLoad.saves.runStatus().reason || 'loaded');

const unknownGrantSnapshot = activeSnapshotRun(baseRegistries, 'straightSword', null);
unknownGrantSnapshot.combatEntered.snapshot.loadout.creationArmourGrant = { classId: 'reaver', id: 'noSuchArmour' };
const unknownGrantLoad = loadStoredRun(baseRegistries, unknownGrantSnapshot);
check(rejectedWithPreservedRaw(unknownGrantLoad, /loadout\.creationArmourGrant\.id.*noSuchArmour/),
  'unknown snapshot creationArmourGrant id fails closed and archives exact raw bytes', unknownGrantLoad.saves.runStatus().reason || 'loaded');

const duplicateStorageSnapshot = activeSnapshotRun(baseRegistries, 'straightSword', null);
duplicateStorageSnapshot.combatEntered.snapshot.loadout.storage = ['dagger', 'dagger'];
const duplicateStorageLoad = loadStoredRun(baseRegistries, duplicateStorageSnapshot);
check(rejectedWithPreservedRaw(duplicateStorageLoad, /loadout\.storage\[1\].*dagger.*loadout\.storage\[0\]/),
  'duplicate snapshot storage location fails closed and archives exact raw bytes', duplicateStorageLoad.saves.runStatus().reason || 'loaded');

const duplicateInactiveHandsSnapshot = activeSnapshotRun(baseRegistries, 'straightSword', null);
duplicateInactiveHandsSnapshot.combatEntered.snapshot.loadout.sets.rightHand[1] = 'dagger';
duplicateInactiveHandsSnapshot.combatEntered.snapshot.loadout.sets.leftHand[1] = 'dagger';
const duplicateInactiveHandsLoad = loadStoredRun(baseRegistries, duplicateInactiveHandsSnapshot);
check(rejectedWithPreservedRaw(duplicateInactiveHandsLoad, /loadout\.sets\.leftHand\[1\].*dagger.*loadout\.sets\.rightHand\[1\]/),
  'duplicate inactive cross-hand snapshot armament fails closed and archives exact raw bytes', duplicateInactiveHandsLoad.saves.runStatus().reason || 'loaded');

console.log(`RESULT: ${failed ? `${failed}/${checks} weapon-card-package check(s) failed.` : `${checks}/${checks} weapon-card-package checks passed.`}`);
process.exit(failed ? 1 : 0);
