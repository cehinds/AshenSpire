// Ruling D16: Vulnerable takes x1.25 in both profiles; previews equal dealt damage.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch, previewCard } from '../src/engine/combat.js';
import { applyStatus, getMult } from '../src/engine/statuses.js';
import { fixCoreRules } from '../src/model/fixCoreMechanics.js';

function fight(core) {
  const registries = createRegistries({ ...contentBundle,
    cards: contentBundle.cards.map(card => card.id === 'twinbladeFlurry'
      ? { ...card, effects: [{ op: 'damage', target: 'enemy', amount: 8, hits: 1 }], textTemplate: 'Deal {damage} damage.' } : card) });
  const actor = { classId: 'reaver', hp: 500, maxHp: 500, mana: 10, maxMana: 10, energyMax: 3, drawPerTurn: 1,
    deck: [{ instanceId: 'flurry', cardId: 'twinbladeFlurry' }], relicIds: [] };
  const combat = createCombat({ registries, rng: createRng(50), enemyIds: ['wanderingSoldier'], ratingsRules: null,
    ...(core ? { combatExpansionVersion: 2 } : {}), player: actor });
  if (core) combat.fixCoreRules = structuredClone(fixCoreRules(combat));
  const enemy = combat.enemies[0];
  enemy.hp = enemy.maxHp = 1000; enemy.block = 0; enemy.poiseMeter = { value: 0, max: 1000 };
  return { combat, enemy };
}
const hpLost = (f, vulnerable) => {
  if (vulnerable) applyStatus(f.combat, f.enemy, 'vulnerable', 1, f.combat.player);
  const before = f.enemy.hp;
  const shown = previewCard(f.combat, 'flurry', f.enemy.id).values.find(v => v.op === 'damage').hitDamages.reduce((a, b) => a + b, 0);
  dispatch(f.combat, { type: 'playCard', cardInstanceId: 'flurry', targetId: f.enemy.id });
  return { shown, dealt: before - f.enemy.hp };
};
for (const core of [false, true]) {
  test(`${core ? 'Core' : 'Current'}: Vulnerable is x1.25 and the preview equals dealt damage`, () => {
    const f = fight(core);
    assert.equal(hpLost(fight(core), false).shown, hpLost(fight(core), false).dealt);
    applyStatus(f.combat, f.enemy, 'vulnerable', 1, f.combat.player);
    assert.equal(getMult(f.combat, f.enemy, 'damageTakenMult'), 1.25);
    const plain = hpLost(fight(core), false), vuln = hpLost(fight(core), true);
    assert.equal(vuln.shown, vuln.dealt);
    assert.ok(vuln.dealt > plain.dealt, 'Vulnerable raises damage');
    assert.equal(vuln.dealt, Math.floor(plain.dealt * 1.25));
  });
}
