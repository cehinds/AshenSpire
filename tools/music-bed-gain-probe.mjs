#!/usr/bin/env node
// tools/music-bed-gain-probe.mjs — headless proof that `bed.gain` reaches the
// music the player actually hears, BY BOTH DOORS (#48, Vega's card).
//
// The defect, in her words: `BEDS.rest.gain = 0.34` and `BEDS.boss.gain = 0.6`
// are numbers somebody chose on purpose; the synth honoured them and the
// external-track path connected straight to `musicBus` at unity, so the moment
// real music files arrive — the release path — a shrine track plays as loud as
// a boss track and the mix table stops reaching the game.
//
// WHY THIS IS A ROUTE PROBE AND NOT A VALUE PROBE. There was no wrong number
// to find: there was NO GAIN STAGE AT ALL on the external path, so every
// instrument that reads scheduled values (sfx-gain-probe, music-silence-probe)
// reported exactly the same thing whether the table reached the asset path or
// not. An absence is invisible to a probe that inspects presences. This one
// therefore measures a LEVEL ALONG A ROUTE: the value a context's music
// arrives at, walking the real graph the engine built, node by node.
//
//   level(context, door) = the peak the source presents
//                        × every gain node strictly between it and the
//                          destination
//
// For the procedural door the peak is what the engine schedules on the voice's
// own gain node; for the external door the source is a media element at unity,
// so the level IS the route. Nothing here has ears — this is the arithmetic of
// the graph, not the quality of the sound.
//
// Both doors are entered through the PRODUCTION path on the real engine:
// `music(context)` for the synth, and `configureMusic({ folder })` + a stubbed
// manifest + `music(context)` for external — the same two calls main.js makes.
// No helper is reached into.
//
// Usage:   node tools/music-bed-gain-probe.mjs             # measure both doors
//          node tools/music-bed-gain-probe.mjs --selftest  # known-bad: revert
//            the routing fix in a disposable copy of the tree and prove this
//            probe goes red through the real door (the instrument rule: a
//            check nobody has watched fail is not green).
//
// Exit 0 = the table governs both doors; 1 = any door ignores it.
// REMOVAL CONDITION: #48's own — delete when beds lose their `gain` field to a
// successor vocabulary, or when the external-track path is removed.

const { installWebAudioStub, stubGraph } = await import('./webaudio-stub.mjs');
installWebAudioStub();
const graph = stubGraph();

const selftest = process.argv.includes('--selftest');

// The manifest the engine fetches. Only the contexts under test carry tracks;
// everything else falls through to the synth, which is the shipped behaviour.
const FOLDER = 'https://music.example/pack';
const MANIFEST = { rest: ['rest/shrine.mp3'], boss: ['boss/erdtree.mp3'], shop: ['shop/none.mp3'], map: ['map/all.mp3'] };
globalThis.fetch = async (url) => (String(url) === `${FOLDER}/manifest.json`
  ? { ok: true, json: async () => MANIFEST }
  : { ok: false, json: async () => ({}) });

const { initAudio } = await import('../src/ui/audio.js');
const { BEDS } = await import('../src/content/music.js');

// BOTH EDGES OF THE TUNABLE ITSELF, set on the live table (this process only;
// the shipped file is untouched). A zero bed must be silent by BOTH doors —
// that is the edge where "the number is ignored" and "the number is obeyed"
// finally look different on the external path — and a bed at 1 must arrive at
// full route level, so the fix cannot be a clamp wearing a stage.
//
// The edges ride EXISTING contexts rather than invented ones, and that is not
// convenience: `MUSIC_CONTEXTS` is `Object.keys(BEDS)` read once at module
// load, so a context added after the import is a context the external manifest
// path will never see. A probe whose edge cases can only be reached by the
// synth would have tested the door that already worked.
const ZERO_CONTEXT = 'shop';
const LOUD_CONTEXT = 'map';
BEDS[ZERO_CONTEXT].gain = 0;
BEDS[LOUD_CONTEXT].gain = 1;

const engine = initAudio({ musicVolume: 100, sfxVolume: 100, muteAudio: false });
if (!engine.isReal) {
  console.error('RESULT: probe broken — initAudio fell back to the silent engine, nothing was inspected.');
  process.exit(1);
}

/**
 * The product of every gain node STRICTLY BETWEEN `from` and the destination.
 * `from`'s own gain is excluded (for a voice it is the scheduled peak, handed
 * in separately; for a media source it does not exist in WebAudio at all), and
 * the destination's is excluded because it is not a gain — the stub gives
 * every node the same shape and only the route is real.
 */
function routeToDestination(from) {
  const dest = graph.nodes.find((n) => n.kind === 'destination');
  const walk = (node, acc, seen) => {
    if (node === dest) return acc;
    if (seen.has(node)) return null;
    seen.add(node);
    let best = null;
    for (const out of node.outs) {
      const next = out === dest ? acc : walk(out, acc * (out.gain ? out.gain.value : 1), seen);
      if (next !== null && (best === null || next > best)) best = next;
    }
    return best;
  };
  return walk(from, 1, new Set());
}

