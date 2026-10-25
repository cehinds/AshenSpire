import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveGameProfile } from '../src/model/gameProfile.js';

test('Core rewards list every Core hand item that has a weapon card package', () => {
  const rules = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} }).content.rewards;
  const offered = new Set(rules.eligibility.weapons.groups.flatMap(id => rules.equipmentGroups[id].members));
  for (const id of ['straightSword', 'greatsword', 'dagger', 'shortbow', 'katana', 'halberd', 'warhammer', 'twinblade', 'battleaxe', 'buckler', 'kiteShield', 'towerShield', 'roundShield', 'spikedShield', 'lantern', 'torch', 'parryDagger', 'ashStaff', 'starstoneStaff', 'boneSceptre', 'emberlightSceptre', 'goldboughBranch', 'blightRod', 'gorefireBrand', 'wyrmhornStaff', 'frostSpear', 'cinderAxe', 'duskChime']) assert.ok(offered.has(id), id);
  assert.equal(offered.size, 28);
});
