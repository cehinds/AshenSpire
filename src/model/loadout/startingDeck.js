// src/model/loadout/startingDeck.js — the composed starting deck: refs, ordering and findings.
// A part of src/model/loadout.js (split from one file; behaviour unchanged).

import { armourIsStartingEligible } from '../startingKits.js';
import { resolveCreationHands, classCreationConfig } from '../characterCreation.js';
import { createLoadout } from './shape.js';
import { equipmentKitPlan } from './kit.js';
import { buildEquippedWeaponCardPlan } from './weaponPlan.js';
import { startingDeckConfig, boundGrantProblems, sortBySourceOrder } from './grantSources.js';
import { startingDeckPlan } from './deckPlan.js';

/**
 * The composed-deck half of validateEquipment.
 *
 * The cap rule is evaluated whatever `growToFit` says, so flipping the toggle
 * can never turn sound content unsound behind your back. When growToFit is on
 * the overrun is reported through `startingDeckWarnings` instead of here — one
 * validation truth, two severities.
 */
export function startingDeckProblems(registries) {
  return startingDeckFindings(registries).problems;
}

/** Overruns a growing deck absorbed. Sound content, worth seeing. */
export function startingDeckWarnings(registries) {
  return startingDeckFindings(registries).warnings;
}

/**
 * grantSourceIds(registries) -> [tagId]
 *
 * The vocabulary of "where a starting card came from", READ FROM THE TAG
 * TABLES rather than typed here. It used to be a frozen array in this file,
 * which is the shape the owner ruled against: adding a sixth source meant
 * editing code. It is now a domain (`grantSource`) with a row per source, so a
 * new one is a spreadsheet line like every other word in the game.
 *
 * Authoring order is the vocabulary's order, and that is the order bound cards
 * are dealt in — `sourceOrder` in balance may re-rank them, but the legal set
 * is whatever the registry holds.
 */
function grantSourceIds(registries) {
  return ((registries || {}).tags || [])
    .filter((tag) => tag && tag.domain === 'grantSource')
    .map((tag) => tag.id);
}

/**
 * The seams in THIS FILE that mint a bound card. These are engine structure,
 * not content vocabulary: there is a weapon seam and an armour seam whatever an
 * author names their sources. Each is bound to a grantSource tag by
 * `startingDeck.sources`, and every one of them must be bound — an unbound seam
 * would stamp `undefined` and sort its cards last in silence.
 *
 * A source with no seam (today: `from:relic`) is legal and needs no entry; it
 * is declared vocabulary waiting for a minter.
 */
const MINTED_GRANT_ROLES = ['global', 'armor', 'weapon', 'class'];

