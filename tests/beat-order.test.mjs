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

// D11 (2026-10-18): a 500 ms gap at every stage boundary. AFTER spans animation → result → reaction.
const IMPACT = 100, TOTAL = 300, LEAD = 500, AFTER = 1000, REACTION = 500, GAP = 500;

function drive(t, fn) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  withKitDom((dom) => {
    const trace = [], words = [];
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
      if (/\bfx-callout\b/.test(cls)) words.push({ kind: node.dataset.calloutKind, at: Date.now() });
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
    const finish = () => { for (let i = 0; i < 20000 && !completed; i++) t.mock.timers.tick(1); assert.equal(completed, 1, 'the timeline completes'); };
    try { fn({ dom, anchors, layer, trace, words, run, finish, tick: (ms) => t.mock.timers.tick(ms) }); }
    finally { setAnimSpeed('normal'); setBeatOrder('sequential'); dom.document.body.classList.remove('reduced-motion'); }
  });
}

const order = (trace) => trace.map((e) => e.what).filter((w) => w !== 'swing');
const timeOf = (trace, what) => trace.find((e) => e.what === what)?.at;
const playerHit = (...amounts) => [
  { type: 'cardPlayed', cardType: 'attack', cardId: 'strike', cardInstanceId: 'c1', targetId: 'e1' },
  ...amounts.map((amount) => ({ type: 'damageDealt', sourceId: 'player', targetId: 'e1', amount, blocked: 0 })),
];

test('accuracy precedes the target animation and the final Block outcome follows it', t => {
  drive(t, ({ trace, words, run, finish }) => {
    run([playerHit()[0], { type: 'attackHit', sourceId: 'player', targetId: 'e1' },
      { type: 'damageDealt', sourceId: 'player', targetId: 'e1', amount: 4, blocked: 4 }], {
      reactionForReceipt: event => event.type === 'damageDealt' ? () => trace.push({ what: 'guard-reaction', at: Date.now() }) : null,
    });
    finish();
    const hit = words.find(row => row.kind === 'hit'), block = words.find(row => row.kind === 'blocked');
    assert.ok(hit.at < timeOf(trace, 'guard-reaction'));
    assert.ok(block.at > timeOf(trace, 'guard-reaction'));
    assert.equal(words.filter(row => row.kind === 'hit').length, 1);
  });
});

test('a committed range failure explains Out of range directly in primary feedback', t => {
  drive(t, ({ words, run, finish }) => {
    run([playerHit()[0], { type: 'attackMissed', sourceId: 'player', targetId: 'e1', missReason: 'range' }]);
    finish();
    assert.deepEqual(words.map(row => row.kind), ['action:Attack', 'missed', 'outOfRange']);
    assert.equal(words.filter(row => row.kind === 'missed').length, 1);
  });
});

test('miss and Evaded are separate accuracy and post-animation outcomes', t => {
  drive(t, ({ trace, words, run, finish }) => {
    run([playerHit()[0], { type: 'attackMissed', sourceId: 'player', targetId: 'e1' },
      { type: 'attackEvaded', sourceId: 'player', targetId: 'e1' }], {
      reactionForReceipt: event => event.type === 'attackEvaded' ? () => trace.push({ what: 'evade-reaction', at: Date.now() }) : null,
    });
    finish();
    assert.ok(words.find(row => row.kind === 'missed').at < timeOf(trace, 'evade-reaction'));
    assert.ok(words.find(row => row.kind === 'evaded').at > timeOf(trace, 'evade-reaction'));
  });
});

