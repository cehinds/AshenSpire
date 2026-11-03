import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { playingCardModel } from '../src/model/playingCard.js';
import { illustratedCardHtml } from '../src/ui/components/illustratedCard.js';
import { withKitDom } from './helpers/kit-dom.mjs';
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
