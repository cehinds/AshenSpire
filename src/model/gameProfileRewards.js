// Persisted mixed offers: claiming never edits/equips the active deck.
import { OwnCardRank } from './cardRank.js';
import { RankShopCardOffers } from './shopOfferRank.js';
import { gameModule, gameContent } from './gameProfile.js';
import { ConfiguredTraderCategories, ConfiguredTraderOffersSmith } from './gameProfileShopKind.js';
import { ShelfStockCounts } from './vendorStockRange.js';
import { syncZones } from './state.js';
import { coreCardRanks, cardTrackLevel, rollDraftRank } from './skills.js';
import { pickRewardCategory, rewardGroupProblems } from '../../engine/kernel/rewardPolicy.js';
import { acquireFlask, refillFlaskCharges, flaskKindOf } from './gracerefill.js';
import { syncFlaskGrowth, flaskGrowthTable } from './flaskgrowth.js';
import { RANK_UP_OPTION, CombatRewardRanksUp, ShopStocksRankUp, ShopRankUpPrice, RankUpCandidates, RankUpReady, RankUpReadyReason, RaiseCardRank, RankUpPrice, RankUpBlock } from './rankUpService.js';
import { reserveStanceCards, basicOrCantripMatcher } from './stanceCoverage.js';
import { deckEditBounds, moveFromSideboard, moveToSideboard } from './deckRules.js';
import { rangeCardAvailable } from './rangeCardAvailability.js';
import { shopOfferPrice } from './shopOfferPrice.js';
import { RankedCardPrice } from './rankedCardPrice.js';
import { createRng } from './rng.js';
import { TierFor, FilterToBand } from './levelLists.js';
import { carriedIds } from './loadout/ownership.js';
import { ThemedItemPick, ItemIsThemed } from './itemThemePick.js';
import { GearTypeEffectsEnabled } from './gearEffects.js';
import { GEAR_TYPES } from '../content/gearTypes.js';
const GEAR_THEME_PERCENT = GEAR_TYPES.themedPercent;
import { reconcileRunLoadoutHp } from './loadout/cardMods.js';
import { SpellRewardEligible, BalanceSpellRewardWeights } from './spellPoolPolicy.js';
import { CARD_COPY_OPTION, CARD_COPY_SOURCE, CopyOwnedCard, GrantRelicCardCopies, VendorStocksCardCopy, CardCopyShelf, CardCopyUsesLeft, CardCopyCandidates, CardCopyPrice } from './cardCopyService.js';

