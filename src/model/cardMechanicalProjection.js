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

// Only a synchronous upgrade plan creates this scope. A caller's ordinary
// signature WeakMap never changes the public frozen/owned projection contract.
export function CreateCardUpgradeProjectionScope() {
  const scope = new WeakMap();
  // The source markers belong to this scope, never to a global output cache.
  probeScopes.set(scope, new WeakMap());
  return scope;
}

function needsNativeNormalization(value, seen = new Set()) {
  if (typeof value === 'function' || typeof value === 'symbol') return true;
  if (!value || typeof value !== 'object') return false;
  if (seen.has(value)) return true;
  seen.add(value);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== Array.prototype && prototype !== null) return true;
  for (const key of Object.keys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    // The native snapshot owns accessor evaluation and transport metadata,
    // including otherwise ignored $comment values that cannot be cloned.
    if (key === '$comment' || !Object.hasOwn(descriptor, 'value') || needsNativeNormalization(descriptor.value, seen)) return true;
  }
  return false;
}
const referencesByRegistry = new WeakMap(), contextCaches = new WeakMap(), projectedDefinitions = new WeakMap();
let defaultRegistries, defaultProfile;
const transient = new Set(['_edited', '_custom', '_generated', '_cpMiss', 'scoringOverride', '_autoName', '_autoNameCore', '_autoNameBudget']);
// Only neutral-face inputs belong here. Runtime piles, enemy state and stance
// receipts intentionally do not influence this attributed card baseline.
const contextFields = ['class','classId','attributes','allocatedAttributes','faceAttributes','loadout','deck','relics','itemUpgradeLevels','itemUpgradePicks','itemCategories','itemRanks','itemProps','gearRules','gearState','level','levelRewardRuleSnapshot','classLevelBonusVersion','classUnequipped','equipmentProfileRuleSnapshot','derivedStatRuleSnapshot','combatExpansionVersion','core2ActionRulesVersion','fixCoreRules'];
const contextSignature = rules => JSON.stringify([
  ...contextFields.map(key => rules[key]),
  rules.player?.liveStats?.base?.attributes ?? rules.player?.attributes,
  rules.player?.allocatedAttributes,
]);
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { for (const item of Object.values(value)) freeze(item); Object.freeze(value); }
  return value;
};

export function CardScoreReferenceContext(def, { registries } = {}) {
  // A bound registry already owns the profile used by its renderer. Reuse that
  // configuration, while creating a separate neutral run rather than borrowing
  // the player's progressed attributes, equipment, or combat state.
  if (!registries?.gameProfile) {
    if (!defaultRegistries) {
      defaultProfile = Profile.resolveGameProfile('default');
      defaultRegistries = Profile.bindGameProfileRegistries(Registries.createRegistries(Profile.applyGameProfileToContent(contentBundle, defaultProfile)), defaultProfile);
    }
    registries = defaultRegistries;
  }
  const profile = registries.gameProfile;
  let entry = referencesByRegistry.get(registries);
  if (!entry || entry.profile !== profile) {
    entry = { profile, references: new Map() };
    referencesByRegistry.set(registries, entry);
  }
  const { references } = entry;
  const magic = def?.tags?.includes('camp:spell') || def?.damageSchool && def.damageSchool !== 'physical';
  const classId = classes.includes(def?.class) ? def.class : magic ? 'starseer' : 'reaver';
  if (!references.has(classId)) {
    const rules = State.createRunState({ registries, classId, seed: 31, runId: `score-reference-${classId}`, profileMeta: { gameProfileUnlocks: { [profile.id]: { completedRunIds: ['a', 'b', 'c'] } } } });
    rules.relics = [];
    references.set(classId, { registries, rules });
  }
  return references.get(classId);
}

/** Frozen projected definition, per-effect mechanic-unit values, and the exact
 * visible token map. No combat stance, enemy mitigation, or invented CP pins. */
