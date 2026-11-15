// Spell costs (owner, 2026-11-15, W25-F: "magic is dealing way too much damage so lets make the cost of spells be 1sp higher ... in a prepared stance,
// it reduces sp by 1, and when using anything with the focus tag (all sceptors for instance) it reduces mp cost by 1 ... cantrips cost 0 sp and 0 mp
// when already spell casting with a focus").
//
// One cost rule, applied to a card's final price (so the face, the affordability checks, the bot and the payment all read the same number):
//   every spell                    +manaSurcharge Mana           (cantrips 0 -> 1, a 1 Mana spell -> 2)
//   every spell but a cantrip      +staminaSurcharge Stamina     (a cantrip stays at its own Stamina; an X-cost spell already spends all it has)
//   a spell with the `manaOnlyTag`  pays 0 Stamina               (owner, 2026-11-15: "spells that cost 0 sp but 2 to 3 mp"; its printed Stamina is 0 and it takes no surcharge; Prepared has nothing to cut)
//   the player is in Prepared      -preparedStaminaDiscount Stamina on every spell (cantrips included), never below 0
//   a Focus item is equipped       -focusManaDiscount Mana on every spell, never below 0; one Focus item gives it, a second adds nothing
// "Spell" is the card Mana policy's reading (model/cardManaPolicy.js cardManaCategory: a spell-camp card that is not a Power, status, curse or
// consumable); weapon arts are not spells and keep their price. The numbers are data (content/source/fixCoreMechanics.json `spellCosts`).
// A fight created before the ruling has no `spellCosts` block: SpellCostRules answers null and the old Focus rule (Prepared stance only) stays.
// Headless: no document, window or timers; no RNG.
import { fixCoreEnabled } from '../model/fixCoreMechanics.js';
import { fixCoreRules } from '../model/fixCoreRulesCache.js';
import { cardManaCategory } from '../model/cardManaPolicy.js';
import { FocusHeld, inPreparedStance } from '../model/focusMana.js';

/** The `spellCosts` block this fight plays under, or null (not Core 2, or a fight created before the ruling). */
export function SpellCostRules(ctx) {
  if (!fixCoreEnabled(ctx)) return null;
  const rows = fixCoreRules(ctx)?.spellCosts;
  return rows?.version === 1 ? rows : null;
}

const tagIds = def => (def?.cardTags ?? def?.tags ?? []).map(tag => (typeof tag === 'string' ? tag : tag?.id));

/** IsSpellCard(ctx, def) -> whether the card is a spell under the card Mana policy. */
export function IsSpellForCost(ctx, def) {
  return !!def && cardManaCategory(ctx.registries, def) === 'spell';
}

/** IsManaOnly(rules, def) -> whether the card carries the rule's mana-only tag (no Stamina surcharge); false when the fight's rules name no such tag. */
export function IsManaOnly(rules, def) {
  return !!rules.manaOnlyTag && tagIds(def).includes(rules.manaOnlyTag);
}

/** IsCantrip(rules, def) -> whether the card carries the rule's cantrip tag. */
export function IsCantrip(rules, def) {
  return tagIds(def).includes(rules.cantripTag);
}

/**
 * SpellCostAdjust(ctx, def, price) -> the price { stamina, mana } with the spell cost rule applied (the same object when the rule is off or the card is no spell).
 * `price.stamina` is the card's Stamina as the fight already priced it (stance and relic cuts in), `price.mana` its Mana.
 */
export function SpellCostAdjust(ctx, def, price) {
  const rules = SpellCostRules(ctx);
  if (!rules || !IsSpellForCost(ctx, def)) return price;
  const focus = FocusHeld(ctx.registries, ctx.loadout, ctx.player?.classId);
  const mana = Math.max(0, price.mana + rules.manaSurcharge - (focus ? rules.focusManaDiscount : 0));
  const surcharge = def.cost === 'X' || IsCantrip(rules, def) || IsManaOnly(rules, def) ? 0 : rules.staminaSurcharge;
  const prepared = inPreparedStance(ctx.player) ? rules.preparedStaminaDiscount : 0;
  const stamina = def.cost === 'X' ? price.stamina : Math.max(0, price.stamina + surcharge - prepared);
  return { stamina, mana };
}
