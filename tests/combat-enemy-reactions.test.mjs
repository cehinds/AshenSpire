import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { createCoopCombat, playCard as coopPlay, chooseReaction as coopChoose, endTurn as coopEnd, leaveCombat, joinCombat } from '../src/engine/coopCombat.js';
import { serializeCoopCombatSnapshot, decodeCoopCombatSnapshot } from '../src/engine/coopCombatSnapshot.js';
import { combatLogEntries } from '../src/model/combatLog.js';
import { createRng } from '../src/engine/rng.js';
import { enemyReactionsActive, reactionMovesOf, incomingAgainst, decideEnemyReaction, clearEnemyReactionRolls, openEnemyWindow } from '../src/engine/enemyReactions.js';

// A soldier whose authored moves include reaction moves (never rolled as intents).
const REACTION_MOVES = {
  attackMove: { intent: 'attack', damage: 1, weight: 1, tags: ['camp:physical', 'maneuver:attack', 'reach:contact', 'targeting:single'] },
  guardA: { intent: 'attack', damage: 3, block: 6, reaction: { on: ['playerAction'], minIncoming: 8 } },
  riposteB: { intent: 'attack', damage: 4, reaction: { on: ['playerReaction'], chance: 0.5 } },
  riposteC: { intent: 'attack', damage: 2, reaction: { on: ['playerReaction'], chance: 0 } },
  guardD: { intent: 'attack', damage: 2, reaction: { on: ['playerAction', 'playerReaction'], chance: 1, minIncoming: 20 } },
};

function fixture({ flag = true, version = 2, moves = REACTION_MOVES } = {}) {
  moves = { attackMove: REACTION_MOVES.attackMove, ...moves };
  const registries = createRegistries({ ...contentBundle,
    enemies: contentBundle.enemies.map(enemy => enemy.id === 'wanderingSoldier' ? { ...enemy, firstMove: 'attackMove', moves } : enemy) });
  const combat = createCombat({ registries, rng: createRng(4242), combatExpansionVersion: 2, reactionRulesVersion: version,
    enemyIds: ['wanderingSoldier', 'wanderingSoldier'], player: { classId: 'reaver', maxHp: 100, hp: 100,
      maxMana: 20, mana: 20, maxStamina: 20, stamina: 20, energyMax: 20, drawPerTurn: 1,
      deck: [{ cardId: 'strike', instanceId: 'r0', upgraded: false }] } });
  if (!flag && combat.reactionRules) delete combat.reactionRules.enemyReactions;
  for (const enemy of combat.enemies) enemy.ratings = { ar: 0, dr: 0, pr: 0, poise: 100, ward: 0 };
  first = combat.enemies[0];
  return combat;
}

const draws = combat => combat.rng.getCounters().enemyReaction || 0;
let first;
const ids = moves => moves.map(([id]) => id);

test('the flag gates enemy reactions to version 2 with enemyReactions true', () => {
  assert.equal(enemyReactionsActive(fixture()), true);
  assert.equal(enemyReactionsActive(fixture({ flag: false })), false);
  assert.equal(enemyReactionsActive(fixture({ version: 1 })), false);
  assert.equal(enemyReactionsActive({ reactionRulesVersion: 2 }), false);
});

test('reactionMovesOf lists the moves that name the window, in authored order', () => {
  const combat = fixture();
  assert.deepEqual(ids(reactionMovesOf(combat, first, 'playerAction')), ['guardA', 'guardD']);
  assert.deepEqual(ids(reactionMovesOf(combat, first, 'playerReaction')), ['riposteB', 'riposteC', 'guardD']);
  assert.deepEqual(ids(reactionMovesOf(combat, first, 'nowhere')), []);
});

test('reaction moves are never rolled as intents', () => {
  const combat = fixture();
  for (const enemy of combat.enemies) assert.deepEqual(enemy.movesHistory, ['attackMove']);
  assert.equal(first.intent.moveId, 'attackMove');
});

test('incomingAgainst takes the largest positive amount aimed at the enemy', () => {
  const group = { targets: {
    a: { id: first.id, contacts: [{ amount: 5 }, { amount: 9 }, { amount: 0, pressure: 3 }] },
    b: { id: 'other', contacts: [{ amount: 30 }] },
  } };
  assert.equal(incomingAgainst(group, first.id), 9);
  assert.equal(incomingAgainst({ group }, first.id), 9);
  assert.equal(incomingAgainst(group, 'nobody'), 0);
});

