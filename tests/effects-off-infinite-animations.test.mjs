// Effects off (and its twin, Lite) leaves nothing animating forever: every `infinite` animation in
// styles/ is stopped by an Effects-off or Lite rule, or is on the allowlist below with its reason.
// Reduced motion does not count: base.css already stops every animation for it, so it proves nothing here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSourceTextSync } from './helpers/read-source.mjs';
import { stripCssComments } from '../tools/css-strip.mjs';

const stylesDir = fileURLToPath(new URL('../styles/', import.meta.url));
const sheets = readdirSync(stylesDir).filter(name => name.endsWith('.css'))
  .map(name => ({ name, css: stripCssComments(readSourceTextSync(join(stylesDir, name))) }));

// Innermost rules only: an @media / @container prelude is not part of the captured selector list.
const rules = sheets.flatMap(({ name, css }) => [...css.matchAll(/([^{}@;]+)\{([^{}]*)\}/g)]
  .map(m => ({ sheet: name, selectors: m[1].split(/,(?![^()]*\))/).map(s => s.trim().replace(/\s+/g, ' ')), body: m[2] })));

const ALLOWLIST = new Map([
  ['.map-enter[data-busy=\'true\']::before', 'the Enter button\'s busy spinner: it runs only while the map is loading, and a still ring reads as stuck'],
]);
// An infinite animation stopped by hiding an ancestor.
const ANCESTOR_GATES = new Map([
  ['.startup-ash', '.startup-ash-field'],
]);

const GATE_PREFIX = /^:root(?::root)?\[data-(?:effects=['"]off['"]|performance=['"]lite['"])\] /;
const STOPS = /(?:^|[;\s])(?:animation(?:-name)?\s*:\s*none|display\s*:\s*none)\b/;
const SELF_GATED = /\[data-performance=["']full["']\]|\[data-effects=["']on["']\]/;

const infinite = rules.filter(r => /animation(?:-iteration-count)?\s*:[^;]*\binfinite\b/.test(r.body))
  .flatMap(r => r.selectors.map(selector => ({ sheet: r.sheet, selector })));
const gates = rules.filter(r => STOPS.test(r.body))
  .flatMap(r => r.selectors.filter(s => GATE_PREFIX.test(s)).map(s => s.replace(GATE_PREFIX, '')));

const stopped = selector => gates.some(gate => gate === selector || gate.endsWith(` ${selector}`));

test('every infinite animation in styles/ stops under Effects off or Lite, or is allowlisted with a reason', () => {
  assert.ok(infinite.length >= 15, `the sweep finds the known loops (found ${infinite.length})`);
  const ungated = infinite.filter(({ selector }) => {
    if (ALLOWLIST.has(selector) || SELF_GATED.test(selector)) return false;
    return !stopped(ANCESTOR_GATES.get(selector) || selector);
  });
  assert.deepEqual(ungated.map(({ sheet, selector }) => `${sheet}: ${selector}`), []);
});

test('the allowlist and ancestor gates name only loops that still exist', () => {
  const selectors = new Set(infinite.map(({ selector }) => selector));
  for (const [selector, reason] of ALLOWLIST) {
    assert.ok(selectors.has(selector), `stale allowlist entry ${selector}`);
    assert.ok(reason.length > 20, `${selector} needs a reason`);
  }
  for (const selector of ANCESTOR_GATES.keys()) assert.ok(selectors.has(selector), `stale ancestor gate ${selector}`);
});

test('the likely-target silhouette and the gold pulse keep a static state under Effects off', () => {
  const combat = sheets.find(s => s.name === 'combat.css').css;
  assert.match(combat, /:root\[data-effects='off'\] \.aim-silho \{ animation: none; filter: none; opacity: [\d.]+; \}/);
  const kit = sheets.find(s => s.name === 'kit.css').css;
  for (const host of ['\\.rebind-btn\\.listening', '\\.as-meter\\.pulse \\.m-fill'])
    assert.match(kit, new RegExp(`:root\\[data-effects='off'\\] ${host} \\{ animation: none; box-shadow: [^;]+;`), host);
});
