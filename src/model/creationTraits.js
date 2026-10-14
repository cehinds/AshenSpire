// Detached creation projection and atomic initial class-trait validation.
import { openRunClassMastery, registriesForClassMastery } from './classMasteryRun.js';
import { nodeTokens } from './tree.js';
import { initialClassTreeChoices, pickInitialClassTreeNode } from './classTree.js';

export function creationTraitPreview(registries, run, meta, ids = []) {
  openRunClassMastery(registries, run, meta, { receiptId: 'creation-preview', bankable: false });
  const scoped = registriesForClassMastery(registries, run);
  const chosen = [];
  for (const id of ids) {
    if (!pickInitialClassTreeNode(scoped, run, id)) break;
    chosen.push(id);
  }
  return { run, registries: scoped, chosen, choices: initialClassTreeChoices(scoped, run) };
}

export function applyCreationTraits(registries, run, ids) {
  if (ids === undefined) return true; // Saved/legacy callers retain the pending-choice fallback.
  if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string')) return false;
  const draft = structuredClone(run);
  const scoped = registriesForClassMastery(registries, draft);
  for (const id of ids) if (!pickInitialClassTreeNode(scoped, draft, id)) return false;
  if (draft.classMasteryState.initialTreeTiers.length) return false;
  run.coreTags = draft.coreTags;
  run.classMasteryState.initialTreeTiers = [];
  return true;
}

export function creationTraitDescription(registries, id) {
  const rule = registries.propertyRules.has(id) ? registries.propertyRules.get(id) : null;
  const tokens = nodeTokens(registries, id);
  return rule?.textTemplate?.replace(/\{([\w.]+)\}/g, (token, key) => Number.isFinite(tokens[key]) ? String(tokens[key]) : token)
    || registries.nodes.find(row => row.id === id)?.blurb || '';
}
