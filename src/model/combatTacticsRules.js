// Saved tactical tuning is authoritative for the rest of that fight.
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.length > 0;
const nonNegative = value => Number.isFinite(value) && value >= 0;
const whole = value => Number.isSafeInteger(value) && value >= 0;

export function combatIntentRulesProblems(rules, path = 'combatIntentRules') {
  if (!record(rules)) return [`${path} must be an object`];
  const keys = ['baseHiddenChance', 'wisdomReduction', 'intelligenceReduction', 'minimumHiddenChance', 'maximumHiddenChance'];
  const problems = Object.keys(rules).filter(key => !keys.includes(key)).map(key => `${path}.${key} is unknown`);
  for (const key of keys) if (!nonNegative(rules[key]) || rules[key] > 1) problems.push(`${path}.${key} must be a probability from 0 to 1`);
  if (rules.minimumHiddenChance > rules.maximumHiddenChance) problems.push(`${path}.minimumHiddenChance cannot exceed maximumHiddenChance`);
  return problems;
}

export function combatMatchupRulesProblems(rules, path = 'combatMatchupRules') {
  if (!record(rules)) return [`${path} must be an object`];
  const problems = [];
  const object = (value, at, keys) => {
    if (!record(value)) { problems.push(`${at} must be an object`); return false; }
    for (const key of Object.keys(value)) if (!keys.includes(key)) problems.push(`${at}.${key} is unknown`);
    return true;
  };
  const numeric = (value, at, integer = false) => {
    if (!(integer ? whole(value) : nonNegative(value))) problems.push(`${at} must be a finite non-negative ${integer ? 'whole number' : 'number'}`);
  };
  const list = (value, at) => {
    if (!Array.isArray(value) || value.some(item => !text(item)) || new Set(value).size !== value.length) problems.push(`${at} must contain unique non-empty strings`);
  };
  object(rules, path, ['counter', 'smash', 'attack', 'damageRiders', 'damageAliases', 'cleanseStatuses']);
  const counterNumbers = ['incomingMultiplier', 'retaliationMultiplier', 'retaliationFlat', 'poiseMultiplier', 'guard', 'ward', 'defaultDamage'];
  if (object(rules.counter, `${path}.counter`, [...counterNumbers, 'meleeBypassDamageTypes', 'meleeIncomingManeuvers'])) {
    for (const key of counterNumbers) numeric(rules.counter[key], `${path}.counter.${key}`, !key.endsWith('Multiplier'));
    list(rules.counter.meleeBypassDamageTypes, `${path}.counter.meleeBypassDamageTypes`);
    list(rules.counter.meleeIncomingManeuvers, `${path}.counter.meleeIncomingManeuvers`);
  }
  if (object(rules.smash, `${path}.smash`, ['guardedMultiplier', 'guardBreakPoiseBonus'])) {
    numeric(rules.smash.guardedMultiplier, `${path}.smash.guardedMultiplier`);
    numeric(rules.smash.guardBreakPoiseBonus, `${path}.smash.guardBreakPoiseBonus`, true);
  }
  if (object(rules.attack, `${path}.attack`, ['preparedPoiseMultiplier'])) numeric(rules.attack.preparedPoiseMultiplier, `${path}.attack.preparedPoiseMultiplier`);
  if (!record(rules.damageRiders)) problems.push(`${path}.damageRiders must be an object`);
  else for (const [type, rider] of Object.entries(rules.damageRiders)) {
    const at = `${path}.damageRiders.${type}`;
    if (!text(type)) problems.push(`${at} requires a damage type`);
    if (!object(rider, at, ['status', 'stacks', 'requiresHpLoss', 'poise', 'guardBypass', 'wardDrain', 'cleanse'])) continue;
    for (const key of ['stacks', 'poise', 'guardBypass', 'wardDrain', 'cleanse']) if (rider[key] !== undefined) numeric(rider[key], `${at}.${key}`, true);
    if (rider.status !== undefined && !text(rider.status)) problems.push(`${at}.status must be a non-empty string`);
    if (rider.status !== undefined && rider.stacks === undefined) problems.push(`${at}.stacks is required for a status rider`);
    if (rider.requiresHpLoss !== undefined && typeof rider.requiresHpLoss !== 'boolean') problems.push(`${at}.requiresHpLoss must be boolean`);
  }
  if (!record(rules.damageAliases) || Object.entries(rules.damageAliases).some(([key, value]) => !text(key) || !text(value))) problems.push(`${path}.damageAliases must map non-empty damage type strings`);
  list(rules.cleanseStatuses, `${path}.cleanseStatuses`);
  return problems;
}

export function combatCounterProblems(counter, path) {
  if (!record(counter)) return [`${path} must be an object`];
  const problems = [];
  if (counter.charges !== 1) problems.push(`${path}.charges must be 1 for an armed reaction`);
  if (!['melee', 'ranged', 'spell', 'magic'].includes(counter.mode)) problems.push(`${path}.mode must name a supported Counter mode`);
  for (const key of ['damage', 'poiseDamage', 'bonus']) if (!nonNegative(counter[key])) problems.push(`${path}.${key} must be finite and non-negative`);
  if (counter.expiresOnTurn !== undefined && (!Number.isSafeInteger(counter.expiresOnTurn) || counter.expiresOnTurn < 1)) problems.push(`${path}.expiresOnTurn must be a positive whole number`);
  if (!record(counter.carrier) || !record(counter.carrier.combatProfile)) problems.push(`${path}.carrier must preserve its combat profile`);
  return problems;
}
