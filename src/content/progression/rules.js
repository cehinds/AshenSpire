import { progressionGearRequirements } from './gear.js';
// Approved progression cadence. Independent content modules contribute rows,
// rather than keeping parallel class pools or reward tables.
export const progressionRules = {
  version: 1,
  gearRequirements: progressionGearRequirements,
  cadence: { cards: [2,4,6,8,10,12,14,16,18,20], feat: [1,4,8,12,16,20], armory: [3,6,9,12,15,18], relic: [5,8,11,14,17,20], attribute: [5,10,15,20] },
  skillBonusXp: 25,
  ability: { base: 100, growthPerLevel: 50, maxLevel: 10, ranksAt: [1,2,4,6,8,10], xp: { magical: 2, spell: 3, manaSpell: 1, technique: 2, maneuver: 5 }, draftSize: 3, intelligenceChance: 0.05, bonusRankDepth: 3 },
  classSkills: { reaver: ['combatManeuvers','item:blade','item:shield','armour:heavy'], starseer: ['item:magic-focus','item:blade','armour:light','armour:medium'], rogue: ['combatManeuvers','item:blade','dualWield','armour:light'], herald: ['item:magic-focus','item:blade','item:shield','armour:medium'] },
  classAttributes: { reaver: ['strength','constitution','dexterity'], starseer: ['intelligence','wisdom','dexterity'], rogue: ['dexterity','strength','wisdom'], herald: ['wisdom','constitution','intelligence'] },
  lessons: { 'item:magic-focus': ['cometFragment','crystalBarrier','scholarsInsight','ashenMote','emberVigil','readTheAsh','cinderSigil','starstoneArc','blightTouch','penance'], combatManeuvers: ['crimsonCleave','shieldBash','quickstep','guardCounter','riposte','rend','quickCut','backstep','stomp','lowBlow'] },
  respec: { enabled: false, cost: null },
};
