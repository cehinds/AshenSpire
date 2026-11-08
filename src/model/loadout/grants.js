// src/model/loadout/grants.js — card ownership: reconciling granted cards against what is equipped.
// A part of src/model/loadout.js (split from one file; behaviour unchanged).

import { gameModule, gameContent } from '../gameProfile.js';
import { isPoolDeckRun } from '../cardRemoval.js';
import {
  applyMountOverrides, extraMountInstances, itemMountEntries, mountKey, ownerItemRef,
} from '../cardMounts.js';
import { resolveUpgradedEquipment } from '../itemUpgrades.js';
import { splitAuthoredWeaponArts } from '../../framework/deck.js';
import { profileById } from './shape.js';
import { WeaponCardPackageModel, handSource } from './weaponPackages.js';
import { grantSourceFor, startingDeckSettings, boundGrantCardIds } from './grantSources.js';
import { equippedPieces } from './equipped.js';

//
// EVERY CARD IN THE DECK HAS AN OWNER: the run, or one item. Run-owned cards
// are the run's for good — base strikes and defends (an item only re-skins
// them), the class signature, global grants, rewards, and anything extracted
// at a smith. Item-owned cards RIDE WITH THE ITEM: equip it and they arrive,
// unequip it and they leave, equip it again and they are back, identical.
//
// One rule, three authoring sources feeding it — a package's `grantedCards`,
// its `weaponArtDefaults`, and the `bound` table (equipmentGrants.csv). Until
// the owner's ruling (2026-09-03) the third was the odd one out: its cards
// were minted as plain run-owned refs at creation and never looked at again,
// so they outlived the piece that promised them. Now all three are minted by
// desiredGrantInstances and swept by the reconciles below, keyed on the one
// predicate here rather than on a role list copied into each sweep.

/** The roles an item-owned instance may carry. */
export const ITEM_OWNED_ROLES = Object.freeze(['granted', 'weaponArt']);

/** True when the instance rides with an item rather than belonging to the run. */
export function isItemOwned(inst) {
  return Boolean(inst) && ITEM_OWNED_ROLES.includes(inst.equipmentRole);
}

/**
 * The namespaced ref of the piece — `armament/<id>` or `armor/<class>/<id>`,
 * the same spelling itemUpgrades and smithing already key on, so an owner
 * written on a card instance can be resolved by every model that speaks it.
 */
export function pieceItemRef(piece) {
  if (!piece || !piece.id) return null;
  return piece.kind === 'armor' ? `armor/${piece.classId}/${piece.id}` : `armament/${piece.id}`;
}

/** The inverse read: the item an instance rides with. Lives in cardMounts.js; re-exported so readers of this module find both halves together. */
export { ownerItemRef };

/** The tagFamilies.csv family a piece belongs to, from its kind. */
function pieceFamily(piece) {
  return piece && piece.kind === 'armor' ? 'armour' : 'armament';
}

/**
 * The instance a pile should hold for a wanted mount: the one it has, unless
 * the mount's CARD changed under the same key — a smith emptied it down to
 * its fallback, or seated another card — in which case the fresh instance
 * replaces it in place. Fresh, not patched: a stamped instance carries the
 * old card's carrier fields (`damageSchool`, `mods`), and stampDeck treats a
 * stamped non-equipment card as immutable, so patching `cardId` alone would
 * leave a Dodge Roll wearing Crimson Cleave's stamp.
 */
// The Dodge Roll's id named its owner hand until 2026-09-24
// (`weaponArt:unarmed:left:dodgeRoll`); a saved run or combat pile still
// holding that spelling is the same card under the owner-free id.
function currentInstanceId(inst) {
  const m = /^weaponArt:unarmed:(?:left|right|body):(.+)$/.exec(inst.instanceId || '');
  if (m) inst.instanceId = `weaponArt:unarmed:${m[1]}`;
  return inst.instanceId;
}

