// SPEC §4.10: when a seat holds a Counter or defensive Sweep but is offered no
// reaction, the engine says why (combatReactionUnavailable), once per root.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { createCoopCombat, endTurn, chooseReaction, setReactions, leaveCombat } from '../src/engine/coopCombat.js';
import { beforeReactionAction } from '../src/engine/combatReactions.js';
import { combatLogEntries } from '../src/model/combatLog.js';
import { applyAttackDamage } from '../src/engine/actions.js';
import { combatRules } from '../src/content/combatRules.js';
import { legacyContentBundle } from './helpers/legacy-progression-content.mjs';

const SLASH = { intent: 'attack', damage: 1, hits: 2, weight: 1 };
const SWEEP = ['camp:physical', 'maneuver:sweep', 'reach:contact', 'targeting:single'];

// An HP offering on the Counter: `offer` is the nonlethal HP payment it asks for.
const withOffering = (card, amount) => {
  const payment = { op: 'loseHp', target: 'self', amount, nonlethal: true, offering: true };
  return { ...card, effects: [payment, ...card.effects], gradeProfiles: card.gradeProfiles?.map(profile => ({ ...profile, effects: [payment, ...profile.effects] })) };
};

function registriesWith(move = {}, offer = null) {
  const cards = offer === null ? contentBundle.cards : contentBundle.cards.map(card => card.id === 'guardCounter' ? withOffering(card, offer) : card);
  return createRegistries({ ...contentBundle, cards, enemies: contentBundle.enemies.map(enemy => enemy.id === 'wanderingSoldier'
    ? { ...enemy, firstMove: 'slash', moves: { slash: { ...SLASH, ...move } } } : enemy) });
}
const seatStats = { classId: 'reaver', maxHp: 100, hp: 100, maxMana: 20, mana: 20, maxStamina: 20, stamina: 20, energyMax: 20 };

function solo({ cardIds = ['guardCounter'], move, offer = null } = {}) {
  const registries = registriesWith(move, offer);
  const combat = createCombat({ registries, rng: createRng(701), combatExpansionVersion: 2, reactionRulesVersion: 1,
    enemyIds: ['wanderingSoldier'], player: { ...seatStats, drawPerTurn: cardIds.length,
      deck: cardIds.map((cardId, index) => ({ cardId, instanceId: `r${index}`, upgraded: false })) } });
  combat.player.block = 100;
  for (const enemy of combat.enemies) enemy.ratings = { ar: 0, dr: 0, pr: 0, poise: 100, ward: 0 };
  return combat;
}

function coop({ cardIds = ['guardCounter'], move, seats = ['a'] } = {}) {
  const players = seats.map(id => ({ id, ...seatStats, drawPerTurn: cardIds.length, combatExpansionVersion: 2,
    deck: cardIds.map((cardId, index) => ({ cardId, instanceId: `${id}:${index}`, upgraded: false })) }));
  const C = createCoopCombat({ registries: registriesWith(move), rng: createRng(701), players,
    enemyIds: ['wanderingSoldier'], reactionRulesVersion: 1 });
  for (const P of C.players.values()) P.entity.block = 100;
  for (const enemy of C.enemies) enemy.ratings = { ar: 0, dr: 0, pr: 0, poise: 100, ward: 0 };
  return C;
}

const unavailable = events => events.filter(event => event.type === 'combatReactionUnavailable')
  .map(({ type, ...payload }) => payload);
const soloEnd = combat => dispatch(combat, { type: 'endTurn' }).events;

test('a melee Counter facing a Sweep reports notCovered with the attack kind', () => {
  const combat = solo({ move: { cardTags: SWEEP } });
  assert.deepEqual(unavailable(soloEnd(combat)), [{ ownerId: 'player', sourceId: 'e1', reason: 'notCovered',
    cardId: 'guardCounter', cardIds: ['guardCounter'], attackKind: 'sweep' }]);
  assert.equal(combat.pendingReaction, undefined);
});

test('a Counter the seat cannot pay for reports cost with need and have', () => {
  const combat = solo();
  combat.player.energy = 0;
  assert.deepEqual(unavailable(soloEnd(combat)), [{ ownerId: 'player', sourceId: 'e1', reason: 'cost',
    cardId: 'guardCounter', cardIds: ['guardCounter'], attackKind: 'attack', resource: 'stamina', need: 1, have: 0 }]);
});

