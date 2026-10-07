// src/framework/candidate.js — buildReplacementCandidate (framework contract:
// One-shot replacement and atomic cutover, Cutover gate).
//
// The candidate is assembled complete — registries, compiler, services,
// shared components, every imported entity — then judged against the gate.
// If ANY required gate is not PASS the current runtime is preserved and every
// failure is reported; there is no partial cutover and no mixed authority.

import { properties as propertiesData } from './data/properties.js';
import { relations as relationsData } from './data/relations.js';
import { terms as termsData } from './data/terms.js';
import { assets as assetsData } from './data/assets.js';
import { entities as entitiesData } from './data/entities.js';
import { confirmationPolicies } from './data/confirmationPolicies.js';
import { theme as themeData } from './data/theme.js';
import { createFrameworkRegistries } from './registries.js';
import { importLegacyContent, expectedCounts } from './importer.js';
import { validateAllContent } from './validate.js';
import { compileTooltip } from './presentation/tooltip.js';
import { SharedCard, SharedPropertyChip, SharedConfirmation, SharedTooltip } from './presentation/components.js';
import { propertyParameters, hasProperty } from './compiler.js';

/** Assemble the complete candidate: authored framework rows + imported legacy rows. */
export function createReplacementCandidate(bundle, { assetLoads = null } = {}) {
  const imported = importLegacyContent(bundle, { canonicalTerms: termsData.terms });
  const registries = createFrameworkRegistries({
    properties: propertiesData.properties,
    relations: relationsData.relations,
    terms: [...termsData.terms, ...imported.terms],
    assets: [...assetsData.assets, ...imported.assets],
    entities: [...entitiesData.entities, ...imported.entities],
    confirmation: confirmationPolicies,
    theme: themeData,
    assetLoads,
  });
  return { registries, imported, bundle };
}

/**
 * captureCurrentBehavior — the legacy bundle's mechanics facts, per card, in
 * the exact fields the running engine reads. This is the comparison baseline.
 */
export function captureCurrentBehavior(bundle) {
  const cards = new Map();
  for (const card of bundle.cards) {
    cards.set(card.id, {
      type: card.type,
      cost: card.cost,
      manaCost: card.manaCost ?? null,
      keywords: [...(card.keywords || [])].sort(),
      damageSchool: card.damageSchool || null,
      targets: [...new Set((card.effects || []).map((e) => e.target).filter(Boolean))].sort(),
    });
  }
  return { cards, counts: expectedCounts(bundle) };
}

const TYPE_OF_CLASSIFICATION = Object.freeze({
  'classification.attack': 'attack',
  'classification.skill': 'skill',
  'classification.power': 'power',
  'classification.curse': 'curse',
  'classification.statusCard': 'status',
});

const SCHOOL_OF_PROPERTY = Object.freeze({
  'damage.physical': 'physical',
  'damage.magic': 'magic',
  'damage.arcane': 'arcane',
});

const KEYWORD_OF_PROPERTY = Object.freeze({
  'lifecycle.exhaust': 'exhaust',
  'lifecycle.ethereal': 'ethereal',
  'lifecycle.innate': 'innate',
  'lifecycle.retain': 'retain',
  'internal.unplayable': 'unplayable',
});

/**
 * compareEveryUnchangedBehavior — reconstruct each legacy card's mechanics
 * facts from the COMPILED candidate entity and diff against the baseline.
 * Any mismatch means the rebuild changed a behavior the contract says to
 * preserve.
 */
export function compareBaseline(baseline, registries, compiledById) {
  const mismatches = [];
  for (const [legacyId, expected] of baseline.cards) {
    const compiled = compiledById.get(`card.${legacyId}`);
    if (!compiled) { mismatches.push({ id: legacyId, field: 'entity', detail: 'missing from candidate' }); continue; }
    const diff = (field, got) => {
      const want = expected[field];
      if (JSON.stringify(got) !== JSON.stringify(want)) {
        mismatches.push({ id: legacyId, field, detail: `candidate ${JSON.stringify(got)} vs baseline ${JSON.stringify(want)}` });
      }
    };
    const type = compiled.properties.map((p) => TYPE_OF_CLASSIFICATION[p.propertyId]).find(Boolean) || null;
    diff('type', type);
    const action = propertyParameters(compiled, 'cost.action');
    diff('cost', action ? (action.variable ? 'X' : action.amount) : null);
    const mana = propertyParameters(compiled, 'cost.mana');
    diff('manaCost', mana ? mana.amount : null);
    const keywords = compiled.properties.map((p) => KEYWORD_OF_PROPERTY[p.propertyId]).filter(Boolean).sort();
    diff('keywords', keywords);
    const school = compiled.properties.map((p) => SCHOOL_OF_PROPERTY[p.propertyId]).find(Boolean) || null;
    diff('damageSchool', school);
    const targets = compiled.properties
      .filter((p) => p.propertyId.startsWith('targeting.') && !p.implied)
      .map((p) => p.propertyId.slice('targeting.'.length)).sort();
    diff('targets', targets);
  }
  return mismatches;
}

