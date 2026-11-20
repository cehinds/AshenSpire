// src/model/loadout/swapCost.js — what a swap costs: one chain, three rules, all of it data.
// A part of src/model/loadout.js (split from one file; behaviour unchanged).

import { runMods } from './cardMods.js';

//
// `canSwap` above says WHETHER. This says HOW MUCH, and the comment on
// `cycleSet` below already named it as the next act: *"the PRICE.
// balance.equipment.swapCost is charged in doSwapArmament, outside this
// function"* — so the price had no truth function at all, only a subtraction in
// the engine. It has one now, and it lives here because this module is the one
// home for what a loadout means.
//
// Constantine named three prices and said *"that way I can try each"*, so the
// three are rows in `balance.equipment.swapCostRules` and the live one is a
// word. This function is the chain they select rungs of; it contains no `if`
// on a rule id, which is the difference between data he can switch between and
// three branches wearing a config key.

/** Where a rule's base price comes from. Closed; a row saying anything else is refused by name. */
export const SWAP_COST_BASES = Object.freeze(['default', 'category']);

/** The authored rules table. Empty is a real answer: no table, no rule, price falls to the default. */
export function swapCostRules(registries) {
  return (((registries || {}).balance || {}).equipment || {}).swapCostRules || [];
}

/**
 * resolveSwapCostRule(registries, meta) → the live rule row, or null.
 *
 * Unset, or a value this build cannot read, is the SHIPPING DEFAULT — the same
 * rule `resolveMapMode` and `savedZoom` use, and for the same reason: a
 * hand-edited save or an older build's value must behave exactly as an absent
 * one. The Settings row reads this table too, so the control and the resolver
 * cannot disagree about which rules exist.
 */
export function resolveSwapCostRule(registries, meta) {
  const cfg = (((registries || {}).balance || {}).equipment || {});
  const rows = swapCostRules(registries);
  const want = ((meta && meta.settings) || {}).swapCostRule;
  return rows.find((r) => r && r.id === want) || rows.find((r) => r && r.id === cfg.swapCostRule) || null;
}

/**
 * swapCostFor(registries, { rule, loadout, classId, slotId, setIndex, relicDelta })
 *   → { cost, ruleId, base, baseCost, categoryTag, gearOn, gearDelta, gearIgnored, floored }
 *
 * THE WHOLE DERIVATION, RETURNED RATHER THAN JUST THE NUMBER. A price a screen
 * or a test can only observe as `2` cannot be checked for WHY it is 2, and the
 * thing being measured tonight is whether three settings actually produce
 * different numbers — so every rung is in the return value and test 28b prints
 * the table. `gearIgnored` is the deliberately loud one: it is the delta a
 * gear-off rule DECLINED, so a talisman doing nothing says so instead of
 * looking broken.
 *
 * WHICH PIECE'S CATEGORY. The one being DRAWN — `loadout.sets[slotId][setIndex]`,
 * the set you are switching TO — not the one going away and not a max() of the
 * two. You pay for what you pick up, which is the reading a player can predict
 * from the thing they just chose. It is one line and named here rather than
 * discovered: if it plays wrong, this sentence is what changes.
 *
 * THE RELIC HALF ARRIVES AS A NUMBER, and that is a module boundary, not a
 * shortcut. `passiveSum` lives in model/registries.js, which imports THIS file
 * — so importing it back would make a cycle, and a cycle that survives Node
 * survives it in a hand-rolled single-file bundler only by luck. Combat already
 * owns the relic-passive-to-price pattern (`effectiveCost`, same file, same
 * shape), so it sums `swapCostDelta` and hands the total in. A caller that
 * forgets is NAMED, not defaulted: silence must not mean "no relics".
 *
 * THE FLOOR IS 0 AND IT IS ARITHMETIC, NOT DATA. An authored negative — a
 * category row at −1, a `swapCost` below zero — is refused by name in
 * `validateEquipment`. A negative TOTAL is a legal talisman meeting a cheap
 * weapon, and it clamps the way `powerCostReduction` already does, with
 * `floored` set so the clamp is observable rather than quiet.
 */
export function swapCostFor(registries, {
  rule = null, loadout = null, classId = null, slotId = null, setIndex = 0, relicDelta,
} = {}) {
  const cfg = (((registries || {}).balance || {}).equipment || {});
  const fallback = Number.isFinite(cfg.swapCost) ? cfg.swapCost : 0;
  const row = rule || null;
  const base = row && SWAP_COST_BASES.includes(row.base) ? row.base : 'default';

  let categoryTag = null;
  let baseCost = fallback;
  if (base === 'category') {
    const ids = ((loadout || {}).sets || {})[slotId] || [];
    const id = ids[setIndex];
    const eq = (registries || {}).equipment || {};
    const piece = id ? (eq.armaments || []).find((a) => a.id === id) || null : null;
    const tags = (piece && piece.tags) || [];
    // ORDERED, FIRST MATCH WINS — the priority between two tags a piece carries
    // is the order of the rows, so it is authorable and visible. No match at all
    // (a bare hand, an untagged piece) falls through to the default, which is
    // the same number the 'flat' rule charges — by design, not by accident.
    const hit = (cfg.swapCostByCategory || []).find((r) => r && tags.includes(r.tag));
    if (hit) {
      categoryTag = hit.tag;
      baseCost = Number.isFinite(hit.cost) ? hit.cost : fallback;
    }
  }

  if (!Number.isFinite(relicDelta)) {
    console.error(
      `swapCostFor('${slotId}'): no finite \`relicDelta\` — refusing to guess.`
      + ` Got ${JSON.stringify(relicDelta)}. Pass passiveSum(registries, relicIds, 'swapCostDelta').`
      + ' Charging the gear stage as 0. This line is the defect, not the price.'
    );
  }
  const relic = Number.isFinite(relicDelta) ? relicDelta : 0;
  const worn = loadout ? runMods(registries, loadout, classId).swapCostDelta : 0;
  const delta = relic + worn;
  const gearOn = !!(row && row.gear);
  const raw = baseCost + (gearOn ? delta : 0);

  return {
    cost: Math.max(0, raw),
    ruleId: row ? row.id : null,
    base,
    baseCost,
    categoryTag,
    gearOn,
    gearDelta: gearOn ? delta : 0,
    gearIgnored: gearOn ? 0 : delta,
    floored: raw < 0,
  };
}
