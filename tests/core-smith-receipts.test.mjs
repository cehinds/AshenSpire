// Core 2 Smith receipts come from the Core pipeline (gear points, ratings, live card values), never from
// the legacy itemUpgradeChanges card rows, and each shown number is what the next fight does.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState, createCardInstance } from '../src/model/state.js';
import { beginGameProfileRest, commitGameProfileRest } from '../src/model/gameProfileRest.js';
import { gameProfileEquipmentReceipt } from '../src/model/gameProfileRun.js';
import { smithingPlan } from '../src/model/smithing.js';
import { coreCardSimulationCount } from '../src/model/smithingCore.js';
import { smithSelectionModel } from '../src/ui/models/SmithSelectionModel.js';
import { CloseConfirmationModal } from '../src/ui/components/confirmationModal.js';
import { mountSmithUpgradeModal } from '../src/ui/components/smithUpgradeModal.js';
import { withKitDom } from './helpers/dom.mjs';
import { buildActMap } from '../src/engine/actmap.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { withoutStanceBenefits } from './legacyStanceRules.mjs';
import { previewCard, dispatch } from '../src/engine/combat.js';

// These suites measure what a smithed tier adds to a card's printed face. The Core player side scale (x0.7, floored; owner, 2026-11-18) hides a +1 tier behind
// its rounding on most cards, so the author is pinned to 1 here, as the other suites that pin other rules' arithmetic do.
const author = JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url)));
author.modules = { ...author.modules, effects: { ...author.modules?.effects, physicalDamageMultiplier: 1, playerDamageMultiplier: 1, blockGainMultiplier: 1 } };
const profile = resolveGameProfile(author);
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
// The Core Reaver starting deck (#2199) holds its Smash as the weapon art, not core.smash; these tests measure a plain
// Smash card's smithed face, so the fixture adds one copy as a reward pick would.
const fresh = () => {
  const run = createRunState({ seed: 73, classId: 'reaver', registries: reg, runId: 'unique-run' });
  if (!run.deck.some((card) => card.cardId === 'core.smash')) run.deck.push(createCardInstance('core.smash', false, () => 'smash-fixture'));
  return run;
};
const visit = (run) => { run.mapGraph = buildActMap(reg, createRng(73), run.seatOrder[0], 1); run.mapNodeId = Object.values(run.mapGraph.nodes).find(n => n.type === 'shrine').id; return beginGameProfileRest(run, '1:' + run.mapNodeId); };
const fight = (run) => {
  const combat = createRunCombat({ registries: reg, run, rng: createRng(17), enemyIds: ['wanderingSoldier'] });
  combat.enemies[0].hp = combat.enemies[0].maxHp = 1000;
  // The dummy opens in a defend stance; Core Smash doubles against that (a situational matchup, not part of AR), so measure against a target whose stance no matchup favours (neutral).
  combat.enemies[0].combatStance = { maneuver: 'neutral', camp: 'physical', range: 'melee' };
  return combat;
};
// Owner, 2026-11-17 (gear `statPoints`): a Smith tier adds attribute points by the item's weights, never AR or DR. The
// greatsword's first tier adds CON (no card number moves) and its second adds STR (so AR): the card-row tests smith
// it from tier 1 to tier 2.
const GS = 'armament/greatsword';
const pastFirstTier = (run) => { run.itemUpgradeLevels = { ...(run.itemUpgradeLevels || {}), [GS]: 1 }; return run; };
const cardsOf = (combat) => [...combat.piles.hand, ...combat.piles.draw, ...combat.piles.discard];
const liveDamage = (run, cardId) => {
  const combat = fight(run), card = cardsOf(combat).find((row) => row.cardId === cardId);
  // The dummy holds no stance, so it is Idle and takes x1.25 (theme B), which can turn the face's +1 into +2 after the floor; this test is about the
  // Smith receipt, so the target takes the hit at face value.
  if (combat.fixCoreRules?.stanceBenefits?.neutral) delete combat.fixCoreRules.stanceBenefits.neutral.damageTakenMultiplier;
  combat.piles.hand = [card, ...combat.piles.hand.filter((row) => row !== card)];
  combat.player.stamina = combat.player.maxStamina = 99; combat.player.mana = combat.player.maxMana = 99; combat.player.energy = 99;
  const hp = combat.enemies[0].hp;
  const aimed = previewCard(combat, card.instanceId).needsTarget;
  dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, ...(aimed ? { targetId: combat.enemies[0].id } : {}) });
  return hp - combat.enemies[0].hp;
};

