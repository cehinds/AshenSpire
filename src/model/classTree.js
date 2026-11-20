// src/model/classTree.js — the class tree rows, the class XP award and the core
// tag checks. The tree is content/source/classTree.csv (class, node, tier); a
// node is a property tag held in `run.coreTags`. The draft that used to offer
// nodes as a class levelled (classDraftPool, pickClassNode, tierOpensAt) is
// retired: Core grants class power through the Core 2 level policy, and a
// saved `coreTags` still loads and mounts.

import { classSkillId, awardSkillXp } from './skills.js';

/** The tree rows of one class, in table order. */
export function classTreeRows(registries, classId) {
  return (Array.isArray(registries && registries.classTree) ? registries.classTree : [])
    .filter((row) => row && row.classId === classId)
    .map((row) => ({ classId: row.classId, nodeId: row.nodeId, tier: Number(row.tier) }));
}

/**
 * awardClassXp(registries, run, { victory, pool }) → the award, or null: the
 * class track's pay for a fight, made by the RUN'S OWNER (main.js,
 * tools/runsim.mjs), who knows the door's pool — the
 * combat does not. A lost fight pays nothing; a boss pays `bossKill` on top
 * of `perWin`.
 */
export function awardClassXp(registries, run, { victory = false, pool = 'normal', multiplier = 1, queueRewards = true } = {}) {
  if (!victory || !run || !run.class || run.classUnequipped) return null;
  const xp = ((((registries || {}).balance || {}).skill || {}).class || {}).xp || {};
  const base = (xp.perWin || 0) + (pool === 'boss' ? (xp.bossKill || 0) : 0);
  const amount = Math.floor(base * multiplier);
  if (!(amount > 0)) return null;
  return awardSkillXp(registries, run, classSkillId(run.class), amount, { queueRewards });
}

/**
 * coreTagsTreeProblems(registries, classId, coreTags, path) → the refusals a
 * REGISTRY can make, for the load door: a pick that is ANOTHER class's node
 * is a tampered save, refused by name — the shape door (coreTagsProblems)
 * cannot know the trees. A pick no tree holds is not refused here: a content
 * update renamed or dropped it, and the door drops it with a ledger row
 * (staleCoreTags), as the skills ledger keeps a track no registry knows.
 */
export function coreTagsTreeProblems(registries, classId, coreTags, path = 'coreTags') {
  if (!Array.isArray(coreTags) || !coreTags.length) return [];
  const owner = new Map((Array.isArray(registries && registries.classTree) ? registries.classTree : []).map((row) => [row.nodeId, row.classId]));
  return coreTags
    .filter((id) => owner.has(id) && owner.get(id) !== classId)
    .map((id) => `${path} '${id}' is another class's node ('${owner.get(id)}')`);
}

/** staleCoreTags(registries, classId, coreTags) → the picks no tree holds, for the door to drop. */
export function staleCoreTags(registries, classId, coreTags) {
  if (!Array.isArray(coreTags)) return [];
  const tree = new Set(classTreeRows(registries, classId).map((row) => row.nodeId));
  return coreTags.filter((id) => !tree.has(id));
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
