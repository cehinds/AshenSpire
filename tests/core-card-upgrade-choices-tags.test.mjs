// Owner ask 2026-10-31: poise and tag upgrade steps take effect on the projected face, the combat identity and
// the save / snapshot validators.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registries, profile } from './helpers/fixcore-combat-rules.mjs';
import { createRunState, validateRunShape } from '../src/model/state.js';
import { projectGameCard } from '../src/model/gameProfile.js';
import { combatProfileFor, combatCardRange } from '../src/model/combatCardProfile.js';
import { upgradeBasic } from '../src/model/cardUpgradeLimits.js';
import { upgradeSignature } from '../src/model/cardUpgrade.js';

const subject = { gameProfile: profile };
const face = (cardId, steps) => projectGameCard(subject, { instanceId: 'i', cardId, upgraded: true, upgradeSteps: steps });
const plain = (cardId) => projectGameCard(subject, { instanceId: 'i', cardId });

test('poise: a hammerBlow face gains poise damage', () => {
  const before = plain('core.hammerBlow').effects.find((e) => e.op === 'poiseDamage').amount;
  assert.equal(face('core.hammerBlow', [{ k: 'poise', n: 2 }]).effects.find((e) => e.op === 'poiseDamage').amount, before + 2);
});

test('range: the combat range follows the step and the old range tag is gone', () => {
  const base = combatCardRange(plain('core.strike'));
  assert.equal(base, 'melee');
  const reach = face('core.strike', [{ k: 'tag', tag: 'range:reach' }]);
  assert.equal(combatProfileFor(reach).range, 'reach');
  assert.equal(combatCardRange(reach), 'reach');
  const ranged = face('core.strike', [{ k: 'tag', tag: 'range:reach' }, { k: 'tag', tag: 'range:ranged' }]);
  assert.equal(combatCardRange(ranged), 'ranged');
  assert.equal(ranged.tags.filter((t) => t.startsWith('range:')).length, 1, 'no conflicting range tags');
});

test('targeting: the profile reads area and the damage hits every enemy', () => {
  const area = face('core.strike', [{ k: 'tag', tag: 'targeting:area', retarget: 'area' }]);
  assert.equal(combatProfileFor(area).targeting, 'area');
  const hit = area.effects.find((e) => e.op === 'damage');
  assert.equal(hit.target, 'allEnemies');
  assert.equal(hit.amount, Math.ceil(plain('core.strike').effects.find((e) => e.op === 'damage').amount * 0.75));
  const back = face('core.strike', [{ k: 'tag', tag: 'targeting:area', retarget: 'area' }, { k: 'tag', tag: 'targeting:single', retarget: 'single' }]);
  assert.equal(combatProfileFor(back).targeting, 'single');
  assert.equal(back.effects.find((e) => e.op === 'damage').target, 'enemy');
});

test('maneuver and school: the profile reads the new value', () => {
  assert.equal(combatProfileFor(face('core.hammerBlow', [{ k: 'tag', tag: 'maneuver:attack' }])).maneuver, 'attack');
  const spell = registries.cards.get('core.cinderDart');
  assert.ok((spell.tags || []).includes('camp:spell'));
  assert.equal(combatProfileFor(face('core.cinderDart', [{ k: 'tag', tag: 'school:frost' }])).school, 'frost');
});

test('element: the face takes the new damage school', () => {
  assert.equal(plain('core.strike').damageSchool, 'physical');
  assert.equal(face('core.strike', [{ k: 'tag', damageSchool: 'holy' }]).damageSchool, 'holy');
});

test('rank-down: the face carries rank.cantrip and the instance counts as Basic', () => {
  const card = 'core.ironbreaker';
  assert.ok(!face(card, [{ k: 'dmg', n: 1 }]).tags.includes('rank.cantrip'));
  assert.ok(face(card, [{ k: 'tag', tag: 'rank.cantrip' }]).tags.includes('rank.cantrip'));
  const def = registries.cards.get(card);
  assert.equal(upgradeBasic(def), false);
  assert.equal(upgradeBasic(def, { upgraded: true, upgradeSteps: [{ k: 'tag', tag: 'rank.cantrip' }] }), true);
});

