// src/engine/encounters.js — encounter + reward rolls, shop stock, unknown
// nodes, shrine math (SPEC §3.8, §6)
//
// Procedural systems: seeded algorithms whose every knob comes from content
// (balance.js, encounters/*.js). Pure functions of (registries, rng, args) —
// run mutation is limited to explicitly documented counters (flask pity,
// removal price) plus `applyGraceRefill`, which is the one function here that
// puts something IN the run — flasks, at a grace, from a pure plan it does not
// itself compute. Stream usage: encounters → 'enemyAI', card rewards →
// 'cardRewards', relics → 'relicRewards', flasks → 'flaskRewards',
// unknown nodes + events → 'events', shop stock → 'shop', cinders → 'misc'.
//
// Headless: no document/window/localStorage/timers.

import { passiveMult, passiveFlag } from '../model/registries.js';
import { relicInRewardPool } from '../model/schemas.js';
import { eventChoiceRequirementMet, EVENT_CHOICE_HISTORY_KIND } from '../model/quests.js';
import { graceRefillPlan, refillFlaskCharges, utilityFlaskIds } from '../model/gracerefill.js';
import { eligibleWeaponArts } from '../model/armamentTrading.js';
import { carriedIds } from '../model/loadout.js';
import { chestUpgradeable, CHEST_CATEGORIES } from '../model/rewardChest.js';
import { skillSchools, rarityUnlockedAt } from '../model/skills.js';
import { classDraftPool } from '../model/classTree.js';

// ---------------------------------------------------------------------------
// Encounters
// ---------------------------------------------------------------------------

/**
 * rollEncounter(registries, rng, { pool, seat, exclude }) → encounter id.
 * Weighted pick from the SEAT's pool (SPEC §13.2); `exclude` is the no-repeat
 * window (pass the last 1–2 fought encounter ids). `seat` is required and an
 * `act` argument is refused: an act is a tier, and a tier has no pool of its
 * own — guessing "act 1" would be the default this section exists to remove.
 */
export function rollEncounter(registries, rng, { pool, seat, act, exclude = [] } = {}) {
  if (act !== undefined) throw new Error('rollEncounter: `act` is retired — pass the seat (SPEC §13.2)');
  if (typeof seat !== 'string' || !seat) throw new Error('rollEncounter: a seat id is required (SPEC §13.2)');
  const inSeatPool = (e) => e.pool === pool && e.seat === seat;
  let candidates = registries.encounters.all().filter((e) => inSeatPool(e) && !exclude.includes(e.id));
  if (candidates.length === 0) {
    candidates = registries.encounters.all().filter(inSeatPool);
  }
  if (candidates.length === 0) throw new Error(`No encounters in pool '${pool}' for seat '${seat}'`);
  const total = candidates.reduce((a, e) => a + e.weight, 0);
  let r = rng.float('enemyAI') * total;
  for (const e of candidates) {
    r -= e.weight;
    if (r < 0) return e.id;
  }
  return candidates[candidates.length - 1].id;
}

// ---------------------------------------------------------------------------
// Combat rewards (SPEC §6)
// ---------------------------------------------------------------------------

/** Cinder reward for a combat pool, scaled by runeGainMult passives (floored). */
export function rollRuneReward(registries, rng, pool, relicIds) {
  const range = registries.balance.rewards.cinders[pool];
  const base = rng.int('misc', range[0], range[1]);
  return Math.floor(base * passiveMult(registries, relicIds, 'runeGainMult'));
}

/** Shared authored reward odds; Chaos always bypasses class and pool weights. */
export function cardRewardRarityWeights(registries, { classId, pool = 'normal', flatRarity = false } = {}) {
  if (flatRarity) return { common: 1, uncommon: 1, rare: 1 };
  const rewards = registries.balance.rewards;
  const poolId = Object.hasOwn(rewards.rarityWeights, pool) ? pool : 'normal';
  return rewards.rarityWeightsByClass?.[classId]?.[poolId] || rewards.rarityWeights[poolId];
}

/**
 * rollCardRewardIds(registries, rng, { classId, pool, relicIds, run }) →
 * distinct card ids (rarity-weighted per pool; elites offer +1 with Feral Eye).
 *
 * Handed the `run`, the offer reads and moves the card-rarity pity (SPEC
 * §3.8.1): `run.cardRarityOffset` shifts every slot's rare chance and
 * `run.cardRewardsSinceRare` forces a rare into the last slot once enough
 * offers went without one — at a normal, elite or boss door alike. Without a
 * run (a tool) or under Chaos Rewards, the roll is the plain weighted one and
 * no counter moves.
 */
