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
test('a multi-hit card keeps its hit count after the number', () => {
  const flurry = { id: 'testFlurry', name: 'Flurry', type: 'attack', effects: [{ op: 'damage', target: 'enemy', amount: 3, hits: 3 }] };
  const [live] = cardEffectLine(flurry, { values: [{ op: 'damage', value: 4, hits: 3 }] }, null);
  assert.deepEqual([live.value, live.hits, live.after, live.dir], [4, 3, ' ×3', 'up']);
  const [authored] = cardEffectLine(flurry, null, null);
  assert.equal(authored.after, ' ×3', 'the authored hit count shows with no preview');
  const [single] = cardEffectLine({ ...flurry, effects: [{ op: 'damage', target: 'enemy', amount: 3 }] }, null, null);
  assert.equal(single.after, '', 'one hit shows no multiplier');
});
test('a counter payload returns HP, Poise and Ward as separate Return parts', () => {
  const payload = { id: 'testPayload', name: 'Rebuke', type: 'attack', tags: ['maneuver:counter', 'camp:physical'],
    counterPayload: { hp: 4, poise: 3, ward: 2 }, effects: [{ op: 'block', target: 'self', amount: 5 }] };
  const rows = cardEffectLine(payload, { values: [{ op: 'block', value: 5 }, { op: 'damage', value: 6 }, { op: 'poiseDamage', value: 3 }] }, null);
  assert.deepEqual(rows.map(row => `${row.before}${row.value}${row.after}`), ['Def 5', 'Return 6', 'Return 3 Poise', 'Return 2 Ward']);
  assert.deepEqual(rows.map(row => row.dir), [null, 'up', null, null]);
});
test('a counter with Poise and Ward effects reads them as Return parts', () => {
  const effects = { id: 'testCounterFx', name: 'Rebuke', type: 'attack', tags: ['maneuver:counter', 'camp:physical'],
    effects: [{ op: 'poiseDamage', target: 'enemy', amount: 3 }, { op: 'wardDamage', target: 'enemy', amount: 2 }] };
  assert.deepEqual(cardEffectLine(effects, null, null).map(row => `${row.before}${row.value}${row.after}`), ['Return 3 Poise', 'Return 2 Ward']);
});
// The screens cannot run here without a browser, so these pin the two call-site rules by source.
import { readFileSync } from 'node:fs';
test('co-op base reaction options resolve at tier 0, not the hand-selected tier', () => {
  const source = readFileSync(new URL('../src/ui/screens/coop.js', import.meta.url), 'utf8');
  assert.match(source, /cardDef\(inst, o\.play\.upcastTier \|\| 0\)/);
});
test('solo round reactions preview against the pending offer attacker', () => {
  const source = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
  assert.match(source, /o\.play\.targetId \?\? o\.sourceId \?\? pending\.sourceId/);
});
