import test from 'node:test';
import assert from 'node:assert/strict';
import { counterstrikeAmount, counterstrikePct, hasStanceAdvantage, traitHitAmount, stanceManeuverOf } from '../src/engine/combatCardTraitMath.js';

test('counterstrike adds max(floor(a × pct), 1) and leaves zero alone', () => {
  assert.equal(counterstrikeAmount(6, 0.5), 9);
  assert.equal(counterstrikeAmount(6, 0.75), 10);
  assert.equal(counterstrikeAmount(1, 0.5), 2);
  assert.equal(counterstrikeAmount(0, 0.5), 0);
});

test('counterstrike reaches 75% only with stance advantage', () => {
  assert.equal(counterstrikePct(null, 'attack', 'smash'), 0.75);
  assert.equal(counterstrikePct(null, 'smash', 'attack'), 0.5);
  assert.equal(counterstrikePct(null, 'counter', null), 0.5);
  assert.equal(hasStanceAdvantage(null, 'casting', 'attack'), false);
});

test('impact and flux double an own amount or add N', () => {
  assert.equal(traitHitAmount(3, 2), 3);
  assert.equal(traitHitAmount(0, 2), 2);
});

test('an enemy stance reads the resolving move first', () => {
  const enemy = { combatStance: { maneuver: 'defend' }, intent: { combatProfile: { maneuver: 'smash' } } };
  assert.equal(stanceManeuverOf(enemy, 'sweep'), 'sweep');
  assert.equal(stanceManeuverOf(enemy), 'defend');
  assert.equal(stanceManeuverOf({ intent: { combatProfile: { maneuver: 'smash' } } }), 'smash');
});
