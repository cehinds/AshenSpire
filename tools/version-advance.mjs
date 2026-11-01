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
// `--read-current` prints the triple the file holds now.
//
// THE CUTS: `--plan` prints the feed events (GET /repos/{repo}/activity on release and main) after
// the newest one dev records, oldest first (see planCuts). IDEMPOTENCE: `--done-event <id>` exits 0
// when a commit on HEAD carries `Version-Advance-Event: <id> ...`, else 1; the workflow runs it
// before each bump, so a re-run never bumps twice. `--message <triple> <branch> <sha> <id> <ts>`
// prints the commit message (subject plus that trailer).
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
 * branch_deletion and other types are dropped. Copies of one event (same ref, before, after,
 * timestamp) are one cut, under the lowest id. Each cut: {id, timestamp, branch, before, after}.
 */
export function planCuts(events, cursor, isBotOnly) {
  const floor = cursor ?? { id: '0', timestamp: SINCE };
  // The feed sometimes lists one push/merge twice under different ids. Copies share
  // (ref, before, after, timestamp); the lowest id speaks for the group. The group is formed
  // BEFORE the cursor test, so a cursor on any copy covers every copy (a crash between copies
  // must not bump twice) because the lowest id sorts at or before the cursor's.
  const groups = new Map();
  for (const e of [...events].sort(cmpEvents)) {
    const branch = eventBranch(e);
    if (!branch || !CUT_TYPES.has(e.activity_type)) continue;
    const key = [e.ref, e.before, e.after, Date.parse(e.timestamp)].join('|');
    const rep = groups.get(key);
    if (!rep) groups.set(key, e);
    else if (cmpEvents(e, rep) < 0) groups.set(key, e);
  }
  const cuts = [];
  for (const e of [...groups.values()].sort(cmpEvents)) {
    if (cmpEvents(e, floor) <= 0) continue;
    const created = !e.before || ZERO_SHA.test(e.before);
    if (!created && isBotOnly(e)) continue;
    cuts.push({ id: String(e.id), timestamp: e.timestamp, branch: eventBranch(e), before: created ? null : e.before, after: e.after });
  }
  return cuts;
}

/** The commit subject the workflow writes. One home for the format. */
export const advanceSubject = (next, branch, sha) => `version-advance: ${next} after ${branch} ${sha} [version-advance]`;

/** The full commit message the workflow writes: subject plus the event trailer. */
export const advanceMessage = (next, branch, sha, event) =>
  `${advanceSubject(next, branch, sha)}\n\nVersion-Advance-Event: ${event.id} ${event.timestamp}\n`;

/** A run that must stop and write nothing: the feed cannot be trusted this time. */
export class FailClosed extends Error {}

/**
 * The events of one ref newer than the cursor, paged newest-first until the cursor is reached.
 * `fetchPage(ref, token)` -> {events, next}; `next` is null on the last page. The ref that owns
 * the cursor (cursor.branch) must show the cursor id before the feed runs out, else FailClosed
 * (a feed that lost the cursor would silently drop cuts). The other ref stops at the first event at
 * or before the cursor, or at the end of the feed. With no cursor it stops at SINCE.
 */
export async function collectEvents({ fetchPage, ref, cursor, since = SINCE }) {
  const floor = cursor ?? { id: '0', timestamp: since };
  const owns = Boolean(cursor) && `refs/heads/${cursor.branch}` === ref;
  const out = [];
  let token = null;
  for (;;) {
    const page = await fetchPage(ref, token);
    out.push(...page.events);
    const reached = page.events.some((e) => cmpEvents(e, floor) <= 0);
    if (owns) {
      if (page.events.some((e) => String(e.id) === String(cursor.id))) return out;
      if (reached) throw new FailClosed(`the cursor event ${cursor.id} is not in the feed of ${ref}`);
    } else if (reached) return out;
    if (!page.next) {
      if (owns) throw new FailClosed(`the feed of ${ref} ran out before the cursor event ${cursor.id}`);
      return out;
    }
    token = page.next;
  }
}

/** Wait (backoff) until the feed of `ref` lists `after`, else FailClosed. */
export async function awaitLag({ fetchPage, ref, after, sleep, tries = 5, firstDelayMs = 10000 }) {
  for (let i = 0; i < tries; i++) {
    const page = await fetchPage(ref, null);
    if (page.events.some((e) => e.after === after)) return;
    if (i < tries - 1) await sleep(firstDelayMs * 2 ** i);
  }
  throw new FailClosed(`the activity feed of ${ref} does not list ${after} after ${tries} tries (feed lag)`);
}

