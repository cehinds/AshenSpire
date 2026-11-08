// ON-CHARACTER CALLOUTS (owner, 2026-10-11; ui/fx.js callout). A short word —
// STAGGERED, COUNTERED, EVADED, CRITICAL, GUARD BREAK — rises from above the
// fighter it happened to. Since 2026-11-05 a word joins that fighter's one floater column: it spawns
// floaterStaggerMs after the floater before it, at most floaterMaxVisible show at once, and a click-skip ends them.

import test from 'node:test';
import { selectedWeaponReactionFor, REAVER_GREATSWORD_PILOT } from '../src/model/selectedWeaponStances.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { callout, clearCallouts, CALLOUT_KINDS, playTimeline, setAnimSpeed, setBeatOrder, ANIM_SPEEDS, calloutForEvent } from '../src/ui/fx.js';
import { registerStage } from '../src/ui/services/PoseAnimator.js';
import { t } from '../src/ui/strings.js';
import { flushMeasureJobs } from '../src/ui/frameMeasure.js';
import { withKitDom } from './helpers/dom.mjs';
import { setCombatPacing as pinCombatPacing, calloutLifeMs, floaterStaggerMs } from '../src/ui/animationPace.js';
import { setFloaterPolicyEnabled } from '../src/ui/models/FloaterPolicyModel.js';
setFloaterPolicyEnabled(false); // this file tests the floater mechanics for every kind; the allowlist is tests/floater-policy.test.mjs
pinCombatPacing({ combatSpeed: 1 }); // these timings are authored at x1; the shipped default is x1.25 (owner, 2026-10-26)

const callouts = (layer) => layer.children.filter((node) => node.dataset?.calloutFor !== undefined);

test('every callout kind has a localized word', () => {
  for (const [kind, def] of Object.entries(CALLOUT_KINDS)) {
    assert.match(t(def.string), /^[A-Za-z —]+$/, `${kind} is a localized outcome phrase`);
  }
  assert.equal(t(CALLOUT_KINDS.guardBreak.string), 'GUARD BREAK');
  assert.equal(t(CALLOUT_KINDS.hit.string), 'Hit');
  assert.equal(t(CALLOUT_KINDS.evadeFailed.string), 'Hit — Evade Failed');
  assert.equal(t(CALLOUT_KINDS.missed.string), 'Missed');
});

// A live anchor: a waiting floater for a detached anchor is dropped (fx.js), as it is for a combatant that left.
function liveNode(dom, tag = 'div') {
  const node = dom.document.createElement(tag);
  node.box = { left: 100, top: 300, width: 80, height: 120 }; // room above the head for the whole column
  dom.document.body.append(node);
  return node;
}
// The mocked clock jumps to the end of a tick before its timers run, so a wait is taken one ms at a time.
const drain = (t2, ms) => { for (let left = ms; left > 0; left -= 1) t2.mock.timers.tick(1); };

test('a callout names its fighter, joins the fighter\'s column one stagger behind the floater before it, and skips a repeat', (t2) => {
  t2.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  withKitDom((dom) => {
    const layer = liveNode(dom); layer.box = { left: 0, top: 0, width: 600, height: 700 };
    const anchor = liveNode(dom);
    const first = callout(layer, anchor, 'e1', 'staggered');
    assert.equal(first.textContent, 'STAGGERED');
    assert.equal(first.dataset.calloutFor, 'e1');
    assert.match(first.className, /\bfx-callout\b.*\bgold\b/);
    assert.equal(callout(layer, anchor, 'e1', 'staggered'), null, 'the same word is not repeated on one fighter');
    const second = callout(layer, anchor, 'e1', 'critical');
    assert.match(second.className, /\bred\b/);
    const other = callout(layer, liveNode(dom), 'player', 'evaded');
    const third = callout(layer, anchor, 'e1', 'guardBreak');
    const fourth = callout(layer, anchor, 'e1', 'countered');
    assert.deepEqual(callouts(layer), [first, other], 'one word per fighter shows at once; another fighter has its own column');
    flushMeasureJobs();
    assert.equal(first.dataset.floatSlot, '0');
    // At the owner's 750 ms interval a word outlives one stagger but not three, so each queued word is checked as it joins.
    for (const word of [second, third, fourth]) {
      drain(t2, floaterStaggerMs());
      flushMeasureJobs();
      assert.ok(callouts(layer).includes(word), 'nothing is dropped: each queued word joins the column in turn');
      assert.equal(word.dataset.floatSlot, '0', 'the newest word sits at the bottom of the column');
    }
    clearCallouts(layer);
    assert.equal(callouts(layer).length, 0, 'a skip ends the visible words and the queue');
  });
});

