// Playtest 2026-11-17 (item 32): the smash icon is the hammer the blunt, heavy and Poise marks already use, on the
// combat intent, the card footer action and the card's smash tag alike.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTION_SIGILS } from '../src/content/combatSigils.js';
import { CARD_COMPONENTS } from '../src/content/cardComponents.generated.js';

const HAMMER = '<path d="M5 2h22v12H5Zm8 14h6v15h-6Z"/>';

test('every smash mark is the hammer', () => {
  const symbols = CARD_COMPONENTS.template.symbols;
  assert.equal(symbols.tags.blunt.svg.body, HAMMER, 'the hammer is the existing blunt mark');
  assert.equal(ACTION_SIGILS.smash.shape, HAMMER);
  assert.equal(symbols.actions.smash.svg.body, HAMMER);
  assert.equal(symbols.tags.smash.svg.body, HAMMER);
});
