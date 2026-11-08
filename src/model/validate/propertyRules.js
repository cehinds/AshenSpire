// src/model/validate/propertyRules.js — relic property-rule cross checks and the script-usage probe.
// Split out of validate.js.

import { SCHEMAS } from '../schemas.js';
import { nodeVariableBindings } from '../tree.js';
import { tagIdsInDomain } from '../tags.js';
import { describe, isPlainObject } from './shared.js';
import { walkSchema } from './schemaWalk.js';
import { checkTemplate } from './templates.js';

/**
 * The triggers a relic's property rules carry, flattened in tagging order.
 *
 * READS THE TAGGING ROWS, NOT `propertyTags`: that field is stamped onto a
 * definition when the registries are built (model/registries.js), and the
 * validator runs on the RAW content bundle, where it does not exist yet. Taking
 * it from the bundle's own join is also the more honest read — this is the same
 * table the mount path resolves against.
 */
function relicRuleTriggers(relic, rulesByTag, taggingByObject) {
  if (!rulesByTag || !taggingByObject) return [];
  const out = [];
  for (const tag of taggingByObject.get(relic.id) || []) {
    const rule = rulesByTag.get(tag);
    for (const trig of (rule && rule.triggers) || []) out.push(trig);
  }
  return out;
}

/** relic id → the property tags tagging.csv hands it, in file order. */
export function relicPropertyTagIndex(b) {
  const propertyTags = new Set(tagIdsInDomain(b, 'property'));
  const index = new Map();
  for (const row of Array.isArray(b.tagging) ? b.tagging : []) {
    if (!row || row.family !== 'relic' || !propertyTags.has(row.tagId)) continue;
    const list = index.get(row.objectId) || [];
    list.push(row.tagId);
    index.set(row.objectId, list);
  }
  return index;
}

// ---------------------------------------------------------------------------
// Property rules (docs/proposal-progression-and-property-system.md §3)
// ---------------------------------------------------------------------------

function balanceRefsIn(value, path, out = []) {
  if (Array.isArray(value)) value.forEach((v, i) => balanceRefsIn(v, `${path}[${i}]`, out));
  else if (isPlainObject(value)) {
    if (Object.keys(value).length === 1 && typeof value.balance === 'string') out.push({ path, ref: value.balance });
    else for (const [k, v] of Object.entries(value)) balanceRefsIn(v, `${path}.${k}`, out);
  }
  return out;
}

/**
 * Every refusal here names its row: a property tag with no rule, or two; a rule
 * for a tag outside the property domain; requires/excludes that name no
 * property tag; a requires cycle; and a sidecar number naming no balance row.
 *
 * WHAT IS NO LONGER REFUSED: the family. Property tags were restricted to four
 * carriers, with the card named in the refusal. That gate is gone — a property
 * tag is how the game is told what an object is and how it may be used, so
 * every family carries them (schemas.js, where the list used to be).
 */
/** The tagging rows that hand a property tag to a holder. Any family may. */
function carriersOf(b, tag) {
  return (Array.isArray(b.tagging) ? b.tagging : []).filter((row) => row && row.tagId === tag);
}

