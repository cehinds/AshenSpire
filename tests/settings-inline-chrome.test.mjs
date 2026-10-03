import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { combatRatingDefaults, resolveCombatRatings, combatRatingProblems } from '../src/model/combatRatings.js';

// SETTINGS HAS TWO DOORS and one chrome (#67, Sunna's D18). The modal hangs its
// toolbar in `.modal-head`; the in-run overlay (src/ui/components/overlay.js)
// renders the SAME panel into `.overlay-body`, which has no head — so every
// rule scoped to `.settings-modal` was a rule the overlay did not get. The
// screenshot of the defect: two unstyled black-on-black icon buttons floating
// at the right, the download button stranded on its own row above them, and a
// second scrollbar on the shell. The host both doors share is the attribute
// renderSettings sets on whatever container it filled.
const ui = readFileSync(new URL('../styles/ui.css', import.meta.url), 'utf8').replace(/\r\n?/g, '\n');
const settingsSource = readFileSync(new URL('../src/ui/screens/settings.js', import.meta.url), 'utf8');

/**
 * Every selector in the file, one per entry.
 *
 * THE NAIVE SPLIT IS THE DEFECT THIS GUARD EXISTS TO CATCH, one layer up.
 * `text.split('}')` swallows the first rule inside every `@media` block (the
 * chunk's first `{` is the query's own), and `head.split(',')` cuts `:is(a, b)`
 * in half — so a guard written that way reads `:is(.settings-modal` as one
 * selector, finds no `set-` token in it, and passes over the exact form this
 * file now writes. Braces are counted and commas at depth are kept.
 */
function selectorsOf(source) {
  // Comments go FIRST: one in this file reads "the left, search and options at
  // the right", and a comma split that runs before the strip breaks the head it
  // is attached to in half.
  const css = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const heads = [];
  let head = '';
  for (const c of css) {
    // A head ends at the brace that follows it, and starts fresh after either
    // brace. An at-rule's own brace (`@media …{`) opens a block whose contents
    // are more rule heads, so it is skipped rather than collected — and the
    // rule that follows it is NOT swallowed, which the naive `split('}')` does.
    if (c === '{') { if (!head.trim().startsWith('@')) heads.push(head); head = ''; continue; }
    if (c === '}') { head = ''; continue; }
    head += c;
  }
  return heads.flatMap((one) => {
    // Commas inside `:is(…)`, `:not(…)` or `:has(…)` belong to that selector.
    const parts = [];
    let cur = '';
    let paren = 0;
    for (const c of one) {
      if (c === '(') paren++;
      else if (c === ')') paren--;
      if (c === ',' && paren === 0) { parts.push(cur); cur = ''; continue; }
      cur += c;
    }
    parts.push(cur);
    return parts;
  }).map((one) => one.trim()).filter(Boolean);
}

const selectors = selectorsOf(ui);

test('the parser reads the shapes this file is written in', () => {
  // A guard whose reader is blind cannot fail, so the reader is tested first.
  const parsed = selectorsOf('@media (max-width: 9px) {\n  .a, :is(.b, .c) .d { color: red; }\n}\n.e { color: blue; }');
  assert.deepEqual(parsed, ['.a', ':is(.b, .c) .d', '.e']);
  // Shape-independent on the real file: a selector cut through `:is(…)` comes
  // back with unbalanced parentheses, which is exactly how the naive split
  // fails, and how a guard reading it goes quiet.
  const unbalanced = selectors.filter((one) => (one.match(/\(/g) || []).length !== (one.match(/\)/g) || []).length);
  assert.deepEqual(unbalanced, [], 'no selector comes back cut through a functional pseudo-class');
  assert.ok(selectors.length > 200, 'the whole file was read, not one block of it');
});

test('the settings chrome is styled for both doors, not the modal alone', () => {
  const chrome = selectors.filter((one) => /\.set-(header-tools|search-toggle|options|subtabs|tabs\b)/.test(one));
  assert.ok(chrome.length >= 8, 'ui.css styles the settings chrome');
  // `.modal-head` is the one part the overlay genuinely does not have, so a
  // rule about the head is allowed to name the modal alone; the inline bar
  // carries the same search-open widening for the other door.
  const modalOnly = chrome.filter((one) => one.includes('.settings-modal')
    && !one.includes('[data-settings-host]') && !one.includes('.modal-head'));
  assert.deepEqual(modalOnly, [], 'no settings chrome rule is reachable only from the modal');
});