export function rollCardRewardIds(registries, rng, { classId, pool, relicIds = [], flatRarity = false, run = null }) {
  const bal = registries.balance.rewards;
  let count = bal.cardChoices;
  if (pool === 'elite' && passiveFlag(registries, relicIds, 'eliteExtraCardReward')) count += 1;

  const cardPool = registries.classes.get(classId).cardPool;
  // flatRarity (Custom Climb "Chaos Rewards") ignores the pool weighting and
  // gives every rarity equal odds — far more rares than normal.
  const weights = cardRewardRarityWeights(registries, { classId, pool, flatRarity });
  const byRarity = {};
  for (const id of cardPool) {
    const def = registries.cards.get(id);
    (byRarity[def.rarity] = byRarity[def.rarity] || []).push(id);
  }
  const rarities = Object.keys(weights).filter((r) => byRarity[r] && byRarity[r].length && weights[r] > 0);
  const total = rarities.reduce((a, r) => a + weights[r], 0);
  if (!total) return [];

  const pity = run && !flatRarity ? cardPityState(registries, run) : null;
  const picks = [];
  const pickedRarities = [];
  let guard = 0;
  while (picks.length < count && guard++ < 100) {
    const slotWeights = pity ? pityWeights(weights, rarities, run.cardRarityOffset) : weights;
    const slotTotal = rarities.reduce((a, r) => a + slotWeights[r], 0);
    let roll = rng.float('cardRewards') * slotTotal;
    let rarity = rarities[rarities.length - 1];
    for (const r of rarities) {
      roll -= slotWeights[r];
      if (roll < 0) {
        rarity = r;
        break;
      }
    }
    const options = byRarity[rarity].filter((id) => !picks.includes(id));
    if (!options.length) continue;
    picks.push(rng.pick('cardRewards', options));
    pickedRarities.push(rarity);
    if (pity) advanceCardPity(pity, run, rarity);
  }
  if (pity) {
    if (!pickedRarities.includes('rare') && run.cardRewardsSinceRare >= pity.rareGuaranteeAfter && picks.length) {
      const rares = (byRarity.rare || []).filter((id) => !picks.includes(id));
      if (rares.length) {
        picks[picks.length - 1] = rng.pick('cardRewards', rares);
        pickedRarities[pickedRarities.length - 1] = 'rare';
        advanceCardPity(pity, run, 'rare');
      }
    }
    run.cardRewardsSinceRare = pickedRarities.includes('rare') ? 0 : run.cardRewardsSinceRare + 1;
  }
  return picks;
}

/** The pity knobs, with the run's counters defaulted in place (old saves). */
function cardPityState(registries, run) {
  const cfg = registries.balance.rewards.cardPity;
  if (!cfg) return null;
  if (!Number.isFinite(run.cardRarityOffset)) run.cardRarityOffset = cfg.offsetStart;
  if (!Number.isInteger(run.cardRewardsSinceRare) || run.cardRewardsSinceRare < 0) run.cardRewardsSinceRare = 0;
  return cfg;
}

function advanceCardPity(cfg, run, rarity) {
  if (rarity === 'common') run.cardRarityOffset = Math.min(cfg.offsetMax, run.cardRarityOffset + cfg.offsetStep);
  else if (rarity === 'rare') run.cardRarityOffset = cfg.offsetStart;
}

/**
 * pityWeights(weights, rarities, offset) → percentages per rarity (SPEC
 * §3.8.1): the rare share of the authored row plus `offset` points, clamped
 * to [0, 100]; the rest split between the other rarities in their ratio.
 * A row the pool cannot fill a rare for is returned unchanged.
 */
export function pityWeights(weights, rarities, offset) {
  const total = rarities.reduce((a, r) => a + weights[r], 0);
  if (!rarities.includes('rare') || !total) return weights;
  const rarePct = Math.min(100, Math.max(0, (100 * weights.rare) / total + offset));
  const others = rarities.filter((r) => r !== 'rare');
  const otherTotal = others.reduce((a, r) => a + weights[r], 0);
  const out = { rare: others.length ? rarePct : 100 };
  for (const r of others) out[r] = otherTotal ? ((100 - rarePct) * weights[r]) / otherTotal : 0;
  return out;
}

