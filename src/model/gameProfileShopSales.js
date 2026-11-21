// Every vendor buys (owner, 2026-11-20): a configured merchant trades against its persisted offer; a Blacksmith, or a
// trader's own workshop while it is open, against its visit stock (`run.shopStock`, kind 'blacksmith'). Either way the
// sale is the same plan/commit pair, priced the same, and bumps the trading stock's `tradeRevision`.
import { gameContent, gameModule } from './gameProfile.js';
import { armamentSalePlan, commitArmamentSale } from './armamentTrading.js';
import { consumableSalePlan, commitConsumableSale } from './consumables.js';
import { removeOwnedRelic, spendClassRewardItem } from './classRewardProvenance.js';
import { reconcileRunLoadoutHp } from './loadout/cardMods.js';
import { syncFlaskGrowth } from './flaskgrowth.js';
import { flaskKindOf } from './gracerefill.js';
import { ownerItemRef } from './cardMounts.js';
import { pieceItemRef } from './loadout.js';
import { mountRows } from './cardExtraction.js';
import { syncZones } from './state.js';
import { gameProfileWeaponArtIds } from './gameProfileRewards.js';

const revision = stock => stock?.tradeRevision || 0;
/** The stock a sale at `shopId` trades against: the trader's workshop or a Blacksmith visit when one is open, else the merchant's offer. */
export function VendorSaleStock(run, shopId) {
  const offer = run.gameProfileRewardOffers?.[`shop:${shopId}`];
  const smith = run.shopStock?.kind === 'blacksmith' ? run.shopStock : null;
  if (smith && (run.gameProfileTraderSmith === shopId || !offer)) return smith;
  return offer?.source === 'shop' ? offer : null;
}
const tableKinds = { weapons: 'armament', armor: 'armour', relics: 'relic', potions: 'flask', combatCards: 'card', weaponArts: 'weaponArt' };
function salePrice(registries, run, stock, kind, def) {
  const table = gameModule(run, 'shops')?.priceTable ?? gameContent(run, 'shops')?.priceTable;
  const row = table?.[tableKinds[kind]], range = Array.isArray(row) ? row : row?.[def?.rarity] ?? row?.common;
  const minimum = range?.[0] ?? stock.price;
  const paid = run.gameProfileShopPurchasePrices?.[`${kind}:${def?.id}`];
  const basis = Number.isSafeInteger(paid) && paid >= 0 ? Math.min(minimum, paid) : minimum;
  const fraction = registries.balance.shop.sellFraction;
  return Number.isSafeInteger(basis) && basis >= 0 && fraction > 0 && fraction < 1 ? Math.floor(basis * fraction) : 0;
}
function withMerchant(run, stock) {
  const draft = structuredClone(run);
  draft.shopStock = { tradeRevision: revision(stock) };
  return draft;
}
export function gameProfileShopSalePlan(registries, run, shopId, kind, identity) {
  const stock = VendorSaleStock(run, shopId);
  let def, item, detail, reason = '';
  if (kind === 'weapons') {
    detail = armamentSalePlan(registries, withMerchant(run, stock), identity);
    def = detail.def; reason = detail.reason; item = { id: identity, signature: detail.signature };
  } else if (kind === 'armor') {
    item = (run.loadout?.boughtArmour || []).find(row => `${row.classId}:${row.id}` === identity);
    def = (registries.equipment.armour || []).find(row => `${row.classId}:${row.id}` === identity);
    if (def) {
      const itemRef = pieceItemRef(def);
      detail = { itemRef, tier: run.itemUpgradeLevels?.[itemRef] || 0, mounts: mountRows(registries, run, { itemRef, piece: def }).filter(row => row.cardId) };
    }
    if (def?.classId === run.class && Object.values(run.loadout?.sets || {}).some(ids => ids.includes(def.id))) reason = 'Unequip this armour from every set before selling.';
    if (item?.legacy) reason = 'This armour cannot be sold.';
    if (!item) reason = 'This armour is no longer in your inventory.';
  } else if (kind === 'relics') {
    def = registries.relics.has(identity) ? registries.relics.get(identity) : null;
    item = run.relics?.includes(identity) ? identity : null;
  } else if (kind === 'potions') {
    item = run.flasks?.[identity];
    def = item && registries.flasks.has(item.flaskId) ? registries.flasks.get(item.flaskId) : null;
    if (def && flaskKindOf(def) !== 'utility') reason = 'Your refillable flasks cannot be sold.';
  } else if (kind === 'consumables') {
    detail = consumableSalePlan(registries, withMerchant(run, stock), identity);
    def = detail.def; reason = detail.reason; item = { id: identity, count: run.consumables?.[identity] };
  } else if (kind === 'combatCards' || kind === 'weaponArts') {
    item = run.sideboard?.find(card => card.instanceId === identity);
    def = item && registries.cards.has(item.cardId) ? registries.cards.get(item.cardId) : null;
    if (item?.grantedBy || item?.sourceArmamentId || item?.equipmentRole || item?.equipmentAttackSlotId) reason = 'Equipment-bound cards cannot be sold.';
  }
  const price = kind === 'consumables' ? detail?.price : salePrice(registries, run, stock || {}, kind, def);
  if (!stock) reason = 'Visit a vendor to sell items.';
  else if (!def || !item) reason ||= 'This item is no longer in your inventory.';
  else if (!Number.isSafeInteger(price) || price <= 0) reason ||= 'The merchant is not buying this item.';
  else if (!Number.isSafeInteger(run.cinders) || !Number.isSafeInteger(run.cinders + price)) reason ||= 'Cinder balance is invalid.';
  const signature = JSON.stringify([item, kind === 'armor' && [run.itemUpgradeLevels?.[pieceItemRef(def)], run.itemMounts?.[pieceItemRef(def)]]]);
  return { ok: !reason, reason, shopId, kind, identity, def, price, revision: revision(stock), signature,
    ...(['weapons', 'armor'].includes(kind) && detail ? { itemRef: detail.itemRef, tier: detail.tier, mounts: detail.mounts } : {}) };
}
export function gameProfileShopSalePlans(registries, run, shopId) {
  const arts = gameProfileWeaponArtIds(registries, run);
  const entries = [
    ...(run.loadout?.storage || []).map(id => ['weapons', id]),
    ...(run.loadout?.boughtArmour || []).filter(row => !row?.legacy).map(row => ['armor', `${row.classId}:${row.id}`]),
    ...(run.relics || []).map(id => ['relics', id]),
    ...(run.flasks || []).map((_, index) => ['potions', index]),
    ...Object.keys(run.consumables || {}).map(id => ['consumables', id]),
    ...(run.sideboard || []).map(card => [arts.has(card.cardId) ? 'weaponArts' : 'combatCards', card.instanceId]),
  ];
  return entries.map(([kind, identity]) => gameProfileShopSalePlan(registries, run, shopId, kind, identity)).filter(plan => plan.def);
}
export function commitGameProfileShopSale(registries, run, shopId, quote) {
  const plan = gameProfileShopSalePlan(registries, run, shopId, quote.kind, quote.identity);
  if (!plan.ok) throw new Error(plan.reason);
  if (quote.shopId !== shopId || quote.price !== plan.price || quote.revision !== plan.revision || quote.signature !== plan.signature) throw new Error('This sale changed. Inspect the item again.');
  const stock = VendorSaleStock(run, shopId), draft = withMerchant(run, stock);
  if (plan.kind === 'weapons') {
    const receipt = commitArmamentSale(registries, draft, armamentSalePlan(registries, draft, plan.identity));
    draft.cinders -= receipt.received;
    draft.sideboard = draft.sideboard.filter(card => ownerItemRef(card) !== `armament/${plan.identity}`);
  } else if (plan.kind === 'armor') {
    const itemRef = pieceItemRef(plan.def);
    draft.loadout.boughtArmour = draft.loadout.boughtArmour.filter(row => `${row.classId}:${row.id}` !== plan.identity);
    draft.deck = draft.deck.filter(card => ownerItemRef(card) !== itemRef);
    draft.sideboard = draft.sideboard.filter(card => ownerItemRef(card) !== itemRef);
    spendClassRewardItem(draft, 'armory', itemRef, 'sold');
  } else if (plan.kind === 'relics') {
    removeOwnedRelic(draft, plan.identity, { reason: 'sold' }); syncFlaskGrowth(registries, draft);
    reconcileRunLoadoutHp(registries, draft); // a sold maxMana1 relic lowers the pools now
  } else if (plan.kind === 'potions') draft.flasks.splice(plan.identity, 1);
  else if (plan.kind === 'consumables') {
    commitConsumableSale(registries, draft, consumableSalePlan(registries, draft, plan.identity));
    draft.cinders -= plan.price;
  } else {
    draft.sideboard = draft.sideboard.filter(card => card.instanceId !== plan.identity);
    spendClassRewardItem(draft, 'cards', plan.identity, 'sold');
  }
  // Preserve the unrelated legacy merchant and all bound upgrade records.
  if (Object.hasOwn(run, 'shopStock')) draft.shopStock = structuredClone(run.shopStock);
  else delete draft.shopStock;
  draft.cinders += plan.price;
  if (stock === run.shopStock) draft.shopStock.tradeRevision = plan.revision + 1;
  else draft.gameProfileRewardOffers[`shop:${shopId}`].tradeRevision = plan.revision + 1;
  syncZones(draft); Object.assign(run, draft);
  return { kind: plan.kind, identity: plan.identity, received: plan.price };
}
