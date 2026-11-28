// stagger.poise (docs/design/SIMPLE-COMBAT-PLAN.md step 1): off empties every Poise pool, so Poise
// damage does nothing and nothing breaks (Core ships it off); on keeps the pools and the break.
import test from 'node:test';
import assert from 'node:assert/strict';
import { dealPoiseDamage, OPCODE_HANDLERS } from '../src/engine/actions.js';
import { PoiseEnabled } from '../src/model/simpleCombatFlags.js';
import { dispatch } from '../src/engine/combat.js';
import { cardFaceLines } from '../src/model/cardFaceText.js';
import { nextUpgradeOptions } from '../src/model/cardUpgradeLimits.js';
import {
  SimpleCombatRegistries,
  SimpleCombatFight,
  SimpleCombatFixture,
  SimpleCombatRun,
} from './helpers/simple-combat.mjs';

const POISE_OFF = 'poiseOff';
const POISE_ON = 'poiseOn';
const HUGE_POISE_DAMAGE = 999;
const BREAK_EVENT = 'poiseBroken';
const POISE_ONLY_EFFECT = {
  op: 'poiseDamage',
  target: 'enemy',
  amount: 3,
};

function breakEvents(combat, start)
{
  return combat.eventLog.slice(start).filter(event => event.type === BREAK_EVENT);
}

test('stagger.poise on: Core fighters hold Poise and a big Poise hit breaks the enemy', () =>
{
  const combat = SimpleCombatFight(SimpleCombatRegistries(POISE_ON));
  const enemy = combat.enemies[0];
  assert.equal(PoiseEnabled(combat), true);
  assert.ok(combat.player.persistentPoise.max > 0, 'the player has a Poise pool');
  assert.ok(enemy.persistentPoise.max > 0, 'the enemy has a Poise pool');
  const start = combat.eventLog.length;
  dealPoiseDamage(combat, enemy, HUGE_POISE_DAMAGE, { source: combat.player });
  assert.equal(enemy.persistentPoise.value, 0);
  assert.equal(breakEvents(combat, start).length, 1, 'the empty pool breaks');
});

test('stagger.poise off: every pool is empty and Poise damage breaks nothing', () =>
{
  const combat = SimpleCombatFight(SimpleCombatRegistries(POISE_OFF));
  const enemy = combat.enemies[0];
  assert.equal(PoiseEnabled(combat), false);
  assert.equal(combat.player.persistentPoise.max, 0);
  assert.equal(enemy.persistentPoise.max, 0);
  const stanceBefore = enemy.combatStance;
  const start = combat.eventLog.length;
  dealPoiseDamage(combat, enemy, HUGE_POISE_DAMAGE, { source: combat.player });
  assert.equal(breakEvents(combat, start).length, 0, 'no Poise break');
  assert.equal(enemy.broken, undefined, 'the enemy is not Broken');
  assert.equal(enemy.combatStance, stanceBefore, 'the enemy is not Staggered');
});

// A Poise-only card counts as a hit through the Poise it dealt
// (combatExpansionActions traitLanded).
function poiseOnlyPressure(overrideName)
{
  const combat = SimpleCombatFight(SimpleCombatRegistries(overrideName));
  const enemy = combat.enemies[0];
  const action = {
    source: combat.player,
    owner: combat.player,
    target: enemy,
    card: {},
    meta:
    {
      expansionGroup:
      {
        targets: {},
      },
    },
  };
  OPCODE_HANDLERS.poiseDamage(combat, action, POISE_ONLY_EFFECT);
  const pressure = action.meta.expansionGroup.ownPressure || {};
  return pressure[enemy.id]?.poiseDealt || 0;
}

test('stagger.poise on: a Poise-only card records the Poise it dealt', () =>
{
  assert.equal(poiseOnlyPressure(POISE_ON), POISE_ONLY_EFFECT.amount);
});

test('stagger.poise off: a Poise-only card records no Poise, so it is not a hit', () =>
{
  assert.equal(poiseOnlyPressure(POISE_OFF), 0);
});

const FIGHT_PROBE = SimpleCombatFixture.poiseOffFightProbe;

function refillPlayer(player)
{
  player.energy = FIGHT_PROBE.resource;
  player.stamina = FIGHT_PROBE.resource;
  player.mana = FIGHT_PROBE.resource;
  player.hp = FIGHT_PROBE.playerHp;
  player.maxHp = FIGHT_PROBE.playerHp;
}

