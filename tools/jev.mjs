#!/usr/bin/env node
// tools/jev.mjs — the deterministic-first gate (zero dependencies, zero model tokens).
//
// Modelled on the idea of jev-harness (a deterministic-first test-failure triage
// gate for AI coding agents: offline heuristics first, a model only when no rule
// matches). External code is not installed here; this is our own small Node tool.
//
//   node tools/jev.mjs triage [file|-] [--human]   rule-match a CI or local log
//   node tools/jev.mjs checks [--fast] [--human]   run the fast checks, triage each failure
//   node tools/jev.mjs regen                       regenerate every generated file
//   node tools/jev.mjs restamp [--pr N]            restamp this PR's receipt (orchestrator only)
//   node tools/jev.mjs devmerge [--base dev] [--pr N]   merge origin/<base> into this branch
//
// Every command prints ONE JSON line on stdout (--human prints text instead).
// Exit codes: 0 = resolved / pass (or a rule names a safe auto-fix),
//             1 = a failure a rule explains but with no safe auto-fix,
//             2 = needs a model (no rule matched, or a rule says judgement is needed).
// The rule table is data: tools/jev.rules.json.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HERE, '..');
export const RULES_PATH = resolve(HERE, 'jev.rules.json');

// Actions that have a safe, mechanical fix (or need none): severity 0.
const SAFE_ACTIONS = new Set(['regen', 'restamp', 'rerun-once', 'ignore-local']);

export function loadRules(path = RULES_PATH) {
  const doc = JSON.parse(readFileSync(path, 'utf8'));
  return doc.rules.map(rule => ({ ...rule, re: new RegExp(rule.regex, rule.flags || '') }));
}

// ---- triage: ordered rules, each reported once (first matching line) ----

const FAILURE_WORDS = /\b(fail(ed|ing|ure)?|error|fatal|not ok|stale|mismatch|ENOENT|FAIL)\b|✖|<{7}/;

export function severityOf(matches) {
  let sev = 0;
  for (const m of matches) {
    if (!m.deterministic) return 2;
    if (!SAFE_ACTIONS.has(m.action)) sev = Math.max(sev, 1);
  }
  return sev;
}

export function triage(text, rules = loadRules()) {
  const lines = String(text).split(/\r?\n/);
  const matches = [];
  for (const rule of rules) {
    const line = lines.find(l => rule.re.test(l));
    if (line === undefined) continue;
    matches.push({
      id: rule.id, category: rule.category, deterministic: rule.deterministic,
      action: rule.action, command: rule.command, note: rule.note,
      'evidence-line': line.trim().slice(0, 240),
    });
  }
  if (matches.length) {
    const exit = severityOf(matches);
    return { matches, verdict: exit === 0 ? 'autofix' : exit === 1 ? 'explained' : 'needs-model', exit };
  }
  if (!FAILURE_WORDS.test(text)) return { matches, verdict: 'pass', exit: 0 };
  return { matches, verdict: 'unmatched', exit: 2 };
}

// ---- process helpers ----

export function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: opts.cwd || ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, input: opts.input });
  return { status: r.status === null ? 1 : r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}
const node = (args, opts) => run(process.execPath, args, opts);

// ---- CLI ----

function emit(obj, human, toText) {
  process.stdout.write(human ? `${toText(obj)}\n` : `${JSON.stringify(obj)}\n`);
}

function triageText(r) {
  const out = r.matches.map(m => `  [${m.deterministic ? 'det' : 'MODEL'}] ${m.id} -> ${m.action}${m.command ? ` (${m.command})` : ''}\n      ${m.note}\n      > ${m['evidence-line']}`);
  return [`jev triage: ${r.verdict} (exit ${r.exit}), ${r.matches.length} match(es)`, ...out].join('\n');
}

const COMMANDS = {};

COMMANDS.triage = async (args) => {
  const human = args.includes('--human');
  const file = args.find(a => !a.startsWith('--') || a === '-');
  const text = !file || file === '-' ? readFileSync(0, 'utf8') : readFileSync(file, 'utf8');
  const r = triage(text);
  emit({ cmd: 'triage', ...r }, human, triageText);
  return r.exit;
};

// ---- checks: the fast-check list, run in order, every failure triaged ----

