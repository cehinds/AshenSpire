// src/engine/skillXp.js — the skill tracks' XP hooks (plan phase 4a,
// proposal §6.1). ONE LISTENER ON THE EVENT BUS, no entity-specific code: it
// reads the tag registry (which item type the card's piece is), the
// framework's weight class (which armour track the wearer is in) and the grip
// (dual-wielding), and pays balance.skill.xp's rows into a receipt on the
// combat. The RUN is written once, when the fight is over, by whoever owns
// the run (main.js, tools/session.mjs, tools/runsim.mjs) through applySkillXp
// — combat never touches a run.
//
//   damageDealt / blockGained by a card a piece lent   → perHit to that piece's
//                                                        group; and to dualWield
//                                                        while the grip is dual
//   combatEnd, victory                                 → perWinEquipped per held
//                                                        group, × killMult for the
//                                                        group that landed the
//                                                        killing hit
//   impactDealt to the wearer (heavy: 1 per impactPerXp; medium: half)
//   attackEvaded by the wearer (light: evadeXp; medium: half)
//   arcaneExposureChanged by the caster (focus: 1 per buildupPerXp)
//   × the class card's `favored` leaning (skillXpMult) for the tracks the
//     card names (plan phase 5a)
//
// Receipts are kept per OWNER KEY ('player' solo; the seat id in co-op, the
// same key triggers.js gates on), so a party's hits do not pool.

import { equippedIn, slotHand, gripOf } from '../model/loadout.js';
import { ownerItemRef } from '../model/cardMounts.js';
import { playerWeightClass } from '../model/combatWeight.js';
import { awardSkillXp, armourSkillId, DUAL_WIELD_SKILL } from '../model/skills.js';

const FOCUS_ITEM_TYPE = 'item:magic-focus';

function xpRows(combat) {
  const skill = ((combat.registries || {}).balance || {}).skill;
  return skill && skill.xp ? skill.xp : null;
}

function ownerKeyOf(combat, entityId, playerId) {
  if (playerId) return playerId;
  if (entityId === 'player') return combat.playerKey || 'player';
  return null;
}

function receiptFor(combat, ownerKey) {
  combat.skillXp = combat.skillXp || {};
  return combat.skillXp[ownerKey] || (combat.skillXp[ownerKey] = { xp: {}, killGroup: null });
}

/**
 * favoredMult(combat, ownerKey, skillId) → the product of every mounted
 * `skillXpMult` passive whose carrier's own tags name the track (plan phase
 * 5a): the class card carries `favored` beside the item types it favours,
 * so a Reaver's blade XP is multiplied and its shield XP is not. Read off
 * the mount records' scopeTags — never unscoped, never a second table.
 */
function favoredMult(combat, ownerKey, skillId) {
  const mounts = combat.propertyMounts && combat.propertyMounts[ownerKey];
  let m = 1;
  if (!mounts) return m;
  for (const key of Object.keys(mounts).sort()) {
    const mount = mounts[key];
    if (!Array.isArray(mount.scopeTags) || !mount.scopeTags.includes(skillId)) continue;
    for (const rule of mount.rules || []) {
      const v = rule.passives && rule.passives.skillXpMult;
      if (typeof v === 'number') m *= v;
    }
  }
  return m;
}

function pay(receipt, skillId, amount, mult = 1) {
  if (!skillId || !(amount > 0)) return;
  receipt.xp[skillId] = (receipt.xp[skillId] || 0) + amount * mult;
}

/** The item type (group) of a held piece, or null. */
function groupOfPiece(piece) {
  if (!piece) return null;
  return (piece.itemTypeTags || []).find((tag) => tag !== 'item:armor') || null;
}

function pieceInHand(combat, hand, loadout = combat.loadout, classId = combat.player && combat.player.classId) {
  const slot = (((combat.registries || {}).equipment || {}).slots || []).find((row) => slotHand(row) === hand);
  if (!slot || !loadout) return null;
  return equippedIn(combat.registries, loadout, classId, slot.id);
}

