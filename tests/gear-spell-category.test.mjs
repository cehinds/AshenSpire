// Arcane and Divine gear selectors (owner 2026-11-20, docs/plans/spell-categories.md section 5): an Arcane bonus names Arcane and Shared
// Spells, a Divine bonus Divine and Shared ones. On a Shared Spell the two do not stack: per field only the larger counts; Spell bonuses add on top.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ApplyGearCardRules, GearHitAdds, GearHitRiders, GearModText, GearSelectorMatches, GearSummary } from '../src/model/gearEffects.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';

const spell = school => ({ id: 'gear-category-probe', tags: ['camp:spell', 'classification.attack', ...(school ? ['school:' + school] : [])],
  effects: [{ op: 'damage', target: 'enemy', amount: 10 }] });
const rule = (selector, amount, stat = 'damage', conds = []) => ({ selector, arg: null, conds, stat, amount, mode: 'add', source: selector });
const damageOf = (rules, def) => ApplyGearCardRules(rules, def, {}).effects[0].amount;

test('Arcane and Divine selectors name their category and Shared Spells only', () => {
  for (const [school, arcane, divine] of [['force', true, false], ['decay', false, true], ['divine', false, true], ['fire', true, true], [null, false, false]]) {
    assert.equal(GearSelectorMatches('arcaneSpell', null, spell(school)), arcane, `${school} arcane`);
    assert.equal(GearSelectorMatches('divineSpell', null, spell(school)), divine, `${school} divine`);
  }
  assert.equal(GearSelectorMatches('arcaneSpell', null, { tags: ['camp:physical', 'school:force'] }), false, 'only a Spell');
});

test('a Shared Spell takes the larger of its Arcane and Divine bonuses; Spell bonuses stack on top', () => {
  const both = [rule('arcaneSpell', 2), rule('divineSpell', 1)];
  assert.equal(damageOf(both, spell('fire')), 12, '+2 Arcane beats +1 Divine, never +3');
  assert.equal(damageOf([...both, rule('spell', 1)], spell('fire')), 13, 'a Spell bonus adds on top');
  assert.equal(damageOf([rule('arcaneSpell', 1), rule('arcaneSpell', 1), rule('divineSpell', 3)], spell('frost')), 13, 'group totals compare');
  assert.equal(damageOf(both, spell('force')), 12, 'an Arcane Spell takes only Arcane');
  assert.equal(damageOf(both, spell('decay')), 11, 'a Divine Spell takes only Divine');
  assert.equal(damageOf(both, spell(null)), 10, 'a schoolless Spell takes neither');
  assert.equal(damageOf([...both, rule('spell', 1)], spell(null)), 11, 'but still takes Spell bonuses');
});

test('the larger-of rule applies per field, to target hit bonuses and to hit riders', () => {
  const mixed = [rule('arcaneSpell', 2), rule('divineSpell', -1, 'manaCost')];
  const shared = ApplyGearCardRules(mixed, { ...spell('fire'), manaCost: 2 }, {});
  assert.equal(shared.effects[0].amount, 12, 'different fields both apply');
  assert.deepEqual(shared.gearManaRules, [{ mode: 'add', amount: -1 }]);
  const back = [{ name: 'target', arg: 'backRow' }];
  const adds = GearHitAdds([rule('arcaneSpell', 1, 'damage', back), rule('divineSpell', 3, 'damage', back), rule('spell', 1, 'damage', back)],
    spell('lightning'), { row: 'back' }, {});
  assert.equal(adds.damage, 4);
  const rider = (selector, stacks) => ({ selector, arg: null, conds: [], status: 'burn', stacks });
  assert.deepEqual(GearHitRiders([rider('arcaneSpell', 1), rider('divineSpell', 2)], spell('fire'), {}, {}).applies, [{ status: 'burn', stacks: 2 }]);
  assert.deepEqual(GearHitRiders([rider('arcaneSpell', 1), rider('divineSpell', 2)], spell('force'), {}, {}).applies, [{ status: 'burn', stacks: 1 }]);
});

test('item text names the new selectors, and a profile without spell traditions drops them', () => {
  const registries = createRegistries(contentBundle);
  assert.equal(GearModText(registries, 'arcaneSpell.cardDamage=+2'), 'Arcane spells: +2 Damage');
  assert.equal(GearModText(registries, 'divineSpell.cardDamage=+1'), 'Divine spells: +1 Damage');
  const piece = { id: 'category-probe', kind: 'weapon', mods: ['arcaneSpell.cardDamage=+2', 'spell.cardDamage=+1'] };
  const registry = { ...registries, equipment: { ...registries.equipment, armaments: [...registries.equipment.armaments, piece] } };
  const loadout = { sets: { rightHand: [piece.id] }, active: {} };
  const profile = traditions => ({ gameProfile: { modules: { gear: { typeEffectsVersion: 1 }, effects: { spellTraditionsVersion: traditions } } } });
  const selectors = subject => GearSummary(registry, loadout, 'starseer', subject).cardRules.filter(row => row.source === piece.id).map(row => row.selector);
  assert.deepEqual(selectors(profile(1)), ['arcaneSpell', 'spell']);
  assert.deepEqual(selectors(profile(0)), ['spell']);
});