test('a window qualifies on minIncoming and takes a chance-1 move without a draw', () => {
  const combat = fixture();
  const before = draws(combat);
  assert.equal(decideEnemyReaction(combat, first, 'playerAction', { groupKey: 'g', windowIndex: 0, incoming: 7 }), null);
  assert.equal(decideEnemyReaction(combat, first, 'playerAction', { groupKey: 'g', windowIndex: 0, incoming: 8 }), 'guardA');
  assert.equal(decideEnemyReaction(combat, first, 'playerAction', { groupKey: 'g', windowIndex: 0, incoming: 0 }), null);
  assert.equal(draws(combat), before);
});

test('a chance-0 move is never taken and the decision passes to the next move', () => {
  const combat = fixture({ moves: { riposteC: { intent: 'attack', damage: 2, reaction: { on: ['playerReaction'], chance: 0 } },
    guardD: { intent: 'attack', damage: 2, reaction: { on: ['playerReaction'], chance: 1 } } } });
  const before = draws(combat);
  assert.equal(decideEnemyReaction(combat, first, 'playerReaction', { groupKey: 'g', windowIndex: 1, incoming: 3 }), 'guardD');
  assert.equal(draws(combat), before);
});

test('a fractional chance draws once and memoises the outcome per window', () => {
  const moves = { riposteB: { intent: 'attack', damage: 4, reaction: { on: ['playerReaction'], chance: 0.5 } } };
  const combat = fixture({ moves });
  const before = draws(combat);
  const first1 = decideEnemyReaction(combat, first, 'playerReaction', { groupKey: 'g', windowIndex: 1, incoming: 2 });
  const memo = `g:1:${first.id}:riposteB`;
  assert.equal(draws(combat), before + 1);
  assert.equal(combat.enemyReactionRolls[memo], first1 === 'riposteB');
  assert.equal(decideEnemyReaction(combat, first, 'playerReaction', { groupKey: 'g', windowIndex: 1, incoming: 2 }), first1);
  assert.equal(draws(combat), before + 1);
});

test('both outcomes of a fractional chance are reachable by seed', () => {
  const outcomes = new Set();
  for (let seed = 1; seed < 60 && outcomes.size < 2; seed++) {
    const moves = { riposteB: { intent: 'attack', damage: 4, reaction: { on: ['playerReaction'], chance: 0.5 } } };
    const combat = fixture({ moves });
    combat.rng = createRng(seed);
    outcomes.add(decideEnemyReaction(combat, first, 'playerReaction', { groupKey: 'g', windowIndex: 1, incoming: 2 }));
  }
  assert.deepEqual([...outcomes].sort(), [null, 'riposteB']);
});

test('a candidate state reads the memo and never draws', () => {
  const moves = { riposteB: { intent: 'attack', damage: 4, reaction: { on: ['playerReaction'], chance: 0.5 } } };
  const combat = fixture({ moves });
  const before = draws(combat);
  combat._reactionPlaying = true;
  assert.equal(decideEnemyReaction(combat, first, 'playerReaction', { groupKey: 'g', windowIndex: 1, incoming: 2 }), null);
  assert.equal(draws(combat), before);
  delete combat._reactionPlaying;
  combat.enemyReactionRolls = { [`g:1:${first.id}:riposteB`]: true };
  combat._reactionPlaying = true;
  assert.equal(decideEnemyReaction(combat, first, 'playerReaction', { groupKey: 'g', windowIndex: 1, incoming: 2 }), 'riposteB');
});

test('one reaction per enemy per combat turn', () => {
  const combat = fixture();
  first.combatReactionTurn = combat.turn;
  assert.equal(decideEnemyReaction(combat, first, 'playerAction', { groupKey: 'g', windowIndex: 0, incoming: 9 }), null);
  first.combatReactionTurn = combat.turn - 1;
  assert.equal(decideEnemyReaction(combat, first, 'playerAction', { groupKey: 'g', windowIndex: 0, incoming: 9 }), 'guardA');
});

