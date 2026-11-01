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
 * Only runs that PRECEDE the current one and did not succeed are taken: a cancelled or
 * failed run lost its cut, and a run still pending (conclusion empty or null: queued,
 * in progress) may be overtaken, because GitHub concurrency does not guarantee order, so
 * a newer run can acquire the group first. The older run, when it finally executes, finds
 * its own cut recorded (the workflow checks `--done` for every cut, the current one
 * included) and does nothing. A run with a higher number is left to its own run, which
 * reconciles this one in turn. Taking a later run would apply its bump before the
 * current event's (a main minor bump landing before an earlier release candidate bump
 * turns 0.7.2 into 0.8.2 instead of 0.8.1). Sorted by run number, de-duplicated on
 * branch+sha, current last. Each cut carries `before`, the branch's previous push head
 * (null when unknown), so the caller can run the bot-only check on before..sha for
 * recovered cuts exactly as for the current one.
 */
export function reconcileCuts(runs, current) {
  const byNumber = [...runs].sort((x, y) => x.number - y.number);
  // The branch's push BEFORE a run is the head sha of the previous push run on that
  // branch (any outcome: consecutive pushes chain). null when the list has none.
  const beforeOf = (branch, number) => {
    const prev = byNumber.filter((r) => r.branch === branch && r.number < number).pop();
    return prev ? prev.sha : null;
  };
  // The ordered list of earlier unrecorded runs: by run number, de-duplicated on branch+sha,
  // keeping the EARLIEST occurrence and its own predecessor as `before`.
  const seen = new Set();
  const list = [];
  for (const r of byNumber) {
    const key = `${r.branch} ${r.sha}`;
    if (r.number >= current.number || r.conclusion === 'success') continue;
    if (!/^(release|main)$/.test(r.branch) || seen.has(key)) continue;
    seen.add(key);
    const b = beforeOf(r.branch, r.number);
    list.push({ branch: r.branch, sha: r.sha, before: b === r.sha ? null : b });
  }
  // The current cut stays where it is when an earlier run already carried it (a dispatch
  // reselecting that head); otherwise it comes last, with its own before (github.event.before)
  // or the branch's previous head from the list. A before equal to the sha is unknown.
  if (seen.has(`${current.branch} ${current.sha}`)) return list;
  // With no explicit before, the earliest earlier push run of the same branch+sha in ALL runs,
  // success included (a bot-only push that succeeded wrote no record), names the real
  // predecessor; the list above stays limited to runs that did not succeed.
  const same = byNumber.find((r) => r.branch === current.branch && r.sha === current.sha && r.number < current.number);
  let before = current.before ?? beforeOf(current.branch, same ? same.number : current.number);
  if (before === current.sha) before = null;
  return [...list, { branch: current.branch, sha: current.sha, before }];
}

// ---- THE ACTIVITY FEED AND THE CURSOR (replaces the run-list reconciliation) ------------------
// Cuts come from GET /repos/{repo}/activity?ref=refs/heads/<release|main>, which records every
// ref update whether or not a workflow ran for it. A record on dev carries the feed event it
// applied as a `Version-Advance-Event: <id> <timestamp>` trailer. The CURSOR is the newest
// recorded event (timestamp, id); events at or before it are never reconsidered.

/** Events before this instant are not cuts this tool owes (set when the automation merged). */
export const SINCE = '2026-11-01T00:00:00Z';
const CUT_TYPES = new Set(['push', 'force_push', 'pr_merge', 'merge_queue_merge', 'branch_creation']);
const ZERO_SHA = /^0+$/;
const SUBJECT = /^version-advance: \d+\.\d+\.\d+ after (release|main) [0-9a-f]{7,40}\b/;
const TRAILER = /^Version-Advance-Event: (\d+) (\S+)\s*$/m;

/** Order two feed events (or a cursor) by (timestamp, id). Pure. */
export function cmpEvents(a, b) {
  const t = Date.parse(a.timestamp) - Date.parse(b.timestamp);
  if (t !== 0) return t < 0 ? -1 : 1;
  const x = BigInt(a.id);
  const y = BigInt(b.id);
  return x === y ? 0 : x < y ? -1 : 1;
}

/** The records a list of full commit messages hold: {id, timestamp, branch}. Pure. */
export function parseRecords(messages) {
  const out = [];
  for (const m of messages) {
    const subject = SUBJECT.exec(m);
    const trailer = TRAILER.exec(m);
    if (subject && trailer) out.push({ id: trailer[1], timestamp: trailer[2], branch: subject[1] });
  }
  return out;
}

/** The newest recorded event, or null when dev has no record yet. Pure. */
export function latestRecord(records) {
  return records.reduce((best, r) => (best === null || cmpEvents(r, best) > 0 ? r : best), null);
}

/** True when any message records the feed event `id`. Pure. */
export function recordsEvent(messages, id) {
  return parseRecords(messages).some((r) => r.id === String(id));
}

/** The branch an event moved, or null when it is not release or main. */
export const eventBranch = (e) => ((e.ref === 'refs/heads/release' && 'release') || (e.ref === 'refs/heads/main' && 'main') || null);

/**
 * The cuts owed, oldest first. Pure. `events` are feed entries (any order, any overlap);
 * `cursor` is the newest recorded {id, timestamp} or null (then SINCE). An event is a cut when it
 * is after the cursor, on release or main, of a pushing type (branch_creation counts; its
 * all-zero before is a cut, not a bot check) and not bot-only per `isBotOnly(event)`.
 * branch_deletion and other types are dropped. Each cut: {id, timestamp, branch, before, after}.
 */
export function planCuts(events, cursor, isBotOnly) {
  const floor = cursor ?? { id: '0', timestamp: SINCE };
  const seen = new Set();
  const cuts = [];
  for (const e of [...events].sort(cmpEvents)) {
    const branch = eventBranch(e);
    if (!branch || !CUT_TYPES.has(e.activity_type) || seen.has(String(e.id))) continue;
    if (cmpEvents(e, floor) <= 0) continue;
    seen.add(String(e.id));
    const created = !e.before || ZERO_SHA.test(e.before);
    if (!created && isBotOnly(e)) continue;
    cuts.push({ id: String(e.id), timestamp: e.timestamp, branch, before: created ? null : e.before, after: e.after });
  }
  return cuts;
}

/** The commit subject the workflow writes. One home for the format. */
export const advanceSubject = (next, branch, sha) => `version-advance: ${next} after ${branch} ${sha} [version-advance]`;

/** The full commit message the workflow writes: subject plus the event trailer. */
export const advanceMessage = (next, branch, sha, event) =>
  `${advanceSubject(next, branch, sha)}\n\nVersion-Advance-Event: ${event.id} ${event.timestamp}\n`;

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