/**
 * rollSkillDraftIds(registries, rng, { classId, loadout, skillId, level,
 * pool, flatRarity, size }) → distinct card ids for one skill draft (plan
 * phase 4b): the class reward pool filtered to the track's schools
 * (model/skills.js skillSchools), rarities unlocked by the level
 * (balance.skill.rarityUnlock), weighted by the door's own reward odds
 * (`rarityWeights[pool]`, normal when the pool has no row; equal odds under
 * Chaos Rewards, as the card offer), `balance.skill.draftSize` picks on the
 * same 'cardRewards' stream the card offer rolls on. An empty pool rolls
 * nothing and draws nothing.
 */
export function rollSkillDraftIds(registries, rng, { classId, loadout, skillId, level, pool = 'normal', flatRarity = false, size }) {
  const skill = registries.balance.skill || {};
  const count = Number.isInteger(size) ? size : skill.draftSize;
  const schools = new Set(skillSchools(registries, loadout, skillId));
  const unlocked = rarityUnlockedAt(registries, level);
  if (!schools.size || !unlocked.length || !(count > 0)) return [];
  const weights = cardRewardRarityWeights(registries, { classId, pool, flatRarity });
  const byRarity = {};
  for (const id of registries.classes.get(classId).cardPool) {
    const def = registries.cards.get(id);
    if (!unlocked.includes(def.rarity) || !(def.tags || []).some((t) => schools.has(t))) continue;
    (byRarity[def.rarity] = byRarity[def.rarity] || []).push(id);
  }
  const rarities = unlocked.filter((r) => byRarity[r] && byRarity[r].length && weights[r] > 0);
  const total = rarities.reduce((a, r) => a + weights[r], 0);
  if (!total) return [];
  const picks = [];
  let guard = 0;
  while (picks.length < count && guard++ < 100) {
    let roll = rng.float('cardRewards') * total;
    let rarity = rarities[rarities.length - 1];
    for (const r of rarities) {
      roll -= weights[r];
      if (roll < 0) { rarity = r; break; }
    }
    const options = byRarity[rarity].filter((id) => !picks.includes(id));
    if (!options.length) {
      if (rarities.every((r) => byRarity[r].every((id) => picks.includes(id)))) break;
      continue;
    }
    picks.push(rng.pick('cardRewards', options));
  }
  return picks;
}

/**
 * rollClassDraftIds(registries, rng, { classId, coreTags, level, size }) →
 * distinct tree node ids for one class draft (plan phase 5b): the class's
 * draftable nodes (model/classTree.js classDraftPool), `balance.skill.draftSize`
 * picks on the 'cardRewards' stream. An empty pool draws nothing.
 */
export function rollClassDraftIds(registries, rng, { classId, coreTags = [], level = 0, size }) {
  const count = Number.isInteger(size) ? size : (registries.balance.skill || {}).draftSize;
  const pool = classDraftPool(registries, classId, coreTags, level);
  if (!pool.length || !(count > 0)) return [];
  const picks = [];
  while (picks.length < Math.min(count, pool.length)) {
    picks.push(rng.pick('cardRewards', pool.filter((id) => !picks.includes(id))));
  }
  return picks;
}

/**
 * rollFlaskDrop(registries, rng, run) → flask id | null.
 * StS-style decaying chance: −step on a drop, +step on a miss (clamped),
 * persisted on run.flaskChancePct.
 */
export function rollFlaskDrop(registries, rng, run) {
  const bal = registries.balance.rewards;
  if (run.flaskChancePct == null) run.flaskChancePct = bal.flaskDropBasePct;
  const hit = rng.float('flaskRewards') * 100 < run.flaskChancePct;
  if (hit) {
    run.flaskChancePct = Math.max(0, run.flaskChancePct - bal.flaskDropStepPct);
    const pool = utilityFlaskIds(registries);
    return pool.length ? rng.pick('flaskRewards', pool) : null;
  }
  run.flaskChancePct = Math.min(100, run.flaskChancePct + bal.flaskDropStepPct);
  return null;
}