// Group members are authored references because the legacy catalog's item tags
// are broader than the core's weapon/armor families. Never infer type from art.
function equipmentGroupMembers(registries, rules, category, family) {
  const rows = family === 'armament' ? registries.equipment.armaments || [] : registries.equipment.armour || [];
  const keyOf = row => family === 'armour' ? `${row.classId}:${row.id}` : row.id;
  const byId = new Map(rows.map(row => [keyOf(row), row]));
  const references = rules.eligibility?.[category]?.groups;
  if (!Array.isArray(references)) throw new Error(`Missing authored ${category} reward groups`);
  const eligible = new Set();
  for (const groupId of references) {
    const group = rules.equipmentGroups?.[groupId];
    if (!group || group.family !== family || !Array.isArray(group.members) || !Array.isArray(group.allTags)) throw new Error(`Invalid ${category} reward group '${groupId}'`);
    for (const member of group.members) {
      const row = byId.get(member);
      if (!row) throw new Error(`Unknown ${family} reward group member '${member}'`);
      const tags = new Set([...(row.entityTags || []), ...(row.itemTypeTags || []), ...(row.tags || [])]);
      if (!group.allTags.every(tag => tags.has(tag))) throw new Error(`Reward group '${groupId}' member '${member}' lacks required item tags`);
      eligible.add(member);
    }
  }
  return eligible;
}
/** The Core reward pools (weapons, weaponArts, armor, …) the shops and the Blacksmith draw from. */
export const gameProfileRewardPools = (registries, run) => pools(registries, run);
function pools(registries, run, { claim = false } = {}) {
  const definitions = gameContent(run,'cards') || [];
  const rules = gameContent(run,'rewards');
  // Owner 2026-10-17: a basic (below minRank) card the character already owns is never offered again.
  const cardRule = rules?.eligibility?.combatCards;
  const ownedIds = new Set([...(run.deck || []), ...(run.sideboard || [])].map(card => card?.cardId ?? card?.id ?? card));
  // Owner 2026-11-14: eligibility.playableOnly never offers a card the class cannot pay for: a mana cost above the
  // class's mana pool base of 0 (stats.poolBasesByClass) or above the run's max mana. Claims keep accepting every card.
  const unpayable = !claim && rules?.eligibility?.playableOnly
    ? (card => (card.manaCost || 0) > 0 && (gameContent(run, 'stats')?.poolBasesByClass?.[run.class]?.mana === 0 || card.manaCost > (run.maxMana ?? 0)))
    : () => false;
  // Owner 2026-11-14: eligibility.excludeCardIds keeps cards that do nothing without the hit roll (Guiding Whisper) or repeat another
  // (base.evade) out of every new offer and shop. Their definitions stay for saved decks, and a claim still accepts an earlier offer.
  const retired = claim ? null : new Set(rules?.eligibility?.excludeCardIds || []);
  // Owner 2026-11-20: eligibility.combatCards.skipOwned never offers a card the player already holds (deck or library), at any
  // rank: one copy of a card, and the copy service (cardCopyService.js) is the only way to a second. A claim still accepts it.
  const skipOwned = !claim && cardRule?.skipOwned === true;
  const cards = definitions.filter(card => (claim || SpellRewardEligible(registries, run, card)) && rangeCardAvailable(run, card) && !unpayable(card) && !retired?.has(card.id) && (card.class === 'colorless' || card.class === run.class) && !['special', 'status'].includes(card.rarity) && card.type !== 'status'
    && !(skipOwned && ownedIds.has(card.id))
    && !(cardRule?.skipOwnedBasics && cardRank(card, rules) < (cardRule.minRank ?? 0) && ownedIds.has(card.id)));
  const equipment = !!gameModule(run,'equipment'), hasCards=!!gameModule(run,'cards');
  const weapons = equipment ? equipmentGroupMembers(registries,rules,'weapons','armament') : new Set();
  const armor = equipment ? equipmentGroupMembers(registries,rules,'armor','armour') : new Set();
  const authoredArts = rules.eligibility?.weaponArts?.cardIds;
  if (!Array.isArray(authoredArts)) throw new Error('Missing authored core weapon-art reward references');
  for (const id of hasCards && equipment ? authoredArts : []) if (!definitions.some(card=>card.id===id) || !registries.cards.has(id)) throw new Error(`Unknown core weapon-art reward '${id}'`);
  const carried = new Set([...run.loadout.storage,...Object.values(run.loadout.sets).flat()]);
  return {
    weapons: equipment ? (registries.equipment.armaments||[]).filter(row=>weapons.has(row.id)&&!carried.has(row.id)).map(row=>row.id) : [],
    relics: registries.relics.all().filter(row=>!run.relics.includes(row.id)&&(claim||!Array.isArray(rules.eligibility?.relics?.allow)||rules.eligibility.relics.allow.includes(row.id))&&(row.pool!=='core2'||(rules.eligibility?.relics?.pools||[]).includes(row.pool))).map(row=>row.id),
    combatCards: hasCards ? cards.map(row=>row.id) : [],
    // Rank split for combat-card offers (rewards.json eligibility.combatCards): a card's own rank, else its rarity's.
    combatCardsLow: hasCards ? cards.filter(row=>cardRank(row,rules)<(rules.eligibility?.combatCards?.minRank??0)).map(row=>row.id) : [],
    weaponArts: hasCards && equipment ? weaponArtPool(registries, run, rules, authoredArts, carried, claim).filter(id => !unpayable(registries.cards.get(id))) : [],
    potions: registries.flasks.all().filter(row=>gameModule(run,'resources')?.include?.includes('mp') || !row.effects.some(effect=>effect.op==='restoreMana')).map(row=>row.id),
    armor: equipment ? (registries.equipment.armour||[]).filter(row=>armor.has(`${row.classId}:${row.id}`)&&row.classId===run.class && !(run.loadout.boughtArmour||[]).some(owned=>owned.classId===row.classId&&owned.id===row.id) && !Object.values(run.loadout.sets).flat().includes(row.id)).map(row=>row.id) : [],
  };
}
// Owner 2026-11-05: the weapon-art pool is the default and learnable arts of the weapons the run carries (storage and sets),
// plus any extra authored ids (empty for Core), minus arts already owned: in the deck or sideboard, which also holds the
// arts a worn weapon grants. A claim (`claim: true`) accepts every authored art plus `legacyClaimIds`, so an offer made earlier (or in an older save) stays claimable.
/** Every id the run may hold as a weapon art (all weapons' default and learnable arts, extras, legacy claim ids): the claim pool and the shop's resale classifier share it. */
export function gameProfileWeaponArtIds(registries, run) {
  const rules = gameContent(run, 'rewards');
  if (!rules || !gameModule(run, 'cards') || !gameModule(run, 'equipment')) return new Set();
  return new Set(weaponArtPool(registries, run, rules, rules.eligibility?.weaponArts?.cardIds || [], new Set(), true));
}
function weaponArtPool(registries,run,rules,extras,carried,claim) {
  const armaments=registries.equipment.armaments||[];
  const ids=[...extras];
  // Claim only (never offered): ids an older save may still hold on a pending door or shop shelf (core.reaverSpecial).
  if(claim)ids.push(...(rules?.eligibility?.weaponArts?.legacyClaimIds||[]));
  for(const piece of armaments){
    if(!claim&&!carried.has(piece.id))continue;
    ids.push(...(piece.weaponCardPackage?.weaponArtDefaults||[]),...(piece.weaponCardPackage?.learnableArts||[]));
  }
  const owned=!claim&&(rules?.eligibility?.weaponArts?.skipOwned||rules?.eligibility?.combatCards?.skipOwned===true)?new Set([...(run.deck||[]),...(run.sideboard||[])].map(card=>card?.cardId??card?.id??card)):new Set();
  return [...new Set(ids)].filter(id=>registries.cards.has(id)&&!owned.has(id)&&rangeCardAvailable(run,registries.cards.get(id)));
}
// Owner 2026-11-05: an art stocked in the shop the player is in, or shown on the open reward door, is not offered by the other.
export function artsOnOtherSide(run,source,offerId) {
  const offers=run.gameProfileRewardOffers||{},ids=new Set();
  const artsOf=offer=>(offer?.options||[]).filter(option=>option.kind==='weaponArts').map(option=>option.id);
  if(source==='shop'||source==='blacksmith'){
    // The open door is the pending reward; a skipped door leaves no pending reward, so it excludes nothing.
    const pendingId=run.gameProfilePendingReward?.offerId,door=pendingId&&pendingId!==offerId?offers[pendingId]:null;
    if(door&&door.source!=='shop'&&door.claimed==null)for(const id of artsOf(door))ids.add(id);
  }
  if(source!=='shop'&&source!=='blacksmith'){
    for(const id of artsOf(offers[`shop:${run.gameProfileOpenShop}`]))ids.add(id);
    for(const row of run.shopStock?.weaponArts||[])ids.add(row.id);
  }
  return [...ids];
}
function cardRank(card,rules) {
  const rule=rules?.eligibility?.combatCards;
  return Number.isSafeInteger(card.rank) ? card.rank : rule?.rankOfRarity?.[card.rarity] ?? 1;
}
// Owner 2026-10-24: fewer copies of cards already owned, and non-casting maneuvers favoured. Weight = tag weight x
// ownedCopyWeight^copies (deck + sideboard); one float roll on the offer's stream keeps replays deterministic.
// When every candidate weighs the same (no settings, or Core 1's neutral ones) the draw is the old uniform pick.
export function cardPickWeight(rule,card,owned) {
  const tagWeights=rule?.tagWeights||{},matched=(card?.tags||[]).filter(tag=>tag!=='default'&&Number.isFinite(tagWeights[tag]));
  const tag=matched.length?matched.reduce((product,key)=>product*tagWeights[key],1):(Number.isFinite(tagWeights.default)?tagWeights.default:1);
  return tag*Math.pow(Number.isFinite(rule?.ownedCopyWeight)?rule.ownedCopyWeight:1,owned);
}
// Owner 2026-10-27: favour basic and cantrip cards on the first map depths of an act, mana-cost and higher-rank cards after
// them, and avoid cards shown on the last few reward screens. Every number is `rule.depthBias` / `rule.recentOffer*`; absent or
// 1 is neutral (Core 1). Multiplies the ownership weight, so an unowned card still beats an owned one at every depth.
function depthWeight(rule,card,rank,isBasic,depth) {
  const bias=rule?.depthBias;
  if(!bias||!card)return 1;
  const early=depth<=(bias.earlyMaxDepth??3),band=early?bias.early:bias.late,mana=(card.manaCost||0)>0;
  if(!band)return 1;
  let weight=1;
  if(early&&isBasic)weight*=band.basicOrCantrip??1;
  if(mana)weight*=band.mana??1;
  if(!early&&rank>=(band.highRankMin??2))weight*=band.highRank??1;
  return weight;
}
// Owner 2026-11-05: skills and powers are offered more often than attacks. rule.typeWeights = { attack, skill, power };
// a type with no entry is neutral (1). Multiplies the pick weight, so the owned-copy weight still dominates.
function typeWeight(rule,card){const w=rule?.typeWeights?.[card?.type];return Number.isFinite(w)?w:1;}
function recentOfferedIds(run,rule) {
  const recentWindow=rule?.recentOfferWindow??0;
  if(!(recentWindow>0))return new Set();
  const rows=Object.values(run.gameProfileRewardOffers||{}).filter(offer=>offer?.source!=='shop').slice(-recentWindow);
  return new Set(rows.flatMap(offer=>(offer.options||[]).filter(option=>option.kind==='combatCards').map(option=>option.id)));
}
function weightedCardPick(registries,run,rule,rng,stream,ids) {
  if(ids.length<2)return rng.pick(stream,ids);
  const defs=new Map((gameContent(run,'cards')||[]).map(card=>[card.id,card])),owned=new Map();
  for(const card of [...(run.deck||[]),...(run.sideboard||[])]){const id=card?.cardId??card?.id??card;owned.set(id,(owned.get(id)||0)+1);}
  const rules=gameContent(run,'rewards'),recent=recentOfferedIds(run,rule),recentWeight=rule?.recentOfferWeight??1,depth=run.floor||0;
  const isBasic=rule?.depthBias?basicOrCantripMatcher(registries,run):()=>false;
  // Owner 2026-10-31: a card already shown (taken or not) is drawn at rule.offeredCopyWeight per earlier showing; absent/1 is neutral.
  const offered=run.rewardOfferHistory?.cards||{},offeredWeight=Number.isFinite(rule?.offeredCopyWeight)?rule.offeredCopyWeight:1;
  const weights=BalanceSpellRewardWeights(registries,run,ids.map(id=>defs.get(id)),ids.map(id=>{const card=defs.get(id);
    return cardPickWeight(rule,card,owned.get(id)||0)*typeWeight(rule,card)*depthWeight(rule,card,card?cardRank(card,rules):1,isBasic(id),depth)*(recent.has(id)?recentWeight:1)*(offeredWeight===1?1:Math.pow(offeredWeight,offered[id]||0));})),total=weights.reduce((sum,weight)=>sum+weight,0);
  if(!(total>0)||weights.every(weight=>weight===weights[0]))return rng.pick(stream,ids);
  let roll=rng.float(stream)*total;
  for(const [index,id] of ids.entries()){roll-=weights[index];if(roll<0)return id;}
  return ids.at(-1);
}
// Authored relic weights (rewards.json eligibility.relics.weights, default 1) make a chosen relic a likely pick.
function weightedRelicPick(weights,rng,stream,ids) {
  const list=ids.map(id=>Number.isFinite(weights?.[id])&&weights[id]>=0?weights[id]:1),total=list.reduce((sum,weight)=>sum+weight,0);
  if(!weights||ids.length<2||!(total>0)||list.every(weight=>weight===list[0]))return rng.pick(stream,ids);
  let roll=rng.float(stream)*total;
  for(const [index,id] of ids.entries()){roll-=list[index];if(roll<0)return id;}
  return ids.at(-1);
}
// Owner 2026-10-31: a potion already in the belt is offered at rule.ownedPotionWeight per held copy (a much lower chance, never a
// forced skip), in combat rewards, chests and shops alike. One float roll on the offer's stream; when every weight is equal (nothing
// held, or the setting absent/1 as in Core 1) the draw is the old uniform rng.pick, so existing seeds are unchanged.
function weightedPotionPick(rule,run,rng,stream,ids) {
  const base=Number.isFinite(rule?.ownedPotionWeight)?rule.ownedPotionWeight:1,held=new Map();
  for(const flask of run.flasks||[])if(flask?.flaskId)held.set(flask.flaskId,(held.get(flask.flaskId)||0)+1);
  const weights=ids.map(id=>Math.pow(base,held.get(id)||0)),total=weights.reduce((sum,weight)=>sum+weight,0);
  if(ids.length<2||!(total>0)||weights.every(weight=>weight===weights[0]))return rng.pick(stream,ids);
  let roll=rng.float(stream)*total;
  for(const [index,id] of ids.entries()){roll-=weights[index];if(roll<0)return id;}
  return ids.at(-1);
}
const BAND_KIND={combatCards:'cards',weapons:'weapon',armor:'armour',relics:'relic'};
/** BandedRewardIds(run, kind, ids) -> ids inside the run's act rank band (model/levelLists.js), or ids when the band holds none. */
function BandedRewardIds(run,kind,ids) {
  const band=BAND_KIND[kind];
  if(!band)return ids;
  return FilterToBand(band,TierFor(run),ids,band==='armour'?{keyOf:id=>`${run.class}.${id}`}:undefined);
}
function makeOffer(registries,run,rng,{offerId,source,count,takeCount,categories,groups=[],itemsPerCategory=null,excludedIds=[],pool='normal'}) {
  if (!offerId || typeof offerId!=='string') throw new Error('A stable reward offerId is required');
  if(run.gameProfileRewardOffers?.[offerId])return run.gameProfileRewardOffers[offerId];
  const available=pools(registries,run), options=[];
  for(const kind of Object.keys(available))available[kind]=available[kind].filter(id=>!excludedIds.includes(id));
  const otherSide=artsOnOtherSide(run,source,offerId);
  if(otherSide.length)available.weaponArts=available.weaponArts.filter(id=>!otherSide.includes(id));
  // Owner 2026-10-24: eligibility.potions.excludeKinds keeps the charge flasks (hp, mana) out of NEW Core offers; a relic grows
  // them instead. Claiming still accepts them, so an offer saved before this change stays claimable.
  const excludedFlasks=gameContent(run,'rewards')?.eligibility?.potions?.excludeKinds||[];
  if(excludedFlasks.length)available.potions=available.potions.filter(id=>!excludedFlasks.includes(flaskKindOf(registries.flasks.get(id))));
  // Owner 2026-10-27 / 2026-11-05: eligibility.weaponArts.skipOwned (Core 2) drops owned arts from every offer, shops
  // and the Blacksmith included; weaponArtPool applies it.
  // Owner 2026-10-27: combat rewards retire relics except the ids in eligibility.relics.combatIds (the flask relic, which
  // stays inside the potions share). Chests (source 'treasure') and shops keep every relic.
  const combatRelics=gameContent(run,'rewards')?.eligibility?.relics?.combatIds;
  if(source==='combat'&&Array.isArray(combatRelics))available.relics=available.relics.filter(id=>combatRelics.includes(id));
  const stream=source==='shop'&&itemsPerCategory!==null?'shop':'cardRewards';
  // A shop shelf's cap: one number for every shelf, or each shelf's own count ({kind: n}, rolled per visit; vendorStockRange.js).
  const shelfCap=kind=>typeof itemsPerCategory==='number'?itemsPerCategory:(itemsPerCategory?.[kind]??0);
  if(groups.length) {
    const problems=rewardGroupProblems(groups,categories);
    if(problems.length)throw new Error(problems.join('; '));
  }
  const shelfCounts=new Map();
  // Owner 2026-10-19: reserve slot(s) for a basic/cantrip card of a stance the character lacks (never in a shop).
  if(source!=='shop'&&categories.includes('combatCards')&&(!groups.length||groups.some(group=>group.weight>0&&group.categories.includes('combatCards'))))for(const id of reserveStanceCards(registries,run,rng,stream,BandedRewardIds(run,'combatCards',available.combatCards),count-options.length)) {
    options.push({kind:'combatCards',id});available.combatCards=available.combatCards.filter(value=>value!==id);
  }
  // Ordinary combat draws weighted groups. Shops independently fill each shelf.
  while(options.length<count) {
    const kinds=categories.filter(kind=>(available[kind]||[]).length && (itemsPerCategory===null || (shelfCounts.get(kind)||0)<shelfCap(kind)));
    if(!kinds.length)break;
    const kind=itemsPerCategory===null?pickRewardCategory(rng,stream,kinds,groups):kinds[0];
    if(!kind)break;
    let ids=available[kind];
    // Owner 2026-11-21 / 2026-11-22: level lists. Rewards AND shop shelves narrow cards, weapons, armour and relics to the act's
    // combat-power rank band (model/levelLists.js); an empty band keeps the whole pool. The filter draws nothing, so seeded
    // streams only see a smaller list. The owned-card exclusion and the shown-card history weighting run on the banded list.
    ids=BandedRewardIds(run,kind,ids);
    // Most card rewards are rank 1+; a small authored chance lets a lower-rank card through.
    const rule=gameContent(run,'rewards')?.eligibility?.combatCards;
    if(kind==='combatCards'&&rule){
      const low=new Set(available.combatCardsLow||[]),high=ids.filter(id=>!low.has(id)),lowIds=ids.filter(id=>low.has(id));
      // The chance is honored even when no rank 1+ card is left: a failed (or zero) roll drops the category.
      const allowLow=lowIds.length>0&&rng.pick(stream,Array.from({length:100},(_,i)=>i))<Math.round((rule.lowerRankChance??0)*100);
      if(!allowLow&&!high.length){available[kind]=[];continue;}
      ids=allowLow?lowIds:high;
    }
    const id=kind==='combatCards'||kind==='weaponArts'?weightedCardPick(registries,run,rule,rng,stream,ids):kind==='relics'?weightedRelicPick(gameContent(run,'rewards')?.eligibility?.relics?.weights,rng,stream,ids):kind==='potions'?weightedPotionPick(gameContent(run,'rewards')?.eligibility?.combatCards,run,rng,stream,ids):kind==='weapons'||kind==='armor'?ThemedItemPick(rng,stream,ids,{classId:run.class,kind,enabled:GearTypeEffectsEnabled(run),rowOf:itemId=>kind==='weapons'?(registries.equipment.armaments||[]).find(row=>row.id===itemId):(registries.equipment.armour||[]).find(row=>row.id===itemId&&row.classId===run.class)}):rng.pick(stream,ids);available[kind]=available[kind].filter(value=>value!==id);
    // A card that is also a weapon art is one offer, never both a card and an art on the same screen.
    if(kind==='combatCards'||kind==='weaponArts')for(const other of ['combatCards','combatCardsLow','weaponArts'])available[other]=available[other].filter(value=>value!==id);
    options.push({kind,id});
    shelfCounts.set(kind,(shelfCounts.get(kind)||0)+1);
  }
  // Card ranks (SPEC 13.4o): a drafted card arrives at rank 1..min(its track's level, rankMax), rolled now so the
  // offer, its save and its reload show one card. Level 1 (or no matching track) rolls nothing and moves no stream.
  if(source!=='shop'&&coreCardRanks(run))for(const option of options){
    if(option.kind!=='combatCards')continue;
    const rank=rollDraftRank(registries,rng,cardTrackLevel(registries,run,registries.cards.get(option.id)));
    if(rank>1)option.rank=rank;
  }
  // Owner 2026-10-31: remember every card shown (offers are cached per offerId, so a reload never counts twice).
  const shown=options.filter(option=>option.kind==='combatCards'||option.kind==='weaponArts');
  if(shown.length){
    const history=run.rewardOfferHistory||={cards:{}};history.cards||={};
    for(const option of shown)history.cards[option.id]=(history.cards[option.id]||0)+1;
  }
  // W25-R: a won fight may also offer to raise a card's rank (rewards.json rankUp.chancePct by fight tier). It rolls on a hash of
  // the run's seed and the offer's id, not on a stream, so it moves no counter and a reload answers the same.
  if(source==='combat'&&CombatRewardRanksUp(registries,run,offerId,pool))options.push({...RANK_UP_OPTION,bonus:true});
  const offer={id:offerId,source,options,takeCount,taken:[],claimed:null};
  run.gameProfileRewardOffers ||= {};
  run.gameProfileRewardOffers[offerId]=offer;
  return offer;
}
/** Owner 2026-11-18: a "Rank up a card" option is its own step after the card pick, never one of the card picks, so it counts
 * as a bonus pick whether or not the saved offer flagged it (an older saved offer lists it without `bonus`). An older offer's
 * rank-up that was already TAKEN was spent as its plain pick (before the ruling it used one), so once taken it is no bonus. */
