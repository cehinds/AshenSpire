import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { legacyContentBundle } from './helpers/legacy-progression-content.mjs';
import { createRegistries } from '../src/model/registries.js';
import { createCombat, dispatch, previewCard } from '../src/engine/combat.js';
import { createCoopCombat, playCard, endTurn } from '../src/engine/coopCombat.js';
import { createRng } from '../src/engine/rng.js';
import { applyStatus, getStacks } from '../src/engine/statuses.js';
import { combatRules } from '../src/content/combatRules.js';
import { resolveCombatRatings } from '../src/model/combatRatings.js';
import { staggerPlayer } from '../src/engine/actions.js';
import { grantAbilityCharge } from '../src/engine/abilityRiders.js';

function registry({ enemyId = 'wanderingSoldier', moveId = 'slash', damage = 8, legacy = false } = {}) {
  const base = legacy ? legacyContentBundle : contentBundle;
  return createRegistries({ ...base,
    enemies: base.enemies.map(enemy => enemy.id === enemyId ? { ...enemy, firstMove: moveId } : enemy),
    enemyMoves: base.enemyMoves.map(move => move.enemyId === enemyId && move.id === moveId ? { ...move, ...(move.damage != null ? { damage } : {}) } : move),
  });
}
const basicRegistry = registry();
const partialRegistry = registry({ damage: 30 });
const counterRegistry = registry({ enemyId: 'gildedKnight', moveId: 'parry' });
const legacyRegistry = registry({ legacy: true });
function player(cardId) {
  return { classId: 'reaver', maxHp: 200, hp: 200, maxMana: 50, mana: 50,
    energyMax: 10, drawPerTurn: 1, deck: [{ instanceId: 'card1', cardId }], relicIds: [] };
}
function solo(cardId, registries = basicRegistry, enemyId = 'wanderingSoldier') {
  return createCombat({ registries, rng: createRng(50), player: player(cardId), enemyIds: [enemyId] });
}
function coop(cardId, count = 1) {
  return createCoopCombat({ registries: basicRegistry, rng: createRng(50),
    players: Array.from({ length: count }, (_, i) => ({ id: 'p' + (i + 1), ...player(cardId) })),
    enemyIds: ['wanderingSoldier'], ratingsRules: null });
}
const counterEvents = combat => combat.eventLog.filter(event => event.type === 'combatCounterTriggered');

test('live Riposte defers damage, grants immediate Guard/Ward, then retaliates exactly once', () => {
  const c = solo('riposte'), enemy = c.enemies[0], hp = enemy.hp;
  dispatch(c, { type: 'playCard', cardInstanceId: 'card1' });
  assert.equal(enemy.hp, hp, 'Counter card must not strike during preparation');
  assert.equal(c.player.block, 6);
  assert.equal(c.player.wardBlock, 2);
  assert.equal(c.player.combatCounter.poiseDamage, 1, 'displayed Poise badge is listed impact');
  dispatch(c, { type: 'endTurn' });
  assert.equal(c.player.hp, 200);
  assert.equal(enemy.hp, hp - 11);
  assert.equal(counterEvents(c).length, 1);
  assert.equal(counterEvents(c)[0].poiseDamage, 1);
  assert.equal(counterEvents(c)[0].sourceKind, 'player');
  assert.equal(counterEvents(c)[0].cardId, 'riposte');
  assert(counterEvents(c)[0].cardTags.includes('maneuver:counter'));
  assert.equal(c.player.combatCounter, undefined);
});

test('live partial shielding consumes Counter without reply or a second attempt', () => {
  const c = solo('riposte', partialRegistry), hp = c.enemies[0].hp;
  dispatch(c, { type: 'playCard', cardInstanceId: 'card1' });
  dispatch(c, { type: 'endTurn' });
  assert.equal(c.player.hp, 191, '30 halved to15 minus6 shielding');
  assert.equal(c.enemies[0].hp, hp);
  assert.equal(counterEvents(c).length, 0);
  assert.equal(c.eventLog.filter(event => event.type === 'combatCounterConsumed').length, 1);
});

test('live enemy Counter arms before player phase and reflects incoming Attack, not its own turn', () => {
  const c = solo('strike', counterRegistry, 'gildedKnight'), enemy = c.enemies[0], hp = enemy.hp;
  assert.equal(enemy.combatCounter.mode, 'melee');
  dispatch(c, { type: 'playCard', cardInstanceId: 'card1', targetId: enemy.id });
  assert.equal(enemy.hp, hp);
  assert.equal(c.player.hp, 186);
  assert.equal(counterEvents(c).length, 1);
  assert.equal(counterEvents(c)[0].sourceId, enemy.id);
  assert.equal(enemy.combatCounter, undefined);
});

