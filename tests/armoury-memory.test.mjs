// The Armoury button reopens on the last menu: Character, Armory, or the Deck tab's editor.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { armouryReopenTarget, armouryRoute } from '../src/model/armouryPages.js';

test('the last tab is the one the Armoury reopens on', () => {
  assert.equal(armouryReopenTarget('grid'), 'grid');
  assert.equal(armouryReopenTarget('rack'), 'rack');
  assert.equal(armouryReopenTarget('cards', { deckDoor: true }), 'deck');
});

test('the Deck tab counts only while its door is open; nothing saved is the default page', () => {
  assert.equal(armouryReopenTarget('cards', { deckDoor: false }), 'rack');
  assert.equal(armouryReopenTarget(undefined), 'rack');
});

test('leaving by the Deck tab saves it', () => {
  const eq = readFileSync(new URL('../src/ui/screens/equipment.js', import.meta.url), 'utf8');
  assert.match(eq, /onEditDeck\) \{ onChange\?\.\(run\.loadout, \{ equipView: 'cards' \}\); leave\(\)/);
});

test('the real route: no request on a saved Deck tab opens the editor', () => {
  assert.equal(armouryRoute('', { stored: 'cards', deckDoor: true }).open, 'deck');
  assert.equal(armouryRoute('', { stored: 'grid', deckDoor: true }).open, 'armoury');
});

test('navigating out of the editor to Character / Armory is saved, so the next visit does not reopen on Deck', () => {
  const toCharacter = armouryRoute('grid', { stored: 'cards', deckDoor: true });
  assert.equal(toCharacter.open, 'armoury');
  assert.equal(toCharacter.saveView, 'grid');
  assert.equal(armouryRoute('rack', { stored: 'cards', deckDoor: true }).saveView, 'rack');
  assert.equal(armouryRoute('rack', { stored: 'rack', deckDoor: true }).saveView, '', 'nothing new to write');
  // The next visit, with what was just saved:
  assert.equal(armouryRoute('', { stored: toCharacter.saveView, deckDoor: true }).open, 'armoury');
});
