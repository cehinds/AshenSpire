// Starting-kit discovery: one data table, one eligibility gate, one profile receipt.

import { classCreationConfig, resolveCreationHands } from './characterCreation.js';

export const PROGRESSION_MODES = Object.freeze(['normal', 'custom', 'debug', 'showcase']);
export const UNDISCOVERED_PRESENTATIONS = Object.freeze(['hidden', 'silhouette']);

function kits(registries) {
  return ((registries || {}).equipment || {}).startingKits || [];
}

function armament(registries, id) {
  return (((registries || {}).equipment || {}).armaments || []).find((row) => row.id === id) || null;
}

function slot(registries, id) {
  return (((registries || {}).equipment || {}).slots || []).find((row) => row.id === id) || null;
}

function fitsKitSlot(targetSlot, piece) {
  if (!targetSlot || !piece || !(targetSlot.kinds || []).includes(piece.kind)) return false;
  return !piece.hand || piece.hand === 'either' || piece.hand === targetSlot.hand;
}

export function startingKitPieceIds(kit) {
  return ['rightHand', 'leftHand'].map((key) => kit && kit[key]).filter(Boolean);
}

export function startingKitProblems(registries) {
  const problems = [];
  const rows = kits(registries);
  const ids = new Set();
  if (!Array.isArray(((registries || {}).equipment || {}).startingKits)) {
    return ['equipment.startingKits: missing required generated table'];
  }
  for (const row of rows) {
    if (!row || typeof row.id !== 'string' || !row.id) { problems.push('startingKits.csv: row missing id'); continue; }
    if (ids.has(row.id)) problems.push(`startingKits.csv: duplicate id '${row.id}'`);
    ids.add(row.id);
    if (!registries.classes.has(row.classId)) problems.push(`${row.id}: unknown class '${row.classId}'`);
    if (typeof row.label !== 'string' || !row.label) problems.push(`${row.id}: label must be non-empty`);
    if (typeof row.baseline !== 'boolean') problems.push(`${row.id}: baseline must be boolean`);
    for (const slotId of ['rightHand', 'leftHand']) {
      const pieceId = row[slotId];
      if (pieceId === '') continue;
      if (typeof pieceId !== 'string') { problems.push(`${row.id}.${slotId}: must be an armament id or blank`); continue; }
      const piece = armament(registries, pieceId);
      if (!piece) { problems.push(`${row.id}.${slotId}: unknown armament '${pieceId}'`); continue; }
      const targetSlot = slot(registries, slotId);
      if (!fitsKitSlot(targetSlot, piece)) problems.push(`${row.id}.${slotId}: '${pieceId}' does not fit ${slotId}`);
    }
    if (!row.rightHand && !row.leftHand) problems.push(`${row.id}: kit must author at least one hand`);
  }

  for (const classId of registries.classes.ids()) {
    const cls = registries.classes.get(classId);
    const eligible = cls.eligibleStartingKitIds;
    if (!Array.isArray(eligible) || !eligible.length) {
      problems.push(`class '${classId}' eligibleStartingKitIds must be non-empty`);
      continue;
    }
    if (new Set(eligible).size !== eligible.length) problems.push(`class '${classId}' eligibleStartingKitIds contains a duplicate`);
    const classRows = rows.filter((row) => row.classId === classId);
    const baseline = classRows.filter((row) => row.baseline === true);
    if (baseline.length !== 1) problems.push(`class '${classId}' has ${baseline.length} baseline starting kits; need exactly one`);
    for (const id of eligible) {
      const row = rows.find((entry) => entry.id === id);
      if (!row) problems.push(`class '${classId}' eligibleStartingKitIds names unknown kit '${id}'`);
      else if (row.classId !== classId) problems.push(`class '${classId}' eligible kit '${id}' belongs to class '${row.classId}'`);
    }
    for (const row of classRows) if (!eligible.includes(row.id)) problems.push(`${row.id}: kit is not listed by class '${classId}' eligibleStartingKitIds`);
    if (baseline[0] && !eligible.includes(baseline[0].id)) problems.push(`class '${classId}' baseline '${baseline[0].id}' is not eligible`);
  }

  for (const piece of ((registries || {}).equipment || {}).armaments || []) {
    if (!Number.isFinite(piece.dropWeight) || piece.dropWeight <= 0) {
      problems.push(`${piece.id}.dropWeight must be finite and > 0`);
    }
  }
  const policy = (((((registries || {}).balance || {}).equipment || {}).startingKitDiscovery) || {});
  if (!UNDISCOVERED_PRESENTATIONS.includes(policy.undiscoveredPresentation)) {
    problems.push(`startingKitDiscovery.undiscoveredPresentation must be ${UNDISCOVERED_PRESENTATIONS.join('|')}`);
  }
  if (!Number.isInteger(policy.receiptLimit) || policy.receiptLimit <= 0) {
    problems.push('startingKitDiscovery.receiptLimit must be a positive integer');
  }
  return problems;
}

