// src/content/shops.js — the three shop kinds and what each one offers (SPEC §14.2).
//
// A shop has a KIND — `market` (the usual merchant), `blacksmith` or `master`
// — and each kind is a list of OFFERINGS. A visit rolls every enabled
// offering's `chance` once, in the order written here, on the `shopOffers`
// stream; a chance of 100 always comes up and draws nothing, and 0 never comes
// up by the roll. When fewer than `guaranteedMinimum` came up, the missing
// enabled offerings with the highest `weight` are added (ties in written
// order) until the minimum is met, with no further roll. A disabled offering
// never appears, not even through the guarantee.
//
// EVERY NUMBER HERE IS A DEFAULT. Settings → Advanced → Shops generates one row
// per number (model/shopKinds.js `shopConfigRows`), keyed
// `gameConfig.shops.<kind>.<offering>.<key>`, and a run freezes the values it
// began with in `run.advancedConfigSnapshot`. Each number carries a `[NOTE]`
// beside it — the sentence its row shows — and validateContent refuses a
// numeric leaf without one, by name.
//
// THE MARKET'S SHELVES ARE TODAY'S. Their stock counts and prices stay in
// balance.shop, their one home, where Advanced → Rewards already lists them;
// an offering here says only whether that shelf is out on a visit. Every
// shelf ships at chance 100, so a seed's shelves roll exactly what they rolled
// before shop kinds existed, and the `shop` stream is drawn exactly as before.
//
// THE BLACKSMITH AND THE MASTER have no screen yet (steps 6 and 7 of §14.6),
// so `kindWeights` ships them at 0 and validateContent refuses anything else
// until their screen is registered (model/shopKinds.js SHOP_KIND_SCREENS). Their
// offerings and prices are written now so the Settings rows exist and a run
// freezes them; nothing reads them until those screens ship.
import { NOTE } from './balance.js';

const GENERIC_NOTES = Object.freeze({
  enabled: 'Whether this offering can appear at all. Off, it is never rolled and never added by the guarantee.',
  chance: 'The percent chance this offering comes up when a visit rolls. At 100 it always does and nothing is rolled; at 0 it appears only when the guarantee needs it.',
  weight: 'When too few offerings came up, the guarantee adds the missing ones with the highest weight first.',
});

// One offering: its id, the three rolling keys, and whatever it sells. `notes`
// describes every other number it carries.
const offering = (id, { chance = 100, weight, ...fields }, notes = {}) => ({
  id, enabled: true, chance, weight, ...fields,
  [NOTE]: { ...GENERIC_NOTES, ...notes },
});

