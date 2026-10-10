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
// not removed: `--slow-only` runs them on every push to `test` and `release`
// (tests.yml, discovered-slow), and ci.yml's discovered shards, which pass
// neither flag, still run every file. An entry whose file has gone fails
// tests/run-node-lanes.test.mjs, so the list cannot rot.
export const SLOW_DISCOVERED = new Map([
  ['tests/balance-doc.test.mjs', 'regenerates the full 300-seed tools/balance.mjs report'],
  ['tests/runsim-report-flags.test.mjs', 'spawns tools/runsim.mjs fleets for each report flag'],
  ['tests/simbot-decisions.test.mjs', 'runs tools/measure-classes.mjs --check against runsim'],
  ['tests/simrun-loop.test.mjs', 'runs tools/measure-classes.mjs --check against runsim'],
]);

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
