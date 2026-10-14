import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAuditRuntime } from '../tools/combat-audit/runtime.mjs';
import { auditInventory } from '../tools/combat-audit/inventory.mjs';
import { makeAuditCombat, setAuditHand, applyAuditScenario } from '../tools/combat-audit/fixtures.mjs';
for (const mode of ['native', 'bundled']) test(`${mode}: registry inventory and DTO fixtures retain live combat methods`, async () => {
  const api = await loadAuditRuntime(mode);
  const inventory = auditInventory(api.registries);
  assert.deepEqual(inventory.cardIds, api.registries.cards.all().map(c => c.id));
  assert.equal(new Set(inventory.variants.map(v => v.key)).size, inventory.variants.length);
  const { combat: staff } = makeAuditCombat(api, { classId: 'starseer', carrierId: 'ashStaff', instance: { cardId: 'strike', profileId: 'staffMagicAttack' } });
  assert.equal(staff.piles.hand[0].grantedBy, 'ashStaff');
  assert.equal(staff.piles.hand[0].profileReceipt.pieceId, 'ashStaff');
  assert.equal(staff.piles.hand[0].damageSchool, 'magic');
  for (const classId of inventory.classes) {
    const { combat } = makeAuditCombat(api, { classId, instance: { cardId: 'strike' } });
    const emit = combat.emit;
    setAuditHand(combat, [{ cardId: 'strike' }, { cardId: 'defend' }]);
    applyAuditScenario(api, combat, 'wounded');
    assert.equal(combat.emit, emit);
    assert.equal(combat.player.hp, combat.player.maxHp / 2);
    assert.equal(combat.player.mana, 50);
    assert.equal(combat.player.baseResourceMaxima.maxMana, 50);
    assert.equal(combat.piles.hand.length, 2);
    assert.throws(() => applyAuditScenario(api, combat, 'unknown'), /Unknown audit scenario/);
  }
});
