#!/usr/bin/env node
// tools/verdict.mjs — THE CI DOOR. A TOOL'S SILENCE IS NOT ITS SUCCESS.
//
// THE DEFECT THIS EXISTS FOR (#12, Bjorn, 2026-07-28), re-derived and observed
// RED at `dev = 001c950` before this file was written:
//
//   $ node tools/verify-shipped.mjs        # recorder neutered
//   verify-shipped: OK — 0 checks passed.        exit 0
//   $ node one-line-stub.mjs               # main() never ran
//   (no output)                                  exit 0
//
// Every CI step in .github/workflows/ci.yml asserts ONE thing: that the process
// exited 0. So a tool that ran and found nothing, a tool whose `main()` never
// executed on this platform, and a tool that checked zero things are all the
// same green. SOP 2 already rules on this shape — *the absence of a red is not
// a green; there is no fourth, silent state* — and we wrote that guard for
// status queries and never turned it on our own tools.
//
// WHY THIS IS ONE FILE AND NOT A SPRINKLE ACROSS TWELVE TOOLS. The door CI
// actually knocks on is `node tools/<x>.mjs` + `$?`. A per-tool floor fixes the
// tool it is typed into and says nothing about the next tool somebody adds —
// twelve copies of one rule, drifting apart, is the second copy this house is
// named for. The rule belongs where the reading happens. (The lesson is my own,
// from the S7 bisect: I found a healthy control reported dead because ONE
// instrument's door was stale. Doors are where this class of defect lives.)
//
// THE CONTRACT, and it is deliberately the smallest thing that distinguishes
// silence from success: a tool that CI trusts must PRINT A COUNTED VERDICT.
// Not a new format nobody speaks — the house already speaks it:
//
//   verify-shipped: OK — 6 checks passed.
//   buildversion: OK — 8 checks passed
//   PASS — 27/27 shapes: every walled shape refuses legibly
//   map-camera persistence: GREEN (6/6)
//   95 passed, 0 failed
//
// This file reads those. What it refuses is a zero and a silence.
//
// Usage
//   node tools/verdict.mjs -- node tools/verify-shipped.mjs
//   node tools/verdict.mjs --min 4 -- node tools/buildversion.mjs --check
//   node tools/verdict.mjs --selftest      the known-bads, each run end to end
//
// Exit codes — and they are DISTINCT ON PURPOSE, because "it failed" and "it
// said nothing" need different fixes and a single code would merge them again:
//   0  the wrapped tool exited 0 AND printed a verdict counting >= --min (1)
//   1  the wrapped tool's verdict counted 0, or it printed two verdicts
//   3  the wrapped tool exited 0 and printed NO countable verdict — SILENCE
//   2  usage error in this file, BEFORE any child is spawned
//   4  the wrapped tool was KILLED BY A SIGNAL before reporting — the
//      environment stopped it (timeout, OOM, ENOSPC). Not a failure, not a
//      pass: nothing was measured, so nothing may be concluded.
//   *  ANY NONZERO CODE A WRAPPED TOOL EXITS WITH IS RETURNED VERBATIM and
//      takes precedence over every row above. `2` from a browser probe means
//      THE INSTRUMENT WAS UNAVAILABLE — unknown, which blocks and is not the
//      same state as `1`, a check that ran and failed. This door reports
//      states; it does not merge them.
//
// BOUNDARY, named rather than left to be found:
//   · This proves a tool SAID it checked N things. It cannot prove the N checks
//     were the right ones, or that any of them could fail — that is each tool's
//     own `--selftest`/`--mutate` corpus, and this file neither replaces nor
//     audits one. A tool printing "OK — 40 checks passed" while checking forty
//     tautologies walks through this door.
//   · It reads stdout and stderr as text. A tool that prints its verdict only
//     to a file is invisible here and must be wrapped by its own runner.
//   · The pattern table below is a CLOSED SET a reader can enumerate. A tool
//     whose verdict grammar is not in it is treated as SILENT — loudly, with
//     the tool named — rather than waved through. That is the safe direction.

import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// THE COUNTED-VERDICT GRAMMAR. Each entry: a name a human can grep for, a
// regex, and which capture group holds the count of things actually checked.
// ADDING A ROW IS A CONTRACT CHANGE and needs a plant in SELFTEST below.
const NEGATION = /\b(?:not|never|no|un)\b/i;

