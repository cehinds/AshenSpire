// How many Core card upgrades are free, what the next one costs, and whether it
// can be bought (docs/ai/tasks/CARD-UPGRADES-2026-10-28.md, owner rulings of
// 2026-10-28). Pure reads of the run: nothing here mutates.
import { cardRank, VisibleCardRank } from './cardRank.js';
import { mulberry32 } from './rng.js';
import { upgradeCount, paidUpgradeCount, upgradeStepsOf, FlatSteps, applyUpgradeSteps, MAX_CARD_UPGRADES } from './cardUpgrade.js';

const MAX_CANDIDATES = 20;
import { rollUpgradeOptions, upgradeStepRng, upgradeSeed, UpgradeStepFamilies } from './cardUpgradeSteps.js';
import { OfferSalted } from './upgradeOffer.js';

/**
 * upgradeBasic(def) → whether a card is "Basic" for upgrades (owner ruling,
 * 2026-10-28): a common card that is not a spell, or any cantrip. Uncommon,
 * rare and starter cards (the class specials, Mana Surge) are not. This is
 * deliberately not the Martial Adept training rule (model/basicCardRule.js),
 * which marks almost every martial card Basic.
 */
export function upgradeBasic(def, instance = null) {
  const tags = (def && def.tags) || [];
  if (tags.includes('rank.cantrip')) return true;
  // A rank-down upgrade step (tag rank.cantrip) makes this copy count as a cantrip.
  if (FlatSteps(upgradeStepsOf(instance || {})).some((step) => step.k === 'tag' && step.tag === 'rank.cantrip')) return true;
  const spell = tags.includes('source:spell') || tags.includes('camp:spell');
  return !!def && def.rarity === 'common' && !spell;
}

/**
 * freeAllowance(instance, def) → F. An upgradeBasic card gets 1; every other
 * card gets its rank (default 1, at most 10): a rank-3 Ironbreaker has 3 free
 * upgrades, a Strike has 1 at any rank.
 */
