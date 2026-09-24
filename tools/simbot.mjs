// tools/simbot.mjs — what the simulator bots may play, asked of the engine.
//
// Every headless bot (runsim, balance, measure-classes) chooses from the same
// list: the cards in hand, in hand order, that are playable and affordable in
// EVERY pool the engine charges — Actions, Mana and Stamina, priced by
// cardPlayCosts, the function doPlayCard itself pays with. The bots used to
// check Actions and Mana only, so a card the player could not afford for
// Stamina was "chosen", thrown out by the engine, and the throw ended the
// whole turn with the rest of the hand unplayed.
//
// A card the engine still refuses (a foundation rule, a target it will not
// take) goes in the turn's `refused` set; the bot moves on to the next card
// instead of ending its turn. refusalsFor(combat) hands out that set and
// clears it when a new player turn begins.

import { resolveCard } from '../src/model/registries.js';
import { cardPlayCosts } from '../src/engine/combat.js';

/** The hand's playable, affordable cards, in hand order, minus this turn's refusals. */
export function affordableCards(registries, combat, refused = new Set()) {
  const p = combat.player;
  return combat.piles.hand.filter((h) => {
    if (refused.has(h.instanceId)) return false;
    const def = resolveCard(registries, { cardId: h.cardId, upgraded: h.upgraded });
    if ((def.keywords || []).includes('unplayable')) return false;
    const cost = cardPlayCosts(combat, h.instanceId);
    return cost.energy <= p.energy && cost.mana <= p.mana && cost.stamina <= p.stamina;
  });
}

/** A per-combat refusal set that empties itself at each new player turn. */
export function refusalsFor(combat) {
  const state = refusalsFor.memo.get(combat);
  if (state && state.turn === combat.turn) return state.refused;
  const fresh = { turn: combat.turn, refused: new Set() };
  refusalsFor.memo.set(combat, fresh);
  return fresh.refused;
}
refusalsFor.memo = new WeakMap();
