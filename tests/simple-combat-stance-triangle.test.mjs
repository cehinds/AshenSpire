// stances.ruleset triangle (docs/design/SIMPLE-COMBAT-PLAN.md step 2a): attack, defend, smash
// and skill; the default maneuvers ruleset keeps today's rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import { StanceRuleset } from '../src/model/simpleCombatFlags.js';
import {
  SimpleCombatFixture,
  SimpleCombatRegistries,
  SimpleCombatFight,
} from './helpers/simple-combat.mjs';

const TRIANGLE = 'triangle';
const MANEUVERS = 'maneuvers';
const PROBE = SimpleCombatFixture.triangleProbe;

test('stances.ruleset: missing, unknown or absent profiles play the maneuvers', () =>
{
  for (const row of PROBE.rulesetCases)
  {
    assert.equal(StanceRuleset(row.subject), row.expected, row.$note);
  }
});

test('stances.ruleset: Core stays on maneuvers; the triangle override turns it on', () =>
{
  assert.equal(StanceRuleset(SimpleCombatFight(SimpleCombatRegistries())), MANEUVERS);
  assert.equal(StanceRuleset(SimpleCombatFight(SimpleCombatRegistries(TRIANGLE))), TRIANGLE);
});
