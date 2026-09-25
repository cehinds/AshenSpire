// The creation screen's hand numbers are the hand a solo fight deals, read
// through the one door (`classHandRules`, model/handRules.js) combat
// snapshots: the run's own hand rows (ruleset 7), the class's opening hand. The Hand and
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
import { configuredContentBundle } from '../src/model/advancedConfig.js';
import { classRuleRow, ruleWeights } from '../src/model/derivedStats.js';

const registries = createRegistries(contentBundle);
const CLASSES = ['reaver', 'rogue', 'herald', 'starseer'];
const rulesFor = (classId, settings = {}) => classHandRules(settings, registries, { class: classId });
const primaryOf = (classId) => ruleWeights(classRuleRow(registries.derivedStatRules, classId, 'openingHand'))[0][0];
const chip = (run, settings, id) => handResourceRows(registries, run, settings).find((row) => row.id === id);

function dealt(run, settings = {}) {
  return createRunCombat({ registries, rng: createRng(7), run, enemyIds: ['wanderingSoldier'], settings }).piles.hand.length;
}

test('the Hand chip follows a per-class Settings override the way the fight does', () => {
  const settings = { 'gameConfig.derivedStatRules.byClass.reaver.openingHand.base': 5 };
  // Settings reach a run at its birth, through the configured bundle (main.js).
  const tuned = createRegistries(configuredContentBundle(contentBundle, settings));
  const run = createRunState({ seed: 7, classId: 'reaver', registries: tuned });
  const stock = createRunState({ seed: 7, classId: 'reaver', registries });
  const hand = handResourceRows(tuned, run, settings).find((row) => row.id === 'openingHand');
  assert.notEqual(hand.value, chip(stock, {}, 'openingHand').value, 'the override moves the chip');
  assert.equal(Math.min(hand.value, run.deck.length), createRunCombat({ registries: tuned, rng: createRng(7), run, enemyIds: ['wanderingSoldier'], settings }).piles.hand.length);
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

test('the primary stat card states the opening-hand effect; no other card claims it', () => {
  for (const classId of CLASSES) {
    const run = createRunState({ seed: 7, classId, registries });
    const hand = rulesFor(classId);
    const primaryStat = primaryOf(classId);
    const cards = attributeCardModels(registries, run.attributes, { projection: statProjection(registries, run), hand });
    const primary = cards.find((card) => card.id === primaryStat);
    // #1294's cadence: one more card every 2 points of the primary, at most 6.
    assert.ok(primary.face.summary.includes('+1 Opening hand per 2 pts (max 6)'), `${classId}: ${primary.face.summary}`);
    assert.ok(primary.reveal.lines.some((line) => line.startsWith('Opening hand +1 every 2 points')), `${classId}: the fold says it too`);
    for (const card of cards) {
      if (card.id !== primaryStat) assert.ok(!card.face.summary.includes('Opening hand'), `${classId} ${card.id}: ${card.face.summary}`);
    }
  }
  assert.equal(handRuleFacts(rulesFor('reaver'), 'strength')[0].label, 'Opening hand');
  assert.deepEqual(handRuleFacts(rulesFor('reaver'), 'intelligence').map((fact) => fact.id), ['draw', 'handSize'], 'Intelligence still feeds the turn draw and the hand size');
});