test('a Counter whose HP offering would leave the seat dead reports cost with resource hp', () => {
  const combat = solo({ offer: seatStats.hp });
  const events = soloEnd(combat);
  assert.deepEqual(unavailable(events), [{ ownerId: 'player', sourceId: 'e1', reason: 'cost',
    cardId: 'guardCounter', cardIds: ['guardCounter'], attackKind: 'attack', resource: 'hp', need: seatStats.hp + 1, have: seatStats.hp }]);
  assert.equal(combat.pendingReaction, undefined);
  const registries = createRegistries(contentBundle);
  assert.deepEqual(combatLogEntries(events, { registries }).map(row => row.text).filter(text => text.startsWith('Not enough')),
    [`Not enough HP to Guard Counter (need ${seatStats.hp + 1}, have ${seatStats.hp}).`]);
});

test('an HP offering reports need as the offering plus one, and have as current HP', () => {
  for (const hp of [5, 3]) {
    const combat = solo({ offer: 5 });
    combat.player.hp = hp;
    assert.deepEqual(unavailable(soloEnd(combat)), [{ ownerId: 'player', sourceId: 'e1', reason: 'cost',
      cardId: 'guardCounter', cardIds: ['guardCounter'], attackKind: 'attack', resource: 'hp', need: 6, have: hp }]);
  }
});

test('the reported refusal names the card it came from, not the first candidate', () => {
  // Guard Counter can't cover a Sweep (notCovered); Whirling Guard is covered but unpaid (cost).
  const combat = solo({ cardIds: ['guardCounter', 'whirlingGuard'], move: { cardTags: SWEEP } });
  combat.player.energy = 0;
  const events = soloEnd(combat);
  const [row] = unavailable(events);
  assert.equal(unavailable(events).length, 1);
  assert.equal(row.reason, 'cost');
  assert.equal(row.cardId, 'whirlingGuard');
  assert.deepEqual(row.cardIds, ['guardCounter', 'whirlingGuard']);
  const registries = createRegistries(contentBundle);
  assert.deepEqual(combatLogEntries(events, { registries }).map(entry => entry.text).filter(text => text.startsWith('Not enough')),
    [`Not enough SP to Sweep (need ${row.need}, have 0).`]);
});

test('the Reaction switch off reports switchOff only to a seat holding a candidate', () => {
  const combat = solo();
  combat.player.reactionsEnabled = false;
  assert.deepEqual(unavailable(soloEnd(combat)).map(row => row.reason), ['switchOff']);
  const empty = solo({ cardIds: ['strike'] });
  empty.player.reactionsEnabled = false;
  assert.deepEqual(unavailable(soloEnd(empty)), []);
});

test('no candidate in hand emits nothing, and an offer emits no unavailable receipt', () => {
  assert.deepEqual(unavailable(soloEnd(solo({ cardIds: ['strike'] }))), []);
  const offered = solo();
  const events = soloEnd(offered);
  assert.ok(offered.pendingReaction);
  assert.deepEqual(unavailable(events), []);
  assert.equal(events.filter(event => event.type === 'combatReactionOffered').length, 1);
});

test('a staggered or controlled attacker reports the halt once per root', () => {
  // The offer check runs before the root's first action, so a halt between
  // planning and that action is set up directly: reopen the root, halt its source.
  for (const [reason, halt] of [['attackerStaggered', enemy => { enemy.skipNextTurn = true; }],
    ['attackerControlled', enemy => { enemy.statuses = { ...enemy.statuses, paralysis: { stacks: 1 } }; }]]) {
    const combat = solo();
    soloEnd(combat);
    const action = combat.queue[0];
    delete combat.pendingReaction;
    action.meta.expansionGroup.reactionAnswered = [];
    halt(combat.enemies[0]);
    const start = combat.eventLog.length;
    const hooks = { play: () => { throw new Error('no trial expected'); } };
    assert.equal(beforeReactionAction(combat, action, hooks), false);
    assert.equal(beforeReactionAction(combat, action, hooks), false);
    assert.deepEqual(unavailable(combat.eventLog.slice(start)), [{ ownerId: 'player', sourceId: 'e1', reason,
      cardId: 'guardCounter', cardIds: ['guardCounter'], attackKind: 'attack' }]);
  }
});

