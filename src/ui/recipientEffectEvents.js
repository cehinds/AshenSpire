import { combatEffectReceipt } from '../model/combatEffectEvents.js';
import { RecipientEffectsForEvent, RecipientWindupFor, RecipientStatusPolarity, ResolveRecipientEffect, RecipientDeliveryFor } from '../model/recipientEffects.js';
import { RECIPIENT_EFFECT_SETTINGS as SETTINGS } from '../content/recipientEffectSettings.js';
import { PrewarmRecipientEffect } from './recipientEffectSprites.js';
import { BUFF_STATUS_IDS } from './buffFeedback.js';

const MARKERS = new Set(['cardPlayed', 'enemyMoveStarted', 'combatHitStarted', 'combatContactPrepared', 'combatCounterTriggered']);
const BOUNDARIES = new Set(['playerTurnStart', 'playerTurnEnd', 'enemyTurnStart', 'enemyTurnEnd']);
function matchingGrants(action, event) {
  return (action?.effects || []).filter(effect => {
    if (event.type === 'statusApplied') return effect.op === 'applyStatus' && effect.status === event.status;
    if (event.type === 'healed') return effect.op === 'heal';
    if (event.type === 'staminaRecovered') return effect.op === 'restoreStamina';
    if (event.type === 'manaRestored') return effect.op === 'restoreMana';
    if (event.type === 'blockGained') return effect.op === 'block';
    if (event.type === 'counterStacksChanged') return effect.op === 'gainCounterStacks';
    if (event.type === 'reflectStacksChanged') return effect.op === 'applyReflect';
    if (event.type === 'persistentWardChanged' || (event.type === 'meterGuardGained' && event.meter === 'ward')) return ['gainWard', 'block'].includes(effect.op);
    return false;
  });
}

/** One state per mounted fight, never a global dedup cache or engine state. */
export function CreateRecipientEffectState() {
  return { serial: 0, clipSerial: 0, actions: new Map(), contacts: new Map(), roots: new Map(), current: null, wardColors: new Map() };
}

function linkSecondary(state, primary, secondary) {
  primary.primaryKey ||= `recipient-clip-${++state.clipSerial}`;
  secondary.afterPrimaryKey = primary.primaryKey;
}

/** Collect a presentation beat without moving or replacing its engine receipts. */
export function RecipientEffectBatchForBeat(events) {
  const marker = events.find(event => MARKERS.has(event.type));
  const actionKey = marker?.recipientActionKey;
  return events.flatMap(event => (event.recipientEffects || []).map(layer =>
    // The engine commits a paid Advance before emitting the card or move
    // marker. The movement sprite belongs to that upcoming actor beat.
    actionKey && layer.phase === 'movement' && layer.sourceId === marker.recipientSourceId
      ? { ...layer, actionKey } : layer));
}

// activateCombatContact names each hit `${rootKey}:hit:${contactIndex}`.
// Keep that root for once-per-action presentation, while contactIndex still
// isolates the individual hit's defense and secondary-effect receipts.
function rootContactKey(event) {
  if (typeof event.contactKey !== 'string') return null;
  const suffix = `:hit:${event.contactIndex}`;
  return Number.isSafeInteger(event.contactIndex) && event.contactKey.endsWith(suffix)
    ? event.contactKey.slice(0, -suffix.length) : event.contactKey;
}

