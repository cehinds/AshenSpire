import test from 'node:test';
import assert from 'node:assert/strict';
import { cardTagExplanation } from '../src/model/cardTagExplanation.js';

test('version-two defensive tag help names the attributes that strengthen Block and Ward and card-specific counter coverage', () => {
  const def = { defenseRulesVersion: 2, counterCoverage: { camps: ['physical'], ranges: ['melee','reach','ranged'], targeting: ['single'] } };
  // Owner 2026-11-18 (ruling §8): AR/DR/PR are removed; the help names DEX for Block and INT or WIS for Ward.
  assert.match(cardTagExplanation(def, { id: 'maneuver:defend' }), /Block.*Ward.*DEX.*Block.*INT or WIS.*Ward/);
  const help = cardTagExplanation(def, { id: 'counter:spell' });
  assert.match(help, /Physical.*Melee.*Reach.*Ranged.*Single/);
  assert.doesNotMatch(help, /incoming physical ranged moves or spells/);
  assert.equal(cardTagExplanation({}, { id: 'maneuver:defend', blurb: 'legacy' }), 'legacy');
  assert.match(cardTagExplanation({ ...def, evade: {} }, { id: 'maneuver:counter' }), /^Counter stance with Evade/);
});