test('a status-only root is notCovered, and a seat it control-locks reports controlled', () => {
  const ATTACK = ['camp:physical', 'maneuver:attack', 'reach:contact', 'targeting:single'];
  const registries = createRegistries({ ...contentBundle, enemies: contentBundle.enemies.map(enemy => enemy.id === 'wanderingSoldier'
    ? { ...enemy, firstMove: 'slash', moves: { slash: { intent: 'debuff', weight: 1,
      effects: [{ op: 'applyStatus', status: 'paralysis', stacks: 2, target: 'player' }] } } }
    : enemy.id === 'blightHound' ? { ...enemy, firstMove: 'slash', moves: { slash: { intent: 'attack', damage: 1, weight: 1, cardTags: ATTACK } } } : enemy) });
  const combat = createCombat({ registries, rng: createRng(701), combatExpansionVersion: 2, reactionRulesVersion: 1,
    enemyIds: ['wanderingSoldier', 'blightHound'], player: { ...seatStats, drawPerTurn: 1,
      deck: [{ cardId: 'guardCounter', instanceId: 'r0', upgraded: false }] } });
  combat.player.block = 100;
  for (const enemy of combat.enemies) enemy.ratings = { ar: 0, dr: 0, pr: 0, poise: 100, ward: 0 };
  assert.deepEqual(unavailable(soloEnd(combat)).map(row => [row.sourceId, row.reason, row.attackKind]),
    [['e1', 'notCovered', 'statusOnly'], ['e2', 'controlled', 'attack']]);
});

test('a later action of an answered root reports alreadyAnswered once', () => {
  const combat = solo({ move: { hits: 1, effects: [{ op: 'damage', target: 'player', amount: 1 }] } });
  soloEnd(combat);
  assert.ok(combat.pendingReaction);
  const events = dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null }).events;
  assert.deepEqual(unavailable(events), [{ ownerId: 'player', sourceId: 'e1', reason: 'alreadyAnswered',
    cardId: 'guardCounter', cardIds: ['guardCounter'], attackKind: 'attack' }]);
});

test('skipping the offer on one action with hits:2 reports alreadyAnswered exactly once', () => {
  const combat = solo({ cardIds: ['guardCounter', 'guardCounter'] });
  soloEnd(combat);
  assert.ok(combat.pendingReaction);
  assert.equal(combat.queue.filter(action => action.effect.op === 'damage').length, 1, 'one damage action carries both hits');
  const events = dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null }).events;
  assert.deepEqual(unavailable(events), [{ ownerId: 'player', sourceId: 'e1', reason: 'alreadyAnswered',
    cardId: 'guardCounter', cardIds: ['guardCounter'], attackKind: 'attack' }]);
  const chosenAt = events.findIndex(event => event.type === 'combatReactionChosen');
  assert.equal(events.findIndex(event => event.type === 'combatReactionUnavailable'), chosenAt + 1, 'right after the answer');
  assert.deepEqual(combatLogEntries(events, { registries: createRegistries(contentBundle) }).map(row => row.text)
    .filter(text => text.startsWith('One reaction')), ["One reaction per attack: the rest of this attack can't be answered."]);
  const coopHits = coop({ cardIds: ['guardCounter', 'guardCounter'] });
  endTurn(coopHits, 'a');
  chooseReaction(coopHits, 'a', { offerId: coopHits.pendingReaction.id });
  assert.deepEqual(unavailable(coopHits.eventLog).map(row => [row.ownerId, row.reason]), [['a', 'alreadyAnswered']]);
});

test('a reaction that kills the attacker reports no alreadyAnswered for the cancelled rest', () => {
  const combat = solo({ cardIds: ['whirlingGuard', 'whirlingGuard'], move: { hits: 2, cardTags: SWEEP } });
  soloEnd(combat);
  assert.ok(combat.pendingReaction, 'the Sweep is offered');
  const [option] = combat.pendingReaction.options;
  assert.ok(option, 'Whirling Guard is offered');
  combat.enemies[0].hp = 1;
  const events = dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: option.id }).events;
  assert.ok(events.some(event => event.type === 'enemyDied'), 'the reaction killed the attacker');
  assert.deepEqual(unavailable(events), [], 'nothing claims the rest of a cancelled attack');
});

test('a single-hit root that was skipped reports nothing more', () => {
  const combat = solo({ move: { hits: 1 } });
  soloEnd(combat);
  const events = dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null }).events;
  assert.deepEqual(unavailable(events), []);
});

