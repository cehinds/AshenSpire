// tests/version-advance.test.mjs — the automatic release-triple bump (owner, 2026-11-01).
import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { planCuts, parseRecords, latestRecord, recordsEvent, advanceMessage, cmpEvents, advanceSeries, advanceSource, advanceSubject, nextTriple, parseTriple, VERSION_FILE, SERIES_FILE } from '../tools/version-advance.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = `  // version-advance: 0.7.2\n  version: '0.7.2',\n  balance,\n`;

test('candidate: 0.7.2 -> 0.7.3, minor: 0.7.3 -> 0.8.0, major untouched', () => {
  assert.deepEqual(nextTriple([0, 7, 2], 'candidate'), [0, 7, 3]);
  assert.deepEqual(nextTriple([0, 7, 3], 'minor'), [0, 8, 0]);
  assert.deepEqual(nextTriple([1, 9, 9], 'minor'), [1, 10, 0]);
  assert.deepEqual(nextTriple([1, 2, 9], 'candidate'), [1, 2, 10]);
  assert.throws(() => nextTriple([0, 7, 2], 'major'));
});

test('advanceSource rewrites only the literal and its marker', () => {
  const a = advanceSource(SRC, 'candidate');
  assert.equal(a.next, '0.7.3');
  assert.equal(a.text, SRC.replaceAll('0.7.2', '0.7.3'));
  const b = advanceSource(a.text, 'minor');
  assert.equal(b.next, '0.8.0');
  assert.equal(b.text, SRC.replaceAll('0.7.2', '0.8.0'));
  assert.equal(parseTriple(b.text).join('.'), '0.8.0');
});

test('advanceSource refuses a file that lost its literal or marker', () => {
  assert.throws(() => advanceSource('nothing', 'candidate'));
  assert.throws(() => advanceSource("  version: '0.7.2',\n", 'candidate'), /marker/);
});

test('the real home parses and carries the marker', () => {
  const text = readFileSync(join(ROOT, VERSION_FILE), 'utf8');
  const t = parseTriple(text).join('.');
  assert.match(text, new RegExp(`^\\s*// version-advance: ${t.replaceAll('.', '\\.')}$`, 'm'));
  advanceSource(text, 'candidate');
});

test('advanceSeries follows a minor bump only through the one SERIES line', () => {
  const t = "const SERIES = '0.7';\nconst x = 1;\n";
  assert.equal(advanceSeries(t, '0.8.0'), "const SERIES = '0.8';\nconst x = 1;\n");
  assert.throws(() => advanceSeries('nothing', '0.8.0'));
  const real = readFileSync(join(ROOT, SERIES_FILE), 'utf8');
  advanceSeries(real, '0.8.0');
});

