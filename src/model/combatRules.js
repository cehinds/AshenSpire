// Pure rules validation and arithmetic shared by execution and previews.
export function assertNumber(value, path, min = 0, max = Infinity) {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${path}: expected finite number in [${min}, ${max}]`);
}

export function validateCombatRules(rules, registries = null) {
  if (!rules || typeof rules.id !== 'string' || !rules.id) throw new Error('combat rules require an id');
  if (!rules.damageTypes || !Object.keys(rules.damageTypes).length) throw new Error('combat rules require damage types');
  for (const [id, type] of Object.entries(rules.damageTypes)) {
    if (typeof type.physical !== 'boolean' || typeof type.tag !== 'string') throw new Error(`damageTypes.${id}: invalid metadata`);
    if (registries && !registries.tags.some((tag) => tag.id === type.tag && tag.domain === 'damageType')) throw new Error(`damageTypes.${id}: unregistered damage tag '${type.tag}'`);
  }
  assertNumber(rules.armor?.scale, 'armor.scale', 1);
  assertNumber(rules.armor?.cap, 'armor.cap', 0, 1);
  assertNumber(rules.resistanceCap, 'resistanceCap', 0, 1);
  assertNumber(rules.vulnerabilityCap, 'vulnerabilityCap', 1);
  for (const group of ['family', 'grip', 'delivery']) {
    if (!rules.impact?.[group]) throw new Error(`impact.${group} required`);
    for (const [key, value] of Object.entries(rules.impact[group])) assertNumber(value, `impact.${group}.${key}`);
  }
  for (const key of ['minimum', 'protectionTurns']) assertNumber(rules.impact[key], `impact.${key}`, 1);
  for (const [key, value] of Object.entries(rules.dodge?.stamina || {})) assertNumber(value, `dodge.stamina.${key}`);
  for (const key of ['light', 'medium', 'heavy']) assertNumber(rules.dodge?.stamina[key], `dodge.stamina.${key}`);
  for (const key of ['actions', 'charges', 'usesPerTurn']) assertNumber(rules.dodge[key], `dodge.${key}`, key === 'actions' ? 0 : 1);
  for (const key of ['staminaPerTurn', 'manaPerTurn']) assertNumber(rules.recovery?.[key], `recovery.${key}`);
  for (const key of ['maxEvents', 'maxDepth', 'limitPerAction']) assertNumber(rules.triggers?.[key], `triggers.${key}`, 1);
  assertNumber(rules.triggers?.chance, 'triggers.chance', 0, 1);
  if (!['play', 'target', 'hit'].includes(rules.triggers?.rollScope)) throw new Error('invalid trigger rollScope');
  assertNumber(rules.stacking?.cap, 'stacking.cap', 1);
  validateSource(rules.fallbackSource, rules);
  return rules;
}

export function validateAttack(attack, rules = null) {
  if (!attack || typeof attack !== 'object' || Array.isArray(attack)) throw new Error('attack must be an object');
  const fields = ['source', 'hand', 'damageType', 'components', 'impactBonus', 'impactFactor', 'penetration', 'hitWeights', 'dodgeable', 'buildup'];
  for (const key of Object.keys(attack)) if (!fields.includes(key)) throw new Error(`unknown attack field '${key}'`);
  if (attack.source && !['weapon', 'spell', 'unarmed'].includes(attack.source)) throw new Error('invalid attack source');
  if (attack.hand && !['mainHand', 'offHand'].includes(attack.hand)) throw new Error('invalid attack hand');
  if (attack.damageType && (typeof attack.damageType !== 'string' || (rules && !(attack.damageType in rules.damageTypes)))) throw new Error('unknown attack damageType');
  for (const key of ['impactBonus', 'impactFactor', 'penetration']) if (attack[key] !== undefined) assertNumber(attack[key], `attack.${key}`);
  if (attack.dodgeable !== undefined && typeof attack.dodgeable !== 'boolean') throw new Error('dodgeable must be boolean');
  for (const row of attack.buildup || []) {
    if (typeof row.status !== 'string' || !row.status) throw new Error('attack buildup requires a status');
    assertNumber(row.amount, 'attack.buildup.amount');
  }
  if (attack.components !== undefined) {
    if (!Array.isArray(attack.components) || !attack.components.length) throw new Error('attack.components must be nonempty');
    for (const c of attack.components) {
      if (typeof c.type !== 'string' || (rules && !rules.damageTypes[c.type])) throw new Error(`unknown component type '${c.type}'`);
      assertNumber(c.weight, 'component.weight');
    }
    if (!attack.components.some((c) => c.weight > 0)) throw new Error('component weights must have a positive total');
  }
  if (attack.hitWeights !== undefined) {
    if (!Array.isArray(attack.hitWeights) || !attack.hitWeights.length) throw new Error('hitWeights must be nonempty');
    attack.hitWeights.forEach((w) => assertNumber(w, 'hitWeights'));
    if (!attack.hitWeights.some((w) => w > 0)) throw new Error('hitWeights require positive total');
  }
}

export function validateSource(source, rules) {
  if (!source || typeof source.id !== 'string') throw new Error('attack source requires id');
  assertNumber(source.weight, `${source.id}.weight`);
  if (!(source.family in rules.impact.family)) throw new Error(`${source.id}: unknown family '${source.family}'`);
  if (!(source.grip in rules.impact.grip)) throw new Error(`${source.id}: unknown grip '${source.grip}'`);
  if (!(source.damageType in rules.damageTypes)) throw new Error(`${source.id}: unknown damage type '${source.damageType}'`);
  for (const effect of source.buildup || []) {
    if (typeof effect.status !== 'string') throw new Error(`${source.id}: buildup requires status`);
    assertNumber(effect.amount, `${source.id}.buildup.amount`);
  }
}

export function validateCombatProfile(profile, rules) {
  if (!profile || typeof profile !== 'object') throw new Error('combat profile must be an object');
  assertNumber(profile.armor ?? 0, 'profile.armor');
  assertNumber(profile.impactResistance ?? 0, 'profile.impactResistance', 0, 1);
  for (const row of profile.resistanceSources || []) {
    if (typeof row.group !== 'string' || !row.group || !rules.damageTypes[row.type]) throw new Error('invalid resistance source group/type');
    assertNumber(row.amount, 'resistance source amount', 0, 1);
  }
  for (const [type, amount] of Object.entries(profile.resistances || {})) {
    if (!(type in rules.damageTypes)) throw new Error(`profile.resistances: unknown type '${type}'`);
    assertNumber(amount, `resistance.${type}`, 0, 1);
  }
  for (const type of profile.immunities || []) if (!(type in rules.damageTypes)) throw new Error(`unknown immunity '${type}'`);
  for (const source of Object.values(profile.sources || {})) validateSource(source, rules);
  if (profile.weightClass && !(profile.weightClass in rules.dodge.stamina)) throw new Error('unknown profile weight class');
}

/** Equivalent sources take the strongest resistance; separate groups compose. */
export function groupedResistance(rules, sources, base = {}) {
  const groups = new Map();
  for (const [type, amount] of Object.entries(base)) groups.set(`${type}:base`, { type, amount });
  for (const row of sources) {
    const key = `${row.type}:${row.group}`;
    groups.set(key, { type: row.type, amount: Math.max(groups.get(key)?.amount || 0, row.amount) });
  }
  const factors = {};
  for (const { type, amount } of groups.values()) factors[type] = (factors[type] ?? 1) * (1 - amount);
  return Object.fromEntries(Object.entries(factors).map(([type, factor]) => [type, Math.min(rules.resistanceCap, 1 - factor)]));
}

/** Stable largest-remainder allocation, conserving a single integer budget. */
export function allocateInteger(total, weights) {
  assertNumber(total, 'allocation.total');
  if (!weights.length) return [];
  weights.forEach((w) => assertNumber(w, 'allocation.weight'));
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) throw new Error('allocation requires positive total weight');
  const raw = weights.map((w) => Math.floor(total) * w / sum);
  const result = raw.map(Math.floor);
  const order = raw.map((v, i) => ({ i, fraction: v - result[i] })).sort((a, b) => b.fraction - a.fraction || a.i - b.i);
  let remainder = Math.floor(total) - result.reduce((a, b) => a + b, 0);
  for (const { i } of order) if (remainder-- > 0) result[i]++;
  return result;
}

export function resolveDamageComponents(rules, { components, armor = 0, penetration = 0, resistances = {}, immunities = [], multiplier = 1, flatBonus = 0 }) {
  if (!components.length) throw new Error('a direct hit needs damage components');
  assertNumber(armor, 'armor'); assertNumber(penetration, 'penetration'); assertNumber(multiplier, 'multiplier');
  if (!Number.isFinite(flatBonus)) throw new Error('flat damage bonus must be finite');
  components.forEach(({ type, amount }) => {
    if (!rules.damageTypes[type]) throw new Error(`unknown damage type '${type}'`);
    assertNumber(amount, 'damage component');
  });
  const weightTotal = components.reduce((sum, c) => sum + c.amount, 0);
  const effectiveArmor = Math.max(0, armor - penetration);
  const reduction = Math.min(rules.armor.cap, effectiveArmor / (effectiveArmor + rules.armor.scale));
  return components.map((component, index) => {
    const weight = weightTotal > 0 ? component.amount / weightTotal : (index === 0 ? 1 : 0);
    const resistance = Math.min(rules.resistanceCap, resistances[component.type] || 0);
    const physical = rules.damageTypes[component.type].physical;
    const amount = immunities.includes(component.type) ? 0 : Math.max(0, Math.floor(
      Math.max(0, component.amount + flatBonus * weight) * multiplier * (physical ? 1 - reduction : 1) * (1 - resistance),
    ));
    return { type: component.type, amount };
  });
}

export function weaponImpact(rules, source, { magical = false, bonus = 0, factor = 1 } = {}) {
  validateSource(source, rules); assertNumber(bonus, 'impact bonus'); assertNumber(factor, 'impact factor');
  const base = Math.max(rules.impact.minimum, Math.floor(source.weight * rules.impact.family[source.family]
    * rules.impact.grip[source.grip] * rules.impact.delivery[magical ? 'magical' : 'physical']));
  return Math.floor((base + bonus) * factor);
}

export function resolveStackApplications(applications, incoming, { mode, cap = 99, refresh = true }) {
  if (!['add', 'refresh', 'replace', 'strongest', 'independent', 'unique'].includes(mode)) throw new Error(`unknown stack mode '${mode}'`);
  assertNumber(cap, 'stack cap', 1); assertNumber(incoming.value, 'stack value');
  const previous = applications.map((a) => ({ ...a }));
  if (mode === 'replace' || mode === 'unique') return [{ ...incoming, value: mode === 'unique' ? 1 : Math.min(cap, incoming.value) }];
  if (mode === 'add' || mode === 'refresh') {
    const old = previous[0];
    return [{ ...incoming, value: Math.min(cap, mode === 'add' ? (old?.value || 0) + incoming.value : (old?.value ?? incoming.value)),
      expires: refresh ? incoming.expires : (old?.expires ?? incoming.expires) }];
  }
  const same = previous.findIndex((a) => a.sourceId === incoming.sourceId);
  if (same >= 0) previous[same] = { ...incoming }; else previous.push({ ...incoming });
  return previous;
}

export function stackMagnitude(applications, mode, cap) {
  const values = applications.map((a) => a.value);
  return Math.min(cap, mode === 'strongest' ? Math.max(0, ...values) : values.reduce((a, b) => a + b, 0));
}
