// version-advance — the release triple's automatic bump (owner, 2026-11-01).
//
//   node tools/version-advance.mjs --kind candidate|minor [--write] [--check]
//
// The triple's one home is `version: 'X.Y.Z'` in src/content/index.js
// (contentBundle.version). Candidate: Z+1. Minor: Y+1, Z=0. MAJOR is never
// touched here; it stays the owner's Tier 2 decision. The fourth component is
// not this tool's business: tools/buildversion.mjs restarts the ordinal at 0 when
// the triple changes.
//
// Without --write the next triple is printed and nothing is written; --check
// prints "pending" with the same arithmetic and also writes nothing. With --write
// only two things change: the version literal, and the `// version-advance: X.Y.Z`
// marker comment beside it. A minor bump also moves `const SERIES = 'X.Y'` in
// tools/release-series.mjs, the series gate, so that gate stays green.
//
// `--read-current` prints the triple the file holds now; `--subject <triple> <branch> <sha>`
// prints the commit subject the workflow writes.
//
// IDEMPOTENCE: `--done <branch> <sha>` exits 0 when a commit on HEAD already records that
// branch and source sha as `version-advance: <triple> after <release|main> <sha>`, else 1.
// The workflow runs it first, so a re-run of a push never bumps twice.
// .github/workflows/version-advance.yml is the caller; a person never runs it.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
export const VERSION_FILE = 'src/content/index.js';
export const SERIES_FILE = 'tools/release-series.mjs';

const LITERAL = /(version:\s*')(\d+)\.(\d+)\.(\d+)(')/;
const MARKER = /^(\s*\/\/ version-advance: )\d+\.\d+\.\d+$/m;
const SERIES = /^(const SERIES = ')\d+\.\d+(';)$/m;

export function parseTriple(text) {
  const m = LITERAL.exec(text);
  if (!m) throw new Error(`no version: 'X.Y.Z' literal found in ${VERSION_FILE}`);
  return [Number(m[2]), Number(m[3]), Number(m[4])];
}

/** The next triple. Pure. Major is never moved. */
export function nextTriple([major, minor, candidate], kind) {
  if (kind === 'candidate') return [major, minor, candidate + 1];
  if (kind === 'minor') return [major, minor + 1, 0];
  throw new Error(`--kind must be candidate or minor, got '${kind}'`);
}

const fmt = (t) => t.join('.');

/** Rewrite the literal and its marker comment; nothing else. Pure. */
export function advanceSource(text, kind) {
  const next = fmt(nextTriple(parseTriple(text), kind));
  if (!MARKER.test(text)) throw new Error(`no '// version-advance: X.Y.Z' marker found in ${VERSION_FILE}`);
  return {
    next,
    text: text.replace(LITERAL, (_, a, _M, _m, _c, e) => `${a}${next}${e}`).replace(MARKER, (_, a) => `${a}${next}`),
  };
}

/** The series gate follows a minor bump (major.minor of the new triple). Pure. */
export function advanceSeries(text, next) {
  if (!SERIES.test(text)) throw new Error(`no "const SERIES = 'X.Y';" line found in ${SERIES_FILE}`);
  return text.replace(SERIES, (_, a, e) => `${a}${next.split('.').slice(0, 2).join('.')}${e}`);
}

/**
 * True when any subject records THIS branch and sha as an advance. Pure. The record is
 * keyed on both: a sha cut to release and later fast-forwarded to main is a different
 * event (candidate, then minor), so release's record must not satisfy main.
 */
export function recordsSource(subjects, branch, sha) {
  if (!/^(release|main)$/.test(branch)) throw new Error(`'${branch}' is not release or main`);
  if (!/^[0-9a-f]{7,40}$/.test(sha)) throw new Error(`'${sha}' is not a commit sha`);
  return subjects.some((s) => new RegExp(`^version-advance: \\d+\\.\\d+\\.\\d+ after ${branch} ${sha}\\b`).test(s));
}

/**
 * The cuts one run must apply, oldest first. Pure. `runs` are earlier push runs of the
 * workflow as {number, branch, sha, conclusion}; `current` is {number, branch, sha}.
 * Only runs that PRECEDE the current one and did not succeed are taken (a cancelled or
 * failed run lost its cut); a run with a higher number is left to its own run, which
 * reconciles this one in turn. Taking a later run would apply its bump before the
 * current event's (a main minor bump landing before an earlier release candidate bump
 * turns 0.7.2 into 0.8.2 instead of 0.8.1). Sorted by run number, de-duplicated on
 * branch+sha, current last. Each cut carries `before`, the branch's previous push head
 * (null when unknown), so the caller can run the bot-only check on before..sha for
 * recovered cuts exactly as for the current one.
 */
