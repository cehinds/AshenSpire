// src/model/classSwap.js — the class swap (plan phase 5c, proposal §4).
//
// "Class swap ships in v1 as an event or boss drop, never a menu. Swapping
// replaces the core card, keeps weapon skills, resets class level to zero,
// and removes tags the new class does not permit." The run's `class` IS the
// core card (zones.core projects it), so the swap is one field written and
// its dependants pruned: the class tracks start over, the tree picks the new
// class has no seat for are dropped, the projection follows. The deck, the
// relics, the loadout, the attributes and the weapon skills are the run's
// and stay; the new class's kit is not dealt (the run was born once).

import { classTreeRows } from './classTree.js';
import { classSkillId } from './skills.js';
import { syncZones } from './state.js';

/**
 * swapRunClass(registries, run, classId) → { from, to, droppedTags,
 * resetTracks } — the receipt of what changed. Throws by name on an unknown
 * class; a swap to the run's own class is a no-op receipt.
 */
export function swapRunClass(registries, run, classId) {
  if (!registries.classes.has(classId)) throw new Error(`swapClass: unknown class '${classId}'`);
  const from = run.class;
  if (from === classId) return { from, to: classId, droppedTags: [], resetTracks: [] };
  const permitted = new Set(classTreeRows(registries, classId).map((row) => row.nodeId));
  const before = Array.isArray(run.coreTags) ? run.coreTags : [];
  const droppedTags = before.filter((id) => !permitted.has(id));
  run.coreTags = before.filter((id) => permitted.has(id));
  const resetTracks = Object.keys(run.skills || {}).filter((id) => id.startsWith('class:'));
  for (const id of resetTracks) delete run.skills[id];
  run.class = classId;
  if (Array.isArray(run.history)) {
    run.history.push({ kind: 'classSwapped', from, to: classId, actNumber: run.actNumber, floor: run.floor, mapNodeId: run.mapNodeId ?? null });
  }
  syncZones(run);
  return { from, to: classId, droppedTags, resetTracks };
}

/** The class track id the swap will reset, for readers that name it. */
export const swappedClassTrack = (classId) => classSkillId(classId);
