import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldRelayout, viewportKey, isPhoneViewport } from '../src/model/relayoutGate.js';
import { uiConfig } from '../src/config/generated/ui.js';
import { readSourceTextSync } from './helpers/read-source.mjs';

const cfg = uiConfig.presentation.combatFormationModel.behavior.relayout;
const base = viewportKey({ width: 1280, height: 800 });

test('the first mount lays out', () => assert.equal(shouldRelayout(null, base, cfg), true));
test('an address-bar height change (+-60px of 844) never relays out', () => {
  const laid = viewportKey({ width: 390, height: 844 });
  for (const h of [784, 844, 904, 790, 850, 900]) assert.equal(shouldRelayout(laid, viewportKey({ width: 390, height: h }), cfg), false);
});
test('a height change under the threshold does not relayout, over it does', () => {
  assert.equal(shouldRelayout(base, viewportKey({ width: 1280, height: 800 * 0.8 }), cfg), false);
  assert.equal(shouldRelayout(base, viewportKey({ width: 1280, height: 800 * 1.3 }), cfg), true);
});
test('a width change over 8% relays out', () => {
  assert.equal(shouldRelayout(base, viewportKey({ width: 1280 * 1.05, height: 800 }), cfg), false);
  assert.equal(shouldRelayout(base, viewportKey({ width: 1280 * 1.1, height: 800 }), cfg), true);
});
test('an orientation flip relays out on desktop and tablet, not on a phone', () => {
  const flipped = viewportKey({ width: 800, height: 1280 });
  assert.equal(shouldRelayout(base, flipped, cfg), true);
  assert.equal(shouldRelayout(viewportKey({ width: 390, height: 844 }), viewportKey({ width: 844, height: 390 }), cfg, { phone: true }), false, 'portrait to landscape is ignored');
});
test('a phone is a coarse pointer with a short side of 500px or less', () => {
  assert.equal(isPhoneViewport({ width: 390, height: 844, coarse: true }, cfg), true);
  assert.equal(isPhoneViewport({ width: 844, height: 390, coarse: true }, cfg), true);
  assert.equal(isPhoneViewport({ width: 390, height: 844, coarse: false }, cfg), false);
  assert.equal(isPhoneViewport({ width: 820, height: 1180, coarse: true }, cfg), false);
});

import { formationKey } from '../src/model/relayoutGate.js';
const state = over => ({ playerCell: 'A1', occupancy: '[]', rangeRanks: '{}', policy: 'null',
  frames: [{ eid: 'player', cell: 'A1', dead: false }, { eid: 'e1', cell: 'D1', dead: false }], ...over });
test('a formation change repositions: player move, enemy advance, strip change, death, removal', () => {
  const base = formationKey(state());
  assert.equal(formationKey(state()), base, 'an unchanged formation is the same key (select/hover never relayout)');
  assert.notEqual(formationKey(state({ playerCell: 'A2', frames: [{ eid: 'player', cell: 'A2', dead: false }, { eid: 'e1', cell: 'D1', dead: false }] })), base, 'player moved');
  assert.notEqual(formationKey(state({ occupancy: '[["A2","player"]]' })), base, 'occupancy');
  assert.notEqual(formationKey(state({ rangeRanks: '{"e1":1}' })), base, 'enemy advance/retreat (rangeRanks)');
  assert.notEqual(formationKey(state({ frames: [{ eid: 'player', cell: 'A1', dead: false }, { eid: 'e1', cell: 'D1', dead: true }] })), base, 'enemy death');
  assert.notEqual(formationKey(state({ frames: [{ eid: 'player', cell: 'A1', dead: false }] })), base, 'frame removed');
});
test('the stage refits when the formation key changes, ahead of the viewport gate', () => {
  const source = readSourceTextSync(new URL('../src/ui/components/battlefieldStage.js', import.meta.url));
  assert.match(source, /formationKey !== placedFormationKey/);
  assert.match(source, /placedFormationKey = formationKey;/);
});

test('a phone that mounted sideways relays out once when it turns upright', () => {
  const sideways = viewportKey({ width: 844, height: 390 });
  assert.equal(shouldRelayout(sideways, viewportKey({ width: 390, height: 844 }), cfg, { phone: true }), true);
  assert.equal(shouldRelayout(sideways, viewportKey({ width: 800, height: 380 }), cfg, { phone: true }), false);
});

test('a display-setting change with an unchanged viewport forces one relayout; a viewport-driven one does not', () => {
  const source = readSourceTextSync(new URL('../src/ui/components/battlefieldStage.js', import.meta.url));
  assert.match(source, /const settingChange = keyMoved && viewport === lastSeenViewport;/);
  assert.match(source, /if \(setting !== lastSettingKey \|\| settingChange\) \{ lastSettingKey = setting; scheduleForced\(\); \}/);
});

test('an art-load callback forces one relayout through the gate (one per load, never a loop)', () => {
  const source = readSourceTextSync(new URL('../src/ui/components/battlefieldStage.js', import.meta.url));
  assert.match(source, /const scheduleArt = \(\) => scheduleForced\(\);/);
  assert.equal((source.match(/currentSprite(Art|Body)Bounds\(sprite, (schedule|refresh|placePlayerHud)\)/g) || []).length, 0, 'no art read registers an ungated callback');
  assert.ok((source.match(/currentSprite(Art|Body)Bounds\(sprite, scheduleArt\)/g) || []).length >= 8);
  // The forced pass is consumed once: refresh clears forcePending, so a settled sprite registers no further callback.
  assert.match(source, /forcePending = false;\n    layoutEpoch\+\+;/);
});

test('the per-frame cell the pass itself writes is not a key input: before and after the cell write the key is equal', () => {
  const frame = { eid: 'e1', dead: false, cell: undefined };
  const before = formationKey(state({ frames: [{ ...frame }] }));
  const after = formationKey(state({ frames: [{ ...frame, cell: 'D1' }] }));
  assert.equal(before, after);
  const source = readSourceTextSync(new URL('../src/ui/components/battlefieldStage.js', import.meta.url));
  assert.doesNotMatch(source, /cell: frame\.dataset\.formationCell/);
  assert.match(source, /lastSeenViewport = `\$\{now\.width\}x\$\{now\.height\}`;/, 'the last seen viewport updates every pass');
});