test('Core weapon tier: receipt names the attribute and each card it changes, and a played card gains exactly that', () => {
  const run = pastFirstTier(fresh()); visit(run);
  const candidate = smithingPlan(reg, run).candidates.find((row) => row.itemRef === 'armament/greatsword');
  assert.ok(candidate.core);
  assert.deepEqual(candidate.changes.map((row) => [row.label, row.after - row.before]), [['STR', 1]]);
  const receipt = commitGameProfileRest(reg, run, 'smith', { itemRef: 'armament/greatsword' });
  const smith = receipt.smith || receipt;
  const saved = run.lastSmithingReceipt;
  assert.equal(saved.changes[0].label, 'STR');
  const cards = saved.changes.filter((row) => row.kind === 'card' && row.op === 'damage');
  assert.ok(cards.length, 'at least one deck card changes damage');
  assert.ok(cards.every((row) => row.after === row.before + 1), 'STR +1 is AR +1 at weight 1: +1 damage per card');
  assert.ok(smith);
  // The receipt is the printed face: a fight's card face shows exactly before/after (levels reset for before).
  const face = (cardId) => { const combat = fight(run), card = cardsOf(combat).find((row) => row.cardId === cardId);
    const entry = previewCard(combat, card.instanceId, undefined, undefined, { rawFace: true }).values.find((e) => e.op === 'damage'); return entry.faceValue ?? entry.value; };
  const shown = new Map(cards.map((row) => [row.cardId, face(row.cardId)]));
  const played = new Map(cards.map((row) => [row.cardId, liveDamage(run, row.cardId)]));
  run.itemUpgradeLevels = { ...run.itemUpgradeLevels, 'armament/greatsword': 1 };
  for (const row of cards) {
    assert.equal(shown.get(row.cardId), row.after, row.cardId);
    assert.equal(face(row.cardId), row.before, row.cardId);
  }
  // Against the dummy enemy a played hit can lose a point to its defences, but never gains more than the face.
  for (const row of cards) {
    const delta = played.get(row.cardId) - liveDamage(run, row.cardId);
    assert.ok(delta >= 0 && delta <= row.after - row.before, row.cardId);
  }
  assert.ok(cards.some((row) => played.get(row.cardId) - liveDamage(run, row.cardId) === row.after - row.before), 'at least one played card moved by the full receipt amount');
});

