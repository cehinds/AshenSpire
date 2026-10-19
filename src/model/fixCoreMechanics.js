// Browser-safe rules adapter. Authored JSON is compiled by content-build; no
// combat state, RNG or rounding is owned by this module.
import { fixCoreMechanics as defaults } from '../content/generated/fixCoreMechanics.js';
import { fixCoreProtection } from '../content/generated/fixCoreProtection.js';
import { compileBindings, evaluateModifiers, queryBinding, parameterDefaults } from './mechanicsKernel.js';
const mechanics = new Map(fixCoreProtection);
const behaviorTags = new Set(fixCoreProtection.map(([, row]) => row.manifest.tag));

const families = ['stance','accuracy','perception','statuses','actionCosts'];
export function fixCoreModuleParameters(rules = defaults) {
  return { ...rules.protectionParameters, ...Object.fromEntries(families.map(id => [`combat.${id}`,
    id === 'actionCosts' ? {enemyHealBlockCost:rules.enemyHealBlockCost} : rules[id]])) };
}
const OLD_PERCEPTION_FIELDS = ['levelBaseline','intelligenceBaseline','levelWeight','intelligenceWeight'];
// Pure v1 -> current migration for persisted rules: a perception block saved
// before bonuses[] keeps baseDC, drops the four retired fields and gets
// bonuses: []. Current-shape rules are returned untouched (same object).
export function normalizeFixCoreRules(rules) {
  const p = rules?.perception;
  if (!p || typeof p !== 'object' || !OLD_PERCEPTION_FIELDS.some(key => Object.hasOwn(p, key))) return rules;
  const perception = { ...p };
  for (const key of OLD_PERCEPTION_FIELDS) delete perception[key];
  if (perception.bonuses === undefined) perception.bonuses = [];
  return { ...rules, perception };
}
const rawRules = ctx => normalizeFixCoreRules(ctx?.fixCoreRules || ctx?.gameProfile?.fixCoreRules || defaults);
export function validateFixCoreRules(rules) {
  if (rules?.version !== 1 || typeof rules.enabled !== 'boolean') throw new Error('FixCore rules require version 1 and enabled');
  const known = new Set(['version','enabled','defaultTags','protectionParameters',...families.filter(id=>id!=='actionCosts'),'enemyHealBlockCost']);
  for(const key of Object.keys(rules)) if(!known.has(key)) throw new Error(`FixCore unknown configuration field ${key}`);
  for (const tag of rules.defaultTags || []) if (!behaviorTags.has(tag)) throw new Error(`FixCore unknown behavior tag ${tag}`);
  compileBindings({mechanics,moduleParameters:fixCoreModuleParameters(rules),attachments:[{
    ownerId:'rules',sourceInstanceId:'rules',kind:'run',tags:families.map(id=>`combat:${id}`)}]});
  return rules;
}
validateFixCoreRules(defaults);
// Only active sources enter this adapter: worn mounts, current status instances,
// an actor and an optional card's play window. Inventory is never consulted.
export function fixCoreAttachments(ctx,entity,carrier=null) {
  if (!entity) return [];
  const rules=rawRules(ctx), ownerId=ctx?.playerIdForEntity?.(entity) || entity.id;
  const table=entity.kind==='enemy' ? ctx?.registries?.enemies : null;
  const definitionId=entity.enemyId || entity.classId;
  const definition=table?.has?.(definitionId) ? table.get(definitionId) : {};
  const rows=[{ownerId,sourceInstanceId:ownerId,kind:'entity',tags:entity.mechanicTags ?? definition.mechanicTags ?? rules.defaultTags,
    mechanicBindings:entity.mechanicBindings ?? definition.mechanicBindings ?? []}];
  for(const [id,mount] of Object.entries(ctx?.propertyMounts?.[ownerId] || {})) rows.push({ownerId,sourceInstanceId:id,
    kind:({armour:'gear',armament:'gear',sigil:'gear',class:'character',feat:'character',companion:'entity'})[mount.kind] || mount.kind,
    label:mount.name,tags:mount.mechanicTags || mount.scopeTags || [],mechanicBindings:mount.mechanicBindings || []});
  for(const [id,instance] of Object.entries(entity.statuses || {})) {
    if (!(instance.stacks>0 || instance.meter?.value>0)) continue;
    const def=ctx?.registries?.statuses?.get(id);
    if(def?.mechanicTags || def?.mechanicBindings) rows.push({ownerId,sourceInstanceId:`status:${id}`,kind:'status',tags:def.mechanicTags || [],mechanicBindings:def.mechanicBindings || []});
  }
  if(carrier && (carrier.mechanicTags || carrier.mechanicBindings)) rows.push({ownerId,sourceInstanceId:`card:${carrier.instanceId || carrier.cardId || carrier.moveId || 'active'}`,kind:'card',tags:carrier.mechanicTags || [],mechanicBindings:carrier.mechanicBindings || []});
  return rows;
}
export function fixCoreRules(ctx,entity=null,carrier=null) {
  const raw=rawRules(ctx), moduleParameters=fixCoreModuleParameters(raw);
  if(raw!==defaults) validateFixCoreRules(raw);
  const bindings=compileBindings({mechanics,moduleParameters,attachments:[{ownerId:'rules',sourceInstanceId:'rules',kind:'run',tags:families.map(id=>`combat:${id}`)},...fixCoreAttachments(ctx,entity,carrier)]});
  const result={...raw};
  for(const family of families) {
    const candidates=bindings.filter(binding=>binding.mechanicId===`combat.${family}`);
    const attached=candidates.filter(binding=>binding.ownerId!=='rules');
    // Config queries are exclusive replacements. Ambiguous equipped sources
    // are rejected instead of silently taking an object iteration winner.
    if(attached.length>1) throw new Error(`Conflicting ${family} rule attachments: ${attached.map(row=>row.sourceInstanceId).join(', ')}`);
    const value=queryBinding(attached[0] || candidates[0],'parameters');
    if(family==='actionCosts') result.enemyHealBlockCost=value.enemyHealBlockCost;else result[family]=value;
  }
  return result;
}
export function fixCoreEnabled(ctx) { return ctx?.combatExpansionVersion === 2 && (ctx?.fixCoreRules?.version === 1 || ctx?.gameProfile?.modules?.effects?.fixCoreVersion === 1) && rawRules(ctx).enabled; }
export function protectionBindings(ctx, entity, carrier=null) {
  return compileBindings({ mechanics, attachments:fixCoreAttachments(ctx,entity,carrier), moduleParameters:fixCoreModuleParameters(rawRules(ctx)) });
}
export function protectionReceipt(ctx, entity, kind, amount) {
  // Detached preview targets may omit inactive pools. Normalize only the
  // read model; live entities and strict mechanic reference validation stay intact.
  const owner = entity ? {...entity, persistentWard: entity.persistentWard ?? {value:0,max:0},
    persistentPoise: entity.persistentPoise ?? {value:0,max:0}} : entity;
  const ownerId = ctx?.playerIdForEntity?.(entity) || entity?.id;
  const receipt = evaluateModifiers({ bindings: fixCoreEnabled(ctx) && amount > 0 ? protectionBindings(ctx, entity) : [],
    phase: 'damage.mitigation', subjectId: ownerId, context: { owner, damageKind: kind }, amount, quantity: true });
  const sources = [...receipt.sources];
  if (receipt.rounding) sources.push({ id: 'rounding', label: 'Final damage rounding', stage: 'rounding', operation: 'add', amount: receipt.rounding });
  return { ...receipt, reduced: Math.max(0, amount - receipt.amount), sources };
}
export function damageReceipt(targetId, hits) {
  return { version: 1, targetId, hits, totalDamage: hits.reduce((sum, hit) => sum + hit.hpLoss, 0) };
}