export function ProjectCardMechanicalValues(def, { registries, rules, projectionScope } = {}) {
  const probeDefinitions = probeScopes.get(projectionScope);
  const probe = !!probeDefinitions;
  const previous = projectedDefinitions.get(def) || probeDefinitions?.get(def);
  if (previous) def = previous.source;
  if (!registries || !rules) {
    const reference = CardScoreReferenceContext(def, { registries });
    registries ||= reference.registries; rules ||= reference.rules;
  }
  let byRules = contextCaches.get(registries);
  if (!byRules) contextCaches.set(registries, byRules = new WeakMap());
  const profile = rules.gameProfile || registries.gameProfile;
  // Only the service's single synchronous, read-only plan supplies a scope.
  // Ordinary calls always fingerprint again, including in-place rule edits.
  let scoped = projectionScope?.get(rules);
  if (!scoped || scoped.profile !== profile || scoped.registries !== registries) {
    scoped = { signature: contextSignature(rules), profile, registries };
    projectionScope?.set(rules, scoped);
  }
  const signature = scoped.signature;
  if (previous && previous.registries === registries && previous.rules === rules && previous.signature === signature && previous.profile === profile) return previous.result;
  let context = byRules.get(rules);
  if (!context || context.signature !== signature || context.profile !== profile) {
    const gear = rules.gearRules ? { rules: rules.gearRules, state: rules.gearState || {} } : rules.loadout ? GearAlwaysOn(registries, rules) : null;
    let attributes = rules.faceAttributes ?? (rules.player && !Array.isArray(rules.deck) ? rules.player.liveStats?.base?.attributes ?? rules.player.attributes : undefined);
    if (attributes === undefined && rules.gameProfile && Array.isArray(rules.deck)) attributes = gameProfileEffectiveAttributes(registries, rules);
    const tokenRules = { ...rules, gearRules: [], gearState: {}, ...(attributes ? { faceAttributes: attributes } : {}) };
    delete tokenRules.faceDefinition;
    context = { cache: new Map(), gear, tokenRules, signature, profile };
    byRules.set(rules, context);
  }
  const { gear, tokenRules } = context;
  const cache = probe ? scoped.probeCache ||= new Map() : context.cache;
  const authored = Object.fromEntries(Object.entries(def || {}).filter(([key]) => !transient.has(key)));
  const key = JSON.stringify(authored);
  let probeSource, probeCard;
  if (probe) {
    // JSON keys are lossy for undefined/nonfinite values and ignored metadata.
    // Every candidate takes strict canonical projection before a cache hit can
    // be trusted; on a miss the already-owned result is used directly below.
    probeSource = needsNativeNormalization(authored) ? structuredClone(authored) : authored;
    if (profile?.content) {
      const subject = { gameProfile: { ...profile, content: { ...profile.content, cards: [probeSource], resourceVariants: {} } } };
      probeCard = Profile.ProjectGameCardProbe(subject, probeSource.id);
    }
    probeCard ||= structuredClone(probeSource);
  }
  let data = cache.get(key);
  if (!data) {
    // Public results retain an owned source for later context re-projection.
    // Private probes instead own dataClone's fresh result, which never escapes
    // their synchronous plan. Native transport still handles metadata and VM
    // inputs before the same strict per-candidate canonical validation.
    const source = probe ? probeSource : structuredClone(authored);
    let card = probeCard;
    if (!probe && profile?.content) {
      // The subject contains only this authored card. Its resource variant is
      // intentionally absent so edited costs remain authoritative; unrelated
      // variants cannot be selected and need not be copied into every probe.
      const subject = { gameProfile: { ...profile, content: { ...profile.content, cards: [source], resourceVariants: {} } } };
      const projected = Profile.projectGameCard(subject, source.id);
      // projectGameCard already clones and freezes its entire result. Only
      // these effect records receive numeric assignments below; leave the
      // independently owned frozen metadata shared with that detached result.
      if (projected) card = { ...projected, ...(Array.isArray(projected.effects) ? { effects: projected.effects.map(effect => ({ ...effect })) } : {}) };
    }
    card ||= structuredClone(source);
    // Apply always-on equipment exactly once, as staticCardTokens does. Its
    // appended effects must participate in bindings and scoring as well.
    if (gear?.rules?.length) card = ApplyGearCardRules(gear.rules, card, gear.state);
    if (probe && !scoped.tokenReader) scoped.tokenReader = PrepareStaticCardTokenReader(registries, tokenRules);
    const tokens = probe ? scoped.tokenReader(card) : staticCardTokens(card, registries, tokenRules);
    const bindings = computeTokenBindings(card.effects || []);
    const values = (card.effects || []).map(() => ({}));
    let packetAdded = false;
    for (const binding of bindings) {
      let value = tokens[binding.token];
      // Configured Evade's canonical face phrase may be the whole-number
      // string "1"/"2". Preserve that resolved mechanical count; multipliers
      // and symbolic formulas remain symbolic rather than guessed numbers.
      if (typeof value === 'string' && /^\d+$/.test(value)) value = Number(value);
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;
      const effect = card.effects[binding.index];
      const factor = binding.field === 'amount' || binding.field === 'stacks' ? BarrierPoiseFactor(effect, registries) : 1;
      value /= factor;
      // A packet face prints its two channels separately; CP prices the whole
      // hit, using the same canonical split rather than dropping its magic half.
      if (!packetAdded && effect.op === 'damage' && binding.field === 'amount' && Number.isFinite(tokens.packet)) { value += tokens.packet; packetAdded = true; }
      values[binding.index][binding.field] = value;
    }
    for (const [index, fields] of values.entries()) Object.assign(card.effects[index], fields);
    data = probe ? { card, values, tokens, bindings } : freeze({ card, values, tokens, bindings });
    if (probe) probeDefinitions.set(card, { source, registries, rules, profile, signature, result: data });
    else projectedDefinitions.set(card, { source, registries, rules, profile, signature, result: data });
    cache.set(key, data);
    if (cache.size > 512) cache.delete(cache.keys().next().value);
  }
  return data;
}
