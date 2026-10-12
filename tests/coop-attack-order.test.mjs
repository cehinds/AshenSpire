// A co-op seat's own card attack plays in the solo order (SPEC §7.4,
// beatOrder 'sequential'): coop.js routes the snapshot that carries it through
// the paced timeline instead of a plain render (coopTimelineRoute).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { initialClassTreeChoices } from '../src/model/classTree.js';
import { registriesForClassMastery } from '../src/model/classMasteryRun.js';
import { createSession } from '../tools/session.mjs';
import { coopTimelineRoute, coopPacedRoute, coopReceiptOverlays, coopCardPlayBuzz, coopReceiptSounds, coopFinalFrame } from '../src/ui/screens/coop.js';
import { haptic } from '../src/ui/haptics.js';
import { decorateCombatEffects, combatEffectReceipt } from '../src/model/combatEffectEvents.js';
import { resolveCoopPlayedCombatCard } from '../src/ui/models/PlayedCombatCard.js';

const registries = createRegistries(contentBundle);

test('a player attack routes through the player timeline', () => {
  assert.equal(coopTimelineRoute([{ type: 'cardPlayed', playerId: 'p1', cardType: 'attack' },
    { type: 'damageDealt', sourceId: 'player', sourcePlayerId: 'p1', targetId: 'e1', amount: 6, isAttack: true }], ['p1']), 'player');
  assert.equal(coopTimelineRoute([{ type: 'impactDealt', sourceId: 'p2', targetId: 'e1', amount: 2 }], ['p1', 'p2']), 'player');
});

test('enemy beats keep the enemy timeline, also when a player attack rides along', () => {
  assert.equal(coopTimelineRoute([{ type: 'enemyMoveStarted', sourceId: 'e1', kind: 'attack' }]), 'enemy');
  assert.equal(coopTimelineRoute([
    { type: 'damageDealt', sourcePlayerId: 'p1', sourceId: 'player', targetId: 'e1', amount: 4, isAttack: true },
    { type: 'combatCounterTriggered', sourceKind: 'enemy', sourceId: 'e1' },
  ], ['p1']), 'enemy');
});

test('non-attack and enemy-sourced receipts render plainly', () => {
  assert.equal(coopTimelineRoute([]), null);
  assert.equal(coopTimelineRoute(null), null);
  assert.equal(coopTimelineRoute([{ type: 'cardPlayed', playerId: 'p1', cardType: 'skill' },
    { type: 'blockGained', targetId: 'player', playerId: 'p1', amount: 5 }], ['p1']), null);
  // Damage that is not an attack (a status tick) and an enemy's hit do not route.
  assert.equal(coopTimelineRoute([{ type: 'damageDealt', sourcePlayerId: 'p1', targetId: 'e1', amount: 3 }], ['p1']), null);
  assert.equal(coopTimelineRoute([{ type: 'damageDealt', sourceId: 'e1', sourcePlayerId: null, targetId: 'player', amount: 3, isAttack: true }], ['p1']), null);
});

test('a real session attack snapshot routes to the player timeline', () => {
  const host = createSession({ registries, seedString: 'ATTACKORDER' });
  host.addMember({ id: 'p1', name: 'One', classId: 'reaver' });
  host.addMember({ id: 'p2', name: 'Two', classId: 'rogue' });
  host.start();
  for (const member of host.session.members.values()) {
    while (member.run.classMasteryState?.initialTreeTiers.length) {
      const choices = initialClassTreeChoices(registriesForClassMastery(registries, member.run), member.run);
      assert.equal(host.chooseMasteryNode(member.id, choices[0]).ok, true);
    }
  }
  for (const id of ['p1', 'p2']) assert.equal(host.chooseNode(id, host.session.mapGraph.startIds[0]).ok, true);
  const scene = host.snapshot().scene;
  assert.equal(scene.kind, 'combat');
  const seat = scene.players.find(player => player.id === 'p1');
  const target = scene.enemies.find(enemy => enemy.alive !== false && enemy.hp > 0);
  const attack = seat.hand.find(card => registries.cards.get(card.cardId)?.type === 'attack');
  assert.ok(attack, 'the opening hand holds an attack');
  const played = host.combatPlay('p1', attack.instanceId, target.id);
  assert.equal(played.ok, true, JSON.stringify(played));
  const after = host.snapshot().scene;
  assert.equal(after.kind, 'combat');
  assert.equal(coopTimelineRoute(after.events, ['p1', 'p2']), 'player', JSON.stringify(after.events.map(event => event.type)));
});

