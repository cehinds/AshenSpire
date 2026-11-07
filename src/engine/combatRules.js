import { shareableGameProfile } from '../model/ownedGameProfile.js';
import { bindTurnStamina } from '../model/turnStamina.js';
import { createRng } from './rng.js';
import { attachSkillXp } from './skillXp.js';
import * as Control from './combatStatusControl.js';
import { ashenBlightRestorationPercent } from './ashenBlight.js';
import * as Actions from './actions.js';
import { effectiveAshenBlightAttributes } from '../model/ashenBlight.js';

// The action pipeline's shared helpers: the card-action list, play refusals,
// and the candidate-state / transaction pair every committed play runs inside.

export function cardActions(ctx, def, source, target, card, meta, sourceSnapshots = null) {
  const actionTarget = effect => effect.op === 'moveEngagement' && effect.target === 'pendingAttacker'
    ? ctx.enemies.find(enemy => enemy.id === ctx._reactionSourceId) || target : target;
  const damageSources=sourceSnapshots ? [...sourceSnapshots.entries()].filter(([effect])=>effect?.op==='damage').map(([,snapshot])=>snapshot) : [];
  let damageIndex=0;
  return (def.effects || []).map(effect=>{
    // Preparation/charges may copy an authored effect. Keep its ordinal's
    // frozen source without replacing the accepted root's stance/metadata.
    const ordinal=effect.op==='damage'?damageIndex++:null;
    const snapshot=sourceSnapshots?.get(effect) || (ctx.rangeState && ordinal!==null ? damageSources[ordinal] : null);
    return {effect,source,owner:source,target:actionTarget(effect),card:snapshot?{...card,...snapshot}:card,meta};
  });
}

/** A card-play refusal that names why, so a reaction trial can say it (SPEC §4.10). */
export function playRefusal(message, reason, extra = {}) {
  return Object.assign(new Error(message), { playRefusal: { reason, ...extra } });
}

const SHARED_RULE_KEYS = ['combatExpansionRules', 'combatMatchupRules', 'combatIntentRules'];

/** Clone one graph, preserving references between players, piles and seats.
 *
 * `detached` is for a candidate that is read and thrown away (a preview, a
 * reaction option probe, a cost preflight) and is never committed back into
 * `ctx`. Its event log starts empty instead of copying the fight's history:
 * the log grows with every event of the fight (120 KB by turn 2), it was most
 * of what each preview cloned, and a phone spent seconds per tap cloning it.
 * Everything that reads a candidate's log reads only what it emitted itself
 * (`eventLog.length` before and `slice(start)` after), so an empty start is
 * the same answer. A transaction (foundationTransaction) keeps the full log:
 * it replaces ctx's.
 */
export function candidateState(ctx, { detached = false } = {}) {
  const data = {};
  for (const [key, value] of Object.entries(ctx)) {
    if (typeof value !== 'function' && key !== 'registries' && key !== 'rng' && !(detached && key === 'eventLog')) data[key] = value;
  }
  // Only a privately owned immutable profile may bypass the clone. The guard
  // falls back if another data field aliases it (or one of its descendants).
  const sharedProfile = shareableGameProfile(data);
  if (sharedProfile) delete data.gameProfile;
  // Rule tables frozen once at createCombat are immutable, so a candidate
  // shares them by reference; a restored/legacy unfrozen table still clones.
  const sharedRules = {};
  for (const key of SHARED_RULE_KEYS) {
    if (data[key] && typeof data[key] === 'object' && Object.isFrozen(data[key])) { sharedRules[key] = data[key]; delete data[key]; }
  }
  const candidate = { ...structuredClone(data), ...sharedRules, ...(sharedProfile ? { gameProfile: sharedProfile } : {}), ...(detached ? { eventLog: [] } : {}), registries: ctx.registries, rng: createRng(ctx.rng.seed, ctx.rng.getCounters()), _emitEvent: ctx._emitEvent };
  // Catalogue accessors are immutable context, never serializable combat data.
  if (ctx.registriesForPlayer) candidate.registriesForPlayer = ctx.registriesForPlayer;
  if (ctx.registerPlayerRegistries) candidate.registerPlayerRegistries = ctx.registerPlayerRegistries;
  if (candidate.player) bindTurnStamina(candidate.player);
  if (candidate.players) for (const seat of candidate.players.values()) bindTurnStamina(seat.entity);
  candidate.emit = (type, payload) => candidate._emitEvent(candidate, type, payload);
  // Detached plays must pay the same receipt as the live event bus. Failed
  // plays and previews keep those payments confined to this candidate.
  attachSkillXp(candidate);
  candidate.enqueue = (action) => candidate.queue.push(action);
  candidate.nextInstanceId = () => `gen${++candidate._idCounter}`;
  if (candidate.combatExpansionVersion === 2 || candidate.sharedExpansionVersion === 2) {
    candidate.combatControlRestrictions = entity => Control.controlRestrictions({ ...candidate, combatExpansionVersion: entity?.combatExpansionVersion || 1 }, entity);
    candidate.restorationModifierPercent = (entity, kind) => ashenBlightRestorationPercent({ ...candidate, combatExpansionVersion: entity?.combatExpansionVersion || 1 }, entity, kind, String(entity?.combatOwnerCycle || 0));
  }
  if (ctx.players) candidate.playerIdForEntity = (entity) => {
    for (const [id, seat] of candidate.players) if (seat.entity === entity) return id;
    return null;
  };
  if (ctx.players) candidate.drawCardsFor = (entity, amount) => {
    const seat = candidate.players.get(candidate.playerIdForEntity(entity));
    if (!seat) return Actions.drawCards(candidate, amount);
    const fields = ['player', 'piles', 'playerKey', 'registries', 'attributes', 'allocatedAttributes', 'combatExpansionVersion',
      'loadout', 'itemUpgradeLevels', 'skills', 'attributeMode', 'orderedDraw', 'handRules', 'handMax', 'classId', 'characterLevel', 'derivedStatRuleSnapshot'];
    const previous = Object.fromEntries(fields.map(key => [key, candidate[key]]));
    Object.assign(candidate, { player: seat.entity, piles: seat.piles, playerKey: seat.id,
      registries: candidate.registriesForPlayer?.(seat.id) || candidate.registries,
      attributes: effectiveAshenBlightAttributes(seat.entity, seat.allocatedAttributes || seat.attributes),
      allocatedAttributes: seat.allocatedAttributes || seat.attributes, combatExpansionVersion: seat.entity.combatExpansionVersion || 1,
      loadout: seat.loadout, itemUpgradeLevels: seat.itemUpgradeLevels, skills: seat.skills || {}, attributeMode: seat.attributeMode || null,
      orderedDraw: seat.orderedDraw || null, handRules: seat.handRules, handMax: seat.handMax,
      classId: seat.entity.classId, characterLevel: seat.level, derivedStatRuleSnapshot: seat.derivedStatRuleSnapshot });
    try { return Actions.drawCards(candidate, amount); }
    finally { Object.assign(candidate, previous); }
  };
  return candidate;
}

