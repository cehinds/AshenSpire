// Explicit shared lesson and cost-retune recipes. Existing school/status
// identity is preserved from the authored family; no class pool is broadened.
import { reaverCards } from '../cards/reaver.js';
import { starseerCards } from '../cards/starseer.js';
import { rogueCards } from '../cards/rogue.js';
import { heraldCards } from '../cards/herald.js';
import { recipeText } from './cardRecipeText.js';
import { cardExposure } from '../generated/cardExposure.js';

const originals = new Map([...reaverCards, ...starseerCards, ...rogueCards, ...heraldCards].map(c => [c.id, c]));
const legacyCarriers = new Map(cardExposure.map(({ cardId, ...carrier }) => [cardId, carrier]));
const budget = [6, 9, 13, 18, 24, 30];
// id, source, default rank, exact Actions at rank 2, primary index,
// six authored primary values. Conditional/secondary effects activate at 2.
const recipes = [
  ['cometFragment', 'spell', 0, 1, 0, [2, 3, 4, 7, 10, 14]],
  ['crystalBarrier', 'spell', 0, 1, 0, [3, 4, 5, 8, 11, 15]],
  ['scholarsInsight', 'spell', 0, 1, 0, [1, 2, 2, 3, 3, 4]],
  ['ashenMote', 'spell', 0, 1, 0, [3, 4, 5, 8, 11, 15]],
  ['emberVigil', 'spell', 0, 1, 0, [3, 4, 5, 8, 11, 15]],
  ['readTheAsh', 'spell', 0, 1, 0, [1, 2, 2, 3, 3, 4]],
  ['cinderSigil', 'spell', 1, 1, 0, [4, 6, 7, 10, 13, 17]],
  ['starstoneArc', 'spell', 1, 1, 0, [4, 6, 7, 10, 13, 17]],
  ['blightTouch', 'spell', 0, 1, 0, [3, 4, 5, 8, 11, 15]],
  ['penance', 'spell', 0, 1, 0, [3, 4, 5, 8, 11, 15]],
  ['crimsonCleave', 'maneuver', 0, 2, 0, [5, 7, 8, 11, 14, 18]],
  ['shieldBash', 'maneuver', 0, 1, 0, [3, 4, 5, 8, 11, 15]],
  ['quickstep', 'maneuver', 0, 1, 0, [4, 5, 6, 9, 12, 16]],
  ['guardCounter', 'maneuver', 0, 1, 0, [3, 4, 4, 7, 10, 14]],
  ['riposte', 'maneuver', 0, 1, 0, [4, 5, 6, 9, 12, 16]],
  ['rend', 'maneuver', 0, 1, 0, [3, 4, 5, 8, 11, 15]],
  ['quickCut', 'maneuver', 0, 1, 0, [2, 3, 3, 6, 9, 13]],
  ['backstep', 'maneuver', 0, 1, 0, [4, 5, 6, 9, 12, 16]],
  ['starbladePhalanx', 'spell', 1, 1, 0, [2, 3, 4, 7, 10, 14]],
  ['starShower', 'spell', 2, 2, 0, [2, 3, 3, 4, 6, 8]],
  ['frostNova', 'spell', 2, 1, 0, [2, 3, 4, 7, 10, 14]],
  ['gravityWell', 'spell', 3, 2, 0, [1, 1, 2, 2, 3, 3]],
  ['radiantSpray', 'spell', 3, 2, 0, [2, 3, 4, 7, 10, 14]],
  ['starPath', 'spell', 1, 1, 0, [1, 1, 1, 2, 2, 3]],
  ['blightward', 'spell', 1, 1, 0, [4, 5, 6, 9, 12, 16]],
  ['gildedOath', 'spell', 2, 2, 0, [1, 1, 2, 2, 3, 3]],
  ['scourge', 'spell', 3, 2, 0, [4, 5, 6, 9, 12, 16]],
  ['reclamation', 'spell', 2, 1, 0, [2, 3, 5, 7, 9, 12]],
  ['desperateRite', 'spell', 2, 1, 0, [4, 6, 9, 12, 15, 19]],
  ['lastMercy', 'spell', 2, 1, 0, [2, 3, 5, 6, 7, 8]],
  ['bracingStance', 'maneuver', 1, 1, 0, [4, 5, 6, 9, 12, 16]],
  ['stomp', 'maneuver', 1, 1, 0, [6, 9, 12, 15, 18, 22]],
  ['kickOff', 'maneuver', 1, 1, 0, [2, 3, 4, 7, 10, 14]],
  ['warcry', 'maneuver', 2, 1, 0, [1, 1, 1, 2, 2, 3]],
  ['sunderplate', 'maneuver', 2, 2, 0, [5, 7, 9, 12, 15, 19]],
  ['poiseBreaker', 'maneuver', 3, 2, 0, [6, 8, 11, 14, 17, 21]],
  ['feint', 'maneuver', 1, 1, 1, [1, 1, 1, 2, 2, 3]],
  ['pocketSand', 'maneuver', 1, 1, 0, [2, 3, 4, 7, 10, 14]],
  ['lowBlow', 'maneuver', 1, 1, 0, [4, 5, 6, 9, 12, 16]],
  ['vanish', 'maneuver', 2, 1, 0, [4, 6, 8, 11, 14, 18]],
  ['smokeBomb', 'maneuver', 2, 1, 0, [4, 6, 8, 11, 14, 18]],
  ['perfectHeist', 'maneuver', 3, 1, 0, [1, 2, 3, 3, 4, 4]],
];

