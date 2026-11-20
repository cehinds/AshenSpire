// src/model/loadout/validate.js — validating the equipment tables.
// A part of src/model/loadout.js (split from one file; behaviour unchanged).

import { ratingIds } from '../ratingFormula.js';
import { startingKitProblems } from '../startingKits.js';
import { tagService } from '../tagService.js';
import { DAMAGE_SCHOOLS } from '../schemas.js';
import { parseMod } from './modStrings.js';
import {
  HANDS, EQUIPMENT_ROLES, armamentIntrinsicStatProblems, slotHand, pieceHand, fitsSlot,
} from './hands.js';
import { CARD_MOD_APPLIES, RUN_MOD_APPLIES } from './applyVocab.js';
import { equipmentRequirementReceipt } from './requirements.js';
import { fromDropPool } from './ownership.js';
import { SLOT_RUNG_KIND, slotRungs } from './slotLadder.js';
import { WeaponCardPackageModel } from './weaponPackages.js';
import { startingDeckProblems } from './startingDeck.js';
import { startingDeckConfig } from './grantSources.js';
import { SWAP_COST_BASES, swapCostRules } from './swapCost.js';

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
