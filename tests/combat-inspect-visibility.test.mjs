import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Owner decisions (2026-10-11), overriding PR #1818's "always show Inspect":
//  A. No Inspect "i" paints at a temporary spot and then moves.
//  B. A combatant's Inspect (.combatant-info) shows only while it is selected.
//  C. The player's stance chip and status icons stay visible while not selected.
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const combatLayers = read('../styles/combat-layers.css');
const kit = read('../styles/kit.css');
const battlefield = read('../src/ui/components/battlefieldStage.js');
const overhead = read('../src/ui/components/combatantOverhead.js');
const tools = read('../tools/combat-mobile-touch-qa.mjs');

test('B: the always-visible Inspect rule is scoped to a selected combatant', () => {
  assert.match(combatLayers, /:root \.combat\[data-layout='formation'\] \.player:is\(\.context-selected,\.selected-target\) \.combatant-leading > \.combatant-info \{ display: flex;/);
  assert.doesNotMatch(combatLayers, /\.player \.combatant-leading > \.combatant-info \{ display: flex;/,
    'the unscoped always-visible rule must not return');
});

test('B: an unselected combatant hides its Inspect with !important', () => {
  assert.match(combatLayers,
    /:root \.combat \.combatant:not\(\.context-selected\):not\(\.selected-target\) \.combatant-leading > \.combatant-info \{ display: none !important; \}/);
});

test('A: an Inspect is hidden until battlefieldStage has placed it', () => {
  assert.match(combatLayers, /:root \.combat \.combatant-info:not\(\[data-placed='true'\]\) \{ visibility: hidden !important; \}/);
});

test('A: the player Info door and every displayed enemy door are marked placed', () => {
  assert.match(battlefield, /if \(door === inspect\) door\.dataset\.placed = 'true';/);
  assert.match(battlefield, /if \(sides\[i\] == null\) \{ delete info\.dataset\.placed; return; \}/);
  assert.match(battlefield, /info\.dataset\.placed = 'true';/);
});

test('A: a selection change refits synchronously, before the newly shown door paints', () => {
  assert.match(battlefield, /const selectionChanged = \(\) => \{ refresh\(\); schedule\(\); \};/);
  assert.match(battlefield, /combatHost\.addEventListener\('combatantselectionchange', selectionChanged\);/);
  assert.match(battlefield, /combatHost\.removeEventListener\('combatantselectionchange', selectionChanged\);/);
});

test('the dead inspectReady timer is gone and nothing reads it', () => {
  assert.doesNotMatch(overhead, /inspectReady|inspectTimers|selectionRevealDelayMs/);
  assert.doesNotMatch(tools, /inspect-ready/);
  assert.match(tools, /\.combatant-info\[data-placed="true"\]/);
});

test('A: a hand card Inspect is shown once, as the portal, never in place on the card', () => {
  assert.match(kit, /\.hand \.card-inspection-target > \.card-info-button \{ visibility:hidden; pointer-events:none; \}/);
  // The rule must come after the shared in-card visibility rule to win at equal specificity.
  assert.ok(kit.indexOf(".hand .card-inspection-target > .card-info-button { visibility:hidden")
    > kit.indexOf(".card-inspection-target:is(.inspection-selected, .selected, [aria-selected='true']) > .card-info-button { visibility:visible"),
  'the hand rule must follow the shared visible rule');
});

test('C: the stance chip and statuses are not in the rest-state hide list', () => {
  const restHide = combatLayers.match(/\.player:not\(\.context-selected\):not\(\.selected-target\)[^{]*\{\s*display:\s*none !important;/s)?.[0] ?? '';
  assert.match(restHide, /\[data-meter-row='resource'\]/);
  assert.doesNotMatch(restHide, /data-meter-row='stance'|\.statuses/);
});
