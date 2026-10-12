// Combat Rounds Preview, solo adapter (SPEC §4.11, PREVIEW-PLAN P3a/P3b). Headless: no DOM, no timers.
//
// combat.js calls this module only when `combat.combatRounds` is set; every other path is untouched.
// It owns three things:
//   1. Enemy queues: each enemy's hidden queue, built from its own SP pool by repeated picks.
//   2. The player's queue: cards played on the player turn are queued, their SP and MP are paid
//      at queue time, and the card stays in hand until End Turn.
//   3. The commit: End Turn builds the timeline inputs, steps the round, and hands each landed
//      action back to combat.js, which runs the live effects. A missed action applies nothing.
//      A player-targeted attack with a Counter or Evade on offer pauses the commit (round.js);
//      resumeRound() answers it and carries on from the paused entry (SPEC §4.11).
// The timeline decides order and hit or miss only. combat.js passes its own helpers in `ops`, so
// this file never imports combat.js (no cycle).
import { startRound, stepRound, answerReaction, finishRound } from './combatRounds/round.js';
import { makeFight } from './combatRounds/timeline.js';
import { DEFAULT_SP, SPEED_MODS_CSV } from '../content/combatRounds.js';

// Enemy SP per round (SPEC §4.11: stat-driven, base 3). One constant, used for every enemy in P3a.
export const ENEMY_SP = DEFAULT_SP;
// A move costs 1 SP unless the move defines its own `sp`.
export const MOVE_SP = 1;
// Guard for zero-cost moves, which would otherwise never run the SP pool out.
const QUEUE_MAX = 16;

// The combat.combatRounds record, with the queue fields added on first use. Fights built before P3a
// (and fights with the preview off) never have them, so nothing reads them until the preview is on.
export function roundState(combat) {
  const cr = combat.combatRounds;
  if (!cr.playerQueue) cr.playerQueue = [];
  if (!cr.enemyQueues) cr.enemyQueues = {};
  return cr;
}

// --- Enemy queues ------------------------------------------------------------------------------

export function moveSp(move) {
  const n = Number(move?.sp ?? MOVE_SP);
  return Number.isFinite(n) && n >= 0 ? n : MOVE_SP;
}

// One enemy's hidden queue. `pick(enemy, def)` is the live weighted pick (enemyAI stream); each pick
// is recorded in movesHistory at once, so maxConsecutive sees the queued run. The first pick of the
// fight is the scripted opener when the move set has one. The queue ends when the next pick would
// spend more SP than is left.
export function buildEnemyQueue(enemy, def, { isFirstTurn = false, pick }) {
  const queue = [];
  let spent = 0;
  while (queue.length < QUEUE_MAX) {
    const opener = isFirstTurn && queue.length === 0 && def.firstMove ? def.firstMove : null;
    const moveId = opener ?? pick(enemy, def);
    if (moveId == null) break;
    const sp = moveSp(def.moves[moveId]);
    if (spent + sp > ENEMY_SP) break;
    spent += sp;
    enemy.movesHistory.push(moveId);
    queue.push({ moveId, sp });
  }
  return queue;
}

// Builds every living, unheld enemy's queue (combat.enemyQueues). `held(enemy)` is true for an enemy
// that does not pick this round (a committed delayed move, or a staggered one). Returns the queues.
export function buildEnemyQueues(combat, { isFirstTurn = false, pick, held }) {
  const cr = roundState(combat);
  const queues = {};
  for (const enemy of combat.enemies) {
    if (!enemy.alive || held(enemy)) continue;
    const def = combat.registries.enemies.get(enemy.enemyId);
    queues[enemy.id] = buildEnemyQueue(enemy, def, { isFirstTurn, pick });
  }
  cr.enemyQueues = queues;
  return queues;
}

// --- Timeline mapping ------------------------------------------------------------------------

// The speed-mods.csv card rows with a whole-number mod: card id → base speed. Other rows (a range, a
// TBD, or a choice such as 1|2|3) are left out, so a card without one counts as speed 0.
export function speedModDefaults(csv = SPEED_MODS_CSV) {
  const table = new Map();
  const lines = String(csv).split('\n').map((l) => l.trim()).filter(Boolean);
  lines.shift();
  for (const line of lines) {
    const [sourceType, source, mod] = line.split(',');
    if (sourceType !== 'card' || !/^[+-]?\d+$/.test(mod ?? '')) continue;
    table.set(source, Number(mod));
  }
  return table;
}
const SPEED_DEFAULTS = speedModDefaults();

