// Closed runner lanes: selection changes scheduling, never verdict semantics.
export function parseRunNodeOptions(argv) {
  const seen = new Set();
  let shard = null;
  let selftestGroup = null;
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (!['--no-selftests', '--selftests-only', '--no-discovered', '--discovered-only', '--shard', '--selftest-group', '--no-slow', '--slow-only'].includes(flag)) {
      throw new Error(`unknown option ${flag}`);
    }
    if (seen.has(flag)) throw new Error(`duplicate option ${flag}`);
    seen.add(flag);
    if (flag === '--shard') {
      const value = argv[++i];
      const match = /^(0|[1-9]\d*)\/(0|[1-9]\d*)$/.exec(value ?? '');
      if (!match) throw new Error('--shard must be i/n with 0 <= i < n');
      const index = Number(match[1]);
      const count = Number(match[2]);
      if (!Number.isSafeInteger(index) || !Number.isSafeInteger(count) || count < 1 || index >= count) {
        throw new Error('--shard must be i/n with 0 <= i < n');
      }
      shard = { index, count };
    } else if (flag === '--selftest-group') {
      selftestGroup = argv[++i];
      if (!['link', 'other'].includes(selftestGroup)) throw new Error('--selftest-group must be link or other');
    }
  }
  const selftestsOnly = seen.has('--selftests-only');
  const discoveredOnly = seen.has('--discovered-only');
  const noSelftests = seen.has('--no-selftests');
  const noDiscovered = seen.has('--no-discovered');
  if (selftestsOnly && (noSelftests || discoveredOnly || noDiscovered)) {
    throw new Error('--selftests-only cannot be combined with other lane selectors');
  }
  if (discoveredOnly && (noSelftests || noDiscovered)) {
    throw new Error('--discovered-only cannot be combined with other lane selectors');
  }
  if (shard && !discoveredOnly) throw new Error('--shard requires --discovered-only');
  if (seen.has('--no-slow') && seen.has('--slow-only')) throw new Error('--no-slow cannot be combined with --slow-only');
  for (const flag of ['--no-slow', '--slow-only']) {
    if (seen.has(flag) && !discoveredOnly) throw new Error(`${flag} requires --discovered-only`);
  }
  if (selftestGroup && !selftestsOnly) throw new Error('--selftest-group requires --selftests-only');
  return {
    core: !selftestsOnly && !discoveredOnly,
    selftests: !noSelftests && !discoveredOnly,
    discovered: !selftestsOnly && !noDiscovered,
    shard,
    selftestGroup,
    slow: seen.has('--no-slow') ? 'exclude' : seen.has('--slow-only') ? 'only' : 'include',
  };
}

// DISCOVERED FILES TOO SLOW FOR THE DEV-PR GATE. A pull request into `dev` is
// gated by fast checks only, about five minutes (owner, 2026-09-26). These
// four spawn full simulation runs and were over half of all discovered-test
// time; balance-doc alone set one shard to 8m19s (run 38028766946). They are
// not removed: ci.yml runs them at the functional stage. Linux/macOS retain
// full discovered shards; Windows runs each slow file in its own job, with
// --no-slow shards exhaustive for the rest. An entry whose file has gone fails
// tests/run-node-lanes.test.mjs, so the list cannot rot.
export const SLOW_DISCOVERED = new Map([
  ['tests/balance-doc.test.mjs', 'regenerates the full 300-seed tools/balance.mjs report'],
  ['tests/runsim-report-flags.test.mjs', 'spawns tools/runsim.mjs fleets for each report flag'],
  ['tests/simbot-decisions.test.mjs', 'runs tools/measure-classes.mjs --check against runsim'],
  ['tests/simrun-loop.test.mjs', 'runs tools/measure-classes.mjs --check against runsim'],
]);

// These files assert wall-clock limits. Keep each in its original discovery
// shard, but run it alone before that shard's CPU-heavy parallel batch. No
// assertions, limits, discovery membership or platform concurrency change.
export const ISOLATED_TIMING_DISCOVERED = new Map([
  ['tests/seed-driven-schedule-and-perf.test.mjs', 'measures the cold 60-card Blacksmith picker against its 250ms limit'],
  ['tests/upgrade-tags-and-perf.test.mjs', 'measures the 60-card Blacksmith picker against its 500ms limit'],
]);

