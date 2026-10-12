// Combat rounds preview (PREVIEW-PLAN P1): the pausable, JSON-only round in src/engine/combatRounds
// matches createRound() event for event, survives a JSON round-trip at every boundary, and the
// content tables in src/content/combatRounds.js are the CSVs in docs/alternative-combat-rounds.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRound, makeFight, MERGE_MODES, DEFAULT_SP, REACTION_BUFF, DEFENSE_BASE, ADAPT_INDEX }
  from '../src/engine/combatRounds/timeline.js';
import { startRound, stepRound, answerReaction, finishRound } from '../src/engine/combatRounds/round.js';
import { parseEvasionArmor, parseEvasionCards, parseEvadeBonus, parseStanceAdvantage }
  from '../src/engine/combatRounds/resolver.js';
import * as content from '../src/content/combatRounds.js';
import * as timelineModule from '../src/engine/combatRounds/timeline.js';
import * as docsTimeline from '../docs/alternative-combat-rounds/timeline.mjs';

const TABLE_DIR = fileURLToPath(new URL('../docs/alternative-combat-rounds/', import.meta.url));
const ENGINE_DIR = fileURLToPath(new URL('../src/engine/combatRounds/', import.meta.url));
const ROUNDS = 3;

const TABLES = {
  armor: parseEvasionArmor(content.EVASION_ARMOR_CSV),
  cards: parseEvasionCards(content.EVASION_CARDS_CSV),
};
const STANCE = parseStanceAdvantage(content.STANCE_ADVANTAGE_CSV);
const EVADE = parseEvadeBonus(content.EVADE_BONUS_CSV);

// Seeded rng (mulberry32), returns floats in [0, 1).
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Every card carries all its fields, so no value is undefined and JSON keeps every key.
const card = (id, kind, target, extra = {}) => ({
  id, name: id, kind, target, speed: 1, sp: 1, damage: 3, accuracy: 0, tags: [], stance: null,
  momentumGain: 1, block: 6, evadePct: 20, counterDamage: 2, ...extra,
});

// Fight archetypes: a solo fight, two enemies, and an intangible enemy, with a hand of
// reaction cards for the player. The queues are built per round from a seeded rng.
const HAND = [
  card('Shield Up', 'guard', 'self', { block: 6, stance: 'block' }),
  card('Backstep', 'evade', 'self', { evadePct: 0 }),
  card('Quickstep', 'evade', 'self'),
  card('Brace', 'evade', 'self', { evadePct: 15 }),
  card('Riposte', 'counter', 'self', { tags: ['stagger'], stance: 'counter' }),
];
const player = (extra = {}) => ({
  id: 'player', hp: 30, sp: 3, attrs: { STR: 2, DEX: 3, WIS: 1, INT: 1 }, level: 2,
  evasionArmor: 'Leather', dex: 3, evadeBasePct: 5, stance: 'block', hand: HAND, ...extra,
});
const FIGHTS = [
  { name: 'solo', merge: 'speed', enemies: ['goblin'],
    specs: [player(), { id: 'goblin', hp: 14, sp: 3, attrs: { DEX: 3 }, level: 1, wis: 2, stance: 'smash', tags: ['stagger'] }] },
  { name: 'duo speed', merge: 'speed', enemies: ['brute', 'archer'],
    specs: [player({ stance: 'evade' }),
      { id: 'brute', hp: 18, sp: 3, attrs: { STR: 3 }, level: 2, wis: 1, stance: 'block', evadeBasePct: 10 },
      { id: 'archer', hp: 11, sp: 3, attrs: { DEX: 4 }, level: 1, wis: 3, stance: 'attack' }] },
  { name: 'duo roundRobin', merge: 'roundRobin', enemies: ['brute', 'archer'],
    specs: [player({ stance: 'counter' }),
      { id: 'brute', hp: 18, sp: 3, attrs: { STR: 3 }, level: 2, wis: 1, stance: 'smash' },
      { id: 'archer', hp: 11, sp: 3, attrs: { DEX: 4 }, level: 1, wis: 3, stance: 'attack' }] },
  { name: 'duo wholeQueue', merge: 'wholeQueue', enemies: ['brute', 'wraith'],
    specs: [player({ stance: 'block' }),
      { id: 'brute', hp: 18, sp: 3, attrs: { STR: 3 }, level: 2, wis: 1, stance: 'smash' },
      { id: 'wraith', hp: 9, sp: 3, attrs: { DEX: 2 }, level: 1, wis: 2, stance: 'sweep', tags: ['intangible'], intangibleCharges: 1 }] },
];

