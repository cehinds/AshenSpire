// ON-CHARACTER CALLOUTS (owner, 2026-10-11; ui/fx.js callout). A short word —
// STAGGERED, COUNTERED, EVADED, CRITICAL, GUARD BREAK — rises from above the
// fighter it happened to. Two on one fighter stack, at most two show at once,
// and a click-skip ends them.

import test from 'node:test';
import { selectedWeaponReactionFor, REAVER_GREATSWORD_PILOT } from '../src/model/selectedWeaponStances.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { callout, clearCallouts, CALLOUT_KINDS, playTimeline, setAnimSpeed, setBeatOrder, ANIM_SPEEDS, calloutForEvent } from '../src/ui/fx.js';
import { registerStage } from '../src/ui/services/PoseAnimator.js';
import { t } from '../src/ui/strings.js';
import { withKitDom } from './helpers/kit-dom.mjs';

const callouts = (layer) => layer.children.filter((node) => node.dataset?.calloutFor !== undefined);

test('every callout kind has a localized word', () => {
  for (const [kind, def] of Object.entries(CALLOUT_KINDS)) {
    assert.match(t(def.string), /^[A-Z ]+$/, `${kind} is a short uppercase word`);
  }
  assert.equal(t(CALLOUT_KINDS.guardBreak.string), 'GUARD BREAK');
});

test('a callout names its fighter, shows three in lanes, queues the rest, and skips a repeat', (t2) => {
  t2.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  withKitDom((dom) => {
    const layer = dom.document.createElement('div');
    const anchor = dom.document.createElement('div');
    const first = callout(layer, anchor, 'e1', 'staggered');
    assert.equal(first.textContent, 'STAGGERED');
    assert.equal(first.dataset.calloutFor, 'e1');
    assert.equal(first.dataset.calloutSlot, '2', 'lane 0 is the top slot');
    assert.match(first.className, /\bfx-callout\b.*\bgold\b/);
    assert.equal(callout(layer, anchor, 'e1', 'staggered'), null, 'the same word is not repeated on one fighter');
    const second = callout(layer, anchor, 'e1', 'critical');
    assert.equal(second.dataset.calloutSlot, '1', 'lane 1 sits under lane 0');
    assert.match(second.className, /\bred\b/);
    const other = callout(layer, anchor, 'player', 'evaded');
    assert.equal(other.dataset.calloutSlot, '2', 'another fighter has its own stack');
    const third = callout(layer, anchor, 'e1', 'guardBreak');
    assert.equal(third.dataset.calloutSlot, '0', 'lane 2 is the bottom slot');
    const fourth = callout(layer, anchor, 'e1', 'countered');
    const starts = [first, second, third].map((node) => Number.parseInt(node.style.animationDelay || '0', 10));
    assert.deepEqual(starts, [0, 150, 300], 'each word starts one step after the one before');
    const delayMs = Number.parseInt(fourth.style.animationDelay, 10);
    assert.ok(delayMs >= 890 && delayMs <= 900, 'the fourth waits for the earliest visible word to finish');
    assert.equal(callouts(layer).length, 5, 'nothing is dropped: the fourth is queued');
    clearCallouts(layer);
    assert.equal(callouts(layer).length, 0, 'a skip ends the visible words and the queue');
  });
});

test('instant speed: the lanes and removal use the 500ms lifetime callout() actually picked', (t2) => {
  t2.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  try {
    withKitDom((dom) => {
      setAnimSpeed('instant');
      const layer = dom.document.createElement('div');
      const anchor = dom.document.createElement('div');
      const kinds = ['staggered', 'disrupted', 'countered', 'critical', 'guardBreak', 'wardBreak'];
      const nodes = kinds.map((kind) => callout(layer, anchor, 'e1', kind));
      const starts = nodes.map((node) => Number.parseInt(node.style.animationDelay || '0', 10));
      assert.deepEqual(starts, [0, 150, 300, 500, 650, 800], 'the fourth word waits for the first 500ms word, not a 900ms one');
      t2.mock.timers.tick(499);
      assert.ok(layer.children.includes(nodes[0]), 'the first word is still up at 499ms');
      t2.mock.timers.tick(1);
      assert.ok(!layer.children.includes(nodes[0]), 'the first word is removed at its 500ms lifetime');
    });
  } finally {
    setAnimSpeed('normal');
  }
});

