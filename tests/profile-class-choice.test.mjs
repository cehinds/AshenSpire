import test from 'node:test';
import assert from 'node:assert/strict';
import { profileClassChoiceIds } from '../src/ui/models/ProfileClassChoiceModel.js';

const classes = ['reaver', 'starseer', 'rogue', 'herald'];
const rules = { initial: ['reaver'], sequence: ['starseer', 'rogue', 'herald'] };

test('progressive profile class choices reveal only the next locked class', () => {
  for (let completedRuns = 0; completedRuns <= 3; completedRuns += 1) {
    const available = new Set([...rules.initial, ...rules.sequence.slice(0, completedRuns)]);
    const expected = [...rules.initial, ...rules.sequence.slice(0, Math.min(3, completedRuns + 1))];
    assert.deepEqual(profileClassChoiceIds(classes, rules, id => available.has(id)), expected);
  }
});

test('progressive choices retain the supplied list when a profile has no ordered rules', () => {
  assert.deepEqual(profileClassChoiceIds(classes, null, () => false), classes);
});
