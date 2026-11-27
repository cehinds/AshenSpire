// Every acquisition/removal path must reconcile resource bonuses immediately.
// A small explicit picked-Mana relic tests the path independently of today's items.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import * as Profile from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { claimGameProfileReward } from '../src/model/gameProfileRewards.js';
import { RUN_OPCODE_HANDLERS } from '../src/engine/actions.js';
import { ItemStatBonus } from '../src/model/itemPicks.js';
import { gameProfileShopSalePlan, commitGameProfileShopSale } from '../src/model/gameProfileShopSales.js';

const shipped = Profile.resolveGameProfile('default');
const RELIC = 'fixture-mana-grant', DELTA = 3;
const fixtureBundle = { ...contentBundle, relics: [...contentBundle.relics,
  { id: RELIC, name: 'Fixture Mana grant', rarity: 'common', passives: {}, textTemplate: 'Fixture resource bonus.' }] };
const registries = Profile.bindGameProfileRegistries(createRegistries(Profile.applyGameProfileToContent(fixtureBundle, shipped)), shipped);
const META = { gameProfileUnlocks: { [shipped.id]: { completedRunIds: ['a', 'b', 'c'] } } };
const fresh = () => {
  const run = createRunState({ registries, classId: 'reaver', seed: 31, profileMeta: META });
  run.itemUpgradePicks = { ...run.itemUpgradePicks, ['relic/' + RELIC]: [{ id: 'fixture-mana', k: 'stat', stat: 'mp', n: DELTA }] };
  run.gameProfile.content.rewards.eligibility.relics.allow = [RELIC];
  return run;
};
const nextCombatMaxMana = run => createRunCombat({ registries, run, rng: createRng(31), enemyIds: [registries.enemies.ids()[0]] }).player.maxMana;

test('current relic Mana properties follow the authored relic and property tables', () => {
  const read = name => JSON.parse(readFileSync(new URL('../content/source/' + name + '.json', import.meta.url), 'utf8'));
  const properties = read('itemProperties').properties;
  const run = fresh();
  for (const row of read('relics')) {
    const expected = (row.properties || []).reduce((sum, id) => sum + (properties.find(property => property.id === id)?.stats?.mp || 0), 0);
    assert.equal(ItemStatBonus(run, 'relic/' + row.id).mp || 0, expected, row.id);
  }
});

function assertRaised(run, before, mana) {
  assert.ok(run.relics.includes(RELIC));
  assert.equal(run.maxMana, before.maxMana + DELTA);
  assert.equal(run.mana, mana + DELTA, 'current Mana rises only as the vessel grows');
  assert.equal(run.hp, before.hp, 'current HP is unchanged');
  assert.equal(nextCombatMaxMana(run), nextCombatMaxMana(before) + DELTA, 'the next combat opens with the new maximum');
}

test('claiming a resource-bonus relic as a reward reconciles Mana immediately', () => {
  const run = fresh(), before = structuredClone(run), mana = run.mana;
  run.gameProfileRewardOffers = { grant: { id: 'grant', source: 'combat', options: [{ kind: 'relics', id: RELIC }], takeCount: 1, taken: [], claimed: null } };
  const cls = run.class;
  claimGameProfileReward(registries, run, 'grant', 0);
  assert.equal(run.class, cls);
  assertRaised(run, before, mana);
});

test('the addRelic opcode reconciles Mana immediately for event, chest and boss grants', () => {
  const run = fresh(), before = structuredClone(run), mana = run.mana;
  RUN_OPCODE_HANDLERS.addRelic({ run, registries, rng: createRng(5), emit() {} }, {}, { op: 'addRelic', id: RELIC });
  assertRaised(run, before, mana);
  const granted = JSON.stringify(run);
  RUN_OPCODE_HANDLERS.addRelic({ run, registries, rng: createRng(5), emit() {} }, {}, { op: 'addRelic', id: RELIC });
  assert.equal(JSON.stringify(run), granted, 'a repeated grant cannot grow the resource pool again');
});

test('selling a resource-bonus relic lowers maximum Mana and clamps current Mana', () => {
  const run = fresh(), base = structuredClone(run);
  RUN_OPCODE_HANDLERS.addRelic({ run, registries, rng: createRng(5), emit() {} }, {}, { op: 'addRelic', id: RELIC });
  assert.equal(run.maxMana, base.maxMana + DELTA);
  run.mana = run.maxMana;
  // An explicit open visit tests the sale path without assuming current shelves.
  run.shopStock = { kind: 'blacksmith', offerings: [] };
  const hp = run.hp, maxHp = run.maxHp;
  const quote = gameProfileShopSalePlan(registries, run, 'market', 'relics', RELIC);
  assert.ok(quote.ok, quote.reason);
  commitGameProfileShopSale(registries, run, 'market', quote);
  assert.ok(!run.relics.includes(RELIC));
  assert.equal(run.maxMana, base.maxMana);
  assert.ok(run.mana <= run.maxMana);
  assert.equal(run.mana, base.mana);
  assert.equal(run.hp, hp);
  assert.equal(run.maxHp, maxHp);
});
