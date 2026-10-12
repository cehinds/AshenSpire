// One hit, two parts: a magic part (Barrier, then Ward) and a physical part
// (Block). Exact numbers from the damage-split brief.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { enqueueExpandedAction, previewExpandedActions } from '../src/engine/combatExpansionActions.js';
import { executeAction, gainBlock } from '../src/engine/actions.js';

function fixture({ ward = 3, barrier = 0, block = 0 } = {}) {
  const registries = createRegistries(contentBundle);
  const combat = createCombat({ registries, rng: createRng(901), combatExpansionVersion: 2,
    enemyIds: ['wanderingSoldier'], player: { classId: 'starseer', maxHp: 100, hp: 100,
      maxMana: 10, mana: 10, maxStamina: 10, stamina: 10, energyMax: 10, drawPerTurn: 1, deck: [] } });
  const enemy = combat.enemies[0];
  enemy.block = block; enemy.barrier = barrier;
  enemy.damageResistanceFlat = {}; enemy.damageWeaknessPercent = {};
  enemy.ratings = { ar: 0, dr: 0, pr: 0, poise: 0, ward: 3 };
  delete enemy.combatCounter; delete enemy.combatEvade; delete enemy.combatStance;
  enemy.persistentWard.max = 3; enemy.persistentWard.value = ward;
  return { combat, enemy };
}

// Commit one damage action of `amount` from `carrier`, return its events and the preview's contacts.
function strike(carrier, amount, setup = {}) {
  const { combat, enemy } = fixture(setup);
  const hpBefore = enemy.hp;
  const action = () => ({ effect: { op: 'damage', target: 'enemy', amount }, source: combat.player, owner: combat.player,
    target: enemy, card: carrier, meta: {} });
  const preview = previewExpandedActions(combat, [action()], { source: combat.player, target: enemy, carrier })
    .flat().reduce((sum, contact) => sum + contact.amount, 0);
  const events = [];
  const emit = combat.emit;
  combat.emit = (type, payload) => { events.push({ type, ...payload }); return emit(type, payload); };
  enqueueExpandedAction(combat, [action()], { source: combat.player, target: enemy, carrier });
  while (combat.queue.length) executeAction(combat, combat.queue.shift());
  const damage = events.filter(e => e.type === 'damageDealt' && e.targetId === enemy.id);
  return { combat, enemy, events, damage, preview, hpBefore, committed: damage.reduce((s, e) => s + e.amount, 0),
    hpLost: before => before - enemy.hp };
}

const scepter = { cardId: undefined, tags: ['camp:spell', 'maneuver:casting', 'damage:arcane'], skipRatingBonus: true,
  magicShare: 0.4, physicalDamageType: 'blunt', damageSchool: 'magic',
  combatProfile: { camp: 'spell', maneuver: 'casting', school: 'force', damageType: 'arcane', reach: 'near', targeting: 'single' } };

test('a scepter strike of 5 is 2 arcane and 3 blunt: Ward takes the 2, the 3 is HP', () => {
  const r = strike(scepter, 5, { ward: 3 });
  assert.equal(r.damage.length, 1);
  const [d] = r.damage;
  assert.equal(d.amount, 3, 'what reaches Block and HP');
  assert.equal(d.magicAmount, 2);
  assert.equal(d.physicalAmount, 3);
  assert.equal(d.wardAbsorbed, 2);
  assert.equal(d.wardRemaining, 1, 'Ward 3 becomes 1');
  assert.equal(r.hpLost(r.hpBefore), 3, 'total HP loss is 3');
  // A force hit's shipped rider (damageRiders.force) then strips 2 more Ward; the hit's own numbers stay as above.
  assert.equal(r.events.find(e => e.type === 'combatWardStripped')?.amount, 1);
});

