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
import { classSkillId, skillLevel } from './skills.js';
import { syncZones } from './state.js';
import { stampDeck } from './loadout.js';

/**
 * swapRunClass(registries, run, classId) → { from, to, fromLevel,
 * droppedTags, resetTracks, droppedArmour } — the receipt of what changed.
 * Throws by name on an unknown class; a swap to the run's own class is a
 * no-op receipt.
 *
 * Armour is a CLASS's (equipment.armour rows are keyed `classId, id`, and no
 * two classes share a set), so the sets the old class wore have no rows for
 * the new one: the run wears the new class's free set and the old ones are
 * set aside — named on the receipt and the history row, never silently
 * lost. Armaments are the run's and stay.
 */
export function swapRunClass(registries, run, classId) {
  if (!registries.classes.has(classId)) throw new Error(`swapClass: unknown class '${classId}'`);
  const from = run.class;
  const fromLevel = skillLevel(run, classSkillId(from));
  if (from === classId) return { from, to: classId, fromLevel, droppedTags: [], resetTracks: [], droppedArmour: [] };
  const permitted = new Set(classTreeRows(registries, classId).map((row) => row.nodeId));
  const before = Array.isArray(run.coreTags) ? run.coreTags : [];
  const droppedTags = before.filter((id) => !permitted.has(id));
  run.coreTags = before.filter((id) => permitted.has(id));
  const resetTracks = Object.keys(run.skills || {}).filter((id) => id.startsWith('class:'));
  for (const id of resetTracks) delete run.skills[id];
  const droppedArmour = [];
  const armour = ((registries.equipment || {}).armour) || [];
  const sets = run.loadout && run.loadout.sets;
  if (sets && Array.isArray(sets.armor)) {
    const free = armour.find((o) => o.classId === classId && o.unlock === '') || null;
    for (const id of sets.armor) if (id && !armour.some((o) => o.classId === classId && o.id === id)) droppedArmour.push(`armor/${from}/${id}`);
    sets.armor = sets.armor.map((id) => (id && armour.some((o) => o.classId === classId && o.id === id) ? id : null));
    if (free && !sets.armor.includes(free.id)) sets.armor[0] = free.id;
    if (run.loadout.active) run.loadout.active.armor = Math.max(0, sets.armor.findIndex((id) => !!id));
  }
  run.class = classId;
  // The armour changed hands, so the deck is restamped and the equipment
  // pools reconciled as the loadout screen does after any change (the review
  // of #1193): the old set's card rewrites and max-HP bonus leave with it.
  if (run.attributes && run.loadout) stampDeck(registries, run);
  if (Array.isArray(run.history)) {
    run.history.push({ kind: 'classSwapped', from, to: classId, fromLevel, droppedTags: [...droppedTags], droppedArmour: [...droppedArmour], actNumber: run.actNumber, floor: run.floor, mapNodeId: run.mapNodeId ?? null });
  }
  syncZones(run);
  return { from, to: classId, fromLevel, droppedTags, resetTracks, droppedArmour };
}

/**
 * peakClassLevel(run) → the highest class level the run reached, the live
 * tracks and every swap's `fromLevel` alike: a swap resets the track, and an
 * unlock earned before the mirror is still earned.
 */
export function peakClassLevel(run) {
  const live = Object.entries((run && run.skills) || {}).filter(([id]) => id.startsWith('class:')).map(([, row]) => (row && row.level) || 0);
  const swapped = ((run && run.history) || []).filter((h) => h && h.kind === 'classSwapped').map((h) => Number(h.fromLevel) || 0);
  return Math.max(0, ...live, ...swapped);
}

/** The class track id the swap will reset, for readers that name it. */
export const swappedClassTrack = (classId) => classSkillId(classId);
