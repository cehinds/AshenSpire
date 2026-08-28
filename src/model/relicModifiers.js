// src/model/relicModifiers.js — generic, data-authored relic modifier receipts.
//
// Relic ids never appear here. A closed modifier tag selects one piece of
// generic arithmetic; the relic row supplies the resource/stat/school and its
// value. The host resolves these rows once before stamping run/combat state.

import { DAMAGE_SCHOOLS } from './schemas.js';

export const RELIC_RESOURCE_IDS = Object.freeze(['hp', 'mana', 'stamina']);

const emptyResource = () => ({ flat: 0, attributeTiers: [], total: 0 });

export function resolveRelicModifiers(registries, relicIds, { attributes = {} } = {}) {
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
        const tier = Math.floor(points / row.pointsPerTier);
        const value = tier * row.amountPerTier;
        const term = {
          sourceStat: row.sourceStat,
          pointsPerTier: row.pointsPerTier,
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
