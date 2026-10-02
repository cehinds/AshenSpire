// src/model/master.js — what the wise master does (SPEC §14.5, §14.6 step 7),
// headless.
//
// A master visit is a stock of kind `master` (engine/shopKinds.js
// buildMasterStock): the master picked for the visit (`masterId`, one row of
// `shops.masters`), three stocked shelves filtered to his tracks — skill
// books (the market's purchase), weapon arts and armaments (the market's
// §12.2 purchase, model/armamentTrading.js) — and five services. Each service
// is the shape every purchase in this game has: a PLAN is inert and names its
// refusal in one sentence (content/source/uiStrings.csv); a COMMIT re-plans,
// refuses a quote whose revision, price or other quoted number no longer
// matches (`stock.tradeRevision`), mutates, and bumps the revision, so one
// quote commits once. A refusal changes nothing.
//
//   training     training.cinders for training.xp on one of his tracks,
//                through awardSkillXp with the track's loadout-independent
//                schools; training.perVisit sessions per visit (`training.left`)
//   respec       one of his tracks at level ≥ 2 back to level 1 with xp 0; a
//                share of the XP spent above level 1 goes to run.trainingPool
//   lesson       one skill draft for one of his tracks, rolled once per track
//                and visit (engine/shopKinds.js rollMasterLesson), for cinders
//   appraisal    a read: each of his tracks' level, XP, lesson pool, respec
//   redistribute the training pool spent on any track, free
//
// PRICES. A service's price is read when quoted from the run's frozen
// `gameConfig.shops.master.*` rows (registries.shops), never stored, so it is
// the same after a reload, and scaled by a custom run's shop price multiplier,
// rounding up, as every market price is (§14.3).
//
// A SERVICE STAYS ONCE ROLLED (§14.4's ruling, extended by §14.5): whether it
// can act is judged here, live, when it is shown and quoted —
// `masterServiceCandidates` lists what each could act on now, and the screen
// shows a service with none as unavailable, with the reason
// `masterServiceIdleReason` names.
//
// THE MASTER'S PIECES are read from content, never from the loadout: a weapon
// or focus track's are every armament of its item type, and dualWield's every
// one-handed armament (`WeaponCardPackageModel` handsRequired 1). So the
// shelves, the lesson and the training upgrade do not depend on what is held.
import { shopSentence, shopStockKind, shopStockOfferings } from './shopKinds.js';
import { carriedIds, WeaponCardPackageModel } from './loadout.js';
import { eligibleWeaponArts } from './armamentTrading.js';
import { awardSkillXp, skillTracks, skillKindOf, skillLevel, xpToNext, rarityUnlockedAt, skillUpgradesCards, DUAL_WIELD_SKILL } from './skills.js';
import { unusedInstanceId } from './deckRules.js';
import { cardRewardRarityWeights } from './rewardOdds.js';

const say = (id, tokens = {}) => shopSentence(id, tokens);
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const ARMOUR_ITEM_TYPE = 'item:armor';

/** The master's stockless services (SPEC §14.5): each stays laid out once rolled. */
export const MASTER_SERVICES = Object.freeze(['training', 'respec', 'lesson', 'appraisal', 'redistribute']);
/** The master's stocked shelves, in the order content/shops.js writes them. */
export const MASTER_SHELVES = Object.freeze(['skillBooks', 'weaponArts', 'armaments']);

export const masterRevision = (run) => run.shopStock?.tradeRevision || 0;

/** The master's offering row `id`, as configured for this run. */
export function masterOffering(registries, id) {
  return (registries.shops?.master?.offerings || []).find((row) => row && row.id === id) || null;
}

/** Whether the visit open now is a master that laid out `id`. */
export function masterOffers(run, id) {
  return !!run.shopStock && shopStockKind(run.shopStock) === 'master' && shopStockOfferings(run.shopStock).includes(id);
}

/** The master row a stock names (`stock.masterId`), or null. */
export function masterById(registries, masterId) {
  return (registries.shops?.masters || []).find((row) => row && row.id === masterId) || null;
}

/** The master of the visit open now, or null. */
export function masterOf(registries, run, stock = run?.shopStock) {
  return object(stock) && stock.kind === 'master' ? masterById(registries, stock.masterId) : null;
}