// The Dodge Roll changes owner — hand, body, or a smith-emptied art mount
// that falls back to it — without leaving the pile it is in. Before the sweep,
// an unwanted Dodge Roll takes the id of a wanted one no pile holds yet, so
// the sweep adopts it where it sits rather than dropping it and minting a
// copy into the discard.
function carryDodgeRoll(registries, piles, wanted) {
  const dodgeId = profileById(registries, ((registries.balance || {}).equipment || {}).unarmedProfiles?.technique)?.baseCardId;
  if (!dodgeId) return;
  const all = piles.flat();
  const held = new Set(all.map((inst) => inst && currentInstanceId(inst)));
  const open = [...wanted.values()].filter((d) => d.equipmentRole === 'weaponArt' && d.cardId === dodgeId && !held.has(d.instanceId));
  for (const inst of all) {
    if (!open.length) return;
    if (!isItemOwned(inst) || inst.equipmentRole !== 'weaponArt' || inst.cardId !== dodgeId || wanted.has(inst.instanceId)) continue;
    inst.instanceId = open.shift().instanceId;
  }
}

function adoptWanted(inst, wanted) {
  if (inst.cardId !== wanted.cardId || (inst.upgraded === true) !== (wanted.upgraded === true)) return wanted;
  // Older combat snapshots omitted ownership metadata. Adopt it without moving
  // the card out of its current pile or resetting its combat lifecycle.
  inst.grantedBy = wanted.grantedBy;
  inst.grantSource = wanted.grantSource;
  if (wanted.kitRole) { inst.kitRole = wanted.kitRole; inst.profileId = wanted.profileId; }
  return inst;
}

/**
 * THE DEALT DECK'S SHARE OF WHAT THE WORN EQUIPMENT LENDS (model/cardRemoval.js
 * isPoolDeckRun). A Sealed/Draft deck is never dealt the equipment's own
 * cards — kit basics, weapon arts, Dodge Roll, authored grants — but a card
 * the PLAYER seated in one of its mounts at the Blacksmith (a mount entry
 * naming a card: an art-mount override or a filled extra mount) is the
 * player's card riding on the item, and it stays, as it does in any run.
 */
function playerInstalledGrants(run, desired) {
  return desired.filter((d) => {
    const itemRef = ownerItemRef(d);
    const entry = itemRef ? itemMountEntries(run, itemRef)[d.instanceId] : null;
    return !!(entry && entry.card);
  });
}

/**
 * CORE'S EQUIPMENT-GRANT PATH (owner 2026-10-19). A configured-cards profile
 * ignores the legacy grant mechanisms; the one thing worn gear may still lend
 * is the card list its Core gear row authors (`gear[].grantedCards`, validated
 * by engine/kernel/gameConfig.js). Returns the profile subject (the run, or
 * the registries when combat hands in a synthetic run) or null.
 */
function configuredGearGrantSubject(registries, run) {
  const subject = run?.gameProfile ? run : registries;
  if (subject?.gameProfile?.foundation?.mode !== 'configured') return null;
  if (gameModule(subject, 'cards')?.mode !== 'configured') return null;
  return Array.isArray(gameContent(subject, 'gear')) || configuredWeaponArtsOn(subject) ? subject : null;
}

/**
 * CORE'S WEAPON ARTS (owner 2026-11-01, reversing the 2026-10-19 "arts stay off"). A configured
 * profile turns them on with the equipment module's `weaponArts` setting (the Core bundle sets
 * it). Only the arts: kits and the Dodge Roll stay off, and Core has no smith mounts to edit.
 */
function configuredWeaponArtsOn(subject) {
  return gameModule(subject, 'equipment')?.weaponArts === true;
}

/**
 * The worn weapons' default arts as item-owned instances, the same ids and shape a legacy weapon
 * art has. Two hands go through the framework split, so an art both author installs once. A
 * kit's art (`combatKit.artCardId`, the default art of most weapons) is still the weapon's art; the
 * kit's basic attack and guard cards are not minted.
 */
