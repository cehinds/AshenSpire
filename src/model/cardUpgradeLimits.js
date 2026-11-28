// How many Core card upgrades are free, what the next one costs, and whether it
// can be bought (docs/ai/tasks/CARD-UPGRADES-2026-10-28.md, owner rulings of
// 2026-10-28). Pure reads of the run: nothing here mutates.
import { cardRank, rankedEffectsCapped, VisibleCardRank } from './cardRank.js';
import { mulberry32 } from './rng.js';
import { upgradeCount, paidUpgradeCount, upgradeStepsOf, FlatSteps, applyUpgradeSteps, MAX_CARD_UPGRADES, firstPlainIndex, isPlainEffect } from './cardUpgrade.js';
import { CardUpgradeRules } from './cardUpgradeRules.js';
import { uiSentence } from './blacksmithConfig.js';
import * as UpgradeSteps from './cardUpgradeSteps.js';
import { OfferSalted } from './upgradeOffer.js';
import { ActNodeUpgradeStock, NodeScheduleKey } from './actSeedSchedule.js';
import { EffectiveTier } from './tierUnlocks.js';
import { GetActiveScoring } from './activeScoring.js';
import { staticCardTokens } from './playingCard.js';
// Upgrade planning is reached while these engine/model cycles initialize in
// the classic bundle. Read the pure receipt dependencies only when invoked.
import * as Offense from './profileDamageOffense.js';
import * as StanceRead from './stanceBenefitsRead.js';
import * as ElementStages from './elementReceiptStages.js';
import * as ProfileRun from './gameProfileRun.js';
import * as Gear from './gearEffects.js';
import * as ItemProperties from './itemProperties.js';
import * as Stances from './stanceRules.js';
import * as CardProfile from './combatCardProfile.js';
import * as CarrierDamage from './carrierDamageType.js';
import * as FixCore from './fixCoreRulesCache.js';
import { AuthoredUpgradesOnly } from './simpleCombatFlags.js';

// canUpgrade's refusal text lives in content/source/uiStrings.csv.
const RefusalSentence = 'upgrade.refuse.';
const OneSlotSentence = 'slots.one';
const ManySlotsSentence = 'slots.many';

// One damage receipt source per plan scope; it reads only the run and registries.
const receiptContextsByScope = new WeakMap();
const AUTHORED_STEP = Object.freeze({ k: 'authored' });

// progression.upgradeMode "authored": one upgrade, the card's own block, and nothing rolled.
const AUTHORED_MODE_SLOTS = 1;

function hasAuthoredUpgrade(base)
{
  return !!base?.upgrade && !Array.isArray(base.gradeProfiles);
}

function authoredOnlyOptions(instance, base, noAuthored)
{
  const firstUpgrade = upgradeStepsOf(instance).length === 0;
  return firstUpgrade && hasAuthoredUpgrade(base) && !noAuthored
    ? [{ ...AUTHORED_STEP }]
    : [];
}

function RankedCard(def, atRank)
{
  return atRank > 1
    ? { ...def, effects: rankedEffectsCapped(def, atRank - 1) }
    : def;
}

// A detached first-play source: no statuses, enemy, flux or prior stance.
function BuildDamageReceiptContext(run, registries)
{
  const ratings = ProfileRun.gameProfileRatingReceipt(registries, run);
  if (!ratings)
  {
    return null;
  }
  const attributes = ProfileRun.gameProfileEffectiveAttributes(registries, run);
  const source = {
    id: 'player',
    kind: 'player',
    classId: run.class,
    attributes,
    ratings: ratings.totals,
    ratingSources: ratings.sources,
    statuses: {},
    alive: true,
    itemProps: {
      ...ItemProperties.ItemPropertySummary(run),
      ...Gear.GearItemProps(Gear.GearSummary(registries, run.loadout, run.class, run)),
    },
  };
  return {
    source,
    gear: Gear.GearAlwaysOn(registries, run),
    ctx: {
      ...run,
      registries,
      fixCoreRules: FixCore.fixCoreRules(run),
      attributes,
      enemies: [],
      phase: 'player',
      elementFlux: null,
    },
  };
}

