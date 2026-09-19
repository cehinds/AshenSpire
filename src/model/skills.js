// src/model/skills.js — the skill ledger and its one curve (plan phase 4a,
// proposal §6.1). A track per weapon group, per armour weight class, one for
// the focus group, one for dual-wielding and one per class; every track
// climbs the same curve shape, so one simulator probe measures them all.
//
// THE TRACKS ARE DERIVED, NEVER LISTED: the weapon and focus tracks are the
// itemType nodes of the tree (content/source/nodes.csv), the armour tracks
// are the framework's weight classes (content/framework/mechanics.json), the
// class tracks are the class registry. Author a new item type or a class and
// its track exists; there is no second list to keep in step.
//
// THE NUMBERS ARE balance.skill's: base, growth and roundTo for the shape,
// the award sizes for the engine's hooks (engine/skillXp.js). Nothing here
// carries a number of its own.

import { mechanics } from '../framework/data/mechanics.js';

/** The kinds of track, and the balance row each reads its curve from. */
export const SKILL_KINDS = Object.freeze(['weapon', 'armour', 'focus', 'dual', 'class']);

const FOCUS_ITEM_TYPE = 'item:magic-focus';
const ARMOUR_ITEM_TYPE = 'item:armor';
export const DUAL_WIELD_SKILL = 'dualWield';

/** The armour track a weight class id names. */
export const armourSkillId = (weightClassId) => `armour:${weightClassId}`;
/** The class track a class id names. */
export const classSkillId = (classId) => `class:${classId}`;

/**
 * skillTracks(registries) → [{ id, kind, label }], in a stable order: the
 * weapon groups as the tree lists them, the focus group, the armour classes
 * light to heavy, dual-wield, then the classes.
 */
export function skillTracks(registries) {
  const nodes = Array.isArray(registries && registries.nodes) ? registries.nodes : [];
  const tracks = [];
  for (const node of nodes) {
    if (node.parentId !== 'itemType' || node.id === ARMOUR_ITEM_TYPE) continue;
    tracks.push({ id: node.id, kind: node.id === FOCUS_ITEM_TYPE ? 'focus' : 'weapon', label: node.label });
  }
  for (const cls of (mechanics.weight && mechanics.weight.classes) || []) {
    tracks.push({ id: armourSkillId(cls.id), kind: 'armour', label: `${cls.label || cls.id} armour` });
  }
  tracks.push({ id: DUAL_WIELD_SKILL, kind: 'dual', label: 'Dual-wield' });
  const classes = registries && registries.classes && typeof registries.classes.all === 'function' ? registries.classes.all() : [];
  for (const cls of classes) tracks.push({ id: classSkillId(cls.id), kind: 'class', label: cls.name || cls.id });
  return tracks;
}

/** The kind a track id belongs to, or null when no track has that id. */
export function skillKindOf(registries, skillId) {
  const track = skillTracks(registries).find((t) => t.id === skillId);
  return track ? track.kind : null;
}

function curveFor(registries, kind) {
  const skill = (((registries || {}).balance || {}).skill) || {};
  const row = kind === 'class' ? (skill.class && skill.class.xp) : skill.xp;
  if (!row) throw new Error(`balance.skill${kind === 'class' ? '.class' : ''}.xp is not authored — the ${kind} curve has no numbers`);
  return row;
}

/**
 * xpToNext(registries, kind, level) → the XP the step from `level` to
 * `level + 1` costs: round(base × growth^level, roundTo). One shape for every
 * track (proposal §10); the class curve reads balance.skill.class.xp, the
 * rest balance.skill.xp.
 */
export function xpToNext(registries, kind, level) {
  if (!SKILL_KINDS.includes(kind)) throw new Error(`xpToNext: '${kind}' is not a skill kind (${SKILL_KINDS.join(', ')})`);
  const { base, growth, roundTo } = curveFor(registries, kind);
  const step = Number.isInteger(level) && level > 0 ? level : 0;
  const raw = base * Math.pow(growth, step);
  const unit = Number.isInteger(roundTo) && roundTo > 0 ? roundTo : 1;
  return Math.max(unit, Math.round(raw / unit) * unit);
}

/** A fresh ledger: no track has been touched. */
export const emptySkills = () => ({});

/** The level a run holds in a track; 0 for a track it has never touched. */
export function skillLevel(run, skillId) {
  const row = run && run.skills && run.skills[skillId];
  return row && Number.isInteger(row.level) ? row.level : 0;
}

/**
 * awardSkillXp(registries, run, skillId, amount) → { skillId, before, after,
 * levelUps } — writes the ledger and climbs as many steps as the XP buys;
 * each step queues one draft (`pendingDrafts`, which phase 4b spends). A
 * non-positive or non-finite amount writes nothing.
 */
export function awardSkillXp(registries, run, skillId, amount) {
  const kind = skillKindOf(registries, skillId);
  if (!kind) throw new Error(`awardSkillXp: '${skillId}' is not a skill track`);
  if (!run.skills || typeof run.skills !== 'object') run.skills = emptySkills();
  const row = run.skills[skillId] || (run.skills[skillId] = { xp: 0, level: 0, pendingDrafts: 0 });
  const before = row.level;
  const gain = Number.isFinite(amount) ? Math.floor(amount) : 0;
  if (gain <= 0) return { skillId, before, after: before, levelUps: 0 };
  row.xp += gain;
  let cost = xpToNext(registries, kind, row.level);
  while (row.xp >= cost) {
    row.xp -= cost;
    row.level += 1;
    row.pendingDrafts += 1;
    cost = xpToNext(registries, kind, row.level);
  }
  return { skillId, before, after: row.level, levelUps: row.level - before };
}

/**
 * skillsProblems(skills) → the shape's refusals, by name. Registry-free, as
 * the save door must be: a track id the registries no longer know is a stale
 * ledger row, not a malformed one, and stays.
 */
export function skillsProblems(skills) {
  const problems = [];
  if (!skills || typeof skills !== 'object' || Array.isArray(skills)) return ['skills must be an object keyed by track id'];
  for (const [id, row] of Object.entries(skills)) {
    if (typeof id !== 'string' || !id) { problems.push('skills has a blank track id'); continue; }
    if (!row || typeof row !== 'object' || Array.isArray(row)) { problems.push(`skills.${id} must be { xp, level, pendingDrafts }`); continue; }
    for (const key of ['xp', 'level', 'pendingDrafts']) {
      if (!Number.isInteger(row[key]) || row[key] < 0) problems.push(`skills.${id}.${key} must be a non-negative integer`);
    }
    for (const key of Object.keys(row)) if (!['xp', 'level', 'pendingDrafts'].includes(key)) problems.push(`skills.${id}.${key} is not a ledger field`);
  }
  return problems;
}