test('an incoming contact animates before its choice and its resumed receipt never repeats the swing', t => {
  drive(t, ({ trace, run, finish }) => {
    run([
      { type: 'combatContactPrepared', sourceId: 'e1', moveId: 'slash', kind: 'attack', contactKey: 'root:0' },
      { type: 'combatReactionOffered', ownerId: 'player' },
      { type: 'enemyMoveStarted', sourceId: 'e1', moveId: 'slash', kind: 'attack', contactPrepared: true, contactKey: 'root:0' },
      { type: 'attackHit', sourceId: 'e1', targetId: 'player' },
      { type: 'damageDealt', sourceId: 'e1', targetId: 'player', amount: 5 },
      { type: 'combatCounterTriggered', sourceId: 'player', targetId: 'e1' },
      { type: 'damageDealt', sourceId: 'player', targetId: 'e1', amount: 3 },
      { type: 'combatContactPrepared', sourceId: 'e1', moveId: 'slash', kind: 'attack', contactKey: 'root:1' },
    ], { animateActor: beat => {
      trace.push({ what: `swing:${beat.actorId}:${beat.telegraph ? 'incoming' : 'return'}`, at: Date.now() });
      return { impactMs: IMPACT, totalMs: TOTAL, cancel() {} };
    } });
    finish();
    assert.deepEqual(trace.filter(row => row.what.startsWith('swing:')).map(row => row.what), ['swing:e1:incoming', 'swing:player:return', 'swing:e1:incoming']);
    assert.ok(timeOf(trace, 'swing:e1:incoming') < timeOf(trace, 'float:-5'));
    assert.ok(timeOf(trace, 'float:-5') < timeOf(trace, 'swing:player:return'));
    const next = trace.filter(row => row.what === 'swing:e1:incoming')[1];
    assert.ok(timeOf(trace, 'float:-3') < next.at, 'the next incoming swing waits for the Counter result');
  });
});

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
    assert.equal(timeOf(trace, 'contact'), LEAD + IMPACT, 'the contact lands at impactMs');
    assert.equal(timeOf(trace, 'settle'), LEAD + TOTAL, 'the swing settles at totalMs');
    assert.equal(timeOf(trace, 'reaction:e1'), LEAD + TOTAL + AFTER, 'the reaction follows the return to stance');
    assert.equal(timeOf(trace, 'float:-4'), LEAD + TOTAL + AFTER + REACTION, 'the number waits reactionMs');
    assert.equal(timeOf(trace, 'bars'), LEAD + TOTAL + AFTER + REACTION, 'the bars follow the number');
  });
});

test('an enemy attack plays in the same order, and a hit-stop lengthens the swing', (t) => {
  drive(t, ({ trace, run, finish }) => {
    run([{ type: 'enemyMoveStarted', sourceId: 'e1', kind: 'attack' },
      { type: 'damageDealt', sourceId: 'e1', targetId: 'player', amount: 6, blocked: 0 }]);
    finish();
    assert.deepEqual(order(trace), ['contact', 'settle', 'reaction:player', 'float:-6', 'bars']);
    assert.equal(timeOf(trace, 'settle'), LEAD + TOTAL + 60, 'the 60 ms hit-stop holds the swing before it settles');
  });
});

test('a multi-hit beat: every contact in the swing, then reaction and number per hit, then bars', (t) => {
  drive(t, ({ layer, trace, run, finish }) => {
    run(playerHit(3, 4));
    finish();
    assert.equal(layer.dataset.contact, '2', 'the layer counts each contact (tools/click-impact-probe.mjs watches it)');
    assert.deepEqual(order(trace), ['contact', 'contact', 'settle', 'reaction:e1', 'float:-3', 'bars', 'reaction:e1', 'float:-4', 'bars']);
    assert.equal(trace.filter((e) => e.what === 'contact')[1].at, LEAD + IMPACT, 'the authored swing contacts precede serial damage receipts');
    assert.equal(trace.filter((e) => e.what === 'reaction:e1')[1].at, LEAD + TOTAL + AFTER + REACTION + 2 * GAP, 'the next hit reacts two gaps after the last number (damage → result → reaction)');
  });
});

test('a lethal hit: reaction, number, health update, then death resolution', (t) => {
  drive(t, ({ trace, run, finish }) => {
    run([...playerHit(5), { type: 'hpLost', targetId: 'e1', amount: 5, cause: 'attack' }, { type: 'enemyDied', targetId: 'e1' }]);
    finish();
    assert.deepEqual(order(trace), ['contact', 'settle', 'reaction:e1', 'float:-5', 'bars', 'float:✝', 'defeated:e1']);
  });
});

test('an attacker out of its stance settles before its delayed swing', (t) => {
  drive(t, ({ anchors, trace, run, finish }) => {
    let settled = 0;
    registerStage(anchors.player, { presentation: { action: 'attack' }, settle: () => settled++, play: () => true, hold() {} });
    run(playerHit(4));
    finish();
    assert.equal(settled, 1, 'the stance is restored first');
    assert.equal(timeOf(trace, 'swing'), LEAD, 'the swing starts after intent and action words');
  });
});