/**
 * The group a card belongs to: the piece that lent it. `sourceHand` names the
 * hand (a weapon's attack or guard card); otherwise `grantedBy` names the
 * piece, in whichever spelling the loadout stamped it — the bare armament id
 * of a kit, package or weapon-art card, or the namespaced `armament/<id>` /
 * `armor/<class>/<id>` ref — normalised once by cardMounts.ownerItemRef. A
 * card no item lent (a run card, the empty hand's Dodge Roll) and a card an
 * armour piece lent (armour is no weapon group) have no group.
 */
function groupOfCard(combat, event) {
  if (event.sourceHand === 'right' || event.sourceHand === 'left') return groupOfPiece(pieceInHand(combat, event.sourceHand));
  const ref = ownerItemRef({ grantedBy: event.grantedBy });
  if (ref && ref.startsWith('armament/')) {
    const id = ref.slice('armament/'.length);
    const piece = (((combat.registries || {}).equipment || {}).armaments || []).find((a) => a.id === id);
    return groupOfPiece(piece);
  }
  return null;
}

/** The groups a pair of hands holds, deduplicated. */
function heldGroups(combat, loadout = combat.loadout, classId = combat.player && combat.player.classId) {
  const groups = [];
  for (const hand of ['right', 'left']) {
    const g = groupOfPiece(pieceInHand(combat, hand, loadout, classId));
    if (g && !groups.includes(g)) groups.push(g);
  }
  return groups;
}

function isDual(combat, loadout = combat.loadout, classId = combat.player && combat.player.classId) {
  return loadout ? gripOf(combat.registries, loadout, classId).mode === 'dual' : false;
}

/** Every seat's { ownerKey, loadout, classId }: one in solo, one per player in co-op. */
function seatsOf(combat) {
  if (combat.players instanceof Map) {
    return [...combat.players.entries()].map(([id, P]) => ({ ownerKey: id, loadout: P.loadout, classId: P.entity && P.entity.classId }));
  }
  return [{ ownerKey: combat.playerKey || 'player', loadout: combat.loadout, classId: combat.player && combat.player.classId }];
}

function weightClassId(combat) {
  try { return playerWeightClass(combat).weightClass.id; } catch { return null; }
}

/**
 * recordSkillXp(combat, event) — called by the bus after every event.
 */