function configuredWeaponArtInstances(registries, run) {
  const subject = configuredGearGrantSubject(registries, run);
  if (!subject || !configuredWeaponArtsOn(subject) || !run.loadout) return [];
  const sources = { right: null, left: null };
  for (const hand of ['right', 'left']) {
    const source = handSource(registries, run.loadout, run.class, hand);
    if (source.package) sources[hand] = source;
  }
  const authored = (source) => source.package.weaponArtDefaults;
  const picks = sources.right && sources.left
    ? splitAuthoredWeaponArts(authored(sources.right), authored(sources.left))
    : ['right', 'left'].flatMap((hand) => (sources[hand] ? authored(sources[hand]).map((id) => ({ id, hand })) : []));
  const weaponSource = grantSourceFor(startingDeckSettings(registries), 'weapon');
  return picks.map((art) => weaponArtInstance(sources[art.hand].package.weaponId, art.id, weaponSource));
}

/** Everything the worn gear lends a configured profile: its authored grantedCards, then its weapon arts. */
function configuredGrantInstances(registries, run) {
  return [...configuredGearGrantInstances(registries, run), ...configuredWeaponArtInstances(registries, run)];
}

/** Item-owned instances the worn Core gear lends: same ids and shape as a weapon package grant. */
function configuredGearGrantInstances(registries, run) {
  const subject = configuredGearGrantSubject(registries, run);
  if (!subject || !run.loadout || !Array.isArray(gameContent(subject, 'gear'))) return [];
  const rows = gameContent(subject, 'gear').filter((row) => Array.isArray(row.grantedCards) && row.grantedCards.length);
  const copies = new Map();
  const out = [];
  for (const piece of equippedPieces(registries, run.loadout, run.class)) {
    const armor = piece.kind === 'armor';
    const row = rows.find((candidate) => (candidate.source?.id || candidate.id) === piece.id
      && (candidate.kind === 'armor') === armor
      && (!candidate.classes || candidate.classes.includes(run.class)));
    if (!row) continue;
    const owner = armor ? pieceItemRef(piece) : piece.id;
    const source = grantSourceFor(startingDeckSettings(registries), armor ? 'armor' : 'weapon');
    for (const grant of row.grantedCards) {
      const key = `${owner}:${grant.card}`;
      // Continue across repeated rows and both worn copies of an item. The
      // first copy retains its historical id, and every authored copy survives.
      const start = copies.get(key) || 0;
      copies.set(key, start + grant.copies);
      for (let i = start; i < start + grant.copies; i++) {
        out.push({
          instanceId: mountKey.granted(owner, grant.card, i),
          cardId: grant.card, upgraded: false, equipmentRole: 'granted', grantedBy: owner,
          grantSource: source,
        });
      }
    }
  }
  return out;
}

/** Sweep stale item-owned cards from the deck and sideboard, append the missing ones. In place. */
function reconcileConfiguredGearGrants(registries, run) {
  if (!run.deck) run.deck = [];
  const desired = configuredGrantInstances(registries, run);
  const wanted = new Map(desired.map((d) => [d.instanceId, d]));
  const present = new Set();
  if (Array.isArray(run.sideboard)) {
    run.sideboard = run.sideboard.filter((card) => {
      if (!isItemOwned(card)) return true;
      if (!wanted.has(card.instanceId) || present.has(card.instanceId)) return false;
      present.add(card.instanceId);
      return true;
    });
  }
  const kept = [];
  for (const inst of run.deck) {
    if (!isItemOwned(inst)) { kept.push(inst); continue; }
    const want = wanted.get(inst.instanceId);
    if (!want || present.has(inst.instanceId)) continue;
    present.add(inst.instanceId);
    kept.push(adoptWanted(inst, want));
  }
  run.deck.length = 0;
  run.deck.push(...kept);
  for (const d of desired) if (!present.has(d.instanceId)) run.deck.push(d);
  return run.deck;
}

