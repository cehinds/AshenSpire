#!/usr/bin/env node
// tools/contentreach.mjs — CAN A PLAYER EVER GET THIS CARD, RELIC OR EVENT?
//
// SPEC §9 M3 accepts when "every card/relic/event is reachable". Until this
// file that clause had no instrument: tools/statusreach.mjs answers the same
// question for statuses, and nothing answered it for the three kinds the
// milestone actually names. This walks the loaded content bundle and, for
// every card, relic, event, encounter and enemy row, finds at least one WAY IN
// — or goes red and names the row.
//
// ---------------------------------------------------------------------------
// THE ROUTES ARE READ OFF THE CODE THAT PICKS, NOT GUESSED. Every route below
// names the function that performs it, and wherever that function is pure
// this file CALLS it (relicInRewardPool, eligibleWeaponArts,
// WeaponCardPackageModel.fromPiece, boundGrantCardIds, encounterFitsSeat,
// finalTier) rather than restating its filter — a restated filter is a second
// home for the rule and it drifts. A route this list does not contain is NOT
// reach, and a row that only such a route would reach reads RED, loudly.
//
//   MAP — which node kinds a climb can produce at all (engine/mapgen.js via
//   mapConfigs[tier]): a type is live when its typeWeights row is > 0, a fixed
//   floor rule names it, or a min rule demands it; an Unknown node's outcome is
//   live when its unknownWeights row is > 0 (engine/encounters.js
//   resolveUnknownNode). Rewards behind a dead node kind are not credited.
//
//   CLASSES   a class is played when characterCreation.classes offers it
//             (model/characterCreation.js), or when a reached event carries
//             op 'swapClass' (engine/actions.js — random swaps pick any class).
//
//   ENCOUNTERS
//     E-roll   pool normal|elite, seat is a real seat, weight > 0, and the map
//              can produce that fight (engine/encounters.js rollEncounter,
//              main.js startFight; an Unknown 'fight' rolls the normal pool).
//     E-boss   pool boss, encounterFitsSeat for some seat at some tier the
//              climb plays (engine/actmap.js buildActMap boss pool — the
//              null-seat row joins at finalTier).
//     E-event  op 'startCombat' in an AVAILABLE choice of a reached event.
//   ENEMIES   named in a reached encounter's enemies[].
//
//   EVENTS
//     V-roll   ungated (no eventHistoryRequirements row) and the map can roll
//              an Unknown 'event' (resolveUnknownNode's `earned` filter).
//     V-chain  gated, and its requirement is satisfiable from choices that are
//              themselves achievable: the referenced event is reached AND the
//              referenced choice is visible (eventChoiceIds + the per-choice
//              requiresHistory — model/quests.js availableEventChoices).
//              Transitive: namelessRest is reached because namelessKeeper is,
//              which is because graveOfTheNameless rolls.
//
//   CARDS
//     C-pool   in a played class's cardPool — card rewards (rollCardRewardIds),
//              skill drafts (rollSkillDraftIds) and the shop (rollShopCards).
//     C-shop   colorless, rarity common|uncommon|rare, not a weapon art, and a
//              merchant can appear (rollShopCards' colorless half).
//     C-art    a weapon art the shop's art shelf sells (eligibleWeaponArts)
//              when a merchant can appear and weaponArtStock > 0.
//     C-class  a played class's startingSignatureCard or abilityCard, or
//              balance.equipment.startingDeck.global.grants
//              (model/loadout.js grantRefsFor).
//     C-equip  a card an OBTAINABLE armament puts in the deck: its
//              WeaponCardPackageModel (weapon arts, granted cards, priority
//              attacks, filler attack profile, combat-kit profiles), its guard
//              and technique profiles' baseCardId, its bound grants
//              (boundGrantCardIds) — plus the unarmed profiles, because an
//              empty hand is always a legal start. An armament is obtainable
//              from a starting kit, a creation handIds list, the drop table
//              (rollArmamentDrop: drops enabled, unlock '', dropWeight > 0, a
//              source with chance > 0 weighting its rarity) or the shop shelf
//              (armamentStock > 0 and an armamentCost row for its rarity).
//     C-coop   a co-op-only card: with a living party of 2+, every combat
//              reward adds one pick from COOP_CARD_IDS (tools/session.mjs
//              rollRewardFor — the LAN host is the co-op engine door).
//     C-inject op 'addCard' / 'addCardToDeck' inside a REACHED card (base or
//              upgrade — transitive), a reached enemy, an available choice of a
//              reached event, or a creation keepsake. This is how curses and
//              status cards are reached: through their injector, never free.
//
//   RELICS
//     R-drop   relicInRewardPool, rarity common|uncommon|rare, and an elite
//              fight, a treasure, or a merchant can happen (rollRelicReward,
//              buildShopStock).
//     R-boss   relicInRewardPool and rarity 'boss' (the boss reward,
//              main.js rollRelicReward(..., { rarities: ['boss'] })).
//     R-class  in a played class's creation relicIds (resolveCreationRelic) or
//              its kitRelic (model/state.js).
//     R-event  op 'addRelic' with an `id`, in an available choice of a reached
//              event or a keepsake; or op 'addRelic' random, which draws ANY
//              reward-pool relic regardless of rarity (engine/actions.js).
//
// ---------------------------------------------------------------------------
// THE READER TRAP (statusreach's header, one domain over). A row MENTIONED is
// not a row GRANTED: cardEquipmentExceptions names cards it restricts, a
// relic's rule text names statuses, the bundle's tagging names everything.
// Nothing here is a text scan. And an injector op found in a set this file
// does not model (a relic rule, a flask, a status hook) is a FLOOR, not a
// green and not a silent skip: it is a door nobody has enumerated yet.
//
// FLOORS — exit 2, never a pass:
//   F1  a population (cards, relics, events, encounters, enemies, classes) is empty
//   F2  a route family found nothing at all — the walk went blind
//   F3  an injector op sits in a set no route models (a new, unenumerated door)
//   F4  an armament's card package could not be read (the model threw)
//
// ALLOWLIST — ALLOWED_UNREACHABLE, below. A row may be declared intentionally
// unobtainable, WITH its reason. It is ratcheted: an allowlisted row that
// becomes reachable, or that no longer exists, is a failure, so the list can
// only shrink honestly. It is EMPTY at the commit that adds this file; nothing
// the first run found has been ruled intentional by the owner.
//
// Usage
//   node tools/contentreach.mjs             the shipped bundle
//   node tools/contentreach.mjs --json      machine-readable
//   node tools/contentreach.mjs --selftest  the planted corpus
//
// Exit codes
//   0  every row has a way in
//   1  an orphan (or a stale allowlist row)
//   2  a floor fired — this run judged nothing it can vouch for