// THE CONTRADICTION RULE, AND IT IS ONE ANCHORED RULE RATHER THAN A LIST OF
// PHRASINGS. Twice now I closed a shape and left the class: `4 failed` was
// refused while `4 checks failed` walked through, because the filter demanded
// the failure word IMMEDIATELY after the number. A third phrasing always
// exists, so the fix stops enumerating them.
//
// THE RULE: a verdict line may carry no NONZERO number that (a) is not part of
// the verdict's own captured count and (b) sits in failure context. The
// anchor is the CAPTURE — every digit the matched row consumed is exempt by
// SPAN, so a mutation tool's honest `6/6 observed red` and `5 reinstatements
// of the defect, 5 caught` stay green while `9 checks passed, 4 checks failed`
// and `12 checks passed (2 errors)` do not. Word order, intervening nouns and
// punctuation stop mattering, which is what "general" has to mean here.
const FAILURE_SENSE = /\b(?:fail\w*|error\w*|miss\w*|uncaught|unresolved|broken|withheld|red)\b/i;
const FAILURE_WINDOW = 48;

/** Every digit-run the matched row consumed, as [start,end) spans. */
function consumedSpans(m) {
  const spans = [];
  if (m.indices) for (let g = 1; g < m.indices.length; g++) if (m.indices[g]) spans.push(m.indices[g]);
  return spans;
}

/** A nonzero number outside the verdict's own count, sitting in failure context. */
function contradiction(line, m) {
  const spans = consumedSpans(m);
  for (const num of line.matchAll(/\d+/g)) {
    const [a, b] = [num.index, num.index + num[0].length];
    if (spans.some(([s, e]) => a >= s && b <= e)) continue;      // the verdict's own count
    if (Number(num[0]) === 0) continue;                          // "0 failed" is a pass
    const near = line.slice(Math.max(0, a - FAILURE_WINDOW), b + FAILURE_WINDOW);
    const hit = near.match(FAILURE_SENSE);
    if (hit) return { count: num[0], word: hit[0] };
  }
  return null;
}

// THE TERMINAL-SUCCESS GRAMMAR, and every row is a FULL LINE, anchored.
// Each row returns a positive count ONLY when the line states an unqualified
// success: a ratio must be whole (n === m) and a suite must report zero
// failures. A row returning null is a line that matched shape and FAILED its
// own success test — refused, never counted.
//
// EVERY ROW SHIPS WITH A PLANT (see SELFTEST). Adding one is a contract change.
const VERDICTS = [
  { name: 'label: OK — N checks passed',
    re: /^\s*[\w][\w .+/-]*:\s*OK\b[^\n]*?(\d+)\s+checks?\s+passed\b[^\n]*$/di,
    count: (m) => Number(m[1]) },
  { name: 'label: OK — N of M ... ran',
    re: /^\s*[\w][\w .+/-]*:\s*OK\b[^\n]*?(\d+)\s+of\s+(\d+)\b[^\n]*\bran\b[^\n]*$/di,
    count: (m) => (Number(m[1]) === Number(m[2]) ? Number(m[1]) : null) },
  { name: 'label: OK — N ..., N caught',
    re: /^\s*[\w][\w .+/-]*:\s*OK\b[^\n]*?(\d+)\s+[^\n]*?,\s*(\d+)\s+caught\b[^\n]*$/di,
    count: (m) => (Number(m[1]) === Number(m[2]) ? Number(m[2]) : null) },
  { name: 'label: OK — N/N <noun>',
    re: /^\s*[\w][\w .+/-]*:\s*OK\s*[—-]\s*(\d+)\s*\/\s*(\d+)\b[^\n]*$/di,
    count: (m) => (Number(m[1]) === Number(m[2]) ? Number(m[1]) : null) },
  { name: 'PASS — n/m',
    re: /^\s*PASS\s*[—-]\s*(\d+)\s*\/\s*(\d+)\b[^\n]*$/di,
    count: (m) => (Number(m[1]) === Number(m[2]) ? Number(m[1]) : null) },
  { name: 'label: GREEN (n/m)',
    re: /^\s*[\w][\w .+/-]*:\s*GREEN\s*\((\d+)\s*\/\s*(\d+)\)[^\n]*$/di,
    count: (m) => (Number(m[1]) === Number(m[2]) ? Number(m[1]) : null) },
  { name: 'N passed, M failed',
    re: /^\s*(\d+)\s+passed,\s*(\d+)\s+failed\b[^\n]*$/di,
    count: (m) => (Number(m[2]) === 0 ? Number(m[1]) : null) },
];

