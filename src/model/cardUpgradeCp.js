import { BaseFace, ScoreCard, CombatPower, RankOf } from './combatPower.js';
import { GetActiveScoring } from './activeScoring.js';
import { VisibleCardRank } from './cardRank.js';
import { applyUpgradeSteps, upgradeStepsOf } from './cardUpgrade.js';
import { ProjectCardMechanicalValues } from './cardMechanicalProjection.js';

const RARITY_LADDER = Object.freeze(['common', 'uncommon', 'rare']);
const num = (v, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

/**
 * Convert a resolved card definition into a `ScoreCard` face for CP/rank evaluation.
 */
export function CardDefinitionToScoreFace(def, { scoring = GetActiveScoring(), registries, rules, projectionScope } = {}) {
  const face = BaseFace();
  if (!def) return face;
  def = ProjectCardMechanicalValues(def, { registries, rules, projectionScope }).card;
  const tags = [...(def.cardTags || def.tags || [])];
  const camp = def.camp || (tags.includes('camp:spell') || tags.includes('source:spell') ? 'spell' : 'physical');
  face.name = def.name || '';
  face.cls = def.class || 'colorless';
  face.rarity = RARITY_LADDER.includes(def.rarity) ? def.rarity : 'common';
  face.camp = camp;
  face.type = def.type || 'attack';
  face.sp = num(def.staminaCost ?? def.cost, def.cost === 'X' ? 1 : 0);
  face.mp = num(def.manaCost, 0);
  face.kw = [...(def.keywords || [])];
  face.tags = tags;
  face.magicShare = num(def.magicShare, 0);

  const statuses = [];
  for (const eff of def.effects || []) {
    if (!eff || typeof eff !== 'object') continue;
    // Conditions and a charge's later use are estimates from the authored
    // reliability model. Keep this projection shared by authoring and upgrade
    // eligibility; neither path may silently price these payloads as zero.
    const reliability = eff.if ? (scoring.conditionals?.inlineIf ?? 0.7) : 1;
    const amount = num(eff.amount, 0) * reliability;
    switch (eff.op) {
      case 'damage':
        face.dmg += amount * Math.max(1, num(eff.hits, 1));
        face.hits = Math.max(face.hits, num(eff.hits, 1));
        break;
      case 'block':
        face.blk += amount;
        break;
      case 'gainWard':
        face.blk += amount * 5;
        break;
      case 'gainBarrier':
        face.blk += amount * 5;
        break;
      case 'poiseDamage':
        face.poise += amount;
        break;
      case 'applyStatus':
        if (typeof eff.status === 'string') {
          statuses.push([eff.status, num(eff.stacks, 1) * reliability, eff.target === 'self' || eff.target === 'ally' ? 'self' : 'enemy']);
        }
        break;
      case 'changeAttribute':
        if (eff.target === 'self' && typeof eff.attribute === 'string') {
          statuses.push([eff.attribute, num(eff.amount, 1), 'self']);
        }
        break;
      case 'draw': face.draw += num(eff.amount, 1) * reliability; break;
      case 'heal': face.heal += amount; break;
      case 'loseHp': face.loseHp += amount; break;
      case 'discard': face.discard += num(eff.amount, 1); break;
      case 'restoreStamina': case 'gainEnergy': face.restoreSp += num(eff.amount, 1) * reliability; break;
      case 'restoreMana': face.restoreMp += num(eff.amount, 1) * reliability; break;
      // Spending an enemy debuff is not a cleanse benefit for the player.
      case 'removeStatus': if (['self', 'owner', 'player', 'ally'].includes(eff.target)) face.cleanse += num(eff.amount, 1) * reliability; break;
      case 'gainCounterStacks': face.counter += num(eff.amount, 1) * reliability; break;
      case 'grantCardCharge': {
        const used = reliability * (scoring.conditionals?.inlineIf ?? 0.7);
        face.dmg += num(eff.damage) * used;
        face.blk += num(eff.block) * used;
        face.heal += num(eff.heal) * used;
        face.poise += num(eff.break) * used;
        face.restoreMp += num(eff.manaDiscount) * used;
        if (eff.buildupStatus) statuses.push([eff.buildupStatus, num(eff.buildup) * used, 'enemy']);
        break;
      }
      case 'applyReflect': face.reflect += num(eff.amount, 1); break;
      case 'pullEnemy': case 'swapRows': face.pull += 1; break;
      case 'moveEngagement': face.move += 1; break;
      case 'retain': face.holdOne += num(eff.amount, 1); break;
      case 'exhaust': face.cull += num(eff.amount, 1); break;
      case 'shuffleDiscardIntoDraw': face.shuffle += 1; break;
      case 'addCard':
        if (eff.card === def.id) face.copy += num(eff.count, 1);
        break;
      case 'restorePoise': face.blk += amount; break;
    }
  }
  face.statuses = statuses;
  if (def.ramp && !face.tags.includes('ramp.honed')) face.tags.push('ramp.honed');
  if (def.runAttributeBonus) {
    face.attr += Object.values(def.runAttributeBonus).reduce((sum, n) => sum + num(n, 0), 0);
  }
  return face;
}

/**
 * Precompute the invariant "before" baseline for a card so evaluating multiple candidate steps
 * against the same `currentDef` does not re-run `ScoreCard(CardDefinitionToScoreFace(currentDef))`.
 */
export function PrepareUpgradeStepCpContext({ baseDef, currentDef, instance = null, playerLevel = 1, scoring = GetActiveScoring(), registries, projectionScope, scoreCard }) {
  const refDef = currentDef || baseDef;
  const face = CardDefinitionToScoreFace(refDef, { scoring, registries, projectionScope });
  const rawBefore = (scoreCard ? scoreCard(face) : ScoreCard(face, scoring)).raw;
  const currentRarity = instance?.rarityOverride || currentDef?.rarity || baseDef?.rarity || 'common';
  const startIdx = Math.max(0, RARITY_LADDER.indexOf(currentRarity));
  const scoredBeforeRank = RankOf(CombatPower(rawBefore, currentRarity, scoring), scoring);
  const cardRank = Math.max(VisibleCardRank(instance || baseDef), scoredBeforeRank);
  const accessibleRank = Math.max(1, Math.min(scoring?.rank?.maxRank || 10, Math.trunc(Number(playerLevel) || 1)));
  const maxAllowedRank = Math.max(cardRank, accessibleRank);
  return { rawBefore, currentRarity, startIdx, cardRank, maxAllowedRank, ...(registries ? { registries } : {}), ...(projectionScope ? { projectionScope } : {}), ...(scoreCard ? { scoreCard } : {}) };
}

/**
 * Evaluate whether an upgrade step keeps the card within its rank (possibly by bumping rarity up to `rare`)
 * or within a rank accessible to the player (`max(cardRank, playerLevel)`).
 */
export function EvaluateUpgradeStepCp({ baseDef, currentDef, instance = null, step, playerLevel = 1, scoring = GetActiveScoring(), registries, context = null }) {
  if (!baseDef || !step) return { allowed: true };
  // Fast path: when currentDef is already resolved, apply just the single candidate step instead of replaying every prior step.
  const afterDef = currentDef
    ? applyUpgradeSteps(currentDef, [step])
    : applyUpgradeSteps(baseDef, [...upgradeStepsOf(instance || {}), step]);
  const ctx = context || PrepareUpgradeStepCpContext({ baseDef, currentDef, instance, playerLevel, scoring, registries });
  const face = CardDefinitionToScoreFace(afterDef, { scoring, registries: ctx.registries || registries, projectionScope: ctx.projectionScope });
  const rawAfter = (ctx.scoreCard ? ctx.scoreCard(face) : ScoreCard(face, scoring)).raw;
  const { startIdx, cardRank, maxAllowedRank } = ctx;

  // Pass 1: Check if the upgraded card stays within its current rank at current or higher rarity (up to rare).
  for (let i = startIdx; i < RARITY_LADDER.length; i++) {
    const rarity = RARITY_LADDER[i];
    const cp = CombatPower(rawAfter, rarity, scoring);
    const rank = RankOf(cp, scoring);
    if (rank <= cardRank) {
      return { allowed: true, rarity, rank: cardRank, raw: rawAfter, cp };
    }
  }

  // Pass 2: Check if the resulting rank is accessible to the player at current or higher rarity.
  for (let i = startIdx; i < RARITY_LADDER.length; i++) {
    const rarity = RARITY_LADDER[i];
    const cp = CombatPower(rawAfter, rarity, scoring);
    const rank = RankOf(cp, scoring);
    if (rank <= maxAllowedRank) {
      return { allowed: true, rarity, rank, raw: rawAfter, cp };
    }
  }

  return { allowed: false, raw: rawAfter };
}
