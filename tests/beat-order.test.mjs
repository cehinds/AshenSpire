// BEAT ORDER (owner, 2026-10-11; ui/animationPace.js beatOrder). An attack beat
// plays: attacker in stance → its swing → back to stance → the defender's
// reaction → the numbers → the bars. 'impact' keeps the older order (reaction
// and numbers at the impact frame, bars after the swing). Instant pacing and
// reduced motion add no waits but keep reaction → numbers → bars.
//
// Each test drives the shipped playTimeline under mocked timers and records a
// trace of { what, at } entries: 'contact' (the slash/spark the attacker's hit
// spawns), 'settle' (the swing's cancel, i.e. back to stance), 'reaction' (the
// target stage's hit pose), 'float:<text>' (a number), 'defeated', 'bars'
// (onBeatApplied / onFlush).

import test from 'node:test';
import assert from 'node:assert/strict';
import { playTimeline, setAnimSpeed, setBeatOrder, getBeatOrder, ANIM_SPEEDS } from '../src/ui/fx.js';
import { registerStage } from '../src/ui/services/PoseAnimator.js';
import { withKitDom } from './helpers/kit-dom.mjs';

const IMPACT = 100, TOTAL = 300;

function drive(t, fn) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  withKitDom((dom) => {
    const trace = [];
    const at = (what) => trace.push({ what, at: Date.now() });
    const el = (id) => { const e = dom.document.createElement('div'); e.className = 'sprite'; e.id = id; return e; };
    const anchors = { player: el('player'), e1: el('e1') };
    for (const [id, anchor] of Object.entries(anchors)) {
      registerStage(anchor, {
        play: (pose) => { at(pose === 'defeated' ? `defeated:${id}` : `reaction:${id}`); return true; },
        hold() { return true; },
        settle() {},
      });
    }
    const layer = dom.document.createElement('div');
    const append = layer.appendChild.bind(layer);
    layer.appendChild = (node) => {
      const cls = String(node.className || '');
      if (/\bfx-(slash|spark)\b/.test(cls)) at('contact');
      if (/\bfloat-num\b/.test(cls)) at(`float:${node.textContent}`);
      return append(node);
    };
    const ctx = {
      layer, combatEl: dom.document.createElement('div'),
      anchorFor: (id) => anchors[id] || null,
      animateActor: () => { at('swing'); return { impactMs: IMPACT, totalMs: TOTAL, hold() {}, cancel: () => at('settle') }; },
      onBeatApplied: (beat) => { if (!beat.banner) at('bars'); },
      onFlush: () => at('bars'),
    };
    let completed = 0;
    const run = (events, extra = {}) => playTimeline(events, { ...ctx, ...extra }, () => completed++);
    const finish = () => { for (let i = 0; i < 4000 && !completed; i++) t.mock.timers.tick(1); assert.equal(completed, 1, 'the timeline completes'); };
    try { fn({ dom, anchors, layer, trace, run, finish, tick: (ms) => t.mock.timers.tick(ms) }); }
    finally { setAnimSpeed('normal'); setBeatOrder('sequential'); dom.document.body.classList.remove('reduced-motion'); }
  });
}

const order = (trace) => trace.map((e) => e.what).filter((w) => w !== 'swing');
const timeOf = (trace, what) => trace.find((e) => e.what === what)?.at;
const playerHit = (...amounts) => [
  { type: 'cardPlayed', cardType: 'attack', cardId: 'strike', cardInstanceId: 'c1', targetId: 'e1' },
  ...amounts.map((amount) => ({ type: 'damageDealt', sourceId: 'player', targetId: 'e1', amount, blocked: 0 })),
];