/** Reject malformed/looping actions without consuming cards, pools or RNG. */
export function foundationTransaction(ctx, execute) {
  const candidate = candidateState(ctx);
  candidate._foundationTransaction = true;
  const result = execute(candidate);
  delete candidate._foundationTransaction;
  // Hosts save the accepted candidate before any stable entity or RNG changes.
  // This function is intentionally absent from detached previews.
  if ((ctx.combatExpansionVersion === 2 || ctx.sharedExpansionVersion === 2) && typeof ctx.beforeCombatCommit === 'function') {
    if (ctx.beforeCombatCommit(candidate)?.ok === false) throw new Error('Combat save was refused; the action was not committed');
  }
  // Public combat entities and seats are stable handles. Commit the detached
  // values into those handles and reconnect paused actions to the same graph.
  const entities = new Map();
  const commitEntity = (old, next) => {
    if (!old || !next) return next;
    entities.set(next, old);
    for (const key of Object.keys(old)) delete old[key];
    Object.assign(old, next);
    if (old.kind === 'player') bindTurnStamina(old);
    return old;
  };
  if (candidate.players) {
    for (const [id, next] of candidate.players) {
      const old = ctx.players.get(id);
      if (!old) continue;
      next.entity = commitEntity(old.entity, next.entity);
      for (const key of Object.keys(old)) if (!(key in next)) delete old[key];
      Object.assign(old, next);
      candidate.players.set(id, old);
    }
  } else candidate.player = commitEntity(ctx.player, candidate.player);
  candidate.enemies = candidate.enemies.map((entity, i) => commitEntity(ctx.enemies[i], entity));
  if (candidate.players) candidate.player = entities.get(candidate.player) || candidate.player;
  for (const action of candidate.queue) for (const key of ['source', 'owner', 'target']) action[key] = entities.get(action[key]) || action[key];
  for (const action of candidate.reactionResume?.queue || []) for (const key of ['source', 'owner', 'target']) action[key] = entities.get(action[key]) || action[key];
  // Keep the run's loadout object identity when committing an equipment change.
  if (!ctx.players && ctx.loadout && candidate.loadout) {
    for (const key of Object.keys(ctx.loadout)) delete ctx.loadout[key];
    Object.assign(ctx.loadout, candidate.loadout); candidate.loadout = ctx.loadout;
  }
  for (const key of Object.keys(ctx)) if (typeof ctx[key] !== 'function' && !['registries', 'rng'].includes(key) && !(key in candidate)) delete ctx[key];
  for (const [key, value] of Object.entries(candidate)) {
    if (key === 'rng') ctx.rng.restoreCounters(value.getCounters());
    else if (typeof value !== 'function' && key !== 'registries') ctx[key] = value;
  }
  if (ctx.registriesForPlayer) ctx.registries = ctx.registriesForPlayer(ctx.playerKey);
  return result;
}
