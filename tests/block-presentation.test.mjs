import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { createCoopCombat, endTurn } from '../src/engine/coopCombat.js';
import { gainBlock, applyAttackDamage } from '../src/engine/actions.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { combatSnapshotProblems } from '../src/model/combatSnapshot.js';
import { blockPresentation } from '../src/model/blockPresentation.js';

const registries = createRegistries(contentBundle);
const player = (id = 'p1') => ({ id, classId: 'reaver', maxHp: 1000, maxMana: 10,
  maxStamina: 3, energyMax: 3, drawPerTurn: 5, relicIds: [],
  deck: Array.from({ length: 12 }, (_, i) => ({ instanceId: `${id}-${i}`, cardId: 'strike', upgraded: false })),
});
const fight = () => createCombat({ registries, rng: createRng(5), player: player(), enemyIds: ['wanderingSoldier'] });
const magic = { damageSchool: 'magic' };

test('magical and ordinary guards share Block, preserve HP, and emit paced HUD provenance', () => {
  const c = fight(), p = c.player;
  const events = [], emit = c.emit;
  c.emit = (type, payload) => { events.push({ type, ...payload }); return emit(type, payload); };
  assert.equal(gainBlock(c, p, 8, magic), 8);
  assert.equal(gainBlock(c, p, 12), 12);
  assert.deepEqual(blockPresentation(p), { defense: 12, ward: 8 });
  const hp = p.hp;
  applyAttackDamage(c, c.enemies[0], p, 12);
  assert.equal(p.hp, hp);
  assert.deepEqual(blockPresentation(p), { defense: 0, ward: 8 });
  applyAttackDamage(c, c.enemies[0], p, 10);
  assert.equal(p.hp, hp - 2);
  assert.deepEqual(blockPresentation(p), { defense: 0, ward: 0 });
  const hits = events.filter(e => e.type === 'damageDealt');
  assert.deepEqual(hits.slice(-2).map(e => e.wardBlockRemaining), [8, 0]);
});

test('provenance survives save/restore and clears on turn reset; old saves stay valid', () => {
  const c = fight();
  const old = serializeCombatSnapshot(c);
  assert.equal(old.player.wardBlock, undefined);
  assert.deepEqual(combatSnapshotProblems(old), []);
  gainBlock(c, c.player, 8, magic);
  gainBlock(c, c.player, 12);
  const saved = serializeCombatSnapshot(c);
  const restored = restoreCombatSnapshot({ registries, rng: createRng(5), snapshot: saved });
  assert.deepEqual(blockPresentation(restored.player), { defense: 12, ward: 8 });
  dispatch(restored, { type: 'endTurn' });
  assert.deepEqual(blockPresentation(restored.player), { defense: 0, ward: 0 });
  saved.player.wardBlock = 21;
  assert(combatSnapshotProblems(saved).some(p => p.includes('wardBlock')));
});

test('co-op resets each seat and enemy Ward with their Block', () => {
  const c = createCoopCombat({ registries, rng: createRng(5), players: [player('p1'), player('p2')], enemyIds: ['wanderingSoldier'] });
  for (const seat of c.players.values()) gainBlock(c, seat.entity, 100, magic);
  gainBlock(c, c.enemies[0], 8, magic);
  endTurn(c, 'p1'); endTurn(c, 'p2');
  for (const seat of c.players.values()) assert.deepEqual(blockPresentation(seat.entity), { defense: 0, ward: 0 });
  assert.equal(c.enemies[0].wardBlock, 0);
});
