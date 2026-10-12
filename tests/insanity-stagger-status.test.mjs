// Owner decision 2026-10-12 (#1): an Insanity break is a full Stagger. The
// proc's direct stagger and a filled poise bar share one path (breakEnemy), so
// both apply the `staggered` status and every rider gated on it fires — here
// Executioner's Staggered damage. The direct path still bypasses the bar: the
// poise max does not grow (SPEC §4.4). Shipped registry, solo and co-op.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { createCoopCombat, playCard } from '../src/engine/coopCombat.js';
import { createRng } from '../src/engine/rng.js';
import { getStacks } from '../src/engine/statuses.js';

const insanityCard = { id: 'tInsanityBreak', name: 'T Insanity', class: 'colorless', rarity: 'special', cost: 0, type: 'skill',
  keywords: [], effects: [{ op: 'applyStatus', target: 'enemy', status: 'insanity', stacks: 14 }], textTemplate: 'Apply {insanity} Insanity.' };
const registries = createRegistries({ ...contentBundle, cards: [...contentBundle.cards, insanityCard],
  tagging: [...contentBundle.tagging, ...['classification.skill', 'camp:physical', 'maneuver:defend']
    .map((tagId) => ({ family: 'card', scope: '', objectId: insanityCard.id, tagId }))] });

const deck = (withInsanity) => [
  ...(withInsanity ? [{ instanceId: 'ins', cardId: 'tInsanityBreak' }] : []),
  { instanceId: 'exe', cardId: 'executioner' },
];
const player = (withInsanity) => ({ classId: 'reaver', maxHp: 200, hp: 200, maxMana: 99, mana: 99,
  energyMax: 10, drawPerTurn: 5, deck: deck(withInsanity), relicIds: [] });
const lastHit = (combat, enemyId) => combat.eventLog
  .filter((e) => e.type === 'damageDealt' && e.targetId === enemyId && e.sourceId !== enemyId)
  .map((e) => e.amount).pop();

function solo(withInsanity) {
  const c = createCombat({ registries, rng: createRng(50), player: player(withInsanity), enemyIds: ['wanderingSoldier'] });
  const enemy = c.enemies[0];
  const poiseMaxBefore = enemy.poiseMeter.max;
  if (withInsanity) dispatch(c, { type: 'playCard', cardInstanceId: 'ins', targetId: enemy.id });
  const state = { skip: !!enemy.skipNextTurn, staggered: getStacks(enemy, 'staggered'), poiseMax: enemy.poiseMeter.max, poiseMaxBefore };
  dispatch(c, { type: 'playCard', cardInstanceId: 'exe', targetId: enemy.id });
  return { ...state, hit: lastHit(c, enemy.id) };
}

function coop(withInsanity) {
  const c = createCoopCombat({ registries, rng: createRng(50), players: [{ id: 'p1', ...player(withInsanity) }],
    enemyIds: ['wanderingSoldier'], ratingsRules: null });
  const enemy = c.enemies[0];
  if (withInsanity) playCard(c, 'p1', 'ins', enemy.id);
  const staggered = getStacks(enemy, 'staggered');
  playCard(c, 'p1', 'exe', enemy.id);
  return { staggered, hit: lastHit(c, enemy.id) };
}

test('an Insanity break applies Staggered, so Executioner deals its Staggered damage', () => {
  const clean = solo(false);
  const broken = solo(true);
  assert.equal(clean.staggered, 0);
  assert.ok(broken.skip, 'the proc skips the enemy\'s next turn');
  assert.equal(broken.staggered, registries.balance.poise.onFill.find((e) => e.status === 'staggered').stacks,
    'the direct break applies the same Staggered stacks a full poise bar does');
  assert.equal(broken.poiseMax, broken.poiseMaxBefore, 'the direct break bypasses the bar: poise max does not grow');
  // Executioner: 10 clean, 25 if Staggered, then Staggered's ×1.5 taken.
  assert.ok(broken.hit > clean.hit * 2, `Staggered rider fired (${clean.hit} -> ${broken.hit})`);
});

test('co-op matches solo after an Insanity break', () => {
  const s = solo(true);
  const c = coop(true);
  assert.equal(c.staggered, s.staggered);
  assert.equal(c.hit, s.hit);
  assert.equal(coop(false).hit, solo(false).hit);
});
