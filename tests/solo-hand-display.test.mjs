// The creation screen's hand numbers are the hand a solo fight deals, read
// off the run's own hand rows (`handStatRows`, model/statRows.js) — the rows
// engine/runCombat.js snapshots, the class's opening hand among them. The Hand
// and Draw chips' parity with the dealt hand under the shipped and legacy
// rules lives in tests/hand-rules.test.mjs; this file covers what it does not:
// a per-class Settings override, fill mode, and the attribute cards' facts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { attributeCardModels } from '../src/model/creationBrief.js';
import { statProjection, handResourceRows } from '../src/model/statProjection.js';
import { HAND_RULES_PREFIX, runHandRules } from '../src/model/handRules.js';
import { statRow } from '../src/model/statRows.js';
import { configuredContentBundle } from '../src/model/advancedConfig.js';

const registries = createRegistries(contentBundle);
const CLASSES = ['reaver', 'rogue', 'herald', 'starseer'];
const PRIMARY = { reaver: 'strength', rogue: 'dexterity', herald: 'wisdom', starseer: 'intelligence' };
const chip = (reg, run, settings, id) => handResourceRows(reg, run, settings).find((row) => row.id === id);

function dealt(reg, run, settings = {}) {
  return createRunCombat({ registries: reg, rng: createRng(7), run, enemyIds: ['wanderingSoldier'], settings }).piles.hand.length;
}

test('the Hand chip follows a per-class Settings override the way the fight does', () => {
  const settings = { 'gameConfig.derivedStatRules.rules.openingHand.byClass.reaver.base': 5 };
  const tuned = createRegistries(configuredContentBundle(contentBundle, settings));
  const run = createRunState({ seed: 7, classId: 'reaver', registries: tuned });
  const stock = createRunState({ seed: 7, classId: 'reaver', registries });
  const hand = chip(tuned, run, settings, 'openingHand');
  assert.notEqual(hand.value, chip(registries, stock, {}, 'openingHand').value, 'the override moves the chip');
  assert.equal(Math.min(hand.value, run.deck.length), dealt(tuned, run, settings));
});

test('in fill mode the Draw chip tops the hand up to capacity', () => {
  const settings = { [`${HAND_RULES_PREFIX}drawMode`]: 'fill' };
  for (const classId of CLASSES) {
    const run = createRunState({ seed: 7, classId, registries });
    const draw = chip(registries, run, settings, 'draw');
    assert.match(draw.formula, /draw until the hand holds (\d+)$/);
    assert.equal(draw.value, Number(draw.formula.match(/holds (\d+)$/)[1]), `${classId}: fill draws capacity into an empty hand`);
  }
});

test('the primary stat card states the opening-hand effect, and no other card does', () => {
  for (const classId of CLASSES) {
    const run = createRunState({ seed: 7, classId, registries });
    const row = statRow(registries, run, 'openingHand');
    const cards = attributeCardModels(registries, run.attributes, { projection: statProjection(registries, run) });
    const primary = cards.find((card) => card.id === PRIMARY[classId]);
    assert.ok(primary.face.summary.includes(`+1 Opening hand per 2 pts (max ${row.max})`), `${classId}: ${primary.face.summary}`);
    assert.ok(primary.reveal.lines.some((line) => line.startsWith('Opening hand +1 every 2 points')), `${classId}: the fold says it too`);
    for (const card of cards) {
      if (card.id !== PRIMARY[classId]) assert.ok(!/Opening hand/.test(`${card.face.summary} ${card.reveal.lines.join(' ')}`), `${classId} ${card.id}`);
    }
  }
});

// EVERY SCREEN THAT SPENDS OR SHOWS A POINT STATES THE SOLO HAND (Codex, #1294).
// The Shrine's level-up picker called `attributeCardModels` without `hand`, so
// its cards fell back to the co-op Draw row; the in-combat Armoury mounted with
// a synthetic `meta.settings` holding no hand rules, so a Settings override was
// read as the authored default. Both now hand the cards the rules the fight
// deals from: the Shrine the next fight's (`classHandRules` over the profile),
// the combat Armoury the running fight's own snapshot.
import { readFileSync } from 'node:fs';
const source = (path) => readFileSync(new URL(`../src/ui/screens/${path}`, import.meta.url), 'utf8');

