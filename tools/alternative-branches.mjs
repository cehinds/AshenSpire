// Shared naming rules for optional alternative development/test pairs.
export function alternativePairs(branches) {
  const names = new Set(branches);
  return [...names].filter((name) => /^alternative\/(?:[a-zA-Z0-9_-]+\/)*dev$/.test(name))
    .sort().map((dev) => ({ dev, test: dev.replace(/dev$/, 'test') }))
    .filter(({ test }) => names.has(test));
}

export function channelRole(branch) {
  return branch.startsWith('alternative/') ? branch.split('/').at(-1) : branch;
}

export function siteRoot(branch) {
  return '../'.repeat(branch.split('/').length);
}

// Keep the role first: saved HTML uses AshenSpire-dev-* / AshenSpire-test-*
// to recognize developer settings. The remainder still identifies the variant.
export function downloadChannel(branch) {
  if (!branch.startsWith('alternative/')) return branch;
  return `${channelRole(branch)}-${branch.split('/').slice(0, -1).join('-')}`;
}
