// Strips follow range through the REAL playback path: engine dispatch -> groupBeats -> playTimeline (fx.js) -> runActionTimeline.
// A committed Advance steps in as contact begins; a retreat after the damage waits for the group's HUD apply.
import test from 'node:test';
import assert from 'node:assert/strict';
import { playTimeline, setAnimSpeed, setBeatOrder, groupBeats } from '../src/ui/fx.js';
import { registerStage } from '../src/ui/services/PoseAnimator.js';
import { withKitDom } from './helpers/dom.mjs';
import { setCombatPacing } from '../src/ui/animationPace.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { rangePairKey } from '../src/model/combatEngagement.js';
import { rangeRankSnapshot, applyRangeRankEvent, rangeRanksFromSnapshot, combatRangeRanks } from '../src/ui/models/CombatRangeRankModel.js';
setCombatPacing({ combatSpeed: 1 });

const profile = resolveGameProfile('core');
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const PAIR = rangePairKey('player:player', 'enemy:e1');

// Plays `cardId` (swapped into a strike's slot) from Reach and replays the receipts through the shipped timeline.
function scenario(t, { cardId = 'core.strike', weapon = null }, check) {
  const run = createRunState({ registries, classId: 'reaver', seed: 511 });
  if (weapon) { run.loadout.sets.rightHand[0] = weapon; run.loadout.sets.leftHand[0] = null; }
  const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  combat.player.hp = combat.player.maxHp = 10000; combat.player.energy = 9;
  combat.rangeState.engagements[PAIR] = 1;
  const card = combat.piles.hand.find(c => c.cardId === 'core.strike'); card.cardId = cardId;
  const snap = rangeRankSnapshot(combat);
  const { events } = dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: 'e1' });
  const rank = () => rangeRanksFromSnapshot(snap).get('player:player');
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  t.mock.method(globalThis.performance, 'now', () => Date.now());
  withKitDom(dom => {
    const marks = [];
    const el = id => { const e = dom.document.createElement('div'); e.className = 'sprite'; e.id = id; return e; };
    const anchors = { player: el('player'), e1: el('e1') };
    for (const anchor of Object.values(anchors)) registerStage(anchor, { play() { return true; }, hold() { return true; }, settle() {} });
    let completed = 0;
    playTimeline(events, {
      layer: dom.document.createElement('div'), combatEl: dom.document.createElement('div'), anchorFor: id => anchors[id] || null,
      animateActor: () => ({ impactMs: 100, totalMs: 300, hold() {}, contact: () => marks.push(['contact', rank()]), cancel() {} }),
      onEngagementMoved: moves => { for (const e of moves) applyRangeRankEvent(snap, e); marks.push(['stripsRefit', rank()]); },
      onBeatApplied: beat => { for (const e of beat.events) applyRangeRankEvent(snap, e); if (!beat.banner) marks.push(['apply', rank()]); },
      onFlush() {},
    }, () => completed++);
    for (let i = 0; i < 20000 && !completed; i++) t.mock.timers.tick(1);
    assert.equal(completed, 1);
    try { check({ events, marks, snap, combat, rank }); } finally { setAnimSpeed('normal'); setBeatOrder('sequential'); }
  });
}
const at = (marks, name) => marks.find(m => m[0] === name)?.[1];

test('plain strike from Reach: both fighters are front by contact', t => scenario(t, {}, ({ marks, combat }) => {
  assert.equal(at(marks, 'contact'), 'front');
  assert.deepEqual([...rangeRanksFromSnapshot(rangeRankSnapshot(combat))], [...combatRangeRanks(combat)]);
}));

test('shortbow strike from Reach: no engagement move, the strips never change', t => scenario(t, { weapon: 'shortbow' }, ({ events, marks }) => {
  assert.equal(events.some(e => e.type === 'combatEngagementMoved'), false);
  assert(marks.every(m => m[1] === 'back'));
}));

test('Hit and Run from Reach: front during contact, back once the group applies', t => scenario(t, { cardId: 'core.hitAndRun' }, ({ events, marks, rank, combat }) => {
  assert.deepEqual(events.filter(e => e.type === 'combatEngagementMoved').map(e => e.bands), [-1, 1]);
  assert.equal(at(marks, 'contact'), 'front');
  assert.equal(marks.findLast(m => m[0] === 'apply')[1], 'back');
  assert.equal(rank(), 'back');
  assert.equal(combat.rangeState.engagements[PAIR], 1);
}));

test('Driving Thrust from Reach: front by contact, and damage stays in the actor beat', t => scenario(t, { cardId: 'core.drivingThrust' }, ({ events, marks }) => {
  const beat = groupBeats(events).find(b => b.events.some(e => e.type === 'damageDealt'));
  assert.equal(beat.actorId, 'player', 'damage keeps its attached actor beat');
  assert(beat.events.some(e => e.type === 'combatEngagementMoved'), 'the push shares the attack beat');
  assert.equal(at(marks, 'contact'), 'front');
}));
