// Elemental flux (owner, 2026-11-15, W25-F: "for spell casters, they get two stance icons, the prepared stance and the elemental stance they are using, and the
// elemental stance adds a floor(1.25x) bonus to the effectiveness of the next card played of that element ... non elemental spells will just use the magic icon,
// but doesn't get the additional 1.25x, just the standard stance bonus"; options answer: "chains while same element").
//
// The player holds one flux: an element, or none.
//   a spell with an element (fire, lightning, frost, divine, necrotic, force; read by ElementOfHit, the reader the element rules use) sets flux to it
//   a spell with no element CLEARS the flux (it gets only Prepared's bonus); a card that is no spell leaves it alone
//   while flux is X, every card of element X played gets its effect numbers (damage, Block, healing, status stacks) times `elementFlux.multiplier`,
//   each floored after the multiply, and the flux stays (so Fire, Fire, Fire is three fluxed casts after the first)
//   the flux ends at the end of the player's turn and when the fight ends; a card played on the enemy phase (a Reaction) neither reads nor changes it
// The state is `player.elementFlux` (a plain string, saved with the fight). The first cast of a chain sets the flux AFTER its own effects resolve, so it is
// never lifted by the flux it creates. The multiplier is data (content/source/fixCoreMechanics.json `elementFlux`); a fight created before the ruling has no block,
// ElementFluxRules answers null and every function here does nothing. Headless: no document, window or timers; no RNG.
import { fixCoreEnabled } from '../model/fixCoreMechanics.js';
import { fixCoreRules } from '../model/fixCoreRulesCache.js';
import { ElementOfHit } from '../model/elementIdentityRules.js';
import { IsSpellForCost } from './spellCosts.js';

/** The `elementFlux` block this fight plays under, or null (not Core 2, or a fight created before the ruling). */
export function ElementFluxRules(ctx) {
  if (!fixCoreEnabled(ctx)) return null;
  const rows = fixCoreRules(ctx)?.elementFlux;
  return rows?.version === 1 ? rows : null;
}

/** FluxElement(ctx, entity) -> the element the player's flux holds, or null. */
export function FluxElement(ctx, entity) {
  return entity?.kind === 'player' && ElementFluxRules(ctx) ? entity.elementFlux || null : null;
}

const isCardPlay = carrier => !!(carrier?.cardId || carrier?.instanceId);
const isReturn = carrier => !!(carrier?.counterReturnAttack || carrier?.reflectedHit);

/** FluxMultiplier(ctx, source, carrier) -> the multiplier of a card's effect numbers: the rule's while the flux is the card's own element, else 1. */
export function FluxMultiplier(ctx, source, carrier) {
  const rules = ElementFluxRules(ctx);
  if (!rules || ctx?.phase === 'enemy' || !isCardPlay(carrier) || isReturn(carrier)) return 1;
  const flux = FluxElement(ctx, source);
  return flux && ElementOfHit(carrier) === flux ? rules.multiplier : 1;
}

/** FluxScale(ctx, source, carrier, value) -> `value` times the flux multiplier, floored (the value itself when no flux applies). */
export function FluxScale(ctx, source, carrier, value) {
  const multiplier = FluxMultiplier(ctx, source, carrier);
  return multiplier === 1 ? value : Math.floor(value * multiplier);
}

/**
 * FluxAfterPlay(ctx, player, carrier, def) -> sets, replaces or clears the flux once a card's effects have resolved. A spell of an element sets it, a spell
 * without one clears it, anything else leaves it. Nothing happens on the enemy phase or without the rule.
 */
export function FluxAfterPlay(ctx, player, carrier, def) {
  if (!ElementFluxRules(ctx) || ctx?.phase === 'enemy' || player?.kind !== 'player' || !IsSpellForCost(ctx, def)) return;
  SetFlux(ctx, player, ElementOfHit(carrier));
}

/** ClearFlux(ctx, player) -> the end of the player's turn, or of the fight. */
export function ClearFlux(ctx, player) {
  SetFlux(ctx, player, null);
}

// The one writer: a change is announced (the HUD's second stance icon follows it beat by beat); no change says nothing.
function SetFlux(ctx, player, element) {
  if (!player || (player.elementFlux || null) === element) return;
  if (element) player.elementFlux = element; else delete player.elementFlux;
  ctx?.emit?.('elementFluxChanged', { targetId: player.id, element });
}