test('a dead, staggered or control-locked enemy does not react', () => {
  const combat = fixture();
  const dead = { ...first, alive: false };
  assert.equal(decideEnemyReaction(combat, dead, 'playerAction', { groupKey: 'g', windowIndex: 0, incoming: 9 }), null);
  const staggered = { ...first, skipNextTurn: true };
  assert.equal(decideEnemyReaction(combat, staggered, 'playerAction', { groupKey: 'g', windowIndex: 0, incoming: 9 }), null);
});

test('clearEnemyReactionRolls drops the memo', () => {
  const combat = fixture({ moves: { riposteB: { intent: 'attack', damage: 4, reaction: { on: ['playerReaction'], chance: 0.5 } } } });
  decideEnemyReaction(combat, first, 'playerReaction', { groupKey: 'g', windowIndex: 1, incoming: 2 });
  assert.ok(combat.enemyReactionRolls);
  clearEnemyReactionRolls(combat);
  assert.equal(combat.enemyReactionRolls, undefined);
});

test('with the flag absent nothing is decided and nothing is drawn', () => {
  const combat = fixture({ flag: false });
  const before = draws(combat);
  assert.equal(decideEnemyReaction(combat, first, 'playerAction', { groupKey: 'g', windowIndex: 0, incoming: 9 }), null);
  assert.equal(combat.enemyReactionRolls, undefined);
  assert.equal(draws(combat), before);
});

// ---------------------------------------------------------------------------
// The engine: windows, the stack and resolution (contract "Enemy reactions",
// Acceptance). Real carriers: Gilded Knight's Gilded Guard and Court Duelist's
// Binding Riposte. `heavyStrike` deals 12 (>= 8); `strike` and `heavyReact` are
// tagged trait:reaction in this bundle.
// ---------------------------------------------------------------------------
const strikeDef = contentBundle.cards.find(card => card.id === 'strike');
const heavyDef = { ...strikeDef, id: 'heavyStrike', name: 'Heavy Strike', effects: [{ op: 'damage', target: 'enemy', amount: 12 }] };
const heavyReactDef = { ...heavyDef, id: 'heavyReact', name: 'Heavy React' };
const strikeTags = contentBundle.tagging.filter(row => row.family === 'card' && row.objectId === 'strike');
function engineRegistries({ firstMoves = {} } = {}) {
  return createRegistries({ ...contentBundle, cards: [...contentBundle.cards, heavyDef, heavyReactDef],
    tagging: [...contentBundle.tagging, ...strikeTags.map(row => ({ ...row, objectId: 'heavyStrike' })),
      ...strikeTags.map(row => ({ ...row, objectId: 'heavyReact' })),
      { family: 'card', scope: '', objectId: 'strike', tagId: 'trait:reaction' },
      { family: 'card', scope: '', objectId: 'heavyReact', tagId: 'trait:reaction' }],
    enemies: contentBundle.enemies.map(enemy => firstMoves[enemy.id] ? { ...enemy, firstMove: firstMoves[enemy.id] } : enemy) });
}
const seatStats = { classId: 'reaver', maxHp: 100, hp: 100, maxMana: 20, mana: 20, maxStamina: 20, stamina: 20, energyMax: 20 };
function solo({ enemyIds = ['gildedKnight'], cards = ['heavyStrike', 'strike'], seed = 5, flag = true, version = 2, firstMoves } = {}) {
  const registries = engineRegistries({ firstMoves });
  const combat = createCombat({ registries, rng: createRng(seed), combatExpansionVersion: 2, reactionRulesVersion: version, enemyIds,
    player: { ...seatStats, drawPerTurn: cards.length, deck: cards.map((cardId, index) => ({ cardId, instanceId: `c${index}`, upgraded: false })) } });
  if (!flag && combat.reactionRules) delete combat.reactionRules.enemyReactions;
  combat.player.block = 100;
  return { combat, registries };
}
const types = out => out.events.map(event => event.type);
const play = (combat, instanceId, targetId = combat.enemies[0].id) => dispatch(combat, { type: 'playCard', cardInstanceId: instanceId, targetId });
const reply = (combat, optionId = null) => dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId });
const optionFor = (state, instanceId) => state.pendingReaction.options.find(option => option.play.cardInstanceId === instanceId).id;
const json = value => JSON.parse(JSON.stringify(value));
const indexOf = (out, predicate) => out.events.findIndex(predicate);

