// Core 2 Smith receipts come from the Core pipeline (gear points, ratings, live card values), never from
// the legacy itemUpgradeChanges card rows, and each shown number is what the next fight does.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { beginGameProfileRest, commitGameProfileRest } from '../src/model/gameProfileRest.js';
import { gameProfileEquipmentReceipt } from '../src/model/gameProfileRun.js';
import { smithingPlan } from '../src/model/smithing.js';
import { smithSelectionModel } from '../src/ui/models/SmithSelectionModel.js';
import { buildActMap } from '../src/engine/actmap.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { previewCard, dispatch } from '../src/engine/combat.js';

const profile = resolveGameProfile(JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url))));
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const fresh = () => createRunState({ seed: 73, classId: 'reaver', registries: reg, runId: 'unique-run' });
const visit = (run) => { run.mapGraph = buildActMap(reg, createRng(73), run.seatOrder[0], 1); run.mapNodeId = 'n3_0'; return beginGameProfileRest(run, '1:n3_0'); };
const fight = (run) => {
  const combat = createRunCombat({ registries: reg, run, rng: createRng(17), enemyIds: ['wanderingSoldier'] });
  combat.enemies[0].hp = combat.enemies[0].maxHp = 1000;
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

test('Core shield tier adds a stat point; receipts never carry legacy +3 card rows', () => {
  const run = fresh(); run.loadout.sets.leftHand[0] = 'kiteShield'; run.loadout.sets.armor[0] = 'vigil';
  const plan = smithingPlan(reg, run);
  assert.deepEqual(['armament/greatsword', 'armament/kiteShield', 'armor/reaver/vigil'].filter((ref) => !plan.candidates.some((row) => row.itemRef === ref)), []);
  const shield = plan.candidates.find((row) => row.itemRef === 'armament/kiteShield');
  const points = shield.changes.find((row) => row.label === 'Stat points');
  assert.equal(points.after, points.before + 1);
  for (const row of plan.candidates) {
    assert.ok(row.changes.every((change) => change.tag.startsWith('core:')), row.itemRef);
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
