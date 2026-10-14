import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { effectiveEvasion } from '../src/engine/stanceHit.js';

const registries = createRegistries({ ...contentBundle,
  enemies: contentBundle.enemies.map(enemy => enemy.id === 'wanderingSoldier' ? { ...enemy, evasion: 11 } : enemy) });
const screen = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
const start = screen.indexOf('  function snapEnt('), end = screen.indexOf('  function takeSnapshot(', start);
assert.ok(start > 0 && end > start);
const displayedCall = screen.match(/\? (effectiveEvasion\(combat, v[^\n]*?\)) : null/)[1];

test('paced HUD uses canonical plated armour, buckler, attributes and enemy definition with beat-local Evasion', () => {
  const slots = registries.equipment.slots;
  const armour = slots.find(slot => slot.kinds.includes('armor'));
  const shield = slots.find(slot => slot.kinds.includes('shield'));
  const loadout = { sets: Object.fromEntries(slots.map(slot => [slot.id, [null]])), active: {} };
  loadout.sets[armour.id] = ['default']; loadout.sets[shield.id] = ['buckler'];
  const combat = createCombat({ registries, rng: createRng(801), combatExpansionVersion: 2,
    enemyIds: ['wanderingSoldier'], player: { classId: 'reaver', hp: 100, maxHp: 100,
      mana: 20, maxMana: 20, stamina: 20, maxStamina: 20, energyMax: 20, drawPerTurn: 0, deck: [], loadout,
      attributes: { dexterity: 20, wisdom: 10, intelligence: 10, strength: 10, constitution: 10 } } });
  const snapshot = vm.runInNewContext(`(() => { ${screen.slice(start, end)} return snapEnt; })()`, {
    combat, structuredClone, previewIntent: () => null, enemyStanceCategory: () => null,
  });
  for (const entity of [combat.player, combat.enemies[0]]) {
    entity.statuses.evade = { stacks: 1 };
    const v = snapshot(entity, true), expected = effectiveEvasion(combat, entity);
    entity.statuses.evade.stacks = 3;
    const shown = () => vm.runInNewContext(displayedCall, { combat, entity, v, effectiveEvasion });
    assert.equal(shown(), expected, 'the live rule matches the earlier paced beat');
    assert.equal(effectiveEvasion(combat, entity), expected + 6, 'later live stacks do not leak into the beat');
    v.statuses.evade.stacks = 2;
    assert.equal(shown(), expected + 3, 'the displayed value changes with the next beat');
  }
  const v = snapshot(combat.player, true);
  const withShield = vm.runInNewContext(displayedCall, { combat, entity: combat.player, v, effectiveEvasion });
  loadout.sets[shield.id] = [null];
  const withoutShield = vm.runInNewContext(displayedCall, { combat, entity: combat.player, v, effectiveEvasion });
  assert.notEqual(withShield, withoutShield, 'the actor context includes the active buckler');
});
