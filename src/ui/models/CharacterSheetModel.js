import { masteryUnlockName, registriesForClassMastery } from '../../model/classMasteryRun.js';
import { abilityRankAt, isAbilitySkill } from '../../model/abilityGrades.js';
import { classRewardBudget, expandedProgression } from '../../model/classMilestones.js';
// src/ui/models/CharacterSheetModel.js — the Character sheet's two ladders,
// read for a surface to draw: every character level, and every level of every
// skill track the run can climb, each row saying what that level grants.
//
// THIS MODULE READS, IT NEVER WRITES. Every number comes from the functions
// that pay the reward: the XP steps from levelup.js / skills.js `xpToNext`,
// the cadences from skills.js's own predicates (`levelQueuesRankUp`,
// `levelQueuesSkillFeat`, `levelQueuesAttributePick`) and balance.skill's
// rows, the pool growth from the run's own derived-stat snapshot at its own
// attributes, the deck floor from loadout.js `deckMinimum`. So the sheet
// cannot promise a reward the level door does not give: a balance edit moves
// both at once.
//
// A GRANT IS A RECORD, NOT A SENTENCE. `{ kind, ...facts }`; the renderer
// (ui/screens/characterSheet.js) words it through uiStrings rows, so the copy
// stays a spreadsheet edit.

import { characterLevel, levelOf, xpToNext as levelXpToNext } from '../../model/levelup.js';
import {
  classSkillId, levelQueuesAttributePick, levelQueuesRankUp, levelQueuesSkillFeat, linkedAttributes,
  rankUpKind, skillLevel, skillMaxLevel, skillTracks, trackSkillFeats, xpToNext as skillXpToNext,
} from '../../model/skills.js';
import { classTreeRows } from '../../model/classTree.js';
import { deriveStat } from '../../model/derivedStats.js';
import { deckMinimum } from '../../model/loadout.js';
import { orderedAttributes } from '../../model/attributes.js';

/** The derived pools a character level can move, in the order the sheet lists them. */
export const LEVEL_STATS = Object.freeze(['hp', 'stamina', 'mana', 'draw', 'handSize']);

/** The grants a skill ladder pays at (nearly) every level: a row with only these is not a milestone. */
export const EVERY_LEVEL_GRANTS = Object.freeze(['cardDraft', 'classNodeDraft', 'classFeat', 'classCard', 'rankUp', 'skillXp']);

/** Which level rewards are switched on (Settings → Advanced → Rewards); the shipped defaults. */
export const DEFAULT_LEVEL_OFFERS = Object.freeze({
  statPoints: true, feats: true, classTree: false, levelCards: false, pointsPerLevel: null,
});

const balanceOf = (registries) => (registries && registries.balance) || {};
const skillRows = (registries) => balanceOf(registries).skill || {};

// The public model also accepts the root registry. Read this character's saved
// rules even when its caller has not already projected a mastery registry.
export function characterSheetRegistries(registries, run) {
  const scoped = registriesForClassMastery(registries, run);
  return { ...scoped, progressionEnabled: expandedProgression(run),
    balance: { ...scoped.balance, ...(expandedProgression(run) && run.progressionRuleSnapshot
      ? { progression: run.progressionRuleSnapshot } : {}) } };
}

/** reached | current | next | locked — where a ladder row stands against the level held. */
export function rowState(rowLevel, held) {
  if (rowLevel < held) return 'reached';
  if (rowLevel === held) return 'current';
  if (rowLevel === held + 1) return 'next';
  return 'locked';
}

function poolValue(rules, statId, run, classDef, level) {
  try {
    const out = deriveStat(rules, statId, { attributes: run.attributes, classDef, level });
    return out && Number.isFinite(out.value) ? out.value : null;
  } catch {
    return null; // a snapshot without that row: the level does not move it
  }
}

/**
 * characterLadder(registries, run, offers) → { level, maxLevel, rows }, one
 * row per level 1..maxLevel: `{ level, stepXp, totalXp, state, grants }`.
 * Level 1 is where a run starts and grants nothing.
 */