/** The loudest level any voice of the just-played bed presents to the output. */
function proceduralLevel() {
  let peak = 0;
  for (const { node, value } of graph.scheduled) {
    // The engine ramps every voice up to its peak and back down to 0.0001;
    // the teardown floor is not a level anyone hears as the bed.
    if (value <= 0.0002) continue;
    const route = routeToDestination(node);
    if (route === null) continue;
    peak = Math.max(peak, value * route);
  }
  return peak;
}

/** The level the external media element arrives at — unity source × its route. */
function externalLevel() {
  let peak = 0;
  for (const el of graph.elements) {
    if (!el.source) continue;
    const route = routeToDestination(el.source);
    if (route !== null) peak = Math.max(peak, route);
  }
  return peak;
}

async function measure(context, door) {
  engine.stopMusic(0);
  await engine.configureMusic({ folder: door === 'external' ? FOLDER : '' });
  // `music(c)` answers 'unchanged' when c is already the live context and plays
  // nothing — the engine's own no-op guard. So every measurement is preceded by
  // a flush through a context this probe never measures; without it the second
  // reading of a context would measure an empty graph and call it silence.
  engine.music('title');
  engine.stopMusic(0);
  graph.reset();
  const disposition = engine.music(context);
  const want = door === 'external' ? 'external' : 'bed';
  if (disposition !== want) {
    console.error(`RESULT: probe broken — music('${context}') answered '${disposition}', wanted '${want}'.`);
    console.error(`  The ${door} door was not entered, so nothing below would be a measurement of it.`);
    process.exit(1);
  }
  return door === 'external' ? externalLevel() : proceduralLevel();
}

const CONTEXTS = ['rest', 'boss', ZERO_CONTEXT, LOUD_CONTEXT];
const rows = [];
for (const context of CONTEXTS) {
  rows.push({
    context,
    gain: BEDS[context].gain,
    procedural: await measure(context, 'procedural'),
    external: await measure(context, 'external'),
  });
}

const at = (c) => rows.find((r) => r.context === c);
const ratio = (door) => (at('rest')[door] > 0 ? at('boss')[door] / at('rest')[door] : Infinity);
const tableRatio = BEDS.boss.gain / BEDS.rest.gain;
const close = (a, b) => Math.abs(a - b) < 1e-9;

console.log(`bed gains: rest ${BEDS.rest.gain} · boss ${BEDS.boss.gain} → the table's ratio is ${tableRatio.toFixed(3)}`);
console.log('context      gain   procedural level   external level');
for (const r of rows) {
  console.log(`  ${r.context.padEnd(11)}${String(r.gain).padEnd(7)}${r.procedural.toFixed(6).padEnd(19)}${r.external.toFixed(6)}`);
}

const fails = [];

// THE OUTPUT ROUTE, DERIVED FROM THE GRAPH, NEVER TYPED. Every level measured
// above rides the shared tail `bus → master → destination`, so a bare `0.9`
// written here would be a second copy of a number that lives in applyGains().
// It is read off the graph the engine actually built: master is the node that
// reaches the destination, a bus is any node that reaches master. Both buses
// sit at the same value only because this probe runs at volume 100/100 — that
// is asserted, not assumed, because if it ever stops holding the tail is no
// longer one number and every expectation below is quietly wrong.
const dest = graph.nodes.find((n) => n.kind === 'destination');
const master = graph.nodes.find((n) => n.outs.includes(dest));
const buses = graph.nodes.filter((n) => n.outs.includes(master));
if (!master || !buses.length || !buses.every((b) => close(b.gain.value, buses[0].gain.value))) {
  console.error('RESULT: probe broken — the output tail is not one route (buses at different gains,');
  console.error('  or no master). Every level below would be measured against the wrong denominator.');
  process.exit(1);
}
const OUTPUT = master.gain.value * buses[0].gain.value;

// THE SYNTH'S OWN VOICE LITERALS, restated on purpose (they live in
// playProcedural). If a peak is retuned this probe is MEANT to fail and be
// re-derived by hand, not to follow along quietly.
//
// AND THE LOUDEST VOICE IS NOT THE SAME VOICE IN EVERY BED — this cost the
// probe its first model. `rest` has no pulse layer, `boss` does, so comparing
// each bed's loudest voice compares 0.16 against 0.22 and reports a ratio of
// 2.426 for a table that says 1.765. That is a difference in bed SHAPE, not a
// mix defect, and a check that called it one would have been red for a reason
// that was never true. The expectation is therefore per-bed: the loudest voice
// this bed actually has.
const PEAKS = { drone: 0.12, note: 0.16, harmonic: 0.07, pulse: 0.22 };
const loudestVoice = (bed) => (bed.pulse ? PEAKS.pulse : PEAKS.note);

