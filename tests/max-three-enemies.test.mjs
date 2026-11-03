// Owner (2026-11-03): "Limit to just 3 enemies max" — a combat never has more than 3 enemies.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { validateContent } from '../src/model/validate.js';
import { MAX_ENEMIES_PER_COMBAT, limitEnemyIds, enemySlotFree } from '../src/model/combatLimits.js';
import { createCombat } from '../src/engine/combat.js';
import { rollEncounter } from '../src/engine/encounters.js';
import { createRng } from '../src/engine/rng.js';

const REG = createRegistries(contentBundle);
const player = { classId: 'reaver', maxHp: 100, hp: 100, maxMana: 0, mana: 0, maxStamina: 3, stamina: 3, energyMax: 3, drawPerTurn: 0, deck: [], relicIds: [], flasks: [] };

test('the cap is 3', () => assert.equal(MAX_ENEMIES_PER_COMBAT, 3));

test('no authored encounter lists more than 3 enemies', () => {
  for (const e of contentBundle.encounters) assert.ok(e.enemies.length >= 1 && e.enemies.length <= 3, `${e.id}: ${e.enemies.length}`);
});

test('every rolled encounter (all seats, pools, seeds) opens with at most 3 enemies', () => {
  for (const seat of REG.seats.ids()) for (const pool of ['normal', 'elite', 'boss']) {
    for (let seed = 1; seed <= 40; seed++) {
      let id;
      try { id = rollEncounter(REG, createRng(seed), { pool, seat }); } catch { break; }
      const enc = REG.encounters.get(id);
      const combat = createCombat({ registries: REG, rng: createRng(seed), player, enemyIds: enc.enemies });
      assert.ok(combat.enemies.length <= 3, `${id} seed ${seed}`);
    }
  }
});

test('createCombat trims an over-long list to the first 3', () => {
  const ids = REG.enemies.ids().slice(0, 6);
  const combat = createCombat({ registries: REG, rng: createRng(5), player, enemyIds: ids });
  assert.deepEqual(combat.enemies.map(e => e.enemyId), ids.slice(0, 3));
  assert.deepEqual(limitEnemyIds(ids), ids.slice(0, 3));
});

test('a summon slot is free only below 3 living enemies', () => {
  assert.ok(enemySlotFree(2));
  assert.ok(!enemySlotFree(3));
});

test('the validator rejects an encounter with 4 enemies', () => {
  const enc = structuredClone(contentBundle.encounters[0]);
  enc.enemies = [enc.enemies[0], enc.enemies[0], enc.enemies[0], enc.enemies[0]];
  const encounters = [enc, ...contentBundle.encounters.slice(1)];
  const r = validateContent({ ...contentBundle, encounters });
  assert.ok(!r.ok);
  assert.ok(JSON.stringify(r).includes('at most 3'), 'message names the cap');
});
