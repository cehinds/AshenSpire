// Current JSON integration plus controlled offer rules and a six-item pool.
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { armamentRewardFixture } from './helpers/reward-contract.mjs';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { GameProfileArmamentOffer, ArmamentRewardRule, claimGameProfileReward } from '../src/model/gameProfileRewards.js';
import { carriedIds } from '../src/model/loadout/ownership.js';

const { reg, fresh } = armamentRewardFixture();
const readJson = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));

test('authored armament reward rules and eligibility groups reach a fresh run', () => {
  const profile = resolveGameProfile(readJson('../games/ashenspire/game.json'));
  const currentReg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const run = createRunState({ seed: 3, classId: 'reaver', registries: currentReg });
  const source = readJson('../games/ashenspire/packs/core/rewards.json');
  for (const pool of Object.keys(source.armamentReward).filter(key => !key.startsWith('$'))) {
    assert.deepEqual(ArmamentRewardRule(run, pool), source.armamentReward[pool], pool);
  }
  assert.deepEqual(run.gameProfile.content.rewards.equipmentGroups, source.equipmentGroups);
  assert.deepEqual(run.gameProfile.content.rewards.eligibility.weapons, source.eligibility.weapons);
  assert.deepEqual(run.gameProfile.content.rewards.eligibility.armor, source.eligibility.armor);
});

const make = (seed, pool, run = fresh(seed), offerId = `1:n:combat:${pool}:armament`) => GameProfileArmamentOffer(reg, run, createRng(seed), { offerId, pool });
const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1);

test('fixture rule: elites 35% for 1-3, bosses 100% for 2-4; normal fights have none', () => {
  const run = fresh(1);
  assert.deepEqual([35, 1, 3], ['chancePct', 'min', 'max'].map(key => ArmamentRewardRule(run, 'elite')[key]));
  assert.deepEqual([100, 2, 4], ['chancePct', 'min', 'max'].map(key => ArmamentRewardRule(run, 'boss')[key]));
  assert.equal(ArmamentRewardRule(run, 'normal'), null);
  assert.equal(make(1, 'normal'), null);
});

test('an elite drops an armament offer about 35% of the time, with 1-3 choices', () => {
  const counts = { 1: 0, 2: 0, 3: 0 };
  let drops = 0;
  for (const seed of SEEDS) {
    const offer = make(seed, 'elite');
    if (!offer) continue;
    drops++; counts[offer.options.length]++;
    assert.equal(offer.source, 'armament'); assert.equal(offer.takeCount, 1);
    assert.ok(offer.options.length >= 1 && offer.options.length <= 3, `${offer.options.length} choices`);
  }
  assert.ok(drops > 60 && drops < 150, `${drops}/300 elite drops (35% expected)`);
  assert.ok(counts[1] > 0 && counts[2] > 0 && counts[3] > 0, JSON.stringify(counts));
});

test('a boss always drops an armament offer with 2-4 choices', () => {
  const counts = { 2: 0, 3: 0, 4: 0 };
  for (const seed of SEEDS) {
    const offer = make(seed, 'boss');
    assert.ok(offer, `seed ${seed}: a boss always drops`);
    assert.ok(offer.options.length >= 2 && offer.options.length <= 4, `${offer.options.length} choices`);
    counts[offer.options.length]++;
  }
  assert.ok(counts[2] > 0 && counts[3] > 0 && counts[4] > 0, JSON.stringify(counts));
});

test('every choice is a distinct, eligible weapon or armour the run does not already own', () => {
  const rules = fresh(1).gameProfile.content.rewards;
  const weaponGroups = new Set(rules.eligibility.weapons.groups.flatMap(id => rules.equipmentGroups[id].members));
  const armourGroups = new Set(rules.eligibility.armor.groups.flatMap(id => rules.equipmentGroups[id].members));
  for (const seed of SEEDS) {
    const run = fresh(seed);
    // Own a few pieces: a bought armour and a stored weapon must never come back.
    run.loadout.storage.push('fixture.bladeB');
    const boughtId = [...armourGroups].map(key => key.split(':')).find(([classId]) => classId === run.class)[1];
    run.loadout.boughtArmour = [{ classId: run.class, id: boughtId }];
    const owned = new Set([...carriedIds(run.loadout), boughtId]);
    const offer = make(seed, 'boss', run);
    const ids = offer.options.map(option => option.id);
    assert.equal(new Set(ids).size, ids.length, 'no duplicates');
    for (const option of offer.options) {
      if (option.kind === 'armor') {
        assert.notEqual(option.id, 'fixture.foreign', 'an eligible group may contain armour for another class');
        assert.ok(reg.equipment.armour.some(row => row.id === option.id && row.classId === run.class), 'armour belongs to the receiving class');
      }
      assert.ok(!owned.has(option.id), `seed ${seed}: ${option.id} is already owned`);
      assert.ok(option.kind === 'weapons' ? weaponGroups.has(option.id) : armourGroups.has(`${run.class}:${option.id}`), `${option.kind} ${option.id} is outside the authored groups`);
    }
  }
});