/**
 * Everything one run decides, with the I/O injected: the cuts to apply, oldest first. Throws
 * FailClosed (and the caller writes nothing) on feed lag or a lost cursor. `trigger` is
 * {ref, after} for a push event, null for a dispatch.
 */
export async function planRun({ fetchPage, messages, trigger = null, isBotOnly, sleep, since = SINCE }) {
  const cursor = latestRecord(parseRecords(messages));
  if (trigger && trigger.after && !ZERO_SHA.test(trigger.after)) await awaitLag({ fetchPage, ref: trigger.ref, after: trigger.after, sleep });
  const events = [];
  for (const ref of ['refs/heads/release', 'refs/heads/main']) events.push(...await collectEvents({ fetchPage, ref, cursor, since }));
  return planCuts(events, cursor, isBotOnly);
}

function gh(args, input) {
  return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 1 << 28, input });
}

/** The real feed page: `gh api -i`, the next page from the Link header. */
function realFetchPage(repo) {
  return async (ref, token) => {
    const path = token ?? `repos/${repo}/activity?ref=${encodeURIComponent(ref)}&per_page=100`;
    const raw = gh(['api', '-i', path]);
    const at = raw.search(/\r?\n\r?\n/);
    const head = raw.slice(0, at);
    const body = raw.slice(at).trim();
    const link = /^link:.*<([^>]+)>;\s*rel="next"/im.exec(head);
    return { events: JSON.parse(body || '[]'), next: link ? link[1].replace(/^https:\/\/[^/]+\//, '') : null };
  };
}

/** True when every commit in before..after is a github-actions[bot] one. Fails loudly, never guesses. */
function realIsBotOnly(repo, root) {
  const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] });
  const authorsOf = (e) => {
    try { return git('log', '--format=%an', `${e.before}..${e.after}`); } catch { /* fall through */ }
    try {
      git('fetch', '-q', 'origin', e.before);
      git('fetch', '-q', 'origin', e.after);
      return git('log', '--format=%an', `${e.before}..${e.after}`);
    } catch { /* fall through */ }
    return gh(['api', `repos/${repo}/compare/${e.before}...${e.after}`, '--jq', '.commits[].commit.author.name']);
  };
  return (e) => {
    const authors = authorsOf(e).split('\n').filter(Boolean);
    return authors.every((a) => a === 'github-actions[bot]');
  };
}

const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

async function plan(root) {
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) throw new Error('GITHUB_REPOSITORY is required for --plan');
  const messages = execFileSync('git', ['log', '--format=%B%x1e'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 }).split('\x1e');
  const trigger = process.env.EVENT_NAME === 'push' ? { ref: process.env.EVENT_REF, after: process.env.EVENT_AFTER } : null;
  try {
    const cuts = await planRun({ fetchPage: realFetchPage(repo), messages, trigger, isBotOnly: realIsBotOnly(repo, root), sleep: sleepMs });
    for (const c of cuts) console.log(`${c.id} ${c.timestamp} ${c.branch} ${c.after}`);
    return 0;
  } catch (error) {
    if (!(error instanceof FailClosed)) throw error;
    console.error(`::error::version-advance: ${error.message}; nothing was written.`);
    return 1;
  }
}

async function main(argv, root = ROOT) {
  if (argv.includes('--plan')) return plan(root);
  const de = argv.indexOf('--done-event');
  if (de >= 0) {
    const messages = execFileSync('git', ['log', '--format=%B%x1e'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 }).split('\x1e');
    return recordsEvent(messages, argv[de + 1] || '') ? 0 : 1;
  }
  const mg = argv.indexOf('--message');
  if (mg >= 0) {
    const [next, branch, sha, id, timestamp] = argv.slice(mg + 1);
    if (!/^\d+\.\d+\.\d+$/.test(next || '') || !/^(release|main)$/.test(branch || '') || !/^[0-9a-f]{7,40}$/.test(sha || '') || !/^\d+$/.test(id || '') || !timestamp) {
      console.error('version-advance: --message wants <triple> <release|main> <sha> <event id> <timestamp>');
      return 2;
    }
    process.stdout.write(advanceMessage(next, branch, sha, { id, timestamp }));
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
  main(process.argv.slice(2), process.env.VERSION_ADVANCE_ROOT || ROOT).then(process.exit, (error) => {
    console.error(`version-advance: ${error.message}`);
    process.exit(2);
  });
}
