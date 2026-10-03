// tests/haptics.test.mjs — haptics on card play, damage taken and turn start,
// and the setting that turns them off (docs/FINISH.md, wave 13 "Haptics").
//
// The FINISH line's test, exactly: a stubbed `navigator.vibrate` records 0
// calls when the setting is off. The rest pins the review of #1517: haptics
// have their own seam (not the shared sfx ids), every HP loss buzzes once,
// co-op card plays buzz from the receipt, and one tick's cues are one call.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HAPTIC_PATTERNS, HAPTICS_DEFAULT_ON, HAPTIC_BATCH_GAP_MS, HAPTIC_BATCH_MAX_MS, hapticPatternIssues } from '../src/content/haptics.js';
import { createHaptics, hapticsEnabled, haptic, joinPatterns } from '../src/ui/haptics.js';
import { sfx } from '../src/ui/sfx.js';
import { playBeatCues, playReceiptSounds } from '../src/ui/fx.js';

const NAMED = ['cardPlay', 'damageTaken', 'turnStart'];
const src = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function stubNavigator() {
  const calls = [];
  const before = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true, writable: true,
    value: { vibrate: (pattern) => { calls.push(pattern); return true; } },
  });
  const restore = () => {
    if (before) Object.defineProperty(globalThis, 'navigator', before);
    else delete globalThis.navigator;
  };
  return { calls, restore };
}

/** A cue whose "next tick" is run by hand: tick() flushes what was queued. */
function manualCue(settings) {
  const ticks = [];
  const cue = createHaptics({ getSettings: () => settings, schedule: (fn) => ticks.push(fn) });
  const tick = () => { while (ticks.length) ticks.shift()(); };
  return { cue, tick };
}

/** The haptic ids asked for while fn runs (the seam, no device). */
function felt(fn) {
  const before = haptic.sink;
  const ids = [];
  haptic.sink = (id) => ids.push(id);
  try { fn(); } finally { haptic.sink = before; }
  return ids;
}

test('the pattern table is data and names card play, damage taken and turn start', () => {
  assert.deepEqual(hapticPatternIssues(), []);
  for (const id of NAMED) assert.ok(Array.isArray(HAPTIC_PATTERNS[id]), `${id} has a pattern`);
  assert.equal(HAPTICS_DEFAULT_ON, true, 'haptics default on');
});

test('the validator names a malformed pattern', () => {
  assert.ok(hapticPatternIssues({ cardPlay: [] }).length > 0);
  assert.ok(hapticPatternIssues({ cardPlay: [-5] }).length > 0);
  assert.ok(hapticPatternIssues({ cardPlay: ['x'] }).length > 0);
});

test('setting off: a stubbed navigator.vibrate records 0 calls', () => {
  const stub = stubNavigator();
  try {
    const { cue, tick } = manualCue({ haptics: false });
    for (const id of NAMED) assert.equal(cue(id), false);
    tick();
    assert.equal(stub.calls.length, 0);
  } finally { stub.restore(); }
});

test('setting on (and unset, the default): each cue vibrates its pattern; unknown ids do not', () => {
  for (const settings of [{ haptics: true }, {}]) {
    const stub = stubNavigator();
    try {
      const { cue, tick } = manualCue(settings);
      for (const id of NAMED) { assert.equal(cue(id), true); tick(); }
      for (const id of ['cardDraw', 'playerHurt', 'turnStinger', 'toString']) assert.equal(cue(id), false, `${id} has no pattern`);
      tick();
      assert.deepEqual(stub.calls, NAMED.map((id) => [...HAPTIC_PATTERNS[id]]));
    } finally { stub.restore(); }
  }
});

test('cues in one tick are ONE vibrate call, played in order, so none truncates another', async () => {
  const stub = stubNavigator();
  try {
    const { cue, tick } = manualCue({});
    cue('damageTaken'); cue('turnStart');
    assert.equal(stub.calls.length, 0, 'nothing is sent until the tick ends');
    tick();
    const G = HAPTIC_BATCH_GAP_MS;
    assert.deepEqual(stub.calls, [[...HAPTIC_PATTERNS.damageTaken, G, ...HAPTIC_PATTERNS.turnStart]]);
    // The default schedule is a microtask: two synchronous cues, one call.
    const live = createHaptics({ getSettings: () => ({}) });
    live('cardPlay'); live('cardPlay');
    await Promise.resolve();
    assert.equal(stub.calls.length, 2);
    assert.deepEqual(stub.calls[1], [...HAPTIC_PATTERNS.cardPlay, G, ...HAPTIC_PATTERNS.cardPlay]);
  } finally { stub.restore(); }
  // A pattern that ends on a pause needs no extra gap; a long batch is capped.
  assert.deepEqual(joinPatterns([[10, 5], [7]], { gap: 99 }), [10, 5, 7]);
  const long = joinPatterns(Array(50).fill([40, 30, 60]));
  assert.ok(long.reduce((n, v) => n + v, 0) <= HAPTIC_BATCH_MAX_MS, 'a long replay is a short rumble');
  assert.ok(long.length > 3, 'but keeps more than one cue');
});

