// tests/run-node.mjs — Node test runner: `node tests/run-node.mjs`
// Prints one line per test; exits 1 on any failure.

import { runTests } from './engine.test.js';

// The art manifest is written by tools/equipment-blender.py and records the
// fields the renderer ACTUALLY read. Loaded here rather than inside the test so
// the harness can stay synchronous (see the promise guard in runTests).
let artManifest = null;
try {
  const { readFileSync } = await import('node:fs');
  const { resolve, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  artManifest = JSON.parse(readFileSync(resolve(root, 'assets/equipment/manifest.json'), 'utf8'));
} catch (e) {
  console.warn('  (no art manifest — test 33 will skip; run tools/equipment-blender.py)');
}

// THE FILESYSTEM, HANDED IN RATHER THAN IMPORTED — same reason as the manifest
// above: engine.test.js also runs in tests/index.html, where there is no `fs`,
// and an import of `node:fs` in that file would take the browser harness down
// entirely. Test 49 asks this whether a path the game CONSTRUCTS resolves to a
// real file; in the browser it is null and the test skips loudly.
let assetExists = null;
try {
  const { existsSync } = await import('node:fs');
  const { resolve, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  assetExists = (rel) => existsSync(resolve(root, rel));
} catch {
  console.warn('  (no filesystem — test 49 will skip)');
}

const { passed, failed, results } = await runTests({ artManifest, assetExists });
for (const r of results) {
  const tag = r.skipped ? 'SKIP' : r.ok ? 'PASS' : 'FAIL';
  console.log(`${tag}  ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
}

// The zoom-unit guard runs HERE, not as a script somebody remembers to run. A
// check nobody reads is not a check: the tutorial lockout it exists to catch
// shipped past this suite while the suite was green the whole time.
// Two lines, because they fail for different reasons and must not be conflated:
//   36 — the check's own integrity (its corpus). Its failure is the check's fault.
//   37 — findings in src/. Its failure is the code's state, not the check's.
// Numbered 36/37, not 35/36: dev's test 35 is Sunna's accessibility-defaults test
// in engine.test.js. Two files, no git conflict, and a suite that would have
// printed "35." twice — the collision a merge cannot see.
let zoomExtra = 0;
let zoomPassed = 0; // counted, because "35 passed" over 37 printed lines is the same
                    // two-homes defect these two lines exist to catch.
{
  const { execFileSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const cwd = fileURLToPath(new URL('..', import.meta.url));
  const run = (args) => {
    try {
      return { out: execFileSync(process.execPath, ['tools/zoomunits.mjs', ...args], { cwd, encoding: 'utf8' }), code: 0 };
    } catch (e) {
      return { out: `${e.stdout || ''}${e.stderr || ''}`, code: e.status ?? 1 };
    }
  };
  // One reader for both lines: quote the tool's own terminated RESULT sentence.
  // `grab` is gone — it defaulted to '?' on a miss, so renaming a word in either
  // tool output printed a question mark inside a PASS (Bjorn's finding 1, same
  // class as the drift that started this). A verdict the harness cannot read in
  // full is a FAIL that says so, in both tests, through the same three lines.
  const quote = (out) => {
    const m = out.match(/^RESULT: (.*)$/m);
    if (!m) return { text: null, why: 'NO RESULT LINE — the harness could not read the tool' };
    if (!/\.$/.test(m[1])) return { text: null, why: `TRUNCATED RESULT — "${m[1]}" does not end the sentence, so the verdict wrapped and the harness read half of it` };
    return { text: m[1], why: null };
  };

  const self = run(['--selftest']);
  const selfV = quote(self.out);
  console.log(
    `${self.code === 0 && selfV.text ? 'PASS' : 'FAIL'}  36. the zoom-unit check still catches its own known-bad corpus` +
      ` — ${selfV.text || `zoomunits --selftest (exit ${self.code}): ${selfV.why}`}`
  );
  if (self.code !== 0 || !selfV.text) zoomExtra++;
  else zoomPassed++;

  const tree = run([]);
  // The detail is the tool's OWN RESULT line, quoted — not numbers scraped out of
  // it and recomposed here. Recomposing is a second home for the verdict, and it
  // drifted the day admissibility became a fourth failure condition the three
  // regexes did not know about: the suite printed FAIL beside a name that read
  // "0 new, 0 vanished". Quoting has no regex to widen, so a clause added to
  // RESULT reaches this line without anyone remembering to. And a run with NO
  // RESULT line is itself a failure: the harness could not read the tool, which
  // is not the same as the tool having nothing to say.
  // (Bjorn's ruling, 2026-07-28, over my proposal to add a fourth number — his
  // test is "did something become deletable?"; under this the whole `grab` helper did.)
  // A verdict is one whole terminated sentence on one line. Without the `.` test a
  // RESULT that ever wraps is quoted up to the wrap and PASSES on half a sentence —
  // the `?` defect in a new dress. Bjorn ruled the first wording, then wrapped the
  // line himself and watched it print `PASS … 9 carried, 0 new,`; this is his
  // corrected version, taken from his log rather than from a relay of it.
  const treeV = quote(tree.out);
  console.log(
    `${tree.code === 0 && treeV.text ? 'PASS' : 'FAIL'}  37. the carried set of unconverted px writes is exactly as recorded` +
      ` — ${treeV.text || `zoomunits (exit ${tree.code}): ${treeV.why}`}` +
      ` (\`node tools/zoomunits.mjs\` for the ledger, \`--raw\` for the bare red)`
  );
  if (tree.code !== 0 || !treeV.text) zoomExtra++;
  else zoomPassed++;

  // 38 — the BOUND, the arithmetic half only (EldenSpire#15, Marina's Rule 2).
  //
  // This is deliberately a small test with a loud boundary. Bounding cannot be
  // verified without layout, so no test in this file can ever discharge Rule 2 —
  // tools/zoomplace.mjs does that, in a browser, and nothing runs it automatically
  // yet (`#16`). What IS testable here is that clampBox never returns a box
  // outside the container it was given, including the cases a caller gets wrong:
  // a box bigger than the view, a negative input, keep larger than the box.
  //
  // The known-bad is the third case. Before the fix, tooltip.js clamped correctly
  // and rendered off-screen anyway, because it clamped in one space and wrote in
  // another — so a test that only fed clampBox sane numbers would have been green
  // against the actual defect. It cannot see that defect either. It says so.
  const { clampBox } = await import('../src/ui/fx.js');
  const view = { width: 1000, height: 800 };
  const inside = (b, w, h, pad) => b.left >= pad - 0.001 && b.top >= pad - 0.001 && b.left + w <= view.width - pad + 0.001 && b.top + h <= view.height - pad + 0.001;
  // No `incl. …` summary of what these cover: the case NAMES below are that
  // description and they are single-homed. The clause that used to sit in the PASS
  // line was a second copy with nothing holding it to the array, and it drifted —
  // delete the last case and it still claimed "a finite keep on BOTH far edges"
  // beside "6/6 cases". Measured or absent; a coverage claim no one maintains is
  // worse than none, because it reads as a guarantee. The failure path already
  // names the cases that broke.
  const cases = [
    ['a box already inside is not moved', () => {
      const r = clampBox({ left: 100, top: 100, width: 200, height: 100 }, view);
      return r.left === 100 && r.top === 100;
    }],
    ['a box off the right/bottom is pulled back inside', () => {
      const r = clampBox({ left: 1400, top: 1400, width: 200, height: 100 }, view);
      return inside(r, 200, 100, 4);
    }],
    ['a box off the left/top is pushed back inside', () => {
      const r = clampBox({ left: -900, top: -900, width: 200, height: 100 }, view);
      return inside(r, 200, 100, 4);
    }],
    ['a box larger than the view pins to the low edge, never slides off the far one', () => {
      const r = clampBox({ left: -5000, top: 5000, width: 4000, height: 3000 }, view);
      return r.left === 4 && r.top === 4;
    }],
    ['keep:40 lets a pointer-tracked box overhang, but never vanish', () => {
      const r = clampBox({ left: -5000, top: -5000, width: 200, height: 100 }, view, { keep: 40 });
      return r.left + 200 >= 44 && r.top + 100 >= 44 && r.left < 4 && r.top < 4;
    }],
    ['keep larger than the box degrades to the whole box, not to a negative bound', () => {
      const r = clampBox({ left: 9999, top: 9999, width: 20, height: 20 }, view, { keep: 500 });
      return inside(r, 20, 20, 4);
    }],
    // The far edge of the SAME rule, because `lo` and `hi` are different
    // expressions and the keep:40 case above exercises only `lo`. Its known-bad:
    // mutate `hi = span - pad - k` to `span - pad - size` and all six cases above
    // stay green while a pointer-tracked box loses its overhang (956 -> 796).
    // A finite `keep` on the high edge is the one branch nothing else watches —
    // no browser run reaches it — so this line is its only witness, and until now
    // it was a one-sided one.
    ['keep:40 overhangs the RIGHT/BOTTOM edge too, not just the left/top', () => {
      const r = clampBox({ left: 9999, top: 9999, width: 200, height: 100 }, view, { keep: 40 });
      return r.left + 200 > view.width - 4 && r.top + 100 > view.height - 4
          && r.left <= view.width - 4 - 40 + 0.001 && r.top <= view.height - 4 - 40 + 0.001;
    }],
  ];
  const bad = cases.filter(([, fn]) => !fn()).map(([n]) => n);
  console.log(
    `${bad.length ? 'FAIL' : 'PASS'}  38. clampBox keeps a box inside its named container` +
      ` — ${bad.length ? `failed: ${bad.join('; ')}` : `${cases.length}/${cases.length} cases.`}` +
      ` (arithmetic only — the space it is computed in is what #15 was, and no unit test can see that)`
  );
  if (bad.length) zoomExtra++;
  else zoomPassed++;

  // 39/40 — every navigable surface declared in data has a handler (#78).
  //
  // Two lines for the same reason 36/37 are two: 39 is the CHECK'S OWN
  // integrity — it plants every breakage an author could make by hand and must
  // see all of them. Its failure is the check's fault. 40 is the state of src/.
  // Its failure is the code's.
  //
  // NO COUNT IN THIS COMMENT, deliberately. It said "five" while the corpus held
  // seven, and it would say seven now that it holds eleven — a number typed
  // beside the list that owns it, which is the defect this whole card is about.
  // The tool's own RESULT line carries the count and 39 quotes it whole.
  //
  // Here rather than in engine.test.js, and that is deliberate: this joins two
  // lists that live in the UI layer, and engine.test.js is engine and content
  // invariants with numbered names that two files cannot both hand out (see the
  // note above 36). The verdict is the tool's own RESULT line, quoted whole —
  // Bjorn's ruling, and the reason is that a recomposed verdict is a second copy
  // of it.
  const runSurf = (args) => {
    try {
      return { out: execFileSync(process.execPath, ['tools/surfaces.mjs', ...args], { cwd, encoding: 'utf8' }), code: 0 };
    } catch (e) {
      return { out: `${e.stdout || ''}${e.stderr || ''}`, code: e.status ?? 1 };
    }
  };

  const surfSelf = runSurf(['--selftest']);
  const surfSelfV = quote(surfSelf.out);
  console.log(
    `${surfSelf.code === 0 && surfSelfV.text ? 'PASS' : 'FAIL'}  39. the surface check still catches its own known-bad corpus` +
      ` — ${surfSelfV.text || `surfaces --selftest (exit ${surfSelf.code}): ${surfSelfV.why}`}`
  );
  if (surfSelf.code !== 0 || !surfSelfV.text) zoomExtra++;
  else zoomPassed++;

  const surfTree = runSurf([]);
  const surfTreeV = quote(surfTree.out);
  console.log(
    `${surfTree.code === 0 && surfTreeV.text ? 'PASS' : 'FAIL'}  40. every declared navigable surface has a handler` +
      ` — ${surfTreeV.text || `surfaces (exit ${surfTree.code}): ${surfTreeV.why}`}` +
      ` (\`node tools/surfaces.mjs\` for the sets, \`--selftest\` for the reds)`
  );
  if (surfTree.code !== 0 || !surfTreeV.text) zoomExtra++;
  else zoomPassed++;

  // 41/42 — the screen census (Marina's ruling, 2026-08-07).
  //
  // WHY IT IS RUN HERE AND NOT BY A PERSON. `release-shots.mjs` did not start
  // for a whole day. Four gates missed it, and the reason is one sentence:
  // every one of them ran this suite, and that file is in nobody's suite — its
  // first run would have been at upload, by whoever was tired. A census that
  // reports the project's state to Constantine goes into exactly that category
  // the moment it exists, so it is wired in on the day it is written rather
  // than on the day it is missed.
  //
  // It CAN be, and that is the whole difference — no browser, no bundle, no
  // port. It is a join between the screens directory, the import graph and the
  // instrument sources. release-shots needs a built artifact and a browser and
  // therefore still needs Bjorn's answer; this is not that answer and does not
  // pretend to be one.
  //
  // Two lines for the same reason 36/37 and 39/40 are two: 41 is the CENSUS'S
  // OWN integrity — its whole known-bad corpus, including the both-edges plant
  // where a fully watched tree must stop alarming. Its failure is the check's
  // fault. 42 is the state of src/.
  //
  // THIS COMMENT USED TO SAY "42's failure is the code's" AND THAT WAS NOT TRUE.
  // Vira measured it while gating this pair: a census that cannot read one of
  // its homes, and the per-row `unreadable` floor, both land on 42 — so the slot
  // labelled for a defect in the game was also catching defects in the check.
  // The exit codes now carry as much of the split as they honestly can, and this
  // is what they actually implement:
  //
  //   42 red, exit 2 — the census could not be taken. A home stopped being
  //                    readable. THE CHECK'S FAULT, or the tree's, never the
  //                    game's; no counts are printed at all.
  //   42 red, exit 1 — a finding. Usually the game's (a screen nothing in src/
  //                    imports), sometimes still the census's (a module it can
  //                    derive no way to recognise). THE FINDING LINE NAMES ITS
  //                    OWNER, and that is the part a reader must use.
  //
  // The residue is deliberate and stated rather than smoothed: one exit code
  // cannot carry a distinction the findings list makes per row.
  //
  // NO PLANT COUNT HERE. This comment said "seven plants" and the corpus is now
  // larger; a count typed beside a list that lives in another file is the same
  // second-home defect this pair exists to catch, and it went stale the first
  // time the corpus grew. The tool's own RESULT line prints the count.
  //
  // NO COUNT IN THIS COMMENT, deliberately — the tool's RESULT line carries
  // every number with the ref it was counted at, and 42 quotes it whole. A
  // number typed beside the thing that owns it is what the census exists to
  // kill, and the top of commons/release-floor.md is why we know that.
  //
  // AND 42 PASSES WHILE SCREENS SIT UNWATCHED, on purpose. The exit code is
  // the health of the DERIVATION — a home that stopped being readable, a screen
  // nothing can mount. How many screens nobody watches is the state of the
  // project, and whether that is fit to ship is Sten's judgement against his
  // datum, not this suite's. The number is printed on every run so it cannot
  // hide; nothing here grades it.
  const runCensus = (args) => {
    try {
      return { out: execFileSync(process.execPath, ['tools/screen-census.mjs', ...args], { cwd, encoding: 'utf8' }), code: 0 };
    } catch (e) {
      return { out: `${e.stdout || ''}${e.stderr || ''}`, code: e.status ?? 1 };
    }
  };

  const censSelf = runCensus(['--selftest']);
  const censSelfV = quote(censSelf.out);
  console.log(
    `${censSelf.code === 0 && censSelfV.text ? 'PASS' : 'FAIL'}  41. the screen census still catches its own known-bad corpus` +
      ` — ${censSelfV.text || `screen-census --selftest (exit ${censSelf.code}): ${censSelfV.why}`}`
  );
  if (censSelf.code !== 0 || !censSelfV.text) zoomExtra++;
  else zoomPassed++;

  const censTree = runCensus(['--raw']);
  const censTreeV = quote(censTree.out);
  console.log(
    `${censTree.code === 0 && censTreeV.text ? 'PASS' : 'FAIL'}  42. every screen in the tree is mountable, and the census can still read it` +
      ` — ${censTreeV.text || `screen-census (exit ${censTree.code}): ${censTreeV.why}`}` +
      ` (\`node tools/screen-census.mjs\` for the checklist itself)`
  );
  if (censTree.code !== 0 || !censTreeV.text) zoomExtra++;
  else zoomPassed++;

  // 43–44 — CARD TEXT MARKS HAVE ONE HOME (Sunna). Same two-line shape as 36/37
  // and 41/42, and for the same reason: 43 is the check's own integrity, 44 is
  // the tree's state, and conflating them makes a broken check look like a clean
  // stylesheet.
  //
  // The defect: fillTemplate() emits the marks a player reads to see what an
  // upgrade changes, and its output is drawn in TWO containers — the card face
  // and the Smith/coop preview inside #tooltip. Every rule styling them was
  // keyed to `.card`, so the preview drew a number it had just computed as
  // CHANGED in the same colour and weight as the prose beside it. Constantine:
  // "I've never seen the upgrade preview before."
  //
  // Five rules were re-keyed at 60935d9. A sixth did not follow, because it
  // carried a hardcoded hex and the selector was the only place that hex could
  // live — every rule keyed to a TOKEN came through for free. That is why this
  // is a check and not a note: one rule surviving a re-key is an instance, a
  // rule that CAN survive one is a class.
  const runMark = (args) => {
    try {
      return { out: execFileSync(process.execPath, ['tools/markhome.mjs', ...args], { cwd, encoding: 'utf8' }), code: 0 };
    } catch (e) {
      return { out: `${e.stdout || ''}${e.stderr || ''}`, code: e.status ?? 1 };
    }
  };

  const markSelf = runMark(['--selftest']);
  const markSelfV = quote(markSelf.out);
  console.log(
    `${markSelf.code === 0 && markSelfV.text ? 'PASS' : 'FAIL'}  43. the card-text mark check still catches its own known-bad corpus` +
      ` — ${markSelfV.text || `markhome --selftest (exit ${markSelf.code}): ${markSelfV.why}`}`
  );
  if (markSelf.code !== 0 || !markSelfV.text) zoomExtra++;
  else zoomPassed++;

  const markTree = runMark(['--raw']);
  const markTreeV = quote(markTree.out);
  console.log(
    `${markTree.code === 0 && markTreeV.text ? 'PASS' : 'FAIL'}  44. every card-text mark rule reaches both places card text is drawn` +
      ` — ${markTreeV.text || `markhome (exit ${markTree.code}): ${markTreeV.why}`}` +
      ` (\`node tools/markhome.mjs\` for the ledger)`
  );
  if (markTree.code !== 0 || !markTreeV.text) zoomExtra++;
  else zoomPassed++;

  // 45–46 — EVERY NAMED IMPORT RESOLVES TO A REAL EXPORT.
  //
  // #88 renamed an export and left tools/release-shots.mjs standing. That tool
  // is the canonical release capture set and the release floor cited it as
  // green; it exited 1 before a browser launched. NOT A FAILED CHECK — A FAILED
  // LOAD, and the first thing that would have noticed was a person, at delivery
  // time. This suite's own BOUNDARY block below names release-shots as the half
  // covering what these tests cannot, and had never LOADED it once.
  //
  // Eleven instruments here are started by a human typing. linkcheck links every
  // module graph under src/, tools/ and tests/ WITHOUT EVALUATING ONE LINE — a
  // missing named export is an instantiation error, raised during linking — so
  // the whole class is caught for the price of no browser and no port.
  //
  // TWO LINES FOR THE SAME REASON 36/37, 39/40, 41/42 AND 43/44 ARE TWO: 45 is
  // the check's own integrity against its planted corpus, 46 is the state of the
  // tree. A tool that cannot go red is `unknown`, not green, whatever it prints.
  //
  // NO PLANT COUNT IN THIS COMMENT. The corpus lives in linkcheck.mjs and its
  // RESULT line carries the count; a number typed beside a list that lives in
  // another file is the second copy this suite exists to kill (see 41–42, which
  // deleted its own "seven plants" for the same reason).
  //
  // 45 HAS THREE RESULTS, NOT TWO, and the third is why it can be trusted:
  // caught / MISSED / UNPLANTABLE. UNTESTABLE covers the denominator — a tree
  // already carrying a broken import cannot score a corpus. UNPLANTABLE covers
  // the numerator — a plant whose edit did not land measures nothing, and a
  // silent no-op must never be reported as a catch or as a miss.
  const runLink = (args) => {
    try {
      return { out: execFileSync(process.execPath, ['tools/linkcheck.mjs', ...args], { cwd, encoding: 'utf8' }), code: 0 };
    } catch (e) {
      return { out: `${e.stdout || ''}${e.stderr || ''}`, code: e.status ?? 1 };
    }
  };

  const linkSelf = runLink(['--selftest']);
  const linkSelfV = quote(linkSelf.out);
  console.log(
    `${linkSelf.code === 0 && linkSelfV.text ? 'PASS' : 'FAIL'}  45. the link check still catches its own known-bad corpus` +
      ` — ${linkSelfV.text || `linkcheck --selftest (exit ${linkSelf.code}): ${linkSelfV.why}`}`
  );
  if (linkSelf.code !== 0 || !linkSelfV.text) zoomExtra++;
  else zoomPassed++;

  const linkTree = runLink(['--raw']);
  const linkTreeV = quote(linkTree.out);
  console.log(
    `${linkTree.code === 0 && linkTreeV.text ? 'PASS' : 'FAIL'}  46. every named import in the tree resolves to a real export` +
      ` — ${linkTreeV.text || `linkcheck (exit ${linkTree.code}): ${linkTreeV.why}`}` +
      ` (\`node tools/linkcheck.mjs\` names the file and the error)`
  );
  if (linkTree.code !== 0 || !linkTreeV.text) zoomExtra++;
  else zoomPassed++;

  // ---- 50/51. CAN A PLAYER EVER MEET THIS STATUS? (Rune, 2026-08-08) -------
  //
  // Law 1 clause 1 says a status is a row. Nothing checked that a row was ever
  // APPLIED, and two complete threshold-proc rows shipped that no player could
  // reach: `frost` (threshold 10, burst, Frost-Exposed, resist row, its own SFX
  // row) and `insanity` (threshold 14, guaranteed Stagger). Zero appliers, both.
  // Bleed had 25. THE CARD NAMED FROST NOVA APPLIED `weak` AND `vulnerable`.
  //
  // Everything downstream was green because everything downstream tested the
  // ROW: the engine procs them (7b, 7c, 7e, 7g), the validator rules on every
  // knob (7f), the SFX resolver answers them (35d). Not one of those checks
  // could tell a row with a door from a row without one — and 35d in
  // particular is the near miss: it walks `statuses.filter(s => s.proc)` and
  // proves each has a burst sound. The same population, one question earlier.
  //
  // TWO LINES, for the same reason 45/46 are two: 50 is the check's own
  // integrity against its planted corpus (including the two plants that must
  // go GREEN), 51 is the state of the tree. No plant count typed here — the
  // corpus lives in statusreach.mjs and its RESULT line carries the number.
  const runReach = (args) => {
    try {
      return { out: execFileSync(process.execPath, ['tools/statusreach.mjs', ...args], { cwd, encoding: 'utf8' }), code: 0 };
    } catch (e) {
      return { out: `${e.stdout || ''}${e.stderr || ''}`, code: e.status ?? 1 };
    }
  };

  // ---- 50-51: the grace refill (Constantine, 2026-08-08) -------------------
  //
  // TWO LINES FOR THE SAME REASON 45/46 ARE TWO: 50 is the check's own
  // integrity against its planted corpus, 51 is the state of the shipped table.
  // A refusal nobody has watched fail is `unknown`, not green.
  //
  // AND THE PLANTS ENTER BY THE DOOR THE REAL INPUT USES — a deep copy of the
  // real contentBundle handed to the real validateContent, and registries built
  // by createRegistries driving the real applyGraceRefill. The tool's header
  // says which door each plant uses; this comment does not restate the corpus,
  // and the count lives in its RESULT line, not here.
  const runGrace = (args) => {
    try {
      return { out: execFileSync(process.execPath, ['tools/gracerefill.mjs', ...args], { cwd, encoding: 'utf8' }), code: 0 };
    } catch (e) {
      return { out: `${e.stdout || ''}${e.stderr || ''}`, code: e.status ?? 1 };
    }
  };

  // 52/53 — every exported closed set has a reader (Marina's ask, out of the
  // PASSIVE_KEYS finding). Numbered after the current engine and status-reach
  // checks so this merged suite has one number line.
  const runSets = (args) => {
    try {
      return { out: execFileSync(process.execPath, ['tools/closedsets.mjs', ...args], { cwd, encoding: 'utf8' }), code: 0 };
    } catch (e) {
      return { out: `${e.stdout || ''}${e.stderr || ''}`, code: e.status ?? 1 };
    }
  };

  const reachSelf = runReach(['--selftest']);
  const reachSelfV = quote(reachSelf.out);
  console.log(
    `${reachSelf.code === 0 && reachSelfV.text ? 'PASS' : 'FAIL'}  50. the status-reach check still catches its own known-bad corpus` +
      ` — ${reachSelfV.text || `statusreach --selftest (exit ${reachSelf.code}): ${reachSelfV.why}`}`
  );
  if (reachSelf.code !== 0 || !reachSelfV.text) zoomExtra++;
  else zoomPassed++;

  const reachTree = runReach([]);
  const reachTreeV = quote(reachTree.out);
  console.log(
    `${reachTree.code === 0 && reachTreeV.text ? 'PASS' : 'FAIL'}  51. every shipped status has something that applies it` +
      ` — ${reachTreeV.text || `statusreach (exit ${reachTree.code}): ${reachTreeV.why}`}` +
      ` (\`node tools/statusreach.mjs\` names the row and the route)`
  );
  if (reachTree.code !== 0 || !reachTreeV.text) zoomExtra++;
  else zoomPassed++;

  const setsSelf = runSets(['--selftest']);
  const setsSelfV = quote(setsSelf.out);
  console.log(
    `${setsSelf.code === 0 && setsSelfV.text ? 'PASS' : 'FAIL'}  52. the closed-set check still catches its own known-bad corpus` +
      ` — ${setsSelfV.text || `closedsets --selftest (exit ${setsSelf.code}): ${setsSelfV.why}`}`
  );
  if (setsSelf.code !== 0 || !setsSelfV.text) zoomExtra++;
  else zoomPassed++;

  const setsTree = runSets([]);
  const setsTreeV = quote(setsTree.out);
  console.log(
    `${setsTree.code === 0 && setsTreeV.text ? 'PASS' : 'FAIL'}  53. every exported closed set is read by something` +
      ` — ${setsTreeV.text || `closedsets (exit ${setsTree.code}): ${setsTreeV.why}`}` +
      ` (\`node tools/closedsets.mjs\` for the table, \`--selftest\` for the reds)`
  );
  if (setsTree.code !== 0 || !setsTreeV.text) zoomExtra++;
  else zoomPassed++;

  const graceSelf = runGrace(['--selftest']);
  const graceSelfV = quote(graceSelf.out);
  console.log(
    `${graceSelf.code === 0 && graceSelfV.text ? 'PASS' : 'FAIL'}  54. the grace-refill refusals still catch their own known-bad corpus` +
      ` — ${graceSelfV.text || `gracerefill --selftest (exit ${graceSelf.code}): ${graceSelfV.why}`}`
  );
  if (graceSelf.code !== 0 || !graceSelfV.text) zoomExtra++;
  else zoomPassed++;

  const graceTree = runGrace([]);
  const graceTreeV = quote(graceTree.out);
  console.log(
    `${graceTree.code === 0 && graceTreeV.text ? 'PASS' : 'FAIL'}  55. a grace pours what balance.graceRefill says it pours` +
      ` — ${graceTreeV.text || `gracerefill (exit ${graceTree.code}): ${graceTreeV.why}`}` +
      ` (\`node tools/gracerefill.mjs\` names each row and what it resolves to)`
  );
  if (graceTree.code !== 0 || !graceTreeV.text) zoomExtra++;
  else zoomPassed++;
}

console.log(`\n${passed + zoomPassed} passed, ${failed + zoomExtra} failed`);
console.log('BOUNDARY: 1–35 are engine and content invariants. 36–37 are a CONSISTENCY');
console.log('          check over coordinate spaces — they prove a transform has two');
console.log('          homes, never that a pixel renders wrong. 38 is arithmetic on');
console.log('          numbers a caller supplies, and the #15 defect was a correct');
console.log('          clamp computed in the wrong space, which 38 cannot detect.');
console.log('          Nothing here opens a browser, so no test in this file has seen');
console.log('          the screen. `node tools/zoomplace.mjs` is the half that has.');
console.log('          39–40 are a JOIN between two source lists: they prove every');
console.log('          declared navigable surface HAS a handler, never that the');
console.log('          handler draws anything — release-shots is the half that has');
console.log('          watched a panel paint.');
console.log('          41–42 are a CENSUS, not a verdict: they prove every screen in');
console.log('          src/ui/screens/ is mountable and that the census can still read');
console.log('          its homes. A screen counted as reached is one an instrument NAMES');
console.log('          a way into — not one anything ran, passed, or photographed.');
console.log('          43–44 read SELECTORS, not pixels. They prove no card-text mark');
console.log('          rule is keyed to one of the two containers card text is drawn');
console.log('          in; they are silent on what colour it ends up, on inline styles,');
console.log('          and on any other route to one container only. The render');
console.log('          comparison that would close that has no home in this suite.');
console.log('          45–46 LINK, THEY DO NOT RUN. Every named import resolves to a real');
console.log('          export and not one module body was executed — so they prove the');
console.log('          eleven hand-started instruments START, never that any of them');
console.log('          WORKS. A name that exists but is wrong links green, and');
console.log('          release-shots must still be RUN by a person before a delivery.');
console.log('          50–51 prove a status has a DOOR, never that the door opens on');
console.log('          anything. They read definitions: nothing here says a card is in');
console.log('          a pool, that a run can draw it, or that the numbers are balanced.');
console.log('          Cases 7e2 and 7e3 separately exercise one real tagged hit for');
console.log('          each exposure; they do not prove broader card coverage.');
console.log('          52–53 ASK ONE QUESTION: is each exported closed set READ anywhere.');
console.log('          They are silent on whether a set has a second, hand-typed copy');
console.log('          somewhere — the defect that made the question worth asking. Green');
console.log('          means no vocabulary is decoration, never that none is duplicated.');
console.log('          54–55 NEVER OPEN A BROWSER. 54 proves the boot refusals fire and the');
console.log('          shrine pours, through the real bundle and the real registry; 55 reports');
console.log('          the shipped table. Neither has seen the settings rows or the shrine');
console.log('          sentence — those are photographed (`?shot=rest`), not asserted.');
console.log('          Neither settles whether 3+3 is release balance; the old no-Mana');
console.log('          A/B is stale, so that needs a Mana-aware simulation and player review.');
process.exit(failed + zoomExtra > 0 ? 1 : 0);