const cinders = (n, priceMult) => (priceMult === 1 ? n : Math.ceil(n * priceMult));
const affordable = (run, cost) => Number.isSafeInteger(run.cinders) && run.cinders >= cost;
const pool = (run) => (Number.isSafeInteger(run.trainingPool) && run.trainingPool > 0 ? run.trainingPool : 0);

/** A track's label, as skillTracks names it. */
export function trackLabel(registries, skillId) {
  return skillTracks(registries).find((row) => row.id === skillId)?.label || skillId;
}

// ---------------------------------------------------------------------------
// The master's pieces, item types and schools (loadout-independent)
// ---------------------------------------------------------------------------

function oneHanded(registries, piece) {
  try { return WeaponCardPackageModel.fromPiece(registries, piece)?.handsRequired === 1; }
  catch { return false; }
}

/**
 * masterPieces(registries, skillId) → the armaments a master's track stands
 * for: every armament of a weapon or focus track's item type, and for
 * `dualWield` only the one-handed armaments (SPEC §14.5) — never a two-handed
 * piece that merely shares their item type.
 */
export function masterPieces(registries, skillId) {
  const kind = skillKindOf(registries, skillId);
  const armaments = registries.equipment?.armaments || [];
  if (kind === 'weapon' || kind === 'focus') return armaments.filter((piece) => (piece.itemTypeTags || []).includes(skillId));
  if (kind === 'dual') return armaments.filter((piece) => oneHanded(registries, piece));
  return [];
}

/** The item types a track names: its own, or for dualWield every type with a one-handed armament. */
export function masterItemTypes(registries, skillId) {
  const kind = skillKindOf(registries, skillId);
  if (kind === 'weapon' || kind === 'focus') return [skillId];
  if (kind !== 'dual') return [];
  const types = [];
  for (const piece of masterPieces(registries, DUAL_WIELD_SKILL)) {
    for (const type of piece.itemTypeTags || []) if (type !== ARMOUR_ITEM_TYPE && !types.includes(type)) types.push(type);
  }
  return types;
}

/**
 * masterSchools(registries, skillId) → the track's loadout-independent card
 * schools (SPEC §14.5, the lesson's rule): the card-domain tags every
 * armament of the track's item types carries in tagging.csv. For dualWield,
 * the union over every item type that can be dual-wielded.
 */
export function masterSchools(registries, skillId) {
  const schools = new Set((registries.nodes || []).filter((node) => node.parentId === 'card').map((node) => node.id));
  const types = masterItemTypes(registries, skillId);
  const out = [];
  for (const piece of registries.equipment?.armaments || []) {
    if (!(piece.itemTypeTags || []).some((type) => types.includes(type))) continue;
    for (const tag of piece.tags || []) if (schools.has(tag) && !out.includes(tag)) out.push(tag);
  }
  return out;
}

// The armaments of every track a master teaches, in registry order.
function piecesOfMaster(registries, master) {
  const ids = new Set((master?.skills || []).flatMap((skillId) => masterPieces(registries, skillId).map((piece) => piece.id)));
  return (registries.equipment?.armaments || []).filter((piece) => ids.has(piece.id));
}

/** The master's rack pool: his pieces the run does not carry that have a `balance.shop.armamentCost` row. */
export function masterArmamentPool(registries, run, master) {
  const carried = new Set(carriedIds(run.loadout));
  const costs = registries.balance.shop.armamentCost || {};
  return piecesOfMaster(registries, master).filter((piece) => !carried.has(piece.id) && Array.isArray(costs[piece.rarity]));
}

/** The master's art pool: the mountable weapon arts named in his pieces' `weaponArtDefaults`. */
export function masterArtPool(registries, master) {
  const named = new Set(piecesOfMaster(registries, master).flatMap((piece) => piece.weaponCardPackage?.weaponArtDefaults || []));
  return eligibleWeaponArts(registries).filter((id) => named.has(id));
}

/** The master's book pool: every skill book whose `skill` is one of his tracks. */
export function masterBookPool(registries, master) {
  const skills = master?.skills || [];
  return registries.consumables.all().filter((def) => def.kind === 'skillBook' && skills.includes(def.skill));
}

