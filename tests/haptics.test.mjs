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
import { playBeatCues, playReceiptSounds, playTimeline } from '../src/ui/fx.js';

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
  // Preserve this historical host's cards and post-setup combat entry.
  const { legacyContentBundle: contentBundle } = await import('./helpers/legacy-progression-content.mjs');
  const { createRegistries } = await import('../src/model/registries.js');
  const { createSession } = await import('../tools/session.mjs');
  const { coopReceiptSounds } = await import('../src/ui/screens/coop.js');
  assert.match(src('src/ui/screens/coop.js'), /lastSoundSeq = coopReceiptSounds\(sc, lastSoundSeq, seats\);/, 'renderCombat names its seats');
  const reg = createRegistries(contentBundle);
  const host = createSession({ registries: reg, seedString: 'HAPT1' });
  for (const id of ['p1', 'p2']) host.addMember({ id, name: id, classId: 'reaver' });
  host.start();
  for (const member of host.session.members.values()) delete member.run.reactionRulesVersion;
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

test('co-op: a teammate\'s direct HP loss buzzes their device, not mine (#1517 review)', async () => {
  // Every player entity is id 'player', so an hpLost receipt that names no
  // seat cannot be told from my own; the engine stamps the seat it cost, and
  // a receipt with no seat is nobody's here, not everyone's.
  // Preserve this historical host's cards and post-setup combat entry.
  const { legacyContentBundle: contentBundle } = await import('./helpers/legacy-progression-content.mjs');
  const { createRegistries } = await import('../src/model/registries.js');
  const { createSession } = await import('../tools/session.mjs');
  const { applyLoseHp } = await import('../src/engine/actions.js');
  const { coopReceiptSounds } = await import('../src/ui/screens/coop.js');
  const host = createSession({ registries: createRegistries(contentBundle), seedString: 'HAPT2' });
  for (const id of ['p1', 'p2']) host.addMember({ id, name: id, classId: 'reaver' });
  host.start();
  for (const id of ['p1', 'p2']) host.chooseNode(id, host.session.mapGraph.startIds[0]);
  let heard = coopReceiptSounds(host.snapshot().scene, 0, ['p1', 'p2']);
  const C = host.live.combat;
  // p1 acts last, so the shared ctx's active seat is p1 when p2 is hurt —
  // as when an enemy's move or a status resolves against an inactive seat.
  const p1 = C.players.get('p1'); p1.entity.energy = 99;
  p1.piles.hand.push({ instanceId: 'hap-card2', cardId: 'gorefireSlash', upgraded: false });
  assert.ok(host.combatPlay('p1', 'hap-card2', 'e1').ok);
  heard = coopReceiptSounds(host.snapshot().scene, heard, ['p1', 'p2']);
  assert.equal(C.playerKey, 'p1');
  assert.equal(applyLoseHp(C, C.players.get('p2').entity, 3, 'effect'), 3, 'Guilt/Herald-style loseHp on the teammate');
  // The scene digest is rebuilt by the next authoritative action: p1 ends
  // their turn alone, so no enemy acts and the batch carries just that wound.
  assert.ok(host.combatEndTurn('p1').ok);
  const scene = host.snapshot().scene;
  const lost = scene.events.filter((e) => e.type === 'hpLost' && e.targetId === 'player');
  assert.deepEqual(lost.map((e) => e.targetPlayerId), ['p2'], 'the receipt names the seat it cost');
  assert.deepEqual(felt(() => coopReceiptSounds(scene, heard, ['p1'])).filter((id) => id === 'damageTaken'), [], 'a teammate\'s wound does not buzz me');
  assert.deepEqual(felt(() => coopReceiptSounds(scene, heard, ['p2'])).filter((id) => id === 'damageTaken'), ['damageTaken'], 'their own device buzzes');
  // A co-op receipt with no seat at all is not treated as local.
  assert.deepEqual(felt(() => playReceiptSounds([{ type: 'hpLost', targetId: 'player', amount: 2, cause: 'effect' }], { isLocalPlayer: (id) => id === 'p1' })), []);
});

