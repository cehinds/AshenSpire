import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';

function fixture(effects) {
  const registries = createRegistries({ ...contentBundle, cards: contentBundle.cards.map(card => card.id === 'starstonePebble'
    ? { ...card, cost: 0, manaCost: 0, effects, upgrade: undefined } : card) });
  const combat = createCombat({ registries, rng: createRng(3021), combatExpansionVersion: 2,
    enemyIds: [contentBundle.enemies[0].id], player: { classId: 'starseer', maxHp: 100, hp: 100,
      maxMana: 10, mana: 10, maxStamina: 10, stamina: 10, energyMax: 10, drawPerTurn: 1,
      deck: [{ cardId: 'starstonePebble', instanceId: 'conditional', upgraded: false }] } });
  const enemy = combat.enemies[0]; enemy.block = enemy.wardBlock = 0;
  delete enemy.combatCounter; delete enemy.combatEvade; delete enemy.combatStance;
  enemy.persistentWard.value = 0;
  return { combat, enemy };
}
const has = { p: 'hasStatus', of: 'target', status: 'strength' };
function play(f) { return dispatch(f.combat, { type: 'playCard', cardInstanceId: 'conditional', targetId: f.enemy.id }); }

test('committed v2 action includes a live damage branch enabled by its earlier status grant', () => {
  const f = fixture([{ op: 'applyStatus', target: 'enemy', status: 'strength', stacks: 1 },
    { op: 'damage', target: 'enemy', amount: 4, if: has }]);
  const before = f.enemy.hp;
  play(f);
  assert(f.enemy.hp < before, 'later live condition must see the preceding grant');
});

test('committed v2 action includes a live damage branch enabled by its earlier removal', () => {
  const f = fixture([{ op: 'removeStatus', target: 'enemy', status: 'strength', amount: 1 },
    { op: 'damage', target: 'enemy', amount: 4, if: { p: 'not', pred: has } }]);
  f.enemy.statuses.strength = { stacks: 1 };
  const before = f.enemy.hp;
  play(f);
  assert(f.enemy.hp < before, 'later live condition must see the preceding removal');
});

test('beforePlay snapshots continue to read the original state despite an earlier status grant', () => {
  const f = fixture([{ op: 'applyStatus', target: 'enemy', status: 'strength', stacks: 1 },
    { op: 'damage', target: 'enemy', amount: 4, if: { ...has, snapshot: 'beforePlay' } }]);
  const before = f.enemy.hp;
  play(f);
  assert.equal(f.enemy.hp, before);
});
