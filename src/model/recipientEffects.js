import {
  RECIPIENT_EFFECT_PALETTES as PALETTES,
  RECIPIENT_ATTRIBUTE_ALIASES as ATTRIBUTES,
  RECIPIENT_EFFECT_ALIASES as ALIASES,
  RECIPIENT_STATUS_PALETTES as STATUS_PALETTES,
  RECIPIENT_NEGATIVE_STATUSES as NEGATIVE,
  RECIPIENT_POSITIVE_STATUSES as POSITIVE,
  RECIPIENT_EFFECT_TIMING as TIMING,
  RECIPIENT_ELEMENT_PALETTES as ELEMENT_PALETTES,
  RECIPIENT_LEGACY_MAGIC_TAGS as MAGIC_TAGS,
  RECIPIENT_SILENT_STATUSES as SILENT_STATUSES,
  RECIPIENT_BLOOD_STATUSES as BLOOD_STATUSES,
} from '../content/recipientEffectRecipes.js';
import { normalizeRange } from './combatRanges.js';
import { RECIPIENT_EFFECT_SETTINGS as SETTINGS } from '../content/recipientEffectSettings.js';

const has = (map, key) => Object.hasOwn(map, key);
const positive = value => Number.isFinite(Number(value)) && Number(value) > 0;
const tagIds = action => (action.cardTags ?? action.tags ?? [])
  .map(tag => typeof tag === 'string' ? tag : tag?.id).filter(Boolean);
const canonical = value => has(ALIASES, value) ? ALIASES[value] : value;
const paletteOf = value => has(PALETTES, canonical(value)) ? canonical(value) : null;
const elementalPaletteOf = value => {
  const palette = paletteOf(value);
  return ELEMENT_PALETTES.includes(palette) ? palette : null;
};
const tagged = (tags, prefix) => tags.find(tag => tag.startsWith(prefix))?.slice(prefix.length);
const sourceOf = (action, event) => event.sourcePlayerId || event.sourceId || action.sourcePlayerId || action.sourceId;
const targetOf = event => event.targetPlayerId || (event.targetId === 'player' && event.playerId) || event.targetId;

const STATUS_RESULT_SHAPES = SETTINGS.behavior.statusResultShapes;
const statusResultShape = status => {
  const id = status?.replace(/^base\./, '');
  return has(STATUS_RESULT_SHAPES, id) ? STATUS_RESULT_SHAPES[id] : null;
};
const BENEFICIAL_RESULTS = new Set(['evade-gain', 'counter-gain', 'mirrors', 'reflect']);
const SELF_GAIN_EVENTS = new Set(['evadeGained', 'combatCounterArmed']);
const statusStackGained = event => positive(event.stacks)
  && (!Number.isFinite(event.previousTotal) || !Number.isFinite(event.total) || event.total > event.previousTotal);

function effectMatchesEvent(effect, event) {
  switch (event.type) {
    case 'statusApplied': case 'procBurst': return effect.op === 'applyStatus' && effect.status === event.status;
    case 'healed': return effect.op === 'heal';
    case 'manaRestored': return effect.op === 'restoreMana';
    case 'staminaRecovered': return effect.op === 'restoreStamina';
    case 'energyGained': return effect.op === 'gainEnergy';
    case 'blockGained': return effect.op === 'block';
    case 'counterStacksChanged': return effect.op === 'gainCounterStacks';
    case 'reflectStacksChanged': return effect.op === 'applyReflect';
    case 'persistentWardChanged': return ['gainWard', 'block'].includes(effect.op);
    case 'persistentPoiseChanged': return effect.op === 'gainPoise';
    case 'meterGuardGained': return effect.op === (event.meter === 'ward' ? 'gainWard' : 'gainPoise');
    default: return effect.op === 'damage';
  }
}