export function reconcileCuts(runs, current) {
  const lost = new Set(['cancelled', 'failure', 'timed_out']);
  const byNumber = [...runs].sort((x, y) => x.number - y.number);
  // The branch's push BEFORE a run is the head sha of the previous push run on that
  // branch (any outcome: consecutive pushes chain). null when the list has none.
  const beforeOf = (branch, number) => {
    const prev = byNumber.filter((r) => r.branch === branch && r.number < number).pop();
    return prev ? prev.sha : null;
  };
  const seen = new Set([`${current.branch} ${current.sha}`]);
  const out = [];
  for (const r of byNumber) {
    const key = `${r.branch} ${r.sha}`;
    if (r.number >= current.number || !lost.has(r.conclusion)) continue;
    if (!/^(release|main)$/.test(r.branch) || seen.has(key)) continue;
    seen.add(key);
    out.push({ branch: r.branch, sha: r.sha, before: beforeOf(r.branch, r.number) });
  }
  // The current event knows its own before (github.event.before); fall back to the list.
  const before = current.before ?? beforeOf(current.branch, current.number);
  return [...out, { branch: current.branch, sha: current.sha, before }];
}

/** The commit subject the workflow writes. One home for the format. */
export const advanceSubject = (next, branch, sha) => `version-advance: ${next} after ${branch} ${sha} [version-advance]`;

function main(argv, root = ROOT) {
  const d = argv.indexOf('--done');
  if (d >= 0) {
    const subjects = execFileSync('git', ['log', '--format=%s'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 }).split('\n');
    return recordsSource(subjects, argv[d + 1] || '', argv[d + 2] || '') ? 0 : 1;
  }
  const rc = argv.indexOf('--reconcile');
  if (rc >= 0) {
    const [number, branch, sha, beforeArg] = argv.slice(rc + 1);
    const cb = /[1-9a-f]/.test(beforeArg || '') ? beforeArg : undefined; // all-zero or absent: ask the list
    const runs = JSON.parse(readFileSync(0, 'utf8') || '[]').map((r) => ({
      number: r.number, branch: r.headBranch, sha: r.headSha, conclusion: r.conclusion,
    }));
    for (const c of reconcileCuts(runs, { number: Number(number), branch, sha, before: cb })) console.log(`${c.branch} ${c.sha} ${c.before ?? '-'}`);
    return 0;
  }
  const sj = argv.indexOf('--subject');
  if (sj >= 0) {
    const [next, branch, sha] = argv.slice(sj + 1);
    if (!/^\d+\.\d+\.\d+$/.test(next || '') || !/^(release|main)$/.test(branch || '') || !/^[0-9a-f]{7,40}$/.test(sha || '')) {
      console.error('version-advance: --subject wants <triple> <release|main> <sha>');
      return 2;
    }
    console.log(advanceSubject(next, branch, sha));
    return 0;
  }
  const k = argv.indexOf('--kind');
  const kind = k >= 0 ? argv[k + 1] : undefined;
  if (kind !== 'candidate' && kind !== 'minor') {
    console.error('version-advance: --kind candidate|minor is required');
    return 2;
  }
  const file = resolve(root, VERSION_FILE);
  const src = readFileSync(file, 'utf8');
  const cur = fmt(parseTriple(src));
  if (argv.includes('--read-current')) {
    console.log(cur);
    return 0;
  }
  const { next, text } = advanceSource(src, kind);
  if (argv.includes('--check')) {
    console.log(`version-advance: ${cur} -> ${next} (${kind}) is pending`);
    return 0;
  }
  if (!argv.includes('--write')) {
    console.log(next);
    return 0;
  }
  writeFileSync(file, text, 'utf8');
  if (kind === 'minor') {
    const sf = resolve(root, SERIES_FILE);
    writeFileSync(sf, advanceSeries(readFileSync(sf, 'utf8'), next), 'utf8');
  }
  console.log(`version-advance: ${cur} -> ${next} (${kind})`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try { process.exit(main(process.argv.slice(2), process.env.VERSION_ADVANCE_ROOT || ROOT)); }
  catch (error) { console.error(`version-advance: ${error.message}`); process.exit(2); }
}
