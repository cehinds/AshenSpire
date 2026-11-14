// W25 step 2: the effect menu. Each step kind adds an effect the card did not have, and the engine does what the face says.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registries, profile } from './helpers/fixcore-combat-rules.mjs';
import { applyUpgradeSteps, upgradeStepsProblems, FX_KINDS } from '../src/model/cardUpgrade.js';
import { nextUpgradeOptions } from '../src/model/cardUpgradeLimits.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch, previewCard } from '../src/engine/combat.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';

const strike = () => registries.cards.get('core.strike');
const withSteps = (steps) => ({ upgraded: true, upgradeSteps: steps });

function fight(cards, { enemies = ['wanderingSoldier'] } = {}) {
  const run = createRunState({ registries, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: enemies });
  for (const pile of Object.values(combat.piles)) pile.length = 0;
  combat.piles.hand.push(...cards);
  for (let i = 0; i < 8; i += 1) combat.piles.draw.push({ instanceId: `f${i}`, cardId: 'core.defend', upgraded: false });
  for (const e of combat.enemies) Object.assign(e, { hp: 500, maxHp: 500, block: 0, persistentPoise: { value: 80, max: 80 } });
  combat.player.stamina = combat.player.maxStamina = 20;
  primeAccuracyRolls(combat, { count: 4 });
  return combat;
}
const play = (combat, id, aimed = true) => dispatch(combat, { type: 'playCard', cardInstanceId: id, ...(aimed ? { targetId: combat.enemies[0].id } : {}) });
const inst = (id, cardId, steps) => ({ instanceId: id, cardId, ...(steps ? withSteps(steps) : { upgraded: false }) });
const ids = (pile) => pile.map((c) => c.instanceId);

test('every fx kind applies, validates, and an unknown one is refused', () => {
  const steps = [
    { k: 'fx', fx: 'block', n: 4 }, { k: 'fx', fx: 'draw', n: 1 }, { k: 'fx', fx: 'cycle', n: 1 }, { k: 'fx', fx: 'cull' }, { k: 'fx', fx: 'copy' },
    { k: 'fx', fx: 'shuffle' }, { k: 'fx', fx: 'retain' }, { k: 'fx', fx: 'innate' }, { k: 'fx', fx: 'holdOne' }, { k: 'fx', fx: 'boost', stat: 'strength', n: 2 },
    { k: 'fx', fx: 'target' }, { k: 'fx', fx: 'reaction' }];
  assert.equal(FX_KINDS.length, steps.length + 1, 'unexhaust is the thirteenth kind');
  for (const step of steps) {
    assert.deepEqual(upgradeStepsProblems(withSteps([step]), 'x'), [], JSON.stringify(step));
    assert.notDeepEqual(JSON.stringify(applyUpgradeSteps(strike(), [step])), JSON.stringify(applyUpgradeSteps(strike(), [{ k: 'dmg', n: 0 }])), step.fx);
  }
  assert.match(upgradeStepsProblems(withSteps([{ k: 'fx', fx: 'nope' }]), 'x')[0], /fx/);
  assert.match(upgradeStepsProblems(withSteps([{ k: 'fx', fx: 'boost', stat: 'wisdom', n: 2 }]), 'x')[0], /stat/);
  assert.match(upgradeStepsProblems(withSteps([{ k: 'fx', fx: 'block', n: 0 }]), 'x')[0], /\.n/);
});

test('a card is only offered what it lacks', () => {
  const run = { seed: 7, gameProfile: profile, rangePolicy: {} };
  const fxOf = (cardId, steps = []) => nextUpgradeOptions(run, { instanceId: 'x', cardId, ...(steps.length ? withSteps(steps) : { upgraded: false }) }, registries.cards.get(cardId), registries, 40, { noAuthored: true })
    .filter((s) => s.k === 'fx').map((s) => s.fx);
  assert.ok(fxOf('core.strike').includes('block'));
  assert.ok(!fxOf('core.defend').includes('block'), 'Defend already gives Block');
  assert.ok(!fxOf('core.strike').includes('unexhaust'), 'Strike has no Exhaust to remove');
  assert.ok(fxOf('core.mendingTouch').includes('unexhaust'));
  assert.ok(!fxOf('core.strike', [{ k: 'fx', fx: 'retain' }]).includes('retain'), 'no second Retain');
  assert.ok(!fxOf('core.strike', [{ k: 'fx', fx: 'block', n: 4 }]).includes('block'));
  assert.ok(!fxOf('core.spark').includes('boost'), 'a spell has no live INT / WIS to boost');
});