// The node runner has no DOM for mountCoop, so the wiring is pinned on the
// source (as coop-layout-cache.test.mjs does): the player route reuses the
// paced timeline under its own flag, the ribbon reads only enemy pacing, and
// a paced timeline's per-beat renders float nothing as snapshot deltas.
const coop = readFileSync(new URL('../src/ui/screens/coop.js', import.meta.url), 'utf8');
const body = (name) => {
  const start = coop.indexOf(`\n  function ${name}(`);
  assert.ok(start > 0, `coop.js must define ${name}()`);
  const next = coop.indexOf('\n  function ', start + 1);
  return coop.slice(start, next > 0 ? next : undefined);
};

test('co-op routes a new player attack through the paced timeline under the player flag', () => {
  const receive = body('receiveSnapshot');
  assert.match(receive, /if \(busy\(\)\) \{/, 'any running timeline queues the next snapshot');
  assert.match(receive, /coopPacedRoute\(sc, lastReceiptSeq, /);
  assert.match(receive, /route === 'player'\) \{\s*paceReactionReceipts\(s, \{ mode: 'player' \}\);/,
    'only new receipts replay, through the same timeline');
  const pace = body('paceReactionReceipts') + body('playPacedReceipts');
  assert.match(pace, /mode === 'player'\) playerPacing = on; else pacing = on;/);
  assert.match(pace, /playTimeline\(events,/);
  assert.match(pace, /onBeatApplied: apply/, 'the bars apply per beat, after its numbers');
  assert.match(pace, /playCardEffects\(effectOwner, ownerPlan, duration\)/, 'the card effect plays on the swing');
  assert.match(pace, /stage\?\.play\(pose, duration, ownerPlan\?\.aura\)/, 'the resource aura plays on the swing');
  // lastReceiptSeq advances before the final render, so spawnCombatFx never refloats.
  assert.ok(pace.indexOf('lastReceiptSeq = Math.max') < pace.lastIndexOf('render();'));
});

test('the ribbon reads enemy pacing only; the hand and controls hold for either', () => {
  const combat = body('renderCombat');
  assert.match(combat, /data-turn="\$\{pacing \|\| sc\.phase === 'enemy' \? 'enemy' : 'player'\}"/);
  assert.match(combat, /\$\{pacing \|\| sc\.phase === 'enemy' \? 'Enemy Turn' : 'Player Turn'\}/);
  assert.doesNotMatch(combat, /playerPacing/, 'the ribbon never reads the player flag');
  assert.match(combat, /hand\.inert = busy\(\)/);
  assert.match(combat, /meP\.ended \|\| busy\(\) \|\| meP\.energy < row\.costPerStack/, 'recovery controls hold');
  assert.match(coop, /const busy = \(\) => pacing \|\| playerPacing;/);
  assert.match(body('spawnCombatFx'), /if \(!prev \|\| busy\(\)\) return;/);
});

test("every combat re-render, the timeline's final one included, keeps live numbers", () => {
  const render = body('render');
  assert.match(render, /const carriedFx = snap\.scene\.kind === 'combat' \? \[\.\.\.\(app\.querySelector\('\.fx-layer'\)\?\.children \|\| \[\]\)\] : \[\];/);
  assert.match(render, /renderCombat\(\);app\.querySelector\('\.fx-layer'\)\?\.append\(\.\.\.carriedFx\);/);
});

test('a paced player attack still earns its receipt overlays, played after the final render', () => {
  // A seat's attack that bursts bleed and meets an enemy's guard, as the
  // session digest carries it (sourceId "player", seat ids beside it).
  const events = [
    { type: 'cardPlayed', playerId: 'p1', sourcePlayerId: 'p1', cardId: 'gorefireSlash', cardType: 'attack' },
    { type: 'damageDealt', sourceId: 'player', sourcePlayerId: 'p1', targetId: 'e1', amount: 5, blocked: 3, blockRemaining: 2, isAttack: true },
    { type: 'procBurst', status: 'bleed', sourceId: 'player', sourcePlayerId: 'p1', targetId: 'e1' },
  ];
  assert.equal(coopTimelineRoute(events, ['p1']), 'player');
  const overlays = coopReceiptOverlays(decorateCombatEffects(events.map(combatEffectReceipt), registries));
  assert.deepEqual(overlays, [{ kind: 'physicalGuard', targetId: 'e1' }, { kind: 'bloodLoss', targetId: 'e1' }]);
  const pace = body('playPacedReceipts');
  const final = pace.lastIndexOf('render();');
  assert.ok(pace.indexOf('playReceiptOverlays(') > final, 'the overlays play on the final board, not a board the next render replaces');
  // A frame queued during the swing renders first; its render would clear them.
  const drained = pace.lastIndexOf('for (const pending of queued) receiveSnapshot(pending);');
  assert.ok(drained > final && pace.indexOf('playReceiptOverlays(overlays);') > drained, 'the overlays play after the queue drains');
  assert.ok(pace.indexOf('if (!playedPlans.has(ownerId)) playSeatPlan(ownerId, plan);') > drained, 'unplayed plans play after the queue drains');
  assert.ok(pace.indexOf('const overlays = hasCardPlay ? effectEvents') < drained, 'the overlays are captured before a queued render replaces effectEvents');
  assert.match(body('spawnCombatFx'), /if\(hasNewReceipts\)playReceiptOverlays\(effectEvents\);/);
});

test('a card plan no swing played (Instant, reduced motion, a skip) plays on the final board', () => {
  const pace = body('playPacedReceipts');
  assert.match(pace, /if \(ownerPlan\) \{ playCardEffects\(effectOwner, ownerPlan, duration\); playedPlans\.add\(effectOwner\); \}/);
  const unplayed = pace.indexOf('for (const [ownerId, plan] of plans || []) if (!playedPlans.has(ownerId)) playSeatPlan(ownerId, plan);');
  assert.ok(unplayed > pace.lastIndexOf('render();'), 'after the final render');
  assert.match(body('playSeatPlan'), /playCardEffects\(ownerId, plan, duration\);\s*stage\?\.play\(pose, duration, plan\.aura\);/,
    'the effect and the resource aura both play');
  assert.match(body('renderCombat'), /for \(const \[ownerId, plan\] of pendingAnimations\) playSeatPlan\(ownerId, plan\);/);
});

test('a throw before the timeline starts clears the flag; a cancelled or torn-down run renders nothing', () => {
  const pace = body('paceReactionReceipts');
  assert.match(pace, /try \{\s*playPacedReceipts\(next, setPacing, run, land\);\s*\} catch \(error\) \{/);
  assert.match(pace, /if \(run\.started\) return;\s*run\.cancelled = true;\s*setPacing\(false\);\s*snap = land;/,
    'the input lock clears, the run is cancelled and the snapshot lands');
  const timeline = body('playPacedReceipts');
  assert.ok(timeline.lastIndexOf('run.started = true;') > timeline.indexOf('playTimeline(events,'), 'started only once playTimeline owns completion');
  // A watchdog armed before the throw later calls onFlush/done: they must not land stale frames.
  assert.match(timeline, /const apply = beat => \{\s*if \(disposed \|\| run\.cancelled\) return;/);
  assert.match(timeline, /onFlush\(\) \{\s*if \(disposed \|\| run\.cancelled\) return;/);
  assert.match(timeline, /\}, \(\) => \{\s*if \(run\.cancelled\) return;\s*\/\/[^\n]*\n\s*setPacing\(false\);\s*if \(disposed\) return;/,
    'done clears the flag before anything that can throw');
  assert.match(timeline, /if \(hasCardPlay\) \{ try \{ seatPlans\(\); \} catch \(error\) \{/, 'a plan that throws cannot strand the frame');
});

test('a duplicated or resynced frame never replays its timeline, enemy or player', () => {
  const enemy = { kind: 'combat', receiptSeq: 7, players: [{ id: 'p1' }], events: [{ type: 'enemyMoveStarted', sourceId: 'e1', kind: 'attack' }] };
  const attack = { kind: 'combat', receiptSeq: 8, players: [{ id: 'p1' }], events: [{ type: 'damageDealt', sourcePlayerId: 'p1', sourceId: 'player', targetId: 'e1', amount: 4, isAttack: true }] };
  assert.equal(coopPacedRoute(enemy, 6), 'enemy');
  assert.equal(coopPacedRoute(enemy, 7), null, 'the enemy frame already played');
  assert.equal(coopPacedRoute(attack, 7), 'player');
  assert.equal(coopPacedRoute(attack, 8), null, 'the attack frame already played');
  assert.equal(coopPacedRoute({ ...enemy, kind: 'reward' }, 0), null);
});

test("a paced card plan resolves the played card from the frame that carries it, not the working copy", () => {
  const host = createSession({ registries, seedString: 'ATTACKORDER' });
  host.addMember({ id: 'p1', name: 'One', classId: 'reaver' });
  host.addMember({ id: 'p2', name: 'Two', classId: 'rogue' });
  host.start();
  for (const member of host.session.members.values()) {
    while (member.run.classMasteryState?.initialTreeTiers.length) {
      const choices = initialClassTreeChoices(registriesForClassMastery(registries, member.run), member.run);
      assert.equal(host.chooseMasteryNode(member.id, choices[0]).ok, true);
    }
  }
  for (const id of ['p1', 'p2']) assert.equal(host.chooseNode(id, host.session.mapGraph.startIds[0]).ok, true);
  const before = host.snapshot();
  const attack = before.scene.players.find(player => player.id === 'p1').hand.find(card => registries.cards.get(card.cardId)?.type === 'attack');
  const target = before.scene.enemies.find(enemy => enemy.alive !== false && enemy.hp > 0);
  assert.equal(host.combatPlay('p1', attack.instanceId, target.id).ok, true);
  const next = host.snapshot();
  const played = next.scene.events.find(event => event.type === 'cardPlayed');
  // The played card has left every post-play hand; the frame's receipt still names it.
  assert.ok(!next.scene.players.find(player => player.id === 'p1').hand.some(card => card.instanceId === played.cardInstanceId));
  assert.equal(resolveCoopPlayedCombatCard(registries, next, played).id ?? played.cardId, played.cardId);
  const collect = body('collectCombatAnimations');
  assert.match(collect, /resolveCoopPlayedCombatCard\(registries, source, event\)/, 'the plan reads the frame it was given');
  assert.doesNotMatch(collect, /resolveCoopPlayedCombatCard\(registries, snap,/, 'never the working copy');
  assert.match(body('playPacedReceipts'), /collectCombatAnimations\(next\)/);
});

test('the blow that ends a fight is paced once, on the board, before its reward scene lands', () => {
  const host = createSession({ registries, seedString: 'ATTACKORDER' });
  host.addMember({ id: 'p1', name: 'One', classId: 'reaver' });
  host.addMember({ id: 'p2', name: 'Two', classId: 'rogue' });
  host.start();
  for (const member of host.session.members.values()) {
    while (member.run.classMasteryState?.initialTreeTiers.length) {
      const choices = initialClassTreeChoices(registriesForClassMastery(registries, member.run), member.run);
      assert.equal(host.chooseMasteryNode(member.id, choices[0]).ok, true);
    }
  }
  for (const id of ['p1', 'p2']) assert.equal(host.chooseNode(id, host.session.mapGraph.startIds[0]).ok, true);
  const board = host.snapshot().scene;
  const lastSeq = board.receiptSeq;
  // Leave one enemy standing on 1 HP, so the next attack ends the fight.
  const [last, ...rest] = host.live.combat.enemies.filter(enemy => enemy.alive);
  for (const enemy of rest) { enemy.hp = 0; enemy.alive = false; }
  last.hp = 1;
  const attack = board.players.find(player => player.id === 'p1').hand.find(card => registries.cards.get(card.cardId)?.type === 'attack');
  assert.equal(host.combatPlay('p1', attack.instanceId, last.id).ok, true);
  const scene = host.snapshot().scene;
  assert.notEqual(scene.kind, 'combat', 'the fight ended');
  // settleCombat: the final receipts ride the replacing scene, one seq past the board's.
  assert.ok(scene.combatReceipts && scene.combatReceipts.receiptSeq > lastSeq, JSON.stringify(scene.combatReceipts?.receiptSeq));
  assert.ok(scene.combatReceipts.events.some(event => event.type === 'damageDealt' && event.isAttack));
  assert.equal(coopPacedRoute(scene, lastSeq, ['p1', 'p2']), 'player', 'the killing blow plays through the player timeline');
  assert.equal(coopPacedRoute(scene, scene.combatReceipts.receiptSeq, ['p1', 'p2']), null, 'and never replays');
  // Wiring: only with the combat board still mounted; the replacing scene lands at the end.
  const receive = body('receiveSnapshot');
  assert.match(receive, /app\.querySelector\('\.combat\.coop'\) && snap\?\.scene\?\.kind === 'combat'/);
  assert.match(receive, /const final = coopFinalFrame\(s, snap\.scene\);\s*paceReactionReceipts\(final, \{ mode: route, land: s \}\);/);
  // The paced frame is the final authoritative combat frame: its combatLog
  // carries the killing blow's entries (the drawer and Full log read it).
  const frame = coopFinalFrame(host.snapshot(), board);
  const killing = scene.combatReceipts.events.filter(event => ['cardPlayed', 'damageDealt', 'enemyDied'].includes(event.type)).map(event => event.eventIndex);
  const finalIds = scene.combatReceipts.combatLog.map(entry => entry.id);
  for (const id of killing) {
    assert.ok(finalIds.includes(id), `the final frame logs event ${id}`);
    assert.ok(!(board.combatLog || []).some(entry => entry.id === id), `the mounted board never had event ${id}`);
  }
  assert.deepEqual(frame.scene.combatLog, scene.combatReceipts.combatLog, 'the paced frame reads the final combatLog');
  assert.deepEqual(frame.scene.players, scene.combatReceipts.players, 'and its players, for card resolution');
  assert.equal(frame.scene.kind, 'combat');
  assert.equal(frame.scene.receiptSeq, scene.combatReceipts.receiptSeq);
  // A partial frame (events and seq only) keeps the mounted scene for the rest.
  const partial = coopFinalFrame({ ...host.snapshot(), scene: { ...scene, combatReceipts: { receiptSeq: 9, events: [] } } }, board);
  assert.deepEqual(partial.scene.players, board.players);
  assert.equal(partial.scene.receiptSeq, 9);
  const timeline = body('playPacedReceipts');
  assert.match(timeline, /snap = land;\s*render\(\);/);
  assert.match(timeline, /if \(land === next\) \{ snap = next; render\(\); \}/, 'a skip does not redraw the ended fight');
});

test('a fully avoided player attack still plays through the player timeline', () => {
  // Synthetic: a dodged, evaded, decoyed or invulnerable swing lands no damage or impact.
  for (const outcome of [{ type: 'attackEvaded', targetId: 'e1', charges: 0 }, { type: 'combatAvoidanceResolved', targetId: 'e1', avoided: true }]) {
    assert.equal(coopTimelineRoute([{ type: 'cardPlayed', playerId: 'p1', sourcePlayerId: 'p1', sourceId: 'player', cardType: 'attack', cardId: 'strike' }, outcome], ['p1']), 'player', outcome.type);
  }
  // An enemy's attack card is not a seat's; a seat's skill still renders plainly.
  assert.equal(coopTimelineRoute([{ type: 'cardPlayed', playerId: 'p1', cardType: 'skill' }], ['p1']), null);
  // Real session: the digest's cardPlayed names its cardType, so the swing routes on it
  // alone once the hit receipts are gone (as when the target avoids it outright).
  const host = createSession({ registries, seedString: 'ATTACKORDER' });
  host.addMember({ id: 'p1', name: 'One', classId: 'reaver' });
  host.addMember({ id: 'p2', name: 'Two', classId: 'rogue' });
  host.start();
  for (const member of host.session.members.values()) {
    while (member.run.classMasteryState?.initialTreeTiers.length) {
      const choices = initialClassTreeChoices(registriesForClassMastery(registries, member.run), member.run);
      assert.equal(host.chooseMasteryNode(member.id, choices[0]).ok, true);
    }
  }
  for (const id of ['p1', 'p2']) assert.equal(host.chooseNode(id, host.session.mapGraph.startIds[0]).ok, true);
  const board = host.snapshot().scene;
  const target = host.live.combat.enemies.find(enemy => enemy.alive);
  const attack = board.players.find(player => player.id === 'p1').hand.find(card => registries.cards.get(card.cardId)?.type === 'attack');
  assert.equal(host.combatPlay('p1', attack.instanceId, target.id).ok, true);
  const events = host.snapshot().scene.events;
  assert.equal(events.find(event => event.type === 'cardPlayed')?.cardType, 'attack', 'the digest projects cardType');
  const avoided = events.filter(event => !['damageDealt', 'impactDealt', 'hpLost'].includes(event.type)).concat({ type: 'attackEvaded', targetId: target.id, charges: 0 });
  assert.equal(coopTimelineRoute(avoided, ['p1', 'p2']), 'player', avoided.map(event => event.type).join(' '));
});

test('a paced attack still buzzes its card play once, for a local seat only, and the final render adds none', () => {
  const felt = (fn) => { const before = haptic.sink; const ids = []; haptic.sink = id => ids.push(id); try { fn(); } finally { haptic.sink = before; } return ids; };
  const events = [{ type: 'cardPlayed', playerId: 'p1', cardType: 'attack' }, { type: 'damageDealt', sourcePlayerId: 'p1', targetId: 'e1', amount: 5, isAttack: true }];
  assert.deepEqual(felt(() => coopCardPlayBuzz(events, ['p1'])), ['cardPlay'], 'the local seat feels its card');
  assert.deepEqual(felt(() => coopCardPlayBuzz(events, ['p2'])), [], 'a teammate card does not buzz this screen');
  // After the paced run marks lastSoundSeq, the final render (and a fight's
  // reward scene carrying the same receipts) buzzes nothing more.
  const scene = { kind: 'combat', receiptSeq: 5, events };
  assert.deepEqual(felt(() => coopReceiptSounds(scene, 5, ['p1'])), []);
  assert.deepEqual(felt(() => coopReceiptSounds({ kind: 'reward', combatReceipts: { receiptSeq: 5, events } }, 5, ['p1'])), []);
  // Wiring: once per new receipt batch, before the timeline marks lastSoundSeq.
  const timeline = body('playPacedReceipts');
  const buzz = timeline.indexOf('if ((Number(next.scene.receiptSeq) || 0) > lastSoundSeq) coopCardPlayBuzz(next.scene.events, seats);');
  assert.ok(buzz > 0 && buzz < timeline.indexOf('playTimeline(events,'), 'at the start of the paced run');
  assert.ok(buzz < timeline.indexOf('lastSoundSeq = Math.max'), 'before lastSoundSeq is marked');
});

test("the paced path scopes the timeline's haptics to this screen's seats, as coopReceiptSounds does", () => {
  assert.match(body('playPacedReceipts'), /playTimeline\(events, \{[\s\S]{0,300}isLocalPlayer: coopLocalSeat\(seats\),/);
  assert.match(coop, /const isLocalPlayer = coopLocalSeat\(localSeats\);/);
});