// 1 — THE CARD'S OWN RETIRE CONDITION: the external boss/rest ratio equals the
// table's. This is the sentence #48 says it retires on, measured at its door.
{
  const measured = ratio('external');
  const ok = close(measured, tableRatio);
  console.log(`${ok ? 'OK  ' : 'MISS'} external boss/rest ratio ${Number.isFinite(measured) ? measured.toFixed(3) : 'inf'} vs table ${tableRatio.toFixed(3)}`);
  if (!ok) fails.push(`external door ignores the mix table (ratio ${Number.isFinite(measured) ? measured.toFixed(3) : 'inf'}, wanted ${tableRatio.toFixed(3)})`);
}

// 2 — ONE HOME, WHICH IS THE ACTUAL RULE AND IS STRONGER THAN A RATIO. For
// every context and both doors, the level must be exactly linear in that bed's
// own gain with nothing else deciding: external is the table value carried by
// the route; procedural is the table value times this bed's loudest voice. A
// ratio can be right while both sides are wrong by the same factor; this
// cannot.
for (const r of rows) {
  const bed = BEDS[r.context];
  const wantExternal = r.gain * OUTPUT;
  const wantProcedural = loudestVoice(bed) * r.gain * OUTPUT;
  const okE = close(r.external, wantExternal);
  const okP = close(r.procedural, wantProcedural);
  console.log(`${okE ? 'OK  ' : 'MISS'} ${r.context} external level ${r.external.toFixed(6)} is the table's ${r.gain} carried by the route`);
  console.log(`${okP ? 'OK  ' : 'MISS'} ${r.context} procedural level ${r.procedural.toFixed(6)} is ${loudestVoice(bed)} x ${r.gain} (unmoved by the fix)`);
  if (!okE) fails.push(`${r.context}: external level ${r.external.toFixed(6)}, wanted ${wantExternal.toFixed(6)}`);
  if (!okP) fails.push(`${r.context}: procedural level ${r.procedural.toFixed(6)}, wanted ${wantProcedural.toFixed(6)}`);
}

// 3 — THE TWO DOORS AGREE WITH EACH OTHER, not merely each with the table.
// Two paths that both look right against different arithmetic is the defect
// this fix is shaped against.
//
// AND THE COMPARISON IS SHAPE-MATCHED, for the second time in this file. The
// naive form — procedural boss/rest ratio against external boss/rest ratio —
// is 2.426 against 1.765 even with the fix in place and both doors reading one
// number, because `boss` carries a pulse voice `rest` does not. It stayed red
// after a correct fix and I nearly went looking for a defect in the engine.
// What actually says "one home" is per-context: the synth's level is the same
// number the file gets, times this bed's loudest voice, with nothing else in
// between. Stated as a product so a zero-gain bed compares 0 to 0 rather than
// dividing by it.
for (const r of rows) {
  const want = loudestVoice(BEDS[r.context]) * r.external;
  const ok = close(r.procedural, want);
  if (!ok) fails.push(`the doors disagree at ${r.context} — two code paths are deciding loudness`);
  if (r.context === 'rest' || r.context === 'boss') {
    console.log(`${ok ? 'OK  ' : 'MISS'} the two doors agree with each other at ${r.context}`);
  }
}

// 4 — BOTH EDGES OF THE TUNABLE.
{
  const zero = at(ZERO_CONTEXT);
  const ok = zero.procedural === 0 && zero.external === 0;
  console.log(`${ok ? 'OK  ' : 'MISS'} a gain-0 bed is silent by both doors`);
  if (!ok) fails.push(`gain 0 still sounds (procedural ${zero.procedural}, external ${zero.external})`);

  const loud = at(LOUD_CONTEXT);
  const okLoud = close(loud.external, OUTPUT);
  console.log(`${okLoud ? 'OK  ' : 'MISS'} a gain-1 bed arrives at the full route level (no clamp wearing a stage)`);
  if (!okLoud) fails.push(`the top of the table is clamped, not carried (${loud.external.toFixed(6)}, wanted ${OUTPUT.toFixed(6)})`);
}

