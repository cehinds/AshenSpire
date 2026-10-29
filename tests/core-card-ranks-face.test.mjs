// Card ranks 11b: a Core instance's rank scales its face (projectGameCard), reaches combat, and shows on the card model.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registries, live } from './helpers/fixcore-combat-rules.mjs';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { projectGameCard } from '../src/model/gameProfile.js';
import { resolveCombatCard } from '../src/engine/combatExpansion.js';
import { playingCardModel } from '../src/model/playingCard.js';

const newRun = () => createRunState({ registries, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
const damage = (def) => def.effects.find((e) => e.op === 'damage').amount;

test('each rank past 1 adds 1 to the primary number; no rank reads as rank 1', () => {
  const run = newRun();
  const at = (rank) => projectGameCard(run, { instanceId: 'x', cardId: 'core.strike', ...(rank ? { rank } : {}) });
  assert.equal(damage(at(undefined)), damage(at(1)));
  assert.equal(damage(at(3)), damage(at(1)) + 2);
  assert.equal(at(3).rank, 3);
});

test('rank and upgrade steps both apply', () => {
  const run = newRun();
  const plain = projectGameCard(run, { instanceId: 'x', cardId: 'core.strike' });
  const both = projectGameCard(run, { instanceId: 'x', cardId: 'core.strike', rank: 3, upgraded: true, upgradeSteps: [{ k: 'dmg', n: 2 }] });
  assert.equal(damage(both), damage(plain) + 2 + 2);
});

test('combat plays the ranked face and the card model shows the rank badge', () => {
  const run = newRun();
  const strike = run.deck.find((c) => c.cardId === 'core.strike');
  strike.rank = 4;
  const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  const copy = Object.values(combat.piles).flat().find((c) => c.instanceId === strike.instanceId);
  assert.equal(copy.rank, 4, 'combat start carries the rank');
  assert.equal(damage(resolveCombatCard(combat, copy)), damage(projectGameCard(run, { cardId: 'core.strike' })) + 3);
  const model = playingCardModel(registries, copy, { gameProfile: run.gameProfile });
  assert.equal(model.rank, 4);
  assert.match(String(model.rankBadge), /Rank 4/);
});

test('a Legacy-style profile without cardRanks ignores rank on the Core projection', () => {
  const run = newRun();
  const off = { ...run, gameProfile: { ...run.gameProfile, modules: { ...run.gameProfile.modules, progression: { ...run.gameProfile.modules.progression, cardRanks: false } } } };
  assert.equal(damage(projectGameCard(off, { cardId: 'core.strike', rank: 5 })), damage(projectGameCard(run, { cardId: 'core.strike' })));
});

test('rank never raises a capped status past its cap, and a step on a rank-capped status is not offered', async () => {
  const { nextUpgradeStep } = await import('../src/model/cardUpgradeLimits.js');
  const { profile } = await import('./helpers/fixcore-combat-rules.mjs');
  const run = newRun();
  const vulnerable = (rank, extra = {}) => projectGameCard(run, { instanceId: 'x', cardId: 'core.hexmark', rank, ...extra }).effects.find((e) => e.op === 'applyStatus' && e.status === 'vulnerable').stacks;
  const base = vulnerable(1);
  assert.ok(base <= 3);
  for (const rank of [2, 3, 10]) assert.equal(vulnerable(rank), Math.max(3, base), `rank ${rank}`);
  // At rank 10 Hexmark is already at the cap through rank: no stk step can be rolled for it.
  const hexmark = registries.cards.get('core.hexmark');
  for (let seed = 1; seed <= 60; seed += 1) {
    const step = nextUpgradeStep({ seed, gameProfile: profile }, { instanceId: 'h', cardId: 'core.hexmark', rank: 10 }, hexmark, registries);
    assert.notEqual(step?.k, 'stk', `seed ${seed}`);
  }
});

test('stk is judged on the ranked face: a status the rank already caps never rolls stk (no authored block)', async () => {
  const { rollUpgradeStep, upgradeStepRng } = await import('../src/model/cardUpgradeSteps.js');
  const hex = { id: 't.weaken', name: 'Weaken', type: 'skill', cost: 1, staminaCost: 1, manaCost: 0, keywords: [], tags: ['camp:physical'],
    effects: [{ op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 2 }] };
  const kinds = (rank) => { const seen = new Set(); for (let seed = 1; seed <= 100; seed += 1) seen.add(rollUpgradeStep(hex, [], 0, upgradeStepRng(seed, 'w', 0), { rank })?.k ?? 'none'); return seen; };
  assert.ok(kinds(1).has('stk'), 'below the cap at rank 1, stk is offered');
  assert.ok(!kinds(10).has('stk'), 'rank 10 already holds Weak at its cap of 3');
});
