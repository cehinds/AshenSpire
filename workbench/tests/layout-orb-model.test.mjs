// node --test workbench/tests/layout-orb-model.test.mjs — Layout Studio's SP orb model against
// the real footer file the game reads: byte-exact round trip, canvas round trip, the SP group,
// the game's own mana-ring resampling, and the repo's config compiler.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compileEntries, readConfigTree } from '../../tools/config-build.mjs';
import { footerLayout, footerFonts } from '../../src/content/footerLayout.js';
import { staminaOrb } from '../../src/content/staminaOrb.js';
import { footerLayoutModel, footerStaminaLayers, footerBounds } from '../../src/ui/models/FooterLayoutModel.js';
import * as O from '../modules/layout/orb-model.mjs';

const real = (rel) => readFileSync(new URL(`../../content/config/ui/${rel}`, import.meta.url), 'utf8');
const TEXT = real('presentation/footerLayout.json');
const data = O.parseFooter(TEXT);
const item = (d, id) => d.components.layout.items.find((n) => n.id === id);

test('the real footer file round-trips byte for byte', () => {
  assert.equal(O.serializeFooter(data), TEXT);
  assert.equal(O.changedText(TEXT, data), null, 'no edit means no file to save');
  assert.deepEqual(data, JSON.parse(TEXT));
});

test('the SP group is the game\'s own classification: orb, frame, sigil, number, label and twelve sockets', () => {
  const ids = O.spIds(data);
  assert.deepEqual(ids.filter((id) => !id.startsWith('mana-')), ['sp-orb', 'sp-frame', 'sp-sigil', 'sp-number', 'sp-label']);
  assert.ok(ids.includes('sp-sigil'), 'a hidden sigil is still in the group');
  assert.deepEqual(O.socketIds(data), Array.from({ length: 12 }, (_, i) => `mana-${i}`));
});

test('an edit changes one value and one line of the file', () => {
  const next = O.setItemField(data, 'sp-orb', 'x', 60);
  const text = O.changedText(TEXT, next);
  assert.ok(text);
  const before = TEXT.split('\n'), after = text.split('\n');
  assert.equal(before.length, after.length);
  const diff = before.map((line, i) => (line === after[i] ? null : [line.trim(), after[i].trim()])).filter(Boolean);
  assert.deepEqual(diff, [['"x": 56,', '"x": 60,']]);
  assert.equal(item(data, 'sp-orb').x, 56, 'the input is not mutated');
});

test('the canvas round trip keeps an untouched footer identical and writes only moved SP items', () => {
  const doc = O.toCanvasDoc(data);
  assert.equal(doc.width, 1200);
  assert.equal(doc.height, 420);
  assert.equal(doc.items.length, data.components.layout.items.length, 'every item is drawn, in file order');
  assert.equal(O.fromCanvasDoc(data, doc), data, 'an untouched canvas returns the same object');
  assert.equal(doc.items.find((it) => it.id === 'rail-a').locked, true, 'non-SP art is context and locked');
  assert.equal(doc.items.find((it) => it.id === 'sp-orb').locked, false);

  const moved = structuredClone(doc);
  const orb = moved.items.find((it) => it.id === 'sp-orb');
  orb.x += 10.004; orb.y -= 3;
  const rail = moved.items.find((it) => it.id === 'rail-a');
  rail.x += 50;
  const out = O.fromCanvasDoc(data, moved);
  assert.equal(item(out, 'sp-orb').x, 66.00, 'a move is taken to the hundredth');
  assert.equal(item(out, 'sp-orb').y, 130);
  assert.equal(item(out, 'rail-a').x, item(data, 'rail-a').x, 'a locked context item is never written');
  assert.equal(O.serializeFooter(out).split('\n').length, TEXT.split('\n').length);
});

test('visibility comes back from the canvas, as the file\'s boolean', () => {
  const doc = O.toCanvasDoc(data);
  doc.items.find((it) => it.id === 'sp-sigil').hidden = false;
  const out = O.fromCanvasDoc(data, doc);
  assert.equal(item(out, 'sp-sigil').visible, true);
  assert.equal(item(data, 'sp-sigil').visible, false);
});

test('values the game does not read are refused, not written', () => {
  assert.throws(() => O.setItemField(data, 'sp-orb', 'w', 0), /greater than 0/);
  assert.throws(() => O.setItemField(data, 'sp-orb', 'x', Number.NaN), /finite/);
  assert.throws(() => O.setItemField(data, 'sp-orb', 'opacity', 1.5), /between 0 and 1/);
  assert.throws(() => O.setItemField(data, 'sp-orb', 'visible', 'yes'), /true or false/);
  assert.throws(() => O.setItemField(data, 'sp-orb', 'fontSize', 12), /has no fontSize/);
  assert.throws(() => O.setItemField(data, 'nope', 'x', 1), /no footer item/);
  assert.deepEqual(O.footerProblems(data), []);
  const bad = structuredClone(data);
  bad.components.layout.items[0].id = 'sp-orb';
  assert.match(O.footerProblems(bad).join(' '), /duplicate footer item "sp-orb"/);
});

