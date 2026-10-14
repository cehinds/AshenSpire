import test from 'node:test';
import assert from 'node:assert/strict';
import { cardTagExplanation } from '../src/model/cardTagExplanation.js';

test('version-two defensive tag help describes both ratings and card-specific counter coverage', () => {
  const def = { defenseRulesVersion: 2, counterCoverage: { camps: ['physical'], ranges: ['melee','reach','ranged'], targeting: ['single'] } };
  assert.match(cardTagExplanation(def, { id: 'maneuver:defend' }), /Block.*Ward.*DR.*PR/);
  const help = cardTagExplanation(def, { id: 'counter:spell' });
  assert.match(help, /Physical.*Melee.*Reach.*Ranged.*Single/);
  assert.doesNotMatch(help, /incoming physical ranged moves or spells/);
  assert.equal(cardTagExplanation({}, { id: 'maneuver:defend', blurb: 'legacy' }), 'legacy');
  assert.match(cardTagExplanation({ ...def, evade: {} }, { id: 'maneuver:counter' }), /^Evade stance/);
});
