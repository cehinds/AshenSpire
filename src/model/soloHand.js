// src/model/soloHand.js — the hand a SOLO fight deals, read before the fight.
//
// A solo fight's hand comes from the hand rules (Advanced → Stats → Draw &
// hand), resolved for the fighter's class exactly as `createRunCombat` does
// (engine/runCombat.js): `handRulesForClass(resolveHandRules(settings, …))`.
// The derived Draw row (content/derivedStats.js) is not it — that row feeds
// co-op and headless fights only. So the creation screen and the attribute
// cards read the opening hand, turn draw and hand capacity from here, and the
// numbers they print are the ones the first turn deals (engine/handRules.js
// `turnDrawCount`: every draw is limited to the room capacity leaves).

import { resolveHandRules, handRulesForClass, scaledCardsReceipt } from './handRules.js';

/** soloHandRules(registries, classId, settings) → the rules a solo fight of this class is handed. */
export function soloHandRules(registries, classId, settings = {}) {
  const attributes = typeof registries?.attributes?.all === 'function' ? registries.attributes.all() : [];
  return handRulesForClass(resolveHandRules(settings || {}, attributes), classId);
}

/**
 * soloHandSummary(rules, attributes, shortLabel) → { opening, turn, capacity, formulas }
 *
 * `opening` and `turn` are what the engine would draw into an empty hand,
 * never past `capacity`; in fill mode `turn` is capacity.
 * `shortLabel(attrId)` names an attribute in the formula strings.
 */
export function soloHandSummary(rules, attributes = {}, shortLabel = (id) => id) {
  const capacity = scaledCardsReceipt(rules.capacity, attributes);
  const starting = scaledCardsReceipt(rules.starting, attributes);
  const fixed = rules.drawMode !== 'fill';
  const turnReceipt = fixed ? scaledCardsReceipt(rules.turn, attributes) : null;
  const words = (receipt) => (receipt.statEnabled
    ? `${receipt.base} base + ${receipt.bonus} (${shortLabel(receipt.stat)} ${receipt.points} − ${receipt.baseline}, ÷ ${receipt.pointsPerCard}), within ${receipt.minimum}–${receipt.maximum}`
    : `${receipt.base} base, within ${receipt.minimum}–${receipt.maximum}`);
  const capped = (value) => Math.min(value, capacity.value);
  const opening = capped(starting.value);
  const turn = fixed ? capped(turnReceipt.value) : capacity.value;
  const limit = (value, total) => (value > total ? `, limited to capacity ${total}` : '');
  return {
    opening, turn, capacity: capacity.value, drawMode: rules.drawMode,
    formulas: {
      opening: `Opening hand: ${words(starting)}${limit(starting.value, capacity.value)} = ${opening}`,
      turn: fixed
        ? `Cards drawn each turn: ${words(turnReceipt)}${limit(turnReceipt.value, capacity.value)} = ${turn}`
        : `Each turn: draw until the hand holds ${capacity.value}`,
      capacity: `Hand capacity: ${words(capacity)} = ${capacity.value}`,
    },
  };
}

/**
 * soloHandFacts(rules, attrId) → what one attribute point buys in a solo hand,
 * as `{ label, points, baseline, maximum }` per hand rule that grows with it.
 * The opening hand is first: it is the one a class's own attribute moves.
 */
export function soloHandFacts(rules, attrId) {
  const groups = [['starting', 'Opening hand'], ...(rules.drawMode === 'fill' ? [] : [['turn', 'Turn draw']]), ['capacity', 'Hand capacity']];
  return groups
    .filter(([group]) => rules[group]?.statEnabled && rules[group].stat === attrId)
    .map(([group, label]) => ({ label, points: rules[group].pointsPerCard, baseline: rules[group].baseline, maximum: rules[group].maximum }));
}
