// Persisted mixed offers: claiming never edits/equips the active deck.
import { gameModule, gameContent } from './gameProfile.js';
import { syncZones } from './state.js';

function pools(registries, run) {
  const cards = (gameContent(run,'cards') || []).filter(card=>card.class==='colorless'||card.class===run.class);
  const artIds = new Set((registries.equipment.armaments||[]).flatMap(row=>row.weaponCardPackage?.weaponArtDefaults||[]));
  const arts = registries.cards.all().filter(card=>artIds.has(card.id) && card.effects.length<=2);
  const equipment = !!gameModule(run,'equipment'), hasCards=!!gameModule(run,'cards');
  const carried = new Set([...run.loadout.storage,...Object.values(run.loadout.sets).flat()]);
  return {
    weapons: equipment ? (registries.equipment.armaments||[]).filter(row=>!carried.has(row.id)).map(row=>row.id) : [],
    relics: registries.relics.all().filter(row=>!run.relics.includes(row.id)).map(row=>row.id),
    combatCards: hasCards ? cards.map(row=>row.id) : [],
    weaponArts: hasCards && equipment ? [...new Set([...(gameContent(run,'starterDeck')?.classSpecials?.reaver ? [gameContent(run,'starterDeck').classSpecials.reaver] : []),...arts.map(row=>row.id)])] : [],
    potions: registries.flasks.all().filter(row=>gameModule(run,'resources')?.include?.includes('mp') || !row.effects.some(effect=>effect.op==='restoreMana')).map(row=>row.id),
    armor: equipment ? (registries.equipment.armour||[]).filter(row=>row.classId===run.class && !(run.loadout.boughtArmour||[]).some(owned=>owned.id===row.id) && !Object.values(run.loadout.sets).flat().includes(row.id)).map(row=>row.id) : [],
  };
}
function makeOffer(registries,run,rng,{offerId,source,count,takeCount,categories}) {
  if (!offerId || typeof offerId!=='string') throw new Error('A stable reward offerId is required');
  run.gameProfileRewardOffers ||= {};
  if(run.gameProfileRewardOffers[offerId])return run.gameProfileRewardOffers[offerId];
  const available=pools(registries,run), options=[];
  // Pick categories uniformly, then an eligible distinct item within that category.
  while(options.length<count) {
    const kinds=categories.filter(kind=>(available[kind]||[]).length);
    if(!kinds.length)break;
    const kind=rng.pick('cardRewards',kinds),ids=available[kind];
    const id=rng.pick('cardRewards',ids);available[kind]=ids.filter(value=>value!==id);
    options.push({kind,id});
  }
  const offer={id:offerId,source,options,takeCount,taken:[],claimed:null};
  run.gameProfileRewardOffers[offerId]=offer;
  return offer;
}
export function gameProfileRewardOffers(registries, run, rng, { offerId, source = 'combat' } = {}) {
  const module=gameModule(run,'rewards');
  if(module?.mode!=='configured')throw new Error('Configured rewards unavailable');
  const rules=gameContent(run,'rewards');
  return makeOffer(registries,run,rng,{offerId,source,count:module.offerCount??rules.offerCount,takeCount:module.takeCount??rules.takeCount,categories:source==='level'?['combatCards']:rules.categories});
}
export function claimGameProfileReward(registries,run,offerId,index) {
  const offer=run.gameProfileRewardOffers?.[offerId];
  if(!offer||offer.claimed!==null||offer.taken.includes(index)||offer.takeCount<1)throw new Error('Reward offer is missing or already claimed');
  const option=offer.options[index];
  if(!Number.isInteger(index)||!option)throw new Error('Invalid reward option');
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
  } else if(option.kind==='potions') {
    registries.flasks.get(option.id);
    if(draft.flasks.length>=registries.balance.flaskSlots)throw new Error('Potion slots are full');
    draft.flasks.push({flaskId:option.id});
  } else if(option.kind==='armor') {
    if(!(registries.equipment.armour||[]).some(row=>row.id===option.id&&row.classId===run.class))throw new Error('Unknown reward armor');
    draft.loadout.boughtArmour ||= [];
    draft.loadout.boughtArmour.push({classId:run.class,id:option.id});
  } else throw new Error('Unknown reward category');
  const pending=draft.gameProfileRewardOffers[offerId];pending.taken.push(index);
  if(pending.taken.length>=Math.min(pending.takeCount,pending.options.length))pending.claimed=index;
  syncZones(draft);Object.assign(run,draft);return option;
}
export function gameProfileShopStock(registries,run,rng,{shopId}={}) {
  const module=gameModule(run,'shops');
  if(module?.mode!=='configured')throw new Error('Configured shop unavailable');
  const rules=gameContent(run,'shops');
  const stock=makeOffer(registries,run,rng,{offerId:`shop:${shopId}`,source:'shop',count:module.options??rules.offerCount,takeCount:module.options??rules.offerCount,categories:gameContent(run,'rewards').categories});
  if(stock.price===undefined)stock.price=rules.price;
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
