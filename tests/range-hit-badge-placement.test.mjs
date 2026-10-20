import test from 'node:test';
import assert from 'node:assert/strict';
import { hitBadgeCenter } from '../src/ui/components/battlefieldStage.js';
test('long current-range label stays visible at either phone flank without moving the actor', () => {
  assert.equal(hitBadgeCenter({ bodyCenter: 270, badgeWidth: 208, left: 8, right: 312 }), 208);
  assert.equal(hitBadgeCenter({ bodyCenter: 25, badgeWidth: 208, left: 8, right: 312 }), 112);
  assert.equal(hitBadgeCenter({ bodyCenter: 160, badgeWidth: 208, left: 8, right: 312 }), 160);
  assert.equal(hitBadgeCenter({ bodyCenter: 25, badgeWidth: 320, left: 8, right: 312 }), 160);
});
