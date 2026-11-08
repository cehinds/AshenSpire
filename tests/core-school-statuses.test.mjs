// Owner, 2026-11-07 (SPEC 4.7, School statuses): in Core 2 a school's hit that costs HP gives the target that school's status, once per action per target,
// and not when the card already prints it. The table is `schoolStatuses` in content/source/fixCoreMechanics.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from './withoutWeaknesses.mjs';
import { applyAttackDamage, executeAction } from '../src/engine/actions.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';
import { schoolStatusRow } from '../src/engine/schoolStatuses.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
function world({ split = false } = {}) {
  const run = createRunState({ registries: reg, classId: 'starseer', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries: reg, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  if (split) { const { damage, ...old } = combat.fixCoreRules; combat.fixCoreRules = old; }
  const target = combat.enemies[0];
  Object.assign(target, { hp: 500, maxHp: 500, block: 0, barrier: 0, statuses: {}, persistentWard: null, persistentPoise: { value: 0, max: 20 }, attributes: { dexterity: 0 } });
  delete target.combatStance; delete target.combatCounter; delete combat.player.combatStance;
  return { combat, target };
}
const drain = combat => { while (combat.queue.length) executeAction(combat, combat.queue.shift()); };
const spell = (school, damageType, extra = {}) => ({ tags: ['camp:spell', ...(school ? [`school:${school}`] : []), `damage:${damageType}`], skipRatingBonus: true, magicShare: 1, combatRiderTargets: [],
  combatProfile: { camp: 'spell', maneuver: 'casting', damageType, range: 'reach', ...(school ? { school } : {}) }, ...extra });
function cast(w, carrier, amount = 6) {
  primeAccuracyRolls(w.combat, { die: 20 });
  applyAttackDamage(w.combat, w.combat.player, w.target, amount, carrier.tags, carrier);
  drain(w.combat);
}
const stacks = (e, id) => e.statuses?.[id]?.stacks || 0;

for (const [school, type, status] of [['fire', 'fire', 'burn'], ['lightning', 'lightning', 'weak'], ['frost', 'frost', 'chilled'], ['decay', 'decay', 'necroticBlight'], ['illusion', 'psychic', 'confused'], ['earth', 'earth', 'slowed']]) {
  test(`${school}: a hit that costs HP gives the target 1 ${status}`, () => {
    const w = world();
    cast(w, spell(school, type));
    assert.ok(w.target.hp < 500, 'fixture: the hit cost HP');
    assert.equal(stacks(w.target, status), 1, JSON.stringify(w.target.statuses));
  });
}
test('force: strips 1 Ward stack from the target', () => {
  const w = world();
  w.target.statuses.ward = { stacks: 3 };
  cast(w, spell('force', 'arcane'));
  assert.equal(stacks(w.target, 'ward'), 2);
});
test('divine: the caster cleanses 1 of its own statuses (the existing cleanse list)', () => {
  const w = world();
  w.combat.player.statuses.weak = { stacks: 2 };
  cast(w, spell('divine', 'sacred'));
  assert.equal(stacks(w.combat.player, 'weak'), 1);
  assert.equal(stacks(w.target, 'weak'), 0, 'divine puts nothing on the target');
});
test('alteration: none', () => {
  const w = world();
  cast(w, spell('alteration', 'arcane'));
  assert.deepEqual(w.target.statuses, {});
  assert.equal(schoolStatusRow(w.combat, spell('abjuration', 'arcane')) && Object.keys(schoolStatusRow(w.combat, spell('abjuration', 'arcane'))).length, 0);
});
test('no school: the damage type decides through the aliases (poison -> venom, frost -> chilled)', () => {
  const w = world();
  cast(w, spell(null, 'poison'));
  assert.equal(stacks(w.target, 'venom'), 1);
  const v = world();
  cast(v, spell(null, 'frost'));
  assert.equal(stacks(v.target, 'chilled'), 1);
});
test('a physical weapon hit gives no school status', () => {
  const w = world();
  cast(w, { tags: ['camp:physical', 'damage:slashing'], skipRatingBonus: true, combatRiderTargets: [], combatProfile: { camp: 'physical', maneuver: 'attack', damageType: 'slashing', range: 'melee' } });
  assert.deepEqual(w.target.statuses, {});
});
test('a hit that costs no HP gives no status (fully blocked)', () => {
  const w = world();
  w.target.block = 100;
  cast(w, spell('fire', 'fire'));
  assert.equal(w.target.hp, 500);
  assert.equal(stacks(w.target, 'burn'), 0);
});
test('once per action per target: a shared budget gives the second hit of one action nothing', () => {
  const w = world();
  const carrier = spell('fire', 'fire'); // one carrier = one action's budget
  cast(w, carrier); cast(w, carrier);
  assert.equal(stacks(w.target, 'burn'), 1);
  cast(w, spell('fire', 'fire')); // a new action
  assert.equal(stacks(w.target, 'burn'), 2);
});
test('a card that prints the status gets no second one (lightning prints Weak: exactly the printed stacks)', () => {
  const w = world();
  const carrier = spell('lightning', 'lightning', { appliedStatuses: ['weak'] });
  cast(w, carrier);
  assert.equal(stacks(w.target, 'weak'), 0, 'the school adds none; the printed effect is a separate effect of the card');
});
test('legacy: a fight saved before damage.unified gets no school status', () => {
  const w = world({ split: true });
  cast(w, spell('fire', 'fire'));
  assert.equal(stacks(w.target, 'burn'), 0);
});
test('a reaction (Counter return) never chains a school status', () => {
  const w = world();
  cast(w, spell('fire', 'fire', { combatReaction: true }));
  assert.equal(stacks(w.target, 'burn'), 0);
});

import { dispatch } from '../src/engine/combat.js';
function play(w, cardId) {
  const instanceId = `t_${cardId}`;
  w.combat.piles.hand.push({ instanceId, cardId, upgraded: false });
  Object.assign(w.combat.player, { mana: 20, stamina: 20, energy: 20 });
  primeAccuracyRolls(w.combat, { die: 20 });
  dispatch(w.combat, { type: 'playCard', cardInstanceId: instanceId, targetId: w.target.id });
}
test('real cards: Spark leaves exactly 1 Weak (one source); Cinder Dart, which prints Burn, gets no second Burn from the school', () => {
  const a = world(); play(a, 'core.spark');
  assert.ok(a.target.hp < 500);
  assert.equal(stacks(a.target, 'weak'), 1);
  const printed = world().combat.registries.cards.get('core.cinderDart').effects.filter(e => e.op === 'applyStatus' && e.status === 'burn').reduce((n, e) => n + (e.stacks || 1), 0);
  const b = world(); play(b, 'core.cinderDart');
  assert.ok(stacks(b.target, 'burn') <= Math.max(printed, 1) + 0, `burn ${stacks(b.target, 'burn')} vs printed ${printed}`);
});
