// Forty class families. Rank is a recipe selection, never an imperative card hook.
import { cardFamilies } from './cardFamilies.js';
import { recipeText } from './cardRecipeText.js';
import { progressionCardLore } from './cardLore.js';
import { abilityCardUpdates as lessonUpdates } from './lessons.js';
export const abilityCardUpdates = lessonUpdates;

const damage = (amount, target = 'enemy', extra = {}) => ({ op: 'damage', target, amount, ...extra });
const block = (amount, extra = {}) => ({ op: 'block', target: 'self', amount, ...extra });
const draw = (amount, extra = {}) => ({ op: 'draw', amount, ...extra });
const status = (id, stacks, extra = {}) => ({ op: 'applyStatus', target: 'enemy', status: id, stacks, ...extra });
const metric = (name, atLeast = 1, extra = {}) => ({ p: 'turnMetric', metric: name, atLeast, ...extra });
const has = (id, of = 'target') => ({ p: 'hasStatus', of, status: id, snapshot: 'beforePlay' });
const lowHp = (of = 'self') => ({ p: 'hpBelowPct', of, pct: 50, snapshot: 'beforePlay' });
const all = (...preds) => ({ p: 'all', preds });
const any = (...preds) => ({ p: 'any', preds });
const charge = (key, extra) => ({ op: 'grantCardCharge', target: 'self', key, ...extra });
const offering = (amount) => ({ op: 'loseHp', target: 'self', amount, nonlethal: true, offering: true });

// Only the family rider is specialized. Shared grade milestones and budgets
// are composed below, with no engine branch naming one of these families.
const riders = {
  'ember-hew': () => [status('bleed', 2)],
  'cinder-guard': () => [charge('guarded-strike', { cardType: 'attack', damage: 3, if: { p: 'hasBlock', of: 'self', snapshot: 'beforePlay' } })],
  bloodstep: () => [draw(1, { if: has('bleed') })],
  'breaker-s-toll': () => [{ op: 'poiseDamage', target: 'enemy', amount: 4 }],
  'furnace-advance': () => [damage(4, 'enemy', { if: metric('tagPlays', 1, { tag: 'guard' }) })],
  'crimson-reprisal': () => [damage(4, 'enemy', { if: metric('hpLostSinceTurnStart') })],
  'warbound-defiance': () => [block(4, { if: lowHp() })],
  'red-standard': () => [draw(1, { if: metric('tagPlays', 2, { tag: 'heavy' }) })],
  'ashen-cleaver': (rank) => [status('weak', 1, { target: rank >= 3 ? 'allEnemies' : 'enemy' })],
  'crown-of-cinders': () => [charge('ember-crown', { cardType: 'attack', damage: 6 })],
  'cinder-orbit': () => [damage(3, 'enemy', { if: metric('previousSpell') })],
  'lunar-aegis': () => [block(3, { if: metric('manaSpent', 2) })],
  'comet-needle': () => [status('vulnerable', 1)],
  'rime-mirror': () => [status('frost', 3)],
  'falling-constellation': (rank) => [damage(3, rank >= 3 ? 'allEnemies' : 'enemy', { if: metric('distinctTagPlays', 2, { tag: 'starstone' }) })],
  'wellspring-sigil': () => [{ op: 'restoreMana', target: 'self', amount: 1, oncePerTurn: 'mana-weave' }],
  'gravitic-knot': () => [status('weak', 1)],
  'nightglass-reading': () => [draw(2), charge('nightglass', { abilityKind: 'spell', cardType: 'attack', damage: 3 })],
  'eclipse-lance': () => [damage(5, 'enemy', { if: any(has('frost'), has('frostExposed')) })],
  'firmament-ward': () => [charge('warded-casting', { abilityKind: 'spell', manaDiscount: 1 })],
  'shiv-of-ash': () => [damage(3, 'enemy', { if: { p: 'firstCardThisTurn' } })],
  'pocket-coil': () => [draw(1, { if: metric('discarded') })],
  'needle-feint': () => [status('weak', 1)],
  'back-alley-cut': () => [damage(4, 'enemy', { if: { p: 'not', pred: { p: 'hasBlock', of: 'target', snapshot: 'beforePlay' } } })],
  'silent-exchange': () => [draw(2), { op: 'discard', amount: 1, choose: true }],
  'wire-snare': () => [status('bleed', 3, { if: any(has('weak'), has('vulnerable')) })],
  nightstep: () => [charge('smoke-edge', { cardType: 'attack', cardTag: 'blade', damage: 3 })],
  'carrion-cut': () => [damage(4, 'enemy', { if: lowHp('target') })],
  twinshade: () => [],
  'last-laugh': () => [damage(4, 'enemy', { if: all(metric('tagPlays', 1, { tag: 'guile' }), metric('tagPlays', 1, { tag: 'guard' })) })],
  'ash-benediction': () => [{ op: 'heal', target: 'self', amount: 2 }],
  'blood-censer': () => [offering(2), block(3)],
  'blight-litany': () => [status('crimsonBlight', 3)],
  'pallbearer-s-ward': () => [draw(1, { if: lowHp() })],
  'ember-tithe': () => [offering(3), status('regen', 1, { target: 'self' })],
  'ossuary-cant': () => [{ op: 'gainEnergy', amount: 1, if: has('crimsonBlight', 'allEnemies') }],
  'requiem-brand': () => [status('weak', 1, { if: has('crimsonBlight') })],
  'pilgrim-s-shelter': () => [{ op: 'heal', target: 'self', amount: 3, if: { p: 'turnMetric', metric: 'turnStartHpPct', atMost: 50 } }],
  'crown-of-scars': () => [offering(3), damage(5, 'enemy', { if: metric('offeringsPaid') })],
  'dawn-after-ash': () => [{ op: 'removeStatus', target: 'self', status: 'weak', amount: 1 }],
};

