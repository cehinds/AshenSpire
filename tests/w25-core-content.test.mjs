// Owner, 2026-11-14 content decisions for Core (W25-B): Backstep cost, Jab as a reaction, spell damage, Ward and Barrier.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const cards = JSON.parse(readFileSync(new URL('../games/ashenspire/packs/core/cards.json', import.meta.url), 'utf8'));
const card = id => cards.find(row => row.id === id);

test('Backstep costs 2 Stamina, in the pack and under every resource profile', () => {
  const backstep = card('core.backstep');
  assert.equal(backstep.staminaCost, 2);
  assert.equal(backstep.cost, 2);
  const variants = JSON.parse(readFileSync(new URL('../games/ashenspire/packs/core/resourceVariants.json', import.meta.url), 'utf8'))['core.backstep'];
  assert.equal(variants.sp.staminaCost, 2);
  assert.equal(variants['sp,mp'].staminaCost, 2);
});

import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from './withoutWeaknesses.mjs';
import { dispatch } from '../src/engine/combat.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
function live(classId = 'reaver', seed = 511) {
  const run = createRunState({ registries: reg, classId, seed, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries: reg, run, rng: createRng(seed), enemyIds: ['wanderingSoldier'] });
  return { run, combat };
}

test('Jab is a reaction card: it is offered against an incoming melee attack when held and affordable', () => {
  assert.ok(card('core.jab').tags.includes('trait:reaction'));
  const { combat } = live();
  combat.piles.hand.length = 0;
  combat.piles.hand.push({ cardId: 'core.jab', instanceId: 'jab1', upgraded: false });
  for (const enemy of combat.enemies) enemy.intentRevealed = false;
  dispatch(combat, { type: 'endTurn' });
  const offer = combat.pendingReaction;
  assert.ok(offer, 'the enemy attack opens a reaction window');
  const option = offer.options.find(row => row.cardId === 'core.jab');
  assert.ok(option, 'Jab is among the options');
  assert.equal(option.staminaCost, 1);
});

test('played as a reaction, Jab pays 1 Stamina and strikes the attacker before the hit lands', () => {
  const { combat } = live();
  const enemy = combat.enemies[0];
  combat.piles.hand.length = 0;
  combat.piles.hand.push({ cardId: 'core.jab', instanceId: 'jab1', upgraded: false });
  const hpBefore = enemy.hp;
  dispatch(combat, { type: 'endTurn' });
  const out = dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id,
    optionId: combat.pendingReaction.options.find(row => row.cardId === 'core.jab').id });
  const types = out.events.map(event => event.type);
  assert.ok(types.includes('cardPlayed'));
  assert.ok(types.indexOf('cardPlayed') < types.indexOf('attackHit'), 'the reaction resolves before the incoming hit');
  assert.ok(enemy.hp < hpBefore, 'the Jab landed on the attacker');
  assert.equal(out.events.find(event => event.type === 'cardPlayed').staminaSpent, 1);
});
