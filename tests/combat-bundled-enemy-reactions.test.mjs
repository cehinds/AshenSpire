import test from 'node:test';
import assert from 'node:assert/strict';
import { productionBundle } from './helpers/production-bundle.mjs';
import { REACTION_CARRIER_IDS, REACTION_TAG } from './helpers/reaction-carriers.mjs';

// Use main's real compiled import order: native ESM bindings hide this cycle.
const require = productionBundle();
const { contentBundle } = require('src/content/index.js');
const { createRegistries } = require('src/model/registries.js');
const { createCombat, dispatch } = require('src/engine/combat.js');
const { createRng } = require('src/engine/rng.js');
const { resolveCombatRatings } = require('src/model/combatRatings.js');
const { reactionPaused } = require('src/engine/combatReactions.js');
const { applyGameProfileToContent, bindGameProfileRegistries } = require('src/model/gameProfile.js');
const { createRunState } = require('src/model/state.js');
const { createRunCombat } = require('src/engine/runCombat.js');
const { previewCard, previewIntent } = require('src/engine/combat.js');
const { CounterPreviewAgainst } = require('src/engine/combatCounterPreview.js');
const { resolveGameAuthor, dataClone } = require('engine/kernel/gameConfig.js');
const { gameProfileCatalog, gameProfileAuthors } = require('src/content/generated/gameProfiles.js');
const CORE_CONTENT_PACK = 'ashen.core-content@2.0.0';

// The bundle checks its own realm's plain objects, so the Reaction tag is added to a bundle-made
// copy of the catalog (tests/fixtures/reaction-carriers.json; owner ruling 2026-11-28).
function bundledCarrierProfile()
{
  const catalog = dataClone(gameProfileCatalog);
  for (const card of catalog.packs[CORE_CONTENT_PACK].content.cards)
  {
    if (REACTION_CARRIER_IDS.includes(card.id)) card.tags.push(REACTION_TAG);
  }
  return resolveGameAuthor(gameProfileAuthors.core, catalog);
}

function coreCounterFixture({ cardStacks = false } = {}) {
  const profile = bundledCarrierProfile();
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const run = createRunState({ registries, classId: 'reaver', seed: 511, runId: 'bundled-counter-preview' });
  const combat = createRunCombat({ registries, run, rng: createRng(run.seed), enemyIds: ['wanderingSoldier'] });
  { const { stanceBenefits, ...rest } = combat.fixCoreRules; combat.fixCoreRules = rest; } // pins the pre-Wave-2.5 arithmetic (tests/legacyStanceRules.mjs)
  // ...and the Block-as-stacks Counter rule of a fight created before Wave 2 batch 5 (the card-stack rule has its own test below).
  if (!cardStacks) { const counter = { ...combat.fixCoreRules.counter }; for (const key of ['stackSource', 'returnPerStack', 'consumePerHit', 'decayPerTurn', 'decayClock', 'advantageShare', 'stacksPerCard', 'stacksUpgradeBonus', 'stacksMax', 'stacksByCard']) delete counter[key]; combat.fixCoreRules = { ...combat.fixCoreRules, counter }; }
  combat.piles.hand.push({ instanceId: 'bundled-core-counter', cardId: 'core.counter' });
  const enemy = combat.enemies[0];
  Object.assign(enemy, { hp: 500, maxHp: 500, statuses: {}, ratings: {}, ratingSources: [],
    attributes: { dexterity: 0 }, basePrecisionBonus: 1000 });
  combat.player.basePrecisionBonus = 1000;
  // This pins the Counter arithmetic, not the armour: a Heavy set adds Block to a Counter card (gear pass A, 2026-11-18), which raises its stacks.
  if (combat.player.itemProps) combat.player.itemProps = {};
  return { combat, enemy };
}

test('bundled Core Counter previews a revealed attack without mutating live state', () => {
  const { combat, enemy } = coreCounterFixture();
  const before = JSON.stringify({ player: combat.player, enemy, piles: combat.piles, rng: combat.rng.getCounters() });
  const view = previewCard(combat, 'bundled-core-counter', enemy.id);
  const returned = view.values.find(row => row.op === 'damage').counterReturn;
  // Owner ruling 2026-11-28: the soldier's stored 2 Slash lands as 2 and the card's 6 Block become
  // 6 stacks: the stored base 1 + floor(0.6 x 2) = 2, Poise floor(0.5 x 2) = 1.
  assert.equal(returned.incoming, 2);
  assert.equal(returned.hp, 2);
  assert.equal(returned.poise, 1);
  // The Counter Block grant is a share of the 2-damage hit: floor(0.25 x 2) = 0.
  assert.equal(returned.block, 0);
  assert.equal(JSON.stringify({ player: combat.player, enemy, piles: combat.piles, rng: combat.rng.getCounters() }), before);
});

test('bundled Core Counter under the card-stack rule previews 1 + floor(0.1 x 2 x 1 stack) and mutates nothing', () => {
  const { combat, enemy } = coreCounterFixture({ cardStacks: true });
  const before = JSON.stringify({ player: combat.player, enemy, piles: combat.piles, rng: combat.rng.getCounters() });
  const returned = previewCard(combat, 'bundled-core-counter', enemy.id).values.find(row => row.op === 'damage').counterReturn;
  // Owner ruling 2026-11-28: the stored 2 Slash lands as 2, and core.counter's 1 stack adds
  // floor(2 x 0.1 x 1) = 0 to the stored base 1.
  assert.equal(returned.incoming, 2);
  assert.equal(returned.hp, 1);
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