// Since ruleset 7 the class's opening hand is its row; a tuned class row is
// set through the row's own keys, and `runHandRules` (model/handRules.js) is
// the door both the Shrine and the Armoury read — as #1318 made them read
// `classHandRules` before the hand became rows.
const tunedReaver = () => createRegistries(configuredContentBundle(contentBundle, {
  'gameConfig.derivedStatRules.rules.openingHand.byClass.reaver.strength': 0,
  'gameConfig.derivedStatRules.rules.openingHand.byClass.reaver.constitution': 0.5,
}));

test('the Shrine level-up cards read the solo hand the next fight deals', () => {
  const rest = source('rest.js');
  const call = rest.slice(rest.indexOf('const cards = new Map(attributeCardModels(registries, values, {'));
  assert.match(call.slice(0, call.indexOf('}).map(')), /hand: runHandRules\(registries, run, meta\?\.settings \|\| \{\}\)/);
  // What those rules put on the face: a per-class override moves the primary card.
  const tuned = tunedReaver();
  const run = createRunState({ seed: 7, classId: 'reaver', registries: tuned });
  const cards = attributeCardModels(tuned, run.attributes, { projection: statProjection(tuned, run), hand: runHandRules(tuned, run, {}) });
  assert.ok(cards.find((card) => card.id === 'constitution').face.summary.includes('Opening hand'), 'the override reaches the level-up card');
  assert.ok(!cards.find((card) => card.id === 'strength').face.summary.includes('Opening hand'));
});

test('the in-combat Armoury cards read the running fight\'s own hand rules', () => {
  const combat = source('combat.js');
  const mount = combat.slice(combat.indexOf('const panel = mountEquipment(document.body, {'));
  assert.match(mount.slice(0, mount.indexOf('inCombat: true')), /handRules: combat\.handRules \|\| runHandRules\(registries, run, readSettings\(\)\)/);
  const equipment = source('equipment.js');
  assert.match(equipment, /hand: handRules \|\| runHandRules\(registries, run, meta\.settings \|\| \{\}\)/);
  // The fight's own hand wins over whatever else the screen could resolve:
  // a fight dealt from the tuned Reaver row names Constitution, even beside a
  // projection read off the stock table.
  const tuned = tunedReaver();
  const run = createRunState({ seed: 7, classId: 'reaver', registries: tuned });
  const fight = createRunCombat({ registries: tuned, rng: createRng(7), run, enemyIds: ['wanderingSoldier'] });
  const stockRun = createRunState({ seed: 7, classId: 'reaver', registries });
  const cards = attributeCardModels(registries, stockRun.attributes, { projection: statProjection(registries, stockRun), hand: fight.handRules });
  assert.ok(cards.find((card) => card.id === 'constitution').face.summary.includes('Opening hand'));
  assert.ok(!cards.find((card) => card.id === 'strength').face.summary.includes('Opening hand'), 'not the stock row a synthetic meta would resolve');
});

// The class chooser's per-class preview sliced the resource rows to five; the
// legacy Draw row became Hand + Draw, so the slice kept Hand and dropped Draw
// (Codex, #1294). It now keeps every row through both hand chips.
import { withHandResources, startingResourceRows } from '../src/model/statProjection.js';

test('the class preview shows both the Hand and the Draw chip, and not Poise', () => {
  for (const classId of CLASSES) {
    const run = createRunState({ seed: 7, classId, registries });
    const rows = startingResourceRows(withHandResources(statProjection(registries, run).derived, handResourceRows(registries, run, {})));
    assert.deepEqual(rows.map((row) => row.id), ['hp', 'mana', 'stamina', 'energy', 'openingHand', 'draw'], classId);
  }
  const customize = source('customize.js');
  assert.doesNotMatch(customize, /creationResources\([^)]*\)\.slice\(0, 5\)/, 'no fixed-count slice of the resource rows');
  assert.equal(customize.match(/classResourceGrid\(classPreviewResources\(/g)?.length, 3, 'every class preview reads the same rows');
});
