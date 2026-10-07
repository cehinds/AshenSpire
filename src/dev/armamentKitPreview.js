// Disposable preview setup; gameplay still uses the real composer and combat.
import { startingDeckRefs, stampDeck } from '../model/loadout.js';

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

export function drawArmamentKitPreview(combat) {
  const cards = [...combat.piles.hand, ...combat.piles.draw];
  const kit = cards.filter(c => c.grantedBy);
  if (!kit.length) return;
  combat.piles.hand = kit.slice(0, combat.handMax);
  combat.piles.draw = cards.filter(c => !combat.piles.hand.includes(c));
}
