import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { enemyReactionsActive, reactionMovesOf, incomingAgainst, decideEnemyReaction, clearEnemyReactionRolls } from '../src/engine/enemyReactions.js';

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
