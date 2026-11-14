// tools/coresim.mjs — a headless Act 1 simulator for the Core 2 ruleset.
//
// runsim.mjs plays the older content bundle (contentBundle / configuredContentBundle), so it cannot answer
// "can a first-time player still win Act 1 under the Core 2 rules?". This tool builds a run from the shipped
// default game profile, walks the act map the run carries from the start node to the Act 1 boss, and fights
// every node through the real Core combat path (createRunCombat -> dispatch -> runCombatEnd). Between fights it
// calls the same model functions src/main.js calls (reward offers and claims, the rest-site services, the node
// refill, the after-combat recovery, character XP), so a change to rests.json / rewards.json / routes.json moves
// the numbers without an edit here. Nothing sets HP or skips an enemy turn.
//
// Usage: node tools/coresim.mjs [--class reaver|rogue|starseer|herald|all] [--runs 200] [--acts 1]
//          [--seed-base 1000] [--policy greedy|careful|both] [--json <file>] [--records] [--quiet] [--selftest]
//   --policy both (the default) runs greedy and careful on the same seeds.
//   --json <file> writes the full report as JSON; the same arguments always print the same report.
//   --records adds every run's node-by-node trace (HP in and out, heals) to the JSON.
//
// Fight bot (policy greedy): affordable attacks in descending damage per stamina (a card that hits ALL first
// when three or more enemies stand; a Smash first against a target in a defensive stance or holding Block),
// then Block cards with what is left; every defensive reaction is accepted (the option with the highest
// defence); a healing flask is drunk under 40% HP. Policy careful: the same, but Block cards go first when the
// enemies' true incoming damage this turn exceeds the current Block by more than 25% of current HP. The bot reads
// true enemy intents from the combat state.
// Run bot: among the reachable next nodes pick rest when HP < 50%, else fight, else elite when HP > 70%, else
// event, else treasure, else shop, else anything. A rest site under a profile with the `rest` service: Rest when
// HP < 60%, else Upgrade Card (first upgradable card that is not Strike or Defend, else any), else Smith; under
// an older profile every free service. Rewards: the first card that is not Strike or Defend goes into the deck;
// the first relic on an elite spoils offer; the first option of a chest. Shops and events are left (counted).
// Attribute points are never spent. A fight past 60 turns is a stalemate: counted and scored as a loss.
// A crash prints the seed and the stack and exits 1.
//
// NOT MODELLED (see the report that accompanies a measurement): events, shops, equipment found on the way
// (weapons and armour are never equipped), skill-track XP, card ranks, rank-up doors, attribute spending.

import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import * as Profile from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { dispatch, previewCard, cardChoicePlan } from '../src/engine/combat.js';
import { createRunCombat, runCombatEnd } from '../src/engine/runCombat.js';
import { stampCombatPlaysEver, foldCombatPlaysEver } from '../src/model/playsEver.js';
import { affordableCards, refusalsFor, botControlAction, botCardTargetId } from './simbot.mjs';
import { buildActMap, bossEncounterForNode, drawSeatOrder } from '../src/engine/actmap.js';
import { rollEncounter, rollRuneReward } from '../src/engine/encounters.js';
import { seatAtTier, seatTierHpMult, bossTierScale } from '../src/model/seats.js';
import { applyAfterCombatRecovery } from '../src/model/recoveryRules.js';
import { applyNodeRefill, refillFlasksAtActChange } from '../src/model/nodeRefill.js';
import { grantSmithingReward, smithingRewardId, smithingPlan } from '../src/model/smithing.js';
import { awardLevelXp, combatXpReceipt } from '../src/model/levelup.js';
import { gameModule, gameContent } from '../src/model/gameProfile.js';
import * as Progression from '../src/model/gameProfileProgression.js';
import * as Rewards from '../src/model/gameProfileRewards.js';
import * as Rest from '../src/model/gameProfileRest.js';
import * as Upgrade from '../src/model/cardUpgradeService.js';
import * as Blacksmith from '../src/model/blacksmithConfig.js';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CLASSES = ['reaver', 'rogue', 'starseer', 'herald'];
const POLICIES = ['greedy', 'careful'];
const STALEMATE_TURNS = 60; // a fight still open after this many turns is a stalemate (scored as a loss)
const ACTION_GUARD = 4000; // bot actions one fight may take: a bot stuck inside one turn is a crash, not a stalemate
const STEP_GUARD = 200; // map nodes one act may take before the walk is declared stuck
const ENGINE_REFUSALS = [
  /^Cards can only be played on the player turn$/, /^Flasks can only be used on the player turn$/,
  /^Card '.*' is not in hand$/, /^'.*' is unplayable$/, /^Not enough (energy|mana|stamina) \(need -?\d+, have -?\d+\)$/,
  /^Invalid target '.*'$/, /^No living enemy to target$/, /^Evade is already active$/, /^Dodge Roll already used this turn$/,
  /^That stance is already active$/, /^No \w+ flask charges$/, /^No flask in slot .*$/,
];
const isRefusal = (e) => !!(e && e.playRefusal) || ENGINE_REFUSALS.some((re) => re.test(String(e && e.message)));
const isBasic = (cardId) => /(^|\.)(strike|defend)$/.test(String(cardId));

