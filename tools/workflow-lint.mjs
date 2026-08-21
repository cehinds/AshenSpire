#!/usr/bin/env node
// tools/workflow-lint.mjs — THE DOOR CANNOT SEE THE WIRING ABOVE ITSELF.
//
// tools/verdict.mjs makes a tool's silence audible, but it only speaks when the
// step RUNS. A step with no command, or a step whose command was overwritten by
// a duplicate YAML key, never reaches the door at all — it is silence one level
// up, and it is invisible to every check inside the process.
//
// THIS IS NOT HYPOTHETICAL. The first cut of the PR that added the door shipped
// exactly that defect: `- name: Engine suite` with NO `run:`, and the following
// step carrying TWO `run:` keys. The suite would have silently not run, or the
// door's own self-test would have been overwritten. Two reviewers caught it on
// the pushed head; my local YAML check passed it, because `yaml.safe_load`
// resolves duplicate keys last-wins WITHOUT COMPLAINING — my validation was
// itself a silent green, which is the card's defect class a third time.
//
// So this reads the workflow AS TEXT, where the duplicate is visible, rather
// than through a parser that has already thrown the evidence away.
//
// Usage
//   node tools/workflow-lint.mjs                 lint .github/workflows/*.yml
//   node tools/workflow-lint.mjs --selftest      the known-bads, each a file
//
// Exit codes
//   0  every step in every workflow carries exactly one command
//   1  a finding (named, with file and line)
//   2  usage / nothing to lint — never a pass

import { readFileSync, readdirSync, existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Findings for one workflow's text. A "step" is a `- ` list item under a
 * `steps:` key; its own keys are the lines at the item's key indent. Text, not
 * a parse tree, because the defect being hunted is invisible after parsing.
 */
/**
 * A line with its trailing YAML comment removed, for STRUCTURAL matching only.
 *
 * Every key pattern in this file anchored INDENTATION and stayed COMMENT-BLIND,
 * so `build: # Linux job` was not a job header (the next bare `steps:` was
 * consumed as one and the job never examined) and `steps: # checks` made the
 * whole list invisible — the lint reporting success while the exact last-wins
 * defect it gates sailed through. Two symptoms, one class, so this is one
 * helper used at EVERY key match rather than two patched patterns.
 *
 * Quote-aware, because `run: echo "# not a comment"` must keep its value; a
 * `#` counts only at line start or after whitespace, outside quotes. Block
 * scalar bodies never reach here — they are skipped as payload upstream.
 */
export function stripComment(line) {
  let q = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i).trimEnd();
  }
  return line;
}

/**
 * ONE RECOGNIZER FOR "IS THIS A KEY, AND WHICH ONE" — used at every key match
 * in this file. Third variation on one axis arrived before this existed: I
 * generalized over INDENTATION (the matrix axis), then over COMMENTS
 * (`build: # Linux job`), and a QUOTED key (`"build":`) walked past both. The
 * shapes were different; the class never was. A YAML key may be quoted or
 * bare, may carry a trailing comment, and sits at a known indent — so that is
 * one function, not three patched patterns.
 *
 * Returns `{ indent, item, name, rest, keyIndent }` or null. `item` marks a
 * `- ` list entry; `keyIndent` is where the entry's OWN keys sit.
 */
export function readKey(code) {
  const m = code.match(/^(\s*)(?:(-)\s+)?(?:"([^"]*)"|'([^']*)'|([\w.\-]+))\s*:(.*)$/);
  if (!m) return null;
  const name = m[3] !== undefined ? m[3] : (m[4] !== undefined ? m[4] : m[5]);
  return { indent: m[1].length, item: !!m[2], name, rest: m[6], keyIndent: m[1].length + (m[2] ? 2 : 0) };
}

/**
 * WHAT FORMS MAY A YAML LIST ITEM TAKE — asked once, here, instead of being
 * discovered one variation at a time. This is the fourth pass over the same
 * axis: indentation, then comments, then quoting, and now the SEQUENCE
 * INDICATOR ITSELF, which need not share a line with its content:
 *
 *     - name: Build          the dash carries the first key
 *     - "name": Build        …which may be quoted
 *     -                      the dash stands ALONE and the keys follow,
 *       name: Build          indented under it, at any deeper column
 *     - run: |               …and the first key may open a block scalar
 *
 * `readItem` answers "does this line START a list entry, and does it carry its
 * first key". A dash-only entry is real and was worth zero findings before:
 * no step object was created at all, so a duplicate `run:` inside it — or no
 * command whatsoever — reported nothing, which is the exact silence this lint
 * exists to break, in the lint.
 */
