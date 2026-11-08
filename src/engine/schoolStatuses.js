// School statuses (owner, 2026-11-07; SPEC 4.7 "School statuses"). Headless. In a Core 2 fight under damage.unified, a landed hit that
// costs HP gives its target the status of the hit's school, once per action per target (the carrier's combatRiderTargets budget), unless the
// card already prints that status. The data is `schoolStatuses` in content/source/fixCoreMechanics.json. It replaces the damage-type riders
// (combatMatchups.damageRiders), which never run in the configured Core path.
import { schoolOf, canonicalDamageType } from '../model/combatRatings.js';
import { fixCoreSchoolStatuses } from '../model/fixCoreMechanics.js';
import { expansionMatchupRules } from './combatMatchups.js';

/** The table row a hit's school (else its damage type, through the matchup aliases) selects, or null. */
export function schoolStatusRow(ctx, carrier) {
  const table = fixCoreSchoolStatuses(ctx);
  const profile = carrier?.combatProfile;
  if (!table || !profile) return null;
  const tagged = { ...profile, tags: carrier.tags || carrier.cardTags || profile.tags };
  const school = schoolOf(tagged);
  if (school) {
    const key = table.schoolAliases?.[school] || school;
    if (Object.hasOwn(table.schools, key)) return table.schools[key];
  }
  const aliases = expansionMatchupRules(ctx).damageAliases || {};
  const raw = canonicalDamageType(profile.damageType) || profile.damageType;
  const type = aliases[raw] || raw;
  if (type && Object.hasOwn(table.damageTypes, type)) return table.damageTypes[type];
  for (const part of profile.damageComponents || []) {
    const t = aliases[canonicalDamageType(part?.type) || part?.type] || canonicalDamageType(part?.type) || part?.type;
    if (t && Object.hasOwn(table.damageTypes, t)) return table.damageTypes[t];
  }
  return null;
}

/** The effects to enqueue for one landed hit (empty when none applies). Spends the once-per-action-and-target budget when it returns any. */
export function schoolStatusEffects(ctx, source, target, carrier, { hpLoss = 0 } = {}) {
  if (!(hpLoss > 0) || !target || carrier?.combatReaction || carrier?.counterReturnAttack || carrier?.reflectedHit) return [];
  const row = schoolStatusRow(ctx, carrier);
  if (!row) return [];
  const key = ctx.playerIdForEntity?.(target) || target.id, seen = carrier.combatRiderTargets;
  if (seen?.includes(key)) return [];
  const effects = [];
  if (target.alive && row.status && !carrier.appliedStatuses?.includes(row.status) && ctx.registries?.statuses?.has(row.status)) effects.push({ op: 'applyStatus', status: row.status, stacks: row.stacks });
  if (target.alive && row.wardStrip && (target.statuses?.ward?.stacks || 0) > 0) effects.push({ op: 'removeStatus', status: 'ward', amount: row.wardStrip });
  if (row.cleanse && source?.alive) {
    const status = expansionMatchupRules(ctx).cleanseStatuses?.find(id => source.statuses?.[id] && ctx.registries?.statuses?.has(id));
    if (status) effects.push({ op: 'removeStatus', target: 'self', status, amount: row.cleanse });
  }
  if (effects.length && seen) seen.push(key);
  return effects;
}