// ---- LIFETIME: does the outgoing stage OUTLIVE ITS OWN FADE? (#296) --------
//
// A SECOND INSTRUMENT IN THE SAME FILE, AND THE SPLIT IS DELIBERATE. Everything
// above reads a LEVEL ALONG A ROUTE — structure at ONE INSTANT. A fade is
// structure OVER TIME, and this file's own boundary said so before anyone found
// a defect there: "nothing here has ears; this is the arithmetic of the graph."
// That boundary was honest and it was also a hole, because the routing fix
// (#296) changed a node's LIFETIME while every check here watched its ROUTE.
//
// So these two ask the question the route reading structurally cannot:
//   L1  the outgoing stage is STILL CONNECTED while its voices' ramps run —
//       otherwise the fade is scheduled into a cut wire and the music stops
//       dead instead of fading.
//   L2  and it is RELEASED afterwards — otherwise every context change leaks a
//       gain node, which is the failure the fix itself would introduce if it
//       simply never disposed.
// Both directions, because one without the other is a fix that trades an
// audible bug for a silent one.
async function lifetime() {
  const out = [];
  const t0 = Date.now();
  const busSet = new Set(buses);
  const stagesOn = () => graph.nodes.filter((n) => n.kind === 'gain' && n.outs.some((o) => busSet.has(o)));
  const connected = (g) => g.outs.some((o) => busSet.has(o));

  // A STAGE'S TRUE END, DERIVED FROM THE ENGINE'S OWN `stop()` CALLS — never
  // from `keepAlive`, which is the engine's record of what it BELIEVES it
  // scheduled. Reading that record back would only confirm it. This walks
  // oscillator -> voice gain -> stage and takes the latest scheduled stop, so a
  // voice added WITHOUT a keepAlive call still counts here and its stage is
  // held to it. That closes the boundary I named on this PR and could not
  // enforce: "a fifth voice added without a keepAlive reintroduces the defect,
  // and nothing forces one." Something forces one now.
  const trueEndOf = (stage) => {
    const voices = graph.nodes.filter((n) => n.outs.includes(stage));
    const oscs = graph.nodes.filter((n) => n.outs.some((o) => voices.includes(o)));
    return Math.max(0, ...oscs.map((o) => o.stoppedAt || 0));
  };

  engine.stopMusic(0);
  await engine.configureMusic({ folder: '' });
  engine.music('title');
  engine.stopMusic(0);
  await new Promise((r) => setTimeout(r, 200));

  // THE SUBJECT IS THE STAGE THIS BED ACTUALLY FEEDS, not every gain node
  // currently on the bus. The first version of this check took all of them and
  // reported "9/9 held" — a pass carried mostly by stale nodes from earlier
  // measurements, which are trivially still connected and prove nothing about
  // the one stage under test. A plant aimed at a population that large would
  // have been diluted by its own denominator.
  graph.reset();
  engine.music('map');                       // the outgoing bed
  const live = new Set(stagesOn());
  const voices = graph.nodes.filter((n) => n.kind === 'gain' && n.outs.some((o) => live.has(o)));
  const outgoing = [...new Set(voices.flatMap((v) => v.outs.filter((o) => live.has(o))))];
  graph.reset();

  engine.music('combat');                    // the switch: stopMusic() then a new stage
  const ramps = graph.scheduled.filter((r) => voices.includes(r.node));
  const heldDuringFade = outgoing.filter((g) => g.outs.some((o) => busSet.has(o))).length;

  const l1 = ramps.length > 0 && heldDuringFade === outgoing.length && outgoing.length > 0;
  console.log(`${l1 ? 'OK  ' : 'MISS'} L1 the outgoing stage stays connected while its fade runs — ${outgoing.length} subject(s), ${heldDuringFade} held, ${ramps.length} ramp(s) pending`);
  if (!l1) {
    out.push(ramps.length === 0
      ? 'L1: no fade ramp was scheduled at the switch — nothing to protect, and that is its own defect'
      : `L1: the fade is scheduled on voices whose stage is already cut from the bus (${heldDuringFade}/${outgoing.length} held) — the ramp cannot reach the output`);
  }

  // The fade is 0.6s and the release is scheduled a beat past it; wait past both
  // rather than racing the timer this check exists to observe.
  await new Promise((r) => setTimeout(r, 2600));
  const stillHeld = outgoing.filter(connected).length;
  // THE NON-EMPTY GUARD, ADDED IN THE SAME SWEEP THAT DELETED L5. Without
  // `outgoing.length > 0` this reads `0 === 0` on an empty subject set and
  // passes having measured nothing — the identical zero-work green, in the
  // check sitting directly above the one it was found in.
  const l2 = outgoing.length > 0 && stillHeld === 0;
  console.log(`${l2 ? 'OK  ' : 'MISS'} L2 the outgoing stage is released once everything it carries is over — ${outgoing.length} subject(s), ${stillHeld} still connected`);
  if (!l2) out.push(outgoing.length === 0
    ? 'L2: NO APPLICABLE SUBJECT — no outgoing stage was tracked, so nothing was measured. Unknown is not green.'
    : `L2: ${stillHeld} outgoing stage(s) never released — every context change leaks a gain node`);

  // L3 — A NOTE'S TAIL SURVIVES A CONTEXT CHANGE.
  // The margin used to come from `fade` (0.6s), and `stopMusic` fades only the
  // DRONE: a melodic note runs 1.9s and is registered nowhere. So the stage was
  // cut at ~0.72s and the note's tail died with it. This samples INSIDE that
  // gap — at 1.1s, past the old margin and well short of 1.9 — which is the
  // only place the two answers differ. 1.9 is a number in the engine, not a
  // number I sampled for; the cell is placed from it.
  engine.stopMusic(0);
  await new Promise((r) => setTimeout(r, 200));
  graph.reset();
  // `music(c)` answers 'unchanged' and plays NOTHING when c is already live, and
  // `stopMusic` does not clear the context. Without this flush the line below
  // measured an empty set and L3 reported "0/0 held" — red, but for the wrong
  // reason, which is not red at all. Guarded rather than assumed, the way
  // `measure()` above already guards its own door.
  engine.music('title');
  engine.stopMusic(0);
  graph.reset();
  const d3 = engine.music('combat');         // a bed with notes AND a pulse
  if (d3 !== 'bed') {
    out.push(`L3: setup broken — music('combat') answered '${d3}', wanted 'bed'; nothing was measured`);
    console.log(`MISS L3 setup — music('combat') answered '${d3}'`);
    return out;
  }
  const live2 = new Set(stagesOn());
  const voices2 = graph.nodes.filter((n) => n.kind === 'gain' && n.outs.some((o) => live2.has(o)));
  const stage2 = [...new Set(voices2.flatMap((v) => v.outs.filter((o) => live2.has(o))))];
  // THE SAMPLE POINT IS DERIVED, NOT TYPED. It used to be a literal 1.1s chosen
  // against a literal 1.9s note, which is a number I would have to maintain by
  // hand every time a voice's envelope changed. It now comes from the longest
  // stop the ENGINE actually scheduled onto this stage, sampled just inside it.
  const end3 = trueEndOf(stage2[0]);
  // ONE CLOCK, STATED. The stub freezes `ctx.currentTime` at 0, so every
  // `stop(t + x)` the engine schedules is `x` — seconds AFTER this playback was
  // scheduled. `tStart` is that same moment in wall time, so `tStart + end*1000`
  // is the deadline in the only units this probe can actually observe.
  // The removed L5 compared `Date.now()` against an AudioContext-relative number
  // through a lifetime-wide epoch — two clocks, one comparison, no meaning.
  const tStart = Date.now();
  engine.music('rest');                      // switch one tick after the notes began
  const deadline = tStart + end3 * 1000;
  await new Promise((r) => setTimeout(r, Math.max(200, deadline - 150 - Date.now())));
  const heldAtTail = stage2.filter(connected).length;
  // AND THE SECOND HALF, WHICH IS ALL THAT SURVIVES OF L5: the stage must be
  // released AFTER its own end, not merely be up shortly before it. Same
  // subject, same clock, and the subject is procedural — so it exists.
  await new Promise((r) => setTimeout(r, (deadline + 500) - Date.now()));
  const releasedAfter = stage2.filter((g) => !connected(g)).length;
  const l3 = stage2.length > 0 && end3 > 0
    && heldAtTail === stage2.length && releasedAfter === stage2.length;
  console.log(`${l3 ? 'OK  ' : 'MISS'} L3 the tail outlives the switch and is then released — ${stage2.length} subject(s), engine-scheduled end ${end3.toFixed(2)}s (${heldAtTail} held at end-150ms, ${releasedAfter} released by end+500ms)`);
  if (!l3) out.push(stage2.length === 0 || end3 === 0
    ? 'L3: NO APPLICABLE SUBJECT — no scheduled stop was found on the outgoing stage, so nothing was measured. Unknown is not green.'
    : `L3: ${heldAtTail}/${stage2.length} held at end-150ms and ${releasedAfter}/${stage2.length} released by end+500ms, against a ${end3.toFixed(2)}s tail`);

  // L4 — THE PLAYLIST DOES NOT LEAK A STAGE PER TRACK.
  // A track ending advances to the next one WITHOUT a context change, so
  // nothing in stopMusic's path ever runs. This is the case L2 structurally
  // could not see: it only ever looked after a switch, which is why a plant
  // that "watches for accumulation" watched the wrong door.
  engine.stopMusic(0);
  await new Promise((r) => setTimeout(r, 2600));
  await engine.configureMusic({ folder: FOLDER });
  engine.music('title');
  engine.stopMusic(0);
  await new Promise((r) => setTimeout(r, 300));
  graph.reset();
  const d4 = engine.music('rest');            // external track 1
  if (d4 !== 'external') {
    out.push(`L4: setup broken — music('rest') answered '${d4}', wanted 'external'; nothing was measured`);
    console.log(`MISS L4 setup — music('rest') answered '${d4}'`);
    return out;
  }
  // EVERY STAGE THE ENGINE CREATED IS EITHER CURRENT OR DISCONNECTED.
  //
  // THIS CHECK HAS NOW BEEN WRONG TWICE, IN OPPOSITE DIRECTIONS, AND BOTH
  // VERSIONS PASSED WHILE A REAL LEAK SAT ON THE BUS.
  //   v1 COUNTED  `stagesOn().length` before/after, accepting `after <= before`.
  //      It saw ALL stages and not WHICH: orphan exactly one while later
  //      advances retire normally and the total is unchanged — "OK (3 -> 2)".
  //   v2 IDENTIFIED stages by walking the CURRENT media element's source. It saw
  //      WHICH and not ALL: a stage no element points at is not in its
  //      population at all, so its predicate could not be false. Saga planted a
  //      real GainNode on `musicBus`, never in `state.bedGains`, and every check
  //      printed OK beside 37 orphans.
  //
  // The diagnosis that produced v2 was right and I applied it by TRADING one
  // blindness for the other instead of removing it. The population has to come
  // from what the engine CREATED, not from what this probe can reach:
  // `everOuts` remembers a connection across `disconnect()`, so any gain ever
  // put on a bus is a subject forever, and there is no route that evades the
  // check because there is no route that skips `bedGain()`.
  const everStages = graph.nodes.filter((n) => n.kind === 'gain' && n.everOuts.some((o) => busSet.has(o)));
  const stageOfCurrentTrack = () => {
    const el = graph.elements[graph.elements.length - 1];
    return el && el.source && el.source.outs.length ? el.source.outs[0] : null;
  };
  for (let i = 0; i < 4; i++) {
    const el = graph.elements[graph.elements.length - 1];
    if (el && el.fire) el.fire('ended');     // the real playlist advance
  }
  // WAIT PAST THE LONGEST RETIREMENT BEFORE JUDGING. A stage that is neither
  // current nor disconnected is not yet an orphan — it may be mid-fade, holding
  // a tail it is REQUIRED to hold (L3 asserts exactly that). The census must
  // therefore sit past the longest scheduled tail plus its margin, or this check
  // convicts the fix it is meant to protect. Measured: a note tail is 1.9s and
  // retirement adds 120ms, so 2.6s clears it with room.
  await new Promise((r) => setTimeout(r, 2600));
  const current = stageOfCurrentTrack();
  const created = graph.nodes.filter((n) => n.kind === 'gain' && n.everOuts.some((o) => busSet.has(o)));
  const orphans = created.filter((g) => g !== current && connected(g));
  const l4 = created.length > 0 && !!current && connected(current) && orphans.length === 0;
  console.log(`${l4 ? 'OK  ' : 'MISS'} L4 every stage ever put on the bus is current or disconnected — ${created.length} created, ${orphans.length} orphan(s) still connected, current ${current && connected(current) ? 'up' : 'DOWN'}`);
  if (!l4) {
    out.push(created.length === 0
      ? 'L4: NO APPLICABLE SUBJECT — no stage was ever connected to a bus, so nothing was measured. Unknown is not green.'
      : (!current || !connected(current)
        ? 'L4: the CURRENT stage is disconnected — the playlist advanced into silence'
        : `L4: ${orphans.length} stage(s) left connected to the bus while neither current nor retired — a leak no sampled population can see`));
  }
  void everStages;

  // L5 WAS HERE AND IS DELETED, NOT REPAIRED — and the reasoning belongs in the
  // file because the next hand will be tempted to add it back.
  //
  // It claimed "no stage was released before its own scheduled voices ended" and
  // it MEASURED NOTHING. Its only subjects were the external playlist stages
  // above, whose sources are media elements with no oscillator -> voice chain,
  // so `trueEndOf` returned 0 for every one of them, `if (!end) continue` skipped
  // the lot, and an empty `late` array reported OK. A ZERO-WORK GREEN — the exact
  // shape I had caught and fixed one check along two heads earlier ("0/0 held is
  // red for the wrong reason, which is not red") and did not think to sweep for.
  // Its clock was wrong too: wall-clock `Date.now()` compared against
  // AudioContext-relative seconds through a lifetime-wide epoch.
  //
  // It is DELETED rather than fixed because its one real assertion — released
  // AFTER its own end, not merely up shortly before it — belongs to a subject
  // that actually has scheduled stops, and L3 already owns that subject and now
  // makes that assertion on one common clock. Repairing L5 would have meant
  // building it a second procedural scenario to have anything to measure: a
  // check kept alive by giving it work, which is defending a check into
  // existence. P7 is caught by L3 alone, so nothing is lost.
  return out;
}

