import { gameContent } from './gameProfile.js';
import { ratingIds } from './ratingFormula.js';
import { startingKitProblems } from './startingKits.js';
import { tagService } from './tagService.js';
import { DAMAGE_SCHOOLS } from './schemas.js';
import { parseMod, modEffectLines, modEffectLine } from './loadout/modStrings.js';
import {
  HANDS, EQUIPMENT_ROLES, armamentIntrinsicStatProblems, slotHand, pieceHand, fitsSlot,
  ARMAMENT_INTRINSIC_STAT_FIELDS,
} from './loadout/hands.js';
import {
  CARD_MOD_APPLIES, RUN_MOD_APPLIES, EQUIPMENT_POOL_FIELDS, moveEquipmentPool,
} from './loadout/applyVocab.js';
import {
  equipmentRequirementReceipt, startingHandsRequirementFailure, previewCompatibleHands,
  cardEquipmentCompatibility,
} from './loadout/requirements.js';
import {
  fromDropPool, ownership, OWNERSHIP_GATES, addToStorage, carriedIds,
} from './loadout/ownership.js';
import {
  SLOT_RUNG_KIND, slotRungs, openedSets, visibleSets, rungFor, setCellState,
} from './loadout/slotLadder.js';
import {
  WeaponCardPackageModel, isEquipmentComposedInstance, applyEquippedWeaponCardPlan,
} from './loadout/weaponPackages.js';
import { buildEquippedWeaponCardPlan, WeaponDeckCompositionService } from './loadout/weaponPlan.js';
import {
  startingDeckProblems, startingDeckWarnings, startingDeckRefs, orderStartingDeck,
} from './loadout/startingDeck.js';
import {
  startingDeckConfig, BOUND_GRANT_TAG, boundGrantProblems, boundGrantCardIds,
  sortBySourceOrder,
} from './loadout/grantSources.js';
import { equippedIn, equippedPieces, figureSpec, loadoutTags } from './loadout/equipped.js';
import { runMods, cardMods, reconcileRunLoadoutHp } from './loadout/cardMods.js';
import {
  createLoadout, createEquipmentProfileRuleSnapshot, restoreEquipmentProfileRuleSnapshot,
} from './loadout/shape.js';
import { equipmentRoleSource, equipmentKitPlan, equipmentKitReceipt } from './loadout/kit.js';
import {
  ITEM_OWNED_ROLES, isItemOwned, pieceItemRef, reconcileGrantedCards, isCurrentEquipmentGrant,
  itemMountInstances, reconcileGrantedCardsInCombat, ownerItemRef,
} from './loadout/grants.js';
import { startingDeckPlan } from './loadout/deckPlan.js';
import { applyCardMods } from './loadout/applyCardMods.js';
import { stampDeck } from './loadout/stampDeck.js';

// src/model/loadout.js — what you carry, and what it does to your cards.
// (Being split into src/model/loadout/*.js; the remainder is below.)


/**
 * validateEquipment(registries) → [] when sound, else human-readable problems.
 * Catches the mistakes CSV authoring actually makes: a misspelled field, a mod
 * aimed at a prefix no class maps to a card, a slot whose `kinds` gate matches
 * nothing, a hand named on one side and not the other, a piece no slot can
 * hold, and armour that leaves a class with no starting set (or two).
 */
/**
 * The same floor as validateContent: a door that answers questions about
 * content is structurally unable to throw on content. Named rules first; this
 * catches what no rule names yet, so a malformed field is a reported problem
 * rather than an exception before the banner can render.
 */
export function validateEquipment(registries) {
  // THE FLOOR ADDS, IT NEVER REPLACES. The accumulator is created HERE and
  // handed in, so a throw partway through keeps every field-addressed problem
  // found before it. Returning a fresh array from the catch — which is what
  // this did — turned a good diagnosis into a generic one: content that
  // correctly reported `grantedCards[0] must name cardId` came back saying only
  // "cannot read properties of null". A backstop that erases the answers it is
  // standing behind is worse than no backstop.
  const problems = [];
  try {
    return collectEquipmentProblems(registries, problems);
  } catch (error) {
    problems.push(`equipment validation could not finish reading this content: ${error && error.message} — a field is malformed in a way no rule names yet; any problems listed above were found before it, and the stack points at the field that threw`);
    return problems;
  }
}