test('the setting is read live, and a missing navigator.vibrate is silent, not a throw', () => {
  const settings = { haptics: true };
  const stub = stubNavigator();
  try {
    const { cue, tick } = manualCue(settings);
    cue('cardPlay'); tick();
    settings.haptics = false;
    cue('cardPlay'); tick();
    assert.equal(stub.calls.length, 1);
    globalThis.navigator = {};
    settings.haptics = true;
    assert.equal(cue('cardPlay'), false);
    tick();
  } finally { stub.restore(); }
  assert.equal(hapticsEnabled({ haptics: 'no' }), HAPTICS_DEFAULT_ON, 'a non-boolean store reads as the default');
});

test('the shared cardPlay SOUND does not buzz: equipment and armament swaps stay still', () => {
  // Review of #1517: equipment.js and combat.js's swapArmament play the
  // 'cardPlay' sound. Haptics are not fed from sfx ids, so they cannot buzz.
  assert.deepEqual(felt(() => sfx.play('cardPlay')), []);
  assert.doesNotMatch(src('src/ui/screens/equipment.js'), /haptic/, 'equipment screens play no haptic');
  const combat = src('src/ui/screens/combat.js');
  const sites = [...combat.matchAll(/haptic\.play\('cardPlay'\)/g)];
  assert.equal(sites.length, 1, 'one card-play haptic site in solo combat');
  const before = combat.slice(Math.max(0, sites[0].index - 900), sites[0].index);
  assert.match(before, /dispatch\(combat, \{ type: 'playCard'/, 'and it is the real card play, after a playCard dispatch');
  assert.doesNotMatch(before.slice(before.lastIndexOf('dispatch(')), /swapArmament/);
});

test('every HP loss buzzes once per beat: direct hpLost too, and an attack pair is one hit', () => {
  // Guilt / Herald loseHp (cause 'effect'), Gorefire/Venom procs: hpLost alone.
  assert.deepEqual(felt(() => playBeatCues([{ type: 'hpLost', targetId: 'player', amount: 3, cause: 'effect' }])), ['damageTaken']);
  assert.deepEqual(felt(() => playBeatCues([{ type: 'hpLost', targetId: 'player', amount: 2, cause: 'proc:venom' }])), ['damageTaken']);
  // An attack: damageDealt plus its hpLost twin → one buzz, not two.
  assert.deepEqual(felt(() => playBeatCues([
    { type: 'damageDealt', targetId: 'player', amount: 6, blocked: 1 },
    { type: 'hpLost', targetId: 'player', amount: 5, cause: 'attack' },
  ])), ['damageTaken']);
  // No HP lost to the player: no buzz.
  assert.deepEqual(felt(() => playBeatCues([{ type: 'damageDealt', targetId: 'player', amount: 4, blocked: 4 }])), [], 'fully blocked');
  assert.deepEqual(felt(() => playBeatCues([{ type: 'hpLost', targetId: 'e1', amount: 4, cause: 'proc:bleed' }])), [], 'an enemy bleeding');
  assert.deepEqual(felt(() => playBeatCues([{ type: 'damageDealt', targetId: 'e1', amount: 9 }])), [], 'an enemy hit');
  // Turn start keeps its own buzz.
  assert.deepEqual(felt(() => playBeatCues([{ type: 'playerTurnStart', turn: 2 }])), ['turnStart']);
});

test('co-op: a card play buzzes from its cardPlayed receipt, for this screen\'s seats only', async () => {
  const { contentBundle } = await import('../src/content/index.js');
  const { createRegistries } = await import('../src/model/registries.js');
  const { createSession } = await import('../tools/session.mjs');
  const { coopReceiptSounds } = await import('../src/ui/screens/coop.js');
  assert.match(src('src/ui/screens/coop.js'), /lastSoundSeq = coopReceiptSounds\(sc, lastSoundSeq, seats\);/, 'renderCombat names its seats');
  const reg = createRegistries(contentBundle);
  const host = createSession({ registries: reg, seedString: 'HAPT1' });
  for (const id of ['p1', 'p2']) host.addMember({ id, name: id, classId: 'reaver' });
  host.start();
  for (const id of ['p1', 'p2']) host.chooseNode(id, host.session.mapGraph.startIds[0]);
  let heard = coopReceiptSounds(host.snapshot().scene, 0, ['p2']);
  const p = host.live.combat.players.get('p2'); p.entity.energy = 99;
  p.piles.hand.push({ instanceId: 'hap-card', cardId: 'gorefireSlash', upgraded: false });
  assert.ok(host.combatPlay('p2', 'hap-card', 'e1').ok);
  const scene = host.snapshot().scene;
  assert.ok(scene.events.some((e) => e.type === 'cardPlayed' && e.playerId === 'p2'), 'the receipt names its seat');
  assert.deepEqual(felt(() => coopReceiptSounds(scene, heard, ['p1'])).filter((id) => id === 'cardPlay'), [], 'a teammate\'s play does not buzz me');
  assert.deepEqual(felt(() => { heard = coopReceiptSounds(scene, heard, ['p2']); }).filter((id) => id === 'cardPlay'), ['cardPlay'], 'my play buzzes');
  // The end of the round: enemies hit, then the next turn starts — one
  // receipt batch, so one vibrate call carrying both, not one truncating the other.
  host.combatEndTurn('p1'); heard = coopReceiptSounds(host.snapshot().scene, heard, ['p1', 'p2']);
  host.combatEndTurn('p2');
  const round = host.snapshot().scene;
  const stub = stubNavigator();
  const before = haptic.sink;
  try {
    const { cue, tick } = manualCue({});
    haptic.sink = cue;
    coopReceiptSounds(round, heard, ['p1', 'p2']);
    tick();
  } finally { haptic.sink = before; stub.restore(); }
  assert.equal(stub.calls.length, 1, 'one call for the batch');
  const ids = felt(() => coopReceiptSounds(round, heard, ['p1', 'p2']));
  assert.ok(ids.includes('damageTaken') && ids.includes('turnStart'), `the round hurts and then starts a turn (${ids})`);
  assert.ok(ids.indexOf('damageTaken') < ids.lastIndexOf('turnStart'), 'damage before the turn stings');
  assert.deepEqual(stub.calls[0], joinPatterns(ids.map((id) => HAPTIC_PATTERNS[id])), 'every cue of the batch, in one pattern');
});

test('a direct HP loss in a co-op receipt batch buzzes the hurt seat', () => {
  const events = [{ type: 'hpLost', targetId: 'player', playerId: 'p2', amount: 2, cause: 'effect' }];
  assert.deepEqual(felt(() => playReceiptSounds(events, { isLocalPlayer: (id) => id === 'p2' })), ['damageTaken']);
  assert.deepEqual(felt(() => playReceiptSounds(events, { isLocalPlayer: (id) => id === 'p1' })), []);
});

test('Settings offers the switch once, under Audio, defaulting to the data value', async () => {
  const { settingsRow, settingOn, generalGroups } = await import('../src/ui/screens/settings.js');
  const row = settingsRow('haptics');
  assert.equal(row.cat, 'Audio');
  assert.equal(row.def, HAPTICS_DEFAULT_ON);
  assert.equal(settingOn({}, 'haptics'), hapticsEnabled({}), 'the row and the runtime agree on an unset key');
  assert.equal(settingOn({ haptics: false }, 'haptics'), false);
  assert.equal(generalGroups('Audio').get('Audio').filter((r) => r.key === 'haptics').length, 1);
});

test('main.js gives sfx and haptics separate sinks', () => {
  // The wiring itself: without it the module above is never reached and the
  // game ships no haptics, while every other test here still passes.
  const main = src('src/main.js');
  assert.match(main, /import\s*\{\s*createHaptics,\s*haptic\s*\}\s*from\s*'\.\/ui\/haptics\.js'/);
  assert.match(main, /haptic\.sink\s*=\s*createHaptics\(\{\s*getSettings:/, 'main.js plugs the device cue into the haptic seam');
  assert.match(main, /sfx\.sink\s*=\s*\(id\)\s*=>\s*audio\.sfx\(id\);/, 'sound ids reach audio only');
});