import { pathToFileURL } from 'node:url';
import { createRegistries } from '../src/model/registries.js';
import { relicInRewardPool } from '../src/model/schemas.js';
import { eligibleWeaponArts } from '../src/model/armamentTrading.js';
import { WeaponCardPackageModel, boundGrantCardIds } from '../src/model/loadout.js';
import { encounterFitsSeat, finalTier } from '../src/model/seats.js';
import { eventChoiceHistoryRequirements as SHIPPED_CHOICE_REQUIREMENTS } from '../src/content/events.js';
import { COOP_CARD_IDS } from '../src/content/cards/coop.js';

// Declared-intentional orphans: { kind: 'cards'|'relics'|'events'|'encounters'|'enemies', id, why }.
export const ALLOWED_UNREACHABLE = [];

const KINDS = ['cards', 'relics', 'events', 'encounters', 'enemies'];
const CARD_OPS = new Set(['addCard', 'addCardToDeck']);
const INJECTOR_OPS = new Set(['addCard', 'addCardToDeck', 'addRelic', 'startCombat', 'swapClass']);
const DROP_RARITIES = ['common', 'uncommon', 'rare'];

/** Every { op } in a value whose op is in `ops`. */
function opsIn(node, ops, out = []) {
  if (Array.isArray(node)) {
    for (const n of node) opsIn(n, ops, out);
    return out;
  }
  if (node === null || typeof node !== 'object') return out;
  if (typeof node.op === 'string' && ops.has(node.op)) out.push(node);
  for (const v of Object.values(node)) opsIn(v, ops, out);
  return out;
}

const pos = (n) => Number.isFinite(n) && n > 0;

/** Which node kinds any tier's map config can produce (engine/mapgen.js). */
function mapCapabilities(bundle) {
  const cap = { monster: false, elite: false, event: false, merchant: false, treasure: false,
    unknownEvent: false, unknownFight: false, unknownTreasure: false, tiers: [] };
  for (const [tierKey, cfg] of Object.entries(bundle.mapConfigs || {})) {
    if (!cfg) continue;
    cap.tiers.push(Number(tierKey));
    const tw = cfg.typeWeights || {};
    const rules = cfg.floorRules || {};
    const fixed = new Set((rules.fixed || []).map((r) => r && r.type));
    const live = (type) => pos(tw[type]) || fixed.has(type);
    cap.monster ||= live('monster');
    cap.elite ||= live('elite') || pos(rules.minElites);
    cap.merchant ||= live('merchant') || pos(rules.minMerchants);
    cap.treasure ||= live('treasure');
    const eventNode = live('event');
    cap.event ||= eventNode;
    const uw = cfg.unknownWeights || {};
    if (eventNode) {
      cap.unknownEvent ||= pos(uw.event);
      cap.unknownFight ||= pos(uw.fight);
      cap.unknownTreasure ||= pos(uw.treasure);
    }
  }
  cap.tiers.sort((a, b) => a - b);
  return cap;
}

/**
 * contentReach(bundle, opts) → the whole verdict, as data. ONE function, called
 * by main(), by --selftest and by the test, so a plant cannot pass against a
 * restated mechanism while the real run is red (statusreach's discipline).
 */
