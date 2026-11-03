import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { playingCardModel } from '../src/model/playingCard.js';
import { illustratedCardHtml } from '../src/ui/components/illustratedCard.js';
import { withKitDom } from './helpers/kit-dom.mjs';
import { renderCard } from '../src/ui/components/card.js';
import { clearSelection } from '../src/ui/components/cardSelection.js';
import { el } from '../src/ui/kit/index.js';
import { arrangeMerchantOffer } from '../src/ui/components/merchantOffer.js';

// Owner 2026-11-03: "inspect is still on the cards ... it's just written in
// white text instead". #2501 removed the CSS for `.card-rules-inspect-cue`
// but the span stayed in the face markup, so every card printed "Inspect card"
// in unstyled cream text. No card face may carry a word that is not the card's.
const reg = createRegistries(contentBundle);
const visibleText = html => html.replace(/<(script|style)[\s\S]*?<\/\1>/g, '').replace(/<[^>]+>/g, ' ');

test('a card face prints no Inspect text, with or without rules', () => {
  for (const cardId of ['strike', 'defend', 'bashingBlow']) {
    for (const rules of ['', '<span class="face-line" data-face-clause="0">Deal 6.</span>']) {
      const html = illustratedCardHtml(playingCardModel(reg, { cardId }), { rules });
      assert.doesNotMatch(visibleText(html), /inspect/i, `${cardId} face text`);
      assert.doesNotMatch(html, /inspect-cue/, `${cardId} face has no cue element`);
    }
  }
});

test('a shop offer thumbnail names Inspect for assistive tech only, never as printed text', () => withKitDom(({ document }) => {
  const tile = el('div', { class: 'class-pick' }, el('div', { class: 'cp-body' }, el('h3', { text: 'Whetstone' })));
  document.body.append(tile);
  arrangeMerchantOffer({ tile, name: 'Whetstone', desc: 'Sharpens.', price: '12 Cinders', avail: { available: true },
    action: { kind: 'buy', label: 'Buy', enabled: true } });
  const thumb = tile.querySelector('.merchant-thumbnail');
  assert.equal(thumb.getAttribute('aria-label'), 'Inspect Whetstone');
  assert.doesNotMatch(thumb.textContent, /inspect/i);
}));

// A combat-hand card is renderCard's default (inspection on, not read-only).
// withKitDom's globals plus the two calls the modal shell makes on the document.
function withGlobalDom(fn) {
  const { dom, globals } = withKitDom((dom, globals) => ({ dom, globals }));
  const saved = Object.fromEntries(Object.keys(globals).map(key => [key, globalThis[key]]));
  Object.assign(globalThis, globals);
  dom.document.documentElement = dom.document.body;
  dom.document.getSelection = () => null;
  try { return fn(dom); } finally {
    clearSelection();
    for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
}

test('a rendered card has no (i) badge and no Inspect text, and a right-click or I opens its reading', () => withGlobalDom(() => {
  const card = renderCard(reg, { cardId: 'strike' }, {});
  document.body.append(card);
  const words = node => [node.textContent || '', ...(node.children || []).map(words)].join(' ');
  assert.equal(card.querySelector('.card-info-button'), null, 'no (i) badge');
  assert.doesNotMatch(words(card), /inspect/i, 'no printed Inspect word anywhere on the card');
  assert.equal(card.getAttribute('aria-keyshortcuts'), 'I', 'the key that reads it is exposed to assistive tech');
  card.dispatchEvent(new Event('contextmenu', { cancelable: true }));
  assert.ok(document.querySelector('.card-inspection-modal'), 'right-click opens the shared inspector');
  document.querySelector('.card-inspection-modal .modal-close').click();
  assert.equal(document.querySelector('.card-inspection-modal'), null);
  card.dispatchEvent(new Event('keydown', { key: 'i', target: card, cancelable: true }));
  assert.ok(document.querySelector('.card-inspection-modal'), 'the I key opens it too');
}));
