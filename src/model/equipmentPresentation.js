// One read model for equipment-facing comparison surfaces. Character creation
// and the Armoury render this receipt; neither screen redoes kit, requirement,
// resource, or inert player-Poise arithmetic.

import {
  equipmentKitReceipt,
  equipmentRequirementReceipt,
  equippedIn,
  equippedPieces,
  parseMod,
  resolveSwapCostRule,
  runMods,
  swapCostFor,
} from './loadout.js';
import { passiveSum } from './registries.js';
import { playerPoiseThresholdReceipt } from './statProjection.js';

function pieceFor(registries, classId, pieceId, slot) {
  if (!pieceId) return null;
  const equipment = registries.equipment || {};
  return slot.kinds.includes('armor')
    ? (equipment.armour || []).find((row) => row.classId === classId && row.id === pieceId) || null
    : (equipment.armaments || []).find((row) => row.id === pieceId) || null;
}

function requirementsFor(registries, run, pieces) {
  return pieces
    .map((piece) => {
      const receipt = equipmentRequirementReceipt(registries, piece, run.attributes);
      return {
        ...receipt,
        pieceName: piece.name,
        requirements: receipt.requirements.map((row) => ({
          ...row,
          label: registries.attributes.get(row.attributeId).shortLabel,
        })),
        failures: receipt.failures.map((row) => ({
          ...row,
          label: registries.attributes.get(row.attributeId).shortLabel,
        })),
      };
    })
    .filter((row) => row.requirements.length);
}

function rolesFor(registries, run) {
  const copies = registries.balance.equipment.roleCopies;
  return equipmentKitReceipt(
    registries,
    run.loadout,
    run.class,
    run.attributes,
    run.equipmentProfileRuleSnapshot,
  ).map((row) => ({ ...row, copies: copies[row.role] }));
}

function explicitEffects(registries, beforePiece, afterPiece) {
  const before = new Set((beforePiece && beforePiece.mods) || []);
  const fields = (registries.equipment || {}).modFields || {};
  return ((afterPiece && afterPiece.mods) || [])
    .filter((raw) => !before.has(raw))
    .map((raw) => {
      const mod = parseMod(raw);
      const field = mod && fields[mod.field];
      if (!mod || !field) throw new Error(`${afterPiece.id}: unknown explicit effect '${raw}'`);
      return {
        raw,
        target: mod.prefix,
        field: mod.field,
        label: `${field.label} ${mod.mode === 'add' && mod.value >= 0 ? '+' : ''}${mod.value}`,
      };
    });
}

