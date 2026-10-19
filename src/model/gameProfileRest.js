// servicesPerVisit 1 (Current): exactly one committed configured service per persisted visit, no arrival grant.
// servicesPerVisit "all" (Core, D10): the visit heals on arrival and every listed service (Smith, Level Up) is usable once,
// in any order; none closes another and only Continue leaves. `visit.used` maps service -> true; `visit.service` is the last one.
import { withGameProfileService } from './gameProfileRun.js';
import { gameModule, gameContent } from './gameProfile.js';
import { applyLevelUp, rederivePools } from './levelup.js';
import { commitSmithing } from './smithing.js';
import { refillFlaskCharges } from './gracerefill.js';
import { syncZones } from './state.js';
import { commitDeckEditDraft } from './deckRules.js';

// True when arriving restored anything, flasks included. Saves from before the flask fields count them as 0.
export const restHealedAny = healed => !!healed && !!(healed.hp || healed.mana || healed.stamina || healed.flaskHp || healed.flaskMana);
export const restServicesAll = run => gameContent(run, 'rests')?.servicesPerVisit === 'all';
// Saves from before `used` existed carry only `service`; that one service counts as used.
export const restServiceUsed = (visit, service) => !!(visit.used ? visit.used[service] : visit.service === service);
export const restServiceSpent = (run, visit, service) => restServicesAll(run) ? restServiceUsed(visit, service) : !!visit.service;
function healFull(run) {
  run.hp = run.maxHp;
  run.mana = run.maxMana;
  run.stamina = run.maxStamina;
  if (run.flaskCharges) refillFlaskCharges(run.flaskCharges);
}
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
  const visit = run.gameProfileRestVisits[visitId];
  // Core: arriving at the site heals once, so Continue without a service still rests. Reloads and remounts do not heal again.
  if (restServicesAll(run) && !visit.healed) {
    const before = { hp: run.hp, mana: run.mana, stamina: run.stamina, flaskHp: run.flaskCharges?.hpCurrent ?? 0, flaskMana: run.flaskCharges?.manaCurrent ?? 0 };
    healFull(run);
    visit.healed = { hp: run.hp - before.hp, mana: run.mana - before.mana, stamina: run.stamina - before.stamina,
      flaskHp: (run.flaskCharges?.hpCurrent ?? 0) - before.flaskHp, flaskMana: (run.flaskCharges?.manaCurrent ?? 0) - before.flaskMana };
    syncZones(run);
  }
  return visit;
}
export function createGameProfileRestDraft(run) {
  if (run.gameProfileRestVisitId !== restContext(run)) throw new Error('Rest visit is stale');
  const visit = run.gameProfileRestVisits?.[run.gameProfileRestVisitId];
  if (!visit || (!restServicesAll(run) && visit.service)) throw new Error('Rest visit is unavailable or spent');
  return structuredClone(run);
}

function applyService(registries, draft, service, payload) {
  const rules = gameContent(draft, 'rests');
  if (draft.gameProfileRestVisitId !== restContext(draft)) throw new Error('Rest visit is stale');
  const visit = draft.gameProfileRestVisits?.[draft.gameProfileRestVisitId];
  if (gameModule(draft, 'rest')?.mode !== 'configured' || !visit) throw new Error('Rest visit is unavailable or spent');
  if (!rules.services.includes(service)) throw new Error(`Unknown rest service '${service}'`);
  if (restServiceSpent(draft, visit, service)) throw new Error('Rest visit is unavailable or spent');
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
  healFull(draft);
  if (restServicesAll(draft)) visit.used = { ...(visit.used || (visit.service ? { [visit.service]: true } : {})), [service]: true };
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