const budget = [6, 9, 13, 18, 24, 30];
const areaFamilies = new Set(['ashen-cleaver', 'falling-constellation']);

export function familyGrade(family, rank) {
  const key = family.id.replace(/^progression-/, '');
  const advanced = rank >= 2 ? riders[key](rank) : [];
  const riderBudget = advanced.filter(e => ['damage', 'block'].includes(e.op)).reduce((sum, e) => sum + e.amount * (e.hits || 1), 0);
  const gradeBlock = rank >= 4 ? 2 : 0;
  // Catalogue values are PER HIT. Reserve the explicit immediate rider budget
  // and milestone Block before clamping to the approved total direct ceiling.
  const primary = Math.min(family.primaryValues[rank], Math.floor((budget[rank] - riderBudget - gradeBlock) / family.hits));
  const primaryEffect = family.primary === 'damage'
    ? damage(primary, rank >= 3 && areaFamilies.has(key) ? 'allEnemies' : 'enemy', family.hits > 1 ? { hits: family.hits } : {})
    : block(primary);
  // Offering is paid first. Guarded Strike checks existing Block BEFORE the
  // primary guard. All other riders follow the primary; history conditions
  // read the engine's before-play snapshot, excluding this card's payment.
  const before = advanced.filter(e => e.op === 'loseHp' || (key === 'cinder-guard' && e.op === 'grantCardCharge'));
  const after = advanced.filter(e => !before.includes(e));
  const effects = [...before, primaryEffect, ...after];
  if (rank >= 4) effects.push(block(2, { oncePerTurn: 'grade-block' }));
  if (rank >= 5) effects.push(draw(1, { oncePerTurn: 'grade-draw' }));
  const magical = ['starseer', 'herald'].includes(family.classId);
  return { rank, actionCost: family.actionCosts[rank], manaCost: rank, effects, textTemplate: recipeText(effects),
    ...(family.primary === 'damage' ? { traits: { damageSchool: magical ? 'magic' : 'physical', exposureBuildupPerHit: magical ? (rank > 0 ? 5 : 1) : 0 } } : {}),
  };
}

export const progressionCards = cardFamilies.map(family => {
  const gradeProfiles = Array.from({ length: 6 }, (_, rank) => familyGrade(family, rank));
  const base = gradeProfiles[family.abilityRank];
  return {
    id: family.id, name: family.name, class: family.classId, rarity: family.rarity,
    cost: base.actionCost, manaCost: base.manaCost,
    type: family.primary === 'damage' ? 'attack' : 'skill',
    keywords: [], icon: family.primary === 'damage' ? '✦' : '◇',
    flavor: progressionCardLore[family.id.replace(/^progression-/, '')].join('\n\n'),
    abilityKind: ['starseer', 'herald'].includes(family.classId) ? 'spell' : 'maneuver',
    abilityRank: family.abilityRank, abilityFamily: family.id,
    effects: base.effects, textTemplate: base.textTemplate, gradeProfiles,
    ...base.traits,
  };
});

export const progressionCardUnlocks = cardFamilies.map(({ classId, level, id }) => ({ classId, level, kind: 'cards', ref: id }));