export function reconcileGrantedCards(registries, run) {
  if (run.gameProfile?.foundation?.mode !== 'legacy' && run.gameProfile && (!gameModule(run, 'cards') || gameModule(run, 'cards')?.mode === 'configured')) {
    // A Core (configured-cards) deck is its authored list, except for the cards
    // the worn gear's data-driven grantedCards lend it (owner 2026-10-19).
    // Weapon arts ride the same path when the profile's equipment.weaponArts is on
    // (owner 2026-11-01); legacy weapon packages, kits and the Dodge Roll stay off.
    return configuredGearGrantSubject(registries, run) ? reconcileConfiguredGearGrants(registries, run) : undefined;
  }
  if (!run.deck) run.deck = [];
  // A dealt deck (Sealed, Draft) keeps only the cards the player installed in
  // the worn equipment's mounts; every other lent card is swept (an older
  // build may have left one) and none is appended.
  const poolDeck = isPoolDeckRun(run);
  const currentGrants = desiredGrantInstances(registries, run);
  const currentById = new Map(currentGrants.map((card) => [card.instanceId, card]));
  // A sideboard entry represents the mount, just like its deck counterpart.
  // Extraction/installation can replace the card under an unchanged mount id;
  // adopt that new content before the sideboard suppresses the mount's deal.
  // Unequipped sources keep their library entries, but smithing those carried
  // items must still refresh a set-aside mount (or remove a deleted extra mount).
  if (Array.isArray(run.sideboard)) {
    const mountsByOwner = new Map();
    run.sideboard = run.sideboard.flatMap((card) => {
      if (!isItemOwned(card)) return [card];
      let desired = currentById.get(currentInstanceId(card));
      const owner = ownerItemRef(card);
      if (!desired && owner && !card.kitRole) {
        if (!mountsByOwner.has(owner)) {
          const piece = resolveUpgradedEquipment(registries, owner, run.itemUpgradeLevels?.[owner] || 0);
          mountsByOwner.set(owner, itemMountInstances(registries, run, piece));
        }
        desired = mountsByOwner.get(owner).find((mount) => mount.instanceId === card.instanceId);
        if (!desired) return [];
      }
      return [desired ? adoptWanted(card, desired) : card];
    });
  }
  const heldAside = new Set((run.sideboard || []).map((card) => currentInstanceId(card)));
  const allDesired = currentGrants.filter((card) => !heldAside.has(card.instanceId));
  const desired = poolDeck ? playerInstalledGrants(run, allDesired) : allDesired;
  const wanted = new Map(desired.map((d) => [d.instanceId, d]));
  const present = new Set();
  // In place, not a reassignment: stampDeck captures its stamping list before
  // reconciling, so an appended instance must land in the SAME array to flow
  // through the carrier/mod stamping that follows.
  if (!poolDeck) carryDodgeRoll(registries, [run.deck], wanted);
  const kept = [];
  for (const inst of run.deck) {
    if (!isItemOwned(inst)) { kept.push(inst); continue; }
    const want = wanted.get(currentInstanceId(inst));
    if (!want) continue;
    present.add(inst.instanceId);
    kept.push(adoptWanted(inst, want));
  }
  run.deck.length = 0;
  run.deck.push(...kept);
  for (const d of desired) if (!present.has(d.instanceId)) run.deck.push(d);
  return run.deck;
}

/** A library grant is addable only while its exact mount still lends that card. */
export function isCurrentEquipmentGrant(registries, run, card) {
  return desiredGrantInstances(registries, run).some((desired) => desired.instanceId === card.instanceId && desired.cardId === card.cardId);
}