test('live Smash gets guarded bonus and adds Poise only after actual Guard break', () => {
  const c = solo('kilnCleave'), enemy = c.enemies[0], hp = enemy.hp;
  enemy.block = 9;
  dispatch(c, { type: 'playCard', cardInstanceId: 'card1', targetId: enemy.id });
  const hit = c.eventLog.find(event => event.type === 'damageDealt' && event.sourceId === 'player');
  assert.equal(hit.amount, 15);
  assert.equal(hit.blocked, 9);
  assert.equal(enemy.hp, hp - 6);
  assert.equal(enemy.poiseMeter.value, 6, 'printed3 plus actual-break3');
  assert.equal(getStacks(enemy, 'burn'), 4, 'printed Burn not duplicated by rider');
});

test('live card identity applies penetration and conditional Lightning rider without double status', () => {
  const p = solo('rimeThrust'), enemy = p.enemies[0], hp = enemy.hp;
  enemy.block = 10;
  dispatch(p, { type: 'playCard', cardInstanceId: 'card1', targetId: enemy.id });
  assert.equal(enemy.hp, hp - 2);
  assert.equal(enemy.block, 7);
  const l = solo('starSpark');
  dispatch(l, { type: 'playCard', cardInstanceId: 'card1', targetId: l.enemies[0].id });
  assert.equal(getStacks(l.enemies[0], 'weak'), 1, 'inactive printed condition does not suppress Lightning rider');
  const charged = solo('starSpark'); applyStatus(charged, charged.player, 'starstoneCharge', 1);
  dispatch(charged, { type: 'playCard', cardInstanceId: 'card1', targetId: charged.enemies[0].id });
  assert.equal(getStacks(charged.enemies[0], 'weak'), 1, 'eligible printed Weak suppresses extra rider');
});

test('live enemy damage tags produce status rider through real enemy-phase dispatch', () => {
  const c = solo('strike');
  dispatch(c, { type: 'endTurn' });
  assert.equal(c.player.hp, 192);
  assert.equal(getStacks(c.player, 'bleed'), 1, 'CSV Slashing move applies Bleed');
});

test('solo and one-seat co-op execute same deferred Counter health and Poise outcome', () => {
  const s = solo('riposte'), c = coop('riposte');
  dispatch(s, { type: 'playCard', cardInstanceId: 'card1' });
  playCard(c, 'p1', 'card1');
  dispatch(s, { type: 'endTurn' }); endTurn(c, 'p1');
  assert.equal(c.players.get('p1').entity.hp, s.player.hp);
  assert.equal(c.enemies[0].hp, s.enemies[0].hp);
  assert.equal(c.enemies[0].poiseMeter.value, s.enemies[0].poiseMeter.value);
  assert.deepEqual(counterEvents(c).map(event => [event.amount, event.poiseDamage]), counterEvents(s).map(event => [event.amount, event.poiseDamage]));
});

test('two co-op seats keep independent Counter charges and retaliation owners', () => {
  const c = coop('riposte', 2);
  playCard(c, 'p1', 'card1'); playCard(c, 'p2', 'card1');
  endTurn(c, 'p1'); endTurn(c, 'p2');
  assert.deepEqual(counterEvents(c).map(event => event.sourcePlayerId).sort(), ['p1', 'p2']);
  for (const seat of c.players.values()) {
    assert.equal(seat.entity.hp, 200);
    assert.equal(seat.entity.combatCounter, undefined);
  }
});

test('legacy conditional Counter takes exactly one eligible damage branch before gaining Guard', () => {
  const unguarded = solo('guardCounter', legacyRegistry);
  dispatch(unguarded, { type: 'playCard', cardInstanceId: 'card1' });
  assert.equal(unguarded.player.combatCounter.damage, 4);
  const guarded = solo('guardCounter', legacyRegistry); guarded.player.block = 2;
  dispatch(guarded, { type: 'playCard', cardInstanceId: 'card1' });
  assert.equal(guarded.player.combatCounter.damage, 10, 'conditional branches must not sum to14');
});