function collectEquipmentProblems(registries, problems = []) {
  const eq = registries.equipment || {};
  const fields = eq.modFields || {};
  const pieces = [...(eq.armaments || []), ...(eq.armour || [])];
  const profilesPresent = Array.isArray(eq.basicCardProfiles);
  const profiles = eq.basicCardProfiles || [];
  const profileIds = new Set();
  const tags = tagService(registries);
  const attributeIds = new Set(registries.attributes && registries.attributes.ids ? registries.attributes.ids() : []);
  if (Array.isArray(eq.startingKits)) problems.push(...startingKitProblems(registries));

  for (const piece of eq.armaments || []) problems.push(...armamentIntrinsicStatProblems(piece));

  if (profilesPresent) {
    if (!Array.isArray(eq.equipmentRequirements)) problems.push('equipmentRequirements.csv: missing generated table');
    if (!Array.isArray(eq.cardEquipmentExceptions)) problems.push('cardEquipmentExceptions.csv: missing generated table');
    if (!Array.isArray(eq.cardTagging)) problems.push('cardTagging: missing the registered card-tag table (content/source/tagging.csv)');
  }
  const requirementKeys = new Set();
  for (const row of eq.equipmentRequirements || []) {
    const key = `${row.itemId}:${row.attributeId}`;
    if (requirementKeys.has(key)) problems.push(`equipmentRequirements.csv: duplicate '${key}'`);
    requirementKeys.add(key);
    if (!pieces.some((piece) => piece.id === row.itemId)) problems.push(`equipmentRequirements.csv: unknown item '${row.itemId}'`);
    if (!attributeIds.has(row.attributeId)) problems.push(`equipmentRequirements.csv: unknown attribute '${row.attributeId}'`);
    if (!Number.isInteger(row.minimum) || row.minimum < 0) problems.push(`${key}: minimum must be a non-negative integer`);
  }
  const exceptionKeys = new Set();
  for (const row of eq.cardEquipmentExceptions || []) {
    const key = `${row.cardId}:${row.weaponId}`;
    if (exceptionKeys.has(key)) problems.push(`cardEquipmentExceptions.csv: duplicate '${key}'`);
    exceptionKeys.add(key);
    if (!registries.cards.has(row.cardId)) problems.push(`cardEquipmentExceptions.csv: unknown card '${row.cardId}'`);
    if (!(eq.armaments || []).some((piece) => piece.id === row.weaponId)) problems.push(`cardEquipmentExceptions.csv: unknown weapon '${row.weaponId}'`);
  }
  for (const piece of pieces) {
    try { equipmentRequirementReceipt(registries, piece, {}); }
    catch (error) { problems.push(error.message); }
  }

  // A row may deliberately reuse an existing generic render instead of adding
  // binary art in the same feature. The reference is explicit and truthful:
  // every renderer-owned field must match the row whose asset is reused.
  const armamentById = new Map((eq.armaments || []).map((piece) => [piece.id, piece]));
  for (const piece of eq.armaments || []) {
    const artKey = piece.artKey || piece.id;
    const source = armamentById.get(artKey);
    if (!source) {
      problems.push(`${piece.id}: artKey '${artKey}' is not a registered armament render`);
      continue;
    }
    if (artKey === piece.id) continue;
    for (const field of ['geom', 'scale', 'metal', 'accent']) {
      if (String(piece[field]) !== String(source[field])) {
        problems.push(`${piece.id}: ${field} '${piece[field]}' disagrees with artKey '${artKey}' field '${source[field]}'`);
      }
    }
  }

  for (const profile of profiles) {
    if (profileIds.has(profile.id)) problems.push(`basicCardProfiles.csv: duplicate profile id '${profile.id}'`);
    profileIds.add(profile.id);
    if (!EQUIPMENT_ROLES.includes(profile.role)) problems.push(`${profile.id}: unknown equipment role '${profile.role}'`);
    if (!registries.cards.has(profile.baseCardId)) problems.push(`${profile.id}: unknown base card '${profile.baseCardId}'`);
    if (!DAMAGE_SCHOOLS.includes(profile.damageSchool)) problems.push(`${profile.id}: unknown damage school '${profile.damageSchool}'`);
    if (!Number.isFinite(profile.baseValue) || profile.baseValue < 0) problems.push(`${profile.id}: baseValue must be finite and non-negative`);
    if (!ratingIds.includes(profile.ratingId)) problems.push(`${profile.id}: unknown ratingId '${profile.ratingId}'`);
    if (profile.cap !== '' && profile.cap != null && (!Number.isFinite(profile.cap) || profile.cap < 0)) problems.push(`${profile.id}: cap must be blank or a finite non-negative number`);
    if (profile.magicShare !== '' && profile.magicShare != null && (!Number.isFinite(profile.magicShare) || profile.magicShare < 0 || profile.magicShare > 1)) problems.push(`${profile.id}: magicShare must be blank or a number from 0 to 1`);
    if (profile.compatibility !== `${profile.role}-v1`) problems.push(`${profile.id}: compatibility '${profile.compatibility}' must match role vocabulary '${profile.role}-v1'`);
    // The service owns what a family may carry, so this reads the same rule
    // the boot door reads rather than a second copy of it.
    for (const tag of profile.tags || []) {
      try { tags.assertLegal('basicCardProfile', tag); }
      catch (e) { problems.push(`${profile.id}: ${e.message}`); }
    }
    for (const raw of profile.mods || []) if (!parseMod(`${profile.role}.${raw}`)) problems.push(`${profile.id}: unparseable profile mod '${raw}'`);
  }

  for (const piece of profilesPresent ? (eq.armaments || []) : []) {
    for (const role of EQUIPMENT_ROLES) {
      const profileId = piece[`${role}Profile`];
      if (!profileId) continue;
      const profile = profiles.find((p) => p.id === profileId);
      if (!profile) problems.push(`${piece.id}: unknown ${role} profile '${profileId}'`);
      else if (profile.role !== role) problems.push(`${piece.id}: ${role}Profile '${profileId}' has wrong role '${profile.role}'`);
    }
    try { WeaponCardPackageModel.fromPiece(registries, piece); }
    catch (error) { problems.push(error.message); }
  }

  for (const piece of pieces) {
    for (const raw of piece.mods || []) {
      const mod = parseMod(raw);
      if (!mod) {
        problems.push(`${piece.id}: unparseable mod '${raw}'`);
        continue;
      }
      const spec = fields[mod.field];
      if (!spec) {
        problems.push(`${piece.id}: unknown mod field '${mod.field}' (register it in equipMods.csv)`);
        continue;
      }
      if (spec.scope === 'run' && mod.prefix !== 'self') {
        problems.push(`${piece.id}: '${mod.field}' is a run mod and must be written as 'self.${mod.field}'`);
      }
      if (spec.scope === 'card' && !(eq.cardTargets || []).includes(mod.prefix)) {
        problems.push(`${piece.id}: '${mod.prefix}' is not a card target (add it to equipTargets.csv)`);
      }
      if (spec.status && !registries.statuses.has(spec.status)) {
        problems.push(`equipMods.csv: field '${mod.field}' names unknown status '${spec.status}'`);
      }
    }
  }

  // ---- the `apply` vocabulary, which nothing checked until A8 --------------
  // equipMods.csv's header calls `apply` a closed set; `cardMods`, `runMods`
  // and `applyCardMods` are the three functions that branch on it, and until
  // now a row naming a fourth value passed every check and did NOTHING. Legal
  // input, no output, no complaint — Law 0 clause 5's dangerous half. The lists
  // live beside those consumers (CARD_MOD_APPLIES / RUN_MOD_APPLIES).
  for (const [field, spec] of Object.entries(fields)) {
    const legal = spec.scope === 'run' ? RUN_MOD_APPLIES : spec.scope === 'card' ? CARD_MOD_APPLIES : null;
    if (!legal) {
      problems.push(`equipMods.csv: field '${field}' has scope '${spec.scope}' — expected 'card' or 'run'`);
      continue;
    }
    if (!legal.includes(spec.apply)) {
      problems.push(
        `equipMods.csv: field '${field}' applies '${spec.apply}', which no ${spec.scope} consumer handles `
        + `— it would collect nothing and change nothing. Legal for scope '${spec.scope}': ${legal.join(', ')}`
      );
    }
  }

  // ABSENT IS NOT ZERO — this file's own rule, applied to itself. The partial
  // registries the tests build carry no `balance`, and telling one of them its
  // swap cost is malformed would be the checker inventing a defect out of not
  // being able to look. No balance block, nothing to say.
  const eqBal = ((registries.balance || {}).equipment) || null;
  if (eqBal) validateEquipmentBalance(pieces, eqBal, problems);

  for (const slot of eq.slots || []) {
    if (slot.kinds.length === 0) problems.push(`slot '${slot.id}' gates on no kinds`);
  }

  // ---- hands: the slot owns the location, the piece owns the eligibility ---
  // Both vocabularies are closed, and a value outside one names its own row.
  for (const slot of eq.slots || []) {
    const h = slot.hand;
    if (h != null && h !== '' && !HANDS.includes(h)) {
      problems.push(`slot '${slot.id}': hand '${h}' is not one of ${HANDS.join('|')} (or empty for a slot that is not a hand)`);
    }
  }
  for (const piece of pieces) {
    const h = piece.hand;
    if (h != null && h !== '' && h !== 'either' && !HANDS.includes(h)) {
      problems.push(`${piece.id}: hand '${h}' is not one of ${HANDS.join('|')}|either`);
    }
  }
  // A carried hand slot must name its location even when every shipped piece
  // is side-neutral. Without this, a slot authored with an empty `hand` takes
  // an armament and draws it nowhere — wrong, reasonable-looking, and silent.
  for (const slot of eq.slots || []) {
    if (slotHand(slot)) continue;
    const held = pieces.filter((p) => (slot.kinds || []).includes(p.kind));
    const handed = held.filter((p) => pieceHand(p));
    if ((slot.storage && held.length) || handed.length) {
      problems.push(
        `slot '${slot.id}' accepts ${held.length} held piece(s) (e.g. '${held[0].id}') ` +
        `but names no hand itself — set hand=${HANDS.join('|')} on that row in equipSlots.csv`
      );
    }
  }
  // Every piece has somewhere to go — kind AND hand. This replaces the old
  // kind-only check, which passed a left-handed staff no slot could ever hold.
  for (const piece of pieces) {
    if (!(eq.slots || []).some((s) => fitsSlot(s, piece))) {
      problems.push(`no slot can hold '${piece.id}' (kind '${piece.kind}', hand '${piece.hand || '—'}')`);
    }
  }
  // …and the other edge: a slot whose kinds match pieces, every one of which
  // names the other hand, is a square the player can open onto an empty list.
  // A slot matching NO piece by kind is a slot authored ahead of its content
  // (talismans today) and is not this defect.
  for (const slot of eq.slots || []) {
    const byKind = pieces.filter((p) => (slot.kinds || []).includes(p.kind));
    if (byKind.length && !byKind.some((p) => fitsSlot(slot, p))) {
      problems.push(
        `slot '${slot.id}' can hold nothing: ${byKind.length} piece(s) match kinds ` +
        `'${(slot.kinds || []).join('|')}' and every one of them names the other hand`
      );
    }
  }

  for (const classId of registries.classes.ids()) {
    const sets = (eq.armour || []).filter((o) => o.classId === classId);
    const starting = sets.filter((o) => o.unlock === '' && !o.sharedSet);
    if (starting.length !== 1) {
      problems.push(`class '${classId}' has ${starting.length} starting armour sets (need exactly 1)`);
    }
  }
  // The ladder's one join, and it dangles the way every join dangles: a rung
  // naming a slot that is not there. Law 1 clause 5 — fail loud, name the
  // entry, and print what the author could have meant. `registries.unlocks` is
  // absent in the partial-registry call sites (tests), and an absent table is
  // "no rungs", not a defect.
  for (const u of registries.unlocks || []) {
    if (u.kind !== SLOT_RUNG_KIND) continue;
    if (!(eq.slots || []).some((s) => s.id === u.ref)) {
      problems.push(
        `unlocks.csv row '${u.id}' is a ${SLOT_RUNG_KIND} rung whose ref '${u.ref}' is not a slot — `
        + `equipSlots.csv has ${(eq.slots || []).map((s) => `'${s.id}'`).join(', ') || '(none)'}`
      );
    }
  }
  // THE LADDER'S JOIN, CHECKED IN BOTH DIRECTIONS — and the second direction is
  // Vira's finding at gate. The first draft only asked whether there were too
  // MANY rungs; too FEW is the silent one, and it is exactly Law 0 clause 5:
  // `talisman` declares 3 sets, authors 0 rungs, derives 1 forever, and every
  // instrument stays green while two thirds of a declared slot are unreachable.
  // Nothing wrong is printed because nothing wrong happens — the screen simply
  // never draws them. That is a generated result that is wrong but reasonable.
  //
  // THE CARVE-OUT IS THE FILE'S OWN, NOT A NEW ONE: a slot matching no piece by
  // kind is authored ahead of its content (talismans today) and is not this
  // defect — the same sentence the empty-slot check above already makes. So this
  // fires the day a talisman row exists, which is the day the gap becomes real.
  for (const slot of eq.slots || []) {
    const rungs = slotRungs(registries, slot.id);
    const cap = Math.max(1, Number(slot.sets) || 1);
    if (1 + rungs.length > cap) {
      problems.push(
        `slot '${slot.id}' carries ${cap} set(s) but unlocks.csv authors ${rungs.length} rung(s) for it `
        + `(${rungs.map((r) => `'${r.id}'`).join(', ')}) — a rung past the last set can never be climbed to; `
        + `raise \`sets\` on that row in equipSlots.csv or drop a rung`
      );
    }
    // AND IT ONLY FIRES WHEN THE TABLE IS THERE TO BE READ. `slotRungs` treats a
    // missing `registries.unlocks` as "no rungs", which is safe for the
    // too-MANY direction (zero can never exceed a cap) and is a lie in this one:
    // a partial registry would be told every multi-set slot is unreachable, when
    // the truth is that this check has nothing to check against. **Absent is not
    // zero.** A run that cannot know says nothing rather than something false.
    const knowable = Array.isArray((registries || {}).unlocks);
    if (knowable && 1 + rungs.length < cap && pieces.some((p) => (slot.kinds || []).includes(p.kind))) {
      problems.push(
        `slot '${slot.id}' declares ${cap} sets but only ${1 + rungs.length} can ever open `
        + `(1 free + ${rungs.length} rung(s) in unlocks.csv) — the other `
        + `${cap - 1 - rungs.length} would never be reachable; add a rung with `
        + `kind='${SLOT_RUNG_KIND}' ref='${slot.id}' or lower \`sets\` in equipSlots.csv`
      );
    }
  }

  if (eqBal) {
    const roleCopies = eqBal.roleCopies || {};
    // roleCopies is the LEGACY distribution, and the hand-kept sum is exactly
    // the coupling the composed deck exists to remove: with the composed path
    // live, raising startingDeckSize to 12 produces a valid twelve-card plan
    // and these dormant counts would still reject it for summing to ten.
    // They are rules only while they are the ones being read.
    if (!startingDeckConfig(registries)) {
      const total = [...EQUIPMENT_ROLES, 'signature', 'ability'].reduce((sum, role) => sum + (Number(roleCopies[role]) || 0), 0);
      if (total !== registries.balance.startingDeckSize) {
        problems.push(`balance.equipment.roleCopies sum ${total}; startingDeckSize is ${registries.balance.startingDeckSize}`);
      }
      if (roleCopies.signature !== 1) problems.push('balance.equipment.roleCopies.signature must be exactly 1');
      if (roleCopies.ability !== undefined && roleCopies.ability !== 1) problems.push('balance.equipment.roleCopies.ability must be exactly 1 when present');
    }
    problems.push(...startingDeckProblems(registries));
    for (const role of EQUIPMENT_ROLES) {
      const sources = (eqBal.roleSources || {})[role];
      if (!Array.isArray(sources) || !sources.length) { problems.push(`roleSources.${role} must be non-empty`); continue; }
      const seenSlots = new Set();
      for (const source of sources) {
        if (!(eq.slots || []).some((s) => s.id === source.slot)) problems.push(`roleSources.${role} names unknown slot '${source.slot}'`);
        if (seenSlots.has(source.slot)) problems.push(`roleSources.${role} duplicates slot '${source.slot}' at equal precedence`);
        seenSlots.add(source.slot);
      }
      const fallback = (eqBal.unarmedProfiles || {})[role];
      const profile = profiles.find((p) => p.id === fallback);
      if (!profile || profile.role !== role) problems.push(`unarmedProfiles.${role} '${fallback}' does not resolve to a ${role} profile`);
    }
  }
  return problems;
}


