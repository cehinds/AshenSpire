// src/model/validate/tokenBindings.js — which template tokens a card, effect list or relic binds (SPEC §3.13).
// Split out of validate.js; validate.js re-exports every name here, so importers are unchanged.

import { nodeTokens } from '../tree.js';
import { tokenRe } from '../tokens.js';

// Ops whose value binds to a text-template token; token name = op name,
// except applyStatus which binds under its status id (SPEC §3.13).
export const TOKENIZABLE_OPS = Object.freeze([
  'gainBarrier', 'buildup', 'applyReflect',
  'discard', 'removeStatus', 'grantCardCharge',
  'damage',
  'block',
  'gainPoise',
  'gainWard',
  'heal',
  'loseHp',
  'applyStatus',
  'poiseDamage',
  'draw',
  'gainEnergy',
  'restoreMana',
  'restoreStamina',
  'addCinders',
  'loseMaxHpPct',
]);

// Ops whose LITERAL numeric value MUST have a bound token in the template
// (a player-visible number with no token is a validation error).
export const REQUIRED_TOKEN_OPS = Object.freeze([
  'gainBarrier', 'buildup',
  'damage',
  'block',
  'gainPoise',
  'gainWard',
  'heal',
  'loseHp',
  'applyStatus',
  'poiseDamage',
  'draw',
  'gainEnergy',
  'restoreMana',
  'restoreStamina',
]);

export function relicModifierTokenBindings(def) {
  const counts = {};
  const out = [];
  const add = (base, value, tag) => {
    counts[base] = (counts[base] || 0) + 1;
    const token = counts[base] === 1 ? base : `${base}.${counts[base]}`;
    out.push({ token, value, literal: typeof value === 'number', op: tag, required: true });
  };
  for (const row of (def.passives && Array.isArray(def.passives.modifiers) ? def.passives.modifiers : [])) {
    if (!row || typeof row !== 'object') continue;
    if (row.tag === 'resource.flat') add(`${row.resource}Flat`, row.amount, row.tag);
    else if (row.tag === 'resource.attributeTier') add(`${row.resource}PerTier`, row.amountPerTier, row.tag);
    else if (row.tag === 'damage.school.flat') add(`${row.school}DamageFlat`, row.amount, row.tag);
  }
  return out;
}

export function relicTokens(def, rules = [], registries = null) {
  // DELEGATES. It used to carry its own grammar — a `['amount','stacks','value',
  // 'n']` scan plus status/id keying — and Bjorn's review found 3 of 4 synthetic
  // relics built from DECLARED vocabulary rendering a raw token, with a green
  // control. computeTokenBindings twelve lines up already owns this rule and
  // owns it better: TOKENIZABLE_OPS gates it, `applyStatus` keys on the status
  // and reads `stacks`, `loseMaxHpPct` reads `pct`, `damage` also binds `hits`,
  // and a repeated op disambiguates to `{block.2}`. My version had none of that.
  //
  // What this function is FOR is the other half: a card carries a flat
  // `effects` array and a relic carries ops spread across `triggers[].do`. So
  // this flattens, and the grammar stays where it already lived.
  //
  // `rules` is the relic's property rules (model/registries.js
  // relicPropertyRules) and `registries` the registries they came from, passed
  // by every caller that has them. Since plan phase 2 a relic's triggers live in
  // its rules, and since the tag tree a rule's numbers are VARIABLES: the
  // sentence binds them BY NAME (tree.js nodeTokens — `{poiseDamage}` reads the
  // variable poiseDamage), not by counting ops. Only the relic's own passives
  // and effects, which are not nodes, are still bound by op position. A caller
  // with no registries gets those alone and leaves `{poiseDamage}` standing —
  // the same honest degrade an unresolvable token has always had.
  const ops = [];
  for (const t of def.triggers || []) for (const op of t.do || []) ops.push(op);
  for (const op of def.effects || []) ops.push(op);
  for (const op of def.do || []) ops.push(op);
  const tokens = {};
  for (const b of computeTokenBindings(ops)) {
    const v = (ops[b.index] || {})[b.field];
    if (typeof v === 'number') tokens[b.token] = v;
  }
  for (const binding of relicModifierTokenBindings(def)) {
    if (typeof binding.value === 'number') tokens[binding.token] = binding.value;
  }
  if (registries) {
    for (const rule of rules || []) Object.assign(tokens, nodeTokens(registries, rule.tag));
  }
  return tokens;
}

export function computeTokenBindings(effects) {
  const counts = {};
  const out = [];
  const push = (base, index, field, op, literal) => {
    counts[base] = (counts[base] || 0) + 1;
    const token = counts[base] === 1 ? base : `${base}.${counts[base]}`;
    out.push({ token, index, field, op, literal });
  };
  (effects || []).forEach((eff, i) => {
    if (!eff || typeof eff !== 'object' || typeof eff.op !== 'string') return;
    if (!TOKENIZABLE_OPS.includes(eff.op)) return;
    if (eff.op === 'grantCardCharge') {
      for (const field of ['damage', 'manaDiscount', 'block', 'heal', 'break', 'buildup']) if (eff[field] !== undefined) push(`charge${field[0].toUpperCase()}${field.slice(1)}`, i, field, eff.op, typeof eff[field] === 'number');
      return;
    }
    const field = eff.op === 'applyStatus' ? 'stacks' : eff.op === 'loseMaxHpPct' ? 'pct' : 'amount';
    const base = ['applyStatus', 'buildup'].includes(eff.op) ? eff.status : eff.op;
    if (typeof base !== 'string') return; // malformed; schema pass reports it
    push(base, i, field, eff.op, typeof eff[field] === 'number');
    if (eff.op === 'damage' && eff.hits != null) {
      push('hits', i, 'hits', eff.op, typeof eff.hits === 'number');
    }
  });
  return out;
}

/**
 * cardTokenEffects(card) → the effect list a card's text template binds to:
 * its play `effects`, then its `onTurnEndInHand` hook (Guilt's HP loss). The
 * hook is appended AFTER the play effects so a play effect's token never
 * changes; a hook op sharing a base binds as `{base.2}`. Shared by the
 * validator and the static token projection (model/playingCard.js), so the
 * number a card shows is the number its hook fires.
 */
export function cardTokenEffects(card) {
  const effects = card && Array.isArray(card.effects) ? card.effects : [];
  const hook = card && Array.isArray(card.onTurnEndInHand) ? card.onTurnEndInHand : [];
  return hook.length ? [...effects, ...hook] : effects;
}

export function extractTemplateTokens(template) {
  const tokens = [];
  const re = tokenRe();
  let m;
  while ((m = re.exec(template)) !== null) tokens.push(m[1]);
  return tokens;
}