function targetTypeOf(action, event, profile, tags) {
  const source = sourceOf(action, event), target = targetOf(event);
  // A multi-effect action can damage all enemies and grant one self buff. The
  // matching operation owns this receipt's targeting, not the card as a whole.
  const effects = (action.effects || []).filter(effect => effectMatchesEvent(effect, event));
  if (effects.some(effect => ['allEnemies', 'allAllies', 'allPlayers', 'all'].includes(effect.target))) return 'aoe';
  if (source && target === source) return 'self';
  if (effects.length && effects.every(effect => ['self', 'owner'].includes(effect.target))) return source && target !== source ? 'target' : 'self';
  if (effects.length && effects.every(effect => ['enemy', 'ally', 'player', 'randomEnemy'].includes(effect.target))) return 'target';
  if (event.targetType === 'self' || event.targetType === 'aoe' || event.targetType === 'target') return event.targetType;
  if (profile.targeting === 'area' || action.targeting === 'area' || tags.includes('targeting:area') || tags.includes('aoe')) return 'aoe';
  if (['self', 'owner'].includes(action.target)) return 'self';
  if (['allEnemies', 'allAllies', 'all'].includes(action.target)) return 'aoe';
  return 'target';
}

/** Pure visual recipe; also accepts a synthetic receipt for the preview gallery. */
export function ResolveRecipientEffect(action = {}, event = {}) {
  action ??= {}; event ??= {};
  const tags = tagIds(action), legacy = tags.map(tag => tag.replace(/^fx:/, ''));
  const profile = action.combatProfile || {};
  const camp = profile.camp || action.camp || tagged(tags, 'camp:');
  const source = action.attack?.source || tagged(tags, 'source:');
  // Modern camp/source identity wins. Old cards predate those fields: preserve
  // their nonphysical damage-school and explicit magic presentation identity.
  const legacySpell = !action.equipmentProfileId && ((action.damageSchool && action.damageSchool !== 'physical')
    || legacy.some(tag => MAGIC_TAGS.includes(tag)));
  const spell = camp ? camp === 'spell' : source ? source === 'spell' : action.type === 'spell' || legacySpell;
  let maneuver = profile.mirrors || profile.maneuver || action.maneuver || tagged(tags, 'maneuver:') || action.stance;
  if (maneuver === 'ranged') maneuver = 'attack';
  if (['casting', 'cast'].includes(maneuver)) maneuver = 'spell';
  if (['defense', 'block', 'guard', 'evade'].includes(maneuver)) maneuver = 'defend';
  const type = String(action.type || action.kind || '').toLowerCase();
  const actionKind = ['attack', 'smash', 'sweep', 'counter', 'defend', 'skill', 'spell'].includes(maneuver)
    ? maneuver : spell ? 'spell' : ['skill', 'power', 'buff', 'debuff'].includes(type)
      || tags.some(tag => ['classification.skill', 'classification.power'].includes(tag)) ? 'skill' : 'attack';
  const rawRange = profile.range || action.range || tagged(tags, 'range:') || tagged(tags, 'reach:')
    || (legacy.includes('ranged') ? 'ranged' : spell ? 'reach' : 'melee');
  // Legacy ranged/projectile content uses the approved Reach presentation;
  // this deliberately does not change the engine's range or targeting rules.
  const range = ['reach', 'ranged', 'projectile'].includes(normalizeRange(rawRange)) || rawRange === 'projectile' ? 'reach' : 'melee';
  const school = profile.school || action.school || tagged(tags, 'school:');
  const damageType = event.damageType || profile.damageType || action.attack?.damageType || tagged(tags, 'damage:');
  const element = tagged(tags, 'element:') || elementalPaletteOf(damageType)
    || tags.filter(tag => tag.startsWith('damage:')).map(tag => elementalPaletteOf(tag.slice(7))).find(Boolean);
  let palette = elementalPaletteOf(element) || elementalPaletteOf(school) || elementalPaletteOf(action.damageSchool)
    || legacy.map(elementalPaletteOf).find(Boolean) || (spell ? 'magic' : actionKind === 'skill' ? 'skill' : 'physical');
  let shape = actionKind === 'smash' ? 'smash' : actionKind === 'sweep' ? 'sweep'
    : actionKind === 'counter' ? 'counter' : spell || actionKind === 'spell' ? 'spell'
      : actionKind === 'skill' || actionKind === 'defend' ? 'skill'
        : ['pierce', 'piercing'].includes(damageType) || legacy.includes('pierce') ? 'thrust'
          : ['blunt', 'crushing'].includes(damageType) || legacy.includes('heavy') ? 'smash' : 'slash';
  let polarity = 'impact';
  const status = event.status || '';
  const attribute = has(ATTRIBUTES, status) ? ATTRIBUTES[status] : status;
  const isAttribute = ['strength', 'dexterity', 'intelligence', 'constitution', 'wisdom', 'charisma', 'stamina', 'mana'].includes(attribute);
  if (event.type === 'healed') { shape = 'heal'; polarity = 'positive'; palette = 'healing'; }
  else if (event.type === 'persistentWardChanged' || (event.type === 'meterGuardGained' && event.meter === 'ward')
    || (event.type === 'statusApplied' && status === 'ward')) { shape = 'ward'; polarity = 'positive'; }
  else if (['blockGained', 'meterGuardGained'].includes(event.type)) { shape = 'skill'; polarity = 'positive'; }
  else if (event.type === 'statusApplied' || event.type === 'procBurst') {
    const negative = event.polarity === 'negative' || event.beneficial === false || NEGATIVE.includes(status);
    polarity = negative ? 'negative' : isAttribute || POSITIVE.includes(status) || status === 'barrier' || event.beneficial === true ? 'positive' : 'neutral';
    shape = negative ? 'debuff' : polarity === 'positive' ? 'buff' : 'status';
    // Attribute hue outranks the casting school's hue; status identity similarly
    // prevents a frost-applying fire action from showing another flame burst.
    palette = isAttribute ? attribute : STATUS_PALETTES[status] || palette;
  }
  const dedicated = event.type === 'statusApplied' ? statusResultShape(status) : null;
  if (dedicated) {
    shape = dedicated;
    polarity = BENEFICIAL_RESULTS.has(shape) ? 'positive' : 'negative';
    palette = SETTINGS.behavior.statusResultPalettes[shape] || palette;
  }
  const aura = dedicated || ['ward', 'buff', 'debuff', 'heal', 'status'].includes(shape);
  return {
    shape, palette, color: PALETTES[palette],
    overlay: dedicated ? null : texture(palette),
    action: actionKind, stance: actionKind,
    targetType: targetTypeOf(action, event, profile, tags), range, polarity,
    camp: spell ? 'spell' : 'physical', school: paletteOf(school),
    frameCount: TIMING.frameCount, durationMs: aura ? TIMING.auraMs : TIMING.impactMs,
  };
}

