// src/model/relicModifiers.js — generic, data-authored relic modifier receipts.
//
// Relic ids never appear here. A closed modifier tag selects one piece of
// generic arithmetic; the relic row supplies the resource/stat/school and its
// value. The host resolves these rows once before stamping run/combat state.

import { DAMAGE_SCHOOLS } from './schemas.js';

export const RELIC_RESOURCE_IDS = Object.freeze(['hp', 'mana', 'stamina']);

const emptyResource = () => ({ flat: 0, attributeTiers: [], total: 0 });

/**
 * The tier granularity a `resource.attributeTier` row folds at.
 *
 * A ROW THAT DOES NOT STATE ONE INHERITS THE RULE IT FOLDS INTO — Law 0
 * clause 1: the entry describes ("+N HP per tier of CON"), the machinery
 * derives what a tier is. `pointsPerTier` stayed REQUIRED here until
 * 2026-08-17 and the one shipped row said 5, which is `derivedStatRules`'
 * own tier size written a second time; the copy was invisible until
 * Constantine asked for that size to be a dial ("let's make the increment of
 * 5 points for reasonable change be confurable as well"). At a 1-point tier
 * the host rule said 1, the relic still said 5, and the fold contract
 * REFUSED — correctly, since +1 per 5 CON cannot be added to a per-1 rule —
 * so a reaver could not start a run at all.
 *
 * STATING IT IS STILL LEGAL AND STILL MEANS WHAT IT SAID (Law 0 clause 3: an
 * override is data). It simply must then match the rule it folds into, which
 * is the contract that has always applied.
 *
 * `tierSizes` is the HOST's resolved granularity per resource, passed by the
 * caller that has it. Absent, the authored table is read — the same answer
 * every caller got before this parameter existed.
 */
function tierSizeFor(registries, resource, row, tierSizes) {
  if (Number.isInteger(row.pointsPerTier)) return row.pointsPerTier;
  if (tierSizes && Number.isInteger(tierSizes[resource])) return tierSizes[resource];
  const table = registries.derivedStatRules || {};
  const authored = (table.rules || {})[resource] || {};
  const per = Number.isInteger(authored.pointsPerTier)
    ? authored.pointsPerTier
    : (table.defaults || {}).pointsPerTier;
  if (!Number.isInteger(per) || per <= 0) {
    throw new Error(`relic modifier on '${resource}' states no pointsPerTier and none could be derived`);
  }
  return per;
}

export function resolveRelicModifiers(registries, relicIds, { attributes = {}, tierSizes = null } = {}) {
  const resources = Object.fromEntries(RELIC_RESOURCE_IDS.map((id) => [id, emptyResource()]));
  const damageBySchoolAdd = Object.fromEntries(DAMAGE_SCHOOLS.map((id) => [id, 0]));
  const sources = [];

  for (const relicId of relicIds || []) {
    const relic = registries.relics.get(relicId);
    for (const [index, row] of (relic.passives && relic.passives.modifiers || []).entries()) {
      const source = { relicId, index, tag: row.tag };
      if (row.tag === 'resource.flat') {
        resources[row.resource].flat += row.amount;
        resources[row.resource].total += row.amount;
        sources.push({ ...source, resource: row.resource, value: row.amount });
      } else if (row.tag === 'resource.attributeTier') {
        const points = attributes[row.sourceStat];
        if (!Number.isFinite(points)) {
          throw new Error(`${relicId}.passives.modifiers[${index}].sourceStat '${row.sourceStat}' has no finite run value`);
        }
        const per = tierSizeFor(registries, row.resource, row, tierSizes);
        const tier = Math.floor(points / per);
        const value = tier * row.amountPerTier;
        const term = {
          sourceStat: row.sourceStat,
          // THE RESOLVED granularity, not the authored one. The receipt is
          // stamped into the save and read by the fold, so it must say what
          // was actually used or the audit trail is fiction.
          pointsPerTier: per,
          amountPerTier: row.amountPerTier,
          tier,
          value,
        };
        resources[row.resource].attributeTiers.push(term);
        resources[row.resource].total += value;
        sources.push({ ...source, resource: row.resource, ...term });
      } else if (row.tag === 'damage.school.flat') {
        damageBySchoolAdd[row.school] += row.amount;
        sources.push({ ...source, school: row.school, value: row.amount });
      } else {
        // Boot validation owns normal content. This is the same loud edge for
        // callers that construct registries without first running validation.
        throw new Error(`${relicId}.passives.modifiers[${index}].tag '${row.tag}' is unknown`);
      }
    }
  }

  return structuredClone({ resources, damageBySchoolAdd, sources });
}