/** The sfx ids asked for while fn runs. */
function heardSfx(fn) {
  const before = sfx.sink;
  const ids = [];
  sfx.sink = (id) => ids.push(id);
  try { fn(); } finally { sfx.sink = before; }
  return ids;
}

test('co-op: the card that wins the fight still buzzes, though combat is gone (#1517 review)', async () => {
  // settleCombat replaces the combat scene with the reward at once, so the
  // final card's receipts never reach a combat scene; they ride the reward.
  // Preserve this historical host's cards and post-setup combat entry.
  const { legacyContentBundle: contentBundle } = await import('./helpers/legacy-progression-content.mjs');
  const { createRegistries } = await import('../src/model/registries.js');
  const { createSession } = await import('../tools/session.mjs');
  const { coopReceiptSounds } = await import('../src/ui/screens/coop.js');
  assert.match(src('src/ui/screens/coop.js'), /if \(snap\.scene\.kind !== 'combat'\) lastSoundSeq = coopReceiptSounds\(snap\.scene, lastSoundSeq, seats\);/,
    'render hears a non-combat scene\'s final receipts');
  const host = createSession({ registries: createRegistries(contentBundle), seedString: 'HAPT3' });
  for (const id of ['p1', 'p2']) host.addMember({ id, name: id, classId: 'reaver' });
  host.start();
  for (const id of ['p1', 'p2']) host.chooseNode(id, host.session.mapGraph.startIds[0]);
  const heard = coopReceiptSounds(host.snapshot().scene, 0, ['p1', 'p2']);
  const C = host.live.combat;
  for (const e of C.enemies) { if (e.id !== 'e1') { e.alive = false; e.hp = 0; } else { e.hp = 1; e.block = 0; } }
  const p = C.players.get('p2'); p.entity.energy = 99;
  p.piles.hand.push({ instanceId: 'hap-win', cardId: 'gorefireSlash', upgraded: false });
  const r = host.combatPlay('p2', 'hap-win', 'e1');
  assert.ok(r.ok && r.result === 'victory', `the card ends the fight (${JSON.stringify(r)})`);
  const scene = host.snapshot().scene;
  assert.equal(scene.kind, 'reward', 'the combat scene is already gone');
  assert.deepEqual(felt(() => coopReceiptSounds(scene, heard, ['p1'])).filter((id) => id === 'cardPlay'), [], 'a teammate\'s winning card does not buzz me');
  let next = heard;
  assert.deepEqual(felt(() => { next = coopReceiptSounds(scene, heard, ['p2']); }), ['cardPlay'], 'my winning card buzzes');
  assert.ok(next > heard, 'and is heard once');
  assert.deepEqual(felt(() => coopReceiptSounds(scene, next, ['p2'])), [], 'a re-render does not buzz again');
  assert.deepEqual(felt(() => coopReceiptSounds(scene, 0, ['p2'])), [], 'a client that just joined replays nothing');
  assert.deepEqual(heardSfx(() => coopReceiptSounds(scene, heard, ['p2'])), [], 'the final receipts make no new sound');
});

test('co-op: a setup HP loss (Warden Horn) buzzes the hurt seat in the opening (#1517 review)', async () => {
  // Preserve this historical host's cards and post-setup combat entry.
  const { legacyContentBundle: contentBundle } = await import('./helpers/legacy-progression-content.mjs');
  const { createRegistries } = await import('../src/model/registries.js');
  const { createSession } = await import('../tools/session.mjs');
  const { coopReceiptSounds } = await import('../src/ui/screens/coop.js');
  const host = createSession({ registries: createRegistries(contentBundle), seedString: 'HAPT4' });
  for (const id of ['p1', 'p2']) host.addMember({ id, name: id, classId: 'reaver' });
  host.start();
  host.livingMembers().find((m) => m.id === 'p2').run.relics.push('wardenHorn');
  for (const id of ['p1', 'p2']) host.chooseNode(id, host.session.mapGraph.startIds[0]);
  const scene = host.snapshot().scene;
  assert.equal(scene.kind, 'combat');
  assert.equal(scene.opening, true);
  const lost = scene.events.filter((e) => e.type === 'hpLost' && e.targetId === 'player');
  assert.deepEqual(lost.map((e) => e.targetPlayerId), ['p2'], 'the opening digest carries the Horn\'s wound, for its seat');
  assert.ok(felt(() => coopReceiptSounds(scene, 0, ['p2'])).includes('damageTaken'), 'the hurt seat buzzes');
  assert.ok(!felt(() => coopReceiptSounds(scene, 0, ['p1'])).includes('damageTaken'), 'a teammate does not');
});