/**
 * rollRelicReward(registries, rng, ownedIds, { rarities }) → relic id | null.
 * Excludes owned relics and quest-pool relics (RELIC_POOLS); default pool is
 * common/uncommon/rare (elite drops); pass ['boss'] for boss rewards.
 */
export function rollRelicReward(registries, rng, ownedIds, { rarities = ['common', 'uncommon', 'rare'] } = {}) {
  const pool = registries.relics
    .all()
    .filter((r) => relicInRewardPool(r) && rarities.includes(r.rarity) && !ownedIds.includes(r.id))
    .map((r) => r.id);
  return pool.length ? rng.pick('relicRewards', pool) : null;
}

/**
 * rollBossRelicChoices(registries, rng, ownedIds, count) → [relic id] (SPEC §6.1).
 * Up to `count` DISTINCT boss-rarity relics, drawn without replacement on the
 * 'relicRewards' stream from the same pool rollRelicReward reads (owned and
 * quest-pool relics excluded). A short pool yields fewer; an empty one [].
 * `count` defaults to balance.rewards.bossRelicChoices.
 */
export function rollBossRelicChoices(registries, rng, ownedIds, count = registries.balance.rewards.bossRelicChoices) {
  const pool = registries.relics
    .all()
    .filter((r) => relicInRewardPool(r) && r.rarity === 'boss' && !ownedIds.includes(r.id))
    .map((r) => r.id);
  const out = [];
  while (out.length < count && pool.length) {
    const id = rng.pick('relicRewards', pool);
    pool.splice(pool.indexOf(id), 1);
    out.push(id);
  }
  return out;
}

/**
 * autoPickBossRelic(registries, rng, ownedIds) → relic id | null.
 * A player-less boss door (simulators, bots): lays out the same choice
 * rollBossRelicChoices does, then keeps one through a seeded pick on the same
 * 'relicRewards' stream. null when the pool is exhausted — the caller pays
 * balance.rewards.bossRelicConsolationCinders, as the game does.
 */
export function autoPickBossRelic(registries, rng, ownedIds) {
  const offered = rollBossRelicChoices(registries, rng, ownedIds);
  return offered.length ? rng.pick('relicRewards', offered) : null;
}

/**
 * rollArmamentDrop(registries, rng, { source, found, carried }) → id | null.
 *
 * Deterministic on stream 'armaments', like every other reward roll, so a seed
 * still replays exactly. `source` keys into balance.equipment.drops.chance and
 * .rarityWeights ('treasure' | 'elite' | 'boss').
 *
 * `found` is everything the profile has ever held and `carried` is what this
 * run already has; a piece in either is a non-event, so the roll prefers
 * something new and returns null when there is nothing left to give (the
 * caller pays consolation cinders instead).
 */
export function rollArmamentDrop(registries, rng, { source, found = [], carried = [], guaranteed = false } = {}) {
  const cfg = (registries.balance.equipment || {}).drops || {};
  if (!cfg.enabled) return null;
  // `guaranteed` (the elite chest's armament, SPEC §3.8.1) skips the chance
  // roll only: the rarity weights and the prefer-unfound rule still apply.
  if (!guaranteed) {
    const chance = (cfg.chance || {})[source];
    if (!chance) return null;
    if (rng.int('armaments', 1, 100) > chance) return null;
  }

  const weights = (cfg.rarityWeights || {})[source] || {};
  const seen = new Set([...found, ...carried]);
  let pool = (registries.equipment.armaments || []).filter((a) => a.unlock === '');
  if (cfg.preferUnfound) {
    const fresh = pool.filter((a) => !seen.has(a.id));
    if (!fresh.length) return null;
    pool = fresh;
  }

  // Rarity first (so a rare stays rare however many rares exist), then a piece
  // from within it. Rarities the pool can't fill are skipped rather than
  // rolling a null.
  const rarities = Object.keys(weights).filter((r) => pool.some((a) => a.rarity === r));
  if (!rarities.length) return null;
  const total = rarities.reduce((a, r) => a + weights[r], 0);
  let roll = rng.float('armaments') * total;
  let rarity = rarities[rarities.length - 1];
  for (const r of rarities) {
    roll -= weights[r];
    if (roll < 0) {
      rarity = r;
      break;
    }
  }
  const candidates = pool.filter((a) => a.rarity === rarity && Number(a.dropWeight) > 0);
  if (!candidates.length) return null;
  const pieceTotal = candidates.reduce((sum, piece) => sum + piece.dropWeight, 0);
  let pieceRoll = rng.float('armaments') * pieceTotal;
  for (const piece of candidates) {
    pieceRoll -= piece.dropWeight;
    if (pieceRoll < 0) return piece.id;
  }
  return candidates[candidates.length - 1].id;
}

