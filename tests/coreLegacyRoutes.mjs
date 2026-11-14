// The Core routes content as shipped through 2026-11-13 (hidden event/fight/treasure/shop nodes, fog map, refilling start node,
// uniform node draw). A run pinned before the visible-fork map keeps this content; tests that pin the old behaviour resolve a profile
// from it. The bundle binds every routes key, so the keys added since are present with null, which means absent.
import { compileGameProfiles } from '../tools/game-config.mjs';
import { resolveGameAuthor } from '../engine/kernel/gameConfig.js';

export const LEGACY_ROUTES = {
  acts: 3, prebossNodes: 9, bosses: 3, restsPerAct: 3,
  hiddenTypes: ['event', 'fight', 'treasure', 'shop'], visibleTypes: ['rest', 'elite', 'boss'],
  restFloors: [3, 6, 9], branchColumns: 3, minimumThreatFloor: 3, mapMode: 'fog', firstFloor: 'fight',
  shopShare: 0.15, requirePrebossRest: true, maxBranches: 3, startNodeRefills: true,
  typeWeights: null, variedNeighbours: null, shopsPerBranch: null, forkPercent: null, crossLinkPercent: null,
};
let compiled = null;
// Resolve the Core profile with the legacy routes content; `routes` are author setting overrides, as resolveGameProfile takes.
export function legacyCoreProfile(routes = {}) {
  compiled ||= compileGameProfiles();
  const changed = structuredClone(compiled.catalog);
  changed.packs['ashen.core-content@2.0.0'].content.routes = structuredClone(LEGACY_ROUTES);
  return resolveGameAuthor({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: { routes } }, changed);
}
