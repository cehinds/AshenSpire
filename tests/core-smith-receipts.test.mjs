// Core 2 Smith receipts come from the Core pipeline (gear points, ratings, live card values), never from
// the legacy itemUpgradeChanges card rows, and each shown number is what the next fight does.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState, createCardInstance } from '../src/model/state.js';
import { beginGameProfileRest, commitGameProfileRest } from '../src/model/gameProfileRest.js';
import { gameProfileEquipmentReceipt } from '../src/model/gameProfileRun.js';
import { smithingPlan } from '../src/model/smithing.js';
import { coreCardSimulationCount } from '../src/model/smithingCore.js';
import { smithSelectionModel } from '../src/ui/models/SmithSelectionModel.js';
import { mountSmithUpgradeModal } from '../src/ui/components/smithUpgradeModal.js';
import { withKitDom } from './helpers/kit-dom.mjs';
import { buildActMap } from '../src/engine/actmap.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { previewCard, dispatch } from '../src/engine/combat.js';

const profile = resolveGameProfile(JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url))));
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
// The Core Reaver starting deck (#2199) holds its Smash as the weapon art, not core.smash; these tests measure a plain
// Smash card's smithed face, so the fixture adds one copy as a reward pick would.
const fresh = () => {
  const run = createRunState({ seed: 73, classId: 'reaver', registries: reg, runId: 'unique-run' });
  if (!run.deck.some((card) => card.cardId === 'core.smash')) run.deck.push(createCardInstance('core.smash', false, () => 'smash-fixture'));
  return run;
};
const visit = (run) => { run.mapGraph = buildActMap(reg, createRng(73), run.seatOrder[0], 1); run.mapNodeId = Object.values(run.mapGraph.nodes).find(n => n.type === 'shrine' && n.floor === 3).id; return beginGameProfileRest(run, '1:' + run.mapNodeId); };
const fight = (run) => {
  const combat = createRunCombat({ registries: reg, run, rng: createRng(17), enemyIds: ['wanderingSoldier'] });
  combat.enemies[0].hp = combat.enemies[0].maxHp = 1000;
  // The dummy opens in a defend stance; Core Smash doubles against that (a situational matchup, not part of AR), so measure against a target whose stance no matchup favours (neutral).
  combat.enemies[0].combatStance = { maneuver: 'neutral', camp: 'physical', range: 'melee' };
  return combat;
};
const cardsOf = (combat) => [...combat.piles.hand, ...combat.piles.draw, ...combat.piles.discard];
const liveDamage = (run, cardId) => {
  const combat = fight(run), card = cardsOf(combat).find((row) => row.cardId === cardId);
  combat.piles.hand = [card, ...combat.piles.hand.filter((row) => row !== card)];
  combat.player.stamina = combat.player.maxStamina = 99; combat.player.mana = combat.player.maxMana = 99; combat.player.energy = 99;
  const hp = combat.enemies[0].hp;
  const aimed = previewCard(combat, card.instanceId).needsTarget;
  dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, ...(aimed ? { targetId: combat.enemies[0].id } : {}) });
  return hp - combat.enemies[0].hp;
};

