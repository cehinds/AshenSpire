// src/model/validate/root.js — root version flags, combat-tactics rules, arcane school buildup and the attack-card damage config.
// Split out of validate.js's collectContentProblems: same errors, same order. `ctx` carries the
// cross-reference data earlier sections built (and the data this one hands on).

import { combatIntentRulesProblems, combatMatchupRulesProblems } from '../combatTacticsRules.js';
import { enemyKnowledgeRuleProblems } from '../enemyKnowledgeRules.js';
import { DAMAGE_SCHOOLS } from '../schemas.js';
import { attackCardDamageConfigProblems } from '../attackCardDamage.js';

export function rootProblems(b, err, ctx) {
  if (b.classMasteryVersion !== undefined && b.classMasteryVersion !== 1) err('classMasteryVersion', 'must be 1 when present');
  if (b.breakMeterVersion !== undefined && ![1, 2].includes(b.breakMeterVersion)) err('breakMeterVersion', 'must be 1 or 2 when present');

  // The `events` door belongs to tools/content-build.mjs (its K15 matrix): a
  // bundle carrying no events section at all is a BUILD fault, not a content
  // fault. The cross-reference rules below read the shipped event list, and an
  // absent section read as "zero shipped events" makes every event-referencing
  // row look wrong — a flood of false refusals that never names the one thing
  // actually missing, and that steals the door from its owner. So when the door
  // is open we skip the cross-references ONLY: every shape rule below still
  // runs, and an events section that SHIPS is cross-referenced exactly as before.
  const eventsDoorOpen = b.events == null;

  for (const problem of b.balance?.combatMatchups !== undefined ? combatMatchupRulesProblems(b.balance.combatMatchups, 'balance.combatMatchups') : []) err('balance.combatMatchups', problem);
  for (const problem of b.balance?.combatIntent !== undefined ? combatIntentRulesProblems(b.balance.combatIntent, 'balance.combatIntent') : []) err('balance.combatIntent', problem);
  for (const problem of enemyKnowledgeRuleProblems({ version: 1, ...b.balance?.enemyKnowledge },
    new Set((Array.isArray(b.enemies) ? b.enemies : []).map(row => row?.id).filter(id => typeof id === 'string')))) err('balance.enemyKnowledge', problem);
  const schoolBuildup = b.balance && b.balance.arcaneExposure && b.balance.arcaneExposure.schoolBuildupMultipliers;
  if (!schoolBuildup || typeof schoolBuildup !== 'object' || Array.isArray(schoolBuildup)) {
    err('balance.arcaneExposure.schoolBuildupMultipliers', 'must be an explicit school map');
  } else {
    for (const [school, multiplier] of Object.entries(schoolBuildup)) {
      if (!DAMAGE_SCHOOLS.includes(school)) err(`balance.arcaneExposure.schoolBuildupMultipliers.${school}`, `unknown damage school '${school}'`);
      if (!Number.isFinite(multiplier) || multiplier < 0) err(`balance.arcaneExposure.schoolBuildupMultipliers.${school}`, 'must be finite and non-negative');
    }
  }
  for (const problem of attackCardDamageConfigProblems(b)) err(problem.path, problem.msg);
  ctx.eventsDoorOpen = eventsDoorOpen;
}
