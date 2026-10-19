import { gameContent } from '../../model/gameProfile.js';
import { previewGameProfileRest, restServiceSpent, restServicesAll, restSmithFree } from '../../model/gameProfileRest.js';
import { smithingPlan } from '../../model/smithing.js';
import { smithSelectionModel } from './SmithSelectionModel.js';
import { t } from '../strings.js';

// Every available choice has successfully previewed the same transaction that
// confirmation will commit. Planning never grants recovery or spends a visit.
export function gameProfileRestModel(registries, run, visit) {
  const rules = gameContent(run, 'rests');
  const attempt = (service, payload = {}) => {
    if (restServiceSpent(run, visit, service)) return { available: false, reason: t('gameProfile.rest.spent') };
    try { return { available: true, reason: '', preview: previewGameProfileRest(registries, run, service, payload).run }; }
    catch (error) { return { available: false, reason: error.message }; }
  };
  const smith = smithingPlan(registries, run, undefined, { free: restSmithFree(run) });
  const smithPreviews = new Map(smith.candidates.map(candidate => [candidate.itemRef, attempt('smith', { itemRef: candidate.itemRef })]));
  const attributes = Object.keys(run.attributes || {}).map(id => {
    const def = registries.attributes.get(id);
    return { id, label: def.label || def.name || id, shortLabel: def.shortLabel || id, value: run.attributes[id], ...attempt('levelUp', { attributeId: id }) };
  });
  const services = rules.services.map(id => {
    const result = id === 'smith' ? [...smithPreviews.values()].find(row => row.available) || [...smithPreviews.values()][0] || { available: false, reason: t('gameProfile.rest.noSmith') }
      : id === 'levelUp' ? attributes.find(row => row.available) || attributes[0] || { available: false, reason: t('gameProfile.rest.noLevel') }
      : attempt(id);
    if (id === 'levelUp' && !restServiceSpent(run, visit, id) && !result.available && !(run.level?.unspentPoints > 0)) result.reason = t('gameProfile.rest.noLevel');
    return { ...result, id, title: t(`gameProfile.rest.service.${id}`), description: t(restServicesAll(run) ? `gameProfile.rest.description.${id === 'smith' && !restSmithFree(run) ? 'smithAllPaid' : `${id}All`}` : `gameProfile.rest.description.${id}`) };
  });
  return { services, smith, smithPreviews, attributes, smithFree: restSmithFree(run) };
}

export function gameProfileSmithModel(registries, plan, previews, selectedItemRef, recoveryHtml, { all = false, levelUpOffered = true } = {}) {
  const model = smithSelectionModel(registries, plan, selectedItemRef);
  const selected = model.properties.selected;
  const preview = selected ? previews.get(selected.itemRef) : null;
  return { ...model, properties: { ...model.properties,
    consequence: t(all ? (levelUpOffered ? 'gameProfile.rest.smithConsequenceAll' : 'gameProfile.rest.smithConsequenceAny') : 'gameProfile.rest.smithConsequence'),
    consequenceBadge: t(all ? 'gameProfile.rest.staysVisit' : 'gameProfile.rest.completesVisit'),
    decisionConsequence: t(all ? 'gameProfile.rest.smithDecisionAll' : 'gameProfile.rest.smithDecision'),
    canConfirm: !!selected && preview?.available === true,
    blockedReasons: selected && !preview?.available ? [preview?.reason || t('gameProfile.rest.noSmith')] : [],
    servicePreviewHtml: preview?.available ? recoveryHtml(preview.preview) : '',
  } };
}