test('the default beat order is sequential', () => {
  assert.equal(getBeatOrder(), 'sequential');
  setBeatOrder('nonsense');
  assert.equal(getBeatOrder(), 'sequential', 'an unknown order falls back to the default');
  for (const pace of ['slow', 'normal', 'fast']) {
    assert.ok(ANIM_SPEEDS[pace].reactionMs > 0 && ANIM_SPEEDS[pace].stanceLeadMs > 0, `${pace} has reaction and stance waits`);
  }
  assert.ok(ANIM_SPEEDS.slow.reactionMs > ANIM_SPEEDS.normal.reactionMs && ANIM_SPEEDS.normal.reactionMs > ANIM_SPEEDS.fast.reactionMs,
    'the reaction wait scales with the pace');
});

test('a player attack: contact at impact, then stance, reaction, number, bars', (t) => {
  drive(t, ({ trace, run, finish }) => {
    run(playerHit(4));
    finish();
    assert.deepEqual(order(trace), ['contact', 'settle', 'reaction:e1', 'float:-4', 'bars']);
    const { reactionMs } = ANIM_SPEEDS.normal;
    assert.equal(timeOf(trace, 'contact'), IMPACT, 'the contact lands at impactMs');
    assert.equal(timeOf(trace, 'settle'), TOTAL, 'the swing settles at totalMs');
    assert.equal(timeOf(trace, 'reaction:e1'), TOTAL, 'the reaction follows the return to stance');
    assert.equal(timeOf(trace, 'float:-4'), TOTAL + reactionMs, 'the number waits reactionMs');
    assert.equal(timeOf(trace, 'bars'), TOTAL + reactionMs, 'the bars follow the number');
  });
});

test('an enemy attack plays in the same order, and a hit-stop lengthens the swing', (t) => {
  drive(t, ({ trace, run, finish }) => {
    run([{ type: 'enemyMoveStarted', sourceId: 'e1', kind: 'attack' },
      { type: 'damageDealt', sourceId: 'e1', targetId: 'player', amount: 6, blocked: 0 }]);
    finish();
    assert.deepEqual(order(trace), ['contact', 'settle', 'reaction:player', 'float:-6', 'bars']);
    assert.equal(timeOf(trace, 'settle'), TOTAL + 60, 'the 60 ms hit-stop holds the swing before it settles');
  });
});

test('a multi-hit beat: every contact in the swing, then reaction and number per hit, then bars', (t) => {
  drive(t, ({ layer, trace, run, finish }) => {
    run(playerHit(3, 4));
    finish();
    assert.equal(layer.dataset.contact, '2', 'the layer counts each contact (tools/click-impact-probe.mjs watches it)');
    assert.deepEqual(order(trace), ['contact', 'contact', 'settle', 'reaction:e1', 'float:-3', 'reaction:e1', 'float:-4', 'bars']);
    const { stepMs, reactionMs } = ANIM_SPEEDS.normal;
    assert.equal(trace.filter((e) => e.what === 'contact')[1].at, IMPACT + stepMs, 'contacts stay stepMs apart');
    assert.equal(trace.filter((e) => e.what === 'reaction:e1')[1].at, TOTAL + reactionMs + stepMs, 'the next hit reacts a step after the last number');
  });
});

test('a lethal hit: reaction, number, then the death, then bars', (t) => {
  drive(t, ({ trace, run, finish }) => {
    run([...playerHit(5), { type: 'hpLost', targetId: 'e1', amount: 5, cause: 'attack' }, { type: 'enemyDied', targetId: 'e1' }]);
    finish();
    assert.deepEqual(order(trace), ['contact', 'settle', 'reaction:e1', 'float:-5', 'float:✝', 'defeated:e1', 'bars']);
  });
});

test('an attacker out of its stance returns to it and waits stanceLeadMs before swinging', (t) => {
  drive(t, ({ anchors, trace, run, finish }) => {
    let settled = 0;
    registerStage(anchors.player, { presentation: { action: 'attack' }, settle: () => settled++, play: () => true, hold() {} });
    run(playerHit(4));
    finish();
    assert.equal(settled, 1, 'the stance is restored first');
    assert.equal(timeOf(trace, 'swing'), ANIM_SPEEDS.normal.stanceLeadMs, 'the swing starts one stance lead later');
  });
});

