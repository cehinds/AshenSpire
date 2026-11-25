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
import { executeAction } from '../src/engine/actions.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';

const strike = () => registries.cards.get('core.strike');
const withSteps = (steps) => ({ upgraded: true, upgradeSteps: steps });

// The `other`-target half hit is a rule about the card's base number; the Core base-damage halving (0.5, rounded up)
// makes 6 and 3 both land as 3 + AR, so that one test pins baseDamageMultiplier 1 to keep the halves distinguishable.
const unscaledProfile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: { effects: { baseDamageMultiplier: 1, physicalDamageMultiplier: 1, playerDamageMultiplier: 1, enemyDamageMultiplier: 1, blockGainMultiplier: 1 } } });
const unscaledRegistries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, unscaledProfile)), unscaledProfile);
function fight(cards, { enemies = ['wanderingSoldier'], registries: reg = registries } = {}) {
  const run = createRunState({ registries: reg, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries: reg, run, rng: createRng(511), enemyIds: enemies });
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
    { k: 'fx', fx: 'target' }, { k: 'fx', fx: 'reaction' }, { k: 'fx', fx: 'counter', n: 1 }, { k: 'fx', fx: 'recurring' }];
  // Batch 2: INT / WIS boosts exist, for this turn or the rest of the fight. They are the same kind ('boost'), so the kind count is unchanged.
  const attributeBoosts = [{ k: 'fx', fx: 'boost', stat: 'intelligence', n: 2, until: 'turn' }, { k: 'fx', fx: 'boost', stat: 'wisdom', n: 1, until: 'fight' }];
  // unexhaust, unethereal and steady change nothing on Strike (it has no Exhaust, Ethereal or rising cost); tests/card-cost-balance.test.mjs covers the last two.
  assert.deepEqual([...FX_KINDS].sort(), [...steps.map(({ fx }) => fx), 'unexhaust', 'unethereal', 'steady'].sort());
  for (const step of steps) {
    assert.deepEqual(upgradeStepsProblems(withSteps([step]), 'x'), [], JSON.stringify(step));
    assert.notDeepEqual(JSON.stringify(applyUpgradeSteps(strike(), [step])), JSON.stringify(applyUpgradeSteps(strike(), [{ k: 'dmg', n: 0 }])), step.fx);
  }
  assert.match(upgradeStepsProblems(withSteps([{ k: 'fx', fx: 'nope' }]), 'x')[0], /fx/);
  for (const step of attributeBoosts) {
    assert.deepEqual(upgradeStepsProblems(withSteps([step]), 'x'), [], JSON.stringify(step));
    assert.notDeepEqual(JSON.stringify(applyUpgradeSteps(strike(), [step])), JSON.stringify(applyUpgradeSteps(strike(), [{ k: 'dmg', n: 0 }])), step.stat);
  }
  assert.match(upgradeStepsProblems(withSteps([{ k: 'fx', fx: 'boost', stat: 'constitution', n: 2, until: 'turn' }]), 'x')[0], /stat/);
  assert.match(upgradeStepsProblems(withSteps([{ k: 'fx', fx: 'boost', stat: 'wisdom', n: 2 }]), 'x')[0], /until/, 'only STR / DEX keep the legacy no-duration boost');
  assert.match(upgradeStepsProblems(withSteps([{ k: 'fx', fx: 'block', n: 0 }]), 'x')[0], /\.n/);
  assert.match(upgradeStepsProblems(withSteps([{ k: 'fx', fx: 'counter', n: 4 }]), 'x')[0], /\.n/, 'one +Counter step never grants more than 3');
  const recurring = applyUpgradeSteps(strike(), [{ k: 'fx', fx: 'recurring' }]);
  assert.ok(recurring.tags.includes('trait:recurring') && recurring.keywords.includes('exhaust'));
});

test('a card is only offered what it lacks', () => {
  const run = { seed: 7, level: { level: 10 }, gameProfile: profile, rangePolicy: {} };
  const fxOf = (cardId, steps = []) => nextUpgradeOptions(run, { instanceId: 'x', cardId, ...(steps.length ? withSteps(steps) : { upgraded: false }) }, registries.cards.get(cardId), registries, 40, { noAuthored: true, everyFamily: true })
    .filter((s) => s.k === 'fx').map((s) => s.fx);
  assert.ok(fxOf('core.strike').includes('block'));
  assert.ok(!fxOf('core.defend').includes('block'), 'Defend already gives Block');
  assert.ok(!fxOf('core.strike').includes('unexhaust'), 'Strike has no Exhaust to remove');
  assert.ok(fxOf('core.mendingTouch').includes('unexhaust'));
  assert.ok(!fxOf('core.strike', [{ k: 'fx', fx: 'retain' }]).includes('retain'), 'no second Retain');
  assert.ok(!fxOf('core.strike', [{ k: 'fx', fx: 'block', n: 4 }]).includes('block'));
  const boostStats = (cardId) => nextUpgradeOptions(run, { instanceId: 'x', cardId, upgraded: false }, registries.cards.get(cardId), registries, 40, { noAuthored: true, everyFamily: true })
    .filter((s) => s.k === 'fx' && s.fx === 'boost').map((s) => s.stat);
  assert.ok(boostStats('core.spark').includes('intelligence'), 'a damaging spell is offered an INT boost');
  assert.ok(!boostStats('core.spark').some((stat) => ['strength', 'dexterity'].includes(stat)), 'a spell is offered INT / WIS boosts, never STR / DEX');
});