// ---- the profile -----------------------------------------------------------------------------------------------
export function loadProfile() {
  const profile = Profile.resolveGameProfile('default');
  const content = Profile.applyGameProfileToContent(contentBundle, profile);
  const registries = Profile.bindGameProfileRegistries(createRegistries(content), profile);
  return { profile, registries };
}
const PROFILE_META = { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } };

// ---- the fight bot ---------------------------------------------------------------------------------------------
const num = (x) => (Number.isFinite(x) ? x : 0);

// A preview clones the whole fight, so a face is previewed once per (turn, set of living enemies, card, target) and reused
// for the rest of that turn's decisions; a reaction card's Block is previewed once per card per fight.
const faceMemo = new WeakMap();
function cardFace(combat, card, targetId) {
  const key = `${combat.turn}|${combat.enemies.filter((e) => e.alive).map((e) => `${e.id}${num(e.block) > 0 ? 'b' : ''}`).join(',')}`;
  let memo = faceMemo.get(combat);
  if (!memo || memo.key !== key) faceMemo.set(combat, memo = { key, faces: new Map() });
  const k = `${card.instanceId}>${targetId}`;
  if (!memo.faces.has(k)) memo.faces.set(k, previewFace(combat, card, targetId));
  return memo.faces.get(k);
}
function previewFace(combat, card, targetId) {
  let p;
  try { p = previewCard(combat, card.instanceId, targetId); } catch (e) { if (isRefusal(e)) return null; throw e; }
  let damage = 0; let hit = 0; let block = 0;
  for (const v of p.values || []) {
    if (v.op === 'damage') {
      const per = v.perTarget || {};
      const ids = Object.keys(per);
      hit = Math.max(hit, ids.length);
      damage += ids.reduce((sum, id) => sum + num(per[id]), 0) * 1;
    } else if (v.op === 'block') block += num(v.value);
  }
  return { damage, hit, block, cost: Math.max(1, num(p.staminaCost) || num(p.cost)), smash: false };
}

/** The damage the living enemies will deal this turn (true intents), before Block. */
function incomingDamage(combat) {
  let sum = 0;
  for (const e of combat.enemies) {
    if (!e.alive || !e.intent || e.intent.kind !== 'attack') continue;
    sum += num(e.intent.damage) * Math.max(1, num(e.intent.hits) || 1);
  }
  return sum;
}

const isDefensive = (e) => e.alive && ((e.combatStance && e.combatStance.maneuver === 'defend') || num(e.block) > 0);

const reactionMemo = new WeakMap();
/** The reaction option with the most defence (previewed Block); null declines. */
function chooseReaction(combat) {
  const offer = combat.pendingReaction;
  let best = null; let bestBlock = 0;
  const memo = reactionMemo.get(combat) || reactionMemo.set(combat, new Map()).get(combat);
  for (const option of offer.options || []) {
    const id = option.play && option.play.cardInstanceId;
    let block = 0;
    if (id && memo.has(option.cardId)) block = memo.get(option.cardId);
    else if (id) {
      try { for (const v of previewCard(combat, id, offer.sourceId).values || []) if (v.op === 'block') block += num(v.value); } catch (e) { if (!isRefusal(e)) throw e; }
      memo.set(option.cardId, block);
    }
    if (block > bestBlock) { best = option; bestBlock = block; }
  }
  return { type: 'chooseReaction', offerId: offer.id, optionId: best ? best.id : null };
}

