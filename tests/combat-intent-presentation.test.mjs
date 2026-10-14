import test from 'node:test';
import assert from 'node:assert/strict';
import { intentBadge, intentTooltip } from '../src/ui/uiContent.js';
import { enemyMoveCards } from '../src/model/enemyMoveCards.js';

const definition = { id: 'hitSequenceFixture', moves: { flurry: { intent: 'attack', damage: 5, hits: 3 } } };
const intent = { kind: 'attack', moveId: 'flurry', damage: 2, hits: 3, hitDamages: [2, 5, 5], totalDamage: 12 };

test('varying hit previews render their sequence and total in overhead, tooltip and current move catalog', () => {
  assert.equal(intentBadge(intent).label, '2+5+5');
  assert.match(intentTooltip(intent), /2 \+ 5 \+ 5 \(12 total\)/);
  assert.doesNotMatch(intentTooltip(intent), /2 × 3/);
  const [card] = enemyMoveCards(definition, { preview: intent });
  assert.equal(card.active, true);
  assert.match(card.detail, /2 \+ 5 \+ 5 \(12 total\) preview damage before Block/);
  assert.doesNotMatch(card.detail, /2 × 3/);
  assert.match(intentTooltip({ ...intent, pending: true }), /Committed:/);
});

test('uniform hits retain the existing multiplication display', () => {
  const uniform = { ...intent, damage: 5, hitDamages: [5, 5, 5], totalDamage: 15 };
  assert.equal(intentBadge(uniform).label, '5×3');
  assert.match(intentTooltip(uniform), /5 × 3 \(15 total\)/);
  assert.match(enemyMoveCards(definition, { preview: uniform })[0].detail, /5 × 3 preview damage before Block/);
});

test('hidden intents reject even malformed unsanitized per-hit preview fields', () => {
  const hidden = { ...intent, hidden: true };
  assert.equal(intentBadge(hidden).label, intentBadge({ kind: 'unknown' }).label);
  assert.equal(intentTooltip(hidden), intentTooltip({ kind: 'unknown' }));
  const [card] = enemyMoveCards(definition, { preview: hidden });
  assert.equal(card.active, false);
  assert.match(card.detail, /5 × 3 base damage/);
  assert.doesNotMatch(card.detail, /2 \+ 5 \+ 5|12 total|preview damage/);
});
