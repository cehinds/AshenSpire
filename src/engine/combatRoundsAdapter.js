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
import { makeFight, makeCombatant, plannedQueueSpeeds } from './combatRounds/timeline.js';
import { decayMomentum } from './combatRounds/resolver.js';
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
// Built once per rules object (the engine only reads these Maps), so a forecast does not rebuild them.
const tablesByRules = new WeakMap();
function engineTables(rules) {
  const cached = tablesByRules.get(rules);
  if (cached) return cached;
  const t = rules.tables;
  const built = {
    evadeTable: new Map(Object.entries(t.evadeBonus)),
    stanceAdvantage: new Map(Object.entries(t.stanceAdvantage)),
    armor: new Map(Object.entries(t.evasionArmor)),
    cards: new Map(Object.entries(t.evasionCards)),
  };
  tablesByRules.set(rules, built);
  return built;
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
//   liveCounterCovers(combat, entry)  whether the player's armed Counter would answer this enemy attack live
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
  const answer = withLiveCounterGate(combat, round, entry, ops, () => answerReaction(round, pick, hooks));
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
    const step = withLiveCounterGate(combat, round, entry, ops, () => stepRound(round, hooks));
    if (step.awaitingReaction) {
      // Each pause re-checks the offer: a card that left hand, a closed control gate or a cost the player
      // can no longer pay is not a choice any more (SPEC §4.10, §4.11). Costs are the live ones.
      round.awaiting.eligible = ops.reactionAvailable(combat, entry, round.awaiting.eligible);
      if (round.awaiting.eligible.length) {
        cr.paused = { events: step.events };
        return { paused: true, offer: { attack: { ...round.awaiting.attack }, eligible: round.awaiting.eligible.map((c) => ({ ...c })) } };
      }
      // Nothing left to offer: the attack resolves with no reaction.
      const events = [...step.events, ...withLiveCounterGate(combat, round, entry, ops, () => answerReaction(round, null, hooks)).events];
      settleEntry(combat, entry, events, ops);
    } else {
      settleEntry(combat, entry, step.events, ops);
    }
    if (combat.result) return { paused: false, offer: null };
  }
  const { state: after } = finishRound(round);
  // The round's unspent Counters are cleared (settleRound), so the live Counter armed for them is cleared too.
  delete combat.player.combatCounter;
  delete cr.enemyActed;
  // Momentum is a rules toggle (SPEC §4.11). Off, it is frozen at 0: nothing is kept from the round.
  const kept = cr.rules?.momentum === true;
  cr.momentum = kept ? after.momentum : {};
  cr.poiseDouble = kept ? after.poiseDouble : {};
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
  else applyEnemyEntry(combat, entry, events, landed, ops);
}