test('against Block 3 the physical 3 is blocked, and at least 1 magic gets through from Ward', () => {
  const r = strike(scepter, 5, { ward: 3, block: 3 });
  const [d] = r.damage;
  assert.equal(d.blocked, 3);
  assert.equal(d.amount, 4, 'one magic point is let through by the at-least-1 rule');
  assert.equal(d.wardAbsorbed, 1, 'Ward gives up the point it let through');
  assert.equal(d.wardRemaining, 2, 'Ward 3 becomes 2');
  assert.equal(r.enemy.block, 0);
  assert.equal(r.hpLost(r.hpBefore), 1, 'total HP loss is 1');
  assert.equal(r.preview, r.committed, 'preview total equals committed damage');
});

test('preview total equals committed damage for a split strike, with and without Barrier and Block', () => {
  for (const setup of [{ ward: 3 }, { ward: 3, block: 3 }, { ward: 0, barrier: 2, block: 1 }, { ward: 0 }]) {
    const r = strike(scepter, 5, setup);
    assert.equal(r.preview, r.committed, JSON.stringify(setup));
  }
});

test('a force (arcane) card with no override splits 50:50', () => {
  const force = { tags: ['camp:spell', 'damage:arcane'], skipRatingBonus: true, combatProfile: { camp: 'spell', damageType: 'arcane', maneuver: 'casting', reach: 'near', targeting: 'single' } };
  const r = strike(force, 5, { ward: 0 });
  assert.equal(r.damage[0].magicAmount, 2, 'floor(5 x 0.5)');
  assert.equal(r.damage[0].physicalAmount, 3);
  assert.equal(r.hpLost(r.hpBefore), 5, 'no Ward, so all 5 lands');
});

test('a fire card stays all magic, and a slashing strike all physical', () => {
  const fire = { tags: ['camp:spell', 'damage:fire'], skipRatingBonus: true, combatProfile: { camp: 'spell', damageType: 'fire', maneuver: 'casting', reach: 'near', targeting: 'single' } };
  const f = strike(fire, 5, { ward: 0 }).damage[0];
  assert.equal(f.magicAmount, 5);
  assert.equal(f.physicalAmount, 0);
  const slash = { tags: ['camp:physical', 'damage:slashing'], skipRatingBonus: true, combatProfile: { camp: 'physical', damageType: 'slashing', maneuver: 'attack', reach: 'contact', targeting: 'single' } };
  const s = strike(slash, 5, { ward: 3 }).damage[0];
  assert.equal(s.magicAmount, 0);
  assert.equal(s.physicalAmount, 5);
  assert.equal(s.wardAbsorbed, undefined, 'a physical hit never touches Ward');
});

test('a spell with a physical tag stays on its camp: Ward, not Block (shipped counters keep their route)', () => {
  const counter = { tags: ['camp:spell', 'damage:blunt'], skipRatingBonus: true, combatProfile: { camp: 'spell', damageType: 'blunt', maneuver: 'counter', reach: 'near', targeting: 'single' } };
  const d = strike(counter, 5, { ward: 3 }).damage[0];
  assert.equal(d.magicAmount, 5);
  assert.equal(d.wardAbsorbed, 3);
});

test('a scepter defend of 5 gives Barrier 2 and Block 3 on full Ward, and Ward 2 and Block 3 on empty Ward', () => {
  const guard = { tags: ['camp:spell', 'maneuver:defend'], skipRatingBonus: true, magicShare: 0.4, physicalDamageType: 'blunt',
    combatProfile: { camp: 'spell', maneuver: 'defend', damageType: 'arcane', reach: 'near', targeting: 'single' } };
  for (const [ward, wardAfter, barrier] of [[3, 3, 2], [0, 2, 0]]) {
    const { combat } = fixture({ ward: 0 });
    const player = combat.player;
    player.persistentWard = { max: 3, value: ward };
    player.barrier = 0; player.block = 0;
    const gained = gainBlock(combat, player, 5, guard);
    assert.equal(gained, 5, 'the guard lays down 5 in all');
    assert.equal(player.block, 3, 'Block 3');
    assert.equal(player.persistentWard.value, wardAfter, `Ward ${ward} becomes ${wardAfter}`);
    assert.equal(player.barrier, barrier, `Barrier ${barrier}`);
  }
});