// A card's base speed: its own `speed` field when it has one, else the speed-mods default for its id.
export function cardSpeed(card, cardId) {
  if (card?.speed !== undefined && card?.speed !== null && Number.isFinite(Number(card.speed))) return Number(card.speed);
  return SPEED_DEFAULTS.get(cardId) ?? 0;
}

// The timeline stance of an action (the stance-advantage table's names). Tags can name a heavy or a
// wide attack; otherwise the kind decides.
const KIND_STANCE = Object.freeze({ attack: 'attack', guard: 'block', evade: 'evade', counter: 'counter' });
export function stanceFor(kind, tags = []) {
  if (kind === 'attack' && tags.includes('smash')) return 'smash';
  if (kind === 'attack' && tags.includes('sweep')) return 'sweep';
  return KIND_STANCE[kind] ?? null;
}

// Kinds the timeline knows: attack, guard, evade, counter and other. A preemptive kind (guard, evade,
// counter) must target its owner or a foe (guard and evade: self), so the caller passes the target.
export function playerKind({ isAttack, effects = [], maneuver }) {
  if (isAttack) return 'attack';
  if (effects.some((e) => e?.op === 'dodgeRoll')) return 'evade';
  if (maneuver === 'counter') return 'counter';
  if (effects.some((e) => e?.op === 'block')) return 'guard';
  return 'other';
}

// An enemy move's timeline kind, from its authored intent. `damage` decides an attack, as the
// enemy's intent box does.
export function moveKind(move) {
  if (move?.damage != null || move?.intent === 'attack') return 'attack';
  if (move?.intent === 'block' || move?.block != null) return 'guard';
  if (move?.intent === 'counter') return 'counter';
  return 'other';
}

// The timeline card of one queued enemy move. An attack aims at the player; a defensive or other
// move is for its owner.
export function enemyTimelineCard(enemy, entry, index, def) {
  const move = def.moves[entry.moveId];
  const kind = moveKind(move);
  const tags = Array.isArray(move.tags) ? [...move.tags] : [];
  return {
    id: entry.moveId,
    instanceId: `${enemy.id}:${index}`,
    kind,
    speed: Number(move.speed ?? 0) || 0,
    target: kind === 'attack' ? 'player' : 'self',
    sp: entry.sp,
    tags,
    stance: stanceFor(kind, tags),
  };
}

// --- Player queue -----------------------------------------------------------------------------

export function queuedCards(combat) {
  return roundState(combat).playerQueue;
}

// True when the enemy's queue is in the round state: it ran in the last commit, or it is waiting for one.
export function enemyQueued(combat, enemyId) {
  return Boolean(roundState(combat).enemyQueues[enemyId]);
}

// True once one of the enemy's moves has started in the round being committed (cleared when the commit ends).
// A stagger that lands before that point spends its round; one that lands after persists (SPEC §4.11).
export function enemyActedThisRound(combat, enemyId) {
  return Boolean(combat.combatRounds.enemyActed?.[enemyId]);
}

export function markEnemyActed(combat, enemyId) {
  combat.combatRounds.enemyActed = { ...(combat.combatRounds.enemyActed || {}), [enemyId]: true };
}

export function isQueued(combat, instanceId) {
  return queuedCards(combat).some((r) => r.instanceId === instanceId);
}

export function addQueuedCard(combat, record) {
  queuedCards(combat).push(record);
  return record;
}

// Removes and returns one queued card's record (null when it is not queued).
export function takeQueuedCard(combat, instanceId) {
  const list = queuedCards(combat);
  const i = list.findIndex((r) => r.instanceId === instanceId);
  return i < 0 ? null : list.splice(i, 1)[0];
}

// The record for a queued card's timeline entry: the card's id, kind, speed, stance, target and SP.
export function timelineCardFor(record) {
  return { ...record.tl };
}

// --- Commit -----------------------------------------------------------------------------------

// Plain-object tables from the rules, as the Maps the engine reads (built on the fly, so the rules
// stay plain and JSON-safe).
function engineTables(rules) {
  const t = rules.tables;
  return {
    evadeTable: new Map(Object.entries(t.evadeBonus)),
    stanceAdvantage: new Map(Object.entries(t.stanceAdvantage)),
    armor: new Map(Object.entries(t.evasionArmor)),
    cards: new Map(Object.entries(t.evasionCards)),
  };
}

// The player's timeline combatant. `sp` is the SP pool (the queued cards' SP plus the Stamina left, so a
// reaction pays from what the queue left); `hand` holds the reaction candidates (combat.js).
function playerSpec(combat, sp, hand) {
  const attrs = { ...(combat.attributes ?? combat.player.attributes ?? {}) };
  return {
    id: 'player', side: 'player', name: combat.player.name ?? 'player', attrs,
    level: Number(combat.characterLevel ?? 0) || 0,
    hp: Math.max(0, Number(combat.player.hp) || 0), sp, wis: Number(attrs.WIS ?? 0) || 0,
    tags: [], stance: null, hand,
  };
}