// Player cards to queue (the hand's ids are kept out of the queue so reactions stay eligible).
function makeQueues(fight, qrng) {
  const queues = { player: [] };
  const playerSpend = { n: 0 };
  const pool = [
    () => card(`Strike${qrng() < 0.5 ? 'A' : 'B'}`, 'attack', fight.enemies[Math.floor(qrng() * fight.enemies.length)], { speed: Math.floor(qrng() * 4), sp: 1, damage: 2 + Math.floor(qrng() * 4), accuracy: Math.floor(qrng() * 3) - 1, stance: qrng() < 0.3 ? 'smash' : null, tags: qrng() < 0.2 ? ['quick'] : [], momentumGain: 1 + Math.floor(qrng() * 2) }),
    () => card('Smash', 'attack', fight.enemies[Math.floor(qrng() * fight.enemies.length)], { speed: 2, sp: 2, damage: 6, stance: 'smash' }),
    () => card('Guard', 'guard', 'self', { speed: Math.floor(qrng() * 3), block: 5 }),
    () => card('Evade Queued', 'evade', 'self', { speed: Math.floor(qrng() * 3), evadePct: 10 }),
    () => card('Counter Queued', 'counter', qrng() < 0.5 ? 'self' : fight.enemies[0], { speed: 3, sp: 1, counterDamage: 2, tags: qrng() < 0.5 ? ['stagger'] : [] }),
  ];
  for (let i = 0; i < 4; i += 1) {
    const c = pool[Math.floor(qrng() * pool.length)]();
    if (playerSpend.n + c.sp > 3) break;
    playerSpend.n += c.sp;
    queues.player.push(c);
  }
  for (const id of fight.enemies) {
    const q = [];
    const count = 2 + Math.floor(qrng() * 2); // at most 3 cards: each costs 1 SP and an enemy has 3
    for (let i = 0; i < count; i += 1) {
      const roll = qrng();
      if (roll < 0.6) q.push(card(`${id}Hit${i}`, 'attack', 'player', { speed: Math.floor(qrng() * 4), damage: 2 + Math.floor(qrng() * 3), accuracy: 1, stance: qrng() < 0.4 ? 'smash' : null }));
      else if (roll < 0.8) q.push(card(`${id}Guard${i}`, 'guard', 'self', { speed: 1, block: 4 }));
      else q.push(card(`${id}Counter${i}`, 'counter', 'player', { speed: 2, counterDamage: 2, tags: ['stagger'] }));
    }
    queues[id] = q;
  }
  return queues;
}

// The reaction choice: a deterministic pick from the eligible cards (or none), from the data alone.
const pickId = (attack, eligible, salt) => {
  const i = (attack.seq * 7 + attack.damage + salt) % (eligible.length + 1);
  return i === eligible.length ? null : eligible[i].id;
};

const hooks = (combatRng) => ({ rng: combatRng, stanceAdvantage: STANCE, evadeTable: EVADE });

// A fight state as the round API returns it: the evasion-cards table is plain data, not a Map.
const plainFight = (state) => ({
  ...state,
  combatants: Object.fromEntries(Object.keys(state.combatants).map((id) => {
    const c = state.combatants[id];
    return [id, c.evadeCards instanceof Map ? { ...c, evadeCards: Object.fromEntries(c.evadeCards) } : c];
  })),
});

// Reference: createRound(...).resolveAll() over ROUNDS rounds, fight state carried forward.
function referenceRun(fight, seed) {
  const combatRng = rng(seed);
  const queueRng = rng(seed + 1000);
  let state = makeFight(fight.specs, TABLES);
  const events = [];
  for (let r = 0; r < ROUNDS; r += 1) {
    const round = createRound(state, {
      queues: makeQueues(fight, queueRng),
      rng: combatRng,
      merge: fight.merge,
      stanceAdvantage: STANCE,
      evadeTable: EVADE,
      onReaction: (attack, eligible) => {
        const id = pickId(attack, eligible, r);
        return id === null ? null : { id };
      },
    });
    const out = round.resolveAll();
    events.push(...out.events);
    state = out.state;
  }
  return { events, state };
}

