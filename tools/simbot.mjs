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
import { chargeFlaskId } from '../src/model/gracerefill.js';

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

// ---- the turn-end decision, shared ------------------------------------------
// Nothing in hand is affordable. Before the turn ends, a player with an Azure
// (Mana) charge left drinks it when that would pay for a card short ONLY on
// Mana. runsim and measure-classes both ask this one function, so the copied
// bot cannot keep ending the turn where runsim drinks (PR #1473 review).

/**
 * Whether drinking the run's Mana charges would pay for a card in hand that is
 * short ONLY on Mana: playable, Actions and Stamina in hand, its Mana price
 * within the pool's maximum and within what the charges left can restore.
 */
export function manaChargeWouldPay(registries, combat, refused = new Set()) {
  const p = combat.player;
  const charges = (p.flaskCharges && p.flaskCharges.manaCurrent) || 0;
  if (charges <= 0) return false;
  const def = registries.flasks.get(chargeFlaskId(registries, 'mana'));
  const per = ((def && def.effects) || []).filter((e) => e.op === 'restoreMana').reduce((n, e) => n + (Number(e.amount) || 0), 0);
  if (per <= 0) return false;
  return affordableCards(registries, { ...combat, player: { ...p, mana: Infinity } }, refused).some((h) => {
    const need = cardPlayCosts(combat, h.instanceId).mana || 0;
    return need > p.mana && need <= (p.maxMana ?? need) && need <= p.mana + charges * per;
  });
}

/**
 * What the bot does when no card in hand is affordable: the Mana-charge action
 * to try first, or null to end the turn. A refused charge also ends the turn.
 */
export function outOfPlaysAction(registries, combat, refused = new Set()) {
  return manaChargeWouldPay(registries, combat, refused) ? { type: 'useFlask', chargeKind: 'mana' } : null;
}

// ---- the decision digest ----------------------------------------------------
// Every action a bot's fight loop dispatches successfully, per fight: a
// fingerprint of the state the fight opened on (the run's RNG counters, the
// player's pools, charges and flasks, the hand and draw pile in order, the
// enemies), then the count and an FNV-1a hash of the actions in order. runsim
// prints it under --digest and measure-classes --check compares it: two bots
// handed the same fight must make the same decisions, not merely reach the
// same win count. Fights that opened on different state (the two run loops
// differ between fights) are counted apart, never compared.

const DIGEST_KEYS = ['type', 'cardInstanceId', 'targetId', 'choice', 'chargeKind', 'slot'];
const FNV0 = 0x811c9dc5;
function fnv(h, text) {
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
const hex = (h) => (h >>> 0).toString(16).padStart(8, '0');

/** The state a fight opens on, as one hash: equal hashes mean the same fight. */
export function fightFingerprint(combat, rng) {
  const p = combat.player;
  const cards = (pile) => (pile || []).map((h) => `${h.cardId}${h.upgraded ? '+' : ''}`).join(',');
  return hex(fnv(FNV0, JSON.stringify({
    rng: rng && rng.getCounters ? rng.getCounters() : null,
    p: [p.classId, p.hp, p.maxHp, p.mana, p.maxMana, p.stamina, p.maxStamina, p.energy],
    charges: p.flaskCharges || null,
    flasks: (p.flasks || []).map((f) => f.flaskId),
    hand: cards(combat.piles.hand), draw: cards(combat.piles.draw),
    enemies: combat.enemies.map((e) => [e.id, e.enemyId, e.hp, e.maxHp, e.damageMult]),
  })));
}

export function createDecisionDigest() {
  const fights = [];
  const perRun = new Map();
  let current = null;
  return {
    /** Open a fight: classId, the run seed, and fightFingerprint(...). */
    beginFight(classId, seed, start) {
      const runKey = `${classId}:${seed >>> 0}`;
      const idx = (perRun.get(runKey) || 0) + 1;
      perRun.set(runKey, idx);
      current = { classId, seed: seed >>> 0, idx, start, actions: 0, h: FNV0 };
      fights.push(current);
    },
    record(action) {
      if (!current) return;
      current.h = fnv(current.h, DIGEST_KEYS.map((k) => (action[k] === undefined ? '' : String(action[k]))).join('|') + ';');
      current.actions++;
    },
    /** The fights of one class, as printable rows. */
    fightsOf(classId) {
      return fights.filter((f) => f.classId === classId)
        .map((f) => ({ key: `${f.seed}#${f.idx}`, start: f.start, actions: f.actions, hash: hex(f.h) }));
    },
    reset() { fights.length = 0; perRun.clear(); current = null; },
  };
}

/** The --digest line for one fight, as runsim prints it and measure-classes parses it. */
export const digestLine = (className, f) => `  digest ${className} ${f.key} start ${f.start} actions ${f.actions} hash ${f.hash}`;
export const DIGEST_LINE = /^ {2}digest (.+?) (\d+#\d+) start ([0-9a-f]{8}) actions (\d+) hash ([0-9a-f]{8})$/;