// ---------------------------------------------------------------------------
// The stale-quote refusal, and the shared refusals
// ---------------------------------------------------------------------------

function stale(quote, plan, keys) {
  for (const key of ['revision', 'cost', ...keys]) {
    if ((quote?.[key] ?? null) !== (plan[key] ?? null)) throw new Error(say('shop.refuse.stale'));
  }
}
function bump(run, plan) {
  run.shopStock.tradeRevision = plan.revision + 1;
}
// The refusal every master-track service shares: offered, then taught.
function teachingRefusal(registries, run, id, skillId) {
  if (!masterOffers(run, id)) return say('master.refuse.notOffered');
  const master = masterOf(registries, run);
  if (!master) return say('master.refuse.notOffered');
  if (!master.skills.includes(skillId)) return say('master.refuse.untaught', { master: master.name, skill: trackLabel(registries, skillId) });
  return '';
}

// ---------------------------------------------------------------------------
// Training
// ---------------------------------------------------------------------------

export function trainingPlan(registries, run, skillId, { priceMult = 1 } = {}) {
  const row = masterOffering(registries, 'training')?.training || null;
  const cost = row ? cinders(row.cinders, priceMult) : 0;
  const left = run.shopStock?.training?.left ?? 0;
  let reason = teachingRefusal(registries, run, 'training', skillId);
  if (!reason && !row) reason = say('master.refuse.notOffered');
  else if (!reason && !(left > 0)) reason = say('master.refuse.trainingSpent');
  else if (!reason && !affordable(run, cost)) reason = say('shop.refuse.cinders');
  return { ok: !reason, reason, skillId, cost, xp: row?.xp ?? 0, left, revision: masterRevision(run) };
}

/** One session: the cost spent, one session taken, the XP paid through awardSkillXp with the track's master schools. */
export function commitTraining(registries, run, quote, { priceMult = 1 } = {}) {
  const plan = trainingPlan(registries, run, quote.skillId, { priceMult });
  if (!plan.ok) throw new Error(plan.reason);
  stale(quote, plan, ['skillId', 'xp']);
  run.cinders -= plan.cost;
  run.shopStock.training = { left: plan.left - 1 };
  const receipt = awardSkillXp(registries, run, plan.skillId, plan.xp, { schools: masterSchools(registries, plan.skillId) });
  bump(run, plan);
  return { ...receipt, spent: plan.cost };
}

// ---------------------------------------------------------------------------
// Respec
// ---------------------------------------------------------------------------

/** The refund percentage, clamped to 50–75 at every read (SPEC §14.5). */
export function respecRefundPct(registries) {
  const value = Number(registries.shops?.master?.respecRefundPct);
  return Math.min(75, Math.max(50, Number.isFinite(value) ? value : 50));
}

/** The XP a track spent above level 1: Σ xpToNext(kind, l) for l = 1 … L − 1, plus the row's XP. */
export function xpSpentAboveOne(registries, run, skillId) {
  const kind = skillKindOf(registries, skillId);
  const row = run.skills?.[skillId];
  if (!kind || !row) return 0;
  let spent = Number.isSafeInteger(row.xp) ? row.xp : 0;
  for (let level = 1; level < row.level; level++) spent += xpToNext(registries, kind, level);
  return spent;
}

export function respecPlan(registries, run, skillId, { priceMult = 1 } = {}) {
  const cost = masterOffering(registries, 'respec')?.respec?.cost || null;
  const level = skillLevel(run, skillId);
  const price = cost ? cinders(cost.base + cost.perLevel * level, priceMult) : 0;
  const refund = Math.floor((respecRefundPct(registries) * xpSpentAboveOne(registries, run, skillId)) / 100);
  let reason = teachingRefusal(registries, run, 'respec', skillId);
  if (!reason && !cost) reason = say('master.refuse.notOffered');
  else if (!reason && level < 2) reason = say('master.refuse.respecLevel', { skill: trackLabel(registries, skillId), level });
  else if (!reason && !affordable(run, price)) reason = say('shop.refuse.cinders');
  return { ok: !reason, reason, skillId, level, cost: price, refund, revision: masterRevision(run) };
}

/**
 * The respec, atomic: the track back to level 1 with xp 0, its queued drafts
 * down by the levels lost (floored at 0), the refund into the training pool.
 * Cards already drafted and upgrades already applied stay.
 */
