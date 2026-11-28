// Canonical pre-defense offense chain shared by live receipts and upgrade eligibility.
// Contextual readers are explicit call inputs; this leaf never loads the combat interpreter.
import { GearReceiptAdd, GearMeleeHit } from './gearDamageRead.js';
import { ChannelLabel, ChannelWeight } from './damageChannels.js';
import { SpellTraditionsActive, SpellTraditionLabel, TraditionSpellPower, CardSpellTraditions } from './spellTraditions.js';
import { sourceRatingValue, splitContactParts, PacketSplit, PacketWeights, isMagicalAttack, finesseRatingView, carrierHasTag, SourceWeaponHasTag, IsFinesseHit } from './combatRatings.js';
import { core2MultiHitRulesEnabled } from './core2ActionPolicy.js';
import { ScaleCardBaseDamage, ScalePhysicalDamage, isSpellCard } from './combatCardProfile.js';
import { stanceEffectiveness } from './stanceRules.js';
import { fixCoreEnabled, FixCoreBrokenRules } from './fixCoreMechanics.js';
import { fixCoreRules } from './fixCoreRulesCache.js';
import { configuredStance } from './profileStance.js';
import { configuredModule } from './profileModule.js';
import { TriangleRules, TriangleBeats } from './stanceTriangle.js';
import { FightMagicShare } from './elementIdentityRules.js';

function rating(entity, name) {
  const value = entity?.ratings?.[name] ?? entity?.[name] ?? 0;
  return Number.isFinite(value) ? value : 0;
}

export function PhysicalDamageMultiplier(effects) {
  const value = effects?.physicalDamageMultiplier;
  return Number.isFinite(value) && value >= 0 ? value : 1;
}
/** The effects module's per-side damage factor (1 when unset): enemies read `enemyDamageMultiplier`, the player `playerDamageMultiplier`. */
export function SideDamageMultiplier(effects, source) {
  const value = source?.kind === 'enemy' ? effects?.enemyDamageMultiplier : source?.kind === 'player' ? effects?.playerDamageMultiplier : 1;
  return Number.isFinite(value) && value >= 0 ? value : 1;
}
/** An element packet hit (owner, 2026-11-19): a player's physical-camp card with a magic share between 0 and 1 and no rating of its own. */
export const IsPacketHit = (ctx, source, carrier, profile, share) => fixCoreEnabled(ctx) && source?.kind === 'player' && carrier?.ratingId === undefined
  && profile?.camp === 'physical' && Number.isFinite(carrier?.magicShare) && share > 0 && share < 1;

export const PacketMagicMultiplier = (flux) => (Number.isFinite(flux) ? flux : 1);

export function DamageIncoming(amount) { return Math.max(0, Math.floor(amount)); }

/** Whether the attacking stance beats the defending one: the triangle's edges, else the maneuver matchups. */
function StanceAdvantage(stances, triangle, attacking, defending)
{
  if (triangle)
  {
    return TriangleBeats(triangle, attacking, defending);
  }
  return !!stances?.include?.includes(attacking)
    && !!stances?.matchups?.[attacking]?.includes(defending);
}

