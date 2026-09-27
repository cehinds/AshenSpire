// src/content/consumables.js — skill books and revive tokens (SPEC §14.3).
//
// A consumable is carried as a count in `run.consumables` ({ [id]: count }),
// bought at the market and sold back through its Sell pane.
//
//   skillBook  { skill, xp }  read out of combat from the Armoury's Inventory:
//                             one awardSkillXp on its track (§13.4d, the one
//                             writer), then the count drops by one
//   revive     { hpPct }      spent by itself when the player would drop to
//                             0 HP in a fight; HP becomes
//                             max(1, floor(maxHp × hpPct / 100))
//
// EVERY NUMBER HERE IS A DEFAULT. Each carries a [NOTE] — the sentence its
// row shows — and Settings → Advanced → Shops generates a row per number,
// `gameConfig.consumables.<id>.<key>`, frozen into the run's snapshot like
// the Shops rows (model/consumables.js consumableConfigRows). validateContent
// refuses a number with no [NOTE], a fraction, a price below 1 and a
// `sellValue` above `cost` (a sale never beats the price), each by name.
//
// `blurb` may name `{xp}`, `{hpPct}` and `{skill}` (the track's label); the
// shelf fills them from the row's live values, so a tuned number never
// leaves a stale sentence.
import { NOTE } from './balance.js';

const COST = 'What one costs at the market, in cinders.';
const SELL = 'What the market pays you for one. Never above its price, so buying and selling back never profits.';
const XP = 'The skill XP reading this book pays to its track.';

const book = (id, name, skill, { xp, cost, sellValue }) => ({
  id, kind: 'skillBook', name, blurb: 'Read it outside a fight: your {skill} skill gains {xp} XP.', skill, xp, cost, sellValue,
  [NOTE]: { xp: XP, cost: COST, sellValue: SELL },
});

export const consumables = [
  book('bladeManual', 'Blade Manual', 'item:blade', { xp: 40, cost: 180, sellValue: 140 }),
  book('shieldManual', 'Shield Manual', 'item:shield', { xp: 40, cost: 180, sellValue: 140 }),
  book('focusTreatise', 'Focus Treatise', 'item:magic-focus', { xp: 40, cost: 180, sellValue: 140 }),
  book('pairedStepsPrimer', 'Paired Steps Primer', 'dualWield', { xp: 40, cost: 180, sellValue: 140 }),
  {
    id: 'emberToken', kind: 'revive', name: 'Ember Token',
    blurb: 'When you would fall in a fight, it burns instead and you rise with {hpPct}% of your max HP.',
    hpPct: 30, cost: 280, sellValue: 90,
    [NOTE]: {
      hpPct: 'The percent of your max HP a revive token leaves you with when it burns, from 1 to 100.',
      cost: COST, sellValue: SELL,
    },
  },
];