export function commitRespec(registries, run, quote, { priceMult = 1 } = {}) {
  const plan = respecPlan(registries, run, quote.skillId, { priceMult });
  if (!plan.ok) throw new Error(plan.reason);
  stale(quote, plan, ['skillId', 'level', 'refund']);
  const row = run.skills[plan.skillId];
  run.skills = { ...run.skills, [plan.skillId]: { xp: 0, level: 1, pendingDrafts: Math.max(0, row.pendingDrafts - (plan.level - 1)) } };
  run.trainingPool = pool(run) + plan.refund;
  run.cinders -= plan.cost;
  bump(run, plan);
  return { skillId: plan.skillId, levelBefore: plan.level, refund: plan.refund, spent: plan.cost };
}

// ---------------------------------------------------------------------------
// Redistribute
// ---------------------------------------------------------------------------

export function redistributePlan(registries, run, skillId, amount) {
  const have = pool(run);
  let reason = '';
  if (!masterOffers(run, 'redistribute')) reason = say('master.refuse.notOffered');
  else if (!skillKindOf(registries, skillId)) reason = say('master.refuse.unknownTrack', { skill: String(skillId) });
  else if (!have) reason = say('master.refuse.poolEmpty');
  else if (!(Number.isSafeInteger(amount) && amount >= 1 && amount <= have)) reason = say('master.refuse.amount', { amount: String(amount), pool: have });
  return { ok: !reason, reason, skillId, amount, pool: have, cost: 0, revision: masterRevision(run) };
}

/** Free: `amount` from the pool, paid to the track through awardSkillXp as its own XP would be. */
export function commitRedistribute(registries, run, quote) {
  const plan = redistributePlan(registries, run, quote.skillId, quote.amount);
  if (!plan.ok) throw new Error(plan.reason);
  stale(quote, plan, ['skillId', 'amount']);
  run.trainingPool = plan.pool - plan.amount;
  const receipt = awardSkillXp(registries, run, plan.skillId, plan.amount);
  bump(run, plan);
  return receipt;
}

// ---------------------------------------------------------------------------
// The lesson
// ---------------------------------------------------------------------------

/** The level a lesson draws at: the track's, but at least 1, so an untouched track still opens commons. */
export const lessonLevel = (run, skillId) => Math.max(skillLevel(run, skillId), 1);

/**
 * lessonPool(registries, run, skillId, { flatRarity }) → the card ids a
 * lesson could draw now: the class pool filtered to the track's master
 * schools and to the rarities `max(level, 1)` opens that the normal door can
 * draw — the same odds rollSkillDraftIds weighs by (model/rewardOdds.js), so
 * a rarity at weight 0 is left out, and Chaos Rewards (`flatRarity`) gives
 * every rarity equal odds. Pure; the appraisal and the live service check
 * read it, so a lesson never looks usable when its roll would be empty.
 */
export function lessonPool(registries, run, skillId, { flatRarity = false } = {}) {
  const schools = new Set(masterSchools(registries, skillId));
  const weights = cardRewardRarityWeights(registries, { classId: run.class, pool: 'normal', flatRarity }) || {};
  const unlocked = rarityUnlockedAt(registries, lessonLevel(run, skillId)).filter((rarity) => weights[rarity] > 0);
  if (!schools.size || !unlocked.length || !registries.classes.has(run.class)) return [];
  return registries.classes.get(run.class).cardPool.filter((id) => {
    const def = registries.cards.has(id) ? registries.cards.get(id) : null;
    return !!def && unlocked.includes(def.rarity) && (def.tags || []).some((tag) => schools.has(tag));
  });
}