export function readItem(code) {
  const bare = code.match(/^(\s*)-\s*$/);
  if (bare) return { indent: bare[1].length, key: null };
  const k = readKey(code);
  if (k && k.item) return { indent: k.indent, key: k };
  return null;
}

const isBlockScalar = (k) => !!k && /^\s*[|>][-+]?\s*$/.test(k.rest);

export function lintWorkflowText(text, file = '<text>') {
  const out = [];
  const lines = String(text).split(/\r?\n/);
  const indentOf = (l) => l.match(/^\s*/)[0].length;

  let jobsIndent = -1;          // indent of the `jobs:` key
  let jobIndent = -1;           // indent of a job NAME under jobs:
  let jobName = null;
  let jobStepsSeen = 0;         // `steps:` keys in THIS job — more than one is the bug
  let jobKeyIndent = -1;        // indent of the job's OWN keys (runs-on, strategy, steps)
  let stepsKeyIndent = -1;      // indent of the active `steps:` key
  let itemIndent = -1;          // indent of the FIRST `- ` under it; every item must match
  let inSteps = false;
  let step = null;
  let skipDeeperThan = -1;      // inside a block scalar (`run: |`): skip more-indented lines

  const closeStep = () => {
    if (!step) return;
    const cmds = ['run', 'uses'].reduce((n, k) => n + (step.keys[k] || 0), 0);
    if (cmds === 0) {
      out.push(`${file}:${step.line}: step ${JSON.stringify(step.name)} carries NO \`run:\` and NO \`uses:\` — it can never execute, and a step that never runs never reaches the verdict door (#12).`);
    }
    for (const k of Object.keys(step.keys)) {
      if (step.keys[k] > 1) {
        out.push(`${file}:${step.line}: step ${JSON.stringify(step.name)} carries ${step.keys[k]} \`${k}:\` keys — YAML resolves duplicates last-wins SILENTLY, so one of those commands never runs.`);
      }
    }
    step = null;
  };
  const closeJob = () => { closeStep(); inSteps = false; stepsKeyIndent = -1; itemIndent = -1; jobStepsSeen = 0; jobKeyIndent = -1; };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\t/g, '  ');
    // BLOCK SCALARS ARE PAYLOAD, NOT STRUCTURE. `run: |` carries shell, and
    // shell contains lines that look exactly like YAML — a heredoc emitting
    // `- name: data`, which this repo's own boundary job is full of. Reading
    // that as a new step closed the real one and reported the PAYLOAD as
    // command-less: a valid workflow, red forever, from a lint that now gates
    // every CI run. Everything more indented than the key belongs to the key.
    if (skipDeeperThan >= 0) {
      if (!line.trim() || indentOf(line) > skipDeeperThan) continue;
      skipDeeperThan = -1;
    }
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const indent = indentOf(line);
    // ONE stripped view, used by every key match below. Leading whitespace is
    // untouched, so indentation anchoring is unaffected.
    const code = stripComment(line);
    if (!code.trim()) continue;

    const k = readKey(code);
    if (k && !k.item && k.name === 'jobs' && !k.rest.trim()) { closeJob(); jobsIndent = indent; jobIndent = -1; jobName = null; continue; }

    // A job header: a bare key one level inside `jobs:`.
    if (jobsIndent >= 0 && indent > jobsIndent && k && !k.item && !k.rest.trim()
        && (jobIndent === -1 || indent === jobIndent) && !inSteps) {
      closeJob();
      jobIndent = indent;
      jobName = k.name;
      continue;
    }
    // Leaving a job entirely (back out to `jobs:` level or shallower).
    if (jobIndent >= 0 && indent <= jobsIndent && k && !k.item) { closeJob(); jobIndent = -1; jobName = null; continue; }

    // A JOB'S OWN KEYS SIT AT ONE INDENT, and the shallowest key under the job
    // header fixes it. Everything deeper is nested data.
    if (jobIndent >= 0 && !inSteps && indent > jobIndent && k && !k.item
        && (jobKeyIndent === -1 || indent < jobKeyIndent)) {
      jobKeyIndent = indent;
    }

    // `steps:` COUNTS ONLY AT THE JOB-KEY INDENT. Unanchored, a matrix axis
    // literally named `steps` (strategy.matrix.steps) read as the job's list,
    // and the real job-level `steps:` then reported a FALSE DUPLICATE — this
    // gate reddening a valid workflow. Same class as the heredoc: structure
    // detected without anchoring to its level. Anchor it, do not special-case
    // the word `matrix`.
    if (k && !k.item && k.name === 'steps' && (!k.rest.trim() || isBlockScalar(k))
        && (jobKeyIndent === -1 || indent === jobKeyIndent)) {
      closeStep();
      jobStepsSeen += 1;
      // TWO `steps:` IN ONE JOB IS THE LINTER'S OWN DEFECT CLASS, ONE LEVEL UP:
      // last-wins silently discards the ENTIRE first list — the real suite —
      // and the old parser simply started reading the second one and reported
      // nothing. A duplicate-key hole in the duplicate-key checker.
      if (jobStepsSeen > 1) {
        out.push(`${file}:${i + 1}: job ${JSON.stringify(jobName || '(unnamed)')} carries ${jobStepsSeen} \`steps:\` keys — YAML resolves duplicates last-wins SILENTLY, so an entire steps list (every check in it) never runs.`);
      }
      inSteps = true; stepsKeyIndent = indent; itemIndent = -1;
      continue;
    }
    if (!inSteps) continue;

    // A key at or left of the `steps:` key ends the block.
    if (indent <= stepsKeyIndent && k && !k.item) {
      closeStep(); inSteps = false; stepsKeyIndent = -1; itemIndent = -1;
      i -= 1; // re-read this line as a job key / job header
      continue;
    }

    const item = readItem(code);
    // ONLY AT THE LIST'S OWN INDENT. The first `- ` after `steps:` fixes it;
    // anything deeper is nested data, not a step.
    if (item && (itemIndent === -1 || indent === itemIndent)) {
      closeStep();
      if (itemIndent === -1) itemIndent = indent;
      const first = item.key;
      step = {
        line: i + 1,
        name: first && first.name === 'name' ? first.rest.trim() : '(unnamed)',
        keys: first ? { [first.name]: 1 } : {},
        // A DASH-ONLY ENTRY DOES NOT YET KNOW WHERE ITS KEYS SIT; the first
        // key line below fixes the column, exactly as the first list item
        // fixes the list's own.
        indent: first ? first.keyIndent : -1,
      };
      if (first && isBlockScalar(first)) skipDeeperThan = first.keyIndent - 1;
      continue;
    }
    if (step && k && !k.item && (step.indent === -1 ? k.indent > itemIndent : k.indent === step.indent)) {
      if (step.indent === -1) step.indent = k.indent;   // dash-only: the first key fixes the column
      if (k.name === 'name' && step.name === '(unnamed)') step.name = k.rest.trim() || '(unnamed)';
      step.keys[k.name] = (step.keys[k.name] || 0) + 1;
      if (isBlockScalar(k)) skipDeeperThan = step.indent;
    }
  }
  closeJob();
  return out;
}