function enemySpec(enemy) {
  return {
    id: enemy.id, side: 'enemy', name: enemy.name ?? enemy.enemyId, attrs: {},
    level: Number(enemy.level ?? 0) || 0, hp: Math.max(0, Number(enemy.hp) || 0), sp: ENEMY_SP,
    wis: 0, tags: [], stance: null, hand: [],
  };
}

// Runs one round. `ops` is combat.js's bundle:
//   enemyTurnStart(combat)          the enemy turn start: the event and the block reset
//   enemyOwnerTurnStart(combat, enemy)  one enemy's turn-start hooks (its DoT ticks)
//   playCard(combat, intent, paid)  the live card effects, with no second payment
//   discardUnplayed(combat, record)  a missed card leaves the hand and spends the charges it claimed
//   refund(combat, record)          pays back a queued card's SP and MP (it never resolved)
//   enemyMove(combat, enemy, moveId)  the live move (or its delayed charge)
//   drain(combat)                   drainQueue
//   findEntity(combat, id)          the live lookup
//   reactionHand(combat)            the reaction candidates the player may play this commit (timeline records)
//   reactionAvailable(combat, entry, eligible)  the candidates still playable at a pause, priced now (SPEC §4.11)
//   playReaction(combat, instanceId, entry)  pays and plays a chosen reaction card, live; refuses a card that is not playable now
// Returns { paused, offer }. A paused commit (SPEC §4.11) waits for the player's reaction: `offer` is the
// round's { attack, eligible }, and resumeRound() continues it. Otherwise the caller runs the live turn end.
export function commitRound(combat, ops, discardIds = []) {
  const cr = roundState(combat);
  const rules = cr.rules;
  const tables = engineTables(rules);
  const rng = () => combat.rng.float('combatRounds');
  delete cr.enemyActed;

  // SPEC §4.1 order: each enemy's turn start (its DoT ticks, the block reset) comes before its moves.
  ops.enemyTurnStart(combat);
  if (combat.result) return { paused: false, offer: null };
  for (const enemy of combat.enemies) {
    if (!enemy.alive) continue;
    ops.enemyOwnerTurnStart(combat, enemy);
    if (combat.result) return { paused: false, offer: null };
  }
  // An enemy a tick killed never acts: its queue is dropped.
  for (const enemy of combat.enemies) if (!enemy.alive) delete cr.enemyQueues[enemy.id];

  const playerRecords = queuedCards(combat).slice();
  const sp = playerRecords.reduce((sum, r) => sum + r.tl.sp, 0);
  const spare = Math.max(0, Number(combat.player.energy) || 0);
  const specs = [playerSpec(combat, sp + spare, ops.reactionHand(combat)), ...combat.enemies.map(enemySpec)];
  const state = makeFight(specs, { armor: tables.armor, cards: tables.cards });
  Object.assign(state.momentum, cr.momentum ?? {});
  Object.assign(state.poiseDouble, cr.poiseDouble ?? {});
  Object.assign(state.charges, cr.charges ?? {});

  const queues = { player: playerRecords.map(timelineCardFor) };
  for (const enemy of combat.enemies) {
    const entries = cr.enemyQueues[enemy.id];
    if (!entries) continue;
    const def = combat.registries.enemies.get(enemy.enemyId);
    queues[enemy.id] = entries.map((e, i) => enemyTimelineCard(enemy, e, i, def));
  }

  // The round is plain JSON from here on, so a pause is saved with the rest of combat.combatRounds.
  cr.round = startRound(state, { queues, rng, merge: rules.merge, decay: rules.decay, liveDefence: true });
  cr.discardIds = [...discardIds];
  return runRound(combat, ops);
}

// Continues a commit that paused for a reaction. `pick` is the instanceId of the chosen reaction card, or
// null to decline. The answer is validated before anything changes (round.js), and nothing that already ran
// is run again: the paused entry is the only one resolved here. Returns { paused, offer } like commitRound().
export function resumeRound(combat, ops, pick) {
  const cr = roundState(combat);
  const round = cr.round;
  if (!cr.paused || !round?.awaiting) throw new TypeError('the round is not waiting for a reaction');
  const rules = cr.rules;
  const hooks = roundHooks(combat, rules);
  const entry = round.timeline.entries[round.awaiting.index];
  const answer = answerReaction(round, pick, hooks);
  const events = [...cr.paused.events, ...answer.events];
  const played = events.find((e) => e.type === 'reaction');
  if (played) ops.playReaction(combat, played.instanceId, entry);
  delete cr.paused;
  settleEntry(combat, entry, events, ops);
  if (combat.result) return { paused: false, offer: null };
  return runRound(combat, ops);
}

