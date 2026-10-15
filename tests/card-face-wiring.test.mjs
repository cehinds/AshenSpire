import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { renderCard, cardDetailHtml, setHandFaceBudget } from '../src/ui/components/card.js';
import { applyCardTraits } from '../src/content/traitProjection.js';
import { applyCombatExpansionCard } from '../src/content/combatExpansionCards.js';
import { withKitDom } from './helpers/kit-dom.mjs';

// Every ordinary face uses the same bounded projection; Information stays complete.
const reg = createRegistries(contentBundle);
const previewOf = cardId => ({ combatExpansionVersion: 2, cost: 1, manaCost: 0, tokens: {}, values: [],
  // The card the engine plays: resolved (action costs derived, SPEC §4.3a), then projected for combat.
  resolvedDefinition: applyCardTraits(applyCombatExpansionCard(resolveCard(reg, { cardId }))) });

// Each face line as { attrs, html } read from the rendered markup. A line runs to the next
// face-line span, or to the end of the rules text div for the last one.
function faceLinesOf(html) {
  return html.split('<span class="face-line"').slice(1).map(part => {
    const open = part.indexOf('>');
    const body = part.slice(open + 1).split('</div>')[0].replace(/<\/span>$/, '');
    return { attrs: part.slice(0, open), html: body };
  });
}
const textOf = line => line.html.replace(/<[^>]+>/g, '');

// Records the markup each element is given, the way the other renderCard tests do.
function trackInnerHtml(dom) {
  const prototype = Object.getPrototypeOf(dom.document.body);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'innerHTML');
  const markup = new WeakMap();
  Object.defineProperty(prototype, 'innerHTML', { configurable: true,
    set(value) { markup.set(this, value); descriptor.set.call(this, value); } });
  return markup;
}

test('a card without a preview renders whole clauses starting with Deal', () => withKitDom(dom => {
  const markup = trackInnerHtml(dom);
  const el = renderCard(reg, { cardId: 'bashingBlow' }, { inspection: false });
  const lines = faceLinesOf(markup.get(el));
  assert.ok(lines.length >= 1, 'at least one .face-line');
  assert.match(textOf(lines[0]), /^Deal /);
  assert.ok(lines.every(line => !textOf(line).startsWith(';')), 'separators never lead a wrapped clause');
  assert.ok(lines.every(line => textOf(line).trimEnd().endsWith('.')), 'periods stay attached to the preceding clause');
}));

test('the same card with a preview gives the same line text when the numbers are equal', () => withKitDom(dom => {
  const markup = trackInnerHtml(dom);
  const plain = faceLinesOf(markup.get(renderCard(reg, { cardId: 'bashingBlow' },
    { inspection: false, rules: { combatExpansionVersion: 2 }, definition: previewOf('bashingBlow').resolvedDefinition })));
  const previewed = faceLinesOf(markup.get(renderCard(reg, { cardId: 'bashingBlow' },
    { inspection: false, preview: previewOf('bashingBlow') })));
  assert.deepEqual(previewed.map(textOf), plain.map(textOf));
}));

test('all authored faces keep at most two clauses even with a legacy hand limit', () => withKitDom(dom => {
  const markup = trackInnerHtml(dom);
  for (const card of reg.cards.all()) {
    const html = markup.get(renderCard(reg, { cardId: card.id }, { inspection: false, faceLineLimit: 3 }));
    const lines = faceLinesOf(html);
    assert.ok(lines.length >= 1 && lines.length <= 2, card.id);
    assert.doesNotMatch(html, /data-face-extra/, card.id);
    assert.match(html, /data-max-lines="3" data-face-lines="true"/, card.id);
  }
}));

test('hand and catalogue share the same concise clauses; secondary details remain in Information', () => withKitDom(dom => {
  const markup = trackInnerHtml(dom);
  const lines = opts => faceLinesOf(markup.get(renderCard(reg, { cardId: 'sanctuaryCleanse' }, { inspection: false, ...opts })));
  assert.deepEqual(lines({}).map(textOf), lines({ faceLineLimit: 3 }).map(textOf));
  assert.ok(lines({}).every(line => !/Usable through/.test(textOf(line))));
  assert.match(cardDetailHtml(reg, { cardId: 'sanctuaryCleanse' }), /Sleep/);
}));

test('a hit that is magic with a physical tag names only its leading type on the face', () => withKitDom(dom => {
  const markup = trackInnerHtml(dom);
  const lines = faceLinesOf(markup.get(renderCard(reg, { cardId: 'starSpark' }, { inspection: false, preview: previewOf('starSpark') })));
  assert.doesNotMatch(textOf(lines[0]), /·/);
}));

test('enlarged faces retain the same budget and selection never permits five lines', () => withKitDom(dom => {
  const markup = trackInnerHtml(dom);
  const ref = { cardId: 'sanctuaryCleanse' };
  const normal = renderCard(reg, ref, { inspection: false });
  const enlarged = renderCard(reg, ref, { inspection: false, level: 'inspect' });
  assert.deepEqual(faceLinesOf(markup.get(normal)).map(textOf), faceLinesOf(markup.get(enlarged)).map(textOf));
  const rules = { dataset: {} }, host = { querySelector: () => rules };
  setHandFaceBudget(host, false); assert.equal(rules.dataset.maxLines, '3');
  setHandFaceBudget(host, true); assert.equal(rules.dataset.maxLines, '3');
}));

test('complex fallback cards also use bounded whole authored clauses', () => withKitDom(dom => {
  const markup = trackInnerHtml(dom);
  const html = markup.get(renderCard(reg, { cardId: 'shieldGuardian' }, { inspection: false, preview: previewOf('shieldGuardian') }));
  assert.match(html, /class="face-line"/);
  assert.ok(faceLinesOf(html).length <= 2);
  assert.doesNotMatch(html, /Add 1 Enter: Bulwark to hand/);
}));
