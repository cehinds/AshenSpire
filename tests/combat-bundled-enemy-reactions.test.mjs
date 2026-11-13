import test from 'node:test';
import assert from 'node:assert/strict';
import { productionBundle } from './helpers/production-bundle.mjs';

// Use main's real compiled import order: native ESM bindings hide this cycle.
const require = productionBundle();
const { contentBundle } = require('src/content/index.js');
const { createRegistries } = require('src/model/registries.js');
const { createCombat, dispatch } = require('src/engine/combat.js');
const { createRng } = require('src/engine/rng.js');
const { resolveCombatRatings } = require('src/model/combatRatings.js');
const { reactionPaused } = require('src/engine/combatReactions.js');
const { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } = require('src/model/gameProfile.js');
const { createRunState } = require('src/model/state.js');
const { createRunCombat } = require('src/engine/runCombat.js');
const { previewCard, previewIntent } = require('src/engine/combat.js');
const { CounterPreviewAgainst } = require('src/engine/combatCounterPreview.js');

function coreCounterFixture() {
  const profile = resolveGameProfile('core');
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const run = createRunState({ registries, classId: 'reaver', seed: 511, runId: 'bundled-counter-preview' });
  const combat = createRunCombat({ registries, run, rng: createRng(run.seed), enemyIds: ['wanderingSoldier'] });
  combat.piles.hand.push({ instanceId: 'bundled-core-counter', cardId: 'core.counter' });
  const enemy = combat.enemies[0];
  Object.assign(enemy, { hp: 500, maxHp: 500, statuses: {}, ratings: {}, ratingSources: [],
    attributes: { dexterity: 0 }, basePrecisionBonus: 1000 });
  combat.player.basePrecisionBonus = 1000;
  return { combat, enemy };
}

test('bundled Core Counter previews a revealed attack without mutating live state', () => {
  const { combat, enemy } = coreCounterFixture();
  const before = JSON.stringify({ player: combat.player, enemy, piles: combat.piles, rng: combat.rng.getCounters() });
  const view = previewCard(combat, 'bundled-core-counter', enemy.id);
  const returned = view.values.find(row => row.op === 'damage').counterReturn;
  assert.equal(returned.incoming, 8);
  // Re-pin (SPEC §17, Counter stacks 2026-10-31): the card's 9 Block become 9 stacks, so 4 + floor(0.9 x 8) + 2 = 13, Poise floor(0.5 x 13) = 6.
  assert.equal(returned.hp, 13);
  assert.equal(returned.poise, 6);
  assert.equal(returned.block, 2);
  assert.equal(JSON.stringify({ player: combat.player, enemy, piles: combat.piles, rng: combat.rng.getCounters() }), before);
});

test('bundled Core Counter remains previewable in a real EndTurn reaction offer', () => {
  const { combat, enemy } = coreCounterFixture();
  dispatch(combat, { type: 'endTurn' });
  const offer = combat.pendingReaction;
  assert.ok(offer, 'EndTurn opens a real incoming-contact offer');
  const option = offer.options.find(row => row.play.cardInstanceId === 'bundled-core-counter');
  assert.ok(option, 'the paid Counter remains an available reaction');
  assert.equal(option.staminaCost, 1);
  assert.equal(option.manaCost, 0);
  const view = previewCard(combat, option.play.cardInstanceId, enemy.id);
  assert.ok(view.values.find(row => row.op === 'damage').counterReturn.hp > 0);
  dispatch(combat, { type: 'chooseReaction', offerId: offer.id, optionId: option.id });
  for (let count = 0; combat.pendingReaction; count++) {
    assert.ok(count < 10, 'the incoming action settles without a stalled reaction');
    dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null });
  }
  assert.equal(combat.phase, 'player');
  assert.equal(combat.turn, 2);
  assert.equal(combat.queue.length, 0);
  assert.ok(combat.eventLog.some(row => row.type === 'combatCounterTriggered'));
});

test('bundled Core Counter keeps hidden and uncovered reads distinct', () => {
  const { combat, enemy } = coreCounterFixture();
  const card = combat.registries.cards.get('core.counter');
  const intent = previewIntent(combat, enemy.id);
  assert.equal(CounterPreviewAgainst(combat, enemy, { ...intent, hidden: true }, card), null);
  assert.equal(CounterPreviewAgainst(combat, enemy, { ...intent, revealed: false }, card), null);
  const uncovered = CounterPreviewAgainst(combat, enemy, { ...intent,
    profile: { ...intent.profile, targeting: 'area', maneuver: 'sweep' } }, card);
  assert.equal(uncovered.uncovered, true);
  assert.equal(uncovered.hp, undefined);
});
