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
//   1  the wrapped tool exited non-zero (propagated), or its verdict counted 0
//   3  the wrapped tool exited 0 and printed NO countable verdict — SILENCE
//   2  usage error in this file itself
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
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// THE COUNTED-VERDICT GRAMMAR. Each entry: a name a human can grep for, a
// regex, and which capture group holds the count of things actually checked.
// ADDING A ROW IS A CONTRACT CHANGE and needs a plant in SELFTEST below.
const VERDICTS = [
  { name: 'N checks passed', re: /(\d+)\s+checks?\s+passed/i, group: 1 },
  { name: 'PASS — n/m', re: /\bPASS\b[^\n]*?(\d+)\s*\/\s*(\d+)/i, group: 1 },
  { name: 'GREEN (n/m)', re: /\bGREEN\b[^\n]*?\((\d+)\s*\/\s*(\d+)\)/i, group: 1 },
  { name: 'n passed, m failed', re: /(\d+)\s+passed,\s*(\d+)\s+failed/i, group: 1 },
  { name: 'N shape(s)/cell(s)/check(s) held', re: /(\d+)\s+(?:checks?|cells?|shapes?)\s+held/i, group: 1 },
  // The two forms the door itself FOUND in the wild, running the real CI steps
  // at `dev = 001c950`: `dirorder --mutate` and `shotguard-probe
  // --selftest-unavailable` both exit 0 with a counted verdict this table did
  // not speak, so both read as SILENT. That is the safe direction working as
  // designed — and the fix is to learn the grammar, not to loosen the rule.
  { name: 'N caught', re: /(\d+)\s+caught\b/i, group: 1 },
  { name: 'n of m ... ran', re: /(\d+)\s+of\s+(\d+)\b[^\n]*\bran\b/i, group: 1 },
];

/** The highest count any known verdict form reports, or null when none spoke. */
export function readVerdict(text) {
  let best = null;
  for (const v of VERDICTS) {
    const m = text.match(v.re);
    if (!m) continue;
    const n = Number(m[v.group]);
    if (!Number.isFinite(n)) continue;
    if (best === null || n > best.count) best = { count: n, form: v.name, line: m[0].trim() };
  }
  return best;
}

