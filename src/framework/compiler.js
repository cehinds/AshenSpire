// src/framework/compiler.js — the deterministic property compiler (framework
// contract: Deterministic compiler).
//
// Precedence is temporary combat restriction, explicit card exception, rune or
// upgrade, equipment, class or relic, property default, then system fallback.
// A conflict never resolves by incidental file order: every merge point sorts
// on (sourcePrecedence, propertyPriority, propertyId, sourceEntityId) and an
// unresolved CONFLICTS_WITH throws rather than picking a survivor.

import { SchemaError } from './schema.js';

export class CompileError extends Error {
  constructor(entityId, message) {
    super(`compile ${entityId}: ${message}`);
    this.name = 'CompileError';
    this.entityId = entityId;
  }
}

// PropertyInstance.source → precedence band. Lower rank wins a same-property
// merge. STATUS carries temporary combat restrictions; AUTHORED rows on the
// entity are its explicit exceptions; defaultParameters sit below every
// instance (PROPERTY_DEFAULT) and the kind's systemDefaults at the bottom.
const SOURCE_RANK = Object.freeze({
  STATUS: 0, // TEMPORARY_COMBAT_RESTRICTION
  AUTHORED: 1, // EXPLICIT_CARD_EXCEPTION
  RUNE: 2,
  EQUIPMENT: 3,
  CLASS: 4,
  RELIC: 4,
  SYSTEM_DEFAULT: 6,
});

// Closed predicate table for PropertyRelation.condition. An unknown predicate
// name is a schema defect, not a silent pass.
const PREDICATES = Object.freeze({
  always: () => true,
  hasRepeatLimiter: (instances) => instances.some((p) => p.propertyId.startsWith('cost.')
    || p.propertyId === 'lifecycle.exhaust' || p.propertyId === 'lifecycle.seal'),
});

function rankOf(instance, entityId) {
  const rank = SOURCE_RANK[instance.source];
  if (rank == null) throw new CompileError(entityId, `unknown property source ${JSON.stringify(instance.source)}`);
  return rank;
}