// Round API: the same rounds, stepped. `trip()` is asked before every call; when it says yes the
// round goes through JSON.stringify and JSON.parse first, so a save may happen at any boundary.
function roundRun(fight, seed, trip = () => false) {
  const combatRng = rng(seed);
  const queueRng = rng(seed + 1000);
  const serial = (x) => (trip() ? JSON.parse(JSON.stringify(x)) : x);
  let state = makeFight(fight.specs, TABLES);
  const events = [];
  const stats = { awaits: 0 };
  for (let r = 0; r < ROUNDS; r += 1) {
    let round = startRound(state, { queues: makeQueues(fight, queueRng), rng: combatRng, merge: fight.merge });
    round = serial(round);
    let res = stepRound(round, hooks(combatRng));
    for (;;) {
      events.push(...res.events);
      if (res.awaitingReaction) {
        stats.awaits += 1;
        const { attack, eligible } = res.awaitingReaction;
        round = serial(round);
        res = answerReaction(round, pickId(attack, eligible, r), hooks(combatRng));
        continue;
      }
      if (res.done) break;
      round = serial(round);
      res = stepRound(round, hooks(combatRng));
    }
    round = serial(round);
    const fin = finishRound(round);
    events.push(...fin.events);
    state = fin.state;
    stats.rounds = (stats.rounds ?? 0) + 1;
  }
  return { events, state, stats };
}

test('stepping a round to the end matches createRound().resolveAll() for every fight and seed', () => {
  const seen = new Set();
  let awaits = 0;
  for (const fight of FIGHTS) {
    for (const seed of [1, 7, 42, 2026, 99991]) {
      const ref = referenceRun(fight, seed);
      const run = roundRun(fight, seed);
      assert.deepStrictEqual(run.events, ref.events, `${fight.name} seed ${seed}: events`);
      assert.deepStrictEqual(run.state, plainFight(ref.state), `${fight.name} seed ${seed}: state`);
      awaits += run.stats.awaits;
      for (const e of ref.events) seen.add(e.type === 'reaction' ? `reaction:${e.kind}` : e.type);
    }
  }
  // The fixtures exercise the paths the round must pause for and replay.
  assert.ok(awaits > 0, 'some attack must have paused for a reaction');
  for (const type of ['reaction:guard', 'reaction:evade', 'reaction:counter', 'countered', 'counterFired',
    'evadeUp', 'evadeRoll', 'guardUp', 'momentum', 'momentumApplied', 'hit', 'defeated', 'roundEnd', 'skipped']) {
    assert.ok(seen.has(type), `fixtures never produce ${type}`);
  }
});

test('a JSON round-trip between any two steps gives the identical result', () => {
  for (const fight of FIGHTS) {
    const seed = 42;
    const straight = roundRun(fight, seed);
    // Serialise at every boundary, including while awaiting a reaction.
    const always = roundRun(fight, seed, () => true);
    assert.deepStrictEqual(always, straight, `${fight.name}: round-trip at every boundary`);
    // And at each boundary on its own, so every single boundary is covered.
    let calls = 0;
    roundRun(fight, seed, () => { calls += 1; return false; });
    for (let k = 0; k < calls; k += 1) {
      let n = -1;
      const one = roundRun(fight, seed, () => { n += 1; return n === k; });
      assert.deepStrictEqual(one, straight, `${fight.name}: round-trip at boundary ${k}`);
    }
  }
});

test('a round is plain JSON: no functions, Maps or Sets, and it round-trips unchanged', () => {
  const fight = FIGHTS[1];
  const combatRng = rng(5);
  const queueRng = rng(6);
  let round = startRound(makeFight(fight.specs, TABLES), { queues: makeQueues(fight, queueRng), rng: combatRng, merge: fight.merge });
  const walk = (v, where) => {
    if (typeof v === 'function') throw new TypeError(`function at ${where}`);
    if (v instanceof Map || v instanceof Set) throw new TypeError(`Map or Set at ${where}`);
    if (v && typeof v === 'object') for (const k of Object.keys(v)) walk(v[k], `${where}.${k}`);
  };
  let guard = 0;
  while (guard < 200) {
    guard += 1;
    walk(round, 'round');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(round)), round);
    const res = stepRound(round, hooks(combatRng));
    if (res.awaitingReaction) {
      walk(round, 'awaiting');
      answerReaction(round, null, hooks(combatRng));
    } else if (res.done) break;
  }
  finishRound(round);
  walk(round, 'finished');
});

