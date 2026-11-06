// The Armoury button reopens on the last menu: Character, Armory, or the Deck tab's editor.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { armouryReopenTarget } from '../src/model/armouryPages.js';

test('the last tab is the one the Armoury reopens on', () => {
  assert.equal(armouryReopenTarget('grid'), 'grid');
  assert.equal(armouryReopenTarget('rack'), 'rack');
  assert.equal(armouryReopenTarget('cards', { deckDoor: true }), 'deck');
});

test('the Deck tab counts only while its door is open; nothing saved is the default page', () => {
  assert.equal(armouryReopenTarget('cards', { deckDoor: false }), 'rack');
  assert.equal(armouryReopenTarget(undefined), 'rack');
});

test('leaving by the Deck tab saves it, and the button routes on it', () => {
  const eq = readFileSync(new URL('../src/ui/screens/equipment.js', import.meta.url), 'utf8');
  assert.match(eq, /onEditDeck\) \{ onChange\?\.\(run\.loadout, \{ equipView: 'cards' \}\); leave\(\)/);
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /armouryReopenTarget\(armouryMeta\.settings\.equipView, \{ deckDoor: deckDoors\(\)\.armoury \}\) === 'deck'\) \{\s*showDeckEditor\(returnTo, true\)/);
});