function playProbeCards(combat, round)
{
  refillPlayer(combat.player);
  for (const cardId of FIGHT_PROBE.cardIds)
  {
    const target = combat.enemies.find(enemy => enemy.alive);
    if (!target)
    {
      return;
    }
    const instanceId = `${cardId}#${round}`;
    combat.piles.hand.push({ instanceId, cardId });
    dispatch(combat, {
      type: 'playCard',
      cardInstanceId: instanceId,
      targetId: target.id,
    });
  }
}

test('shipping Core has Poise off: a fight of Poise cards lands no Poise and no Poise break staggers', () =>
{
  const combat = SimpleCombatFight(SimpleCombatRegistries());
  assert.equal(PoiseEnabled(combat), false, 'Core ships stagger.poise false');
  const forbidden = new Set(FIGHT_PROBE.forbiddenEvents);
  dispatch(combat, { type: 'setReactions', enabled: false });
  for (const enemy of combat.enemies)
  {
    enemy.hp = FIGHT_PROBE.enemyHp;
    enemy.maxHp = FIGHT_PROBE.enemyHp;
  }
  let played = 0;
  for (let round = 0; round < FIGHT_PROBE.rounds && !combat.result; round += 1)
  {
    const before = combat.eventLog.length;
    playProbeCards(combat, round);
    played += combat.eventLog.slice(before).filter(event => event.type === 'cardPlayed').length;
    dispatch(combat, { type: 'endTurn' });
  }
  assert.ok(played > 0, 'the probe cards were played');
  const fighters = [combat.player, ...combat.enemies];
  for (const fighter of fighters)
  {
    assert.equal(fighter.persistentPoise?.value || 0, 0, `${fighter.id} holds no Poise`);
  }
  const staggers = new Set(FIGHT_PROBE.staggerEvents);
  const poiseStagger = event => staggers.has(event.type)
    && event.cause === FIGHT_PROBE.poiseStaggerCause;
  const seen = combat.eventLog
    .filter(event => forbidden.has(event.type) || poiseStagger(event))
    .map(event => event.type);
  assert.deepEqual(seen, [], 'no Poise event and no Poise-break stagger');
});

function probeCardSetup(overrideName)
{
  const registries = SimpleCombatRegistries(overrideName);
  const card = registries.cards.get(FIGHT_PROBE.faceCardId);
  return {
    registries,
    card,
  };
}

function faceText(overrideName)
{
  const { registries, card } = probeCardSetup(overrideName);
  return cardFaceLines(card, null, registries)
    .map(line => line.html)
    .join(' ');
}

function poiseUpgradeSteps(overrideName)
{
  const { registries, card } = probeCardSetup(overrideName);
  const run = SimpleCombatRun(registries);
  const instance = {
    instanceId: 'probe-1',
    cardId: card.id,
  };
  const options = nextUpgradeOptions(
    run,
    instance,
    card,
    registries,
    FIGHT_PROBE.upgradeOptions,
    {
      noAuthored: true,
      everyFamily: true,
    },
  );
  return options.filter(step => step.k === FIGHT_PROBE.upgradeStepKind);
}

test('shipping Core has Poise off: a Poise card face names no Poise', () =>
{
  assert.ok(!faceText().includes(FIGHT_PROBE.faceWord), 'Core face has no Poise clause');
  assert.ok(faceText(POISE_ON).includes(FIGHT_PROBE.faceWord), 'Poise on keeps the clause');
});

test('shipping Core has Poise off: no Poise upgrade step is offered', () =>
{
  assert.equal(poiseUpgradeSteps().length, 0, 'no Poise step in Core');
  assert.ok(poiseUpgradeSteps(POISE_ON).length > 0, 'Poise on still offers it');
});

const MARKUP = /<[^>]+>/g;

// Every shipping Core card face, as the hand draws it, that still names Poise.
function cardsNamingPoise(overrideName)
{
  const registries = SimpleCombatRegistries(overrideName);
  const rules = {
    combatExpansionVersion: FIGHT_PROBE.faceExpansionVersion,
    gameProfile: registries.gameProfile,
  };
  const cards = registries.cards.all()
    .filter(card => card.id.startsWith(FIGHT_PROBE.faceCardPrefix));
  assert.ok(cards.length > 0, 'the probe sees Core cards');
  return cards.filter(card =>
  {
    const lines = cardFaceLines(card, null, registries, rules) || [];
    const text = lines.map(line => line.html.replace(MARKUP, '')).join(' ');
    return text.includes(FIGHT_PROBE.faceWord);
  }).map(card => card.id);
}

test('shipping Core has Poise off: no Core card face names Poise', () =>
{
  assert.deepEqual(cardsNamingPoise(), []);
  assert.ok(cardsNamingPoise(POISE_ON).length > 0, 'Poise on still names it');
});