// SPEC §4.11: a queued Counter is spent by the timeline on the attack it fires on, and only on an attack its live
// coverage reaches. For any other enemy attack the timeline does not see the Counter, so it neither spends nor
// credits it. Runs `fn` with the player's timeline Counters hidden when the live Counter would not answer this attack.
function withLiveCounterGate(combat, round, entry, ops, fn) {
  if (entry.side !== 'enemy' || ops.liveCounterCovers(combat, entry)) return fn();
  const counters = round.cur.active.player.counters;
  round.cur.active.player.counters = [];
  try {
    return fn();
  } finally {
    round.cur.active.player.counters = counters;
  }
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

// The live move runs only for a landed attack. The live Counter is kept out of the move unless the timeline
// spent it on this attack (counterFired), and it is cleared after the move when the timeline spent it, so a
// Counter the timeline did not fire never answers this attack live, and a spent one never answers another.
function applyEnemyEntry(combat, entry, events, landed, ops) {
  const fired = events.some((e) => e.type === 'counterFired' && e.by === 'player');
  const armed = combat.player.combatCounter;
  if (!fired) delete combat.player.combatCounter;
  try {
    const enemy = combat.enemies.find((e) => e.id === entry.actor);
    if (!enemy || !landed || !enemy.alive || enemy.hp <= 0) return;
    ops.enemyMove(combat, enemy, entry.cardId);
    ops.drain(combat);
  } finally {
    if (fired) delete combat.player.combatCounter;
    else if (armed) combat.player.combatCounter = armed;
  }
}

// --- Unqueue ----------------------------------------------------------------------------------

// Removes a queued card and returns its record, so the caller can refund exactly what it paid.
export function unqueueCard(combat, instanceId) {
  return takeQueuedCard(combat, instanceId);
}

// --- Preview screen forecast ------------------------------------------------------------------

// roundMomentum(combat) → { [enemyId]: M } as the round being planned uses it: each stored M after the rules'
// decay step, which startRound applies before it orders anything. The forecast and the turn banner read this, so
// they show what applies this round. The stored momentum is not changed.
export function roundMomentum(combat) {
  const cr = roundState(combat);
  const step = cr.rules?.decay === undefined ? 1 : Number(cr.rules.decay);
  return Object.fromEntries(Object.entries(cr.momentum ?? {}).map(([id, m]) => [id, decayMomentum(m, step)]));
}

// screenForecast(combat, enemyId, candidate) → the plan-time speeds the preview screen compares (PREVIEW-PLAN,
// Screen; timeline plannedQueueSpeeds). `candidate` is a hand card's timeline view (roundCardForecast) or null.
// cardSpeed is the candidate's effective speed at the end of the player's queue, with the candidate placed last
// (null without a candidate). foeSpeed and foe are the enemy's first queued action (null when it has no queue).
// The d4 is excluded, as the forecast requires. stanceTable is the Map targetOutline reads.
export function screenForecast(combat, enemyId, candidate = null) {
  const cr = roundState(combat);
  const tables = engineTables(cr.rules);
  const momentum = roundMomentum(combat);
  const player = makeCombatant(playerSpec(combat, 0, []), tables);
  // A card already in the queue keeps its place; any other candidate is placed last.
  const queued = queuedCards(combat).map(timelineCardFor);
  const at = candidate ? queued.findIndex((c) => c.instanceId === candidate.instanceId) : -1;
  const playerQueue = !candidate || at >= 0 ? queued : [...queued, candidate];
  const playerSpeeds = plannedQueueSpeeds({ combatant: player, queue: playerQueue, momentum });
  const enemy = combat.enemies.find((e) => e.id === enemyId);
  const cards = enemy ? enemyActions(combat, enemy.id) : [];
  let foeSpeed = null;
  let foe = null;
  if (enemy && cards.length) {
    const speeds = plannedQueueSpeeds({ combatant: makeCombatant(enemySpec(enemy), tables), queue: cards, momentum });
    foeSpeed = speeds[0];
    foe = { stance: cards[0].stance, kind: cards[0].kind };
  }
  let cardSpeed = null;
  if (candidate) cardSpeed = at >= 0 ? playerSpeeds[at] : playerSpeeds[playerSpeeds.length - 1];
  return { cardSpeed, foeSpeed, foe, stanceTable: tables.stanceAdvantage };
}

// enemyActions(combat, enemyId) → the enemy's queued actions as timeline cards, in play order (the first is
// its current action). [] when the enemy has no queue this round, or its queue is stale (see below).
export function enemyActions(combat, enemyId) {
  const cr = roundState(combat);
  const enemy = combat.enemies.find((e) => e.id === enemyId);
  const entries = enemy ? cr.enemyQueues[enemy.id] : null;
  if (!enemy || !entries?.length) return [];
  // A queue shows only while it is the one the enemy will play: a stagger that lands during planning (intent
  // 'staggered') drops it at commit (enemyMoveAt), and any slot 0 that no longer matches the live intent is stale.
  if (enemy.intent?.kind === 'staggered' || enemy.intent?.moveId !== entries[0].moveId) return [];
  const def = combat.registries.enemies.get(enemy.enemyId);
  return entries.map((e, i) => enemyTimelineCard(enemy, e, i, def));
}
