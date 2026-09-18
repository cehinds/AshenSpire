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
  const body = rule[1];
  assert.match(body, /grid-template-areas:\s*"info actions" "meters actions"/,
    'facts over meters, the Armoury/Menu pair beside both — the map header’s shape');
  assert.doesNotMatch(body, /grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 1fr\)/,
    'two half-width columns cannot hold four facts and three meters at phone width');
});
