import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// THE FOLD IS ONE RULE SET, NOT ONE PER HOST (styles/kit.css § BAND FOLD).
//
// The defect these guard: W4b's map header carried the folded band's yield
// rules alone, and when W4c's dialogue band took the same fold it took the
// GRID and left the yielding behind — so at 430 wide the run header's three
// fact tracks and the stacked meters overflowed their columns and printed on
// top of each other. A fold that is copied is a fold that is copied wrong, so
// what is checked here is that the rules name BOTH hosts and that the
// dialogue band stacks its two rows rather than seating them side by side.
const css = readFileSync(new URL('../styles/kit.css', import.meta.url), 'utf8').replace(/\r\n?/g, '\n');
// The wireframe is READ, not imported: tools/linkcheck.mjs --selftest copies the
// tree without docs/, and an import of a doc module reads as a broken one there.
// tests/wireframe-button-sizes.test.mjs reads button-widths.json the same way.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n?/g, '\n');
const hudConfig = JSON.parse(read('docs/architecture-handoff/hud-config.json'));
const hudReference = read('docs/architecture-handoff/hud-reference.mjs');

const MAP_HOST = '.shared-hud[data-hud-layout="map-compact"]';
const DIALOGUE_HOST = ".dialogue-screen[data-hud-compact='true'] .shared-hud";

/** The § BAND FOLD block: from its banner to the next banner comment. */
function foldBlock() {
  const start = css.indexOf('BAND FOLD');
  assert.ok(start > 0, 'styles/kit.css has a § BAND FOLD block');
  const after = css.indexOf('*/', start);
  const ends = [css.indexOf('/* ═══', after), css.indexOf('@media', after)].filter((i) => i > 0);
  return css.slice(start, ends.length ? Math.min(...ends) : css.length);
}

/** Every selector that opens a rule in `block`, one per declaration list. */
function selectorsOf(block) {
  return [...block.matchAll(/(^|\})([^{}]+)\{/g)]
    .map((m) => m[2].replace(/\/\*[\s\S]*?\*\//g, '').trim())
    .filter((selector) => selector && !selector.startsWith('@'));
}

test('every band-fold rule serves both the map header and the dialogue band', () => {
  const selectors = selectorsOf(foldBlock());
  assert.ok(selectors.length >= 6, `the fold block still carries its rules (${selectors.length})`);
  for (const selector of selectors) {
    assert.ok(selector.includes(MAP_HOST), `fold rule names the map host: ${selector}`);
    assert.ok(selector.includes(DIALOGUE_HOST), `fold rule names the dialogue host: ${selector}`);
  }
});

test('the fold is what makes the meters one line, and it is not written twice', () => {
  const block = foldBlock();
  assert.match(block, /grid-auto-flow: column/, 'the fold reflows the meters onto one line');
  // One home: the map host must not carry a private copy of a fold rule.
  const mapOwn = css.split('\n').filter((line) => line.trimStart().startsWith(MAP_HOST));
  for (const line of mapOwn) {
    assert.ok(!/grid-auto-flow: column|text-overflow: ellipsis/.test(line),
      `the map host keeps no private copy of a fold rule: ${line.trim()}`);
  }
});

test('the folded dialogue band stacks its rows; it never seats them side by side', () => {
  const rule = /\.dialogue-screen\[data-hud-compact='true'\] > \.topbar > \.hud-top \{([^}]*)\}/.exec(css);
  assert.ok(rule, 'the dialogue band composes its folded HUD');
  // The defect: four facts and three meters cannot share one line at phone
  // width. Whatever the band does with its two rows, it never halves them.
  assert.doesNotMatch(rule[1], /grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 1fr\)/,
    'two half-width columns cannot hold four facts and three meters at phone width');
  assert.doesNotMatch(rule[1], /grid-template-areas:[^;]*"[^"]*\binfo\b[^"]*\bmeters\b/,
    'facts and meters never share a grid row');
});


// THE PHONE BAND (owner, 2026-09-18): "just vertically stacked vitality block,
// cinders, armament and menu button. should be uniform in every view. act and
// floor should show up in wide screen but on mobile, that's how it should be."
const PHONE_GATE = ":root[data-layout='narrow']";

/** The § BAND ON A PHONE block: from its banner to the next banner comment. */
function phoneBlock() {
  const start = css.indexOf('BAND ON A PHONE');
  assert.ok(start > 0, 'styles/kit.css has a § BAND ON A PHONE block');
  const after = css.indexOf('*/', start);
  const ends = [css.indexOf('/* \u2550\u2550\u2550', after), css.indexOf('@media', after)].filter((i) => i > 0);
  return css.slice(start, ends.length ? Math.min(...ends) : css.length);
}
const phoneRules = () => phoneBlock().split('\n').filter((line) => line.startsWith(PHONE_GATE));

test('the wireframe states the phone band, and states it as the published gate', () => {
  const phone = hudConfig.phone;
  assert.ok(phone, 'hudConfig carries the phone band');
  assert.equal(phone.meters, 'stacked');
  assert.deepEqual(
    { class: phone.layers.class, position: phone.layers.position, route: phone.layers.route, cinders: phone.layers.cinders },
    { class: false, position: false, route: false, cinders: true },
    'four things: stacked meters, Cinders, Armoury, Menu — the wide facts are absent');
  assert.match(phone.gate, /data-layout='narrow'/, 'the gate is the composition main.js publishes, not a second measurement');
  const wgh7 = /\['WGH7',[\s\S]*?\n\];/.exec(hudReference) || /\['WGH7',[\s\S]*/.exec(hudReference);
  assert.match(wgh7[0], /ONLY CINDERS REMAINS/, 'WGH7 says what the phone band carries');
});

test('the stylesheet gates the phone band on that same attribute, for every host', () => {
  const lines = phoneRules();
  const rule = (needle) => lines.find((line) => line.includes(needle));
  assert.ok(rule('.hud-identity'), 'the class name leaves the band on a phone');
  assert.ok(rule('.hud-run-meta'), 'act and floor leave the band on a phone');
  assert.ok(rule('.act-route-strip'), 'the map’s route receipt leaves it too — one band in every view');
  const meters = rule('.resbars {') || lines.find((line) => line.includes('.resbars'));
  assert.ok(meters, 'the meters are addressed on a phone');
  // Every one of them addresses `.shared-hud`, not one screen's own selector:
  // uniform in every view is the rule, so no host may opt out.
  for (const line of lines) assert.ok(line.includes('.shared-hud'), `phone rule is the shared band’s: ${line.trim()}`);
  // …and it must outrank § BAND FOLD's one meter line, which is a wide answer.
  assert.ok(css.indexOf('BAND ON A PHONE') > css.indexOf('BAND FOLD'), 'the phone block follows the fold it overrides');
});

test('the phone band drops the wide facts rather than shrinking them', () => {
  const lines = phoneRules();
  const dropped = lines.filter((line) => /\.hud-identity|\.hud-run-meta|\.act-route-strip/.test(line));
  for (const line of dropped) {
    assert.match(line, /display: none/, `absent, not ellipsized: ${line.trim()}`);
  }
});
