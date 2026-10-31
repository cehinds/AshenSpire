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