// ---------------------------------------------------------------------------
// WHAT A SWAP WOULD COST — read from the price, never re-derived (Viki, MR-41)
// ---------------------------------------------------------------------------
//
// ---- WHY THIS ROW IS KEPT AT ALL, AND WHEN THAT REASON DIES (Saga, MR-45) ---
//
// A8 IS THE PRESENTATION HALF OF HIS SWAP-COST ASK. Constantine, D15,
// 2026-08-08: *"switching sets should cost actions. PERHAPS THIS ACTION COSTS
// MORE OR LESS DEPENDING ON TALISMAN or starting relic… let's default to
// costing 2 actions… THAT WAY I CAN TRY EACH."*
//
// KEEP IT, AND THIS IS THE REASON THAT HOLDS: THIS IS THE ONLY PLACE A PLAYER
// MEETS THE PRICE. Settings › Advanced ships the RULE — the row keyed
// `swapCostRule`, labelled *"Weapon swap cost"*, in the settings table at
// `src/ui/screens/settings.js` — so A8 is not invisible, and the reason first
// written here, *"THE ONLY TRACE OF A8 ON A SCREEN"*, was overstated. But what
// Settings shows is a WORD: which of his three prices is in force, never what
// it costs. No shipped screen states the NUMBER of Actions a swap charges.
// `src/engine/combat.js` charges it and emits `armamentSwapped` carrying
// `cost`, and NO SCREEN SUBSCRIBES: the event lands in `combat.eventLog`,
// whose only reader under `src/ui` filters for `relicTriggered`, and the one
// consumer of the payload anywhere is engine test `28p`. He asked to TRY EACH,
// which is a comparison, and this row is the only place it is drawn.
//
//   DISCHARGE CONDITION: this reason dies the day any OTHER shipped screen puts
//   a swap price, as a number, in front of a player — a combat affordance, an
//   `armamentSwapped` reader, a Settings row that prints Actions instead of a
//   rule name. On that day this row is ordinary code, judged on its own merits
//   and deletable like any other. Measured undischarged at `dabd7d9`.
//
//   DO NOT KEEP IT BECAUSE IT IS THE LAST TRACE OF A REQUEST HE MADE. That was
//   the reason first recorded here and IT IS FALSE. The ask has other traces
//   and several are executable: the `flat`/`gear`/`category` rows of
//   `balance.equipment.swapCostRules` in `src/content/balance.js`, under a
//   paragraph quoting his sentence verbatim; `swapCostFor()`'s
//   gearOn/gearDelta/gearIgnored rungs in `src/model/loadout.js`; and engine
//   tests `28p`, `28q`, `28r` in `tests/engine.test.js`. ONE GREP DISCHARGES A
//   LAST-TRACE CLAIM, and the reader careful enough to run that grep is handed
//   an argument for the deletion this comment exists to prevent. A false reason
//   for a right keep is an invitation.
//
//   NO COUNT OF THOSE TRACES IS WRITTEN HERE, DELIBERATELY. The first version
//   of this marker printed one — *"at least five traces and four executable"*
//   — and it was wrong in the arithmetic and in two of the names it counted:
//   `content/balance.js` does not exist (it is `src/content/balance.js`), and
//   `engine test 28c` has never existed in this repo at all, while `28b` is
//   about which hand holds a piece. A number in a marker goes stale, and a
//   stale number is an argument for the deletion the marker exists to prevent
//   — which is the exact failure this paragraph already records against the
//   reason it replaced. Falsified by Sten; citations corrected by Bjorn; both
//   2026-08-15.
//
//   AND IT DOES RENDER, which the first version of this marker denied. Under
//   the shipped default (`flat`) a weapon swap costs the same either way and
//   the row correctly stays silent — but Settings › Advanced switches the rule
//   to `category` with no content and no code, and a heavy-weapon candidate
//   then reads 2 → 3. That is asserted, not asserted-about — the row named
//   "the live rule decides the row" in
//   `node tools/equipment-surface-receipts.mjs` measures it. So the keep does
//   not rest on a surface nobody can reach.
//
// THE DEFECT THIS REPLACES, MEASURED RATHER THAN ARGUED. This row used to be
// `beforeMods.swapCostDelta → afterMods.swapCostDelta` under the label
// *"Active-set swap Actions"* — a DELTA wearing a PRICE's name, and a second
// home for a fact `swapCostFor()` already owns. With one talisman authored
// (`self.swapCost=+2`, a CSV row and no code) it renders **0 → 2** while the
// engine charges:
//
//   flat (the shipped default)  2 → 2, and the +2 DISCARDED (gearIgnored 2)
//   gear                        2 → 4
//   category                    2 → 2, and the +2 DISCARDED (gearIgnored 2)
//
// Wrong under all three, and loudest under the default. The trigger is a
// content author adding a row and touching no code — the exact act Law 0 exists
// to make easy — so it is a mine under the content pipeline, not a cosmetic
// slip. `swapCostFor()` is the ONE place that knows the base, the rule, the
// category and the two gear channels; this reads its answer and does no
// arithmetic of its own. That is the whole fix: one fact, one home.
//
// SAME SET, BEFORE AND AFTER. Each combat-swappable slot is priced at the SAME
// set index in both loadouts — the candidate's own set for its own slot, the
// active set for the others — so the two numbers differ by this piece and
// nothing else. Pricing "your current set" against "the candidate's set" would
// fold a set change into a piece comparison and the row could move for a reason
// the player did not choose.
//
// WHY ONLY `swap === 'combat'` SLOTS. There is no mid-fight price for a slot
// you cannot change mid-fight. A talisman or an outfit still shows up here —
// it is WORN, so it moves the hands' price — and the row names the hand rather
// than implying you pay to change the charm.
//
// `gearIgnored` IS CONSULTED, WHICH IS THE POINT. A gear-off rule declines the
// talisman/relic delta; `swapCostFor` returns the declined amount precisely so
// "a talisman doing nothing says so instead of looking broken" (its own header).
// The row renders when the PRICE moves or when the DECLINED amount moves, so
// under `flat` the charm reads `2 → 2` with a sentence saying the rule refused
// its +2. Silence there would be the same defect one step quieter.
//
// ---- THE RELIC CHANNEL HAS NO SURFACE HERE, AND THAT IS ARM 2 (MR-46) -------
//
// `relicDelta` below is real and it CANCELS: a relic does not change when you
// slot a weapon, so it lands identically in `before` and `after` and a
// before/after comparison can never show it. That is correct for this row and
// it is NOT a gap this row can close. The starting-relic half of A8 —
// Constantine's *"depending on Talisman OR STARTING RELIC"* — therefore has no
// presentation anywhere in the tree: a relic authoring `swapCostDelta` today
// changes the price a player pays and NOTHING on any screen moves. It does not
// lie; it says nothing, which is the harder failure.
//
// MARKER, and it is a claim, so it is checked (MR-45 — a structural decision
// leaves a TRUE marker with its reason and its discharge condition):
//   · reason        — a relic's delta cancels in a before/after comparison
//   · discharge     — the day any shipped presentation reader's output moves
//                     when a `swapCostDelta` relic is worn, this paragraph is
//                     false and must go
//   · the wake      — `node tools/swap-cost-relic-surface.mjs` goes RED when a
//                     relic authors `swapCostDelta` while no reader moves, and
//                     RED the other way when a reader moves while this marker
//                     still says none does.
//
// THE WORD "Actions" HAS ONE HOME AND IT IS NOT THIS FILE (D26). I spelt it out
// in the row's label last night, and the note below needs the same word — so
// rather than write a second copy of it here and a third one there, both read
// the row that owns it: `derivedStatRules.presentation.energy`. Absent is NAMED,
// never guessed: a price row labelled `undefined Actions` is exactly the
// plausible-and-wrong render Law 0 clause 5 is about, and `statProjection`
// already throws by name for the same table.
function actionsWord(registries) {
  const row = (((registries || {}).derivedStatRules || {}).presentation || {}).energy;
  const word = row && (row.faceLabel || row.label);
  if (!word) throw new Error('swapPriceChanges requires derivedStatRules.presentation.energy — the word a swap price is charged in has one home (D26)');
  return word;
}

