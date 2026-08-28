#!/usr/bin/env node
// tools/music-silence-probe.mjs — headless proof that the engine can tell
// silence-by-intent from silence-by-bug (word 3; Sunna's lift condition).
//
// Three shapes, three verdicts, through the REAL engine on the stubbed
// WebAudio graph (tools/webaudio-stub.mjs):
//   1. a context with a bed        → 'bed',     gain values scheduled
//   2. a context spelled 'silence' → 'silence', ZERO gain values scheduled —
//      the bed that was playing stops, nothing new starts: actual quiet,
//      and the engine SAYS it is deliberate
//   3. a context with no bed       → 'unknown', zero gain values AND a
//      console.warn naming the context — the bug shape, loud, never mistaken
//      for a decision
//
// Usage:   node tools/music-silence-probe.mjs             # the three shapes
//          node tools/music-silence-probe.mjs --selftest  # known-bad: delete
//            a bed the game relies on and prove shape 1's check goes red (the
//            instrument rule: a check nobody has watched fail is not green).
//
// Exit 0 = all three shapes give their verdict; 1 = any confusion.
// Nothing here has ears — this is the scheduling graph, not loudness.
// REMOVAL CONDITION: delete when music() no longer reports dispositions or
// the silence word leaves the vocabulary (MUSIC_SILENCE_WORD, model/schemas.js).

const { installWebAudioStub } = await import('./webaudio-stub.mjs');
const gainTargets = installWebAudioStub();

const { initAudio } = await import('../src/ui/audio.js');
const { BEDS } = await import('../src/content/music.js');
const { MUSIC_SILENCE_WORD } = await import('../src/model/schemas.js');

const selftest = process.argv.includes('--selftest');

// The probe's own test contexts, injected into the live table (this process
// only). BEDS is module state here, not the shipped file.
BEDS.probeQuiet = MUSIC_SILENCE_WORD;
if (selftest) delete BEDS.combat; // the planted bug: a relied-on bed gone

const warns = [];
const realWarn = console.warn;
console.warn = (...a) => { warns.push(a.join(' ')); realWarn(...a); };

const engine = initAudio({ musicVolume: 50, sfxVolume: 50, muteAudio: false });
if (!engine.isReal) {
  console.error('RESULT: probe broken — initAudio fell back to the silent engine, nothing was inspected.');
  process.exit(1);
}

let misses = 0;
const fail = (msg) => { misses++; console.error(`MISS  ${msg}`); };

// Shape 1 — a bed plays, and says so.
gainTargets.length = 0;
const d1 = engine.music('combat');
if (d1 !== 'bed') fail(`music('combat') reported '${d1}', expected 'bed'`);
if (gainTargets.length === 0) fail(`music('combat') scheduled no gain values — a bed context produced quiet`);
const combatScheduled = gainTargets.length;

// Shape 2 — the word stops the bed and schedules nothing new, deliberately.
gainTargets.length = 0;
const w2 = warns.length; // count only warns raised BY this shape
const d2 = engine.music('probeQuiet');
// stopMusic() fades the RUNNING bed out: ramps to 0.0001 are teardown, not
// music. Anything above the floor scheduled here would be sound.
const newSound = gainTargets.filter((v) => v > 0.0001);
if (d2 !== MUSIC_SILENCE_WORD) fail(`music('probeQuiet') reported '${d2}', expected '${MUSIC_SILENCE_WORD}'`);
if (newSound.length > 0) fail(`explicit silence scheduled sound anyway: ${newSound.join(', ')}`);
if (warns.length > w2) fail(`deliberate silence warned (${warns[w2]}) — intent must not look like a bug`);
// THE STOP IS ASSERTED, not just claimed (Vira's minor on word 3: her
// stopMusic no-op plant passed the first version, because the checks above
// only prove nothing NEW played). The teardown ramps ARE the available
// evidence: fading a live bed out schedules floor-level writes (≤ 0.0001) on
// its gain nodes, so a silence switch that tears nothing down leaves shape
// 2's pool EMPTY. Guarded on shape 1 having played — with no live bed there
// is nothing whose stop could be witnessed.
const teardown = gainTargets.filter((v) => v <= 0.0001);
if (combatScheduled > 0 && teardown.length === 0) {
  fail(`'${MUSIC_SILENCE_WORD}' scheduled no teardown writes — the running bed was never faded out, so the word did not STOP anything`);
}

// Shape 3 — an unwritten context is a bug, and it says which.
gainTargets.length = 0;
const before = warns.length;
const d3 = engine.music('noSuchContext');
const newSound3 = gainTargets.filter((v) => v > 0.0001);
if (d3 !== 'unknown') fail(`music('noSuchContext') reported '${d3}', expected 'unknown'`);
if (newSound3.length > 0) fail(`unknown context scheduled sound: ${newSound3.join(', ')}`);
if (warns.length !== before + 1 || !warns[before].includes('noSuchContext')) {
  fail(`unknown context did not warn naming itself (warns: ${JSON.stringify(warns.slice(before))})`);
}

// Prototype key — same class the SFX lookups had: an inherited name is a
// missing bed, never a function mistaken for one.
const d4 = engine.music('toString');
if (d4 !== 'unknown') fail(`music('toString') reported '${d4}', expected 'unknown' (inherited key must be a missing bed)`);

console.warn = realWarn;

// THE DOOR, in the run's own output — Vira's doors audit, 2026-08-14, found
// this probe SAME-DOOR and its door UNSTATED. An observation that cannot name
// its entry point has not made the claim (development.md, the instrument
// rule's same-door clause), so the entry point is printed, and so is the stage
// that carries no plant.
const DOOR = [
  '  DOOR: the known-bad enters as a CONTENT ROW — a bed deleted from the live BEDS table,',
  '    the same object src/content/music.js exports — and is judged by the REAL engine:',
  '    initAudio() builds its graph on the WebAudio stub and every scheduling call runs.',
  '    Nothing is handed to a verdict function; the disposition is whatever music() returns.',
  '    NOT PLANTED, and it matters: the plant is an in-memory edit to the imported module,',
  '    so the file read and parse of src/content/music.js carry no known-bad here. A bed that',
  '    vanished by a BAD FILE rather than a bad row would enter below this probe.',
].join('\n');

if (selftest) {
  const combatMiss = misses > 0;
  if (combatMiss && d2 === MUSIC_SILENCE_WORD) {
    console.log(DOOR);
    console.log(`RESULT: selftest held — with BEDS.combat deleted, shape 1 went red (${misses} miss${misses === 1 ? '' : 'es'}) while the silence word still read as intent; a vanished bed cannot pass as quiet-by-design.`);
    process.exit(0);
  }
  console.error('RESULT: selftest FAILED — deleting a relied-on bed did not red shape 1 (or broke the silence verdict); this probe cannot be trusted either way.');
  process.exit(1);
}

if (misses === 0) {
  console.log(DOOR);
  console.log(`RESULT: intent and bug are distinguishable — bed schedules sound (${combatScheduled} gain values), '${MUSIC_SILENCE_WORD}' stops the bed and schedules none without warning, an unwritten context schedules none AND warns naming itself. (Scheduling graph only — nothing here has ears.)`);
  process.exit(0);
}
console.error(`RESULT: ${misses} miss(es) — silence-by-intent and silence-by-bug are confusable; see MISS lines above.`);
process.exit(1);
