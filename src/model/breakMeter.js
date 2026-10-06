import { resolveVariable, nodeTokens } from './tree.js';

// SPEC §13.4p: absence of the run/fight stamp always keeps the older rules.
export function usesSingleBreakMeter(context) {
  return !!context?.ratingsRules && context.ratingsRules.enabled !== false && context.breakMeterVersion === 1;
}

export function breakMeterIds(context) {
  return usesSingleBreakMeter(context) ? ['poise'] : ['poise', 'ward'];
}

// A content variant replaces only its named fields; the old face stays authored
// for older runs. Properties are re-mounted from the fight's own stamp on load.
export function breakPropertyRule(context, rule) {
  if (!usesSingleBreakMeter(context)) return rule;
  // Resolve the author's variables against this run's configured balance,
  // rather than import-time numbers, so Advanced settings price the same hit.
  const resolve = value => {
    if (Array.isArray(value)) return value.map(resolve);
    if (!value || typeof value !== 'object') return value;
    if (typeof value.variable === 'string') return resolveVariable(context.registries, rule.tag, value.variable);
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, resolve(child)]));
  };
  const authored = context.registries.nodeEffects?.[rule.tag];
  const variant = { ...rule, ...(authored ? resolve(authored) : {}), ...resolve(authored?.singleBreak || rule.singleBreak || {}) };
  return { ...variant, triggers: (variant.triggers || []).map(trigger =>
    trigger.on === 'arcaneBreak' ? { ...trigger, on: 'arcaneStagger' } : trigger) };
}

/** Scoped property prose, with the same configured variables as its mounted rule. */
export function breakPropertyText(registries, tag, { breakMeterVersion = registries.breakMeterVersion, ...scope } = {}) {
  if (!registries.propertyRules?.has(tag)) return '';
  const rule = breakPropertyRule({ registries, ratingsRules: registries.balance.combatRatings, breakMeterVersion }, registries.propertyRules.get(tag));
  const tokens = nodeTokens(registries, tag, scope);
  return String(rule.textTemplate || '').replace(/\{(\w+)\}/g, (match, name) => tokens[name] === undefined ? match : String(tokens[name]));
}
