// src/model/loadout/deckPlan.js — the starting-deck plan.
// A part of src/model/loadout.js (split from one file; behaviour unchanged).

import { profileById } from './shape.js';
import { equipmentKitPlan } from './kit.js';
import { handSource } from './weaponPackages.js';
import { grantSourceFor, startingDeckConfig, sortBySourceOrder } from './grantSources.js';
import { desiredGrantInstances } from './grants.js';

/** Cards a source hands over outright, one copy each, before any filler. */
function grantRefsFor(registries, loadout, classId, cfg, techniqueRow) {
  const cls = registries.classes.get(classId);
  const grants = [];

  // Weapon — the technique the equipped armament teaches. Weapon ATTACK grants
  // (priorityAttackRefs) are not counted here: they are dealt inside the attack
  // quota by quotaRefs, so counting them again would charge them twice.
  const hasCombatKit = ['right', 'left'].some((hand) => handSource(registries, loadout, classId, hand).package?.combatKit);
  // The unarmed technique IS the Dodge Roll, and every deck already carries
  // one item-owned Dodge Roll (desiredGrantInstances), so it is not granted a
  // second time as a technique slot.
  const unarmedDodge = profileById(registries, ((registries.balance || {}).equipment || {}).unarmedProfiles?.technique)?.baseCardId;
  if (techniqueRow && techniqueRow.profile && !hasCombatKit && techniqueRow.profile.baseCardId !== unarmedDodge) {
    grants.push({
      source: grantSourceFor(cfg, 'weapon'),
      cardId: techniqueRow.profile.baseCardId,
      equipmentRole: 'technique',
      profileId: techniqueRow.profile.id,
    });
  }

  // NOT HERE: the cards a `bound` piece carries (equipmentGrants.csv). They
  // used to be pushed as plain run-owned refs, which is why they stayed in the
  // deck after the piece was unequipped and why a bound piece equipped mid-run
  // brought nothing — round nineteen's finding, and the owner's ruling
  // (2026-09-03): if the item is not equipped, its cards are gone. So they are
  // ITEM-OWNED instances, minted by desiredGrantInstances alongside package
  // grants and weapon arts, and swept by the same reconcile. startingDeckPlan
  // counts them against the cap through that door, never through this list.

  // The validator names a non-array `global.grants`, so a bad bundle does not
  // boot — but this is the PLANNER, reached by tools and fixtures with
  // hand-built configs that never went through that door. It reads the shape it
  // needs rather than trusting that someone else checked.
  const globalGrants = (cfg.global || {}).grants;
  if (Array.isArray(globalGrants)) {
    for (const cardId of globalGrants) grants.push({ source: grantSourceFor(cfg, 'global'), cardId });
  }
  if (cls.startingSignatureCard) grants.push({ source: grantSourceFor(cfg, 'class'), cardId: cls.startingSignatureCard });
  // The class ability card (plan phase 5a, proposal §4): one copy, beside the
  // signature, from the same source.
  if (cls.abilityCard) grants.push({ source: grantSourceFor(cfg, 'class'), cardId: cls.abilityCard });

  // DEALT IN THE AUTHORED ORDER. `sourceOrder` is a list of grantSource tag ids;
  // a source it does not name is dealt last, in the order it was pushed. Stable,
  // so two grants from the same source keep their authored sequence.
  return sortBySourceOrder(cfg, grants, (grant) => grant.source);
}

/**
 * startingDeckPlan(registries, loadout, classId) → the arithmetic, no cards.
 *
 * Grants are dealt first and are never dropped; filler is what the budget has
 * left, split between attack and guard by the class bias. `minFiller` is the
 * invariant in both branches of `growToFit` — the toggle only decides whether
 * the deck size gives way (true) or the content author does (false).
 */
export function startingDeckPlan(registries, loadout, classId) {
  const cfg = startingDeckConfig(registries);
  if (!cfg) return null;
  const cap = Number(registries.balance.startingDeckSize);
  const rows = equipmentKitPlan(registries, loadout, classId);
  const grants = grantRefsFor(registries, loadout, classId, cfg, rows.find((row) => row.role === 'technique'));

  // Cards the package layer mints (reconcileGrantedCards installs them itself at
  // run creation, so they are COUNTED here and never pushed into `grants` —
  // pushing would deal each card twice). Weapon ARTS are counted the same way:
  // they are equally real cards in the opening hand, and under the cap rule
  // below there is nothing to refuse, so there is no longer any reason to treat
  // them differently from grants. That asymmetry existed only to avoid failing
  // the shipped bundle, and the rule that made it fail is gone.
  const packageCards = desiredGrantInstances(registries, { loadout, class: classId }).length;

  // THE CAP APPLIES TO THE BASE CARDS, AND ONLY AT CREATION (owner ruling,
  // 2026-09-03). Bound cards are dealt first and are never capped, dropped or
  // refused; the cap decides how many base strikes and defends are minted on
  // top of them, and nothing else. If equipment alone meets or exceeds the cap,
  // no base cards are minted and the run begins with only its unique cards —
  // that is a balance question for whoever authors the weapons, not an error.
  //
  // Which is why `growToFit` and `minFiller` are gone. Both existed to decide
  // who yields when grants got greedy: the deck size, or the content author.
  // Nobody yields now. A floor of basic cards is not a rule either — it is
  // simply what the cap leaves over, and the unarmed profiles are what those
  // cards LOOK like when a hand is bare.
  const bound = grants.length + packageCards;
  const filler = Math.max(0, cap - bound);

  const bias = Number(
    ((cfg.classes || {})[classId] || {}).strikeBias ?? cfg.defaultStrikeBias ?? 0.5
  );
  // An odd filler count cannot split evenly, so one role wins the remainder.
  // Authored, not assumed: `oddFillerGoesTo` names it and defaults to attack.
  const oddGoesToAttack = (cfg.oddFillerGoesTo ?? 'attack') !== 'guard';
  const exact = filler * bias;
  const attackCount = Math.min(filler, Math.max(0, oddGoesToAttack
    ? Math.round(exact)
    : Math.ceil(exact - 0.5)));
  return Object.freeze({
    size: bound + filler,
    grants: Object.freeze(grants.map(Object.freeze)),
    filler,
    attackCount,
    guardCount: filler - attackCount,
    bias,
    oddGoesToAttack,
    cap,
    // Counted against the cap, dealt by reconcileGrantedCards rather than by
    // this plan, so `grants` stays the deal-out list it is used as.
    packageCards,
  });
}