/** Choose the next card to play, or null. */
function pickCard(registries, combat, refused, policy) {
  const alive = combat.enemies.filter((e) => e.alive);
  if (!alive.length) return null;
  const hand = affordableCards(registries, combat, refused);
  if (!hand.length) return null;
  const focus = alive.reduce((a, b) => (b.hp + num(b.block) < a.hp + num(a.block) ? b : a));
  const defensive = alive.find(isDefensive) || null;
  const hp = combat.player.hp;
  const block = num(combat.player.block);
  const guardFirst = policy === 'careful' && incomingDamage(combat) - block > 0.25 * hp;
  const scored = [];
  for (const card of hand) {
    const def = registries.cards.get(card.cardId);
    const smash = (def.tags || []).includes('maneuver:smash');
    const target = smash && defensive ? defensive : focus;
    const face = cardFace(combat, card, target.id);
    if (!face) { refused.add(card.instanceId); continue; }
    scored.push({ card, target, face, smash });
  }
  const attacks = scored.filter((s) => s.face.damage > 0);
  const guards = scored.filter((s) => s.face.damage <= 0 && s.face.block > 0);
  const rank = (s) => {
    const tier = s.smash && s.target === defensive ? 0 : (alive.length >= 3 && s.face.hit >= 3 ? 1 : 2);
    return [tier, -(s.face.damage / s.face.cost)];
  };
  attacks.sort((a, b) => { const x = rank(a); const y = rank(b); return x[0] - y[0] || x[1] - y[1]; });
  guards.sort((a, b) => b.face.block / b.face.cost - a.face.block / a.face.cost);
  // A card that both hits and blocks (Counter) is an attack for the order above; Block cards never run ahead of attacks
  // unless the careful policy sees more damage coming than the player can take.
  const order = guardFirst ? [...guards, ...attacks] : [...attacks, ...guards];
  return order.length ? order[0] : null;
}