export function ProfileDamageOffense(ctx, source, target, base, carrier = {}, readers) {
  const { getAdd, AttackDamageMultiplier, FluxMultiplier, StanceWeaknessMultiplier, ElementReceiptStages, defensiveCombatStance, hitWeaknessTriggers, matchingHitWeaknesses, weaknessLabel } = readers;
  const effects = configuredModule(ctx, 'effects');
  const stances = configuredModule(ctx, 'stances');
  const defenses = configuredModule(ctx, 'defenses');
  const attacking = configuredStance(carrier, ctx);
  const defending = configuredStance(defensiveCombatStance(ctx,target,carrier), ctx);
  const advantage = StanceAdvantage(stances, TriangleRules(ctx), attacking, defending);
  const modern = fixCoreEnabled(ctx);
  const flatReturn = modern && carrier.counterReturnAttack;
  // Owner, 2026-11-17: a profile's `effects.baseDamageMultiplier` scales every card's base damage (the Core bundle halves it), rounded up, before AR or
  // PR adds. A return computed from damage already dealt (a Counter return, a reflected hit, a proposal's reactive return such as
  // base.reflect's 50%) is final damage and is not scaled again (#2820 review).
  const authoredBase = base, baseMultiplier = carrier.counterReturnAttack || carrier.reflectedHit || carrier.proposalReactive ? 1 : effects?.baseDamageMultiplier;
  base = ScaleCardBaseDamage(base, baseMultiplier);
  const sources = [{id:'base',label:'Card damage (including enhancements)',amount:authoredBase,stage:'offense',operation:'set'}];
  if (base !== authoredBase) sources.push({id:'base-damage-scale',label:'Base damage scale',amount:base-authoredBase,requested:authoredBase,effective:base,stage:'offense',operation:'multiply',multiplier:baseMultiplier});
  // The chain keeps full precision and is floored once where it is applied (the quantity-rounding step);
  // receipt lines show the running floor so every shown number is whole (owner, 2026-10-18 16:05).
  const whole = value => modern ? Math.max(0, Math.floor(value)) : value;
  const transition = (id,label,before,after,stage='offense',multiplier) => {
    if (before !== after) sources.push({id,label,amount:whole(after)-whole(before),requested:whole(before),effective:whole(after),stage,operation:multiplier === undefined ? 'add' : 'multiply',...(multiplier === undefined ? {} : {multiplier})});
    return after;
  };
  const profile = {...(carrier.combatProfile || {}), ...(Number.isFinite(carrier.magicShare) ? {magicShare:carrier.magicShare} : {})};
  const share = FightMagicShare(ctx, profile);
  // Owner, 2026-10-19: spell effectiveness uses PR; a spell (camp spell or magic school, whatever its Barrier split) reads PR where a physical attack reads AR.
  // A hit with any magic share (a school-only technique included, as magicShareOf reads it) reads PR.
  // Enemies keep AR for their spells: their PR is 0 in data, so reading it would zero their spell damage.
  // Owner, 2026-11-19 (an element upgrade's packet): a player's physical-camp card with a magic share between 0 and 1 and no rating of its own deals a
  // physical part and a magic part on one hit. The physical part keeps its STR / AR channel and the magic part adds INT / Power (Arcane tradition) as its own
  // stage, so neither is lost to the other. A lent staff or sceptre card names its `ratingId`, and an enemy move reads its own, so both keep their one channel.
  const packetHit = IsPacketHit(ctx, source, carrier, profile, share);
  const ratingId = !packetHit && modern && (source?.kind !== 'enemy' || SpellTraditionsActive(ctx)) && (profile.camp === 'spell' || share > 0 || isMagicalAttack(ctx, carrier)) ? 'pr' : 'ar';
  const ratingLabel = ratingId === 'pr' && SpellTraditionsActive(ctx) ? SpellTraditionLabel(carrier) : ChannelLabel(ratingId);
  // A finesse hit scales with Dexterity instead of Strength (owner, 2026-10-25; Core 2 rules version 2).
  const finesse = modern && core2MultiHitRulesEnabled(ctx) && IsFinesseHit(ctx, source, carrier, ratingId);
  const rated = finesse ? finesseRatingView(source) : source;
  const ar = modern ? sourceRatingValue(ctx, rated, ratingId, carrier.sourceArmamentId, carrier.equipmentScoped, carrier) : rating(source,'ar');
  const ratingBonus = modern && carrier.skipRatingBonus ? 0 : ar * ChannelWeight(effects,ratingId);
  let raw = base;
  const applicable = (rated?.ratingSources || []).filter(row => row.kind !== 'equipment' || !carrier.sourceArmamentId && !carrier.equipmentScoped
    || row.slot === 'armor' || row.sourceId?.startsWith('armor/') || row.sourceId === carrier.sourceArmamentId || row.sourceId === `armament/${carrier.sourceArmamentId}`);
  const contributionValue = row => row.kind === 'attribute' && ratingId === 'pr' && SpellTraditionsActive(ctx)
    ? TraditionSpellPower(ctx, rated, carrier, row[ratingId] || 0) : row[ratingId] || 0;
  const sourceAR = applicable.reduce((sum,row)=>sum+contributionValue(row),0);
  if (modern && sourceAR > 0 && ratingBonus > 0) {
    for (const [index,row] of applicable.entries()) {
      const contribution = contributionValue(row) * ChannelWeight(effects,ratingId);
      raw = transition(`${ratingId}:${row.sourceId || index}`,`${row.name || row.kind}: ${ratingLabel}`,raw,raw+contribution);
    }
    raw = transition('ar:adjustments',`${ratingLabel} stance/status modifiers (including Weak)`,raw,base+ratingBonus);
  } else raw = transition('ar',ratingLabel,raw,raw+ratingBonus);
  // The packet's magic part reads Power on top: its own stage, counted into the magic part of the final split below.
  const packetPower = packetHit && !carrier.skipRatingBonus ? Math.max(0, Math.floor(sourceRatingValue(ctx, source, 'pr', carrier.sourceArmamentId, carrier.equipmentScoped, carrier) * ChannelWeight(effects,'pr'))) : 0;
  if (packetPower > 0) raw = transition('pr:packet',`${ChannelLabel('pr')} (magic part)`,raw,raw+packetPower);
  // Owner, 2026-11-18: gear that adds DEX to a hit (Katana, a Bow against a Retreat-stacked target), STR a second time (Greatsword Smash) and damage
  // against a target (a Pike against the front row) is one receipt stage, so the quote equals the hit. A triggered one is a fight effect for the face.
  const gearAdd = modern && !carrier.skipRatingBonus && source?.kind === 'player' ? GearReceiptAdd(ctx, source, target, carrier, { ratingId, ar, effects }) : 0;
  if (gearAdd) raw = transition('gear', 'Gear', raw, raw + gearAdd);
  // A `dexDamage` tag (on the card or on a weapon without cardAddDex) strictly adds DEX on top of existing damage scaling.
  const dexTagAdd = modern && !carrier.skipRatingBonus && ratingId === 'ar'
    && (carrierHasTag(ctx, carrier, 'dexDamage') || (SourceWeaponHasTag(ctx, source, carrier, 'dexDamage') && !(carrier?.gear?.addDex > 0)))
    ? sourceRatingValue(ctx, source, 'dr', carrier.sourceArmamentId, carrier.equipmentScoped, carrier) * ChannelWeight(effects, 'dr') : 0;
  if (dexTagAdd > 0) raw = transition('dex-add', 'DEX (Deft)', raw, raw + dexTagAdd);
  // A Core 2 Counter return is final pre-protection damage (SPEC §17): no matching-stance or defensive-stance stage.
  const stanceMultiplier = flatReturn ? 1 : stanceEffectiveness(ctx,source,carrier);
  raw = transition('matching-stance','Matching stance effectiveness',raw,raw*stanceMultiplier,'offense',stanceMultiplier);
  // Owner, 2026-11-14: a Broken target (Poise break under `poise.breakRule: "broken"`) takes the Broken multiplier from every hit.
  const brokenRule = modern && !flatReturn && target?.broken ? FixCoreBrokenRules(ctx) : null;
  if (brokenRule) raw = transition('broken','Broken',raw,raw*brokenRule.damageMultiplier,'offense',brokenRule.damageMultiplier);
  // Owner, 2026-11-14 (Wave 2.5): the attacker's own stance benefit (Attack +20%, Prepared +25%), then a Sweep splash hit's share of that damage.
  const benefitMultiplier = flatReturn ? 1 : AttackDamageMultiplier(ctx,source,carrier);
  raw = transition('stance-benefit','Stance benefit',raw,raw*benefitMultiplier,'offense',benefitMultiplier);
  // Owner, 2026-11-15 (W25-F): the player's elemental flux lifts the next card of its element by x1.25 (engine/elementFlux.js), in the same chain as Prepared's bonus so the quote equals the hit.
  const fluxMultiplier = flatReturn ? 1 : FluxMultiplier(ctx,source,carrier);
  // Owner ruling, 2026-11-20: on a packet hit flux lifts the magic part only, so the chain carries it as a factor on the magic share of the hit.
  const packetWeights = packetHit ? PacketWeights({base,share,physicalBonus:ratingBonus,magicBonus:packetPower}) : null;
  const fluxFactor = packetWeights && fluxMultiplier !== 1 ? 1 + (fluxMultiplier - 1) * packetWeights.magic / Math.max(1, packetWeights.magic + packetWeights.physical) : fluxMultiplier;
  raw = transition('element-flux','Elemental flux',raw,raw*fluxFactor,'offense',fluxFactor);
  const splashMultiplier = flatReturn ? 1 : carrier.stanceSplash > 0 && carrier.stanceSplash < 1 ? carrier.stanceSplash : 1;
  raw = transition('sweep-splash','Sweep splash',raw,raw*splashMultiplier,'offense',splashMultiplier);
  // Owner, 2026-11-17 (theme B): the target's stance weakness, Prepared x1.25 from melee and Idle x1.25 from everything.
  // An un-aimed face (no target) names no stance, so it takes no weakness.
  const weaknessMultiplier = flatReturn || !target ? 1 : StanceWeaknessMultiplier(ctx,carrier,defending,profile,target);
  raw = transition('stance-weakness','Stance weakness',raw,raw*weaknessMultiplier,'offense',weaknessMultiplier);
  // Owner, 2026-11-18: a wearer Vulnerable to melee (robes, a bow) takes the Vulnerable amount from melee physical attacks, Smashes and Sweeps.
  if (modern && !flatReturn && target?.itemProps?.vulnMelee && GearMeleeHit(profile, carrier)) raw = transition('vulnerable-melee', 'Vulnerable to melee (gear)', raw, raw * fixCoreRules(ctx, target).statuses.vulnerabilityMultiplier, 'offense', fixCoreRules(ctx, target).statuses.vulnerabilityMultiplier);
  if (modern && !flatReturn && target?.statuses?.vulnerable?.stacks > 0) raw=transition('vulnerable','Vulnerable',raw,raw*fixCoreRules(ctx, target).statuses.vulnerabilityMultiplier,'offense',fixCoreRules(ctx, target).statuses.vulnerabilityMultiplier);
  // Owner, 2026-10-31 (SPEC 5.3): each enemy weakness the hit matches multiplies its damage, after Vulnerable.
  const weaknesses = modern && !flatReturn && target?.kind === 'enemy' ? matchingHitWeaknesses(target, hitWeaknessTriggers(ctx, source, carrier, profile, share)) : [];
  for (const row of weaknesses) if (row.effect === 'damage') raw = transition(`weakness:${row.hidden ? 'unknown' : row.to}`,weaknessLabel(row.to,row.hidden),raw,raw*(1+row.amount/100),'offense',1+row.amount/100);
  // Element identity (W25): the deterministic element multipliers (Burn, Shock, Brittle, Chill, spread, chain, undead) are receipt stages, so a quote equals the hit.
  const element = modern && !flatReturn ? ElementReceiptStages(ctx, source, target, carrier, raw) : null;
  for (const stage of element?.stages || []) raw = transition(stage.id, stage.label, raw, raw * stage.multiplier, 'offense', stage.multiplier);
  const packetMagicMultiplier = packetHit ? PacketMagicMultiplier(fluxMultiplier) : 1;
  // Owner, 2026-11-18: one stage scales every hit by its side (`effects.playerDamageMultiplier` / `enemyDamageMultiplier`), after the element stages and
  // before Block and Poise absorb it, so the face, the intent and the hit read the same number. Final returns (a Counter return, a reflected hit, a
  // proposal's reactive return) are not scaled again. A positive hit never rounds to 0.
  // Owner, 2026-11-18: the physical share of the hit (the receipt's own physical/magical split) takes `effects.physicalDamageMultiplier` for both sides,
  // on top of the side scale, with the same exemptions for final returns. A positive physical part never rounds to 0.
  const physicalMultiplier = flatReturn || carrier.counterReturnAttack || carrier.reflectedHit || carrier.proposalReactive ? 1 : PhysicalDamageMultiplier(effects);
  if (physicalMultiplier !== 1 && raw > 0) {
    const split = packetHit ? PacketSplit({base,share,physicalBonus:ratingBonus,magicBonus:packetPower,magicMultiplier:packetMagicMultiplier,total:raw}) : splitContactParts({amount:raw,base,ratingBonus,share,ratingPart:ratingId === 'pr' || share >= 1 ? 'magic' : 'physical',primary:share >= 1 ? 'magic' : 'physical'});
    const physicalFraction = split.physical + split.magic > 0 ? split.physical / (split.physical + split.magic) : 0;
    if (physicalFraction > 0) raw = transition('physical-damage-scale','Physical damage scale',raw,ScalePhysicalDamage(raw,physicalFraction,physicalMultiplier),'offense',physicalMultiplier);
  }
  const sideMultiplier = flatReturn || carrier.counterReturnAttack || carrier.reflectedHit || carrier.proposalReactive ? 1 : SideDamageMultiplier(effects, source);
  if (sideMultiplier !== 1 && raw > 0) raw = transition('side-damage-scale',`${source?.kind === 'enemy' ? 'Enemy' : 'Player'} damage scale`,raw,Math.max(raw >= 1 && sideMultiplier > 0 ? 1 : 0,raw*sideMultiplier),'offense',sideMultiplier);
  // Stat-adding buff statuses on the attacker (+1 per stack, never shrunk by side/physical multipliers):
  // STR (`attackDamageAdd`) on physical/attack hits; WIS (`divineDamageAdd`) on Divine hits; INT (`magicDamageAdd` + `arcaneDamageAdd`) on magic/Arcane hits.
  // The same snapshot revision authored the weapon-Poise switch; its presence marks the era, even when disabled.
  if (modern && !flatReturn && typeof fixCoreRules(ctx).poise?.weaponPoiseEnabled === 'boolean') {
    const strBuff = ratingId === 'ar' || share < 1 ? getAdd(ctx, source, 'attackDamageAdd') : 0;
    if (strBuff) raw = transition('status:strength', 'Strength buff', raw, raw + strBuff);
    const traditions = CardSpellTraditions(carrier);
    const magicHit = isSpellCard(carrier) || isMagicalAttack(ctx, carrier) || share > 0 || packetHit;
    const divineHit = (magicHit && traditions.includes('divine')) || carrierHasTag(ctx, carrier, 'tradition:divine') || carrierHasTag(ctx, carrier, 'school:divine') || carrierHasTag(ctx, carrier, 'damage:sacred');
    const arcaneHit = (magicHit && traditions.includes('arcane')) || carrierHasTag(ctx, carrier, 'tradition:arcane') || carrierHasTag(ctx, carrier, 'damage:arcane') || carrierHasTag(ctx, carrier, 'damage.arcane');
    const wisBuff = divineHit ? getAdd(ctx, source, 'divineDamageAdd') : 0;
    if (wisBuff) raw = transition('status:wisdom', 'Wisdom buff', raw, raw + wisBuff);
    const intMagic = magicHit ? getAdd(ctx, source, 'magicDamageAdd') : 0;
    const intArcane = arcaneHit ? getAdd(ctx, source, 'arcaneDamageAdd') : 0;
    // ChangeAttribute is already included in the effective attributes read by spell power.
    if (intMagic + intArcane) raw = transition('status:intelligence', 'Intelligence buff', raw, raw + intMagic + intArcane);
  }
  return { base, effects, stances, defenses, attacking, defending, advantage, modern, flatReturn, authoredBase, sources, transition, profile, share, packetHit, ratingId, ratingBonus, packetPower, weaknessMultiplier, weaknesses, element, packetMagicMultiplier, physicalMultiplier, raw, rawHit: DamageIncoming(raw) };
}
