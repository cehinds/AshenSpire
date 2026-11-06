// The Armoury button reopens on the last menu: Character, Armory, or the Deck tab's editor.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { armouryReopenTarget, armouryRoute } from '../src/model/armouryPages.js';

test('the last tab is the one the Armoury reopens on', () => {
  assert.equal(armouryReopenTarget('grid'), 'grid');
  assert.equal(armouryReopenTarget('rack'), 'rack');
  assert.equal(armouryReopenTarget('deck', { deckDoor: true }), 'deck');
});

test('the Deck tab counts only while its door is open; nothing saved is the default page', () => {
  assert.equal(armouryReopenTarget('deck', { deckDoor: false }), 'rack');
  assert.equal(armouryReopenTarget(undefined), 'rack');
});

test('leaving by the Deck tab saves it', () => {
  const eq = readFileSync(new URL('../src/ui/screens/equipment.js', import.meta.url), 'utf8');
  assert.match(eq, /onEditDeck\) \{ onChange\?\.\(run\.loadout, \{ equipView: 'deck' \}\); leave\(\)/);
});

test('the real route: the HUD button (remembered) on a saved Deck tab opens the editor; no other caller does', () => {
  assert.equal(armouryRoute({ remembered: true }, { stored: 'deck', deckDoor: true }).open, 'deck');
  assert.equal(armouryRoute('', { stored: 'deck', deckDoor: true }).open, 'armoury', 'the reward screen\'s Edit equipment');
  assert.equal(armouryRoute({ equipItemId: 'x', remembered: true }, { stored: 'deck', deckDoor: true }).open, 'armoury', 'an explicit destination wins');
  assert.equal(armouryRoute({ remembered: true }, { stored: 'deck', deckDoor: false }).open, 'armoury', 'a closed deck door');
  assert.equal(armouryRoute('', { stored: 'grid', deckDoor: true }).open, 'armoury');
});

test('navigating out of the editor to Character / Armory is saved, so the next visit does not reopen on Deck', () => {
  const toCharacter = armouryRoute('grid', { stored: 'deck', deckDoor: true });
  assert.equal(toCharacter.open, 'armoury');
  assert.equal(toCharacter.saveView, 'grid');
  assert.equal(armouryRoute('rack', { stored: 'deck', deckDoor: true }).saveView, 'rack');
  assert.equal(armouryRoute('rack', { stored: 'rack', deckDoor: true }).saveView, '', 'nothing new to write');
  // The next visit, with what was just saved:
  assert.equal(armouryRoute({ remembered: true }, { stored: toCharacter.saveView, deckDoor: true }).open, 'armoury');
});

test('the retired \'cards\' id in an old save keeps opening the Armory page, never the editor', () => {
  assert.equal(armouryReopenTarget('cards', { deckDoor: true }), 'rack');
  assert.equal(armouryRoute({ remembered: true }, { stored: 'cards', deckDoor: true }).open, 'armoury');
});

test('only the HUD Armoury button sets the remembered flag', () => {
  const hud = readFileSync(new URL('../src/ui/components/runHud.js', import.meta.url), 'utf8');
  assert.equal((hud.match(/remembered: true/g) || []).length, 1);
  assert.match(hud, /armouryBtn\.addEventListener\('click'[^\n]*onArmoury\(\{ remembered: true \}\)/);
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.equal((main.match(/remembered: true/g) || []).length, 0, 'no other caller sets it');
});