function instanceSortKey(a, b, entityId) {
  const byRank = rankOf(a, entityId) - rankOf(b, entityId);
  if (byRank) return byRank;
  if (a._priority !== b._priority) return a._priority - b._priority;
  if (a.propertyId !== b.propertyId) return a.propertyId < b.propertyId ? -1 : 1;
  const sa = a.sourceEntityId || '';
  const sb = b.sourceEntityId || '';
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

export function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

/**
 * compileEntity(registries, entityId, context) — deterministic, side-effect
 * free, returns a deep-frozen CompiledEntity.
 *
 * context (all optional):
 *   classProperties / equipmentProperties / runeProperties / relicProperties /
 *   statusProperties: List<PropertyInstance> from the live run state.
 *   systemDefaults(kind): List<PropertyInstance> for the entity kind.
 *   runtimeModifiers: List<{op:'set'|'add', path, value}> applied last, in order.
 */
export function compileEntity(registries, entityId, context = {}) {
  const { properties: props } = registries;
  const entity = registries.content.require(entityId);

  // 1. collect — every contributing source, tagged and checked.
  let instances = [];
  const add = (list, fallbackSource) => {
    for (const row of list || []) {
      if (!props.has(row.propertyId)) {
        throw new CompileError(entityId, `unknown property ${JSON.stringify(row.propertyId)} from ${row.source || fallbackSource}`);
      }
      const def = props.require(row.propertyId);
      instances.push({
        propertyId: row.propertyId,
        parameters: row.parameters ? { ...row.parameters } : undefined,
        source: row.source || fallbackSource,
        sourceEntityId: row.sourceEntityId,
        _priority: def.priority,
        _implied: false,
      });
    }
  };
  add(context.systemDefaults ? context.systemDefaults(entity.kind) : [], 'SYSTEM_DEFAULT');
  add(context.classProperties, 'CLASS');
  add(entity.properties, 'AUTHORED');
  add(context.equipmentProperties, 'EQUIPMENT');
  add(context.runeProperties, 'RUNE');
  add(context.relicProperties, 'RELIC');
  add(context.statusProperties, 'STATUS');

  // 2. expandParents — a property implies its whole parent chain, carried at
  // the child's source so family checks (REQUIRES on a root) see it.
  const present = new Set(instances.map((p) => p.propertyId));
  for (const inst of [...instances]) {
    for (const ancestorId of props.ancestorsOf(inst.propertyId)) {
      if (!present.has(ancestorId)) {
        present.add(ancestorId);
        const def = props.require(ancestorId);
        instances.push({
          propertyId: ancestorId, source: inst.source, sourceEntityId: inst.sourceEntityId,
          _priority: def.priority, _implied: true,
        });
      }
    }
  }

  // 3. replacement and suppression — relation-driven, precedence-ordered so
  // the outcome is a function of the data, never of row order.
  const orderedRelations = [...props.relations].sort((a, b) => b.precedence - a.precedence
    || (a.sourcePropertyId < b.sourcePropertyId ? -1 : 1));
  const removed = new Map(); // propertyId -> byPropertyId
  const has = (id) => instances.some((p) => p.propertyId === id);
  for (const rel of orderedRelations) {
    if (rel.relation !== 'REPLACES' && rel.relation !== 'SUPPRESSES') continue;
    if (has(rel.sourcePropertyId) && has(rel.targetPropertyId)) {
      instances = instances.filter((p) => p.propertyId !== rel.targetPropertyId);
      removed.set(rel.targetPropertyId, { by: rel.sourcePropertyId, relation: rel.relation });
    }
  }

  // 4. requirements and conflicts — an unresolved defect throws by name.
  const idsPresent = new Set(instances.map((p) => p.propertyId));
  for (const rel of props.relations) {
    if (rel.relation === 'REQUIRES' && idsPresent.has(rel.sourcePropertyId)) {
      const predicate = rel.condition ? PREDICATES[rel.condition] : null;
      if (rel.condition && !predicate) throw new CompileError(entityId, `unknown predicate ${JSON.stringify(rel.condition)}`);
      const satisfied = predicate
        ? predicate(instances)
        : instances.some((p) => props.isA(p.propertyId, rel.targetPropertyId));
      if (!satisfied) {
        throw new CompileError(entityId, `${rel.sourcePropertyId} requires ${rel.targetPropertyId}`);
      }
    }
    if (rel.relation === 'CONFLICTS_WITH'
      && idsPresent.has(rel.sourcePropertyId) && idsPresent.has(rel.targetPropertyId)) {
      throw new CompileError(entityId, `unresolved conflict ${rel.sourcePropertyId} vs ${rel.targetPropertyId}`);
    }
  }

  // 5. deterministic order, then same-property dedupe: the best-ranked
  // instance survives with lower-ranked parameters showing through beneath it.
  instances.sort((a, b) => instanceSortKey(a, b, entityId));
  const byProperty = new Map();
  for (const inst of instances) {
    const existing = byProperty.get(inst.propertyId);
    if (!existing) byProperty.set(inst.propertyId, { ...inst });
    else if (inst.parameters) existing.parameters = { ...inst.parameters, ...existing.parameters };
  }

  // 6. deriveDefaults — PROPERTY_DEFAULT parameters sit under every instance.
  const compiledProperties = [...byProperty.values()].map((inst) => {
    const def = props.require(inst.propertyId);
    const parameters = { ...(def.defaultParameters || {}), ...(inst.parameters || {}) };
    return {
      propertyId: inst.propertyId,
      source: inst.source,
      sourceEntityId: inst.sourceEntityId,
      implied: inst._implied,
      visibility: def.visibility,
      playerTermId: def.playerTermId,
      tooltipTermId: def.tooltipTermId,
      parameters,
    };
  });

  let compiled = {
    id: entity.id,
    kind: entity.kind,
    nameTermId: entity.nameTermId,
    descriptionTermId: entity.descriptionTermId,
    artId: entity.artId,
    rarityId: entity.rarityId,
    properties: compiledProperties,
    suppressed: Object.fromEntries(removed),
    overrides: {},
  };

  // 7. explicit overrides, then runtime modifiers, in that order and each
  // deterministic (a modifier is data, not a function).
  if (entity.explicitOverrides) compiled.overrides = { ...entity.explicitOverrides };
  for (const mod of context.runtimeModifiers || []) {
    if (mod.op === 'set') compiled.overrides[mod.path] = mod.value;
    else if (mod.op === 'add') compiled.overrides[mod.path] = (compiled.overrides[mod.path] || 0) + mod.value;
    else throw new CompileError(entityId, `unknown runtime modifier op ${JSON.stringify(mod.op)}`);
  }

  return deepFreeze(validateCompiledResult(compiled, entityId));
}

function validateCompiledResult(compiled, entityId) {
  const seen = new Set();
  for (const p of compiled.properties) {
    if (seen.has(p.propertyId)) throw new CompileError(entityId, `duplicate compiled property ${p.propertyId}`);
    seen.add(p.propertyId);
  }
  if (!compiled.nameTermId) throw new CompileError(entityId, 'compiled entity lost its name term');
  return compiled;
}

/** Convenience predicate on a compiled entity (or any property list holder). */
export function hasProperty(compiled, propertyId) {
  return compiled.properties.some((p) => p.propertyId === propertyId);
}

export function propertyParameters(compiled, propertyId) {
  const found = compiled.properties.find((p) => p.propertyId === propertyId);
  return found ? found.parameters : null;
}

export { SchemaError };