export function discoveryExecutionBatches(files) {
  if (!files.length || new Set(files).size !== files.length) throw new Error('discovery batches require nonempty, unique assigned files');
  const isolated = files.filter(file => ISOLATED_TIMING_DISCOVERED.has(file)).map(file => [file]);
  const parallel = files.filter(file => !ISOLATED_TIMING_DISCOVERED.has(file));
  return [...isolated, ...(parallel.length ? [parallel] : [])];
}

export function reporterSummaryCounts(out) {
  const blocks = out.split(/^ℹ tests /m).slice(1);
  if (!blocks.length) return null;
  let tests = 0, failed = 0;
  for (const block of blocks) {
    const testCount = /^(\d+)(?:\r?\n|$)/.exec(block);
    const failures = [...block.matchAll(/^ℹ fail (\d+)\r?$/gm)];
    if (!testCount || failures.length !== 1) return null;
    const count = Number(testCount[1]), fail = Number(failures[0][1]);
    if (!Number.isSafeInteger(count) || !Number.isSafeInteger(fail) || fail > count) return null;
    tests += count; failed += fail;
  }
  if (!Number.isSafeInteger(tests) || !Number.isSafeInteger(failed)) return null;
  return { tests, failed, summaries: blocks.length };
}

/** Synchronous child batches share one deadline. Ordinary failures do not hide
 * the rest of the assigned corpus, but a timeout stops further launches. */
export function runDiscoveryBatches(batches, { runBatch, timeoutMs, now = () => performance.now() }) {
  const assigned = batches.flat();
  if (!batches.length || batches.some(batch => !batch.length) || new Set(assigned).size !== assigned.length) throw new Error('discovery batches require nonempty, unique assigned files');
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) throw new Error('discovery timeout must be finite and non-negative');
  const deadline = now() + timeoutMs;
  const results = [];
  let timedOut = false;
  for (const files of batches) {
    const remaining = Math.floor(deadline - now());
    if (remaining <= 0) { timedOut = true; break; }
    const result = runBatch(files, remaining);
    const out = `${result.stdout || ''}${result.stderr || ''}`;
    const summary = reporterSummaryCounts(out);
    const ok = result.status === 0 && !result.error && summary?.summaries === 1 && summary.tests > 0 && summary.failed === 0;
    results.push({ ...result, out, summary, ok });
    if (result.error?.code === 'ETIMEDOUT') { timedOut = true; break; }
  }
  if (now() > deadline) timedOut = true;
  return { results, out: results.map(result => result.out).join('\n'), timedOut,
    ok: !timedOut && results.length === batches.length && results.every(result => result.ok) };
}

export function discoverySpeedFiles(files, slow) {
  if (slow === 'include') return files.slice();
  if (slow === 'exclude') return files.filter(file => !SLOW_DISCOVERED.has(file));
  if (slow === 'only') return files.filter(file => SLOW_DISCOVERED.has(file));
  throw new Error('slow selection must be include, exclude or only');
}

export function discoveryShardFiles(files, shard) {
  const selected = shard ? files.filter((_, index) => index % shard.count === shard.index) : files.slice();
  // Passing no file names to node --test would discover a different corpus.
  if (!selected.length) throw new Error('discovered test selection is empty; refusing a zero-work lane');
  return selected;
}

export function selftestInGroup(group, tool) {
  if (group === null) return true;
  if (group === 'link') return tool === 'linkcheck';
  if (group === 'other') return tool !== 'linkcheck';
  throw new Error('selftest group must be link or other');
}

// The summary counts for one shard. A shard stopped by its time limit never
// prints node --test's "ℹ tests N" / "ℹ fail N" lines, so its counts are
// unknown; say so instead of printing NaN.
export function shardSummaryCounts({ out, timedOut, limitMinutes, files, expectedSummaries }) {
  if (timedOut) return `${files} files, stopped after ${limitMinutes} minutes (timed out; no test summary)`;
  const counts = reporterSummaryCounts(out);
  if (!counts || expectedSummaries !== undefined && counts.summaries !== expectedSummaries) return `${files} files, counts unavailable`;
  return `${files} files, ${counts.tests} tests, ${counts.failed} failed`;
}
