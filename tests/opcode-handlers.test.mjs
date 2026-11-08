// runOpcode dispatches through OPCODE_HANDLERS / RUN_OPCODE_HANDLERS (code review H3). The schema lists
// are the authored vocabulary; the handler maps must cover exactly that vocabulary, no more, no less.
import test from 'node:test';
import assert from 'node:assert/strict';
import { COMBAT_OPCODES, RUN_OPCODES } from '../src/model/schemas.js';
import { OPCODE_HANDLERS, RUN_OPCODE_HANDLERS } from '../src/engine/actions.js';

// Combat opcodes resolved before the map is consulted: runGuardStackOpcode (counter and reflect stacks)
// and executeAction (completeCombatAction goes to the expansion module).
const HANDLED_OUTSIDE_MAP = ['gainCounterStacks', 'applyReflect', 'completeCombatAction'];

test('every combat opcode has a handler and every handler is a combat opcode', () => {
  for (const op of COMBAT_OPCODES.filter((o) => !HANDLED_OUTSIDE_MAP.includes(o))) assert.equal(typeof OPCODE_HANDLERS[op], 'function', `no handler for combat opcode '${op}'`);
  for (const op of Object.keys(OPCODE_HANDLERS)) assert.ok(COMBAT_OPCODES.includes(op), `handler '${op}' is not in COMBAT_OPCODES`);
  for (const op of HANDLED_OUTSIDE_MAP) assert.ok(!(op in OPCODE_HANDLERS), `'${op}' is handled before the map; drop it from HANDLED_OUTSIDE_MAP or the map`);
});

test('every run opcode has a handler and every handler is a run opcode', () => {
  for (const op of RUN_OPCODES) assert.equal(typeof RUN_OPCODE_HANDLERS[op], 'function', `no handler for run opcode '${op}'`);
  for (const op of Object.keys(RUN_OPCODE_HANDLERS)) assert.ok(RUN_OPCODES.includes(op), `handler '${op}' is not in RUN_OPCODES`);
});

test('the handler maps are frozen', () => {
  assert.ok(Object.isFrozen(OPCODE_HANDLERS));
  assert.ok(Object.isFrozen(RUN_OPCODE_HANDLERS));
});