test('Gilded Guard pushes before a heavy player hit and resolves first; a light hit does not qualify', () => {
  const { combat, registries } = solo();
  const knight = combat.enemies[0];
  const opened = play(combat, 'c0');
  assert.ok(types(opened).includes('combatEnemyReactionStacked'));
  assert.equal(combat.reactionStack.entries[0].side, 'enemy');
  assert.equal(combat.reactionStack.entries[0].moveId, 'gildedGuard');
  assert.equal(knight.combatReactionTurn, combat.turn);
  // The card waits for its root: neither resolved nor discarded yet.
  assert.equal(types(opened).includes('cardResolved'), false);
  assert.equal(combat.piles.discard.length, 0);
  const out = reply(combat);
  const started = indexOf(out, event => event.type === 'enemyMoveStarted' && event.reaction === true && event.moveId === 'gildedGuard');
  const block = indexOf(out, event => event.type === 'blockGained' && event.targetId === knight.id);
  const hit = indexOf(out, event => event.type === 'damageDealt' && event.targetId === knight.id);
  assert.ok(started >= 0 && started < block && block < hit, 'the guard resolves before the root hit');
  assert.ok(types(out).includes('cardResolved'));
  assert.deepEqual(combat.piles.discard.map(inst => inst.instanceId), ['c0']);
  assert.equal(combat.reactionStack, undefined);
  const log = combatLogEntries(out.events, { registries, enemies: combat.enemies }).map(row => row.text);
  assert.ok(log.includes('Gilded Knight reacts with Gilded Guard.'), log.join('\n'));
  // A 6-damage Strike is under minIncoming 8: no window, no stack.
  const light = solo();
  assert.equal(types(play(light.combat, 'c1')).includes('combatEnemyReactionStacked'), false);
  assert.equal(light.combat.reactionStack, undefined);
});

test('the acting seat can answer the enemy entry; its reaction resolves first', () => {
  const { combat } = solo();
  play(combat, 'c0');
  assert.equal(combat.pendingReaction.ownerId, 'player');
  assert.equal(combat.pendingReaction.sourceId, combat.enemies[0].id);
  const id = optionFor(combat, 'c1');
  assert.ok(id.endsWith(`:${combat.enemies[0].id}`), 'aimed at the entry\'s enemy');
  const out = reply(combat, id);
  const reaction = indexOf(out, event => event.type === 'cardPlayed' && event.cardInstanceId === 'c1');
  const guard = indexOf(out, event => event.type === 'enemyMoveStarted' && event.reaction);
  assert.ok(reaction >= 0 && reaction < guard);
  assert.deepEqual(combat.piles.discard.map(inst => inst.instanceId).sort(), ['c0', 'c1']);
});

test('one reaction per enemy per combat turn', () => {
  const { combat } = solo({ cards: ['heavyStrike', 'heavyStrike'] });
  play(combat, 'c0');
  if (combat.pendingReaction) reply(combat);
  assert.equal(types(play(combat, 'c1')).includes('combatEnemyReactionStacked'), false);
  assert.equal(combat.reactionStack, undefined);
});

test('enemyReactions absent (or version 1) disables enemy reactions entirely', () => {
  for (const options of [{ flag: false }, { version: 1 }]) {
    const { combat } = solo(options);
    const before = combat.rng.getCounters().enemyReaction || 0;
    const out = play(combat, 'c0');
    assert.equal(types(out).includes('combatEnemyReactionStacked'), false);
    assert.equal(combat.reactionStack, undefined);
    assert.equal(combat.pendingReaction, undefined);
    assert.ok(types(out).includes('cardResolved'));
    assert.equal(combat.rng.getCounters().enemyReaction || 0, before);
  }
});

test('a fight without reaction moves is identical to a flag-off run', () => {
  const run = flag => {
    const { combat } = solo({ enemyIds: ['wanderingSoldier', 'wanderingSoldier'], flag, cards: ['heavyStrike', 'strike', 'strike'] });
    const outs = [play(combat, 'c0')];
    if (combat.pendingReaction) outs.push(reply(combat));
    outs.push(dispatch(combat, { type: 'endTurn' }));
    while (combat.pendingReaction) outs.push(reply(combat, combat.pendingReaction.options[0].id));
    const saved = json(serializeCombatSnapshot(combat));
    delete saved.reactionRules.enemyReactions;
    return { events: json(outs.map(out => out.events)), saved, counters: combat.rng.getCounters(),
      intents: combat.enemies.map(enemy => enemy.movesHistory) };
  };
  assert.deepEqual(run(true), run(false));
});