test('callout CSS: larger than a float, HUD text shadow, reduced motion and Reduce flashes', () => {
  const css = readFileSync(new URL('../styles/combat.css', import.meta.url), 'utf8');
  assert.match(css, /\.fx-callout \{[^}]*text-shadow: var\(--hud-text-shadow/s);
  const rem = (sel) => Number(css.match(new RegExp(`(?:^|\\n)${sel} \\{[^}]*?font-size: ([0-9.]+)rem`))?.[1]);
  const callout = rem('\\.fx-callout'), float = rem('\\.float-num');
  assert.ok(callout > float, `callout ${callout}rem must be larger than a damage float ${float}rem`);
  assert.match(css, /\.reduced-motion \.fx-callout \{ animation: callout-fade/, 'reduced motion: in place, no rise');
  assert.match(css, /\.reduce-flashes \.fx-callout \{ animation: callout-rise var\(--fx-callout-ms, 900ms\) ease-out forwards; \}/, 'reduce flashes: no glow pulse');
});

// ---- through the shipped timeline (the beat-order harness) ----------------
const IMPACT = 100, TOTAL = 300;
function drive(t2, fn) {
  t2.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  withKitDom((dom) => {
    const trace = [];
    const at = (what) => trace.push({ what, at: Date.now() });
    const el = (id) => { const e = dom.document.createElement('div'); e.className = 'sprite'; e.id = id; return e; };
    const anchors = { player: el('player'), e1: el('e1'), seatB: el('seatB') };
    for (const [id, anchor] of Object.entries(anchors)) {
      registerStage(anchor, { play: (pose) => { if (pose !== 'defeated') at(`reaction:${id}`); return true; }, hold() { return true; }, settle() {} });
    }
    const layer = dom.document.createElement('div');
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
    const finish = () => { for (let i = 0; i < 4000 && !completed; i++) t2.mock.timers.tick(1); assert.equal(completed, 1, 'the timeline completes'); };
    try { fn({ dom, layer, trace, run, finish, tick: (ms) => t2.mock.timers.tick(ms) }); }
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
    assert.ok(trace.some(entry=>entry.what==='callout:evaded@player'),'the existing successful callout remains');
  });
});

test('an unsupported receipt reaction hook preserves callout-only pacing',t2=>{
  drive(t2,({trace,run,finish})=>{
    // A callout-only event: a miss now has its own streak and swish, so it no longer serves here.
    run(enemyAttack({type:'combatCounterTriggered',sourceId:'e1',targetId:'player'}),{reactionForReceipt:()=>null});finish();
    assert.equal(timeOf(trace,'bars'),TOTAL,'no extra reaction wait when the fighter has no selected profile');
  });
});

const CASES = [
  ['CRITICAL on the target, with its hurt pose', enemyAttack({ type: 'critHit', sourceId: 'e1', targetId: 'player', multiplier: 2 }, hit('e1', 'player')), 'critical@player'],
  ['EVADED on the evader (attackEvaded)', enemyAttack({ type: 'attackEvaded', sourceId: 'e1', targetId: 'player', charges: 0 }), 'evaded@player'],
  ['EVADED on the evader (combatAvoidanceResolved)', enemyAttack({ type: 'combatAvoidanceResolved', sourceId: 'e1', targetId: 'player', avoided: true, evade: { success: true } }), 'evaded@player'],
  ['GUARD BREAK on the target', playerAttack(hit('player', 'e1'), { type: 'combatGuardBroken', sourceId: 'player', targetId: 'e1', poise: 2 }), 'guardBreak@e1'],
  ['STAGGERED on an enemy', playerAttack(hit('player', 'e1'), { type: 'enemyStaggered', targetId: 'e1', enemyId: 'x' }), 'staggered@e1'],
  ['STAGGERED on the player', enemyAttack(hit('e1', 'player'), { type: 'playerStaggered', targetId: 'player', actionLoss: 1 }), 'staggered@player'],
  ['STAGGERED on a co-op seat', enemyAttack(hit('e1', 'seatB'), { type: 'playerStaggered', targetId: 'seatB', actionLoss: 1 }), 'staggered@seatB'],
  ['STAGGERED from a Poise break (ratingImpact)', playerAttack(hit('player', 'e1'), { type: 'ratingImpact', targetId: 'e1', meter: 'poise', amount: 5, breaks: 1, label: 'Stagger' }), 'staggered@e1'],
];

for (const [name, events, want] of CASES) {
  test(`sequential: ${name}, in the reaction phase`, (t2) => {
    drive(t2, ({ trace, run, finish }) => {
      run(events);
      finish();
      const shown = trace.filter((e) => e.what.startsWith('callout:'));
      assert.deepEqual(shown.map((e) => e.what), [`callout:${want}`], 'one callout, on the right fighter');
      assert.ok(shown[0].at >= TOTAL, 'after the attacker is back in its stance, not at contact');
      assert.ok(shown[0].at <= TOTAL + ANIM_SPEEDS.normal.reactionMs + ANIM_SPEEDS.normal.stepMs, 'with the reaction');
    });
  });
}

test('sequential: CRITICAL shows with the hurt pose and adds no wait before the number', (t2) => {
  drive(t2, ({ trace, run, finish }) => {
    run(CASES[0][1]);
    finish();
    assert.equal(timeOf(trace, 'callout:critical@player'), TOTAL);
    assert.equal(timeOf(trace, 'reaction:player'), TOTAL);
    assert.equal(timeOf(trace, 'float:-4'), TOTAL + ANIM_SPEEDS.normal.reactionMs, 'the number still waits only reactionMs');
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

test('COUNTERED shows on the attacker who got countered, at the counter\'s impact', (t2) => {
  drive(t2, ({ trace, run, finish }) => {
    run([{ type: 'combatCounterTriggered', sourceId: 'player', sourceKind: 'player', targetId: 'e1', amount: 3 }, hit('player', 'e1', 3)]);
    finish();
    assert.equal(timeOf(trace, 'callout:countered@e1'), IMPACT, 'counter beats keep the impact order');
    assert.equal(timeOf(trace, 'float:-3'), IMPACT, 'and the hit after it is not delayed');
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
      assert.equal(timeOf(trace, 'callout:critical@player'), timeOf(trace, 'float:-4'), 'the callout shares its hit\'s tick');
      assert.ok(trace.every((e) => e.at <= 80), 'nothing waits past the fast path\'s own step');
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
    for (let i = 0; i <= TOTAL; i++) tick(1);
    assert.equal(callouts(layer).length, 1, 'the CRITICAL callout is showing');
    globalThis.dispatchEvent(new dom.Event('pointerdown'));
    assert.equal(callouts(layer).length, 0, 'the skip removed it');
    globalThis.dispatchEvent(new dom.Event('pointerup'));
    finish();
  });
});
