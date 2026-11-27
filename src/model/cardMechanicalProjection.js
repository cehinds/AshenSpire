// The same neutral, attributed card-face baseline used by playingCardModel.
// Reference profiles/runs are initialized only on the first headless request.
import { contentBundle } from '../content/index.js';
import * as Registries from './registries.js';
import * as State from './state.js';
import * as Profile from './gameProfile.js';
import { staticCardTokens, PrepareStaticCardTokenReader } from './playingCard.js';
import { computeTokenBindings } from './validate/tokenBindings.js';
import { BarrierPoiseFactor } from './combatRatings.js';
import { ApplyGearCardRules, GearAlwaysOn } from './gearEffects.js';
import { gameProfileEffectiveAttributes } from './gameProfileGear.js';

const classes = ['reaver', 'starseer', 'rogue', 'herald'];
const probeScopes = new WeakMap();
const referencesByRegistry = new WeakMap();
const contextCaches = new WeakMap();
const projectedDefinitions = new WeakMap();
let defaultRegistries;
let defaultProfile;
const transient = new Set([
  '_edited',
  '_custom',
  '_generated',
  '_cpMiss',
  'scoringOverride',
  '_autoName',
  '_autoNameCore',
  '_autoNameBudget',
]);
// Neutral-face inputs only; piles, enemy state and stance receipts never change the baseline.
const contextFields = [
  'class',
  'classId',
  'attributes',
  'allocatedAttributes',
  'faceAttributes',
  'loadout',
  'deck',
  'relics',
  'itemUpgradeLevels',
  'itemUpgradePicks',
  'itemCategories',
  'itemRanks',
  'itemProps',
  'gearRules',
  'gearState',
  'level',
  'levelRewardRuleSnapshot',
  'classLevelBonusVersion',
  'classUnequipped',
  'equipmentProfileRuleSnapshot',
  'derivedStatRuleSnapshot',
  'combatExpansionVersion',
  'core2ActionRulesVersion',
  'fixCoreRules',
];

// An opaque handle for one synchronous upgrade operation; its records stay private.
export function CreateCardUpgradeProjectionScope()
{
  const scope = Object.freeze({});
  probeScopes.set(scope, { records: new WeakMap(), definitions: new WeakMap() });
  return scope;
}

// True when only native cloning can copy the value: functions, accessors, $comment,
// shared or cyclic references, or non-plain prototypes.
function needsNativeNormalization(value, seen = new Set())
{
  if (typeof value === 'function' || typeof value === 'symbol')
  {
    return true;
  }
  if (!value || typeof value !== 'object')
  {
    return false;
  }
  if (seen.has(value))
  {
    return true;
  }
  seen.add(value);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== Array.prototype && prototype !== null)
  {
    return true;
  }
  for (const key of Object.keys(value))
  {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (key === '$comment' || !Object.hasOwn(descriptor, 'value') || needsNativeNormalization(descriptor.value, seen))
    {
      return true;
    }
  }
  return false;
}

function contextSignature(rules)
{
  return JSON.stringify([
    ...contextFields.map(key => rules[key]),
    rules.player?.liveStats?.base?.attributes ?? rules.player?.attributes,
    rules.player?.allocatedAttributes,
  ]);
}

function freeze(value)
{
  if (value && typeof value === 'object' && !Object.isFrozen(value))
  {
    for (const item of Object.values(value))
    {
      freeze(item);
    }
    Object.freeze(value);
  }
  return value;
}

const ReferenceSeed = 31;
const ReferenceCompletedRunIds = ['a', 'b', 'c'];
const MagicReferenceClass = 'starseer';
const MartialReferenceClass = 'reaver';
const MaxCachedProjections = 512;
const WholeNumberText = /^\d+$/;

function DefaultReferenceRegistries()
{
  if (!defaultRegistries)
  {
    defaultProfile = Profile.resolveGameProfile('default');
    const content = Profile.applyGameProfileToContent(contentBundle, defaultProfile);
    defaultRegistries = Profile.bindGameProfileRegistries(Registries.createRegistries(content), defaultProfile);
  }
  return defaultRegistries;
}

