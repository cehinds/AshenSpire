// Owner, 2026-11-14 (W25-L): attributes change during a fight, everything derived follows at once, and everything returns after it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { gameProfileEffectiveAttributes } from '../src/model/gameProfileGear.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { awardLevelXp, xpToNext } from '../src/model/levelup.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from './withoutWeaknesses.mjs';
import { createSaveManager, createMemoryStorage } from '../src/engine/save.js';
import { commitCombatSnapshot, serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { dispatch } from '../src/engine/combat.js';
import { runCombatEnd } from '../src/engine/runCombat.js';
import { profileDamageReceipt } from '../src/engine/gameProfileCombat.js';
import { ChangeAttribute, ClearTurnAttributeBoosts, RestoreLiveStats, LiveAttribute, ElementStatScale, StatScaledNumber } from '../src/engine/liveStats.js';
import { ratingValue } from '../src/model/combatRatings.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: { effects: { physicalDamageMultiplier: 1, playerDamageMultiplier: 1 } } }); // Disable both output scales so live damage deltas are directly observable.
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
function live(classId = 'reaver', seed = 511) {
  const run = createRunState({ registries: reg, classId, seed, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries: reg, run, rng: createRng(seed), enemyIds: ['wanderingSoldier'] });
  return { run, combat };
}
const hit = (combat, base = 6) => profileDamageReceipt(combat, combat.player, combat.enemies[0], base, {});

test('+2 STR raises AR at once and the next hit quote', () => {
  const { combat } = live();
  const p = combat.player;
  const ar = ratingValue(combat, p, 'ar');
  const before = hit(combat).rawHit;
  assert.ok(ChangeAttribute(combat, p, 'strength', 2));
  assert.equal(LiveAttribute(p, 'strength'), p.liveStats.base.attributes.strength + 2);
  assert.equal(ratingValue(combat, p, 'ar'), ar + 2);
  assert.equal(p.ratingSources.find(r => r.kind === 'attribute').ar, p.liveStats.base.attributeRow.ar + 2, 'the per-source readers follow too');
  assert.equal(hit(combat).rawHit, before + 2, 'the quote changed by the AR gained');
});

test('the quote rises by the AR gained (shown = dealt)', () => {
  const a = live().combat, b = live().combat;
  const plain = hit(a).rawHit;
  ChangeAttribute(b, b.player, 'strength', 2);
  const boosted = hit(b).rawHit;
  assert.equal(boosted, plain + 2);
});

test('+2 CON raises max HP by 10 without raising Stamina or Poise; restoration trims HP', () => {
  const { combat } = live();
  const p = combat.player;
  const start = { maxHp: p.maxHp, hp: p.hp, maxStamina: p.maxStamina, energyMax: p.energyMax, poise: p.ratings.poise, pMax: p.persistentPoise.max };
  ChangeAttribute(combat, p, 'constitution', 2);
  assert.equal(p.maxHp, start.maxHp + 10, 'each CON point adds 5 Health');
  assert.equal(p.hp, start.hp, 'a higher maximum does not heal');
  assert.equal(p.ratings.poise, start.poise, 'Constitution no longer grants Poise');
  assert.equal(p.persistentPoise.max, p.ratings.poise);
  assert.equal(p.maxStamina, start.maxStamina);
  assert.equal(p.energyMax, start.energyMax);
  p.hp = p.maxHp; // full on the raised maximum
  RestoreLiveStats(combat);
  assert.equal(p.maxHp, start.maxHp);
  assert.equal(p.hp, start.maxHp, 'HP above the restored maximum is trimmed');
  assert.equal(p.ratings.poise, start.poise);
  assert.equal(p.persistentPoise.max, start.pMax);
  assert.equal(p.liveStats, undefined);
});

test('+2 WIS raises live Poise and its vessel by 2, then restoration removes the bonus', () => {
  const { combat } = live();
  const p = combat.player;
  const before = { poise: p.ratings.poise, max: p.persistentPoise.max, hp: p.maxHp, stamina: p.maxStamina };
  ChangeAttribute(combat, p, 'wisdom', 2);
  assert.equal(p.ratings.poise, before.poise + 2);
  assert.equal(p.persistentPoise.max, before.max + 2);
  assert.equal(p.maxHp, before.hp);
  assert.equal(p.maxStamina, before.stamina);
  RestoreLiveStats(combat);
  assert.equal(p.ratings.poise, before.poise);
  assert.equal(p.persistentPoise.max, before.max);
});

test('only DEX raises new-profile Stamina, and live attribute boosts leave the run untouched', () => {
  const { run, combat } = live();
  const p = combat.player;
  const attrs = structuredClone(run.attributes);
  const maxHp = run.maxHp;
  const stamina = p.maxStamina;
  const runStamina = run.maxStamina;
  const held = { stamina: p.stamina, energy: p.energy };
  ChangeAttribute(combat, p, 'constitution', 8);
  assert.equal(p.maxStamina, stamina, 'CON does not grant Stamina');
  ChangeAttribute(combat, p, 'dexterity', 8);
  assert.equal(p.maxStamina, stamina + 8, 'eight DEX raises capacity by eight');
  assert.equal(p.energyMax, p.maxStamina);
  assert.deepEqual({ stamina: p.stamina, energy: p.energy }, held, 'a higher maximum does not refill the turn budget');
  assert.deepEqual(run.attributes, attrs, 'the run attributes are never written');
  assert.equal(run.maxHp, maxHp);
  runCombatEnd(run, combat);
  assert.equal(run.maxHp, maxHp, 'the fight leaves the run its own maximum');
  assert.equal(run.maxStamina, runStamina);
  assert.deepEqual(run.attributes, attrs);
});

test('live configured hand size and draw rise per Intelligence point, then return', () => {
  const { combat } = live();
  const hand = combat.handMax, draw = combat.drawPerTurn;
  ChangeAttribute(combat, combat.player, 'intelligence', 2 - LiveAttribute(combat.player, 'intelligence'));
  const atTwo = { hand: combat.handMax, draw: combat.drawPerTurn };
  ChangeAttribute(combat, combat.player, 'intelligence', 1);
  assert.equal(combat.handMax, atTwo.hand + 1, 'INT 2 -> 3 adds a card');
  assert.equal(combat.drawPerTurn, atTwo.draw + 1);
  ChangeAttribute(combat, combat.player, 'intelligence', 1);
  assert.equal(combat.handMax, atTwo.hand + 2, 'INT 3 -> 4 adds another card');
  assert.equal(combat.drawPerTurn, atTwo.draw + 2);
  RestoreLiveStats(combat);
  assert.equal(combat.handMax, hand);
  assert.equal(combat.drawPerTurn, draw);
});

test('a this-turn change leaves at the end of the owner\'s turn; a rest-of-fight change stays and stacks', () => {
  const { combat } = live();
  const p = combat.player;
  const str = LiveAttribute(p, 'strength');
  ChangeAttribute(combat, p, 'strength', 2, { thisTurn: true });
  ChangeAttribute(combat, p, 'strength', 1);
  ChangeAttribute(combat, p, 'strength', 1);
  assert.equal(LiveAttribute(p, 'strength'), str + 4);
  dispatch(combat, { type: 'endTurn' });
  assert.equal(LiveAttribute(p, 'strength'), str + 2, 'only the two fight-long points remain');
});

test('enemies change live too', () => {
  const { combat } = live();
  const e = combat.enemies[0];
  const ar = e.ratings.ar, maxHp = e.maxHp;
  ChangeAttribute(combat, e, 'strength', 2);
  ChangeAttribute(combat, e, 'constitution', 3);
  assert.equal(e.ratings.ar, ar + 2);
  assert.ok(e.maxHp > maxHp);
  RestoreLiveStats(combat);
  assert.equal(e.ratings.ar, ar);
  assert.equal(e.maxHp, maxHp);
});

test('a mid-fight INT boost raises the stat-scaled element numbers at once and they revert', () => {
  const { combat } = live();
  const p = combat.player;
  const fire = ElementStatScale(p, 'fire', combat), shock = ElementStatScale(p, 'lightning', combat), chill = ElementStatScale(p, 'frost', combat);
  ChangeAttribute(combat, p, 'intelligence', 2);
  const shared = Math.max(LiveAttribute(p, 'intelligence'), LiveAttribute(p, 'wisdom'));
  assert.equal(ElementStatScale(p, 'fire', combat), shared, 'shared Fire reads the greater casting attribute');
  assert.equal(ElementStatScale(p, 'frost', combat), shared);
  assert.equal(ElementStatScale(p, 'lightning', combat), shared);
  assert.ok(shared >= shock);
  assert.equal(StatScaledNumber(p, ['intelligence', 'wisdom'], 'max'), Math.max(LiveAttribute(p, 'intelligence'), LiveAttribute(p, 'wisdom')));
  RestoreLiveStats(combat);
  assert.equal(ElementStatScale(p, 'fire', combat), fire);
  assert.equal(ElementStatScale(p, 'frost', combat), chill);
});

test('a mid-fight INT or WIS boost raises PR under max(INT, WIS)', () => {
  const { combat } = live('starseer');
  const p = combat.player;
  const pr = ratingValue(combat, p, 'pr');
  const high = Math.max(LiveAttribute(p, 'intelligence'), LiveAttribute(p, 'wisdom'));
  ChangeAttribute(combat, p, 'wisdom', high + 3 - LiveAttribute(p, 'wisdom')); // WIS becomes the highest
  assert.equal(ratingValue(combat, p, 'pr'), pr + 3);
  RestoreLiveStats(combat);
  assert.equal(ratingValue(combat, p, 'pr'), pr);
});

test('boosts survive a save of the fight (plain JSON) and still revert', () => {
  const { combat } = live();
  const p = combat.player;
  ChangeAttribute(combat, p, 'strength', 2);
  const copy = JSON.parse(JSON.stringify(p.liveStats));
  assert.deepEqual(copy, p.liveStats);
  const ar = p.ratings.ar;
  p.liveStats = copy;
  RestoreLiveStats(combat);
  assert.equal(p.ratings.ar, ar - 2);
});


test('HP, Stamina and Mana gains never refill; expiration and debuffs clamp, including after restore', () => {
  const { combat } = live();
  const poolSpec = [
    ['constitution', 'hp', 'maxHp', 10],
    ['dexterity', 'stamina', 'maxStamina', 2],
    ['wisdom', 'mana', 'maxMana', 2],
  ];
  const before = new Map();
  for (const entity of [combat.player, combat.enemies[0]]) {
    const original = [];
    if (entity.kind === 'enemy') entity.mana = entity.maxMana = 3;
    for (const [attribute, resource, maximum, playerDelta] of poolSpec) {
      const cap = entity[maximum];
      entity[resource] = Math.max(0, cap - 1);
      const held = entity[resource];
      ChangeAttribute(combat, entity, attribute, 2, { thisTurn: true });
      assert.equal(entity[maximum], cap + (entity.kind === 'enemy' ? 2 : playerDelta));
      assert.equal(entity[resource], held, `${entity.kind} ${resource}: capacity does not refill`);
      original.push([resource, maximum, cap, held]);
    }
    before.set(entity.id, original);
  }
  const restored = restoreCombatSnapshot({ registries: reg, snapshot: serializeCombatSnapshot(combat), rng: createRng(511) });
  for (const entity of [restored.player, restored.enemies[0]]) {
    for (const [resource, maximum, cap, held] of before.get(entity.id)) {
      assert.ok(entity[maximum] > cap);
      assert.equal(entity[resource], held);
      entity[resource] = entity[maximum]; // Simulate an independent refill while the boost is active.
    }
    ClearTurnAttributeBoosts(restored, entity);
    for (const [resource, maximum, cap] of before.get(entity.id)) {
      assert.deepEqual([entity[resource], entity[maximum]], [cap, cap]);
    }
  }
  const player = restored.player;
  // The Reaver starts with no Wisdom (owner, 2026-11-28); a fight-long point gives the debuff something to take.
  ChangeAttribute(restored, player, 'wisdom', 1);
  player.mana = player.maxMana;
  ChangeAttribute(restored, player, 'wisdom', -1, { thisTurn: true });
  const reduced = player.maxMana;
  assert.equal(player.mana, reduced);
  ClearTurnAttributeBoosts(restored, player);
  assert.equal(player.maxMana, reduced + 1);
  assert.equal(player.mana, reduced, 'recovering from a debuff does not refill Mana');
});
test('enemy turn boosts expire after acting or skipping', () => {
  for (const skipped of [false, true]) {
    const { combat } = live();
    dispatch(combat, { type: 'setReactions', enabled: false });
    const enemy = combat.enemies[0];
    const maxHp = enemy.maxHp;
    ChangeAttribute(combat, enemy, 'constitution', 2, { thisTurn: true });
    assert.ok(enemy.maxHp > maxHp);
    enemy.hp = enemy.maxHp;
    enemy.skipNextTurn = skipped;
    dispatch(combat, { type: 'endTurn' });
    assert.equal(combat.enemies[0].maxHp, maxHp);
    assert.equal(combat.enemies[0].hp, maxHp);
    assert.deepEqual(combat.enemies[0].liveStats.turnBoosts, {});
  }
});

test('saving an active fight persists live capacities only inside the combat snapshot', () => {
  const { run, combat } = live();
  const permanent = Object.fromEntries(['maxHp', 'maxMana', 'maxStamina', 'energyMax', 'drawPerTurn'].map(field => [field, run[field]]));
  const player = combat.player;
  for (const attribute of ['constitution', 'dexterity', 'wisdom']) {
    ChangeAttribute(combat, player, attribute, 2, { thisTurn: true });
  }
  for (const [pool, cap] of [['hp', 'maxHp'], ['mana', 'maxMana'], ['stamina', 'maxStamina']]) {
    assert.ok(player[cap] > permanent[cap]);
    player[pool] = player[cap];
  }
  commitCombatSnapshot({ run, combat, nodeId: 'n1_4', encounterId: 'patrol' });
  const manager = createSaveManager(createMemoryStorage());
  manager.saveRun(run, combat.rng);
  const loaded = manager.loadRun(reg);
  assert.ok(loaded, JSON.stringify(manager.runStatus()));
  for (const [field, value] of Object.entries(permanent)) assert.equal(loaded[field], value, field);
  const restored = restoreCombatSnapshot({
    registries: reg, snapshot: loaded.combatEntered.snapshot, rng: createRng(511), expectedGameProfile: loaded.gameProfile,
  });
  for (const [pool, cap] of [['hp', 'maxHp'], ['mana', 'maxMana'], ['stamina', 'maxStamina']]) {
    assert.equal(loaded[pool], permanent[cap], pool);
    assert.equal(restored.player[pool], player[cap], pool);
  }
  ClearTurnAttributeBoosts(restored, restored.player);
  for (const [pool, cap] of [['hp', 'maxHp'], ['mana', 'maxMana'], ['stamina', 'maxStamina']]) {
    assert.equal(restored.player[cap], permanent[cap], cap);
    assert.equal(restored.player[pool], permanent[cap], pool);
  }
});
test('an equipment change during a boost keeps permanent level gains and survives saving', () => {
  const registries = {
    ...reg,
    balance: { ...reg.balance, equipment: { ...reg.balance.equipment, allowChangesInCombat: true, swapEndsTurn: false, swapCostKind: 'allowance' } },
  };
  function swap(boosted) {
    const run = createRunState({ registries, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
    const initialStrength = gameProfileEffectiveAttributes(registries, run).strength;
    awardLevelXp(registries, run, xpToNext(registries, 1));
    run.loadout.storage.push('boneSceptre');
    const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
    combat.swapsLeft = 99;
    assert.equal(combat.player.attributes.strength, initialStrength + 1, 'the earned class point increases the equipped Strength');
    if (boosted) ChangeAttribute(combat, combat.player, 'wisdom', 2, { thisTurn: true });
    dispatch(combat, { type: 'changeEquipment', slotId: 'rightHand', setIndex: 0, pieceId: 'boneSceptre' });
    assert.equal(combat.loadout.sets.rightHand[0], 'boneSceptre');
    return { run, combat };
  }
  const { run, combat } = swap(true);
  const unboosted = swap(false).combat.player;
  assert.equal(combat.player.attributes.wisdom, unboosted.attributes.wisdom + 2);
  assert.equal(combat.player.maxMana, unboosted.maxMana + 2);
  commitCombatSnapshot({ run, combat, nodeId: 'n1_4', encounterId: 'patrol' });
  const manager = createSaveManager(createMemoryStorage());
  manager.saveRun(run, combat.rng);
  const loaded = manager.loadRun(registries);
  assert.ok(loaded, JSON.stringify(manager.runStatus()));
  const restored = restoreCombatSnapshot({
    registries, snapshot: loaded.combatEntered.snapshot, rng: createRng(511), expectedGameProfile: loaded.gameProfile,
  });
  assert.equal(restored.player.maxMana, loaded.maxMana + 2);
  ClearTurnAttributeBoosts(restored, restored.player);
  assert.deepEqual(restored.player.attributes, unboosted.attributes);
  assert.deepEqual(restored.player.ratings, unboosted.ratings);
  assert.equal(restored.player.maxMana, loaded.maxMana);
});