/** Receipts only: attempted/missed/resisted actions never manufacture a hit. */
export function RecipientEffectForEvent(action = {}, event = {}) {
  if (!targetOf(event)) return null;
  let accepted = false;
  switch (event.type) {
    case 'damageDealt':
      accepted = !event.evaded && !event.immune && !event.missed && !event.dodged
        && [event.amount, event.blocked, event.wardAbsorbed, event.wardMitigated, event.poiseAbsorbed, event.poiseMitigated].some(positive);
      break;
    case 'statusApplied': accepted = statusStackGained(event); break;
    case 'healed': case 'blockGained': case 'meterGuardGained': accepted = positive(event.amount); break;
    case 'persistentWardChanged': accepted = positive(event.restored) || positive(event.missingRecovered); break;
    // Proc receipts carry their own status. The paired damage receipt remains
    // responsible for the damage flash, so do not animate the proc twice here.
    default: return null;
  }
  return accepted ? ResolveRecipientEffect(action, event) : null;
}

const texture = palette => ['fire', 'frost', 'lightning', 'earth', 'force', 'illusion', 'decay'].includes(palette) ? palette : null;
const num = value => Math.max(0, Number(value) || 0);

/** Read authored metadata conservatively: an unknown status stays neutral. */
export function RecipientStatusPolarity(definition = {}) {
  if (definition.beneficial === true || definition.polarity === 'positive') return 'positive';
  if (definition.beneficial === false || definition.polarity === 'negative') return 'negative';
  const modifiers = definition.modifiers || {};
  const positiveKeys = ['attackDamageAdd', 'blockAdd', 'accuracyAdd', 'dodgeAdd', 'ar', 'dr', 'pr', 'ward', 'poise'];
  const signs = [];
  for (const [key, value] of Object.entries(modifiers)) {
    if (positiveKeys.includes(key) && Number(value)) signs.push(Number(value) > 0 ? 1 : -1);
    else if (['damageDealtMult', 'spellDamageDealtMult', 'blockGainedMult'].includes(key) && Number(value) !== 1) signs.push(Number(value) > 1 ? 1 : -1);
    else if (key === 'damageTakenMult' && Number(value) !== 1) signs.push(Number(value) < 1 ? 1 : -1);
    else if (key === 'retainBlock' && value) signs.push(1);
    else if (key === 'skipTurn' && value) signs.push(-1);
  }
  return signs.length && signs.every(sign => sign > 0) ? 'positive' : signs.some(sign => sign < 0) ? 'negative' : 'neutral';
}

