// Node audit adapters. The browser may import inventory.mjs/fixtures.mjs alone.
const moduleIds = [
  'src/content/index.js', 'src/model/registries.js', 'src/model/state.js',
  'src/engine/combat.js', 'src/engine/runCombat.js', 'src/engine/rng.js',
  'src/engine/combatExpansion.js', 'src/engine/combatReactions.js',
  'src/engine/abilityRiders.js', 'src/model/cardTargets.js', 'src/model/upcasting.js',
  'src/engine/combatSnapshot.js', 'src/engine/combatStatusControl.js',
  'src/engine/actions.js', 'src/engine/statuses.js', 'src/engine/triggers.js', 'src/engine/properties.js',
];
export async function loadAuditRuntime(mode = 'native') {
  if (!['native', 'bundled'].includes(mode)) throw new Error(`Unknown audit loader '${mode}'`);
  let modules;
  if (mode === 'bundled') {
    const { productionBundle } = await import('../../tests/helpers/production-bundle.mjs');
    const require = productionBundle({ additionalModules: moduleIds });
    modules = moduleIds.map(id => require(id));
  } else modules = await Promise.all(moduleIds.map(id => import(new URL('../../' + id, import.meta.url))));
  const api = Object.assign({}, ...modules);
  return { ...api, mode, registries: api.createRegistries(api.contentBundle) };
}