export const FAST_CHECKS = [
  { id: 'style-lint', args: ['tools/style-lint.mjs', '--check'] },
  { id: 'content-build', args: ['tools/content-build.mjs', '--check'] },
  { id: 'config-build', args: ['tools/config-build.mjs', '--check'] },
  { id: 'game-config', args: ['tools/game-config.mjs', 'check'] },
  { id: 'framework-data-build', args: ['tools/framework-data-build.mjs', '--check'] },
  { id: 'build-game', args: ['tools/build-game.mjs', '--check'] },
  { id: 'bundle-cycles', args: ['tools/bundle-cycles.mjs'] },
  { id: 'mechanics-generate', args: ['tools/mechanics-generate.mjs', '--check'] },
  { id: 'uistrings', args: ['tools/uistrings.mjs', '--check'] },
  { id: 'run-node', args: ['tests/run-node.mjs', '--no-selftests', '--no-discovered'] },
  { id: 'runsim', args: ['tools/runsim.mjs', '5'] },
];

// A failed check is never "resolved", so its severity is at least 1; triage can
// raise it to 2. The exit of the whole run is the maximum.
export function runChecks(list, runner, rules = loadRules()) {
  const results = [];
  for (const check of list) {
    const started = Date.now();
    const { status, out } = runner(check);
    const ms = Date.now() - started;
    if (status === 0) { results.push({ id: check.id, status: 'pass', exit: 0, ms }); continue; }
    const t = triage(out, rules);
    // Tag the check name onto the text so a rule keyed on the tool name can see it.
    const tagged = t.matches.length ? t : triage(`${check.id}: ${out}`, rules);
    const exit = Math.max(1, tagged.exit);
    results.push({
      id: check.id, status: 'fail', exit, ms, verdict: tagged.verdict,
      matches: tagged.matches.map(m => m.id), fix: tagged.matches.map(m => m.command).filter(Boolean),
      tail: out.trim().split('\n').slice(-6).join('\n').slice(0, 800),
    });
  }
  return { results, exit: results.reduce((a, r) => Math.max(a, r.exit), 0) };
}

function checksText({ results, exit }) {
  const rows = results.map(r => `  ${r.status === 'pass' ? 'PASS' : 'FAIL'}  ${r.id.padEnd(22)} ${String(r.ms).padStart(6)}ms${r.status === 'fail' ? `  exit ${r.exit}  ${r.matches.join(',') || 'no rule matched'}${r.fix.length ? `  fix: ${r.fix.join(' ; ')}` : ''}` : ''}`);
  return [`jev checks: exit ${exit}`, ...rows].join('\n');
}

COMMANDS.checks = async (args) => {
  const human = args.includes('--human');
  const onlyAt = args.indexOf('--only');
  const only = onlyAt >= 0 ? new Set(args[onlyAt + 1].split(',')) : null;
  const list = FAST_CHECKS.filter(c => !only || only.has(c.id));
  const r = runChecks(list, c => node(c.args));
  emit({ cmd: 'checks', exit: r.exit, verdict: r.exit === 0 ? 'pass' : r.exit === 1 ? 'explained' : 'needs-model', results: r.results }, human, () => checksText(r));
  return r.exit;
};

// ---- regen ----

export const REGEN_STEPS = [
  ['tools/about-changelog.mjs', '--write'],
  ['tools/content-build.mjs'],
  ['tools/framework-data-build.mjs'],
  ['tools/game-config.mjs', 'build'],
  ['tools/build-game.mjs'],
];

// Returns { exit, steps:[{cmd,status}], failed? }. Stops at the first failing step.
export function regen(cwd = ROOT) {
  const steps = [];
  for (const args of REGEN_STEPS) {
    const r = node(args, { cwd });
    steps.push({ cmd: `node ${args.join(' ')}`, status: r.status });
    if (r.status !== 0) {
      const t = triage(r.out);
      return { exit: Math.max(1, t.exit), steps, failed: args[0], tail: r.out.trim().split('\n').slice(-8).join('\n') };
    }
  }
  return { exit: 0, steps };
}

COMMANDS.regen = async (args) => {
  const r = regen();
  emit({ cmd: 'regen', verdict: r.exit === 0 ? 'regenerated' : 'failed', ...r }, args.includes('--human'),
    o => [`jev regen: ${o.verdict}`, ...o.steps.map(s => `  ${s.status === 0 ? 'ok  ' : 'FAIL'} ${s.cmd}`), o.tail || ''].join('\n').trim());
  return r.exit;
};

// ---- restamp ----

const STAMP_RE = /`\d+\.\d+\.\d+\.\d+`/;
const DATE_HEADING = /^## \d{4}-\d{2}-\d{2}\b/;