export function kitIsDiscovered(kit, meta) {
  if (kit.baseline === true) return true;
  const found = new Set((meta && meta.discoveredArmaments) || []);
  return startingKitPieceIds(kit).every((id) => found.has(id));
}

export function startingKitViews(registries, classId, meta = {}) {
  const cls = registries.classes.get(classId);
  const allowed = new Set(cls.eligibleStartingKitIds || []);
  const policy = registries.balance.equipment.startingKitDiscovery.undiscoveredPresentation;
  const rows = kits(registries).filter((row) => row.classId === classId && allowed.has(row.id));
  return rows.flatMap((row) => {
    const available = kitIsDiscovered(row, meta);
    if (!available && policy === 'hidden') return [];
    if (!available) return [{ id: row.id, classId, baseline: false, available: false, silhouette: true }];
    return [{ ...row, available: true, pieceIds: startingKitPieceIds(row) }];
  });
}

export function resolveStartingKit(registries, classId, requestedId, meta = {}) {
  const cls = registries.classes.get(classId);
  const baseline = kits(registries).find((row) => row.classId === classId && row.baseline === true);
  const id = requestedId || (baseline && baseline.id);
  if (!id) throw new Error(`class '${classId}' has no baseline starting kit`);
  if (!(cls.eligibleStartingKitIds || []).includes(id)) throw new Error(`starting kit '${id}' is unavailable to class '${classId}'`);
  const row = kits(registries).find((entry) => entry.id === id);
  if (!row || row.classId !== classId) throw new Error(`starting kit '${id}' is unavailable to class '${classId}'`);
  if (!kitIsDiscovered(row, meta)) throw new Error(`starting kit '${id}' is not discovered`);
  return row;
}

export function startingKitSnapshot(kit) {
  return Object.freeze({
    id: kit.id,
    classId: kit.classId,
    rightHand: kit.rightHand || null,
    leftHand: kit.leftHand || null,
    ...(kit.customized ? { customized: true } : {}),
  });
}

/** Validate persisted identity, or stamp the one explicit v1 baseline migration. */
export function validateRunStartingKit(run, registries, meta = {}, { legacy = false } = {}) {
  if (legacy) {
    const baseline = resolveStartingKit(registries, run.class, undefined, {});
    run.startingKitId = baseline.id;
    run.startingKitSnapshot = startingKitSnapshot(baseline);
    return run;
  }
  if (typeof run.startingKitId !== 'string') throw new Error('run startingKitId is required');
  if (!run.startingKitSnapshot || typeof run.startingKitSnapshot !== 'object') throw new Error('run startingKitSnapshot is required');
  const row = resolveStartingKit(registries, run.class, run.startingKitId, meta);
  if (run.startingKitSnapshot.customized === true) {
    if (run.startingKitSnapshot.id !== row.id || run.startingKitSnapshot.classId !== row.classId) {
      throw new Error(`startingKitId '${run.startingKitId}' disagrees with customized startingKitSnapshot identity`);
    }
    const hands = resolveCreationHands(registries, run.class, run.startingKitSnapshot, row);
    if (hands.leftHand !== (run.startingKitSnapshot.leftHand || null)
      || hands.rightHand !== (run.startingKitSnapshot.rightHand || null)) {
      throw new Error(`startingKitId '${run.startingKitId}' has a malformed customized startingKitSnapshot`);
    }
    return run;
  }
  const expected = startingKitSnapshot(row);
  if (JSON.stringify(run.startingKitSnapshot) !== JSON.stringify(expected)) {
    throw new Error(`startingKitId '${run.startingKitId}' disagrees with persisted startingKitSnapshot`);
  }
  return run;
}

