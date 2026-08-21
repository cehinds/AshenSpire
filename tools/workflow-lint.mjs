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
export function lintWorkflowText(text, file = '<text>') {
  const out = [];
  const lines = String(text).split(/\r?\n/);
  const indentOf = (l) => l.match(/^\s*/)[0].length;

  let jobsIndent = -1;          // indent of the `jobs:` key
  let jobIndent = -1;           // indent of a job NAME under jobs:
  let jobName = null;
  let jobStepsSeen = 0;         // `steps:` keys in THIS job — more than one is the bug
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
  const closeJob = () => { closeStep(); inSteps = false; stepsKeyIndent = -1; itemIndent = -1; jobStepsSeen = 0; };

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

    if (/^\s*jobs:\s*$/.test(line)) { closeJob(); jobsIndent = indent; jobIndent = -1; jobName = null; continue; }

    // A job header: a bare key one level inside `jobs:`.
    if (jobsIndent >= 0 && indent > jobsIndent && /^\s*[\w.-]+:\s*$/.test(line)
        && (jobIndent === -1 || indent === jobIndent) && !inSteps) {
      closeJob();
      jobIndent = indent;
      jobName = line.trim().replace(/:$/, '');
      continue;
    }
    // Leaving a job entirely (back out to `jobs:` level or shallower).
    if (jobIndent >= 0 && indent <= jobsIndent && /^\s*[\w.-]+:/.test(line)) { closeJob(); jobIndent = -1; jobName = null; continue; }

    if (/^\s*steps:\s*(\|>?[-+]?)?\s*$/.test(line)) {
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
    if (indent <= stepsKeyIndent && /^\s*[\w.-]+:/.test(line)) {
      closeStep(); inSteps = false; stepsKeyIndent = -1; itemIndent = -1;
      i -= 1; // re-read this line as a job key / job header
      continue;
    }

    const item = line.match(/^(\s*)-\s+([\w.-]+):(.*)$/);
    // ONLY AT THE LIST'S OWN INDENT. The first `- ` after `steps:` fixes it;
    // anything deeper is nested data, not a step.
    if (item && (itemIndent === -1 || indent === itemIndent)) {
      closeStep();
      if (itemIndent === -1) itemIndent = indent;
      const key = item[2];
      step = { line: i + 1, name: key === 'name' ? item[3].trim() : '(unnamed)', keys: { [key]: 1 }, indent: indent + 2 };
      if (/:\s*[|>][-+]?\s*$/.test(line)) skipDeeperThan = indent + 2 - 1;
      continue;
    }
    if (step) {
      const kv = line.match(/^(\s*)([\w.-]+):/);
      if (kv && kv[1].length === step.indent) {
        step.keys[kv[2]] = (step.keys[kv[2]] || 0) + 1;
        if (/:\s*[|>][-+]?\s*$/.test(line)) skipDeeperThan = step.indent;
      }
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
