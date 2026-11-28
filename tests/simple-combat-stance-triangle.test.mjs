// stances.ruleset triangle (docs/design/SIMPLE-COMBAT-PLAN.md step 2a): attack, defend, smash
// and skill; the default maneuvers ruleset keeps today's rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import { StanceRuleset } from '../src/model/simpleCombatFlags.js';
import { configuredStance } from '../src/model/profileStance.js';
import { stanceOf } from '../src/model/stanceRules.js';
import { setProfileStance, profileDamageReceipt } from '../src/engine/gameProfileCombat.js';
import { NeutralExtraDraw, StanceWeaknessMultiplier } from '../src/engine/stanceBenefits.js';
import { enemyMoveCarrier } from '../src/engine/combatCardTactics.js';
import {
  SimpleCombatFixture,
  SimpleCombatRegistries,
  SimpleCombatFight,
} from './helpers/simple-combat.mjs';

const TRIANGLE = 'triangle';
const MANEUVERS = 'maneuvers';
const SKILL = 'skill';
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

const NOTE_KEY = '$note';

function stanceRows(table)
{
  return Object.entries(table).filter(([id]) => id !== NOTE_KEY);
}

function cardCarrier(registries, cardId)
{
  return registries.cards.get(cardId);
}

test('triangle: real Core cards resolve through the map and byEffect', () =>
{
  const registries = SimpleCombatRegistries(TRIANGLE);
  const fight = SimpleCombatFight(registries);
  for (const [cardId, expected] of stanceRows(PROBE.cardStances))
  {
    const card = cardCarrier(registries, cardId);
    assert.equal(configuredStance(card, fight), expected, cardId);
    assert.equal(stanceOf(card, null, fight).maneuver, expected, cardId);
  }
});

test('triangle: enemy moves read through the same map', () =>
{
  const fight = SimpleCombatFight(SimpleCombatRegistries(TRIANGLE));
  const enemy = fight.enemies[0];
  const moves = fight.registries.enemies.get(enemy.enemyId).moves;
  for (const [moveId, expected] of stanceRows(PROBE.enemyMoveStances))
  {
    const carrier = enemyMoveCarrier(enemy, moves[moveId], moveId, fight);
    assert.equal(configuredStance(carrier, fight), expected, moveId);
  }
});

test('triangle: overrides fix a card by id', () =>
{
  const registries = SimpleCombatRegistries(TRIANGLE);
  const fight = SimpleCombatFight(registries);
  const triangle = fight.gameProfile.modules.stances.triangle;
  const { cardId, stance } = PROBE.overrideCase;
  const patched = {
    ...fight,
    gameProfile:
    {
      ...fight.gameProfile,
      modules:
      {
        ...fight.gameProfile.modules,
        stances:
        {
          ...fight.gameProfile.modules.stances,
          triangle:
          {
            ...triangle,
            overrides: { [cardId]: stance },
          },
        },
      },
    },
  };
  assert.equal(configuredStance(cardCarrier(registries, cardId), patched), stance);
});

test('triangle: a skill card enters skill, not neutral', () =>
{
  const registries = SimpleCombatRegistries(TRIANGLE);
  const fight = SimpleCombatFight(registries);
  const skillCardId = stanceRows(PROBE.cardStances).find(([, stance]) => stance === SKILL)[0];
  setProfileStance(fight, fight.player, { ...cardCarrier(registries, skillCardId) });
  assert.equal(fight.player.combatStance.maneuver, SKILL);
});

test('maneuvers: a fight on the default ruleset resolves every card as before', () =>
{
  const registries = SimpleCombatRegistries();
  const fight = SimpleCombatFight(registries);
  for (const card of registries.cards.all())
  {
    assert.equal(configuredStance(card, fight), configuredStance(card), card.id);
    assert.deepEqual(stanceOf(card, null, fight), stanceOf(card), card.id);
  }
});

const MATCHUP = PROBE.matchup;
const STANCE_IDS = Object.keys(MATCHUP.carriers);

function isWinner(attacking, defending)
{
  return MATCHUP.winners.some(([winner, loser]) => winner === attacking && loser === defending);
}

function matchupReceipt(fight, attacking, defending)
{
  const carrier = { ...cardCarrier(fight.registries, MATCHUP.carriers[attacking]) };
  const target = {
    ...fight.enemies[0],
    block: 0,
    combatStance:
    {
      maneuver: defending,
      camp: 'physical',
      range: 'melee',
    },
  };
  return profileDamageReceipt(fight, fight.player, target, MATCHUP.base, carrier);
}

test('triangle: all 16 pairs, the winner x winnerMultiplier and the loser unchanged', () =>
{
  const fight = SimpleCombatFight(SimpleCombatRegistries(TRIANGLE));
  for (const attacking of STANCE_IDS)
  {
    for (const defending of STANCE_IDS)
    {
      const label = `${attacking} vs ${defending}`;
      const receipt = matchupReceipt(fight, attacking, defending);
      const multiplier = isWinner(attacking, defending)
        ? MATCHUP.winnerMultiplier
        : 1;
      assert.equal(receipt.attackStance, attacking, label);
      assert.equal(receipt.advantage, isWinner(attacking, defending), label);
      assert.equal(receipt.stanceMitigation, 0, label);
      assert.equal(receipt.rawHit, Math.floor(receipt.raw * multiplier), label);
    }
  }
});

test('triangle: skill is not Idle, no extra draw and no extra damage taken', () =>
{
  const { turn, neutralStance, skillStance } = PROBE.skillProbe;
  const fight = SimpleCombatFight(SimpleCombatRegistries(TRIANGLE));
  const inSkill = {
    ...fight.player,
    combatStance: { maneuver: skillStance },
  };
  assert.equal(NeutralExtraDraw(fight, inSkill, turn), 0);
  assert.equal(StanceWeaknessMultiplier(fight, null, skillStance, {}), 1);
  assert.ok(StanceWeaknessMultiplier(fight, null, neutralStance, {}) > 1, 'Idle stays weak');
});
