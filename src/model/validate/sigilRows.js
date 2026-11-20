// src/model/validate/sigilRows.js — the sigil row check (SPEC §14.3, §15.4).
// Split out of validate.js.

import { SIGIL_RARITIES } from '../schemas.js';
import { describe, isPlainObject } from './shared.js';

const SIGIL_FIELDS = new Set(['id', 'name', 'rarity', 'cost', 'blurb']);

// WHAT A SIGIL DOES IS ITS TAGGING ROW (SPEC §14.3, §14.4; Codex on #1376). A
// sigil authors no `triggers` or `modifiers`: its `family = sigil` row in
// tagging.csv names a leaf under the `sigil` branch of `property`, whose rule
// is in nodeEffects.json, and stampTags derives its `propertyTags`. A tag that
// is the branch itself, sits elsewhere in the tree, or has no rule is refused.
export function validateSigils(rows, vctx, bundle = {}) {
  const { err } = vctx;
  // SPEC §15.4's numbers: how many legendaries a run may attune (a whole
  // number from 0) and each pool's drop chance (a whole percent, 0-100).
  const numbers = isPlainObject(bundle.balance) && isPlainObject(bundle.balance.sigils) ? bundle.balance.sigils : null;
  if (numbers) {
    if (!(Number.isSafeInteger(numbers.attuneMax) && numbers.attuneMax >= 0)) err('balance.sigils.attuneMax', `must be a whole number from 0, got ${describe(numbers.attuneMax)}`);
    const chances = numbers.dropChancePct;
    if (!isPlainObject(chances)) err('balance.sigils.dropChancePct', `must be { normal, elite, boss, treasure }, got ${describe(chances)}`);
    else for (const pool of ['normal', 'elite', 'boss', 'treasure']) {
      const pct = chances[pool];
      if (!(Number.isSafeInteger(pct) && pct >= 0 && pct <= 100)) err(`balance.sigils.dropChancePct.${pool}`, `must be a whole percent from 0 to 100, got ${describe(pct)}`);
    }
  }
  if (!Array.isArray(rows)) { err('sigils', `must be an array of sigil rows, got ${describe(rows)}`); return; }
  const tagging = Array.isArray(bundle.tagging) ? bundle.tagging : [];
  const propertyIds = new Set((Array.isArray(bundle.tags) ? bundle.tags : []).filter((tag) => tag && tag.domain === 'property').map((tag) => tag.id));
  const nodes = new Map((Array.isArray(bundle.nodes) ? bundle.nodes : []).map((node) => [node.id, node]));
  const effects = isPlainObject(bundle.nodeEffects) ? bundle.nodeEffects : {};
  const underSigil = (id) => {
    for (let at = nodes.get(id); at; at = nodes.get(at.parentId)) if (at.parentId === 'sigil') return true;
    return false;
  };
  const seen = new Set();
  rows.forEach((row, index) => {
    if (!isPlainObject(row) || typeof row.id !== 'string' || !row.id) { err(`sigils[${index}]`, 'must be a sigil { id, name, rarity, cost, blurb }'); return; }
    const at = `sigils.${row.id}`;
    if (seen.has(row.id)) err(at, 'is listed twice');
    seen.add(row.id);
    for (const key of ['triggers', 'modifiers']) {
      if (row[key] !== undefined) err(`${at}.${key}`, 'is not authored on a sigil (Codex on #1376): what a sigil does is its property row in tagging.csv, a leaf under the sigil branch with its rule in nodeEffects.json');
    }
    for (const key of Object.keys(row)) if (!SIGIL_FIELDS.has(key) && key !== 'triggers' && key !== 'modifiers') err(`${at}.${key}`, `is not a sigil field (fields: ${[...SIGIL_FIELDS].join(', ')})`);
    if (typeof row.name !== 'string' || !row.name) err(`${at}.name`, 'must be a non-empty string');
    if (typeof row.blurb !== 'string' || !row.blurb) err(`${at}.blurb`, 'must be a non-empty string (the sentence the shelf shows)');
    if (!SIGIL_RARITIES.includes(row.rarity)) err(`${at}.rarity`, `must be one of ${SIGIL_RARITIES.join(', ')}, got ${describe(row.rarity)}`);
    // A legendary (SPEC §15.4) is `{ id, name, rarity, blurb }`: attuned, never
    // sold, so it has no price. Every other sigil is sold and has one.
    if (row.rarity === 'legendary') {
      if (row.cost !== undefined) err(`${at}.cost`, 'is not authored on a legendary sigil (SPEC §15.4): a legendary is never shop stock, and a drop is its only source');
    } else if (!(Number.isSafeInteger(row.cost) && row.cost > 0)) err(`${at}.cost`, `must be a whole number of cinders above 0, got ${describe(row.cost)}`);
    const props = tagging.filter((tag) => tag && tag.family === 'sigil' && tag.objectId === row.id && propertyIds.has(tag.tagId)).map((tag) => tag.tagId);
    if (!props.length) err(at, 'derives no property tag: give it a `sigil` row in tagging.csv naming a leaf under the sigil branch of property');
    else if (row.rarity === 'legendary' && props.length !== 1) err(at, `is legendary and must derive exactly one property tag from tagging.csv, got ${props.length} (${props.join(', ')})`);
    for (const tag of props) {
      if (!underSigil(tag)) err(at, `carries property '${tag}', which is not a leaf under the sigil branch of property`);
      else if (!Object.hasOwn(effects, tag)) err(at, `carries property '${tag}', which has no rule in nodeEffects.json`);
    }
  });
}
