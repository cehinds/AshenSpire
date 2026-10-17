// Node audit adapters. The browser may import inventory.mjs/fixtures.mjs alone.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, relative } from 'node:path';

const root = fileURLToPath(new URL('../..', import.meta.url));
const digest = value => createHash('sha256').update(value).digest('hex');
function sourceIdentity() {
  const files = [];
  const walk = directory => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.js')) files.push(relative(root, path).split('\\').join('/'));
    }
  };
  walk(resolve(root, 'src'));
  files.push('index.html', 'tools/bundle.mjs');
  files.sort();
  const hash = createHash('sha256');
  for (const path of files) hash.update(path).update('\0').update(readFileSync(resolve(root, path))).update('\0');
  const auditFiles = ['tools/combat-audit/cards.mjs', 'tools/combat-audit/runtime.mjs',
    'tools/combat-audit/fixtures.mjs', 'tools/combat-audit/inventory.mjs', 'tests/helpers/production-bundle.mjs'];
  return { sha256: hash.digest('hex'), files: files.length,
    method: 'sha256(sorted repository path + NUL + exact bytes + NUL); all src/**/*.js, index.html, tools/bundle.mjs',
    auditFiles: Object.fromEntries(auditFiles.map(path => [path, digest(readFileSync(resolve(root, path)))])) };
}
const moduleIds = [
  'src/content/index.js', 'src/model/registries.js', 'src/model/state.js',
  'src/engine/combat.js', 'src/engine/runCombat.js', 'src/engine/rng.js',
  'src/engine/combatExpansion.js', 'src/engine/combatReactions.js',
  'src/engine/abilityRiders.js', 'src/model/cardTargets.js', 'src/model/upcasting.js',
  'src/engine/combatSnapshot.js', 'src/engine/combatStatusControl.js',
  'src/engine/actions.js', 'src/engine/statuses.js', 'src/engine/triggers.js', 'src/engine/properties.js',
  'src/model/loadout.js', 'src/model/skills.js',
  'src/engine/encounters.js', 'src/engine/locations.js', 'src/model/locations.js',
  'src/model/mapknowledge.js', 'src/model/statProjection.js',
  'src/model/advancedConfig.js',
];
export async function loadAuditRuntime(mode = 'native', { configuration = 'raw-authored' } = {}) {
  if (!['native', 'bundled'].includes(mode)) throw new Error(`Unknown audit loader '${mode}'`);
  if (!['raw-authored', 'configured-defaults'].includes(configuration)) throw new Error(`Unknown audit configuration '${configuration}'`);
  let modules;
  if (mode === 'bundled') {
    const { productionBundle } = await import('../../tests/helpers/production-bundle.mjs');
    const require = productionBundle({ additionalModules: moduleIds });
    modules = moduleIds.map(id => require(id));
  } else modules = await Promise.all(moduleIds.map(id => import(new URL('../../' + id, import.meta.url))));
  const api = Object.assign({}, ...modules);
  // Match main.js beginPreparedRun/rebuildRegistries without changing the
  // historical raw-authored fixture or its named loader evidence.
  const snapshot = configuration === 'configured-defaults'
    ? { ...api.advancedConfigSnapshot(), breakMeterVersion: 2 } : null;
  const bundle = snapshot ? api.configuredContentBundle(api.contentBundle, snapshot) : api.contentBundle;
  return { ...api, mode, registries: api.createRegistries(bundle), configuration: {
    mode: configuration, snapshot,
    ...(snapshot ? { v2RunOverride: { breakMeterVersion: 2 },
      snapshotSha256: digest(JSON.stringify(snapshot)),
      resolvedContent: bundle, resolvedContentSha256: digest(JSON.stringify(bundle)) } : {}),
    ratingsEnabled: Boolean(bundle.balance?.combatRatings?.enabled),
    breakMeterVersion: bundle.breakMeterVersion ?? null,
  }, source: sourceIdentity() };
}