export function recordSkillXp(combat, event) {
  const rows = xpRows(combat);
  if (!rows || !combat.player) return;
  switch (event.type) {
    case 'damageDealt': {
      const owner = ownerKeyOf(combat, event.sourceId, event.sourcePlayerId);
      if (!owner || event.targetId === 'player' || !(event.amount > 0)) return;
      const group = groupOfCard(combat, event);
      if (!group) return;
      const receipt = receiptFor(combat, owner);
      pay(receipt, group, rows.perHit, favoredMult(combat, owner, group));
      if (isDual(combat)) pay(receipt, DUAL_WIELD_SKILL, rows.perHit, favoredMult(combat, owner, DUAL_WIELD_SKILL));
      // damageDealt fires after HP is taken and before afterHpChange marks
      // the death, so the kill is read from the HP, not the flag.
      const target = (combat.enemies || []).find((e) => e.id === event.targetId);
      if (target && (target.hp <= 0 || !target.alive)) receipt.killGroup = group;
      return;
    }
    case 'blockGained': {
      // Paid to the seat that PLAYED the card (its hands lent it), which in
      // co-op may differ from the ally it guarded; an enemy's block pays no one.
      if (!ownerKeyOf(combat, event.targetId, event.targetPlayerId) || !(event.amount > 0)) return;
      const owner = event.sourcePlayerId || combat.playerKey || 'player';
      const group = groupOfCard(combat, event);
      if (!group) return;
      const receipt = receiptFor(combat, owner);
      pay(receipt, group, rows.perHit, favoredMult(combat, owner, group));
      if (isDual(combat)) pay(receipt, DUAL_WIELD_SKILL, rows.perHit, favoredMult(combat, owner, DUAL_WIELD_SKILL));
      return;
    }
    case 'impactDealt': {
      const owner = ownerKeyOf(combat, event.targetId, event.targetPlayerId);
      if (!owner || !(event.amount > 0)) return;
      const wc = weightClassId(combat);
      if (wc === 'heavy') pay(receiptFor(combat, owner), armourSkillId(wc), event.amount / rows.impactPerXp, favoredMult(combat, owner, armourSkillId(wc)));
      else if (wc === 'medium') pay(receiptFor(combat, owner), armourSkillId(wc), event.amount / rows.impactPerXp / 2, favoredMult(combat, owner, armourSkillId(wc)));
      return;
    }
    case 'attackEvaded': {
      const owner = ownerKeyOf(combat, event.targetId, event.targetPlayerId);
      if (!owner) return;
      const wc = weightClassId(combat);
      if (wc === 'light') pay(receiptFor(combat, owner), armourSkillId(wc), rows.evadeXp, favoredMult(combat, owner, armourSkillId(wc)));
      else if (wc === 'medium') pay(receiptFor(combat, owner), armourSkillId(wc), rows.evadeXp / 2, favoredMult(combat, owner, armourSkillId(wc)));
      return;
    }
    case 'arcaneExposureChanged': {
      const owner = ownerKeyOf(combat, event.sourceId, event.sourcePlayerId);
      if (!owner || !(event.amount > 0)) return;
      pay(receiptFor(combat, owner), FOCUS_ITEM_TYPE, event.amount / rows.buildupPerXp, favoredMult(combat, owner, FOCUS_ITEM_TYPE));
      return;
    }
    case 'combatEnd': {
      if (!event.victory) return;
      // Every seat is paid for the groups ITS hands hold — one seat in solo,
      // each player in co-op — and the killing group's bonus is the seat's own.
      for (const seat of seatsOf(combat)) {
        const receipt = receiptFor(combat, seat.ownerKey);
        for (const group of heldGroups(combat, seat.loadout, seat.classId)) {
          pay(receipt, group, rows.perWinEquipped * (receipt.killGroup === group ? rows.killMult : 1), favoredMult(combat, seat.ownerKey, group));
        }
        if (isDual(combat, seat.loadout, seat.classId)) pay(receipt, DUAL_WIELD_SKILL, rows.perWinEquipped, favoredMult(combat, seat.ownerKey, DUAL_WIELD_SKILL));
      }
      return;
    }
    default:
  }
}

/** Hook the bus: every emitted event is recorded after its triggers fired. */
export function attachSkillXp(combat) {
  const inner = combat.emit;
  combat.skillXp = combat.skillXp || {};
  combat.emit = (type, payload) => {
    const event = inner(type, payload);
    recordSkillXp(combat, event);
    return event;
  };
  return combat;
}

/**
 * skillXpReceipt(combat, ownerKey = 'player') → { [skillId]: integer XP }, the
 * fractional accumulations floored once, here, so a heavy wearer who absorbed
 * 9 impact at 5 per XP is paid 1, not 0 twice.
 */
export function skillXpReceipt(combat, ownerKey = 'player') {
  const receipt = combat && combat.skillXp && combat.skillXp[ownerKey];
  const out = {};
  if (!receipt) return out;
  for (const [id, amount] of Object.entries(receipt.xp)) {
    const whole = Math.floor(amount);
    if (whole > 0) out[id] = whole;
  }
  return out;
}

/** applySkillXp(registries, run, receipt) → the awards, one per track paid. */
export function applySkillXp(registries, run, receipt) {
  const awards = [];
  for (const [skillId, amount] of Object.entries(receipt || {})) {
    awards.push(awardSkillXp(registries, run, skillId, amount));
  }
  return awards;
}
