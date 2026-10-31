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
  return doc.rules.map(rule => ({
    ...rule, re: new RegExp(rule.regex, rule.flags || ''),
    covers: rule.covers ? new RegExp(rule.covers, rule.flags || '') : null,
  }));
}

// ---- triage: ordered rules, each reported once (first matching line) ----

// Anything that looks like a failure, matched anywhere in a line and case-insensitively,
// so TypeError, AssertionError, "Failed", "not ok", "# fail 2", "npm ERR!" and a
// non-zero exit code all count. A false "pass" is the worst outcome, so this is broad.
const FAILURE_WORDS = /fail|error|fatal|not ok|stale|mismatch|ENOENT|ERR!|assertion|exception|panic|traceback|✖|<{7}|\bexit(ed)?\s+(with\s+)?(status|code)\W{0,3}[1-9]|\bcode\s+[1-9]\d*\b[^\n]*\bexit|\bnon-?zero\b/i;
// The one shape that names a failure word but reports none: "# fail 0" / "ℹ fail 0".
const ZERO_FAIL = /^\W*(fail|failed|failures?)\s+0\W*$/i;

export function failureLines(text) {
  return String(text).split(/\r?\n/).filter(l => FAILURE_WORDS.test(l) && !ZERO_FAIL.test(l));
}

export function severityOf(matches) {
  let sev = 0;
  for (const m of matches) {
    if (!m.deterministic) return 2;
    if (!SAFE_ACTIONS.has(m.action)) sev = Math.max(sev, 1);
  }
  return sev;
}

// Rule f (a file missing from a sparse checkout) only holds locally: when CI is set
// the checkout is the full one, so a missing file is a real failure. Injectable.
export function sparseLocal(line, { env = process.env, cwd = ROOT, git: g = (args) => run('git', args, { cwd }) } = {}) {
  if (env.CI) return false;
  if (g(['config', '--get', 'core.sparseCheckout']).out.trim() === 'true') return true;
  const file = (String(line).match(/(component-catalog\.html|attack-source-audit\.csv)/) || [])[1];
  if (!file) return false;
  const tracked = g(['ls-files', '--', `**/${file}`, file]).out.split('\n').filter(Boolean);
  return tracked.length > 0 && tracked.every(f => !existsSync(resolve(cwd, f)));
}
const DEFAULT_CTX = { 'sparse-local': line => sparseLocal(line) };