test('instant speed: the words keep the 500ms lifetime callout() picked and a short stagger', (t2) => {
  t2.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  try {
    withKitDom((dom) => {
      setAnimSpeed('instant');
      const layer = liveNode(dom); layer.box = { left: 0, top: 0, width: 600, height: 700 };
      const anchor = liveNode(dom);
      const stagger = floaterStaggerMs();
      assert.ok(stagger > 0 && stagger < 320, 'Instant shortens the stagger with the life');
      const kinds = ['staggered', 'disrupted', 'countered'];
      const nodes = kinds.map((kind) => callout(layer, anchor, 'e1', kind));
      const spawned = [];
      const append = layer.appendChild.bind(layer);
      layer.appendChild = (node) => { spawned.push(Date.now()); return append(node); };
      drain(t2, stagger * 2);
      assert.deepEqual(spawned, [stagger, stagger * 2], 'the later words follow one stagger apart');
      assert.ok(layer.children.includes(nodes[0]), 'the first word is still up before its 500ms life ends');
      drain(t2, 500 - stagger * 2 - 1);
      assert.ok(layer.children.includes(nodes[0]), 'still up at 499ms');
      drain(t2, 1);
      assert.ok(!layer.children.includes(nodes[0]), 'removed at its 500ms lifetime');
      assert.ok(layer.children.includes(nodes[1]), 'the second spawned later, so it outlives the first');
    });
  } finally {
    setAnimSpeed('normal');
  }
});

