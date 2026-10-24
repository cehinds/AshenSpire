// src/content/consumables.js — skill books and revive tokens (SPEC §14.3).
//
// IN JSON: the hand-authored rows, content/source/consumableBooks.json (the
// books) and consumableTokens.json (the revive tokens), notes included as
// "$note" keys. Design notes: content/source/CONTENT-NOTES.md, "Consumables".
//
// STILL JS, ON PURPOSE: the per-class books. There is one for every class,
// derived from `classes` (id, name, blurbs), so a new class gets its book
// without anyone authoring one; hand-writing them as data would lose that.
// Row order is books, class books, tokens.
import { NOTE } from './balance.js';
import { classes } from './classes.js';
import { consumableBooks } from './generated/consumableBooks.js';
import { consumableTokens } from './generated/consumableTokens.js';

const COST = 'What one costs at the market, in cinders.';
const SELL = 'What the market pays you for one. Never above its price, so buying and selling back never profits.';
const XP = 'The skill XP reading this book pays to its track.';

const book = (id, name, skill, { xp, cost, sellValue }) => ({
  id, kind: 'skillBook', name, blurb: 'Gain {xp} {skill} XP and choose one matching skill card, including skills from other classes.', skill, xp, cost, sellValue,
  [NOTE]: { xp: XP, cost: COST, sellValue: SELL },
});

export const consumables = [
  ...consumableBooks,
  ...classes.map((cls) => ({
    ...book(`${cls.id}ClassBook`, `${cls.name} Class Book`, `class:${cls.id}`, { xp: 40, cost: 180, sellValue: 140 }),
    learnClass: cls.id, combatCardChance: 25, featChance: 5,
    blurb: `Gain {xp} ${cls.name} XP and learn its class card if new. Each reading has a {combatCardChance}% combat-card chance and an independent {featChance}% feat chance.`,
    masteryBlurb: `Learn the ${cls.name} class card if new. Each reading has a {combatCardChance}% combat-card chance and an independent {featChance}% feat chance. Class mastery advances through fights and quests.`,
    [NOTE]: { xp: XP, cost: COST, sellValue: SELL,
      combatCardChance: 'Percent chance that reading this class book grants one combat card from its class pool. Independent of the feat roll; 0 disables and 100 guarantees a card when the pool is available.',
      featChance: 'Percent chance that reading this class book grants one feat. Independent of the combat-card roll; 0 disables and 100 guarantees a feat.' },
  })),
  ...consumableTokens,
];