test('foundation Counter snapshots its source before payment and preserves it for deferred reply', () => {
  const c = createCombat({ registries: basicRegistry, rng: createRng(50), player: player('riposte'),
    enemyIds: ['wanderingSoldier'], ruleset: combatRules,
    combatProfiles: { player: { sources: { mainHand: { id: 'prepared-sword', sourceType: 'weapon',
      family: 'blade', weight: 2, grip: 'oneHand', damageType: 'slashing', tags: [], buildup: [] } } } } });
  dispatch(c, { type: 'playCard', cardInstanceId: 'card1' });
  assert.equal(c.player.combatCounter.carrier.resolvedSource.id, 'prepared-sword');
  c.foundation.profiles.player.sources.mainHand.id = 'later-weapon';
  dispatch(c, { type: 'endTurn' });
  const reply = c.eventLog.find(event => event.type === 'damageDealt' && event.sourceId === 'player');
  assert.equal(reply.sourceInstanceId, 'prepared-sword');
});

test('Sweep or Piercing Poise break cancels enemy Counter before follow-up Attack', () => {
  for (const cardId of ['cleavingBlow', 'rimeThrust']) {
    const inputs = player(cardId);
    inputs.attributes = { strength: 0, dexterity: 0, constitution: 0, wisdom: 0, intelligence: 0, charisma: 0 };
    inputs.drawPerTurn = 2;
    inputs.deck.push({ instanceId: 'followup', cardId: 'strike' });
    const rated = cardId === 'rimeThrust';
    const ratingsRules = rated ? resolveCombatRatings({}, contentBundle) : null;
    // Piercing card gains authored impact through the shared configurable row.
    if (ratingsRules) ratingsRules.attackImpact.rimeThrust = 1;
    const c = createCombat({ registries: counterRegistry, rng: createRng(50), player: inputs,
      enemyIds: ['gildedKnight'], ratingsRules });
    const enemy = c.enemies[0];
    enemy.poiseMeter.value = enemy.poiseMeter.max - (rated ? 1 : 3);
    dispatch(c, { type: 'playCard', cardInstanceId: 'card1', targetId: enemy.id });
    assert.equal(enemy.intent.kind, 'staggered', cardId + ' interrupts preparation');
    assert.equal(enemy.combatCounter, undefined, cardId + ' clears armed reaction');
    const hp = c.player.hp;
    dispatch(c, { type: 'playCard', cardInstanceId: 'followup', targetId: enemy.id });
    assert.equal(c.player.hp, hp);
    assert.equal(counterEvents(c).length, 0);
  }
});

test('player stagger also cancels prepared Counter while preserving existing defense pools', () => {
  const c = solo('riposte');
  dispatch(c, { type: 'playCard', cardInstanceId: 'card1' });
  const block = c.player.block;
  staggerPlayer(c, c.player);
  assert.equal(c.player.combatCounter, undefined);
  assert.equal(c.player.block, block);
});

test('Counter preserves one-use damage and Break charges in deferred payload', () => {
  for (const damageScope of [undefined, 'effect']) {
    const c = solo('riposte');
    grantAbilityCharge(c.player, { key: 'counter-combo', cardType: 'attack', damage: 3, break: 2, damageScope });
    dispatch(c, { type: 'playCard', cardInstanceId: 'card1' });
    assert.equal(c.player.combatCounter.damage, 7);
    assert.equal(c.player.combatCounter.poiseDamage, 3);
    assert.deepEqual(c.player.abilityRiders.charges, {});
    dispatch(c, { type: 'endTurn' });
    assert.equal(counterEvents(c)[0].amount, 15);
    assert.equal(counterEvents(c)[0].poiseDamage, 4);
  }
});

test('solo and co-op carry enemy damage tags through while-charging effects', () => {
  const registries = createRegistries({ ...contentBundle,
    enemies: contentBundle.enemies.map(enemy => enemy.id === 'wanderingSoldier' ? { ...enemy, firstMove: 'slash' } : enemy),
    enemyMoves: contentBundle.enemyMoves.map(move => move.enemyId === 'wanderingSoldier' && move.id === 'slash'
      ? { ...move, delay: { turns: 1, whileCharging: { effects: [{ op: 'damage', target: 'player', amount: 2 }] } } } : move),
  });
  const s = solo('strike', registries);
  const c = createCoopCombat({ registries, rng: createRng(50),
    players: [{ id: 'p1', ...player('strike') }], enemyIds: ['wanderingSoldier'], ratingsRules: null });
  dispatch(s, { type: 'endTurn' }); endTurn(c, 'p1');
  assert.equal(s.player.hp, 198);
  assert.equal(c.players.get('p1').entity.hp, s.player.hp);
  assert.equal(getStacks(s.player, 'bleed'), 1);
  assert.equal(getStacks(c.players.get('p1').entity, 'bleed'), 1);
});