// Read-only status projection for cards, PIPs, logs and inspectors. The base
// registry is explicit so UI facades cannot recursively query themselves.
export function fixCoreStatusDefinition(ctx, id, baseDefinition) {
  const base = baseDefinition ?? ctx?.registries?.statuses?.get(id);
  if (!fixCoreEnabled(ctx)) return base;
  const rules = fixCoreRules(ctx), overrides = rules.statuses.overrides?.[id];
  const row = overrides ? {...base,...overrides} : {...base};
  const facts = {
    weak: `Attack rating ×${rules.statuses.weakARMultiplier} while active.`,
    vulnerable: `Damage taken ×${rules.statuses.vulnerabilityMultiplier} while active.`,
    staggered: 'Interrupts the next action; inflicts Weak and Vulnerable.',
    evade: `Evasion +${rules.accuracy.evasionPerStack} per stack.`,
    precision: `Precision +${rules.accuracy.precisionPerStack} per stack.`,
  };
  if (facts[id]) row.tooltip = row.description = `${facts[id]} Applications add stacks. Lose ${rules.statuses.decayAmount} stack at the start of the owner's turn each round.`;
  return row;
}

export function fixCoreProtectionDescription(ctx,entity,kind) {
  if (!fixCoreEnabled(ctx) || !entity) return null;
  const damageKind = kind === 'ward' || kind === 'magical' ? 'magical' : 'physical';
  const shadow = {...entity,persistentWard:{...entity.persistentWard,value:1},persistentPoise:{...entity.persistentPoise,value:1}};
  const receipt = protectionReceipt(ctx,shadow,damageKind,100);
  return `While active, reduces ${damageKind} damage by ${receipt.reduced}%. The prevented damage spends this pool. Block cards restore both Poise and Ward by their Block amount, up to each maximum.`;
}

export function snapshotFixCoreRules(ctx) {
  const rules=structuredClone(fixCoreRules(ctx));
  rules.protectionParameters=Object.fromEntries(fixCoreProtection.filter(([id])=>id.startsWith('defense.')).map(([id,row])=>[id,{...parameterDefaults(row.manifest.parameters),...(rules.protectionParameters?.[id] || {})}]));
  return validateFixCoreRules(rules);
}
