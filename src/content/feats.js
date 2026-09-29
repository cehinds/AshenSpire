// Permanent, repeatable character-level choices. Values are intentionally
// small because a long run may select the same feat more than once.
export const feats = Object.freeze([
  { id: 'fieldStudy', name: 'Field Study', description: 'Gain 10% more character XP from combat.', bonus: 'characterXp' },
  { id: 'weaponDrill', name: 'Weapon Drill', description: 'Gain 10% more weapon, focus and dual-wield XP from combat.', bonus: 'weaponXp' },
  { id: 'armourPractice', name: 'Armour Practice', description: 'Gain 10% more armour XP from combat.', bonus: 'armourXp' },
  { id: 'classInsight', name: 'Class Insight', description: 'Gain 10% more class XP from combat.', bonus: 'classXp' },
  { id: 'spoilsInstinct', name: 'Spoils Instinct', description: 'Gain 10% more Cinders from won fights.', bonus: 'cinders' },
  { id: 'vitalRenewal', name: 'Vital Renewal', description: 'Recover 5 HP after each victory.', bonus: 'victoryHeal' },
]);
