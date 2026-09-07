import { playerLoadReceipt } from './statProjection.js';

// Shared by cost previews and action resolution. Keep this dependency below
// the combat orchestrator so standalone module loading cannot capture an
// unfinished combat export through the combat -> actions -> combat cycle.
export function playerWeightClass(combat) {
  const registries = combat.registries;
  if (combat.loadout && combat.attributes) {
    const receipt = playerLoadReceipt(registries, {
      loadout: combat.loadout, attributes: combat.attributes, class: combat.player.classId,
      itemUpgradeLevels: combat.itemUpgradeLevels || {},
    });
    return registries.framework.weightClass({
      attributes: combat.attributes,
      weights: { mainHandWeight: receipt.hands, offHandWeight: 0, armorWeight: receipt.armour, otherCountedWeight: 0 },
    });
  }
  return registries.framework.weightClass({
    attributes: { constitution: 10, strength: 10, ...(combat.attributes || {}) },
    weights: { mainHandWeight: 0, offHandWeight: 0, armorWeight: 0, otherCountedWeight: 0 },
  });
}
