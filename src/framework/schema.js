// src/framework/schema.js — closed vocabularies and row-shape checks for the
// canonical relational model (framework contract: Canonical relational model).
//
// Every enum here is CLOSED: an unknown domain, relation, kind, source, or
// visibility is rejected by name, never silently accepted (authority boundary:
// NEVER silently accept an unknown ID).

export const PROPERTY_DOMAINS = Object.freeze([
  'CLASSIFICATION', 'DAMAGE', 'ACTION_ROLE', 'COST', 'TARGETING',
  'LIFECYCLE', 'SCALING', 'EQUIPMENT', 'STATUS', 'PRESENTATION', 'INTERNAL',
]);

export const PROPERTY_VISIBILITIES = Object.freeze([
  'PRIMARY', 'SECONDARY', 'CONTEXTUAL', 'INTERNAL', 'DEBUG',
]);

export const RELATION_KINDS = Object.freeze([
  'REQUIRES', 'CONFLICTS_WITH', 'PERMITS', 'INHERITS', 'REPLACES', 'SUPPRESSES',
]);

export const ENTITY_KINDS = Object.freeze([
  'CARD', 'EQUIPMENT', 'CLASS', 'ENEMY', 'STATUS', 'EFFECT', 'LOCATION',
  'RELIC', 'CONSUMABLE', 'UI_SURFACE',
]);

export const PROPERTY_SOURCES = Object.freeze([
  'AUTHORED', 'EQUIPMENT', 'RUNE', 'STATUS', 'CLASS', 'RELIC', 'SYSTEM_DEFAULT',
]);

export const ASSET_KINDS = Object.freeze([
  'PORTRAIT', 'CARD_ART', 'ICON', 'BACKGROUND', 'AUDIO',
]);

export const CONFIRMATION_LEVELS = Object.freeze([
  'NONE', 'REVERSIBLE', 'COMMITMENT', 'DESTRUCTIVE',
]);

export const EQUIPMENT_CATEGORIES = Object.freeze([
  'WEAPON', 'SHIELD', 'PARRY_TOOL', 'ARMOR', 'RELIC', 'ITEM',
]);

export const EQUIPMENT_RARITIES = Object.freeze([
  'BASIC', 'COMMON', 'RARE', 'LEGENDARY', 'MYTHIC',
]);

export const COST_MODES = Object.freeze(['ALL_REQUIRED', 'CHOOSE_ONE']);

const ID_RE = /^[a-zA-Z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)*$/;

export class SchemaError extends Error {
  constructor(where, message) {
    super(`${where}: ${message}`);
    this.name = 'SchemaError';
    this.where = where;
  }
}

export function assertStableId(id, where) {
  if (typeof id !== 'string' || !ID_RE.test(id)) {
    throw new SchemaError(where, `invalid stable id ${JSON.stringify(id)}`);
  }
  return id;
}

function assertEnum(value, allowed, field, where) {
  if (!allowed.includes(value)) {
    throw new SchemaError(where, `${field} ${JSON.stringify(value)} is not one of [${allowed.join(', ')}]`);
  }
  return value;
}

function assertOptional(value, kind, field, where) {
  if (value == null) return undefined;
  if (kind === 'string' && typeof value !== 'string') throw new SchemaError(where, `${field} must be a string`);
  if (kind === 'integer' && !Number.isInteger(value)) throw new SchemaError(where, `${field} must be an integer`);
  if (kind === 'object' && (typeof value !== 'object' || Array.isArray(value))) throw new SchemaError(where, `${field} must be an object`);
  return value;
}

export function checkPropertyDefinition(row) {
  const where = `property ${row && row.id}`;
  assertStableId(row.id, 'property');
  if (row.parentId != null) assertStableId(row.parentId, where);
  assertEnum(row.domain, PROPERTY_DOMAINS, 'domain', where);
  assertEnum(row.visibility, PROPERTY_VISIBILITIES, 'visibility', where);
  assertOptional(row.defaultParameters, 'object', 'defaultParameters', where);
  assertOptional(row.playerTermId, 'string', 'playerTermId', where);
  assertOptional(row.tooltipTermId, 'string', 'tooltipTermId', where);
  if (!Number.isInteger(row.priority)) throw new SchemaError(where, 'priority must be an integer');
  return row;
}

export function checkPropertyRelation(row, index) {
  const where = `relation #${index} (${row && row.sourcePropertyId} ${row && row.relation} ${row && row.targetPropertyId})`;
  assertStableId(row.sourcePropertyId, where);
  assertStableId(row.targetPropertyId, where);
  assertEnum(row.relation, RELATION_KINDS, 'relation', where);
  if (!Number.isInteger(row.precedence)) throw new SchemaError(where, 'precedence must be an integer');
  assertOptional(row.condition, 'string', 'condition', where);
  return row;
}

export function checkPropertyInstance(row, where) {
  assertStableId(row.propertyId, where);
  assertEnum(row.source, PROPERTY_SOURCES, 'source', where);
  assertOptional(row.parameters, 'object', 'parameters', where);
  assertOptional(row.sourceEntityId, 'string', 'sourceEntityId', where);
  return row;
}

export function checkContentEntity(row) {
  const where = `entity ${row && row.id}`;
  assertStableId(row.id, 'entity');
  assertEnum(row.kind, ENTITY_KINDS, 'kind', where);
  assertStableId(row.nameTermId, where);
  assertOptional(row.descriptionTermId, 'string', 'descriptionTermId', where);
  assertOptional(row.artId, 'string', 'artId', where);
  assertOptional(row.rarityId, 'string', 'rarityId', where);
  assertOptional(row.explicitOverrides, 'object', 'explicitOverrides', where);
  if (!Array.isArray(row.properties)) throw new SchemaError(where, 'properties must be a list');
  row.properties.forEach((p, i) => checkPropertyInstance(p, `${where} properties[${i}]`));
  return row;
}

export function checkTermDefinition(row) {
  const where = `term ${row && row.id}`;
  assertStableId(row.id, 'term');
  if (typeof row.canonicalText !== 'string' || row.canonicalText.length === 0) {
    throw new SchemaError(where, 'canonicalText must be a non-empty string');
  }
  for (const field of ['shortText', 'pluralText', 'accessibilityText']) {
    assertOptional(row[field], 'string', field, where);
  }
  if (row.aliasesForImportOnly != null && !Array.isArray(row.aliasesForImportOnly)) {
    throw new SchemaError(where, 'aliasesForImportOnly must be a list');
  }
  return row;
}

export function checkAssetDefinition(row) {
  const where = `asset ${row && row.id}`;
  assertStableId(row.id, 'asset');
  assertEnum(row.kind, ASSET_KINDS, 'kind', where);
  if (typeof row.sourcePath !== 'string' || row.sourcePath.length === 0) {
    throw new SchemaError(where, 'sourcePath must be a non-empty string');
  }
  assertStableId(row.fallbackAssetId, where);
  assertOptional(row.altTermId, 'string', 'altTermId', where);
  return row;
}

export function checkConfirmationPolicy(row) {
  const where = `policy ${row && row.id}`;
  assertStableId(row.id, 'policy');
  assertEnum(row.level, CONFIRMATION_LEVELS, 'level', where);
  return row;
}

export function checkConfirmationAction(row) {
  const where = `action ${row && row.id}`;
  assertStableId(row.id, 'action');
  assertStableId(row.policyId, where);
  if (typeof row.destructive !== 'boolean') throw new SchemaError(where, 'destructive must be a boolean');
  return row;
}