// Presentation-only annotations. Definitions select appearance; engine receipts
// select outcomes. State survives paused reaction dispatches and nested counters.
export function DecorateRecipientEffects(events, { resolveCard, resolveEnemyMove, resolveStatus, resolveTelegraphTargets, state = CreateRecipientEffectState() } = {}) {
  let segment = 0;
  const movement = new Set();
  const annotated = events.map(raw => {
    const event = combatEffectReceipt(raw);
    if (BOUNDARIES.has(event.type)) {
      segment++;
      movement.clear();
      state.actions.clear(); state.contacts.clear(); state.roots.clear(); state.current = null;
    }
    let marker = null;
    if (MARKERS.has(event.type)) {
      segment++;
      movement.clear();
      const sourceId = event.sourceId || event.playerId || 'player';
      const prior = state.actions.get(sourceId);
      const continuation = ['combatHitStarted', 'combatContactPrepared'].includes(event.type)
        || (event.type === 'enemyMoveStarted' && event.contactPrepared);
      const keyed = event.contactKey && state.contacts.get(event.contactKey);
      const root = rootContactKey(event);
      const rootId = root == null ? null : JSON.stringify([sourceId, root]);
      const rooted = rootId && state.roots.get(rootId);
      const context = keyed?.sourceId === sourceId ? keyed
        : rooted || (!event.contactKey && continuation ? prior : null);
      let definition = (event.type === 'cardPlayed' || event.sourceKind === 'player' ? resolveCard?.(event) : resolveEnemyMove?.(event)) || context?.definition || {};
      // Enemy receipts capture the expanded move profile under their public
      // intent/action projection. It outranks the raw authored move's tags.
      const profile = event.combatProfile || event.intentPreview?.combatProfile || event.intentPreview?.profile || event.actionPreview?.profile;
      if (profile) definition = { ...definition, combatProfile: profile };
      if (event.type === 'combatCounterTriggered') definition = { ...definition, combatProfile: { ...definition.combatProfile, maneuver: 'counter' } };
      marker = context || { key: `recipient-action-${++state.serial}`, sourceId, swept: false, windupShown: false };
      if (Number.isFinite(event.contactIndex)) marker.contactIndex = event.contactIndex;
      marker.definition = { ...definition, sourceId };
      state.actions.set(sourceId, marker);
      if (event.contactKey) state.contacts.set(event.contactKey, marker);
      if (rootId) state.roots.set(rootId, marker);
      state.current = marker;
    }
    const owner = event.sourceId;
    let context = (owner ? state.actions.get(owner) : state.current) || null;
    if (!owner && event.targetId !== state.current?.sourceId) {
      // A nested counter must not steal the interrupted actor's source-less
      // self Ward/heal grants. Explicit ally grants remain with their caster.
      const currentHasAllyGrant = matchingGrants(state.current?.definition, event).some(effect => !['self', 'owner'].includes(effect.target));
      const targetContext = state.actions.get(event.targetId);
      if (!currentHasAllyGrant && matchingGrants(targetContext?.definition, event).some(effect => ['self', 'owner'].includes(effect.target))) context = targetContext;
    }
    const definition = context?.definition || {};
    const sourceId = owner || context?.sourceId || null;
    if (owner && context) state.current = context;
    const polarity = event.status ? BUFF_STATUS_IDS.includes(event.status) ? 'positive' : RecipientStatusPolarity(resolveStatus?.(event.status)) : 'neutral';
    const normalized = { ...event, sourceId,
      ...(event.type === 'energyGained' && !event.targetId ? { targetId: event.playerId || sourceId } : {}),
      ...(polarity !== 'neutral' && !event.polarity ? { polarity, beneficial: polarity === 'positive' } : {}) };
    let layers = RecipientEffectsForEvent(definition, normalized).map(layer => ({ ...layer, actionKey: context?.key || null }));
    if (layers[0]?.phase === 'movement') {
      // A single step can change several pairwise distances. Paint the mover
      // once while retaining every receipt for the formation strips.
      const { shape, targetId } = layers[0];
      const key = JSON.stringify([shape, targetId]);
      if (movement.has(key)) layers = [];
      else movement.add(key);
    }
    if (context && event.type === 'statusApplied' && layers.length) {
      const key = JSON.stringify([layers[0].targetId, event.status]);
      const applications = context.statusApplications ||= new Set();
      if (applications.has(key)) layers = [];
      else applications.add(key);
    }
    // Ward remembers the protected actor's own granted tint, not the attacker's.
    for (const layer of layers) if (['ward', 'ward-shatter'].includes(layer.shape)) {
      if (layer.treatment === 'gain') state.wardColors.set(layer.targetId, { color: layer.color, palette: layer.palette });
      else Object.assign(layer, state.wardColors.get(layer.targetId) || {});
    }
    let windup = null;
    if (marker && !marker.windupShown) {
      const circle = RecipientWindupFor(marker.definition, normalized);
      if (circle) windup = { ...circle, actionKey: marker.key };
      marker.windupShown = true;
    }
    let approach = null;
    if (marker && event.type === 'combatContactPrepared') {
      const targetIds = [...new Set((resolveTelegraphTargets?.(event) || [event.targetId]).filter(Boolean))];
      if (targetIds.length) {
        const base = ResolveRecipientEffect(marker.definition, normalized);
        approach = { ...base, impactShape: base.shape, shape: null, phase: 'delivery', mount: 'target',
          sourceId, targetIds, actionKey: marker.key, claimsDamage: false, delivery: RecipientDeliveryFor(marker.definition, normalized) };
        (marker.preparedDeliveries ||= new Set()).add(marker.contactIndex || 0);
        PrewarmRecipientEffect({ ...approach, shape: approach.impactShape });
      }
    }
    if (context?.preparedDeliveries?.has(context.contactIndex || 0)) layers = layers.map(layer => ({ ...layer, delivery: null }));
    const result = { ...raw, recipientEffects: layers, recipientEffect: layers[0] || null,
      recipientTargetId: layers[0]?.targetId || event.targetId || null,
      recipientSourceId: sourceId, recipientActionKey: context?.key || null,
      recipientContactKey: context ? `${context.key}:${context.contactIndex || 0}` : null,
      ...(windup ? { recipientWindup: windup } : {}) };
    if (approach) result.recipientDelivery = approach;
    return { result, event, context, segment };
  });

  const sameContact = (a, b) => a.result.recipientActionKey != null && a.result.recipientActionKey === b.result.recipientActionKey
    && a.result.recipientContactKey === b.result.recipientContactKey && a.result.recipientTargetId === b.result.recipientTargetId;
  const sameLifecycle = (a, b) => a.segment === b.segment && a.result.recipientTargetId === b.result.recipientTargetId
    && a.result.recipientActionKey === b.result.recipientActionKey;
  for (let i = 0; i < annotated.length; i++) {
    const row = annotated[i], { event, result } = row;
    // Engine emits statusRemoved then statusExpired for one consumption, and
    // procBurst then hpLost for one burst. Preserve one visual per real result.
    if (event.type === 'statusExpired' && annotated.slice(0, i).some(other => other.event.type === 'statusRemoved'
      && other.event.status === event.status && sameLifecycle(row, other))) result.recipientEffects = [];
    if (event.type === 'hpLost' && String(event.cause).startsWith('proc:') && annotated.slice(0, i).some(other => other.event.type === 'procBurst'
      && other.event.status === String(event.cause).slice(5) && sameLifecycle(row, other))) result.recipientEffects = [];
    if (event.type === 'persistentWardChanged' && event.spent > 0 && annotated.some(other => other.event.type === 'damageDealt'
      && sameContact(row, other) && other.result.recipientEffects.some(layer => layer.shape === 'ward'))) result.recipientEffects = [];
    // Match a secondary only to an actual preceding contact in this action and
    // recipient. Standalone healing/status uses its own non-damaging primary.
    const preceding = annotated.slice(0, i).findLast(other => sameContact(row, other)
      && other.result.recipientEffects.some(layer => layer.phase === 'contact'));
    const secondary = result.recipientEffects.find(layer => layer.secondary);
    if (secondary && preceding) {
      const bloodApply = event.type === 'statusApplied' && ['bleed', 'bleeding'].includes(event.status);
      if (event.type === 'healed' || bloodApply) {
        const primary = preceding.result.recipientEffects.find(layer => layer.phase === 'contact');
        linkSecondary(state, primary, secondary);
        preceding.result.recipientEffects.push(secondary);
        result.recipientEffects = [];
      }
    }
    if (secondary && result.recipientEffects.includes(secondary)) {
      const primary = result.recipientEffects.find(layer => layer !== secondary);
      if (primary) linkSecondary(state, primary, secondary);
    }
    // A break replaces the same defense's hit pulse for this contact. Multiple
    // damage receipts still retain their distinct physical impacts.
    if (['blockBroken', 'combatGuardBroken'].includes(event.type)) {
      // A legacy Smash reports both the depleted Block and the Smash guard
      // consequence. They describe one break. A later damage receipt starts
      // another contact even when legacy events have no explicit hit index.
      const lastDamage = annotated.slice(0, i).findLastIndex(other => sameContact(row, other) && other.event.type === 'damageDealt');
      const pairedType = event.type === 'blockBroken' ? 'combatGuardBroken' : 'blockBroken';
      if (annotated.slice(lastDamage + 1, i).some(other => sameContact(row, other) && other.event.type === pairedType)) {
        result.recipientEffects = result.recipientEffects.filter(layer => layer.shape !== 'block-break');
      }
    }
    for (const layer of result.recipientEffects) {
      const hitShape = layer.shape === 'block-break' ? 'block-hit' : layer.shape === 'poise-break' ? 'poise-hit'
        : layer.shape === 'ward-shatter' ? 'ward' : null;
      if (!hitShape) continue;
      const previous = annotated.slice(0, i).findLast(other => sameContact(row, other)
        && other.result.recipientEffects.some(clip => clip.shape === hitShape && clip.treatment !== 'gain'));
      if (previous) previous.result.recipientEffects = previous.result.recipientEffects.filter(clip => clip.shape !== hitShape || clip.treatment === 'gain');
    }
    // Avoidance belongs to this individual hit. A later evasion must never
    // remove an earlier successful hit of a multi-contact action.
  }

  const groups = new Map();
  for (const row of annotated) {
    for (const layer of row.result.recipientEffects) if (layer.shape === 'sweep' && layer.phase === 'contact') {
      const key = row.context?.key || row;
      const group = groups.get(key) || { rows: [], layers: [], context: row.context };
      group.rows.push(row); group.layers.push(layer); groups.set(key, group);
    }
  }
  for (const group of groups.values()) {
    const first = group.layers[0];
    first.mount = 'group'; first.targetType = 'aoe';
    first.targetIds = [...new Set(group.layers.flatMap(layer => layer.targetIds))];
    first.claimsDamage = group.layers.some(layer => layer.claimsDamage);
    first.opacity = first.claimsDamage ? SETTINGS.layering.opacity.primary : SETTINGS.layering.opacity.protectedContact;
    const primaryKeys = new Set(group.layers.map(layer => layer.primaryKey).filter(Boolean));
    for (const row of group.rows) for (const layer of row.result.recipientEffects) {
      if (primaryKeys.has(layer.afterPrimaryKey)) {
        if (group.context?.swept) delete layer.afterPrimaryKey;
        else linkSecondary(state, first, layer);
      }
    }
    for (const row of group.rows) row.result.recipientEffects = row.result.recipientEffects.filter(layer => layer.shape !== 'sweep'
      || layer.phase !== 'contact' || (!group.context?.swept && layer === first));
    if (group.context) group.context.swept = true;
  }
  return annotated.map(({ result }) => {
    result.recipientEffect = result.recipientEffects[0] || null;
    for (const layer of [...result.recipientEffects, result.recipientWindup].filter(Boolean)) PrewarmRecipientEffect(layer);
    return result;
  });
}
