#!/usr/bin/env node
// Issue #211 — deterministic, non-writing acceptance gate for run-owned
// armament Smithing. This tool exercises the real content/model/save/session
// modules from the selected tree. It writes only to in-memory save storage.
//
//   node tools/armament-smithing.mjs
//   node tools/armament-smithing.mjs --root <checkout>


import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  if (index < 0) return null;
  if (!process.argv[index + 1] || process.argv[index + 1].startsWith('--')) {
    console.error(`armament-smithing: ${flag} requires a path`);
    process.exit(2);
  }
  return process.argv[index + 1];
}

const ROOT = resolve(valueAfter('--root') || resolve(HERE, '..'));
const required = [
  'src/content/index.js',
  'src/model/registries.js',
  'src/model/validate.js',
  'src/model/smithingRules.js',
  'src/model/state.js',
  'src/model/loadout.js',
  'src/model/smithing.js',
  'src/engine/combat.js',
  'src/engine/combatSnapshot.js',
  'src/engine/actions.js',
  'src/engine/save.js',
  'src/engine/rng.js',
  'tools/session.mjs',
];

let checks = 0;
let failures = 0;

function check(ok, code, detail) {
  checks += 1;
  if (ok) console.log(`  PASS ${code} - ${detail}`);
  else {
    failures += 1;
    console.error(`  RED  ${code} - ${detail}`);
  }
}

function thrown(fn, pattern = undefined) {
  try {
    fn();
    return null;
  } catch (error) {
    if (pattern && !pattern.test(error?.message || '')) return null;
    return error;
  }
}

function amount(receipt, op) {
  const row = (receipt?.changes || []).find((change) => change.op === op);
  return row ? [row.before, row.after] : null;
}

function cardAmount(resolveCard, registries, instance, op) {
  const effect = (resolveCard(registries, instance).effects || []).find((row) => row.op === op);
  return effect?.amount ?? effect?.stacks ?? null;
}

async function fromRoot(relative) {
  return import(pathToFileURL(join(ROOT, relative)).href);
}

