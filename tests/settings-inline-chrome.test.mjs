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

/** Every selector in the file, paired with nothing else — declarations dropped. */
const selectors = ui.split('}').map((block) => block.split('{')[0].trim()).filter(Boolean)
  .flatMap((head) => head.split(',').map((one) => one.trim()))
  .filter((one) => one && !one.startsWith('@') && !one.startsWith('/*'));

test('the settings toolbar is styled for both doors, not the modal alone', () => {
  const toolbar = selectors.filter((one) => /set-header-tools|set-search-toggle|set-options/.test(one));
  assert.ok(toolbar.length >= 6, 'ui.css styles the settings toolbar');
  // `.modal-head` is the one part the overlay genuinely does not have, so a
  // rule about the head is allowed to name the modal alone; the inline bar
  // carries the same search-open widening for the other door.
  const modalOnly = toolbar.filter((one) => one.includes('.settings-modal')
    && !one.includes('[data-settings-host]') && !one.includes('.modal-head'));
  assert.deepEqual(modalOnly, [], 'no toolbar rule is reachable only from the modal');
});

test('the one scrollport and the notice band hang off the shared host', () => {
  assert.ok(ui.includes('.modal > [data-settings-host] {'), 'the filled container owns the column');
  assert.ok(ui.includes('.modal > [data-settings-host] > .set-notice {'), 'the notice band is shared');
  assert.ok(ui.includes('[data-settings-host] .set-panel { min-height: 0;'), 'the pane is the one scrollport');
});

test('the inline tools ride one bar instead of stacking', () => {
  assert.ok(ui.includes('[data-settings-host] > .set-inline-bar {'), 'the bar has a rule');
  assert.ok(ui.includes('[data-settings-host] > .set-inline-bar > .set-header-tools { margin-left: auto; }'),
    'the icon pair sits at the far end of that one row');
  assert.ok(settingsSource.includes("inlineBar.className = 'set-inline-bar'"), 'renderSettings builds the bar');
  assert.ok(settingsSource.includes('inlineBar.append(offline)') && settingsSource.includes('inlineBar.append(headerTools)'),
    'the download button and the toolbar are siblings in it');
  assert.ok(!/container\.prepend\((offline|headerTools)\)/.test(settingsSource),
    'neither is prepended loose any more');
});

// A status weight is two fields, written one at a time. Only the seven statuses
// named in combatRatingDefaults.statuses arrive with both, so tuning Poise for
// any other one left `{ poise }` with no `ward` and the panel reported
// "Invalid status resistance weights" for a perfectly reasonable config.
test('one side of a status weight resolves to a complete pair', () => {
  const unnamed = contentBundle.statuses.map((status) => status.id)
    .find((id) => !combatRatingDefaults.statuses[id]);
  assert.ok(unnamed, 'the bundle carries statuses the rating defaults do not name');
  const config = resolveCombatRatings({ [`gameConfig.combatRatings.statuses.${unnamed}.poise`]: 0.5 }, contentBundle);
  assert.deepEqual(config.statuses[unnamed], { poise: 0.5, ward: 0 });
  assert.deepEqual(combatRatingProblems(config), []);
});

test('an authored weight fills the side that was not written', () => {
  const config = resolveCombatRatings({ 'gameConfig.combatRatings.statuses.burn.poise': 0.4 }, contentBundle);
  assert.deepEqual(config.statuses.burn, { poise: 0.4, ward: combatRatingDefaults.statuses.burn.ward });
  assert.deepEqual(combatRatingProblems(config), []);
});

test('a weight outside 0–1 is still refused', () => {
  const config = resolveCombatRatings({ 'gameConfig.combatRatings.statuses.burn.poise': 4 }, contentBundle);
  assert.equal(config.statuses.burn.poise, combatRatingDefaults.statuses.burn.poise, 'the row is skipped, not stored');
  assert.deepEqual(combatRatingProblems({ ...config, statuses: { burn: { poise: 4, ward: 0 } } }),
    ['Invalid status resistance weights'], 'the check itself still bites');
});
