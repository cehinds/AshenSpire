// src/content/progression/lessons.js — the recipe table is authored in
// content/source/progressionLessonRecipes.json; content-build compiles it to
// src/content/generated/progressionLessonRecipes.js. Edit the JSON, not the table here.
// Explicit shared lesson and cost-retune recipes. Existing school/status
// identity is preserved from the authored family; no class pool is broadened.
// Stays JS: the grade maths (lessonGrade) and everything derived from the class
// card pools (originals, legacy faces, exposure carriers); only the recipe table is data.
import { reaverCards } from '../cards/reaver.js';
import { starseerCards } from '../cards/starseer.js';
import { rogueCards } from '../cards/rogue.js';
import { heraldCards } from '../cards/herald.js';
import { recipeText } from './cardRecipeText.js';
import { combatProfileFor } from '../../model/combatCardProfile.js';
import { cardExposure } from '../generated/cardExposure.js';
import { progressionGradeRules } from '../generated/progressionGradeRules.js';
import { progressionLessonRecipes as recipes } from '../generated/progressionLessonRecipes.js';

const originals = new Map([...reaverCards, ...starseerCards, ...rogueCards, ...heraldCards].map(c => [c.id, c]));
const legacyCarriers = new Map(cardExposure.map(({ cardId, ...carrier }) => [cardId, carrier]));
const budget = progressionGradeRules.gradeBudget;

function lessonGrade(recipe, rank) {
  const { id, abilityKind, actionCost, primaryIndex, values, ...options } = recipe;
  const original = originals.get(id);
  // Explicit grades preserve the previous resolved resource prices and riders.
  // These paid entry spells/arts author their payoff directly instead of
  // letting a stronger effect silently buy another resource tax.
  if (options.grades) {
    const grade = structuredClone(options.grades[rank]);
    return { rank, ...grade, textTemplate: recipeText(grade.effects, combatProfileFor(id)),
      traits: { costRule: 'fixed',
        ...(original.effects.some(e => e.op === 'damage') ? { damageSchool: abilityKind === 'spell' ? 'magic' : 'physical', exposureBuildupPerHit: abilityKind === 'spell' ? (rank > 0 ? 5 : 1) : 0 } : {}),
      },
    };
  }
  const primary = structuredClone(original.effects[primaryIndex]);
  const field = primary.op === 'applyStatus' ? 'stacks' : 'amount';
  primary[field] = id === 'reclamation'
    ? { ...primary.amount, max: values[rank] }
    : values[rank];
  // `alwaysRiders` (opt-in per recipe) keeps the non-primary effects at every
  // rank; all other recipes keep the rank-2 rider threshold unchanged.
  const riderEffects = rank >= 2 || options.alwaysRiders ? original.effects.filter((_, i) => i !== primaryIndex).map(e => structuredClone(e)) : [];
  // These two originals authored mutually-exclusive primary amounts. Grades
  // express the larger amount as a conditional BONUS rather than applying the
  // old 16-point replacement unchanged over a small cantrip.
  if (['guardCounter', 'desperateRite'].includes(id)) {
    delete primary.if;
    if (riderEffects[0]) riderEffects[0].amount = id === 'guardCounter' ? 6 : 7;
  }
  // Spell area forms begin at grade 3; a Sweep keeps its area at every grade.
  if (rank < 3 && combatProfileFor(id).maneuver !== 'sweep') for (const effect of [primary, ...riderEffects]) if (effect.target === 'allEnemies') effect.target = 'enemy';
  if (['damage', 'block'].includes(primary.op)) {
    const extra = riderEffects.filter(e => ['damage', 'block'].includes(e.op) && typeof e.amount === 'number').reduce((sum, e) => sum + e.amount * (e.hits || 1), 0);
    primary.amount = Math.min(primary.amount, Math.max(1, Math.floor((budget[rank] - extra - (rank >= 4 ? 2 : 0)) / (primary.hits || 1))));
  }
  const effects = [primary, ...riderEffects];
  if (rank >= 4) effects.push({ op: 'block', target: 'self', amount: 2, oncePerTurn: 'grade-block' });
  if (rank >= 5) effects.push({ op: 'draw', amount: 1, oncePerTurn: 'grade-draw' });
  const fixedCost=options.fixedGradeCosts?.[rank];
  return { rank, actionCost: fixedCost?.actionCost ?? (rank === 0 ? Math.max(1, Math.min(actionCost, 3)) : rank === 1 ? 1 : Math.min(rank, actionCost + (rank >= 4 ? 1 : 0))), manaCost: fixedCost?.manaCost ?? rank, effects, textTemplate: recipeText(effects, combatProfileFor(id)),
    ...(original.effects.some(e => e.op === 'damage') ? { traits: { ...(fixedCost ? {costRule:'fixed'} : {}),damageSchool: abilityKind === 'spell' ? 'magic' : 'physical', exposureBuildupPerHit: abilityKind === 'spell' ? (rank > 0 ? 5 : 1) : 0 } } : {}),
  };
}

export const abilityCardUpdates = recipes.map(recipe => {
  const { id, abilityKind, abilityRank } = recipe;
  const original = originals.get(id);
  const gradeProfiles = Array.from({ length: 6 }, (_, rank) => lessonGrade(recipe, rank));
  const base = gradeProfiles[abilityRank];
  return { id, abilityKind, abilityRank, abilityFamily: id, gradeProfiles,
    legacyFace: { cost: original.cost, manaCost: original.manaCost || 0, effects: structuredClone(original.effects), textTemplate: original.textTemplate,
      ...legacyCarriers.get(id),
      ...(original.upgrade ? { upgrade: structuredClone(original.upgrade) } : {}),
    },
    cost: base.actionCost, manaCost: base.manaCost, effects: base.effects, textTemplate: base.textTemplate,
    ...base.traits,
    // A rank recipe replaces the old upgrade recipe; never layer its old
    // free-resource effects back on top of a resolved ability grade.
    upgrade: {},
  };
});
