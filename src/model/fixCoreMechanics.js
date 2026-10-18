// Browser-safe rules adapter. Authored JSON is compiled by content-build; no
// combat state, RNG or rounding is owned by this module.
import { fixCoreMechanics as defaults } from '../content/generated/fixCoreMechanics.js';

const finite = (value, label, min = 0, max = Infinity) => {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`FixCore ${label}: invalid number`);
};
export function validateFixCoreRules(rules) {
  if (rules?.version !== 1 || typeof rules.enabled !== 'boolean') throw new Error('FixCore rules require version 1 and enabled');
  for (const [tag, row] of Object.entries(rules.definitions || {})) {
    if (!tag.includes(':') || !['physical', 'magical'].includes(row.damageKind)
      || !['persistentWard', 'persistentPoise'].includes(row.pool) || !row.group) throw new Error(`FixCore invalid protection ${tag}`);
    finite(row.multiplier, `${tag}.multiplier`, 0, 1);
  }
  for (const tag of rules.defaultTags || []) if (!rules.definitions[tag]) throw new Error(`FixCore unknown behavior tag ${tag}`);
  for (const section of ['stance', 'perception']) for (const [key, value] of Object.entries(rules[section] || {})) finite(value, `${section}.${key}`);
  return rules;
}
validateFixCoreRules(defaults);
export function fixCoreRules(ctx) {
  const rules = ctx?.fixCoreRules || ctx?.gameProfile?.fixCoreRules || defaults;
  return rules === defaults ? rules : validateFixCoreRules(rules);
}
export function fixCoreEnabled(ctx) { return ctx?.combatExpansionVersion === 2 && (ctx?.fixCoreRules?.version === 1 || ctx?.gameProfile?.modules?.effects?.fixCoreVersion === 1) && fixCoreRules(ctx).enabled; }

// Attachment identity remains owner/source specific. Existing property mounts
// supply equipped sources; inventory records are deliberately never scanned.
export function protectionBindings(ctx, entity, kind) {
  const rules = fixCoreRules(ctx);
  if (!rules.enabled) return [];
  const ownerId = ctx?.playerIdForEntity?.(entity) || entity?.id;
  const authored = entity?.mechanicBindings;
  const sources = [{ id: ownerId, label: entity?.name || 'Base protection',
    tags: entity?.mechanicTags ?? rules.defaultTags, bindings: authored || [] },
    ...Object.entries(ctx?.propertyMounts?.[ownerId] || {}).map(([id, mount]) => ({
      id, label: mount.name || mount.id, tags: mount.mechanicTags || mount.scopeTags || [], bindings: mount.mechanicBindings || [] }))];
  const out = [];
  for (const source of sources) {
    const explicit = new Map();
    for (const binding of source.bindings) {
      if (!rules.definitions[binding.tag]) throw new Error(`FixCore unknown behavior tag ${binding.tag}`);
      if (explicit.has(binding.tag)) throw new Error(`FixCore duplicate binding ${source.id}:${binding.tag}`);
      if (Object.keys(binding.parameters || {}).some(key => key !== 'multiplier')) throw new Error(`FixCore unknown protection parameter ${binding.tag}`);
      explicit.set(binding.tag, binding);
    }
    for (const tag of new Set([...source.tags, ...explicit.keys()])) {
      const definition = rules.definitions[tag];
      if (!definition || definition.damageKind !== kind) continue;
      const binding = explicit.get(tag);
      if (binding?.enabled === false || !(entity?.[definition.pool]?.value > 0)) continue;
      const multiplier = binding?.parameters?.multiplier ?? definition.multiplier;
      finite(multiplier, `${tag}.multiplier`, 0, 1);
      out.push({ id: `${ownerId}/${source.id}/${tag}`, label: `${source.label}: ${definition.pool === 'persistentWard' ? 'Ward' : 'Poise'}`,
        group: definition.group, pool: definition.pool, multiplier, stage: 'mitigation', operation: 'multiply' });
    }
  }
  // A baseline and enhanced equipped copy in one group choose the strongest;
  // distinct authored groups compose in a stable order.
  const groups = new Map();
  for (const row of out.sort((a,b) => a.id.localeCompare(b.id))) if (!groups.has(row.group) || groups.get(row.group).multiplier > row.multiplier) groups.set(row.group, row);
  return [...groups.values()].sort((a,b) => a.group.localeCompare(b.group));
}
export function protectionReceipt(ctx, entity, kind, amount) {
  let value = amount;
  const sources = [];
  if (fixCoreEnabled(ctx)) for (const binding of protectionBindings(ctx, entity, kind)) {
    const next = value * binding.multiplier;
    sources.push({ ...binding, amount: next - value }); value = next;
  }
  // Fractions survive all modifiers; only the final damage quantity rounds.
  const final = Math.max(0, Math.floor(value));
  return { amount: final, reduced: Math.max(0, amount - final), sources };
}
export function damageReceipt(targetId, hits) {
  return { version: 1, targetId, hits, totalDamage: hits.reduce((sum, hit) => sum + hit.hpLoss, 0) };
}
