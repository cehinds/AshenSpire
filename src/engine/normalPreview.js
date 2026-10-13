// src/engine/normalPreview.js — momentum in normal combat (SPEC §4.11; owner decision 2026-10-12).
//
// Rounds mode (combatRoundsAdapter.js) keeps momentum per enemy and settles it once per round. A normal fight
// has no speed order and no hit roll, so momentum here has NO mechanical effect: it is tracked, shown on the
// turn banner, and recorded. The rules are the rounds rules, reused:
//   - a turn is a round: each enemy's M moves 1 toward 0 when the player's turn starts (decayMomentum);
//   - each exchange credits one side at most once: a landed attack to the attacker, a blocked, evaded or
//     missed attack to the defender, a counter that fires to the counter's owner; the gain is the winner's card
//     gain (default 1) plus the stance bonus (creditExchange, stance-advantage.csv);
//   - the summed deltas are added to the decayed start once at the end of the enemy phase and clamped to
//     -3..+3, and a raw total past the cap sets the overflow flag (settleRound's rule).
// Not mapped: the ±3 counter stagger (normal Counters carry no stagger tag), and the overflow flag's poise
// double (normal combat models no poise damage to double). Both are recorded and change nothing.
//
// Engine code only: no DOM. Events reach here from emitEvent (triggers.js); the hooks in combat.js are the
// turn start, the enemy phase's end and the play of a card (its stance).
import { creditExchange } from './combatRounds/timeline.js';
import { clampMomentum, decayMomentum, MOMENTUM_MAX, MOMENTUM_MIN, parseStanceAdvantage } from './combatRounds/resolver.js';
import { enemyTimelineCard, moveKind, stanceFor } from './combatRoundsAdapter.js';
import { STANCE_ADVANTAGE_CSV } from '../content/combatRounds.js';

const STANCE_TABLE = parseStanceAdvantage(STANCE_ADVANTAGE_CSV);

/** The stance-advantage table (stance-advantage.csv) the normal-combat momentum and outline read. */
export function normalStanceTable() {
  return STANCE_TABLE;
}

/** True when the fight carries the normal-combat momentum toggle (combat.normalPreview.momentum). */
export function momentumOn(combat) {
  return combat?.normalPreview?.momentum === true;
}

function stateOf(combat) {
  return combat.normalPreview.state;
}

/** True when the fight carries the multi-action toggle in normal combat (combat.normalPreview.multiAction). */
export function multiActionOn(combat) {
  return combat?.normalPreview?.multiAction === true;
}

/**
 * The enemy's planned actions as timeline cards, in play order: the current action first, then its planned
 * follow-ups (combat.enemies[].plannedMoves). [] when the toggle is off, or the enemy has no action to play.
 */
export function enemyPlanActions(combat, enemy) {
  if (!multiActionOn(combat) || !enemy?.alive) return [];
  const intent = enemy.intent;
  if (!intent?.moveId || intent.kind === 'staggered') return [];
  const def = combat.registries.enemies.get(enemy.enemyId);
  const head = { moveId: intent.moveId, sp: 1 };
  return [head, ...(enemy.plannedMoves ?? [])].map((entry, i) => enemyTimelineCard(enemy, entry, i, def));
}

/** Turn start: each enemy's stored M moves one step toward 0 (the rounds decay, DESIGN.md). */
export function decayNormalMomentum(combat) {
  if (!momentumOn(combat)) return;
  const { momentum } = stateOf(combat);
  for (const id of Object.keys(momentum)) momentum[id] = decayMomentum(momentum[id], 1);
}

/** Enemy phase end: the summed deltas join each enemy's decayed start once, clamped; then the round's scratch clears. */
export function settleNormalMomentum(combat) {
  if (!momentumOn(combat)) return;
  const st = stateOf(combat);
  for (const enemy of combat.enemies) {
    const raw = clampMomentum(st.momentum[enemy.id] ?? 0) + (st.pending[enemy.id] ?? 0);
    st.momentum[enemy.id] = clampMomentum(raw) || 0;
    if (raw > MOMENTUM_MAX) st.poiseDouble.player = true;
    if (raw < MOMENTUM_MIN) st.poiseDouble[enemy.id] = true;
  }
  st.pending = {};
  delete st.counterDamage;
  delete st.enemyExchange;
}

/** The momentum the turn banner reads: each enemy's stored M, already decayed for this turn. */
export function displayedMomentum(combat) {
  return momentumOn(combat) ? { ...stateOf(combat).momentum } : {};
}

/** The timeline stance of an enemy's current action, or null when it has none (none, or staggered). */
export function enemyIntentStance(combat, enemy) {
  const intent = enemy?.intent;
  if (!intent?.moveId || intent.kind === 'staggered') return null;
  const def = combat.registries.enemies.get(enemy.enemyId);
  const move = def?.moves?.[intent.moveId];
  return move ? stanceFor(moveKind(move), Array.isArray(move.tags) ? move.tags : []) : null;
}

// 'player', 'enemy' or null for a combatant id.
function sideOf(combat, id) {
  if (id === combat.player.id) return 'player';
  return combat.enemies.some((e) => e.id === id) ? 'enemy' : null;
}