function SharedDamageReceiptContext(projectionScope, run, registries)
{
  const shared = projectionScope
    ? receiptContextsByScope.get(projectionScope)
    : null;
  if (shared && shared.run === run && shared.registries === registries)
  {
    return shared.value;
  }
  const value = BuildDamageReceiptContext(run, registries);
  if (projectionScope)
  {
    receiptContextsByScope.set(projectionScope, { run, registries, value });
  }
  return value;
}

// Readers for a detached hit: no adds, flux, defender stance or weaknesses.
function NeutralOffenseHooks()
{
  return {
    getAdd: () => 0,
    FluxMultiplier: () => 1,
    defensiveCombatStance: () => undefined,
    hitWeaknessTriggers: () => [],
    matchingHitWeaknesses: () => [],
    weaknessLabel: () => '',
    AttackDamageMultiplier: StanceRead.AttackDamageMultiplier,
    StanceWeaknessMultiplier: StanceRead.StanceWeaknessMultiplier,
    ElementReceiptStages: (...args) => ElementStages.ElementReceiptStages(...args, {
      stacksOf: () => 0,
      hasTag: () => false,
      opponents: () => [],
      bandsActive: () => false,
    }),
  };
}

// Conditional payloads, charges and Counter returns keep the static fallback.
function HasIntrinsicDamage(run, registries, def)
{
  if (!run.class || !run.attributes || !registries?.gameProfile || def.effectVariants?.length || def.comboHook)
  {
    return false;
  }
  return !(def.effects || []).some(effect => effect.op === 'grantCardCharge'
    || effect.op === 'damage' && !isPlainEffect(effect, 'damage'));
}

function checkDamageUpgrade(run, registries, rank, ranked, projectionScope)
{
  if (!Number.isFinite(run.gameProfile?.modules?.effects?.baseDamageMultiplier))
  {
    return undefined;
  }
  const tokens = (def, atRank) => staticCardTokens(RankedCard(def, atRank), registries, run);
  let before;
  let intrinsicBefore;
  let receiptContext;
  const intrinsicDamage = (def, atRank) =>
  {
    if (!HasIntrinsicDamage(run, registries, def))
    {
      return null;
    }
    const index = firstPlainIndex(def.effects, 'damage');
    if (index < 0 || CardProfile.combatProfileFor(def).maneuver === 'counter')
    {
      return null;
    }
    // Built lazily, after a numeric damage candidate passed the static-face check.
    if (receiptContext === undefined)
    {
      receiptContext = SharedDamageReceiptContext(projectionScope, run, registries);
    }
    if (!receiptContext)
    {
      return null;
    }
    const { source, ctx, gear } = receiptContext;
    const shown = Gear.ApplyGearCardRules(gear.rules, RankedCard(def, atRank), gear.state);
    const carrierCard = {
      ...shown,
      cardId: shown.id,
      combatProfile: { ...CardProfile.combatProfileFor(shown) },
      fixCoreSameStance: false,
    };
    const carrier = CarrierDamage.ResolveCarrierDamageType(carrierCard, registries, run.loadout, run.class);
    const attacker = { ...source, combatStance: Stances.stanceOf(carrier, source) };
    const amount = shown.effects[index].amount;
    return Offense.ProfileDamageOffense({ ...ctx, player: attacker }, attacker, null, amount, carrier, NeutralOffenseHooks()).rawHit;
  };
  return (current, step, nextRank) =>
  {
    before ??= tokens(current, rank);
    const afterDef = applyUpgradeSteps(current, [step]);
    const afterRank = ranked
      ? Math.max(rank, nextRank || 0)
      : rank;
    const after = tokens(afterDef, afterRank);
    if (!Object.values(before).some(Number.isFinite))
    {
      return true;
    }
    if (!Object.keys(after).some(key => before[key] !== after[key]))
    {
      return false;
    }
    // A static increase can still round away in the stance and element chain,
    // so eligibility also checks the engine's pre-defense hit.
    if (intrinsicBefore === undefined)
    {
      intrinsicBefore = intrinsicDamage(current, rank);
    }
    const intrinsicAfter = intrinsicBefore === null
      ? null
      : intrinsicDamage(afterDef, afterRank);
    return intrinsicBefore === null || intrinsicAfter === null || intrinsicAfter > intrinsicBefore;
  };
}

