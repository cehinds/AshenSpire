// Browser-safe rules adapter. Authored JSON is compiled by content-build; no
// combat state, RNG or rounding is owned by this module.
import { fixCoreMechanics as defaults } from '../content/generated/fixCoreMechanics.js';
import { fixCoreProtection } from '../content/generated/fixCoreProtection.js';
import { compileBindings, evaluateModifiers } from './mechanicsKernel.js';
const mechanics = new Map(fixCoreProtection);
const behaviorTags = new Set(fixCoreProtection.map(([, row]) => row.manifest.tag));

const finite = (value, label, min = 0, max = Infinity) => {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`FixCore ${label}: invalid number`);
};
export function validateFixCoreRules(rules) {
  if (rules?.version !== 1 || typeof rules.enabled !== 'boolean') throw new Error('FixCore rules require version 1 and enabled');
  for (const tag of rules.defaultTags || []) if (!behaviorTags.has(tag)) throw new Error(`FixCore unknown behavior tag ${tag}`);
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
export function protectionBindings(ctx, entity) {
  const rules = fixCoreRules(ctx);
  const ownerId = ctx?.playerIdForEntity?.(entity) || entity?.id;
  const attachments = [{ ownerId, sourceInstanceId: ownerId, kind: 'entity',
    tags: entity?.mechanicTags ?? rules.defaultTags, mechanicBindings: entity?.mechanicBindings || [], active: true },
    ...Object.entries(ctx?.propertyMounts?.[ownerId] || {}).map(([id, mount]) => ({
      ownerId, sourceInstanceId: id, kind: ['armour', 'armament', 'sigil'].includes(mount.kind) ? 'gear' : mount.kind,
      label: mount.name, tags: mount.mechanicTags || mount.scopeTags || [], mechanicBindings: mount.mechanicBindings || [], active: true }))];
  return compileBindings({ mechanics, attachments, moduleParameters: rules.protectionParameters || {} });
}
export function protectionReceipt(ctx, entity, kind, amount) {
  const ownerId = ctx?.playerIdForEntity?.(entity) || entity?.id;
  const receipt = evaluateModifiers({ bindings: fixCoreEnabled(ctx) ? protectionBindings(ctx, entity) : [],
    phase: 'damage.mitigation', subjectId: ownerId, context: { owner: entity, damageKind: kind }, amount, quantity: true });
  const sources = [...receipt.sources];
  if (receipt.rounding) sources.push({ id: 'rounding', label: 'Final damage rounding', stage: 'rounding', operation: 'add', amount: receipt.rounding });
  return { ...receipt, reduced: Math.max(0, amount - receipt.amount), sources };
}
export function damageReceipt(targetId, hits) {
  return { version: 1, targetId, hits, totalDamage: hits.reduce((sum, hit) => sum + hit.hpLoss, 0) };
}