test('an attacker already in stance swings at once', (t) => {
  drive(t, ({ anchors, trace, run, finish }) => {
    registerStage(anchors.player, { presentation: { action: undefined }, settle() { throw new Error('no settle'); }, play: () => true, hold() {} });
    run(playerHit(4));
    finish();
    assert.equal(timeOf(trace, 'swing'), 0);
  });
});

for (const mode of ['instant', 'reduced-motion']) {
  test(`${mode}: no added waits, still reaction → number → bars`, (t) => {
    drive(t, ({ dom, trace, run, finish }) => {
      if (mode === 'instant') setAnimSpeed('instant');
      else dom.document.body.classList.add('reduced-motion');
      run(playerHit(4));
      finish();
      // The fast path passes no beat kind, so it draws no slash (as before).
      assert.deepEqual(order(trace), ['reaction:e1', 'float:-4', 'bars']);
      assert.ok(trace.every((e) => e.at <= 80), 'nothing waits past the fast path\'s own step');
    });
  });
}

test('beatOrder impact keeps the older order: reaction and number at impact, bars after the swing', (t) => {
  drive(t, ({ trace, run, finish }) => {
    run(playerHit(4), { beatOrder: 'impact' });
    finish();
    assert.deepEqual(order(trace), ['contact', 'reaction:e1', 'float:-4', 'settle', 'bars']);
    assert.equal(timeOf(trace, 'float:-4'), IMPACT);
    assert.equal(timeOf(trace, 'bars'), TOTAL);
  });
});

test('a counter beat keeps the impact order', (t) => {
  drive(t, ({ trace, run, finish }) => {
    run([{ type: 'combatCounterTriggered', sourceId: 'e1', sourceKind: 'enemy', targetId: 'player' },
      { type: 'damageDealt', sourceId: 'e1', targetId: 'player', amount: 3, blocked: 0 }]);
    finish();
    assert.deepEqual(order(trace), ['reaction:player', 'float:-3', 'settle', 'bars']);
  });
});

test('a custom body clip keeps standard numbers but finishes before another reaction in the same beat', (t) => {
  drive(t,({trace,run,finish})=>{
    let index=0;
    run(playerHit(1,1),{
      reactionTimingForReceipt:()=>422.5,
      reactionForReceipt:event=>event.type==='damageDealt'?()=>trace.push({what:'pilot:'+ ++index,at:Date.now()}):null,
    });
    finish();
    const first=timeOf(trace,'pilot:1'),second=timeOf(trace,'pilot:2');
    assert.ok(second-first>=422.5,'the second reaction never replaces an unfinished body clip');
    assert.equal(trace.find(e=>e.what==='float:-1').at-first,ANIM_SPEEDS.normal.reactionMs,'numbers retain the contractual reaction delay');
  });
});

test('an identity-bound contact cue runs before hit-stop and also on an avoided or empty contact', (t) => {
  drive(t,({trace,run,finish})=>{
    run(playerHit(6),{animateActor:()=>({impactMs:100,totalMs:300,
      contact:()=>trace.push({what:'ack',at:Date.now()}),
      hold:()=>trace.push({what:'contact-hold',at:Date.now()}),
      cancel:()=>trace.push({what:'settle',at:Date.now()}),
    })});finish();
    assert.equal(timeOf(trace,'ack'),100);
    assert.ok(trace.findIndex(row=>row.what==='ack')<trace.findIndex(row=>row.what==='contact-hold'));
  });
});

test('an opted-in actor acknowledges its contact even when no hit-stop or outcome is drawn', (t) => {
  drive(t,({trace,run,finish})=>{
    run([{type:'cardPlayed',cardType:'attack',cardId:'strike',cardInstanceId:'empty',targetId:'e1'}],{
      animateActor:()=>({impactMs:100,totalMs:300,contact:()=>trace.push({what:'ack',at:Date.now()}),cancel(){}}),
    });finish();assert.equal(timeOf(trace,'ack'),100);
  });
});