/** Fight one encounter through the real Core path. Returns { result, turns, stalemate, hpLost, healed }. */
function fight(ctx, run, rng, encounterId, policy) {
  const { registries } = ctx;
  const enc = registries.encounters.get(encounterId);
  const boss = Array.isArray(run.seatOrder) ? bossTierScale(registries, { encounter: enc, tier: run.actNumber }) : null;
  const hpMult = Array.isArray(run.seatOrder) ? (boss ? boss.hp : seatTierHpMult(registries, seatAtTier(run.seatOrder, run.actNumber), run.actNumber)) : 1;
  const combat = createRunCombat({ registries, rng, run, enemyIds: enc.enemies, encounter: enc, hpMult, enemyDamageMult: boss ? boss.damage : 1 });
  stampCombatPlaysEver(run, combat);
  const hpIn = run.hp;
  let guard = 0; let stalemate = false;
  const act = (action) => dispatch(combat, action);
  while (!combat.result) {
    if (++guard > ACTION_GUARD) throw new Error(`fight ${encounterId} took ${ACTION_GUARD} bot actions (stuck inside turn ${combat.turn})`);
    if (combat.turn > STALEMATE_TURNS) { stalemate = true; break; }
    if (combat.pendingReaction) { act(chooseReaction(combat)); continue; }
    const control = botControlAction(combat);
    if (control) { act(control); continue; }
    if (combat.phase !== 'player') throw new Error(`fight ${encounterId}: not the player's turn and nothing pending (phase ${combat.phase})`);
    const p = combat.player;
    if (p.hp < p.maxHp * 0.4) {
      const ch = p.flaskCharges;
      if (ch && num(ch.hpCurrent) > 0) {
        try { act({ type: 'useFlask', chargeKind: 'hp' }); continue; } catch (e) { if (!isRefusal(e)) throw e; }
      }
      if (p.flasks && p.flasks.length) {
        const def = registries.flasks.get(p.flasks[0].flaskId);
        const living = combat.enemies.find((e) => e.alive);
        if (def && def.effects.some((fx) => fx.op === 'heal' || fx.op === 'restoreHp')) {
          try { act({ type: 'useFlask', slot: 0, targetId: def.targeted ? living && living.id : undefined }); continue; } catch (e) { if (!isRefusal(e)) throw e; }
        }
      }
    }
    const refused = refusalsFor(combat);
    const pick = pickCard(registries, combat, refused, policy);
    if (!pick) { act({ type: 'endTurn' }); continue; }
    // The door's own target rule decides: a card whose resolved face takes no enemy (a variant swapped in by what was paid)
    // is retried with no target; a card the door still refuses is set aside for the turn.
    const choice = cardChoicePlan(combat, pick.card.instanceId)?.options[0]?.id;
    const tries = [botCardTargetId(registries, combat, pick.card, pick.target.id), undefined];
    let played = false;
    for (let t = 0; t < tries.length && !played; t++) {
      if (t > 0 && tries[t] === tries[0]) break;
      try { act({ type: 'playCard', cardInstanceId: pick.card.instanceId, targetId: tries[t], choice }); played = true; } catch (e) {
        if (!isRefusal(e) && !/^Invalid \w+ target '/.test(String(e && e.message))) throw e;
      }
    }
    if (!played) refused.add(pick.card.instanceId);
  }
  let healed = 0; let lost = 0;
  for (const ev of combat.eventLog) {
    if (ev.targetId !== 'player') continue;
    if (ev.type === 'healed') healed += num(ev.amount);
    else if (ev.type === 'hpLost') lost += num(ev.amount);
  }
  const result = stalemate ? 'defeat' : combat.result;
  if (stalemate) combat.result = 'defeat';
  runCombatEnd(run, combat);
  foldCombatPlaysEver(run, combat);
  return { combat, enc, result, turns: Math.min(combat.turn, STALEMATE_TURNS), stalemate, hpIn, hpLost: lost, healed };
}

// ---- between fights (the rules src/main.js onCombatEnd / beginGameProfileReward / showRest follow) -------------------
function takeOffer(ctx, run, offerId, want) {
  const offer = run.gameProfileRewardOffers && run.gameProfileRewardOffers[offerId];
  if (!offer) return null;
  const { registries } = ctx;
  const index = offer.options.findIndex(want);
  if (index < 0) return null;
  const option = offer.options[index];
  try {
    if (option.kind === 'combatCards' || option.kind === 'weaponArts') Rewards.claimGameProfileRewardToDeck(registries, run, offerId, index, {});
    else Rewards.claimGameProfileReward(registries, run, offerId, index);
  } catch (e) { return null; } // a refused claim (deck rules) leaves the run untouched: the bot walks on
  return option;
}
const isNewCard = (o) => (o.kind === 'combatCards' || o.kind === 'weaponArts') && !isBasic(o.id);

/** After a won fight: spoils, in the order the game's reward door runs them. */
function settleVictory(ctx, run, rng, combat, enc, stats) {
  const { registries } = ctx;
  applyAfterCombatRecovery(run);
  run.stats.fightsWon += 1;
  run.combatEntered = null;
  grantSmithingReward(registries, run, enc.pool, smithingRewardId(run, enc.pool), rng);
  run.cinders += Math.floor(rollRuneReward(registries, rng, enc.pool, run.relics));
  const configuredLevels = Progression.configuredCharacterLevels ? Progression.configuredCharacterLevels(run) : true;
  const isConfigured = !!run.gameProfile;
  const xp = combatXpReceipt(registries, { victory: true, pool: enc.pool, enemies: combat.enemies,
    characterMultiplier: configuredLevels && Progression.configuredCharacterXpMultiplier ? Progression.configuredCharacterXpMultiplier(run) : 1 });
  const levelXp = isConfigured && !configuredLevels ? 0 : xp.total;
  const award = awardLevelXp(registries, run, levelXp, { pointsPerLevel: gameModule(run, 'progression')?.attributePointsPerLevel || 0, grantStats: !!gameModule(run, 'stats') });
  stats.levelUps += award.levelUps || 0;
  if (enc.pool === 'boss') return;
  if (!gameModule(run, 'rewards')) return;
  const offerId = `${run.actNumber}:${run.mapNodeId}:combat`;
  Rewards.gameProfileRewardOffers(registries, run, rng, { offerId, source: 'combat' });
  if (takeOffer(ctx, run, offerId, isNewCard)) stats.cardsTaken++;
  // Elite spoils (rewards.json eliteRelic), then one level card per level bought, as the Continue chain does.
  let chain = offerId;
  if (enc.pool === 'elite' && gameContent(run, 'rewards')?.eliteRelic && Rewards.GameProfileEliteRelicOffer) {
    const eliteId = `${chain}:elite`;
    if (Rewards.GameProfileEliteRelicOffer(registries, run, rng, { offerId: eliteId })) {
      if (takeOffer(ctx, run, eliteId, (o) => o.kind === 'relics')) stats.relicsTaken++;
      chain = eliteId;
    }
  }
  for (let n = award.levelUps || 0; n > 0; n--) {
    const levelId = `${chain}:level:${n}`;
    Rewards.gameProfileRewardOffers(registries, run, rng, { offerId: levelId, source: 'level' });
    if (takeOffer(ctx, run, levelId, isNewCard)) stats.cardsTaken++;
  }
}

/** A rest site. Returns the service picked ('rest', 'upgradeCard', 'smith', 'free', or null). */
function visitRest(ctx, run, stats) {
  const { registries } = ctx;
  const node = run.mapGraph.nodes[run.mapNodeId];
  if (!gameModule(run, 'rest') || gameModule(run, 'rest').mode !== 'configured') return null;
  Rest.beginGameProfileRest(run, `${run.actNumber}:${node.id}`);
  stats.rests++;
  const choice = Rest.RestChoiceMode ? Rest.RestChoiceMode(run) : false;
  const upgrade = () => {
    const ids = [...run.deck].sort((a, b) => Number(isBasic(a.cardId)) - Number(isBasic(b.cardId)));
    for (const card of ids) {
      let quote;
      try { quote = Upgrade.planCardUpgrade(run, registries, card.instanceId); } catch (e) { continue; }
      if (!quote.ok) continue;
      try { Rest.commitGameProfileRest(registries, run, 'upgradeCard', { instanceId: card.instanceId, quote }); return true; } catch (e) { /* refused */ }
    }
    return false;
  };
  const smith = () => {
    let plan;
    try { plan = smithingPlan(registries, run, undefined, { free: Rest.restSmithFree ? Rest.restSmithFree(run) : true, maxTier: Blacksmith.restSmithMaxTier ? Blacksmith.restSmithMaxTier(run) : undefined }); } catch (e) { return false; }
    for (const candidate of plan.candidates || []) {
      try { Rest.commitGameProfileRest(registries, run, 'smith', { itemRef: candidate.itemRef }); return true; } catch (e) { /* refused */ }
    }
    return false;
  };
  const services = gameContent(run, 'rests').services || [];
  if (!choice) {
    // Every service is usable once and none closes another: take the free ones (never Level Up: no attribute points are spent).
    let any = false;
    if (services.includes('upgradeCard') && upgrade()) any = true;
    if (services.includes('smith') && smith()) any = true;
    return any ? 'free' : 'arrival';
  }
  const rest = () => { Rest.commitGameProfileRest(registries, run, 'rest', {}); stats.restPicks++; return 'rest'; };
  if (run.hp < run.maxHp * 0.6) return rest();
  if (services.includes('upgradeCard') && upgrade()) return 'upgradeCard';
  if (services.includes('smith') && smith()) return 'smith';
  return run.hp < run.maxHp ? rest() : null;
}

// ---- one run ---------------------------------------------------------------------------------------------------
const NODE_KIND = { monster: 'fight', fight: 'fight', elite: 'elite', boss: 'boss', shrine: 'rest', event: 'event', treasure: 'treasure', merchant: 'shop' };

function choose(options, run) {
  const kinds = options.map((n) => NODE_KIND[n.type] || 'other');
  const find = (k) => options[kinds.indexOf(k)];
  const frac = run.hp / run.maxHp;
  if (frac < 0.5 && find('rest')) return find('rest');
  if (find('fight')) return find('fight');
  if (frac > 0.7 && find('elite')) return find('elite');
  return find('event') || find('treasure') || find('shop') || find('boss') || options[0];
}

/** Simulate one run. Returns a plain record; never throws for game losses. */
export function simulateRun(ctx, classId, seed, policy, { acts = 1 } = {}) {
  const { registries } = ctx;
  const run = createRunState({ registries, classId, seed, profileMeta: PROFILE_META });
  run.stats = { fightsWon: 0, damageDealt: 0, damageTaken: 0 };
  run.path = []; run.seenEvents = []; run.lastEncounters = [];
  run.history ||= [];
  const rng = createRng(seed);
  run.seatOrder = drawSeatOrder(registries, rng);
  const rec = { classId, seed, policy, win: false, actsCleared: 0, death: null, hpAtBoss: null, maxHpAtBoss: null,
    fights: 0, turns: 0, stalemates: 0, encounters: {}, rests: 0, restPicks: 0, events: 0, shops: 0, treasures: 0,
    cardsTaken: 0, relicsTaken: 0, levelUps: 0, trace: [] };
  const trace = (kind, nodeId, before, healed, extra = {}) => rec.trace.push({ kind, nodeId, floor: run.floor, hpIn: before, hpOut: run.hp, maxHp: run.maxHp, healed, ...extra });
  const stats = rec;
  for (let act = 1; act <= acts; act++) {
    run.actNumber = act; run.floor = 0; run.mapNodeId = null; run.path = []; run.lastEncounters = [];
    if (act > 1) { run.hp = run.maxHp; refillFlasksAtActChange(run); }
    const seat = seatAtTier(run.seatOrder, act);
    run.mapGraph = buildActMap(registries, rng, seat, act, null, { history: run.history });
    const map = run.mapGraph;
    let options = map.startIds.map((id) => map.nodes[id]);
    let steps = 0;
    for (;;) {
      if (++steps > STEP_GUARD) throw new Error(`act ${act} walked ${STEP_GUARD} nodes without reaching its boss`);
      const node = choose(options, run);
      const kind = NODE_KIND[node.type] || 'other';
      const before = run.hp;
      run.mapNodeId = node.id; run.path.push(node.id); run.floor = node.floor;
      let healed = 0;
      if (node.refill === true) { applyNodeRefill(run, node, { healMult: 1 }); healed += run.hp - before; }
      let eff = kind; let resolved = null;
      if (kind === 'event') {
        resolved = node.resolved || { kind: 'fight' };
        if (resolved.kind === 'event') { rec.events++; run.seenEvents.push(resolved.eventId); eff = 'event'; } else eff = resolved.kind === 'fight' ? 'fight' : resolved.kind === 'treasure' ? 'treasure' : 'event';
      }
      if (eff === 'fight' || eff === 'elite' || eff === 'boss') {
        const pool = eff === 'fight' ? 'normal' : eff;
        const encId = pool === 'boss' ? bossEncounterForNode(registries, map, node.id, { seat, tier: act })
          : rollEncounter(registries, rng, { pool, seat, exclude: run.lastEncounters });
        if (pool === 'normal') { run.lastEncounters.push(encId); if (run.lastEncounters.length > 2) run.lastEncounters.shift(); }
        if (pool === 'boss') { rec.hpAtBoss = run.hp; rec.maxHpAtBoss = run.maxHp; }
        const hpIn = run.hp;
        const out = fight(ctx, run, rng, encId, policy);
        rec.fights++; rec.turns += out.turns;
        const row = rec.encounters[encId] || (rec.encounters[encId] = { n: 0, lost: 0 });
        row.n++; row.lost += hpIn - Math.max(0, run.hp);
        if (out.stalemate) rec.stalemates++;
        if (out.result !== 'victory') {
          rec.death = { kind: eff, floor: node.floor, encounterId: encId, act, stalemate: out.stalemate };
          trace('fight', node.id, hpIn, out.healed, { result: 'defeat' });
          return rec;
        }
        const preRecovery = run.hp;
        settleVictory(ctx, run, rng, out.combat, out.enc, stats);
        trace(eff, node.id, hpIn, out.healed + (run.hp - preRecovery), { result: 'victory', encounterId: encId });
        if (pool === 'boss') { rec.actsCleared++; break; }
      } else if (eff === 'rest') {
        const pick = visitRest(ctx, run, stats);
        trace('rest', node.id, before, 0, { pick });
      } else if (eff === 'treasure') {
        rec.treasures++;
        const offerId = `${act}:${node.id}:treasure`;
        if (gameModule(run, 'rewards')) {
          Rewards.gameProfileRewardOffers(registries, run, rng, { offerId, source: 'treasure' });
          takeOffer(ctx, run, offerId, () => true);
        }
        trace('treasure', node.id, before, healed);
      } else if (eff === 'shop') {
        rec.shops++; trace('shop', node.id, before, healed);
      } else trace(eff, node.id, before, healed);
      options = (map.nodes[node.id].next || []).map((id) => map.nodes[id]);
      if (!options.length) options = (map.bossIds || [map.bossId]).map((id) => map.nodes[id]);
    }
  }
  rec.win = true;
  return rec;
}

// ---- the report ------------------------------------------------------------------------------------------------
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const r2 = (x) => Math.round(x * 100) / 100;

export function summarize(records) {
  const n = records.length;
  const wins = records.filter((r) => r.win);
  const deaths = records.filter((r) => r.death);
  const byKind = { fight: 0, elite: 0, boss: 0 };
  const byFloor = {};
  for (const r of deaths) { byKind[r.death.kind] = (byKind[r.death.kind] || 0) + 1; byFloor[r.death.floor] = (byFloor[r.death.floor] || 0) + 1; }
  const atBoss = records.filter((r) => r.hpAtBoss !== null);
  const enc = {};
  for (const r of records) for (const [id, row] of Object.entries(r.encounters)) { const e = enc[id] || (enc[id] = { n: 0, lost: 0 }); e.n += row.n; e.lost += row.lost; }
  const encounters = Object.entries(enc).map(([id, e]) => ({ id, fights: e.n, meanHpLost: r2(e.lost / e.n) }))
    .sort((a, b) => b.meanHpLost - a.meanHpLost || (a.id < b.id ? -1 : 1)).slice(0, 10);
  const fights = records.reduce((s, r) => s + r.fights, 0);
  const rests = records.reduce((s, r) => s + r.rests, 0);
  return {
    runs: n, wins: wins.length, winRate: r2(n ? wins.length / n : 0),
    deathsByKind: byKind, deathsByFloor: Object.fromEntries(Object.entries(byFloor).sort((a, b) => a[0] - b[0])),
    bossEntered: atBoss.length,
    meanHpAtBoss: r2(mean(atBoss.map((r) => r.hpAtBoss))), meanHpPctAtBoss: r2(mean(atBoss.map((r) => r.hpAtBoss / r.maxHpAtBoss))),
    fullHpAtBossShare: r2(atBoss.length ? atBoss.filter((r) => r.hpAtBoss >= r.maxHpAtBoss).length / n : 0),
    fullHpAtBossShareOfEntered: r2(atBoss.length ? atBoss.filter((r) => r.hpAtBoss >= r.maxHpAtBoss).length / atBoss.length : 0),
    meanFightsPerRun: r2(fights / (n || 1)), meanTurnsPerFight: r2(fights ? records.reduce((s, r) => s + r.turns, 0) / fights : 0),
    meanRestSites: r2(rests / (n || 1)), restPickShare: r2(rests ? records.reduce((s, r) => s + r.restPicks, 0) / rests : 0),
    meanEventsLeft: r2(records.reduce((s, r) => s + r.events, 0) / (n || 1)), meanShopsLeft: r2(records.reduce((s, r) => s + r.shops, 0) / (n || 1)),
    meanLevelUps: r2(records.reduce((s, r) => s + r.levelUps, 0) / (n || 1)),
    stalemates: records.reduce((s, r) => s + r.stalemates, 0), crashes: 0, topEncountersByHpLost: encounters,
  };
}

/** Run the fleet. `onCrash(seed, classId, error)` is called for a crash; the fleet stops there. */
export function runFleet(ctx, { classes, runs, acts, seedBase, policies, keepRuns = false }) {
  const report = { acts, runs, seedBase, results: {} };
  for (const policy of policies) {
    for (const classId of classes) {
      const records = [];
      for (let i = 0; i < runs; i++) {
        const seed = seedBase + i;
        try { records.push(simulateRun(ctx, classId, seed, policy, { acts })); } catch (error) {
          const e = new Error(`coresim crash: class ${classId} policy ${policy} seed ${seed}: ${error && error.message}`);
          e.stack = `${e.message}\n${error && error.stack}`; e.seed = seed; throw e;
        }
      }
      report.results[`${policy}:${classId}`] = { policy, classId, ...summarize(records), ...(keepRuns ? { records } : {}) };
    }
  }
  return report;
}

function allClassRow(report, policy, classes) {
  const rows = classes.map((c) => report.results[`${policy}:${c}`]);
  const m = (key) => r2(mean(rows.map((r) => r[key])));
  return { policy, classId: 'all', winRate: m('winRate'), meanHpPctAtBoss: m('meanHpPctAtBoss'), fullHpAtBossShare: m('fullHpAtBossShare'),
    deathsByKind: ['fight', 'elite', 'boss'].reduce((o, k) => (o[k] = rows.reduce((s, r) => s + (r.deathsByKind[k] || 0), 0), o), {}) };
}

function printReport(report, classes, policies) {
  const out = [];
  out.push(`coresim: ${report.runs} runs per class, acts ${report.acts}, seeds ${report.seedBase}..${report.seedBase + report.runs - 1}`);
  for (const policy of policies) {
    for (const classId of classes) {
      const r = report.results[`${policy}:${classId}`];
      out.push('', `[${policy}] ${classId}: ${r.wins}/${r.runs} won (${(r.winRate * 100).toFixed(1)}%)`);
      out.push(`  deaths by node: fight ${r.deathsByKind.fight} elite ${r.deathsByKind.elite} boss ${r.deathsByKind.boss}; by floor ${JSON.stringify(r.deathsByFloor)}`);
      out.push(`  entered boss ${r.bossEntered}: mean HP ${r.meanHpAtBoss} (${(r.meanHpPctAtBoss * 100).toFixed(1)}% of max); at full HP ${(r.fullHpAtBossShare * 100).toFixed(1)}% of runs`);
      out.push(`  fights/run ${r.meanFightsPerRun}, turns/fight ${r.meanTurnsPerFight}, rest sites/run ${r.meanRestSites} (Rest picked ${(r.restPickShare * 100).toFixed(1)}%), events left ${r.meanEventsLeft}, shops left ${r.meanShopsLeft}, level-ups ${r.meanLevelUps}`);
      out.push(`  stalemates ${r.stalemates}, crashes ${r.crashes}`);
      out.push(`  HP lost per fight, top: ${r.topEncountersByHpLost.map((e) => `${e.id} ${e.meanHpLost} (n=${e.fights})`).join('; ')}`);
    }
    const all = allClassRow(report, policy, classes);
    out.push('', `[${policy}] all classes: mean win rate ${(all.winRate * 100).toFixed(1)}%, mean HP at boss ${(all.meanHpPctAtBoss * 100).toFixed(1)}%, full-HP share ${(all.fullHpAtBossShare * 100).toFixed(1)}%, deaths fight/elite/boss ${all.deathsByKind.fight}/${all.deathsByKind.elite}/${all.deathsByKind.boss}`);
  }
  return out.join('\n');
}

// ---- command line ----------------------------------------------------------------------------------------------
function parseArgs(argv) {
  const opt = { class: 'all', runs: 200, acts: 1, seedBase: 1000, policy: 'both', json: null, records: false, quiet: false, selftest: false };
  const take = (i, name) => { if (i + 1 >= argv.length) throw new Error(`${name} needs a value`); return argv[i + 1]; };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--class') opt.class = take(i++, a);
    else if (a === '--runs') opt.runs = Number(take(i++, a));
    else if (a === '--acts') opt.acts = Number(take(i++, a));
    else if (a === '--seed-base') opt.seedBase = Number(take(i++, a));
    else if (a === '--policy') opt.policy = take(i++, a);
    else if (a === '--json') opt.json = take(i++, a);
    else if (a === '--records') opt.records = true;
    else if (a === '--quiet') opt.quiet = true;
    else if (a === '--selftest') opt.selftest = true;
    else throw new Error(`unknown argument '${a}'`);
  }
  if (opt.class !== 'all' && !CLASSES.includes(opt.class)) throw new Error(`--class expects ${CLASSES.join('|')}|all`);
  if (!(Number.isInteger(opt.runs) && opt.runs > 0)) throw new Error('--runs expects a positive integer');
  if (!(Number.isInteger(opt.acts) && opt.acts >= 1 && opt.acts <= 3)) throw new Error('--acts expects 1..3');
  if (!Number.isInteger(opt.seedBase)) throw new Error('--seed-base expects an integer');
  if (opt.policy !== 'both' && !POLICIES.includes(opt.policy)) throw new Error('--policy expects greedy|careful|both');
  return opt;
}

