import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { renderCard } from '../src/ui/components/card.js';
import { applyCardTraits } from '../src/content/traitProjection.js';
import { applyCombatExpansionCard } from '../src/content/combatExpansionCards.js';
import { withKitDom } from './helpers/kit-dom.mjs';

// Every card view reads one face text: the shared cardFaceLines model, one <span class="face-line"> per line.
const reg = createRegistries(contentBundle);
const previewOf = cardId => ({ combatExpansionVersion: 2, cost: 1, manaCost: 0, tokens: {}, values: [],
  resolvedDefinition: applyCardTraits(applyCombatExpansionCard(reg.cards.get(cardId))) });

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

test('a card without a preview renders face lines starting with Inflict', () => withKitDom(dom => {
  const markup = trackInnerHtml(dom);
  const el = renderCard(reg, { cardId: 'bashingBlow' }, { inspection: false });
  const lines = faceLinesOf(markup.get(el));
  assert.ok(lines.length >= 1, 'at least one .face-line');
  assert.match(textOf(lines[0]), /^Inflict /);
}));

test('the same card with a preview gives the same line text when the numbers are equal', () => withKitDom(dom => {
  const markup = trackInnerHtml(dom);
  const plain = faceLinesOf(markup.get(renderCard(reg, { cardId: 'bashingBlow' }, { inspection: false })));
  const previewed = faceLinesOf(markup.get(renderCard(reg, { cardId: 'bashingBlow' },
    { inspection: false, preview: previewOf('bashingBlow') })));
  assert.deepEqual(previewed.map(textOf), plain.map(textOf));
}));

test('with faceLineLimit 3 a card with more than three lines marks lines 4+ data-face-extra', () => withKitDom(dom => {
  const markup = trackInnerHtml(dom);
  const cardId = reg.cards.all().map(card => card.id).find(id => {
    const el = renderCard(reg, { cardId: id }, { inspection: false });
    return faceLinesOf(markup.get(el)).length > 3;
  });
  assert.ok(cardId, 'a card with more than three face lines exists in content');
  const lines = faceLinesOf(markup.get(renderCard(reg, { cardId }, { inspection: false, faceLineLimit: 3 })));
  assert.ok(lines.length > 3);
  lines.forEach((line, i) => {
    if (i < 3) assert.doesNotMatch(line.attrs, /data-face-extra/, `line ${i + 1} stays visible`);
    else assert.match(line.attrs, /data-face-extra="true"/, `line ${i + 1} is marked extra`);
  });
}));

test('the hand hides detail lines until the card is selected; other views show them', () => withKitDom(dom => {
  const markup = trackInnerHtml(dom);
  const lines = opts => faceLinesOf(markup.get(renderCard(reg, { cardId: 'sanctuaryCleanse' }, { inspection: false, ...opts })));
  const detail = list => list.filter(line => /data-face-kind="detail"/.test(line.attrs));
  assert.ok(detail(lines({})).length && detail(lines({})).every(line => !/data-face-extra/.test(line.attrs)), 'a non-hand view shows Usable through');
  const hand = detail(lines({ faceLineLimit: 3 }));
  assert.ok(hand.length, 'the hand keeps the detail line for selection');
  assert.ok(hand.every(line => /data-face-extra="true"/.test(line.attrs)), 'and hides it at rest');
}));

test('a hit that is magic with a physical tag names only its leading type on the face', () => withKitDom(dom => {
  const markup = trackInnerHtml(dom);
  const lines = faceLinesOf(markup.get(renderCard(reg, { cardId: 'starSpark' }, { inspection: false, preview: previewOf('starSpark') })));
  assert.doesNotMatch(textOf(lines[0]), /·/);
}));

test('inspecting a hand card shows the full face, detail lines included', () => withKitDom(dom => {
  const markup = trackInnerHtml(dom);
  const src = renderCard.toString();
  assert.match(src, /level: 'inspect', faceLineLimit: undefined/, 'the inspect face does not inherit the hand limit');
  const kinds = faceLinesOf(markup.get(renderCard(reg, { cardId: 'sanctuaryCleanse' }, { inspection: false, level: 'inspect' })))
    .map(line => /data-face-kind="(\w+)"/.exec(line.attrs)[1]);
  assert.ok(kinds.includes('detail'));
}));

test('a combat face the shared model refuses shows the authored rules, not the looser summary', () => withKitDom(dom => {
  const markup = trackInnerHtml(dom);
  const html = markup.get(renderCard(reg, { cardId: 'shieldGuardian' }, { inspection: false, preview: previewOf('shieldGuardian') }));
  assert.doesNotMatch(html, /class="face-line"/);
  assert.doesNotMatch(html, /Add 1 Enter: Bulwark to hand/);
}));