/**
 * The `balance.equipment` half of the equipment check (Viki, A8/A7).
 *
 * Separate only because its input is separate: everything above validates what
 * an AUTHOR wrote in a spreadsheet, and this validates what a TUNER wrote in
 * balance.js. Both are data and both fail loud by name; a partial registry has
 * the first and not the second, and the caller says so rather than guessing.
 */
function validateEquipmentBalance(pieces, eqBal, problems) {
  // ---- A FEW BASIC WEAPONS FOR ALL (A7) ------------------------------------
  // `basicTag` is the one word behind *"maybe a few basic weapons become
  // available for all"*, and each refusal below exists because the failure it
  // catches is SILENT: the shelf looks exactly the way it looked before, and
  // nobody can tell a setting that is off from one that is broken.
  const basicTag = eqBal.basicTag;
  if (basicTag != null && basicTag !== '') {
    if (typeof basicTag !== 'string') {
      problems.push(`balance.equipment.basicTag must be a tag id string or '' — got ${JSON.stringify(basicTag)}`);
    } else {
      const carriers = pieces.filter((p) => (p.tags || []).includes(basicTag));
      if (!carriers.length) {
        problems.push(
          `balance.equipment.basicTag is '${basicTag}' and no armament carries that tag — `
          + `the universal shelf would be empty and say nothing. Tag a row in weapons.csv or set basicTag to ''`
        );
      }
      for (const p of carriers) {
        // `basic` answers the FOUND gate; an unlock is the EARNED gate. A row
        // wearing both is an author saying two opposite things, and the one
        // that would win is an implementation detail of `ownership()`.
        if (p.unlock !== '' && p.unlock != null) {
          problems.push(
            `'${p.id}' is tagged '${basicTag}' (everybody's) AND has unlock '${p.unlock}' (earned) — `
            + `pick one: drop the tag, or clear the unlock`
          );
        }
        // Armour never enters the drop pool, so `basic` has no gate to answer
        // on it and would sit there looking meaningful.
        if (!fromDropPool(p)) {
          problems.push(
            `'${p.id}' is tagged '${basicTag}' but its kind '${p.kind}' never drops, so the tag can never do `
            + `anything — '${basicTag}' answers the found gate only`
          );
        }
      }
    }
  }

  // ---- THE SWAP-COST CHAIN (A8) --------------------------------------------
  // Three rules he can try, so three ways to author one that quietly charges
  // the default forever. Each of these names the row.
  const rules = eqBal.swapCostRules;
  if (rules != null) {
    if (!Array.isArray(rules) || !rules.length) {
      problems.push('balance.equipment.swapCostRules must be a non-empty array of rule rows');
    } else {
      const seen = new Set();
      for (const r of rules) {
        const at = `swapCostRules row '${(r && r.id) || '(no id)'}'`;
        if (!r || typeof r.id !== 'string' || !r.id) { problems.push(`${at}: every rule row needs an id`); continue; }
        if (seen.has(r.id)) problems.push(`${at}: duplicate rule id — the later row is unreachable`);
        seen.add(r.id);
        if (!SWAP_COST_BASES.includes(r.base)) {
          problems.push(`${at}: base '${r.base}' is not one of ${SWAP_COST_BASES.join('|')}`);
        }
        if (typeof r.gear !== 'boolean') {
          problems.push(`${at}: gear must be true or false — got ${JSON.stringify(r.gear)}`);
        }
      }
      if (!seen.has(eqBal.swapCostRule)) {
        problems.push(
          `balance.equipment.swapCostRule is '${eqBal.swapCostRule}', which is not a rule id — `
          + `authored rules: ${[...seen].map((s) => `'${s}'`).join(', ')}`
        );
      }
    }
  }
  if (!Number.isInteger(eqBal.swapCost) || eqBal.swapCost < 0) {
    problems.push(`balance.equipment.swapCost must be a whole number ≥ 0 — got ${JSON.stringify(eqBal.swapCost)}`);
  }
  if (typeof eqBal.allowChangesInCombat !== 'boolean') {
    problems.push(`balance.equipment.allowChangesInCombat must be true or false — got ${JSON.stringify(eqBal.allowChangesInCombat)}`);
  }
  for (const r of eqBal.swapCostByCategory || []) {
    const at = `swapCostByCategory row '${(r && r.tag) || '(no tag)'}'`;
    if (!r || typeof r.tag !== 'string' || !r.tag) { problems.push(`${at}: every category row needs a tag`); continue; }
    // A category nothing carries is the silent one: the rule is live, the row
    // is legal, and no weapon in the game will ever match it.
    if (!pieces.some((p) => (p.tags || []).includes(r.tag))) {
      problems.push(`${at}: no armament carries tag '${r.tag}', so this cost can never be charged`);
    }
    if (!Number.isInteger(r.cost) || r.cost < 0) {
      problems.push(`${at}: cost must be a whole number ≥ 0 — got ${JSON.stringify(r.cost)}`);
    }
  }
}

/**
 * GRIP (plan phase 3c, proposal §5). How the hands hold what they hold, READ
 * off the loadout and never stored: a grip is a function of the two hand
 * slots, so a stored grip would be a second home for one fact (3NF), and the
 * moment the player gains a grip CHOICE (two-handing a one-hander) that
 * choice becomes the stored intent and this the reader of it.
 *
 *   two   either hand holds a piece whose package requires both hands
 *   dual  both hands hold a piece, neither two-handed, sharing an item
 *         type tag (item:blade, item:shield, …) — the "same armament group"
 *   one   anything else, including empty hands
 *
 * gripOf(registries, loadout, classId) → { mode, group, right, left } where
 * `group` is the shared item type tag under `dual` and null otherwise, and
 * right/left are the held piece ids (null when empty).
 */