/** Representative component trees for the accessibility walk. */
function sampleComponentTrees(registries, compiledById) {
  const trees = [];
  const sample = compiledById.get('card.strike') || [...compiledById.values()].find((c) => c.kind === 'CARD');
  if (sample) {
    const tooltip = compileTooltip(registries, sample);
    trees.push(SharedCard({
      model: { title: registries.terms.displayTerm(sample.nameTermId), onActivate: () => {} },
      chips: sample.properties
        .filter((p) => p.visibility === 'PRIMARY' && p.playerTermId)
        .map((p) => SharedPropertyChip({ text: registries.terms.displayTerm(p.playerTermId) })),
    }));
    trees.push(SharedTooltip({ model: tooltip }));
  }
  trees.push(SharedConfirmation({
    policy: registries.confirmation.require('policy.abandonRun'),
    titleText: 'Abandon this run?',
    bodyText: 'Progress on this run is lost.',
    confirmLabel: registries.terms.displayTerm('term.confirm'),
    cancelLabel: registries.terms.displayTerm('term.cancel'),
  }));
  return trees;
}

/**
 * buildReplacementCandidate(bundle, options) — the whole gate, honestly.
 * options.regressionSuite / options.legacyAuthorityCheck let the node gate
 * runner supply results the module itself cannot measure (the browser suite,
 * grep-level authority proof); absent, those gates report NOT_RUN and the
 * candidate cannot pass.
 */
export function buildReplacementCandidate(bundle, options = {}) {
  const gates = [];
  const gate = (name, status, detail = '') => gates.push({ name, status, detail });

  const baseline = captureCurrentBehavior(bundle);
  const candidate = createReplacementCandidate(bundle, options);
  const { registries, imported } = candidate;

  const authoredCountsByKind = { CARD: entitiesData.entities.filter((e) => e.kind === 'CARD').length };
  const validation = validateAllContent(registries, {
    expectedCounts: baseline.counts,
    authoredCountsByKind,
    drift: imported.drift,
    assetExists: options.assetExists,
    sampleComponents: sampleComponentTrees(registries, new Map()),
  });
  // Re-walk samples with real compiled entities now that compilation ran.
  const componentFailures = validateAllContent(registries, {
    sampleComponents: sampleComponentTrees(registries, validation.compiledById),
  }).failures.filter((f) => f.check.startsWith('assertEveryInteractive') || f.check.startsWith('assertEveryTooltip'));
  validation.failures.push(...componentFailures);

  const failuresBy = (prefix) => validation.failures.filter((f) => f.check.startsWith(prefix));
  const passIfEmpty = (name, rows, detail = '') => gate(name, rows.length === 0 ? 'PASS' : 'FAIL',
    rows.length ? rows.slice(0, 5).map((r) => `${r.check}: ${r.detail}`).join('; ') : detail);

  passIfEmpty('schema and reference validation',
    [...failuresBy('assertUniqueStableIds'), ...failuresBy('assertEveryReferenceResolves'), ...failuresBy('assertNoUnknownTargetOrEffectType'), ...failuresBy('assertEveryPlayerFacingEntityHasCanonicalTerms')]);
  passIfEmpty('property-conflict and cycle validation',
    [...failuresBy('assertNoUnresolvedPropertyConflicts'), ...failuresBy('assertEveryPropertyRequirementIsSatisfied'), ...failuresBy('assertNoPropertyCycles'), ...failuresBy('assertNoDuplicateCardInstances'), ...failuresBy('assertCostProfilesComplete')]);
  passIfEmpty('complete entity counts', failuresBy('assertCompleteEntityCounts'),
    `all ${imported.entities.length} legacy entities imported`);
  passIfEmpty('asset and terminology validation',
    [...failuresBy('assertEveryAssetHasValidFallbackPolicy'), ...failuresBy('assertNoTerminologyDrift')]);

  // Save compatibility: the candidate preserves every legacy stable id and
  // never rewrites a save; PASS is claimed only at that data level.
  const idDamage = imported.entities.filter((e) => e.explicitOverrides?.legacyId == null);
  gate('save compatibility', idDamage.length === 0 ? 'PASS' : 'FAIL',
    idDamage.length ? `${idDamage.length} entities lost their legacy id` : 'every imported entity carries its legacy id; saves untouched');

  const mismatches = compareBaseline(baseline, registries, validation.compiledById);
  gate('unchanged-gameplay equivalence', mismatches.length === 0 ? 'PASS' : 'FAIL',
    mismatches.length ? mismatches.slice(0, 5).map((m) => `${m.id}.${m.field}: ${m.detail}`).join('; ')
      : `data-level equivalence over ${baseline.cards.size} cards; runtime replay equivalence is the regression suite's gate`);

  gate('approved new-mechanics acceptance',
    options.newMechanicsAccepted === true ? 'PASS' : options.newMechanicsAccepted === false ? 'FAIL' : 'NOT_RUN',
    'stamina/weight/dodge/seal/recall services implemented and unit-tested; acceptance sign-off is a human gate');
  passIfEmpty('responsive UI and accessibility',
    [...failuresBy('assertEveryInteractiveComponentHasAccessibleName'), ...failuresBy('assertEveryTooltipHasAccessibleFallback'), ...failuresBy('assertReadableText'), ...failuresBy('assertEveryDestructiveActionHasExactlyOneConfirmationPolicy')]);
  gate('full regression suite',
    options.regressionSuite === true ? 'PASS' : options.regressionSuite === false ? 'FAIL' : 'NOT_RUN',
    'node tests/run-node.mjs + tests/framework.test.mjs');
  gate('proof that legacy runtime authority is unreachable',
    options.legacyAuthorityCheck === true ? 'PASS' : 'FAIL',
    'legacy engine/UI consumers still read src/content + src/engine directly; cutover has not been performed');

  const allPass = gates.every((g) => g.status === 'PASS');
  return {
    status: allPass ? 'SUCCESS' : 'FAILURE',
    cutover: allPass,
    gates,
    validation,
    baseline,
    candidate,
    mismatches,
  };
}

export { hasProperty };
