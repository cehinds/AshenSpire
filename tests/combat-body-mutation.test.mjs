import test from 'node:test';
import assert from 'node:assert/strict';
import { combatantBodyMutation } from '../src/ui/components/battlefieldStage.js';

const change = (attributeName, oldValue, value, body = true) => ({
  attributeName, oldValue, target: { getAttribute: () => value, matches: () => body },
});

test('stationary selection, arming and target highlights do not restart body tracking', () => {
  for (const name of ['target-hud-selected', 'target-hud-focused', 'target-hud-candidate',
    'armed', 'skill-selected', 'targetable', 'hover-target', 'gp-focus']) {
    assert.equal(combatantBodyMutation(change('class', 'combatant enemy', `combatant enemy ${name}`)), false, name);
    assert.equal(combatantBodyMutation(change('class', `combatant enemy ${name}`, 'combatant enemy')), false, `${name} removed`);
  }
  assert.equal(combatantBodyMutation(change('class', 'sprite enemy', 'enemy sprite')), false, 'class order is not motion');
  assert.equal(combatantBodyMutation(change('class', 'intent', 'intent expanded', false)), false, 'HUD descendants do not move the body');
});

test('inspection preserves legacy enlargement but does not track detailed-HUD tint', () => {
  const selected = change('class', 'combatant', 'combatant context-selected');
  assert.equal(combatantBodyMutation(selected, false), true);
  assert.equal(combatantBodyMutation(selected, true), false);
});

test('stance images, action motion, reactions and unknown body classes retain tracking', () => {
  for (const attribute of ['src', 'data-pose', 'data-rest', 'data-stance', 'data-animating']) {
    assert.equal(combatantBodyMutation(change(attribute, 'old', 'new'), true), true, attribute);
    assert.equal(combatantBodyMutation(change(attribute, 'same', 'same'), true), false, `${attribute} unchanged`);
  }
  for (const name of ['act-attack', 'hit-stop', 'hit-heavy', 'defeated', 'future-body-animation']) {
    assert.equal(combatantBodyMutation(change('class', 'sprite', `sprite target-hud-focused ${name}`), true), true, name);
  }
});