const SELFTEST = [
  {
    name: 'THE DEFECT THIS PR SHIPPED: a step with no run, and the next with two',
    yml: `on: push\njobs:\n  a:\n    steps:\n      - uses: actions/checkout@v4\n      - name: Engine suite\n      - name: The door\n        run: node tools/verdict.mjs --selftest\n        run: node tests/run-node.mjs\n`,
    want: 2,
  },
  { name: 'a step with no command at all', want: 1,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      - name: Ghost\n' },
  { name: 'a step with two run keys', want: 1,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      - name: Twice\n        run: echo one\n        run: echo two\n' },
  // (2) THE HEREDOC CASE — a valid `run: |` block whose payload contains a line
  // that looks like a step. This repo's own boundary job is full of multi-line
  // run blocks; reading payload as structure made a valid workflow red forever
  // from a lint that gates every CI run.
  { name: 'a run: | block carrying a step-shaped line is PAYLOAD, not a step', want: 0,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      - name: Boundary\n        run: |\n          cat <<EOF\n          - name: data\n          EOF\n' },
  { name: 'and a real command-less step AFTER a heredoc is still caught', want: 1,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      - name: Boundary\n        run: |\n          echo "- name: data"\n      - name: Ghost\n' },
  // (3) THE LINTER'S OWN DEFECT CLASS, ONE LEVEL UP: two `steps:` in one job.
  { name: 'two steps: keys in one job — last-wins discards an ENTIRE list', want: 1,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      - name: Real suite\n        run: node tests/run-node.mjs\n    steps:\n      - name: Shadow\n        run: echo nothing\n' },
  { name: 'two jobs each with their own steps: is fine', want: 0,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      - name: One\n        run: echo 1\n  b:\n    steps:\n      - name: Two\n        run: echo 2\n' },
  { name: 'nested list data under a step key is not a step', want: 0,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      - name: Matrix\n        with:\n          args:\n            - name: inner\n        run: echo ok\n' },
  // THE ESCAPE A REVIEWER FOUND: a matrix axis literally named `steps`. The
  // general fix is anchoring, not a `matrix` special case — so the plant keeps
  // the axis AND a real job-level steps list, and expects silence.
  { name: 'a matrix axis named `steps` is not the job\'s steps list', want: 0,
    yml: 'on: push\njobs:\n  a:\n    strategy:\n      matrix:\n        steps:\n          - one\n          - two\n    steps:\n      - name: Real\n        run: echo ok\n' },
  { name: 'and a REAL duplicate steps: is still caught beside a matrix axis', want: 1,
    yml: 'on: push\njobs:\n  a:\n    strategy:\n      matrix:\n        steps:\n          - one\n    steps:\n      - name: Real\n        run: echo ok\n    steps:\n      - name: Shadow\n        run: echo no\n' },
  // COMMENT-BLINDNESS, both symptoms of the one class, plus the guard that
  // keeps the general fix from eating a legitimate value.
  { name: 'a job header with a trailing comment is still a job header', want: 1,
    yml: 'on: push\njobs:\n  build: # Linux job\n    steps:\n      - name: Twice\n        run: echo one\n        run: echo two\n' },
  { name: 'a steps: key with a trailing comment still opens the list', want: 1,
    yml: 'on: push\njobs:\n  a:\n    steps: # checks\n      - name: Ghost\n' },
  { name: 'a quoted # inside a run value is NOT a comment', want: 0,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      - name: Hash\n        run: echo "# not a comment"\n' },
  { name: 'a commented duplicate steps: is still a duplicate', want: 1,
    yml: 'on: push\njobs:\n  a:\n    steps: # real\n      - name: One\n        run: echo 1\n    steps: # shadow\n      - name: Two\n        run: echo 2\n' },
  // THE KEY-RECOGNITION CLASS, ALL THREE FORMS, because the general rule has
  // to prove it swallows each: quoted, commented, and quoted-AND-commented.
  { name: 'a QUOTED job key is still a job header', want: 1,
    yml: 'on: push\njobs:\n  "build":\n    steps:\n      - name: Twice\n        run: echo one\n        run: echo two\n' },
  { name: 'a QUOTED + COMMENTED job key is still a job header', want: 1,
    yml: 'on: push\njobs:\n  "build": # Linux job\n    steps:\n      - name: Twice\n        run: echo one\n        run: echo two\n' },
  { name: 'a single-quoted steps: key still opens the list', want: 1,
    yml: "on: push\njobs:\n  a:\n    'steps':\n      - name: Ghost\n" },
  { name: 'a quoted step key counts as a command', want: 0,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      - name: Quoted\n        "run": echo ok\n' },
  { name: 'and a quoted DUPLICATE run: is still caught', want: 1,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      - name: Twice\n        "run": echo one\n        run: echo two\n' },
  // THE SEQUENCE-INDICATOR FORMS. A dash may stand alone, and its keys follow
  // at any deeper column — worth ZERO findings before, because no step object
  // was ever created.
  { name: 'a dash-only item with a duplicate run: is caught', want: 1,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      -\n        name: Twice\n        run: echo one\n        run: echo two\n' },
  { name: 'a dash-only item with NO command is caught', want: 1,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      -\n        name: Ghost\n' },
  { name: 'a healthy dash-only item is silent', want: 0,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      -\n        name: Fine\n        run: echo ok\n' },
  { name: 'a dash-only item at a deeper key column still works', want: 1,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      -\n          name: Deep\n          run: echo one\n          run: echo two\n' },
  { name: 'a dash-only item carrying a block scalar is not misread', want: 0,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      -\n        name: Block\n        run: |\n          echo "- name: data"\n' },
  { name: 'mixed dash-only and inline items in one list', want: 1,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      - name: Inline\n        run: echo ok\n      -\n        name: Ghost\n' },
  { name: 'a healthy workflow is silent', want: 0,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      - uses: actions/checkout@v4\n      - name: Fine\n        run: echo ok\n' },
  { name: 'a step whose command is `uses` is a command too', want: 0,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      - name: Checkout\n        uses: actions/checkout@v4\n' },
  { name: 'multi-line run blocks are one command', want: 0,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      - name: Block\n        run: |\n          echo one\n          run: not-a-key\n' },
  { name: 'keys after a step (env, with) are not commands and not duplicates', want: 0,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      - name: Env\n        env:\n          A: 1\n        run: echo ok\n' },
];

// MAIN-MODULE GUARD, spelled with the platform API rather than by string
// concatenation — that exact hand-rolled comparison is #12's instance 1 and
// #13's whole subject. Without it, importing this module to reuse
// `lintWorkflowText` RUNS the CLI and exits the caller: I hit that within a
// minute of writing the file.
const IS_MAIN = import.meta.url === pathToFileURL(process.argv[1] || '').href;

if (IS_MAIN && process.argv.includes('--selftest')) {
  const dir = mkdtempSync(resolve(tmpdir(), 'workflow-lint-'));
  let bad = 0;
  console.log('workflow-lint --selftest — each plant is a FILE, read the way the real lint reads\n');
  try {
    for (const p of SELFTEST) {
      const f = resolve(dir, `plant-${SELFTEST.indexOf(p)}.yml`);
      writeFileSync(f, p.yml);
      const found = lintWorkflowText(readFileSync(f, 'utf8'), f);
      const ok = found.length === p.want;
      if (!ok) bad++;
      console.log(`  ${ok ? 'CAUGHT ' : 'MISSED '} ${found.length} finding(s), want ${p.want}  ${p.name}`);
      if (!ok) found.forEach((x) => console.log(`      ${x}`));
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
  console.log('');
  if (bad) { console.error(`workflow-lint --selftest: RED — ${bad} plant(s) not caught.`); process.exit(1); }
  console.log(`workflow-lint --selftest: OK — ${SELFTEST.length} checks passed.`);
  process.exit(0);
}

if (!IS_MAIN) { /* imported for lintWorkflowText — the CLI below is not ours to run */ }
else {
const dir = resolve(ROOT, '.github/workflows');
if (!existsSync(dir)) { console.error('workflow-lint: no .github/workflows — nothing to lint, and that is not a pass.'); process.exit(2); }
const files = readdirSync(dir).filter((f) => /\.ya?ml$/.test(f));
if (!files.length) { console.error('workflow-lint: no workflow files found — nothing measured.'); process.exit(2); }
const findings = [];
let steps = 0;
for (const f of files) {
  const text = readFileSync(join(dir, f), 'utf8');
  steps += (text.match(/^\s*-\s+(name|uses|run):/gm) || []).length;
  findings.push(...lintWorkflowText(text, `.github/workflows/${f}`));
}
if (findings.length) {
  console.error(`\nworkflow-lint: FAILED ${findings.length} finding(s) over ${files.length} workflow(s).`);
  findings.forEach((x) => console.error(`  · ${x}`));
  process.exit(1);
}
// One terminated verdict line carrying a count (#12's contract), so this tool
// walks through the same door it protects.
console.log(`\nworkflow-lint: OK — ${steps} checks passed.`);
process.exit(0);
}
