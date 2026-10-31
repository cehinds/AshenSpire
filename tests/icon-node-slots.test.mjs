import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withKitDom } from './helpers/kit-dom.mjs';
import { chip, meter, el, glyph } from '../src/ui/kit/index.js';
import { arrangeMerchantOffer } from '../src/ui/components/merchantOffer.js';

test('Core no-face merchant rows draw category vector art and retain row identity/actions', () => withKitDom(({ document }) => {
  for (const [name, fallback] of [['Lost Letter', 'dexterity'], ['A quiet room', 'progression'], ['Upgrade an item', 'smith']]) {
    // This is shopItem's text-only shape: no image, card or .glyph face.
    const tile = el('div', { class: 'class-pick shop-text-offer' }, el('div', { class: 'cp-body' }, el('h3', { text: name })));
    document.body.append(tile);
    const action = arrangeMerchantOffer({ tile, name, desc: 'Available here.', price: '12 Cinders', avail: { available: true },
      action: { kind: 'buy', label: 'Buy', enabled: true } }, { fallback });
    const face = tile.querySelector('.merchant-offer-glyph');
    assert.ok(face, 'the no-face path preserves its styled thumbnail wrapper');
    assert.equal(face.getAttribute('aria-hidden'), 'true');
    assert.equal(face.querySelector('.engraved-icon')?.dataset.engravedIcon, fallback);
    assert.notEqual(face.textContent, fallback, 'the internal category ID is not printed');
    assert.equal(tile.querySelector('h3').textContent, name);
    assert.equal(action.dataset.shopAction, 'buy');
    assert.equal(action.getAttribute('aria-label'), `${name}: Buy`);
    assert.equal(tile.querySelector('.merchant-thumbnail').getAttribute('aria-label'), `Inspect ${name}`);
  }
}));

test('Meter preserves zero/string text and explicit numeric semantics while accepting a value node', () => withKitDom(() => {
  const zero = meter({ label: 'HP', value: 0, cur: 0, max: 10, pct: 0 });
  assert.equal(zero.querySelector('.m-value').textContent, '0');
  assert.equal(zero.querySelector('.m-track').getAttribute('aria-label'), 'HP 0 of 10');
  assert.equal(meter({ value: 'Ready' }).querySelector('.m-value').textContent, 'Ready');
  const icon = glyph('bleed'), node = meter({ valueNode: icon, cur: 2, max: 7, ariaLabel: 'Bleed 2 of 7' });
  assert.equal(node.querySelector('.m-value').children[0], icon, 'the original node is retained');
  assert.equal(node.querySelector('.engraved-icon')?.dataset.engravedIcon, 'bleed');
  assert.equal(node.querySelector('.m-track').getAttribute('aria-label'), 'Bleed 2 of 7');
  assert.equal(node.querySelector('.m-track').dataset.cur, '2');
  assert.equal(meter().querySelector('.m-plate'), null, 'an empty ordinary meter stays empty');
}));

test('Chip preserves ordinary key/value text and mounts an explicit key node without guessing strings', () => withKitDom(() => {
  const ordinary = chip({ key: 'skill', value: 0 });
  assert.equal(ordinary.querySelector('.ck').textContent, 'skill', 'ordinary strings are never auto-interpreted as IDs');
  assert.equal(ordinary.querySelector('.cv').textContent, '0');
  const icon = glyph('actions'), node = chip({ keyNode: icon, value: '2/3', attrs: { 'aria-label': 'Actions 2 of 3' } });
  assert.equal(node.querySelector('.ck').children[0], icon);
  assert.equal(node.querySelector('.engraved-icon')?.dataset.engravedIcon, 'actions');
  assert.equal(node.querySelector('.cv').textContent, '2/3');
  assert.equal(node.getAttribute('aria-label'), 'Actions 2 of 3');
}));

test('the retained nonexpanded proc-meter caller supplies icon art through the explicit node slot', () => {
  const source = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
  const begin = source.indexOf('for (const { sid, resisted } of procs)');
  const end = source.indexOf('meterEl.dataset.status', begin);
  assert.ok(begin >= 0 && end > begin);
  const proc = source.slice(begin, end);
  assert.match(proc, /valueNode: engravedIcon\(def.icon/);
  assert.doesNotMatch(proc, /value:\s*def.icon/);
  assert.match(proc, /cur: inst.meter.value, max: inst.meter.max/);
});