test('the one scrollport and the notice band hang off the shared host', () => {
  assert.ok(selectors.includes('.modal > [data-settings-host]'), 'the filled container owns the column');
  assert.ok(selectors.includes('.modal > [data-settings-host] > .set-notice'), 'the notice band is shared');
  assert.ok(ui.includes('[data-settings-host] .set-panel { min-height: 0;'), 'the pane is the one scrollport');
});

test('the inline tools ride one bar instead of stacking', () => {
  assert.ok(selectors.includes('[data-settings-host] > .set-inline-bar'), 'the bar has a rule');
  assert.ok(ui.includes('[data-settings-host] > .set-inline-bar > .set-header-tools { margin-left: auto; }'),
    'the icon pair sits at the far end of that one row');
  assert.ok(settingsSource.includes("inlineBar.className = 'set-inline-bar'"), 'renderSettings builds the bar');
  assert.ok(settingsSource.includes('inlineBar.append(offline)') && settingsSource.includes('inlineBar.append(headerTools)'),
    'the download button and the toolbar are siblings in it');
  assert.ok(!/container\.prepend\((offline|headerTools)\)/.test(settingsSource),
    'neither is prepended loose any more');
});

test('both doors are handed the Download & saves opener', () => {
  // openSettings destructured `onOffline` and then left it out of both
  // renderSettings calls, so the title screen's Settings door never grew the
  // button. Two calls, and the one in the import path counts too.
  const calls = [...settingsSource.matchAll(/renderSettings\((?:host|door\.body),\s*\{([^}]*)\}/g)];
  assert.equal(calls.length, 2, 'openSettings renders on open and after an import');
  for (const [, args] of calls) assert.match(args, /\bonOffline\b/, 'the opener is forwarded');
});

// A status weight is two fields, written one at a time, and the clone
// resolveCombatRatings starts from carries both only for the seven statuses the
// defaults name. Tuning Poise for any other one left `{ poise }` with no
// `ward` and the panel reported "Invalid status resistance weights" for a
// perfectly reasonable config.
test('a one-sided weight on ANY status resolves to a complete pair', () => {
  const ids = contentBundle.statuses.map((status) => status.id);
  assert.ok(ids.some((id) => !combatRatingDefaults.statuses[id]),
    'the bundle carries statuses the rating defaults do not name — the case that broke');
  for (const id of ids) {
    for (const [written, other] of [['poise', 'ward'], ['ward', 'poise']]) {
      const config = resolveCombatRatings({ [`gameConfig.combatRatings.statuses.${id}.${written}`]: 0.5 }, contentBundle);
      assert.equal(config.statuses[id][written], 0.5, `${id}.${written} takes the written value`);
      assert.ok(Number.isFinite(config.statuses[id][other]), `${id}.${other} is a number, not undefined`);
      // An authored weight is not overwritten by the fill: it arrived finite.
      const authored = combatRatingDefaults.statuses[id]?.[other];
      if (authored !== undefined) assert.equal(config.statuses[id][other], authored, `${id}.${other} keeps its authored weight`);
      assert.deepEqual(combatRatingProblems(config), [], `${id}: a one-sided ${written} is a valid config`);
    }
  }
});

test('a weight outside 0–1 is refused rather than filled', () => {
  const config = resolveCombatRatings({ 'gameConfig.combatRatings.statuses.burn.poise': 4 }, contentBundle);
  assert.equal(config.statuses.burn.poise, combatRatingDefaults.statuses.burn.poise, 'the row is skipped, not stored');
  // And the check the fill answers to still bites when a pair really is broken.
  assert.deepEqual(combatRatingProblems({ ...config, statuses: { burn: { poise: 4, ward: 0 } } }),
    ['Invalid status resistance weights']);
});