test('a paused round refuses to step, and rejects a card that was not eligible', () => {
  // Find the first seed whose opening round pauses for a reaction.
  let paused = null;
  for (let seed = 1; seed <= 60 && paused === null; seed += 1) {
    const fight = FIGHTS[0];
    const combatRng = rng(seed);
    const queueRng = rng(seed + 1000);
    const round = startRound(makeFight(fight.specs, TABLES), { queues: makeQueues(fight, queueRng), rng: combatRng, merge: fight.merge });
    let res = stepRound(round, hooks(combatRng));
    while (!res.awaitingReaction && !res.done) res = stepRound(round, hooks(combatRng));
    if (res.awaitingReaction) paused = { round, combatRng, eligible: res.awaitingReaction.eligible };
  }
  assert.ok(paused, 'some seed must pause for a reaction');
  const { round, combatRng, eligible } = paused;
  assert.throws(() => stepRound(round, hooks(combatRng)), TypeError);
  assert.throws(() => finishRound(round), TypeError);
  const notEligible = 'not-a-card';
  assert.equal(eligible.some((c) => c.id === notEligible), false);
  assert.throws(() => answerReaction(round, notEligible, hooks(combatRng)), TypeError);
  // A refused answer changes nothing: the same round still waits, and a null answer resumes it.
  assert.ok(round.awaiting, 'a refused answer leaves the round waiting');
  answerReaction(round, null, hooks(combatRng));
  assert.equal(round.awaiting, null);
});

test('a reaction card with an invalid defence value throws and leaves the paused round unchanged', () => {
  let paused = null;
  for (let seed = 1; seed <= 60 && paused === null; seed += 1) {
    const fight = FIGHTS[0];
    const combatRng = rng(seed);
    const queueRng = rng(seed + 1000);
    const round = startRound(makeFight(fight.specs, TABLES), { queues: makeQueues(fight, queueRng), rng: combatRng, merge: fight.merge });
    let res = stepRound(round, hooks(combatRng));
    while (!res.awaitingReaction && !res.done) res = stepRound(round, hooks(combatRng));
    if (res.awaitingReaction) paused = { round, combatRng };
  }
  assert.ok(paused, 'some seed must pause for a reaction');
  const { round, combatRng } = paused;
  // A tampered save or bad hand data: the offered card carries a non-numeric defence value.
  const card = round.awaiting.eligible[0];
  for (const field of ['block', 'evadePct', 'counterDamage']) card[field] = 'x';
  const before = JSON.stringify(round);
  assert.throws(() => answerReaction(round, card.id, hooks(combatRng)), TypeError);
  assert.equal(JSON.stringify(round), before, 'nothing changed: still paused, no SP spent, card not used');
  answerReaction(round, null, hooks(combatRng));
  assert.equal(round.awaiting, null);
});

test('a reaction card with invalid momentum gain throws and leaves the paused round unchanged', () => {
  let paused = null;
  for (let seed = 1; seed <= 60 && paused === null; seed += 1) {
    const fight = FIGHTS[0];
    const combatRng = rng(seed);
    const queueRng = rng(seed + 1000);
    const round = startRound(makeFight(fight.specs, TABLES), { queues: makeQueues(fight, queueRng), rng: combatRng, merge: fight.merge });
    let res = stepRound(round, hooks(combatRng));
    while (!res.awaitingReaction && !res.done) res = stepRound(round, hooks(combatRng));
    if (res.awaitingReaction) paused = { round, combatRng };
  }
  assert.ok(paused, 'some seed must pause for a reaction');
  const { round, combatRng } = paused;
  const card = round.awaiting.eligible[0];
  card.momentumGain = 'Infinity';
  const before = structuredClone(round);
  assert.throws(() => answerReaction(round, card.id, hooks(combatRng)), /momentumGain must be a finite number/);
  assert.deepStrictEqual(round, before, 'nothing changed: still paused, no SP spent, card not used');
  answerReaction(round, null, hooks(combatRng));
  assert.equal(round.awaiting, null);
});

