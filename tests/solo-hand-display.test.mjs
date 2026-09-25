// The creation screen's hand numbers are the hand a solo fight deals
// (model/soloHand.js), not the derived Draw row, which feeds co-op only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { attributeCardModels } from '../src/model/creationBrief.js';
import { statProjection } from '../src/model/statProjection.js';
import { soloHandRules, soloHandSummary, soloHandFacts } from '../src/model/soloHand.js';
import { HAND_RULES_PREFIX } from '../src/model/handRules.js';

const registries = createRegistries(contentBundle);
const CLASSES = ['reaver', 'rogue', 'herald', 'starseer'];

function dealt(run, settings = {}) {
  return createRunCombat({ registries, rng: createRng(7), run, enemyIds: ['wanderingSoldier'], settings }).piles.hand.length;
}

test('the summary\'s opening hand is the hand a solo fight of that class deals', () => {
  for (const classId of CLASSES) {
    const run = createRunState({ seed: 7, classId, registries });
    const summary = soloHandSummary(soloHandRules(registries, classId, {}), run.attributes);
    assert.equal(Math.min(summary.opening, run.deck.length), dealt(run), `${classId} Standard opening hand`);
    assert.ok(summary.turn >= 0 && summary.turn <= summary.capacity, `${classId}: a turn draw never exceeds capacity`);
    assert.match(summary.formulas.opening, new RegExp(`= ${summary.opening}$`));
  }
});

test('the summary follows Settings the way the fight does', () => {
  const settings = { [`${HAND_RULES_PREFIX}startingByClass.reaver.base`]: 5 };
  const run = createRunState({ seed: 7, classId: 'reaver', registries });
  const summary = soloHandSummary(soloHandRules(registries, 'reaver', settings), run.attributes);
  assert.equal(Math.min(summary.opening, run.deck.length), dealt(run, settings));
  const fill = soloHandSummary(soloHandRules(registries, 'reaver', { [`${HAND_RULES_PREFIX}drawMode`]: 'fill' }), run.attributes);
  assert.equal(fill.turn, fill.capacity, 'fill mode draws up to capacity');
});

test('the primary stat card states the opening-hand effect; no card claims Draw sets it', () => {
  for (const classId of CLASSES) {
    const run = createRunState({ seed: 7, classId, registries });
    const hand = soloHandRules(registries, classId, {});
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
  assert.equal(soloHandFacts(soloHandRules(registries, 'reaver', {}), 'strength')[0].label, 'Opening hand');
});
