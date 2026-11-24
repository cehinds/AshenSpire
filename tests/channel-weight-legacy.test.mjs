// Review fix: a run resumed from an old runtime snapshot (attackRatingWeight / defenseRatingWeight) keeps its STR/DEX/INT contribution.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ChannelWeight } from '../src/model/damageChannels.js';

test('old effects keys feed the channels when the new keys are missing', () => {
  const old = { attackRatingWeight: 1, defenseRatingWeight: 2 };
  assert.deepEqual(['ar', 'dr', 'pr'].map(id => ChannelWeight(old, id)), [1, 2, 1]);
});
test('new keys win, and a module with neither states 0', () => {
  assert.equal(ChannelWeight({ strengthDamageWeight: 3, attackRatingWeight: 1 }, 'ar'), 3);
  assert.equal(ChannelWeight({}, 'dr'), 0);
  assert.equal(ChannelWeight(undefined, 'pr'), 0);
});
