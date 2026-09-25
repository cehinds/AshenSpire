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