test('Block, draw, copy, shuffle and cull do what the card says', () => {
  let c = fight([inst('p', 'core.strike', [{ k: 'fx', fx: 'block', n: 4 }])]);
  play(c, 'p');
  assert.ok(c.player.block >= 4, `block ${c.player.block}`);
  c = fight([inst('p', 'core.strike', [{ k: 'fx', fx: 'draw', n: 1 }])]);
  play(c, 'p');
  assert.equal(c.piles.hand.length, 1, 'drew one card');
  c = fight([inst('p', 'core.strike', [{ k: 'fx', fx: 'copy' }])]);
  play(c, 'p');
  assert.equal(c.piles.discard.filter((x) => x.cardId === 'core.strike').length, 2, 'the played card and its copy');
  c = fight([inst('p', 'core.strike', [{ k: 'fx', fx: 'shuffle' }])]);
  c.piles.discard.push({ instanceId: 'd1', cardId: 'core.defend', upgraded: false });
  play(c, 'p');
  assert.ok(ids(c.piles.draw).includes('d1'));
  c = fight([inst('p', 'core.strike', [{ k: 'fx', fx: 'cull' }]), inst('q', 'core.defend')]);
  play(c, 'p');
  assert.equal(c.piles.exhaust.length, 1);
  assert.equal(c.piles.hand.length, 2, 'the other card left; two drawn');
});

test('target (a step saved before `other`) hits a second enemy; a temporary boost leaves at the end of the turn', () => {
  const c = fight([inst('p', 'core.strike', [{ k: 'fx', fx: 'target' }])], { enemies: ['wanderingSoldier', 'wanderingSoldier'] });
  Object.assign(c.enemies[1], { hp: 500, maxHp: 500, block: 0, persistentPoise: { value: 80, max: 80 } });
  play(c, 'p');
  assert.ok(c.enemies[0].hp < 500 || c.enemies[1].hp < 500);
  assert.ok(c.enemies[0].hp < 500 && c.enemies[1].hp < 500 || c.enemies[0].hp + c.enemies[1].hp < 1000);
  const b = fight([inst('p', 'core.strike', [{ k: 'fx', fx: 'boost', stat: 'strength', n: 2 }])]);
  play(b, 'p');
  assert.equal(b.player.statuses.strength?.stacks, 2);
  dispatch(b, { type: 'endTurn' });
  assert.ok(!b.player.statuses.strength || b.player.statuses.strength.stacks === 0, 'gone at turn end');
});

test('target with `other` hits one OTHER enemy at half damage, never the main target again, and nothing extra against a lone enemy', () => {
  const step = { k: 'fx', fx: 'target', other: true };
  const plain = fight([inst('p', 'core.strike')], { enemies: ['wanderingSoldier', 'wanderingSoldier'] });
  play(plain, 'p');
  const main = 500 - plain.enemies[0].hp;
  const c = fight([inst('p', 'core.strike', [step])], { enemies: ['wanderingSoldier', 'wanderingSoldier'] });
  play(c, 'p');
  assert.equal(500 - c.enemies[0].hp, main, 'the main target takes only the card\'s own hit');
  assert.ok(c.enemies[1].hp < 500 && 500 - c.enemies[1].hp < main, 'the other enemy takes the half hit');
  const lone = fight([inst('p', 'core.strike', [step])]);
  play(lone, 'p');
  assert.equal(500 - lone.enemies[0].hp, main, 'a lone enemy takes one hit, not a second');
  assert.match(JSON.stringify(applyUpgradeSteps(strike(), [step]).effects), /otherEnemy/);
  const q = fight([inst('p', 'core.strike', [step])], { enemies: ['wanderingSoldier', 'wanderingSoldier'] });
  const half = (aimed) => previewCard(q, 'p', aimed.id).values.find((row) => row.target === 'otherEnemy');
  for (const [aimed, other] of [[q.enemies[0], q.enemies[1]], [q.enemies[1], q.enemies[0]]]) {
    const row = half(aimed);
    assert.deepEqual(Object.keys(row.perTarget), [other.id], 'the half hit is quoted only on the other enemy');
    assert.ok(row.perTarget[other.id] > 0);
  }
  const alone = fight([inst('p', 'core.strike', [step])]);
  assert.deepEqual(Object.keys(previewCard(alone, 'p', alone.enemies[0].id).values.find((row) => row.target === 'otherEnemy').perTarget), [], 'a lone enemy is quoted no half hit');
});