test('a skipped timeline still buzzes the hit and the turn start it jumped past, in one call (#1517 review)', async () => {
  // At Normal pacing a pointer press flushes the timeline: onFlush jumps the
  // display to the end, and the beats it skipped never reach playBeatCues.
  const listeners = {};
  const saved = { add: globalThis.addEventListener, remove: globalThis.removeEventListener };
  globalThis.addEventListener = (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); };
  globalThis.removeEventListener = (type, fn) => { listeners[type] = (listeners[type] || []).filter((f) => f !== fn); };
  const fire = (type) => { for (const fn of (listeners[type] || []).splice(0)) fn(); };
  const events = [
    { type: 'enemyMoveStarted', sourceId: 'e1', enemyId: 'e1', kind: 'attack' },
    { type: 'damageDealt', sourceId: 'e1', targetId: 'player', amount: 6, blocked: 0 },
    { type: 'hpLost', targetId: 'player', amount: 6, cause: 'attack' },
    { type: 'playerTurnStart', turn: 2 },
  ];
  const ctx = { layer: { closest: () => null }, anchorFor: () => null, onFlush: () => {}, onBeatApplied: () => {} };
  const stub = stubNavigator();
  const before = haptic.sink;
  const ids = [];
  const sounds = [];
  const sfxBefore = sfx.sink;
  try {
    const { cue, tick } = manualCue({});
    haptic.sink = (id) => { ids.push(id); cue(id); };
    sfx.sink = (id) => sounds.push(id);
    await new Promise((resolve) => {
      playTimeline(events, ctx, resolve);
      // The enemy's beat has started; nothing has been cued yet. Skip it.
      fire('pointerdown');
      fire('pointerup');
    });
    tick();
  } finally {
    haptic.sink = before; sfx.sink = sfxBefore; stub.restore();
    globalThis.addEventListener = saved.add; globalThis.removeEventListener = saved.remove;
  }
  assert.deepEqual(ids, ['damageTaken', 'turnStart'], 'the skipped hit and turn start still buzz');
  assert.equal(stub.calls.length, 1, 'as one vibrate call');
  assert.deepEqual(stub.calls[0], joinPatterns(ids.map((id) => HAPTIC_PATTERNS[id])));
  assert.deepEqual(sounds, [], 'and the skip replays no sound');
});

