// tests/roll-log.test.mjs — every roll logs "<what>: <total> vs <DC> · verdict", and the full-detail
// log itemises it (owner, 2026-10-31; SPEC combat log). Run: node --test tests/roll-log.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { combatLogEntries } from '../src/model/combatLog.js';
import { rollReceiptLines } from '../src/ui/components/rollReceipt.js';

const registries = createRegistries(contentBundle);
const enemies = [{ id: 'e1', enemyId: 'wyrmLord' }];
const rows = events => combatLogEntries(events, { registries, enemies });
const one = event => rows([event])[0];

test('accuracy: compact total vs Evasion, itemised in the receipt', () => {
  const row = one({ type: 'attackHit', sourceId: 'player', targetId: 'e1', fixedDefense: true, cardId: 'strike',
    dice: [8, 13], d20: 8, attackTotal: 17, accuracy: 4, evasion: 9, evasionTotal: 9, hitChance: 96, mode: 'advantage' });
  assert.match(row.text, /: 17 vs 9 · hit$/);
  assert.deepEqual(row.rollReceipt, { kind: 'accuracy', die: 'd20', dice: [8, 13], mode: 'advantage', success: true, chance: 96,
    parts: [{ label: 'Precision', value: 4 }], total: 17, dcParts: [{ label: 'Evasion', value: 9 }], dc: 9 });
  assert.deepEqual(rollReceiptLines(row.rollReceipt), ['d20 [8, 13] → 13 · advantage', '+ Precision 4', '= 17', 'vs Evasion 9', 'hit · 96%']);
});

test('accuracy: itemised Precision pieces on the event are shown when present; a miss reads miss', () => {
  const row = one({ type: 'attackMissed', sourceId: 'player', targetId: 'e1', fixedDefense: true, dice: [3], attackTotal: 7, accuracy: 4,
    precisionParts: [{ label: 'Precision', value: 4, note: 'mix 2 + stacks 2' }], evasion: 9, evasionTotal: 9, mode: 'normal' });
  assert.match(row.text, /: 7 vs 9 · miss$/);
  assert.equal(rollReceiptLines(row.rollReceipt)[1], '+ Precision 4 (mix 2 + stacks 2)');
});

test('an automatic outcome (no die) carries no roll receipt', () => {
  const row = one({ type: 'attackHit', sourceId: 'player', targetId: 'e1', opposed: true, bypass: true, dice: [], accuracy: 4, evasion: 3 });
  assert.equal(row.rollReceipt, undefined);
});

test('contest: compact and itemised', () => {
  const contest = { roll: 5, parts: [{ id: 'intelligence', value: 1 }, { id: 'wisdom', value: 2 }], rank: 1, total: 9,
    dcParts: [{ id: 'poise', value: 7 }, { id: 'wisdom', value: 1 }, { id: 'level', value: 1 }], dc: 9, passed: true };
  const row = one({ type: 'contestPassed', sourceId: 'player', targetId: 'e1', cardId: 'strike', contest });
  assert.match(row.text, /Strike contest: 9 vs 9 · success$/);
  assert.deepEqual(rollReceiptLines(row.rollReceipt), ['d20 [5]', '+ INT 1', '+ WIS 2', '+ rank 1', '= 9', 'vs Poise 7', '+ WIS 1', '+ level 1', '= 9', 'success']);
});

test('crit, perception, status chance and status recovery log total vs DC', () => {
  const crit = one({ type: 'critRolled', sourceId: 'player', targetId: 'e1', roll: 12.4, chance: 15, multiplier: 2, success: true });
  assert.match(crit.text, /Crit: 12.4 vs 15 · crit$/);
  assert.deepEqual(rollReceiptLines(crit.rollReceipt), ['d100 [12.4]', '= 12.4', 'needs < Crit chance % 15', 'crit']);
  const perception = one({ type: 'perceptionRolled', ownerId: 'player', enemyInstanceId: 'e1', roll: 9, wisdom: 3, total: 12, dc: 8, passed: true,
    dcParts: [{ label: 'base', value: 5 }, { label: 'INT', value: 2 }, { label: 'WIS', value: 1 }] });
  assert.match(perception.text, /Perception: 12 vs 8 · read$/);
  assert.deepEqual(rollReceiptLines(perception.rollReceipt).slice(0, 4), ['d20 [9]', '+ WIS 3', '= 12', 'vs base 5']);
  const buildup = one({ type: 'statusChanceRolled', status: 'burn', targetId: 'e1', rolls: [34], roll: 34, chance: 45, effectiveChance: 45, success: true });
  assert.match(buildup.text, /Burn buildup: 34 vs 45 · success$/);
  const recovery = one({ type: 'statusRecoveryRolled', status: 'burn', targetId: 'e1', rolls: [60, 20], roll: 20, chance: 30, effectiveChance: 51, success: true });
  assert.match(recovery.text, /Burn recovery: 20 vs 30 · success$/);
  assert.equal(recovery.rollReceipt.mode, 'advantage');
});

