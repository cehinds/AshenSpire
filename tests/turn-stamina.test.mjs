import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch, previewCard, cardPlayCosts } from '../src/engine/combat.js';
import { createCoopCombat, playCard, endTurn } from '../src/engine/coopCombat.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { validateContent } from '../src/model/validate.js';
import { executeAction } from '../src/engine/actions.js';
import { statRowValue } from '../src/model/derivedStats.js';

test('stamina scales with Dexterity, Constitution, Wisdom, Intelligence and level', () => {
  const row = contentBundle.derivedStatRules.rules.stamina;
  const value = (attributes, level = 1) => statRowValue(row, { attributes, level, statId: 'stamina' }).value;
  const base = { strength: 1, dexterity: 1, constitution: 1, wisdom: 1, intelligence: 1 };
  assert.equal(value(base), 3);
  for (const [attribute, threshold] of [['dexterity', 4], ['constitution', 4], ['wisdom', 5], ['intelligence', 5]]) {
    assert.equal(value({ ...base, [attribute]: threshold - 1 }), 3, attribute);
    assert.equal(value({ ...base, [attribute]: threshold }), 4, attribute);
  }
  assert.equal(value(base, 10), 3);
  assert.equal(value(base, 11), 4);
  assert.equal(value({ ...base, strength: 100 }), 3);
  assert.equal(value({ ...base, dexterity: 4, constitution: 4, wisdom: 5, intelligence: 5 }, 11), 8);
});

const registries = createRegistries(contentBundle);
const player = (id = 'p1') => ({ id, classId: 'reaver', maxHp: 1000, maxMana: 10,
  maxStamina: 3, energyMax: 3, drawPerTurn: 5, relicIds: [],
  deck: Array.from({ length: 12 }, (_, i) => ({ instanceId: `${id}-${i}`, cardId: 'strike', upgraded: false })),
});
const fight = () => createCombat({ registries, rng: createRng(5), player: player(), enemyIds: ['wanderingSoldier'] });

test('shipping content validates and every class starts with three base stamina', () => {
  assert.deepEqual(validateContent(contentBundle).errors, []);
  for (const cls of registries.classes.all()) {
    const run = createRunState({ seed: 5, classId: cls.id, registries });
    assert.equal(run.maxStamina, 3, cls.id);
    assert.equal(run.stamina, 3, cls.id);
  }
  assert.deepEqual(contentBundle.resources.filter(r => r.surfaces.includes('main')).map(r => r.id).sort(), ['hp', 'mana']);
});

test('all card faces expose one stamina price equal to the former action price', () => {
  for (const card of registries.cards.all()) for (const upgraded of [false, true]) {
    const def = resolveCard(registries, { cardId: card.id, upgraded });
    const price = registries.framework.costProfile(def);
    assert.equal(price.stamina, price.action, `${card.id} upgrade=${upgraded}`);
    assert.equal(price.variable, def.cost === 'X');
  }
});

test('solo payment is once, insufficient stamina is atomic, next turn fully resets', () => {
  const c = fight();
  const card = c.piles.hand[0];
  assert.equal(previewCard(c, card.instanceId, 'e1').staminaCost, 1);
  assert.deepEqual(cardPlayCosts(c, card.instanceId), { energy: 1, stamina: 1, mana: 0 });
  dispatch(c, { type: 'playCard', cardInstanceId: card.instanceId, targetId: 'e1' });
  assert.equal(c.player.stamina, 2);
  assert.equal(c.player.energy, 2);
  c.player.stamina = 0;
  const before = JSON.stringify(serializeCombatSnapshot(c));
  assert.throws(() => dispatch(c, { type: 'playCard', cardInstanceId: c.piles.hand[0].instanceId, targetId: 'e1' }), /stamina/);
  assert.equal(JSON.stringify(serializeCombatSnapshot(c)), before);
  c.player.mana = 2;
  dispatch(c, { type: 'endTurn' });
  assert.equal(c.player.stamina, 3);
  assert.equal(c.player.mana, 2);
});