export const GRIP_MODES = Object.freeze(['one', 'two', 'dual']);

function handHeld(registries, loadout, classId, hand) {
  const slot = (((registries || {}).equipment || {}).slots || []).find((row) => slotHand(row) === hand);
  if (!slot || !loadout) return { piece: null, twoHanded: false };
  const piece = equippedIn(registries, loadout, classId, slot.id);
  const pkg = piece ? WeaponCardPackageModel.fromPiece(registries, piece) : null;
  return { piece, twoHanded: Boolean(pkg && pkg.handsRequired === 2) };
}

export function gripOf(registries, loadout, classId) {
  const right = handHeld(registries, loadout, classId, 'right');
  const left = handHeld(registries, loadout, classId, 'left');
  const out = { mode: 'one', group: null, right: right.piece ? right.piece.id : null, left: left.piece ? left.piece.id : null };
  if (right.twoHanded || left.twoHanded) return { ...out, mode: 'two' };
  if (right.piece && left.piece) {
    const shared = (right.piece.itemTypeTags || []).find((tag) => (left.piece.itemTypeTags || []).includes(tag));
    if (shared) return { ...out, mode: 'dual', group: shared };
  }
  return out;
}

/** The framework tags a grip derives — read at the action snapshot, written to no card. */
export const GRIP_TAGS = Object.freeze({ one: Object.freeze([]), two: Object.freeze(['equipment.twoHanded']), dual: Object.freeze(['equipment.dualWield']) });
export function gripTags(grip) {
  const mode = grip && grip.mode;
  if (!GRIP_MODES.includes(mode)) throw new Error(`gripTags: '${mode}' is not a grip mode (${GRIP_MODES.join(', ')})`);
  return [...GRIP_TAGS[mode]];
}

/**
 * gripRefusal(registries, loadout, classId, slotId, setIndex, itemId) → '' or
 * the sentence that refuses the grip the hands would be left in. The one
 * illegal grip today is a two-handed piece beside an occupied other hand;
 * `dual` is legal on its own (its attribute gate is plan phase 9's row). The
 * loadout is judged AS THE EDIT LEAVES IT — the candidate in its cell, every
 * active index unchanged — against the other hand's active piece: the active
 * pair is the invariant, and it is also held by the deck plan's gate
 * (buildEquippedWeaponCardPlan throws on a two-hander beside an occupied
 * off-hand, which cycleSet and equipPiece both run). This is the same rule
 * asked EARLIER — at canEquip, with a sentence — so the Armoury can say why
 * before the act rather than after it.
 *
 * A MOVE IS NOT A SECOND COPY: equipping a piece that is already in the
 * other hand moves it (applyEquipTransition clears the old cell), so the
 * trial clears every other hand cell holding the candidate before it reads
 * the hands — else a two-hander moved from left to right would be refused
 * for being beside itself.
 */
export function gripRefusal(registries, loadout, classId, slotId, setIndex, itemId) {
  const slots = (((registries || {}).equipment || {}).slots || []);
  const slot = slots.find((row) => row.id === slotId);
  if (!slot || !slotHand(slot) || !loadout) return '';
  const trial = structuredClone(loadout);
  trial.sets = trial.sets || {}; trial.active = trial.active || {};
  for (const hand of slots.filter((row) => slotHand(row))) {
    trial.sets[hand.id] = [...(trial.sets[hand.id] || [])].map((held) => (itemId && held === itemId ? null : held));
  }
  // THE ACTIVE INDEX IS NOT MOVED: equipPiece edits the cell and never
  // activates it, so a two-hander laid in a prepared set beside an occupied
  // active hand is a legal edit here; the day the player cycles to it, the
  // deck plan's gate at cycleSet refuses the pair. Judging the loadout as it
  // will actually be is the only reading that cannot refuse a legal edit.
  if (Number.isInteger(setIndex) && setIndex >= 0) trial.sets[slotId][setIndex] = itemId || null;
  const right = handHeld(registries, trial, classId, 'right');
  const left = handHeld(registries, trial, classId, 'left');
  if ((right.twoHanded && left.piece) || (left.twoHanded && right.piece)) {
    const two = right.twoHanded ? right.piece : left.piece;
    const other = right.twoHanded ? left.piece : right.piece;
    return `${two.name || two.id} needs both hands, and ${other.name || other.id} is in the other one. Free that hand first.`;
  }
  return '';
}

/**
 * healMissingSlotCells(registries, loadout) → the ids of the slots whose cells
 * were absent and are now present, empty. A save written before a slot row
 * existed (phase 3b added head, hands and feet) carries no cells for it, so
 * the Armoury drew no position and equipPiece refused the slot; this gives it
 * what createLoadout gives a fresh run, and nothing else. The load door
 * calls it (save.js loadRun, which notes it on the ledger).
 */
export function healMissingSlotCells(registries, loadout) {
  if (!loadout || typeof loadout !== 'object') return [];
  loadout.sets = loadout.sets || {};
  loadout.active = loadout.active || {};
  const added = [];
  for (const slot of (((registries || {}).equipment || {}).slots || [])) {
    if (Array.isArray(loadout.sets[slot.id])) continue;
    loadout.sets[slot.id] = new Array(Math.max(1, slot.sets || 1)).fill(null);
    loadout.active[slot.id] = 0;
    added.push(slot.id);
  }
  return added;
}

/**
 * trimExtraSets(registries, loadout) → [{ slotId, setIndex, id }] for every
 * armament that sat in a set the slot no longer has. A hand carried three sets
 * until 2026-11-01 and carries one now (equipSlots.csv `sets`), so an older
 * save can hold a weapon in MH2/MH3 or OH2/OH3 and an `active` index past the
 * last set. Each such piece moves to `loadout.storage` (never deleted, and never
 * duplicated if storage already lists it), the array is cut to the slot's
 * `sets`, and `active` is reset to set 1 if it pointed past the cut. Works on any slot whose
 * cap shrinks, not only the hands. The load door calls it and notes the result.
 */
export function trimExtraSets(registries, loadout) {
  if (!loadout || typeof loadout !== 'object' || !loadout.sets) return [];
  loadout.active = loadout.active || {};
  loadout.storage = Array.isArray(loadout.storage) ? loadout.storage : [];
  const moved = [];
  for (const slot of (((registries || {}).equipment || {}).slots || [])) {
    const ids = loadout.sets[slot.id];
    if (!Array.isArray(ids)) continue;
    const cap = Math.max(1, Number(slot.sets) || 1);
    if (ids.length > cap) {
      for (let setIndex = cap; setIndex < ids.length; setIndex += 1) {
        const id = ids[setIndex];
        if (!id) continue;
        moved.push({ slotId: slot.id, setIndex, id });
        if (!loadout.storage.includes(id) && !ids.slice(0, cap).includes(id)) loadout.storage.push(id);
      }
      loadout.sets[slot.id] = ids.slice(0, cap);
      // Only a slot that really lost cells has its active set reset: an
      // out-of-range index on a slot of the right size is a corrupt save, and
      // the load door's shape check still refuses it by name.
      if (loadout.active[slot.id] !== 0) {
        if (Number.isInteger(loadout.active[slot.id]) && loadout.active[slot.id] >= cap) moved.push({ slotId: slot.id, setIndex: loadout.active[slot.id], id: null });
        if (!Number.isInteger(loadout.active[slot.id]) || loadout.active[slot.id] >= cap) loadout.active[slot.id] = 0;
      }
    }
  }
  return moved;
}

/**
 * deckMinimum(registries, run) → the fewest cards a run may leave the Armoury
 * with (plan phase 3b, proposal §5). balance.deck is the one home of the
 * numbers; character level (phase 6) is read as 0 until it exists.
 */
export function deckMinimum(registries, run) {
  const cfg = (((registries || {}).balance || {}).deck) || {};
  // The character level is the ledger's (plan phase 6, `run.level.level`;
  // a fresh run is level 1); `characterLevel` is the field the floor read
  // before the ledger existed, kept for a caller that still names it.
  const ledger = run && run.level && Number.isInteger(run.level.level) && run.level.level > 0 ? run.level.level : null;
  const level = ledger !== null ? ledger
    : (run && Number.isInteger(run.characterLevel) && run.characterLevel > 0 ? run.characterLevel : 0);
  const step = Number.isInteger(cfg.minimumStepLevels) && cfg.minimumStepLevels > 0 ? cfg.minimumStepLevels : 1;
  const base = Number.isInteger(cfg.minimum) ? cfg.minimum : 0;
  const perStep = Number.isInteger(cfg.minimumPerStep) ? cfg.minimumPerStep : 0;
  return base + Math.floor(level / step) * perStep;
}

