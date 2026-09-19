// src/model/classTree.js — the class tree (plan phase 5b, proposal §6.2).
//
// A node is a property tag a class may pick as it levels; picking one adds
// it to `run.coreTags`, the class card's own tagging rows, and the class
// carrier mounts its rule in every fight after (engine/properties.js
// classCarrier). The tree is content/source/classTree.csv (class, node,
// tier); a tier opens at the class level balance.skill.class.tierAt names;
// a node's `requires` and `excludes` are its relation rows, read here as they
// are read at mount (a REQUIRES on a node not yet picked keeps the node out
// of the draft; a CONFLICTS_WITH with a picked node does too). Tier 3 nodes
// exclude one another by content rule (validate.js), so the top pick is the
// subclass, never a stack.

import { classSkillId, awardSkillXp, skillLevel } from './skills.js';

/** The tree rows of one class, in table order. */
export function classTreeRows(registries, classId) {
  return (Array.isArray(registries && registries.classTree) ? registries.classTree : [])
    .filter((row) => row && row.classId === classId)
    .map((row) => ({ classId: row.classId, nodeId: row.nodeId, tier: Number(row.tier) }));
}

/** The class level tier `tier` (1-based) opens at, from balance.skill.class.tierAt. */
export function tierOpensAt(registries, tier) {
  const at = ((((registries || {}).balance || {}).skill || {}).class || {}).tierAt;
  return Array.isArray(at) && Number.isInteger(at[tier - 1]) ? at[tier - 1] : Infinity;
}

function rule(registries, nodeId) {
  const rules = registries && registries.propertyRules;
  return rules && typeof rules.get === 'function' && rules.has(nodeId) ? rules.get(nodeId) : null;
}

/**
 * classDraftPool(registries, classId, coreTags, level) → the node ids a class
 * at `level` holding `coreTags` may draft, in table order: the tier open,
 * not yet picked, every REQUIRES picked, no CONFLICTS_WITH picked.
 */
export function classDraftPool(registries, classId, coreTags = [], level = 0) {
  const picked = new Set(coreTags || []);
  return classTreeRows(registries, classId)
    .filter((row) => level >= tierOpensAt(registries, row.tier) && !picked.has(row.nodeId))
    .filter((row) => {
      const r = rule(registries, row.nodeId);
      if (!r) return false;
      if ((r.requires || []).some((t) => !picked.has(t))) return false;
      if ((r.excludes || []).some((t) => picked.has(t))) return false;
      return true;
    })
    .map((row) => row.nodeId);
}

/**
 * pickClassNode(registries, run, nodeId) → true when the node joined
 * `run.coreTags`; false (and no write) when the node is not draftable now —
 * the reward door's one write to the core zone's tags.
 */
export function pickClassNode(registries, run, nodeId) {
  if (!run || !run.class) return false;
  const level = skillLevel(run, classSkillId(run.class));
  if (!classDraftPool(registries, run.class, run.coreTags || [], level).includes(nodeId)) return false;
  if (!Array.isArray(run.coreTags)) run.coreTags = [];
  run.coreTags.push(nodeId);
  return true;
}

/**
 * awardClassXp(registries, run, { victory, pool }) → the award, or null: the
 * class track's pay for a fight, made by the RUN'S OWNER (main.js,
 * tools/runsim.mjs, tools/session.mjs), who knows the door's pool — the
 * combat does not. A lost fight pays nothing; a boss pays `bossKill` on top
 * of `perWin`.
 */
export function awardClassXp(registries, run, { victory = false, pool = 'normal' } = {}) {
  if (!victory || !run || !run.class) return null;
  const xp = ((((registries || {}).balance || {}).skill || {}).class || {}).xp || {};
  const amount = (xp.perWin || 0) + (pool === 'boss' ? (xp.bossKill || 0) : 0);
  if (!(amount > 0)) return null;
  return awardSkillXp(registries, run, classSkillId(run.class), amount);
}

/** coreTagsProblems(coreTags) → the shape's refusals, registry-free, for the save door. */
export function coreTagsProblems(coreTags) {
  if (!Array.isArray(coreTags)) return ['coreTags must be an array of node ids'];
  const problems = [];
  const seen = new Set();
  coreTags.forEach((id, i) => {
    if (typeof id !== 'string' || !id) problems.push(`coreTags[${i}] must be a non-empty node id`);
    else if (seen.has(id)) problems.push(`coreTags[${i}] '${id}' is picked twice`);
    seen.add(id);
  });
  return problems;
}
