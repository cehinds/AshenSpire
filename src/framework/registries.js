// src/framework/registries.js — the canonical registries (framework contract:
// Canonical relational model, Terminology and assets).
//
// A registry's require() throws with the offending id — an unknown ID is never
// silently accepted. Registries are built once from checked rows and frozen;
// nothing downstream mutates them.

import {
  checkPropertyDefinition, checkPropertyRelation, checkContentEntity,
  checkTermDefinition, checkAssetDefinition, checkConfirmationPolicy,
  checkConfirmationAction, SchemaError,
} from './schema.js';

class Registry {
  constructor(label, rows, check) {
    this.label = label;
    this.map = new Map();
    this.duplicates = [];
    for (const row of rows) {
      check(row);
      if (this.map.has(row.id)) this.duplicates.push(row.id);
      else this.map.set(row.id, Object.freeze({ ...row }));
    }
  }

  has(id) { return this.map.has(id); }

  get(id) { return this.map.get(id) || null; }

  require(id) {
    const row = this.map.get(id);
    if (!row) throw new SchemaError(this.label, `unknown id ${JSON.stringify(id)}`);
    return row;
  }

  all() { return [...this.map.values()]; }

  get size() { return this.map.size; }
}

export class TermRegistry extends Registry {
  constructor(rows) { super('TermRegistry', rows, checkTermDefinition); }

  /**
   * The one word source (authority boundary: ALWAYS resolve words through
   * TermRegistry). context: 'default' | 'short' | 'plural' | 'accessibility'.
   */
  displayTerm(termId, context = 'default') {
    const term = this.require(termId);
    if (context === 'short') return term.shortText || term.canonicalText;
    if (context === 'plural') return term.pluralText || term.canonicalText;
    if (context === 'accessibility') return term.accessibilityText || term.canonicalText;
    return term.canonicalText;
  }

  /** Import-only alias lookup — canonical id for a legacy spelling, or null. */
  idForAlias(alias) {
    for (const term of this.map.values()) {
      if ((term.aliasesForImportOnly || []).includes(alias)) return term.id;
    }
    return null;
  }
}

export class AssetRegistry extends Registry {
  constructor(rows, { assetLoads = null } = {}) {
    super('AssetRegistry', rows, checkAssetDefinition);
    // Injected existence/load probe (node: fs check; browser: loader cache).
    // Absent probe = trust the path; validation supplies the real one.
    this.assetLoads = assetLoads;
    this.systemMissingId = 'asset.system.missing';
  }

  /** Typed fallback resolution (framework contract: resolveAsset). */
  resolveAsset(assetId) {
    const seen = new Set();
    let id = assetId;
    while (id && !seen.has(id)) {
      seen.add(id);
      const asset = this.get(id);
      if (!asset) break;
      const loads = this.assetLoads ? this.assetLoads(asset.sourcePath) : true;
      if (loads) return asset;
      id = asset.fallbackAssetId;
    }
    return this.get(this.systemMissingId);
  }
}

export class PropertyRegistry extends Registry {
  constructor(rows, relations) {
    super('PropertyRegistry', rows, checkPropertyDefinition);
    this.relations = relations.map((r, i) => Object.freeze({ ...checkPropertyRelation(r, i) }));
  }

  /** The parent chain from a property up to its family root, excluding self. */
  ancestorsOf(id) {
    const out = [];
    const seen = new Set([id]);
    let current = this.require(id);
    while (current.parentId) {
      if (seen.has(current.parentId)) break; // cycle — validation reports it
      seen.add(current.parentId);
      current = this.require(current.parentId);
      out.push(current.id);
    }
    return out;
  }

  /** Whether candidate is propertyId or descends from it (parent chain or INHERITS). */
  isA(candidateId, propertyId) {
    if (candidateId === propertyId) return true;
    if (this.ancestorsOf(candidateId).includes(propertyId)) return true;
    for (const rel of this.relations) {
      if (rel.relation === 'INHERITS' && rel.sourcePropertyId === candidateId) {
        if (this.isA(rel.targetPropertyId, propertyId)) return true;
      }
    }
    return false;
  }

  relationsOfKind(kind) {
    return this.relations.filter((r) => r.relation === kind);
  }

  relationsFrom(sourceId, kind = null) {
    return this.relations.filter((r) => r.sourcePropertyId === sourceId && (kind == null || r.relation === kind));
  }
}

export class ContentRegistry extends Registry {
  constructor(rows) {
    super('ContentRegistry', rows, checkContentEntity);
  }

  ofKind(kind) { return this.all().filter((e) => e.kind === kind); }
}

export class ConfirmationRegistry {
  constructor({ policies, actions }) {
    this.policies = new Registry('ConfirmationRegistry.policies', policies, checkConfirmationPolicy);
    this.actions = new Registry('ConfirmationRegistry.actions', actions, checkConfirmationAction);
  }

  require(policyId) { return this.policies.require(policyId); }

  policyForAction(actionId) {
    const action = this.actions.require(actionId);
    return this.policies.require(action.policyId);
  }

  get duplicates() { return [...this.policies.duplicates, ...this.actions.duplicates]; }
}

export class ThemeRegistry {
  constructor(theme) {
    if (!theme || typeof theme !== 'object') throw new SchemaError('ThemeRegistry', 'theme data missing');
    for (const section of ['colors', 'spacing', 'typography', 'radius', 'interactionStates', 'layout']) {
      if (!theme[section]) throw new SchemaError('ThemeRegistry', `missing section ${section}`);
    }
    this.data = theme;
    this.rolesById = new Map(theme.typography.roles.map((r) => [r.id, Object.freeze({ ...r })]));
  }

  color(name) {
    const value = this.data.colors[name];
    if (!value) throw new SchemaError('ThemeRegistry', `unknown color ${JSON.stringify(name)}`);
    return value;
  }

  role(id) {
    const role = this.rolesById.get(id);
    if (!role) throw new SchemaError('ThemeRegistry', `unknown typography role ${JSON.stringify(id)}`);
    return role;
  }

  get contrastPairs() { return this.data.contrastPairs || []; }
}

/**
 * Build every registry from one data bag (the generated framework data plus
 * imported rows). Duplicate ids are collected, not thrown, so validation can
 * report the complete list; require() still refuses unknowns immediately.
 */
export function createFrameworkRegistries({ properties, relations, terms, assets, entities, confirmation, theme, assetLoads = null }) {
  return Object.freeze({
    properties: new PropertyRegistry(properties, relations),
    terms: new TermRegistry(terms),
    assets: new AssetRegistry(assets, { assetLoads }),
    content: new ContentRegistry(entities),
    confirmation: new ConfirmationRegistry(confirmation),
    theme: new ThemeRegistry(theme),
  });
}