/**
 * loadoutLeaveRefusal(registries, run, { enteredWith }) → '' when the player
 * may leave the Armoury, else the sentence that says why not.
 *
 * THE FLOOR GATES THE DOOR, NOT THE ACT: unequipping is always allowed (the
 * player may be mid-swap), and what is refused is LEAVING with the deck under
 * `deckMinimum`. `enteredWith` is the deck size when the screen opened: a run
 * that was already under the floor when it arrived (a shop removal took it
 * there; nothing in this screen did) may leave, because a door that traps a
 * player over a state it did not create is a defect, not a rule.
 */
export function loadoutLeaveRefusal(registries, run, { enteredWith } = {}) {
  const held = Array.isArray(run && run.deck) ? run.deck.length : 0;
  const floor = deckMinimum(registries, run);
  if (held >= floor) return '';
  if (Number.isInteger(enteredWith) && enteredWith < floor) return '';
  const short = floor - held;
  return `Your deck holds ${held} card${held === 1 ? '' : 's'} and the floor is ${floor}. Equip something that carries ${short} more, or put back what you took off, before you leave.`;
}

/** A short string that changes whenever the worn set does — for cache keys. */
export function loadoutSignature(loadout) {
  if (!loadout) return '';
  return Object.keys(loadout.sets || {})
    .sort()
    .map((k) => `${k}:${(loadout.sets[k] || [])[(loadout.active || {})[k] || 0] || '-'}`)
    .join('|');
}

function equipmentChangedPayload(reason, before, after) {
  const changedPositions = [];
  const slotIds = new Set([...Object.keys((before || {}).sets || {}), ...Object.keys((after || {}).sets || {})]);
  for (const slotId of [...slotIds].sort()) {
    const beforeIds = ((before || {}).sets || {})[slotId] || [];
    const afterIds = ((after || {}).sets || {})[slotId] || [];
    const count = Math.max(beforeIds.length, afterIds.length);
    for (let setIndex = 0; setIndex < count; setIndex++) {
      const beforeItemId = beforeIds[setIndex] || null;
      const afterItemId = afterIds[setIndex] || null;
      const beforeActive = (((before || {}).active || {})[slotId] || 0) === setIndex;
      const afterActive = (((after || {}).active || {})[slotId] || 0) === setIndex;
      if (beforeItemId !== afterItemId || beforeActive !== afterActive) {
        changedPositions.push({ slotId, setIndex, beforeItemId, afterItemId, beforeActive, afterActive });
      }
    }
  }
  return {
    reason,
    beforeLoadoutSignature: loadoutSignature(before),
    afterLoadoutSignature: loadoutSignature(after),
    changedPositions,
  };
}

function emitEquipmentChanged(ctx, reason, before, after) {
  if (ctx && typeof ctx.onEquipmentChanged === 'function') {
    ctx.onEquipmentChanged(equipmentChangedPayload(reason, before, after));
  }
}


/**
 * canSwap(registries, slotId, { inCombat }) → { ok, word, reason }.
 * The rule lives in equipSlots.csv (`swap`): hands may be changed mid-fight at
 * a price, armour and talismans may not.
 *
 * `word` IS THE BADGE, AND IT LIVES HERE BECAUSE THE COLLISION DID (#98, Bjorn).
 * The screen used to type the literal 'sealed' into the slot header while this
 * function supplied only the tooltip — so the one word a player actually reads
 * had no home, and nothing could compare it to anything. It collided: the
 * ARMOUR header said "sealed" (this function, about the ACTIVE SET) while two
 * rows below the picker said "Right Hand is sealed in combat" (canEquip, about
 * a set's CONTENTS), on a Right Hand carrying no badge at all. Both sentences
 * were true. **One word carrying two facts, with the copies visibly
 * disagreeing** — his framing, and it is worse than a second copy, because a
 * second copy at least says the same thing twice.
 *
 * So the badge word sits beside the reason it belongs to, and test 31d asserts
 * canEquip's sentence contains neither this word nor any slot label. A future
 * edit that reintroduces the collision goes red, which is the point: the
 * brittleness IS the check. The wording is Sunna's whenever she wants it —
 * both strings are one line each and neither is derived from the other.
 */
export function canSwap(registries, slotId, { inCombat = false } = {}) {
  const slot = ((registries.equipment || {}).slots || []).find((s) => s.id === slotId);
  if (!slot) return { ok: false, word: 'unknown', reason: `No slot '${slotId}'` };
  // THE WORDING IS MINE (Sunna, #98). Two changes, and the second is the reason
  // for the first.
  //
  // `sealed` → `fastened`. Not a synonym swap. "Sealed" is an ABSOLUTE word over
  // a PARTIAL rule — it says *shut*, while the fact it carries is only that THIS
  // slot cannot change its active set, and two slots beside it can. A total word
  // over a partial fact is how it collided with the screen-wide seal in the first
  // place, and re-keying the string without changing its register would leave the
  // reader in the same place Bjorn found them. "Fastened" is a STATE, not a
  // verdict: it says the armour is done up, which is why it cannot come off, and
  // it cannot be read as the re-arm rule below.
  //
  // AND IT HAS TO STAND ALONE, which is the part I could not fix here. This badge
  // carries its reason in a `title=`, and Law 3 clause 4 is explicit that a native
  // title alone does not satisfy — a touch or pad player never sees it. Measured
  // at 390x844: the badge renders 23.6-33.1 px wide with NO reachable explanation
  // at any text size. So the word is the whole message on the shape Constantine
  // just made the priority, and I picked one that survives being alone. The
  // reason wants to be on the glass; that is markup, not a string, and it is
  // filed rather than smuggled in here.
  if (inCombat && slot.swap !== 'combat') {
    return { ok: false, word: 'fastened', reason: `${slot.label} stays fastened until the fight ends.` };
  }
  return { ok: true, word: '', reason: '' };
}

//
// `canSwap` above says WHETHER. This says HOW MUCH, and the comment on
// `cycleSet` below already named it as the next act: *"the PRICE.
// balance.equipment.swapCost is charged in doSwapArmament, outside this
// function"* — so the price had no truth function at all, only a subtraction in
// the engine. It has one now, and it lives here because this module is the one
// home for what a loadout means.
//
// Constantine named three prices and said *"that way I can try each"*, so the
// three are rows in `balance.equipment.swapCostRules` and the live one is a
// word. This function is the chain they select rungs of; it contains no `if`
// on a rule id, which is the difference between data he can switch between and
// three branches wearing a config key.

/** Where a rule's base price comes from. Closed; a row saying anything else is refused by name. */
export const SWAP_COST_BASES = Object.freeze(['default', 'category']);

/** The authored rules table. Empty is a real answer: no table, no rule, price falls to the default. */
export function swapCostRules(registries) {
  return (((registries || {}).balance || {}).equipment || {}).swapCostRules || [];
}

/**
 * resolveSwapCostRule(registries, meta) → the live rule row, or null.
 *
 * Unset, or a value this build cannot read, is the SHIPPING DEFAULT — the same
 * rule `resolveMapMode` and `savedZoom` use, and for the same reason: a
 * hand-edited save or an older build's value must behave exactly as an absent
 * one. The Settings row reads this table too, so the control and the resolver
 * cannot disagree about which rules exist.
 */
export function resolveSwapCostRule(registries, meta) {
  const cfg = (((registries || {}).balance || {}).equipment || {});
  const rows = swapCostRules(registries);
  const want = ((meta && meta.settings) || {}).swapCostRule;
  return rows.find((r) => r && r.id === want) || rows.find((r) => r && r.id === cfg.swapCostRule) || null;
}

/**
 * swapCostFor(registries, { rule, loadout, classId, slotId, setIndex, relicDelta })
 *   → { cost, ruleId, base, baseCost, categoryTag, gearOn, gearDelta, gearIgnored, floored }
 *
 * THE WHOLE DERIVATION, RETURNED RATHER THAN JUST THE NUMBER. A price a screen
 * or a test can only observe as `2` cannot be checked for WHY it is 2, and the
 * thing being measured tonight is whether three settings actually produce
 * different numbers — so every rung is in the return value and test 28b prints
 * the table. `gearIgnored` is the deliberately loud one: it is the delta a
 * gear-off rule DECLINED, so a talisman doing nothing says so instead of
 * looking broken.
 *
 * WHICH PIECE'S CATEGORY. The one being DRAWN — `loadout.sets[slotId][setIndex]`,
 * the set you are switching TO — not the one going away and not a max() of the
 * two. You pay for what you pick up, which is the reading a player can predict
 * from the thing they just chose. It is one line and named here rather than
 * discovered: if it plays wrong, this sentence is what changes.
 *
 * THE RELIC HALF ARRIVES AS A NUMBER, and that is a module boundary, not a
 * shortcut. `passiveSum` lives in model/registries.js, which imports THIS file
 * — so importing it back would make a cycle, and a cycle that survives Node
 * survives it in a hand-rolled single-file bundler only by luck. Combat already
 * owns the relic-passive-to-price pattern (`effectiveCost`, same file, same
 * shape), so it sums `swapCostDelta` and hands the total in. A caller that
 * forgets is NAMED, not defaulted: silence must not mean "no relics".
 *
 * THE FLOOR IS 0 AND IT IS ARITHMETIC, NOT DATA. An authored negative — a
 * category row at −1, a `swapCost` below zero — is refused by name in
 * `validateEquipment`. A negative TOTAL is a legal talisman meeting a cheap
 * weapon, and it clamps the way `powerCostReduction` already does, with
 * `floored` set so the clamp is observable rather than quiet.
 */