export function freeAllowance(instance, def) {
  if (!def) return 0;
  if (upgradeBasic(def, instance)) return 1;
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

/**
 * UpgradeSlots(run, instance) → how many upgrades the card may carry: the rank its face shows plus 1, never past
 * MAX_CARD_UPGRADES (owner, 2026-11-23; the weapon's Smith level no longer adds). An unranked card (no badge) has 1,
 * a "Rank 1" card 2, a "Rank 4" card 5. `run` is kept for callers; the rule no longer reads it.
 */
export function UpgradeSlots(run, instance) {
  return Math.min(MAX_CARD_UPGRADES, VisibleCardRank(instance) + 1);
}

/** Rest-site odds (owner, 2026-11-14): upgrades 1-3 offer one option of one effect; the 4th and later offer two options, each 80% one effect, 20% two. */
export const REST_ONE_OPTION_UPTO = 3;
export const REST_TWO_EFFECT_CHANCE = 0.2;
export function RestUpgradeRule(instance) {
  return upgradeCount(instance) + 1 > REST_ONE_OPTION_UPTO ? { choices: 2, combos: true } : { choices: 1, combos: false };
}

/**
 * upgradeChoiceCount(def, instance, { blacksmith, run }) → how many options a player picks from: a blacksmith
 * offers 2 or 3 at random (owner, 2026-11-14), seeded by the run, the card, its upgrade number and the visit's offer key
 * (upgradeOffer.js) so the quote is stable for the stay; a rest-site upgrade, an event reward and co-op keep the single roll (1). Asked without a run (no seed to
 * roll from) the older rule stands: 2 on a Basic card and 3 on a ranked (not Basic) one.
 */
export function upgradeChoiceCount(def, instance, { blacksmith = false, run = null } = {}) {
  if (!blacksmith) return 1;
  if (run && instance?.instanceId) return mulberry32(upgradeSeed(run.seed, OfferSalted(run, `${instance.instanceId}#choices`), upgradeStepsOf(instance).length))() < 0.5 ? 2 : 3;
  return upgradeBasic(def, instance) ? 2 : 3;
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
export function nextUpgradeOptions(run, instance, base, registries, count = 1, { scale = 1, salt = '', noAuthored = false, combos = false, everyFamily = false, vendor = '' } = {}) {
  const applied = upgradeStepsOf(instance);
  const mana = (registries && registries.balance && registries.balance.mana) || {};
  // Core ranks scale the face after the steps, so the roll sees the rank the card will be shown at.
  const rank = run.gameProfile?.modules?.progression?.cardRanks === true ? cardRank(instance) : 1;
  const limits = { ...mana, rank, scale, exposure: registries?.balance?.exposure?.elementUpgradeBuildup, maxRange: run.rangePolicy?.maxRange, ...(vendor ? { vendor } : {}) };
  const authored = applied.length === 0 && base.upgrade && !Array.isArray(base.gradeProfiles) && !noAuthored;
  if (count <= 1 && authored) return [{ k: 'authored' }];
  // An authored first step occupies its family (AuthoredFamilies): the rolled alternative is of another family.
  const excludeFamilies = authored && !everyFamily ? AuthoredFamilies(base) : [];
  const roll = (n) => rollUpgradeOptions(base, applied, applied.length, upgradeStepRng(run.seed, OfferSalted(run, salt ? `${instance.instanceId}#${salt}` : instance.instanceId), applied.length), { ...limits, excludeFamilies, everyFamily }, n);
  if (count <= 1) return roll(1);
  // Two options that resolve to the same card would be no choice: every pick after the first must differ in what
  // it does (face, tags, profile fields; the name aside) from the picks before it. Candidates come from the same
  // seeded stream in the same order, so the list stays deterministic; a card with no distinct candidate left shows fewer.
  const outcome = (step) => { const { name, ...face } = applyUpgradeSteps(base, [...applied, step]); return JSON.stringify(face); };
  const picked = authored ? [{ k: 'authored' }] : [];
  const seen = new Set(picked.map(outcome));
  for (const step of roll(MAX_CANDIDATES)) {
    if (picked.length >= count) break;
    const key = outcome(step);
    if (picked.length && seen.has(key)) continue;
    seen.add(key);
    picked.push(step);
  }
  const chosen = picked.slice(0, authored ? 2 : count);
  return combos ? withSecondEffects(run, instance, applied, chosen, roll(MAX_CANDIDATES), outcome, salt) : chosen;
}

// "Two effects" (owner, 2026-11-14): each option gets a second, different effect with REST_TWO_EFFECT_CHANCE. The draw comes from
// its own seeded stream (instance id + `#fx` + step index), so the same quote always shows the same list.
function withSecondEffects(run, instance, applied, chosen, candidates, outcome, salt) {
  const draw = mulberry32(upgradeSeed(run.seed, OfferSalted(run, `${instance.instanceId}#fx${salt}`), applied.length));
  const offered = new Set(chosen.flatMap(UpgradeStepFamilies));
  return chosen.map((step) => {
    const roll = draw();
    const pick = draw();
    if (roll >= REST_TWO_EFFECT_CHANCE || step.k === 'authored' || step.k === 'combo') return step;
    // The second effect is of a family no option on the list already has (UPGRADE_FAMILIES).
    const partners = candidates.filter((other) => other.k !== 'authored' && other.k !== 'combo' && !UpgradeStepFamilies(other).some((family) => offered.has(family))
      && !chosen.some((c) => JSON.stringify(c) === JSON.stringify(other)) && outcome(other) !== outcome(step));
    if (!partners.length) return step;
    const partner = partners[Math.min(partners.length - 1, Math.floor(pick * partners.length))];
    for (const family of UpgradeStepFamilies(partner)) offered.add(family);
    return { k: 'combo', steps: [step, partner] };
  });
}

/**
 * The families a card's authored upgrade belongs to, read from what it changes on the face: lower cost, more damage,
 * more Block, more status, more draw-like effects, new keywords. A text-only authored upgrade claims none.
 */
export function AuthoredFamilies(base) {
  const after = applyUpgradeSteps(base, [{ k: 'authored' }]);
  const families = new Set();
  const differs = (pick) => JSON.stringify(pick(base)) !== JSON.stringify(pick(after));
  // Effects by op, whole (a formula amount, a ramp's `add`, hits and targets all count), judged per family.
  const ops = (card, list) => (card.effects || []).filter((e) => list.includes(e.op)).map((e) => JSON.stringify(e)).sort();
  const lower = (key) => Number.isFinite(base[key]) && Number.isFinite(after[key]) && after[key] < base[key];
  if (lower('cost') || lower('staminaCost') || lower('manaCost') || differs((card) => card.costGrowth || null)) families.add('cost');
  const rampOf = (stat) => (card) => (card.ramp?.stat === stat ? card.ramp : null);
  if (differs((card) => ops(card, OP_FAMILIES.damage)) || differs(rampOf('damage'))) families.add('damage');
  if (differs((card) => ops(card, OP_FAMILIES.defense)) || differs(rampOf('block'))) families.add('defense');
  if (differs((card) => ops(card, OP_FAMILIES.pressure))) families.add('pressure');
  if (differs((card) => ops(card, OP_FAMILIES.flow))) families.add('flow');
  if (differs((card) => [...(card.keywords || [])].sort())) families.add('keyword');
  if (differs((card) => [...(card.cardTags ?? card.tags ?? [])].sort())) families.add('form');
  // Any other effect, a ramp on another stat, or a text-only change: still one family, never none (review, 2026-11-20).
  if (!families.size && (differs((card) => card.effects || []) || differs((card) => card.ramp || null))) families.add(OTHER_OP_FAMILY);
  if (!families.size) families.add('form');
  return [...families];
}

// The effect ops each family reads when it judges an authored upgrade (AuthoredFamilies).
const OP_FAMILIES = Object.freeze({
  damage: ['damage', 'changeAttribute'],
  defense: ['block', 'gainWard', 'gainBarrier', 'heal', 'applyReflect', 'restorePoise', 'gainCounterStacks'],
  pressure: ['applyStatus', 'poiseDamage', 'removeStatus'],
  flow: ['draw', 'discard', 'addCard', 'shuffleDiscardIntoDraw', 'exhaust', 'retain', 'restoreStamina', 'restoreMana'],
});
const OTHER_OP_FAMILY = 'form';

/**
 * nextUpgradeStep(run, instance, base, registries) → the step the next upgrade
 * would add: `authored` for a first upgrade when the card has an upgrade block,
 * else the seeded roll; null when no kind is eligible (the card is maxed).
 * Stateless: the same run, instance and count always give the same step.
 */
export function nextUpgradeStep(run, instance, base, registries) {
  return nextUpgradeOptions(run, instance, base, registries, 1)[0] || null;
}

/**
 * upgradeCost(run, instance, def[, registries]) → the Smithing Stones the NEXT
 * upgrade costs: 0 while its number n (1-based) is within F, else 1; null when
 * the card is at the 10-upgrade cap or maxed (no step is eligible any more).
 */
export function upgradeCost(run, instance, def, registries) {
  // The cap counts slot-using upgrades only, like the slots check: a rank-up bonus step is a gift (paidUpgradeCount).
  if (paidUpgradeCount(instance) + 1 > MAX_CARD_UPGRADES) return null;
  if (def && instance && nextUpgradeStep(run, instance, def, registries) === null) return null;
  // A rank-up bonus step does not use a free upgrade (paidUpgradeCount).
  return paidUpgradeCount(instance) + 1 <= freeAllowance(instance, def) ? 0 : 1;
}

const stonesOf = (run) => (Number.isSafeInteger(run && run.smithingStones) ? run.smithingStones : 0);

/**
 * canUpgrade(registries, run, instance) → { ok, code, reason, cost, n, free }.
 * Codes: 'missing' (not a known card), 'armament' (an armament's own cards upgrade
 * with their armament), 'slots' (all the card's slots are used), 'cap' (10 upgrades), 'maxed' (no step is eligible any more), 'stones'.
 */
export function canUpgrade(registries, run, instance) {
  const def = instance && registries.cards.has(instance.cardId) ? registries.cards.get(instance.cardId) : null;
  const n = upgradeCount(instance) + 1;
  const refuse = (code, reason, cost = null) => ({ ok: false, code, reason, cost, n, free: null });
  if (!def) return refuse('missing', 'That card is not in the deck.');
  if (instance.sourceArmamentId || instance.grantedBy) return refuse('armament', `${def.name} is upgraded with its armament.`);
  const slots = UpgradeSlots(run, instance);
  // A rank-up bonus step is a gift and uses no slot, so a rank-up leaves one slot free (owner, 2026-11-23).
  // The 10 cap counts the same slot-using upgrades, so bonus steps never hold a card short of its slots.
  const paid = paidUpgradeCount(instance) + 1;
  if (paid > slots && paid <= MAX_CARD_UPGRADES) {
    return refuse('slots', `${def.name} has ${slots} upgrade ${slots === 1 ? 'slot' : 'slots'} (rank + 1); raise its rank for more.`);
  }
  const cost = upgradeCost(run, instance, def, registries);
  if (cost === null) {
    return paid > MAX_CARD_UPGRADES ? refuse('cap', `${def.name} is already at ${MAX_CARD_UPGRADES} upgrades.`)
      : refuse('maxed', `${def.name} is fully upgraded.`);
  }
  if (cost > stonesOf(run)) return refuse('stones', `Needs ${cost} Smithing Stone; you have ${stonesOf(run)}.`, cost);
  return { ok: true, code: '', reason: '', cost, n, free: cost === 0 };
}