/**
 * upgradeBasic(def) → whether a card is "Basic" for upgrades: a common card that is not a spell,
 * or any cantrip. Not the Martial Adept training rule (model/basicCardRule.js).
 */
export function upgradeBasic(def, instance = null, registries = null)
{
  const { cantripTag, spellTags, rarity } = CardUpgradeRules(registries).basicRule;
  const tags = (def && def.tags) || [];
  if (tags.includes(cantripTag))
  {
    return true;
  }
  // A rank-down upgrade step adding the cantrip tag makes this copy a cantrip.
  const steps = FlatSteps(upgradeStepsOf(instance || {}));
  if (steps.some(step => step.k === 'tag' && step.tag === cantripTag))
  {
    return true;
  }
  const spell = spellTags.some(tag => tags.includes(tag));
  return !!def && def.rarity === rarity && !spell;
}

/**
 * freeAllowance(instance, def) → free upgrades: a Basic card's configured count, every other
 * card its rank, at most MAX_CARD_UPGRADES.
 */
export function freeAllowance(instance, def, registries = null)
{
  if (!def)
  {
    return 0;
  }
  if (upgradeBasic(def, instance, registries))
  {
    return CardUpgradeRules(registries).slots.basicFreeUpgrades;
  }
  return Math.min(MAX_CARD_UPGRADES, cardRank(instance));
}

/**
 * The weapon a card belongs to for upgrades (W25, owner 2026-11-14; since 2026-11-23 it no longer adds upgrade slots): the card's own source weapon (an equipment-bound card
 * carries `sourceArmamentId` / `weaponId`), else the main weapon the run has equipped (the active right-hand slot).
 * Returns its armament id, or '' when there is none.
 */
export function UpgradeWeaponId(run, instance) {
  const own = instance && (instance.sourceArmamentId || instance.weaponId);
  if (own) return own;
  const loadout = run && run.loadout;
  return (loadout && loadout.sets && loadout.sets.rightHand && loadout.sets.rightHand[(loadout.active && loadout.active.rightHand) || 0]) || '';
}

/** The weapon's Smith level (how many times it has been upgraded at the Smith / Blacksmith), 0 for none. */
export function WeaponSmithLevel(run, instance) {
  const id = UpgradeWeaponId(run, instance);
  const ref = `armament/${id}`;
  const level = id && run && run.itemUpgradeLevels ? run.itemUpgradeLevels[ref] : 0;
  // The fixed Smith tier plus the options the Blacksmith's work picked (W25 step 4: each is one upgrade of the weapon).
  const picks = id && Array.isArray(run?.itemUpgradePicks?.[ref]) ? run.itemUpgradePicks[ref].length : 0;
  return (Number.isSafeInteger(level) && level > 0 ? level : 0) + picks;
}

/** Upgrades the card may carry: its visible rank plus the configured extra, at most MAX_CARD_UPGRADES. */
export function UpgradeSlots(run, instance, registries = null)
{
  // Authored mode: the one slot is the card's own block, none when it has no block to apply.
  if (AuthoredUpgradesOnly(run))
  {
    const definition = registries?.cards?.get(instance?.cardId);
    return !definition || hasAuthoredUpgrade(definition)
      ? AUTHORED_MODE_SLOTS
      : 0;
  }
  const extraSlots = CardUpgradeRules(registries).slots.aboveVisibleRank;
  return Math.min(MAX_CARD_UPGRADES, VisibleCardRank(instance) + extraSlots);
}

/** Rest-site offer shape: one single-effect option early, then several that may carry two effects. */
export function RestUpgradeRule(instance, registries = null)
{
  const { singleOptionUpTo, earlyChoices, laterChoices } = CardUpgradeRules(registries).rest;
  return upgradeCount(instance) + 1 > singleOptionUpTo
    ? { choices: laterChoices, combos: true }
    : { choices: earlyChoices, combos: false };
}

/**
 * Options a player picks from: a Blacksmith rolls fewer or more, seeded so a visit's quote is stable;
 * every other source offers 1. Without a run, a Basic card gets fewer and a ranked card more.
 */