function ReferenceClassId(def)
{
  if (classes.includes(def?.class))
  {
    return def.class;
  }
  const magic = def?.tags?.includes('camp:spell') || def?.damageSchool && def.damageSchool !== 'physical';
  return magic
    ? MagicReferenceClass
    : MartialReferenceClass;
}

// A neutral run on the registry's own profile, never the player's progressed state.
export function CardScoreReferenceContext(def, { registries } = {})
{
  registries = registries?.gameProfile
    ? registries
    : DefaultReferenceRegistries();
  const profile = registries.gameProfile;
  let entry = referencesByRegistry.get(registries);
  if (!entry || entry.profile !== profile)
  {
    entry = { profile, references: new Map() };
    referencesByRegistry.set(registries, entry);
  }
  const { references } = entry;
  const classId = ReferenceClassId(def);
  if (!references.has(classId))
  {
    const rules = State.createRunState({
      registries,
      classId,
      seed: ReferenceSeed,
      runId: `score-reference-${classId}`,
      shareFrozenProfile: true,
      profileMeta: { gameProfileUnlocks: { [profile.id]: { completedRunIds: [...ReferenceCompletedRunIds] } } },
    });
    rules.relics = [];
    references.set(classId, { registries, rules });
  }
  return references.get(classId);
}

// A profile holding only this card, without resource variants, so edited costs stay authoritative.
function SingleCardSubject(profile, card)
{
  return {
    gameProfile: {
      ...profile,
      content: { ...profile.content, cards: [card], resourceVariants: {} },
    },
  };
}

// Probes reuse one subject per scope; the slot is emptied again so no candidate is kept.
function ProjectProbeCard(scoped, profile, source)
{
  const subject = scoped.probeSubject ||= SingleCardSubject(profile, null);
  const slot = subject.gameProfile.content.cards;
  slot[0] = source;
  try
  {
    return Profile.ProjectGameCardProbe(subject, source.id);
  }
  finally
  {
    slot[0] = null;
  }
}

// projectGameCard returns a frozen clone; only its effects are written below.
function ProjectPublicCard(profile, source)
{
  const projected = Profile.projectGameCard(SingleCardSubject(profile, source), source.id);
  if (!projected)
  {
    return null;
  }
  return Array.isArray(projected.effects)
    ? { ...projected, effects: projected.effects.map(effect => ({ ...effect })) }
    : { ...projected };
}

function FaceAttributes(registries, rules)
{
  const playerAttributes = rules.player && !Array.isArray(rules.deck)
    ? rules.player.liveStats?.base?.attributes ?? rules.player.attributes
    : undefined;
  const attributes = rules.faceAttributes ?? playerAttributes;
  if (attributes === undefined && rules.gameProfile && Array.isArray(rules.deck))
  {
    return gameProfileEffectiveAttributes(registries, rules);
  }
  return attributes;
}

function ProjectionContext(registries, rules, signature, profile)
{
  let gear = null;
  if (rules.gearRules)
  {
    gear = { rules: rules.gearRules, state: rules.gearState || {} };
  }
  else if (rules.loadout)
  {
    gear = GearAlwaysOn(registries, rules);
  }
  const attributes = FaceAttributes(registries, rules);
  const tokenRules = { ...rules, gearRules: [], gearState: {}, ...(attributes ? { faceAttributes: attributes } : {}) };
  delete tokenRules.faceDefinition;
  return { cache: new Map(), gear, tokenRules, signature, profile };
}

// Token values per effect field, in mechanic units; symbolic values stay unset.
function MechanicalFieldValues(card, tokens, bindings, registries)
{
  const values = (card.effects || []).map(() => ({}));
  let packetAdded = false;
  for (const binding of bindings)
  {
    let value = tokens[binding.token];
    // Evade's face may print a whole-number string; keep that count.
    if (typeof value === 'string' && WholeNumberText.test(value))
    {
      value = Number(value);
    }
    if (typeof value !== 'number' || !Number.isFinite(value))
    {
      continue;
    }
    const effect = card.effects[binding.index];
    const scaled = binding.field === 'amount' || binding.field === 'stacks';
    value /= scaled
      ? BarrierPoiseFactor(effect, registries)
      : 1;
    // A packet face prints two channels; CP prices the whole hit.
    if (!packetAdded && effect.op === 'damage' && binding.field === 'amount' && Number.isFinite(tokens.packet))
    {
      value += tokens.packet;
      packetAdded = true;
    }
    values[binding.index][binding.field] = value;
  }
  return values;
}