test('co-op: a downed seat spectating does not buzz on a teammate\'s turn; the stinger is shared (#1517 review)', async () => {
  // Preserve this historical host's cards and post-setup combat entry.
  const { legacyContentBundle: contentBundle } = await import('./helpers/legacy-progression-content.mjs');
  const { createRegistries } = await import('../src/model/registries.js');
  const { createSession } = await import('../tools/session.mjs');
  const { applyLoseHp } = await import('../src/engine/actions.js');
  const { coopReceiptSounds } = await import('../src/ui/screens/coop.js');
  const host = createSession({ registries: createRegistries(contentBundle), seedString: 'HAPT5' });
  for (const id of ['p1', 'p2']) host.addMember({ id, name: id, classId: 'reaver' });
  host.start();
  for (const id of ['p1', 'p2']) host.chooseNode(id, host.session.mapGraph.startIds[0]);
  const opening = host.snapshot().scene;
  // The opening: each seat's own start buzzes its own device once.
  assert.deepEqual(felt(() => coopReceiptSounds(opening, 0, ['p1'])).filter((id) => id === 'turnStart'), ['turnStart']);
  assert.deepEqual(felt(() => coopReceiptSounds(opening, 0, ['p2'])).filter((id) => id === 'turnStart'), ['turnStart'], 'a later seat\'s start still buzzes it');
  const heard = coopReceiptSounds(opening, 0, ['p1', 'p2']);
  const C = host.live.combat;
  const p1 = C.players.get('p1'); p1.entity.hp = p1.entity.maxHp = 999;
  applyLoseHp(C, C.players.get('p2').entity, 9999, 'effect');
  assert.equal(C.players.get('p2').entity.alive, false, 'p2 is down, and spectates');
  assert.ok(host.combatEndTurn('p1').ok);
  const scene = host.snapshot().scene;
  assert.equal(scene.kind, 'combat');
  const starts = scene.events.filter((e) => e.type === 'playerTurnStart');
  assert.deepEqual(starts.map((e) => e.playerId), ['p1'], 'only the living seat starts a turn');
  assert.ok(!felt(() => coopReceiptSounds(scene, heard, ['p2'])).includes('turnStart'), 'the spectator\'s device does not buzz');
  assert.ok(heardSfx(() => coopReceiptSounds(scene, heard, ['p2'])).includes('turnStinger'), 'but hears the shared stinger');
  assert.deepEqual(felt(() => coopReceiptSounds(scene, heard, ['p1'])).filter((id) => id === 'turnStart'), ['turnStart'], 'the living seat buzzes');
});

test('co-op: an enemy turn held back by pacing while the fight ends still buzzes, without sound (#1517 audit)', async () => {
  // paceEnemyTurn holds frames; when the last is the reward or completion
  // scene, only that scene is rendered, so the held combat frames are heard
  // here, haptics only (pacing is DOM-bound: the wiring is read from source).
  assert.match(src('src/ui/screens/coop.js'),
    /if \(latest\.scene\?\.kind !== 'combat'\) \{\s*for \(const frame of combatFrames\) lastSoundSeq = coopReceiptSounds\(frame\.scene, lastSoundSeq, seats, \{ hapticsOnly: true \}\);/);
  // Preserve this historical host's cards and post-setup combat entry.
  const { legacyContentBundle: contentBundle } = await import('./helpers/legacy-progression-content.mjs');
  const { createRegistries } = await import('../src/model/registries.js');
  const { createSession } = await import('../tools/session.mjs');
  const { coopReceiptSounds } = await import('../src/ui/screens/coop.js');
  const host = createSession({ registries: createRegistries(contentBundle), seedString: 'HAPT1' });
  for (const id of ['p1', 'p2']) host.addMember({ id, name: id, classId: 'reaver' });
  host.start();
  for (const member of host.session.members.values()) delete member.run.reactionRulesVersion;
  for (const id of ['p1', 'p2']) host.chooseNode(id, host.session.mapGraph.startIds[0]);
  const heard = coopReceiptSounds(host.snapshot().scene, 0, ['p1', 'p2']);
  host.combatEndTurn('p1'); host.combatEndTurn('p2');
  const round = host.snapshot().scene;
  const full = felt(() => coopReceiptSounds(round, heard, ['p1', 'p2']));
  assert.ok(full.includes('damageTaken') && full.includes('turnStart'), `the round hurts and starts a turn (${full})`);
  let ids = [];
  let next = heard;
  const sounds = heardSfx(() => { ids = felt(() => { next = coopReceiptSounds(round, heard, ['p1', 'p2'], { hapticsOnly: true }); }); });
  assert.deepEqual(ids, full, 'the same buzzes');
  assert.deepEqual(sounds, [], 'and no sound');
  assert.equal(next, round.receiptSeq, 'the frame is heard, so the scene after it does not replay it');
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