function roundHooks(combat, rules) {
  const tables = engineTables(rules);
  return { rng: () => combat.rng.float('combatRounds'), evadeTable: tables.evadeTable, stanceAdvantage: tables.stanceAdvantage };
}

// Steps the round to its end or to the next reaction pause. A pause keeps the round's cursor in `round`.
function runRound(combat, ops) {
  const cr = roundState(combat);
  const round = cr.round;
  const hooks = roundHooks(combat, cr.rules);
  while (round.idx < round.timeline.entries.length) {
    const entry = round.timeline.entries[round.idx];
    const step = stepRound(round, hooks);
    if (step.awaitingReaction) {
      // Each pause re-checks the offer: a card that left hand, a closed control gate or a cost the player
      // can no longer pay is not a choice any more (SPEC §4.10, §4.11). Costs are the live ones.
      round.awaiting.eligible = ops.reactionAvailable(combat, entry, round.awaiting.eligible);
      if (round.awaiting.eligible.length) {
        cr.paused = { events: step.events };
        return { paused: true, offer: { attack: { ...round.awaiting.attack }, eligible: round.awaiting.eligible.map((c) => ({ ...c })) } };
      }
      // Nothing left to offer: the attack resolves with no reaction.
      const events = [...step.events, ...answerReaction(round, null, hooks).events];
      settleEntry(combat, entry, events, ops);
    } else {
      settleEntry(combat, entry, step.events, ops);
    }
    if (combat.result) return { paused: false, offer: null };
  }
  const { state: after } = finishRound(round);
  delete cr.enemyActed;
  cr.momentum = after.momentum;
  cr.poiseDouble = after.poiseDouble;
  cr.charges = after.charges;
  delete cr.round;
  delete cr.discardIds;
  return { paused: false, offer: null };
}

// Applies one resolved entry: a landed action runs its live effects, a missed one applies nothing.
function settleEntry(combat, entry, events, ops) {
  const hit = events.find((e) => e.type === 'hit');
  const landed = hit ? hit.hit === true : true;
  if (entry.side === 'player') applyPlayerEntry(combat, entry, landed, ops);
  else applyEnemyEntry(combat, entry, landed, ops);
}

// True while a commit waits for the player's reaction (SPEC §4.11).
export function roundPaused(combat) {
  return Boolean(combat.combatRounds?.paused);
}

// The discard choice End Turn made before the commit paused.
export function pausedDiscardIds(combat) {
  return [...(combat.combatRounds?.discardIds ?? [])];
}

function applyPlayerEntry(combat, entry, landed, ops) {
  const record = takeQueuedCard(combat, entry.card.instanceId);
  if (!record) return;
  // An earlier queued card can remove this one from hand (Pilfer discards at random). It never
  // resolves: its SP and MP come back, and the round goes on.
  if (!combat.piles.hand.some((c) => c.instanceId === record.instanceId)) {
    ops.refund(combat, record);
    combat.emit('combatRoundCardSkipped', { cardInstanceId: record.instanceId, cardId: record.cardId, reason: 'leftHand', refund: { ...record.paid } });
    return;
  }
  const player = combat.player;
  const target = record.targetId == null ? null : ops.findEntity(combat, record.targetId);
  const targetLive = !record.targetId || (target && target.alive && target.hp > 0);
  if (!landed || !player.alive || player.hp <= 0 || !targetLive) {
    ops.discardUnplayed(combat, record);
    return;
  }
  ops.playCard(combat, {
    cardInstanceId: record.instanceId,
    targetId: record.targetId ?? undefined,
    choice: record.choice,
    upcastTier: record.upcastTier,
    upcastRanks: record.upcastRanks,
  }, record.paid);
  ops.drain(combat);
}

function applyEnemyEntry(combat, entry, landed, ops) {
  const enemy = combat.enemies.find((e) => e.id === entry.actor);
  if (!enemy || !landed || !enemy.alive || enemy.hp <= 0) return;
  ops.enemyMove(combat, enemy, entry.cardId);
  ops.drain(combat);
}

// --- Unqueue ----------------------------------------------------------------------------------

// Removes a queued card and returns its record, so the caller can refund exactly what it paid.
export function unqueueCard(combat, instanceId) {
  return takeQueuedCard(combat, instanceId);
}
