// src/framework/termOverlay.js — per-bundle term authority for entity words
// (framework contract: Terminology and assets — ALWAYS resolve words through
// TermRegistry).
//
// The shared bridge reads only canonical framework data, so entity NAMES and
// TOOLTIPS (statuses, stances) need a registry built from the same bundle the
// legacy registries were built from — that is what keeps probe/fixture
// bundles working and keeps one authority per registries instance. Rows use
// the importer's naming scheme (term.entity.<kind>.<id>.<field>) with the
// bundle's text VERBATIM, so display strings cannot drift from the shipped
// content while the resolution authority moves to the framework.

import { TermRegistry } from './registries.js';

function entityTermRows(kind, rows) {
  const terms = [];
  for (const row of rows || []) {
    if (!row || !row.id || typeof row.name !== 'string' || !row.name) continue;
    terms.push({ id: `term.entity.${kind}.${row.id}.name`, canonicalText: row.name });
    if (typeof row.tooltip === 'string' && row.tooltip) {
      terms.push({ id: `term.entity.${kind}.${row.id}.tooltip`, canonicalText: row.tooltip });
    }
  }
  return terms;
}

/**
 * createEntityTermOverlay(bundle) → frozen display resolvers for the bundle's
 * statuses and stances. A display returns null for an unknown id and omits
 * `tooltip` where the entity authored none — callers keep their existing
 * skip behavior.
 */
export function createEntityTermOverlay(bundle) {
  const terms = new TermRegistry([
    ...entityTermRows('status', bundle.statuses),
    ...entityTermRows('stance', bundle.stances),
  ]);
  const display = (kind) => (id) => {
    const nameId = `term.entity.${kind}.${id}.name`;
    if (!terms.has(nameId)) return null;
    const tooltipId = `term.entity.${kind}.${id}.tooltip`;
    return {
      name: terms.displayTerm(nameId),
      ...(terms.has(tooltipId) ? { tooltip: terms.displayTerm(tooltipId) } : {}),
    };
  };
  return Object.freeze({
    statusDisplay: display('status'),
    stanceDisplay: display('stance'),
  });
}
