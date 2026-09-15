// src/content/propertyRules.js — the property rules table, indexed by tag.
//
// A property tag (domain `property`, content/source/tagDomains.csv) is the one
// kind of tag that CONFERS behaviour, and what it confers is exactly one row of
// this table (docs/proposal-progression-and-property-system.md §3). Two
// sources, compiled by tools/content-build.mjs and joined here by tag:
//
//   content/source/propertyRules.csv        tag, requires, excludes, textTemplate
//   content/source/propertyRuleEffects.json { [tag]: { passives?, triggers? } }
//
// The sidecar holds the relic-shaped trees (a trigger list is not a CSV cell);
// SCHEMAS.propertyRule is built from the same passives/triggers nodes a relic
// uses, so a property can say nothing a relic cannot.
//
// NUMBERS COME FROM content/balance.js. A sidecar value written as
// `{ "balance": "exposure.siphonRefund" }` is read from balance when this
// module loads, so the one home for the number is the balance row. A path that
// names nothing is LEFT IN PLACE, and model/validate.js refuses it by name —
// this module never throws at import, because an import-time throw would take
// the whole game down before the validator could say which row is wrong.
//
// Nothing here mutates content, and nothing here decides WHO holds a property:
// that is the carrier's tagging row (tagging.csv) and the engine's mount path.

import { propertyRules as ruleRows } from './generated/propertyRules.js';
import { propertyRuleEffects } from './generated/propertyRuleEffects.js';
import { balance } from './balance.js';

// A CSV cell coerces '' to '', 'a' to 'a' and 'a|b' to ['a', 'b'].
function tagList(cell) {
  if (Array.isArray(cell)) return cell.map(String);
  if (cell === '' || cell == null) return [];
  return [String(cell)];
}

function balanceRow(path) {
  let node = balance;
  for (const part of String(path).split('.')) node = node && typeof node === 'object' ? node[part] : undefined;
  return node;
}

function isBalanceRef(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === 1 && typeof value.balance === 'string';
}

function resolveBalanceRefs(value) {
  if (Array.isArray(value)) return value.map(resolveBalanceRefs);
  if (isBalanceRef(value)) {
    const n = balanceRow(value.balance);
    return Number.isFinite(n) ? n : value;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveBalanceRefs(v)]));
  }
  return value;
}

function composeRule(row) {
  const effects = resolveBalanceRefs(propertyRuleEffects[row.tag] || {});
  return {
    tag: String(row.tag),
    requires: tagList(row.requires),
    excludes: tagList(row.excludes),
    textTemplate: row.textTemplate == null ? '' : String(row.textTemplate),
    ...effects,
  };
}

const rowTags = new Set(ruleRows.map((row) => String(row.tag)));

/**
 * Every rule, in authoring order. A sidecar entry with no CSV row is carried
 * through as a rule with no textTemplate, so the validator names it rather
 * than the join dropping it silently.
 */
export const PROPERTY_RULES = Object.freeze([
  ...ruleRows.map(composeRule),
  ...Object.keys(propertyRuleEffects)
    .filter((tag) => !rowTags.has(tag))
    .map((tag) => ({ tag, requires: [], excludes: [], ...resolveBalanceRefs(propertyRuleEffects[tag]) })),
]);

const BY_TAG = new Map();
for (const rule of PROPERTY_RULES) if (!BY_TAG.has(rule.tag)) BY_TAG.set(rule.tag, rule);

/** The rule a property tag resolves to, or null. Duplicates are validate.js's red. */
export function propertyRuleFor(tag) {
  return BY_TAG.get(tag) || null;
}
