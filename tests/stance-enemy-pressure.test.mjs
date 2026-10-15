import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { createCoopCombat, endTurn } from '../src/engine/coopCombat.js';
import { enemyMoveCards } from '../src/model/enemyMoveCards.js';
import { learnedEnemyMoveCards } from '../src/model/enemyKnowledgeView.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';
import { createRng } from '../src/engine/rng.js';
import { expandedEnemyMove, primeEnemyCounter } from '../src/engine/combatCardTactics.js';
import { enqueueExpandedAction } from '../src/engine/combatExpansionActions.js';
import { executeAction } from '../src/engine/actions.js';

const registries = createRegistries(contentBundle);
function fight() {
  return createCombat({ registries, rng: createRng(811), combatExpansionVersion: 2,
    enemyIds: ['gildedKnight'], player: { classId: 'reaver', hp: 1000, maxHp: 1000,
      mana: 20, maxMana: 20, stamina: 20, maxStamina: 20, energyMax: 20, drawPerTurn: 0, deck: [] } });
}
const drain = combat => { for (let n = 0; combat.queue.length; n++) {
  assert.ok(n < 100, 'the ordinary action queue must settle'); executeAction(combat, combat.queue.shift());
} };

for (const [authored, fallback, expected] of [[0, 3, 3], [0, 7, 7], [5, 7, 5]]) {
  test(`live Gilded Knight Counter uses Poise ${expected} with authored ${authored} and fallback ${fallback}`, () => {
    const combat = fight(), enemy = combat.enemies[0], player = combat.player;
    drain(combat);
    combat.stanceRules = { fallbackPoise: fallback };
    delete enemy.combatCounterReturnedCycle;
    const move = { ...registries.enemies.get('gildedKnight').moves.parry, counterPoiseDamage: authored };
    primeEnemyCounter(combat, enemy, move, 'parry'); drain(combat);
    assert.equal(enemy.combatCounter.payload.poise, expected);
    enemy.block = 1000; enemy.wardBlock = 0; enemy.evasion = 0;
    player.block = player.wardBlock = 0; player.evasion = 0;
    player.statuses = {}; player.combatStance = { camp: 'physical', maneuver: 'attack', range: 'melee' };
    player.poiseMeter = { value: 0, max: 1000 };
    combat.rng.int = () => 20;
    const carrier = { type: 'attack', tags: ['camp:physical', 'maneuver:attack', 'range:melee'], combatProfile: { camp: 'physical', maneuver: 'attack', range: 'melee' } };
    enqueueExpandedAction(combat, [{ effect: { op: 'damage', amount: 1 }, source: player, owner: player,
      target: enemy, card: carrier, meta: {} }], { source: player, target: enemy, carrier });
    const returnGroups = new Set();
    for (let n = 0; combat.queue.length; n++) {
      assert.ok(n < 100, 'the ordinary action queue must settle');
      const action = combat.queue.shift();
      if (action.meta?.expansionGroup?.counterReturn) returnGroups.add(action.meta.expansionGroup);
      executeAction(combat, action);
    }
    assert.equal(returnGroups.size, 1, 'one fully blocked incoming Attack produces one live return');
    const reply = [...returnGroups][0].counterReturn;
    assert.equal(reply.poiseDamage, expected, 'the reply retains its authored or configured base');
    assert.equal(player.poiseMeter.value, Math.ceil(expected * 1.5), 'the landed return applies its Attack matchup to pressure');
  });
}

test('enemy Smash fallback is configured, idempotent and excludes support-only charging stages', () => {
  const combat = fight(), enemy = { enemyId: 'fellWarden' };
  combat.stanceRules = { fallbackPoise: 7 };
  const move = registries.enemies.get('fellWarden').moves.heldBlade;
  const projected = expandedEnemyMove(enemy, move, 'heldBlade', combat);
  assert.equal(projected.effects.filter(effect => effect.op === 'poiseDamage').length, 1);
  assert.equal(projected.effects.find(effect => effect.op === 'poiseDamage').amount, 7);
  assert.equal(projected.delay.whileCharging.effects.some(effect => effect.op === 'poiseDamage'), false);
  assert.equal(expandedEnemyMove(enemy, projected, 'heldBlade', combat).effects.filter(effect => effect.op === 'poiseDamage').length, 1);
  const authored = expandedEnemyMove(enemy, { ...move, effects: [{ op: 'poiseDamage', target: 'player', amount: 4 }] }, 'heldBlade', combat);
  assert.deepEqual(authored.effects.filter(effect => effect.op === 'poiseDamage'), [{ op: 'poiseDamage', target: 'player', amount: 4 }]);
  assert.equal(move.effects?.some(effect => effect.op === 'poiseDamage') || false, false, 'projection does not mutate authored content');
});