test('Core weapon tier: receipt names AR and each card it changes, and a played card gains exactly that', () => {
  const run = fresh(); visit(run);
  const candidate = smithingPlan(reg, run).candidates.find((row) => row.itemRef === 'armament/greatsword');
  assert.ok(candidate.core);
  assert.deepEqual(candidate.changes.map((row) => [row.label, row.after - row.before]), [['AR', 1]]);
  const receipt = commitGameProfileRest(reg, run, 'smith', { itemRef: 'armament/greatsword' });
  const smith = receipt.smith || receipt;
  const saved = run.lastSmithingReceipt;
  assert.equal(saved.changes[0].label, 'AR');
  const cards = saved.changes.filter((row) => row.kind === 'card' && row.op === 'damage');
  assert.ok(cards.length, 'at least one deck card changes damage');
  assert.ok(cards.every((row) => row.after === row.before + 1), 'AR weight 1: +1 damage per card');
  assert.ok(smith);
  // The receipt is the printed face: a fight's card face shows exactly before/after (levels reset for before).
  const face = (cardId) => { const combat = fight(run), card = cardsOf(combat).find((row) => row.cardId === cardId);
    const entry = previewCard(combat, card.instanceId).values.find((e) => e.op === 'damage'); return entry.faceValue ?? entry.value; };
  const shown = new Map(cards.map((row) => [row.cardId, face(row.cardId)]));
  const played = new Map(cards.map((row) => [row.cardId, liveDamage(run, row.cardId)]));
  run.itemUpgradeLevels = { ...run.itemUpgradeLevels, 'armament/greatsword': 0 };
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

test('Core armor tier: receipt shows the budget point and the block it adds to Defend', () => {
  const run = fresh(); run.loadout.sets.armor[0] = 'vigil'; visit(run);
  const candidate = smithingPlan(reg, run).candidates.find((row) => row.itemRef === 'armor/reaver/vigil');
  assert.ok(candidate?.core);
  const budget = candidate.changes.find((row) => row.kind === 'budget');
  assert.deepEqual([budget.before, budget.after], [3, 4]);
  commitGameProfileRest(reg, run, 'smith', { itemRef: 'armor/reaver/vigil' });
  const gear = gameProfileEquipmentReceipt(reg, run).sources.find((row) => row.sourceId === 'armor/reaver/vigil');
  assert.equal(gear.resolved.budget, budget.after);
  const block = run.lastSmithingReceipt.changes.find((row) => row.kind === 'card' && row.op === 'block' && row.cardId === 'core.defend');
  assert.ok(block && block.after > block.before);
  const defend = (combat) => { const card = cardsOf(combat).find((row) => row.cardId === 'core.defend'); return previewCard(combat, card.instanceId).values.find((e) => e.op === 'block').value; };
  assert.equal(defend(fight(run)), block.after);
  run.itemUpgradeLevels = {};
  assert.equal(defend(fight(run)), block.before);
});

test('Smith item summaries expose actual tier deltas for weapons, shields and armor without simulating other cards', () => {
  const run = fresh(); run.loadout.sets.leftHand[0] = 'kiteShield'; run.loadout.sets.armor[0] = 'vigil'; visit(run);
  const plan = smithingPlan(reg, run);
  const before = coreCardSimulationCount();
  const model = smithSelectionModel(reg, plan);
  assert.equal(coreCardSimulationCount(), before, 'item summaries do not evaluate live card previews');
  for (const ref of ['armament/greatsword', 'armament/kiteShield', 'armor/reaver/vigil']) {
    const candidate = plan.candidates.find(row => row.itemRef === ref);
    const item = model.properties.candidates.find(row => row.itemRef === ref);
    assert.ok(item.intrinsicChanges.length, `${ref} has a visible benefit`);
    assert.equal(item.intrinsicStats, null, 'Core summaries do not mix legacy base ratings into the tier receipt');
    assert.deepEqual(item.intrinsicChanges, candidate.changes.filter(row => row.before !== row.after), ref);
    assert.ok(Object.isFrozen(item.intrinsicChanges));
  }
  assert.ok(model.properties.candidates.find(row => row.itemRef === 'armor/reaver/vigil').intrinsicChanges.some(row => row.label === 'DR'));
});

test('Smith renders calculated item and card deltas outside the closed details', () => withKitDom(dom => {
  const run = fresh(); visit(run);
  const model = smithSelectionModel(reg, smithingPlan(reg, run), 'armament/greatsword');
  const host = dom.document.createElement('main'); dom.document.body.append(host);
  const door = mountSmithUpgradeModal(host, model, { registries: reg, meta: {}, onSelect() {}, onBack() {}, onConfirm() {} });
  const stone = host.querySelector('.smith-economy-values .smith-stone-icon');
  assert.equal(stone.querySelector('[data-engraved-icon]')?.dataset.engravedIcon, 'weight');
  assert.equal(stone.getAttribute('aria-hidden'), 'true', 'cost text names the decorative stone');
  assert.doesNotMatch(stone.textContent, /weight/);
  assert.match(host.querySelector('.smith-economy-values').outerHTML, /Smithing Stone Cost/);
  const stats = host.querySelector('.smith-intrinsic-stats');
  const deltas = node => node.querySelectorAll('.as-statpair').map(pair => [
    pair.querySelector('em')?.textContent, pair.querySelector('b')?.textContent, pair.querySelector('strong')?.textContent,
  ]);
  for (const change of model.properties.selected.intrinsicChanges) {
    assert.ok(deltas(stats).some(row => JSON.stringify(row) === JSON.stringify([change.label, String(change.before), String(change.after)])));
  }
  const folds = host.querySelectorAll('.smith-upgrade-fold');
  assert.equal(folds.length, model.properties.selected.affectedRows.length);
  folds.forEach((fold, index) => {
    assert.equal(fold.hasAttribute('open'), false, 'the preview starts folded');
    const summary = fold.querySelector('summary');
    for (const change of model.properties.selected.affectedRows[index].values) {
      assert.ok(deltas(summary).some(row => JSON.stringify(row) === JSON.stringify([change.label, String(change.before), String(change.after)])));
    }
  });
  door.close();
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

test('legacy profile smithing keeps its authored card rows', () => {
  const current = resolveGameProfile('current'), legacy = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, current)), current);
  const run = createRunState({ seed: 73, classId: 'reaver', registries: legacy });
  run.smithingStones = 3;
  const candidate = smithingPlan(legacy, run).candidates.find((row) => row.itemKind === 'armament');
  assert.ok(candidate && !candidate.core);
  assert.ok(candidate.changes.some((row) => row.kind === 'effect'));
});

test('copies of one card with different faces are previewed separately; co-op receipt counts the cards', () => {
  const run = fresh(); visit(run);
  const smash = run.deck.find((card) => card.cardId === 'core.smash');
  run.deck.push({ ...smash, instanceId: 'smash-variant', upgraded: true });
  const candidate = smithingPlan(reg, run).candidates.find((row) => row.itemRef === 'armament/greatsword');
  const rows = candidate.coreCardRows.filter((row) => row.cardId === 'core.smash' && row.op === 'damage');
  assert.equal(rows.length, 2, 'one row per distinct face');
  assert.equal(rows.reduce((sum, row) => sum + row.copies, 0), run.deck.filter((card) => card.cardId === 'core.smash').length);
  commitGameProfileRest(reg, run, 'smith', { itemRef: 'armament/greatsword' });
  assert.ok(run.lastSmithingReceipt.affectedCards.length >= rows.length);
});

test('a rank-2 Core shield may spend the tier point in its authored points (validator matches the resolver)', async () => {
  const { loadGameProfileCatalog } = await import('../tools/game-config.mjs');
  const { resolveGameAuthor, resolveGearItem } = await import('../engine/kernel/gameConfig.js');
  const author = JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url)));
  const build = (rank) => {
    const catalog = loadGameProfileCatalog();
    const shield = catalog.packs['ashen.core-content@2.0.0'].content.gear.find((item) => item.kind === 'shield');
    const max = Object.values(resolveGearItem(shield, resolveGameAuthor(author, loadGameProfileCatalog()).modules.gear).points).reduce((a, b) => a + b, 0);
    shield.rank = rank; shield.points = { dr: max + 1 };
    return () => resolveGameAuthor(author, catalog);
  };
  assert.doesNotThrow(build(2));
  assert.throws(build(1), /exceed the pool/);
});