function startingDeckFindings(registries) {
  const problems = [];
  const warnings = [];
  const cfg = ((registries.balance || {}).equipment || {}).startingDeck;
  if (!cfg) return { problems, warnings };
  if (typeof cfg.enabled !== 'boolean') problems.push('startingDeck.enabled must be boolean');
  if (cfg.oddFillerGoesTo !== undefined && !['attack', 'guard'].includes(cfg.oddFillerGoesTo)) {
    problems.push(`startingDeck.oddFillerGoesTo must be 'attack' or 'guard' (got ${JSON.stringify(cfg.oddFillerGoesTo)}) — it names which role wins the remainder when the cap leaves an odd number of base cards`);
  }
  // The DECK SIZE, held here because the composed path is now the only reader of
  // it. The legacy roleCopies sum used to imply this — a fractional size could
  // never equal a sum of integer copies — and gating that check on the composed
  // path being off (round four) removed the implication without replacing it.
  // `10.5` then validated clean and planned `guardCount: 4.5`, which the copy
  // loop turned into five guards and an eleven-card deck.
  // sourceOrder is read by grantRefsFor to order the bound cards it deals, and a
  // malformed one used to surface as a TypeError rather than a content problem.
  // The vocabulary is the grantSource tag domain, so this validates against the
  // registry rather than a list typed in this file.
  if (cfg.sourceOrder !== undefined) {
    const legal = grantSourceIds(registries);
    if (!Array.isArray(cfg.sourceOrder)) {
      problems.push(`startingDeck.sourceOrder must be an array of grant-source tags (got ${JSON.stringify(cfg.sourceOrder)}) — it names the order bound cards are dealt in`);
    } else {
      for (const source of cfg.sourceOrder) {
        if (!legal.includes(source)) {
          problems.push(`startingDeck.sourceOrder names unknown grant source '${source}' (legal: ${legal.join(', ') || 'none registered — add nodes under the grantSource root in nodes.csv'})`);
        }
      }
    }
  }

  // `sources` binds each minting seam to one of those tags. Without it the ids
  // were typed at the seams, so renaming a grantSource tag AND its sourceOrder
  // entry passed everything above and then dealt that source's cards last —
  // clean validation, wrong deck. Checked here so the rename fails at the door
  // instead of at the table: every seam bound, to a registered source.
  {
    const legal = grantSourceIds(registries);
    const map = cfg.sources;
    if (map === undefined || map === null || typeof map !== 'object' || Array.isArray(map)) {
      problems.push(`startingDeck.sources must be an object binding each minting seam (${MINTED_GRANT_ROLES.join(', ')}) to a grant-source tag (got ${JSON.stringify(map)}) — it is what each seam stamps on the cards it mints`);
    } else {
      for (const role of MINTED_GRANT_ROLES) {
        const bound = map[role];
        if (typeof bound !== 'string' || !bound) {
          problems.push(`startingDeck.sources.${role} must name a grant-source tag (got ${JSON.stringify(bound)}) — the '${role}' seam mints cards and would stamp nothing, sorting them last in silence`);
        } else if (!legal.includes(bound)) {
          problems.push(`startingDeck.sources.${role} names unknown grant source '${bound}' (legal: ${legal.join(', ') || 'none registered — add nodes under the grantSource root in nodes.csv'})`);
        } else if (Array.isArray(cfg.sourceOrder) && !cfg.sourceOrder.includes(bound)) {
          // Legal — an unranked source is dealt last by contract — but almost
          // never what an author meant, so it is SEEN rather than refused.
          warnings.push(`startingDeck.sources.${role} names '${bound}', which sourceOrder does not rank — the '${role}' seam's cards are dealt after every ranked source`);
        }
      }
      for (const role of Object.keys(map)) {
        if (!MINTED_GRANT_ROLES.includes(role)) {
          problems.push(`startingDeck.sources names unknown seam '${role}' (the engine mints: ${MINTED_GRANT_ROLES.join(', ')}) — nothing reads this binding, so the tag it names would never be stamped`);
        }
      }
    }
  }
  const authoredSize = (registries.balance || {}).startingDeckSize;
  if (!Number.isInteger(authoredSize) || authoredSize < 0) {
    problems.push(`startingDeckSize must be a non-negative integer (got ${JSON.stringify(authoredSize)}) — the composed plan divides it into role counts, and a fraction becomes a card that half exists`);
  }
  // The DEFAULT bias, held to the same rule as an override. A class with no
  // override falls back to it, so a malformed default is not a cosmetic typo:
  // it reaches startingDeckPlan as NaN and run creation dies restamping against
  // an authored NaN quota, with nothing said at the door.
  const inBias = (v) => Number.isFinite(v) && v >= 0 && v <= 1;
  if (cfg.defaultStrikeBias !== undefined && !inBias(cfg.defaultStrikeBias)) {
    problems.push(`startingDeck.defaultStrikeBias must be between 0 and 1 (got ${JSON.stringify(cfg.defaultStrikeBias)})`);
  }
  for (const [classId, row] of Object.entries(cfg.classes || {})) {
    if (!registries.classes.has(classId)) problems.push(`startingDeck.classes names unknown class '${classId}'`);
    const bias = row && row.strikeBias;
    if (!inBias(bias)) {
      problems.push(`startingDeck.classes.${classId}.strikeBias must be between 0 and 1 (got ${bias})`);
    }
  }
  const globalGrants = (cfg.global || {}).grants;
  if (globalGrants !== undefined && !Array.isArray(globalGrants)) {
    problems.push(`startingDeck.global.grants must be an array of card ids (got ${JSON.stringify(globalGrants)})`);
  } else {
    for (const cardId of globalGrants || []) {
      if (!registries.cards.has(cardId)) problems.push(`startingDeck.global.grants names unknown card '${cardId}'`);
    }
  }
  problems.push(...boundGrantProblems(registries));

  if (cfg.enabled !== true || problems.length) return { problems, warnings };

  // NO BUDGET REFUSAL, AND NO WEAPON-ART WARNING. Both existed to police a cap
  // that no longer works that way: the cap governs how many BASE cards are
  // minted, not how many cards a run may begin with. Equipment that fills or
  // exceeds it simply leaves no room for strikes and defends, which is a
  // balance question for whoever authors the weapons rather than something
  // validation can answer. The starseer and herald decks that read 11 against
  // an authored 10 were never wrong — they are 10 base cards' worth of cap with
  // one weapon art on top.
  //
  // What remains worth saying is what the composed deck WILL be, per class, so
  // an author can see the shape their content produces without starting a run.
  // Reported over EVERY loadout a player can begin in, not just the baseline —
  // the enumeration that four review rounds went into building for the budget
  // check. The budget is gone; the enumeration is not, because the question it
  // answers ("what can a player actually start in") is the same one, and a kit
  // that deals no base cards is worth seeing whichever kit it is.
  const seenShape = new Set();
  for (const classId of registries.classes.ids()) {
    let candidates = [];
    // A validation pass never throws on bad content — a bundle whose slots or
    // profiles are broken is named by the rules that own them.
    try { candidates = selectableStartingLoadouts(registries, classId); } catch { continue; }
    for (const { label, loadout } of candidates) {
      let plan = null;
      try { plan = startingDeckPlan(registries, loadout, classId); } catch (e) {
        problems.push(`startingDeck: cannot plan '${classId}' ${label}: ${e.message}`);
        continue;
      }
      if (!plan || plan.filler > 0) continue;
      const detail = `startingDeck: class '${classId}' ${label} begins with ${plan.size} card(s), all equipment-bound — its gear meets the ${plan.cap}-card cap on its own, so no base strikes or defends are dealt`;
      if (seenShape.has(detail)) continue;
      seenShape.add(detail);
      warnings.push(detail);
    }
  }

  return { problems, warnings };
}