for (const coop of [false, true]) for (const die of [1, 20]) {
  test(`${coop ? 'co-op' : 'solo'} charging Smash gates fallback Poise with its ${die === 1 ? 'miss' : 'hit'}`, () => {
    const move = { intent: 'attack', damage: 10, weight: 1,
      tags: ['camp:physical', 'maneuver:smash', 'range:melee', 'targeting:single'],
      delay: { turns: 1, whileCharging: { effects: [{ op: 'damage', target: 'player', amount: 2 }] } } };
    const reg = createRegistries({ ...contentBundle,
      enemies: contentBundle.enemies.map(def => def.id === 'fellWarden'
        ? { ...def, firstMove: 'heldBlade', spPool: 1, moves: { heldBlade: move } } : def),
      enemyMoves: contentBundle.enemyMoves.map(row => row.enemyId === 'fellWarden' && row.id === 'heldBlade' ? { ...row, ...move } : row),
    });
    const player = { id: 'p1', classId: 'reaver', hp: 1000, maxHp: 1000,
      mana: 20, maxMana: 20, stamina: 20, maxStamina: 20, energyMax: 20, drawPerTurn: 0, deck: [], combatExpansionVersion: 2 };
    const options = { registries: reg, rng: createRng(811), combatExpansionVersion: 2,
      reactionRulesVersion: 1, enemyIds: ['fellWarden'] };
    const combat = coop ? createCoopCombat({ ...options, players: [player] }) : createCombat({ ...options, player });
    combat.stanceRules = { fallbackPoise: 7 };
    const target = coop ? combat.players.get('p1').entity : combat.player;
    target.statuses = {}; target.block = target.barrier = 0;
    target.evasion = 0; target.combatStance = { camp: 'physical', maneuver: 'attack', range: 'melee' };
    delete target.combatCounter;
    target.poiseMeter = { value: 0, max: 1000 };
    if (target.persistentWard) target.persistentWard.value = 0;
    combat.enemies[0].plannedMoves = [];
    primeAccuracyRolls(combat, { die });
    const before = combat.eventLog.length;
    if (coop) endTurn(combat, 'p1'); else dispatch(combat, { type: 'endTurn' });
    const events = combat.eventLog.slice(before);
    const live = coop ? combat.players.get('p1').entity : combat.player;
    assert.ok(combat.enemies[0].pendingMove, 'the real turn committed the charging stage');
    assert.equal(events.filter(event => ['attackHit', 'attackMissed'].includes(event.type)).length, 1, 'one decision gates the whole charging payload');
    assert.equal(live.poiseMeter.value, die === 1 ? 0 : 9, 'a hit applies 7 fallback plus 2 ordinary hit pressure; a miss applies neither');
    assert.equal(events.some(event => event.type === 'hpLost' && event.targetId === live.id), die === 20);
  });
}

test('enemy move cards show configured fallback pressure without changing legacy or knowledge privacy', () => {
  const def = registries.enemies.get('fellWarden');
  for (const fallbackPoise of [3, 7]) {
    const options = { registries, combatExpansionVersion: 2, stanceRules: { fallbackPoise } };
    const card = enemyMoveCards(def, options).find(row => row.moveId === 'heldBlade');
    assert.match(card.detail, new RegExp(`${fallbackPoise} base Poise damage`));
    for (const stage of [4, 5]) assert.match(learnedEnemyMoveCards(def, stage, options).find(row => row.moveId === 'heldBlade').detail,
      new RegExp(`${fallbackPoise} base Poise damage`));
    assert.doesNotMatch(learnedEnemyMoveCards(def, 3, options).find(row => row.moveId === 'heldBlade').detail, /Poise|7|3/);
  }
  assert.doesNotMatch(enemyMoveCards(def).find(row => row.moveId === 'heldBlade').detail, /base Poise damage/);
  const authored = { ...def, moves: { heldBlade: { ...def.moves.heldBlade, effects: [{ op: 'poiseDamage', target: 'player', amount: 4 }] } } };
  const card = enemyMoveCards(authored, { combatExpansionVersion: 2, stanceRules: { fallbackPoise: 7 } })[0];
  assert.match(card.detail, /4 base Poise damage/);
  assert.doesNotMatch(card.detail, /7 base Poise damage/);
});

for (const [label, patch, stanceRules, expected] of [
  ['default', {}, null, 3],
  ['configured', {}, { fallbackPoise: 7 }, 7],
  ['authored field', { counterPoiseDamage: 5 }, { fallbackPoise: 7 }, 5],
  ['authored payload', { counterPayload: { hp: 2, poise: 6 } }, { fallbackPoise: 7 }, 6],
  ['authored effect', { effects: [{ op: 'poiseDamage', amount: 4, target: 'player' }] }, { fallbackPoise: 7 }, 0],
  ['zero fallback', {}, { fallbackPoise: 0 }, 0],
]) {
  test(`Counter move cards match live ${label} Poise without exposing locked knowledge`, () => {
    const original = registries.enemies.get('gildedKnight');
    const move = { ...original.moves.parry, ...patch };
    const def = { ...original, moves: { parry: move } };
    const options = { registries, combatExpansionVersion: 2, stanceRules };
    const combat = fight(); drain(combat);
    if (stanceRules) combat.stanceRules = stanceRules;
    primeEnemyCounter(combat, combat.enemies[0], move, 'parry'); drain(combat);
    assert.equal(combat.enemies[0].combatCounter.payload.poise, expected);
    const cards = [enemyMoveCards(def, options)[0], ...[4, 5].map(stage => learnedEnemyMoveCards(def, stage, options)[0])];
    for (const card of cards) {
      if (expected > 0) assert.match(card.detail, new RegExp(`${expected} base counter Poise damage(?: ·|$)`));
      else assert.doesNotMatch(card.detail, /base counter Poise damage/);
      if (label === 'authored effect') assert.match(card.detail, /4 base Poise damage to player/);
    }
    assert.doesNotMatch(learnedEnemyMoveCards(def, 3, options)[0].detail, /Poise|[0-9]/);
    assert.doesNotMatch(enemyMoveCards(original, { registries }).find(row => row.moveId === 'parry').detail, /base counter Poise damage/);
  });
}

