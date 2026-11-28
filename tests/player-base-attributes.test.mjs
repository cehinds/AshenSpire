// Every playable class starts with 1 attribute point, in its main stat (owner, 2026-11-28),
// and a run at attribute 0 saves and reloads unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { core2Profile, core2Registries, core2Run } from './helpers/core2.mjs';
import { createMemoryStorage, createSaveManager } from '../src/engine/save.js';
import { gameContent } from '../src/model/gameProfile.js';

const FIXTURE_PATH = fileURLToPath(new URL('./fixtures/player-base-attributes.json', import.meta.url));
const FIXTURE = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));
// Enough completed runs to unlock every class in the Core unlock sequence.
const COMPLETED_RUN_IDS = [
  'unlockRunA',
  'unlockRunB',
  'unlockRunC',
  'unlockRunD',
];

function unlockedMeta()
{
  return {
    gameProfileUnlocks: {
      [core2Profile().id]: {
        completedRunIds: COMPLETED_RUN_IDS,
      },
    },
  };
}

function sum(attributes)
{
  return Object.values(attributes).reduce((total, value) => total + value, 0);
}

for (const [classId, mainAttribute] of Object.entries(FIXTURE.mainAttribute))
{
  test(`${classId} starts with ${FIXTURE.total} point, ${mainAttribute} at ${FIXTURE.mainValue}`, () =>
  {
    const attributes = gameContent(core2Profile(), 'classAttributes')[classId];
    assert.equal(sum(attributes), FIXTURE.total);
    assert.equal(attributes[mainAttribute], FIXTURE.mainValue);
  });

  test(`a new ${classId} run at attribute 0 saves and reloads unchanged`, () =>
  {
    const run = core2Run(
      {
        classId,
        profileMeta: unlockedMeta(),
      },
    );
    assert.equal(sum(run.attributes), FIXTURE.total);
    const saves = createSaveManager(createMemoryStorage());
    saves.saveRun(run);
    const restored = saves.loadRun(core2Registries());
    assert.ok(restored, 'the saved run loads');
    assert.deepEqual(restored.attributes, run.attributes);
    assert.deepEqual(restored.attributeModeSnapshot, run.attributeModeSnapshot);
    assert.equal(restored.maxHp, run.maxHp);
  });
}
