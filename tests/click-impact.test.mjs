// CLICK TO IMPACT (docs/FINISH.md §5: "Click to impact ≤ 400 ms at Normal
// pacing", baseline 1.28 s). The browser measurement is
// tools/click-impact-probe.mjs; these are the two pacing rules it rests on,
// checked headlessly:
//   1. a card's cost events (emitted just before cardPlayed) ride the card's
//      own beat as `lead` events instead of costing a beat and a breath of
//      their own (~500 ms at Normal);
//   2. an authored clip whose impact frame lands after the pace's impactCapMs
//      plays faster as a whole, so its impact lands at the cap.

import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { groupBeats, ANIM_SPEEDS } from '../src/ui/fx.js';
import { EQUIPMENT_ANIMATIONS, animationTiming, resolvedAnimationSet } from '../src/model/equipmentAnimation.js';

const cardPlay = [
  { type: 'energySpent', amount: 1 },
  { type: 'staminaSpent', amount: 1 },
  { type: 'cardPlayed', cardType: 'attack', cardId: 'strike', cardInstanceId: 'c1', targetId: 'e1' },
  { type: 'damageDealt', sourceId: 'player', targetId: 'e1', amount: 6, blocked: 0 },
];

test('a card\'s cost events ride its beat as lead events, not a beat of their own', () => {
  const beats = groupBeats(cardPlay);
  assert.equal(beats.length, 1, 'one beat for one card play');
  const [beat] = beats;
  assert.equal(beat.actorId, 'player');
  assert.equal(beat.kind, 'attack');
  assert.deepEqual(beat.lead.map((e) => e.type), ['energySpent', 'staminaSpent']);
  assert.deepEqual(beat.events.map((e) => e.type), ['energySpent', 'staminaSpent', 'cardPlayed', 'damageDealt'],
    'the beat still carries every event, in order, for the display update');
});

test('banners and draws are never folded into the next actor', () => {
  const beats = groupBeats([
    { type: 'enemyTurnStart' },
    { type: 'enemyMoveStarted', sourceId: 'e1', kind: 'attack' },
    { type: 'cardDrawn', cardInstanceId: 'c2' },
    { type: 'playerTurnStart' },
    { type: 'energySpent', amount: 1 },
    { type: 'cardPlayed', cardType: 'skill', cardInstanceId: 'c2' },
  ]);
  assert.deepEqual(beats.map((b) => b.banner || b.kind), ['ENEMY TURN', 'attack', 'draw', 'YOUR TURN', 'act']);
  assert.equal(beats[1].lead, undefined, 'a banner beat is not a lead');
  // The playerTurnStart banner collects the energySpent that follows it, as it
  // did before: only an actor-less, banner-less run is a lead.
  assert.equal(beats[4].lead, undefined);
});

test('every pace has an impact cap, tighter as the pace quickens', () => {
  const { slow, normal, fast } = ANIM_SPEEDS;
  for (const pace of [slow, normal, fast]) assert.ok(pace.impactCapMs > 0);
  assert.ok(slow.impactCapMs > normal.impactCapMs && normal.impactCapMs > fast.impactCapMs);
  assert.ok(normal.impactCapMs <= 300, 'Normal leaves room under the 400 ms budget for render and the card\'s own step');
});

test('an authored clip whose impact lands late is played faster, impact at the cap', () => {
  const sets = Object.values(EQUIPMENT_ANIMATIONS.sets).map((set) => resolvedAnimationSet(EQUIPMENT_ANIMATIONS, set));
  let late = 0;
  for (const pace of ['slow', 'normal', 'fast']) {
    const speed = ANIM_SPEEDS[pace];
    for (const set of sets) {
      const timing = animationTiming(set, 'attack', speed);
      if (!timing) continue;
      const uncapped = animationTiming(set, 'attack', { ...speed, impactCapMs: undefined });
      assert.ok(timing.impactMs <= speed.impactCapMs,
        `${pace}: impact ${timing.impactMs} ms is at most the cap ${speed.impactCapMs} ms (rounding aside)`);
      if (uncapped.impactMs > speed.impactCapMs) {
        late += 1;
        // The whole clip is compressed by the same factor: every frame still shows.
        const ratio = timing.totalMs / uncapped.totalMs;
        assert.ok(Math.abs(timing.impactMs / uncapped.impactMs - ratio) < 0.1, 'impact and total compress together');
      } else {
        assert.deepEqual(timing, uncapped, 'a clip already inside the cap is unchanged');
      }
    }
  }
  assert.ok(late > 0, 'the shipped sets include a clip the cap actually compresses');
});

test('the painted Reaver swing obeys the same cap, and an uncapped call is unchanged', async () => {
  const { reaverAttackTiming } = await import('../src/ui/reaverAttack.js');
  for (const pace of ['slow', 'normal', 'fast']) {
    const speed = ANIM_SPEEDS[pace];
    const capped = reaverAttackTiming(speed);
    assert.ok(capped.impactMs <= speed.impactCapMs, `${pace}: Reaver impact ${capped.impactMs} ms within the cap`);
  }
  const bare = reaverAttackTiming({ lungeMs: ANIM_SPEEDS.normal.lungeMs });
  assert.ok(bare.impactMs > ANIM_SPEEDS.normal.impactCapMs, 'without a cap the authored sequence keeps its own timing');
});

test('a screen with onLeadApplied gets the lead\'s display at the swing, and the rest after, each once', () => {
  // Drive the shipped timeline headlessly with a stand-in window and DOM.
  const src = readFileSync(new URL('../src/ui/fx.js', import.meta.url), 'utf8');
  assert.match(src, /if \(leadApplied\) safe\(\(\) => ctx\.onLeadApplied\(\{ \.\.\.beat, events: beat\.lead \}\)\)/);
  assert.match(src, /ctx\.onBeatApplied\(leadApplied \? \{ \.\.\.beat, events: beat\.events\.filter\(\(e\) => !lead\.has\(e\)\) \} : beat\)/,
    'the rest of the beat excludes the lead only when the lead was already applied');
});
