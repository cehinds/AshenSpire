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
// THE BLACKSMITH'S SCREEN SHIPPED at §14.6 step 6 (model/shopKinds.js
// SHOP_KIND_SCREENS), so the non-conditional minimum binds it and its weight
// has a Settings row; it still ships at weight 0, and the owner raises it to
// let a classic merchant be a blacksmith. The atlas smith is always one.
// THE MASTER'S SCREEN SHIPPED at §14.6 step 7 (SPEC §14.5): it also ships at
// weight 0, and the owner raises it to let a classic merchant be a master. An
// atlas `master` point is always one, though no shipped point carries it yet.
import { NOTE } from './balance.js';

const GENERIC_NOTES = Object.freeze({
  enabled: 'Whether this offering can appear at all. Off, it is never rolled and never added by the guarantee.',
  chance: 'The percent chance this offering comes up when a visit rolls. At 100 it always does and nothing is rolled; at 0 it appears only when the guarantee needs it.',
  weight: 'When too few offerings came up, the guarantee adds the missing ones with the highest weight first.',
});

// CONDITIONAL OR NOT (SPEC §14.2). An offering is `conditional` when its pool
// can be empty on a visit — every relic already held, every armament carried,
// every sigil owned — so the visit does not lay it out and the guarantee fills
// from the others. A conditional offering never counts toward the enablement
// minimum: validateContent and Settings keep at least `guaranteedMinimum`
// enabled offerings that are NOT conditional, so the guarantee can always be
// met. Authored here, per offering, and never a Settings row. When in doubt,
// an offering is conditional.
const ALWAYS = 'It always has something to lay out when it comes up, so it counts toward the guaranteed minimum.';
// A NON-CONDITIONAL SHELF STILL NEEDS A STOCK (SPEC §14.2). Its per-visit
// count lives elsewhere (balance.shop, where Advanced → Rewards lists it) and
// can be set to 0; `stockKey` names it, so validation and Settings count the
// offering toward the minimum only while that count is at least 1. An
// offering that names none always counts (a service with nothing to run out).
const STOCK_KEY = 'Where this shelf\'s per-visit stock lives. While that stock is 0 the shelf lays out nothing, so it does not count toward the guaranteed minimum.';
const MAYBE = (why) => `It can have nothing to sell on a visit (${why}); then it is not laid out, and it never counts toward the guaranteed minimum.`;
// A BLACKSMITH SERVICE STAYS ONCE ROLLED (SPEC §14.4, coordinator ruling on
// #1378): whether it can act is judged when it is shown and quoted, so it is
// shown unavailable until the run holds something for it.
const SERVICE = (why) => `It can have nothing to act on (${why}); then it is shown unavailable until you do, and it never counts toward the guaranteed minimum.`;