export function characterLadder(registries, run, offers = DEFAULT_LEVEL_OFFERS) {
  const o = { ...DEFAULT_LEVEL_OFFERS, ...(offers || {}) };
  const authoredMax = (balanceOf(registries).levelUp || {}).maxLevels;
  const maxLevel = Number.isInteger(authoredMax) && authoredMax > 0 ? authoredMax : 20;
  const held = characterLevel(run);
  const authoredPoints = (balanceOf(registries).levelUp || {}).pointsPerLevel;
  const points = Number.isInteger(o.pointsPerLevel) && o.pointsPerLevel > 0 ? o.pointsPerLevel
    : Number.isInteger(authoredPoints) && authoredPoints > 0 ? authoredPoints : 1;
  const rules = run && run.derivedStatRuleSnapshot && run.derivedStatRuleSnapshot.rules;
  const classDef = rules && registries.classes && typeof registries.classes.get === 'function' ? registries.classes.get(run.class) : null;
  const floorAt = (level) => deckMinimum(registries, { level: { level } });
  const rows = [];
  let total = 0;
  for (let level = 1; level <= maxLevel; level += 1) {
    const stepXp = level === 1 ? 0 : levelXpToNext(registries, level - 1);
    total += stepXp;
    const grants = [];
    if (level > 1) {
      if (o.statPoints) grants.push({ kind: 'points', amount: points });
      if (rules) {
        for (const stat of LEVEL_STATS) {
          const before = poolValue(rules, stat, run, classDef, level - 1);
          const after = poolValue(rules, stat, run, classDef, level);
          if (before != null && after != null && after > before) grants.push({ kind: 'stat', stat, amount: after - before });
        }
      }
      const floor = floorAt(level);
      if (floor > floorAt(level - 1)) grants.push({ kind: 'deckMinimum', amount: floor });
      // One level choice (main.js rollLevelChoices): feats and class-tree
      // nodes share a single pick, and no class equipped offers no node.
      const nodes = o.classTree && !(run && run.classUnequipped);
      if (o.feats && nodes) grants.push({ kind: 'featOrNodeChoice' });
      else if (o.feats) grants.push({ kind: 'featChoice' });
      else if (nodes) grants.push({ kind: 'classNodeChoice' });
      if (o.levelCards) grants.push({ kind: 'levelCard' });
    }
    rows.push(Object.freeze({ level, stepXp, totalXp: total, state: rowState(level, held), grants: Object.freeze(grants) }));
  }
  const ledger = levelOf(run);
  return Object.freeze({
    level: held,
    maxLevel,
    xp: Number.isFinite(ledger.xp) && ledger.xp > 0 ? Math.floor(ledger.xp) : 0,
    rows: Object.freeze(rows),
  });
}

/** The class-tree tiers that open at `level` on `classId`'s track, with their nodes. */
function tiersOpeningAt(registries, classId, level) {
  const at = (skillRows(registries).class || {}).tierAt;
  if (!Array.isArray(at)) return [];
  const nodes = Array.isArray(registries.nodes) ? registries.nodes : [];
  const out = [];
  at.forEach((opensAt, index) => {
    if (opensAt !== level) return;
    const tier = index + 1;
    const names = classTreeRows(registries, classId).filter((row) => row.tier === tier)
      .map((row) => (nodes.find((n) => n && n.id === row.nodeId) || {}).label || row.nodeId);
    out.push({ kind: 'classTier', tier, nodes: Object.freeze(names) });
  });
  return out;
}

/**
 * trackLadder(registries, run, track) → { ...track, level, maxLevel, xp,
 * touched, rows }, one row per level 1..maxLevel: `{ level, stepXp, totalXp,
 * state, milestone, grants }`. `milestone` marks a level that grants more
 * than the every-level draft and rank-up.
 */
