// HIT SOUND TIERS (docs/FINISH.md §5 "Hit sound tiers").
//
// Every fx event that has a sound of its own must reach a recipe row that is
// NOT the 440 Hz `default` blip: three damage tiers chosen by the size of the
// hit, a separate sound when the PLAYER is hurt, a stinger when the player's
// turn starts, and draw / shuffle / discard sounds for the piles. The tier
// thresholds are data (content/sfx.js SFX_HIT_TIERS, owner ruling D1), so the
// boundaries are read from the table, never restated here.
//
// The fx layer is driven through its exported sound seams (playHitSound,
// playBeatCues) with the sink unplugged; `sfx.recent` is the record of what
// would have reached the audio engine — the same sink that honours the
// mute and SFX-volume settings (ui/audio.js sfx()).

import test from 'node:test';
import assert from 'node:assert/strict';
import { SFX_RECIPES, SFX_HIT_TIERS, hitTierFor, resolveRecipe } from '../src/content/sfx.js';
import { sfx } from '../src/ui/sfx.js';
import { playHitSound, playBeatCues } from '../src/ui/fx.js';

const played = (fn) => {
  sfx.sink = null;
  sfx.recent.length = 0;
  fn();
  return [...sfx.recent];
};

const hit = (amount, extra = {}) => ({ type: 'damageDealt', sourceId: 'player', targetId: 'e1', amount, blocked: 0, ...extra });
const tierMin = (tier) => SFX_HIT_TIERS.find((row) => row.tier === tier).min;

test('the tier table has at least three tiers, ascending, each with its own recipe row', () => {
  assert.ok(SFX_HIT_TIERS.length >= 3, 'at least three damage tiers');
  for (let i = 1; i < SFX_HIT_TIERS.length; i++) {
    assert.ok(SFX_HIT_TIERS[i].min > SFX_HIT_TIERS[i - 1].min, `tier ${SFX_HIT_TIERS[i].tier} starts above ${SFX_HIT_TIERS[i - 1].tier}`);
  }
  for (const { tier } of SFX_HIT_TIERS) {
    const r = resolveRecipe(`hit_${tier}`);
    assert.equal(r.matched, `hit_${tier}`, `hit_${tier} has an exact row`);
  }
});

test('the thresholds pick the right tier at each boundary', () => {
  for (let i = 0; i < SFX_HIT_TIERS.length; i++) {
    const { tier, min } = SFX_HIT_TIERS[i];
    assert.equal(hitTierFor(min), tier, `${min} damage is ${tier}`);
    if (i > 0) assert.equal(hitTierFor(min - 1), SFX_HIT_TIERS[i - 1].tier, `${min - 1} damage is still ${SFX_HIT_TIERS[i - 1].tier}`);
  }
  assert.equal(hitTierFor(10_000), SFX_HIT_TIERS.at(-1).tier, 'a huge hit is the top tier');
  assert.equal(hitTierFor(1), SFX_HIT_TIERS[0].tier, 'one point of damage is the bottom tier');
  // The thresholds are data: a different table gives different answers.
  const tuned = [{ tier: 'light', min: 1 }, { tier: 'medium', min: 3 }, { tier: 'heavy', min: 5 }];
  assert.equal(hitTierFor(4, tuned), 'medium');
  assert.equal(hitTierFor(5, tuned), 'heavy');
});

test('a hit sounds its tier by the HP it actually took, not the guard it hit', () => {
  for (let i = 0; i < SFX_HIT_TIERS.length; i++) {
    const { tier, min } = SFX_HIT_TIERS[i];
    assert.deepEqual(played(() => playHitSound(hit(min))), [`hit_${tier}`], `a ${min}-damage hit`);
  }
  const heavy = tierMin('heavy');
  // Guard soaks all but the bottom tier's worth: the residual decides.
  assert.deepEqual(played(() => playHitSound(hit(heavy, { blocked: heavy - 1 }))), [`hit_${SFX_HIT_TIERS[0].tier}`]);
  assert.deepEqual(played(() => playHitSound(hit(heavy, { blocked: heavy }))), [], 'a fully guarded hit plays no hit sound (block owns it)');
});

test('the player being hurt has its own sound, solo and co-op', () => {
  assert.deepEqual(played(() => playHitSound(hit(5, { sourceId: 'e1', targetId: 'player' }))), ['playerHurt']);
  assert.deepEqual(played(() => playHitSound(hit(5, { sourceId: 'e1', targetId: 'seat2', targetPlayerId: 'p2', sourcePlayerId: null }))), ['playerHurt']);
  assert.deepEqual(played(() => playHitSound(hit(5, { targetPlayerId: null }))), [`hit_${hitTierFor(5)}`], 'an enemy target in co-op is a hit');
});

test('turn start, draw, shuffle and discard each cue once per beat', () => {
  assert.deepEqual(played(() => playBeatCues([{ type: 'playerTurnStart' }])), ['turnStinger']);
  assert.deepEqual(played(() => playBeatCues([{ type: 'enemyTurnStart' }])), [], 'the enemy turn has no stinger');
  assert.deepEqual(played(() => playBeatCues([
    { type: 'deckShuffled', size: 10 },
    { type: 'cardDrawn', cardInstanceId: 'a' },
    { type: 'cardDrawn', cardInstanceId: 'b' },
    { type: 'cardDrawn', cardInstanceId: 'c' },
  ])), ['deckShuffle', 'cardDraw'], 'a five-card refill is one draw sound, not five');
  assert.deepEqual(played(() => playBeatCues([
    { type: 'cardDiscarded', reason: 'turnEnd' },
    { type: 'cardDiscarded', reason: 'turnEnd' },
  ])), ['cardDiscard']);
  assert.deepEqual(played(() => playBeatCues([{ type: 'damageDealt', amount: 5 }])), []);
});

test('every one of those fx events maps to a distinct recipe that is not the default', () => {
  const ids = new Set();
  for (const { min } of SFX_HIT_TIERS) played(() => playHitSound(hit(min))).forEach((id) => ids.add(id));
  played(() => playHitSound(hit(5, { targetId: 'player' }))).forEach((id) => ids.add(id));
  played(() => playBeatCues([
    { type: 'playerTurnStart' }, { type: 'cardDrawn' }, { type: 'deckShuffled' }, { type: 'cardDiscarded' },
  ])).forEach((id) => ids.add(id));
  const expected = [...SFX_HIT_TIERS.map((row) => `hit_${row.tier}`), 'playerHurt', 'turnStinger', 'cardDraw', 'deckShuffle', 'cardDiscard'];
  assert.deepEqual([...ids].sort(), expected.sort());
  const bodies = new Set();
  for (const id of ids) {
    const r = resolveRecipe(id);
    assert.equal(r.fellBack, false, `${id} does not fall back`);
    assert.equal(r.matched, id, `${id} answers with its own row, not a family`);
    assert.notDeepEqual(r.recipe, SFX_RECIPES.default, `${id} is not the default blip`);
    bodies.add(JSON.stringify(r.recipe));
  }
  assert.equal(bodies.size, ids.size, 'no two of these events share one sound');
});
