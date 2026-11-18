import test from 'node:test';
import assert from 'node:assert/strict';
import { compileGameProfiles } from '../tools/game-config.mjs';
import { resolveGameAuthor } from '../engine/kernel/gameConfig.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { gameProfileEquipmentReceipt } from '../src/model/gameProfileGear.js';

const { catalog, authors } = compileGameProfiles();
const profile = resolveGameAuthor(authors.core, catalog);
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const meta = { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } };

// Owner, 2026-11-18: the four `default` outfit rows map to their gear items, so starting armour adds its Poise and attribute points.
const GEAR = { reaver: 'wayfarerPlate', starseer: 'nightweave', herald: 'riteVestments', rogue: 'gutterLeathers' };
for (const [classId, gearId] of Object.entries(GEAR)) {
  test(`${classId}'s starting outfit resolves to gear item ${gearId}`, () => {
    const run = createRunState({ registries, classId, seed: 7, profileMeta: meta });
    assert.equal(run.loadout.sets.armor[run.loadout.active.armor || 0], 'default');
    assert.equal(registries.equipment.armour.find(row => row.classId === classId && row.id === 'default').gearId, gearId);
    const receipt = gameProfileEquipmentReceipt(registries, run);
    const source = receipt.sources.find(row => row.kind === 'equipment' && row.slot === 'armor');
    assert.ok(source, 'the starting armour is a resolved gear source');
    assert.equal(source.itemId, `armor.${gearId}`);
  });
}

test('an armour group base Poise replaces the armour item\'s own Poise: a level-1 Reaver in plate opens at 15', () => {
  const run = createRunState({ registries, classId: 'reaver', seed: 7, profileMeta: meta });
  const receipt = gameProfileEquipmentReceipt(registries, run);
  assert.equal(receipt.sources.find(row => row.slot === 'armor').poise, 0, 'the plate\'s item Poise is replaced by the Heavy base');
  assert.equal(receipt.sources.find(row => row.sourceId === 'type/poise').poise, 6, 'Heavy +5 and the Greatsword +1');
});
