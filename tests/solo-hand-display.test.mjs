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
import { HAND_RULES_PREFIX } from '../src/model/handRules.js';
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