async function runOne(cmd, argv, { min, quiet = false, env } = {}) {
  return new Promise((done) => {
    let out = '';
    const child = spawn(cmd, argv, { cwd: ROOT, env: { ...process.env, ...(env || {}) } });
    const tee = (chunk, sink) => { out += chunk; if (!quiet) sink.write(chunk); };
    child.stdout.on('data', (c) => tee(String(c), process.stdout));
    child.stderr.on('data', (c) => tee(String(c), process.stderr));
    child.on('error', (e) => done({ code: 2, out, note: `could not run: ${e.message}` }));
    child.on('close', (code) => {
      const label = [cmd, ...argv].join(' ');
      // A RED STAYS RED, AND IT IS NOT RE-JUDGED. If the tool already failed,
      // this file adds nothing and must not convert its exit code.
      if (code !== 0) return done({ code: 1, out, note: `${label} exited ${code} — propagated` });
      const v = readVerdict(out);
      if (!v) {
        return done({
          code: 3, out,
          note: `SILENCE: ${label} exited 0 and printed no counted verdict.\n`
            + `  A tool that checked nothing and a tool that found nothing are the same green (#12).\n`
            + `  Fix: make the tool print one of ${VERDICTS.map((x) => `"${x.name}"`).join(', ')} — or wrap it in a runner that does.`,
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
  {
    name: 'a tool that printed NOTHING and exited 0 (the #12 platform case)',
    file: 'process.exit(0);\n', want: 3,
  },
  {
    name: 'a tool that ran ZERO checks and said so (verify-shipped\'s live shape)',
    file: 'console.log("verify-shipped: OK — 0 checks passed."); process.exit(0);\n', want: 1,
  },
  {
    name: 'a tool whose verdict grammar is unknown to the table',
    file: 'console.log("everything is fine, trust me"); process.exit(0);\n', want: 3,
  },
  {
    name: 'a REAL counted verdict passes the door',
    file: 'console.log("verify-shipped: OK — 6 checks passed."); process.exit(0);\n', want: 0,
  },
  {
    name: 'a PASS n/m verdict passes the door',
    file: 'console.log("PASS — 27/27 shapes: every walled shape refuses"); process.exit(0);\n', want: 0,
  },
  {
    name: 'a suite verdict passes the door',
    file: 'console.log("95 passed, 0 failed"); process.exit(0);\n', want: 0,
  },
  {
    name: 'a tool that FAILED keeps its own red (not re-judged)',
    file: 'console.log("verify-shipped: FAILED 2 of 5."); process.exit(1);\n', want: 1,
  },
  {
    name: 'a counted verdict printed while FAILING is still red',
    file: 'console.log("OK — 9 checks passed."); process.exit(1);\n', want: 1,
  },
  {
    name: 'a verdict on stderr is still read (a tool may report either way)',
    file: 'console.error("map-camera persistence: GREEN (6/6)"); process.exit(0);\n', want: 0,
  },
  // One plant per grammar row — ADDING A ROW IS A CONTRACT CHANGE (see the
  // table). These two are the real verdicts of dirorder --mutate and
  // shotguard-probe --selftest-unavailable, quoted from their own output.
  {
    name: 'the mutate grammar passes (dirorder\'s real verdict)',
    file: 'console.log("dirorder --mutate: OK — 5 reinstatements of the defect, 5 caught."); process.exit(0);\n', want: 0,
  },
  {
    name: 'the paths-ran grammar passes (shotguard\'s real verdict)',
    file: 'console.log("shotguard --selftest-unavailable: OK — 3 of 3 unavailability paths ran and all resolved to 2."); process.exit(0);\n', want: 0,
  },
  {
    name: 'a ZERO in the mutate grammar is still refused',
    file: 'console.log("dirorder --mutate: OK — 0 reinstatements of the defect, 0 caught."); process.exit(0);\n', want: 1,
  },
];

async function selftest() {
  const dir = mkdtempSync(resolve(tmpdir(), 'verdict-selftest-'));
  let bad = 0;
  console.log('verdict.mjs --selftest — the door, run end to end on real child processes\n');
  console.log('DOOR: each plant is a FILE executed by `node`, wrapped by the same runOne()');
  console.log('      the CI steps use. Nothing is handed to the matcher directly.\n');
  try {
    for (const p of SELFTEST) {
      const f = resolve(dir, `plant-${SELFTEST.indexOf(p)}.mjs`);
      writeFileSync(f, p.file);
      const r = await runOne(process.execPath, [f], { min: 1, quiet: true });
      const ok = r.code === p.want;
      if (!ok) bad++;
      console.log(`  ${ok ? 'CAUGHT ' : 'MISSED '} exit ${r.code} (want ${p.want})  ${p.name}`);
      if (!ok) console.log(`      note: ${(r.note || '').split('\n')[0]}`);
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

const argv = process.argv.slice(2);
if (argv.includes('--selftest')) { await selftest(); }

const minIdx = argv.indexOf('--min');
const min = minIdx >= 0 ? Number(argv[minIdx + 1]) : 1;
if (!Number.isInteger(min) || min < 1) {
  console.error('verdict: --min takes a positive integer');
  process.exit(2);
}
const sep = argv.indexOf('--');
const rest = sep >= 0 ? argv.slice(sep + 1) : argv.filter((a, i) => !(i === minIdx || i === minIdx + 1));
if (!rest.length) {
  console.error('usage: node tools/verdict.mjs [--min N] -- <command> [args...]');
  process.exit(2);
}

const r = await runOne(rest[0], rest.slice(1), { min });
if (r.code === 0) console.log(`\nverdict: OK — ${r.note}`);
else console.error(`\nverdict: ${r.note}`);
process.exit(r.code);
