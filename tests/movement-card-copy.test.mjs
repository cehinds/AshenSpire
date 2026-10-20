import test from 'node:test';
import assert from 'node:assert/strict';
import { combatCardSummary } from '../src/model/playingCard.js';
import { summarizeCardOption } from '../src/ui/models/CardOptionSummaryModel.js';

const card = effects => ({ id: 'movement-copy', name: 'Movement', type: 'skill', effects });

test('movement summaries distinguish closing from retreating and the affected opponent', () => {
  for (const [bands, target, expected] of [
    [-1, 'enemy', 'Close 1 band toward target.'],
    [1, 'enemy', 'Retreat 1 band from target.'],
    [-1, 'pendingAttacker', 'Close 1 band toward attacker.'],
    [1, 'pendingAttacker', 'Retreat 1 band from attacker.'],
  ]) assert.equal(combatCardSummary(card([{ op: 'moveEngagement', bands, target }])), expected);
});

test('movement keeps conditions and refuses to misdescribe an unsupported movement', () => {
  assert.equal(combatCardSummary(card([{ op: 'moveEngagement', target: 'enemy', bands: -1,
    if: { p: 'firstCardThisTurn' } }])), 'If this is your first card this turn: close 1 band toward target.');
  for (const effect of [
    { op: 'moveEngagement', target: 'allEnemies', bands: -1 },
    { op: 'moveEngagement', target: 'enemy', bands: 2 },
  ]) assert.equal(combatCardSummary(card([effect])), null);
});

test('a defensive movement picker keeps both Evade and the movement direction', () => {
  const def = card([{ op: 'applyStatus', target: 'self', status: 'evade', stacks: 2 },
    { op: 'moveEngagement', target: 'pendingAttacker', bands: 1 }]);
  const result = summarizeCardOption(null, {}, { id: 'choice' }, { defOf: () => def });
  assert.match(result.html, /(?:2 Evade|Evade.*2)/);
  assert.match(result.html, /Retreat.*1.*band.*attacker/i);
});