test('callout CSS: the one floater size, HUD text shadow, reduced motion and Reduce flashes', () => {
  const css = readFileSync(new URL('../styles/combat.css', import.meta.url), 'utf8');
  assert.match(css, /\.fx-callout \{[^}]*text-shadow: var\(--hud-text-shadow/s);
  const size = (sel) => css.match(new RegExp(`(?:^|\\n)${sel} \\{[^}]*?font-size: ([^;]+);`))?.[1];
  assert.equal(size('\\.fx-callout'), size('\\.float-num'), 'a word is the same size as a number (owner, 2026-11-05)');
  assert.equal(size('\\.fx-callout'), 'var(--floater-font, 2.8rem)');
  assert.match(css, /\.reduced-motion \.fx-callout \{ animation: callout-fade/, 'reduced motion: in place, no rise');
  assert.match(css, /\.reduce-flashes \.fx-callout \{ animation: callout-rise var\(--fx-callout-ms, 900ms\) ease-out forwards; \}/, 'reduce flashes: no glow pulse');
});

// ---- through the shipped timeline (the beat-order harness) ----------------
const IMPACT = 100, TOTAL = 300, LEAD = 1000, AFTER = 500, REACTION = 500;
// LEAD: intent word, one 500 ms gap, stance, one more gap, then the swing (owner, 2026-11-06).
// Accuracy follows the complete swing; target reaction follows accuracy; the
// final defense/effect word and number follow that reaction. Default gaps are
// 500ms; the authored 300ms sprite duration remains independent.
function drive(t2, fn) {
  t2.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  // The scheduler's monotonic clock must advance with these mocked timers.
  t2.mock.method(globalThis.performance, 'now', () => Date.now());
  withKitDom((dom) => {
    const trace = [];
    const at = (what) => trace.push({ what, at: Date.now() });
    const el = (id) => { const e = dom.document.createElement('div'); e.className = 'sprite'; e.id = id; return e; };
    const anchors = { player: el('player'), e1: el('e1'), seatB: el('seatB') };
    for (const [id, anchor] of Object.entries(anchors)) {
      registerStage(anchor, { play: (pose) => { if (pose !== 'defeated') at(`reaction:${id}`); return true; }, hold() { return true; }, settle() {} });
    }
    for (const anchor of Object.values(anchors)) dom.document.body.append(anchor);
    const layer = dom.document.createElement('div');
    dom.document.body.append(layer);
    const append = layer.appendChild.bind(layer);
    layer.appendChild = (node) => {
      if (node.dataset?.calloutFor !== undefined) at(`callout:${node.dataset.calloutKind}@${node.dataset.calloutFor}`);
      if (/\bfloat-num\b/.test(String(node.className))) at(`float:${node.textContent}`);
      return append(node);
    };
    const ctx = {
      layer, combatEl: dom.document.createElement('div'),
      anchorFor: (id) => anchors[id] || null,
      animateActor: () => ({ impactMs: IMPACT, totalMs: TOTAL, hold() {}, cancel: () => at('settle') }),
      onBeatApplied: (beat) => { if (!beat.banner) at('bars'); },
      onFlush: () => at('bars'),
    };
    let completed = 0;
    const run = (events, extra = {}) => playTimeline(events, { ...ctx, ...extra }, () => completed++);
    // After the timeline, let the floaters still waiting in a column spawn (they outlive the beat).
    const finish = () => {
      for (let i = 0; i < 20000 && !completed; i++) t2.mock.timers.tick(1);
      assert.equal(completed, 1, 'the timeline completes');
      for (let i = 0; i < 4000; i++) t2.mock.timers.tick(1); // one ms at a time: the mocked Date jumps to the end of a tick
    };
    try { fn({ dom, layer, anchors, trace, run, finish, tick: (ms) => t2.mock.timers.tick(ms) }); }
    finally { setAnimSpeed('normal'); setBeatOrder('sequential'); dom.document.body.classList.remove('reduced-motion'); }
  });
}
const timeOf = (trace, what) => trace.find((e) => e.what === what)?.at;
const enemyAttack = (...events) => [{ type: 'enemyMoveStarted', sourceId: 'e1', kind: 'attack' }, ...events];
const playerAttack = (...events) => [{ type: 'cardPlayed', cardType: 'attack', cardId: 'strike', cardInstanceId: 'c1', targetId: 'e1' }, ...events];
const hit = (sourceId, targetId, amount = 4) => ({ type: 'damageDealt', sourceId, targetId, amount, blocked: 0 });

for (const mode of ['sequential', 'impact', 'instant', 'reduced']) test(`selected player receipt reactions execute once in ${mode} playback`, t2 => {
  drive(t2, ({dom, run, finish, trace}) => {
    if (mode === 'instant') setAnimSpeed('instant');
    if (mode === 'reduced') dom.document.body.classList.add('reduced-motion');
    const reactions=[];
    const events=enemyAttack(
      {type:'attackEvaded',targetId:'player'},
      {type:'combatAvoidanceResolved',targetId:'player',avoided:false,evade:{success:false}},
      {type:'combatAvoidanceResolved',targetId:'player',avoided:true,distance:{success:true}},
      {type:'combatGuardBroken',targetId:'player',poise:0},
      {type:'combatGuardBroken',targetId:'e1',poise:0});
    run(events,{beatOrder:mode==='impact'?'impact':'sequential',reactionForReceipt:event=>{
      const kind=selectedWeaponReactionFor(event,REAVER_GREATSWORD_PILOT);
      return kind?()=>reactions.push({kind,targetId:event.targetId,at:Date.now()}):null;
    }});
    finish();
    assert.deepEqual(reactions.map(({kind,targetId})=>({kind,targetId})),[
      {kind:'evade',targetId:'player'},{kind:'guard-break',targetId:'player'}]);
    if(mode==='sequential')assert.ok(reactions.every(reaction=>reaction.at>=TOTAL),'defender reactions follow the complete swing');
    if (mode === 'sequential') {
      assert.ok(trace.some(entry=>entry.what==='callout:missed@player'),'accuracy remains visible before the selected reaction');
      assert.ok(trace.some(entry=>entry.what==='callout:dodged@player'),'the successful dodge outcome remains visible afterward');
    } else assert.ok(trace.some(entry=>entry.what==='callout:evaded@player'),'the existing fast/impact successful callout remains');
  });
});

test('an unsupported receipt reaction hook preserves callout-only pacing',t2=>{
  drive(t2,({trace,run,finish})=>{
    // A callout-only event: a miss now has its own streak and swish, so it no longer serves here.
    run(enemyAttack({type:'combatCounterTriggered',sourceId:'e1',targetId:'player'}),{reactionForReceipt:()=>null});finish();
    assert.equal(timeOf(trace,'bars'),LEAD + TOTAL + AFTER + 2 * REACTION,'ordered callout-only actions retain the shared action delays');
  });
});

const CASES = [
  ['CRITICAL on the target, with its hurt pose', enemyAttack({ type: 'critHit', sourceId: 'e1', targetId: 'player', multiplier: 2 }, hit('e1', 'player')), 'critical@player', 'hit@player'],
  ['Dodged on the evader (attackEvaded)', enemyAttack({ type: 'attackEvaded', sourceId: 'e1', targetId: 'player', charges: 0 }), 'dodged@player', 'missed@player'],
  ['Dodged on the evader (combatAvoidanceResolved)', enemyAttack({ type: 'combatAvoidanceResolved', sourceId: 'e1', targetId: 'player', avoided: true, evade: { success: true } }), 'dodged@player', 'missed@player'],
  ['GUARD BREAK on the target', playerAttack(hit('player', 'e1'), { type: 'combatGuardBroken', sourceId: 'player', targetId: 'e1', poise: 2 }), 'guardBreak@e1', 'hit@e1'],
  ['STAGGERED on an enemy', playerAttack(hit('player', 'e1'), { type: 'enemyStaggered', targetId: 'e1', enemyId: 'x' }), 'staggered@e1', 'hit@e1'],
  ['STAGGERED on the player', enemyAttack(hit('e1', 'player'), { type: 'playerStaggered', targetId: 'player', actionLoss: 1 }), 'staggered@player', 'hit@player'],
  ['STAGGERED on a co-op seat', enemyAttack(hit('e1', 'seatB'), { type: 'playerStaggered', targetId: 'seatB', actionLoss: 1 }), 'staggered@seatB', 'hit@seatB'],
  ['STAGGERED from a Poise break (ratingImpact)', playerAttack(hit('player', 'e1'), { type: 'ratingImpact', targetId: 'e1', meter: 'poise', amount: 5, breaks: 1, label: 'Stagger' }), 'staggered@e1', 'hit@e1'],
];

for (const [name, events, want, accuracy] of CASES) {
  test(`sequential: ${name}, after the target reaction`, (t2) => {
    drive(t2, ({ trace, run, finish }) => {
      run(events);
      finish();
      const shown = trace.filter((e) => e.what.startsWith('callout:') && !e.what.startsWith('callout:action:'));
      assert.deepEqual(shown.map((e) => e.what), [`callout:${accuracy}`, `callout:${want}`], 'accuracy then one final outcome, both on the right fighter');
      assert.equal(shown[0].at, LEAD + TOTAL + AFTER, 'accuracy follows the complete attacker sprite');
      // Owner 2026-11-06: the damage number leads the numbers stage; the outcome word queues behind it in the column.
      assert.ok(shown[1].at >= LEAD + TOTAL + AFTER + 2 * REACTION, 'the final outcome follows the target reaction');
    });
  });
}

test('sequential: Hit precedes the hurt pose, then CRITICAL accompanies the damage', (t2) => {
  drive(t2, ({ trace, run, finish }) => {
    run(CASES[0][1]);
    finish();
    assert.equal(timeOf(trace, 'callout:hit@player'), LEAD + TOTAL + AFTER);
    assert.equal(timeOf(trace, 'reaction:player'), LEAD + TOTAL + AFTER + REACTION, 'the sprite reaction follows the accuracy word by a gap');
    assert.ok(timeOf(trace, 'callout:critical@player') > timeOf(trace, 'float:-4'), 'critical is the final outcome, after the hurt pose and the damage number');
    assert.equal(timeOf(trace, 'float:-4'), LEAD + TOTAL + AFTER + 2 * REACTION, 'the number waits a gap after the reaction; a damage number never waits behind the column');
  });
});

test('a failed avoidance roll and an unbroken rating say nothing', () => {
  assert.equal(calloutForEvent({ type: 'combatAvoidanceResolved', targetId: 'player', avoided: false, evade: { success: false } }), null);
  assert.equal(calloutForEvent({ type: 'ratingImpact', targetId: 'e1', breaks: 0, label: 'Stagger' }), null);
  assert.deepEqual(calloutForEvent({ type: 'ratingImpact', targetId: 'e1', breaks: 1, label: 'Disruption' }), { kind: 'disrupted', targetId: 'e1' });
  // A distance roll or a prevention charge that stops a hit is a miss too, over the fighter it missed.
  assert.deepEqual(calloutForEvent({ type: 'combatAvoidanceResolved', sourceId: 'e1', targetId: 'player', avoided: true, distance: { roll: 4, chance: 30, success: true } }), { kind: 'evaded', targetId: 'player' });
  assert.deepEqual(calloutForEvent({ type: 'combatAvoidanceResolved', sourceId: 'e1', targetId: 'player', avoided: true, prevention: 'decoy' }), { kind: 'evaded', targetId: 'player' });
  // Each break earns its own word over the fighter it broke; an enemy's cancelled action reads INTERRUPTED.
  assert.deepEqual(calloutForEvent({ type: 'blockBroken', targetId: 'player' }), { kind: 'blockBreak', targetId: 'player' });
  // A Smash that breaks the last Block shows GUARD BREAK alone: its blockBroken earns no BREAK word.
  assert.equal(calloutForEvent({ type: 'blockBroken', targetId: 'e1', smash: true }), null);
  assert.deepEqual(calloutForEvent({ type: 'combatGuardBroken', targetId: 'e1', poise: 0 }), { kind: 'guardBreak', targetId: 'e1' });
  assert.deepEqual(calloutForEvent({ type: 'wardBroken', targetId: 'e1', staminaLoss: 0 }), { kind: 'wardBreak', targetId: 'e1' });
  assert.deepEqual(calloutForEvent({ type: 'poiseBroken', targetId: 'e1', interrupted: true, staminaLoss: 1 }), { kind: 'poiseBreak', targetId: 'e1' });
  assert.deepEqual(calloutForEvent({ type: 'enemyInterrupted', targetId: 'e1', cancelledMove: 'slam', cause: 'poiseBreak' }), { kind: 'interrupted', targetId: 'e1' });
  // A stagger a break caused shows no second word: the break's word and INTERRUPTED carry it.
  assert.equal(calloutForEvent({ type: 'enemyStaggered', targetId: 'e1', cause: 'poiseBreak' }), null);
  assert.deepEqual(calloutForEvent({ type: 'enemyStaggered', targetId: 'e1' }), { kind: 'staggered', targetId: 'e1' });
  assert.equal(CALLOUT_KINDS.interrupted.string, 'combat.callout.interrupted');
  assert.equal(CALLOUT_KINDS.barrierBreak.tone, 'barrier');
});

test('COUNTERED shows on the attacker who got countered, after the counter\'s sprite', (t2) => {
  drive(t2, ({ trace, run, finish }) => {
    run([{ type: 'combatCounterTriggered', sourceId: 'player', sourceKind: 'player', targetId: 'e1', amount: 3 }, hit('player', 'e1', 3)]);
    finish();
    assert.equal(timeOf(trace, 'callout:hit@e1'), LEAD + TOTAL + AFTER, 'the counter hit is announced before target reaction');
    assert.equal(timeOf(trace, 'reaction:e1'), LEAD + TOTAL + AFTER + REACTION);
    assert.ok(timeOf(trace, 'callout:countered@e1') >= LEAD + TOTAL + AFTER + 2 * REACTION, 'counter outcome follows the target reaction');
    assert.equal(timeOf(trace, 'float:-3'), LEAD + TOTAL + AFTER + 2 * REACTION, 'the counter damage follows its reaction by a gap');
  });
});

test('impact order: the callout fires at impact', (t2) => {
  drive(t2, ({ trace, run, finish }) => {
    run(CASES[0][1], { beatOrder: 'impact' });
    finish();
    assert.equal(timeOf(trace, 'callout:critical@player'), IMPACT);
  });
});

for (const mode of ['instant', 'reduced-motion']) {
  test(`${mode}: callouts still appear and add no waits`, (t2) => {
    drive(t2, ({ dom, trace, run, finish }) => {
      if (mode === 'instant') setAnimSpeed('instant');
      else dom.document.body.classList.add('reduced-motion');
      run(CASES[0][1]);
      finish();
      assert.ok(trace.some((e) => e.what === 'callout:critical@player'));
      // The accuracy word spawns first; CRITICAL is the next word, one stagger later. The damage number never waits.
      assert.equal(timeOf(trace, 'callout:critical@player') - timeOf(trace, 'callout:hit@player'), floaterStaggerMs());
      assert.ok(timeOf(trace, 'float:-4') <= 80, 'the number comes with the fast path\'s own step');
      assert.ok(trace.filter((e) => !e.what.startsWith('callout:')).every((e) => e.at <= 80), 'nothing but a queued word waits past the fast path\'s own step');
      assert.ok(trace.every((e) => e.at <= 80 + 2 * floaterStaggerMs()), 'a queued word appears within the fast path\'s step plus two staggers');
    });
  });
}

test('the STAGGERED word is on the fighter now, not a screen banner', (t2) => {
  drive(t2, ({ layer, run, finish }) => {
    run(CASES[4][1]);
    finish();
    assert.ok(!layer.children.some((node) => /\bfx-banner\b/.test(String(node.className))), 'no banner');
  });
});

test('a click-skip ends the callouts', (t2) => {
  drive(t2, ({ dom, layer, run, finish, tick }) => {
    run(CASES[0][1]);
    for (let i = 0; i <= LEAD + TOTAL + AFTER + 2 * REACTION + floaterStaggerMs(); i++) tick(1);
    assert.ok(callouts(layer).some(node => node.dataset.calloutKind === 'critical'), 'the CRITICAL callout is showing');
    globalThis.dispatchEvent(new dom.Event('pointerdown'));
    assert.equal(callouts(layer).length, 0, 'the skip removed it');
    globalThis.dispatchEvent(new dom.Event('pointerup'));
    finish();
  });
});

for (const mode of ['impact', 'sequential', 'instant', 'reduced']) test('accuracy outcome leads damage in ' + mode + ' playback', t2 => {
  drive(t2, ({ dom, trace, run, finish }) => {
    if (mode === 'instant') setAnimSpeed('instant');
    if (mode === 'reduced') dom.document.body.classList.add('reduced-motion');
    run(enemyAttack({ type: 'attackHit', sourceId: 'e1', targetId: 'player', evadeActive: true }, hit('e1', 'player')), { beatOrder: mode });
    finish();
    const outcome = timeOf(trace, mode === 'sequential' ? 'callout:hit@player' : 'callout:evadeFailed@player');
    const damage = timeOf(trace, 'float:-4');
    assert.ok(Number.isFinite(outcome) && Number.isFinite(damage), 'both production visuals execute');
    if (mode === 'impact') {
      assert.ok(damage - outcome >= 300, 'legacy impact retains its readable accuracy lead');
    } else if (mode === 'sequential') {
      assert.equal(timeOf(trace, 'reaction:player') - outcome, REACTION, 'accuracy precedes the target reaction');
      assert.equal(damage - outcome, 2 * REACTION, 'accuracy leads damage by two gaps (accuracy → reaction → result)');
      assert.ok(timeOf(trace, 'callout:evadeFailed@player') >= damage, 'failed defense is the final outcome, after the damage number');
    } else assert.ok(outcome - damage >= 0 && outcome - damage <= floaterStaggerMs(), 'instant and reduced motion add no waits for the number; the word may queue one stagger behind the accuracy word');
  });
});

test('accuracy wording follows stance entry and the first sequential swing', t2 => {
  drive(t2, ({ anchors, trace, run, finish }) => {
    const stage = { pose: 'hit', rest: 'idle', settle() { this.pose = this.rest; }, hold() {} };
    registerStage(anchors.e1, stage);
    run(enemyAttack({ type: 'attackHit', sourceId: 'e1', targetId: 'player' }, hit('e1', 'player')), {
      animateActor: () => {
        trace.push({ what: 'swing-start', at: Date.now() });
        return { impactMs: IMPACT, totalMs: TOTAL, hold() {}, cancel() {} };
      },
    });
    finish();
    const outcome = timeOf(trace, 'callout:hit@player');
    const damage = timeOf(trace, 'float:-4');
    assert.equal(outcome, LEAD + TOTAL + AFTER, 'the accuracy word follows the sprite');
    assert.equal(timeOf(trace, 'swing-start'), LEAD, 'intent and action wording precede the swing');
    assert.ok(damage - outcome >= 300, 'the hit-only hold remains readable');
    assert.equal(damage, outcome + 2 * REACTION, 'damage follows the result word by two gaps');
    assert.equal(trace.filter(e => e.what === 'callout:hit@player').length, 1, 'the accuracy word is shown once');
  });
});

test('committed damage without accuracy receipts still says Hit before its reaction and damage', t2 => {
  drive(t2, ({ trace, run, finish }) => {
    run(playerAttack(hit('player', 'e1'))); finish();
    assert.equal(timeOf(trace, 'callout:hit@e1'), LEAD + TOTAL + AFTER);
    assert.equal(timeOf(trace, 'float:-4'), LEAD + TOTAL + AFTER + 2 * REACTION);
  });
});

test('a fully guarded contact says Hit, then Blocked after the target reaction', t2 => {
  drive(t2, ({ anchors, trace, run, finish }) => {
    anchors.e1.classList.add('enemy'); // production enemy ancestry selects its guard-hit pose
    run(playerAttack({ ...hit('player', 'e1'), blocked: 4 })); finish();
    assert.equal(timeOf(trace, 'callout:hit@e1'), LEAD + TOTAL + AFTER);
    assert.equal(timeOf(trace, 'reaction:e1'), LEAD + TOTAL + AFTER + REACTION);
    assert.ok(timeOf(trace, 'callout:blocked@e1') >= LEAD + TOTAL + AFTER + 2 * REACTION);
    assert.ok(!trace.some(row => row.what === 'float:-4'), 'a fully absorbed contact paints no HP loss');
  });
});


test('callout life scales with Combat speed only: 1400 at x1, 700 at x2, floored at 700 beyond, Instant keeps 500', () => {
  try {
    setAnimSpeed('normal');
    pinCombatPacing({ combatSpeed: 1 });
    assert.equal(calloutLifeMs(), 1400);
    pinCombatPacing({ combatSpeed: 2 });
    assert.equal(calloutLifeMs(), 700);
    pinCombatPacing({ combatSpeed: 4 });
    assert.equal(calloutLifeMs(), 700, 'floors at 700 ms');
    setAnimSpeed('fast');
    pinCombatPacing({ combatSpeed: 1.25 });
    assert.equal(calloutLifeMs(), 1120, 'the Fast animation pace does not shrink the word');
    setAnimSpeed('instant');
    assert.equal(calloutLifeMs(), 500);
  } finally {
    setAnimSpeed('normal');
    pinCombatPacing({ combatSpeed: 1 });
  }
});

test('beat timing never reads calloutLifeMs: words outlive the beat, as floaters do', () => {
  const fx = readFileSync(new URL('../src/ui/fx.js', import.meta.url), 'utf8');
  const uses = fx.split('\n').filter((line) => line.includes('calloutLifeMs'));
  assert.ok(uses.length >= 3 && uses.length <= 6, 'calloutLifeMs feeds only the callout lifetime sites');
  const pace = readFileSync(new URL('../src/ui/animationPace.js', import.meta.url), 'utf8');
  const actionPacing = pace.slice(pace.indexOf('export function actionPacing'), pace.indexOf('export function reactionPlayMs'));
  assert.ok(!actionPacing.includes('calloutLifeMs') && !actionPacing.includes('calloutLife'), 'actionPacing (beat waits) does not read the callout life');
});