function pausedRound() {
  for (let seed = 1; seed <= 60; seed += 1) {
    const fight = FIGHTS[0];
    const combatRng = rng(seed);
    const queueRng = rng(seed + 1000);
    const round = startRound(makeFight(fight.specs, TABLES), { queues: makeQueues(fight, queueRng), rng: combatRng, merge: fight.merge });
    let res = stepRound(round, hooks(combatRng));
    while (!res.awaitingReaction && !res.done) res = stepRound(round, hooks(combatRng));
    if (res.awaitingReaction) return { round, combatRng };
  }
  assert.fail('some seed must pause for a reaction');
}

for (const [label, bad] of [['x', 'x'], ['NaN', NaN]]) {
  test(`a reaction card with momentumGain ${label} throws before the pause clears and leaves the round unchanged`, () => {
    const { round, combatRng } = pausedRound();
    const card = round.awaiting.eligible[0];
    card.momentumGain = bad;
    const before = JSON.stringify(round);
    assert.throws(() => answerReaction(round, card.id, hooks(combatRng)), TypeError);
    assert.equal(JSON.stringify(round), before, 'nothing changed: still paused, no SP spent, card not used');
    answerReaction(round, null, hooks(combatRng));
    assert.equal(round.awaiting, null);
  });
}

test('a queued card with a non-finite momentumGain fails queue validation before any event', () => {
  const fight = FIGHTS[0];
  const queues = makeQueues(fight, rng(1001));
  const queued = Object.values(queues).find((q) => q.length > 0)[0];
  queued.momentumGain = 'x';
  assert.throws(() => startRound(makeFight(fight.specs, TABLES), { queues, rng: rng(1), merge: fight.merge }), TypeError);
});

test('a hand reaction card with a non-finite sp throws at round start, before any change', () => {
  const fight = FIGHTS[0];
  const state = makeFight(fight.specs, TABLES);
  const hand = state.combatants.player.hand;
  const card = hand.find((c) => ['guard', 'evade', 'counter'].includes(c.kind));
  assert.ok(card, 'the player hand has a defensive card');
  card.sp = 'x';
  const before = JSON.stringify(state);
  assert.throws(() => startRound(state, { queues: makeQueues(fight, rng(1001)), rng: rng(1), merge: fight.merge }), RangeError);
  assert.equal(JSON.stringify(state), before, 'the fight state is untouched');
});

test('a stepRound that throws mid-round leaves the round exactly as it was', () => {
  let threw = false;
  for (let seed = 1; seed <= 60 && !threw; seed += 1) {
    const fight = FIGHTS[0];
    const combatRng = rng(seed);
    const round = startRound(makeFight(fight.specs, TABLES), { queues: makeQueues(fight, rng(seed + 1000)), rng: combatRng, merge: fight.merge });
    // Tampered after start: every player hand card that can be offered gets a non-finite sp.
    for (const c of round.cur.combatants.player.hand) if (c.kind !== 'attack') c.sp = 'x';
    for (let guard = 0; guard < 200 && !round.settled; guard += 1) {
      const before = JSON.stringify(round);
      try {
        const res = stepRound(round, hooks(combatRng));
        if (res.awaitingReaction) break;
        if (res.done) break;
      } catch (err) {
        threw = true;
        assert.ok(err instanceof TypeError || err instanceof RangeError);
        assert.equal(JSON.stringify(round), before, 'a throw changes nothing: same cursor, no SP spent');
        break;
      }
    }
  }
  assert.ok(threw, 'some seed must reach a throwing offer');
});

test('the rng is passed per call and never stored in the round', () => {
  const fight = FIGHTS[0];
  const round = startRound(makeFight(fight.specs, TABLES), { queues: makeQueues(fight, rng(3)), rng: rng(4), merge: 'speed' });
  assert.equal(JSON.stringify(round).includes('rng'), false);
  assert.throws(() => stepRound(round, {}), TypeError);
});