export function swapCostFor(registries, {
  rule = null, loadout = null, classId = null, slotId = null, setIndex = 0, relicDelta,
} = {}) {
  const cfg = (((registries || {}).balance || {}).equipment || {});
  const fallback = Number.isFinite(cfg.swapCost) ? cfg.swapCost : 0;
  const row = rule || null;
  const base = row && SWAP_COST_BASES.includes(row.base) ? row.base : 'default';

  let categoryTag = null;
  let baseCost = fallback;
  if (base === 'category') {
    const ids = ((loadout || {}).sets || {})[slotId] || [];
    const id = ids[setIndex];
    const eq = (registries || {}).equipment || {};
    const piece = id ? (eq.armaments || []).find((a) => a.id === id) || null : null;
    const tags = (piece && piece.tags) || [];
    // ORDERED, FIRST MATCH WINS — the priority between two tags a piece carries
    // is the order of the rows, so it is authorable and visible. No match at all
    // (a bare hand, an untagged piece) falls through to the default, which is
    // the same number the 'flat' rule charges — by design, not by accident.
    const hit = (cfg.swapCostByCategory || []).find((r) => r && tags.includes(r.tag));
    if (hit) {
      categoryTag = hit.tag;
      baseCost = Number.isFinite(hit.cost) ? hit.cost : fallback;
    }
  }

  if (!Number.isFinite(relicDelta)) {
    console.error(
      `swapCostFor('${slotId}'): no finite \`relicDelta\` — refusing to guess.`
      + ` Got ${JSON.stringify(relicDelta)}. Pass passiveSum(registries, relicIds, 'swapCostDelta').`
      + ' Charging the gear stage as 0. This line is the defect, not the price.'
    );
  }
  const relic = Number.isFinite(relicDelta) ? relicDelta : 0;
  const worn = loadout ? runMods(registries, loadout, classId).swapCostDelta : 0;
  const delta = relic + worn;
  const gearOn = !!(row && row.gear);
  const raw = baseCost + (gearOn ? delta : 0);

  return {
    cost: Math.max(0, raw),
    ruleId: row ? row.id : null,
    base,
    baseCost,
    categoryTag,
    gearOn,
    gearDelta: gearOn ? delta : 0,
    gearIgnored: gearOn ? 0 : delta,
    floored: raw < 0,
  };
}

/**
 * canEquip(registries, slotId, { inCombat }) → { ok, reason }.
 *
 * MAY WHAT IS IN THIS SET CHANGE RIGHT NOW — the sibling question to canSwap.
 * `canSwap` asks whether the ACTIVE set may change; this asks whether a set's
 * CONTENTS may. The combat answer is data-owned by allowChangesInCombat so the
 * Armoury, mutation, and engine all read one rule.
 *
 * This is intentionally one combat-wide balance switch rather than another
 * per-slot column. Which prepared set may become active remains a property of
 * the slot (`canSwap`); whether carried gear may replace, move, or leave a
 * position is one fight rule for every position (`allowChangesInCombat`).
 *
 * The context is required and must contain a boolean. Silence never means
 * permission: malformed callers fail closed even when the shipped rule is on.
 */
/** One shared refusal sentence for model, engine, and Armoury. */
export const COMBAT_EQUIPMENT_CHANGE_DISABLED = 'Equipment changes are disabled during combat.';

export function canEquip(registries, slotId, ctx) {
  const slot = (((registries || {}).equipment || {}).slots || []).find((s) => s.id === slotId);
  if (!slot) return { ok: false, reason: `No slot '${slotId}'` };
  if (!ctx || typeof ctx !== 'object' || typeof ctx.inCombat !== 'boolean') {
    console.error(
      `canEquip('${slotId}'): no boolean \`inCombat\` in the context — refusing.`
      + ` Got ${JSON.stringify(ctx)}. This line is the defect, not the refusal.`
    );
    return { ok: false, reason: COMBAT_EQUIPMENT_CHANGE_DISABLED };
  }
  const cfg = (((registries || {}).balance || {}).equipment || {});
  if (ctx.inCombat && cfg.allowChangesInCombat !== true) {
    return { ok: false, reason: COMBAT_EQUIPMENT_CHANGE_DISABLED };
  }
  // THE GRIP THE HANDS WOULD BE LEFT IN (plan phase 3c). Asked only when the
  // caller says what it is about to put where — equipPiece does; a bare
  // "may this slot change at all" question keeps its old answer.
  if (ctx.loadout && ctx.itemId !== undefined) {
    const refusal = gripRefusal(registries, ctx.loadout, ctx.classId || null, slotId, ctx.setIndex, ctx.itemId);
    if (refusal) return { ok: false, reason: refusal };
  }
  // THE ATTRIBUTE GATE (plan phase 9), BESIDE THE GRIP'S. equipPiece has
  // enforced these minima on the mutation for as long as they have existed;
  // what this adds is the ANSWER, early and in words, to a caller that asks
  // "may this go here" before acting — the equipment screen's seal, which
  // could previously only find out by trying. Asked when the caller names
  // both the candidate and the attributes to judge it by; a bare "may this
  // slot change" question keeps its old answer, and the mutation's own check
  // remains the gate of record.
  if (ctx.itemId && ctx.attributes) {
    // BOTH HALVES OF THE WARDROBE. equipmentRequirements.csv carries armour
    // rows (the plate asks Strength, the vestments Wisdom) as well as
    // armaments, and a gate that searched only the weapons would have left
    // every armour minimum unenforced while reading as though it enforced
    // them — worse than no gate, because the table says otherwise.
    // ARMOUR IDS REPEAT PER CLASS (outfits.csv carries four `wayfarerPlate`
    // rows), so the armour half is resolved against the run's own class when
    // the caller names one; without a class the first row still answers, as
    // equipPiece's own read does.
    const eq = registries.equipment || {};
    const piece = (eq.armaments || []).find((row) => row.id === ctx.itemId)
      || (eq.armour || []).find((row) => row.id === ctx.itemId && (!ctx.classId || row.classId === ctx.classId))
      || (eq.armour || []).find((row) => row.id === ctx.itemId);
    if (piece) {
      // THE SAME INPUTS THE MUTATION'S OWN CHECK USES. equipPiece has read
      // these minima since before this gate existed; this one runs FIRST and
      // short-circuits, so a narrower copy here would overrule the wider one
      // and refuse an item whose requirement an upgrade had lowered.
      const receipt = equipmentRequirementReceipt(registries, piece, ctx.attributes, {
        itemUpgradeLevels: ctx.itemUpgradeLevels || {},
        armamentLevels: ctx.armamentLevels || {},
      });
      if (!receipt.ok) {
        const shortOf = receipt.failures[0];
        const label = (registries.attributes.get(shortOf.attributeId) || {}).shortLabel || shortOf.attributeId;
        // An absent attribute is UNKNOWN, not zero: a caller that hands in a
        // partial allocation is not a character with nothing in that stat.
        const have = shortOf.actual === null ? 'unknown' : shortOf.actual;
        return { ok: false, reason: `${piece.name || piece.id} requires ${label} ${shortOf.required} (you have ${have})` };
      }
    }
  }
  return { ok: true, reason: '' };
}