async function main() {
  const missing = required.filter((relative) => !existsSync(join(ROOT, relative)));
  if (missing.length) throw new Error(`selected root is missing: ${missing.join(', ')}`);

  const [{ contentBundle }, registriesModule, validateModule, stateModule, loadoutModule,
    smithingModule, combatModule, combatSnapshotModule, actionsModule, saveModule, rngModule, sessionModule] = await Promise.all([
    fromRoot('src/content/index.js'),
    fromRoot('src/model/registries.js'),
    fromRoot('src/model/validate.js'),
    fromRoot('src/model/state.js'),
    fromRoot('src/model/loadout.js'),
    fromRoot('src/model/smithing.js'),
    fromRoot('src/engine/combat.js'),
    fromRoot('src/engine/combatSnapshot.js'),
    fromRoot('src/engine/actions.js'),
    fromRoot('src/engine/save.js'),
    fromRoot('src/engine/rng.js'),
    fromRoot('tools/session.mjs'),
  ]);

  const { createRegistries, resolveCard } = registriesModule;
  const { validateContent } = validateModule;
  const { createRunState } = stateModule;
  const { stampDeck } = loadoutModule;
  const {
    smithingPlan,
    commitSmithing,
    grantSmithingReward,
  } = smithingModule;
  const { createCombat, dispatch } = combatModule;
  const { commitCombatSnapshot, restoreCombatSnapshot } = combatSnapshotModule;
  const { executeRunEffects } = actionsModule;
  const { createSaveManager, createMemoryStorage, RUN_KEY } = saveModule;
  const { createRng } = rngModule;
  const { createSession, restoreSession } = sessionModule;

  const registries = createRegistries(contentBundle);
  const contentVerdict = validateContent(contentBundle);
  check(contentVerdict.ok, 'SMITH-CONTENT-DOOR', 'the shipped economy passes the ordinary boot-time content validator');
  const malformedEconomy = validateContent({
    ...contentBundle,
    balance: {
      ...contentBundle.balance,
      smithing: {
        ...contentBundle.balance.smithing,
        rewardByPool: { normal: 0, elite: 1, boss: -1, treasure: 0 },
      },
    },
  });
  check(!malformedEconomy.ok && malformedEconomy.errors.some((row) => row.path === 'balance.smithing' && /boss/.test(row.msg)),
    'SMITH-CONTENT-REFUSAL', 'the boot-time content door rejects a malformed negative boss faucet by name');
  const newReaver = (seed = 211) => createRunState({ seed, classId: 'reaver', registries });
  const combatPlayer = (candidate) => ({
    classId: candidate.class,
    attributes: candidate.attributes,
    maxHp: candidate.maxHp,
    hp: candidate.hp,
    maxMana: candidate.maxMana,
    mana: candidate.mana,
    maxStamina: candidate.maxStamina,
    stamina: candidate.stamina,
    energyMax: candidate.energyMax,
    drawPerTurn: candidate.drawPerTurn,
    deck: candidate.deck,
    relicIds: candidate.relics,
    flasks: candidate.flasks,
    flaskCharges: candidate.flaskCharges,
    loadout: candidate.loadout,
    armamentLevels: candidate.armamentLevels,
    equipmentProfileRuleSnapshot: candidate.equipmentProfileRuleSnapshot,
  });
  const combatCards = (combat, predicate) => ['draw', 'hand', 'discard', 'exhaust']
    .flatMap((pile) => combat.piles[pile]).filter(predicate);

  console.log(`armament-smithing — issue #211 source/model gate\n  root: ${ROOT}\n`);

  // Zero purse, stable armament identities, exact affected-card partition, and
  // actual engine-resolved preview values.
  const run = newReaver();
  const zero = smithingPlan(registries, run);
  const sword = zero.candidates.find((row) => row.armamentId === 'straightSword');
  const shield = zero.candidates.find((row) => row.armamentId === 'roundShield');
  check(zero.stones === 0 && run.smithingStones === 0,
    'SMITH-PURSE-ZERO', 'a new run starts with zero Smithing Stones');
  check(zero.candidates.length === 2
      && new Set(zero.candidates.map((row) => row.armamentId)).size === 2,
    'SMITH-DISTINCT-ARMAMENTS', 'four attacks plus Technique collapse to one sword choice; four Guards to one shield choice');
  check(zero.candidates.every((row) => row.inventoryCount === 1),
    'SMITH-INVENTORY-COUNT', 'each Smithing candidate reports its exact single owned inventory instance');
  check(sword?.affectedCards.length === 5
      && sword.affectedCards.filter((row) => row.role === 'attack').length === 4
      && sword.affectedCards.filter((row) => row.role === 'technique').length === 1,
    'SMITH-SWORD-PARTITION', 'Straight Sword owns four Attack basics and one Technique basic');
  check(shield?.affectedCards.length === 4
      && shield.affectedCards.every((row) => row.role === 'guard'),
    'SMITH-SHIELD-PARTITION', 'Round Shield owns all four Guard basics and no sword basic');

  const strikePreview = sword?.affectedCards.find((row) => row.role === 'attack');
  const techniquePreview = sword?.affectedCards.find((row) => row.role === 'technique');
  const guardPreview = shield?.affectedCards[0];
  check(JSON.stringify(amount(strikePreview, 'damage')) === '[7,10]'
      && JSON.stringify(amount(techniquePreview, 'block')) === '[3,5]'
      && JSON.stringify(amount(guardPreview, 'block')) === '[7,10]',
    'SMITH-REAL-DELTAS', 'preview is engine-resolved: Strike 7→10, Technique Block 3→5, Guard 7→10');
  check(sword?.cost === 1 && sword?.shortfall === 1 && sword?.affordable === false
      && shield?.cost === 1 && shield?.shortfall === 1 && shield?.affordable === false,
    'SMITH-UNAFFORDABLE', 'both choices name cost 1 and shortfall 1 without hiding the picker');
  check(!!thrown(() => commitSmithing(registries, run, 'straightSword'), /Insufficient Smithing Stones/)
      && run.smithingStones === 0 && Object.keys(run.armamentLevels).length === 0,
    'SMITH-REFUSE-NO-STONE', 'an unaffordable commit changes neither purse nor armament tiers');

  // Paid transaction, whole-source propagation, cap, free promotion, future
  // copy inheritance, and swap-away/back restoration.
  run.smithingStones = 1;
  const paid = commitSmithing(registries, run, 'straightSword');
  const swordCards = run.deck.filter((card) => card.sourceArmamentId === 'straightSword');
  const shieldCards = run.deck.filter((card) => card.sourceArmamentId === 'roundShield');
  check(paid.cost === 1 && paid.stoneBalanceBefore === 1 && paid.stoneBalanceAfter === 0
      && run.smithingStones === 0 && run.armamentLevels.straightSword === 1,
    'SMITH-SPEND-EXACT', 'paid Smithing spends exactly one Stone and promotes only the source tier');
  check(swordCards.length === 5 && swordCards.every((card) => card.smithingLevel === 1 && card.upgraded === false)
      && swordCards.filter((card) => card.equipmentRole === 'attack')
        .every((card) => cardAmount(resolveCard, registries, card, 'damage') === 10)
      && cardAmount(resolveCard, registries,
        swordCards.find((card) => card.equipmentRole === 'technique'), 'block') === 5,
    'SMITH-WHOLE-SOURCE', 'all five sword-owned basics resolve at tier 1 with no per-copy upgrade authority');
  check(shieldCards.length === 4 && shieldCards.every((card) => card.smithingLevel === 0)
      && shieldCards.every((card) => cardAmount(resolveCard, registries, card, 'block') === 7),
    'SMITH-OTHER-SOURCE-STABLE', 'Smithing the sword leaves every shield-owned Guard unchanged');
  const stonesAtCap = run.smithingStones;
  check(!smithingPlan(registries, run).candidates.some((row) => row.armamentId === 'straightSword')
      && !!thrown(() => commitSmithing(registries, run, 'straightSword'), /not an eligible Smithing candidate/)
      && run.smithingStones === stonesAtCap && run.armamentLevels.straightSword === 1,
    'SMITH-CAP', 'the level-1 cap refuses a second promotion without spending');

  const freeRun = newReaver(212);
  const free = commitSmithing(registries, freeRun, 'straightSword', undefined, { free: true });
  check(free.free === true && free.cost === 0 && freeRun.smithingStones === 0
      && freeRun.armamentLevels.straightSword === 1,
    'SMITH-FREE-GRANT', 'a free upgrade promotes the source armament and spends zero Stones');

  const keepsakeRun = newReaver(2111);
  const whetstone = registries.characterCreation.keepsakes.find((row) => row.id === 'whetstoneMemory');
  executeRunEffects({ run: keepsakeRun, registries, rng: createRng(11) }, whetstone.effects);
  const keepsakeSword = keepsakeRun.deck.filter((card) => card.sourceArmamentId === 'straightSword');
  check(keepsakeRun.armamentLevels.straightSword === 1
      && keepsakeSword.length === 5
      && keepsakeSword.every((card) => card.smithingLevel === 1 && card.upgraded === false)
      && keepsakeSword.filter((card) => card.equipmentRole === 'attack')
        .every((card) => cardAmount(resolveCard, registries, card, 'damage') === 10),
    'SMITH-WHETSTONE-ROUTE', 'Whetstone Memory promotes the whole Straight Sword source while the retired per-copy flag stays clear');

  const originalAttack = run.deck.find((card) => card.equipmentRole === 'attack');
  const futureAttack = { ...structuredClone(originalAttack), instanceId: 'future-attack', smithingLevel: 0 };
  delete futureAttack.sourceArmamentId;
  stampDeck(registries, run, [futureAttack], { adoptEquipmentBonuses: false, reconcileEquipmentPools: false });
  check(futureAttack.sourceArmamentId === 'straightSword' && futureAttack.smithingLevel === 1
      && futureAttack.upgraded === false
      && cardAmount(resolveCard, registries, futureAttack, 'damage') === 10,
    'SMITH-FUTURE-COPY', 'a recreated sourced basic inherits the current armament tier when stamped');

  run.loadout.sets.rightHand[1] = 'dagger';
  run.loadout.active.rightHand = 1;
  stampDeck(registries, run);
  const daggerState = run.deck.filter((card) => card.equipmentRole === 'attack');
  const awayOk = daggerState.length === 4
    && daggerState.every((card) => card.sourceArmamentId === 'dagger' && card.smithingLevel === 0)
    && daggerState.every((card) => cardAmount(resolveCard, registries, card, 'damage') === 7);
  run.loadout.active.rightHand = 0;
  stampDeck(registries, run);
  const restoredSword = run.deck.filter((card) => card.equipmentRole === 'attack');
  check(awayOk && restoredSword.length === 4
      && restoredSword.every((card) => card.sourceArmamentId === 'straightSword' && card.smithingLevel === 1)
      && restoredSword.every((card) => cardAmount(resolveCard, registries, card, 'damage') === 10),
    'SMITH-SWAP-RESTORE', 'switching to an unsmithed weapon removes the tier; switching back restores it');

  // The real combat intent door must recompose all live piles using the
  // run-owned tier, and an active-combat save must carry that authority through
  // the ordinary save/load and snapshot restoration doors.
  const liveRun = newReaver(218);
  liveRun.smithingStones = 1;
  commitSmithing(registries, liveRun, 'straightSword');
  liveRun.loadout.sets.rightHand[1] = 'dagger';
  liveRun.loadout.active.rightHand = 1;
  stampDeck(registries, liveRun);
  const liveCombat = createCombat({
    registries,
    rng: createRng(218),
    player: combatPlayer(liveRun),
    enemyIds: ['fellWarden'],
  });
  const swapEvents = dispatch(liveCombat, { type: 'swapArmament', slotId: 'rightHand', setIndex: 0 }).events;
  const liveSwordCards = combatCards(liveCombat, (card) => card.equipmentRole === 'attack');
  check(liveCombat.loadout.active.rightHand === 0
      && swapEvents.filter((event) => event.type === 'armamentSwapped').length === 1
      && liveSwordCards.length === 4
      && liveSwordCards.every((card) => card.sourceArmamentId === 'straightSword'
        && card.smithingLevel === 1
        && cardAmount(resolveCard, registries, card, 'damage') === 10),
    'SMITH-COMBAT-SWAP', 'the real combat swap intent restores the smithed sword tier across every live attack pile');

  commitCombatSnapshot({ run: liveRun, combat: liveCombat, nodeId: 'gate-node', encounterId: 'fellWarden' });
  const combatStorage = createMemoryStorage();
  const combatSaves = createSaveManager(combatStorage);
  combatSaves.saveRun(liveRun, createRng(liveRun.seed, liveRun.streamCounters));
  const loadedCombatRun = combatSaves.loadRun(registries);
  const restoredCombat = loadedCombatRun?.combatEntered?.snapshot
    ? restoreCombatSnapshot({
      registries,
      rng: createRng(loadedCombatRun.seed, loadedCombatRun.streamCounters),
      snapshot: loadedCombatRun.combatEntered.snapshot,
    })
    : null;
  const restoredCombatCards = restoredCombat
    ? combatCards(restoredCombat, (card) => card.equipmentRole === 'attack')
    : [];
  check(loadedCombatRun?.armamentLevels?.straightSword === 1
      && loadedCombatRun?.combatEntered?.snapshot?.armamentLevels?.straightSword === 1
      && restoredCombat?.armamentLevels?.straightSword === 1
      && restoredCombatCards.length === 4
      && restoredCombatCards.every((card) => card.sourceArmamentId === 'straightSword'
        && card.smithingLevel === 1
        && cardAmount(resolveCard, registries, card, 'damage') === 10),
    'SMITH-COMBAT-SNAPSHOT-ROUNDTRIP', 'active-combat save/load and snapshot restore retain tier authority and resolved 10-damage attacks');

  // Current save round-trip and one-time legacy per-copy migration.
  const storage = createMemoryStorage();
  const saves = createSaveManager(storage);
  saves.saveRun(run, createRng(run.seed, run.streamCounters));
  const loaded = saves.loadRun(registries);
  check(loaded?.smithingStones === 0 && loaded?.armamentLevels?.straightSword === 1
      && loaded.deck.filter((card) => card.sourceArmamentId === 'straightSword')
        .every((card) => card.smithingLevel === 1)
      && saves.runStatus().state === 'ok',
    'SMITH-SAVE-ROUNDTRIP', 'current save/load preserves purse, tier map, and stamped card carriers without healing');

  const legacyStorage = createMemoryStorage();
  const legacySaves = createSaveManager(legacyStorage);
  const legacy = newReaver(213);
  delete legacy.smithingStones;
  delete legacy.armamentLevels;
  delete legacy.smithingRewardClaims;
  legacy.deck.find((card) => card.equipmentRole === 'attack').upgraded = true;
  const ordinary = legacy.deck.find((card) => !card.equipmentRole);
  ordinary.upgraded = true;
  legacyStorage.setItem(RUN_KEY, JSON.stringify(legacy));
  const migrated = legacySaves.loadRun(registries);
  check(migrated?.smithingStones === 0 && migrated?.armamentLevels?.straightSword === 1
      && Array.isArray(migrated?.smithingRewardClaims)
      && migrated.deck.filter((card) => card.sourceArmamentId === 'straightSword')
        .every((card) => card.upgraded === false && card.smithingLevel === 1)
      && migrated.deck.find((card) => card.instanceId === ordinary.instanceId)?.upgraded === true,
    'SMITH-LEGACY-MIGRATION', 'legacy equipment flag promotes once to its armament while an ordinary card upgrade survives');
  check(legacySaves.runStatus().state === 'healed'
      && legacySaves.runStatus().ledger?.entries?.some((entry) => entry.site === 'smithing.js:initializeRunSmithing'),
    'SMITH-MIGRATION-RECEIPT', 'the save door reports the legacy Smithing initialization in its heal ledger');

  const legacyCombatStorage = createMemoryStorage();
  const legacyCombatSaves = createSaveManager(legacyCombatStorage);
  const legacyCombatRun = newReaver(220);
  const legacyCombat = createCombat({
    registries,
    rng: createRng(220),
    player: combatPlayer(legacyCombatRun),
    enemyIds: ['fellWarden'],
  });
  commitCombatSnapshot({
    run: legacyCombatRun,
    combat: legacyCombat,
    nodeId: 'legacy-gate-node',
    encounterId: 'fellWarden',
  });
  delete legacyCombatRun.smithingStones;
  delete legacyCombatRun.armamentLevels;
  delete legacyCombatRun.smithingRewardClaims;
  delete legacyCombatRun.combatEntered.snapshot.armamentLevels;
  legacyCombatRun.deck.find((card) => card.equipmentRole === 'attack').upgraded = true;
  legacyCombatStorage.setItem(RUN_KEY, JSON.stringify(legacyCombatRun));
  const migratedLegacyCombatRun = legacyCombatSaves.loadRun(registries);
  const migratedLegacyCombatCards = migratedLegacyCombatRun
    ? ['draw', 'hand', 'discard', 'exhaust'].flatMap((pile) => migratedLegacyCombatRun.combatEntered.snapshot.piles[pile])
      .filter((card) => card.equipmentRole === 'attack')
    : [];
  const restoredLegacyCombat = migratedLegacyCombatRun
    ? restoreCombatSnapshot({
      registries,
      rng: createRng(migratedLegacyCombatRun.seed, migratedLegacyCombatRun.streamCounters),
      snapshot: migratedLegacyCombatRun.combatEntered.snapshot,
    })
    : null;
  check(migratedLegacyCombatRun?.armamentLevels?.straightSword === 1
      && migratedLegacyCombatRun?.combatEntered?.snapshot?.armamentLevels?.straightSword === 1
      && migratedLegacyCombatCards.length === 4
      && migratedLegacyCombatCards.every((card) => card.smithingLevel === 1
        && cardAmount(resolveCard, registries, card, 'damage') === 10)
      && restoredLegacyCombat?.armamentLevels?.straightSword === 1,
    'SMITH-LEGACY-COMBAT-MIGRATION', 'legacy active-combat load promotes before restamping and restores every saved attack at tier 1');

  // Malformed persisted numbers fail closed.
  const malformedPurse = newReaver(214);
  malformedPurse.smithingStones = -1;
  const malformedFraction = newReaver(215);
  malformedFraction.smithingStones = 0.5;
  const malformedLevel = newReaver(216);
  malformedLevel.armamentLevels = { straightSword: 0.5 };
  check(!!thrown(() => smithingPlan(registries, malformedPurse), /integer >= 0/)
      && !!thrown(() => smithingPlan(registries, malformedFraction), /integer >= 0/)
      && !!thrown(() => smithingPlan(registries, malformedLevel), /integer >= 0/),
    'SMITH-MALFORMED-NUMBERS', 'negative/fractional purses and fractional tiers are rejected, never rounded or clamped');

  // Content-owned faucets and idempotent reward claims.
  const rewardRun = newReaver(217);
  const normal = grantSmithingReward(registries, rewardRun, 'normal', 'normal:1');
  const treasure = grantSmithingReward(registries, rewardRun, 'treasure', 'treasure:1');
  const elite = grantSmithingReward(registries, rewardRun, 'elite', 'elite:1');
  const eliteAgain = grantSmithingReward(registries, rewardRun, 'elite', 'elite:1');
  const boss = grantSmithingReward(registries, rewardRun, 'boss', 'boss:1');
  check(normal.amount === 0 && treasure.amount === 0 && elite.amount === 1 && boss.amount === 1
      && rewardRun.smithingStones === 2,
    'SMITH-REWARD-TABLE', 'normal/treasure award 0; elite/boss award 1 from the balance table');
  check(eliteAgain.duplicate === true && eliteAgain.amount === 0
      && rewardRun.smithingRewardClaims.length === 4 && rewardRun.smithingStones === 2,
    'SMITH-REWARD-IDEMPOTENT', 'replaying one reward id is a zero-award duplicate and cannot mint another Stone');

  const faucetStorage = createMemoryStorage();
  const faucetSaves = createSaveManager(faucetStorage);
  const faucetRun = newReaver(219);
  const firstFaucet = grantSmithingReward(registries, faucetRun, 'elite', 'elite:persisted');
  faucetSaves.saveRun(faucetRun, createRng(faucetRun.seed, faucetRun.streamCounters));
  const loadedFaucetRun = faucetSaves.loadRun(registries);
  const replayedFaucet = grantSmithingReward(registries, loadedFaucetRun, 'elite', 'elite:persisted');
  check(firstFaucet.amount === 1 && loadedFaucetRun?.smithingStones === 1
      && loadedFaucetRun?.smithingRewardClaims?.filter((id) => id === 'elite:persisted').length === 1
      && replayedFaucet.duplicate === true && replayedFaucet.amount === 0
      && loadedFaucetRun.smithingStones === 1,
    'SMITH-REWARD-SAVE-REPLAY', 'save/load between an elite claim and replay preserves the claim and refuses a second Stone');

  const pendingStorage = createMemoryStorage();
  const pendingSaves = createSaveManager(pendingStorage);
  const pendingRun = newReaver(221);
  const pendingStone = grantSmithingReward(registries, pendingRun, 'elite', 'elite:pending');
  pendingRun.pendingReward = {
    schemaVersion: 1,
    source: 'elite',
    after: 'map',
    rewards: {
      title: 'ELITE VANQUISHED',
      cinders: 32,
      cardIds: ['crimsonCleave', 'shieldBash', 'quickstep'],
      smithingStoneReceipt: pendingStone,
    },
    states: { smithingStone: 'taken' },
    chosenCardId: null,
  };
  pendingSaves.saveRun(pendingRun, createRng(pendingRun.seed, pendingRun.streamCounters));
  const resumedPending = pendingSaves.loadRun(registries);
  resumedPending.cinders += 32;
  resumedPending.pendingReward.states.cinders = 'taken';
  pendingSaves.saveRun(resumedPending, createRng(resumedPending.seed, resumedPending.streamCounters));
  const resumedPartial = pendingSaves.loadRun(registries);
  check(resumedPartial?.smithingStones === 1
      && resumedPartial?.smithingRewardClaims?.includes('elite:pending')
      && resumedPartial?.pendingReward?.states?.smithingStone === 'taken'
      && resumedPartial?.pendingReward?.states?.cinders === 'taken'
      && resumedPartial?.cinders === pendingRun.cinders + 32,
    'SMITH-PENDING-REWARD-ROUNDTRIP', 'interruption and partial collection preserve the Stone, claim, exact offer, and Taken states');

  const badPendingStorage = createMemoryStorage();
  const badPendingSaves = createSaveManager(badPendingStorage);
  const badPendingRun = structuredClone(pendingRun);
  badPendingRun.pendingReward.rewards.cardIds = ['notARealCard'];
  badPendingStorage.setItem(RUN_KEY, JSON.stringify(badPendingRun));
  check(badPendingSaves.loadRun(registries) === null
      && /Malformed pending reward references/.test(badPendingSaves.runStatus().reason || ''),
    'SMITH-PENDING-REWARD-REFUSAL', 'a saved pending offer with an unknown content id archives by name instead of crashing on resume');

  // Co-op clients send intent only. A forged client-authored affordable view
  // is ignored; the host reconstructs and revalidates the real plan, then its
  // receipt and run-owned state survive host serialization/restoration.
  const coop = createSession({ registries, seedString: 'GOLDBOUGH' });
  const host = coop.addMember({ id: 'host', name: 'Host', classId: 'reaver' });
  coop.addMember({ id: 'guest', name: 'Guest', classId: 'reaver' });
  coop.start();
  const anchor = Object.values(coop.session.mapGraph.nodes)
    .find((node) => Array.isArray(node.next) && node.next.length) || Object.values(coop.session.mapGraph.nodes)[0];
  coop.session.cursorId = anchor.id;
  coop.session.scene = {
    kind: 'shrine',
    done: {},
    smithing: {
      host: { stones: 0, candidates: [{ armamentId: 'straightSword', cost: 0, affordable: true }] },
      guest: smithingPlan(registries, coop.livingMembers().find((member) => member.id === 'guest').run),
    },
    receipts: {},
  };
  const forged = coop.shrineChoice('host', 'smith', 'straightSword');
  check(forged.ok === false && /Insufficient Smithing Stones/.test(forged.error || '')
      && host.run.smithingStones === 0 && !host.run.armamentLevels.straightSword
      && !coop.session.scene.receipts.host,
    'SMITH-COOP-HOST-REFUSAL', 'host ignores a forged affordable client view and refuses the zero-purse intent without mutation');

  host.run.smithingStones = 1;
  coop.session.scene.smithing.host = smithingPlan(registries, host.run);
  const accepted = coop.shrineChoice('host', 'smith', 'straightSword');
  const coopView = coop.snapshot();
  const hostView = coopView.party.find((member) => member.id === 'host');
  check(accepted.ok === true && host.run.smithingStones === 0 && host.run.armamentLevels.straightSword === 1
      && coopView.scene.receipts.host?.armamentId === 'straightSword'
      && hostView?.smithingStones === 0 && hostView?.armamentLevels?.straightSword === 1,
    'SMITH-COOP-HOST-COMMIT', 'host revalidates, spends, promotes, and broadcasts one durable armament receipt');

  const serialized = coop.serialize();
  const restored = restoreSession(registries, structuredClone(serialized));
  const restoredView = restored.snapshot();
  const restoredHost = restoredView.party.find((member) => member.id === 'host');
  check(!!serialized && restoredHost?.smithingStones === 0
      && restoredHost?.armamentLevels?.straightSword === 1
      && restoredHost.deck.filter((card) => card.sourceArmamentId === 'straightSword')
        .every((card) => card.smithingLevel === 1 && card.upgraded === false)
      && restoredView.scene.receipts.host?.afterLevel === 1,
    'SMITH-COOP-RESTORE', 'host serialization/restoration preserves purse, tier, source carriers, and the visible Smith receipt');

  console.log('\n  Boundary: headless source/model/save/session semantics only; no DOM, browser pixels, screenshots, generated bundles, network, or repository writes were checked.');
  if (failures) console.log(`armament-smithing: ${checks - failures} passed, ${failures} failed`);
  else console.log(`armament-smithing: OK — ${checks} checks passed`);
  return failures ? 1 : 0;
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error(`armament-smithing: HARNESS COULD NOT RUN - ${error?.stack || error}`);
  process.exitCode = 2;
}