test('card rows record the printed face number, not the number against the first enemy', () => {
  const run = fresh(); visit(run);
  const candidate = smithingPlan(reg, run).candidates.find((row) => row.itemRef === 'armament/greatsword');
  const smash = candidate.coreCardRows.find((row) => row.cardId === 'core.smash' && row.op === 'damage');
  const combat = fight(run), card = cardsOf(combat).find((row) => row.cardId === 'core.smash');
  const entry = previewCard(combat, card.instanceId).values.find((e) => e.op === 'damage');
  assert.equal(smash.before, entry.faceValue ?? entry.value);
});

test('opening the rest runs no card simulation; the real commit adds the chosen item\'s card rows once', async () => {
  const { gameProfileRestModel } = await import('../src/ui/models/GameProfileRestModel.js');
  const { coreCardSimulationCount } = await import('../src/model/smithingCore.js');
  const run = fresh(); run.loadout.sets.leftHand[0] = 'kiteShield'; run.loadout.sets.armor[0] = 'vigil';
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

test('an armor tier always raises DR, and Defend block preview equals the played block', async () => {
  const { gameProfileRatingReceipt } = await import('../src/model/gameProfileRun.js');
  const run = fresh(); run.loadout.sets.armor[0] = 'vigil'; visit(run);
  const dr = gameProfileRatingReceipt(reg, run).totals.dr;
  const defendBlock = (combat) => { const card = cardsOf(combat).find((row) => row.cardId === 'core.defend');
    const shown = previewCard(combat, card.instanceId).values.find((e) => e.op === 'block').value;
    combat.piles.hand = [card, ...combat.piles.hand.filter((row) => row !== card)];
    const had = combat.player.block; dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId });
    assert.equal(combat.player.block - had, shown, 'preview equals live'); return shown; };
  const was = defendBlock(fight(run));
  const candidate = smithingPlan(reg, run).candidates.find((row) => row.itemRef === 'armor/reaver/vigil');
  assert.deepEqual(candidate.changes.filter((row) => row.label === 'DR').map((row) => row.after - row.before), [2]);
  commitGameProfileRest(reg, run, 'smith', { itemRef: 'armor/reaver/vigil' });
  const after = gameProfileRatingReceipt(reg, run).totals.dr;
  assert.equal(after, dr + 2);
  const weight = run.gameProfile.modules.defenses?.defenseRatingWeight ?? 1;
  const now = defendBlock(fight(run));
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
  const run = fresh();
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
  const run = fresh(); visit(run);
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