export const IsBonusOption = (option, taken = false) => !!option && (option.bonus === true || (option.kind === RANK_UP_OPTION.kind && !taken));
const bonusAt = (offer, at) => IsBonusOption(offer.options[at], offer.taken.includes(at));
/** BonusFreeOffer(offer) -> the offer as the plain card picks see it: bonus options and the picks taken on them removed. */
export function BonusFreeOffer(offer) {
  return { ...offer, options: offer.options.filter((_, at) => !bonusAt(offer, at)), taken: offer.taken.filter(at => !bonusAt(offer, at)) };
}
/**
 * OfferPicksLeft(offer) -> how many picks the player may still make. A bonus option (a rank-up that came beside the card pick,
 * rewards.json rankUp.bonusPickPct) is one extra pick on top of takeCount; every other option shares takeCount. An offer
 * without a bonus option counts exactly as before.
 */
export function OfferPicksLeft(offer) {
  const bonus = offer.options.filter((_, at) => bonusAt(offer, at)), plain = offer.options.length - bonus.length;
  const plainTaken = offer.taken.filter(at => !bonusAt(offer, at)).length, bonusTaken = offer.taken.length - plainTaken;
  return Math.max(0, Math.min(offer.takeCount, plain) - plainTaken) + (bonus.length - bonusTaken);
}
export function gameProfileRewardOffers(registries, run, rng, { offerId, source = 'combat', pool = 'normal', takeCount: takeOverride = null } = {}) {
  const module=gameModule(run,'rewards');
  if(module?.mode!=='configured')throw new Error('Configured rewards unavailable');
  const rules=gameContent(run,'rewards');
  // Owner 2026-11-05: a combat door lays out a random 3..5 choices (rules.combatOfferCount {min,max}), rolled once on the
  // reward stream when the offer is first made. Chests, level cards and shops keep offerCount; a settings offerCount that differs from combatOfferCount.appliesAtOfferCount (the shipped 3) wins over the range.
  const range=rules.combatOfferCount,cached=!!run.gameProfileRewardOffers?.[offerId];
  const combatCount=source==='combat'&&!cached&&(module.offerCount??rules.offerCount)===(range?.appliesAtOfferCount??rules.offerCount)&&range&&Number.isInteger(range.min)&&Number.isInteger(range.max)&&range.max>=range.min?rng.int('cardRewards',range.min,range.max):null;
  return makeOffer(registries,run,rng,{offerId,source,pool,count:combatCount??module.offerCount??rules.offerCount,takeCount:takeOverride??module.takeCount??rules.takeCount,categories:source==='level'?['combatCards']:rules.categories,
    groups:source==='combat'?(module.rewardGroups??rules.rewardGroups??[]):source==='treasure'?(rules.treasureRewardGroups??module.rewardGroups??rules.rewardGroups??[]):[]});
}
/** Elite spoils (rewards.json `eliteRelic`): a relic choice of up to `choices` unowned relics from the allowed relic pool (eligibility.relics.allow), built once per offerId
 * on the reward stream. Returns null (nothing stored) when the key is absent or no relic qualifies. Its own source ('elite'), so the combat
 * offer's relic strip (eligibility.relics.combatIds) never applies. */