// Court Duelist opens with Lunge (an attack): the player pushes a Strike at it, and
// Binding Riposte (chance 0.5) decides in the playerReaction window opened by that push.
function duelist(seed) {
  const built = solo({ enemyIds: ['courtDuelist'], cards: ['strike', 'strike'], seed, firstMoves: { courtDuelist: 'lunge' } });
  dispatch(built.combat, { type: 'endTurn' });
  return built;
}

test('Binding Riposte answers a pushed reaction at its chance: both outcomes, memoised', () => {
  const seen = new Map();
  for (let seed = 1; seed < 80 && seen.size < 2; seed++) {
    const { combat } = duelist(seed);
    if (!combat.pendingReaction) continue;
    const root = combat.pendingReaction.groupKey;
    const before = combat.rng.getCounters().enemyReaction || 0;
    const out = reply(combat, optionFor(combat, 'c0'));
    const key = `${root}:0:${combat.enemies[0].id}:bindingRiposte`;
    assert.equal(typeof combat.enemyReactionRolls?.[key], 'boolean');
    assert.equal(combat.rng.getCounters().enemyReaction, before + 1);
    const reacted = types(out).includes('combatEnemyReactionStacked');
    assert.equal(reacted, combat.enemyReactionRolls[key]);
    if (reacted) {
      const entry = combat.reactionStack.entries.at(-1);
      assert.deepEqual([entry.side, entry.moveId, entry.targetPlayerId], ['enemy', 'bindingRiposte', 'player']);
      assert.equal(entry.plan.group.carrier.combatReaction, true);
    }
    seen.set(reacted, seed);
  }
  assert.deepEqual([...seen.keys()].sort(), [false, true]);
});

function duelistReacting() {
  for (let seed = 1; seed < 80; seed++) {
    const built = duelist(seed);
    if (!built.combat.pendingReaction) continue;
    reply(built.combat, optionFor(built.combat, 'c0'));
    if (built.combat.reactionStack?.entries.some(entry => entry.side === 'enemy')) return { ...built, seed };
  }
  throw new Error('no seed reacts');
}

test('a memoised roll and a committed plan survive save/restore with identical state and RNG counters', () => {
  const { combat, registries } = duelistReacting();
  assert.ok(combat.pendingReaction, 'the seat is re-offered against the riposte');
  const saved = json(serializeCombatSnapshot(combat));
  assert.ok(saved.enemyReactionRolls && saved.reactionStack.entries.some(entry => entry.side === 'enemy' && entry.plan));
  const restored = restoreCombatSnapshot({ registries, rng: createRng(combat.rng.seed, combat.rng.getCounters()), snapshot: json(saved) });
  assert.deepEqual(json(serializeCombatSnapshot(restored)), saved);
  const outs = [combat, restored].map(state => reply(state));
  assert.deepEqual(json(outs[0].events), json(outs[1].events));
  assert.ok(outs[0].events.some(event => event.type === 'enemyMoveStarted' && event.reaction && event.moveId === 'bindingRiposte'));
  assert.deepEqual(json(serializeCombatSnapshot(restored)), json(serializeCombatSnapshot(combat)));
  assert.deepEqual(restored.rng.getCounters(), combat.rng.getCounters());
});

test('offer checks never draw: re-offers and canonical checks leave the enemyReaction counter alone', () => {
  const { combat } = duelistReacting();
  const after = combat.rng.getCounters().enemyReaction;
  // The re-offer (already computed) replayed the committed riposte plan in candidates,
  // and answering rechecks it canonically; neither draws.
  const options = combat.pendingReaction.options;
  assert.ok(options.length > 0);
  reply(combat, options[0].id);
  assert.equal(combat.rng.getCounters().enemyReaction, after);
});

test('a version-2 snapshot without the flag key has no enemy reactions after restore', () => {
  const { combat, registries } = solo({ flag: false });
  const saved = json(serializeCombatSnapshot(combat));
  const restored = restoreCombatSnapshot({ registries, rng: createRng(5, combat.rng.getCounters()), snapshot: saved });
  assert.equal(types(play(restored, 'c0')).includes('combatEnemyReactionStacked'), false);
});