export function lessonPlan(registries, run, skillId, cardId, { priceMult = 1 } = {}) {
  const price = masterOffering(registries, 'lesson')?.cinders;
  const cost = Number.isSafeInteger(price) ? cinders(price, priceMult) : 0;
  const entry = run.shopStock?.lessons?.[skillId] || null;
  let reason = teachingRefusal(registries, run, 'lesson', skillId);
  if (!reason && !Number.isSafeInteger(price)) reason = say('master.refuse.notOffered');
  else if (!reason && !entry) reason = say('master.refuse.lessonUnrolled', { skill: trackLabel(registries, skillId) });
  else if (!reason && !entry.cardIds.length) reason = say('master.refuse.lessonEmpty', { skill: trackLabel(registries, skillId) });
  else if (!reason && entry.taken) reason = say('master.refuse.lessonTaken', { skill: trackLabel(registries, skillId) });
  else if (!reason && !entry.cardIds.includes(cardId)) reason = say('master.refuse.lessonCard');
  else if (!reason && !affordable(run, cost)) reason = say('shop.refuse.cinders');
  return { ok: !reason, reason, skillId, cardId, cost, upgraded: skillUpgradesCards(registries, skillLevel(run, skillId)), revision: masterRevision(run) };
}

/** The card joins run.deck as the reward door's draft does; the track's lesson is taken. No queued draft is spent. */
export function commitLesson(registries, run, quote, { priceMult = 1 } = {}) {
  const plan = lessonPlan(registries, run, quote.skillId, quote.cardId, { priceMult });
  if (!plan.ok) throw new Error(plan.reason);
  stale(quote, plan, ['skillId', 'cardId']);
  const instance = { instanceId: unusedInstanceId(run, 'r', plan.cardId), cardId: plan.cardId, upgraded: plan.upgraded };
  run.cinders -= plan.cost;
  run.deck.push(instance);
  run.shopStock.lessons = { ...run.shopStock.lessons, [plan.skillId]: { ...run.shopStock.lessons[plan.skillId], taken: true } };
  bump(run, plan);
  return { skillId: plan.skillId, instance, spent: plan.cost };
}

// ---------------------------------------------------------------------------
// Appraisal
// ---------------------------------------------------------------------------

/**
 * masterAppraisal(registries, run, { priceMult }) → one row per track the
 * visiting master teaches: its level, the XP held, the XP to the next level,
 * the card ids a lesson could draw now, and the respec quote or its refusal.
 * A read and nothing else: it writes nothing and draws nothing.
 */
export function masterAppraisal(registries, run, { priceMult = 1, flatRarity = false } = {}) {
  const master = masterOf(registries, run);
  if (!master) return [];
  return master.skills.map((skillId) => {
    const kind = skillKindOf(registries, skillId);
    const level = skillLevel(run, skillId);
    return {
      skillId, label: trackLabel(registries, skillId), level,
      xp: run.skills?.[skillId]?.xp ?? 0,
      toNext: kind ? xpToNext(registries, kind, level) : 0,
      cardIds: lessonPool(registries, run, skillId, { flatRarity }),
      respec: respecPlan(registries, run, skillId, { priceMult }),
    };
  });
}

// ---------------------------------------------------------------------------
// Which services can act now (SPEC §14.5)
// ---------------------------------------------------------------------------

/**
 * masterServiceCandidates(registries, run, id, { master, stock }) → what
 * service `id` could act on now, for the screen and for the build-time
 * backstop (a service with none is empty for the guarantee, but stays laid
 * out). `master` and `stock` default to the visit open now; the stock builder
 * passes the ones it is building. `flatRarity` is Chaos Rewards, as the lesson
 * roll reads it. Affordability is not asked: a price the
 * purse cannot meet is a refusal, not an empty service.
 */
export function masterServiceCandidates(registries, run, id, { master = masterOf(registries, run), stock = run.shopStock, flatRarity = false } = {}) {
  const skills = master?.skills || [];
  switch (id) {
    case 'training': return (stock?.training?.left ?? 0) > 0 ? [...skills] : [];
    case 'respec': return skills.filter((skillId) => skillLevel(run, skillId) >= 2);
    case 'lesson': return skills.filter((skillId) => {
      const entry = stock?.lessons?.[skillId];
      return entry ? !entry.taken && entry.cardIds.length > 0 : lessonPool(registries, run, skillId, { flatRarity }).length > 0;
    });
    case 'appraisal': return [...skills];
    case 'redistribute': return pool(run) ? skillTracks(registries).map((row) => row.id) : [];
    default: return [];
  }
}

/** The sentence a service with nothing to act on shows (uiStrings `master.idle.<id>`). */
export function masterServiceIdleReason(id) {
  return say(`master.idle.${id}`);
}
