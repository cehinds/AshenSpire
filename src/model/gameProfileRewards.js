// Persisted mixed offers: claiming never edits/equips the active deck.
import { gameModule, gameContent } from './gameProfile.js';
import { syncZones } from './state.js';
import { pickRewardCategory, rewardGroupProblems } from '../../engine/kernel/rewardPolicy.js';
import { acquireFlask, refillFlaskCharges, flaskKindOf } from './gracerefill.js';
import { syncFlaskGrowth, flaskGrowthTable } from './flaskgrowth.js';
import { reserveStanceCards } from './stanceCoverage.js';
import { deckEditBounds, moveFromSideboard } from './deckRules.js';
import { rangeCardAvailable } from './rangeCardAvailability.js';

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
function pools(registries, run) {
  const definitions = gameContent(run,'cards') || [];
  const rules = gameContent(run,'rewards');
  // Owner 2026-10-17: a basic (below minRank) card the character already owns is never offered again.
  const cardRule = rules?.eligibility?.combatCards;
  const ownedIds = new Set([...(run.deck || []), ...(run.sideboard || [])].map(card => card?.cardId ?? card?.id ?? card));
  const cards = definitions.filter(card => rangeCardAvailable(run, card) && (card.class === 'colorless' || card.class === run.class) && !['special', 'status'].includes(card.rarity) && card.type !== 'status'
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
    relics: registries.relics.all().filter(row=>!run.relics.includes(row.id)).map(row=>row.id),
    combatCards: hasCards ? cards.map(row=>row.id) : [],
    // Rank split for combat-card offers (rewards.json eligibility.combatCards): a card's own rank, else its rarity's.
    combatCardsLow: hasCards ? cards.filter(row=>cardRank(row,rules)<(rules.eligibility?.combatCards?.minRank??0)).map(row=>row.id) : [],
    weaponArts: hasCards && equipment ? [...new Set(authoredArts)].filter(id => rangeCardAvailable(run, registries.cards.get(id))) : [],
    potions: registries.flasks.all().filter(row=>gameModule(run,'resources')?.include?.includes('mp') || !row.effects.some(effect=>effect.op==='restoreMana')).map(row=>row.id),
    armor: equipment ? (registries.equipment.armour||[]).filter(row=>armor.has(`${row.classId}:${row.id}`)&&row.classId===run.class && !(run.loadout.boughtArmour||[]).some(owned=>owned.id===row.id) && !Object.values(run.loadout.sets).flat().includes(row.id)).map(row=>row.id) : [],
  };
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
function weightedCardPick(run,rule,rng,stream,ids) {
  if(ids.length<2)return rng.pick(stream,ids);
  const defs=new Map((gameContent(run,'cards')||[]).map(card=>[card.id,card])),owned=new Map();
  for(const card of [...(run.deck||[]),...(run.sideboard||[])]){const id=card?.cardId??card?.id??card;owned.set(id,(owned.get(id)||0)+1);}
  const weights=ids.map(id=>cardPickWeight(rule,defs.get(id),owned.get(id)||0)),total=weights.reduce((sum,weight)=>sum+weight,0);
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
function makeOffer(registries,run,rng,{offerId,source,count,takeCount,categories,groups=[],itemsPerCategory=null}) {
  if (!offerId || typeof offerId!=='string') throw new Error('A stable reward offerId is required');
  if(run.gameProfileRewardOffers?.[offerId])return run.gameProfileRewardOffers[offerId];
  const available=pools(registries,run), options=[];
  // Owner 2026-10-24: eligibility.potions.excludeKinds keeps the charge flasks (hp, mana) out of NEW Core offers; a relic grows
  // them instead. Claiming still accepts them, so an offer saved before this change stays claimable.
  const excludedFlasks=gameContent(run,'rewards')?.eligibility?.potions?.excludeKinds||[];
  if(excludedFlasks.length)available.potions=available.potions.filter(id=>!excludedFlasks.includes(flaskKindOf(registries.flasks.get(id))));
  const stream=source==='shop'&&itemsPerCategory!==null?'shop':'cardRewards';
  if(groups.length) {
    const problems=rewardGroupProblems(groups,categories);
    if(problems.length)throw new Error(problems.join('; '));
  }
  const shelfCounts=new Map();
  // Owner 2026-10-19: reserve slot(s) for a basic/cantrip card of a stance the character lacks (never in a shop).
  if(source!=='shop'&&categories.includes('combatCards')&&(!groups.length||groups.some(group=>group.weight>0&&group.categories.includes('combatCards'))))for(const id of reserveStanceCards(registries,run,rng,stream,available.combatCards,count-options.length)) {
    options.push({kind:'combatCards',id});available.combatCards=available.combatCards.filter(value=>value!==id);
  }
  // Ordinary combat draws weighted groups. Shops independently fill each shelf.
  while(options.length<count) {
    const kinds=categories.filter(kind=>(available[kind]||[]).length && (itemsPerCategory===null || (shelfCounts.get(kind)||0)<itemsPerCategory));
    if(!kinds.length)break;
    const kind=itemsPerCategory===null?pickRewardCategory(rng,stream,kinds,groups):kinds[0];
    if(!kind)break;
    let ids=available[kind];
    // Most card rewards are rank 1+; a small authored chance lets a lower-rank card through.
    const rule=gameContent(run,'rewards')?.eligibility?.combatCards;
    if(kind==='combatCards'&&rule){
      const low=new Set(available.combatCardsLow||[]),high=ids.filter(id=>!low.has(id)),lowIds=ids.filter(id=>low.has(id));
      // The chance is honored even when no rank 1+ card is left: a failed (or zero) roll drops the category.
      const allowLow=lowIds.length>0&&rng.pick(stream,Array.from({length:100},(_,i)=>i))<Math.round((rule.lowerRankChance??0)*100);
      if(!allowLow&&!high.length){available[kind]=[];continue;}
      ids=allowLow?lowIds:high;
    }
    const id=kind==='combatCards'?weightedCardPick(run,rule,rng,stream,ids):kind==='relics'?weightedRelicPick(gameContent(run,'rewards')?.eligibility?.relics?.weights,rng,stream,ids):rng.pick(stream,ids);available[kind]=available[kind].filter(value=>value!==id);
    options.push({kind,id});
    shelfCounts.set(kind,(shelfCounts.get(kind)||0)+1);
  }
  const offer={id:offerId,source,options,takeCount,taken:[],claimed:null};
  run.gameProfileRewardOffers ||= {};
  run.gameProfileRewardOffers[offerId]=offer;
  return offer;
}
export function gameProfileRewardOffers(registries, run, rng, { offerId, source = 'combat' } = {}) {
  const module=gameModule(run,'rewards');
  if(module?.mode!=='configured')throw new Error('Configured rewards unavailable');
  const rules=gameContent(run,'rewards');
  return makeOffer(registries,run,rng,{offerId,source,count:module.offerCount??rules.offerCount,takeCount:module.takeCount??rules.takeCount,categories:source==='level'?['combatCards']:rules.categories,
    groups:source==='combat'?(module.rewardGroups??rules.rewardGroups??[]):[]});
}
export function claimGameProfileReward(registries,run,offerId,index) {
  const offer=run.gameProfileRewardOffers?.[offerId];
  if(!offer||offer.claimed!==null||offer.taken.includes(index)||offer.takeCount<1)throw new Error('Reward offer is missing or already claimed');
  const option=offer.options[index];
  if(!Number.isInteger(index)||!option)throw new Error('Invalid reward option');
  if (!(pools(registries,run)[option.kind] || []).includes(option.id)) throw new Error('Reward option is unavailable under configured eligibility');
  const draft=structuredClone(run);
  if(['combatCards','weaponArts'].includes(option.kind)) {
    registries.cards.get(option.id);
    draft.sideboard.push({instanceId:`reward:${offerId}:${index}`,cardId:option.id,upgraded:false});
  } else if(option.kind==='weapons') {
    if(!(registries.equipment.armaments||[]).some(row=>row.id===option.id))throw new Error('Unknown reward weapon');
    if(draft.loadout.storage.includes(option.id))throw new Error('Reward weapon already owned');
    draft.loadout.storage.push(option.id);
  } else if(option.kind==='relics') {
    registries.relics.get(option.id);
    if(draft.relics.includes(option.id))throw new Error('Reward relic already owned');
    draft.relics.push(option.id);
    // Bind flask growth now (a Core pickup used to wait for a reload); a relic that grows a flask also refills them.
    syncFlaskGrowth(registries,draft);
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
  if(pending.taken.length>=Math.min(pending.takeCount,pending.options.length))pending.claimed=index;
  syncZones(draft);Object.assign(run,draft);return option;
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
export function gameProfileShopStock(registries,run,rng,{shopId}={}) {
  const module=gameModule(run,'shops');
  if(module?.mode!=='configured')throw new Error('Configured shop unavailable');
  const rules=gameContent(run,'shops');
  const categories=gameContent(run,'rewards').categories;
  const itemsPerCategory=module.itemsPerCategory??rules.itemsPerCategory??null;
  const count=itemsPerCategory===null?(module.options??rules.offerCount):itemsPerCategory*categories.length;
  const stock=makeOffer(registries,run,rng,{offerId:`shop:${shopId}`,source:'shop',count,takeCount:count,categories,itemsPerCategory});
  if(stock.price===undefined)stock.price=module.price??rules.price;
  return stock;
}
export function purchaseGameProfileShopOffer(registries,run,shopId,index) {
  const offerId=`shop:${shopId}`,stock=run.gameProfileRewardOffers?.[offerId];
  if(!stock||stock.source!=='shop')throw new Error('Missing configured shop');
  if(!Number.isSafeInteger(stock.price)||stock.price<0)throw new Error('Invalid configured shop price');
  if(run.cinders<stock.price)throw new Error('Insufficient cinders');
  const draft=structuredClone(run);draft.cinders-=stock.price;
  const receipt=claimGameProfileReward(registries,draft,offerId,index);
  Object.assign(run,draft);return {...receipt,price:stock.price};
}