// ---------------------------------------------------------------------------
// Starting armour (E5 / #250) — the same discovery shape as kits, for the set
// you begin the climb wearing.
//
// STARTING-ELIGIBLE = the class's free set (unlock === '') PLUS any set whose
// unlock the profile has EARNED (meta.unlocked — the same ledger the Armoury
// reads via model/unlocks.js). No content edit widens this list: outfits.csv
// keeps its "exactly one free set per class" contract and loadout.js keeps the
// check that enforces it. What a player has won becomes a starting choice;
// what they have not stays a prize.
//
// WHY meta AND NOT A NEW TABLE: the kit chooser above already answers "what
// may this profile start with" from profile meta. Two eligibility ledgers for
// two rows of the same screen would be two deciders — the #24 class of defect.
// ---------------------------------------------------------------------------

function armourRows(registries, classId) {
  return (((registries || {}).equipment || {}).armour || []).filter((o) => o.classId === classId);
}

function armourIsStartingEligible(row, meta, registries, classId) {
  if (!row) return false;
  if (row.unlock === '') return true;
  if ((classCreationConfig(registries, classId).armourIds || []).includes(row.id)) return true;
  return new Set((meta && meta.unlocked) || []).has(row.unlock);
}

/** The sets this profile may begin in, authoring order, free set first-eligible. */
export function startingArmourViews(registries, classId, meta = {}) {
  return armourRows(registries, classId)
    .filter((row) => armourIsStartingEligible(row, meta, registries, classId))
    .map((row) => ({ id: row.id, label: row.name, blurb: row.blurb, free: row.unlock === '' }));
}

/**
 * The row the run starts wearing. `requestedId` absent → the class's free set,
 * which is exactly what createLoadout always chose — a caller that never heard
 * of this function gets yesterday's behaviour. A requested set that is not
 * this class's, or not earned, is refused BY NAME, never silently swapped:
 * a wrong-but-plausible fallback is the Law 0 clause 5 defect.
 */
export function resolveStartingArmour(registries, classId, requestedId, meta = {}) {
  const rows = armourRows(registries, classId);
  const free = rows.find((row) => row.unlock === '');
  if (!requestedId) {
    if (!free) throw new Error(`class '${classId}' has no free starting armour set`);
    return free;
  }
  const row = rows.find((entry) => entry.id === requestedId);
  if (!row) throw new Error(`starting armour '${requestedId}' is unavailable to class '${classId}'`);
  if (!armourIsStartingEligible(row, meta, registries, classId)) throw new Error(`starting armour '${requestedId}' is not unlocked`);
  return row;
}

export function recordArmamentDiscovery(meta, pieceId, {
  progressionMode = 'normal', source = 'unknown', runSeed = null, receiptLimit = 64,
} = {}) {
  if (!PROGRESSION_MODES.includes(progressionMode)) throw new Error(`unknown progressionMode '${progressionMode}'`);
  const current = meta && typeof meta === 'object' ? meta : {};
  const discovered = [...new Set(current.discoveredArmaments || [])];
  const receipts = [...(current.discoveryReceipts || [])];
  if (progressionMode !== 'normal' || discovered.includes(pieceId)) {
    return { meta: { ...current, discoveredArmaments: discovered, discoveryReceipts: receipts }, receipt: null };
  }
  const receipt = Object.freeze({
    kind: 'armamentDiscovery', pieceId, first: true, source,
    runSeed: runSeed == null ? null : String(runSeed), sequence: receipts.length + 1,
  });
  discovered.push(pieceId);
  receipts.push(receipt);
  const limit = Number.isInteger(receiptLimit) && receiptLimit > 0 ? receiptLimit : 64;
  return {
    meta: { ...current, discoveredArmaments: discovered, discoveryReceipts: receipts.slice(-limit) },
    receipt,
  };
}