// Frozen projected card, per-effect mechanic values and the visible token map.
// No combat stance, enemy mitigation or invented CP pins.
export function ProjectCardMechanicalValues(def, { registries, rules, projectionScope } = {})
{
  const operation = probeScopes.get(projectionScope);
  const probeDefinitions = operation?.definitions;
  const probe = !!operation;
  const previous = projectedDefinitions.get(def) || probeDefinitions?.get(def);
  if (previous)
  {
    def = previous.source;
  }
  if (!registries || !rules)
  {
    const reference = CardScoreReferenceContext(def, { registries });
    registries ||= reference.registries;
    rules ||= reference.rules;
  }
  let byRules = contextCaches.get(registries);
  if (!byRules)
  {
    byRules = new WeakMap();
    contextCaches.set(registries, byRules);
  }
  const profile = rules.gameProfile || registries.gameProfile;
  // Only a plan's scope may reuse a fingerprint; ordinary calls always recompute it.
  let scoped = operation?.records.get(rules);
  if (!scoped || scoped.profile !== profile || scoped.registries !== registries)
  {
    scoped = { signature: contextSignature(rules), profile, registries };
    operation?.records.set(rules, scoped);
  }
  const signature = scoped.signature;
  const previousStillValid = previous
    && previous.registries === registries
    && previous.rules === rules
    && previous.signature === signature
    && previous.profile === profile;
  if (previousStillValid)
  {
    return previous.result;
  }
  let context = byRules.get(rules);
  if (!context || context.signature !== signature || context.profile !== profile)
  {
    context = ProjectionContext(registries, rules, signature, profile);
    byRules.set(rules, context);
  }
  const { gear, tokenRules } = context;
  const cache = probe
    ? scoped.probeCache ||= new Map()
    : context.cache;
  const authored = Object.fromEntries(Object.entries(def || {}).filter(([key]) => !transient.has(key)));
  const key = JSON.stringify(authored);
  let probeSource;
  let probeCard;
  if (probe)
  {
    // JSON keys are lossy, so every probe is projected strictly before a cache hit is trusted.
    probeSource = needsNativeNormalization(authored)
      ? structuredClone(authored)
      : authored;
    if (profile?.content)
    {
      probeCard = ProjectProbeCard(scoped, profile, probeSource);
    }
    probeCard ||= structuredClone(probeSource);
  }
  let data = cache.get(key);
  if (!data)
  {
    const source = probe
      ? probeSource
      : structuredClone(authored);
    let card = probeCard;
    if (!probe && profile?.content)
    {
      card = ProjectPublicCard(profile, source) || card;
    }
    card ||= structuredClone(source);
    // Always-on gear applies once, as staticCardTokens does, so its effects are bound too.
    if (gear?.rules?.length)
    {
      card = ApplyGearCardRules(gear.rules, card, gear.state);
    }
    if (probe && !scoped.tokenReader)
    {
      scoped.tokenReader = PrepareStaticCardTokenReader(registries, tokenRules);
    }
    const tokens = probe
      ? scoped.tokenReader(card)
      : staticCardTokens(card, registries, tokenRules);
    const bindings = computeTokenBindings(card.effects || []);
    const values = MechanicalFieldValues(card, tokens, bindings, registries);
    for (const [index, fields] of values.entries())
    {
      Object.assign(card.effects[index], fields);
    }
    data = freeze({ card, values, tokens, bindings });
    const definitions = probe
      ? probeDefinitions
      : projectedDefinitions;
    definitions.set(card, { source, registries, rules, profile, signature, result: data });
    cache.set(key, data);
    if (cache.size > MaxCachedProjections)
    {
      cache.delete(cache.keys().next().value);
    }
  }
  return data;
}
