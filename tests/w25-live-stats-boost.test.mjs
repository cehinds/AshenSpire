// W25-L: the upgrade boost step offers INT and WIS and a duration (this turn / the rest of the fight), played as a live attribute change.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { dispatch } from '../src/engine/combat.js';
import { upgradeStepsProblems, applyUpgradeSteps } from '../src/model/cardUpgrade.js';
import { rollUpgradeOptions, upgradeStepRng } from '../src/model/cardUpgradeSteps.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';
import { LiveAttribute } from '../src/engine/liveStats.js';
import { ratingValue } from '../src/model/combatRatings.js';

const boost = (stat, n, until) => ({ k: 'fx', fx: 'boost', stat, n, ...(until ? { until } : {}) });

test('boost steps validate: INT and WIS need a duration, STR and DEX may omit it (legacy)', () => {
  const p = (step) => upgradeStepsProblems({ upgraded: true, upgradeSteps: [step] }, 'c');
  assert.deepEqual(p(boost('strength', 2)), [], 'legacy this-turn STR');
  assert.deepEqual(p(boost('intelligence', 2, 'turn')), []);
  assert.deepEqual(p(boost('wisdom', 1, 'fight')), []);
  assert.match(p(boost('intelligence', 2))[0], /until/);
  assert.match(p(boost('wisdom', 1, 'forever'))[0], /until/);
  assert.match(p(boost('luck', 1, 'fight'))[0], /stat/);
});

test('a boost step writes a changeAttribute effect; a legacy STR step keeps its status', () => {
  const strike = registries.cards.get('core.strike');
  const fight = applyUpgradeSteps(strike, [{ k: 'authored' }, boost('strength', 1, 'fight')]).effects.find(e => e.op === 'changeAttribute');
  assert.deepEqual({ attribute: fight.attribute, amount: fight.amount, thisTurn: fight.thisTurn, target: fight.target }, { attribute: 'strength', amount: 1, thisTurn: undefined, target: 'self' });
  const turn = applyUpgradeSteps(strike, [{ k: 'authored' }, boost('intelligence', 2, 'turn')]).effects.find(e => e.op === 'changeAttribute');
  assert.equal(turn.thisTurn, true);
  const legacy = applyUpgradeSteps(strike, [{ k: 'authored' }, boost('strength', 2)]).effects;
  assert.ok(legacy.some(e => e.op === 'applyStatus' && e.thisTurn === true && e.status === 'strength'));
  assert.ok(!legacy.some(e => e.op === 'changeAttribute'));
});

test('the roll offers a spell INT or WIS boost and an attack STR, with either duration', () => {
  const seen = { spell: new Set(), attack: new Set() };
  const spells = registries.cards.ids().map(id => registries.cards.get(id)).filter(def => (def.tags || []).includes('camp:spell') && (def.effects || []).some(e => e.op === 'damage'));
  const attacks = [registries.cards.get('core.strike')];
  for (let seed = 0; seed < 400; seed += 1) {
    for (const [kind, list] of [['spell', spells.slice(0, 3)], ['attack', attacks]]) for (const def of list) {
      for (const step of rollUpgradeOptions(def, [], 1, upgradeStepRng(seed, `i${seed}`, 1), {}, 3)) {
        if (step.k === 'fx' && step.fx === 'boost') seen[kind].add(`${step.stat}:${step.until}`);
      }
    }
  }
  assert.ok(seen.spell.has('intelligence:turn') && seen.spell.has('intelligence:fight'), [...seen.spell].join());
  assert.ok(seen.attack.has('strength:turn') && seen.attack.has('strength:fight'), [...seen.attack].join());
  assert.ok(![...seen.attack].some(key => key.startsWith('intelligence')));
});

function fightWith(steps) {
  const run = createRunState({ registries, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const index = run.deck.findIndex((c) => c.cardId === 'core.strike');
  Object.assign(run.deck[index], { upgraded: true, upgradeSteps: steps });
  const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  const instance = Object.values(combat.piles).flat().find((c) => c.instanceId === run.deck[index].instanceId);
  for (const pile of Object.values(combat.piles)) { const at = pile.indexOf(instance); if (at >= 0) pile.splice(at, 1); }
  combat.piles.hand.push(instance);
  Object.assign(combat.enemies[0], { hp: 500, maxHp: 500 });
  combat.player.energy = combat.player.stamina = combat.player.maxStamina = 20;
  return { combat, instance };
}

test('playing a +STR for-the-fight Strike raises AR at once and it stays; a this-turn INT one leaves at turn end', () => {
  const play = (steps) => {
    const fight = fightWith(steps);
    primeAccuracyRolls(fight.combat, { count: 3 });
    dispatch(fight.combat, { type: 'playCard', cardInstanceId: fight.instance.instanceId, targetId: fight.combat.enemies[0].id });
    return fight.combat;
  };
  const control = play([{ k: 'authored' }]);
  const boosted = play([{ k: 'authored' }, boost('strength', 2, 'fight')]);
  const p = boosted.player;
  assert.equal(LiveAttribute(p, 'strength'), LiveAttribute(control.player, 'strength') + 2);
  assert.equal(ratingValue(boosted, p, 'ar'), ratingValue(control, control.player, 'ar') + 2, 'AR rose the moment the card was played');
  const str = LiveAttribute(p, 'strength');
  dispatch(boosted, { type: 'endTurn' });
  assert.equal(LiveAttribute(p, 'strength'), str, 'a rest-of-fight boost survives the turn');

  const turn = play([{ k: 'authored' }, boost('intelligence', 2, 'turn')]);
  const int = LiveAttribute(turn.player, 'intelligence');
  assert.equal(int, LiveAttribute(control.player, 'intelligence') + 2);
  dispatch(turn, { type: 'endTurn' });
  assert.equal(LiveAttribute(turn.player, 'intelligence'), int - 2);
});

test('two plays of a for-the-fight boost stack, and the fight ending returns the attributes', () => {
  const { combat, instance } = fightWith([{ k: 'authored' }, boost('wisdom', 1, 'fight')]);
  const p = combat.player, wis = LiveAttribute(p, 'wisdom'), int = LiveAttribute(p, 'intelligence');
  primeAccuracyRolls(combat, { count: 6 });
  dispatch(combat, { type: 'playCard', cardInstanceId: instance.instanceId, targetId: combat.enemies[0].id });
  assert.equal(LiveAttribute(p, 'wisdom'), wis + 1);
  combat.piles.hand.push({ ...instance, instanceId: 'dup' });
  dispatch(combat, { type: 'playCard', cardInstanceId: 'dup', targetId: combat.enemies[0].id });
  assert.equal(LiveAttribute(p, 'wisdom'), wis + 2);
  // Winning ends the fight and takes both points back.
  combat.enemies[0].hp = 1;
  combat.piles.hand.push({ cardId: 'core.strike', instanceId: 'finisher', upgraded: false });
  primeAccuracyRolls(combat, { count: 6 });
  dispatch(combat, { type: 'playCard', cardInstanceId: 'finisher', targetId: combat.enemies[0].id });
  assert.equal(combat.result, 'victory');
  assert.equal(LiveAttribute(p, 'wisdom'), wis);
  assert.equal(LiveAttribute(p, 'intelligence'), int);
  assert.equal(p.liveStats, undefined);
});