test('Counter card fallback reads registry configuration and preserves legacy authored pressure', () => {
  const def = registries.enemies.get('gildedKnight');
  const configured = { ...registries, balance: { ...registries.balance, stanceRules: { fallbackPoise: 7 } } };
  assert.match(enemyMoveCards(def, { registries: configured, combatExpansionVersion: 2 }).find(row => row.moveId === 'parry').detail,
    /7 base counter Poise damage(?: ·|$)/);
  const authored = { ...def, moves: { parry: { ...def.moves.parry, counterPoiseDamage: 5 } } };
  assert.match(enemyMoveCards(authored, { registries: configured })[0].detail, /5 base counter Poise damage ×/);
});

for (const fallbackPoise of [3, 7]) {
  test(`charging Smash cards separate configured ${fallbackPoise} pressure from resolution pressure`, () => {
    const original = registries.enemies.get('fellWarden');
    const move = { ...original.moves.heldBlade,
      delay: { turns: 1, whileCharging: { effects: [{ op: 'damage', target: 'player', amount: 2 }] } } };
    const def = { ...original, moves: { heldBlade: move } };
    const before = JSON.stringify(def);
    const options = { registries, combatExpansionVersion: 2, stanceRules: { fallbackPoise } };
    const projected = expandedEnemyMove({ enemyId: def.id }, move, 'heldBlade', options);
    assert.equal(projected.effects.find(effect => effect.op === 'poiseDamage').amount, fallbackPoise);
    assert.equal(projected.delay.whileCharging.effects.find(effect => effect.op === 'poiseDamage').amount, fallbackPoise);
    for (const card of [enemyMoveCards(def, options)[0], learnedEnemyMoveCards(def, 5, options)[0]]) {
      const pieces = card.detail.split(' · ');
      assert.equal(pieces.filter(piece => piece === `${fallbackPoise} base Poise damage to player`).length, 1);
      assert.equal(pieces.filter(piece => piece === `${fallbackPoise} base Poise damage to player while charging`).length, 1);
    }
    assert.doesNotMatch(learnedEnemyMoveCards(def, 3, options)[0].detail, /Poise|charging|[0-9]/);
    assert.doesNotMatch(learnedEnemyMoveCards(def, 4, options)[0].detail, /charging|Delayed/);
    assert.doesNotMatch(enemyMoveCards(def, { registries })[0].detail, /base Poise damage to player/);
    const pressurePieces = card => card.detail.split(' · ').filter(piece => piece.includes('base Poise damage'));
    assert.deepEqual(pressurePieces(enemyMoveCards({ ...def, moves: { heldBlade: projected } }, options)[0]),
      pressurePieces(enemyMoveCards(def, options)[0]), 'already-expanded pressure is not displayed twice');
    assert.equal(JSON.stringify(def), before, 'the read-only card projection preserves authored content');
  });
}

test('charging pressure display preserves authored effects, support-only phases and nested expansion', () => {
  const original = registries.enemies.get('fellWarden');
  const options = { registries, combatExpansionVersion: 2, stanceRules: { fallbackPoise: 7 } };
  const cardFor = charging => enemyMoveCards({ ...original, moves: { heldBlade: { ...original.moves.heldBlade,
    delay: { turns: 1, whileCharging: charging } } } }, options)[0];
  const authored = cardFor({ effects: [{ op: 'damage', amount: 2, target: 'player' }, { op: 'poiseDamage', amount: 4, target: 'player' }] });
  assert.match(authored.detail, /4 base Poise damage to player while charging/);
  assert.doesNotMatch(authored.detail, /7 base Poise damage to player while charging/);
  assert.doesNotMatch(cardFor({ block: 8 }).detail, /Poise damage to player while charging/);
  const nested = cardFor({ effects: [{ op: 'damage', amount: 2, target: 'player' }],
    delay: { turns: 1, whileCharging: { effects: [{ op: 'damage', amount: 1, target: 'player' }] } } });
  assert.match(nested.detail, /7 base Poise damage to player while charging/);
  assert.match(nested.detail, /7 base Poise damage to player during charging stage 2/);
});
