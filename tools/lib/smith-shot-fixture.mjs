import { readFileSync } from 'node:fs';

// A reachability fixture, not a change to the game's authored Smith policy.
// Read the current author afresh and resolve the small override through the
// existing gameProfile query door, so registries, run and save share its hash.
export function SmithProbeAuthor({ free = true } = {}) {
  const author = JSON.parse(readFileSync(new URL('../../games/ashenspire/game.json', import.meta.url), 'utf8'));
  return { ...author, modules: { ...author.modules,
    gear: { ...author.modules?.gear, statPoints: { ...author.modules?.gear?.statPoints, perRank: 1 } },
    rest: { ...author.modules?.rest, mode: 'configured', servicesPerVisit: 1,
      services: ['rest', 'smith'], smith: { ...author.modules?.rest?.smith, free, tiersPerService: 1 } },
  } };
}

export function SmithProbeQuery() {
  return `?${new URLSearchParams({ shot: 'smith', gameProfile: JSON.stringify(SmithProbeAuthor()) })}`;
}

// Both probes must reach a real, eligible candidate dialog. Existence alone
// accepts the disabled "Nothing to upgrade" card and hides the fixture error.
export const SMITH_PROBE_OPEN = `(() => {
  if (!document.querySelector('.upgrade-desk')) {
    const option = document.querySelector('#smith-opt');
    const reason = option?.querySelector('p')?.textContent || 'Smith option missing';
    if (!option || option.getAttribute('aria-disabled') === 'true') throw new Error('Smith fixture unavailable: ' + reason);
    option.click();
  }
  if (!document.querySelector('.upgrade-desk') || !document.querySelector('.smith-candidate-card')) {
    throw new Error('Smith fixture did not open a nonempty candidate dialog');
  }
  return true;
})()`;