const NIGHTVEIL = 'armor/rogue/nightveil';
const freshRogue = () => createRunState({ seed: 73, classId: 'rogue', registries: reg, runId: 'unique-run', profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
// Owner, 2026-11-17 (gear `statPoints`): the armour has no budget; its row is the item's point total (attributes + Poise),
// and only a tier that adds DEX moves Defend (DR = DEX). The Rogue's Nightveil Coat's first tier (rank 1 -> 2) adds DEX 1 -> 2.
test('Core armor tier: receipt shows the budget point and the block it adds to Defend', () => {
  const run = freshRogue(); run.loadout.sets.armor[0] = 'nightveil'; visit(run);
  const candidate = smithingPlan(reg, run).candidates.find((row) => row.itemRef === NIGHTVEIL);
  assert.ok(candidate?.core);
  const budget = candidate.changes.find((row) => row.kind === 'budget');
  assert.deepEqual([budget.before, budget.after], [3, 4]);
  commitGameProfileRest(reg, run, 'smith', { itemRef: NIGHTVEIL });
  const gear = gameProfileEquipmentReceipt(reg, run).sources.find((row) => row.sourceId === NIGHTVEIL);
  assert.equal(Object.values(gear.resolved.points).reduce((sum, n) => sum + n, 0) + gear.resolved.tagCost, budget.after);
  const block = run.lastSmithingReceipt.changes.find((row) => row.kind === 'card' && row.op === 'block' && row.cardId === 'core.defend');
  assert.ok(block && block.after > block.before);
  const defend = (combat) => { const card = cardsOf(combat).find((row) => row.cardId === 'core.defend'); return previewCard(combat, card.instanceId, undefined, undefined, { rawFace: true }).values.find((e) => e.op === 'block').value; };
  assert.equal(defend(fight(run)), block.after);
  run.itemUpgradeLevels = {};
  assert.equal(defend(fight(run)), block.before);
});

test('Smith item summaries expose actual tier deltas for weapons, shields and armor without simulating other cards', () => {
  const run = fresh(); run.loadout.sets.leftHand[0] = 'kiteShield'; run.loadout.sets.armor[0] = 'vigil'; visit(run);
  const plan = smithingPlan(reg, run);
  const model = smithSelectionModel(reg, plan);
  // The default pick (first upgradeable item) is the only one that pays for card rows.
  assert.ok(model.properties.selected, 'the first upgradeable item is preselected');
  assert.ok(model.properties.candidates.filter(row => !row.selected).every(row => row.affectedRows.length === 0), 'item summaries do not evaluate live card previews');
  for (const ref of ['armament/greatsword', 'armament/kiteShield', 'armor/reaver/vigil']) {
    const candidate = plan.candidates.find(row => row.itemRef === ref);
    const item = model.properties.candidates.find(row => row.itemRef === ref);
    assert.ok(item.intrinsicChanges.length, `${ref} has a visible benefit`);
    assert.equal(item.intrinsicStats, null, 'Core summaries do not mix legacy base ratings into the tier receipt');
    assert.deepEqual(item.intrinsicChanges, candidate.changes.filter(row => row.before !== row.after), ref);
    assert.ok(Object.isFrozen(item.intrinsicChanges));
  }
  // Owner, 2026-11-17 (gear `statPoints`): the armour's tier is an attribute point (CON here), never DR.
  const vigil = model.properties.candidates.find(row => row.itemRef === 'armor/reaver/vigil').intrinsicChanges;
  assert.ok(vigil.some(row => ['CON', 'DEX'].includes(row.label)) && !vigil.some(row => row.label === 'DR'), JSON.stringify(vigil));
});

test('the item\'s upgrade modal lists the calculated item and card deltas, as before and after', () => withKitDom(dom => {
  const priorTimeout = globalThis.setTimeout;
  globalThis.setTimeout = () => 0;
  try {
    const run = fresh(); visit(run);
    const model = smithSelectionModel(reg, smithingPlan(reg, run), 'armament/greatsword');
    const host = dom.document.createElement('main'); dom.document.body.append(host);
    const door = mountSmithUpgradeModal(host, model, { registries: reg, meta: {}, onSelect() {}, onBack() {}, onConfirm() {} });
    const details = dom.document.querySelector('.confirmation-modal .confirmation-details');
    // The kit fixture's HTML parser drops text, so this pins the structure: one before/after row per affected row, then Requirements.
    const rows = details.querySelectorAll('.confirmation-change-list .sr-name');
    assert.equal(rows.length, model.properties.selected.affectedRows.length + 1);
    assert.equal(details.querySelectorAll('.confirmation-change-list .as-statpair').length >= model.properties.selected.intrinsicChanges.length, true, 'every change is a before to after pair');
    CloseConfirmationModal();
    door.close();
  } finally { globalThis.setTimeout = priorTimeout; }
}));
test('Core shield tier adds a stat point; receipts never carry legacy +3 card rows', () => {
  const run = fresh(); run.loadout.sets.leftHand[0] = 'kiteShield'; run.loadout.sets.armor[0] = 'vigil';
  const plan = smithingPlan(reg, run);
  assert.deepEqual(['armament/greatsword', 'armament/kiteShield', 'armor/reaver/vigil'].filter((ref) => !plan.candidates.some((row) => row.itemRef === ref)), []);
  const shield = plan.candidates.find((row) => row.itemRef === 'armament/kiteShield');
  const points = shield.changes.find((row) => row.label === 'Stat points');
  assert.equal(points.after, points.before + 1);
  for (const row of plan.candidates) {
    // Core rows, plus the authored non-card deltas the tier still applies (requirements, Poise threshold).
    assert.ok(row.changes.every((change) => /^(core:|requirement:|equipment:poise)/.test(change.tag) || change.kind === 'equipmentPoise'), row.itemRef);
    assert.ok(row.changes.every((change) => !/^(card:|upgrade:)/.test(change.tag)), row.itemRef);
    assert.equal(row.affectedCards.length, 0);
    const model = smithSelectionModel(reg, plan, row.itemRef).properties.selected;
    const text = JSON.stringify(model.affectedRows);
    assert.ok(model.affectedRows.length, row.itemRef);
    assert.doesNotMatch(text, /Attack Rating|GUARD|\+3|"upgrade:/, row.itemRef);
  }
});


test('copies of one card with different faces are previewed separately; co-op receipt counts the cards', () => {
  const run = pastFirstTier(fresh()); visit(run);
  const smash = run.deck.find((card) => card.cardId === 'core.smash');
  run.deck.push({ ...smash, instanceId: 'smash-variant', upgraded: true });
  const candidate = smithingPlan(reg, run).candidates.find((row) => row.itemRef === 'armament/greatsword');
  const rows = candidate.coreCardRows.filter((row) => row.cardId === 'core.smash' && row.op === 'damage');
  assert.equal(rows.length, 2, 'one row per distinct face');
  assert.equal(rows.reduce((sum, row) => sum + row.copies, 0), run.deck.filter((card) => card.cardId === 'core.smash').length);
  commitGameProfileRest(reg, run, 'smith', { itemRef: 'armament/greatsword' });
  assert.ok(run.lastSmithingReceipt.affectedCards.length >= rows.length);
});

test('a Core card row carries its own copy (upgrades, rank), so the modal faces keep them', () => {
  const run = pastFirstTier(fresh()); visit(run);
  const smash = run.deck.find((card) => card.cardId === 'core.smash');
  run.deck.push({ ...smash, instanceId: 'smash-up', upgraded: true, upgradeSteps: [{ k: 'dmg', n: 2 }] });
  const candidate = smithingPlan(reg, run).candidates.find((row) => row.itemRef === 'armament/greatsword');
  const rows = candidate.coreCardRows.filter((row) => row.cardId === 'core.smash' && row.op === 'damage');
  const upgraded = rows.find((row) => row.cardReference?.upgraded === true), plain = rows.find((row) => !row.cardReference?.upgraded);
  assert.ok(upgraded && plain, 'each distinct copy carries its own reference');
  assert.equal('instanceId' in upgraded.cardReference, false);
  const damage = (row) => resolveCard(reg, row.cardReference).effects.find((effect) => effect.op === 'damage').amount;
  assert.notEqual(damage(upgraded), damage(plain), 'the upgraded copy resolves to its own upgraded definition');
  const shown = smithSelectionModel(reg, smithingPlan(reg, run), 'armament/greatsword').properties.selected.affectedRows;
  assert.ok(shown.some((row) => row.cardReference?.upgraded === true), 'the modal row keeps the copy');
});

test('Core statPoints gear: no pool cap at any rank, and an authored DR point grants nothing (validator matches the resolver)', async () => {
  const { loadGameProfileCatalog } = await import('../tools/game-config.mjs');
  const { resolveGameAuthor, resolveGearItem } = await import('../engine/kernel/gameConfig.js');
  const author = JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url)));
  // Owner, 2026-11-17: Core gear grants attribute points and a Poise value, never AR or DR, and no longer spends a pool.
  const build = (rank, points) => {
    const catalog = loadGameProfileCatalog();
    const shield = catalog.packs['ashen.core-content@2.0.0'].content.gear.find((item) => item.kind === 'shield');
    shield.rank = rank; shield.points = points;
    return () => resolveGameAuthor(author, catalog);
  };
  for (const rank of [1, 2]) assert.doesNotThrow(build(rank, { dr: 9 }));
  const profile = build(1, { dr: 9 })();
  const shield = profile.content.gear.find((item) => item.kind === 'shield');
  const resolved = resolveGearItem(shield, profile.modules.gear);
  assert.equal(resolved.values.dr, 0, 'an authored DR point grants no DR');
  assert.equal(resolved.values.ar, 0);
});

