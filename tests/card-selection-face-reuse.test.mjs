import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { renderCard, setHandFaceBudget, cardDetailHtml } from '../src/ui/components/card.js';
import { clearSelection } from '../src/ui/components/cardSelection.js';
import { mountHand } from '../src/ui/components/hand.js';
import { applyCardArtStyle } from '../src/ui/cardArtStyle.js';
import { withModalDom } from './helpers/modal-dom.mjs';

const registries = createRegistries(contentBundle);

test('selecting and dousing retain face, artwork, tag and input nodes while updating level', () => withModalDom(() => {
  clearSelection();
  const card = renderCard(registries, { cardId: 'bashingBlow', instanceId: 'reuse' }, { faceLineLimit: 3 });
  document.body.append(card);
  const face = card.querySelector('.illustrated-card-face');
  const art = card.querySelector('.playing-card-art');
  const tag = card.querySelector('[data-tag-id]');
  assert.ok(face && art && tag);
  const input = document.createElement('button');
  let presses = 0;
  input.addEventListener('click', () => presses++);
  card.append(input);
  const rules = card.querySelector('.ic-text[data-face-lines="true"]');
  assert.ok(rules);

  card.dispatchEvent(new CustomEvent('cardholdstart'));
  setHandFaceBudget(card, true);
  assert.equal(card.dataset.level, 'focus');
  assert.equal(rules.dataset.maxLines, '3', 'selected ordinary effects keep the same physical line budget');
  assert.ok(rules.querySelectorAll('.face-line').length <= 2);
  assert.equal(card.querySelector('.illustrated-card-face'), face);
  assert.equal(card.querySelector('.playing-card-art'), art);
  assert.equal(card.querySelector('[data-tag-id]'), tag);
  assert.equal(input.parentNode, card);
  input.dispatchEvent(new Event('click'));
  assert.equal(presses, 1);

  clearSelection();
  setHandFaceBudget(card, false);
  assert.equal(card.dataset.level, 'glance');
  assert.equal(rules.dataset.maxLines, '3');
  assert.equal(card.querySelector('.illustrated-card-face'), face);
  assert.equal(card.querySelector('.playing-card-art'), art);
  assert.equal(card.querySelector('[data-tag-id]'), tag);
  input.dispatchEvent(new Event('click'));
  assert.equal(presses, 2);
}));

test('inspection keeps the bounded face and complete Information while artwork refresh still repaints', () => withModalDom(() => {
  clearSelection();
  applyCardArtStyle({});
  const card = renderCard(registries, { cardId: 'bashingBlow' }, { faceLineLimit: 3 });
  const full = renderCard(registries, { cardId: 'bashingBlow' }, { inspection: false, level: 'inspect' });
  document.body.append(card, full);
  assert.equal(card.querySelector('.illustrated-card-face').dataset.fullRules, 'false');
  assert.equal(full.querySelector('.illustrated-card-face').dataset.fullRules, 'false');
  assert.equal(full.dataset.level, 'inspect');
  assert.equal(full.querySelector('.ic-text[data-face-lines="true"]').dataset.maxLines, '3');
  assert.equal(full.querySelectorAll('.face-line').length, card.querySelectorAll('.face-line').length);
  assert.ok(full.querySelectorAll('.face-line').length <= 2);
  assert.match(cardDetailHtml(registries, { cardId: 'bashingBlow' }).replace(/<[^>]*>/g, ''), /Deal 13 damage and 7 Poise damage\./, 'Information retains the full authored effect');
  const oldFace = card.querySelector('.illustrated-card-face');
  applyCardArtStyle({ cardArtStyle: 'Legacy' });
  assert.notEqual(card.querySelector('.illustrated-card-face'), oldFace);
  applyCardArtStyle({});
}));

test('hand preview changes replace the card, keep its face nodes and print the fresh values', () => withModalDom(() => {
  clearSelection();
  document.documentElement = document.body;
  // The fixture parses elements but drops text nodes; retain the actual markup
  // assigned by the renderer so the changed preview must print its new number.
  const prototype = Object.getPrototypeOf(document.body);
  const html = Object.getOwnPropertyDescriptor(prototype, 'innerHTML');
  const markup = new WeakMap();
  Object.defineProperty(prototype, 'innerHTML', { configurable: true,
    set(value) { markup.set(this, value); html.set.call(this, value); } });
  const hand = document.createElement('div');
  hand.className = 'hand';
  document.body.append(hand);
  let released = 0;
  const strip = mountHand(hand, { registries, reuseCards: true, inspectHold: false,
    wireCard: () => () => released++ });
  const entry = { inst: { cardId: 'bashingBlow', instanceId: 'live' }, affordable: true,
    preview: { cost: 1, manaCost: 0, staminaCost: 1, tokens: { damage: 4 } } };
  strip.render({ cards: [entry] });
  const before = hand.children[0];
  const oldFace = before.querySelector('.illustrated-card-face');
  assert.match(markup.get(before).replace(/<[^>]*>/g, ''), /Deal 4 Blunt damage/);
  strip.render({ cards: [{ ...entry, selected: true }] });
  assert.equal(hand.children[0], before, 'selection alone retains the mounted hand card');
  strip.render({ cards: [{ ...entry, preview: { ...entry.preview, cost: 3, tokens: { damage: 42 } } }] });
  const after = hand.children[0];
  assert.notEqual(after, before, 'a different live preview still replaces the hand record');
  // The card (its inputs, its door) is new; its face is the old one with the changed rows rewritten.
  assert.equal(after.querySelector('.illustrated-card-face'), oldFace);
  assert.equal(released, 1, 'old play input is released exactly once');
  assert.match(markup.get(after.querySelector('.ic-text[data-card-binding="rules"]')).replace(/<[^>]*>/g, ''), /Deal 42 Blunt damage/,
    'updated damage reaches the rewritten rules row');
  strip.teardown();
}));