// ---------------------------------------------------------------------------
// The elite chest (SPEC §3.8.1)
// ---------------------------------------------------------------------------

/** A view of `rng` whose every draw, whatever stream it names, is on 'relicRewards'. */
function relicStreamOnly(rng) {
  return {
    seed: rng.seed,
    float: () => rng.float('relicRewards'),
    int: (_stream, min, max) => rng.int('relicRewards', min, max),
    pick: (_stream, array) => rng.pick('relicRewards', array),
    shuffle: (_stream, array) => rng.shuffle('relicRewards', array),
    chance: (_stream, pct) => rng.chance('relicRewards', pct),
  };
}

// The chest's closed category set and grant rules live in model/rewardChest.js.
export { chestUpgradeable, CHEST_CATEGORIES };

/**
 * rollEliteChest(registries, rng, run, { found, exclude }) → { options } | null.
 * Up to `balance.rewards.eliteChest.choices` options, each of a DISTINCT
 * category drawn by `categoryWeights` without replacement (stream
 * 'relicRewards'). A category that cannot build a payload is dropped and the
 * draw moves on; no buildable category at all rolls no chest. Every draw,
 * the payload rolls included, is on 'relicRewards' only. Pure apart from
 * the rng: the run is read, never written. `found` is the profile's found
 * armaments (the armament roll's prefer-unfound input); `exclude` names
 * armament ids the chest's piece may not be (the door's own armament drop);
 * `omit` names categories this door leaves out entirely (the co-op host's
 * `['armament']`).
 */
export function rollEliteChest(registries, outerRng, run, { found = [], exclude = [], omit = [] } = {}) {
  const cfg = registries.balance.rewards.eliteChest;
  if (!cfg || !(cfg.choices > 0)) return null;
  // EVERY chest draw is on 'relicRewards' — the stream the elite's one relic
  // drew on before the chest replaced it — whatever stream a builder names
  // (the armament roll's 'armaments', the upgrade's 'cardRewards', the
  // cinders' 'misc'). So the door's card offer, its armament drop and every
  // later offer on those streams replay exactly as they did before the chest.
  const rng = relicStreamOnly(outerRng);
  const builders = {
    relic() {
      const relicId = rollRelicReward(registries, rng, run.relics || []);
      return relicId ? { category: 'relic', relicId } : null;
    },
    upgrade() {
      const owned = (run.deck || []).filter((inst) => chestUpgradeable(registries, run, inst));
      const rares = registries.classes.get(run.class).cardPool.filter((id) => {
        const def = registries.cards.get(id);
        return def && def.rarity === 'rare';
      });
      const preferOwned = rng.int('cardRewards', 1, 100) <= cfg.upgradeOwnedPct;
      if (owned.length && (preferOwned || !rares.length)) {
        const inst = rng.pick('cardRewards', owned);
        return { category: 'upgrade', mode: 'owned', instanceId: inst.instanceId, cardId: inst.cardId };
      }
      return rares.length ? { category: 'upgrade', mode: 'rare', cardId: rng.pick('cardRewards', rares) } : null;
    },
    armament() {
      // The door's own armament drop (`exclude`) is never the chest's piece too.
      const carried = [...carriedIds(run.loadout), ...exclude.filter(Boolean)];
      const armamentId = rollArmamentDrop(registries, rng, { source: 'elite', found, carried, guaranteed: true });
      if (armamentId) return { category: 'armament', armamentId };
      const inDeck = new Set((run.deck || []).map((c) => c.cardId));
      const arts = eligibleWeaponArts(registries).filter((id) => !inDeck.has(id));
      return arts.length ? { category: 'armament', weaponArtId: rng.pick('armaments', arts) } : null;
    },
    cinders() {
      const [lo, hi] = cfg.cinders;
      return { category: 'cinders', cinders: rng.int('misc', lo, hi), smithingStones: cfg.smithingStones };
    },
  };
  // `omit` names categories a door cannot grant (co-op has no armament bag,
  // SPEC §3.8.1): they leave the draw before it starts, so nothing is spent on them.
  let remaining = CHEST_CATEGORIES.filter((c) => (cfg.categoryWeights[c] || 0) > 0 && !omit.includes(c));
  const options = [];
  while (options.length < cfg.choices && remaining.length) {
    const total = remaining.reduce((a, c) => a + cfg.categoryWeights[c], 0);
    let roll = rng.float('relicRewards') * total;
    let category = remaining[remaining.length - 1];
    for (const c of remaining) {
      roll -= cfg.categoryWeights[c];
      if (roll < 0) { category = c; break; }
    }
    remaining = remaining.filter((c) => c !== category);
    const option = builders[category]();
    if (option) options.push(option);
  }
  options.sort((a, b) => CHEST_CATEGORIES.indexOf(a.category) - CHEST_CATEGORIES.indexOf(b.category));
  return options.length ? { options } : null;
}