test('saved combat restores the shared budget and continues identically', () => {
  const c = fight();
  dispatch(c, { type: 'playCard', cardInstanceId: c.piles.hand[0].instanceId, targetId: 'e1' });
  const restored = restoreCombatSnapshot({ registries, rng: createRng(c.rng.seed, c.rng.getCounters()), snapshot: serializeCombatSnapshot(c) });
  assert.equal(restored.player.stamina, 2);
  restored.player.energy--;
  assert.equal(restored.player.stamina, 1);
  restored.player.stamina++;
  assert.deepEqual(dispatch(c, { type: 'endTurn' }), dispatch(restored, { type: 'endTurn' }));
  assert.deepEqual(serializeCombatSnapshot(c), serializeCombatSnapshot(restored));
});

test('co-op spends only the acting seat stamina and refills both seats next round', () => {
  const c = createCoopCombat({ registries, rng: createRng(5), players: [player('p1'), player('p2')], enemyIds: ['wanderingSoldier'] });
  const one = c.players.get('p1'), two = c.players.get('p2');
  playCard(c, 'p1', one.piles.hand[0].instanceId, 'e1');
  assert.equal(one.entity.stamina, 2);
  assert.equal(two.entity.stamina, 3);
  endTurn(c, 'p1'); endTurn(c, 'p2');
  assert.equal(one.entity.stamina, 3);
  assert.equal(two.entity.stamina, 3);
});

test('X costs spend all remaining stamina; zero-cost cards stay playable at zero', () => {
  for (const amount of [0, 2, 5]) {
    const c = fight();
    c.enemies[0].hp = c.enemies[0].maxHp = 1000;
    c.player.stamina = amount;
    c.piles.hand = [{ instanceId: 'x', cardId: 'stitchedArms', upgraded: false }];
    assert.equal(previewCard(c, 'x', 'e1').staminaCost, amount);
    const events = dispatch(c, { type: 'playCard', cardInstanceId: 'x', targetId: 'e1' }).events;
    assert.equal(c.player.stamina, 0);
    assert.equal(events.find(e => e.type === 'cardPlayed').staminaSpent, amount);
    c.piles.hand = [{ instanceId: 'free', cardId: 'rogueShiv', upgraded: false }];
    dispatch(c, { type: 'playCard', cardInstanceId: 'free', targetId: 'e1' });
    assert.equal(c.player.stamina, 0);
  }
});

test('gain and recovery effects share the same turn budget, including overflow', () => {
  const c = fight();
  const apply = effect => executeAction(c, { effect, source: c.player, owner: c.player, target: c.player });
  c.player.stamina = 1;
  apply({ op: 'restoreStamina', target: 'self', amount: 1 });
  assert.equal(c.player.energy, 2);
  apply({ op: 'gainEnergy', amount: 3 });
  assert.equal(c.player.stamina, 5);
  apply({ op: 'restoreStamina', target: 'self', amount: 1 });
  assert.equal(c.player.stamina, 5, 'recovery never removes bonus stamina');
  const restored = restoreCombatSnapshot({ registries, rng: createRng(5), snapshot: serializeCombatSnapshot(c) });
  assert.equal(restored.player.stamina, 5);
  dispatch(c, { type: 'endTurn' });
  assert.equal(c.player.stamina, 3, 'temporary gains do not carry over');
});

test('Mana remains a separate payment and Power reductions affect the one stamina cost', () => {
  const c = fight();
  c.piles.hand = [{ instanceId: 'spell', cardId: 'gorefireSlash', upgraded: false }];
  c.player.mana = 0;
  assert.throws(() => dispatch(c, { type: 'playCard', cardInstanceId: 'spell', targetId: 'e1' }), /mana/);
  assert.equal(c.player.stamina, 3);
  c.player.mana = 1;
  dispatch(c, { type: 'playCard', cardInstanceId: 'spell', targetId: 'e1' });
  assert.equal(c.player.stamina, 2);
  assert.equal(c.player.mana, 0);
  const power = registries.cards.all().find(c => c.type === 'power' && c.cost > 0);
  const profile = registries.framework.costProfile(resolveCard(registries, {cardId: power.id}), { powerCostReduction: 1 });
  assert.equal(profile.stamina, Math.max(0, power.cost - 1));
});
