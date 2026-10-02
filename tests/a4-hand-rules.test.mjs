// A4 hand rules (FINISH D27, decided 2026-09-27 under the owner's delegation;
// SPEC §4.1): a solo
// fight RETAINS the hand between turns and draws the derived Draw stat each
// turn, up to the hand size — it neither fills to capacity nor discards at
// turn end. The Draw row's base is 3 (the largest draw a retained hand of 7 is
// never capped at on creation; see the row's comment). Retain-and-fill and
// discard-at-turn-end stay selectable, and a saved run keeps its own rows.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { configuredContentBundle } from '../src/model/advancedConfig.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { createSaveManager, createMemoryStorage } from '../src/engine/save.js';
import { handRulesDefaults } from '../src/content/handRules.js';
import { HAND_RULES_PREFIX, handRow, scaledCards } from '../src/model/handRules.js';
import { resolveCard } from '../src/model/registries.js';
import { endTurnCardFate } from '../src/engine/handRules.js';

const registries = createRegistries(contentBundle);
const CLASSES = registries.classes.all().map((c) => c.id);
const ENEMY = 'wanderingSoldier';
const ids = (cards) => cards.map((card) => card.instanceId);
const fightFor = (run, settings = {}, reg = registries) =>
  createRunCombat({ registries: reg, rng: createRng(4242), run, enemyIds: [ENEMY], settings });
const capacityOf = (c, run) => scaledCards(handRow(c.handRules, 'handSize'), run.attributes, 1);
const endsTurnAsDiscard = (c, card) => c.registries.framework.endTurnFate(resolveCard(c.registries, card)) === 'discard';

test('the shipped hand behaviour retains the hand and draws a fixed number', () => {
  assert.equal(handRulesDefaults.retain, true);
  assert.equal(handRulesDefaults.drawMode, 'fixed');
});

test('the Draw row gives every class 3 cards a turn at creation', () => {
  for (const classId of CLASSES) {
    const run = createRunState({ seed: 3, classId, registries });
    assert.equal(run.drawPerTurn, 3, `${classId} draws ${run.drawPerTurn} at creation`);
    assert.equal(scaledCards(handRow(fightFor(run).handRules, 'draw'), run.attributes, 1), 3, classId);
  }
});

test('a new solo fight keeps last turn\'s unplayed cards, draws exactly the Draw stat more (clamped at capacity), and discards nothing', () => {
  for (const classId of CLASSES) {
    const run = createRunState({ seed: 5, classId, registries });
    const c = fightFor(run);
    // Play one card so the hand has room for the whole draw.
    const first = c.piles.hand.find((card) => { try { dispatch(c, { type: 'playCard', cardInstanceId: card.instanceId, targetId: c.enemies[0].id }); return true; } catch { return false; } });
    assert(first, `${classId}: a card could be played`);
    const kept = c.piles.hand.filter((card) => endTurnCardFate(c, card) === 'keep');
    assert.equal(kept.length, c.piles.hand.length, `${classId}: the default keeps every ordinary card`);
    const keptIds = ids(kept);
    const discardBefore = ids(c.piles.discard);
    dispatch(c, { type: 'endTurn' });
    assert.equal(c.phase, 'player', classId);
    for (const id of keptIds) assert(c.piles.hand.some((card) => card.instanceId === id), `${classId}: unplayed ${id} left the hand`);
    assert.deepEqual(ids(c.piles.discard).filter((id) => !discardBefore.includes(id)), [], `${classId}: nothing is discarded at turn end`);
    const expected = Math.min(run.drawPerTurn, capacityOf(c, run) - keptIds.length);
    assert.equal(c.piles.hand.length - keptIds.length, expected, `${classId} drew ${c.piles.hand.length - keptIds.length}, expected ${expected}`);
  }
});

test('the draw stops at the hand size when the retained hand is nearly full', () => {
  const run = createRunState({ seed: 5, classId: 'starseer', registries });
  const c = fightFor(run);
  const capacity = capacityOf(c, run);
  const kept = c.piles.hand.length;
  assert(capacity - kept < run.drawPerTurn, 'fixture: the room left is below the Draw stat');
  dispatch(c, { type: 'endTurn' });
  assert.equal(c.piles.hand.length, capacity);
});

test('retain-and-fill still works when selected', () => {
  const run = createRunState({ seed: 5, classId: 'reaver', registries });
  const c = fightFor(run, { [HAND_RULES_PREFIX + 'drawMode']: 'fill' });
  const before = ids(c.piles.hand);
  dispatch(c, { type: 'endTurn' });
  assert(before.every((id) => c.piles.hand.some((card) => card.instanceId === id)));
  assert.equal(c.piles.hand.length, Math.min(capacityOf(c, run), run.deck.length));
});

test('discard at end of turn still works when selected', () => {
  const run = createRunState({ seed: 5, classId: 'rogue', registries });
  const c = fightFor(run, { [HAND_RULES_PREFIX + 'retain']: false });
  const unplayed = ids(c.piles.hand.filter((card) => endsTurnAsDiscard(c, card)));
  dispatch(c, { type: 'endTurn' });
  for (const id of unplayed) assert(c.piles.discard.some((card) => card.instanceId === id), `${id} was discarded`);
  assert.equal(c.piles.hand.length, run.drawPerTurn, 'a fresh hand of the Draw stat');
  assert.equal(c.piles.hand.filter((card) => unplayed.includes(card.instanceId)).length, 0);
});

test('a run saved before D27 keeps its snapshotted Draw row and its hand behaviour', () => {
  const run = createRunState({ seed: 7, classId: 'rogue', registries });
  run.derivedStatRuleSnapshot.rules.rules.draw.base = 2; // what a pre-D27 run was born with
  run.drawPerTurn = 2;
  const saves = createSaveManager(createMemoryStorage());
  saves.saveRun(run);
  const loaded = saves.loadRun(registries);
  assert.equal(loaded.drawPerTurn, 2);
  const c = fightFor(loaded);
  assert.equal(scaledCards(handRow(c.handRules, 'draw'), loaded.attributes, 1), 2);
  assert.equal(c.handRules.retain, true);
  assert.equal(c.handRules.drawMode, 'fixed');
  // A new run on the same content draws the new row.
  assert.equal(createRunState({ seed: 7, classId: 'rogue', registries }).drawPerTurn, 3);
});

test('the Draw row is data: overriding its base changes what a new character draws', () => {
  const tuned = createRegistries(configuredContentBundle(contentBundle, { 'gameConfig.derivedStatRules.rules.draw.base': 2 }));
  const run = createRunState({ seed: 3, classId: 'herald', registries: tuned });
  assert.equal(run.drawPerTurn, 2);
  const c = fightFor(run, {}, tuned);
  const kept = c.piles.hand.length;
  dispatch(c, { type: 'endTurn' });
  assert.equal(c.piles.hand.length, Math.min(kept + 2, capacityOf(c, run)));
});