test('CLI dry run in a temp copy: prints the next triple, --write moves both files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'va-'));
  try {
    for (const f of [VERSION_FILE, SERIES_FILE]) {
      mkdirSync(dirname(join(dir, f)), { recursive: true });
      cpSync(join(ROOT, f), join(dir, f));
    }
    const run = (...args) => spawnSync(process.execPath, [join(ROOT, 'tools/version-advance.mjs'), ...args],
      { env: { ...process.env, VERSION_ADVANCE_ROOT: dir }, encoding: 'utf8' });
    const cur = parseTriple(readFileSync(join(dir, VERSION_FILE), 'utf8'));
    const before = readFileSync(join(dir, VERSION_FILE), 'utf8');
    const dry = run('--kind', 'candidate');
    assert.equal(dry.status, 0);
    assert.equal(dry.stdout.trim(), nextTriple(cur, 'candidate').join('.'));
    assert.equal(readFileSync(join(dir, VERSION_FILE), 'utf8'), before, 'no --write, no change');
    assert.equal(run('--kind', 'candidate', '--check').status, 0);
    assert.equal(readFileSync(join(dir, VERSION_FILE), 'utf8'), before);
    assert.equal(run('--kind', 'bogus').status, 2);
    // Pin a known start so the examples in the owner's request are exact.
    writeFileSync(join(dir, VERSION_FILE), before.replaceAll(cur.join('.'), '0.7.2'));
    // The series gate is pinned too: the repo's own SERIES moves with every real minor bump.
    writeFileSync(join(dir, SERIES_FILE), readFileSync(join(dir, SERIES_FILE), 'utf8').replace(/^(const SERIES = ')\d+\.\d+(';)$/m, (_, a, e) => `${a}0.7${e}`));
    assert.equal(run('--kind', 'candidate', '--write').status, 0);
    assert.equal(parseTriple(readFileSync(join(dir, VERSION_FILE), 'utf8')).join('.'), '0.7.3');
    assert.match(readFileSync(join(dir, SERIES_FILE), 'utf8'), /const SERIES = '0\.7';/);
    assert.equal(run('--kind', 'minor', '--write').status, 0);
    assert.equal(parseTriple(readFileSync(join(dir, VERSION_FILE), 'utf8')).join('.'), '0.8.0');
    assert.match(readFileSync(join(dir, SERIES_FILE), 'utf8'), /const SERIES = '0\.8';/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('CLI: --read-current and --message, and the message round-trips through the guard', () => {
  const run = (...args) => spawnSync(process.execPath, [join(ROOT, 'tools/version-advance.mjs'), ...args], { encoding: 'utf8' });
  const sha = 'c'.repeat(40);
  const cur = parseTriple(readFileSync(join(ROOT, VERSION_FILE), 'utf8')).join('.');
  assert.equal(run('--kind', 'candidate', '--read-current').stdout.trim(), cur);
  const message = run('--message', '0.7.3', 'release', sha, '41', '2026-11-02T00:00:00Z');
  assert.equal(message.status, 0);
  assert.equal(message.stdout, `version-advance: 0.7.3 after release ${sha} [version-advance]\n\nVersion-Advance-Event: 41 2026-11-02T00:00:00Z\n`);
  assert.equal(recordsEvent([message.stdout], 41), true);
  assert.equal(recordsEvent([message.stdout], 42), false);
  assert.equal(run('--message', '0.7.3', 'dev', sha, '41', 'x').status, 2);
});
// ---- planCuts: the activity feed and the cursor -------------------------------------------------

const ev = (id, branch, before, after, type = 'push', ts) => ({
  id, activity_type: type, ref: `refs/heads/${branch}`, before, after, timestamp: ts ?? `2026-11-02T00:00:${String(id).padStart(2, '0')}Z`,
});
const noBots = () => false;

test('planCuts: events after the cursor only, oldest first, release/main only', () => {
  const events = [ev(5, 'release', 'a', 'b'), ev(3, 'main', 'c', 'd'), ev(4, 'dev', 'e', 'f'), ev(9, 'release', 'b', 'c')];
  assert.deepEqual(planCuts(events, null, noBots).map((c) => c.id), ['3', '5', '9']);
  assert.deepEqual(planCuts(events, { id: '5', timestamp: ev(5).timestamp }, noBots).map((c) => c.id), ['9']);
  assert.deepEqual(planCuts(events, { id: '9', timestamp: ev(9).timestamp }, noBots), []);
});

test('planCuts: types, force push, branch creation, deletion, duplicates', () => {
  const z = '0'.repeat(40);
  const events = [
    ev(1, 'release', 'a', 'b', 'force_push'), ev(2, 'main', 'b', 'c', 'pr_merge'), ev(3, 'main', 'c', 'd', 'merge_queue_merge'),
    ev(4, 'release', z, 'e', 'branch_creation'), ev(5, 'release', 'e', z, 'branch_deletion'), ev(6, 'main', 'd', 'x', 'whatever'),
    ev(1, 'release', 'a', 'b', 'force_push'),
  ];
  const cuts = planCuts(events, null, (e) => (e.before === z ? assert.fail('a creation must not be bot-checked') : false));
  assert.deepEqual(cuts.map((c) => [c.id, c.branch]), [['1', 'release'], ['2', 'main'], ['3', 'main'], ['4', 'release']]);
  assert.equal(cuts[3].before, null);
});

test('planCuts: a bot-only event is skipped, however many events follow it', () => {
  const events = [ev(1, 'release', 'a', 'bot'), ...Array.from({ length: 150 }, (_, i) => ev(i + 2, 'main', `m${i}`, `m${i + 1}`))];
  const cuts = planCuts(events, null, (e) => e.after === 'bot');
  assert.equal(cuts.length, 150);
  assert.ok(cuts.every((c) => c.branch === 'main'));
});

test('planCuts: a push that never started a run still gets its cut; release-then-main = 0.8.0, main-then-release = 0.8.1', () => {
  const fold = (cuts) => cuts.reduce((t, c) => nextTriple(t, c.branch === 'release' ? 'candidate' : 'minor'), [0, 7, 2]).join('.');
  assert.equal(fold(planCuts([ev(2, 'main', 'b', 'c'), ev(1, 'release', 'a', 'b')], null, noBots)), '0.8.0');
  assert.equal(fold(planCuts([ev(1, 'main', 'a', 'b'), ev(2, 'release', 'b', 'c')], null, noBots)), '0.8.1');
});

test('records: the trailer round-trips and the cursor is the newest by (timestamp, id)', () => {
  const m1 = advanceMessage('0.7.3', 'release', 'a'.repeat(40), { id: '7', timestamp: '2026-11-02T00:00:07Z' });
  const m2 = advanceMessage('0.8.0', 'main', 'b'.repeat(40), { id: '12', timestamp: '2026-11-02T00:00:03Z' });
  assert.match(m1, /^version-advance: 0\.7\.3 after release a{40} \[version-advance\]\n\nVersion-Advance-Event: 7 2026-11-02T00:00:07Z\n$/);
  const recs = parseRecords([m1, m2, 'unrelated', 'version-advance: 0.7.3 after release aaaaaaa [x]\n']);
  assert.equal(recs.length, 2);
  assert.deepEqual(latestRecord(recs), { id: '7', timestamp: '2026-11-02T00:00:07Z', branch: 'release' });
  assert.equal(latestRecord([]), null);
  assert.equal(recordsEvent([m1, m2], 12), true);
  assert.equal(recordsEvent([m1, m2], 8), false);
  assert.equal(cmpEvents({ id: '2', timestamp: '2026-11-02T00:00:00Z' }, { id: '10', timestamp: '2026-11-02T00:00:00Z' }), -1);
});

// ---- planRun: paging, lag, fail closed -----------------------------------------------------------
import { FailClosed, collectEvents, planRun } from '../tools/version-advance.mjs';

/** A fake feed: per-ref arrays (any order); pages of `size` newest-first. */
const feedOf = (events, size = 100) => async (ref, token) => {
  const all = events.filter((e) => e.ref === ref).sort((a, b) => cmpEvents(b, a));
  const at = token ? Number(token) : 0;
  return { events: all.slice(at, at + size), next: at + size < all.length ? String(at + size) : null };
};
const msgFor = (e, branch = 'release') => advanceMessage('0.7.3', branch, 'a'.repeat(40), e);

test('planRun: pages past 100 events to the cursor; a bot-only event aged past a page still skipped', async () => {
  const events = [ev(1, 'release', 'a', 'bot'), ...Array.from({ length: 250 }, (_, i) => ev(i + 2, 'main', `m${i}`, `m${i + 1}`, 'push', `2026-11-02T01:${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}Z`))];
  const cuts = await planRun({ fetchPage: feedOf(events, 100), messages: [], isBotOnly: (e) => e.after === 'bot', sleep: async () => {} });
  assert.equal(cuts.length, 250);
  const cursor = events[100];
  const after = await planRun({ fetchPage: feedOf(events, 100), messages: [msgFor(cursor, 'main')], isBotOnly: noBots, sleep: async () => {} });
  assert.ok(after.every((c) => cmpEvents(c, cursor) > 0));
});

test('planRun: no record yet stops at SINCE; a lost cursor fails closed', async () => {
  const old = ev(1, 'release', 'a', 'b', 'push', '2026-10-01T00:00:00Z');
  const cuts = await planRun({ fetchPage: feedOf([old, ev(2, 'release', 'b', 'c')], 1), messages: [], isBotOnly: noBots, sleep: async () => {} });
  assert.deepEqual(cuts.map((c) => c.id), ['2']);
  const lost = { id: '77', timestamp: '2026-11-02T00:00:50Z' };
  await assert.rejects(planRun({ fetchPage: feedOf([ev(2, 'release', 'b', 'c')]), messages: [msgFor(lost)], isBotOnly: noBots, sleep: async () => {} }), FailClosed);
  await assert.rejects(collectEvents({ fetchPage: feedOf([ev(60, 'release', 'b', 'c')]), ref: 'refs/heads/release', cursor: { ...lost, branch: 'release' } }), FailClosed);
});

test('planRun: feed lag retries with backoff then fails closed; it recovers when the event shows up', async () => {
  const sleeps = [];
  const e = ev(2, 'release', 'b', 'c');
  await assert.rejects(planRun({ fetchPage: feedOf([]), messages: [], trigger: { ref: e.ref, after: 'c' }, isBotOnly: noBots, sleep: async (ms) => sleeps.push(ms) }), FailClosed);
  assert.deepEqual(sleeps, [10000, 20000, 40000, 80000]);
  let calls = 0;
  const lagging = async (ref, t) => (++calls < 3 ? { events: [], next: null } : feedOf([e])(ref, t));
  const cuts = await planRun({ fetchPage: lagging, messages: [], trigger: { ref: e.ref, after: 'c' }, isBotOnly: noBots, sleep: async () => {} });
  assert.deepEqual(cuts.map((c) => c.id), ['2']);
});

// ---- simulation: random histories against a simulated feed and dev -------------------------------
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

test('simulation: recorded events are always an ordered prefix of the non-bot events; a clean run completes them', async () => {
  for (let seed = 1; seed <= 300; seed++) {
    const rand = rng(seed);
    const pick = (xs) => xs[Math.floor(rand() * xs.length)];
    const feed = [];
    const bots = new Set();
    const dev = { messages: [], triple: [0, 7, 2] };
    let nextId = 100 + Math.floor(rand() * 5);
    const noSleep = async () => {};
    const humanEvents = () => feed.filter((e) => !bots.has(e.after)).sort(cmpEvents);
    const recordedIds = () => dev.messages.flatMap((m) => parseRecords([m]).map((r) => r.id));
    const push = () => {
      const id = nextId++;
      const branch = pick(['release', 'main']);
      const type = pick(['push', 'push', 'push', 'force_push', 'pr_merge']);
      const e = { id, activity_type: type, ref: `refs/heads/${branch}`, before: `b${id - 1}`, after: `a${id}`, timestamp: `2026-11-02T00:00:${String(Math.floor(id / 3) % 60).padStart(2, '0')}Z` };
      if (rand() < 0.3) bots.add(e.after);
      feed.push(e);
      return e;
    };
    const apply = (cuts, crashAfter = Infinity) => {
      let n = 0;
      for (const c of cuts) {
        if (n++ >= crashAfter) return;
        if (recordsEvent(dev.messages, c.id)) continue;
        dev.triple = nextTriple(dev.triple, c.branch === 'release' ? 'candidate' : 'minor');
        dev.messages.push(advanceMessage(dev.triple.join('.'), c.branch, c.after.padEnd(7, '0').replace(/[^0-9a-f]/g, '0'), c));
      }
    };
    const plan = (view, trigger) => planRun({ fetchPage: feedOf(view, 4), messages: [...dev.messages], trigger, isBotOnly: (e) => bots.has(e.after), sleep: noSleep });
    const check = (where) => {
      const ids = recordedIds();
      assert.equal(new Set(ids).size, ids.length, `${where} seed ${seed}: duplicate record`);
      assert.deepEqual(ids, humanEvents().map((e) => String(e.id)).slice(0, ids.length), `${where} seed ${seed}: not an ordered prefix`);
    };
    let pendingPlan = null;
    for (let step = 0; step < 25; step++) {
      const r = rand();
      if (r < 0.4) push();
      else if (r < 0.7) {
        // A run for the newest push (or a dispatch), which may crash part way.
        const last = feed.at(-1);
        const trigger = last && rand() < 0.7 ? { ref: last.ref, after: last.after } : null;
        apply(await plan(feed, trigger), rand() < 0.4 ? Math.floor(rand() * 3) : Infinity);
      } else if (r < 0.8 && feed.length) {
        // Feed lag: the run cannot see the newest event; it must fail and write nothing.
        const last = feed.at(-1);
        const before = dev.messages.length;
        await assert.rejects(plan(feed.filter((e) => e !== last), { ref: last.ref, after: last.after }), FailClosed);
        assert.equal(dev.messages.length, before);
      } else if (r < 0.88 && dev.messages.length) {
        // A feed that lost the cursor: fail closed, write nothing.
        const cur = latestRecord(parseRecords(dev.messages));
        const before = dev.messages.length;
        await assert.rejects(plan(feed.filter((e) => cmpEvents(e, cur) > 0), null), FailClosed);
        assert.equal(dev.messages.length, before);
      } else if (r < 0.95) {
        // A race: run A plans, run B plans and applies everything, then A applies its stale plan.
        pendingPlan = await plan(feed, null);
        apply(await plan(feed, null));
        apply(pendingPlan);
      } else {
        apply(await plan(feed, null), 1);
      }
      check(`step ${step}`);
    }
    // A final clean run applies everything still owed; the triple is the fold of every non-bot event.
    apply(await plan(feed, null));
    check('final');
    assert.deepEqual(recordedIds(), humanEvents().map((e) => String(e.id)), `final seed ${seed}`);
    const expected = humanEvents().reduce((t, e) => nextTriple(t, e.ref === 'refs/heads/release' ? 'candidate' : 'minor'), [0, 7, 2]);
    assert.deepEqual(dev.triple, expected, `seed ${seed}`);
  }
});
