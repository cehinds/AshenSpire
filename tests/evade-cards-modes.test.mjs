// Owner, 2026-11-15 (W25-EvadeCards): a card may carry named modes picked at play, and a self Advance steps the owner in.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cardChoice, assertCardChoice, CardModeEffects } from '../src/model/cardChoices.js';
import { validateEffects } from '../src/model/validate/effectGrammar.js';
import { registries } from './helpers/bands-fight.mjs';

const modes = [{ id: 'advance', name: 'Advance', tooltip: 'Step in.' }, { id: 'retreat', name: 'Retreat', tooltip: 'Step back.' }];
const def = {
  id: 'test.modes', choiceModes: modes,
  effects: [
    { op: 'block', target: 'self', amount: 2 },
    { op: 'moveEngagement', target: 'self', bands: -1, mode: 'advance' },
    { op: 'moveEngagement', target: 'self', bands: 1, mode: 'retreat' },
  ],
};

test('a card with modes offers one option per mode and refuses a play without a legal pick', () => {
  const plan = cardChoice(registries, def, 'reaver');
  assert.equal(plan.kind, 'mode');
  assert.deepEqual(plan.options.map(o => o.id), ['advance', 'retreat']);
  assert.equal(assertCardChoice(plan, 'retreat'), 'retreat');
  assert.equal(assertCardChoice(plan, null), 'advance', 'no pick plays the first mode');
  assert.throws(() => assertCardChoice(plan, 'swim'), /Choose one/);
  assert.equal(cardChoice(registries, { id: 'plain', effects: [] }, 'reaver'), null);
});

test('only the chosen mode and the unmoded effects play', () => {
  assert.deepEqual(CardModeEffects(def, 'advance').effects.map(e => e.mode ?? e.op), ['block', 'advance']);
  assert.deepEqual(CardModeEffects(def, 'retreat').effects.map(e => e.mode ?? e.op), ['block', 'retreat']);
  const plain = { id: 'plain', effects: [{ op: 'block', target: 'self', amount: 1 }] };
  assert.equal(CardModeEffects(plain, 'x'), plain);
});

test('the validator accepts a self Advance and a mode field, and still refuses a self move of 2', () => {
  const problems = effects => { const out = []; validateEffects(effects, 'c', { ids: {}, nodeIds: new Set(), err: (path, message) => out.push(message), errors: out, warn() {} }); return out; };
  assert.doesNotMatch(problems(def.effects).join('|'), /moveEngagement|mode/);
  assert.match(problems([{ op: 'moveEngagement', target: 'self', bands: 2 }]).join('|'), /moveEngagement/);
});