function lessonGrade(recipe, rank) {
  const [id, abilityKind, , actionCost, primaryIndex, values] = recipe;
  const original = originals.get(id);
  const primary = structuredClone(original.effects[primaryIndex]);
  const field = primary.op === 'applyStatus' ? 'stacks' : 'amount';
  primary[field] = id === 'reclamation'
    ? { ...primary.amount, max: values[rank] }
    : values[rank];
  const riderEffects = rank >= 2 ? original.effects.filter((_, i) => i !== primaryIndex).map(e => structuredClone(e)) : [];
  // These two originals authored mutually-exclusive primary amounts. Grades
  // express the larger amount as a conditional BONUS rather than applying the
  // old 16-point replacement unchanged over a small cantrip.
  if (['guardCounter', 'desperateRite'].includes(id)) {
    delete primary.if;
    if (riderEffects[0]) riderEffects[0].amount = id === 'guardCounter' ? 6 : 7;
  }
  // Area form begins at grade 3; the earlier recipe focuses a chosen enemy.
  if (rank < 3) for (const effect of [primary, ...riderEffects]) if (effect.target === 'allEnemies') effect.target = 'enemy';
  if (['damage', 'block'].includes(primary.op)) {
    const extra = riderEffects.filter(e => ['damage', 'block'].includes(e.op) && typeof e.amount === 'number').reduce((sum, e) => sum + e.amount * (e.hits || 1), 0);
    primary.amount = Math.min(primary.amount, Math.max(1, Math.floor((budget[rank] - extra - (rank >= 4 ? 2 : 0)) / (primary.hits || 1))));
  }
  const effects = [primary, ...riderEffects];
  if (rank >= 4) effects.push({ op: 'block', target: 'self', amount: 2, oncePerTurn: 'grade-block' });
  if (rank >= 5) effects.push({ op: 'draw', amount: 1, oncePerTurn: 'grade-draw' });
  return { rank, actionCost: rank === 0 ? Math.max(1, Math.min(actionCost, 3)) : rank === 1 ? 1 : Math.min(rank, actionCost + (rank >= 4 ? 1 : 0)), manaCost: rank, effects, textTemplate: recipeText(effects),
    ...(original.effects.some(e => e.op === 'damage') ? { traits: { damageSchool: abilityKind === 'spell' ? 'magic' : 'physical', exposureBuildupPerHit: abilityKind === 'spell' ? (rank > 0 ? 5 : 1) : 0 } } : {}),
  };
}

export const abilityCardUpdates = recipes.map(recipe => {
  const [id, abilityKind, abilityRank] = recipe;
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
