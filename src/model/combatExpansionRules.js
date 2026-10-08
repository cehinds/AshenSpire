import { combatExpansionMatchups } from '../content/combatMatchups.js';
import { combatStatusRules } from '../content/combatStatusRules.js';
import { ASHEN_BLIGHT_RULES } from '../content/ashenBlight.js';
import { combatExpansionEquipment } from '../content/combatExpansionEquipment.js';
import { combatExpansionMatchupRulesProblems } from './combatTacticsRules.js';

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function createCombatExpansionRuleSnapshot() {
  return structuredClone({ matchups: combatExpansionMatchups, statuses: combatStatusRules,
    ashenBlight: ASHEN_BLIGHT_RULES, equipment: combatExpansionEquipment });
}

/** Carried tuning is data, never executable callbacks or a live-table fallback. */
export function combatExpansionRulesProblems(value, path = 'combatExpansionRules') {
  if (!record(value)) return [`${path} must contain the run's frozen combat rules`];
  const problems = [];
  for (const key of Object.keys(value)) if (!['matchups', 'statuses', 'ashenBlight', 'equipment'].includes(key)) problems.push(`${path}.${key} is unknown`);
  problems.push(...combatExpansionMatchupRulesProblems(value.matchups, `${path}.matchups`));
  const check = (actual, template, at) => {
    if (record(template)) {
      if (!record(actual)) { problems.push(`${at} must be an object`); return; }
      for (const key of Object.keys(actual)) if (!(key in template)) problems.push(`${at}.${key} is unknown`);
      for (const [key, expected] of Object.entries(template)) check(actual[key], expected, `${at}.${key}`);
    } else if (typeof template === 'number') {
      if (!Number.isFinite(actual) || (template >= 0 && actual < 0)) problems.push(`${at} must be finite${template >= 0 ? ' and non-negative' : ''}`);
    } else if (typeof actual !== typeof template || (typeof template === 'string' && actual !== template)) problems.push(`${at} has invalid rule data`);
  };
  check(value.statuses, combatStatusRules, `${path}.statuses`);
  if (value.statuses?.version !== 2) problems.push(`${path}.statuses.version must be 2`);
  for (const [id, row] of Object.entries(value.statuses?.statuses || {})) {
    if (!Number.isSafeInteger(row?.cap) || row.cap < 1 || !(row.initialThreshold > 0) || !(row.activeThreshold > 0)) problems.push(`${path}.statuses.statuses.${id} requires positive thresholds and a whole cap`);
  }
  const recovery = value.statuses?.recovery;
  if (recovery && (recovery.maximum > 100 || recovery.minimum > recovery.maximum || recovery.pendingRemoval > 1)) problems.push(`${path}.statuses.recovery has invalid chance or removal bounds`);
  // The requested severe contract is fixed: a save may not redefine its risk.
  if (!record(value.ashenBlight) || Object.keys(value.ashenBlight).length !== Object.keys(ASHEN_BLIGHT_RULES).length
    || Object.entries(ASHEN_BLIGHT_RULES).some(([key, expected]) => JSON.stringify(value.ashenBlight[key]) !== JSON.stringify(expected))) problems.push(`${path}.ashenBlight must preserve the fixed 25/50/75, 90-percent threshold and 5-percent later-combat contract`);
  if (!record(value.equipment)) problems.push(`${path}.equipment must be an object`);
  else {
    for (const group of Object.keys(value.equipment)) if (!['armour', 'sharedArmour', 'armaments', 'enemies'].includes(group)) problems.push(`${path}.equipment.${group} is unknown`);
    const numberMap = (map, at) => {
      if (!record(map) || Object.entries(map).some(([id, amount]) => !id || !Number.isFinite(amount) || amount < 0)) problems.push(`${at} must contain non-negative numeric traits`);
    };
    for (const group of ['armour', 'sharedArmour', 'armaments', 'enemies']) {
      const rows = value.equipment[group];
      if (!record(rows)) { problems.push(`${path}.equipment.${group} must be an object`); continue; }
      for (const [id, row] of Object.entries(rows)) {
        const at = `${path}.equipment.${group}.${id}`;
        if (!id || !record(row)) { problems.push(`${at} must be an authored equipment projection`); continue; }
        for (const key of Object.keys(row)) if (!['armorClass', 'flat', 'weak', 'traits'].includes(key)) problems.push(`${at}.${key} is unknown`);
        if (row.armorClass !== undefined && !['light', 'medium', 'heavy'].includes(row.armorClass)) problems.push(`${at}.armorClass is unsupported`);
        for (const key of ['flat', 'weak']) if (row[key] !== undefined) numberMap(row[key], `${at}.${key}`);
        if (row.traits !== undefined) {
          if (!record(row.traits)) problems.push(`${at}.traits must be an object`);
          else for (const [name, trait] of Object.entries(row.traits)) {
            if (['buildupResistance', 'recoveryBonus'].includes(name)) numberMap(trait, `${at}.traits.${name}`);
            else if (typeof trait !== 'boolean' && !(Array.isArray(trait) && trait.every(item => typeof item === 'string' && item))) problems.push(`${at}.traits.${name} must be a boolean or list of named traits`);
          }
        }
      }
    }
  }
  return problems;
}