test('the content tables equal the CSVs in docs/alternative-combat-rounds, byte for byte and parsed', () => {
  const files = {
    EVADE_BONUS_CSV: 'evade-bonus.csv',
    EVASION_ARMOR_CSV: 'evasion-armor.csv',
    EVASION_CARDS_CSV: 'evasion-cards.csv',
    SPEED_MODS_CSV: 'speed-mods.csv',
    STANCE_ADVANTAGE_CSV: 'stance-advantage.csv',
  };
  for (const [name, file] of Object.entries(files)) {
    assert.equal(content[name], readFileSync(`${TABLE_DIR}${file}`, 'utf8'), `${name} drifted from ${file}`);
  }
  const parsedSame = (a, b) => assert.deepStrictEqual([...a], [...b]);
  parsedSame(parseStanceAdvantage(content.STANCE_ADVANTAGE_CSV), parseStanceAdvantage(readFileSync(`${TABLE_DIR}stance-advantage.csv`, 'utf8')));
  parsedSame(parseEvadeBonus(content.EVADE_BONUS_CSV), parseEvadeBonus(readFileSync(`${TABLE_DIR}evade-bonus.csv`, 'utf8')));
  parsedSame(parseEvasionCards(content.EVASION_CARDS_CSV), parseEvasionCards(readFileSync(`${TABLE_DIR}evasion-cards.csv`, 'utf8')));
  parsedSame(parseEvasionArmor(content.EVASION_ARMOR_CSV), parseEvasionArmor(readFileSync(`${TABLE_DIR}evasion-armor.csv`, 'utf8')));
});

test('the placeholder numbers in the content module are the ones the engine and docs use', () => {
  assert.equal(content.DEFAULT_SP, DEFAULT_SP);
  assert.deepStrictEqual({ ...content.REACTION_BUFF }, { ...REACTION_BUFF });
  assert.deepStrictEqual({ ...content.DEFENSE_BASE }, { ...DEFENSE_BASE });
  assert.equal(content.ADAPT_INDEX, ADAPT_INDEX);
  assert.deepStrictEqual(docsTimeline.MERGE_MODES, MERGE_MODES);
});

test('src/engine/combatRounds stays headless: no window, document, storage, timers or node: imports', () => {
  const files = readdirSync(ENGINE_DIR).filter((f) => f.endsWith('.js'));
  assert.ok(files.includes('round.js') && files.includes('timeline.js') && files.includes('resolver.js'));
  const banned = ['window', 'document', 'localStorage', 'setTimeout', "from 'node:", 'from "node:'];
  for (const f of files) {
    const text = readFileSync(`${ENGINE_DIR}${f}`, 'utf8');
    for (const word of banned) assert.equal(text.includes(word), false, `${f} contains "${word}"`);
  }
});

test('every export line in the combat rounds modules is a form tools/bundle.mjs accepts', () => {
  // tools/bundle.mjs transforms exports line by line: `export { a, b };` (no `from`),
  // `export function|class NAME`, or `export const|let|var NAME`. Anything else fails the build.
  const files = ['src/engine/combatRounds/resolver.js', 'src/engine/combatRounds/timeline.js',
    'src/engine/combatRounds/round.js', 'src/content/combatRounds.js'];
  const ok = [
    /^[ \t]*export\s*\{[^}]*\}\s*;?[ \t]*$/,
    /^[ \t]*export\s+(async\s+)?(function\*?|class)\s+[A-Za-z_$]/,
    /^[ \t]*export\s+(const|let|var)\s+[A-Za-z_$]/,
  ];
  for (const f of files) {
    const lines = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
      if (!/^[ \t]*export\b/.test(line)) return;
      assert.ok(ok.some((re) => re.test(line)), `${f}:${i + 1} uses an export form the bundler rejects: ${line}`);
    });
  }
});

test('a non-finite combatant level counts as 0, the same before and after a JSON round-trip', async () => {
  const { makeCombatant } = await import('../src/engine/combatRounds/timeline.js');
  const c = makeCombatant({ id: 'player', side: 'player', level: 'x', hp: 10 });
  assert.equal(c.level, 0);
  assert.equal(JSON.parse(JSON.stringify(c)).level, 0);
});