/**
 * EVERY item-owned instance the CURRENTLY worn equipment lends — the one list
 * both reconciles and the creation plan read, so "what does my gear give me"
 * has one answer. Bound-table cards first, for every worn piece; then package
 * grants, right hand then left (the contract model authors no dedup for them);
 * then weapon arts, which with both hands armed go through the framework's
 * splitAuthoredWeaponArts — quota split, unique preference RIGHT_THEN_LEFT —
 * so an art both weapons author installs once, attributed to the winning hand.
 */
export function desiredGrantInstances(registries, run) {
  if (configuredGearGrantSubject(registries, run)) return configuredGrantInstances(registries, run);
  // Stamped from the authored binding, not typed here — see grantSourceFor.
  const settings = startingDeckSettings(registries);
  const weaponSource = grantSourceFor(settings, 'weapon');
  let desired = [];

  // THE BOUND TABLE. Every worn piece carrying the `bound` tag lends the cards
  // equipmentGrants.csv names for it — armour as much as armaments, because
  // the tag is the gate and it does not care what kind of thing wears it.
  for (const piece of equippedPieces(registries, run.loadout, run.class, { itemUpgradeLevels: run.itemUpgradeLevels || {} })) {
    desired.push(...boundMountInstances(registries, settings, piece));
  }

  const sources = { right: null, left: null };
  for (const hand of ['right', 'left']) {
    const source = handSource(registries, run.loadout, run.class, hand);
    if (source.package) sources[hand] = source;
  }
  for (const hand of ['right', 'left']) {
    const source = sources[hand];
    if (!source) continue;
    desired.push(...packageGrantInstances(source.package, weaponSource));
  }
  const optionalArts = (source) => source.package.weaponArtDefaults.filter((id) => id !== source.package.combatKit?.artCardId);
  const arts = sources.right && sources.left
    ? splitAuthoredWeaponArts(optionalArts(sources.right), optionalArts(sources.left))
    : ['right', 'left'].flatMap((hand) => (sources[hand]
      ? optionalArts(sources[hand]).map((id) => ({ id, hand }))
      : []));
  for (const hand of ['right', 'left']) {
    const kit = sources[hand]?.package.combatKit;
    if (kit) arts.push({ id: kit.artCardId, hand });
  }
  for (const art of arts) {
    desired.push(weaponArtInstance(sources[art.hand].package.weaponId, art.id, weaponSource));
  }

  // WHAT A SMITH HAS DONE TO THOSE MOUNTS, applied before the empty-hand rule
  // below so an art mount emptied down to its Dodge Roll fallback counts as a
  // Dodge Roll already installed — one, not one per hand.
  desired = applyMountOverrides(registries, run, desired);
  // Guaranteed basics are item-owned, but are not extractable smith mounts.
  for (const hand of ['right', 'left']) {
    const source = sources[hand];
    const kit = source?.package.combatKit;
    if (!kit) continue;
    for (const role of ['attack', 'guard']) {
      const profile = profileById(registries, kit[`${role}ProfileId`]);
      desired.push({
        instanceId: `kit:${source.piece.id}:${role}`, cardId: profile.baseCardId,
        upgraded: false, equipmentRole: 'granted', kitRole: role, profileId: profile.id,
        grantedBy: source.piece.id, grantSource: weaponSource,
      });
    }
  }

  // EVERYONE HAS THE DODGE (the owner's rule, 2026-09-24, widening the
  // 2026-09-02 empty-hand rule): holding equipment never costs the Dodge Roll.
  // Exactly one rides in every composed deck. An empty hand still owns it
  // (`unarmed:<hand>`, right first), so filling that hand moves it rather than
  // removing it; with no empty hand — both armed, or a two-handed armament —
  // the body owns it (`unarmed:body`). An art mount already holding the Dodge
  // Roll (a smith's emptied mount falls back to it) counts: one, not two.
  const empty = ['right', 'left'].filter((hand) => !handSource(registries, run.loadout, run.class, hand).piece);
  const twoHanded = sources.right?.package?.handsRequired === 2 || sources.left?.package?.handsRequired === 2;
  const owner = twoHanded || !empty.length ? 'body' : empty[0];
  const profile = profileById(registries, ((registries.balance || {}).equipment || {}).unarmedProfiles?.technique);
  // A run saved while the unarmed technique slot still dealt the Dodge Roll
  // keeps that run-owned copy; it counts as the one only while both hands are
  // empty — the restamp that follows rebinds a technique slot to an armed
  // hand's technique, and then that copy is no longer a Dodge Roll.
  const legacyTechniqueDodge = empty.length === 2 && !twoHanded
    && (run.deck || []).some((c) => c && c.equipmentRole === 'technique' && c.cardId === profile?.baseCardId);
  const alreadyInstalled = profile && (
    desired.some((d) => d.equipmentRole === 'weaponArt' && d.cardId === profile.baseCardId)
    || legacyTechniqueDodge);
  if (profile && profile.baseCardId && !alreadyInstalled) {
    // One id whoever owns it, so a swap that moves it between a hand and the
    // body re-attributes the card in whatever pile it sits in instead of
    // dropping it and minting a fresh copy into the discard.
    desired.push({
      instanceId: `weaponArt:unarmed:${profile.baseCardId}`,
      cardId: profile.baseCardId, upgraded: false, equipmentRole: 'weaponArt', grantedBy: `unarmed:${owner}`,
      grantSource: weaponSource,
    });
  }

  // Exactly one: two emptied art mounts (both hands' Weapon Arts extracted)
  // each fall back to the Dodge Roll. The first — right hand before left, the
  // order the arts were composed in — owns it; the others lend nothing.
  if (profile && profile.baseCardId) {
    let seen = false;
    desired = desired.filter((d) => {
      if (d.equipmentRole !== 'weaponArt' || d.cardId !== profile.baseCardId) return true;
      if (seen) return false;
      seen = true;
      return true;
    });
  }

  // EXTRA MOUNTS a smith has filled on worn pieces (the rune seam).
  for (const piece of equippedPieces(registries, run.loadout, run.class, { itemUpgradeLevels: run.itemUpgradeLevels || {} })) {
    desired.push(...extraMountInstances(registries, run, pieceItemRef(piece), {
      grantSource: grantSourceFor(settings, pieceFamily(piece) === 'armour' ? 'armor' : 'weapon'),
    }));
  }
  return desired;
}