function selftest() {
  // Two identical small fleets must agree, and a planted stalemate guard must be reachable (cheap sanity, no plants needed).
  const ctx = loadProfile();
  const a = JSON.stringify(runFleet(ctx, { classes: ['reaver'], runs: 3, acts: 1, seedBase: 1000, policies: ['greedy'] }));
  const b = JSON.stringify(runFleet(ctx, { classes: ['reaver'], runs: 3, acts: 1, seedBase: 1000, policies: ['greedy'] }));
  if (a !== b) { console.error('coresim selftest: two identical fleets printed different reports'); process.exit(1); }
  console.log('coresim selftest: ok (deterministic, 3 Reaver runs)');
}

export async function main(argv) {
  let opt;
  try { opt = parseArgs(argv); } catch (error) { console.error(`coresim: ${error.message}`); process.exit(2); }
  if (opt.selftest) return selftest();
  const classes = opt.class === 'all' ? CLASSES : [opt.class];
  const policies = opt.policy === 'both' ? POLICIES : [opt.policy];
  const ctx = loadProfile();
  let report;
  try { report = runFleet(ctx, { classes, runs: opt.runs, acts: opt.acts, seedBase: opt.seedBase, policies, keepRuns: opt.records }); } catch (error) {
    console.error(error.stack || String(error));
    process.exit(1);
  }
  if (opt.json) writeFileSync(opt.json, `${JSON.stringify(report, null, 1)}\n`);
  if (!opt.quiet) console.log(printReport(report, classes, policies));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main(process.argv.slice(2));
