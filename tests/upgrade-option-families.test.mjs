// No two upgrade options of one family (owner, 2026-11-20: "damage +2 / damage +3" side by side is no choice).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { shops as shippedShops } from '../src/content/shops.js';
import { createRegistries } from '../src/model/registries.js';
import { configuredContentBundle } from '../src/model/advancedConfig.js';
import { applyGameProfileToContent, bindGameProfileRegistries, resolveGameProfile } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { nextUpgradeOptions, AuthoredFamilies } from '../src/model/cardUpgradeLimits.js';
import { UpgradeStepFamilies, UPGRADE_FAMILIES, UPGRADE_OPTION_KINDS } from '../src/model/cardUpgradeSteps.js';
import { RollSmithOptions, SmithPickFamily } from '../src/model/smithUpgrade.js';
import '../src/engine/runCombat.js';

const profile = resolveGameProfile(JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url))));
const OUT_ROWS = Object.fromEntries(shippedShops.blacksmith.offerings.map((row) => [`gameConfig.shops.blacksmith.${row.id}.chance`, 100]));
const registries = bindGameProfileRegistries(createRegistries(configuredContentBundle(applyGameProfileToContent(contentBundle, profile), OUT_ROWS)), profile);
const baseRun = createRunState({ seed: 1, classId: 'reaver', registries, runId: 'families', profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
const pool = registries.cards.all().filter((def) => def.id.startsWith('core.') && !['status', 'curse'].includes(def.type));

const familiesOf = (base, step) => (step.k === 'authored' ? AuthoredFamilies(base) : UpgradeStepFamilies(step));
function assertDistinct(base, steps, where) {
  const seen = new Set();
  for (const step of steps) {
    for (const family of familiesOf(base, step)) {
      assert.ok(!seen.has(family), `${where}: two options of family ${family}: ${JSON.stringify(steps)}`);
      seen.add(family);
    }
  }
}

test('every rolled kind belongs to exactly one family', () => {
  const listed = Object.values(UPGRADE_FAMILIES).flat();
  for (const kind of UPGRADE_OPTION_KINDS) if (kind !== 'fx:boost') assert.equal(listed.filter((k) => k === kind).length, 1, kind);
});

test('over 500 seeds, no card upgrade offer repeats a family (with and without two-effect combos)', () => {
  for (let seed = 1; seed <= 500; seed += 1) {
    const run = { ...baseRun, seed };
    const def = pool[seed % pool.length];
    const fresh = { instanceId: `c${seed}`, cardId: def.id };
    assertDistinct(def, nextUpgradeOptions(run, fresh, def, registries, 3), `${def.id} seed ${seed}`);
    // From the fourth upgrade a rest offers two options, some with two effects: still one family each.
    const steps = nextUpgradeOptions(run, { ...fresh, upgradeSteps: [] }, def, registries, 3, { noAuthored: true });
    const worn = { ...fresh, upgraded: true, upgradeSteps: steps.slice(0, 1) };
    assertDistinct(def, nextUpgradeOptions(run, worn, def, registries, 2, { combos: true }), `${def.id} combos seed ${seed}`);
  }
});

test('over 500 seeds, no item offer repeats a family', () => {
  const refs = ['armament/greatsword', 'armament/dagger', `armor/reaver/${baseRun.loadout.sets.armor[0]}`];
  for (let seed = 1; seed <= 500; seed += 1) {
    const run = { ...baseRun, seed };
    for (const ref of refs) {
      const families = RollSmithOptions(run, ref, 1 + (seed % 4)).map(SmithPickFamily);
      assert.equal(new Set(families).size, families.length, `${ref} seed ${seed}: ${families}`);
    }
  }
});
