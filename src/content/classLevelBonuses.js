// src/content/classLevelBonuses.js — the class bonus a Core character earns at
// every odd character level (owner, 2026-11-17, playtest item 24), as data.
//
// From `fromLevel`, every odd level grants `amount` to the class's signature
// attribute. model/classLevelBonus.js reads it; nothing else may spell these.
export const classLevelBonuses = Object.freeze({
  fromLevel: 3,
  amount: 1,
  attributeByClass: Object.freeze({
    reaver: 'strength',
    rogue: 'dexterity',
    starseer: 'intelligence',
    herald: 'wisdom',
  }),
});