for (const f of await lifetime()) fails.push(f);

if (!selftest) {
  if (fails.length) {
    console.error('\nRESULT: the mix table does not govern what the player hears —');
    for (const f of fails) console.error(`  ${f}`);
    process.exit(1);
  }
  console.log('\nRESULT: bed.gain governs both doors, at both edges, with the synth unmoved.');
  process.exit(0);
}

// ---- --selftest: the real door, planted ------------------------------------
// One class, and it is the production one: REVERT THE FIX in a disposable copy
// of the tree (the external source connected straight to the bus, exactly as
// dev stood at 001c950) and re-run THIS PROBE INSIDE THE COPY, so its own
// `../src/ui/audio.js` import resolves to the reverted engine. Every stage the
// real probe performs runs. The plant is the defect itself, not a proxy for it.
if (fails.length) {
  console.error('RESULT: selftest FAILED — this tree is already red, so a plant proves nothing.');
  for (const f of fails) console.error(`  ${f}`);
  process.exit(1);
}

const { spawnSync } = await import('node:child_process');
const { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } = await import('node:fs');
const { resolve, join, dirname } = await import('node:path');
const { tmpdir } = await import('node:os');
const { fileURLToPath } = await import('node:url');

const HERE = dirname(fileURLToPath(import.meta.url));
const TREE = resolve(HERE, '..');

