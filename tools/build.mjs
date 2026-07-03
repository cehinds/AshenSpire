// tools/build.mjs -- the "build" for a no-bundler, data-driven game.
//
// There is no transpile/bundle step (SPEC section 1: vanilla ES modules, no
// build). The equivalent of a build here is proving the content bundle is
// well-formed:
//   1. every content object passes its schema + the closed-set checks,
//   2. every id cross-reference resolves,
//   3. the registries actually construct (dup-id detection, deep-freeze),
//   4. the scripts.js escape-hatch budget stays < 5%.
// Exits non-zero on any failure so run.bat (and CI, later) can gate on it.
//
// Run: node tools/build.mjs

import { contentBundle } from '../src/content/index.js';
import { validateContent } from '../src/model/validate.js';
import { createRegistries } from '../src/model/registries.js';

const t0 = Date.now();
console.log('EldenSpire build -- validating content bundle\n');

const { ok, errors, scriptReport } = validateContent(contentBundle);

if (!ok) {
  console.error(`[FAIL] content validation failed (${errors.length} error${errors.length === 1 ? '' : 's'}):\n`);
  for (const e of errors) console.error(`  - ${e.path}: ${e.msg}`);
  process.exit(1);
}
console.log('[OK] content validation passed');

// Registries must construct: catches duplicate ids and any freeze/getter issues
// that validation alone does not exercise.
let registries;
try {
  registries = createRegistries(contentBundle);
} catch (err) {
  console.error(`[FAIL] registries failed to construct: ${err.message}`);
  process.exit(1);
}
console.log('[OK] registries constructed');

// Content inventory -- a quick at-a-glance of what shipped.
const counts = {
  cards: registries.cards.size,
  relics: registries.relics.size,
  statuses: registries.statuses.size,
  stances: registries.stances.size,
  enemies: registries.enemies.size,
  encounters: registries.encounters.size,
  events: registries.events.size,
  flasks: registries.flasks.size,
  classes: registries.classes.size,
};
console.log('\ncontent inventory:');
for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(11)} ${v}`);

const { count, total, pct } = scriptReport;
console.log(`\nscripts budget: ${count}/${total} content objects (${pct.toFixed(1)}%) -- limit 5%`);

console.log(`\n[OK] BUILD OK (${Date.now() - t0} ms)`);
process.exit(0);