function swapPriceChanges(registries, run, beforeLoadout, afterLoadout, meta, candidateSlotId, candidateSetIndex) {
  const rule = resolveSwapCostRule(registries, meta);
  const unit = actionsWord(registries);
  const relicDelta = passiveSum(registries, run.relics || [], 'swapCostDelta');
  const rows = [];
  for (const slot of (registries.equipment.slots || [])) {
    if (slot.swap !== 'combat') continue;
    const setIndex = slot.id === candidateSlotId
      ? candidateSetIndex
      : Number((afterLoadout.active || {})[slot.id]) || 0;
    const priceIn = (loadout) => swapCostFor(registries, {
      rule, loadout, classId: run.class, slotId: slot.id, setIndex, relicDelta,
    });
    const before = priceIn(beforeLoadout);
    const after = priceIn(afterLoadout);
    const declined = after.gearIgnored - before.gearIgnored;
    if (before.cost === after.cost && declined === 0) continue;
    rows.push({
      id: `swapCost:${slot.id}`,
      // Actions, not Energy (D17 message 3) — the same resource, the same
      // rename, and a comparison row that kept the old noun would be the one
      // place a player met both words in one session.
      label: `${slot.label} swap ${unit}`,
      before: before.cost,
      after: after.cost,
      ruleId: after.ruleId,
      // THE SENTENCE IS SUNNA'S, ADOPTED VERBATIM (MR-77), and it is a
      // correction rather than a rewrite. What it replaces said *"Flat does not
      // charge gear — +2 not applied."* and three things were wrong with it:
      //
      //   · "gear" is an INTERNAL ID that leaked. She counted it: the word
      //     occurs exactly ONCE in player-facing prose, in a Settings ›
      //     Advanced explainer a default-rule player has by definition never
      //     opened — and in that same sentence the game's own name for the
      //     concept is the rule label "Talisman & relic". The note reached past
      //     the game's word to ours.
      //   · "Flat" stood as a bare subject, so a proper noun read as an adverb.
      //     `${label} swap costs` makes it modify the thing it names.
      //   · "+2" dropped the unit every other number on this row carries, which
      //     is why `unit` is threaded through both strings above.
      //
      // No rule row is a legal state (an unauthored table — the price falls to
      // the default), so the subject degrades to a bare "Swap costs" rather
      // than into "This rule swap costs".
      note: declined === 0 ? '' : `${rule && rule.label ? `${rule.label} swap costs` : 'Swap costs'} ignore talismans and relics`
        + ` — this ${declined > 0 ? '+' : ''}${declined} ${unit} is not charged.`,
    });
  }
  return rows;
}