/**
 * selectableStartingLoadouts(registries, classId) -> [{ label, loadout }]
 *
 * Every loadout a player can actually BEGIN in. This asks character creation
 * what it accepts rather than guessing the axes: three rounds of review found
 * three of them in turn (the baseline kit, then the armour, then the hands,
 * each chosen independently of the others), because the enumeration was built
 * from the kit table while `resolveCreationHands`/`resolveStartingArmour` were
 * the things actually deciding. So the candidates come from
 * characterCreation's own `handIds` and `armourIds`, paired through creation's
 * own resolver — an incompatible pair throws there and is skipped here, with no
 * second copy of the compatibility rule to drift.
 *
 * The authored kits ride along as a floor, so a class whose kit names a piece
 * outside handIds is still checked.
 */
function selectableStartingLoadouts(registries, classId) {
  const armours = (registries.equipment || {}).armour || [];
  const kits = ((registries.equipment || {}).startingKits || []).filter((kit) => kit.classId === classId);
  let creation = null;
  try { creation = classCreationConfig(registries, classId); } catch { creation = null; }
  const handIds = [null, ...((creation && creation.handIds) || [])];
  // ASK THE PREDICATE, DO NOT RE-LIST THE AXES. `armourIds` is one of THREE ways
  // an outfit becomes startable — free (`unlock === ''`) and earned-by-unlock are
  // the others — and enumerating the one I remembered is what three earlier
  // rounds each caught one axis later. startingKits.js owns the real answer, and
  // run creation asks it, so this asks the same function with the most permissive
  // meta there is: every unlock the bundle can ever grant. Nothing a player can
  // start in is outside this set, and nothing outside the bundle is inside it.
  const everyUnlock = { unlocked: ((registries.unlocks || []).map((row) => row && row.id)).filter(Boolean) };
  const armourRows = armours.filter((row) => row.classId === classId
    && armourIsStartingEligible(row, everyUnlock, registries, classId));

  const out = [];
  const seen = new Set();
  const add = (label, loadout, key) => {
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ label, loadout });
  };

  for (const armour of armourRows.length ? armourRows : [null]) {
    const armourWhere = armour ? ` + armour '${armour.id}'` : '';
    // The authored kits, whole.
    for (const kit of kits) {
      add(`kit '${kit.id}'${armourWhere}`, createLoadout(registries, classId, kit, armour),
        `kit:${kit.id}:${armour ? armour.id : ''}`);
    }
    // And every hand pair creation would accept, which is where the kits stop
    // being the whole story: two grant-bearing pieces that share no kit can
    // still be picked together.
    for (const rightHand of handIds) {
      for (const leftHand of handIds) {
        if (rightHand === null && leftHand === null) continue;
        let hands;
        try {
          hands = resolveCreationHands(registries, classId, { rightHand, leftHand }, {});
        } catch {
          continue; // creation refuses this pair, so a player cannot reach it
        }
        const kit = { classId, rightHand: hands.rightHand || '', leftHand: hands.leftHand || '' };
        const where = `hands ${hands.rightHand || '-'}/${hands.leftHand || '-'}${armourWhere}`;
        add(where, createLoadout(registries, classId, kit, armour),
          `hands:${hands.rightHand || ''}:${hands.leftHand || ''}:${armour ? armour.id : ''}`);
      }
    }
  }
  if (!out.length) out.push({ label: 'default loadout', loadout: createLoadout(registries, classId) });
  return out;
}

