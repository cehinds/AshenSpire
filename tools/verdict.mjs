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
//   2  THE HARNESS COULD NOT RUN — nothing was measured, so nothing may be
//      concluded. Three roads reach it: a usage error in this file BEFORE any
//      child is spawned; a child that could not be spawned at all; and A CHILD
//      THAT DIED OF AN UNHANDLED EXCEPTION. That last one is why this row was
//      rewritten — see HARNESS DEATH, below.
//   4  the wrapped tool was KILLED BY A SIGNAL before reporting — the
//      environment stopped it (timeout, OOM, ENOSPC). Not a failure, not a
//      pass: nothing was measured, so nothing may be concluded.
//      POSIX ONLY. Windows has no signal delivery: a terminated child is
//      reported with a real exit code (1, measured) and signal === null, so it
//      comes back through the propagation rule above. The INVARIANT holds on
//      every platform — a child that died without speaking is never 0 — but on
//      Windows `killed` and `failed` are the same code, which is the
//      platform's collapse and is named here rather than papered over.
//
// HARNESS DEATH — THE ONE STATE THIS DOOR WAS STILL MERGING, and it is the
// commonest instrument death in this tree. An unhandled throw or rejection in a
// Node child exits **1**, and `1` is this door's word for *a check ran and
// failed*. So the door reported a dead harness as a finding: the exact merge the
// file exists to refuse, sitting in the file's own propagation rule. Saga
// measured it against this PR's thesis and the thesis was unmet.
//
// NOT THEORETICAL, AND NOT MINE. Viki hit it the same day: `armoury-picked-up
// .mjs` exited 1 on an unhandled `timeout picker` and reported a harness death
// in a finding's clothes. She moved HER tool to exit 2. A door is the wrong
// place to fix one tool at a time — that is this card's founding argument — so
// the rule belongs here, in her vocabulary: **2 = HARNESS could not run.**
//
// THE DISCRIMINATOR, and it is narrow on purpose: exit code exactly 1, no
// signal, AND the child's captured output carries Node's FATAL-EXCEPTION
// SIGNATURE — a stack frame (`\n    at `) together with the `Node.js vX.Y.Z`
// trailer Node prints only on the uncaught-exception/unhandled-rejection path.
// Restricted to 1 because 1 is the only code that collides; 2, 4 and 77 already
// say distinct things and are untouched.
//
// ITS BOUNDARY, named rather than left to be found:
//   · A tool that CATCHES its own error and deliberately exits 1 — even one
//     that prints a stack — is a FINDING and stays 1. The trailer is the tell,
//     and there is a plant for exactly that shape.
//   · The trailer is NODE'S. A python or shell harness that dies unhandled
//     exits 1 with no signature and is still read as a finding. Every child in
//     this tree's CI is `node`; the day one is not, this discriminator is blind
//     to it and says so here rather than in a starved run.
//   · A child that prints the trailer text itself while exiting 1 is
//     misread. It is a lie a tool has to work at, and the safe direction: the
//     failure mode is "blocked as unknown", never "green".
//
//   *  ANY OTHER NONZERO CODE A WRAPPED TOOL EXITS WITH IS RETURNED VERBATIM and
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
// ONE LIST. There were two readings of "what counts as a negation" in this
// file — this regex (not|never|no|un) and, 130 lines down, a denegation path
// that stripped only `not` and `no`. So `NEVER PASS — 1/10` was recognised by
// neither: not a verdict row (it does not start with PASS), and not a NEGATED
// verdict shape either, so it never reached `refused` and a later success won
// the door outright — a checker that reported failure exiting GREEN on retry.
//
// The fix is not to add `never` to the second list. It is for there to BE no
// second list: both regexes are built from these words, so the two readings
// cannot drift apart again. Same defect as the CLI counting steps with its own
// regex while the parser used another — a second reader of one question.
// ONE LIST — AND CONSULTED AT EVERY POSITION A VERDICT TOKEN CAN APPEAR.
//
// THE RULE THIS FILE KEEPS RELEARNING, written once so the next reader gets it
// for free: A DECISION MADE CORRECTLY IS WORTH NOTHING AT THE SITES THAT DO NOT
// CONSULT IT. I closed the negation vocabulary into one list — correct — and
// then applied it at one site: the start of the line. So `tool: NEVER OK — 9
// checks passed` reached neither `hits` nor `refused`, and a later success line
// stood as the sole verdict: THE DOOR EXITED GREEN ON A CHECKER THAT SAID
// "NEVER OK". Same defect as finding 33, one position over, an hour later.
//
// A closed set is closed only if there is exactly ONE of it AND every place a
// verdict token can appear consults it. Vocabulary and POSITION are two axes
// and closing one says nothing about the other.
const NEGATION_WORDS = ['not', 'never', 'no', 'un'];
const VERDICT_TOKENS = ['OK', 'PASS', 'GREEN'];
const NEGATION = new RegExp(`\\b(?:${NEGATION_WORDS.join('|')})\\b`, 'i');
const LEADING_NEGATION = new RegExp(`^(\\s*)(?:${NEGATION_WORDS.join('|')})\\s+`, 'i');
// A negation sitting immediately before a verdict token, wherever that token is
// — bare (`NEVER PASS …`) or behind a label (`tool: NEVER OK …`).
const TOKEN_NEGATION = new RegExp(`\\b(?:${NEGATION_WORDS.join('|')})\\s+(?=(?:${VERDICT_TOKENS.join('|')})\\b)`, 'ig');

