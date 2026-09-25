// The creation screen's hand numbers are the hand a solo fight deals, read
// through the one door (`classHandRules`, model/handRules.js) combat
// snapshots — not the derived Draw row, which feeds co-op only. The Hand and
// Draw chips' parity with the dealt hand under the shipped and legacy rules
// lives in tests/hand-rules.test.mjs; this file covers what it does not: a
// per-class Settings override, fill mode, and the attribute cards' facts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { attributeCardModels } from '../src/model/creationBrief.js';
import { statProjection, handResourceRows } from '../src/model/statProjection.js';
import { classHandRules, handRuleFacts, HAND_RULES_PREFIX } from '../src/model/handRules.js';

const registries = createRegistries(contentBundle);
const CLASSES = ['reaver', 'rogue', 'herald', 'starseer'];
const rulesFor = (classId, settings = {}) => classHandRules(settings, registries.attributes.all(), classId);
const chip = (run, settings, id) => handResourceRows(registries, run, settings).find((row) => row.id === id);

function dealt(run, settings = {}) {
  return createRunCombat({ registries, rng: createRng(7), run, enemyIds: ['wanderingSoldier'], settings }).piles.hand.length;
}

test('the Hand chip follows a per-class Settings override the way the fight does', () => {
  const settings = { [`${HAND_RULES_PREFIX}startingByClass.reaver.base`]: 5 };
  const run = createRunState({ seed: 7, classId: 'reaver', registries });
  const hand = chip(run, settings, 'openingHand');
  assert.notEqual(hand.value, chip(run, {}, 'openingHand').value, 'the override moves the chip');
  assert.equal(Math.min(hand.value, run.deck.length), dealt(run, settings));
});

test('in fill mode the Draw chip tops the hand up to capacity', () => {
  const settings = { [`${HAND_RULES_PREFIX}drawMode`]: 'fill' };
  for (const classId of CLASSES) {
    const run = createRunState({ seed: 7, classId, registries });
    const draw = chip(run, settings, 'draw');
    assert.match(draw.formula, /draw until the hand holds (\d+)$/);
    assert.equal(draw.value, Number(draw.formula.match(/holds (\d+)$/)[1]), `${classId}: fill draws capacity into an empty hand`);
  }
});

test('the primary stat card states the opening-hand effect; no card claims Draw sets it', () => {
  for (const classId of CLASSES) {
    const run = createRunState({ seed: 7, classId, registries });
    const hand = rulesFor(classId);
    const cards = attributeCardModels(registries, run.attributes, { projection: statProjection(registries, run), hand });
    const primary = cards.find((card) => card.id === hand.starting.stat);
    const per = hand.starting.pointsPerCard;
    assert.ok(primary.face.summary.includes(`+1 Opening hand per ${per === 1 ? 'pt' : `${per} pts`} (max ${hand.starting.maximum})`),
      `${classId}: ${primary.face.summary}`);
    assert.ok(primary.reveal.lines.some((line) => line.startsWith('Opening hand +1 every')), `${classId}: the fold says it too`);
    for (const card of cards) {
      assert.ok(!/opening hand/i.test(card.face.summary.replace('Opening hand per', '')), `${classId} ${card.id}: ${card.face.summary}`);
      assert.ok(!/\bDraw\b/.test(card.face.summary), `${classId} ${card.id}: the co-op Draw row stays off the solo face`);
      if (card.id !== hand.starting.stat) assert.ok(!card.face.summary.includes('Opening hand'), `${classId} ${card.id}`);
    }
  }
  // Without solo rules (co-op / headless readers) the Draw row still reads,
  // and it no longer claims the opening hand.
  const run = createRunState({ seed: 7, classId: 'starseer', registries });
  const plain = attributeCardModels(registries, run.attributes, { projection: statProjection(registries, run) });
  const intelligence = plain.find((card) => card.id === 'intelligence');
  assert.ok(intelligence.reveal.lines.some((line) => line.startsWith('Draw / turn (co-op)')), intelligence.reveal.lines.join(' | '));
  assert.ok(!plain.some((card) => /opening hand/i.test(`${card.face.summary} ${card.reveal.lines.join(' ')}`)));
  assert.equal(handRuleFacts(rulesFor('reaver'), 'strength')[0].label, 'Opening hand');
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

test('the Shrine level-up cards read the solo hand the next fight deals', () => {
  const rest = source('rest.js');
  const call = rest.slice(rest.indexOf('const cards = new Map(attributeCardModels(registries, values, {'));
  assert.match(call.slice(0, call.indexOf('}).map(')), /hand: classHandRules\(meta\?\.settings \|\| \{\}, registries\.attributes\.all\(\), run\.class\)/);
  // What those rules put on the face: a per-class override moves the primary card.
  const settings = { [`${HAND_RULES_PREFIX}startingByClass.reaver.stat`]: 'constitution' };
  const run = createRunState({ seed: 7, classId: 'reaver', registries });
  const cards = attributeCardModels(registries, run.attributes, { projection: statProjection(registries, run), hand: rulesFor('reaver', settings) });
  assert.ok(cards.find((card) => card.id === 'constitution').face.summary.includes('Opening hand'), 'the override reaches the level-up card');
  assert.ok(!cards.find((card) => card.id === 'strength').face.summary.includes('Opening hand'));
});

test('the in-combat Armoury cards read the running fight\'s own hand rules', () => {
  const combat = source('combat.js');
  const mount = combat.slice(combat.indexOf('const panel = mountEquipment(document.body, {'));
  assert.match(mount.slice(0, mount.indexOf('inCombat: true')), /handRules: combat\.handRules \|\| classHandRules\(readSettings\(\), registries\.attributes\.all\(\), run\.class\)/);
  const equipment = source('equipment.js');
  assert.match(equipment, /hand: handRules \|\| classHandRules\(meta\.settings \|\| \{\}, registries\.attributes\.all\(\), run\.class\)/);
  // The fight's snapshot carries the override its profile set, so the cards do too.
  const settings = { [`${HAND_RULES_PREFIX}startingByClass.starseer.stat`]: 'wisdom' };
  const run = createRunState({ seed: 7, classId: 'starseer', registries });
  const fight = createRunCombat({ registries, rng: createRng(7), run, enemyIds: ['wanderingSoldier'], settings });
  const cards = attributeCardModels(registries, run.attributes, { projection: statProjection(registries, run), hand: fight.handRules });
  assert.ok(cards.find((card) => card.id === 'wisdom').face.summary.includes('Opening hand'));
  assert.ok(!cards.find((card) => card.id === 'intelligence').face.summary.includes('Opening hand'), 'not the authored default the synthetic meta resolved');
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
