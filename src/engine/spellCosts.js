// Spell costs (owner, 2026-11-15, W25-F: "magic is dealing way too much damage so lets make the cost of spells be 1sp higher ... in a prepared stance,
// it reduces sp by 1, and when using anything with the focus tag (all sceptors for instance) it reduces mp cost by 1 ... cantrips cost 0 sp and 0 mp
// when already spell casting with a focus").
//
// One cost rule, applied to a card's final price (so the face, the affordability checks, the bot and the payment all read the same number):
//   every spell                    +manaSurcharge Mana           (0 since owner 2026-11-26; it was 1 from 2026-11-15)
//   every spell but a cantrip      +staminaSurcharge Stamina     (0 since owner 2026-11-23; a cantrip stays at its own Stamina; an X-cost spell already spends all it has)
//   a spell with the `manaOnlyTag`  pays 0 Stamina               (owner, 2026-11-15: "spells that cost 0 sp but 2 to 3 mp"; its printed Stamina is 0 and it takes no surcharge; Prepared has nothing to cut)
//   the player is in Prepared      -preparedStaminaDiscount Stamina on every spell (cantrips included), never below preparedStaminaMinimum (owner 2026-11-26: 1)
//                                  and never raising a price already at or under it; -preparedManaDiscount Mana (owner 2026-11-26: 1), floored at 0
// Owner, 2026-11-26 (Star Seer hotfix): manaSurcharge is 0 so the printed Mana (creation, deck, reward faces) is the Mana combat charges.
//   a Focus item is equipped       old saved profiles: -focusManaDiscount Mana in any stance; current gear: its data rule applies only in Prepared
//   current gear Mana modifiers    apply after the surcharge, once, with only the final result floored at 0
// "Spell" is the card Mana policy's reading (model/cardManaPolicy.js cardManaCategory: a spell-camp card that is not a Power, status, curse or
// consumable); weapon arts are not spells and keep their price. The numbers are data (content/source/fixCoreMechanics.json `spellCosts`).
// A fight created before the ruling has no `spellCosts` block: SpellCostRules answers null and the old Focus rule (Prepared stance only) stays.
// Headless: no document, window or timers; no RNG.
import { fixCoreEnabled } from '../model/fixCoreMechanics.js';
import { fixCoreRules } from '../model/fixCoreRulesCache.js';
import { cardManaCategory } from '../model/cardManaPolicy.js';
import { GearTypeEffectsEnabled, GearManaCost } from '../model/gearEffects.js';
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
 * PreparedStamina(rules, stamina, inPrepared) -> the Stamina after the Prepared cut.
 * Owner, 2026-11-26: Prepared is max(SP - 1, preparedStaminaMinimum) and never raises a price already at or under that floor
 * (a 0 SP or 1 SP spell keeps its SP). A fight saved without preparedStaminaMinimum keeps the old floor of 0.
 */
export function PreparedStamina(rules, stamina, inPrepared) {
  const base = Math.max(0, stamina);
  if (!inPrepared) return base;
  const floor = rules.preparedStaminaMinimum ?? 0;
  if (base <= floor) return base;
  return Math.max(floor, base - rules.preparedStaminaDiscount);
}

/**
 * SpellCostAdjust(ctx, def, price) -> the price { stamina, mana } with the spell cost rule applied (the same object when the rule is off or the card is no spell).
 * `price.stamina` is the card's Stamina as the fight already priced it (stance and relic cuts in), `price.mana` its Mana.
 */
export function SpellCostAdjust(ctx, def, price) {
  const rules = SpellCostRules(ctx);
  if (!rules || !IsSpellForCost(ctx, def)) return { ...price, mana: GearManaCost(def, price.mana) };
  // Gear-pass Focus is the Prepared-only data rule, applied at the same final door as other gear Mana changes.
  const focus = !GearTypeEffectsEnabled(ctx) && FocusHeld(ctx.registries, ctx.loadout, ctx.player?.classId);
  const inPrepared = inPreparedStance(ctx.player);
  // Owner, 2026-11-26: Prepared takes preparedManaDiscount Mana off a spell, floored at 0 (absent in fights saved before the ruling).
  const preparedMana = inPrepared ? (rules.preparedManaDiscount ?? 0) : 0;
  const mana = GearManaCost(def, price.mana + rules.manaSurcharge - preparedMana - (focus ? rules.focusManaDiscount : 0));
  const surcharge = def.cost === 'X' || IsCantrip(rules, def) || IsManaOnly(rules, def) ? 0 : rules.staminaSurcharge;
  const stamina = def.cost === 'X' ? price.stamina : PreparedStamina(rules, price.stamina + surcharge, inPrepared);
  return { stamina, mana };
}