export function propertyRuleProblems(b, vctx) {
  const { err } = vctx;
  const rules = b.propertyRules === undefined ? [] : b.propertyRules;
  if (!Array.isArray(rules)) {
    err('propertyRules', `must be an array of property rule rows (got ${describe(rules)})`);
    return;
  }
  const propertyTags = new Set(tagIdsInDomain(b, 'property'));
  const byTag = new Map();
  rules.forEach((rule, i) => {
    const tag = rule && typeof rule.tag === 'string' ? rule.tag : `#${i}`;
    const path = `propertyRules.${tag}`;
    walkSchema(rule, SCHEMAS.propertyRule, path, vctx);
    if (!isPlainObject(rule) || typeof rule.tag !== 'string') return;
    if (byTag.has(rule.tag)) {
      err(path, `duplicate rule for property tag '${rule.tag}' — a property tag has exactly one rule; a stronger version is a second tag ('${rule.tag}2'), not a second row`);
      return;
    }
    byTag.set(rule.tag, rule);
    if (!propertyTags.has(rule.tag)) {
      err(path, `'${rule.tag}' is not a property tag — register it as a node under the property root in content/source/nodes.csv, or delete this rule`);
    }
    for (const field of ['requires', 'excludes']) {
      for (const ref of Array.isArray(rule[field]) ? rule[field] : []) {
        if (!propertyTags.has(ref)) err(`${path}.${field}`, `${field} '${ref}', which is not a property tag — every entry names a node under the property root`);
      }
    }
    const excludes = Array.isArray(rule.excludes) ? rule.excludes : [];
    if (excludes.includes(rule.tag)) err(`${path}.excludes`, `'${rule.tag}' excludes itself, so it could never mount`);
    for (const ref of Array.isArray(rule.requires) ? rule.requires : []) {
      if (excludes.includes(ref)) err(`${path}.requires`, `'${ref}' is both required and excluded, so the rule could never mount`);
    }
    for (const { path: at, ref } of balanceRefsIn(rule, path)) {
      err(at, `names balance row '${ref}', which is not a number in src/content/balance.js — add the row or fix the path`);
    }
    // A RULE EITHER STATES ITSELF OR ITS CARRIER STATES IT, and either way every
    // number reaches a reader. A rule with its own sentence is checked against
    // it. A rule with an EMPTY sentence is deferred to the carriers holding the
    // tag — today that is a relic, whose own textTemplate has covered the whole
    // relic since before its triggers moved (plan phase 2), and which is checked
    // against both halves in validateRelicTemplate. A rule with an empty
    // sentence that NOBODY carries would state its numbers nowhere at all, so
    // that is the one shape refused here.
    if (typeof rule.textTemplate === 'string' && Array.isArray(rule.triggers)) {
      const effects = rule.triggers.flatMap((trig) => (trig && Array.isArray(trig.do) ? trig.do : []));
      if (rule.textTemplate.trim()) {
        // Bound by NAME — the rule's sentence reads the node's variables — and
        // by op position for a rule authored straight into `propertyRules` with
        // literal numbers and no node (a fixture; shipped rules are derived
        // from nodes and carry balance refs, which bind nothing here).
        checkTemplate(rule.textTemplate, effects, `${path}.textTemplate`, err, nodeVariableBindings(b, rule.tag));
      } else if (effects.length && !carriersOf(b, rule.tag).length) {
        err(`${path}.textTemplate`, `is empty and no carrier holds '${rule.tag}', so the numbers in its triggers are stated nowhere — give the rule its own sentence, or add the tagging row for the carrier whose text already covers it`);
      }
    }
  });
  for (const tag of propertyTags) {
    if (!byTag.has(tag)) err(`tags.${tag}`, `property tag '${tag}' has no rule — a property node's rule is derived from the tree by tools/content-build.mjs — put the node under the property root in nodes.csv and rebuild`);
  }

  // No requires cycles: a rule that (transitively) requires itself is a
  // carrier nobody can author.
  const state = new Map();
  const reported = new Set();
  const visit = (tag, stack) => {
    state.set(tag, 1);
    stack.push(tag);
    for (const next of byTag.get(tag).requires || []) {
      if (!byTag.has(next)) continue;
      if (state.get(next) === 1) {
        const cycle = [...stack.slice(stack.indexOf(next)), next];
        const key = [...new Set(cycle)].sort().join('|');
        if (!reported.has(key)) {
          reported.add(key);
          err(`propertyRules.${next}.requires`, `requires cycle ${cycle.join(' → ')} — no carrier could ever satisfy it`);
        }
      } else if (!state.has(next)) visit(next, stack);
    }
    stack.pop();
    state.set(tag, 2);
  };
  for (const tag of byTag.keys()) if (!state.has(tag)) visit(tag, []);

}

// ---------------------------------------------------------------------------
// Scripts budget helpers
// ---------------------------------------------------------------------------

export function usesScript(node) {
  if (Array.isArray(node)) return node.some(usesScript);
  if (node !== null && typeof node === 'object') {
    if (typeof node.script === 'string') return true;
    return Object.values(node).some(usesScript);
  }
  return false;
}
