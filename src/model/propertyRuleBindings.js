// Rebind normalized magnitudes against this bundle's configuration. Mounts
// already held by a combat are immutable; only registry composition calls this.
import { resolveVariable } from './tree.js';

export function configuredPropertyRules(bundle) {
  const rows = bundle.propertyRules || [];
  if (!bundle.nodeEffects || !Array.isArray(bundle.variableBindings) || !bundle.variableBindings.length) return rows;
  const bind = (value, authored, tag) => {
    if (authored && typeof authored === 'object' && Object.keys(authored).length === 1 && typeof authored.variable === 'string') {
      const resolved = resolveVariable(bundle, tag, authored.variable);
      if (!Number.isFinite(resolved)) throw new Error(`Property '${tag}' variable '${authored.variable}' has no finite balance binding`);
      return resolved;
    }
    if (Array.isArray(value)) return value.map((child, i) => bind(child, authored?.[i], tag));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, bind(child, authored?.[key], tag)]));
    return value;
  };
  return rows.map(row => bundle.nodeEffects[row.tag] ? bind(row, bundle.nodeEffects[row.tag], row.tag) : row);
}