export function GameProfileEliteRelicOffer(registries, run, rng, { offerId } = {}) {
  if (!offerId || typeof offerId !== 'string') throw new Error('A stable reward offerId is required');
  if (run.gameProfileRewardOffers?.[offerId]) return run.gameProfileRewardOffers[offerId];
  const rules = gameContent(run, 'rewards'), rule = rules?.eliteRelic;
  if (!rule) return null;
  let ids = pools(registries, run).relics;
  const options = [];
  for (let n = Number.isInteger(rule.choices) ? rule.choices : 1; n > 0 && ids.length; n--) {
    const id = weightedRelicPick(rules.eligibility?.relics?.weights, rng, 'cardRewards', ids);
    ids = ids.filter(value => value !== id);
    options.push({ kind: 'relics', id });
  }
  if (!options.length) return null;
  const offer = { id: offerId, source: 'elite', options, takeCount: 1, taken: [], claimed: null };
  (run.gameProfileRewardOffers ||= {})[offerId] = offer;
  return offer;
}
/**
 * ArmamentRewardRule(run, pool) -> the authored { chancePct, min, max } for a won fight of this pool (rewards.json
 * `armamentReward.elite|boss`), or null when the profile has none for it (normal fights never drop one).
 */
export function ArmamentRewardRule(run, pool) {
  const rule = gameContent(run, 'rewards')?.armamentReward?.[pool];
  return rule && typeof rule === 'object' && pool !== 'normal' ? rule : null;
}
/**
 * ArmamentRewardStep(registries, run, rng, rest) -> { next, rest }: the armament door that follows the relic step, rolled ONCE.
 * `next` is the pending reward to show (an armament offer) or null; `rest` is the pending record to carry on with, its
 * `armamentReward` flag spent either way, so a failed chance roll never re-rolls after a level door (offer ids differ).
 */