// THREE PLANTS, EACH A REAL EDIT TO THE REAL ENGINE IN A DISPOSABLE COPY, with
// this probe re-run INSIDE the copy so its own `../src/ui/audio.js` import
// resolves to the planted engine. Every stage the real probe performs runs.
//
// P2 AND P3 ARE BOTH DIRECTIONS OF ONE FIX, and they are separate on purpose:
// a repair that never disposes passes P2 and fails P3, and the synchronous
// disposal that shipped fails P2 and passes P3. One plant either way would have
// licensed the other bug. (#296 — and the rule it earned: when you change a
// lifetime, plant both ends of it.)
const PLANTS = [
  {
    name: 'P1 ROUTING — the external track goes straight to the bus again (#48 itself)',
    from: '        src.connect(bedGain(bed));',
    to: '        src.connect(musicBus);',
    expect: [/external boss\/rest ratio 1\.000/, /the two doors agree with each other/],
    wanted: 'the external ratio at 1.000 and the two doors disagreeing',
  },
  {
    name: 'P2 LIFETIME, cut too early — the stage is disconnected while its fade still runs',
    from: '  function retireStages(fade) {\n    const retiring = state.bedGains;\n    state.bedGains = [];\n    if (!retiring.length) return;',
    to: '  function retireStages(fade) {\n    const retiring = state.bedGains;\n    state.bedGains = [];\n    if (!retiring.length) return;\n    for (const g of retiring) { try { g.disconnect(); } catch (e) { /* planted: the #296 defect */ } }\n    if (retiring.length) return;',
    expect: [/L1 the outgoing stage stays connected/],
    wanted: 'L1 red — the fade scheduled into a cut wire',
  },
  {
    name: 'P4 MARGIN from `fade` again — the note tail is cut at 0.72s (the review\'s first P2)',
    from: '      const until = Math.max(g.endsAt || 0, t + fade + 0.05);',
    to: '      const until = t + fade + 0.05; // planted: the margin forgets what the stage carries',
    // NOTE FOR THE NEXT HAND: this regex broke once when I renamed L3's printed
    // message and the plant went MISSED while producing exactly the right red.
    // The corpus caught it because it scores BY NAME — which is the argument for
    // naming, not for looser matching.
    expect: [/L3 the tail outlives the switch/],
    wanted: 'L3 red — the stage cut while a 1.9s note still sounded',
  },
  {
    name: 'P5 SUPERSEDING is not a retirement — the playlist leaks a stage per track (the second P2)',
    from: '    retireStages(0);\n    const g = ctx.createGain();',
    to: '    const g = ctx.createGain(); // planted: a superseded stage is never retired',
    expect: [/L4 every stage ever put on the bus is current or disconnected/],
    wanted: 'L4 red — the graph growing with no context change',
  },
  {
    // THE DISCRIMINATING PLANT, AND IT STAYS IN THE CORPUS. Exactly ONE
    // superseded external stage is orphaned; every later advance retires
    // normally. The bus total is unchanged, so the count-based L4 printed
    // "OK L4 ... (3 -> 2)" and exited 0 with a real leak present — measured, on
    // this tree, before the identity rewrite. P5's gross leak (every rollover)
    // was caught the whole time, which is exactly why the corpus looked healthy.
    // A plant that only the identity check can catch is the one that proves the
    // identity check earns its place; it must never be replaced by the gross
    // one that already passes.
    name: 'P6 ONE superseded stage orphaned — the leak a bus TOTAL cannot see',
    // AIMED AT THE 'ended' ADVANCE, not at bedGain. The first aim keyed a
    // once-only flag inside bedGain, which fires on the FIRST stage the process
    // ever builds — twenty-odd route measurements before the playlist section
    // exists. The orphan was real and simply outside the window under test:
    // a plant can be correct in its mechanism and still land nowhere near the
    // check it is meant to bite.
    from: "      if (state.context === context) playExternal(context, urls, bed);",
    to: "      if (state.context === context) { if (!globalThis.__leakOnce) { globalThis.__leakOnce = 1; state.bedGains = []; } playExternal(context, urls, bed); } // planted: exactly one orphan, at a real advance",
    expect: [/L4 every stage ever put on the bus is current or disconnected/],
    wanted: 'L4 red — one orphaned stage still connected while the total looks fine',
  },
  {
    // THE BOUNDARY I NAMED AND COULD NOT ENFORCE, NOW A RED. On this PR I wrote:
    // "a fifth voice added without a keepAlive call reintroduces the defect, and
    // nothing forces one." This is that fifth voice, simulated by removing the
    // call an existing voice already makes. It goes red because L3/L5 derive a
    // stage's true end from the ENGINE'S OWN `stop()` scheduling, not from the
    // bookkeeping `keepAlive` maintains — an independent reading, which is the
    // only kind that can catch the bookkeeping being incomplete.
    name: 'P7 a voice with NO keepAlive — the stage is released while that voice still sounds',
    from: '      keepAlive(out, t + 1.9);',
    to: '      // planted: this voice never declares when it is done',
    // NAMES EXACTLY ONE CHECK. It used to read /L3 …|L5 …/, and a disjunction
    // lets a plant that claims two checks be satisfied by ONE — which is how L5
    // sat green and unmeasuring behind a passing plant. A closed set with an
    // open slot: the same shape as the vacuous pass it was hiding.
    expect: [/L3 the tail outlives the switch/],
    wanted: 'L3 red — a stage cut before a voice the bookkeeping forgot',
  },
  {
    // SAGA'S KNOWN-BAD (B1), kept verbatim in intent: a real GainNode connected
    // to `musicBus`, never entered in `state.bedGains`, never any track's
    // current stage. It is invisible to any population a probe SAMPLES — no
    // media element points at it and no voice feeds it — and it was invisible
    // to the identity check I wrote, which printed OK beside 37 orphans. It is
    // caught now only because the population is built from what the engine
    // CREATED (`everOuts`) rather than from what the probe can reach.
    name: 'P8 an orphan stage on the bus, current to nothing — the leak no SAMPLED population can see',
    from: '    const g = ctx.createGain();\n    g.gain.value = bed && typeof bed.gain === \'number\' ? bed.gain : 1;',
    to: '    const orphan = ctx.createGain(); orphan.gain.value = 1; orphan.connect(musicBus); // planted: never retired, never current\n    const g = ctx.createGain();\n    g.gain.value = bed && typeof bed.gain === \'number\' ? bed.gain : 1;',
    expect: [/L4 every stage ever put on the bus is current or disconnected/],
    wanted: 'L4 red — orphan stages left connected while neither current nor retired',
  },
  {
    name: 'P3 LIFETIME, never released — the stage leaks on every context change',
    from: '      const timer = setTimeout(() => {',
    to: '      const timer = setTimeout(() => { if (1) return; // planted: the release never happens\n        void 0;',
    expect: [/L2 the outgoing stage is released/],
    wanted: 'L2 red — a gain node leaked per context change',
  },
];

