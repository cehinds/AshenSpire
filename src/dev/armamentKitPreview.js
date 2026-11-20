// Disposable preview setup; gameplay still uses the real composer and combat.
import { startingDeckRefs, stampDeck, reconcileRunLoadoutHp } from '../model/loadout.js';

export function configureArmamentKitPreview(registries, run, right, left) {
  if (right && right === left) throw new Error('Choose different armaments for the two hands.');
  for (const [slot, id] of [['rightHand', right], ['leftHand', left]]) {
    if (id && !registries.equipment.armaments.some(p => p.id === id)) throw new Error(`Unknown armament: ${id}`);
    run.loadout.active[slot] = 0;
    run.loadout.sets[slot][0] = id || null;
  }
  run.deck = startingDeckRefs(registries, run.loadout, run.class).map((ref, i) => ({ ...ref, instanceId: `kit-preview:${i}`, upgraded: false }));
  run.equipmentAttackSlotCount = run.deck.filter(c => c.equipmentRole === 'attack').length;
  stampDeck(registries, run);
  return run;
}

// `?shotArmor=<id>`: wear one of the run class's outfits, through the same loadout fields and pool reconcile a real equip uses, so an
// armour's pools and turn grants (Sage's Robe's Ward, 2026-11-19) can be captured without first buying it. An unknown id throws, as above.
export function configureArmourPreview(registries, run, id) {
  if (!registries.equipment.armour.some(o => o.classId === run.class && o.id === id)) throw new Error(`Unknown ${run.class} armour: ${id}`);
  run.loadout.sets.armor = [id];
  run.loadout.active.armor = 0;
  reconcileRunLoadoutHp(registries, run, { adoptEquipmentBonuses: true });
  return run;
}

export function drawArmamentKitPreview(combat) {
  const cards = [...combat.piles.hand, ...combat.piles.draw];
  const kit = cards.filter(c => c.grantedBy);
  if (!kit.length) return;
  combat.piles.hand = kit.slice(0, combat.handMax);
  combat.piles.draw = cards.filter(c => !combat.piles.hand.includes(c));
}