// Pure. Sets the first receipt under the newest date heading that names PR #pr to
// `build`, and drops repeated identical receipt lines under that heading.
export function restampChangelog(text, { pr, build }) {
  const lines = text.split('\n');
  const start = lines.findIndex(l => DATE_HEADING.test(l));
  if (start < 0) throw new Error('CHANGELOG.md has no "## <date>" heading');
  let end = lines.findIndex((l, i) => i > start && /^## /.test(l));
  if (end < 0) end = lines.length;
  const seen = new Set();
  const kept = [];
  let deduped = 0;
  for (let i = start + 1; i < end; i++) {
    const line = lines[i];
    if (/^- /.test(line)) {
      if (seen.has(line)) { deduped++; continue; }
      seen.add(line);
    }
    kept.push(line);
  }
  const named = new RegExp(`/pull/${pr}\\)|\\(#${pr}\\b|\\[#${pr}\\]`);
  const at = kept.findIndex(l => /^- /.test(l) && named.test(l));
  if (at < 0) throw new Error(`no receipt under the newest date heading names PR #${pr}`);
  if (!STAMP_RE.test(kept[at])) throw new Error(`the receipt for PR #${pr} carries no \`<release>.<ordinal>\` stamp to replace`);
  const before = kept[at];
  kept[at] = before.replace(STAMP_RE, `\`${build}\``);
  const out = [...lines.slice(0, start + 1), ...kept, ...lines.slice(end)].join('\n');
  return { text: out, deduped, restamped: kept[at] !== before, from: (before.match(STAMP_RE) || [''])[0].replace(/`/g, ''), to: build };
}

export function currentBuild(root = ROOT) {
  const b = JSON.parse(readFileSync(resolve(root, 'buildordinal.json'), 'utf8'));
  return `${b.release}.${b.ordinal}`;
}

// The PR this branch carries: --pr, else the branch's open PR via gh when present.
export function detectPr(args, cwd = ROOT) {
  const at = args.indexOf('--pr');
  if (at >= 0) return Number(args[at + 1]);
  const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd }).out.trim();
  const r = run('gh', ['pr', 'list', '--head', branch, '--json', 'number', '-q', '.[0].number'], { cwd });
  const n = Number(r.out.trim());
  return r.status === 0 && n > 0 ? n : null;
}

// Rewrites CHANGELOG.md in root, then (unless noRegen) projects it and checks order.
export function restamp({ root = ROOT, pr, noRegen = false }) {
  const path = resolve(root, 'CHANGELOG.md');
  const r = restampChangelog(readFileSync(path, 'utf8'), { pr, build: currentBuild(root) });
  writeFileSync(path, r.text);
  const info = { pr, from: r.from, to: r.to, deduped: r.deduped, restamped: r.restamped };
  if (noRegen) return { exit: 0, ...info };
  const w = node(['tools/about-changelog.mjs', '--write'], { cwd: root });
  if (w.status !== 0) return { exit: 1, ...info, failed: 'about-changelog --write', tail: w.out.trim().split('\n').slice(-6).join('\n') };
  const c = node(['tools/about-changelog.mjs', '--check-order', '--pending', String(pr)], { cwd: root });
  if (c.status !== 0) return { exit: Math.max(1, triage(c.out).exit), ...info, failed: 'about-changelog --check-order', tail: c.out.trim().split('\n').slice(-6).join('\n') };
  return { exit: 0, ...info };
}

COMMANDS.restamp = async (args) => {
  const pr = detectPr(args);
  if (!pr) throw new Error('cannot tell which PR this branch carries; pass --pr N');
  const rootAt = args.indexOf('--root');
  const r = restamp({ pr, root: rootAt >= 0 ? resolve(args[rootAt + 1]) : ROOT, noRegen: args.includes('--no-regen') });
  emit({ cmd: 'restamp', verdict: r.exit === 0 ? 'restamped' : 'failed', ...r }, args.includes('--human'),
    o => `jev restamp: ${o.verdict} PR #${o.pr} ${o.from} -> ${o.to}, ${o.deduped} duplicate line(s) dropped${o.tail ? `\n${o.tail}` : ''}`);
  return r.exit;
};

// ---- entry ----

async function main(argv) {
  const [cmd, ...args] = argv;
  const fn = COMMANDS[cmd];
  if (!fn) {
    process.stderr.write(`usage: jev.mjs ${Object.keys(COMMANDS).join('|')} [--human]\n`);
    return 2;
  }
  try {
    return await fn(args);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ cmd, verdict: 'error', exit: 2, error: error.message })}\n`);
    return 2;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
