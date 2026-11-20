import test from 'node:test';
import assert from 'node:assert/strict';
import { withKitDom } from './helpers/dom.mjs';
import { openShopCardChoice, openShopArmamentChoice } from '../src/ui/components/shopBuyChoice.js';

test('a bought card offers optional deck editing even when Add to deck is full', () => withKitDom(() => {
  let edits = 0, adds = 0, keeps = 0;
  const choice = openShopCardChoice({ name: 'Bought card', refusal: 'Deck is full',
    onDeck: () => adds++, onLibrary: () => keeps++, onEditDeck: () => edits++ });
  assert.equal(document.querySelector('#shop-buy-primary').disabled, true);
  assert.ok([...document.querySelectorAll('.shop-buy-choice p')].some(node => node.textContent.includes('Bought card')));
  const edit = document.querySelector('#shop-buy-edit-deck');
  assert.ok(edit && !edit.disabled);
  edit.click(); edit.click();
  assert.equal(edits, 1, 'a repeated activation cannot open another editor');
  assert.equal(adds, 0); assert.equal(keeps, 0);
  choice.close();
}));

test('keeping or dismissing a bought card never opens the editor', () => withKitDom(() => {
  let edits = 0, keeps = 0;
  openShopCardChoice({ name: 'First', onDeck() {}, onLibrary: () => keeps++, onEditDeck: () => edits++ });
  document.querySelector('#shop-buy-keep').click();
  const next = openShopCardChoice({ name: 'Second', onDeck() {}, onLibrary: () => keeps++, onEditDeck: () => edits++ });
  next.close();
  assert.equal(keeps, 2); assert.equal(edits, 0);
}));

test('armament purchases and hosts without deck editing have no Edit deck choice', () => withKitDom(() => {
  const card = openShopCardChoice({ name: 'Card', onDeck() {}, onLibrary() {} });
  assert.equal(document.querySelector('#shop-buy-edit-deck'), null); card.close();
  const armament = openShopArmamentChoice({ name: 'Sword', onEquip() {}, onKeep() {} });
  assert.equal(document.querySelector('#shop-buy-edit-deck'), null); armament.close();
}));