export function ArmamentRewardStep(registries, run, rng, rest) {
  if (!rest.armamentReward) return { next: null, rest };
  const offerId = `${rest.offerId}:armament`;
  if (GameProfileArmamentOffer(registries, run, rng, { offerId, pool: rest.armamentReward })) {
    return { next: { ...rest, offerId, source: 'armament', armamentReward: '' }, rest: { ...rest, armamentReward: '' } };
  }
  return { next: null, rest: { ...rest, armamentReward: '' } };
}
// Least-picked selection at each level (type, family, sub-kind): the candidates left are those whose group the offer has used
// least, a random one of those groups wins ties, so weapons and armour, and different families, spread across the choices.
function spreadPick(rng, candidates, chosen, levels) {
  let rows = candidates;
  for (const level of levels) {
    const used = key => chosen.filter(row => level(row) === key).length;
    const keys = [...new Set(rows.map(level))];
    const fewest = Math.min(...keys.map(used));
    const key = rng.pick('cardRewards', keys.filter(value => used(value) === fewest));
    rows = rows.filter(row => level(row) === key);
  }
  return rng.pick('cardRewards', rows);
}
/**
 * GameProfileArmamentOffer(registries, run, rng, { offerId, pool }) -> the armament choice a won elite (chancePct) or boss
 * (guaranteed) lays out after its other spoils (owner 2026-11-18). A weapon or armour piece per choice, min..max of them,
 * every one unowned (storage, equipped sets, bought armour) and from the same authored eligibility groups as the shop; the choices
 * spread over weapon/armour and over weapon families and armour groups before repeating one. Rolled once per offerId on the reward
 * stream and saved on the run like any offer, so a reload shows the same door. Returns null (nothing stored) when the profile has no
 * rule for the pool, the chance roll fails, or nothing eligible is left. Claiming is the ordinary claimGameProfileReward.
 */
