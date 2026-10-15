import test from 'node:test';
import assert from 'node:assert/strict';
import { statusRulePresentation } from '../src/ui/models/StatusRulePresentation.js';
import { contentBundle } from '../src/content/index.js';
import { resolveStackApplications, stackMagnitude } from '../src/model/combatRules.js';

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

test('every standard timed stack mode states that reapplication resets expiry', () => {
  for (const stackMode of ['add', 'refresh', 'unique']) {
    assert.match(statusRulePresentation({ stackMode, decay: { duration: 2 } }).stackingText,
      /Reapplying resets the duration\./);
  }
});

test('standard unique status and consume lifetime use their authored rules', () => {
  assert.deepEqual(statusRulePresentation({ stackMode: 'unique', decay: { duration: 2 } }), {
    durationText: 'Expires after 2 owner turns; stacks stay until expiry.',
    stackingText: 'Remains at 1 stack. Reapplying resets the duration.',
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
    stackingText: 'Remains at 1 stack. Reapplying resets the duration.',
  });
  assert.deepEqual(statusRulePresentation(status, { foundation: true }), {
    durationText: 'Applications expire after 3 turns at the start of their owner’s turn.',
    stackingText: 'Applications add together. Capped at 5. Reapplication resets the expiry.',
  });
});

test('foundation modes expose cap, expiry refresh and clock from the policy', () => {
  assert.deepEqual(statusRulePresentation({ stackMode: 'add', decay: 'none', stacking: {
    mode: 'refresh', cap: 7, duration: 2, clock: 'ownerTurnEnd', refresh: false,
  } }, { foundation: true }), {
    durationText: 'Applications expire after 2 turns at the end of their owner’s turn.',
    stackingText: 'Keeps the existing value on reapplication. Capped at 7. Reapplication keeps the existing expiry.',
  });
  assert.equal(statusRulePresentation({ stacking: { mode: 'strongest', cap: 4 } }, { foundation: true }).stackingText,
    'Uses the strongest application, with each source replacing its own prior value. Capped at 4.');
  assert.equal(statusRulePresentation({ stacking: { mode: 'unique', cap: 3 } }, { foundation: true }).stackingText,
    'Keeps one application.');
});

test('foundation refresh preserves old value while refreshing expiry by default', () => {
  const rules = { mode: 'refresh', cap: 10 };
  const first = resolveStackApplications([], { sourceId: 'a', value: 4, expires: 2 }, rules);
  const reapplied = resolveStackApplications(first, { sourceId: 'b', value: 8, expires: 3 }, rules);
  assert.equal(stackMagnitude(reapplied, 'refresh', 10), 4);
  assert.equal(reapplied[0].expires, 3);

  const noExpiryRefresh = resolveStackApplications(first, { sourceId: 'b', value: 8, expires: 3 }, { ...rules, refresh: false });
  assert.equal(stackMagnitude(noExpiryRefresh, 'refresh', 10), 4);
  assert.equal(noExpiryRefresh[0].expires, 2);
});

test('foundation strongest and independent modes replace same-source values', () => {
  const firstSource = [{ sourceId: 'a', value: 4, expires: 2 }];
  const strongestSameSource = resolveStackApplications(firstSource, { sourceId: 'a', value: 8, expires: 3 }, { mode: 'strongest', cap: 20 });
  assert.equal(strongestSameSource.length, 1);
  assert.equal(stackMagnitude(strongestSameSource, 'strongest', 20), 8);
  const strongestOtherSource = resolveStackApplications(strongestSameSource, { sourceId: 'b', value: 6, expires: 3 }, { mode: 'strongest', cap: 20 });
  assert.equal(strongestOtherSource.length, 2);
  assert.equal(stackMagnitude(strongestOtherSource, 'strongest', 20), 8);

  const independentSameSource = resolveStackApplications(firstSource, { sourceId: 'a', value: 8, expires: 3 }, { mode: 'independent', cap: 20 });
  assert.equal(independentSameSource.length, 1);
  assert.equal(stackMagnitude(independentSameSource, 'independent', 20), 8);
  const independentOtherSource = resolveStackApplications(independentSameSource, { sourceId: 'b', value: 6, expires: 3 }, { mode: 'independent', cap: 20 });
  assert.equal(independentOtherSource.length, 2);
  assert.equal(stackMagnitude(independentOtherSource, 'independent', 20), 14);
});

test('foundation policy with no expiry says so; unknown policy values return null', () => {
  assert.deepEqual(statusRulePresentation({ stacking: { mode: 'independent', cap: 9 } }, { foundation: true }), {
    durationText: 'No timed expiry is defined.',
    stackingText: 'Adds values across sources; each source’s reapplication replaces its prior value. Capped at 9.',
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
    stackingText: 'Remains at 1 stack. Reapplying resets the duration.',
  });
});