/**
 * readVerdict(text) → { count, form, line } | { error, … }
 *
 * THE CARD'S CONTRACT, VERBATIM (#12): *"Every tool CI runs prints EXACTLY ONE
 * TERMINATED VERDICT LINE carrying a count of what it checked, and every CI
 * step asserts that line, not the exit code."* So this is not a search for the
 * best-looking number in a stream — it is a census of terminal verdict lines,
 * and anything other than exactly one is a refusal.
 *
 * WHY IT IS THIS STRICT, and both holes were found by reviewers on this PR's
 * own head rather than by me: a highest-count substring match green-lit
 * `NOT PASS — 1/10`, `1 passed, 4 failed`, `PASS — 1/27`, and a `9 checks
 * passed` later corrected to `0 checks passed`. A door that admits a stated
 * failure is the same defect as a door that admits silence, wearing a number.
 */
export function readVerdict(text) {
  const lines = String(text).split(/\r?\n/);
  const hits = [];
  const refused = [];
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    for (const v of VERDICTS) {
      const m = line.match(v.re);
      if (!m) continue;
      // A NEGATED LINE IS NEVER A VERDICT. `NOT PASS`, `no checks passed`.
      if (NEGATION.test(line)) { refused.push({ line: line.trim(), why: 'negated' }); break; }
      const contra = contradiction(line, m);
      if (contra) {
        refused.push({ line: line.trim(), why: `states ${contra.count} "${contra.word}" alongside its success count` });
        break;
      }
      const n = v.count(m);
      if (n === null) { refused.push({ line: line.trim(), why: 'states a failure or a partial ratio' }); break; }
      hits.push({ count: n, form: v.name, line: line.trim() });
      break;
    }
  }
  if (hits.length === 1) return hits[0];
  if (hits.length === 0) return { error: 'none', refused };
  return { error: 'many', hits, refused };
}