export function GameProfileArmamentOffer(registries, run, rng, { offerId, pool = 'elite' } = {}) {
  if (!offerId || typeof offerId !== 'string') throw new Error('A stable reward offerId is required');
  if (run.gameProfileRewardOffers?.[offerId]) return run.gameProfileRewardOffers[offerId];
  const rule = ArmamentRewardRule(run, pool);
  if (!rule || !gameModule(run, 'equipment')) return null;
  const chance = Number.isFinite(rule.chancePct) ? rule.chancePct : 100;
  if (chance <= 0 || (chance < 100 && rng.int('cardRewards', 1, 100) > chance)) return null;
  const rules = gameContent(run, 'rewards'), available = pools(registries, run);
  const owned = new Set([...carriedIds(run.loadout), ...(run.loadout?.boughtArmour || []).map(row => row?.id)]);
  const armourGroupOf = new Map();
  for (const groupId of rules.eligibility?.armor?.groups || []) for (const member of rules.equipmentGroups?.[groupId]?.members || []) armourGroupOf.set(member, groupId);
  const storageFull = (run.loadout?.storage || []).length >= (registries.balance.equipment?.storageSlots ?? 8);
  const candidates = [];
  if (!storageFull) for (const id of available.weapons) {
    const row = (registries.equipment.armaments || []).find(item => item.id === id);
    if (row && !owned.has(id)) candidates.push({ kind: 'weapons', id, type: 'weapon', family: `weapon:${row.kind || ''}`, sub: row.geom || id });
  }
  for (const id of available.armor) {
    if (owned.has(id)) continue;
    candidates.push({ kind: 'armor', id, type: 'armour', family: `armour:${armourGroupOf.get(`${run.class}:${id}`) || ''}`, sub: id });
  }
  // Owner 2026-11-21: level lists: weapons and armour come from the act's rank band (an empty band keeps every candidate of the kind).
  const tier = TierFor(run), weaponRows = candidates.filter(row => row.kind === 'weapons'), armourRows = candidates.filter(row => row.kind === 'armor');
  candidates.splice(0, candidates.length, ...FilterToBand('weapon', tier, weaponRows, { keyOf: row => row.id }), ...FilterToBand('armour', tier, armourRows, { keyOf: row => `${run.class}.${row.id}` }));
  const min = Number.isInteger(rule.min) && rule.min > 0 ? rule.min : 1, max = Number.isInteger(rule.max) && rule.max >= min ? rule.max : min;
  const wanted = min === max ? min : rng.int('cardRewards', min, max);
  const chosen = [];
  let left = candidates;
  while (chosen.length < wanted && left.length) {
    // Owner, 2026-11-18: each pick draws from the class-themed items 75% of the time (the whole pool otherwise, or when none is left).
    const themed = left.filter(row => ItemIsThemed(row.kind === 'weapons' ? (registries.equipment.armaments || []).find(item => item.id === row.id) : (registries.equipment.armour || []).find(item => item.id === row.id && item.classId === run.class), run.class, row.kind));
    const pool = GearTypeEffectsEnabled(run) && rng.int('cardRewards', 1, 100) <= GEAR_THEME_PERCENT && themed.length ? themed : left;
    const pick = spreadPick(rng, pool, chosen, [row => row.type, row => row.family, row => row.sub]);
    chosen.push(pick);
    left = left.filter(row => row !== pick);
  }
  if (!chosen.length) return null;
  const offer = { id: offerId, source: 'armament', options: chosen.map(({ kind, id }) => ({ kind, id })), takeCount: 1, taken: [], claimed: null };
  (run.gameProfileRewardOffers ||= {})[offerId] = offer;
  return offer;
}
export function claimGameProfileReward(registries,run,offerId,index,{instanceId=null}={}) {
  const offer=run.gameProfileRewardOffers?.[offerId];
  if(!offer||offer.claimed!==null||offer.taken.includes(index)||offer.takeCount<1)throw new Error('Reward offer is missing or already claimed');
  const option=offer.options[index];
  if(!Number.isInteger(index)||!option)throw new Error('Invalid reward option');
  if(!IsBonusOption(option)&&OfferPicksLeft(BonusFreeOffer(offer))<1)throw new Error('Reward offer is missing or already claimed');
  // A copy door (cardCopyService.js) lists owned cards, which no reward pool holds; its options are checked against the run instead.
  const copyDoor=offer.source===CARD_COPY_SOURCE;
  if (option.kind!==RANK_UP_OPTION.kind&&option.kind!==CARD_COPY_OPTION.kind&&!copyDoor&&!(pools(registries,run,{claim:true})[option.kind] || []).includes(option.id)) throw new Error('Reward option is unavailable under configured eligibility');
  const draft=structuredClone(run);
  let raised=null;
  if(option.kind===RANK_UP_OPTION.kind) {
    // W25-R: the service raises one chosen owned card by one rank; the pick rides the claim, so the offer stays one row.
    if(typeof instanceId!=='string'||!instanceId)throw new Error('Choose a card to rank up');
    raised=RaiseCardRank(registries,draft,instanceId);
  } else if(option.kind===CARD_COPY_OPTION.kind) {
    // Owner 2026-11-20: a vendor's copy service copies one chosen owned card into the library.
    if(typeof instanceId!=='string'||!instanceId)throw new Error('Choose a card to copy');
    const copy=CopyOwnedCard(registries,draft,instanceId);
    raised={instanceId:copy.instanceId,cardId:copy.cardId};
  } else if(copyDoor) {
    // A copy relic's door: the chosen card is copied as the instance it names (`copyOf`), at the reward's own instance id,
    // so "Add to deck" finds it. A source since removed still yields the card the door showed.
    if(option.kind!=='combatCards'||!registries.cards.has(option.id))throw new Error('Invalid reward option');
    const at=rewardInstanceId(offerId,index),source=[...draft.deck,...draft.sideboard].find(card=>card?.instanceId===option.copyOf&&card.cardId===option.id);
    if(source){const copy=CopyOwnedCard(registries,draft,source.instanceId);copy.instanceId=at;}
    else draft.sideboard.push({instanceId:at,cardId:option.id,upgraded:!!option.upgraded,...(OwnCardRank(option)>0?{rank:option.rank}:{})});
  } else if(['combatCards','weaponArts'].includes(option.kind)) {
    registries.cards.get(option.id);
    const instanceId=`reward:${offerId}:${index}${offer.source==='shop'?`:${offer.tradeRevision||0}`:''}`;
    draft.sideboard.push({instanceId,cardId:option.id,upgraded:false,...(OwnCardRank(option)>0?{rank:option.rank}:{})});
  } else if(option.kind==='weapons') {
    if(!(registries.equipment.armaments||[]).some(row=>row.id===option.id))throw new Error('Unknown reward weapon');
    if(draft.loadout.storage.includes(option.id))throw new Error('Reward weapon already owned');
    draft.loadout.storage.push(option.id);
  } else if(option.kind==='relics') {
    registries.relics.get(option.id);
    if(draft.relics.includes(option.id))throw new Error('Reward relic already owned');
    draft.relics.push(option.id);
    GrantRelicCardCopies(registries,draft,option.id); // a copy relic queues its one-time copy door (main.js opens it next)
    // Bind flask growth now (a Core pickup used to wait for a reload); a relic that grows a flask also refills them.
    syncFlaskGrowth(registries,draft);
    reconcileRunLoadoutHp(registries,draft); // a relic property such as maxMana1 raises the pools now, not at the next load
    if(flaskGrowthTable(registries.balance).some(row=>row?.source==='relic'&&row.id===option.id))refillFlaskCharges(draft.flaskCharges);
  } else if(option.kind==='potions') {
    const acquisition=acquireFlask(registries,draft,option.id);
    if(!acquisition.ok)throw new Error(acquisition.reason);
  } else if(option.kind==='armor') {
    if(!(registries.equipment.armour||[]).some(row=>row.id===option.id&&row.classId===run.class))throw new Error('Unknown reward armor');
    draft.loadout.boughtArmour ||= [];
    draft.loadout.boughtArmour.push({classId:run.class,id:option.id});
  } else throw new Error('Unknown reward category');
  const pending=draft.gameProfileRewardOffers[offerId];pending.taken.push(index);
  if(OfferPicksLeft(pending)<1)pending.claimed=index;
  syncZones(draft);Object.assign(run,draft);return raised?{...option,...raised}:option;
}
// Owner 2026-10-18: a won card may go straight into the deck. The claim is the ordinary one (the card lands in the
// sideboard as `reward:<offer>:<index>`); the move into the deck then obeys the deck rules (size cap, copy limits,
// equipment eligibility). Both steps run on a draft, so a refusal leaves the run and the offer untouched.
export const rewardInstanceId = (offerId, index) => `reward:${offerId}:${index}`;
const deckAddProblem = (code, text, extra = {}) => Object.assign(new Error(text), { code, ...extra });
function addRewardToDeckDraft(registries, draft, offerId, index, settings) {
  const offer = draft.gameProfileRewardOffers?.[offerId], option = offer?.options?.[index];
  if (!option || !['combatCards', 'weaponArts'].includes(option.kind)) throw deckAddProblem('notCard', 'Only a card can be added to the deck');
  const instanceId = rewardInstanceId(offerId, index);
  if (draft.deck.some(card => card?.instanceId === instanceId)) return { option, instanceId, changed: false };
  if (!offer.taken.includes(index)) claimGameProfileReward(registries, draft, offerId, index);
  const { max } = deckEditBounds(settings);
  if (draft.deck.length + 1 > max) throw deckAddProblem('full', `Your deck is full (${max} cards)`, { max });
  if (!moveFromSideboard(registries, draft, instanceId, settings)) throw deckAddProblem('limit', 'This card cannot join the deck right now');
  syncZones(draft);
  return { option, instanceId, changed: true };
}
/** rewardDeckAddRefusal(...) → '' when "Add to deck" is legal for the offered card, else a code: 'notCard' | 'full' | 'limit'. */
export function rewardDeckAddRefusal(registries, run, offerId, index, settings = {}) {
  try { addRewardToDeckDraft(registries, structuredClone(run), offerId, index, settings); return ''; }
  catch (error) { if (error.code) return error.code; throw error; }
}
/** claimGameProfileRewardToDeck(...) → the option. Claims (when not yet claimed) and adds the card to the deck; repeat calls change nothing. */
export function claimGameProfileRewardToDeck(registries, run, offerId, index, settings = {}) {
  const draft = structuredClone(run);
  const { option } = addRewardToDeckDraft(registries, draft, offerId, index, settings);
  Object.assign(run, draft); return option;
}
// Owner 2026-11-05: a card bought at the shop may go straight into the deck. The purchase already put it in the library
// (sideboard); this is the same deck move the reward door's "Add to deck" makes, with the same refusals ('full' | 'limit').
function addPurchasedCardToDeckDraft(registries, draft, instanceId, settings) {
  if (draft.deck.some(card => card?.instanceId === instanceId)) return false;
  if (!draft.sideboard.some(card => card?.instanceId === instanceId)) throw deckAddProblem('notCard', 'That card is not in your library');
  const { max } = deckEditBounds(settings);
  if (draft.deck.length + 1 > max) throw deckAddProblem('full', `Your deck is full (${max} cards)`, { max });
  if (!moveFromSideboard(registries, draft, instanceId, settings)) throw deckAddProblem('limit', 'This card cannot join the deck right now');
  syncZones(draft);
  return true;
}
/** shopCardDeckRefusal(...) → '' when the purchased card can join the deck, else 'notCard' | 'full' | 'limit'. */
export function shopCardDeckRefusal(registries, run, instanceId, settings = {}) {
  try { addPurchasedCardToDeckDraft(registries, structuredClone(run), instanceId, settings); return ''; }
  catch (error) { if (error.code) return error.code; throw error; }
}
/** addPurchasedCardToDeck(...) → true when moved. Library to deck; a refusal throws (error.code) and leaves the run untouched. */
export function addPurchasedCardToDeck(registries, run, instanceId, settings = {}) {
  const draft = structuredClone(run);
  const moved = addPurchasedCardToDeckDraft(registries, draft, instanceId, settings);
  Object.assign(run, draft); return moved;
}
export function gameProfileShopStock(registries,run,rng,{shopId}={}) {
  const module=gameModule(run,'shops');
  if(module?.mode!=='configured')throw new Error('Configured shop unavailable');
  const rules=gameContent(run,'shops');
  const fresh=!run.gameProfileRewardOffers?.[`shop:${shopId}`];
  // W25-R rank-up shelf, decided first: it is one of the trader's dock options, so the shelves below make room for it.
  const rankUpShelf=fresh&&ShopStocksRankUp(registries,run,shopId);
  // Each trader offers 3-6 options in all (playtest 2026-11-17 item 42; gameProfileShopKind.js).
  const categories=ConfiguredTraderCategories(run,shopId,gameContent(run,'rewards').categories,{rankUpShelf});
  // Owner 2026-11-20: `itemsPerCategory` may be a [min, max] range; each shelf rolls its own count per visit, seeded by the
  // run seed, the node and the shelf (vendorStockRange.js), so a reload and a revisit agree.
  const perCategory=module.itemsPerCategory??rules.itemsPerCategory??null;
  const itemsPerCategory=perCategory===null?null:ShelfStockCounts(run,shopId,categories,perCategory);
  const count=itemsPerCategory===null?(module.options??rules.offerCount):Object.values(itemsPerCategory).reduce((sum,n)=>sum+n,0);
  const stock=makeOffer(registries,run,rng,{offerId:`shop:${shopId}`,source:'shop',count,takeCount:count,categories,itemsPerCategory});
  if(stock.price===undefined)stock.price=module.price??rules.price;
  // W25-R: some shops also stock a rank-up service (shops.json rankUp.stockChancePct), at the Blacksmith's own price. It rolls on a hash of the
  // run seed and the shop id, joins a fresh stock once, and rides the saved stock after that.
  if(rankUpShelf&&!stock.options.some(option=>option.kind===RANK_UP_OPTION.kind)){stock.options.push({...RANK_UP_OPTION,price:ShopRankUpPrice(run)});stock.takeCount+=1;}
  // Owner 2026-11-20: some traders also sell a copy-a-card service with limited uses (shops.json cardCopy), rolled once on a
  // hash of the run seed and the shop id, like the rank-up shelf. It rides the saved stock after that. It shares the SERVICES tab
  // with a rank-up shelf; without one it needs a tab of its own, so it is stocked only while the dock stays within maxCategories.
  if(fresh&&VendorStocksCardCopy(registries,run,'trader',shopId)&&!stock.options.some(option=>option.kind===CARD_COPY_OPTION.kind)&&CopyShelfFits(run,shopId,stock)){stock.options.push(CardCopyShelf(run,'trader'));stock.takeCount+=1;}
  // Owner 2026-10-24: each new offer rolls its own price from the authored table; saved stock keeps its single price.
  // Owner 2026-11-23: some card offers arrive ranked (shops.json rankedOfferChancePct), rolled before the price so it reads the rank.
  if(fresh)RankShopCardOffers(run,`shop:${shopId}`,stock.options);
  const table=module.priceTable??rules.priceTable;
  if(fresh&&table)for(const option of stock.options)if(option.price===undefined)option.price=rollOfferPrice(registries,run,rng,table,option);
  return stock;
}
// The dock counts one tab per stocked kind, Sell, and the Blacksmith when the trader keeps one (gameProfileShopKind.js).
function CopyShelfFits(run,shopId,stock) {
  const kinds=new Set(stock.options.map(option=>option.kind));
  if(kinds.has(RANK_UP_OPTION.kind))return true;
  const max=gameContent(run,'shops')?.trader?.maxCategories;
  return !Number.isInteger(max)||kinds.size+1+1+(ConfiguredTraderOffersSmith(run,shopId)?1:0)<=max;
}
const PRICE_KIND={combatCards:'card',weaponArts:'weaponArt',relics:'relic',weapons:'armament',armor:'armour',potions:'flask'};
function rollOfferPrice(registries,run,rng,table,option) {
  const kind=PRICE_KIND[option.kind],row=table[kind];
  if(!row)throw new Error(`No shop price for ${option.kind}`);
  const def=option.kind==='combatCards'||option.kind==='weaponArts'?registries.cards.get(option.id)
    :option.kind==='relics'?registries.relics.get(option.id)
    :option.kind==='potions'?registries.flasks.get(option.id)
    :option.kind==='weapons'?(registries.equipment.armaments||[]).find(item=>item.id===option.id)
    :(registries.equipment.armour||[]).find(item=>item.id===option.id&&item.classId===run.class);
  const range=Array.isArray(row)?row:row[def?.rarity]??row.common;
  if(!Array.isArray(range)||range.length!==2||!range.every(Number.isSafeInteger)||range[0]<0||range[1]<range[0])throw new Error(`Invalid shop price range for ${option.kind}`);
  const price=rng.int('shop',range[0],range[1]);
  // Owner 2026-11-23: a ranked card offer costs +rankPricePct% per visible rank (rankedCardPrice.js); shop offers roll no rank today.
  return option.kind==='combatCards'||option.kind==='weaponArts'?RankedCardPrice(run,price,option):price;
}
export { shopOfferPrice };
/**
 * gameProfileShopPurchasePlan(registries, run, shopId, index[, { instanceId }]) -> the quote for buying offer `index`. A copy
 * shelf's price is its "from" price (an unranked card's) until `instanceId` names the card to copy; then it is that card's
 * rank-raised price (CardCopyPrice, owner 2026-11-23), and the commit charges it.
 */