// ---- the three minters, one spelling each --------------------------------

/** The `bound` table's cards for one piece, as item-owned instances. Copies of the same card are numbered. */
function boundMountInstances(registries, settings, piece) {
  const family = pieceFamily(piece);
  const owner = pieceItemRef(piece);
  const copies = new Map();
  const out = [];
  for (const cardId of boundGrantCardIds(registries, piece, family)) {
    const i = copies.get(cardId) || 0;
    copies.set(cardId, i + 1);
    out.push({
      instanceId: mountKey.bound(owner, cardId, i),
      cardId, upgraded: false, equipmentRole: 'granted', grantedBy: owner,
      grantSource: grantSourceFor(settings, family === 'armour' ? 'armor' : 'weapon'),
    });
  }
  return out;
}

/** A package's grantedCards, as item-owned instances. */
function packageGrantInstances(pkg, weaponSource) {
  const out = [];
  for (const grant of pkg.grantedCards) {
    for (let i = 0; i < grant.count; i++) {
      out.push({
        instanceId: mountKey.granted(pkg.weaponId, grant.cardId, i),
        cardId: grant.cardId, upgraded: false, equipmentRole: 'granted', grantedBy: pkg.weaponId,
        grantSource: weaponSource,
      });
    }
  }
  return out;
}

/** One authored weapon art, as an item-owned instance. */
function weaponArtInstance(weaponId, artId, weaponSource) {
  return {
    instanceId: mountKey.weaponArt(weaponId, artId),
    cardId: artId, upgraded: false, equipmentRole: 'weaponArt', grantedBy: weaponId,
    grantSource: weaponSource,
  };
}