export function trackLadder(registries, run, track) {
  registries = characterSheetRegistries(registries, run);
  const expanded = expandedProgression(run);
  const ability = expanded && isAbilitySkill(track.id);
  const s = skillRows(registries);
  const maxLevel = skillMaxLevel(registries, track.kind) || 10;
  const held = skillLevel(run, track.id);
  const ledger = run && run.skills && run.skills[track.id];
  const xp = ledger && Number.isFinite(ledger.xp) && ledger.xp > 0 ? Math.floor(ledger.xp) : 0;
  const rankMax = Number.isInteger(s.rankMax) && s.rankMax > 0 ? s.rankMax : 1;
  const unlock = s.rarityUnlock || {};
  const attrLabels = new Map(orderedAttributes(registries).map((a) => [a.id, a.label]));
  const classId = track.kind === 'class' ? track.id.slice('class:'.length) : null;
  const rows = [];
  let total = 0;
  for (let level = 1; level <= maxLevel; level += 1) {
    const stepXp = ability && level === 1 ? 0 : skillXpToNext(registries, track.kind, level - 1);
    total += stepXp;
    const grants = [];
    if (track.kind === 'class') {
      grants.push({ kind: 'classNodeDraft' });
      if (run.classMasteryState) {
        const names = registries.classMastery.filter(row => row.classId === classId && row.level === level).map(row => masteryUnlockName(registries, row));
        if (names.length) grants.push({ kind: 'masteryUnlock', names });
      }
      // The class level's source bonuses (engine/sourceRewardBonuses.js):
      // a feat choice and a class-pool card, each at its authored chance.
      if (expanded) {
        const before = classRewardBudget(registries, level - 1), after = classRewardBudget(registries, level);
        for (const kind of Object.keys(after)) if (after[kind] > before[kind]) {
          grants.push({ kind: 'classMilestone', rewardKind: kind,
            ...(kind === 'attribute' ? { options: Object.freeze(linkedAttributes(registries, track.id).map(id => attrLabels.get(id) || id)) } : {}) });
        }
        const skills = skillTracks(registries);
        grants.push({ kind: 'skillXp', amount: registries.balance.progression.skillBonusXp,
          tracks: Object.freeze((registries.balance.progression.classSkills[classId] || []).map(id => skills.find(skill => skill.id === id)?.label || id)) });
      } else {
        const bonus = (balanceOf(registries).rewards || {}).sourceBonuses || {};
        if (bonus.classFeatChancePct > 0) grants.push({ kind: 'classFeat', pct: Math.min(100, bonus.classFeatChancePct) });
        if (bonus.classCardChancePct > 0) grants.push({ kind: 'classCard', pct: Math.min(100, bonus.classCardChancePct) });
      }
    } else grants.push({ kind: 'cardDraft', rank: ability ? abilityRankAt(registries, level) : Math.min(level, rankMax),
      ...(ability ? { ability: true, choices: registries.balance.progression.ability.draftSize } : {}) });
    if (track.kind !== 'class' && !ability) {
      for (const rarity of Object.keys(unlock)) {
        if (unlock[rarity] === level && level > 1) grants.push({ kind: 'rarity', rarity });
      }
    }
    if (!ability && levelQueuesRankUp(track.kind, level)) grants.push({ kind: 'rankUp' });
    if (classId) grants.push(...tiersOpeningAt(registries, classId, level));
    if (!(expanded && classId) && levelQueuesSkillFeat(registries, track.id, level)) {
      grants.push({ kind: 'feat', options: Object.freeze(trackSkillFeats(track.id, !!run.classMasteryState, registries).filter((f) => f.minLevel <= level).map((f) => f.name)) });
    }
    if (!(expanded && classId) && levelQueuesAttributePick(registries, track.id, level)) {
      grants.push({ kind: 'attribute', options: Object.freeze(linkedAttributes(registries, track.id).map((id) => attrLabels.get(id) || id)) });
    }
    const every = s.flatEvery;
    if (!ability && rankUpKind(track.kind) && Number.isInteger(every) && every > 0 && level % every === 0) {
      grants.push({ kind: 'flat', total: level / every });
    }
    const milestone = grants.some((g) => !EVERY_LEVEL_GRANTS.includes(g.kind));
    rows.push(Object.freeze({ level, stepXp, totalXp: total, state: rowState(level, held), milestone, grants: Object.freeze(grants.map(Object.freeze)) }));
  }
  return Object.freeze({
    id: track.id, kind: track.kind, label: track.label, expanded,
    level: held, maxLevel, xp, touched: held > 0 || xp > 0,
    rows: Object.freeze(rows),
  });
}

/**
 * characterSheetModel(registries, run, { offers }) → the whole sheet:
 * `{ character, tracks, ownTrackId }`. The tracks are every weapon, focus,
 * armour and dual-wield track plus the run's own class track (another class's
 * ladder is not this character's); the own class first, then the authored
 * order.
 */
export function characterSheetModel(registries, run, { offers = DEFAULT_LEVEL_OFFERS } = {}) {
  registries = characterSheetRegistries(registries, run);
  const classId = run && !run.classUnequipped && typeof run.class === 'string' ? run.class : '';
  const ownTrackId = classId ? classSkillId(classId) : null;
  const tracks = skillTracks(registries)
    .filter((t) => t.kind !== 'class' || t.id === ownTrackId)
    .sort((a, b) => (b.id === ownTrackId) - (a.id === ownTrackId))
    .map((t) => trackLadder(registries, run, t));
  return Object.freeze({
    character: characterLadder(registries, run, offers),
    tracks: Object.freeze(tracks),
    ownTrackId,
  });
}