test('card rows record the printed face number, not the number against the first enemy', () => {
  const run = pastFirstTier(fresh()); visit(run);
  const candidate = smithingPlan(reg, run).candidates.find((row) => row.itemRef === 'armament/greatsword');
  const smash = candidate.coreCardRows.find((row) => row.cardId === 'core.smash' && row.op === 'damage');
  const combat = fight(run), card = cardsOf(combat).find((row) => row.cardId === 'core.smash');
  const entry = previewCard(combat, card.instanceId, undefined, undefined, { rawFace: true }).values.find((e) => e.op === 'damage');
  assert.equal(smash.before, entry.faceValue ?? entry.value);
});

test('opening the rest runs no card simulation; the real commit adds the chosen item\'s card rows once', async () => {
  const { gameProfileRestModel } = await import('../src/ui/models/GameProfileRestModel.js');
  const { coreCardSimulationCount } = await import('../src/model/smithingCore.js');
  const run = pastFirstTier(fresh()); run.loadout.sets.leftHand[0] = 'kiteShield'; run.loadout.sets.armor[0] = 'vigil';
  const visitState = visit(run);
  const before = coreCardSimulationCount();
  const model = gameProfileRestModel(reg, run, visitState);
  assert.ok(model.smith.candidates.length >= 3);
  assert.equal(coreCardSimulationCount(), before, 'building the model with N candidates simulates no combat');
  assert.ok([...model.smithPreviews.values()].every((row) => row.available));
  assert.equal(coreCardSimulationCount(), before);
  const smash = run.deck.find((card) => card.cardId === 'core.smash');
  run.deck.push({ ...smash, instanceId: 'smash-copy' });
  commitGameProfileRest(reg, run, 'smith', { itemRef: 'armament/greatsword' });
  assert.ok(coreCardSimulationCount() > before);
  const receipt = run.lastSmithingReceipt;
  assert.ok(receipt.changes.some((row) => row.kind === 'card'));
  const copies = receipt.affectedCards.filter((row) => row.cardId === 'core.smash').length;
  assert.equal(copies, 2, 'affectedCards counts every changed copy');
});

