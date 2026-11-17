// Theme G of the 2026-11-17 playtest (owner): the new self-buff and conditional payoff cards, played for real in a
// Core fight. Each conditional card pays its bonus when its condition holds and not otherwise; the reach-only cards
// refuse to play at melee. Self-buffs only ever target the player.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { actorRangeKey, rangePairKey } from '../src/model/combatEngagement.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);

export const SELF_BUFF_CARDS = Object.freeze({
  reaver: ['steelResolve', 'ironHide'], herald: ['hearthVigil', 'zealousFervor'], starseer: ['innerOrbit', 'starlitSkin'], rogue: ['keenEdge'],
});
export const CONDITIONAL_CARDS = Object.freeze({
  reaver: ['openingCut', 'holdTheLine', 'lungingThrust'], herald: ['sanctifiedGuard', 'pyreBrand'],
  starseer: ['unguardedBolt', 'focusedStar', 'rimeLance', 'distantStar'], rogue: ['breakFocus', 'dirtyStrike', 'closeQuarters'],
});

function live(classId, seed = 433) {
  const run = createRunState({ registries, classId, seed, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries, run, rng: createRng(seed), enemyIds: ['wanderingSoldier'] });
  const enemy = combat.enemies[0];
  delete combat.reactionRules.contactPolicy;
  Object.assign(combat.player, { basePrecisionBonus: 1000, hp: 999, maxHp: 999, energy: 99, stamina: 99, maxStamina: 99, mana: 99, maxMana: 99, statuses: {} });
  Object.assign(enemy, { hp: 5000, maxHp: 5000, statuses: {}, ratingSources: [], basePrecisionBonus: 0, block: 0 });
  dispatch(combat, { type: 'setReactions', enabled: false });
  return { combat, player: combat.player, enemy };
}
const setBand = (combat, enemy, band) => {
  combat.rangeState.engagements[rangePairKey(actorRangeKey(combat, combat.player), actorRangeKey(combat, enemy))] = band;
};
const play = (combat, cardId, target) => {
  const id = `t-${cardId}-${combat.piles.hand.length}`;
  combat.piles.hand.push({ instanceId: id, cardId });
  dispatch(combat, { type: 'playCard', cardInstanceId: id, ...(target ? { targetId: target.id } : {}) });
};
/** One fresh fight per side of the condition: `setup(world, met)` arranges it, `measure(world)` reads the payoff. */
function bothSides(classId, cardId, setup, measure) {
  return [true, false].map(met => {
    const world = live(classId);
    setup(world, met);
    const before = measure(world);
    play(world.combat, cardId, registries.cards.get(cardId).type === 'attack' ? world.enemy : null);
    return measure(world) - before;
  });
}
const damageTaken = ({ enemy }) => -enemy.hp;
const blockHeld = ({ player }) => player.block;
const stance = maneuver => ({ maneuver, camp: maneuver === 'casting' ? 'spell' : 'physical', range: 'melee' });

test('every new card is an expanded-combat card of its class, so the Core reward roll offers it; self-buffs target only the player', () => {
  for (const [classId, ids] of Object.entries(SELF_BUFF_CARDS)) {
    for (const id of [...ids, ...CONDITIONAL_CARDS[classId]]) {
      const def = registries.cards.get(id);
      assert.ok(def, `${id} is registered`);
      assert.equal(def.class, classId, `${id} belongs to ${classId}`);
      assert.equal(def.minCombatExpansionVersion, 2, `${id} joins the Core (expanded combat) reward roll`);
      assert.ok(!registries.classes.get(classId).cardPool.includes(id), `${id} stays out of the older rules' pool`);
    }
    for (const id of ids) {
      const def = registries.cards.get(id);
      const statusEffects = [...def.effects, ...(def.upgrade?.effects || [])].filter(effect => effect.op === 'applyStatus');
      assert.ok(statusEffects.length, `${id} buffs`);
      assert.ok(statusEffects.every(effect => effect.target === 'self'), `${id} buffs the player only`);
    }
  }
});

test('the strong self-buffs carry a penalty that the upgrade eases', () => {
  const penalty = def => (def.keywords || []).filter(k => ['exhaust', 'ethereal'].includes(k)).length * 10 + (def.manaCost || 0) + (def.cost || 0) + (def.costGrowth ? 5 : 0);
  for (const ids of Object.values(SELF_BUFF_CARDS)) for (const id of ids) {
    const def = registries.cards.get(id);
    const upgraded = { ...def, ...def.upgrade, costGrowth: def.costGrowth };
    assert.ok(penalty(upgraded) < penalty(def), `${id}: the upgrade eases its penalty`);
  }
});