test('enemy Counter payload uses the same fight damage scale in solo and co-op', () => {
  const s = createCombat({ registries: counterRegistry, rng: createRng(50), player: player('strike'),
    enemyIds: ['gildedKnight'], enemyDamageMult: 2 });
  const c = createCoopCombat({ registries: counterRegistry, rng: createRng(50),
    players: [{ id: 'p1', ...player('strike') }], enemyIds: ['gildedKnight'], enemyDamageMult: 2, ratingsRules: null });
  assert.equal(s.enemies[0].combatCounter.damage, 12);
  assert.equal(c.enemies[0].combatCounter.damage, 12);
  dispatch(s, { type: 'playCard', cardInstanceId: 'card1', targetId: s.enemies[0].id });
  playCard(c, 'p1', 'card1', c.enemies[0].id);
  assert.equal(counterEvents(s)[0].amount, 23);
  assert.equal(counterEvents(c)[0].amount, 23);
  assert.equal(s.player.hp, 177);
  assert.equal(c.players.get('p1').entity.hp, 177);
});

test('empty custom combat identity retains local hit vulnerability tags in preview and execution', () => {
  const registries = createRegistries({ ...legacyContentBundle,
    cards: legacyContentBundle.cards.map(card => card.id === 'strike'
      ? { ...card, cardTags: [], effects: [{ op: 'damage', target: 'enemy', amount: 10, tags: ['starstone'] }] } : card),
    tagging: legacyContentBundle.tagging.filter(row => !(row.family === 'card' && row.objectId === 'strike') || row.tagId === 'classification.attack'),
  });
  assert.deepEqual(registries.cards.get('strike').cardTags, []);
  const c = solo('strike', registries);
  applyStatus(c, c.enemies[0], 'frostExposed', 1);
  const preview = previewCard(c, 'card1', c.enemies[0].id);
  assert.equal(preview.values.find(row => row.op === 'damage').value, 12);
  dispatch(c, { type: 'playCard', cardInstanceId: 'card1', targetId: c.enemies[0].id });
  assert.equal(c.eventLog.find(event => event.type === 'damageDealt' && event.sourceId === 'player').amount, 12);
  assert.equal(getStacks(c.enemies[0], 'bleed'), 0, 'empty card identity does not inherit a tactical Slashing rider');
});

test('Holy lethal hit cleanses its attacker before the card ends combat', () => {
  const c = solo('sacredHarvest');
  c.enemies[0].hp = 1;
  applyStatus(c, c.player, 'weak', 3);
  dispatch(c, { type: 'playCard', cardInstanceId: 'card1', targetId: c.enemies[0].id });
  assert.equal(c.result, 'victory');
  assert.equal(c.enemies[0].alive, false);
  assert.equal(getStacks(c.player, 'weak'), 2);
  assert(c.eventLog.some(event => event.type === 'statusRemoved' && event.targetId === 'player' && event.status === 'weak' && event.amount === 1));
});

test('Deathblow shares one Slashing rider across its separately queued damage effects', () => {
  const registries = createRegistries({ ...legacyContentBundle,
    tagging: [...legacyContentBundle.tagging, { family: 'card', scope: '', objectId: 'deathblow', tagId: 'damage:slashing' }],
  });
  for (const foundation of [false, true]) for (const coopMode of [false, true]) {
    const options = { registries, rng: createRng(50), enemyIds: ['wanderingSoldier'],
      ...(foundation ? { ruleset: combatRules } : {}), ratingsRules: null };
    const c = coopMode ? createCoopCombat({ ...options, players: [{ id: 'p1', ...player('deathblow') }] })
      : createCombat({ ...options, player: player('deathblow') });
    const enemy = c.enemies[0]; enemy.hp = enemy.maxHp = 200;
    applyStatus(c, enemy, 'bleed', 1); applyStatus(c, enemy, 'venom', 1);
    if (coopMode) playCard(c, 'p1', 'card1', enemy.id);
    else dispatch(c, { type: 'playCard', cardInstanceId: 'card1', targetId: enemy.id });
    assert.equal(c.eventLog.filter(event => event.type === 'damageDealt' && event.sourceId === 'player').length, 3);
    assert.equal(getStacks(enemy, 'bleed'), 2, `one extra Bleed, foundation=${foundation}, coop=${coopMode}`);
  }
});