/**
 * cycleSet(registries, loadout, slotId, index, { meta }) → mutates the active
 * set index. Returns false when the slot, the index, or the LADDER says no.
 *
 * VIRA'S GATE OF #90, AND SHE IS RIGHT THAT IT IS THE SAME DEFECT. `equipPiece`
 * above carried a comment claiming the gate was on the mutation; #90 proved that
 * sentence was about `fitsSlot` and had never been true of ownership, and moved
 * the gate. **This function was three functions below it, in the same file, in
 * the same commit, still bounding on `ids.length` — the raw array — while
 * `openedSets()` shipped directly above it already knowing the answer.** So the
 * ladder's gate was in the screen: the exact arrangement the commit spent itself
 * disproving. A truth function written in the same act is not a follow-up.
 *
 * Measured at `c43c908`, her falsifier, before this change: fresh profile,
 * `openedSets 1 · cycleSet accepts 3` on every multi-set slot — **6 of 13
 * (slot, index) pairs.**
 *
 * THE BOUND IS `openedSets()` AND NEVER `1 + rungs earned`, which is her edge 2
 * and the reason this is not "just add a comparison". A save from before today
 * has `sets` full-width with pieces already in the last cell and no rungs
 * earned; `openedSets` raises its floor to what the loadout is already holding,
 * on purpose. A bound that recomputed the ladder from the rungs alone would
 * strand a legacy player's weapon behind a lock that did not exist when they put
 * it there — worse than the defect. **One truth function, two consumers**: the
 * screen draws what `openedSets` opens and this refuses what it does not, so the
 * two cannot disagree about a cell.
 *
 * THE SWAP RULE IS ASKED HERE NOW, AND THAT IS THE WHOLE CHANGE (#104, Vira,
 * found while gating #98 and carded as its own act). This signature used to have
 * no `inCombat` at all, so the question was never whether it CHECKED the swap
 * rule but whether it COULD: `canSwap` was enforced by both callers and by
 * neither of them structurally. **A second copy fails by divergence; an
 * unenforced gate fails by bypass** — different defects, and only the second one
 * was here. It had a live cell: `talisman` (`swap=outOfCombat`, `sets=3`) MOVED
 * mid-fight, against its own data, and every test of this function used
 * `rightHand`, where the missing gate is vacuous — which is why nothing was red.
 * Dormant only because talismans are unauthored: one CSV row under Law 1 clause 1
 * wakes it, so this is a content fact away from live, not a hypothetical.
 *
 * IT ASKS `canSwap`; IT DOES NOT RESTATE IT. The rule keeps its one home — no
 * `slot.swap` comparison is written in this function, and the sentence a player
 * reads is not typed here. `doSwapArmament` still calls `canSwap` itself because
 * it needs the REASON to throw before it charges the price; that is the same
 * function answering two questions (may I / what do I tell them), not two copies
 * of the rule. Both callers and the mutation now agree by construction.
 *
 * `inCombat` IS REQUIRED AND FAILS CLOSED, exactly as `equipPiece`'s is and for
 * the reason written there: a context defaulting to "not in combat" makes
 * SILENCE MEAN PERMISSION, which is how every hole in this module got in. The
 * check is on the VALUE, not the key — `{ inCombat: undefined }` is what a caller
 * produces by forwarding a variable that was never set, and it refuses too.
 *
 * WHAT THIS DOES NOT OWN: the PRICE. `balance.equipment.swapCost` is charged in
 * the combat intent, outside this function. Direct model calls remain useful for
 * previews and fixtures; player actions must route through the engine.
 *
 * `registries` moves to the front like everything else in this module, which is
 * also what makes a call site left on the old signature fail CLOSED: the old
 * first argument was a loadout, `registries.equipment.slots` is then undefined,
 * the slot does not resolve, and it cycles nothing and says so.
 */
export function cycleSet(registries, loadout, slotId, index, ctx) {
  const ids = ((loadout || {}).sets || {})[slotId];
  if (!ids || index < 0 || index >= ids.length) return false;
  const slot = (((registries || {}).equipment || {}).slots || []).find((s) => s.id === slotId);
  if (!slot) {
    console.error(
      `cycleSet('${slotId}', ${index}): no such slot in registries.equipment — refusing.`
      + ' Call it as cycleSet(registries, loadout, slotId, index, { meta, inCombat }).'
      + ' This line is the defect, not the refusal.'
    );
    return false;
  }
  if (!ctx || typeof ctx !== 'object' || typeof ctx.inCombat !== 'boolean') {
    console.error(
      `cycleSet('${slotId}', ${index}): no boolean \`inCombat\` in the context — refusing.`
      + ` Got ${JSON.stringify(ctx)}. Pass { meta, inCombat } so the bound is`
      + ' openedSets() and the seal is canSwap(). This line is the defect, not the refusal.'
    );
    return false;
  }
  if (!canSwap(registries, slotId, { inCombat: ctx.inCombat }).ok) return false;
  if (index >= openedSets(registries, slot, { meta: ctx.meta || {}, loadout })) return false;
  const before = structuredClone(loadout);
  loadout.active[slotId] = index;
  try {
    buildEquippedWeaponCardPlan(registries, loadout, ctx.classId || null);
  } catch (error) {
    loadout.active[slotId] = before.active[slotId];
    console.error(`cycleSet('${slotId}', ${index}): ${error.message} — refusing.`);
    return false;
  }
  emitEquipmentChanged(ctx, 'swapSet', before, loadout);
  return true;
}

/**
 * Normalize saves written while one owned armament could occupy several hand
 * sets. Keep an active occurrence when one exists (slot order breaks ties),
 * clear the others, and remove an equipped survivor from shared Inventory.
 * Returns a receipt for the load-door ledger; an empty array means no change.
 */
export function normalizeArmamentLocations(registries, loadout) {
  if (!loadout || !loadout.sets) return [];
  const eq = (registries || {}).equipment || {};
  const handSlots = (eq.slots || []).filter((slot) => slotHand(slot));
  const armamentIds = new Set((eq.armaments || []).map((piece) => piece.id));
  const occurrences = new Map();
  for (const slot of handSlots) {
    const ids = loadout.sets[slot.id] || [];
    for (let setIndex = 0; setIndex < ids.length; setIndex++) {
      const id = ids[setIndex];
      if (!id || !armamentIds.has(id)) continue;
      const rows = occurrences.get(id) || [];
      rows.push({ slotId: slot.id, setIndex, active: setIndex === ((loadout.active || {})[slot.id] || 0) });
      occurrences.set(id, rows);
    }
  }

  const changes = [];
  const storage = [...new Set(loadout.storage || [])];
  for (const [id, rows] of occurrences) {
    const kept = rows.find((row) => row.active) || rows[0];
    // Configured class packs may explicitly own two same-definition weapons
    // (the Rogue's dagger/dagger kit). Preserve only its two active hand
    // occurrences; legacy and unrelated duplicate locations still normalize.
    const authoredPair = registries.gameProfile?.foundation?.mode === 'configured'
      && gameContent(registries, 'classes')?.some(row => row.loadout?.rightHand === id && row.loadout?.leftHand === id);
    const retained = authoredPair ? rows.filter(row => row.active).slice(0, 2) : [kept];
    if (!retained.length) retained.push(kept);
    const cleared = rows.filter((row) => !retained.includes(row));
    for (const row of cleared) loadout.sets[row.slotId][row.setIndex] = null;
    const removedFromStorage = storage.includes(id);
    if (removedFromStorage) storage.splice(storage.indexOf(id), 1);
    if (cleared.length || removedFromStorage) changes.push({ id, kept, cleared, removedFromStorage });
  }
  if (storage.length !== (loadout.storage || []).length || changes.length) loadout.storage = storage;
  return changes;
}

/**
 * Apply the storage/location half of an equipment mutation. Both the real
 * mutation and comparison preview call this function, so a preview cannot
 * invent a duplicate object the committed action would move away.
 */
function equipTransitionPlan(registries, loadout, slotId, setIndex, itemId) {
  const ids = ((loadout || {}).sets || {})[slotId];
  const eq = (registries || {}).equipment || {};
  const slot = (eq.slots || []).find((candidate) => candidate.id === slotId);
  if (!slot || !ids || setIndex < 0 || setIndex >= ids.length) {
    return { ok: false, reason: 'That equipment location is no longer available.' };
  }

  const previousId = ids[setIndex] || null;
  if (!slotHand(slot)) {
    return { ok: true, slot, ids, previousId, nextStorage: loadout.storage || [], storesPrevious: false };
  }

  const cap = Number.isInteger(((registries.balance || {}).equipment || {}).storageSlots)
    ? registries.balance.equipment.storageSlots
    : 8;
  const nextStorage = [...new Set(loadout.storage || [])].filter((id) => id !== itemId);
  const storesPrevious = previousId && previousId !== itemId && !nextStorage.includes(previousId);
  if (storesPrevious && nextStorage.length >= cap) {
    return {
      ok: false,
      reason: `Inventory is full (${nextStorage.length}/${cap}). Make room before ${itemId ? 'moving this item' : 'unequipping this item'}.`,
    };
  }
  return { ok: true, slot, ids, previousId, nextStorage, storesPrevious };
}

/** A mutation-free capacity verdict for the Armoury's action feedback. */
export function equipTransitionReceipt(registries, loadout, slotId, setIndex, itemId) {
  const plan = equipTransitionPlan(registries, loadout, slotId, setIndex, itemId);
  return { ok: plan.ok, reason: plan.reason || '' };
}

export function applyEquipTransition(registries, loadout, slotId, setIndex, itemId) {
  const plan = equipTransitionPlan(registries, loadout, slotId, setIndex, itemId);
  if (!plan.ok) return false;
  const { slot, ids, nextStorage, previousId, storesPrevious } = plan;
  if (!slotHand(slot)) {
    ids[setIndex] = itemId || null;
    return true;
  }

  const eq = (registries || {}).equipment || {};
  const handSlotIds = new Set((eq.slots || []).filter((candidate) => slotHand(candidate)).map((candidate) => candidate.id));
  if (itemId) {
    for (const [otherSlotId, otherIds] of Object.entries(loadout.sets || {})) {
      if (!handSlotIds.has(otherSlotId)) continue;
      for (let i = 0; i < otherIds.length; i++) {
        if (otherIds[i] === itemId && (otherSlotId !== slotId || i !== setIndex)) otherIds[i] = null;
      }
    }
  }
  if (storesPrevious) nextStorage.push(previousId);
  loadout.storage = nextStorage;
  ids[setIndex] = itemId || null;
  return true;
}

