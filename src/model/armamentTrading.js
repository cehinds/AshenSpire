// Merchant transactions: plans are inert; commits revalidate before mutation.
import { carriedIds, pieceItemRef } from './loadout.js';
import { ownerItemRef } from './cardMounts.js';
import { mountRows } from './cardExtraction.js';

const pieceFor = (registries, id) => (registries.equipment.armaments || []).find((piece) => piece.id === id);
const revision = (run) => run.shopStock?.tradeRevision || 0;
const priced = (cost) => Number.isSafeInteger(cost) && cost > 0;

export function eligibleWeaponArts(registries) {
  const tag = registries.balance.equipment.cardMounts?.extractableTag || 'extractable';
  const ids = new Set((registries.equipment.armaments || []).flatMap((piece) => piece.weaponCardPackage?.weaponArtDefaults || []));
  return [...ids].filter((id) => (registries.cards.get(id)?.tags || []).includes(tag));
}

export function armamentPurchasePlan(registries, run, item, kind = 'armament') {
  const shelf = kind === 'armament' ? 'armaments' : 'weaponArts';
  const def = kind === 'armament' ? pieceFor(registries, item?.id) : registries.cards.get(item?.id);
  let reason = '';
  if (!item || !(run.shopStock?.[shelf] || []).includes(item)) reason = 'This offer is no longer available.';
  else if (!def || !priced(item.cost)) reason = 'This offer has no valid price.';
  else if (kind !== 'armament' && !eligibleWeaponArts(registries).includes(item.id)) reason = 'This card is not a mountable weapon art.';
  else if (kind === 'armament' && carriedIds(run.loadout).includes(item.id)) reason = 'You already carry this armament.';
  else if (kind === 'armament' && !run.loadout) reason = 'Inventory is unavailable.';
  else if (kind === 'armament' && (run.loadout.storage || []).length >= (registries.balance.equipment.storageSlots ?? 8)) reason = 'Inventory is full. Sell or make room first.';
  else if (!Number.isSafeInteger(run.cinders) || run.cinders < item.cost) reason = 'Not enough cinders.';
  return { ok: !reason, reason, item, def, kind, shelf, cost: item?.cost, revision: revision(run) };
}

export function commitArmamentPurchase(registries, run, quote) {
  const plan = armamentPurchasePlan(registries, run, quote.item, quote.kind);
  if (!plan.ok) throw new Error(plan.reason);
  if (quote.cost !== plan.cost || quote.revision !== plan.revision) throw new Error('The offer changed. Inspect it again.');
  let instance = null;
  if (plan.kind !== 'armament') {
    let n = 1;
    while (run.deck.some((card) => card.instanceId === `shop-art:${n}:${plan.item.id}`)) n++;
    instance = { instanceId: `shop-art:${n}:${plan.item.id}`, cardId: plan.item.id, upgraded: false };
  }
  // No callback or fallible derivation inside this mutation group.
  if (plan.kind === 'armament') run.loadout.storage = [...(run.loadout.storage || []), plan.item.id];
  else run.deck.push(instance);
  run.cinders -= plan.cost;
  run.shopStock[plan.shelf].splice(run.shopStock[plan.shelf].indexOf(plan.item), 1);
  run.shopStock.tradeRevision = plan.revision + 1;
  return { kind: plan.kind, id: plan.item.id, spent: plan.cost, instance };
}

export function armamentSalePlan(registries, run, id) {
  const def = pieceFor(registries, id);
  const itemRef = def ? pieceItemRef(def) : `armament/${id}`;
  const range = def && registries.balance.shop.armamentCost?.[def.rarity];
  const fraction = registries.balance.shop.sellFraction;
  const price = range && fraction > 0 && fraction < 1 ? Math.floor(range[0] * fraction) : 0;
  const equipped = Object.values(run.loadout?.sets || {}).some((ids) => ids.includes(id));
  const tier = run.itemUpgradeLevels?.[itemRef] ?? run.armamentLevels?.[id] ?? 0;
  const mounts = def ? mountRows(registries, run, { itemRef, piece: def }).filter((row) => row.cardId) : [];
  const signature = JSON.stringify([tier, run.itemMounts?.[itemRef] || null]);
  let reason = '';
  if (!run.shopStock) reason = 'Visit a trader to sell armaments.';
  else if (!def) reason = 'Unknown armament.';
  else if (equipped) reason = 'Unequip this armament from every set before selling.';
  else if (!(run.loadout?.storage || []).includes(id)) reason = 'This armament is no longer in your inventory.';
  else if (!priced(price)) reason = 'The trader is not buying this armament.';
  else if (!Number.isSafeInteger(run.cinders) || !Number.isSafeInteger(run.cinders + price)) reason = 'Cinder balance is invalid.';
  return { ok: !reason, reason, id, def, itemRef, tier, mounts, price, equipped, signature, revision: revision(run) };
}

export function commitArmamentSale(registries, run, quote) {
  const plan = armamentSalePlan(registries, run, quote.id);
  if (!plan.ok) throw new Error(plan.reason);
  if (plan.price !== quote.price || plan.signature !== quote.signature || plan.revision !== quote.revision) throw new Error('This sale changed. Inspect the armament again.');
  const storage = run.loadout.storage.filter((id) => id !== plan.id);
  // Preserve run-owned extracted cards, and keep tier/mount records bound to
  // the item for reacquisition. An unowned item cannot leave usable grants.
  const deck = run.deck.filter((card) => ownerItemRef(card) !== plan.itemRef);
  run.loadout.storage = storage;
  run.deck = deck;
  run.cinders += plan.price;
  run.shopStock.tradeRevision = plan.revision + 1;
  return { id: plan.id, received: plan.price, tier: plan.tier };
}