/** The starting deck as instance-ready refs. */
export function startingDeckRefs(registries, loadout, classId) {
  const cls = registries.classes.get(classId);
  const plan = startingDeckPlan(registries, loadout, classId);
  const copies = ((registries.balance || {}).equipment || {}).roleCopies || {};
  const refs = [];

  // Composed path: attack and guard counts come from the plan, everything else
  // is a grant. Legacy path: the authored roleCopies distribution, verbatim.
  const attackSlotCount = plan ? plan.attackCount : undefined;
  const guardCopies = plan ? plan.guardCount : (copies.guard || 0);

  for (const row of equipmentKitPlan(registries, loadout, classId)) {
    if (row.role === 'attack') {
      const attackPlan = buildEquippedWeaponCardPlan(registries, loadout, classId, { attackSlotCount });
      refs.push(...attackPlan.slots.map((slot) => ({
        cardId: slot.cardId,
        equipmentRole: 'attack',
        profileId: slot.profileId,
        equipmentAttackSlotId: slot.equipmentAttackSlotId,
        equipmentPlanFingerprint: attackPlan.fingerprint,
        ...(slot.sourceHand ? { sourceHand: slot.sourceHand } : {}),
        ...(slot.weaponId ? { weaponId: slot.weaponId } : {}),
      })));
      continue;
    }
    if (row.role === 'guard') {
      for (let i = 0; i < guardCopies; i++) {
        refs.push({ cardId: row.profile.baseCardId, equipmentRole: 'guard', profileId: row.profile.id });
      }
      continue;
    }
    if (plan) continue; // technique is a grant under the composed path
    for (let i = 0; i < (copies[row.role] || 0); i++) {
      refs.push({ cardId: row.profile.baseCardId, equipmentRole: row.role, profileId: row.profile.id });
    }
  }

  if (!plan) {
    for (let i = 0; i < (copies.signature || 0); i++) refs.push({ cardId: cls.startingSignatureCard });
    if (cls.abilityCard) for (let i = 0; i < (copies.ability || 0); i++) refs.push({ cardId: cls.abilityCard });
    return refs;
  }
  for (const grant of plan.grants) {
    const { source, ...ref } = grant;
    // The provenance rides ALONG. It used to be discarded here, which left the
    // assembled deck with no way to answer "where did this card come from" —
    // so `sourceOrder` could order the plan but never the deck it produced.
    refs.push({ ...ref, grantSource: source });
  }
  return refs;
}

/**
 * Granted cards and default weapon arts reconcile against the EQUIPPED
 * packages on every authoritative restamp (contract-new outputs on the
 * adopted composer; dormant while no shipped armament authors either).
 * Deterministic instance ids make the reconcile idempotent and save-stable;
 * an instance whose armament left the hands leaves the deck with it.
 */
/**
 * orderStartingDeck(registries, run) -> run.deck
 *
 * SPEC says bound cards are dealt first, in `sourceOrder`. Until this ran, they
 * were dealt LAST: startingDeckRefs emits the base attack and guard refs before
 * it consumes the grants, and reconcileGrantedCards appends package grants and
 * weapon arts after that again — so the shipped starseer opened with four
 * strikes and three defends, then its technique, signature and art. The spec I
 * wrote and the code I wrote disagreed, and the spec is the one the owner ruled.
 *
 * Ordered ONCE, at creation, because "dealt" is a creation word: instances that
 * arrive later from a mid-run swap land where reconcile puts them.
 *
 * Base cards keep their relative order. That is not tidiness — the legacy
 * attack-slot migration binds `attack:0..N-1` by deck order, so reshuffling the
 * base cards among themselves would rebind them.
 */
export function orderStartingDeck(registries, run) {
  const cfg = startingDeckConfig(registries);
  if (!cfg || !Array.isArray(run.deck)) return run.deck;
  // A card either CARRIES its provenance or is a base card. No shape-guessing:
  // `grantSource` is written where the card is minted, in the same vocabulary
  // `sourceOrder` names, so this reads one field instead of inferring from
  // `grantedBy`/`sourceId`/role and drifting the day a fourth shape appears.
  const sourceOf = (card) => (card && card.grantSource) || null;
  const bound = [];
  const base = [];
  for (const card of run.deck) (sourceOf(card) === null ? base : bound).push(card);
  run.deck = [...sortBySourceOrder(cfg, bound, sourceOf), ...base];
  return run.deck;
}