test('mana sockets move the ring the game draws: at full capacity each gem sits on its socket', () => {
  const sockets = O.socketIds(data).map((id) => item(data, id));
  const gems = O.ringAt(data, 12, 5);
  assert.equal(gems.length, 12);
  // A spent gem is drawn at 60% of its socket, centred on it, so its offset is 20% of the socket's width.
  gems.forEach((gem, i) => {
    assert.equal(gem.asset, i < 5 ? 'diamond' : 'spent');
    const inset = i < 5 ? 0 : sockets[i].w * 0.2;
    assert.ok(Math.abs(gem.x - (sockets[i].x + inset)) < 1e-9, `gem ${i} x`);
    assert.ok(Math.abs(gem.y - (sockets[i].y + (i < 5 ? 0 : sockets[i].h * 0.2))) < 1e-9, `gem ${i} y`);
  });
  const moved = O.setItemField(data, 'mana-0', 'x', sockets[0].x + 25);
  assert.equal(O.ringAt(moved, 12, 5)[0].x, sockets[0].x + 25, 'the game\'s resampling reads the moved socket');
  assert.equal(O.ringAt(data, 3).length, 3, 'a three-MP capacity draws three gems');
});

test('the edited footer passes the repo\'s config compiler with the rest of the real config', () => {
  const entries = readConfigTree(fileURLToPath(new URL('../../content', import.meta.url)));
  const FOOTER = 'ui/presentation/footerLayout.json';
  assert.ok(entries.some((e) => e.rel === FOOTER), 'the footer is in the real config tree');
  const with_ = (text) => entries.map((e) => (e.rel === FOOTER ? { rel: FOOTER, text } : e));
  assert.deepEqual(compileEntries(with_(TEXT)).errors, []);
  const moved = O.changedText(TEXT, O.setItemField(data, 'sp-orb', 'x', 60));
  assert.deepEqual(compileEntries(with_(moved)).errors, []);
});

// The browser copy of the game's rules (orb-model.mjs) against the game's own functions.
const shownAll = (d) => ({ ...layoutOf(d), items: layoutOf(d).items.map((n) => ({ ...n, visible: true })) });
function layoutOf(d) { return d.components.layout; }
const mutants = (d) => {
  const L = layoutOf(d);
  const edit = (f) => ({ ...d, components: { ...d.components, layout: { ...L, items: L.items.map(f) } } });
  return [
    d,
    edit((n) => (n.id === 'sp-number' ? { ...n, group: 'draw' } : n)),
    edit((n) => (n.id === 'sp-sigil' ? { ...n, asset: 'plate' } : n)),
    edit((n) => (n.id === 'draw-art' ? { ...n, group: 'sp' } : n)),
    edit((n) => (n.id === 'end-plate' ? { ...n, asset: 'diamond', x: 100, y: 180 } : n)),
    edit((n) => (n.id === 'rail-a' ? { ...n, group: 'potions' } : n)),
    edit((n) => (n.asset === 'orb' ? { ...n, binding: 'discard' } : n)),
  ];
};

test('the SP group is the game\'s own classification, on the real file and on edited variants', () => {
  for (const d of mutants(data)) {
    const game = footerLayoutModel(shownAll(d)).groups.sp.items.map((n) => n.id);
    assert.deepEqual(O.spIds(d), game);
  }
});

test('the mana ring matches the game\'s resampling at every capacity and when a socket moves', () => {
  const pick = (g) => g.map(({ id, asset, x, y, w, h }) => ({ id, asset, x, y, w, h }));
  const sockets = [data, O.setItemField(data, 'mana-0', 'x', 300), O.setItemField(data, 'mana-7', 'w', 40)];
  for (const d of sockets) {
    for (const [capacity, available] of [[0, 0], [3, 2], [6, 6], [12, 5], [18, 9], [24, 1]]) {
      const game = footerStaminaLayers(d.components.layout, { gems: Array.from({ length: capacity }, (_, i) => ({ id: i < available ? 'diamond' : 'spent' })) })
        .filter((n) => n.asset === 'diamond' || n.asset === 'spent');
      assert.deepEqual(pick(O.ringAt(d, capacity, available)), pick(game), `capacity ${capacity}`);
    }
  }
  const hidden = O.setItemField(data, 'mana-3', 'visible', false);
  assert.deepEqual(pick(O.ringAt(hidden, 12, 3)), pick(footerStaminaLayers(hidden.components.layout, { gems: Array.from({ length: 12 }, (_, i) => ({ id: i < 3 ? 'diamond' : 'spent' })) }).filter((n) => n.asset === 'diamond' || n.asset === 'spent')));
});

test('the bounds and the art paths and fonts are the game\'s', () => {
  const sp = O.spIds(data).map((id) => data.components.layout.items.find((n) => n.id === id));
  assert.deepEqual(O.footerBounds(sp), footerBounds(sp));
  assert.deepEqual(O.footerBounds([]), footerBounds([]));
  assert.deepEqual(O.ORB_ASSETS, staminaOrb.assets);
  assert.deepEqual(O.FOOTER_FONTS, footerFonts);
});
