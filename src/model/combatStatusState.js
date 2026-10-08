// Saved combat-only state is checked before any runtime methods are attached.
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonnegative = value => Number.isFinite(value) && value >= 0;
const whole = value => Number.isSafeInteger(value) && value >= 0;
export function statusControlProblems(entity, path, { required = false, rules = null } = {}) {
  const problems = [];
  const ward = entity?.persistentWard;
  if (ward !== undefined || required) {
    if (!record(ward) || !whole(ward.max) || !whole(ward.value) || ward.value > ward.max) problems.push(`${path}.persistentWard must contain whole max/value with 0 <= value <= max`);
    else if (Object.keys(ward).some(key => !['max', 'value'].includes(key))) problems.push(`${path}.persistentWard contains unknown fields`);
  }
  const s = entity?.statusControl;
  if (s === undefined && !required) return problems;
  if (!record(s)) return [...problems, `${path}.statusControl must be an object`];
  const prefix = `${path}.statusControl`;
  const keys = ['version', 'gauges', 'sleepHpRestored', 'sleepWardGranted', 'sleepWardContribution', 'wardRestoreCarry', 'wardDamageCarry', 'wardAllowances', 'resolveNextTurn', 'resolveActive', 'ownerCycle', 'lastRecoveryCycle', 'lastSleepCycle', 'completedActions'];
  for (const key of Object.keys(s)) if (!keys.includes(key)) problems.push(`${prefix}.${key} is unknown`);
  if (s.version !== 1) problems.push(`${prefix}.version must be 1`);
  for (const key of ['sleepWardGranted', 'resolveNextTurn', 'resolveActive']) if (typeof s[key] !== 'boolean') problems.push(`${prefix}.${key} must be boolean`);
  if (!whole(s.sleepHpRestored) || s.sleepHpRestored > (rules?.sleep?.hpCombatCap ?? 6)) problems.push(`${prefix}.sleepHpRestored exceeds its whole combat budget`);
  if (!nonnegative(s.sleepWardContribution) || s.sleepWardContribution > (rules?.sleep?.wardCombatCap ?? 1)) problems.push(`${prefix}.sleepWardContribution exceeds its combat budget`);
  for (const key of ['wardRestoreCarry', 'wardDamageCarry']) if (!nonnegative(s[key]) || s[key] >= 1) problems.push(`${prefix}.${key} must be a fractional carry in [0, 1)`);
  if (!whole(s.ownerCycle)) problems.push(`${prefix}.ownerCycle must be a whole owner cycle`);
  if (!Number.isSafeInteger(s.lastRecoveryCycle) || s.lastRecoveryCycle < -1 || s.lastRecoveryCycle > s.ownerCycle) problems.push(`${prefix}.lastRecoveryCycle must be between -1 and ownerCycle`);
  if (s.lastSleepCycle !== undefined && (!whole(s.lastSleepCycle) || s.lastSleepCycle > s.ownerCycle)) problems.push(`${prefix}.lastSleepCycle must be within ownerCycle`);
  for (const key of ['wardAllowances', 'completedActions']) if (!record(s[key]) || Object.entries(s[key]).some(([id, value]) => !id || typeof value !== 'boolean')) problems.push(`${prefix}.${key} must map non-empty ids to booleans`);
  if (!record(s.gauges)) problems.push(`${prefix}.gauges must be an object`);
  else for (const [id, gauge] of Object.entries(s.gauges)) {
    const at = `${prefix}.gauges.${id}`;
    if (!id || (rules && !rules.statuses?.[id])) problems.push(`${at} names an unknown ailment`);
    if (!record(gauge) || !nonnegative(gauge.value) || !['physical', 'spell'].includes(gauge.camp) || !['bodily', 'elemental', 'mental', 'curse'].includes(gauge.recoveryProfile)) problems.push(`${at} requires finite buildup, a source camp, and a recovery profile`);
    else if (Object.keys(gauge).some(key => !['value', 'camp', 'recoveryProfile'].includes(key))) problems.push(`${at} contains unknown fields`);
  }
  return problems;
}