// ---------------------------------------------------------------------------
// Shop (SPEC §6 prices — all from balance.shop)
// ---------------------------------------------------------------------------

/**
 * buildShopStock(registries, rng, run) → { cards, relics, flasks, removeCost }.
 * cards/relics/flasks: [{ id, cost }]. Deterministic on stream 'shop'.
 */
export function buildShopStock(registries, rng, run) {
  const bal = registries.balance.shop;
  const classId = run.class;

  const cardIds = rollShopCards(registries, rng, classId, bal.cardStock);
  const cards = cardIds.map((id) => ({
    id,
    cost: rng.int('shop', ...bal.cardCost[registries.cards.get(id).rarity]),
  }));

  const relicPool = registries.relics
    .all()
    .filter((r) => relicInRewardPool(r) && ['common', 'uncommon', 'rare'].includes(r.rarity) && !run.relics.includes(r.id))
    .map((r) => r.id);
  const relics = [];
  for (let i = 0; i < bal.relicStock && relicPool.length; i++) {
    const id = rng.pick('shop', relicPool);
    relicPool.splice(relicPool.indexOf(id), 1);
    relics.push({ id, cost: rng.int('shop', ...bal.relicCost[registries.relics.get(id).rarity]) });
  }

  const flaskIds = utilityFlaskIds(registries);
  const flasks = [];
  for (let i = 0; i < bal.flaskStock && flaskIds.length; i++) {
    const id = rng.pick('shop', flaskIds);
    flasks.push({ id, cost: rng.int('shop', bal.flaskCost[0], bal.flaskCost[1]) });
  }

  const removeCost = bal.removeBase + bal.removeStep * (run.removesPurchased || 0);
  const owned = new Set(carriedIds(run.loadout));
  const armamentPool = (registries.equipment.armaments || [])
    .filter((piece) => !owned.has(piece.id) && bal.armamentCost?.[piece.rarity]);
  const armaments = [];
  for (let i = 0; i < (bal.armamentStock || 0) && armamentPool.length; i++) {
    const piece = rng.pick('shop', armamentPool);
    armamentPool.splice(armamentPool.indexOf(piece), 1);
    armaments.push({ id: piece.id, cost: rng.int('shop', ...bal.armamentCost[piece.rarity]) });
  }
  const artPool = eligibleWeaponArts(registries);
  const weaponArts = [];
  for (let i = 0; i < (bal.weaponArtStock || 0) && artPool.length; i++) {
    const id = rng.pick('shop', artPool);
    artPool.splice(artPool.indexOf(id), 1);
    weaponArts.push({ id, cost: rng.int('shop', ...bal.weaponArtCost) });
  }
  return { cards, relics, flasks, armaments, weaponArts, removeCost };
}

