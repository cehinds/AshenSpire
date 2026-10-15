import test from 'node:test';
import assert from 'node:assert/strict';
import { statusRulePresentation } from '../src/ui/models/StatusRulePresentation.js';
import { contentBundle } from '../src/content/index.js';

test('standard additive statuses distinguish no timed expiry from stack decay', () => {
  assert.deepEqual(statusRulePresentation({ stackMode: 'add', decay: 'none' }), {
    durationText: 'No timed expiry; may be consumed or removed.',
    stackingText: 'Applications add stacks.',
  });
  assert.deepEqual(statusRulePresentation({ stackMode: 'add', decay: 'perTurnEnd' }), {
    durationText: 'Loses 1 stack at the end of its owner’s turn.',
    stackingText: 'Applications add stacks.',
  });
});

test('standard timed status explains duration and refresh without inventing a cap', () => {
  assert.deepEqual(statusRulePresentation({ stackMode: 'refresh', decay: { duration: 2 } }), {
    durationText: 'Expires after 2 owner turns; stacks stay until expiry.',
    stackingText: 'Keeps the higher stack count. Reapplying resets the duration.',
  });
});

test('standard unique status and consume lifetime use their authored rules', () => {
  assert.deepEqual(statusRulePresentation({ stackMode: 'unique', decay: { duration: 2 } }), {
    durationText: 'Expires after 2 owner turns; stacks stay until expiry.',
    stackingText: 'Remains at 1 stack.',
  });
  assert.deepEqual(statusRulePresentation({ stackMode: 'refresh', decay: 'onConsume' }), {
    durationText: 'Lasts until consumed.',
    stackingText: 'Keeps the higher stack count.',
  });
});

test('unknown standard mode or decay produces no invented copy', () => {
  assert.deepEqual(statusRulePresentation({ stackMode: 'multiply', decay: 'forever' }), {
    durationText: null,
    stackingText: null,
  });
});

test('foundation policy is selected only when requested, and stays separate from stackMode', () => {
  const status = {
    stackMode: 'unique',
    decay: { duration: 4 },
    stacking: { mode: 'add', cap: 5, duration: 3, clock: 'ownerTurnStart' },
  };
  assert.deepEqual(statusRulePresentation(status), {
    durationText: 'Expires after 4 owner turns; stacks stay until expiry.',
    stackingText: 'Remains at 1 stack.',
  });
  assert.deepEqual(statusRulePresentation(status, { foundation: true }), {
    durationText: 'Applications expire after 3 turns at the start of their owner’s turn.',
    stackingText: 'Applications add together. Capped at 5.',
  });
});

test('foundation modes expose cap, expiry refresh and clock from the policy', () => {
  assert.deepEqual(statusRulePresentation({ stackMode: 'add', decay: 'none', stacking: {
    mode: 'refresh', cap: 7, duration: 2, clock: 'ownerTurnEnd', refresh: false,
  } }, { foundation: true }), {
    durationText: 'Applications expire after 2 turns at the end of their owner’s turn.',
    stackingText: 'Keeps the higher application value. Capped at 7. Reapplication keeps the existing expiry.',
  });
  assert.equal(statusRulePresentation({ stacking: { mode: 'strongest', cap: 4 } }, { foundation: true }).stackingText,
    'Uses the strongest active application. Capped at 4.');
  assert.equal(statusRulePresentation({ stacking: { mode: 'unique', cap: 3 } }, { foundation: true }).stackingText,
    'Keeps one application.');
});

test('foundation policy with no expiry says so; unknown policy values return null', () => {
  assert.deepEqual(statusRulePresentation({ stacking: { mode: 'independent', cap: 9 } }, { foundation: true }), {
    durationText: 'No timed expiry is defined.',
    stackingText: 'Applications remain separate and add together. Capped at 9.',
  });
  assert.deepEqual(statusRulePresentation({ stacking: { mode: 'mystery', cap: 2, duration: 2, clock: 'ownerTurnEnd' } }, { foundation: true }), {
    durationText: 'Applications expire after 2 turns at the end of their owner’s turn.',
    stackingText: null,
  });
  assert.deepEqual(statusRulePresentation({ stacking: { mode: 'add', cap: 2, duration: 2, clock: 'combatEnd' } }, { foundation: true }), {
    durationText: null,
    stackingText: 'Applications add together. Capped at 2.',
  });
});

test('status without a usable canonical rule does not imply combat lifetime', () => {
  assert.deepEqual(statusRulePresentation({}), { durationText: null, stackingText: null });
  assert.deepEqual(statusRulePresentation(null), { durationText: null, stackingText: null });
});

test('representative shipped statuses use their canonical definitions', () => {
  const status = id => contentBundle.statuses.find(row => row.id === id);
  assert.deepEqual(statusRulePresentation(status('burn')), {
    durationText: 'Loses 1 stack at the end of its owner’s turn.',
    stackingText: 'Applications add stacks.',
  });
  assert.deepEqual(statusRulePresentation(status('strength')), {
    durationText: 'No timed expiry; may be consumed or removed.',
    stackingText: 'Applications add stacks.',
  });
  assert.deepEqual(statusRulePresentation(status('concealed')), {
    durationText: 'Expires after 2 owner turns; stacks stay until expiry.',
    stackingText: 'Keeps the higher stack count. Reapplying resets the duration.',
  });
  assert.deepEqual(statusRulePresentation(status('stoneskin')), {
    durationText: 'Expires after 2 owner turns; stacks stay until expiry.',
    stackingText: 'Remains at 1 stack.',
  });
});