test('self-buffs grant their status to the player', () => {
  for (const [classId, ids] of Object.entries(SELF_BUFF_CARDS)) for (const id of ids) {
    const { combat, player } = live(classId);
    play(combat, id);
    const statuses = registries.cards.get(id).effects.filter(effect => effect.op === 'applyStatus').map(effect => effect.status);
    for (const status of statuses) assert.ok((player.statuses[status]?.stacks || 0) > 0, `${id} gives the player ${status}`);
  }
});

test('Opening Cut and Unguarded Bolt pay off against an Idle target', () => {
  const idle = ({ enemy }, met) => { if (met) delete enemy.combatStance; else enemy.combatStance = stance('attack'); };
  const [met, unmet] = bothSides('reaver', 'openingCut', idle, damageTaken);
  assert.ok(met > unmet, `Idle target takes more (${met} > ${unmet})`);
  const vulnerable = ['starseer'].flatMap(classId => [true, false].map(on => {
    const world = live(classId);
    idle(world, on);
    play(world.combat, 'unguardedBolt', world.enemy);
    return world.enemy.statuses.vulnerable?.stacks || 0;
  }));
  assert.ok(vulnerable[0] > 0 && vulnerable[1] === 0, `Vulnerable only on an Idle target (${vulnerable})`);
});

test('Break Focus pays off against a target in Prepared', () => {
  const [met, unmet] = bothSides('rogue', 'breakFocus', ({ enemy }, on) => { enemy.combatStance = stance(on ? 'casting' : 'attack'); }, damageTaken);
  assert.ok(met > unmet, `${met} > ${unmet}`);
});

test('Hold the Line and Sanctified Guard read your stance before the card', () => {
  const inDefense = ({ player }, on) => { player.combatStance = stance(on ? 'defend' : 'attack'); };
  const [lineMet, lineUnmet] = bothSides('reaver', 'holdTheLine', inDefense, blockHeld);
  assert.ok(lineMet > lineUnmet, `Hold the Line Block ${lineMet} > ${lineUnmet}`);
  const [guardMet, guardUnmet] = bothSides('herald', 'sanctifiedGuard', inDefense, blockHeld);
  assert.ok(guardMet > guardUnmet, `Sanctified Guard Block ${guardMet} > ${guardUnmet}`);
});

test('Focused Star pays off when you were in Prepared', () => {
  const [met, unmet] = bothSides('starseer', 'focusedStar', ({ player }, on) => { player.combatStance = stance(on ? 'casting' : 'attack'); }, damageTaken);
  assert.ok(met > unmet, `${met} > ${unmet}`);
});

test('Pyre Brand, Dirty Strike and Rime Lance read the target status', () => {
  const [burnMet, burnUnmet] = bothSides('herald', 'pyreBrand', ({ enemy }, on) => { if (on) enemy.statuses.burn = { stacks: 1 }; }, damageTaken);
  assert.ok(burnMet > burnUnmet, `Burning target takes more (${burnMet} > ${burnUnmet})`);
  const [weakMet, weakUnmet] = bothSides('rogue', 'dirtyStrike', ({ enemy }, on) => { if (on) enemy.statuses.weak = { stacks: 2 }; }, damageTaken);
  assert.ok(weakMet > weakUnmet, `a Weak target takes more (${weakMet} > ${weakUnmet})`);
  const vulnerable = [true, false].map(on => {
    const world = live('starseer');
    if (on) world.enemy.statuses.frost = { stacks: 1 };
    play(world.combat, 'rimeLance', world.enemy);
    return world.enemy.statuses.vulnerable?.stacks || 0;
  });
  assert.ok(vulnerable[0] > 0 && vulnerable[1] === 0, `Vulnerable only on a Frosted target (${vulnerable})`);
});

test('Lunging Thrust and Distant Star play only at Reach', () => {
  for (const [classId, cardId] of [['reaver', 'lungingThrust'], ['starseer', 'distantStar']]) {
    const near = live(classId);
    setBand(near.combat, near.enemy, 0);
    assert.throws(() => play(near.combat, cardId, near.enemy), error => error.playRefusal?.reason === 'unplayable', `${cardId} refuses at Melee`);
    const far = live(classId);
    setBand(far.combat, far.enemy, 1);
    const hp = far.enemy.hp;
    play(far.combat, cardId, far.enemy);
    assert.ok(far.enemy.hp < hp, `${cardId} hits at Reach`);
  }
});

test('Close Quarters pays off at Melee and not at Reach', () => {
  const [met, unmet] = bothSides('rogue', 'closeQuarters', ({ combat, enemy }, on) => setBand(combat, enemy, on ? 0 : 1), damageTaken);
  assert.ok(met > unmet, `${met} > ${unmet}`);
});
