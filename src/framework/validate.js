// src/framework/validate.js — validateAllContent (framework contract:
// Complete validation). Every assertion the contract lists runs, every run,
// and failures are COLLECTED with names rather than stopping at the first —
// the cutover gate needs the complete list (reportAllFailures).

import { compileEntity, CompileError } from './compiler.js';
import { compileCosts, CostError } from './costs.js';
import { walkComponents } from './presentation/components.js';

function srgbChannel(value) {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function contrastRatio(hexA, hexB) {
  const lum = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return 0.2126 * srgbChannel((n >> 16) & 255) + 0.7152 * srgbChannel((n >> 8) & 255) + 0.0722 * srgbChannel(n & 255);
  };
  const [hi, lo] = [lum(hexA), lum(hexB)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * validateAllContent(registries, options) -> {ok, failures: [{check, detail}]}
 * options: expectedCounts (per-kind), duplicateIds (collected by registries),
 * assetExists(path), sampleComponents (component trees to walk), drift rows.
 */
export function validateAllContent(registries, options = {}) {
  const failures = [];
  const fail = (check, detail) => failures.push({ check, detail });
  const { properties, terms, assets, content, confirmation } = registries;

  // assertUniqueStableIds — registries collect duplicates instead of dropping.
  for (const id of content.duplicates) fail('assertUniqueStableIds', `entity ${id}`);
  for (const id of properties.duplicates) fail('assertUniqueStableIds', `property ${id}`);
  for (const id of terms.duplicates) fail('assertUniqueStableIds', `term ${id}`);
  for (const id of assets.duplicates) fail('assertUniqueStableIds', `asset ${id}`);
  for (const id of confirmation.duplicates) fail('assertUniqueStableIds', `confirmation ${id}`);
  for (const id of options.duplicateIds || []) fail('assertUniqueStableIds', id);

  // assertEveryReferenceResolves
  for (const prop of properties.all()) {
    if (prop.parentId && !properties.has(prop.parentId)) fail('assertEveryReferenceResolves', `property ${prop.id} parent ${prop.parentId}`);
    if (prop.playerTermId && !terms.has(prop.playerTermId)) fail('assertEveryReferenceResolves', `property ${prop.id} playerTermId ${prop.playerTermId}`);
    if (prop.tooltipTermId && !terms.has(prop.tooltipTermId)) fail('assertEveryReferenceResolves', `property ${prop.id} tooltipTermId ${prop.tooltipTermId}`);
  }
  for (const rel of properties.relations) {
    if (!properties.has(rel.sourcePropertyId)) fail('assertEveryReferenceResolves', `relation source ${rel.sourcePropertyId}`);
    if (!properties.has(rel.targetPropertyId)) fail('assertEveryReferenceResolves', `relation target ${rel.targetPropertyId}`);
  }
  for (const entity of content.all()) {
    if (!terms.has(entity.nameTermId)) fail('assertEveryReferenceResolves', `entity ${entity.id} nameTermId ${entity.nameTermId}`);
    if (entity.descriptionTermId && !terms.has(entity.descriptionTermId)) fail('assertEveryReferenceResolves', `entity ${entity.id} descriptionTermId ${entity.descriptionTermId}`);
    if (entity.artId && !assets.has(entity.artId)) fail('assertEveryReferenceResolves', `entity ${entity.id} artId ${entity.artId}`);
    for (const inst of entity.properties) {
      if (!properties.has(inst.propertyId)) fail('assertNoUnknownTargetOrEffectType', `entity ${entity.id} property ${inst.propertyId}`);
    }
  }
  for (const action of confirmation.actions.all()) {
    if (!confirmation.policies.has(action.policyId)) fail('assertEveryReferenceResolves', `action ${action.id} policy ${action.policyId}`);
  }

  // assertEveryAssetHasValidFallbackPolicy — every chain reaches the system
  // missing asset without a loop, and (given a probe) every path exists.
  for (const asset of assets.all()) {
    const seen = new Set();
    let current = asset;
    while (current && current.id !== assets.systemMissingId) {
      if (seen.has(current.id)) { fail('assertEveryAssetHasValidFallbackPolicy', `cycle at ${asset.id}`); break; }
      seen.add(current.id);
      current = assets.get(current.fallbackAssetId);
    }
    if (!current) fail('assertEveryAssetHasValidFallbackPolicy', `${asset.id} chain leaves the registry`);
    if (options.assetExists && !options.assetExists(asset.sourcePath)) {
      fail('assertEveryAssetHasValidFallbackPolicy', `${asset.id} sourcePath ${asset.sourcePath} does not exist`);
    }
  }

  // assertEveryPlayerFacingEntityHasCanonicalTerms — player-visible properties
  // need player terms; every entity needs a name term (checked above).
  for (const prop of properties.all()) {
    if (prop.visibility === 'INTERNAL' || prop.visibility === 'DEBUG') continue;
    if (!prop.playerTermId) fail('assertEveryPlayerFacingEntityHasCanonicalTerms', `property ${prop.id} has no playerTermId`);
    if (!prop.tooltipTermId) fail('assertEveryTooltipHasAccessibleFallback', `property ${prop.id} has no tooltipTermId`);
  }

  // assertNoPropertyCycles — parent chains and INHERITS edges together.
  {
    const edges = new Map();
    for (const prop of properties.all()) {
      edges.set(prop.id, prop.parentId ? [prop.parentId] : []);
    }
    for (const rel of properties.relationsOfKind('INHERITS')) {
      if (edges.has(rel.sourcePropertyId)) edges.get(rel.sourcePropertyId).push(rel.targetPropertyId);
    }
    const state = new Map();
    const visit = (id, path) => {
      if (state.get(id) === 'done') return;
      if (state.get(id) === 'visiting') { fail('assertNoPropertyCycles', [...path, id].join(' -> ')); return; }
      state.set(id, 'visiting');
      for (const next of edges.get(id) || []) visit(next, [...path, id]);
      state.set(id, 'done');
    };
    for (const id of edges.keys()) visit(id, []);
  }

  // assertEveryPropertyRequirementIsSatisfied + assertNoUnresolvedPropertyConflicts
  // + duplicate-instance detection: compileEntity IS the checker; run it on
  // every entity with no context (authored rows + defaults only).
  const compiledById = new Map();
  for (const entity of content.all()) {
    try {
      const compiled = compileEntity(registries, entity.id, {});
      compiledById.set(entity.id, compiled);
    } catch (e) {
      if (e instanceof CompileError) {
        const check = /unresolved conflict/.test(e.message) ? 'assertNoUnresolvedPropertyConflicts'
          : /requires/.test(e.message) ? 'assertEveryPropertyRequirementIsSatisfied'
            : /duplicate compiled/.test(e.message) ? 'assertNoDuplicateCardInstancesAfterCompilation'
              : 'assertNoUnknownTargetOrEffectType';
        fail(check, e.message);
      } else {
        fail('compileEntity', `${entity.id}: ${e.message}`);
      }
    }
  }

  // Cost completeness (incomplete alternative costs, Recall repeat limiters).
  for (const [id, compiled] of compiledById) {
    if (compiled.kind !== 'CARD') continue;
    try {
      compileCosts(compiled, {});
    } catch (e) {
      if (e instanceof CostError) fail('assertCostProfilesComplete', e.message);
      else fail('assertCostProfilesComplete', `${id}: ${e.message}`);
    }
  }

  // assertNoDuplicateCardInstancesAfterCompilation — a composed deck must not
  // mint two instances with one instance id (checked over provided decks).
  for (const deck of options.composedDecks || []) {
    const seen = new Set();
    for (const slot of deck.cards) {
      if (seen.has(slot.instanceId)) fail('assertNoDuplicateCardInstancesAfterCompilation', `instance ${slot.instanceId}`);
      seen.add(slot.instanceId);
    }
  }

  // assertNoTerminologyDrift — the importer's comparison rows.
  for (const row of options.drift || []) fail('assertNoTerminologyDrift', `${row.id}: ${row.reason}`);

  // assertEveryDestructiveActionHasExactlyOneConfirmationPolicy
  for (const action of confirmation.actions.all()) {
    const policy = confirmation.policies.get(action.policyId);
    if (!policy) continue; // reference failure already recorded
    if (action.destructive && policy.level !== 'DESTRUCTIVE') {
      fail('assertEveryDestructiveActionHasExactlyOneConfirmationPolicy', `${action.id} maps to ${policy.level}`);
    }
    if (!action.destructive && policy.level === 'DESTRUCTIVE') {
      fail('assertEveryDestructiveActionHasExactlyOneConfirmationPolicy', `${action.id} is not destructive but maps to a DESTRUCTIVE policy`);
    }
  }

  // assertEveryInteractiveComponentHasAccessibleName +
  // assertEveryTooltipHasAccessibleFallback over sample component trees.
  for (const tree of options.sampleComponents || []) {
    walkComponents(tree, (component) => {
      if (component.interactive && !component.accessibleName) {
        fail('assertEveryInteractiveComponentHasAccessibleName', `${component.tag}.${component.className || ''}`);
      }
      if (component.role === 'tooltip' && !component.accessibleName) {
        fail('assertEveryTooltipHasAccessibleFallback', `${component.tag}.${component.className || ''}`);
      }
    });
  }

  // Readable text — every declared contrast pair clears its floor.
  for (const pair of registries.theme.contrastPairs) {
    const ratio = contrastRatio(registries.theme.color(pair.fg), registries.theme.color(pair.bg));
    if (ratio < pair.minimumRatio) {
      fail('assertReadableText', `${pair.id}: ${ratio.toFixed(2)} < ${pair.minimumRatio}`);
    }
  }

  // Entity-count completeness against the legacy bundle.
  if (options.expectedCounts) {
    const actual = {};
    for (const entity of content.all()) actual[entity.kind] = (actual[entity.kind] || 0) + 1;
    for (const [kind, expected] of Object.entries(options.expectedCounts)) {
      const found = (actual[kind] || 0) - (options.authoredCountsByKind?.[kind] || 0);
      if (found !== expected) fail('assertCompleteEntityCounts', `${kind}: imported ${found}, legacy has ${expected}`);
    }
  }

  return { ok: failures.length === 0, failures, compiledById };
}