test('mixed-version co-op resolves a seat\'s candidates under that seat\'s own rules', () => {
  // Seat a runs the legacy rules, seat b the expansion; Whirling Guard is a
  // candidate only under b's. With b's Reaction switch off, b still hears why.
  const players = [
    { id: 'a', ...seatStats, drawPerTurn: 1, combatExpansionVersion: 1, deck: [{ cardId: 'strike', instanceId: 'a:0', upgraded: false }] },
    { id: 'b', ...seatStats, drawPerTurn: 1, combatExpansionVersion: 2, deck: [{ cardId: 'whirlingGuard', instanceId: 'b:0', upgraded: false }] }];
  const C = createCoopCombat({ registries: registriesWith({ hits: 1, cardTags: SWEEP }), rng: createRng(701), players,
    enemyIds: ['wanderingSoldier'], reactionRulesVersion: 1 });
  for (const P of C.players.values()) P.entity.block = 100;
  for (const enemy of C.enemies) enemy.ratings = { ar: 0, dr: 0, pr: 0, poise: 100, ward: 0 };
  setReactions(C, 'b', false);
  endTurn(C, 'a'); endTurn(C, 'b');
  assert.deepEqual(unavailable(C.eventLog).map(row => [row.ownerId, row.reason, row.cardIds]), [['b', 'switchOff', ['whirlingGuard']]]);
});

test('co-op reports the same reasons through the same offer door', () => {
  const cost = coop();
  cost.players.get('a').entity.energy = 0;
  endTurn(cost, 'a');
  assert.deepEqual(unavailable(cost.eventLog), [{ ownerId: 'a', sourceId: 'e1', reason: 'cost',
    cardId: 'guardCounter', cardIds: ['guardCounter'], attackKind: 'attack', resource: 'stamina', need: 1, have: 0 }]);
  const sweep = coop({ move: { cardTags: SWEEP } });
  endTurn(sweep, 'a');
  assert.deepEqual(unavailable(sweep.eventLog).map(row => [row.ownerId, row.reason, row.attackKind]), [['a', 'notCovered', 'sweep']]);
  const off = coop();
  setReactions(off, 'a', false);
  endTurn(off, 'a');
  assert.deepEqual(unavailable(off.eventLog).map(row => row.reason), ['switchOff']);
  const later = coop({ move: { hits: 1, effects: [{ op: 'damage', target: 'player', amount: 1 }] } });
  endTurn(later, 'a');
  chooseReaction(later, 'a', { offerId: later.pendingReaction.id });
  assert.deepEqual(unavailable(later.eventLog).map(row => row.reason), ['alreadyAnswered']);
  const frozen = coop({ seats: ['a', 'b'] });
  for (const P of frozen.players.values()) P.entity.energy = 0;
  leaveCombat(frozen, 'b');
  endTurn(frozen, 'a');
  assert.ok(unavailable(frozen.eventLog).every(row => row.ownerId !== 'b'), 'a disconnected seat gets no receipt');
});

const guardBroken = events => events.filter(event => event.type === 'combatGuardBroken').map(({ type, ...payload }) => payload);

test('v2: an enemy Smash that breaks a defending seat\'s Guard emits combatGuardBroken once per root', () => {
  const SMASH = { damage: 20, hits: 1, cardTags: ['camp:physical', 'maneuver:smash', 'reach:contact', 'targeting:single'] };
  for (const [block, broken] of [[0, true], [200, false]]) {
    const combat = solo({ cardIds: ['defend'], move: SMASH });
    combat.player.block = 0;
    dispatch(combat, { type: 'playCard', cardInstanceId: 'r0' });
    combat.player.block += block;
    assert.ok(combat.player.block > 0, 'Defend raised Guard');
    const rows = guardBroken(soloEnd(combat));
    assert.deepEqual(rows.map(({ targetId, sourceId }) => ({ targetId, sourceId })), broken ? [{ targetId: 'player', sourceId: 'e1' }] : []);
    if (broken) assert.ok(rows[0].poise > 0);
  }
});