// THE CLAIM'S OWN NOUN IS A CLOSED SET TOO — because closing the LINE was not
// enough. `PASS — 9/9 checks failed` and `tool: OK — 9/9 errors occurred` both
// passed the terminated grammar: BOTH numbers belong to the verdict's own
// captures, so the contradiction rule finds no extra number to object to, and
// the noun after the ratio was an unrestricted word suffix — so a FAILURE WORD
// SITTING IN THE CLAIM'S OWN SLOT READ AS SUCCESS.
//
// The fix is the closed-table principle applied one level deeper, and it is the
// only version that does not reopen the English problem: the noun following a
// ratio comes from a set of exact phrases this repo actually emits. Anything
// else is unrecognised grammar, refused by name, and the tool either says one
// of these or the set gains a row WITH A PLANT — a contract change, like every
// other row here.
//
// ⚠ EXPECT THIS LIST TO BE INCOMPLETE. My enumeration of trailing-prose
// summaries was one short a commit ago and the door found the sixth within a
// minute. That is the mechanism working; the answer is to add the phrase and
// its plant, NEVER to widen the slot back into a wildcard to silence it.
const RATIO_NOUNS = new Set([
  'shapes',
  'placements photographed',
  'plants observed red',
  'known-bads observed red',
  'current-build aliases refreshed',
]);

const knownNoun = (tail) => RATIO_NOUNS.has(String(tail || '').replace(/\s+/g, ' ').trim().toLowerCase());

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
    re: /^\s*[\w][\w .+/-]*:\s*OK\s*[—-]?\s*(\d+)\s+checks?\s+passed\s*[.!]?\s*$/di,
    count: (m) => Number(m[1]) },
  { name: 'label: OK — N of M <words> ran',
    re: /^\s*[\w][\w .+/-]*:\s*OK\s*[—-]?\s*(\d+)\s+of\s+(\d+)\s+[\w -]*?ran\s*[.!]?\s*$/di,
    count: (m) => (Number(m[1]) === Number(m[2]) ? Number(m[1]) : null) },
  { name: 'label: OK — N <words>, N caught',
    re: /^\s*[\w][\w .+/-]*:\s*OK\s*[—-]?\s*(\d+)\s+[^,\n]*?,\s*(\d+)\s+caught\s*[.!]?\s*$/di,
    count: (m) => (Number(m[1]) === Number(m[2]) ? Number(m[2]) : null) },
  { name: 'label: OK — N/N <known noun>',
    re: /^\s*[\w][\w .+/-]*:\s*OK\s*[—-]?\s*(\d+)\s*\/\s*(\d+)(?:\s+([\w -]*))?\s*[.!]?\s*$/di,
    count: (m) => (Number(m[1]) === Number(m[2]) && knownNoun(m[3]) ? Number(m[1]) : null) },
  { name: 'PASS — n/n <known noun>',
    re: /^\s*PASS\s*[—-]\s*(\d+)\s*\/\s*(\d+)(?:\s+([\w -]*))?\s*[.!]?\s*$/di,
    count: (m) => (Number(m[1]) === Number(m[2]) && knownNoun(m[3]) ? Number(m[1]) : null) },
  { name: 'label: GREEN (n/m)',
    re: /^\s*[\w][\w .+/-]*:\s*GREEN\s*\((\d+)\s*\/\s*(\d+)\)\s*[.!]?\s*$/di,
    count: (m) => (Number(m[1]) === Number(m[2]) ? Number(m[1]) : null) },
  { name: 'N passed, M failed',
    re: /^\s*(\d+)\s+passed,\s*(\d+)\s+failed\s*[.!]?\s*$/di,
    count: (m) => (Number(m[2]) === 0 ? Number(m[1]) : null) },
];