// Duplicate copies of one card definition (owner, Codex finding on PR #1867): the same id, told
// apart by instanceId. A copy is tracked by cardKey(card) = instanceId ?? id.
const dupDefend = (instanceId) => card('defend', 'guard', 'self', { instanceId, block: 4 });
const plainDefend = () => card('defend', 'guard', 'self', { block: 4 });
const goblinStabs = () => [
  card('stab1', 'attack', 'player', { speed: 0, damage: 3, sp: 1 }),
  card('stab2', 'attack', 'player', { speed: 2, damage: 3, sp: 1 }),
];
function dupFight(hand, playerQueue = []) {
  const specs = [player({ hand, sp: 3 }),
    { id: 'goblin', hp: 14, sp: 3, attrs: { DEX: 3 }, level: 1, wis: 2, stance: 'smash' }];
  const queues = { player: playerQueue, goblin: goblinStabs() };
  return startRound(makeFight(specs, TABLES), { queues, rng: rng(1), merge: 'speed' });
}
// Steps the round to the end. `pick(eligible)` names the reaction card (or null) for each offer.
function stepAll(round, pick) {
  const combatRng = rng(1);
  const offers = [];
  const events = [];
  let res = stepRound(round, hooks(combatRng));
  for (;;) {
    events.push(...res.events);
    if (res.awaitingReaction) {
      const { eligible } = res.awaitingReaction;
      offers.push(eligible.map((c) => c.instanceId ?? c.id));
      const chosen = pick(eligible);
      res = answerReaction(round, chosen ? keyOf(chosen) : null, hooks(combatRng));
      continue;
    }
    if (res.done) break;
    res = stepRound(round, hooks(combatRng));
  }
  return { offers, events };
}
const keyOf = (c) => c.instanceId ?? c.id;

test('cardKey is instanceId when a card has one, and its id otherwise', () => {
  assert.equal(timelineModule.cardKey({ id: 'defend' }), 'defend');
  assert.equal(timelineModule.cardKey({ id: 'defend', instanceId: 'defend#2' }), 'defend#2');
});

test('a queued copy does not make its twin copy ineligible: the other copy is still offered', () => {
  const d1 = dupDefend('defend#1');
  const d2 = dupDefend('defend#2');
  const round = dupFight([d1, d2], [{ ...d1 }]);
  const { offers } = stepAll(round, () => null);
  assert.ok(offers.length >= 1, 'an attack on the player must offer the unqueued copy');
  for (const o of offers) assert.deepStrictEqual(o, ['defend#2'], 'only the unqueued copy is offered');
});

test('reacting with one copy uses that copy only: its twin is not offered again this round', () => {
  const d1 = dupDefend('defend#1');
  const d2 = dupDefend('defend#2');
  const round = dupFight([d1, d2], [{ ...d1 }]);
  const { offers, events } = stepAll(round, (eligible) => eligible.find((c) => keyOf(c) === 'defend#2'));
  // The first attack takes defend#2; the second attack finds defend#1 queued and defend#2 used.
  assert.equal(offers.length, 1, 'no offer after the copy is used');
  const reactions = events.filter((e) => e.type === 'reaction');
  assert.equal(reactions.length, 1);
  assert.equal(reactions[0].cardId, 'defend', 'cardId stays the card id for display');
  assert.equal(reactions[0].instanceId, 'defend#2', 'the event names the copy that was played');
});

test('stepped answerReaction picks the named copy and refuses the queued one', () => {
  const d1 = dupDefend('defend#1');
  const d2 = dupDefend('defend#2');
  const round = dupFight([d1, d2], [{ ...d1 }]);
  const combatRng = rng(1);
  let res = stepRound(round, hooks(combatRng));
  while (!res.awaitingReaction && !res.done) res = stepRound(round, hooks(combatRng));
  assert.ok(res.awaitingReaction, 'the first attack pauses for a reaction');
  assert.deepStrictEqual(res.awaitingReaction.eligible.map(keyOf), ['defend#2']);
  assert.throws(() => answerReaction(round, 'defend#1', hooks(combatRng)), TypeError);
  assert.ok(round.awaiting, 'a refused copy leaves the round waiting');
  const next = answerReaction(round, 'defend#2', hooks(combatRng));
  const reaction = next.events.find((e) => e.type === 'reaction');
  assert.equal(reaction.instanceId, 'defend#2');
  assert.equal(reaction.cardId, 'defend');
});

test('regression: two copies without instanceId are tracked by id, as before', () => {
  // A queued copy makes every copy with that id ineligible: no offer at all.
  const queued = dupFight([plainDefend(), plainDefend()], [plainDefend()]);
  assert.equal(stepAll(queued, () => null).offers.length, 0);
  // Without a queue, one reaction uses the id, so the second attack gets no offer.
  const free = dupFight([plainDefend(), plainDefend()]);
  const { offers, events } = stepAll(free, (eligible) => eligible[0]);
  assert.deepStrictEqual(offers, [['defend', 'defend']]);
  const reaction = events.find((e) => e.type === 'reaction');
  assert.equal(reaction.cardId, 'defend');
  assert.equal(Object.hasOwn(reaction, 'instanceId'), false, 'no instanceId field for a card without one');
});