test('v1: a Smash that breaks Guard emits combatGuardBroken once, queued or synchronous', () => {
  const registries = createRegistries(contentBundle);
  const c = createCombat({ registries, rng: createRng(50), ratingsRules: null, ruleset: combatRules,
    enemyIds: ['wanderingSoldier'], player: { classId: 'reaver', hp: 200, maxHp: 200, mana: 20, maxMana: 20,
      energyMax: 10, drawPerTurn: 1, deck: [{ instanceId: 'card1', cardId: 'strike' }], relicIds: [] } });
  const enemy = c.enemies[0];
  enemy.hp = enemy.maxHp = 200; enemy.block = 3;
  applyAttackDamage(c, c.player, enemy, 5, [], { combatProfile: { camp: 'physical', maneuver: 'smash', damageType: 'slashing' },
    attack: { source: 'weapon', damageType: 'slashing' }, combatRiderTargets: [] });
  assert.equal(c.combatExpansionVersion === 2, false);
  assert.deepEqual(guardBroken(c.eventLog).map(({ targetId, sourceId, poise }) => ({ targetId, sourceId, poise })),
    [{ targetId: 'e1', sourceId: 'player', poise: 3 }]);
  // The bonus is nominal (Poise Guard may absorb it), so the log claims pressure, not damage taken.
  assert.deepEqual(combatLogEntries(c.eventLog, { registries }).map(row => row.text).filter(text => text.startsWith('Guard broken')),
    ['Guard broken! (+3 Poise pressure)']);
});

test('v1: a Smash with a zero break bonus still reports the Guard break, with no Poise claim', () => {
  const registries = createRegistries(contentBundle);
  const c = createCombat({ registries, rng: createRng(50), ratingsRules: null, ruleset: combatRules,
    enemyIds: ['wanderingSoldier'], player: { classId: 'reaver', hp: 200, maxHp: 200, mana: 20, maxMana: 20,
      energyMax: 10, drawPerTurn: 1, deck: [{ instanceId: 'card1', cardId: 'strike' }], relicIds: [] } });
  const enemy = c.enemies[0];
  enemy.hp = enemy.maxHp = 200; enemy.block = 3;
  const poiseBefore = enemy.poiseMeter?.value;
  applyAttackDamage(c, c.player, enemy, 5, [], { combatProfile: { camp: 'physical', maneuver: 'smash', damageType: 'slashing', breakPoiseBonus: 0 },
    attack: { source: 'weapon', damageType: 'slashing' }, combatRiderTargets: [] });
  assert.deepEqual(guardBroken(c.eventLog).map(({ targetId, poise }) => ({ targetId, poise })), [{ targetId: 'e1', poise: 0 }]);
  assert.deepEqual(combatLogEntries(c.eventLog, { registries }).map(row => row.text).filter(text => text.startsWith('Guard broken')),
    ['Guard broken!']);
  assert.equal(enemy.poiseMeter?.value, poiseBefore, 'no bonus Poise was applied');
});

test('v1: a Smash into an armed Counter breaks Guard through the synchronous door once', () => {
  const profile = { camp: 'physical', maneuver: 'smash', damageType: 'slashing' };
  const registries = createRegistries({ ...legacyContentBundle,
    cards: legacyContentBundle.cards.map(card => card.id === 'kilnCleave' ? { ...card,
      effects: [{ op: 'damage', target: 'enemy', amount: 4, combatProfile: profile }] } : card),
    enemies: legacyContentBundle.enemies.map(enemy => enemy.id === 'gildedKnight' ? { ...enemy, firstMove: 'parry' } : enemy) });
  const c = createCombat({ registries, rng: createRng(50), enemyIds: ['gildedKnight', 'wanderingSoldier'], ratingsRules: null,
    player: { classId: 'reaver', hp: 200, maxHp: 200, energyMax: 10, drawPerTurn: 1,
      deck: [{ instanceId: 'smash1', cardId: 'kilnCleave' }], relicIds: [] } });
  const enemy = c.enemies[0];
  enemy.block = 3; enemy.wardBlock = 0; enemy.poiseGuard = 0; enemy.poiseMeter = { value: 0, max: 100 };
  enemy.combatCounter.mode = 'melee'; enemy.combatCounter.damage = 6; enemy.combatCounter.poiseDamage = 4;
  c.player.poiseMeter = { value: 0, max: 100 };
  dispatch(c, { type: 'playCard', cardInstanceId: 'smash1', targetId: enemy.id });
  assert.deepEqual(guardBroken(c.eventLog).map(({ targetId, sourceId, poise }) => ({ targetId, sourceId, poise })),
    [{ targetId: enemy.id, sourceId: 'player', poise: 3 }]);
});