// THE LINE ENDS AT ITS COUNTED CLAIM. Every row above is anchored to end of
// line (a closing `.` or `!` aside), and that single decision dissolves a pair
// of findings that were pulling in opposite directions:
//
//   FALSE GREEN — `OK — 9 checks passed; errors occurred` and `…; one check
//     failed` sailed through, because the contradiction rule only inspects
//     NUMERIC tokens: a failure claim in prose, or with its quantity spelled
//     as a word, was never examined at all.
//   FALSE RED — `OK — 9 checks passed; no failures` was REFUSED, because the
//     negation test matched the standalone "no" anywhere on the line. A tool
//     honestly reporting zero failures was called a liar.
//
// Satisfying both at once means accepting "no failures", rejecting "errors
// occurred", rejecting "one check failed" — that is NATURAL-LANGUAGE
// UNDERSTANDING, it is unbounded, and every future loss is either a lie
// accepted or an honest tool called a liar. So the line stops being prose to
// interpret and becomes a CONTRACT: anything trailing the counted claim is
// UNRECOGNISED GRAMMAR, refused by name, and the tool prints its commentary on
// its own line.
//
// THE COST, STATED RATHER THAN DISCOVERED: a tool whose summary carries
// trailing prose reds CI until its line is corrected, and each correction is
// one line in that tool. Bounded and enumerable — five such lines existed in
// this repo when this landed — SIX, in fact: my enumeration said five and the
// door found the sixth (buildversion --selftest) the moment I ran it, which is
// the bounded cost behaving exactly as advertised. All six are fixed here. That is
// the same move as fixing the speaker instead of widening the listener, which
// is the call this card has now made three times.

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
  // A BARE \r IS A LINE BOUNDARY. Terminal progress reporters rewrite a line
  // with a carriage return and no newline, so `…1 check passed\r…0 checks
  // passed\n` arrived as ONE line: the first success grammar consumed the
  // whole string and the trailing zero-work verdict was never seen. Splitting
  // on all three terminators puts every verdict-shaped UPDATE into the
  // exactly-one census, which is where a tool that changed its mind belongs.
  const lines = String(text).split(/\r\n|\r|\n/);
  const hits = [];
  const refused = [];
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    // A NEGATED VERDICT SHAPE IS A VERDICT-SHAPED LINE, and it must reach the
    // `refused` bucket or the rule above cannot see it. `NOT PASS — 1/10`
    // matches no row BY DESIGN (the rows anchor on the success token), so it
    // used to be invisible: prose, as far as the parse was concerned, and a
    // good verdict beside it walked through. Stripping ONE leading negation
    // and re-testing is deliberately the narrowest form of this — the door
    // judges verdict lines, it does not police prose, and a boundary block
    // reading "NOT A VERDICT AND NOT A FAILURE:" still matches nothing.
    const denegated = line.replace(LEADING_NEGATION, '$1').replace(TOKEN_NEGATION, '');
    if (denegated !== line && VERDICTS.some((v) => v.re.test(denegated))) {
      refused.push({ line: line.trim(), why: 'a negated verdict shape' });
      continue;
    }
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
  // THE DECISION CONSULTS EVERYTHING THE PARSE COLLECTED. `refused` was built
  // as a bucket and then not read when deciding, so a stream printing
  // `PASS — 1/2` and then `PASS — 2/2` returned the sole ACCEPTED hit and
  // greened a checker that had reported a failure. A collected-but-unread
  // signal is its own defect: not two states merged, but one CAPTURED AND
  // DISCARDED — the sixth distinction this door failed to honour.
  //
  // THE RULE, and it follows from the contract already written above: EXACTLY
  // ONE terminated verdict line. A stream carrying verdict-shaped lines that
  // were refused, alongside one that was accepted, is not "one verdict plus
  // noise" — it is ambiguous, and ambiguity is a refusal, never a tiebreak in
  // favour of the good news.
  if (hits.length === 1 && refused.length === 0) return hits[0];
  if (hits.length === 0) return { error: 'none', refused };
  return { error: 'many', hits, refused };
}

