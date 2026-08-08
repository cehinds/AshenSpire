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

const { passed, failed, results } = await runTests({ artManifest });
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
process.exit(failed + zoomExtra > 0 ? 1 : 0);