test('an attacker already in stance waits for intent and action wording', (t) => {
  drive(t, ({ anchors, trace, run, finish }) => {
    registerStage(anchors.player, { presentation: { action: undefined }, settle() { throw new Error('no settle'); }, play: () => true, hold() {} });
    run(playerHit(4));
    finish();
    assert.equal(timeOf(trace, 'swing'), LEAD);
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
      assert.deepEqual(order(trace), ['contact', 'reaction:e1', 'float:-4', 'bars']);
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

test('a counter beat uses ordered reaction, damage and HUD stages', (t) => {
  drive(t, ({ trace, run, finish }) => {
    run([{ type: 'combatCounterTriggered', sourceId: 'e1', sourceKind: 'enemy', targetId: 'player' },
      { type: 'damageDealt', sourceId: 'e1', targetId: 'player', amount: 3, blocked: 0 }]);
    finish();
    assert.deepEqual(order(trace), ['settle', 'reaction:player', 'float:-3', 'bars']);
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
    assert.equal(trace.find(e=>e.what==='float:-1').at-first,REACTION,'numbers retain the contractual reaction delay');
  });
});

test('a staggering hit: the Stagger sprite plays with the reaction, so the number keeps its plain-hit time', (t) => {
  drive(t, ({ layer, trace, run, finish }) => {
    run([...playerHit(4), { type: 'enemyStaggered', targetId: 'e1', cause: 'poiseBroken' }]);
    finish();
    assert.equal(layer.dataset.contact, '1', 'the stagger takes no contact step of its own (tools/click-impact-probe.mjs)');
    assert.equal(timeOf(trace, 'float:-4'), LEAD + TOTAL + AFTER + REACTION, 'the first number lands as on a plain hit');
  });
});

test('an identity-bound contact cue runs before hit-stop and also on an avoided or empty contact', (t) => {
  drive(t,({trace,run,finish})=>{
    run(playerHit(6),{animateActor:()=>({impactMs:100,totalMs:300,
      contact:()=>trace.push({what:'ack',at:Date.now()}),
      hold:()=>trace.push({what:'contact-hold',at:Date.now()}),
      cancel:()=>trace.push({what:'settle',at:Date.now()}),
    })});finish();
    assert.equal(timeOf(trace,'ack'),LEAD + 100);
    assert.ok(trace.findIndex(row=>row.what==='ack')<trace.findIndex(row=>row.what==='contact-hold'));
  });
});

test('an opted-in actor acknowledges its contact even when no hit-stop or outcome is drawn', (t) => {
  drive(t,({trace,run,finish})=>{
    run([{type:'cardPlayed',cardType:'attack',cardId:'strike',cardInstanceId:'empty',targetId:'e1'}],{
      animateActor:()=>({impactMs:100,totalMs:300,contact:()=>trace.push({what:'ack',at:Date.now()}),cancel(){}}),
    });finish();assert.equal(timeOf(trace,'ack'),LEAD + 100);
  });
});

const accuracyHit = (...amounts) => {
  const [played,...damage] = playerHit(...amounts);
  return [played,{type:'attackHit',sourceId:'player',targetId:'e1'},...damage];
};
function shortActor(trace, totalMs = 195, remainingMs) {
  return () => ({ impactMs: IMPACT, totalMs, remainingMs,
    hold: ms => trace.push({ what: 'hold', ms, at: Date.now() }),
    cancel: () => trace.push({ what: 'settle', at: Date.now() }) });
}

for (const [amount, hold] of [[7, 60], [22, 120]]) {
  test(`ordered contact keeps its ${hold} ms hit-stop without an empty inter-contact gap`, t => {
    drive(t, ({ trace, run, finish }) => {
      run(accuracyHit(amount), { animateActor: shortActor(trace), maxHpFor: () => 54 }); finish();
      const settled = LEAD + 195 + hold;
      assert.equal(timeOf(trace, 'contact'), LEAD + IMPACT, 'intent and action words precede the authored contact');
      assert.deepEqual(trace.filter(row => row.what === 'hold').map(({ ms, at }) => [ms, at]), [[hold, LEAD + IMPACT]]);
      assert.equal(timeOf(trace, 'settle'), settled, 'only authored recovery and hit-stop follow the final contact');
      assert.equal(timeOf(trace, 'reaction:e1'), settled + AFTER, 'the configured wait follows the return to stance');
      assert.equal(timeOf(trace, `float:-${amount}`), settled + AFTER + REACTION, 'the complete reaction wait precedes its number');
    });
  });
}

test('a short ordered swing finishes its total duration plus hit-stop before the two outcome waits', t => {
  drive(t, ({ trace, run, finish }) => {
    run(playerHit(7), { animateActor: shortActor(trace), maxHpFor: () => 54 }); finish();
    assert.equal(timeOf(trace, 'contact'), LEAD + IMPACT);
    assert.equal(timeOf(trace, 'settle'), LEAD + 195 + 60);
    assert.equal(timeOf(trace, 'float:-7'), LEAD + 195 + 60 + AFTER + REACTION);
  });
});

test('a delayed ordered contact retains the full hit-stop and remaining authored frames from delivery', t => {
  drive(t, ({ trace, run, finish, tick }) => {
    run(accuracyHit(7), { animateActor: shortActor(trace), maxHpFor: () => 54 });
    tick(LEAD); // Let the required pre-sprite wait finish on time.
    tick(350); // Deliver the sprite's 100 ms contact callback 250 ms late.
    finish();
    const delivered = LEAD + 350;
    const settled = delivered + (195 - IMPACT) + 60;
    assert.equal(timeOf(trace, 'contact'), delivered);
    assert.deepEqual(trace.filter(row => row.what === 'hold').map(({ ms, at }) => [ms, at]), [[60, delivered]]);
    assert.equal(timeOf(trace, 'settle'), settled, 'a late timer cannot erase the contact hold or remaining frames');
    assert.equal(timeOf(trace, 'float:-7'), settled + AFTER + REACTION);
  });
});

for (const totalMs of [195, 800]) {
  test(`ordered multi-hit contact preserves both holds and an actor of ${totalMs} ms fully recovers`, t => {
    drive(t, ({ trace, run, finish }) => {
      run(accuracyHit(7, 7), { animateActor: shortActor(trace, totalMs), maxHpFor: () => 54 }); finish();
      assert.deepEqual(trace.filter(row => row.what === 'contact').map(row => row.at), [LEAD + IMPACT, LEAD + IMPACT]);
      assert.deepEqual(trace.filter(row => row.what === 'hold').map(({ ms, at }) => [ms, at]), [[120, LEAD + IMPACT]], 'both qualifying hits extend their shared authored contact');
      const settled = LEAD + totalMs + 120;
      assert.equal(timeOf(trace, 'settle'), settled, 'all holds and the remaining swing survive');
      assert.equal(timeOf(trace, 'float:-7'), settled + AFTER + REACTION);
      assert.deepEqual(trace.filter(row => row.what === 'reaction:e1').map(row => row.at),
        [settled + AFTER, settled + AFTER + REACTION + 2 * GAP], 'each hit retains its own reaction before its numeric receipt');
    });
  });
}

test('a longer stage-reported recovery takes precedence over the ordered clock estimate', t => {
  drive(t, ({ trace, run, finish }) => {
    run(accuracyHit(7), { animateActor: shortActor(trace, 195, () => 250), maxHpFor: () => 54 }); finish();
    const settled = LEAD + IMPACT + 250;
    assert.equal(timeOf(trace, 'settle'), settled, '250 ms reported recovery exceeds the 95 ms frames plus 60 ms hold estimate');
    assert.equal(timeOf(trace, 'float:-7'), settled + AFTER + REACTION);
  });
});

test('impact order retains its existing terminal visual delay',t=>{
 drive(t,({trace,run,finish})=>{
  run(accuracyHit(7),{animateActor:shortActor(trace),maxHpFor:()=>54,beatOrder:'impact'});finish();
  assert.equal(timeOf(trace,'contact'),300);
  assert.equal(timeOf(trace,'float:-7'),300);
  assert.equal(timeOf(trace,'settle'),300+ANIM_SPEEDS.normal.stepMs+60);
 });
});