// NODE'S FATAL-EXCEPTION SIGNATURE. Node prints the offending source line, the
// error, a stack, and then a bare `Node.js vX.Y.Z` trailer — and it prints that
// trailer ONLY on the fatal uncaught-exception / unhandled-rejection path, never
// for a tool that reports and exits on its own terms. Both halves are required:
// a stack frame AND the trailer. One list, one reader, as with the negation
// vocabulary above — this question is asked in exactly one place.
const NODE_STACK_FRAME = /\n\s+at\s/;
const NODE_FATAL_TRAILER = /(?:^|\n)Node\.js v\d+\.\d+\.\d+[^\n]*\s*$/;
const nodeFatal = (out) => NODE_STACK_FRAME.test(out) && NODE_FATAL_TRAILER.test(out.replace(/\s+$/, ''));

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
      // A HARNESS DEATH IS NOT A FINDING, AND `1` WAS BOTH OF THEM. See
      // HARNESS DEATH in the header: an unhandled throw exits 1, which is this
      // door's code for "a check ran and failed", so the door merged the two
      // states it was written to keep apart — for the commonest instrument
      // death in this tree. Viki's vocabulary is adopted rather than invented:
      // 2 is HARNESS could not run, which is where `child.on('error')` above
      // already lands. Narrow by construction: code === 1 only.
      if (code === 1 && nodeFatal(out)) {
        return done({
          code: 2, out,
          note: `HARNESS COULD NOT RUN: ${label} died of an unhandled exception and exited 1.\n`
            + '  This is not a finding — the harness never reached a verdict, so nothing was\n'
            + '  measured and nothing may be concluded. Node exits 1 for an uncaught throw, the\n'
            + '  same code a real failure uses; the fatal-exception trailer is what separates them.\n'
            + '  Fix the instrument, then re-run. `unknown` blocks and is never a pass.',
        });
      }
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
        const refusedLines = (v.refused || []).map((r) => `    ✗ "${r.line}" — ${r.why}`);
        return done({
          code: 1, out,
          note: `AMBIGUOUS: ${label} printed ${v.hits.length} accepted and ${(v.refused || []).length} refused `
            + `verdict-shaped line(s); the contract is EXACTLY ONE (#12).\n`
            + v.hits.map((h) => `    ✓ "${h.line}" [${h.form}]`).join('\n')
            + (refusedLines.length ? `\n${refusedLines.join('\n')}` : '')
            + `\n  A tool that reports a failure and then a success must not be readable as either.`,
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
    file: 'console.log("buildstamp-shot --selftest: OK — 6/6 plants observed red"); process.exit(0);\n', want: 0 },
  { name: 'and a defect-counting mutate verdict is still a pass',
    file: 'console.log("dirorder --mutate: OK — 5 reinstatements of the defect, 5 caught."); process.exit(0);\n', want: 0 },
  // MY OWN OLDER PLANT, CORRECTLY INVALIDATED BY THE STRICTER CONTRACT: under
  // termination even an honest ", 0 failed" is a trailing clause, so it is
  // refused as GRAMMAR and the tool prints it on its own line. The old
  // expectation (pass) belonged to the era of interpreting the tail.
  { name: 'even an honest ", 0 failed" tail is refused as grammar now',
    file: 'console.log("tool: OK — 9 checks passed, 0 failed"); process.exit(0);\n', want: 3 },
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
  // KILLED MID-RUN. THE MECHANISM IS PLATFORM-SHAPED; THE INVARIANT IS NOT.
  //
  // POSIX delivers a real signal, so `close` hands back code === null plus the
  // signal and the door answers 4. WINDOWS HAS NO SIGNAL DELIVERY: Node
  // emulates `process.kill(self, 'SIGTERM'|'SIGKILL')` by terminating the
  // process, and the parent sees a REAL EXIT CODE with signal === null — 1,
  // measured on windows-latest / node 22.23.2 (run 32463037727, job
  // 96713743110, all three plants: "exited 1 — propagated verbatim"). So code
  // 4 is unreachable there BY THIS MECHANISM, and the door's own propagation
  // rule carries the outcome instead.
  //
  // These plants therefore assert the PLATFORM'S ACTUAL SEMANTICS, plus
  // `neverZero`, which is the sentence that must hold on all three runners:
  // A CHILD THAT DIED WITHOUT SPEAKING IS NOT A PASS.
  //
  // ⚠ THE COST, NAMED RATHER THAN HIDDEN: on Windows a killed checker is
  // reported as `1` and is therefore INDISTINGUISHABLE from "a check ran and
  // failed". That collapse is the platform's, not this door's — and it is the
  // same kind of merge this file exists to prevent, so it is written down
  // rather than left for someone to discover in a starved run.
  { name: 'a checker KILLED by SIGTERM is never a pass (POSIX 4 / win32 1)',
    file: 'console.log("starting a long check..."); process.kill(process.pid, "SIGTERM");\n',
    want: 4, winWant: 1, neverZero: true },
  { name: 'a checker KILLED by SIGKILL, the OOM shape, is never a pass',
    file: 'process.kill(process.pid, "SIGKILL");\n',
    want: 4, winWant: 1, neverZero: true },
  { name: 'and a killed child that had ALREADY printed a good verdict is still killed',
    file: 'console.log("tool: OK — 9 checks passed."); process.kill(process.pid, "SIGTERM");\n',
    want: 4, winWant: 1, neverZero: true },
  // ---- HARNESS DEATH vs A FINDING. Both edges, because `1` was both. ----
  { name: 'HARNESS: an unhandled top-level throw exits 2, not 1',
    file: 'throw new Error("selector went missing");\n', want: 2, mustSay: 'HARNESS COULD NOT RUN' },
  { name: "HARNESS: Viki's real shape — an unhandled throw from a timer",
    file: 'setTimeout(() => { throw new Error("timeout picker"); }, 1);\n',
    want: 2, mustSay: 'HARNESS COULD NOT RUN' },
  { name: 'HARNESS: an unhandled promise rejection is a death, not a finding',
    file: 'Promise.reject(new Error("no browser"));\n', want: 2, mustSay: 'HARNESS COULD NOT RUN' },
  { name: 'HARNESS: a death AFTER a good verdict is still a death, never a pass',
    file: 'console.log("tool: OK — 9 checks passed."); throw new Error("died cleaning up");\n',
    want: 2, neverZero: true, mustSay: 'HARNESS COULD NOT RUN' },
  // THE OTHER EDGE, AND IT IS THE ONE THAT KEEPS THE RULE HONEST: a tool that
  // catches its own error and exits 1 on purpose is a FINDING and stays 1 —
  // even when it prints stack-shaped text. The trailer is the discriminator,
  // not the word "Error" and not an `at` line.
  { name: 'FINDING: a tool that reports a caught error and exits 1 stays 1',
    file: 'console.error("Error: two copies disagree\\n    at compare (tools/x.mjs:4:1)"); console.log("tool: FAILED 1 of 3."); process.exit(1);\n',
    want: 1 },
  { name: 'FINDING: a stated failure with no fatal trailer is still a finding',
    file: 'console.log("tool: FAILED 2 of 5."); process.exit(1);\n', want: 1 },
  { name: 'a child exiting 2 (instrument unavailable) comes out 2, not 1',
    file: 'process.exit(2);\n', want: 2 },
  { name: 'a child exiting 1 (a check ran and failed) comes out 1',
    file: 'console.log("tool: FAILED 2 of 5."); process.exit(1);\n', want: 1 },
  { name: 'an unusual code (77) is not flattened either',
    file: 'process.exit(77);\n', want: 77 },
  { name: 'a counted verdict printed while FAILING is still red',
    file: 'console.log("tool: OK — 9 checks passed."); process.exit(1);\n', want: 1 },
  // A REFUSED VERDICT ALONGSIDE AN ACCEPTED ONE IS AMBIGUITY, NOT NOISE.
  { name: 'a progress reporter rewriting its line with a bare CR is still two verdicts',
    file: 'process.stdout.write("tool: OK — 1 check passed\\rtool: OK — 0 checks passed\\n"); process.exit(0);\n', want: 1 },
  { name: 'and a CR-rewritten line ending in a good verdict alone still passes',
    file: 'process.stdout.write("working...\\rtool: OK — 7 checks passed\\n"); process.exit(0);\n', want: 0 },
  // TRAILING TEXT IS UNRECOGNISED GRAMMAR — the pair of findings that pulled
  // in opposite directions, dissolved by one rule instead of interpreted.
  // THE CLAIM'S OWN NOUN SLOT — closed after `9/9 checks failed` passed.
  { name: 'a failure word IN THE NOUN SLOT is refused: "9/9 checks failed"',
    file: 'console.log("PASS — 9/9 checks failed"); process.exit(0);\n', want: 3 },
  { name: 'and "OK — 9/9 errors occurred" is refused',
    file: 'console.log("tool: OK — 9/9 errors occurred"); process.exit(0);\n', want: 3 },
  { name: 'an INVENTED success noun is refused too — the set is closed, not vetted',
    file: 'console.log("tool: OK — 9/9 widgets frobnicated"); process.exit(0);\n', want: 3 },
  { name: 'and every noun the repo actually emits still passes (shapes)',
    file: 'console.log("PASS — 27/27 shapes"); process.exit(0);\n', want: 0 },
  { name: 'known noun: current-build aliases refreshed',
    file: 'console.log("launch: OK — 3/3 current-build aliases refreshed."); process.exit(0);\n', want: 0 },
  { name: 'known noun: known-bads observed red',
    file: 'console.log("buildversion --selftest: OK — 19/19 known-bads observed red"); process.exit(0);\n', want: 0 },
  { name: 'trailing prose claiming failure is refused: "; errors occurred"',
    file: 'console.log("tool: OK — 9 checks passed; errors occurred"); process.exit(0);\n', want: 3 },
  { name: 'a failure counted in WORDS is refused too: "; one check failed"',
    file: 'console.log("tool: OK — 9 checks passed; one check failed"); process.exit(0);\n', want: 3 },
  { name: 'and "; no failures" is refused as GRAMMAR, not called a liar',
    file: 'console.log("tool: OK — 9 checks passed; no failures"); process.exit(0);\n', want: 3 },
  { name: 'a bare counted claim passes, with or without a full stop',
    file: 'console.log("tool: OK — 9 checks passed."); process.exit(0);\n', want: 0 },
  { name: 'row: label: OK — N/N <words>, the corrected buildstamp form',
    file: 'console.log("buildstamp-shot --selftest: OK — 6/6 plants observed red"); process.exit(0);\n', want: 0 },
  { name: 'and the commentary is fine on its OWN line',
    file: 'console.log("tool: OK — 9 checks passed"); console.log("  no failures; everything nominal."); process.exit(0);\n', want: 0 },
  { name: 'a FAILING verdict followed by a passing one is refused, not greened',
    file: 'console.log("PASS — 1/2 shapes"); console.log("PASS — 2/2 shapes"); process.exit(0);\n', want: 1 },
  { name: 'and in the other order, which is how a retry would print it',
    file: 'console.log("PASS — 2/2 shapes"); console.log("PASS — 1/2 shapes"); process.exit(0);\n', want: 1 },
  // THE TWO-LIST DEFECT: `never` was in one reading of "negation" and not the
  // other, so this line reached neither bucket and the retry below won.
  // THE SAME VOCABULARY, ONE POSITION OVER: behind a label.
  { name: 'a LABELLED "NEVER OK" is a negated verdict, and a retry cannot win',
    file: 'console.log("tool: NEVER OK — 9 checks passed"); console.log("tool: OK — 9 checks passed"); process.exit(0);\n', want: 1 },
  { name: 'and a labelled NEVER OK alone is refused, not silent-passed',
    file: 'console.log("tool: NEVER OK — 9 checks passed"); process.exit(0);\n', want: 3 },
  { name: 'a labelled NOT GREEN is caught at that position too',
    file: 'console.log("map-camera persistence: NOT GREEN (6/6)"); console.log("tool: OK — 9 checks passed"); process.exit(0);\n', want: 1 },
  { name: 'NEVER is a negation in BOTH readings, so a retry cannot win',
    file: 'console.log("NEVER PASS — 1/10"); console.log("tool: OK — 9 checks passed"); process.exit(0);\n', want: 1 },
  { name: 'and a NEVER-negated shape alone is refused, not silent-passed',
    file: 'console.log("NEVER PASS — 1/10"); process.exit(0);\n', want: 3 },
  { name: 'UN- form too, from the same one list',
    file: 'console.log("UN PASS — 1/10"); console.log("tool: OK — 9 checks passed"); process.exit(0);\n', want: 1 },
  { name: 'a negated verdict beside a good one is refused too',
    file: 'console.log("NOT PASS — 1/10"); console.log("tool: OK — 9 checks passed."); process.exit(0);\n', want: 1 },
  { name: 'two DIFFERENT good verdicts are ambiguous, not "the best one"',
    file: 'console.log("a: OK — 9 checks passed."); console.log("PASS — 3/3 shapes"); process.exit(0);\n', want: 1 },

  // ---- ONE PLANT PER GRAMMAR ROW (adding a row is a contract change) ----
  { name: 'row: label: OK — N checks passed', file: 'console.log("verify-shipped: OK — 6 checks passed."); process.exit(0);\n', want: 0 },
  { name: 'row: label: OK — N of M ... ran',
    file: 'console.log("shotguard --selftest-unavailable: OK — 3 of 3 unavailability paths ran"); process.exit(0);\n', want: 0 },
  { name: 'row: label: OK — N ..., N caught',
    file: 'console.log("dirorder --mutate: OK — 5 reinstatements of the defect, 5 caught."); process.exit(0);\n', want: 0 },
  { name: 'row: label: OK — N/N <noun>', file: 'console.log("buildstamp-shot: OK — 4/4 placements photographed"); process.exit(0);\n', want: 0 },
  { name: 'row: PASS — n/m', file: 'console.log("PASS — 27/27 shapes"); process.exit(0);\n', want: 0 },
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
    file: 'console.log("shotguard: OK — 8 checks passed"); process.exit(0);\n', want: 0 },
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
      // A PLANT'S PREMISE CAN BE PLATFORM-SHAPED, AND ONE OF MINE WAS. The
      // MECHANISM may differ per OS; the INVARIANT may not. `winWant` names
      // the platform's actual semantics (observed, cited) instead of skipping
      // the plant or loosening it to "nonzero somehow".
      const expected = (process.platform === 'win32' && p.winWant !== undefined) ? p.winWant : p.want;
      const r = await runOne(process.execPath, [f, ...(p.args || [])], { min: 1, quiet: true });
      let ok = r.code === expected;
      // THE INVARIANT UNDER TEST, asserted on every runner by whatever
      // mechanism that runner provides: a child that died without speaking is
      // NOT A PASS. This holds even where the exact code differs.
      if (p.neverZero && r.code === 0) ok = false;
      // `mustSay` proves the CHILD spoke — the argv plant's whole point.
      if (ok && p.mustSay && !`${r.out}${r.note || ''}`.includes(p.mustSay)) ok = false;
      // The KILLED wording is asserted only where the signal path exists.
      // Asserted only where 4 is the expectation: `neverZero` is the shared
      // invariant, but KILLED is the SIGNAL path's wording. A harness-death
      // plant also carries neverZero and says HARNESS, not KILLED — one
      // invariant, two mechanisms, each asserted by its own `mustSay`.
      if (ok && p.neverZero && p.want === 4 && process.platform !== 'win32' && !`${r.note || ''}`.includes('KILLED')) ok = false;
      if (!ok) bad++;
      console.log(`  ${ok ? 'CAUGHT ' : 'MISSED '} exit ${r.code} (want ${expected})  ${p.name}`);
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