export const shops = {
  // Which kind a classic merchant node turns out to be, rolled on `shopOffers`
  // only when more than one kind has a weight above 0.
  kindWeights: {
    market: 100,
    blacksmith: 0,
    master: 0,
    [NOTE]: {
      market: 'How likely a merchant on the map is to be the usual market. It is the only kind open so far, so any weight above 0 makes every merchant a market.',
      blacksmith: 'How likely a merchant on the map is to be a blacksmith. Locked at 0 until the blacksmith screen ships.',
      master: 'How likely a merchant on the map is to be a wise master. Locked at 0 until the master screen ships.',
    },
  },

  market: {
    guaranteedMinimum: 2,
    offerings: [
      offering('cards', { weight: 60 }),
      offering('relics', { weight: 30 }),
      offering('flasks', { weight: 40 }),
      offering('armaments', { weight: 30 }),
      offering('weaponArts', { weight: 20 }),
      offering('remove', { weight: 50 }),
      // THE MARKET ADDITIONS (SPEC §14.3, §14.6 step 5). Each ships at a chance
      // below 100 and a weight below the shelves above, so the shelves stay the
      // visit's certainties and the guarantee still fills from them first. Their
      // stock rolls on `shopOffers` after the offering roll, never on `shop`.
      offering('armour', {
        chance: 35, weight: 20, stock: 2, includeLocked: true,
        cost: {
          min: 300, max: 390,
          [NOTE]: {
            min: 'The least one armour set on the market\'s shelf costs, in cinders.',
            max: 'The most one armour set on the market\'s shelf costs, in cinders. Each set\'s price is rolled between the two.',
          },
        },
      }, {
        stock: 'How many armour sets the market\'s armour shelf holds each visit. Only sets of your class that you do not already own are offered.',
        includeLocked: 'Whether the market sells armour sets of your class that your profile has not unlocked yet. A set bought this way is yours for this run only and does not unlock it. Off, the armour shelf has nothing to sell and is not laid out.',
      }),
      offering('smithStones', { chance: 50, weight: 25, price: 110, perVisit: 2 }, {
        price: 'What one Smithing Stone costs at the market, in cinders.',
        perVisit: 'How many Smithing Stones the market sells each visit.',
      }),
      offering('sigils', { chance: 25, weight: 10, stock: 2, pricePct: 100 }, {
        stock: 'How many sigils the market\'s sigil shelf holds each visit. It never offers one you already own.',
        pricePct: 'The percent of each sigil\'s authored cost the market charges for it. At 100 it sells at the sigil\'s own price.',
      }),
      offering('innRest', { chance: 30, weight: 15, price: 150 }, {
        chance: 'The percent chance a market away from any inn offers a full rest. A market in a town with an inn always offers it while it is enabled.',
        price: 'What a full rest bought at the market costs, in cinders. It rests you exactly as the inn\'s bed does, once per visit.',
      }),
    ],
    [NOTE]: {
      guaranteedMinimum: 'The fewest offerings a market visit lays out. When fewer came up by their chances, the heaviest missing ones are added. At least 2.',
    },
  },

  blacksmith: {
    guaranteedMinimum: 2,
    offerings: [
      offering('armaments', { weight: 40, stock: 5 }, {
        stock: 'How many armaments the blacksmith\'s shelf holds each visit.',
      }),
      offering('upgrade', { weight: 100 }),
      offering('smithStones', { weight: 60, price: 90, perVisit: 3 }, {
        price: 'What one Smithing Stone costs at the blacksmith, in cinders.',
        perVisit: 'How many Smithing Stones the blacksmith sells each visit.',
      }),
      offering('refineStones', {
        weight: 30,
        refine: {
          from: 3, value: 4, cinders: 100,
          [NOTE]: {
            from: 'How many ordinary Smithing Stones one refined stone is made from.',
            value: 'How many ordinary stones a refined stone pays toward an upgrade.',
            cinders: 'The cinders refining one stone costs, on top of the stones.',
          },
        },
      }),
      offering('sigilSlots', {
        weight: 20,
        sigilSlots: {
          max: 3, cinders: 300,
          [NOTE]: {
            max: 'The most sigil slots the blacksmith will cut into one armament.',
            cinders: 'What cutting one sigil slot costs, in cinders.',
          },
        },
      }),
      offering('sigils', { weight: 20 }),
      offering('extractArt', { weight: 50 }),
      offering('installArt', { weight: 50 }),
      offering('upgradeArt', { weight: 30, stones: 2 }, {
        stones: 'How many Smithing Stones upgrading one loose weapon-art card costs.',
      }),
      offering('stackCopy', {
        weight: 20,
        stack: {
          stones: 2, cinders: 150, stepPerOwned: 1,
          [NOTE]: {
            stones: 'The Smithing Stones stacking the first extra copy of a card costs.',
            cinders: 'The cinders stacking the first extra copy of a card costs.',
            stepPerOwned: 'How much each of those two prices rises for every copy of the card already owned.',
          },
        },
      }),
    ],
    [NOTE]: {
      guaranteedMinimum: 'The fewest offerings a blacksmith visit lays out. At least 2.',
    },
  },

  master: {
    guaranteedMinimum: 2,
    // A respec pays back this whole percentage of the XP spent above level 1
    // into the training pool (SPEC §14.5); Settings clamps it to 50–75.
    respecRefundPct: 60,
    offerings: [
      offering('skillBooks', { weight: 40 }),
      offering('weaponArts', { weight: 40 }),
      offering('armaments', { weight: 30 }),
      offering('training', {
        weight: 100,
        training: {
          cinders: 150, xp: 20, perVisit: 3,
          [NOTE]: {
            cinders: 'What one training session costs, in cinders.',
            xp: 'The skill XP one training session pays.',
            perVisit: 'How many training sessions one master visit sells.',
          },
        },
      }),
      offering('respec', {
        weight: 60,
        respec: {
          cost: {
            base: 200, perLevel: 50,
            [NOTE]: {
              base: 'The cinders every respec costs before its level surcharge.',
              perLevel: 'The cinders a respec adds for each level the track had.',
            },
          },
        },
      }),
      offering('lesson', { weight: 50, cinders: 250 }, {
        cinders: 'What one lesson (a skill draft for one of the master\'s tracks) costs, in cinders.',
      }),
      offering('appraisal', { weight: 30 }),
      offering('redistribute', { weight: 30 }),
    ],
    [NOTE]: {
      guaranteedMinimum: 'The fewest offerings a master visit lays out. At least 2.',
      respecRefundPct: 'The whole percentage of the XP spent above level 1 that a respec pays into the training pool, from 50 to 75.',
    },
  },
};