test('multi-effect, multi-hit AoE Piercing shares per-target budget and resets next card', () => {
  const registries = createRegistries({ ...legacyContentBundle,
    cards: legacyContentBundle.cards.map(card => card.id === 'rimeThrust' ? { ...card,
      effects: [{ op: 'damage', target: 'allEnemies', amount: 4, hits: 2, repeat: 2 },
        { op: 'damage', target: 'allEnemies', amount: 4, hits: 2 }],
    } : card),
  });
  for (const foundation of [false, true]) for (const coopMode of [false, true]) {
    const inputs = player('rimeThrust'); inputs.drawPerTurn = 2;
    inputs.deck.push({ instanceId: 'card2', cardId: 'rimeThrust' });
    const options = { registries, rng: createRng(50), enemyIds: ['wanderingSoldier', 'wanderingSoldier'],
      ...(foundation ? { ruleset: combatRules } : {}), ratingsRules: null };
    const c = coopMode ? createCoopCombat({ ...options, players: [{ id: 'p1', ...inputs }] })
      : createCombat({ ...options, player: inputs });
    for (const enemy of c.enemies) { enemy.hp = enemy.maxHp = 200; enemy.block = 100; }
    for (const instanceId of ['card1', 'card2']) {
      if (coopMode) playCard(c, 'p1', instanceId);
      else dispatch(c, { type: 'playCard', cardInstanceId: instanceId });
      const expectedLoss = instanceId === 'card1' ? 2 : 4;
      for (const enemy of c.enemies) assert.equal(enemy.hp, 200 - expectedLoss,
        `one bypass per card and target, foundation=${foundation}, coop=${coopMode}`);
      assert.equal(c.eventLog.filter(event => event.type === 'damageDealt' && event.sourceId === 'player').length,
        instanceId === 'card1' ? 12 : 24, 'all six contacts resolve against both targets');
    }
  }
});

test('enemy move damage payloads share a rider budget per seat, including charging effects', () => {
  for (const type of ['slashing', 'piercing']) for (const charging of [false, true]) {
    const effects = [{ op: 'damage', target: 'player', amount: 2, repeat: 2 },
      { op: 'damage', target: 'player', amount: 2 }];
    const registries = createRegistries({ ...contentBundle,
      enemies: contentBundle.enemies.map(enemy => enemy.id === 'wanderingSoldier' ? { ...enemy, firstMove: 'slash' } : enemy),
      enemyMoves: contentBundle.enemyMoves.map(move => move.enemyId === 'wanderingSoldier' && move.id === 'slash'
        ? { ...move, damage: 2, ...(charging ? { effects: [], delay: { turns: 1, whileCharging: { effects } } }
          : { effects: [effects[0]] }) } : move),
      tagging: [...contentBundle.tagging.filter(row => !(row.family === 'enemyMove' && row.scope === 'wanderingSoldier'
        && row.objectId === 'slash' && row.tagId.startsWith('damage:'))),
      { family: 'enemyMove', scope: 'wanderingSoldier', objectId: 'slash', tagId: `damage:${type}` }],
    });
    for (const foundation of [false, true]) for (const coopMode of [false, true]) {
      const options = { registries, rng: createRng(50), enemyIds: ['wanderingSoldier'],
        ...(foundation ? { ruleset: combatRules } : {}), ratingsRules: null };
      const c = coopMode ? createCoopCombat({ ...options,
        players: ['p1', 'p2'].map(id => ({ id, ...player('strike') })) })
        : createCombat({ ...options, player: player('strike') });
      const targets = coopMode ? [...c.players.values()].map(seat => seat.entity) : [c.player];
      if (type === 'piercing') for (const target of targets) target.block = 100;
      if (coopMode) { endTurn(c, 'p1'); endTurn(c, 'p2'); }
      else dispatch(c, { type: 'endTurn' });
      for (const target of targets) {
        assert.equal(target.hp, type === 'piercing' ? 198 : 194,
          `one rider per root move/seat: ${type}, charging=${charging}, foundation=${foundation}, coop=${coopMode}`);
        if (type === 'slashing') assert.equal(getStacks(target, 'bleed'), 1,
          `one Bleed: charging=${charging}, foundation=${foundation}, coop=${coopMode}`);
      }
    }
  }
});
