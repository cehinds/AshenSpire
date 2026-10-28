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