export function upgradeChoiceCount(def, instance, { blacksmith = false, run = null, registries = null } = {})
{
  if (!blacksmith)
  {
    return 1;
  }
  const offers = CardUpgradeRules(registries).offers;
  if (run && instance?.instanceId)
  {
    const seed = UpgradeSteps.upgradeSeed(
      run.seed,
      OfferSalted(run, `${instance.instanceId}#choices`),
      upgradeStepsOf(instance).length,
    );
    return mulberry32(seed)() < offers.blacksmithFewerChoicesChance
      ? offers.blacksmithFewerChoices
      : offers.blacksmithMoreChoices;
  }
  return upgradeBasic(def, instance, registries)
    ? offers.basicChoicesWithoutRun
    : offers.rankedChoicesWithoutRun;
}

/**
 * nextUpgradeOptions(run, instance, base, registries, count) → up to `count` distinct steps the next upgrade could
 * add, [] when the card is maxed. A first upgrade with an upgrade block and no ability grade lists `authored`
 * first, then one rolled alternative when count > 1. Otherwise the seeded roll supplies the options.
 * The first entry is always what nextUpgradeStep returns. Stateless.
 * `scale` (> 1) makes the amounts bigger, `salt` gives the roll its own stream and `noAuthored` skips the card's
 * designed upgrade: the three a rank-up bonus uses (model/rankUpBonus.js). `everyFamily` lists every eligible kind
 * (several of one family), for a probe or test that walks the whole menu; no offer uses it. `vendor` ('blacksmith' | 'arcane') weights
 * the kinds by category and reads the vendor's own rarity odds (proposal section 11); none is a rest site, a free upgrade or any other source.
 */
export function nextUpgradeOptions(run, instance, base, registries, count = 1, { scale = 1, salt = '', noAuthored = false, combos = false, everyFamily = false, vendor = '', preparation = {} } = {}) {
  if (AuthoredUpgradesOnly(run))
  {
    return authoredOnlyOptions(instance, base, noAuthored);
  }
  const applied = upgradeStepsOf(instance);
  const mana = (registries && registries.balance && registries.balance.mana) || {};
  // Core ranks scale the face after the steps, so the roll sees the rank the card will be shown at.
  const ranked = run.gameProfile?.modules?.progression?.cardRanks === true;
  const rank = ranked ? cardRank(instance) : 1;
  const playerLevel = Number.isInteger(run?.level?.level) && run.level.level >= 1 ? run.level.level : 1;
  const visibleRank = VisibleCardRank(instance);
  const nodeKey = !everyFamily && !salt ? NodeScheduleKey(run) : '';
  const activeScoring = GetActiveScoring();
  let nodeSpecialty = null;
  if (nodeKey) {
    const cardTier = EffectiveTier(visibleRank, instance?.rarityOverride || base.rarity || 'common', activeScoring);
    nodeSpecialty = ActNodeUpgradeStock(run.seed, nodeKey, { vendor, scoring: activeScoring }).forTier(cardTier);
  }
  const mechanics = run.combatMechanics || run.gameProfile?.combatMechanics;
  const mechanicsContext = mechanics ? { combatMechanics: mechanics } : null;
  const limits = { ...mana, mechanicsContext, rank, cardRank: visibleRank, playerLevel, instance, scale, registries, preparation,
    damageChanges: checkDamageUpgrade(run, registries, rank, ranked, preparation?.projectionScope),
    exposure: registries?.balance?.exposure?.elementUpgradeBuildup, maxRange: run.rangePolicy?.maxRange, ...(vendor ? { vendor } : {}), ...(nodeSpecialty ? { nodeSpecialty } : {}) };
  const authored = applied.length === 0 && base.upgrade && !Array.isArray(base.gradeProfiles) && !noAuthored;
  if (count <= 1 && authored) return [{ k: 'authored' }];
  // An authored first step occupies its family (AuthoredFamilies): the rolled alternative is of another family.
  const excludeFamilies = authored && !everyFamily ? AuthoredFamilies(base, registries) : [];
  const roll = (n) => UpgradeSteps.rollUpgradeOptions(base, applied, applied.length, UpgradeSteps.upgradeStepRng(run.seed, OfferSalted(run, salt ? `${instance.instanceId}#${salt}` : instance.instanceId), applied.length), { ...limits, excludeFamilies, everyFamily }, n);
  if (count <= 1) return roll(1);
  // Two options that resolve to the same card would be no choice: every pick after the first must differ in what
  // it does (face, tags, profile fields; the name aside) from the picks before it. Candidates come from the same
  // seeded stream in the same order, so the list stays deterministic; a card with no distinct candidate left shows fewer.
  const outcome = (step) => { const { name, ...face } = applyUpgradeSteps(base, [...applied, step]); return JSON.stringify(face); };
  const target = authored ? 2 : count;
  const pickDistinct = (pool) => {
    const picked = authored ? [{ k: 'authored' }] : [];
    const seen = new Set(picked.map(outcome));
    for (const step of pool) {
      if (picked.length >= target) break;
      const key = outcome(step);
      if (picked.length && seen.has(key)) continue;
      seen.add(key);
      picked.push(step);
    }
    return picked;
  };
  const rules = CardUpgradeRules(registries);
  const maxCandidates = rules.offers.maxCandidates;
  let pool = roll(combos ? maxCandidates : Math.min(maxCandidates, target));
  let picked = pickDistinct(pool);
  if (picked.length < target && pool.length < maxCandidates) {
    pool = roll(maxCandidates);
    picked = pickDistinct(pool);
  }
  const chosen = picked.slice(0, target);
  return combos ? withSecondEffects(run, instance, applied, chosen, pool, outcome, salt, rules.rest.twoEffectChance) : chosen;
}