function layerFor(action, event, shape, options = {}) {
  const base = ResolveRecipientEffect(action, event);
  return { ...base, shape, phase: 'contact', mount: 'target', delayMs: 0,
    sourceId: sourceOf(action, event) || null, targetId: targetOf(event), targetIds: [targetOf(event)].filter(Boolean),
    durationMs: SETTINGS.motion.clipMs, opacity: SETTINGS.layering.opacity.primary,
    flat: true, claimsDamage: false, silhouette: null, ...options };
}

/** The circle is presentation windup; it never schedules or delays engine work. */
export function RecipientWindupFor(action = {}, event = {}) {
  // Casting identity belongs to the invoker, independently of the eventual
  // damage/status recipient (and independently of an attribute buff's hue).
  const sourceId = sourceOf(action, event);
  const invoker = { ...event, type: 'recipientWindup', sourceId,
    targetId: sourceId, targetPlayerId: sourceId, playerId: undefined, status: undefined };
  const base = ResolveRecipientEffect(action, invoker);
  if (base.camp !== 'spell') return null;
  return layerFor(action, invoker, 'spell-circle', {
    mount: 'actor', phase: 'windup', category: 'castingMovement', targetType: 'self', overlay: null,
    durationMs: SETTINGS.motion.spellWindupMs, opacity: SETTINGS.layering.opacity.spellCircle,
  });
}

/** Delivery styles are separate from flat recipient sprites. Legacy ranged is Reach. */
export function RecipientDeliveryFor(action = {}, event = {}) {
  const base = ResolveRecipientEffect(action, event);
  const reach = base.range === 'reach';
  return { mode: reach ? 'reach-extension' : 'melee-contact',
    style: base.camp === 'spell' ? reach ? 'spell-link' : 'magic-contact' : reach ? 'weapon-extension' : 'weapon-contact',
    durationMs: reach ? SETTINGS.motion.reachDeliveryMs : SETTINGS.motion.meleeDeliveryMs,
    camp: base.camp, school: base.school, color: base.color, overlay: base.overlay };
}

/**
 * Actual engine receipts select layers; tags only choose their appearance.
 * No tag, card intent, stance grant, or failed contact can manufacture damage.
 * The event decorator pairs related receipts and groups Sweeps without mutating
 * these engine receipts or changing their resolution order.
 */