/**
 * equipPiece(registries, loadout, slotId, setIndex, itemId, owned, ctx) → boolean.
 * Put a piece id into a specific set of a slot; `null` clears it.
 *
 * The gate is HERE, on the mutation, and not in the screen that calls it. The
 * picker used to be the only thing deciding what may go where, so every other
 * way into a slot — a save file, a drop, a future drag, a gamepad path nobody
 * has written yet — walked straight past it. A caller that must remember to
 * check is not a gate (`bundle.mjs`, same week, same lesson). `registries` is
 * the first argument like everything else in this module, which is also what
 * makes a call site left on the old signature fail CLOSED — it equips nothing
 * and the suite says so — rather than quietly skip the new check.
 *
 * `owned` is that same sentence, one check later, and the reason it is REQUIRED
 * rather than optional (#90). Whether the piece FITS was gated here; whether it
 * is YOURS was gated only by the picker declining to attach a click handler to
 * a locked chip. #90 removes those chips, so an optional argument would have
 * left ownership enforced by nothing at all while the screen looked stricter.
 * Missing `owned` refuses and says so — the same fail-closed shape as the
 * `registries` argument above, for the same reason.
 *
 * Clearing a slot needs no ownership, but it still asks the combat-change rule.
 * The permission is checked before the `!itemId` return so disabling combat
 * equipment changes also disables combat unequip.
 *
 * `ctx` — `{ inCombat }` — is REQUIRED, for the reason the two arguments above
 * it are (#95). A context that defaults to "not in combat" fails OPEN: every
 * call site written after today would equip mid-fight by saying nothing, which
 * is how the ownership hole survived #90 in the first place. `cycleSet` above
 * already takes a required trailing context for the ladder, so this is that
 * pattern, not a new one.
 *
 * THE CHECK IS ON THE VALUE, NOT THE KEY (#98, Vira). It read `'inCombat' in
 * ctx`, which answers whether the key was TYPED — so `{ inCombat: undefined }`
 * and `{ inCombat: null }` were taken, and both are what a caller produces by
 * forwarding a variable that was never set. That is the same defect one notch
 * quieter than the one this argument exists to close: absent read as permission.
 * A boolean, or it refuses and prints what it was actually handed.
 */
export function equipPiece(registries, loadout, slotId, setIndex, itemId, owned, ctx) {
  const ids = ((loadout || {}).sets || {})[slotId];
  if (!ids || setIndex < 0 || setIndex >= ids.length) return false;
  if (!ctx || typeof ctx !== 'object' || typeof ctx.inCombat !== 'boolean') {
    console.error(
      `equipPiece('${slotId}', '${itemId}'): no boolean \`inCombat\` in the context — refusing.`
      + ` Got ${JSON.stringify(ctx)}. Pass { inCombat } as the seventh argument.`
      + ' This line is the defect, not the refusal.'
    );
    return false;
  }
  // THE GATE IS HERE, ON THE MUTATION, and the screen no longer holds a copy of
  // it. Before #95 the only thing stopping a mid-fight re-arm was the armoury
  // declining to open its picker — a screen, not a gate, so a save file, a drop,
  // a drag, a gamepad path or a second surface walked straight past it. Measured
  // at 98fedde: equipPiece on a live combat loadout returned true.
  // Passed through, NOT coerced. `!!ctx.inCombat` would turn a value this
  // function had just refused into a legal one, so if the check above is ever
  // loosened canEquip's own check is a real second gate rather than an echo.
  const permission = canEquip(registries, slotId, {
    inCombat: ctx.inCombat, loadout, classId: ctx.classId || null, setIndex, itemId,
    // The attribute gate judges only when the caller hands in what to judge
    // by, and then by the same levels this function's own check uses.
    ...(ctx.attributes ? {
      attributes: ctx.attributes,
      itemUpgradeLevels: ctx.itemUpgradeLevels,
      armamentLevels: ctx.armamentLevels,
    } : {}),
  });
  if (!permission.ok) return false;
  const eq = (registries || {}).equipment || {};
  const slot = (eq.slots || []).find((s) => s.id === slotId);
  if (!slot) return false;
  const before = structuredClone(loadout);
  const appearedElsewhere = itemId && Object.entries(loadout.sets || {}).some(([otherSlotId, values]) => (
    values.some((value, index) => value === itemId && (otherSlotId !== slotId || index !== setIndex))
  ));
  const reason = !itemId ? 'unequip' : appearedElsewhere ? 'move' : 'equip';
  if (!itemId) {
    const changed = applyEquipTransition(registries, loadout, slotId, setIndex, null);
    if (changed) emitEquipmentChanged(ctx, reason, before, loadout);
    return changed;
  }
  // Armour ids repeat across classes; the class gate is armourById's, and this
  // one only asks whether the piece may live in this slot at all. The row it
  // reads is still the WEARER's when the caller names a class, as canEquip's
  // is: the requirement receipt keys an outfit's smithing level by
  // `armor/<classId>/<id>`, and reading another class's row would price the
  // act differently from the seal (review, #1255).
  const piece = slot.kinds.includes('armor')
    ? ((eq.armour || []).find((o) => o.id === itemId && ctx.classId && o.classId === ctx.classId)
      || (eq.armour || []).find((o) => o.id === itemId))
    : (eq.armaments || []).find((a) => a.id === itemId);
  if (!piece || !fitsSlot(slot, piece)) return false;
  if (!owned || typeof owned.has !== 'function') {
    console.error(
      `equipPiece('${slotId}', '${itemId}'): called with no ownership — refusing.`
      + ' Pass ownership(registries, { meta, loadout }) as the sixth argument.'
      + ' This line is the defect, not the refusal.'
    );
    return false;
  }
  if (!owned.has(piece)) return false;
  if (!equipmentRequirementReceipt(registries, piece, ctx.attributes, { itemUpgradeLevels: ctx.itemUpgradeLevels, armamentLevels: ctx.armamentLevels }).ok) return false;
  const next = structuredClone(loadout);
  if (!applyEquipTransition(registries, next, slotId, setIndex, itemId)) return false;
  try {
    buildEquippedWeaponCardPlan(registries, next, ctx.classId || null);
  } catch (error) {
    console.error(`equipPiece('${slotId}', '${itemId}'): ${error.message} — refusing.`);
    return false;
  }
  loadout.sets = next.sets;
  loadout.active = next.active;
  loadout.storage = next.storage;
  emitEquipmentChanged(ctx, reason, before, loadout);
  return true;
}

export {
  parseMod,
  modEffectLines,
  modEffectLine,
  HANDS,
  EQUIPMENT_ROLES,
  ARMAMENT_INTRINSIC_STAT_FIELDS,
  armamentIntrinsicStatProblems,
  slotHand,
  pieceHand,
  fitsSlot,
  CARD_MOD_APPLIES,
  EQUIPMENT_POOL_FIELDS,
  RUN_MOD_APPLIES,
  moveEquipmentPool,
  equipmentRequirementReceipt,
  startingHandsRequirementFailure,
  previewCompatibleHands,
  cardEquipmentCompatibility,
  fromDropPool,
  OWNERSHIP_GATES,
  ownership,
  addToStorage,
  carriedIds,
  SLOT_RUNG_KIND,
  slotRungs,
  openedSets,
  visibleSets,
  rungFor,
  setCellState,
  createLoadout,
  createEquipmentProfileRuleSnapshot,
  restoreEquipmentProfileRuleSnapshot,
  equippedIn,
  equippedPieces,
  figureSpec,
  loadoutTags,
  equipmentRoleSource,
  equipmentKitPlan,
  equipmentKitReceipt,
  isEquipmentComposedInstance,
  WeaponCardPackageModel,
  applyEquippedWeaponCardPlan,
  BOUND_GRANT_TAG,
  boundGrantProblems,
  boundGrantCardIds,
  sortBySourceOrder,
  ITEM_OWNED_ROLES,
  isItemOwned,
  pieceItemRef,
  reconcileGrantedCards,
  isCurrentEquipmentGrant,
  itemMountInstances,
  reconcileGrantedCardsInCombat,
  ownerItemRef,
  startingDeckPlan,
  buildEquippedWeaponCardPlan,
  WeaponDeckCompositionService,
  startingDeckProblems,
  startingDeckWarnings,
  startingDeckRefs,
  orderStartingDeck,
  cardMods,
  runMods,
  reconcileRunLoadoutHp,
  applyCardMods,
  stampDeck,
};