export function triage(text, rules = loadRules(), ctx = DEFAULT_CTX) {
  const lines = String(text).split(/\r?\n/);
  const matches = [];
  for (const rule of rules) {
    const hit = l => rule.re.test(l) && (!rule.requires || (ctx[rule.requires] ? ctx[rule.requires](l) : false));
    const line = lines.find(hit);
    if (line === undefined) continue;
    matches.push({
      id: rule.id, category: rule.category, deterministic: rule.deterministic,
      action: rule.action, command: rule.command, note: rule.note,
      'evidence-line': line.trim().slice(0, 240),
    });
  }
  const failing = failureLines(text);
  if (matches.length) {
    // A matched rule only vouches for the lines it matches; any other failure line
    // is unexplained and forces a model (a safe fix must never hide a real failure).
    const matched = rules.filter(r => matches.some(m => m.id === r.id));
    const uncovered = failing.filter(l => !matched.some(r => (r.re.test(l) && (!r.requires || (ctx[r.requires] ? ctx[r.requires](l) : false))) || (r.covers && r.covers.test(l))));
    if (uncovered.length) {
      matches.push({
        id: 'unmatched', category: 'unknown', deterministic: false, action: 'model', command: '',
        note: `${uncovered.length} failure line(s) no matched rule explains.`,
        'evidence-line': uncovered[0].trim().slice(0, 240),
      });
    }
    const exit = severityOf(matches);
    return { matches, verdict: exit === 0 ? 'autofix' : exit === 1 ? 'explained' : 'needs-model', exit };
  }
  if (!failing.length) return { matches, verdict: 'pass', exit: 0 };
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
export function runChecks(list, runner, rules = loadRules(), ctx = DEFAULT_CTX) {
  const results = [];
  for (const check of list) {
    const started = Date.now();
    const { status, out } = runner(check);
    const ms = Date.now() - started;
    if (status === 0) { results.push({ id: check.id, status: 'pass', exit: 0, ms }); continue; }
    const t = triage(out, rules, ctx);
    // Tag the check name onto the text so a rule keyed on the tool name can see it.
    const tagged = t.matches.length ? t : triage(`${check.id}: ${out}`, rules, ctx);
    // No rule explains it: a nonzero exit with nothing recognised needs a model, never "explained".
    const exit = tagged.matches.length ? Math.max(1, tagged.exit) : 2;
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

// ---- devmerge ----

// Derived files a dev merge may resolve by taking dev's side, then regenerating.
// buildordinal.json is derived too (tools/bundle.mjs writes it), so it is taken the same way.
const GENERATED_PATHS = [
  /^src\/content\/generated\//,
  /^games\/[^/]+\/(build\.summary\.json|game\.lock\.json)$/,
  /^(.+\/)?game\.lock\.json$/,
  /^src\/content\/changelog\.generated\.js$/,
  /^src\/framework\/data\/[^/]+\.js$/,
  /^buildordinal\.json$/,
];

// Pure: sort conflicted paths into generated (take theirs), changelog (merge by
// rule) and other (a person or model must resolve; the merge is aborted).
export function classifyConflicts(paths) {
  const out = { generated: [], changelog: [], other: [] };
  for (const raw of paths) {
    const path = String(raw).replace(/\\/g, '/');
    if (path === 'CHANGELOG.md') out.changelog.push(path);
    else if (GENERATED_PATHS.some(re => re.test(path))) out.generated.push(path);
    else out.other.push(path);
  }
  return out;
}

// Pure: resolve every conflict block in CHANGELOG.md text. Ours (HEAD) receipt
// block first, then theirs; a non-blank line of ours that theirs already holds is dropped.
export function resolveChangelogConflict(text) {
  // diff3/zdiff3 add a `||||||| base` section between ours and `=======`; it is dropped.
  const re = /^<{7}[^\n]*\n([\s\S]*?)(?:^\|{7}[^\n]*\n[\s\S]*?)?^={7}\n([\s\S]*?)^>{7}[^\n]*\n?/gm;
  return text.replace(re, (_all, ours, theirs) => {
    const have = new Set(theirs.split('\n').filter(l => l.trim()));
    const kept = ours.split('\n').filter(l => !l.trim() || !have.has(l));
    // blank separators from ours add nothing once its receipts are gone
    const oursText = kept.join('\n').replace(/^\n+|\n+$/g, '');
    return `${oursText ? `${oursText}\n` : ''}${theirs}`;
  });
}

const git = (args, cwd) => run('git', args, { cwd });

// deps: injectable regen/restamp/node runner, so tests need not run the full repo tools.
export function devmerge({ base = 'dev', pr = null, cwd = ROOT, deps = {} }) {
  const doRegen = deps.regen || regen;
  const doRestamp = deps.restamp || restamp;
  const runNode = deps.node || node;
  const top = git(['rev-parse', '--show-toplevel'], cwd).out.trim() || cwd;
  const dirty = git(['status', '--porcelain', '--untracked-files=no'], top).out.trim();
  if (dirty) return { exit: 1, verdict: 'dirty-tree', files: dirty.split('\n') };
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], top).out.trim();
  const fetched = git(['fetch', '--filter=blob:none', 'origin', base], top);
  if (fetched.status !== 0) return { exit: 2, verdict: 'fetch-failed', tail: fetched.out.trim().slice(-400) };
  const merged = git(['merge', '--no-edit', '--no-ff', '--no-commit', `origin/${base}`], top);
  if (merged.status === 0 && /Already up to date/i.test(merged.out)) return { exit: 0, verdict: 'up-to-date', branch };
  const resolved = { generated: [], changelog: [] };
  if (merged.status !== 0) {
    const unmerged = git(['diff', '--name-only', '--diff-filter=U'], top).out.split('\n').filter(Boolean);
    const cls = classifyConflicts(unmerged);
    if (!unmerged.length || cls.other.length) {
      git(['merge', '--abort'], top);
      return { exit: 2, verdict: 'needs-model', reason: unmerged.length ? 'conflicts outside the derived files' : 'merge failed without a file conflict', files: cls.other.length ? cls.other : [], tail: unmerged.length ? '' : merged.out.trim().slice(-400) };
    }
    for (const f of cls.generated) {
      const co = git(['checkout', '--theirs', '--', f], top);
      if (co.status === 0) git(['add', '--', f], top); else git(['rm', '-f', '--', f], top);
      resolved.generated.push(f);
    }
    for (const f of cls.changelog) {
      const path = resolve(top, f);
      writeFileSync(path, resolveChangelogConflict(readFileSync(path, 'utf8')));
      git(['add', '--', f], top);
      resolved.changelog.push(f);
    }
  }
  const notes = [];
  const g = doRegen(top);
  if (g.exit !== 0) return { exit: g.exit, verdict: 'regen-failed', branch, resolved, failed: g.failed, tail: g.tail, hint: 'merge left uncommitted; `git merge --abort` to undo' };
  const prNumber = pr || detectPr([], top);
  if (prNumber) {
    try {
      const r = doRestamp({ root: top, pr: prNumber });
      if (r.exit !== 0) return { exit: r.exit, verdict: 'restamp-failed', branch, resolved, failed: r.failed, tail: r.tail, hint: 'merge left uncommitted; `git merge --abort` to undo' };
      notes.push(`restamped #${prNumber} ${r.from} -> ${r.to}`);
    } catch (error) {
      notes.push(`restamp skipped: ${error.message}`);
    }
  } else notes.push('restamp skipped: no PR known (pass --pr N)');
  const pending = prNumber ? ['--pending', String(prNumber)] : [];
  const verify = runChecks([
    { id: 'about-changelog', args: ['tools/about-changelog.mjs', '--check-order', ...pending] },
    ...FAST_CHECKS.filter(c => ['content-build', 'config-build', 'game-config', 'framework-data-build', 'build-game'].includes(c.id)),
  ], c => runNode(c.args, { cwd: top }));
  if (verify.exit !== 0) return { exit: verify.exit, verdict: 'checks-failed', branch, resolved, checks: verify.results.filter(r => r.status === 'fail'), hint: 'merge left uncommitted; `git merge --abort` to undo' };
  git(['add', '-u'], top);
  const fresh = git(['ls-files', '--others', '--exclude-standard'], top).out.split('\n').filter(Boolean);
  for (const f of classifyConflicts(fresh).generated) git(['add', '--', f], top);
  const c = git(['commit', '--no-edit'], top);
  if (c.status !== 0) return { exit: 2, verdict: 'commit-failed', tail: c.out.trim().slice(-400) };
  const sha = git(['rev-parse', '--short', 'HEAD'], top).out.trim();
  return { exit: 0, verdict: 'merged', branch, sha, resolved, notes, push: `git push origin ${branch}` };
}

COMMANDS.devmerge = async (args) => {
  const baseAt = args.indexOf('--base');
  const prAt = args.indexOf('--pr');
  const r = devmerge({ base: baseAt >= 0 ? args[baseAt + 1] : 'dev', pr: prAt >= 0 ? Number(args[prAt + 1]) : null, cwd: process.cwd() });
  emit({ cmd: 'devmerge', ...r }, args.includes('--human'),
    o => [`jev devmerge: ${o.verdict} (exit ${o.exit})`, o.reason || '', ...(o.files || []).map(f => `  ${f}`), ...(o.notes || []), o.tail || '', o.hint || '', o.push ? `next (not run): ${o.push}` : ''].filter(Boolean).join('\n'));
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