// Owner, 2026-11-17 (gear `statPoints`): an armour tier adds attribute points, never DR; a tier that adds DEX raises DR
// (DR = DEX). The Rogue's Nightveil Coat's first tier (rank 1 -> 2) adds DEX 1 -> 2.
test('an armor tier that adds DEX raises DR, and Defend block preview equals the played block', async () => {
  const { gameProfileRatingReceipt } = await import('../src/model/gameProfileRun.js');
  const run = freshRogue(); run.loadout.sets.armor[0] = 'nightveil'; visit(run);
  const dr = gameProfileRatingReceipt(reg, run).totals.dr;
  const defendBlock = (combat) => { const card = cardsOf(combat).find((row) => row.cardId === 'core.defend');
    const shown = previewCard(combat, card.instanceId, undefined, undefined, { rawFace: true }).values.find((e) => e.op === 'block').value;
    combat.piles.hand = [card, ...combat.piles.hand.filter((row) => row !== card)];
    const had = combat.player.block; dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId });
    assert.equal(combat.player.block - had, shown, 'preview equals live'); return shown; };
  // This test pins the DR -> Block arithmetic, so it plays the pre-benefit rules (Defend's +50% is tests/stance-benefits.test.mjs).
  const was = defendBlock(withoutStanceBenefits(fight(run)));
  const candidate = smithingPlan(reg, run).candidates.find((row) => row.itemRef === NIGHTVEIL);
  assert.deepEqual(candidate.changes.filter((row) => row.label === 'DR'), [], 'the item itself grants no DR');
  assert.deepEqual(candidate.changes.filter((row) => row.label === 'DEX').map((row) => row.after - row.before), [1]);
  commitGameProfileRest(reg, run, 'smith', { itemRef: NIGHTVEIL });
  const after = gameProfileRatingReceipt(reg, run).totals.dr;
  assert.equal(after, dr + 1);
  const weight = run.gameProfile.modules.defenses?.dexterityBlockWeight ?? 1;
  const now = defendBlock(withoutStanceBenefits(fight(run)));
  assert.ok(now > was);
  assert.equal(now - was, Math.floor((after - dr) * weight));
});

test('Core receipts keep the authored requirement and Poise threshold deltas a tier still applies', () => {
  const run = fresh(); run.loadout.sets.rightHand[0] = 'straightSword'; run.loadout.sets.armor[0] = 'vigil';
  // Core ships no equipment requirements; a legacy-gated override still gets its authored tier delta.
  const gated = { ...reg, equipment: { ...reg.equipment, armaments: reg.equipment.armaments.map((piece) => piece.id === 'straightSword' ? { ...piece, requirements: { attributes: { strength: 8 } } } : piece) } };
  const plan = smithingPlan(gated, run);
  const sword = plan.candidates.find((row) => row.itemRef === 'armament/straightSword');
  assert.ok(sword.requirements.some((row) => row.change !== 0), 'the fixture tier changes a requirement');
  assert.ok(sword.changes.some((row) => row.kind === 'requirement'));
  const armor = plan.candidates.find((row) => row.itemRef === 'armor/reaver/vigil');
  assert.ok(armor.changes.some((row) => row.kind === 'equipmentPoise' && row.after > row.before));
});