export function RecipientEffectsForEvent(action = {}, event = {}) {
  const type = event.type;
  if (type === 'statusApplied' && (!statusStackGained(event) || SILENT_STATUSES.includes(event.status))) return [];
  const selfResult = SELF_GAIN_EVENTS.has(type) || type === 'reflectTriggered';
  const targetId = selfResult ? sourceOf(action, event)
    : targetOf(event) || (['combatAdvancedChanged', 'implicitAdvance'].includes(type) ? sourceOf(action, event) : null);
  if (!targetId) return [];
  event = { ...event, targetId, ...(selfResult ? { targetPlayerId: null, targetType: 'self' } : {}) };
  const base = ResolveRecipientEffect(action, event);
  const clip = (shape, options) => layerFor(action, event, shape, options);
  const reaction = (shape, options = {}) => clip(shape, { phase: 'reaction', delayMs: SETTINGS.motion.reactionLeadMs,
    category: 'defenseReactions', color: PALETTES.physical, palette: 'physical', overlay: null, ...options });
  const aura = (shape, options = {}) => clip(shape, { phase: 'status', category: 'buffsStatuses', durationMs: SETTINGS.motion.auraMs, ...options });
  if (SELF_GAIN_EVENTS.has(type) || ['counterStacksChanged', 'reflectStacksChanged', 'reflectTriggered'].includes(type)) {
    if (!positive(event.amount)) return [];
    const shape = type === 'evadeGained' ? 'evade-gain' : type.startsWith('reflect') ? 'reflect' : 'counter-gain';
    return [aura(shape, { category: 'defenseReactions', overlay: null, polarity: 'positive', durationMs: SETTINGS.motion.clipMs, treatment: type === 'reflectTriggered' ? 'reflect' : 'gain' })];
  }
  if (['staminaRecovered', 'manaRestored', 'energyGained'].includes(type) && positive(event.amount)) return [aura('buff', {
    palette: type === 'staminaRecovered' ? 'stamina' : type === 'manaRestored' ? 'mana' : 'skill',
    color: PALETTES[type === 'staminaRecovered' ? 'stamina' : type === 'manaRestored' ? 'mana' : 'skill'],
    overlay: null, polarity: 'positive', anchor: 'card-bottom', sizing: 'card',
  })];
  if (type === 'damageDealt') {
    if (event.evaded) return [reaction('evade', { delayMs: 0, silhouette: 'evade', treatment: 'avoid' })];
    if (!RecipientEffectForEvent(action, event)) return [];
    const hp = event.hpRemoved ?? event.hpLoss ?? event.damageReceipt?.hpLoss ?? Math.max(0, num(event.amount) - num(event.blocked));
    const impact = clip(base.shape, { category: 'attackImpacts', claimsDamage: positive(hp), treatment: positive(hp) ? 'impact' : 'protected-contact',
      opacity: positive(hp) ? SETTINGS.layering.opacity.primary : SETTINGS.layering.opacity.protectedContact,
      delivery: RecipientDeliveryFor(action, event) });
    const clips = [impact];
    if (positive(event.blocked)) clips.push(reaction('block-hit'));
    if ([event.poiseAbsorbed, event.poiseMitigated].some(positive)) clips.push(reaction('poise-hit'));
    if ([event.wardAbsorbed, event.wardMitigated, event.wardResisted].some(positive)) clips.push(reaction('ward', {
      palette: base.palette, color: base.color, silhouette: 'ward', treatment: 'absorb',
    }));
    return clips;
  }
  if (['blockBroken', 'combatGuardBroken', 'poiseBroken', 'statusPoiseBreak', 'wardBroken'].includes(type)) {
    if (event.evaded || event.immune) return [];
    return [reaction(['poiseBroken', 'statusPoiseBreak'].includes(type) ? 'poise-break' : type === 'wardBroken' ? 'ward-shatter' : 'block-break',
      type === 'wardBroken' ? { color: base.color, palette: base.palette, silhouette: 'ward', treatment: 'break' } : { treatment: 'break' })];
  }
  if (type === 'persistentWardChanged' && positive(event.spent)) return [reaction('ward', {
    color: base.color, palette: base.palette, silhouette: 'ward', treatment: 'absorb',
  })];
  if (type === 'combatAvoidanceResolved') return event.avoided
    ? [reaction('evade', { delayMs: 0, silhouette: 'evade', treatment: 'avoid' })] : [];
  if (type === 'attackMissed') return event.missReason === 'evaded' || (event.missReason === 'accuracy' && event.evadeAttempted)
    ? [reaction('evade', { delayMs: 0, silhouette: 'evade', treatment: 'avoid' })] : [];
  if (type === 'combatAdvancedChanged') {
    // endAdvance also fires on expiry. Only an explicitly played retreat gets
    // the Retreat visual; the duration timer is never a movement receipt.
    const retreat = tagIds(action).some(tag => ['retreat', 'maneuver:retreat'].includes(tag))
      || (action.effects || []).some(effect => effect.op === 'retreat');
    if (!event.advanced && !retreat) return [];
    return [clip(event.advanced ? 'advance' : 'retreat', { mount: 'actor', phase: 'movement', category: 'castingMovement', overlay: null,
      targetType: 'self', color: PALETTES.physical, durationMs: SETTINGS.motion.movementMs })];
  }
  if (type === 'implicitAdvance' || (type === 'combatEngagementMoved' && ['advance', 'retreat'].includes(event.reason))) {
    return [clip(event.reason === 'retreat' ? 'retreat' : 'advance', { mount: 'actor', phase: 'movement', category: 'castingMovement',
      targetId: sourceOf(action, event), targetIds: [sourceOf(action, event)], targetType: 'self', overlay: null,
      color: PALETTES.physical, durationMs: SETTINGS.motion.movementMs })];
  }
  if ((type === 'persistentWardChanged' && [event.restored, event.missingRecovered].some(positive))
    || (type === 'meterGuardGained' && event.meter === 'ward' && positive(event.amount))
    || (type === 'statusApplied' && event.status === 'ward' && positive(event.stacks))) {
    return [aura('ward', { category: 'defenseReactions', silhouette: 'ward', treatment: 'gain', overlay: null })];
  }
  if (type === 'healed' && positive(event.amount)) {
    // The decorator reuses a preceding confirmed contact when the action has one.
    const primary = ResolveRecipientEffect(action, { ...event, type: 'supportPrimary' });
    return [clip(primary.camp === 'spell' ? 'spell' : 'skill', { ...primary, shape: primary.camp === 'spell' ? 'spell' : 'skill',
      targetType: base.targetType, phase: 'status', category: 'buffsStatuses', claimsDamage: false, treatment: 'support' }),
    clip('heal-plus', { phase: 'status', category: 'buffsStatuses', palette: 'healing', color: PALETTES.healing, overlay: null,
      secondary: true, treatment: 'heal' })];
  }
  if ((['blockGained', 'meterGuardGained'].includes(type) && positive(event.amount))
    || (type === 'persistentPoiseChanged' && [event.restored, event.missingRecovered].some(positive))) {
    return [aura('buff', { category: 'defenseReactions', overlay: null, anchor: 'card-bottom', sizing: 'card' })];
  }
  let lifecycle = null;
  if (type === 'statusApplied' && positive(event.stacks)) lifecycle = 'apply';
  else if (type === 'procBurst' && positive(event.amount)) lifecycle = 'tick';
  else if (type === 'hpLost' && positive(event.amount) && (event.status || event.triggeredBy?.kind === 'status' || /^(proc|status):/.test(event.cause || ''))) lifecycle = 'tick';
  else if ((type === 'procResisted' && positive(event.blocked)) || (type === 'statusImmune' && positive(event.units))
    || (type === 'statusPressure' && positive(event.resisted))) lifecycle = 'resist';
  else if (type === 'statusExpired' || (type === 'statusRemoved' && positive(event.amount))) lifecycle = 'clear';
  if (!lifecycle) return [];
  const status = event.status || (event.triggeredBy?.kind === 'status' ? event.triggeredBy.id : String(event.cause).split(':')[1]);
  const resolved = ResolveRecipientEffect(action, { ...event, type: 'statusApplied', status });
  const palette = STATUS_PALETTES[status] || resolved.palette;
  const blood = BLOOD_STATUSES.includes(status);
  const clear = ['clear', 'resist'].includes(lifecycle);
  const dedicated = lifecycle === 'apply' ? statusResultShape(status) : null;
  const shape = dedicated || (lifecycle === 'apply' && ['buff', 'debuff'].includes(resolved.shape) && (!STATUS_PALETTES[status] || resolved.polarity === 'positive')
    ? resolved.shape : `status-${lifecycle}`);
  const primary = aura(shape, { status, lifecycle, palette, color: PALETTES[palette], polarity: resolved.polarity,
    overlay: blood || dedicated ? null : texture(palette), statusMotif: blood ? 'droplets' : 'glyph',
    overlayScale: SETTINGS.sizing.statusOverlay[lifecycle],
    overlayOffset: clear ? SETTINGS.layering.statusOffset : { x: 0, y: 0 },
    overlayTreatment: lifecycle === 'clear' ? 'fade-out' : lifecycle === 'resist' ? 'deflect' : lifecycle === 'tick' ? 'small-pulse' : 'pulse',
    intensity: lifecycle === 'apply' ? Math.min(SETTINGS.layering.statusStack.maxIntensity, 1 + Math.max(0, num(event.stacks) - 1) * SETTINGS.layering.statusStack.step) : 1,
    durationMs: lifecycle === 'tick' ? SETTINGS.motion.statusTickMs : SETTINGS.motion.clipMs,
    ...(['buff', 'debuff'].includes(shape) ? { anchor: 'card-bottom', sizing: 'card' } : {}) });
  if (!blood) return [primary];
  return [primary, clip('bleed-drops', { phase: 'status', category: 'buffsStatuses', status, lifecycle, secondary: !clear,
    palette, color: PALETTES[palette], overlay: null, claimsDamage: false,
    overlayTreatment: primary.overlayTreatment, treatment: primary.overlayTreatment,
    scale: clear ? SETTINGS.sizing.statusOverlay[lifecycle] : 1,
    offset: clear ? SETTINGS.layering.statusOffset : { x: 0, y: 0 } })];
}