test('choices spread over weapon and armour, and over families before repeating one', () => {
  let both = 0, familyRepeat = 0, fourChoice = 0;
  const familyOf = option => option.kind === 'armor' ? 'armour' : reg.equipment.armaments.find(row => row.id === option.id).kind;
  for (const seed of SEEDS) {
    const offer = make(seed, 'boss', fresh(seed));
    const kinds = new Set(offer.options.map(option => option.kind));
    if (kinds.has('weapons') && kinds.has('armor')) both++;
    // Three families are on offer for weapons (weapon, shield, staff) plus armour: four choices use four different ones.
    if (offer.options.length === 4) { fourChoice++; if (new Set(offer.options.map(familyOf)).size < 3) familyRepeat++; }
  }
  assert.equal(both, SEEDS.length, 'every boss offer mixes weapons and armour');
  assert.ok(fourChoice > 0);
  assert.equal(familyRepeat, 0, 'a four-choice offer covers at least three families');
});

test('the same seed and offerId always roll the same offer; a built offer is cached', () => {
  for (const seed of [3, 11, 40]) {
    const a = make(seed, 'boss', fresh(seed)), b = make(seed, 'boss', fresh(seed));
    assert.deepEqual(a, b);
    const run = fresh(seed), first = make(seed, 'boss', run);
    assert.equal(GameProfileArmamentOffer(reg, run, createRng(999), { offerId: '1:n:combat:boss:armament', pool: 'boss' }), first, 'cached by offerId');
  }
  assert.notDeepEqual(make(5, 'boss', fresh(5), 'a'), make(6, 'boss', fresh(6), 'a'));
});

test('a saved offer survives a reload (structured clone) and claims into storage or bought armour', () => {
  const run = fresh(8), offer = make(8, 'boss', run);
  const reloaded = structuredClone(run);
  assert.deepEqual(reloaded.gameProfileRewardOffers[offer.id], offer);
  const weaponIndex = offer.options.findIndex(option => option.kind === 'weapons'), armourIndex = offer.options.findIndex(option => option.kind === 'armor');
  assert.ok(weaponIndex >= 0 && armourIndex >= 0);
  const armourId = offer.options[armourIndex].id;
  claimGameProfileReward(reg, reloaded, offer.id, armourIndex);
  assert.ok(reloaded.loadout.boughtArmour.some(row => row.id === armourId && row.classId === 'reaver'));
  assert.notEqual(reloaded.gameProfileRewardOffers[offer.id].claimed, null, 'one pick closes the door');
  const other = structuredClone(run);
  claimGameProfileReward(reg, other, offer.id, weaponIndex);
  assert.ok(other.loadout.storage.includes(offer.options[weaponIndex].id));
});

test('no offer when nothing is left to give, and none without the rule', () => {
  const run = fresh(2);
  for (const row of reg.equipment.armaments) if (!run.loadout.storage.includes(row.id)) run.loadout.storage.push(row.id);
  for (const row of reg.equipment.armour) run.loadout.boughtArmour = [...(run.loadout.boughtArmour || []), { classId: row.classId, id: row.id }];
  assert.equal(make(2, 'boss', run), null);
  assert.equal(run.gameProfileRewardOffers?.['1:n:combat:boss:armament'], undefined);
  const bare = fresh(2);
  delete bare.gameProfile.content.rewards.armamentReward;
  assert.equal(make(2, 'boss', bare), null);
});

test('chancePct 0 never drops and 100 always drops', () => {
  for (const [chancePct, expected] of [[0, false], [100, true]]) {
    for (const seed of [1, 2, 3, 4, 5]) {
      const run = fresh(seed);
      run.gameProfile.content.rewards.armamentReward.elite.chancePct = chancePct;
      assert.equal(!!make(seed, 'elite', run), expected);
    }
  }
});