test('Core run: a Sleeping Smith card-upgrade reward upgrades a Core item and its live cards change', async () => {
  const { executeAction } = await import('../src/engine/actions.js');
  // Only a tier that moves a live card is a candidate: the greatsword's first tier is CON, its second STR.
  const run = pastFirstTier(fresh());
  const before = JSON.stringify(run.itemUpgradeLevels || {});
  const emitted = [];
  executeAction({ registries: reg, run, rng: { float: () => 0.5, pick: (_s, list) => list[0] }, emit: (name, payload) => emitted.push([name, payload]) },
    { effect: { op: 'upgradeCard', random: true } });
  assert.notEqual(JSON.stringify(run.itemUpgradeLevels || {}), before, 'a Core item tier was set');
  const smithed = emitted.find(([name]) => name === 'armamentSmithed');
  assert.ok(smithed, 'the upgrade committed');
  assert.ok(smithed[1].changes.some((row) => row.kind === 'card'), 'at least one live card number changed');
  assert.ok(smithed[1].affectedCards.length > 0);
});

test('a Core Smith plan keeps its card rows through JSON (co-op snapshot), and the client model shows them', () => {
  const run = pastFirstTier(fresh()); visit(run);
  const plan = smithingPlan(reg, run);
  const live = plan.candidates.find((row) => row.itemRef === 'armament/greatsword');
  assert.ok(live.coreCardRows.length, 'the host has card rows for the greatsword');
  const wire = JSON.parse(JSON.stringify(plan));
  const sent = wire.candidates.find((row) => row.itemRef === 'armament/greatsword');
  assert.deepEqual(sent.coreCardRows, JSON.parse(JSON.stringify(live.coreCardRows)));
  const shown = (source) => smithSelectionModel(reg, source, 'armament/greatsword').properties.selected.affectedRows;
  assert.ok(shown(wire).some((row) => row.role === 'card' || row.cardId), 'the client lists card rows');
  assert.deepEqual(JSON.parse(JSON.stringify(shown(wire))), JSON.parse(JSON.stringify(shown(plan))), 'the client shows what the host shows');
});

test('serializing a Core Smith plan again (or a fresh plan of the same run) runs no extra card fights', () => {
  const run = fresh(); visit(run);
  JSON.stringify(smithingPlan(reg, run));
  const fights = coreCardSimulationCount();
  const plan = smithingPlan(reg, run);
  JSON.stringify(plan); JSON.stringify(plan); JSON.stringify(smithingPlan(reg, run));
  assert.equal(coreCardSimulationCount(), fights, 'the memo holds every candidate of one snapshot');
});

test('Smith card receipts read a Honed card at its lifetime plays (Whetstone Nick, playsEver 8)', async () => {
  const { coreSmithingCards } = await import('../src/model/smithingCore.js');
  const nick = (playsEver) => {
    const run = fresh();
    run.deck.push({ ...createCardInstance('core.whetstoneNick', false, () => `nick-${playsEver}`), ...(playsEver ? { playsEver } : {}) });
    const row = coreSmithingCards(reg, run, 'armament/greatsword', 1, 2).find((card) => card.cardId === 'core.whetstoneNick' && card.op === 'damage');
    assert.ok(row, 'the Smith lists Whetstone Nick among the cards the tier changes');
    return row;
  };
  const fresh0 = nick(0), honed = nick(8);
  // Nick is an Attack card: its face carries Attack's +20% (stance benefit, Wave 2.5) and the Core base-damage scale 0.5
  // (rounded up): base 2 scales to 1 and base 2 + 8 plays to 5, so at AR 5 the faces are floor(1.2 x 6) = 7 and
  // floor(1.2 x 10) = 12, and at AR 6 they are 8 and 13.
  assert.equal(honed.before - fresh0.before, 5, 'before: base 2 + 8 plays, not the fresh base');
  assert.equal(honed.after - fresh0.after, 5, 'after: the same 8 plays');
});
