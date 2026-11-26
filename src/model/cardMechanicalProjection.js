// The same neutral, attributed card-face baseline used by playingCardModel.
// Reference profiles/runs are initialized only on the first headless request.
import { contentBundle } from '../content/index.js';
import { createRegistries } from './registries.js';
import { createRunState } from './state.js';
import * as Profile from './gameProfile.js';
import { staticCardTokens } from './playingCard.js';
import { computeTokenBindings } from './validate/tokenBindings.js';
import { BarrierPoiseFactor } from './combatRatings.js';
import { ApplyGearCardRules, GearAlwaysOn } from './gearEffects.js';
import { gameProfileEffectiveAttributes } from './gameProfileGear.js';

const classes = ['reaver', 'starseer', 'rogue', 'herald'];
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
      defaultRegistries = Profile.bindGameProfileRegistries(createRegistries(Profile.applyGameProfileToContent(contentBundle, defaultProfile)), defaultProfile);
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
    const rules = createRunState({ registries, classId, seed: 31, runId: `score-reference-${classId}`, profileMeta: { gameProfileUnlocks: { [profile.id]: { completedRunIds: ['a', 'b', 'c'] } } } });
    rules.relics = [];
    references.set(classId, { registries, rules });
  }
  return references.get(classId);
}

/** Frozen projected definition, per-effect mechanic-unit values, and the exact
 * visible token map. No combat stance, enemy mitigation, or invented CP pins. */
export function ProjectCardMechanicalValues(def, { registries, rules } = {}) {
  const previous = projectedDefinitions.get(def);
  if (previous) def = previous.source;
  if (!registries || !rules) {
    const reference = CardScoreReferenceContext(def, { registries });
    registries ||= reference.registries; rules ||= reference.rules;
  }
  let byRules = contextCaches.get(registries);
  if (!byRules) contextCaches.set(registries, byRules = new WeakMap());
  const signature = contextSignature(rules), profile = rules.gameProfile || registries.gameProfile;
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
  const { cache, gear, tokenRules } = context;
  const authored = Object.fromEntries(Object.entries(def || {}).filter(([key]) => !transient.has(key)));
  const key = JSON.stringify(authored);
  let data = cache.get(key);
  if (!data) {
    let card = structuredClone(authored);
    if (profile?.content) {
      const { [card.id]: _variants, ...resourceVariants } = profile.content.resourceVariants || {};
      const subject = { gameProfile: { ...profile, content: { ...profile.content, cards: [card], resourceVariants } } };
      card = structuredClone(Profile.projectGameCard(subject, card.id) || card);
    }
    // Apply always-on equipment exactly once, as staticCardTokens does. Its
    // appended effects must participate in bindings and scoring as well.
    if (gear?.rules?.length) card = ApplyGearCardRules(gear.rules, card, gear.state);
    const tokens = staticCardTokens(card, registries, tokenRules);
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
    data = freeze({ card, values, tokens, bindings });
    projectedDefinitions.set(card, { source: structuredClone(authored), registries, rules, profile, signature, result: data });
    cache.set(key, data);
    if (cache.size > 512) cache.delete(cache.keys().next().value);
  }
  return data;
}
