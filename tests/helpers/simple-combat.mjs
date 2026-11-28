// Builds a Core fight with one Simple Combat switch off (tests/fixtures/simple-combat-flags.json).
import { readFileSync } from 'node:fs';
import { contentBundle } from '../../src/content/index.js';
import { createRegistries } from '../../src/model/registries.js';
import { createRunState } from '../../src/model/state.js';
import { createRng } from '../../src/engine/rng.js';
import { createRunCombat } from '../../src/engine/runCombat.js';
import {
  resolveGameProfile,
  applyGameProfileToContent,
  bindGameProfileRegistries,
} from '../../src/model/gameProfile.js';

const FIXTURE_URL = new URL('../fixtures/simple-combat-flags.json', import.meta.url);
const UNLOCKED_META = {
  gameProfileUnlocks:
  {
    core:
    {
      completedRunIds: [
        'a',
        'b',
        'c',
      ],
    },
  },
};

export const SimpleCombatFixture = JSON.parse(readFileSync(FIXTURE_URL, 'utf8'));

/** Registries for Core with the named override applied; no name is today's Core. */
export function SimpleCombatRegistries(overrideName = null)
{
  const modules = overrideName
    ? SimpleCombatFixture.overrides[overrideName]
    : {};
  const author = {
    formatVersion: 1,
    core: SimpleCombatFixture.core,
    modules,
  };
  const profile = resolveGameProfile(author);
  const content = applyGameProfileToContent(contentBundle, profile);
  return bindGameProfileRegistries(createRegistries(content), profile);
}

/** A fresh run on those registries. */
export function SimpleCombatRun(registries)
{
  return createRunState({
    registries,
    classId: SimpleCombatFixture.classId,
    seed: SimpleCombatFixture.seed,
    profileMeta: UNLOCKED_META,
  });
}

/** A fresh fight on those registries against the fixture's enemies. */
export function SimpleCombatFight(registries)
{
  const run = SimpleCombatRun(registries);
  return createRunCombat({
    registries,
    run,
    rng: createRng(SimpleCombatFixture.seed),
    enemyIds: SimpleCombatFixture.enemyIds,
  });
}
