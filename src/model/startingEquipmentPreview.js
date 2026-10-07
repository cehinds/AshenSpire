import { equipmentRoleSource, startingDeckRefs, stampDeck } from './loadout.js';

/** A disposable candidate using the same composition and stamping as run creation. */
export function startingEquipmentPreview(registries, baseRun, hands, slot) {
  const run = structuredClone(baseRun);
  for (const hand of ['leftHand', 'rightHand']) {
    run.loadout.sets[hand][run.loadout.active[hand] || 0] = hands[hand] || null;
  }
  run.deck = startingDeckRefs(registries, run.loadout, run.class)
    .map((ref, index) => ({ ...ref, upgraded: false, instanceId: `creation-preview:${index}` }));
  run.equipmentAttackSlotCount = run.deck.filter(ref => ref.equipmentRole === 'attack').length;
  stampDeck(registries, run, null, { reconcileEquipmentPools: false });
  const itemId = hands[slot] || null;
  const hand = slot === 'leftHand' ? 'left' : 'right';
  const groups = new Map();
  for (const ref of run.deck) {
    let belongs = false;
    if (ref.grantedBy) belongs = itemId ? ref.grantedBy === itemId : ref.grantedBy === `unarmed:${hand}`;
    else if (ref.equipmentRole === 'attack') belongs = itemId ? ref.weaponId === itemId : !ref.weaponId;
    else if (ref.equipmentRole) {
      const source = equipmentRoleSource(registries, run.loadout, run.class, ref.equipmentRole);
      belongs = itemId ? source.piece?.id === itemId : !source.piece;
    }
    if (!belongs) continue;
    const key = [ref.cardId, ref.profileId, ref.equipmentRole, ref.sourceArmamentId, ref.upgraded].join(':');
    const group = groups.get(key) || { ref, count: 0 };
    group.count++; groups.set(key, group);
  }
  return { cards: [...groups.values()], total: [...groups.values()].reduce((sum, row) => sum + row.count, 0) };
}
