// Minimal offer operands, intentionally unrelated to today's equipment catalog.
import { contentBundle } from '../../src/content/index.js';
import { createRegistries } from '../../src/model/registries.js';
import { createRunState } from '../../src/model/state.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../../src/model/gameProfile.js';

export function armamentRewardFixture() {
  const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
  const base = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const armaments = [
    { id: 'fixture.bladeA', kind: 'weapon', geom: 'blade' },
    { id: 'fixture.bladeB', kind: 'weapon', geom: 'blade' },
    { id: 'fixture.shield', kind: 'shield', geom: 'shield' },
    { id: 'fixture.staff', kind: 'staff', geom: 'staff' },
  ];
  const armour = [...['light', 'heavy'].map(id => ({ id: `fixture.${id}`, classId: 'reaver' })),
    { id: 'fixture.foreign', classId: 'herald' }];
  const reg = { ...base, balance: { ...base.balance, equipment: { ...base.balance.equipment, storageSlots: 8 } }, equipment: { ...base.equipment, armaments, armour } };
  function fresh(seed) {
    const run = createRunState({ seed, classId: 'reaver', registries: base });
    run.loadout.storage = [];
    run.loadout.boughtArmour = [];
    for (const slot of Object.keys(run.loadout.sets)) run.loadout.sets[slot] = [null];
    // This fixture isolates least-used type/family selection from themed picks.
    run.gameProfile.modules.gear = { ...run.gameProfile.modules.gear, typeEffectsVersion: 0 };
    run.gameProfile.content.rewards = {
      armamentReward: { elite: { chancePct: 35, min: 1, max: 3 }, boss: { chancePct: 100, min: 2, max: 4 } },
      equipmentGroups: {
        weapons: { family: 'armament', allTags: [], members: armaments.map(row => row.id) },
        light: { family: 'armour', allTags: [], members: ['reaver:fixture.light', 'herald:fixture.foreign'] },
        heavy: { family: 'armour', allTags: [], members: ['reaver:fixture.heavy'] },
      },
      eligibility: { weapons: { groups: ['weapons'] }, armor: { groups: ['light', 'heavy'] }, weaponArts: { cardIds: [] } },
    };
    return run;
  }
  return { reg, fresh };
}

export function bossRelicFixture(base) {
  const rows = [
    ...['relicA', 'relicB', 'relicC', 'relicD', 'relicE'].map(id => ({ id, name: id, rarity: 'boss', passives: {}, textTemplate: 'Fixture relic.', propertyTags: [] })),
    { id: 'ordinaryRelic', rarity: 'common', passives: {} },
    { id: 'questRelic', rarity: 'boss', pool: 'quest', passives: {} },
  ];
  const byId = new Map(rows.map(row => [row.id, row]));
  return { ...base, balance: { ...base.balance, rewards: { ...base.balance.rewards, bossRelicChoices: 3 } }, relics: { all: () => rows, ids: () => rows.map(row => row.id), has: id => byId.has(id) || base.relics.has(id), get: id => byId.get(id) || base.relics.get(id) } };
}