// Each option may get a second effect of another family, drawn from its own seeded stream.
function withSecondEffects(run, instance, applied, chosen, candidates, outcome, salt, twoEffectChance) {
  const draw = mulberry32(UpgradeSteps.upgradeSeed(run.seed, OfferSalted(run, `${instance.instanceId}#fx${salt}`), applied.length));
  const offered = new Set(chosen.flatMap(UpgradeSteps.UpgradeStepFamilies));
  return chosen.map((step) => {
    const roll = draw();
    const pick = draw();
    if (roll >= twoEffectChance || step.k === 'authored' || step.k === 'combo') return step;
    // The second effect is of a family no option on the list already has (UPGRADE_FAMILIES).
    const partners = candidates.filter((other) => other.k !== 'authored' && other.k !== 'combo' && !UpgradeSteps.UpgradeStepFamilies(other).some((family) => offered.has(family))
      && !chosen.some((c) => JSON.stringify(c) === JSON.stringify(other)) && outcome(other) !== outcome(step));
    if (!partners.length) return step;
    const partner = partners[Math.min(partners.length - 1, Math.floor(pick * partners.length))];
    for (const family of UpgradeSteps.UpgradeStepFamilies(partner)) offered.add(family);
    return { k: 'combo', steps: [step, partner] };
  });
}

/**
 * The families a card's authored upgrade belongs to, read from what it changes on the face: lower cost, more damage,
 * more Block, more status, more draw-like effects, new keywords. A text-only authored upgrade claims none.
 */
export function AuthoredFamilies(base, registries = null) {
  const after = applyUpgradeSteps(base, [{ k: 'authored' }]);
  const families = new Set();
  const differs = (pick) => JSON.stringify(pick(base)) !== JSON.stringify(pick(after));
  // Effects by op, whole (a formula amount, a ramp's `add`, hits and targets all count), judged per family.
  const ops = (card, list) => (card.effects || []).filter((e) => list.includes(e.op)).map((e) => JSON.stringify(e)).sort();
  const lower = (key) => Number.isFinite(base[key]) && Number.isFinite(after[key]) && after[key] < base[key];
  if (lower('cost') || lower('staminaCost') || lower('manaCost') || differs((card) => card.costGrowth || null)) families.add('cost');
  const rampOf = (stat) => (card) => (card.ramp?.stat === stat ? card.ramp : null);
  const { opsByFamily, fallback } = CardUpgradeRules(registries).authoredFamilies;
  if (differs((card) => ops(card, opsByFamily.damage)) || differs(rampOf('damage'))) families.add('damage');
  if (differs((card) => ops(card, opsByFamily.defense)) || differs(rampOf('block'))) families.add('defense');
  if (differs((card) => ops(card, opsByFamily.pressure))) families.add('pressure');
  if (differs((card) => ops(card, opsByFamily.flow))) families.add('flow');
  if (differs((card) => [...(card.keywords || [])].sort())) families.add('keyword');
  if (differs((card) => [...(card.cardTags ?? card.tags ?? [])].sort())) families.add('form');
  // Any other effect, a ramp on another stat, or a text-only change: still one family, never none (review, 2026-11-20).
  if (!families.size && (differs((card) => card.effects || []) || differs((card) => card.ramp || null))) families.add(fallback);
  if (!families.size) families.add(fallback);
  return [...families];
}

