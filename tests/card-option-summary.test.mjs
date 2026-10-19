// tests/card-option-summary.test.mjs — the picker tile line: live numbers, with their direction.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cardEffectLine, summarizeCardOption } from '../src/ui/models/CardOptionSummaryModel.js';

const counterDef = { id: 'testCounter', name: 'Counter', type: 'attack', tags: ['maneuver:counter', 'camp:physical'],
  effects: [{ op: 'block', target: 'self', amount: 5 }, { op: 'damage', target: 'enemy', amount: 4 }] };
const strikeDef = { id: 'testStrike', name: 'Strike', type: 'attack', effects: [{ op: 'damage', target: 'enemy', amount: 6 }] };
const line = (def, preview) => cardEffectLine(def, preview, null).map(row => `${row.label} ${row.value}${row.dir ? `:${row.dir}` : ''}`);

test('counter reads Def and Return from the live preview', () => {
  const preview = { values: [{ op: 'block', value: 7 }, { op: 'damage', value: 4 }] };
  assert.deepEqual(line(counterDef, preview), ['Def 7:up', 'Return 4']);
});
test('a lowered number is down, an unchanged one has no direction', () => {
  assert.deepEqual(line(strikeDef, { values: [{ op: 'damage', value: 3 }] }), ['Dmg 3:down']);
  assert.deepEqual(line(strikeDef, { values: [{ op: 'damage', value: 6 }] }), ['Dmg 6']);
});
test('with no preview the authored numbers show and nothing is coloured', () => {
  assert.deepEqual(line(counterDef, null), ['Def 5', 'Return 4']);
});
test('summarizeCardOption: name, line and cost chips; a missing reader gives a name-only tile', () => {
  const option = { id: 'o1', name: 'Counter', staminaCost: 2, manaCost: 1, play: { cardInstanceId: 'c1', targetId: 'e1' } };
  const full = summarizeCardOption(null, {}, option, { defOf: () => counterDef,
    previewOf: (opt) => { assert.equal(opt.play.targetId, 'e1'); return { values: [{ op: 'block', value: 7 }, { op: 'damage', value: 4 }] }; } });
  assert.equal(full.name, 'Counter');
  assert.deepEqual(full.costs, ['2 SP', '1 MP']);
  assert.equal(full.line[0].dir, 'up');
  const bare = summarizeCardOption(null, {}, option);
  assert.deepEqual(bare.line, []);
  const broken = summarizeCardOption(null, {}, option, { defOf: () => { throw new Error('no card'); } });
  assert.deepEqual(broken.line, []);
});
test('a gain row places its number first and keeps a plain label', () => {
  const healDef = { id: 'testHeal', name: 'Mend', type: 'skill', effects: [{ op: 'heal', target: 'self', amount: 5 }] };
  const [row] = cardEffectLine(healDef, { values: [{ op: 'heal', value: 5 }] }, null);
  assert.equal(row.label, 'HP');
  assert.equal(row.before, '+');
  assert.equal(row.after, ' HP');
});
test('a non-spell Barrier gain is labelled Barrier, not Def', () => {
  const barrierDef = { id: 'testBarrier', name: 'Brace', type: 'skill', tags: ['camp:physical'], effects: [{ op: 'gainBarrier', target: 'self', amount: 4 }] };
  const rows = cardEffectLine(barrierDef, { values: [{ op: 'gainBarrier', value: 6 }] }, null);
  assert.deepEqual(rows.map(row => [row.label, row.value, row.dir, row.before, row.after]), [['Barrier', 6, 'up', '+', ' Barrier']]);
});