// One offering: its id, the three rolling keys, whether it is conditional, and
// whatever it sells. `notes` describes every other value it carries.
const offering = (id, { chance = 100, weight, conditional, ...fields }, notes = {}) => ({
  id, enabled: true, chance, weight, conditional, ...fields,
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
      market: 'How likely a merchant on the map is to be the usual market. While the other kinds are at 0, any weight above 0 makes every merchant a market.',
      blacksmith: 'How likely a merchant on the map is to be a blacksmith, which offers the blacksmith\'s services instead of market shelves. At 0 no merchant is one; an atlas smith always is.',
      master: 'How likely a merchant on the map is to be a wise master, who trains, respecs and teaches the skills he knows instead of selling market shelves. At 0 no merchant is one.',
    },
  },

  market: {
    guaranteedMinimum: 2,
    offerings: [
      offering('cards', { weight: 60, conditional: false, stockKey: 'balance.shop.cardStock' }, { conditional: `${ALWAYS} Its pool is the class's cards and the colourless ones, whatever the run owns.`, stockKey: STOCK_KEY }),
      offering('relics', { weight: 30, conditional: true }, { conditional: MAYBE('it never offers a relic you already hold') }),
      offering('flasks', { weight: 40, conditional: false, stockKey: 'balance.shop.flaskStock' }, { conditional: `${ALWAYS} Its pool is every utility flask, whatever the run carries.`, stockKey: STOCK_KEY }),
      offering('armaments', { weight: 30, conditional: true }, { conditional: MAYBE('it never offers an armament you already carry') }),
      offering('weaponArts', { weight: 20, conditional: true }, { conditional: MAYBE('its pool is only the mountable weapon arts the armaments carry') }),
      offering('remove', { weight: 50, conditional: true }, { conditional: MAYBE('it needs a card in your deck that can be removed, and a deck of one card, or of granted cards only, has none') }),
      // THE MARKET ADDITIONS (SPEC §14.3, §14.6 step 5). Each ships at a chance
      // below 100 and a weight below the shelves above, so the shelves stay the
      // visit's certainties and the guarantee still fills from them first. Their
      // stock rolls on `shopOffers` after the offering roll, never on `shop`.
      offering('armour', {
        chance: 35, weight: 20, conditional: true, stock: 2, includeLocked: true,
        cost: {
          min: 300, max: 390,
          [NOTE]: {
            min: 'The least one armour set on the market\'s shelf costs, in cinders.',
            max: 'The most one armour set on the market\'s shelf costs, in cinders. Each set\'s price is rolled between the two.',
          },
        },
      }, {
        stock: 'How many armour sets the market\'s armour shelf holds each visit. Only sets of your class that you do not already own are offered.',
        conditional: MAYBE('only locked sets of your class that the run does not own are sold, and with Include locked off there are none'),
        includeLocked: 'Whether the market sells armour sets of your class that your profile has not unlocked yet. A set bought this way is yours for this run only and does not unlock it. Off, the armour shelf has nothing to sell and is not laid out.',
      }),
      offering('smithStones', { chance: 50, weight: 25, conditional: true, price: 110, perVisit: 2 }, {
        conditional: MAYBE('its per-visit stock can be set to 0'),
        price: 'What one Smithing Stone costs at the market, in cinders.',
        perVisit: 'How many Smithing Stones the market sells each visit.',
      }),
      offering('sigils', { chance: 25, weight: 10, conditional: true, stock: 2, pricePct: 100 }, {
        conditional: MAYBE('it never offers a sigil you already own'),
        stock: 'How many sigils the market\'s sigil shelf holds each visit. It never offers one you already own.',
        pricePct: 'The percent of each sigil\'s authored cost the market charges for it. At 100 it sells at the sigil\'s own price.',
      }),
      offering('innRest', { chance: 30, weight: 15, conditional: true, price: 150 }, {
        conditional: MAYBE('it is certain only in a town with an inn'),
        chance: 'The percent chance a market away from any inn offers a full rest. A market in a town with an inn always offers it while it is enabled.',
        price: 'What a full rest bought at the market costs, in cinders. It rests you exactly as the inn\'s bed does, once per visit.',
      }),
      // STEP 5b (SPEC §14.3): consumables, the quest event and companions. Each
      // item's price and numbers are its own rows (content/consumables.js,
      // content/companions.js); the offering adds only how many it lays out.
      offering('skillBooks', { chance: 30, weight: 12, conditional: true, stock: 2 }, {
        conditional: MAYBE('its per-visit stock can be set to 0'),
        stock: 'How many different skill books the market\'s book shelf holds each visit.',
      }),
      offering('reviveTokens', { chance: 10, weight: 5, conditional: true, stock: 1 }, {
        conditional: MAYBE('its per-visit stock can be set to 0'),
        stock: 'How many different revive tokens the market lays out each visit.',
      }),
      offering('questEvent', { chance: 15, weight: 8, conditional: true, price: 60 }, {
        conditional: MAYBE('it never offers an event you have already seen, and you may have seen them all'),
        price: 'What following the market\'s quest event costs, in cinders. Taking it closes the market behind you.',
      }),
      offering('companions', { chance: 20, weight: 10, conditional: true, stock: 1 }, {
        conditional: MAYBE('it never offers a companion already travelling with you'),
        stock: 'How many different companions the market offers each visit. One of each travels with you at a time.',
      }),
    ],
    [NOTE]: {
      guaranteedMinimum: 'The fewest offerings a market visit lays out. When fewer came up by their chances, the heaviest missing ones are added. At least 2.',
    },
  },

  blacksmith: {
    guaranteedMinimum: 2,
    offerings: [
      offering('armaments', { weight: 40, conditional: true, stock: 5 }, {
        conditional: MAYBE('it never offers an armament you already carry'),
        stock: 'How many armaments the blacksmith\'s shelf holds each visit.',
      }),
      offering('upgrade', { weight: 100, conditional: true }, { conditional: SERVICE('every item you own may already be at its top tier') }),
      offering('smithStones', { weight: 60, conditional: false, stockKey: 'shops.blacksmith.smithStones.perVisit', price: 90, perVisit: 3 }, {
        conditional: `${ALWAYS} It sells stones, whatever the run owns, while its per-visit stock is at least 1.`,
        stockKey: STOCK_KEY,
        price: 'What one Smithing Stone costs at the blacksmith, in cinders.',
        perVisit: 'How many Smithing Stones the blacksmith sells each visit.',
      }),
      offering('refineStones', {
        weight: 30, conditional: false,
        refine: {
          from: 3, value: 4, cinders: 100,
          [NOTE]: {
            from: 'How many ordinary Smithing Stones one refined stone is made from.',
            value: 'How many ordinary stones a refined stone pays toward an upgrade.',
            cinders: 'The cinders refining one stone costs, on top of the stones.',
          },
        },
      }, { conditional: `${ALWAYS} It is a service with a price, not a shelf of goods.` }),
      offering('sigilSlots', {
        weight: 20, conditional: true,
        sigilSlots: {
          base: 0, max: 3, cinders: 300,
          [NOTE]: {
            base: 'How many empty sigil slots every armament has before the blacksmith cuts any. The slots he cuts are added to these.',
            max: 'The most sigil slots one armament can have, its base slots included. The blacksmith cuts none past it.',
            cinders: 'What cutting one sigil slot costs, in cinders.',
          },
        },
      }, { conditional: SERVICE('you may carry no armament, or every one may already have its most slots') }),
      offering('sigils', { weight: 20, conditional: true }, { conditional: SERVICE('it sets only the sigils you carry into empty slots, and takes out only those set, and you may have neither') }),
      offering('extractArt', { weight: 50, conditional: true }, { conditional: SERVICE('it needs an armament with a weapon art to take out') }),
      offering('installArt', { weight: 50, conditional: true }, { conditional: SERVICE('it needs a loose weapon-art card and an open mount to put it in') }),
      offering('upgradeArt', { weight: 30, conditional: true, stones: 2 }, {
        conditional: SERVICE('it needs a loose weapon-art card that is not upgraded yet'),
        stones: 'How many Smithing Stones upgrading one loose weapon-art card costs.',
      }),
      offering('stackCopy', {
        weight: 20, conditional: true,
        stack: {
          stones: 2, cinders: 150, stepPerOwned: 1,
          [NOTE]: {
            stones: 'The Smithing Stones stacking the first extra copy of a card costs.',
            cinders: 'The cinders stacking the first extra copy of a card costs.',
            stepPerOwned: 'How much each of those two prices rises for every copy of the card you own beyond the first.',
          },
        },
      }, { conditional: SERVICE('it needs a loose weapon art or technique you own') }),
    ],
    [NOTE]: {
      guaranteedMinimum: 'The fewest offerings a blacksmith visit lays out. At least 2.',
    },
  },

  master: {
    guaranteedMinimum: 2,
    // A respec pays back this whole percentage of the XP spent above level 1
    // into the training pool (SPEC §14.5). Every reader clamps it to 50–75.
    respecRefundPct: 60,
    offerings: [
      // THE STOCKED SHELVES (SPEC §14.5): each filtered to the visiting
      // master's tracks, rolled on `shopOffers` after the offering roll.
      offering('skillBooks', { weight: 40, conditional: true, stock: 2 }, {
        conditional: MAYBE('no skill book may teach the master\'s skills, or its stock may be 0'),
        stock: 'How many different skill books for the master\'s skills his shelf holds each visit.',
      }),
      offering('weaponArts', { weight: 40, conditional: true, stock: 3 }, {
        conditional: MAYBE('its pool is only the mountable weapon arts of the pieces the master teaches, and its stock may be 0'),
        stock: 'How many weapon arts of the master\'s pieces his shelf holds each visit.',
      }),
      offering('armaments', { weight: 30, conditional: true, stock: 3 }, {
        conditional: MAYBE('it never offers an armament you already carry, and its stock may be 0'),
        stock: 'How many armaments of the master\'s item types his rack holds each visit.',
      }),
      // THE SERVICES (SPEC §14.5): each stays laid out once rolled and is
      // judged live. Training and appraisal can always act: every master
      // teaches three or four tracks.
      offering('training', {
        weight: 100, conditional: false, stockKey: 'shops.master.training.training.perVisit',
        training: {
          cinders: 150, xp: 20, perVisit: 3,
          [NOTE]: {
            cinders: 'What one training session costs, in cinders.',
            xp: 'The skill XP one training session pays.',
            perVisit: 'How many training sessions one master visit sells, whichever skills they train.',
          },
        },
      }, {
        conditional: `${ALWAYS} Every master teaches three or four skills, so there is always one to train while its sessions per visit are at least 1.`,
        stockKey: STOCK_KEY,
      }),
      offering('respec', {
        weight: 60, conditional: true,
        respec: {
          cost: {
            base: 200, perLevel: 50,
            [NOTE]: {
              base: 'The cinders every respec costs before its level surcharge.',
              perLevel: 'The cinders a respec adds for each level the skill had.',
            },
          },
        },
      }, { conditional: SERVICE('none of the master\'s skills may be at level 2 or higher') }),
      offering('lesson', { weight: 50, conditional: true, cinders: 250 }, {
        conditional: SERVICE('every one of the master\'s skills may have taken its lesson this visit, or have nothing to draw'),
        cinders: 'What one lesson (a skill draft for one of the master\'s skills) costs, in cinders.',
      }),
      offering('appraisal', { weight: 30, conditional: false }, { conditional: `${ALWAYS} It is free and shows the master's skills, and every master teaches three or four.` }),
      offering('redistribute', { weight: 30, conditional: true }, { conditional: SERVICE('your training pool may be empty until a respec fills it') }),
    ],
    [NOTE]: {
      guaranteedMinimum: 'The fewest offerings a master visit lays out. At least 2.',
      respecRefundPct: 'The whole percentage of the XP spent above level 1 that a respec pays into the training pool. It is read between 50 and 75.',
    },
  },

  // THE MASTERS (SPEC §14.5). Not a kind and no Settings row: who a master
  // visit can be. A visit picks one on the `shop` stream, in written order.
  // Each teaches 3 or 4 distinct weapon, focus or dual-wield tracks (never an
  // armour track, which has no item type, nor a `class:` track, whose respec
  // would strand the class tree's picks), and speaks as a speakers.csv row.
  masters: [
    { id: 'swordSaint', name: 'The Sword Saint', speakerId: 'swordSaint', skills: ['item:blade', 'item:shield', 'dualWield'] },
    { id: 'starReader', name: 'The Star Reader', speakerId: 'starReader', skills: ['item:magic-focus', 'item:shield', 'item:blade'] },
  ],
};
