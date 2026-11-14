// BEAT ORDER (owner, 2026-10-11; SPEC §7.4). An attack beat
// plays: attacker in stance → its swing → back to stance → the defender's
// reaction → the numbers → the bars. Instant pacing and
// reduced motion add no waits but keep reaction → numbers → bars.
//
// Each test drives the shipped playTimeline under mocked timers and records a
// trace of { what, at } entries: 'contact' (the slash/spark the attacker's hit
// spawns), 'settle' (the swing's cancel, i.e. back to stance), 'reaction' (the
// target stage's hit pose), 'float:<text>' (a number), 'defeated', 'bars'
// (onBeatApplied / onFlush).

import test from 'node:test';
import assert from 'node:assert/strict';
import { playTimeline, setAnimSpeed, ANIM_SPEEDS } from '../src/ui/fx.js';
import { registerStage } from '../src/ui/services/PoseAnimator.js';
import { withKitDom } from './helpers/dom.mjs';
import { setCombatPacing as pinCombatPacing } from '../src/ui/animationPace.js';
import { setFloaterPolicyEnabled } from '../src/ui/models/FloaterPolicyModel.js';
setFloaterPolicyEnabled(false); // this file tests beat order and sound timing for every floater; the allowlist is tests/floater-policy.test.mjs
pinCombatPacing({ combatSpeed: 1 }); // these timings are authored at x1; the shipped default is x1.25 (owner, 2026-10-26)

// The combat timeline (owner, 2026-11-13; content/config/ui/presentation/actionPacing.json): cost 0, action word and stance +100,
// swing +100, contact on the impact frame, result +100, reaction +100 with the numbers and bars, end +100. The pose, the
// numbers and the bars land together; nothing waits for the attacker to settle.
const IMPACT = 100, TOTAL = 300, GAP = 100;
const LEAD = 2 * GAP;                      // the swing starts 200 ms after the beat
const RESULT = LEAD + IMPACT + GAP;        // the Hit / Miss word
const REACT = RESULT + GAP;                // the defender's pose, the numbers and the bars
const END = REACT + GAP;                   // the beat ends and the attacker settles (when its clip is over)

function drive(t, fn) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  // The scheduler's monotonic clock must advance with these mocked timers.
  t.mock.method(globalThis.performance, 'now', () => Date.now());
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
    const finish = () => { for (let i = 0; i < 20000 && !completed; i++) t.mock.timers.tick(1); assert.equal(completed, 1, 'the timeline completes'); t.mock.timers.tick(3000); /* trailing floaters and words */ };
    try { fn({ dom, anchors, layer, trace, words, run, finish, tick: (ms) => t.mock.timers.tick(ms) }); }
    finally { setAnimSpeed('normal'); dom.document.body.classList.remove('reduced-motion'); }
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
    assert.ok(words.find(row => row.kind === 'dodged').at > timeOf(trace, 'evade-reaction'));
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

test('every pace has reaction and stance-lead waits', () => {
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
    assert.deepEqual(order(trace), ['contact', 'reaction:e1', 'float:-4', 'bars', 'settle']);
    assert.equal(timeOf(trace, 'contact'), LEAD + IMPACT, 'the contact lands at impactMs');
    assert.equal(timeOf(trace, 'reaction:e1'), REACT, 'the pose starts 200 ms after contact, while the swing is still recovering');
    assert.equal(timeOf(trace, 'float:-4'), REACT, 'the number lands with the pose');
    assert.equal(timeOf(trace, 'bars'), REACT, 'and so do the bars');
    assert.equal(timeOf(trace, 'settle'), END, 'the attacker settles when the beat ends (its 300 ms clip is over by then)');
  });
});

test('an enemy attack plays in the same order, and a hit-stop lengthens the swing', (t) => {
  drive(t, ({ trace, run, finish }) => {
    run([{ type: 'enemyMoveStarted', sourceId: 'e1', kind: 'attack' },
      { type: 'damageDealt', sourceId: 'e1', targetId: 'player', amount: 6, blocked: 0 }]);
    finish();
    assert.deepEqual(order(trace), ['contact', 'reaction:player', 'float:-6', 'bars', 'settle']);
    // An enemy beat has no card and no stance change: its swing starts at the action word, 100 ms in, not 200.
    assert.equal(timeOf(trace, 'settle'), Math.max(END - GAP, GAP + TOTAL + 60), 'the attacker settles at the end, or after its hit-stop if that is later');
  });
});

