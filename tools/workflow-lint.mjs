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
  let inSteps = false;
  let stepsIndent = -1;
  let step = null;
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
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.replace(/\t/g, '  ');
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const indent = line.match(/^\s*/)[0].length;
    const m = line.match(/^\s*steps:\s*$/);
    if (m) { closeStep(); inSteps = true; stepsIndent = indent; continue; }
    if (!inSteps) continue;
    // Leaving the steps block: a key at or left of `steps:` own indent.
    if (indent <= stepsIndent && /^\s*[\w.-]+:/.test(line)) { closeStep(); inSteps = false; continue; }
    const item = line.match(/^(\s*)-\s+([\w.-]+):(.*)$/);
    if (item) {
      closeStep();
      const key = item[2];
      step = { line: i + 1, name: key === 'name' ? item[3].trim() : '(unnamed)', keys: { [key]: 1 }, indent: item[1].length + 2 };
      continue;
    }
    if (step) {
      const kv = line.match(/^(\s*)([\w.-]+):/);
      if (kv && kv[1].length === step.indent) {
        const key = kv[2];
        step.keys[key] = (step.keys[key] || 0) + 1;
      }
    }
  }
  closeStep();
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
