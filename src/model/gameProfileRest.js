// Exactly one committed configured service per persisted visit. No arrival grant.
import { withGameProfileService } from './gameProfileRun.js';
import { gameModule, gameContent } from './gameProfile.js';
import { applyLevelUp, rederivePools } from './levelup.js';
import { commitSmithing } from './smithing.js';
import { refillFlaskCharges } from './gracerefill.js';
import { syncZones } from './state.js';
import { commitDeckEditDraft } from './deckRules.js';

function restContext(run) {
  const node = run.mapGraph?.nodes?.[run.mapNodeId];
  if (!node || (node.type !== 'shrine' && node.actualType !== 'rest')) throw new Error('Rest service requires the current rest node');
  return `${run.actNumber}:${run.mapNodeId}`;
}
export function beginGameProfileRest(run, visitId = restContext(run)) {
  if (gameModule(run, 'rest')?.mode !== 'configured') throw new Error('Configured rest is unavailable');
  if (visitId !== restContext(run)) throw new Error('Rest visitId must identify the current rest node');
  run.gameProfileRestVisits ||= {};
  run.gameProfileRestVisits[visitId] ||= { id: visitId, service: null };
  run.gameProfileRestVisitId = visitId;
  return run.gameProfileRestVisits[visitId];
}
export function createGameProfileRestDraft(run) {
  if (run.gameProfileRestVisitId !== restContext(run)) throw new Error('Rest visit is stale');
  const visit = run.gameProfileRestVisits?.[run.gameProfileRestVisitId];
  if (!visit || visit.service) throw new Error('Rest visit is unavailable or spent');
  return structuredClone(run);
}

function applyService(registries, draft, service, payload) {
  const rules = gameContent(draft, 'rests');
  if (draft.gameProfileRestVisitId !== restContext(draft)) throw new Error('Rest visit is stale');
  const visit = draft.gameProfileRestVisits?.[draft.gameProfileRestVisitId];
  if (gameModule(draft, 'rest')?.mode !== 'configured' || !visit || visit.service) throw new Error('Rest visit is unavailable or spent');
  if (!rules.services.includes(service)) throw new Error(`Unknown rest service '${service}'`);
  if (service === 'strategize' && payload.draft) {
    const edited = payload.draft;
    if (edited.gameProfileRestVisitId !== draft.gameProfileRestVisitId) throw new Error('Stale Strategize draft');
    commitDeckEditDraft(registries, draft, edited, payload.settings || {});
  }
  if (service === 'levelUp') withGameProfileService(draft, service, () => applyLevelUp(registries, draft, payload.attributeId));
  if (service === 'smith') {
    if (rules.smith?.tiersPerService !== 1) throw new Error('Smith requires an authored single-tier service policy');
    withGameProfileService(draft, service, () => commitSmithing(registries, draft, payload.itemRef, undefined, { free: rules.smith.free === true }));
    rederivePools(registries, draft, 'Smith equipment upgrade');
  }
  draft.hp = draft.maxHp;
  draft.mana = draft.maxMana;
  draft.stamina = draft.maxStamina;
  if (draft.flaskCharges) refillFlaskCharges(draft.flaskCharges);
  visit.service = service;
  syncZones(draft);
  return { visitId: visit.id, service, hp: draft.hp, mana: draft.mana, stamina: draft.stamina };
}
export function previewGameProfileRest(registries, run, service, payload = {}) {
  const draft = structuredClone(run);
  return { run: draft, receipt: applyService(registries, draft, service, payload) };
}
export function commitGameProfileRest(registries, run, service, payload = {}) {
  const { run: draft, receipt } = previewGameProfileRest(registries, run, service, payload);
  Object.assign(run, draft);
  return receipt;
}