async function runOne(cmd, argv, { min, quiet = false, env } = {}) {
  return new Promise((done) => {
    let out = '';
    const child = spawn(cmd, argv, { cwd: ROOT, env: { ...process.env, ...(env || {}) } });
    const tee = (chunk, sink) => { out += chunk; if (!quiet) sink.write(chunk); };
    child.stdout.on('data', (c) => tee(String(c), process.stdout));
    child.stderr.on('data', (c) => tee(String(c), process.stderr));
    child.on('error', (e) => done({ code: 2, out, note: `could not run: ${e.message}` }));
    child.on('close', (code, signal) => {
      const label = [cmd, ...argv].join(' ');
      // KILLED IS ITS OWN STATE, AND IT WAS READING AS A PASS. Node calls
      // `close` with code === null and the signal separately when a child is
      // terminated — SIGTERM from a timeout, SIGKILL from an OOM killer. This
      // branch returned that null, and `process.exit(null)` coerces to 0: a
      // checker killed BEFORE it could print anything made the step GREEN.
      //
      // NOT THEORETICAL. This box ran out of disk tonight and killed a corpus
      // mid-run (a sibling's --selftest died of ENOSPC partway through; another
      // seat's pass ran at 67 MB free). Under the old branch, a runner that
      // OOM-kills a browser probe does not report a starved instrument — it
      // reports a pass. That is this card's thesis at its most literal: the
      // tool said nothing because it was DEAD, and the door called it success.
      //
      // It gets its own code (4) rather than being folded into 1, because
      // "killed by the environment" and "a check ran and failed" send a reader
      // to different places — and this door has been caught four times merging
      // states it exists to keep apart.
      if (signal) {
        return done({
          code: 4, out, signal,
          note: `KILLED: ${label} was terminated by ${signal} before it could report.\n`
            + '  This is not a failure and it is not a pass — the instrument was stopped by the\n'
            + '  environment (a timeout, or an OOM/ENOSPC kill). Re-run it on a healthy runner\n'
            + '  before reading anything into the result.',
        });
      }
      // A RED STAYS RED, AND IT IS NOT RE-JUDGED. If the tool already failed,
      // this file adds nothing and must not convert its exit code.
      // THE CHILD'S CODE COMES BACK VERBATIM. Hard-coding 1 here erased a
      // distinction this repo paid a real CI run to learn, and ci.yml says so
      // in its own voice: *"The probe exits 2 when the instrument is
      // unavailable, which is red on purpose: `unknown` blocks, and it must
      // never read as a pass. It exits 1 only when a check actually RAN and
      // failed. THOSE TWO WERE THE SAME EXIT CODE UNTIL RUN 1 OF THIS WORKFLOW
      // TAUGHT ME OTHERWISE."* A door that maps many states onto one is the
      // same defect as a tool that prints none — and mine said "propagated"
      // while doing it, so the receipt lied too. Fourth distinction this door
      // has been caught collapsing: silence-vs-success, failure-vs-success,
      // unknown-vs-failure.
      if (code !== 0) return done({ code, out, note: `${label} exited ${code} — propagated verbatim (unknown is not failure)` });
      const v = readVerdict(out);
      if (v.error === 'none') {
        const near = v.refused.length
          ? `\n  Lines that looked like verdicts and were REFUSED:\n${v.refused.map((r) => `    · "${r.line}" — ${r.why}`).join('\n')}`
          : '';
        return done({
          code: 3, out,
          note: `SILENCE: ${label} exited 0 and printed no terminal success verdict.\n`
            + `  A tool that checked nothing and a tool that found nothing are the same green (#12).\n`
            + `  Fix: print exactly one terminated line in a known form — ${VERDICTS.map((x) => `"${x.name}"`).join(', ')}.${near}`,
        });
      }
      if (v.error === 'many') {
        return done({
          code: 1, out,
          note: `AMBIGUOUS: ${label} printed ${v.hits.length} terminal verdict lines; the contract is EXACTLY ONE (#12).\n`
            + v.hits.map((h) => `    · "${h.line}" [${h.form}]`).join('\n')
            + `\n  A tool that changes its mind (9 checks passed … then 0) must not be readable as either.`,
        });
      }
      if (v.count < min) {
        return done({
          code: 1, out,
          note: `ZERO-WORK GREEN: ${label} exited 0 but its verdict counts ${v.count} (floor ${min}).\n`
            + `  Verdict read: "${v.line}" [${v.form}]`,
        });
      }
      done({ code: 0, out, note: `verdict: ${v.count} via [${v.form}] — "${v.line}"` });
    });
  });
}