const control = spawnSync(process.execPath, [resolve(TREE, 'tools/music-bed-gain-probe.mjs')], { encoding: 'utf8' });
console.log('\n  THE REAL DOOR: each plant is an edit to src/ui/audio.js in a disposable copy of the');
console.log('    tree, and this probe is re-run INSIDE that copy.');
console.log(`    control (this tree, unplanted): exit ${control.status} — a red here would prove only that copying breaks it`);

let held = control.status === 0;
for (const plant of PLANTS) {
  const dir = mkdtempSync(join(tmpdir(), 'music-bed-gain-kb-'));
  for (const d of ['src', 'tools']) {
    if (existsSync(resolve(TREE, d))) cpSync(resolve(TREE, d), resolve(dir, d), { recursive: true });
  }
  const enginePath = resolve(dir, 'src/ui/audio.js');
  const engineSrc = readFileSync(enginePath, 'utf8');
  const at = engineSrc.indexOf(plant.from);
  if (at < 0 || engineSrc.indexOf(plant.from, at + 1) >= 0) {
    console.error(`\n  PLANT SITE DRIFTED  ${plant.name}`);
    console.error(`    its anchor found ${at < 0 ? 'NO' : 'MORE THAN ONE'} home in src/ui/audio.js. RE-AIM it; do not`);
    console.error('    delete it. A corpus that silently stops matching is the eleven-instruments shape.');
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* tmp */ }
    held = false;
    continue;
  }
  writeFileSync(enginePath, engineSrc.slice(0, at) + plant.to + engineSrc.slice(at + plant.from.length), 'utf8');
  const planted = spawnSync(process.execPath, [resolve(dir, 'tools/music-bed-gain-probe.mjs')], { encoding: 'utf8' });
  const out = (planted.stdout || '') + (planted.stderr || '');
  const missLines = out.split('\n').filter((l) => /^MISS /.test(l));
  const named = plant.expect.every((re) => missLines.some((l) => re.test(l)));
  const ok = planted.status === 1 && named;
  console.log(`\n  ${ok ? 'CAUGHT' : 'MISSED'}  ${plant.name}`);
  console.log(`    planted: exit ${planted.status}, ${missLines.length} MISS line(s); wanted ${plant.wanted}`);
  for (const l of missLines.slice(0, 3)) console.log(`    red | ${l}`);
  if (!ok) console.error(`    NOT RED BY NAME — failing for another reason is not red.`);
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* tmp */ }
  held = held && ok;
}

if (!held) {
  console.error('\nRESULT: selftest FAILED — see the MISSED plant(s) above.');
  process.exit(1);
}
console.log(`\nRESULT: selftest held — ${PLANTS.length}/${PLANTS.length} plants caught by their named reds, control green.`);
process.exit(0);