export function contentReach(bundle, opts = {}) {
  const choiceRequirements = opts.choiceRequirements || SHIPPED_CHOICE_REQUIREMENTS;
  const allowlist = opts.allowlist || ALLOWED_UNREACHABLE;
  const floors = [];
  let byId = {};
  let randomRelic = null; // where the first reached 'addRelic random' lives
  const witness = Object.fromEntries(KINDS.map((k) => [k, new Map()]));
  const note = (kind, id, where) => {
    if (typeof id !== 'string' || !id) return false;
    const m = witness[kind];
    const fresh = !m.has(id);
    if (fresh) m.set(id, []);
    const list = m.get(id);
    if (list.length < 8 && !list.includes(where)) list.push(where);
    return fresh;
  };

  // ---- populations, F1 -------------------------------------------------------
  const rows = (x) => (Array.isArray(x) ? x.filter((r) => r && typeof r.id === 'string') : []);
  const pop = {
    cards: rows(bundle.cards), relics: rows(bundle.relics), events: rows(bundle.events),
    encounters: rows(bundle.encounters), enemies: rows(bundle.enemies),
  };
  for (const [k, list] of [...Object.entries(pop), ['classes', rows(bundle.classes)]]) {
    if (list.length === 0) floors.push(`F1  the ${k} table is EMPTY — there is no population to rule on`);
  }
  if (floors.length) return finish();

  const R = createRegistries(bundle);
  const cap = mapCapabilities(bundle);
  byId = Object.fromEntries(KINDS.map((k) => [k, new Map(pop[k].map((r) => [r.id, r]))]));
  const seats = rows(bundle.seats).map((s) => s.id);
  const bal = bundle.balance || {};
  const shop = bal.shop || {};
  const merchant = cap.merchant;
  const creation = (bundle.characterCreation || {}).classes || {};
  const keepsakes = (bundle.characterCreation || {}).keepsakes || [];

  // ---- F3: an injector in a set no route models --------------------------------
  // Modelled homes: cards, enemies, events, characterCreation.keepsakes. The
  // tagging/node tables are vocabulary and carry no ops; everything else is
  // scanned so a new door reads loudly instead of as absence.
  for (const [key, value] of Object.entries(bundle)) {
    if (['cards', 'enemies', 'events'].includes(key)) continue;
    const scanned = key === 'characterCreation'
      ? Object.fromEntries(Object.entries(value || {}).filter(([k]) => k !== 'keepsakes'))
      : value;
    for (const op of opsIn(scanned, INJECTOR_OPS)) {
      floors.push(`F3  op '${op.op}' found in bundle.${key} — no route in this file models that set; enumerate it from the engine before trusting any verdict`);
    }
  }

  // ---- classes -----------------------------------------------------------------
  const played = new Set(Object.keys(creation).filter((id) => R.classes.has(id)));

  // ---- fixpoint over events / encounters / enemies / cards / relics ------------
  const achievable = new Set(); // `${eventId}|${choiceId}`
  const reqMet = (req) => {
    if (!req) return true;
    const has = (ref) => ref && achievable.has(`${ref.eventId}|${ref.choiceId}`);
    if ((req.all || []).some((ref) => !has(ref))) return false;
    if (req.any && !req.any.some(has)) return false;
    return true; // `none` is met by not having done a thing, which every run can manage
  };
  const choicesOf = (ev) => {
    const ids = (bundle.eventChoiceIds || {})[ev.id];
    if (!Array.isArray(ev.choices) || !Array.isArray(ids) || ids.length !== ev.choices.length) return [];
    const reqs = choiceRequirements[ev.id] || [];
    return ev.choices.map((c, i) => ({ ...c, id: ids[i], requiresHistory: reqs[i] }));
  };
  const gates = bundle.eventHistoryRequirements || {};

  // Static routes first.
  if (cap.unknownEvent) {
    for (const ev of pop.events) if (!gates[ev.id]) note('events', ev.id, 'V-roll unknown-node pool (ungated)');
  }
  const canFight = { normal: cap.monster || cap.unknownFight, elite: cap.elite };
  for (const enc of pop.encounters) {
    if ((enc.pool === 'normal' || enc.pool === 'elite') && canFight[enc.pool] && seats.includes(enc.seat) && pos(enc.weight)) {
      note('encounters', enc.id, `E-roll ${enc.pool} pool, seat ${enc.seat}`);
    }
    if (enc.pool === 'boss') {
      const last = finalTier(R);
      const fits = seats.some((seat) => cap.tiers.some((tier) => encounterFitsSeat(enc, { seat, tier, finalTier: last })));
      if (fits) note('encounters', enc.id, `E-boss destination${enc.seat === null ? ' (null seat, final tier)' : `, seat ${enc.seat}`}`);
    }
  }

  // Obtainable armaments (C-equip's first half).
  const armaments = (bundle.equipment || {}).armaments || [];
  const drops = (bal.equipment || {}).drops || {};
  const dropSources = Object.entries(drops.chance || {}).filter(([src, ch]) => pos(ch)
    && ((src === 'treasure' && (cap.treasure || cap.unknownTreasure)) || (src === 'elite' && cap.elite) || src === 'boss'));
  const armWhy = new Map();
  const markArm = (id, why) => { if (id && !armWhy.has(id)) armWhy.set(id, why); };
  for (const kit of (bundle.equipment || {}).startingKits || []) {
    if (!kit || !played.has(kit.classId)) continue;
    markArm(kit.rightHand, `starting kit ${kit.id}`);
    markArm(kit.leftHand, `starting kit ${kit.id}`);
  }
  for (const cls of played) for (const id of (creation[cls] || {}).handIds || []) markArm(id, `creation handIds (${cls})`);
  for (const piece of armaments) {
    if (drops.enabled && piece.unlock === '' && pos(piece.dropWeight)) {
      const src = dropSources.find(([s]) => pos(((drops.rarityWeights || {})[s] || {})[piece.rarity]));
      if (src) markArm(piece.id, `armament drop (${src[0]})`);
    }
    if (merchant && pos(shop.armamentStock) && (shop.armamentCost || {})[piece.rarity]) markArm(piece.id, 'shop armament shelf');
  }
  const profiles = new Map((((bundle.equipment || {}).basicCardProfiles) || []).map((p) => [p.id, p]));
  const profileCard = (pid, where) => {
    const p = profiles.get(pid);
    if (p && p.baseCardId) note('cards', p.baseCardId, where);
  };
  for (const [role, pid] of Object.entries((bal.equipment || {}).unarmedProfiles || {})) profileCard(pid, `C-equip unarmed ${role} profile ${pid}`);
  for (const id of (((bal.equipment || {}).startingDeck || {}).global || {}).grants || []) note('cards', id, 'C-class startingDeck.global.grants');
  for (const piece of armaments) {
    const why = armWhy.get(piece.id);
    if (!why) continue;
    const at = `C-equip ${piece.id} (${why})`;
    let pkg = null;
    try {
      pkg = WeaponCardPackageModel.fromPiece(R, piece);
    } catch (e) {
      floors.push(`F4  ${piece.id}: its weapon card package could not be read (${e.message})`);
    }
    if (pkg) {
      for (const id of pkg.weaponArtDefaults) note('cards', id, `${at} weapon art`);
      for (const g of pkg.grantedCards) note('cards', g.cardId, `${at} granted`);
      for (const p of pkg.priorityAttackRefs) note('cards', p.cardId, `${at} priority attack`);
      profileCard(pkg.fillerAttackProfileId, `${at} filler attack`);
      if (pkg.combatKit) {
        profileCard(pkg.combatKit.attackProfileId, `${at} kit attack`);
        profileCard(pkg.combatKit.guardProfileId, `${at} kit guard`);
      }
    }
    profileCard(piece.guardProfile, `${at} guard profile`);
    profileCard(piece.techniqueProfile, `${at} technique profile`);
    for (const id of boundGrantCardIds(R, piece)) note('cards', id, `${at} bound grant`);
  }
  if (merchant && pos(shop.weaponArtStock)) for (const id of eligibleWeaponArts(R)) note('cards', id, 'C-art shop weapon-art shelf');
  if (merchant && pos(shop.cardStock)) {
    const arts = new Set(eligibleWeaponArts(R));
    for (const c of pop.cards) {
      if (c.class === 'colorless' && DROP_RARITIES.includes(c.rarity) && !arts.has(c.id)) note('cards', c.id, 'C-shop colorless shelf');
    }
  }

  if (pop.encounters.some((e) => witness.encounters.has(e.id))) {
    for (const id of opts.coopCardIds || COOP_CARD_IDS) note('cards', id, 'C-coop party combat reward (tools/session.mjs rollRewardFor)');
  }

  // Keepsakes: chosen at creation, so their ops are always available.
  for (const k of keepsakes) {
    for (const op of opsIn(k && k.effects, INJECTOR_OPS)) creditOp(op, `keepsake ${k.id}`);
  }

  // Relics that do not depend on the fixpoint.
  const anyFight = pop.encounters.some((e) => witness.encounters.has(e.id));
  const relicDoors = [
    cap.elite && pop.encounters.some((e) => e.pool === 'elite' && witness.encounters.has(e.id)) && 'elite drop',
    (cap.treasure || cap.unknownTreasure) && 'treasure',
    merchant && pos(shop.relicStock) && 'shop relic shelf',
  ].filter(Boolean);
  const bossFight = pop.encounters.some((e) => e.pool === 'boss' && witness.encounters.has(e.id));
  for (const r of pop.relics) {
    if (relicInRewardPool(r) && DROP_RARITIES.includes(r.rarity) && relicDoors.length) note('relics', r.id, `R-drop ${relicDoors.join(' / ')}`);
    if (relicInRewardPool(r) && r.rarity === 'boss' && bossFight) note('relics', r.id, 'R-boss boss reward');
  }

  function creditOp(op, where) {
    if (CARD_OPS.has(op.op)) return note('cards', op.card, `C-inject ${op.op} in ${where}`);
    if (op.op === 'addRelic') {
      if (op.id) return note('relics', op.id, `R-event addRelic in ${where}`);
      if (op.random && !randomRelic) { randomRelic = where; return true; }
      return false;
    }
    if (op.op === 'startCombat') return note('encounters', op.encounterId, `E-event startCombat in ${where}`);
    if (op.op === 'swapClass') {
      let grew = false;
      for (const id of R.classes.ids()) if (!played.has(id)) { played.add(id); grew = true; }
      return grew;
    }
    return false;
  }

  for (let grew = true; grew;) {
    grew = false;
    // classes → their cards and relics
    for (const cls of played) {
      const def = R.classes.get(cls);
      if (anyFight || merchant) for (const id of def.cardPool || []) grew = note('cards', id, `C-pool ${cls} card pool`) || grew;
      grew = note('cards', def.startingSignatureCard, `C-class ${cls} signature`) || grew;
      grew = note('cards', def.abilityCard, `C-class ${cls} ability`) || grew;
      for (const id of (creation[cls] || {}).relicIds || []) grew = note('relics', id, `R-class ${cls} creation relic`) || grew;
      grew = note('relics', def.kitRelic, `R-class ${cls} kit relic`) || grew;
    }
    // events: gated chains, then the choices of every reached event
    for (const ev of pop.events) {
      if (gates[ev.id] && !witness.events.has(ev.id) && cap.unknownEvent && reqMet(gates[ev.id])) {
        grew = note('events', ev.id, 'V-chain gated, requirement satisfiable') || grew;
      }
      if (!witness.events.has(ev.id)) continue;
      for (const choice of choicesOf(ev)) {
        if (!reqMet(choice.requiresHistory)) continue;
        const key = `${ev.id}|${choice.id}`;
        if (!achievable.has(key)) { achievable.add(key); grew = true; }
        for (const op of opsIn(choice.effects, INJECTOR_OPS)) grew = creditOp(op, `event ${ev.id}.${choice.id}`) || grew;
      }
    }
    // encounters → enemies → their injected cards
    for (const enc of pop.encounters) {
      if (!witness.encounters.has(enc.id)) continue;
      for (const id of enc.enemies || []) grew = note('enemies', id, `encounter ${enc.id}`) || grew;
    }
    for (const en of pop.enemies) {
      if (!witness.enemies.has(en.id)) continue;
      for (const op of opsIn(en, CARD_OPS)) grew = creditOp(op, `enemy ${en.id}`) || grew;
    }
    // reached cards inject further cards (transitive)
    for (const c of pop.cards) {
      if (!witness.cards.has(c.id)) continue;
      for (const op of opsIn(c, CARD_OPS)) grew = creditOp(op, `card ${c.id}`) || grew;
    }
  }
  if (randomRelic) {
    for (const r of pop.relics) if (relicInRewardPool(r)) note('relics', r.id, `R-event addRelic random in ${randomRelic}`);
  }

  // ---- F2: a route family that found nothing -----------------------------------
  for (const k of KINDS) {
    if (witness[k].size === 0) floors.push(`F2  ZERO ${k} reached by any route — the walk went blind; ${pop[k].length} rows cannot all be orphans`);
  }
  return finish();

  function finish() {
    const allowed = new Map(allowlist.map((a) => [`${a.kind}|${a.id}`, a]));
    const kinds = {};
    const stale = [];
    for (const k of KINDS) {
      const total = pop[k].length;
      const orphans = pop[k].map((r) => r.id).filter((id) => !witness[k].has(id) && !allowed.has(`${k}|${id}`));
      const dangling = [...witness[k].keys()].filter((id) => !(byId[k] || new Map()).has(id));
      kinds[k] = { total, reached: witness[k].size - dangling.length, orphans, dangling };
    }
    for (const a of allowlist) {
      const exists = pop[a.kind] && pop[a.kind].some((r) => r.id === a.id);
      if (!exists) stale.push(`${a.kind}:${a.id} is allowlisted but no such row exists — remove the entry`);
      else if (witness[a.kind].has(a.id)) stale.push(`${a.kind}:${a.id} is allowlisted as unreachable but IS reached (${witness[a.kind].get(a.id)[0]}) — remove the entry`);
      else if (!a.why) stale.push(`${a.kind}:${a.id} is allowlisted with no reason — an allowlist row must say why`);
    }
    const orphanCount = KINDS.reduce((n, k) => n + (kinds[k] ? kinds[k].orphans.length : 0), 0);
    const verdict = floors.length ? 'FLOOR' : (orphanCount || stale.length) ? 'FAIL' : 'PASS';
    return { kinds, witness, floors, stale, allowlist, verdict, exitCode: floors.length ? 2 : verdict === 'FAIL' ? 1 : 0 };
  }
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

const NOT_CHECKED = `
NOT CHECKED — what a green from this tool does NOT mean (SPEC §8.5):
  · REACHABLE IS NOT LIKELY. A route exists; its odds are not computed. A rare
    in a pool whose rarity weight is 0 is still reached through the shop's
    uniform draw, and one relic among forty is still "reached". tools/runsim.mjs
    is the half that plays.
  · ONE RUN IS NOT MODELLED. Choices that exclude each other within a run (two
    answers to one event, a none-gate against an earlier choice) are each
    credited on their own; a requirement needing both is not refused.
  · PRICES AND PURSES ARE NOT READ. A shop row or a priced event choice counts
    whatever it costs; a choice's cinder/HP requirement is not checked.
  · ONLY THE SOLO MAP CLIMB IS ENUMERATED, plus one co-op door (the party
    reward's co-op card). World Journey (model/worldAtlas.js), legacy
    dungeons, the rest of co-op, Custom Climb chaos rules and Endless loops are
    doors this file does not walk: a row they alone reach reads RED here.
  · CARD UPGRADES, flasks, statuses, armour and weapon arts as items are not
    populations here (statusreach owns statuses; flask and armour reach are
    unchecked). Armour contributes only through bound grants, and only when a
    creation list or an outfit unlock names it — and that is not walked yet.
  · CLASS-TREE NODES, class drafts and relic rule text grant no cards today;
    a future grant from any of them trips F3 only if it is an op in the bundle.
  · The dev screenshot state (?shotEvent=) can open any event; it is a tool
    door, not a player's, and is not credited.`;

function report(r, { json = false } = {}) {
  if (json) {
    console.log(JSON.stringify({ verdict: r.verdict, kinds: r.kinds, floors: r.floors, stale: r.stale }, null, 2));
    return;
  }
  console.log('contentreach: every card, relic, event, encounter and enemy row, and the way a player meets it.\n');
  for (const k of KINDS) {
    const s = r.kinds[k];
    console.log(`  ${k.padEnd(11)} ${String(s.reached).padStart(4)} of ${String(s.total).padStart(4)} reached  ${s.orphans.length} orphan(s)`);
  }
  console.log();
  for (const k of KINDS) {
    for (const id of r.kinds[k].orphans) console.log(`  RED   ${k}:${id} — NO ROUTE IN: no reward, shop, grant, kit, event or injector reaches it`);
    for (const id of r.kinds[k].dangling) console.log(`  NOTE  ${k}:${id} is granted by ${(r.witness[k].get(id) || []).join(', ')} but there is NO SUCH ROW`);
  }
  for (const a of r.allowlist) console.log(`  ALLOW ${a.kind}:${a.id} — ${a.why}`);
  for (const s of r.stale) console.log(`  RED   ${s}`);
  for (const f of r.floors) console.log(`  FLOOR ${f}`);
  if (process.argv.includes('--verbose')) {
    for (const k of KINDS) for (const [id, w] of [...r.witness[k]].sort()) console.log(`  ok    ${k}:${id} — ${w.slice(0, 2).join(' · ')}`);
  }
  console.log(NOT_CHECKED);
  console.log();
  const total = KINDS.reduce((n, k) => n + r.kinds[k].total, 0);
  const orphans = KINDS.reduce((n, k) => n + r.kinds[k].orphans.length, 0);
  if (r.verdict === 'FLOOR') console.log(`RESULT: FLOOR — ${r.floors.length} floor(s) fired; this run judged nothing it can vouch for.`);
  else if (r.verdict === 'FAIL') console.log(`RESULT: FAIL — ${orphans} of ${total} content rows have no route in${r.stale.length ? `, ${r.stale.length} stale allowlist row(s)` : ''}.`);
  else console.log(`contentreach: OK — ${total}/${total} content rows reachable.`);
}

// ---------------------------------------------------------------------------
// --selftest — plants IN MEMORY on the loaded bundle, through the same
// contentReach() main() calls. They exercise the reach model, not the loading.
// ---------------------------------------------------------------------------

function clone(node) {
  // Not structuredClone and not JSON: the bundle carries functions (scripts).
  if (Array.isArray(node)) return node.map(clone);
  if (node === null || typeof node !== 'object') return node;
  if (node instanceof Map) return new Map([...node].map(([k, v]) => [k, clone(v)]));
  if (node instanceof Set) return new Set([...node].map(clone));
  const out = {};
  for (const [k, v] of Object.entries(node)) out[k] = clone(v);
  for (const s of Object.getOwnPropertySymbols(node)) out[s] = node[s];
  return out;
}

function selftest(real) {
  let bad = 0;
  let n = 0;
  const expect = (name, got, want) => {
    n++;
    const ok = got === want;
    if (!ok) bad++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name.padEnd(70)} got ${got}, want ${want}`);
  };
  const orphaned = (r, kind, id) => r.kinds[kind].orphans.includes(id);
  const card = (id, extra = {}) => ({ id, name: 'Planted', class: 'colorless', rarity: 'special', cost: 1, type: 'skill',
    effects: [{ op: 'block', target: 'self', amount: 1 }], ...extra });
  const relic = (id, extra = {}) => ({ ...clone(real.relics.find((x) => x.rarity === 'starter')), id, name: 'Planted', ...extra });
  const event = (id) => ({ id, name: 'Planted', art: '?', text: 'Planted.', choices: [{ label: 'Leave', effects: [], resultText: '.' }] });
  const withEvent = (b, ev, ids) => { b.events.push(ev); b.eventChoiceIds = { ...b.eventChoiceIds, [ev.id]: ids }; };

  console.log('contentreach --selftest — every route family planted, including the greens that must hold.');
  console.log('THE DOOR, said plainly: these plants enter IN MEMORY on the loaded bundle, downstream of');
  console.log('the CSV compile and module load; they prove the reach model, not the loading.\n');

  // G1 — THE CHECK CAN GO GREEN. Whatever the tree holds, give every orphan a
  // route through an ordinary door and the verdict must turn to PASS. Every
  // plant below starts from THIS green bundle, so a red is the plant's own red
  // and never the tree's (a corpus that fails for the tree's reason cannot say
  // whose fault a red is — statusreach's G1 note).
  const green = clone(real);
  {
    const b = green;
    const before = contentReach(b);
    const pool = b.classes[0].cardPool = [...b.classes[0].cardPool];
    for (const id of before.kinds.cards.orphans) pool.push(id);
    for (const id of before.kinds.relics.orphans) Object.assign(b.relics.find((x) => x.id === id), { rarity: 'common', pool: 'reward' });
    for (const id of before.kinds.events.orphans) { const g = { ...b.eventHistoryRequirements }; delete g[id]; b.eventHistoryRequirements = g; }
    for (const id of before.kinds.encounters.orphans) Object.assign(b.encounters.find((x) => x.id === id), { pool: 'normal', seat: b.seats[0].id, weight: 1 });
    for (const id of before.kinds.enemies.orphans) b.encounters[0].enemies = [...b.encounters[0].enemies, id];
    expect('G1  every orphan given an ordinary route (must go GREEN)', contentReach(b).verdict, 'PASS');
  }
  real = green;

  // P1 — an orphan CARD: a colorless special row nothing grants.
  let b = clone(real);
  b.cards.push(card('plantedOrphanCard'));
  let r = contentReach(b);
  expect('P1  a card nothing grants', r.verdict, 'FAIL');
  expect('P1  ...and it is named', orphaned(r, 'cards', 'plantedOrphanCard'), true);

  // P2 — THE READER TRAP: the card is MENTIONED (an equipment exception row, a
  // predicate, an upgrade on some other card that removes it) but never granted.
  b = clone(real);
  b.cards.push(card('plantedOnlyNamed'));
  b.equipment.cardEquipmentExceptions = [...(b.equipment.cardEquipmentExceptions || []), { cardId: 'plantedOnlyNamed', weaponId: 'dagger' }];
  b.cards[0] = { ...b.cards[0], effects: [...b.cards[0].effects, { op: 'removeCardFromDeck', card: 'plantedOnlyNamed' }] };
  expect('P2  named two ways, granted none (the reader trap)', orphaned(contentReach(b), 'cards', 'plantedOnlyNamed'), true);

  // P3 — an injector counts only while ITS carrier is reached: a card added by
  // an orphan card is itself an orphan; wire the carrier in and both turn.
  b = clone(real);
  b.cards.push(card('plantedCarrier', { effects: [{ op: 'addCard', card: 'plantedInjected', pile: 'hand' }] }), card('plantedInjected'));
  r = contentReach(b);
  const bothRed = orphaned(r, 'cards', 'plantedCarrier') && orphaned(r, 'cards', 'plantedInjected');
  b.classes[0].cardPool = [...b.classes[0].cardPool, 'plantedCarrier'];
  r = contentReach(b);
  expect('P3  injection is transitive through a REACHED carrier only', bothRed && !orphaned(r, 'cards', 'plantedInjected'), true);

  // P4 — an orphan RELIC: starter rarity (no drop pool), in no creation list,
  // and quest-pool so an event's "random relic" cannot draw it either. (A
  // reward-pool STARTER relic is reached: engine/actions.js addRelic random
  // draws every reward-pool relic whatever its rarity — found by this plant's
  // first draft going green, and the tool was right.)
  b = clone(real);
  b.relics.push(relic('plantedOrphanRelic', { pool: 'quest' }));
  r = contentReach(b);
  expect('P4  a relic in no pool, list or grant', orphaned(r, 'relics', 'plantedOrphanRelic'), true);
  expect('P4  ...and the run is red', r.exitCode, 1);

  // P5 — a QUEST-pool relic of reward rarity is NOT a drop (relicInRewardPool).
  b = clone(real);
  b.relics.push(relic('plantedQuestRelic', { rarity: 'rare', pool: 'quest' }));
  expect('P5  a quest-pool relic no event grants', orphaned(contentReach(b), 'relics', 'plantedQuestRelic'), true);

  // P6 — an orphan EVENT: gated on a choice of an event that does not exist.
  b = clone(real);
  withEvent(b, event('plantedOrphanEvent'), ['leave']);
  b.eventHistoryRequirements = { ...b.eventHistoryRequirements, plantedOrphanEvent: { any: [{ eventId: 'noSuchEvent', choiceId: 'noSuchChoice' }] } };
  r = contentReach(b);
  expect('P6  a gated event whose chain cannot be satisfied', orphaned(r, 'events', 'plantedOrphanEvent'), true);
  expect('P6  ...and the run is red', r.exitCode, 1);

  // P7 — chains are transitive: gate the root of the nameless chain and every
  // later step, and the quest-pool relic its keeper hands over, falls with it.
  b = clone(real);
  b.eventHistoryRequirements = { ...b.eventHistoryRequirements, graveOfTheNameless: { all: [{ eventId: 'noSuchEvent', choiceId: 'x' }] } };
  r = contentReach(b);
  expect('P7  the chain root gated shut takes namelessRest down with it', orphaned(r, 'events', 'namelessRest'), true);
  expect('P7  ...and the quest relic the keeper hands over (gravetendersBell)', orphaned(r, 'relics', 'gravetendersBell'), true);

  // P8 — an orphan ENEMY: in no encounter.
  b = clone(real);
  b.enemies.push({ ...clone(b.enemies[0]), id: 'plantedOrphanEnemy' });
  expect('P8  an enemy no encounter names', orphaned(contentReach(b), 'enemies', 'plantedOrphanEnemy'), true);

  // P9 — an encounter in a seat that does not exist is not rolled.
  b = clone(real);
  b.encounters.push({ ...clone(b.encounters[0]), id: 'plantedNoSeat', seat: 'noSuchSeat' });
  expect('P9  an encounter in no real seat', orphaned(contentReach(b), 'encounters', 'plantedNoSeat'), true);

  // P10 — the map gate: with no Unknown nodes, no event rolls at all.
  b = clone(real);
  for (const cfg of Object.values(b.mapConfigs)) cfg.unknownWeights = { ...cfg.unknownWeights, event: 0 };
  r = contentReach(b);
  expect('P10 unknownWeights.event zeroed on every tier: events go dark', r.kinds.events.orphans.length === r.kinds.events.total, true);

  // F1 / F2 / F3 — never a pass.
  b = clone(real); b.cards = [];
  expect('F1  empty card table', contentReach(b).exitCode, 2);
  // Every seat-rolled fight unseated AND the Unknown event door shut, so no
  // event's startCombat can stand in for the roll.
  b = clone(real); b.encounters = b.encounters.map((e) => ({ ...e, weight: 0, seat: 'noSuchSeat' }));
  for (const cfg of Object.values(b.mapConfigs)) cfg.unknownWeights = { ...cfg.unknownWeights, event: 0 };
  r = contentReach(b);
  expect('F2  no encounter reached by any route', r.exitCode === 2 && r.floors.some((f) => f.includes('encounters')), true);
  b = clone(real);
  b.flasks = [...b.flasks, { ...clone(b.flasks[0]), id: 'plantedFlask', effects: [{ op: 'addCard', card: 'guilt' }] }];
  expect('F3  an injector in a set no route models', contentReach(b).exitCode, 2);

  // The allowlist ratchet: allowlisting a REACHED row is a failure.
  r = contentReach(real, { allowlist: [{ kind: 'cards', id: 'strike', why: 'planted' }] });
  expect('A1  an allowlisted row that is actually reached is RED', r.stale.length === 1 && r.exitCode >= 1, true);
  // ...and allowlisting a genuine orphan with a reason clears it.
  b = clone(real); b.cards.push(card('plantedAllowed'));
  r = contentReach(b, { allowlist: [{ kind: 'cards', id: 'plantedAllowed', why: 'planted: intentionally unobtainable' }] });
  expect('A2  a justified allowlist row removes exactly that orphan', orphaned(r, 'cards', 'plantedAllowed'), false);

  console.log();
  if (bad) console.log(`RESULT: CORPUS BROKE — ${bad} of ${n} planted checks did not behave.`);
  else console.log(`contentreach --selftest: OK — ${n} checks passed.`);
  return bad === 0 ? 0 : 1;
}

async function main() {
  const args = process.argv.slice(2);
  const { contentBundle } = await import('../src/content/index.js');
  if (args.includes('--selftest')) return selftest(contentBundle);
  const r = contentReach(contentBundle);
  report(r, { json: args.includes('--json') });
  return r.exitCode;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().then((code) => process.exit(code), (e) => { console.error(e); process.exit(2); });
}