test('Block, draw, copy, shuffle and cull do what the card says', () => {
  let c = fight([inst('p', 'core.strike', [{ k: 'fx', fx: 'block', n: 4 }])]);
  play(c, 'p');
  assert.ok(c.player.block >= Math.floor(4 * 0.7), `block ${c.player.block}`); // Core blockGainMultiplier 0.7 (owner, 2026-11-18)
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
  const plain = fight([inst('p', 'core.strike')], { enemies: ['wanderingSoldier', 'wanderingSoldier'], registries: unscaledRegistries });
  play(plain, 'p');
  const main = 500 - plain.enemies[0].hp;
  const c = fight([inst('p', 'core.strike', [step])], { enemies: ['wanderingSoldier', 'wanderingSoldier'], registries: unscaledRegistries });
  play(c, 'p');
  assert.equal(500 - c.enemies[0].hp, main, 'the main target takes only the card\'s own hit');
  assert.ok(c.enemies[1].hp < 500 && 500 - c.enemies[1].hp < main, 'the other enemy takes the half hit');
  const lone = fight([inst('p', 'core.strike', [step])], { registries: unscaledRegistries });
  play(lone, 'p');
  assert.equal(500 - lone.enemies[0].hp, main, 'a lone enemy takes one hit, not a second');
  assert.match(JSON.stringify(applyUpgradeSteps(strike(), [step]).effects), /otherEnemy/);
  const q = fight([inst('p', 'core.strike', [step])], { enemies: ['wanderingSoldier', 'wanderingSoldier'], registries: unscaledRegistries });
  const half = (aimed) => previewCard(q, 'p', aimed.id).values.find((row) => row.target === 'otherEnemy');
  for (const [aimed, other] of [[q.enemies[0], q.enemies[1]], [q.enemies[1], q.enemies[0]]]) {
    const row = half(aimed);
    assert.deepEqual(Object.keys(row.perTarget), [other.id], 'the half hit is quoted only on the other enemy');
    assert.ok(row.perTarget[other.id] > 0);
  }
  const alone = fight([inst('p', 'core.strike', [step])], { registries: unscaledRegistries });
  assert.deepEqual(Object.keys(previewCard(alone, 'p', alone.enemies[0].id).values.find((row) => row.target === 'otherEnemy').perTarget), [], 'a lone enemy is quoted no half hit');
});

// Opus review on #2756: a boost gained in the enemy phase (a Reaction) used to last through the player's whole next turn, and the
// end-of-turn clear subtracted the whole boost even after a Strength loss, eating stacks the player owned before it.
const boostSelf = (combat) => executeAction(combat, { effect: { op: 'applyStatus', target: 'self', status: 'strength', stacks: 2, thisTurn: true },
  source: combat.player, owner: combat.player, target: combat.player, meta: {} });
test('a thisTurn boost gained in the enemy phase ends with that turn, before the player acts again', () => {
  // The shipped Core profile: the Wandering Soldier opens with Slash at seed 511, so a Reaction card is offered against it.
  const core = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
  const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, core)), core);
  const c = createRunCombat({ registries: reg, run: createRunState({ registries: reg, classId: 'reaver', seed: 511 }), rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  assert.equal(c.enemies[0].intent.moveId, 'slash');
  for (const pile of Object.values(c.piles)) pile.length = 0;
  c.piles.hand.push(inst('p', 'core.strike', [{ k: 'fx', fx: 'boost', stat: 'strength', n: 2 }, { k: 'fx', fx: 'reaction' }]));
  for (let i = 0; i < 8; i += 1) c.piles.draw.push({ instanceId: `f${i}`, cardId: 'core.defend', upgraded: false });
  c.player.stamina = c.player.maxStamina = 20; c.player.hp = c.player.maxHp = 999;
  dispatch(c, { type: 'endTurn' });
  const option = c.pendingReaction?.options?.find((row) => row.play?.cardInstanceId === 'p');
  assert.ok(option, 'the boosted Reaction is offered against Slash');
  dispatch(c, { type: 'chooseReaction', offerId: c.pendingReaction.id, optionId: option.id });
  for (let i = 0; c.pendingReaction && i < 20; i++) dispatch(c, { type: 'chooseReaction', offerId: c.pendingReaction.id, optionId: null });
  assert.ok(c.eventLog.some((row) => row.type === 'statusApplied' && row.status === 'strength'), 'the Reaction granted the boost');
  assert.equal(c.phase, 'player');
  assert.ok(!c.player.statuses.strength || c.player.statuses.strength.stacks === 0, 'gone before the next player turn');
  assert.equal(c.player.turnBoosts, undefined);
});
test('clearing a thisTurn boost removes at most the boost still present, never stacks owned before it', () => {
  const c = fight([inst('p', 'core.strike')]);
  c.player.statuses.strength = { stacks: 3 };
  boostSelf(c);
  assert.equal(c.player.statuses.strength.stacks, 5);
  c.player.statuses.strength.stacks -= 2; // a Strength loss after the grant takes the boost first
  dispatch(c, { type: 'endTurn' });
  for (let i = 0; c.pendingReaction && i < 20; i++) dispatch(c, { type: 'chooseReaction', offerId: c.pendingReaction.id, optionId: null });
  assert.equal(c.player.statuses.strength?.stacks, 3, 'the three owned stacks stay');
  const d = fight([inst('p', 'core.strike')]);
  d.player.statuses.strength = { stacks: 3 };
  boostSelf(d);
  dispatch(d, { type: 'endTurn' });
  for (let i = 0; d.pendingReaction && i < 20; i++) dispatch(d, { type: 'chooseReaction', offerId: d.pendingReaction.id, optionId: null });
  assert.equal(d.player.statuses.strength?.stacks, 3, 'with no loss the whole boost leaves');
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
