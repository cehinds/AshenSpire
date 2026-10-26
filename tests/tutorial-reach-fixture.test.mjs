import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries, projectGameCard } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { resolveCombatCard } from '../src/engine/combatExpansion.js';
import { combatProfileFor } from '../src/model/combatCardProfile.js';
import { cardTargetPlan } from '../src/model/cardTargets.js';
import { hasImmediateHostileDamage } from '../tools/click-impact-card.mjs';

const source = readFileSync(new URL('../tools/tutorial-reach.mjs', import.meta.url), 'utf8');
const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const fresh = () => createRunState({ registries, classId: 'reaver', seed: 511 });
function block(startMarker, endMarker) {
  const start = source.indexOf(startMarker), end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, 'execute the actual fixture setup');
  return source.slice(start, end);
}
function selfCounter(combat, cards) {
  const card = cards.find(card => combatProfileFor(resolveCombatCard(combat, card)).maneuver === 'counter');
  assert.ok(card, 'a Counter exists even when the starter draw has none');
  const definition = resolveCombatCard(combat, card);
  assert.equal(definition.id, 'core.counter', 'the production Core definition supplies the behavior');
  const plan = cardTargetPlan(definition, combat.player.id, combat.enemies, [{ ...combat.player, connected: true }], { solo: true });
  assert.equal(plan.mode, 'friendly');
  assert.ok(plan.legalIds.includes(combat.player.id));
  return card;
}

test('actual shot setup supplies a production self Counter independently of the starting draw', () => {
  const combat = createRunCombat({ registries, run: fresh(), rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  combat.piles.hand = [{ instanceId: 'only-defend', cardId: 'core.defend' }];
  const body = block('      const combat = window.__combat;\n      const fixtureCards = [', "      const m = await import('/src/ui/components/tutorial.js');");
  let renders = 0;
  const context = { window: { __combat: combat, __renderCombatForShot: () => { renders++; } }, projectGameCard };
  runInNewContext(`(() => {${body}})()`, context);
  const card = selfCounter(combat, combat.piles.hand);
  runInNewContext(`(() => {${body}})()`, context);
  assert.equal(combat.piles.hand.filter(row => row.instanceId === card.instanceId).length, 1, 'setup is idempotent');
  assert.equal(renders, 2, 'the real renderer receives the seeded hand');
});

test('actual durable setup adds an authored Counter before reload when the starter deck has none', () => {
  const saved = fresh();
  saved.deck = saved.deck.filter(card => combatProfileFor(projectGameCard(saved, card)).maneuver !== 'counter');
  const setup = block("      saved.flasks = [{ flaskId: 'blightCoating' }];", '      localStorage.setItem(key, JSON.stringify(saved));');
  runInNewContext(`(() => {${setup}})()`, { saved, view: saved, projectGameCard, combatProfileFor, hasImmediateHostileDamage });
  const combat = createRunCombat({ registries, run: saved, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  const card = selfCounter(combat, saved.deck);
  assert.equal(saved.deck[1].instanceId, card.instanceId, 'ordered opening draw includes the Counter');
  assert.equal(saved.flasks[0].flaskId, 'blightCoating');
  const ids = saved.deck.map(card => card.instanceId);
  assert.equal(new Set(ids).size, ids.length, 'durable deck keeps unique owned instances');
});