test('a multi-hit beat: every contact in the swing, then reaction and number per hit, then bars', (t) => {
  drive(t, ({ layer, trace, run, finish }) => {
    run(playerHit(3, 4));
    finish();
    assert.equal(layer.dataset.contact, '2', 'the layer counts each contact (tools/click-impact-probe.mjs watches it)');
    assert.deepEqual(order(trace), ['contact', 'contact', 'reaction:e1', 'float:-3', 'bars', 'reaction:e1', 'float:-4', 'bars', 'settle']);
    assert.equal(trace.filter((e) => e.what === 'contact')[1].at, LEAD + IMPACT, 'the authored swing contacts precede serial damage receipts');
    assert.equal(trace.filter((e) => e.what === 'reaction:e1')[1].at, REACT + 2 * GAP, 'the next hit reacts one segment (100 ms) plus the result spacing (100 ms) after the first');
  });
});

test('a lethal hit: reaction, number, health update, then death resolution', (t) => {
  drive(t, ({ trace, run, finish }) => {
    run([...playerHit(5), { type: 'hpLost', targetId: 'e1', amount: 5, cause: 'attack' }, { type: 'enemyDied', targetId: 'e1' }]);
    finish();
    assert.deepEqual(order(trace), ['contact', 'reaction:e1', 'float:-5', 'bars', 'float:Defeated', 'defeated:e1', 'settle']);
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

test('a counter beat uses ordered reaction, damage and HUD stages', (t) => {
  drive(t, ({ trace, run, finish }) => {
    run([{ type: 'combatCounterTriggered', sourceId: 'e1', sourceKind: 'enemy', targetId: 'player' },
      { type: 'damageDealt', sourceId: 'e1', targetId: 'player', amount: 3, blocked: 0 }]);
    finish();
    assert.deepEqual(order(trace), ['reaction:player', 'float:-3', 'bars', 'settle']);
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
    assert.equal(trace.find(e=>e.what==='float:-1').at,first,'the number lands with its pose');
  });
});

test('a staggering hit: the Stagger sprite plays with the reaction, so the number keeps its plain-hit time', (t) => {
  drive(t, ({ layer, trace, run, finish }) => {
    run([...playerHit(4), { type: 'enemyStaggered', targetId: 'e1', cause: 'poiseBroken' }]);
    finish();
    assert.equal(layer.dataset.contact, '1', 'the stagger takes no contact step of its own (tools/click-impact-probe.mjs)');
    assert.equal(timeOf(trace, 'float:-4'), REACT, 'the first number lands as on a plain hit');
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
      const settled = Math.max(END, LEAD + 195 + hold);
      assert.equal(timeOf(trace, 'contact'), LEAD + IMPACT, 'intent and action words precede the authored contact');
      assert.deepEqual(trace.filter(row => row.what === 'hold').map(({ ms, at }) => [ms, at]), [[hold, LEAD + IMPACT]]);
      assert.equal(timeOf(trace, 'settle'), settled, 'the attacker settles at the end of the beat, or after its authored recovery and hit-stop if later');
      assert.equal(timeOf(trace, 'reaction:e1'), REACT, 'the reaction does not wait for the return to stance');
      assert.equal(timeOf(trace, `float:-${amount}`), REACT, 'the number lands with the reaction');
    });
  });
}

test('a short ordered swing finishes its total duration plus hit-stop before the two outcome waits', t => {
  drive(t, ({ trace, run, finish }) => {
    run(playerHit(7), { animateActor: shortActor(trace), maxHpFor: () => 54 }); finish();
    assert.equal(timeOf(trace, 'contact'), LEAD + IMPACT);
    assert.equal(timeOf(trace, 'settle'), Math.max(END, LEAD + 195 + 60));
    assert.equal(timeOf(trace, 'float:-7'), REACT);
  });
});

test('a delayed ordered contact retains the full hit-stop and remaining authored frames from delivery', t => {
  drive(t, ({ trace, run, finish, tick }) => {
    // Unlike an elapsed CSS animation, this actor starts its recovery at contact
    // and reports the remaining authored frames plus every requested hit-stop.
    let contactAt = null, held = 0;
    const actor = { impactMs: IMPACT, totalMs: 195,
      contact() { contactAt = Date.now(); },
      hold(ms) { held += ms; trace.push({ what: 'hold', ms, at: Date.now() }); },
      remainingMs() {
        assert.notEqual(contactAt, null, 'contact cues the authored recovery');
        return Math.max(0, 195 - IMPACT + held - (Date.now() - contactAt));
      },
      cancel() { trace.push({ what: 'settle', at: Date.now() }); },
    };
    run(accuracyHit(7), { animateActor: () => actor, maxHpFor: () => 54 });
    tick(GAP); tick(GAP); // Let each required pre-sprite wait (intent, then action word) finish on time.
    tick(350); // Deliver the sprite's 100 ms contact callback 250 ms late.
    finish();
    const delivered = LEAD + 350;
    const settled = Math.max(delivered + (195 - IMPACT) + 60, END);
    assert.equal(timeOf(trace, 'contact'), delivered);
    assert.deepEqual(trace.filter(row => row.what === 'hold').map(({ ms, at }) => [ms, at]), [[60, delivered]]);
    assert.equal(timeOf(trace, 'settle'), settled, 'a late timer cannot erase the contact hold or remaining frames');
    assert.equal(timeOf(trace, 'float:-7'), delivered, 'events already due when the late contact is delivered fire right after it');
  });
});

for (const totalMs of [195, 800]) {
  test(`ordered multi-hit contact preserves both holds and an actor of ${totalMs} ms fully recovers`, t => {
    drive(t, ({ trace, run, finish }) => {
      run(accuracyHit(7, 7), { animateActor: shortActor(trace, totalMs), maxHpFor: () => 54 }); finish();
      assert.deepEqual(trace.filter(row => row.what === 'contact').map(row => row.at), [LEAD + IMPACT, LEAD + IMPACT]);
      assert.deepEqual(trace.filter(row => row.what === 'hold').map(({ ms, at }) => [ms, at]), [[120, LEAD + IMPACT]], 'both qualifying hits extend their shared authored contact');
      const settled = Math.max(END + 2 * GAP, LEAD + totalMs + 120);
      assert.equal(timeOf(trace, 'settle'), settled, 'all holds and the remaining swing survive');
      assert.equal(timeOf(trace, 'float:-7'), REACT);
      assert.deepEqual(trace.filter(row => row.what === 'reaction:e1').map(row => row.at),
        [REACT, REACT + 2 * GAP], 'each hit has its own reaction, one segment apart');
    });
  });
}

test('a longer stage-reported recovery takes precedence over the ordered clock estimate', t => {
  drive(t, ({ trace, run, finish }) => {
    run(accuracyHit(7), { animateActor: shortActor(trace, 195, () => 250), maxHpFor: () => 54 }); finish();
    const settled = Math.max(END, LEAD + IMPACT + 250);
    assert.equal(timeOf(trace, 'settle'), settled, '250 ms reported recovery exceeds the 95 ms frames plus 60 ms hold estimate');
    assert.equal(timeOf(trace, 'float:-7'), REACT);
  });
});



// Owner 2026-11-06: card played → cost → intent word → stance → animation → hit word → reaction → damage → the rest.
test('the card-play order: cost, intent word, stance, animation, hit word, reaction, damage numbers', t => {
  drive(t, ({ trace, words, run, finish }) => {
    const mark = what => trace.push({ what, at: Date.now() });
    run([
      { type: 'energySpent', amount: 2 },
      { type: 'cardPlayed', cardType: 'attack', cardId: 'strike', cardInstanceId: 'c1', targetId: 'e1', name: 'Strike' },
      { type: 'stanceEntered', stance: 'smash', playerId: 'player' },
      { type: 'attackHit', sourceId: 'player', targetId: 'e1' },
      { type: 'damageDealt', sourceId: 'player', targetId: 'e1', amount: 4, blocked: 0 },
    ], {
      onLeadApplied: () => mark('cost-applied'),
      onStanceLead: (beat, event, options) => { if (!options?.cardOnly) mark('stance'); },
    });
    finish();
    const all = [...words.map(w => ({ what: `word:${w.kind}`, at: w.at })), ...trace.map(e => ({ ...e }))]
      .filter(e => e.what !== 'bars').sort((a, b) => a.at - b.at);
    const names = all.map(e => e.what);
    const first = what => names.indexOf(what);
    assert.deepEqual(names.filter(n => ['float:−2 EP', 'cost-applied', 'word:action:Strike', 'stance', 'swing', 'word:hit', 'reaction:e1', 'float:-4'].includes(n)),
      ['float:−2 EP', 'cost-applied', 'word:action:Strike', 'stance', 'swing', 'word:hit', 'reaction:e1', 'float:-4']);
    assert.ok(first('float:−2 EP') < first('word:action:Strike'));
    const at = what => all.find(e => e.what === what).at;
    assert.equal(at('cost-applied'), GAP, 'the card is shown played first; the cost follows it by 100 ms');
    assert.equal(at('stance'), 2 * GAP, 'the stance changes with the action word');
    assert.equal(at('word:action:Strike'), 2 * GAP, 'the action word follows the cost by 100 ms');
  });
});

// Owner 2026-11-06, enemy loop: reveal -> the enemy pays (SP floater, meter) -> move (word, animation) -> hit word -> reaction -> damage.
test('the enemy-turn order: reveal, SP payment, move word, animation, hit word, reaction, damage', t => {
  drive(t, ({ trace, words, run, finish }) => {
    const mark = what => trace.push({ what, at: Date.now() });
    run([
      { type: 'enemyActorTurnStarted', sourceId: 'e1', intent: {} },
      { type: 'enemyStaminaSpent', sourceId: 'e1', moveId: 'slash', amount: 2, remaining: 1 },
      { type: 'enemyMoveStarted', sourceId: 'e1', moveId: 'slash', kind: 'attack' },
      { type: 'attackHit', sourceId: 'e1', targetId: 'player' },
      { type: 'damageDealt', sourceId: 'e1', targetId: 'player', amount: 6, blocked: 0 },
    ], { onLeadApplied: () => mark('cost-applied') });
    finish();
    const all = [...words.map(w => ({ what: `word:${w.kind}`, at: w.at })), ...trace].sort((a, b) => a.at - b.at).map(e => e.what);
    const wanted = ['float:−2 SP', 'cost-applied', 'word:action:Attack', 'swing', 'word:hit', 'reaction:player', 'float:-6'];
    const seen = all.filter(n => wanted.includes(n));
    assert.deepEqual(seen, wanted);
  });
});

test('an enemy that cannot pay says OUT OF SP over itself and plays nothing', t => {
  drive(t, ({ trace, words, run, finish }) => {
    run([{ type: 'enemyMoveUnavailable', sourceId: 'e1', moveId: 'slash', required: 3, available: 1, resource: 'sp' }]);
    finish();
    assert.deepEqual(words.map(w => w.kind), ['outOfSp']);
    assert.ok(!trace.some(e => e.what === 'swing' || e.what === 'contact'), 'no animation for a skipped move');
  });
});

// Owner 2026-11-06: every cost floater of one play (SP, MP; the enemy's SP) appears in the cost beat, before the intent word.
test('a card with two distinct costs (SP and MP) shows both cost floaters before the intent word and the stance', t => {
  drive(t, ({ trace, words, run, finish }) => {
    run([
      { type: 'staminaSpent', amount: 1 },
      { type: 'manaSpent', amount: 2 },
      { type: 'cardPlayed', cardType: 'attack', cardId: 'strike', cardInstanceId: 'c1', targetId: 'e1', name: 'Strike' },
      { type: 'stanceEntered', stance: 'smash', playerId: 'player' },
      { type: 'damageDealt', sourceId: 'player', targetId: 'e1', amount: 4, blocked: 0 },
    ], { onStanceLead: (beat, event, options) => { if (!options?.cardOnly) trace.push({ what: 'stance', at: Date.now() }); } });
    finish();
    const word = words.find(w => w.kind === 'action:Strike');
    const sp = trace.find(e => e.what === 'float:\u22121 SP'), mp = trace.find(e => e.what === 'float:\u22122 MP'), stance = trace.find(e => e.what === 'stance');
    assert.ok(sp && mp && word && stance, 'both costs, the word and the stance all appear');
    assert.ok(sp.at <= word.at && mp.at <= word.at, `both cost floaters (${sp.at}, ${mp.at}) precede the word (${word.at})`);
    assert.ok(word.at <= stance.at, 'the word and the stance share a time, the word first');
  });
});

// Core 2 aliases energy to stamina (model/turnStamina.js): one payment emits energySpent AND staminaSpent.
test('one aliased Core 2 payment (energySpent + staminaSpent) shows exactly one "-1 SP" floater', t => {
  drive(t, ({ trace, run, finish }) => {
    const applied = [];
    run([
      { type: 'energySpent', amount: 1 }, { type: 'staminaSpent', amount: 1 },
      { type: 'cardPlayed', cardType: 'attack', cardId: 'core.strike', cardInstanceId: 'c1', targetId: 'e1', name: 'Strike' },
      { type: 'damageDealt', sourceId: 'player', targetId: 'e1', amount: 4, blocked: 0 },
    ], { onLeadApplied: beat => applied.push(...beat.events.map(e => e.type)) });
    finish();
    const floats = trace.filter(e => /^float:\u2212/.test(e.what)).map(e => e.what);
    assert.deepEqual(floats, ['float:\u22121 SP']);
    assert.deepEqual(applied, ['energySpent', 'staminaSpent'], 'both receipts still reach the HUD');
  });
});

test('the enemy SP payment floater precedes the enemy move word', t => {
  drive(t, ({ trace, words, run, finish }) => {
    run([
      { type: 'enemyStaminaSpent', sourceId: 'e1', moveId: 'slash', amount: 2, remaining: 1 },
      { type: 'enemyMoveStarted', sourceId: 'e1', moveId: 'slash', kind: 'attack' },
    ]);
    finish();
    const cost = trace.find(e => e.what === 'float:\u22122 SP'), word = words.find(w => w.kind.startsWith('action:'));
    assert.ok(cost && word && cost.at <= word.at);
  });
});

// A cardPreparing trigger (feat:pilgrim-of-scars) can heal before cardPlayed; that receipt rides the beat's lead with the
// cost but is not a cost, so it keeps its visuals while only the cost is played and applied up front.
test('a heal that precedes cardPlayed keeps its +HP floater; only the cost is applied up front', t => {
  drive(t, ({ trace, run, finish }) => {
    const led = [];
    run([
      { type: 'energySpent', amount: 1 },
      { type: 'healed', targetId: 'player', amount: 5 },
      { type: 'cardPlayed', cardType: 'attack', cardId: 'strike', cardInstanceId: 'c1', targetId: 'e1', name: 'Strike' },
      { type: 'damageDealt', sourceId: 'player', targetId: 'e1', amount: 4, blocked: 0 },
    ], { onLeadApplied: beat => led.push(...beat.events.map(e => e.type)),
         onBeatApplied: beat => led.push(...beat.events.map(e => 'applied:' + e.type)) });
    finish();
    assert.ok(trace.some(e => e.what === 'float:+5'), 'the +HP floater plays');
    assert.ok(trace.some(e => e.what === 'float:−1 EP'), 'and so does the cost floater');
    assert.deepEqual(led.filter(x => /energySpent|healed/.test(x)), ['energySpent', 'applied:healed'], 'the cost applies up front, the heal with the beat, each once');
  });
});