test('Retain keeps the card at end of turn; holdOne keeps another; Exhaust removal drops Exhaust; Innate opens in hand', () => {
  let c = fight([inst('p', 'core.defend', [{ k: 'fx', fx: 'retain' }]), inst('q', 'core.defend')]);
  dispatch(c, { type: 'endTurn' });
  assert.ok(ids(c.piles.hand).includes('p'), 'the Retain card is still in hand next turn');
  assert.ok(!ids(c.piles.hand).includes('q') || ids(c.piles.draw).length === 0, 'the plain card went back with the refresh');
  c = fight([inst('p', 'core.defend', [{ k: 'fx', fx: 'holdOne' }]), inst('q', 'core.defend'), inst('r', 'core.defend')]);
  play(c, 'p', false);
  dispatch(c, { type: 'endTurn' });
  assert.equal(ids(c.piles.hand).filter((x) => x === 'q' || x === 'r').length, 1, 'one of the two other cards was retained');
  const face = applyUpgradeSteps(registries.cards.get('core.mendingTouch'), [{ k: 'fx', fx: 'unexhaust' }]);
  assert.ok(!face.keywords.includes('exhaust'));
  assert.ok(!face.tags.includes('lifecycle.exhaust'));
  const run = createRunState({ registries, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const target = run.deck[run.deck.length - 1];
  Object.assign(target, { upgraded: true, upgradeSteps: [{ k: 'fx', fx: 'innate' }] });
  const opening = createRunCombat({ registries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  assert.ok(ids(opening.piles.hand).includes(target.instanceId), 'an Innate card starts in the opening hand');
});

test('a Reaction step adds the trait and a combo applies both effects', () => {
  const one = applyUpgradeSteps(strike(), [{ k: 'fx', fx: 'reaction' }]);
  assert.ok(one.tags.includes('trait:reaction'));
  const both = applyUpgradeSteps(strike(), [{ k: 'combo', steps: [{ k: 'fx', fx: 'block', n: 4 }, { k: 'fx', fx: 'draw', n: 1 }] }]);
  assert.ok(both.effects.some((e) => e.op === 'block') && both.effects.some((e) => e.op === 'draw'));
  assert.deepEqual(upgradeStepsProblems(withSteps([{ k: 'combo', steps: [{ k: 'fx', fx: 'block', n: 4 }, { k: 'dmg', n: 2 }] }]), 'x'), []);
  assert.match(upgradeStepsProblems(withSteps([{ k: 'combo', steps: [{ k: 'dmg', n: 2 }] }]), 'x')[0], /steps/);
});

import { cardFaceLines } from '../src/model/cardFaceText.js';
import { projectGameCard } from '../src/model/gameProfile.js';

test('every menu step reads on the card face (no step is hidden behind the authored text)', () => {
  const text = (steps) => cardFaceLines(projectGameCard({ gameProfile: profile }, { instanceId: 'x', cardId: 'core.strike', ...withSteps(steps) }), null, registries, null)
    .map((line) => line.html.replace(/<[^>]+>/g, '')).join(' | ');
  const expect = { block: /Block/, draw: /Draw/, cycle: /discard/i, cull: /Exhaust/, copy: /copy/, shuffle: /Shuffle/, holdOne: /Retain/, target: /random enemy|damage/ };
  for (const [fx, pattern] of Object.entries(expect)) {
    const step = { k: 'fx', fx, ...(['block', 'draw', 'cycle'].includes(fx) ? { n: 2 } : {}) };
    assert.match(text([step]), pattern, fx);
  }
  assert.match(text([{ k: 'fx', fx: 'boost', stat: 'strength', n: 2 }]), /Strength 2 this turn/);
});