// ---- engine events ---------------------------------------------------------------------------------------------
import { EVENTS, TRIGGER_EVENTS } from '../src/model/schemas.js';
import { rollCrit } from '../src/engine/actions.js';

test('each new roll event is registered', () => {
  for (const type of ['critRolled', 'perceptionRolled', 'statusChanceRolled', 'statusRecoveryRolled']) {
    assert.ok(EVENTS.includes(type), type);
    assert.ok(TRIGGER_EVENTS.includes(type), type);
  }
});

test('rollCrit emits critRolled and keeps its single combatProcs draw', () => {
  const events = [], draws = [];
  const ctx = { attributes: { dexterity: 10 }, emit: (type, payload) => events.push({ type, ...payload }),
    rng: { float: stream => { draws.push(stream); return 0.124; } } };
  const source = { kind: 'player', id: 'player', critRules: [{ tags: ['attack'], base: 0.15, multiplier: 2, cap: 1 }] };
  assert.equal(rollCrit(ctx, source, ['attack'], { targetId: 'e1', cardId: 'strike' }), 2);
  assert.deepEqual(draws, ['combatProcs']);
  assert.deepEqual(events, [{ type: 'critRolled', sourceId: 'player', targetId: 'e1', cardId: 'strike', roll: 12.4, chance: 15, multiplier: 2, success: true }]);
  ctx.rng.float = () => 0.9;
  assert.equal(rollCrit(ctx, source, ['attack']), 0);
  assert.equal(events[1].success, false);
  assert.equal(rollCrit(ctx, source, ['spell']), 0, 'no matching rule: no draw, no event');
  assert.equal(events.length, 2);
});


import { rollStatusChance } from '../src/engine/combatStatusControl.js';
test('rollStatusChance emits statusChanceRolled only when labelled, with the same draws', () => {
  const make = () => { const events = [], draws = []; return { events, draws, ctx: { emit: (type, payload) => events.push({ type, ...payload }),
    rng: { int: (stream, lo, hi) => { draws.push([stream, lo, hi]); return 34; } } } }; };
  const quiet = make(), loud = make();
  const a = rollStatusChance(quiet.ctx, 45, { stream: 'statusPressure' });
  const b = rollStatusChance(loud.ctx, 45, { stream: 'statusPressure', event: { status: 'burn', targetId: 'e1' } });
  assert.deepEqual(a, b);
  assert.deepEqual(quiet.draws, loud.draws);
  assert.equal(quiet.events.length, 0);
  assert.deepEqual(loud.events, [{ type: 'statusChanceRolled', status: 'burn', targetId: 'e1', rolls: [34], roll: 34, chance: 45, effectiveChance: 45, success: true }]);
});

test('Dodge and Evade keep their sentences and add an itemised receipt', () => {
  const dodge = one({ type: 'dodgeRolled', sourceId: 'player', success: true, roll: 9, check: 12, difficulty: 10, temporaryGuard: 3 });
  assert.match(dodge.text, /Dodge roll 12 beat 10/);
  assert.deepEqual(rollReceiptLines(dodge.rollReceipt), ['d20 [9]', '+ Dexterity + Weight Class 3', '= 12', 'vs DC 10', 'success']);
  const evade = one({ type: 'combatAvoidanceResolved', sourceId: 'e1', targetId: 'player', evade: { roll: 7, total: 9, difficulty: 12, success: false } });
  assert.deepEqual(rollReceiptLines(evade.rollReceipt), ['d20 [7]', '+ bonus 2', '= 9', 'vs DC 12', 'fail']);
});
