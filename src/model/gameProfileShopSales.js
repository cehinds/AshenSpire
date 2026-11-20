// Configured merchants trade against their persisted offer, never legacy shopStock.
import { gameContent, gameModule } from './gameProfile.js';
import { armamentSalePlan, commitArmamentSale } from './armamentTrading.js';
import { consumableSalePlan, commitConsumableSale } from './consumables.js';
import { removeOwnedRelic, spendClassRewardItem } from './classRewardProvenance.js';
import { syncFlaskGrowth } from './flaskgrowth.js';
import { flaskKindOf } from './gracerefill.js';
import { ownerItemRef } from './cardMounts.js';
import { ownership, pieceItemRef } from './loadout.js';
import { mountRows } from './cardExtraction.js';
import { syncZones } from './state.js';
import { gameProfileWeaponArtIds } from './gameProfileRewards.js';
import { upgradeStepsOf } from './cardUpgrade.js';

const revision = stock => stock?.tradeRevision || 0;
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
function ownedArmour(registries, run) {
  if (!run.loadout) return [];
  const mine = ownership(registries, { loadout: run.loadout });
  return (registries.equipment.armour || []).filter(piece =>
    (piece.classId === run.class || (run.loadout?.boughtArmour || []).some(row => row.classId === piece.classId && row.id === piece.id))
    && mine.has(piece));
}
export function gameProfileShopSalePlan(registries, run, shopId, kind, identity) {
  const stock = run.gameProfileRewardOffers?.[`shop:${shopId}`];
  let def, item, detail, reason = '';
  if (kind === 'weapons') {
    detail = armamentSalePlan(registries, withMerchant(run, stock), identity);
    def = detail.def; reason = detail.reason; item = { id: identity, signature: detail.signature };
  } else if (kind === 'armor') {
    const owned = ownedArmour(registries, run).find(row => `${row.classId}:${row.id}` === identity);
    item = owned && { classId: owned.classId, id: owned.id };
    def = (registries.equipment.armour || []).find(row => `${row.classId}:${row.id}` === identity);
    if (def) {
      const itemRef = pieceItemRef(def);
      detail = { itemRef, tier: run.itemUpgradeLevels?.[itemRef] || 0, mounts: mountRows(registries, run, { itemRef, piece: def }).filter(row => row.cardId) };
    }
    if (def?.classId === run.class && Object.values(run.loadout?.sets || {}).some(ids => ids.includes(def.id))) reason = 'Unequip this armour from every set before selling.';
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
  if (!stock || stock.source !== 'shop') reason = 'Visit a configured merchant to sell items.';
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
    ...ownedArmour(registries, run).map(row => ['armor', `${row.classId}:${row.id}`]),
    ...(run.relics || []).map(id => ['relics', id]),
    ...(run.flasks || []).map((_, index) => ['potions', index]),
    ...Object.keys(run.consumables || {}).map(id => ['consumables', id]),
    ...(run.sideboard || []).map(card => [arts.has(card.cardId) ? 'weaponArts' : 'combatCards', card.instanceId]),
  ];
  return entries.map(([kind, identity]) => gameProfileShopSalePlan(registries, run, shopId, kind, identity)).filter(plan => plan.def);
}
const cardSale = kind => kind === 'combatCards' || kind === 'weaponArts';
const canonical = value => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
function cardSaleGroupKey(plan, ref) {
  // Per-copy identity and reward receipts do not alter the card. Keep every
  // other field, including unknown future mechanics/provenance, conservatively.
  const { instanceId, rewardReceiptId, ...variant } = ref;
  Object.assign(variant, { upgraded: upgradeStepsOf(ref).length > 0, upgradeSteps: upgradeStepsOf(ref),
    rank: ref.rank || 1, mods: ref.mods || [], abilityRank: ref.abilityRank || 0,
    smithingLevel: ref.smithingLevel || 0, playsEver: ref.playsEver || 0 });
  return JSON.stringify([plan.kind, plan.price, canonical(variant)]);
}
function cardSaleGroups(run, plans) {
  const groups = new Map();
  for (const plan of plans) {
    if (!cardSale(plan.kind) || !plan.ok) continue;
    const ref = run.sideboard.find(card => card.instanceId === plan.identity);
    // Corrupt duplicate instance IDs must never turn one quote into two sales.
    if (!ref || run.sideboard.filter(card => card.instanceId === plan.identity).length !== 1
      || run.deck?.some(card => card.instanceId === plan.identity)) continue;
    const key = cardSaleGroupKey(plan, ref);
    if (!groups.has(key)) groups.set(key, { groupKey: key, ref, plans: [] });
    groups.get(key).plans.push(plan);
  }
  return groups;
}
function quoteCardGroup(run, shopId, group, quantity, identities = null) {
  const members = group?.plans || [], first = members[0];
  const ids = identities || members.slice(0, quantity).map(plan => plan.identity);
  const selected = ids.map(id => members.find(plan => plan.identity === id));
  let reason = '';
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > members.length) reason = 'Choose a whole quantity between 1 and the available copies.';
  else if (ids.length !== quantity || new Set(ids).size !== quantity || selected.some(plan => !plan)) reason = 'This sale changed. Inspect the cards again.';
  const price = selected.reduce((sum, plan) => sum + (plan?.price || 0), 0);
  if (!reason && (!Number.isSafeInteger(price) || !Number.isSafeInteger(run.cinders) || !Number.isSafeInteger(run.cinders + price))) reason = 'Cinder balance is invalid.';
  return { ...first, ok: !reason && !!first, reason: reason || (!first ? 'These cards are no longer available to sell.' : ''),
    shopId, batch: true, groupKey: group?.groupKey, ref: group?.ref,
    identity: ids[0], identities: ids, quantity, available: members.length, unitPrice: first?.price || 0, price,
    signature: JSON.stringify(selected.map(plan => [plan?.identity, plan?.signature])) };
}
/** Group loose identical cards; equipment and refused sales retain their single-item plans. */
export function gameProfileShopSaleGroups(registries, run, shopId) {
  const plans = gameProfileShopSalePlans(registries, run, shopId);
  const groups = cardSaleGroups(run, plans), emitted = new Set();
  return plans.flatMap(plan => {
    if (!cardSale(plan.kind) || !plan.ok) return [plan];
    const ref = run.sideboard.find(card => card.instanceId === plan.identity), key = cardSaleGroupKey(plan, ref);
    if (emitted.has(key)) return [];
    emitted.add(key);
    return groups.has(key) ? [quoteCardGroup(run, shopId, groups.get(key), 1)] : [];
  });
}
/** Quote a positive quantity from a current group without changing inventory. */
export function gameProfileShopCardSalePlan(registries, run, shopId, groupKey, quantity = 1) {
  const groups = cardSaleGroups(run, gameProfileShopSalePlans(registries, run, shopId));
  return quoteCardGroup(run, shopId, groups.get(groupKey), quantity);
}
function commitCardGroupSale(registries, run, shopId, quote) {
  if (!Array.isArray(quote.identities)) throw new Error('This sale changed. Inspect the cards again.');
  const groups = cardSaleGroups(run, gameProfileShopSalePlans(registries, run, shopId));
  const plan = quoteCardGroup(run, shopId, groups.get(quote.groupKey), quote.quantity, quote.identities);
  if (!plan.ok) throw new Error(plan.reason);
  if (quote.shopId !== shopId || quote.kind !== plan.kind || quote.price !== plan.price || quote.revision !== plan.revision || quote.signature !== plan.signature) throw new Error('This sale changed. Inspect the cards again.');
  const draft = structuredClone(run), ids = new Set(plan.identities);
  draft.sideboard = draft.sideboard.filter(card => !ids.has(card.instanceId));
  for (const id of ids) spendClassRewardItem(draft, 'cards', id, 'sold');
  draft.cinders += plan.price;
  draft.gameProfileRewardOffers[`shop:${shopId}`].tradeRevision = plan.revision + 1;
  syncZones(draft); Object.assign(run, draft);
  return { kind: plan.kind, identity: plan.identity, identities: plan.identities, quantity: plan.quantity, received: plan.price };
}
export function commitGameProfileShopSale(registries, run, shopId, quote) {
  if (quote.batch === true) return commitCardGroupSale(registries, run, shopId, quote);
  const plan = gameProfileShopSalePlan(registries, run, shopId, quote.kind, quote.identity);
  if (!plan.ok) throw new Error(plan.reason);
  if (quote.shopId !== shopId || quote.price !== plan.price || quote.revision !== plan.revision || quote.signature !== plan.signature) throw new Error('This sale changed. Inspect the item again.');
  const stock = run.gameProfileRewardOffers[`shop:${shopId}`], draft = withMerchant(run, stock);
  if (plan.kind === 'weapons') {
    const receipt = commitArmamentSale(registries, draft, armamentSalePlan(registries, draft, plan.identity));
    draft.cinders -= receipt.received;
    draft.sideboard = draft.sideboard.filter(card => ownerItemRef(card) !== `armament/${plan.identity}`);
  } else if (plan.kind === 'armor') {
    const itemRef = pieceItemRef(plan.def);
    draft.loadout.boughtArmour = (draft.loadout.boughtArmour || []).filter(row => `${row.classId}:${row.id}` !== plan.identity);
    if (draft.loadout.creationArmourGrant?.classId === plan.def.classId && draft.loadout.creationArmourGrant?.id === plan.def.id) draft.loadout.creationArmourGrant = null;
    draft.loadout.soldArmour = [...(draft.loadout.soldArmour || []).filter(row => `${row.classId}:${row.id}` !== plan.identity), { classId: plan.def.classId, id: plan.def.id }];
    draft.deck = draft.deck.filter(card => ownerItemRef(card) !== itemRef);
    draft.sideboard = draft.sideboard.filter(card => ownerItemRef(card) !== itemRef);
    spendClassRewardItem(draft, 'armory', itemRef, 'sold');
  } else if (plan.kind === 'relics') {
    removeOwnedRelic(draft, plan.identity, { reason: 'sold' }); syncFlaskGrowth(registries, draft);
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
  draft.gameProfileRewardOffers[`shop:${shopId}`].tradeRevision = plan.revision + 1;
  syncZones(draft); Object.assign(run, draft);
  return { kind: plan.kind, identity: plan.identity, received: plan.price };
}
