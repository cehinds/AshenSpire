import test from 'node:test';
import assert from 'node:assert/strict';
import { figureAnimationsEnabled } from '../src/model/gameAnimationPolicy.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch } from '../src/engine/combat.js';

const author = (name, animation) => ({ formatVersion: 1, core: `ashen.${name}@1.0.0`, modules: animation === undefined ? {} : { animation } });

test('Core and Current author JSON resolves defaults, explicit off, true and enabled overrides', () => {
  for (const name of ['core', 'current']) {
    for (const [animation, expected] of [[undefined, true], [true, true], [false, false], [{ enabled: false }, false], [{ enabled: true }, true]]) {
      const profile = resolveGameProfile(author(name, animation));
      assert.equal(figureAnimationsEnabled(profile), expected);
      assert.equal(figureAnimationsEnabled({ gameProfile: profile }), expected);
      if (animation === false) assert.equal(profile.modules.animation, false, 'whole-module false survives resolution');
      else assert.equal(profile.modules.animation.mode, name === 'core' ? 'configured' : 'legacy');
      assert.equal(Object.isFrozen(profile), true);
    }
    for (const animation of [{ enabled: 'false' }, { enabled: 0 }, { unknown: true }, null, { mode: name === 'core' ? 'legacy' : 'configured' }]) {
      assert.throws(() => resolveGameProfile(author(name, animation)), /animation/);
    }
  }
});

test('historical runs default on without a profile or without the historical optional animation key', () => {
  for (const subject of [undefined, {}, { gameProfile: { formatVersion: 1, modules: {} } }, { formatVersion: 1, modules: { cards: false } }]) assert.equal(figureAnimationsEnabled(subject), true);
  assert.equal(figureAnimationsEnabled({ gameProfile: { modules: { animation: false } } }), false);
  assert.equal(figureAnimationsEnabled({ gameProfile: { modules: { animation: { mode: 'legacy', enabled: false } } } }), false);
});

function fight(name, animation) {
  const gameProfile = resolveGameProfile(author(name, animation));
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, gameProfile)), gameProfile);
  const rng = createRng(311);
  const cardId = name === 'core' ? 'core.strike' : 'strike';
  const combat = createCombat({ registries, gameProfile, rng, enemyIds: ['wanderingSoldier'], player: {
    classId: 'reaver', maxHp: 100, hp: 100, maxStamina: 10, stamina: 10, maxMana: 5, mana: 5,
    energyMax: 10, drawPerTurn: 5, attributes: { strength: 2, dexterity: 1, intelligence: 1 },
    deck: Array.from({ length: 10 }, (_, i) => ({ instanceId: `card-${i}`, cardId, upgraded: false })),
  } });
  const before = { energy: combat.player.energy, stamina: combat.player.stamina, hp: combat.enemies[0].hp };
  const receipt = dispatch(combat, { type: 'playCard', cardInstanceId: combat.piles.hand[0].instanceId, targetId: combat.enemies[0].id });
  assert.equal(receipt.error, undefined);
  assert.ok(combat.player.energy < before.energy || combat.player.stamina < before.stamina, 'the real play pays its resource cost');
  assert.ok(combat.enemies[0].hp < before.hp, 'the real target takes damage');
  const next = dispatch(combat, { type: 'endTurn' });
  assert.equal(next.error, undefined);
  return { player: combat.player, enemies: combat.enemies, piles: combat.piles, eventLog: combat.eventLog, phase: combat.phase, turn: combat.turn, result: combat.result, rng: rng.getCounters() };
}

test('paid engine play and enemy turn are identical on/off, including receipts, piles, resources and RNG', () => {
  for (const name of ['core', 'current']) {
    const enabled = fight(name, true);
    assert.deepEqual(fight(name, false), enabled);
    assert.deepEqual(fight(name, { enabled: false }), enabled);
  }
});
