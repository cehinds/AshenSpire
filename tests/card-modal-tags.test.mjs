// tests/card-modal-tags.test.mjs - the card details' chips and inline effect text.
//
// 1. One chip per distinct tag. A spell card authors camp:spell, source:spell and
//    maneuver:casting, three ids that all read "Spell"; it used to print
//    "Spell Spell Spell" because only byte-identical markup was deduped.
// 2. Effect tags (keywords, applied statuses) also list their tooltip text inline
//    under the chips, from the same term the tooltip shows. Card type, stance
//    and element tags stay tooltip-only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { cardDetailHtml } from '../src/ui/components/card.js';
import { withKitDom } from './helpers/kit-dom.mjs';

const registries = createRegistries(contentBundle);
const decode = (text) => text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'");
const chips = (html) => [...html.matchAll(/<span class="inspection-tag[^"]*"[^>]*>([^<]*)<\/span>/g)].map((m) => decode(m[1]));
const inline = (html) => {
  const dl = /<dl class="inspection-effect-tags">([\s\S]*?)<\/dl>/.exec(html)?.[1] || '';
  return [...dl.matchAll(/<dt>([^<]*)<\/dt><dd>([^<]*)<\/dd>/g)].map((m) => [decode(m[1]), decode(m[2])]);
};

test('a spell card shows one Spell chip, and no label repeats', () => withKitDom(() => {
  const html = cardDetailHtml(registries, { cardId: 'cometFragment' });
  const labels = chips(html);
  assert.equal(labels.filter((label) => label === 'Spell').length, 1, `Spell once, got ${labels.join(', ')}`);
  assert.equal(new Set(labels.map((label) => label.toLowerCase())).size, labels.length, `no repeats in ${labels.join(', ')}`);
}));

test('every card in the bundle lists each chip label once', () => withKitDom(() => {
  for (const card of contentBundle.cards) {
    const labels = chips(cardDetailHtml(registries, { cardId: card.id })).map((label) => label.toLowerCase());
    assert.equal(new Set(labels).size, labels.length, `${card.id}: ${labels.join(', ')}`);
  }
}));

test('effect tags list their tooltip text inline; type, stance and element tags do not', () => withKitDom(() => {
  const card = contentBundle.cards.find((c) => (c.keywords || []).length && registries.framework.keywordDisplay(c.keywords[0]));
  assert.ok(card, 'a card with an effect keyword');
  const html = cardDetailHtml(registries, { cardId: card.id });
  const listed = inline(html);
  const kw = registries.framework.keywordDisplay(card.keywords[0]);
  const row = listed.find(([label]) => label === kw.name);
  assert.ok(row, `${kw.name} is listed inline`);
  assert.equal(row[1], kw.tooltip, 'the inline text is the tooltip text');
  const typeLike = new Set(['Physical', 'Spell', 'Attack', 'Defend', 'Counter', 'Sweep', 'Ranged', 'Smash', 'Cantrip',
    'Melee', 'Reach', 'Frost', 'Fire', 'Lightning', 'Force', 'Alteration', 'Illusion', 'Divine', 'Decay']);
  for (const [label] of listed) assert.ok(!typeLike.has(label), `${label} stays tooltip-only`);
}));

test('a card with only type and element tags has no inline effect list', () => withKitDom(() => {
  const html = cardDetailHtml(registries, { cardId: 'cometFragment' });
  assert.doesNotMatch(html, /inspection-effect-tags/);
}));

test('key effect text leads; common type/school explanations and chips follow', () => withKitDom(() => {
  const html = cardDetailHtml(registries, { cardId: 'crystalBarrier' });
  const at = (needle) => html.indexOf(needle);
  assert.ok(at('class="ctext"') > 0 && at('inspection-effect-tags') > 0 && at('inspection-sigils') > 0 && at('class="inspection-tags"') > 0);
  assert.ok(at('class="ctext"') < at('inspection-effect-tags'), 'effect line before effect-tag definitions');
  assert.ok(at('inspection-effect-tags') < at('inspection-sigils'), 'key tags before common tags');
  assert.ok(at('inspection-sigils') < at('class="inspection-tags"'), 'common tags before chips');
}));

test('every inline effect text is exactly a keyword or status tooltip, never a tag blurb', async () => {
  const { tags } = await import('../src/content/generated/tags.js');
  const blurbs = [...new Set(tags.map((t) => t.blurb).filter((b) => b && b.length > 20))];
  withKitDom(() => {
    let seen = 0;
    for (const card of contentBundle.cards) {
      for (const [label, text] of inline(cardDetailHtml(registries, { cardId: card.id }))) {
        seen++;
        const kw = (card.keywords || []).map((id) => registries.framework.keywordDisplay(id)).find((d) => d && d.name === label);
        if (kw) assert.equal(text, kw.tooltip, `${card.id} ${label}`);
        for (const blurb of blurbs) assert.ok(!text.includes(blurb), `${card.id} ${label} leaks tag text: ${blurb}`);
      }
    }
    assert.ok(seen > 0);
  });
});