function enemyById(combat, id) {
  return combat.enemies.find((e) => e.id === id) ?? null;
}

// The sides already credited in the exchange an event belongs to (PR #1953 review). An exchange is one played card
// against one target, or one enemy move, however many hits it lands, as a rounds timeline entry is (timeline.js
// resolveExchange shares one credited list per entry). `attackerId` is the side whose card or move opened it. An
// event outside any open exchange (a hit with no card, thorns) is its own exchange.
function creditedFor(combat, attackerId, key) {
  const st = stateOf(combat);
  if (attackerId === combat.player.id && st.cardExchange) return (st.cardExchange[key] ||= []);
  if (attackerId != null && st.enemyExchange?.sourceId === attackerId) return st.enemyExchange.credited;
  return [];
}

// One exchange. `key` is the enemy in it; a card gain is 1 (normal cards carry no momentumGain).
function exchange(combat, key, winner, winStance, foeStance, credited = []) {
  creditExchange({ pending: stateOf(combat).pending, stanceTable: STANCE_TABLE }, {
    key, winner, winCard: { momentumGain: 1, stance: winStance }, foeCard: { stance: foeStance }, events: [], seq: 0, credited,
  });
}

/**
 * withCardExchange(combat, stance, fn): runs a played card's resolution as one exchange per target. `stance` is the
 * card's timeline stance, which its landed attacks are credited with. Both are cleared afterwards; nothing saves them.
 */
export function withCardExchange(combat, stance, fn) {
  if (!momentumOn(combat)) return fn();
  const st = stateOf(combat);
  st.playerStance = stance ?? 'attack';
  st.cardExchange = {};
  try {
    return fn();
  } finally {
    delete st.playerStance;
    delete st.cardExchange;
  }
}

/**
 * recordNormalExchange(combat, type, event): credits the momentum an emitted event decides. Only attacks, evades
 * and counters that fire count; every other event changes nothing. The player's attack stance is the stance of the
 * card being played (combat.normalPreview.state.playerStance, set by combat.js), 'attack' otherwise.
 */
export function recordNormalExchange(combat, type, event = {}) {
  if (!momentumOn(combat)) return;
  const st = stateOf(combat);
  const playerStance = st.playerStance ?? 'attack';
  if (type === 'enemyMoveStarted') {
    // Each enemy move opens its own exchange; the enemy phase end closes the last one.
    if (sideOf(combat, event.sourceId) === 'enemy') st.enemyExchange = { sourceId: event.sourceId, credited: [] };
    return;
  }
  if (type === 'damageDealt' && event.isAttack === true) {
    const amount = Number(event.amount) || 0;
    if (amount <= 0) return;
    // A counter's own damage is the counter's exchange, already credited when it fired.
    if (st.counterDamage && st.counterDamage.by === event.sourceId && st.counterDamage.to === event.targetId) {
      delete st.counterDamage;
      return;
    }
    const blocked = Math.max(0, Number(event.blocked) || 0);
    const landed = amount - blocked > 0;
    const attacker = sideOf(combat, event.sourceId);
    const target = sideOf(combat, event.targetId);
    if (attacker === 'player' && target === 'enemy') {
      const foe = enemyIntentStance(combat, enemyById(combat, event.targetId));
      const credited = creditedFor(combat, event.sourceId, event.targetId);
      if (landed) exchange(combat, event.targetId, 'player', playerStance, foe, credited);
      else exchange(combat, event.targetId, 'enemy', blocked > 0 ? 'block' : foe, playerStance, credited);
    } else if (attacker === 'enemy' && target === 'player') {
      const foe = enemyIntentStance(combat, enemyById(combat, event.sourceId));
      const credited = creditedFor(combat, event.sourceId, event.sourceId);
      if (landed) exchange(combat, event.sourceId, 'enemy', foe, null, credited);
      else exchange(combat, event.sourceId, 'player', 'block', foe, credited);
    }
    return;
  }
  if (type === 'attackEvaded') {
    const attacker = sideOf(combat, event.sourceId);
    const target = sideOf(combat, event.targetId);
    if (attacker === 'enemy' && target === 'player') {
      exchange(combat, event.sourceId, 'player', 'evade', enemyIntentStance(combat, enemyById(combat, event.sourceId)),
        creditedFor(combat, event.sourceId, event.sourceId));
    } else if (attacker === 'player' && target === 'enemy') {
      exchange(combat, event.targetId, 'enemy', 'evade', playerStance, creditedFor(combat, event.sourceId, event.targetId));
    }
    return;
  }
  if (type === 'combatCounterTriggered') {
    // The counter's owner (sourceId) answers the attacker (targetId) and wins its exchange against an attack.
    const owner = sideOf(combat, event.sourceId);
    const key = owner === 'enemy' ? event.sourceId : event.targetId;
    if (!owner || !sideOf(combat, key)) return;
    // The counter answers the attacker's card or move: it is part of that exchange, as a counter is in a round.
    exchange(combat, key, owner, 'counter', 'attack', creditedFor(combat, event.targetId, key));
    st.counterDamage = { by: event.sourceId, to: event.targetId };
  }
}