// ---------------------------------------------------------------------------
// THE KNOWN-BADS. Each is a real child process run end to end through the same
// function CI uses — never a string handed to the matcher, because the thing
// being proven is the DOOR, and a matcher unit-test walks past it.
const SELFTEST = [
  // ---- THE TWO FIXTURES THE CARD REQUIRES, run from their real paths. ----
  { fixture: 'tests/fixtures/verdict/silent_exit_zero.mjs',
    name: "#12 fixture: prints nothing, exits 0 → SILENCE", want: 3 },
  { fixture: 'tests/fixtures/verdict/vacuous_green.mjs',
    name: '#12 fixture: well-formed verdict counting ZERO → refused', want: 1 },

  // ---- THE ARGV PLANT. The door's own worst defect: wrapper flags parsed
  // from the whole argv made a wrapped `--selftest` run THIS corpus instead of
  // the child's. The plant proves the child actually executes. ----
  { name: 'a wrapped --selftest REACHES ITS CHILD (never this corpus)',
    file: 'if (process.argv.includes("--selftest")) { console.log("child-guard: OK — 4 checks passed."); process.exit(0); }\n'
      + 'console.log("child ran without its flag"); process.exit(1);\n',
    args: ['--selftest'], want: 0, mustSay: 'child-guard' },

  // ---- THE REVIEWERS' FIVE, each reproduced exit-0-through-the-door before
  // the strict matcher landed. A door that admits a STATED FAILURE is the same
  // defect as one that admits silence, wearing a number. ----
  { name: 'negated: "NOT PASS — 1/10"', file: 'console.log("NOT PASS — 1/10"); process.exit(0);\n', want: 3 },
  { name: 'negated: "NOT GREEN (1/9)"', file: 'console.log("NOT GREEN (1/9)"); process.exit(0);\n', want: 3 },
  { name: 'a suite reporting failures: "1 passed, 4 failed"', file: 'console.log("1 passed, 4 failed"); process.exit(0);\n', want: 3 },
  { name: 'a CONTRADICTORY summary: "OK — 9 checks passed, 4 failed"',
    file: 'console.log("tool: OK — 9 checks passed, 4 failed"); process.exit(0);\n', want: 3 },
  // THE ESCAPE A REVIEWER FOUND, plus two phrasings neither of us named: the
  // rule is now general, so it must swallow all of them.
  { name: 'an intervening noun does not hide it: "9 checks passed, 4 checks failed"',
    file: 'console.log("tool: OK — 9 checks passed, 4 checks failed"); process.exit(0);\n', want: 3 },
  { name: 'reverse order is refused too: "failures: 4"',
    file: 'console.log("tool: OK — 9 checks passed; failures: 4"); process.exit(0);\n', want: 3 },
  { name: 'a phrasing nobody enumerated: "4 uncaught"',
    file: 'console.log("tool: OK — 9 checks passed, 4 uncaught"); process.exit(0);\n', want: 3 },
  // AND THE RULE MUST NOT EAT AN HONEST MUTATION VERDICT: the counted red IS
  // the success there, and its digits are the verdict's own capture.
  { name: 'a mutation verdict counting red is still a pass',
    file: 'console.log("buildstamp-shot --selftest: OK — 6/6 observed red, each named by the failure it should"); process.exit(0);\n', want: 0 },
  { name: 'and a defect-counting mutate verdict is still a pass',
    file: 'console.log("dirorder --mutate: OK — 5 reinstatements of the defect, 5 caught."); process.exit(0);\n', want: 0 },
  { name: 'and its zero form is still a pass: "OK — 9 checks passed, 0 failed"',
    file: 'console.log("tool: OK — 9 checks passed, 0 failed"); process.exit(0);\n', want: 0 },
  { name: 'a trailing error count is refused too',
    file: 'console.log("tool: OK — 12 checks passed (2 errors)"); process.exit(0);\n', want: 3 },
  { name: 'a partial ratio: "PASS — 1/27"', file: 'console.log("PASS — 1/27 shapes"); process.exit(0);\n', want: 3 },
  { name: 'changed its mind: 9 checks passed, then 0', want: 1,
    file: 'console.log("tool: OK — 9 checks passed."); console.log("tool: OK — 0 checks passed."); process.exit(0);\n' },

  // ---- SILENCE AND PROPAGATION ----
  { name: 'unknown grammar reads as silence, loudly', file: 'console.log("everything is fine, trust me"); process.exit(0);\n', want: 3 },
  { name: 'a tool that FAILED keeps its own red (not re-judged)', file: 'console.log("tool: FAILED 2 of 5."); process.exit(1);\n', want: 1 },
  // EXIT-CODE FIDELITY, BY NAME. 2 is "the instrument was unavailable"
  // (unknown, blocks); 1 is "a check ran and failed". They are different
  // sentences and the door must not merge them.
  // A CHILD KILLED MID-RUN. `process.exit(null)` used to coerce this to 0.
  { name: 'a checker KILLED by SIGTERM comes out 4, never 0',
    file: 'console.log("starting a long check..."); process.kill(process.pid, "SIGTERM");\n', want: 4, mustSay: 'KILLED' },
  { name: 'a checker KILLED by SIGKILL (the OOM shape) comes out 4',
    file: 'process.kill(process.pid, "SIGKILL");\n', want: 4, mustSay: 'KILLED' },
  { name: 'and a killed child that had ALREADY printed a good verdict is still killed',
    file: 'console.log("tool: OK — 9 checks passed."); process.kill(process.pid, "SIGTERM");\n', want: 4, mustSay: 'KILLED' },
  { name: 'a child exiting 2 (instrument unavailable) comes out 2, not 1',
    file: 'process.exit(2);\n', want: 2 },
  { name: 'a child exiting 1 (a check ran and failed) comes out 1',
    file: 'console.log("tool: FAILED 2 of 5."); process.exit(1);\n', want: 1 },
  { name: 'an unusual code (77) is not flattened either',
    file: 'process.exit(77);\n', want: 77 },
  { name: 'a counted verdict printed while FAILING is still red',
    file: 'console.log("tool: OK — 9 checks passed."); process.exit(1);\n', want: 1 },
  { name: 'two DIFFERENT good verdicts are ambiguous, not "the best one"',
    file: 'console.log("a: OK — 9 checks passed."); console.log("PASS — 3/3 shapes"); process.exit(0);\n', want: 1 },

  // ---- ONE PLANT PER GRAMMAR ROW (adding a row is a contract change) ----
  { name: 'row: label: OK — N checks passed', file: 'console.log("verify-shipped: OK — 6 checks passed."); process.exit(0);\n', want: 0 },
  { name: 'row: label: OK — N of M ... ran',
    file: 'console.log("shotguard --selftest-unavailable: OK — 3 of 3 unavailability paths ran and all resolved to 2."); process.exit(0);\n', want: 0 },
  { name: 'row: label: OK — N ..., N caught',
    file: 'console.log("dirorder --mutate: OK — 5 reinstatements of the defect, 5 caught."); process.exit(0);\n', want: 0 },
  { name: 'row: label: OK — N/N <noun>', file: 'console.log("buildstamp-shot: OK — 4/4 placements photographed"); process.exit(0);\n', want: 0 },
  { name: 'row: PASS — n/m', file: 'console.log("PASS — 27/27 shapes: every walled shape refuses"); process.exit(0);\n', want: 0 },
  { name: 'row: label: GREEN (n/m)', file: 'console.error("map-camera persistence: GREEN (6/6)"); process.exit(0);\n', want: 0 },
  { name: 'row: N passed, M failed', file: 'console.log("94 passed, 0 failed"); process.exit(0);\n', want: 0 },

  // ---- THE THREE TOOL SUMMARIES CHANGED FOR THIS CARD, each quoted from the
  // tool's own new output. #12's scope names launch.mjs, and a builder is not
  // exempt; verify-shipped's and dirorder's --selftest lines were countless
  // ("every known-bad case failed for its named reason"), so a corpus that
  // shrank to zero read identically. The fix is the TOOL saying it correctly. ----
  { name: 'tool change: launch --build-only now counts its aliases',
    file: 'console.log("launch: OK — 3/3 current-build aliases refreshed."); process.exit(0);\n', want: 0 },
  { name: 'tool change: verify-shipped --selftest now counts its cases',
    file: 'console.log("verify-shipped --selftest: OK — 25 checks passed."); process.exit(0);\n', want: 0 },
  { name: 'tool change: dirorder --selftest now counts its cases',
    file: 'console.log("dirorder --selftest: OK — 9 checks passed."); process.exit(0);\n', want: 0 },
  // A LAUNCH THAT COPIED NOTHING IS REFUSED — as a PARTIAL ratio (exit 3, no
  // terminal success), not as a zero count. The two refusals are different
  // sentences and the corpus keeps them apart: my first expectation here said
  // 1, the door said 3, and the door was right.
  { name: 'tool change: shotguard now counts its checks',
    file: 'console.log("shotguard: OK — 8 checks passed; ?shot= cannot reach the save."); process.exit(0);\n', want: 0 },
  { name: 'tool change: shotguard --mutate says CAUGHT, not "failed N"',
    file: 'console.log("shotguard --mutate: OK — 4 defeat(s) planted, 4 caught."); process.exit(0);\n', want: 0 },
  { name: 'and its OLD wording — "correctly failed 4 check(s)" — is refused',
    file: 'console.log("shotguard --mutate: OK — gate defeated, probe correctly failed 4 check(s):"); process.exit(0);\n', want: 3 },
  { name: 'a launch that copied NOTHING is refused (partial ratio → silence)',
    file: 'console.log("launch: OK — 0/3 current-build aliases refreshed."); process.exit(0);\n', want: 3 },
  { name: 'a whole-but-empty ratio IS a zero count (0/0 → refused as vacuous)',
    file: 'console.log("t: OK — 0/0 placements photographed"); process.exit(0);\n', want: 1 },

  // ---- AND EACH RATIO ROW REFUSES ITS OWN PARTIAL FORM ----
  { name: 'row refuses partial: OK — 3 of 4 ... ran', file: 'console.log("t: OK — 3 of 4 paths ran"); process.exit(0);\n', want: 3 },
  { name: 'row refuses partial: OK — 4 ..., 3 caught', file: 'console.log("t: OK — 4 defects, 3 caught."); process.exit(0);\n', want: 3 },
  { name: 'row refuses partial: OK — 3/4 placements', file: 'console.log("t: OK — 3/4 placements photographed"); process.exit(0);\n', want: 3 },
  { name: 'row refuses partial: GREEN (5/6)', file: 'console.log("t: GREEN (5/6)"); process.exit(0);\n', want: 3 },
];