test('no window on Counter-return roots or reaction plays', () => {
  // A reaction play (the heavy reaction pushed against the Knight's Thrust) opens no
  // playerAction window, though it hits the Knight for 12.
  const { combat } = solo({ cards: ['heavyReact'], firstMoves: { gildedKnight: 'thrust' } });
  dispatch(combat, { type: 'endTurn' });
  assert.ok(combat.pendingReaction);
  const out = reply(combat, optionFor(combat, 'c0'));
  assert.ok(out.events.some(event => event.type === 'cardPlayed' && event.cardInstanceId === 'c0'));
  assert.equal(types(out).includes('combatEnemyReactionStacked'), false);
  // A Counter-return root (and any reaction carrier) opens no window and draws nothing.
  const duel = duelist(3).combat;
  const before = duel.rng.getCounters().enemyReaction || 0;
  const pushed = { side: 'player', ownerId: 'player', incoming: { [duel.enemies[0].id]: 9 } };
  for (const group of [{ key: 'x:1', sourceId: duel.enemies[0].id, targets: {}, counterReturn: { sourceId: duel.enemies[0].id } },
    { key: 'x:2', sourceId: duel.enemies[0].id, targets: {}, carrier: { combatReaction: true } },
    { key: 'x:3', sourceId: duel.enemies[0].id, targets: {}, carrier: { reactionDepth: 1 } }]) {
    assert.deepEqual(openEnemyWindow(duel, group, 'playerReaction', pushed, {}), []);
    assert.equal(group.enemyWindows, undefined);
  }
  assert.equal(duel.rng.getCounters().enemyReaction || 0, before);
});

// ---- co-op ------------------------------------------------------------------
function coop({ seed = 9, hands = { a: ['heavyStrike', 'strike'], b: ['strike', 'strike'] }, firstMoves, enemyIds = ['gildedKnight'] } = {}) {
  const registries = engineRegistries({ firstMoves });
  const players = Object.entries(hands).map(([id, cards]) => ({ id, ...seatStats, drawPerTurn: cards.length, combatExpansionVersion: 2,
    deck: cards.map((cardId, index) => ({ cardId, instanceId: `${id}:${index}`, upgraded: false })) }));
  const C = createCoopCombat({ registries, rng: createRng(seed), players, enemyIds, reactionRulesVersion: 2 });
  for (const P of C.players.values()) P.entity.block = 100;
  return { C, registries, players };
}

test('co-op: Gilded Guard pushes before the heavy hit, and only the acting seat may answer', () => {
  const { C } = coop();
  const knight = C.enemies[0];
  const opened = coopPlay(C, 'a', 'a:0', knight.id);
  assert.ok(opened.events.some(event => event.type === 'combatEnemyReactionStacked' && event.targetPlayerId === 'a'));
  assert.equal(C.pendingReaction.ownerId, 'a');
  assert.throws(() => coopChoose(C, 'b', { offerId: C.pendingReaction.id, optionId: null }), /unavailable/);
  assert.throws(() => coopPlay(C, 'b', 'b:0', knight.id), /pending reaction/);
  const out = coopChoose(C, 'a', { offerId: C.pendingReaction.id, optionId: optionFor(C, 'a:1') });
  const reaction = indexOf(out, event => event.type === 'cardPlayed' && event.cardInstanceId === 'a:1');
  const guard = indexOf(out, event => event.type === 'enemyMoveStarted' && event.reaction);
  const root = indexOf(out, event => event.type === 'cardResolved' && event.cardInstanceId === 'a:0');
  assert.ok(reaction >= 0 && reaction < guard && guard < root);
  assert.ok(C.players.get('a').piles.discard.some(inst => inst.instanceId === 'a:0'));
  assert.equal(C.reactionStack, undefined);
});

test('co-op: a dead acting seat cancels the root', () => {
  const { C } = coop({ hands: { a: ['heavyStrike'], b: ['strike'] } });
  const knight = C.enemies[0], seat = C.players.get('a').entity;
  seat.block = 0; seat.hp = 1;
  const hp = knight.hp;
  const out = coopPlay(C, 'a', 'a:0', knight.id);
  assert.ok(out.events.some(event => event.type === 'enemyMoveStarted' && event.reaction));
  assert.equal(seat.alive, false);
  assert.equal(out.events.some(event => event.type === 'damageDealt' && event.targetId === knight.id), false);
  assert.equal(knight.hp, hp);
  assert.equal(C.reactionStack, undefined);
});