function candidateReceipt(registries, run, candidate, beforeRoles, meta) {
  const slot = (registries.equipment.slots || []).find((row) => row.id === candidate.slotId);
  if (!slot) throw new Error(`Unknown comparison slot '${candidate.slotId}'`);
  const setIndex = Number(candidate.setIndex);
  if (!Number.isInteger(setIndex) || setIndex < 0) throw new Error('Equipment comparison needs a non-negative set index');
  const piece = pieceFor(registries, run.class, candidate.pieceId, slot);
  if (candidate.pieceId && !piece) throw new Error(`Unknown comparison piece '${candidate.pieceId}'`);

  const loadout = structuredClone(run.loadout);
  if (!Array.isArray(loadout.sets[slot.id]) || setIndex >= loadout.sets[slot.id].length) {
    throw new Error(`${slot.id}: comparison set ${setIndex} does not exist`);
  }
  const beforePiece = equippedIn(registries, run.loadout, run.class, slot.id);
  loadout.sets[slot.id][setIndex] = piece ? piece.id : null;
  loadout.active[slot.id] = setIndex;
  const comparedRun = { ...run, loadout };
  const afterRoles = rolesFor(registries, comparedRun);
  const beforeByRole = new Map(beforeRoles.map((row) => [row.role, row]));
  const beforeMods = runMods(registries, run.loadout, run.class);
  const afterMods = runMods(registries, loadout, run.class);
  const resourceChanges = [];
  if (beforeMods.maxHp !== afterMods.maxHp) {
    resourceChanges.push({
      id: 'maxHp',
      label: 'Max HP',
      before: run.maxHp,
      after: run.maxHp + afterMods.maxHp - beforeMods.maxHp,
    });
  }
  resourceChanges.push(...swapPriceChanges(registries, run, run.loadout, loadout, meta, slot.id, setIndex));
  const beforePoise = playerPoiseThresholdReceipt(registries, run);
  const afterPoise = playerPoiseThresholdReceipt(registries, comparedRun);
  return {
    slotId: slot.id,
    setIndex,
    pieceId: piece && piece.id,
    pieceName: piece ? piece.name : 'Bare',
    requirement: piece ? requirementsFor(registries, run, [piece])[0] || {
      itemId: piece.id, pieceName: piece.name, requirements: [], failures: [], ok: true,
    } : null,
    roles: afterRoles.map((after) => ({
      role: after.role,
      beforeName: beforeByRole.get(after.role).profile.displayName,
      afterName: after.profile.displayName,
      beforeValue: beforeByRole.get(after.role).receipt.value,
      afterValue: after.receipt.value,
      afterSchool: after.profile.damageSchool,
      afterTags: after.profile.tags || [],
    })),
    addedEffects: explicitEffects(registries, beforePiece, piece),
    resourceChanges,
    poise: {
      before: beforePoise.value,
      after: afterPoise.value,
      active: false,
      note: afterPoise.note,
    },
  };
}

// `meta` is the profile whose `settings.swapCostRule` picks the live price rule
// — the SAME resolver `createCombat` uses, so the screen and the engine cannot
// disagree about which rule is on. An absent `meta` resolves to the shipping
// default exactly as `createCombat(…, { swapCostRule: null })` does; the rule
// that actually priced each row is returned on the row (`ruleId`) so a screen
// that forgot to hand its settings over is readable rather than plausible.
export function equipmentSurfaceReceipt(registries, run, { candidate = null, meta = null } = {}) {
  if (!run || !run.loadout) throw new Error('equipmentSurfaceReceipt requires a run loadout');
  const roleCopies = { ...registries.balance.equipment.roleCopies };
  const roles = rolesFor(registries, run);
  const signatureId = registries.classes.get(run.class).startingSignatureCard;
  const receipt = {
    roleCopies,
    roles,
    signature: {
      cardId: signatureId,
      name: registries.cards.get(signatureId).name,
      copies: roleCopies.signature,
    },
    requirements: requirementsFor(registries, run, equippedPieces(registries, run.loadout, run.class)),
    poise: playerPoiseThresholdReceipt(registries, run),
  };
  if (candidate) receipt.candidate = candidateReceipt(registries, run, candidate, roles, meta);
  return receipt;
}
