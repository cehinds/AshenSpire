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

test('the player being hurt has its own sound', () => {
  assert.deepEqual(played(() => playHitSound(hit(5, { sourceId: 'e1', targetId: 'player' }))), ['playerHurt']);
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

// ---- the opening turn and the real co-op path (review of #1472) ----------

import { readFileSync } from 'node:fs';
import { playEventCues, animateEvents } from '../src/ui/fx.js';
// Replay the historical host loadouts; this retains current combat/sound rules.
import { legacyContentBundle } from './helpers/legacy-progression-content.mjs';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';

const src = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('instant playback cues beat by beat, as paced playback does', () => {
  // An enemy turn that refills the hand, then the player's turn starts and a
  // later draw lands in its own beat: two draw beats, two draw sounds.
  const events = [
    { type: 'cardDiscarded', reason: 'turnEnd' },
    { type: 'enemyTurnStart' },
    { type: 'enemyMoveStarted', sourceId: 'e1', kind: 'attack' },
    { type: 'cardDrawn' }, { type: 'cardDrawn' },
    { type: 'playerTurnStart' },
    { type: 'cardPlayed', cardType: 'skill' },
    { type: 'cardDrawn' },
  ];
  const cues = played(() => playEventCues(events));
  assert.deepEqual(cues, ['cardDiscard', 'cardDraw', 'turnStinger', 'cardDraw']);
  assert.match(src('src/ui/fx.js'), /export function animateEvents[\s\S]{0,700}const beats = groupBeats\(events\);[\s\S]{0,400}playBeatCues\(beats\[cued\+\+\]\.events[,)]/,
    'animateEvents (instant / reduced motion) cues the same beats the paced timeline does');
});

test('a fresh fight sounds its opening draw and turn stinger; a restored one replays nothing', () => {
  const combatSrc = src('src/ui/screens/combat.js');
  assert.match(combatSrc, /if \(opening\) playEventCues\(combat\.eventLog\);/, 'mountCombat sounds the setup only when told the fight is fresh');
  assert.match(combatSrc, /opening = false \}\) \{/, 'a caller that says nothing (a restore, a preview) replays no history');
  assert.match(src('src/main.js'), /opening: !savedSnapshot && !bossIntro,/, 'enterCombat marks only a newly created fight as an opening (a boss splash defers it)');
  // What that call hears for a real fresh solo fight's setup log.
  const reg = createRegistries(legacyContentBundle);
  const run = createRunState({ registries: reg, seed: 1, classId: 'reaver' });
  const combat = createRunCombat({ registries: reg, rng: createRng(1), run, enemyIds: ['wanderingSoldier'] });
  const cues = played(() => playEventCues(combat.eventLog));
  assert.ok(cues.includes('cardDraw'), `the opening draw sounds (${cues})`);
  assert.ok(cues.includes('turnStinger'), `the first turn stings (${cues})`);
  assert.equal(cues.filter((id) => id === 'turnStinger').length, 1, 'once');
});

test('instant playback keeps cue order: the enemy hit lands before "your turn" stings', async () => {
  const restore = {};
  for (const k of ['addEventListener', 'removeEventListener']) { restore[k] = globalThis[k]; globalThis[k] ??= () => {}; }
  try {
    const events = [
      { type: 'cardDiscarded', reason: 'turnEnd' },
      { type: 'enemyTurnStart' },
      { type: 'enemyMoveStarted', sourceId: 'e1', kind: 'attack' },
      { type: 'damageDealt', sourceId: 'e1', targetId: 'player', amount: 7, blocked: 0 },
      { type: 'cardDrawn' }, { type: 'cardDrawn' },
      { type: 'playerTurnStart' },
    ];
    sfx.sink = null; sfx.recent.length = 0;
    await new Promise((resolve) => animateEvents(events, { layer: null, combatEl: null, anchorFor: () => null }, resolve));
    const order = sfx.recent.filter((id) => ['cardDiscard', 'playerHurt', 'cardDraw', 'turnStinger'].includes(id));
    assert.deepEqual(order, ['cardDiscard', 'playerHurt', 'cardDraw', 'turnStinger']);
  } finally {
    for (const k of Object.keys(restore)) if (restore[k] === undefined) delete globalThis[k];
  }
});

// ---- follow-ups to #1472's last review (Codex P2 threads) ------------------

test('a fresh boss fight holds its opening cues until the name splash closes', () => {
  const main = src('src/main.js');
  assert.match(main, /opening: !savedSnapshot && !bossIntro,/, 'mountCombat does not sound the opening under the boss splash');
  assert.match(main, /onClose: !savedSnapshot \? \(\) => playEventCues\(openingLog\) : null/, 'the splash sounds the opening when it closes');
  const intro = src('src/ui/components/intro.js');
  assert.match(intro, /onClose = null/, 'showBossIntro takes an onClose');
});

test('the boss splash runs onClose exactly once, whichever way it closes', async (t) => {
  const { withKitDom } = await import('./helpers/kit-dom.mjs');
  const { showBossIntro } = await import('../src/ui/components/intro.js');
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const ways = {
    timer: () => t.mock.timers.tick(2300),
    click: (veil) => veil.dispatchEvent(new globalThis.Event('pointerdown')),
    key: (veil, win) => win.press('Escape'),
  };
  for (const [name, closeIt] of Object.entries(ways)) {
    withKitDom((dom, win) => {
      let ran = 0;
      const veil = showBossIntro({ name: 'Rot Valkyrie', act: 3 }, { onClose: () => { ran += 1; } });
      closeIt(veil, win);
      assert.equal(ran, 1, `${name}: onClose ran once`);
      // Every other way, after the first, is a no-op.
      for (const other of Object.values(ways)) other(veil, win);
      t.mock.timers.tick(2300);
      assert.equal(ran, 1, `${name}: a later timer, click or key does not run onClose again`);
    });
  }
  // Screenshot mode freezes the card and never closes it, so onClose never runs.
  withKitDom(() => {
    let ran = 0;
    showBossIntro({ name: 'Rot Valkyrie', act: 3 }, { hold: true, onClose: () => { ran += 1; } });
    t.mock.timers.tick(5000);
    assert.equal(ran, 0, 'hold mode does not run onClose');
  });
});