async function selftest() {
  const dir = mkdtempSync(resolve(tmpdir(), 'verdict-selftest-'));
  let bad = 0;
  console.log('verdict.mjs --selftest — the door, run end to end on real child processes\n');
  console.log('DOOR: each plant is a FILE executed by `node`, wrapped by the same runOne()');
  console.log('      the CI steps use. Nothing is handed to the matcher directly.\n');
  try {
    for (const p of SELFTEST) {
      // A FIXTURE ENTERS BY ITS REAL PATH; a plant is written and executed as a
      // file. Neither is handed to the matcher — the thing proven is the door.
      const f = p.fixture ? resolve(ROOT, p.fixture) : resolve(dir, `plant-${SELFTEST.indexOf(p)}.mjs`);
      if (!p.fixture) writeFileSync(f, p.file);
      else if (!existsSync(f)) {
        bad++; console.log(`  MISSING  ${p.fixture} — the card requires this fixture to exist`);
        continue;
      }
      const r = await runOne(process.execPath, [f, ...(p.args || [])], { min: 1, quiet: true });
      let ok = r.code === p.want;
      // `mustSay` proves the CHILD spoke — the argv plant's whole point.
      if (ok && p.mustSay && !`${r.out}${r.note || ''}`.includes(p.mustSay)) ok = false;
      if (!ok) bad++;
      console.log(`  ${ok ? 'CAUGHT ' : 'MISSED '} exit ${r.code} (want ${p.want})  ${p.name}`);
      if (!ok) console.log(`      note: ${(r.note || '').split('\n')[0] || 'child output did not carry ' + p.mustSay}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  console.log('');
  if (bad) {
    console.error(`verdict --selftest: RED — ${bad} plant(s) not caught. The door does not close.`);
    process.exit(1);
  }
  // This tool obeys its own contract: its verdict is counted, so a CI step may
  // wrap it in itself and the silence rule applies to the silence-checker too.
  console.log(`verdict --selftest: OK — ${SELFTEST.length} checks passed.`);
  process.exit(0);
}

// WRAPPER FLAGS ARE READ ONLY BEFORE THE `--` SEPARATOR, AND THIS LINE IS THE
// WHOLE FIX FOR THE WORST DEFECT THIS FILE EVER HAD. Parsing the full argv made
// `verdict -- node tools/verify-shipped.mjs --selftest` run THIS FILE'S corpus
// and exit 0 without ever spawning the child: the door built to make a tool's
// silence audible would have silently REPLACED four guards with itself and
// reported green — the card's own defect class, inside the card's own fix.
// Found by two reviewers independently, on the PR's own head, after a clean
// local run. The plants below prove a wrapped `--selftest` reaches its child.
// MAIN-MODULE GUARD — and finding it here is the night's lesson applied to
// itself. I added exactly this to workflow-lint.mjs an hour ago, after
// importing it ran the CLI and exited my caller, and I did not carry the fix
// to its sibling: importing verdict.mjs to reuse `readVerdict` ran the whole
// door and exited 2. Fix the CLASS, not the file that happened to bite.
const IS_MAIN = import.meta.url === pathToFileURL(process.argv[1] || '').href;

const argv = IS_MAIN ? process.argv.slice(2) : [];
const sep = argv.indexOf('--');
const mine = sep >= 0 ? argv.slice(0, sep) : argv;
const rest = sep >= 0 ? argv.slice(sep + 1) : [];

if (IS_MAIN && mine.includes('--selftest')) { await selftest(); }

if (IS_MAIN) {
const minIdx = mine.indexOf('--min');
const min = minIdx >= 0 ? Number(mine[minIdx + 1]) : 1;
if (!Number.isInteger(min) || min < 1) {
  console.error('verdict: --min takes a positive integer');
  process.exit(2);
}
if (!rest.length) {
  console.error('usage: node tools/verdict.mjs [--min N] -- <command> [args...]');
  console.error('  the `--` is REQUIRED: wrapper flags are read only before it.');
  process.exit(2);
}

const r = await runOne(rest[0], rest.slice(1), { min });
if (r.code === 0) console.log(`\nverdict: OK — ${r.note}`);
else console.error(`\nverdict: ${r.note}`);
process.exit(r.code);
}