test('the cache key tells each new step apart', () => {
  const steps = [[{ k: 'poise', n: 1 }], [{ k: 'tag', tag: 'range:reach' }], [{ k: 'tag', tag: 'targeting:area', retarget: 'area' }],
    [{ k: 'tag', damageSchool: 'fire' }], [{ k: 'tag', tag: 'rank.cantrip' }]];
  assert.equal(new Set(steps.map((s) => upgradeSignature({ upgradeSteps: s }))).size, steps.length);
});

test('a save with the new steps validates, and a bad tag step is refused', () => {
  const run = createRunState({ registries, classId: 'reaver', seed: 504, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const card = run.deck.find((c) => c.cardId === 'core.strike');
  card.upgraded = true;
  card.upgradeSteps = [{ k: 'poise', n: 1 }, { k: 'tag', tag: 'range:reach' }, { k: 'tag', tag: 'targeting:area', retarget: 'area' }, { k: 'tag', damageSchool: 'arcane' }, { k: 'tag', tag: 'rank.cantrip' }];
  const problems = (r) => [validateRunShape(r)].flat().filter(Boolean);
  const json = JSON.parse(JSON.stringify(run));
  assert.deepEqual(json.deck.find((c) => c.instanceId === card.instanceId).upgradeSteps, card.upgradeSteps, 'round-trips through JSON');
  const text = JSON.stringify(problems(run));
  assert.ok(!text.includes('upgradeSteps'), text);
  card.upgradeSteps = [{ k: 'tag', tag: 'range:far' }];
  assert.ok(JSON.stringify(problems(run)).includes('upgradeSteps'), 'a tag outside the vocabulary is a problem');
});

test('a school change on a non-damaging spell projects a valid face and profile', () => {
  for (const id of ['core.mendingTouch', 'core.hexmark']) {
    const before = plain(id);
    const after = face(id, [{ k: 'tag', tag: 'school:divine' }]);
    assert.equal(combatProfileFor(after).school, 'divine');
    assert.equal(combatProfileFor(after).camp, 'spell');
    assert.deepEqual(after.effects, before.effects, 'school changes typing only');
  }
});

test('an element step carries the exposure an authored card of that school builds, so combat reads both', async () => {
  const { nextUpgradeOptions } = await import('../src/model/cardUpgradeLimits.js');
  const floor = registries.balance.exposure.buildupPerManaSpell;
  const authored = [...registries.cards.ids()].map((id) => registries.cards.get(id)).find((c) => c.id.startsWith('core.') && c.damageSchool === 'magic' && c.manaCost > 0 && c.exposureBuildupPerHit > 0);
  assert.ok(authored, 'an authored Mana spell of the magic school');
  assert.ok(authored.exposureBuildupPerHit >= floor, 'the floor is what the least authored one builds');
  const run = { seed: 504, gameProfile: profile };
  const element = [];
  for (let n = 0; n < 200; n += 1) {
    const instance = { instanceId: `e${n}`, cardId: 'core.strike' };
    for (const step of nextUpgradeOptions({ ...run, seed: n }, instance, registries.cards.get('core.strike'), registries, 20)) if (step.damageSchool) element.push(step);
  }
  assert.ok(element.length > 0 && element.every((s) => s.exposureBuildupPerHit === floor), 'every element step names the floor');
  const stepped = face('core.strike', [element[0]]);
  assert.equal(stepped.damageSchool, element[0].damageSchool);
  assert.equal(stepped.exposureBuildupPerHit, floor);
  assert.equal(plain('core.strike').exposureBuildupPerHit, 0, 'the base is untouched');
});
