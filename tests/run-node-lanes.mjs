// Closed runner lanes: selection changes scheduling, never verdict semantics.
export function parseRunNodeOptions(argv) {
  const seen = new Set();
  let shard = null;
  let selftestGroup = null;
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (!['--no-selftests', '--selftests-only', '--no-discovered', '--discovered-only', '--shard', '--selftest-group'].includes(flag)) {
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
  if (selftestGroup && !selftestsOnly) throw new Error('--selftest-group requires --selftests-only');
  return {
    core: !selftestsOnly && !discoveredOnly,
    selftests: !noSelftests && !discoveredOnly,
    discovered: !selftestsOnly && !noDiscovered,
    shard,
    selftestGroup,
  };
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