test('co-op: a memoised roll and a committed plan survive save/restore', () => {
  let found = null;
  for (let seed = 1; seed < 80 && !found; seed++) {
    const built = coop({ seed, enemyIds: ['courtDuelist'], firstMoves: { courtDuelist: 'lunge' }, hands: { a: ['strike', 'strike'], b: ['strike'] } });
    coopEnd(built.C, 'a'); coopEnd(built.C, 'b');
    if (built.C.pendingReaction?.ownerId !== 'a') continue;
    coopChoose(built.C, 'a', { offerId: built.C.pendingReaction.id, optionId: optionFor(built.C, 'a:0') });
    if (built.C.reactionStack?.entries.some(entry => entry.side === 'enemy')) found = built;
  }
  assert.ok(found, 'some seed reacts');
  const { C, registries, players } = found;
  assert.equal(C.pendingReaction.ownerId, 'a');
  const saved = json(serializeCoopCombatSnapshot(C));
  const restored = createCoopCombat({ registries, rng: createRng(C.rng.seed, C.rng.getCounters()), players, enemyIds: [], snapshot: json(saved) });
  const decoded = state => decodeCoopCombatSnapshot(serializeCoopCombatSnapshot(state));
  assert.deepEqual(decoded(restored), decoded(C));
  assert.equal(Object.keys(decoded(restored).enemyReactionRolls).length, 1);
  const outs = [C, restored].map(state => coopChoose(state, 'a', { offerId: state.pendingReaction.id, optionId: null }));
  assert.deepEqual(json(outs[0].events), json(outs[1].events));
  assert.deepEqual(decoded(restored), decoded(C));
  assert.deepEqual(restored.rng.getCounters(), C.rng.getCounters());
});

test('co-op: the acting seat leaving during its window cancels the root', () => {
  const { C } = coop({ hands: { a: ['heavyStrike', 'strike'], b: ['strike'] } });
  const knight = C.enemies[0];
  coopPlay(C, 'a', 'a:0', knight.id);
  assert.equal(C.pendingReaction.ownerId, 'a');
  const hits = () => C.eventLog.filter(event => event.type === 'damageDealt' && event.targetId === knight.id).length;
  const before = hits();
  leaveCombat(C, 'a');
  assert.equal(C.pendingReaction, undefined);
  assert.equal(C.reactionStack, undefined);
  // The guard fizzles (its target left) and the root is cancelled: nothing hits the Knight.
  assert.ok(C.eventLog.some(event => event.type === 'combatReactionFizzled' && event.side === 'enemy'));
  assert.equal(hits(), before);
});

test('co-op: the last connected seat leaving mid-window resumes its root on rejoin, with the card discarded once', () => {
  const { C, players } = coop({ hands: { a: ['heavyStrike', 'strike'], b: ['strike'] } });
  const knight = C.enemies[0];
  leaveCombat(C, 'b');
  coopPlay(C, 'a', 'a:0', knight.id);
  assert.equal(C.pendingReaction.ownerId, 'a');
  leaveCombat(C, 'a');
  assert.equal(C.phase, 'suspended');
  joinCombat(C, players.find(player => player.id === 'a'));
  assert.equal(C.reactionStack, undefined);
  assert.equal(C.reactionRootPlay, undefined);
  const seat = C.players.get('a');
  const copies = [...seat.piles.hand, ...seat.piles.discard, ...seat.piles.draw].filter(inst => inst.instanceId === 'a:0');
  assert.equal(copies.length, 1, 'the root card sits in exactly one pile');
  assert.doesNotThrow(() => decodeCoopCombatSnapshot(serializeCoopCombatSnapshot(C)));
});

test('a playerReaction window opens only for the root owner or enemies the root card targets', () => {
  const { C } = coop({ enemyIds: ['gildedKnight', 'courtDuelist'] });
  const [knight, duelist] = C.enemies;
  const group = { key: 'g', sourceId: knight.id, targets: {}, enemyWindows: 1 };
  // The pushed reaction hits the Duelist, but the Duelist neither owns the root nor is its target.
  const opened = openEnemyWindow(C, group, 'playerReaction', { ownerId: 'a', incoming: { [duelist.id]: 9 } }, {});
  assert.deepEqual(opened, []);
  assert.equal(C.rng.getCounters().enemyReaction || 0, 0, 'no window, so no draw');
});