/**
 * nextUpgradeStep(run, instance, base, registries) → the step the next upgrade
 * would add: `authored` for a first upgrade when the card has an upgrade block,
 * else the seeded roll; null when no kind is eligible (the card is maxed).
 * Stateless: the same run, instance and count always give the same step.
 */
export function nextUpgradeStep(run, instance, base, registries, { preparation } = {}) {
  return nextUpgradeOptions(run, instance, base, registries, 1, { preparation })[0] || null;
}

/**
 * upgradeCost(run, instance, def[, registries]) → the Smithing Stones the NEXT
 * upgrade costs: 0 while its number n (1-based) is within F, else 1; null when
 * the card is at the 10-upgrade cap or maxed (no step is eligible any more).
 */
export function upgradeCost(run, instance, def, registries, { preparation } = {}) {
  // The cap counts slot-using upgrades only, like the slots check: a rank-up bonus step is a gift (paidUpgradeCount).
  if (paidUpgradeCount(instance) + 1 > MAX_CARD_UPGRADES) return null;
  if (def && instance && nextUpgradeStep(run, instance, def, registries, { preparation }) === null) return null;
  // A rank-up bonus step does not use a free upgrade (paidUpgradeCount).
  return paidUpgradeCount(instance) + 1 <= freeAllowance(instance, def, registries)
    ? 0
    : CardUpgradeRules(registries).slots.stonesAfterFree;
}

const stonesOf = (run) => (Number.isSafeInteger(run && run.smithingStones) ? run.smithingStones : 0);

/**
 * canUpgrade(registries, run, instance) → { ok, code, reason, cost, n, free }.
 * Codes: 'missing', 'armament' (upgraded with its armament), 'slots', 'cap', 'maxed', 'stones'.
 */
export function canUpgrade(registries, run, instance, { preparation } = {})
{
  const def = instance && registries.cards.has(instance.cardId)
    ? registries.cards.get(instance.cardId)
    : null;
  const n = upgradeCount(instance) + 1;
  const refuse = (code, fields = {}, cost = null, sentence = code) => ({
    ok: false,
    code,
    reason: uiSentence(RefusalSentence + sentence, fields),
    cost,
    n,
    free: null,
  });
  if (!def)
  {
    return refuse('missing');
  }
  const name = def.name;
  if (instance.sourceArmamentId || instance.grantedBy)
  {
    return refuse('armament', { name });
  }
  const slots = UpgradeSlots(run, instance, registries);
  // Rank-up bonus steps are gifts: they use no slot and do not count toward the cap.
  const paid = paidUpgradeCount(instance) + 1;
  if (paid > slots && paid <= MAX_CARD_UPGRADES)
  {
    const sentence = slots === 1
      ? OneSlotSentence
      : ManySlotsSentence;
    return refuse('slots', { name, slots }, null, sentence);
  }
  const cost = upgradeCost(run, instance, def, registries, { preparation });
  if (cost === null)
  {
    return paid > MAX_CARD_UPGRADES
      ? refuse('cap', { name, cap: MAX_CARD_UPGRADES })
      : refuse('maxed', { name });
  }
  const stones = stonesOf(run);
  if (cost > stones)
  {
    return refuse('stones', { cost, stones }, cost);
  }
  return { ok: true, code: '', reason: '', cost, n, free: cost === 0 };
}
