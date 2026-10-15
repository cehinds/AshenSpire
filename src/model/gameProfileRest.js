// Exactly one committed configured service per persisted visit. No arrival grant.
import { withGameProfileService } from './gameProfileRun.js';
import { gameModule, gameContent } from './gameProfile.js';
import { applyLevelUp, rederivePools } from './levelup.js';
import { commitSmithing } from './smithing.js';
import { refillFlaskCharges } from './gracerefill.js';
import { syncZones } from './state.js';
import { deckEditRefusal } from './deckRules.js';

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
    const basics = new Set(gameContent(draft, 'editor')?.unlimitedBasicCards || []);
    const isBasic = card => basics.has(card.cardId);
    if (edited.gameProfileRestVisitId !== draft.gameProfileRestVisitId) throw new Error('Stale Strategize draft');
    const before = new Map([...draft.deck, ...(draft.sideboard || [])].map(card => [card.instanceId, card]));
    const after = [...edited.deck, ...(edited.sideboard || [])];
    if (new Set(after.map(card => card.instanceId)).size !== after.length) throw new Error('Duplicate Strategize card identity');
    for (const card of after) if (!registries.cards.has(card.cardId)) throw new Error(`Unknown edited card '${card.cardId}'`);
    const refusal = deckEditRefusal(edited.deck.length, payload.settings || {});
    if (refusal) throw new Error(refusal);
    for (const card of after) {
      const owned = before.get(card.instanceId);
      if (owned && JSON.stringify(owned) !== JSON.stringify(card)) throw new Error('Strategize cannot modify an owned card');
      if (!owned && !isBasic(card)) throw new Error('Strategize cannot invent a limited card');
    }
    for (const [id, card] of before) if (!isBasic(card) && !after.some(row => row.instanceId === id)) throw new Error('Strategize cannot delete an owned limited card');
    // Copy only deck-edit fields; the caller cannot commit other draft state.
    // Copy only deck-edit fields; a forged draft cannot change HP, XP or gear.
    for (const key of ['deck', 'sideboard', 'equipmentAttackSlotCount', 'removedAttackSlotIds', 'editMintCounter']) {
      if (edited[key] !== undefined) draft[key] = structuredClone(edited[key]);
    }
  }
  if (service === 'levelUp') withGameProfileService(draft, service, () => applyLevelUp(registries, draft, payload.attributeId));
  if (service === 'smith') {
    withGameProfileService(draft, service, () => commitSmithing(registries, draft, payload.itemRef));
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