// Shop card pool = the class pool + neutral colorless cards (StS-faithful:
// colorless is sold at Merchants, not offered in standard combat rewards).
// The status/curse colorless are rarity 'special' and excluded here.
const SHOP_RARITIES = ['common', 'uncommon', 'rare'];
function rollShopCards(registries, rng, classId, count) {
  const artIds = new Set(eligibleWeaponArts(registries));
  const colorless = registries.cards
    .all()
    .filter((c) => c.class === 'colorless' && SHOP_RARITIES.includes(c.rarity) && !artIds.has(c.id))
    .map((c) => c.id);
  const pool = [...registries.classes.get(classId).cardPool, ...colorless];
  const out = [];
  while (out.length < count && pool.length) {
    const id = rng.pick('shop', pool);
    pool.splice(pool.indexOf(id), 1);
    out.push(id);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Unknown nodes + shrine math
// ---------------------------------------------------------------------------

/**
 * resolveUnknownNode(registries, rng, { seenEvents, tier, history }) →
 *   { kind: 'event', eventId } | { kind: 'fight'|'shrine'|'treasure' }
 * Odds from mapConfigs[tier].unknownWeights — per TIER, beside the geometry
 * they describe (they used to be `balance.unknownNode`, a flat global that
 * could not differ per act while the map did). `tier` is required: guessing
 * tier 1 would be a default nobody authored, which is the fallback this rework
 * exists to remove. (It was `act`; SPEC §13 made the act number the tier and
 * the seat the content — unknown odds are geometry, so they stay with the tier.)
 * Events avoid repeats within a run while unseen ones remain. Stream 'events'
 * (SPEC §5.6).
 */
export function resolveUnknownNode(registries, rng, { seenEvents = [], tier, act, history = [] } = {}) {
  if (act !== undefined) throw new Error('resolveUnknownNode: `act` is retired — pass the tier (SPEC §13.2)');
  const cfg = registries.mapConfig(tier);
  const odds = cfg && cfg.unknownWeights;
  if (!odds) throw new Error(`resolveUnknownNode: tier ${JSON.stringify(tier)} has no unknownWeights`);
  const total = Object.values(odds).reduce((a, b) => a + b, 0);
  let r = rng.float('events') * total;
  let kind = 'event';
  for (const [k, w] of Object.entries(odds)) {
    r -= w;
    if (r < 0) {
      kind = k;
      break;
    }
  }
  if (kind !== 'event') return { kind };
  // Quest steps (E12): an event with a history requirement is in the pool only
  // once the run's choices have earned it — and it never falls back in either,
  // because a step met before the step it answers is a broken chain, not a
  // repeat. Everything ungated behaves exactly as before.
  // A gated step the run has already answered is COMPLETE, not re-earned: the
  // keeper does not come twice for one grave, and the reward it carries is
  // handed over once. Only gated events are consulted — an ungated event that
  // appears in the history keeps its shipped behaviour (repeatable across
  // acts; `seenEvents` de-duplicates within one map).
  const gates = registries.eventHistoryRequirements || {};
  const completed = new Set(history
    .filter((row) => row && row.kind === EVENT_CHOICE_HISTORY_KIND)
    .map((row) => row.eventId));
  const earned = registries.events.ids()
    .filter((id) => !gates[id] || (!completed.has(id) && eventChoiceRequirementMet(gates[id], { history })));
  let pool = earned.filter((id) => !seenEvents.includes(id));
  if (!pool.length) pool = earned;
  if (!pool.length) return { kind: 'fight' }; // no events shipped: fall back
  return { kind: 'event', eventId: rng.pick('events', pool) };
}

/**
 * applyGraceRefill(registries, run, { counts }) → the plan it just applied.
 *
 * THE ONE MUTATION, and it is listed in this file's header beside flask pity
 * and the removal price. Everything that decides WHAT to hand over is pure and
 * lives in model/gracerefill.js, so a screen, a settings row and a sim can each
 * ask what a grace would do without one of them having to do it.
 *
 * AUTOMATIC, NOT A CHOICE. Constantine: "flasks should refill automatically at
 * graces". The caller fires this on ARRIVAL at the shrine, before Rest or Smith
 * is offered — resting is one of the two things you can then spend the stop on,
 * and the flasks are not the price of either.
 *
 * IDEMPOTENT BY CONSTRUCTION, which is what makes a re-entry safe: the plan is
 * a TOP-UP to `count`, so calling it twice at one shrine grants nothing the
 * second time. A resumed save that re-mounts the shrine cannot double-pour.
 */
export function applyGraceRefill(registries, run, opts = {}) {
  if (run.flaskCharges) {
    refillFlaskCharges(run.flaskCharges);
    return { chargePools: structuredClone(run.flaskCharges), grants: [], total: 0, shortfalls: [] };
  }
  const plan = graceRefillPlan(registries, run, opts);
  for (const flaskId of plan.grants) run.flasks.push({ flaskId });
  return plan;
}