/**
 * itemMountInstances(registries, run, piece, { authored }) -> [instance]
 *
 * Everything ONE piece lends, whether or not it is equipped — the bound table,
 * the package's grants, ALL of its arts (the two-hand split that keeps a
 * shared art to one copy is a question about a pair, not about this piece)
 * and, unless `authored` is asked for, what a smith has done to those mounts
 * plus any extra mounts filled. The smith services enumerate an item's mounts
 * through this one door so a carried, unequipped sword can be worked on.
 */
export function itemMountInstances(registries, run, piece, { authored = false } = {}) {
  if (!piece) return [];
  const settings = startingDeckSettings(registries);
  const weaponSource = grantSourceFor(settings, 'weapon');
  const list = boundMountInstances(registries, settings, piece);
  const pkg = piece.kind === 'armor' ? null : WeaponCardPackageModel.fromPiece(registries, piece);
  if (pkg) {
    list.push(...packageGrantInstances(pkg, weaponSource));
    for (const artId of pkg.weaponArtDefaults) list.push(weaponArtInstance(pkg.weaponId, artId, weaponSource));
  }
  if (authored) return list;
  const itemRef = pieceItemRef(piece);
  return [
    ...applyMountOverrides(registries, run, list),
    ...extraMountInstances(registries, run, itemRef, {
      grantSource: grantSourceFor(settings, pieceFamily(piece) === 'armour' ? 'armor' : 'weapon'),
    }),
  ];
}

/**
 * The same reconcile at the ONE mid-fight door equipment moves through: the
 * combat piles are the deck while a fight is on, so a swap sweeps stale
 * granted/weaponArt instances out of every pile (hand included — an instance
 * whose armament left the hands leaves with it) and lands missing ones in the
 * discard pile, where the engine's addCard effect puts mid-combat additions.
 * Deterministic instance ids keep the sweep idempotent and combat-save-stable.
 */
export function reconcileGrantedCardsInCombat(registries, run, piles) {
  const configured = !!configuredGearGrantSubject(registries, run);
  // A dealt deck's fight is held to the same rule (model/cardRemoval.js,
  // playerInstalledGrants): only cards the player installed in the worn
  // equipment's mounts ride; any other lent card (one an older build's
  // mid-fight swap put into a pile) is swept, and none is appended.
  const poolDeck = isPoolDeckRun(run);
  // Combat's swap hands in a synthetic run with an empty deck; the piles are
  // the deck here, and the Dodge Roll rule reads the deck for a legacy copy.
  const deck = run.deck && run.deck.length ? run.deck : [...piles.hand, ...piles.draw, ...piles.discard, ...piles.exhaust];
  const heldAside = new Set(run.sideboardedEquipmentCardIds || (run.sideboard || []).map((card) => currentInstanceId(card)));
  const allDesired = desiredGrantInstances(registries, { ...run, deck }).filter((card) => !heldAside.has(card.instanceId));
  const desired = poolDeck ? playerInstalledGrants(run, allDesired) : allDesired;
  const wanted = new Map(desired.map((d) => [d.instanceId, d]));
  const present = new Set();
  if (!poolDeck) carryDodgeRoll(registries, [piles.hand, piles.draw, piles.discard, piles.exhaust], wanted);
  for (const pile of [piles.hand, piles.draw, piles.discard, piles.exhaust]) {
    const kept = [];
    for (const inst of pile) {
      if (!isItemOwned(inst)) { kept.push(inst); continue; }
      const want = wanted.get(currentInstanceId(inst));
      if (!want || (configured && present.has(inst.instanceId))) continue;
      present.add(inst.instanceId);
      kept.push(adoptWanted(inst, want));
    }
    pile.length = 0;
    pile.push(...kept);
  }
  for (const d of desired) if (!present.has(d.instanceId)) piles.discard.push(d);
}