export function gameProfileShopPurchasePlan(registries,run,shopId,index,{instanceId=null}={}) {
  const offerId=`shop:${shopId}`,stock=run.gameProfileRewardOffers?.[offerId];
  const copyCard=stock?.options?.[index]?.kind===CARD_COPY_OPTION.kind&&typeof instanceId==='string'?CardCopyCandidates(registries,run).find(card=>card.instanceId===instanceId):null;
  // A rank-up shelf's price is its Rank 1 price; the chosen card pays it times the rank it reaches (owner, 2026-11-23).
  const rankCard=stock?.options?.[index]?.kind===RANK_UP_OPTION.kind&&typeof instanceId==='string'?RankUpCandidates(registries,run).find(card=>card.instanceId===instanceId):null;
  const shelfPrice=shopOfferPrice(stock,index);
  const price=copyCard?CardCopyPrice(run,shelfPrice,copyCard):rankCard?RankUpPrice(shelfPrice,OwnCardRank(rankCard)+1):shelfPrice;
  let reason='';
  if(!stock||stock.source!=='shop')reason='Missing configured shop';
  else if(!Number.isInteger(index)||!stock.options[index]||stock.taken.includes(index)||stock.claimed!==null)reason='This offer is sold out.';
  else if(!Number.isSafeInteger(price)||price<0)reason='Invalid configured shop price';
  else if(stock.options[index].kind==='weapons'&&(run.loadout?.storage||[]).length>=(registries.balance.equipment.storageSlots??8))reason='Inventory is full. Sell or make room first.';
  else if(!Number.isSafeInteger(run.cinders)||run.cinders<price)reason='Insufficient cinders';
  else if(stock.options[index].kind===RANK_UP_OPTION.kind){if(!RankUpCandidates(registries,run).length)reason='No card of yours can rise in rank.';else if(!RankUpReady(registries,run).length)reason=RankUpReadyReason();else if(rankCard&&RankUpBlock(run,rankCard))reason=RankUpBlock(run,rankCard);}
  else if(stock.options[index].kind===CARD_COPY_OPTION.kind){if(CardCopyUsesLeft(stock.options[index])<1)reason='This offer is sold out.';else if(!CardCopyCandidates(registries,run).length)reason='You have no card to copy.';}
  else try {claimGameProfileReward(registries,structuredClone(run),offerId,index);}catch(error){reason=error.message;}
  return {ok:!reason,reason,shopId,index,price,revision:stock?.tradeRevision||0,signature:JSON.stringify(stock?.options[index])};
}
export function purchaseGameProfileShopOffer(registries,run,shopId,index,rng=null,quote=null) {
  const plan=gameProfileShopPurchasePlan(registries,run,shopId,index,{instanceId:quote?.instanceId??null});
  if(quote&&(quote.revision!==plan.revision||quote.signature!==plan.signature||quote.price!==plan.price||quote.shopId!==shopId||quote.index!==index))throw new Error('This offer changed. Inspect it again.');
  if(!plan.ok)throw new Error(plan.reason);
  const offerId=`shop:${shopId}`,price=plan.price;
  const instanceId=`reward:${offerId}:${index}:${run.gameProfileRewardOffers?.[offerId]?.tradeRevision||0}`;
  const draft=structuredClone(run);draft.cinders-=price;
  const receipt=claimGameProfileReward(registries,draft,offerId,index,{instanceId:quote?.instanceId??null});
  // A rank-up service is a one-off shelf: no replacement is stocked in its place, and what was paid is no resale ceiling.
  if(receipt.kind===RANK_UP_OPTION.kind){draft.gameProfileRewardOffers[offerId].tradeRevision=plan.revision+1;Object.assign(run,draft);return {...receipt,price,replacement:null};}
  // A copy service sells until its uses run out: each use reopens the shelf with one use fewer; the last leaves it sold out.
  if(receipt.kind===CARD_COPY_OPTION.kind){
    const copyStock=draft.gameProfileRewardOffers[offerId],shelf=copyStock.options[index],left=CardCopyUsesLeft(shelf)-1;
    shelf.usesLeft=Math.max(0,left);
    if(left>0){copyStock.taken=copyStock.taken.filter(taken=>taken!==index);copyStock.claimed=null;}
    copyStock.tradeRevision=plan.revision+1;Object.assign(run,draft);return {...receipt,price,replacement:null};
  }
  // Old saves can offer a much lower flat price. Retain that paid-price
  // ceiling across reloads and later merchants so resale cannot profit.
  draft.gameProfileShopPurchasePrices ||= {};
  const purchaseKey=`${receipt.kind}:${receipt.id}`,previousPrice=draft.gameProfileShopPurchasePrices[purchaseKey];
  draft.gameProfileShopPurchasePrices[purchaseKey]=Number.isSafeInteger(previousPrice)?Math.min(previousPrice,price):price;
  const stock=draft.gameProfileRewardOffers[offerId];
  // Persist the new option itself: reloads never roll a replacement again.
  const random=rng||createRng(run.seed,{shop:plan.revision*1000+index});
  const counters=random.getCounters?.();
  try {
    let temporaryId=`${offerId}:restock`;
    while(Object.hasOwn(draft.gameProfileRewardOffers,temporaryId))temporaryId+=':';
    const excludedIds=stock.options.map(option=>option.id);
    const replacement=makeOffer(registries,draft,random,{offerId:temporaryId,source:'shop',count:1,takeCount:1,categories:[receipt.kind],itemsPerCategory:1,excludedIds}).options[0];
    delete draft.gameProfileRewardOffers[temporaryId];
    if(replacement){
      RankShopCardOffers(draft,`${offerId}:restock:${plan.revision}`,[replacement]);
      const table=gameModule(run,'shops').priceTable??gameContent(run,'shops').priceTable;
      if(table)replacement.price=rollOfferPrice(registries,draft,random,table,replacement);
      stock.options[index]=replacement;
      stock.taken=stock.taken.filter(taken=>taken!==index);stock.claimed=null;
    }
    stock.tradeRevision=plan.revision+1;
    Object.assign(run,draft);return {...receipt,price,instanceId,replacement:replacement||null};
  } catch(error) {if(counters&&random.restoreCounters)random.restoreCounters(counters);throw error;}
}
