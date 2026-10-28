// Driving Thrust closes a band and then hits. The range planner must price the hit at the distance the card's own leading
// close reaches, so a melee weapon at band 1 pays only the card's price, never an extra implicit Advance on top of it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { dispatch, previewCard } from '../src/engine/combat.js';
import { rangePairKey } from '../src/model/combatEngagement.js';

const profile = resolveGameProfile('core');
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const PAIR = rangePairKey('player:player', 'enemy:e1');
function setup(cardId, stamina, band = 1, regs = registries) {
  const registries = regs;
  const run = createRunState({ registries, seed: 777, classId: 'reaver', profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries, run, rng: createRng(777), enemyIds: ['wanderingSoldier'] });
  combat.player.stamina = stamina; combat.player.energy = stamina;
  combat.rangeState = { ...combat.rangeState, engagements: { ...combat.rangeState.engagements, [PAIR]: band } };
  combat.piles.hand.length = 0;
  combat.piles.hand.push({ instanceId: 'qa', cardId, upgraded: false });
  return combat;
}

test('Driving Thrust at band 1 with 1 SP left plays for its own price and closes to band 0', () => {
  const combat = setup('core.drivingThrust', 1);
  assert.equal(combat.rangeState.engagements[PAIR], 1);
  const pv = previewCard(combat, 'qa', 'e1');
  assert.equal(pv.range.routes.find(r => r.id === 'advance').advanceSp, 0, 'no implicit Advance is quoted');
  dispatch(combat, { type: 'playCard', cardInstanceId: 'qa', targetId: 'e1' });
  assert.equal(combat.player.stamina, 0);
  assert.equal(combat.rangeState.engagements[PAIR], 0);
  assert.ok(combat.enemies[0].hp < combat.enemies[0].maxHp);
});

test('a card with trailing movement still pays the implicit Advance for its hit (Gale Push is unchanged)', () => {
  const combat = setup('core.galePush', 2);
  const pv = previewCard(combat, 'qa', 'e1');
  assert.equal(pv.range.routes.find(r => r.id === 'advance').advanceSp, 1);
});

test('Driving Thrust at band 2 pays one SP for the Advance, ends at band 0 and hits', () => {
  const combat = setup('core.drivingThrust', 2, 2);
  assert.equal(combat.rangeState.engagements[PAIR], 2);
  const pv = previewCard(combat, 'qa', 'e1');
  assert.equal(pv.range.routes.find(r => r.id === 'advance').advanceSp, 1);
  dispatch(combat, { type: 'playCard', cardInstanceId: 'qa', targetId: 'e1' });
  assert.equal(combat.player.stamina, 0, 'card 1 SP + Advance 1 SP');
  assert.equal(combat.rangeState.engagements[PAIR], 0);
  assert.ok(combat.enemies[0].hp < combat.enemies[0].maxHp);
});

test('a conditional leading close is not assumed: it is priced at the original distance', () => {
  const content = applyGameProfileToContent(contentBundle, profile);
  const base = content.cards.find(card => card.id === 'core.drivingThrust');
  const synthetic = { ...base, id: 'core.qaConditionalThrust', name: 'QA Conditional Thrust',
    effects: [{ op: 'moveEngagement', target: 'enemy', bands: -1, if: { p: 'hasBlock', of: 'self' } }, base.effects[1]], upgrade: undefined };
  const regs = bindGameProfileRegistries(createRegistries({ ...content, cards: [...content.cards, synthetic] }), profile);
  const combat = setup('core.qaConditionalThrust', 2, 1, regs);
  const pv = previewCard(combat, 'qa', 'e1');
  assert.equal(pv.range.routes.find(r => r.id === 'advance').advanceSp, 1);
});
