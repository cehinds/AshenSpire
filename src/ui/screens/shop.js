import { uiZoom } from '../fx.js';
import { wireCardShelf } from '../components/cardShelf.js';
import { arrangeMerchantOffer } from '../components/merchantOffer.js';
// The wandering merchant. Stock is rolled once, saved with the run, and read
// through the W1d workspace: a bottom category dock below one W1v pane of
// offers, the selected offer's detail, and a footer whose right-hand action is
// the selected offer's. Armament inspection uses the Armoury card components;
// transactions revalidate through armamentTrading.js.

import { renderCard } from '../components/card.js';
import { servicePortrait } from '../components/servicePortrait.js';
import { relicText, cardPlainText } from '../components/card.js';
import { beatArmer } from '../../framework/optionDecision.js';
import { modalHead, modalFooter } from '../components/modalShell.js';
import { button, statusText, el, railItem } from '../kit/index.js';
// Every sentence this screen says is a row in content/source/uiStrings.csv.
import { t } from '../strings.js';
import { renderEquipmentCard } from '../components/equipmentCard.js';
import { renderCollectibleCard } from '../components/collectibleCard.js';
import { shopOfferPrice } from '../../model/shopOfferPrice.js';
import { gameProfileShopPurchasePlan } from '../../model/gameProfileRewards.js';
import { gameProfileShopSalePlans } from '../../model/gameProfileShopSales.js';
import { runHudHtml, wireRunHud } from '../components/runHud.js';
import { settingOn } from './settings.js';
import { clearSelection } from '../components/cardSelection.js';
import { shopWorkspaceLayout } from '../models/ShopWorkspaceModel.js';

// Configured stock uses the same merchant frame, category dock, offer rows,
// inspections and purchase review as the full game. The host retains ownership
// of saved stock and its atomic transaction; this adapter only presents it.
// A shop card has no selection step, so it wears the shared (i) badge always (merchantOffer.js shows it); the
// reading it opens carries no purchase or play verbs (`only: []`), and buying stays on the row's own button.
const shopCardOptions = Object.freeze({ level: 'glance', infoBadge: true, surface: 'shop', only: [] });

// A configured-shop row's description: the resolved text the card face / relic tooltip shows (cardPlainText and
// relicText fill the {tokens}), never the raw textTemplate. Equipment and other kinds have no template to fill.
function configuredOfferText(registries, run, kind, def, ref) {
  if (['combatCards', 'weaponArts'].includes(kind)) return ref ? cardPlainText(registries, ref, { rules: run }) : '';
  if (['relics', 'potions'].includes(kind)) return relicText(def, registries);
  return '';
}

export function mountConfiguredShop(app, { registries, run, offer, onTake, onSell, onLeave, meta, hud = null }) {
  const previousCategory = app.querySelector('.merchant-workspace')?.dataset.shopContent;
  clearSelection();
  app.replaceChildren();
  if (hud) {
    const band = el('div'); band.innerHTML = runHudHtml({ registries, run, meta, place: 'shop', headerClass: 'map-header room-header workspace-hud' });
    app.append(...band.childNodes);
    wireRunHud(app, { ...hud, registries, run, meta, remount: () => mountConfiguredShop(app, { registries, run, offer, onTake, onSell, onLeave, meta, hud }) });
  }
  const root = el('div', { class: 'screen room-screen shop-workspace merchant-workspace', dataset: { wireframe: 'W1d', shopRail: 'dock' } });
  const paneHead = el('div', { class: 'as-pane-head shop-pane-head' });
  const offersBox = el('div', { class: 'shop-offers' });
  const detail = el('section', { class: 'shop-detail', hidden: true });
  const body = el('div', { class: 'shop-body' }, [offersBox, detail]);
  const pane = el('div', { class: 'as-pane shop-pane', id: 'shop-pane', dataset: { wireframe: 'W1v' } }, [paneHead, body]);
  const railed = el('div', { class: 'as-railed shop-railed' }, pane);
  const dock = el('nav', { class: 'merchant-category-dock', 'aria-label': t('shop.rail.aria') });
  const foot = el('div', { class: 'shop-foot-host' });
  const frame = el('div', { class: 'shop-frame' }, [modalHead({ title: t('shop.title'), closeLabel: t('shop.leave'), onClose: onLeave, showMenuButton: false, extras: hud ? null : statusText(t('shop.purse', { cinders: run.cinders })) }), railed, dock, foot]);
  root.append(servicePortrait('merchant'), frame); app.append(root);
  const status = statusText('', { role: 'alert' });
  const leave = button({ label: t('shop.leave'), role: 'exit', id: 'leave-shop' }); leave.addEventListener('click', onLeave);
  foot.append(status, modalFooter({ secondary: [leave], className: 'shop-foot' }));
  const labels = { combatCards: 'shop.bar.combatCards', weaponArts: 'shop.bar.weaponArts', weapons: 'shop.bar.armaments', armor: 'shop.bar.armour', relics: 'shop.bar.relics', potions: 'shop.bar.flasks', sell: 'shop.bar.sell' };
  const sellEnabled = onSell && settingOn(meta?.settings, 'shopSell');
  const categories = [...new Set(offer.options.map(option => option.kind)), ...(sellEnabled ? ['sell'] : [])];
  let active = categories.includes(previousCategory) ? previousCategory : categories[0];
  const shopId = offer.id.slice('shop:'.length);
  const shelves = new Map(); const tabs = new Map();
  let layout;
  function showCategory(key) {
    active = key; root.dataset.shopContent = key;
    paneHead.textContent = t(labels[key] || 'shop.title');
    for (const [kind, shelf] of shelves) shelf.hidden = kind !== key;
    for (const [kind, tab] of tabs) { tab.classList.toggle('on', kind === key); tab.setAttribute('aria-expanded', String(kind === key)); }
    layout?.apply();
  }
  for (const kind of categories) {
    const shelf = el('div', { class: 'card-shelf shop-shelf', dataset: { shopShelf: kind } }); shelves.set(kind, shelf); offersBox.append(shelf);
    const tab = railItem({ label: t(labels[kind]), member: kind, current: kind === active, className: 'with-status shop-railitem', attrs: { dataset: { shopCategory: kind }, 'aria-controls': 'shop-pane' } });
    tab.removeAttribute('role'); tab.addEventListener('click', () => showCategory(kind)); tabs.set(kind, tab); dock.append(tab);
  }
  const arm = beatArmer(meta, registries);
  for (const [index, option] of offer.options.entries()) {
    const card = ['combatCards', 'weaponArts'].includes(option.kind);
    const def = card ? registries.cards.get(option.id) : option.kind === 'relics' ? registries.relics.get(option.id) : option.kind === 'potions' ? registries.flasks.get(option.id) : option.kind === 'weapons' ? registries.equipment.armaments.find(row => row.id === option.id) : registries.equipment.armour.find(row => row.id === option.id && row.classId === run.class);
    const quote = gameProfileShopPurchasePlan(registries, run, shopId, index);
    const price = shopOfferPrice(offer, index);   // each offer has its own price; stock saved before that has one for all
    const available = quote.ok;
    const tile = el('div', { class: 'class-pick shop-offer' });
    const visual = card ? renderCard(registries, { cardId: option.id, instanceId: `shop:${index}`, upgraded: false }, shopCardOptions) : ['weapons', 'armor'].includes(option.kind) ? renderEquipmentCard(registries, def, { interactive: false, level: 'glance', surface: 'shop' }).card : renderCollectibleCard(registries, def, option.kind === 'potions' ? 'Potion' : 'Relic', { interactive: false, surface: 'shop' }).card;
    const action = { kind: 'buy', label: t('shop.action.buy', { cost: price }), enabled: available };
    const buy = arrangeMerchantOffer({ tile, name: def?.name || option.id, desc: configuredOfferText(registries, run, option.kind, def, { cardId: option.id, instanceId: `shop:${index}`, upgraded: false }), visual, price: t('shop.price', { cost: price }), avail: { available, reason: quote.reason || null, because: 'cinders' }, action });
    if (available) arm(buy, 'shopBuy', { onConfirm: () => { try { onTake(index, quote); } catch (error) { status.textContent = error.message; } } });
    shelves.get(option.kind).append(tile);
  }
  if (sellEnabled) {
    const sales = gameProfileShopSalePlans(registries, run, shopId);
    for (const quote of sales) {
      const { def, kind, price } = quote;
      const tile = el('div', { class: 'class-pick shop-offer', dataset: { saleKind: kind } });
      const visual = ['combatCards', 'weaponArts'].includes(kind)
        ? renderCard(registries, run.sideboard.find(card => card.instanceId === quote.identity), shopCardOptions)
        : ['weapons', 'armor'].includes(kind) ? renderEquipmentCard(registries, def, { interactive: false, level: 'glance', surface: 'shop' }).card
        : kind === 'consumables' ? null : renderCollectibleCard(registries, def, kind === 'potions' ? 'Potion' : 'Relic', { interactive: false, surface: 'shop' }).card;
      const saleRef = ['combatCards', 'weaponArts'].includes(kind) ? run.sideboard.find(card => card.instanceId === quote.identity) : null;
      const sell = arrangeMerchantOffer({ tile, name: def.name, desc: configuredOfferText(registries, run, kind, def, saleRef) || def.blurb || '', visual,
        price: t('shop.price.back', { price }), avail: { available: quote.ok, reason: quote.reason || null },
        action: { kind: 'sell', label: t('shop.action.sell', { price }), enabled: quote.ok } });
      if (quote.ok) arm(sell, 'shopSell', { onConfirm: () => { try { onSell(quote); } catch (error) { status.textContent = error.message; } } });
      shelves.get('sell').append(tile);
    }
    if (!sales.length) shelves.get('sell').append(statusText(t('shop.status.nothingWanted')));
  }
  showCategory(active); layout = wireShopLayout(root); wireCardShelf(offersBox);
}

/**
 * Measure the W1d frame and write the model's layout: rail beside or above
 * the pane, offers and detail side by side or stacked, and the numbers CSS
 * places them with. The model owns every number (ShopWorkspaceModel.js).
 */
export function wireShopLayout(root) {
  const frame = root.querySelector('.shop-frame');
  const body = root.querySelector('.shop-body');
  const hud = root.parentElement?.querySelector(':scope > .shared-hud');
  let pending = 0;
  let observer = null;
  function apply() {
    pending = 0;
    if (!root.isConnected) { release(); return; }
    const style = getComputedStyle(document.documentElement);
    const rem = parseFloat(style.fontSize) || 16;
    // The short landscape HUD is absolute. Reserve its measured bottom before
    // sizing the scrollable pane, so the merchant's close button stays exposed.
    const zoom = uiZoom();
    const clearance = hud ? Math.max(0, hud.getBoundingClientRect().bottom - root.getBoundingClientRect().top) / zoom + 8 / zoom : 0;
    root.style.setProperty('--merchant-hud-clearance', `${clearance}px`);
    // How wide a resting card is ACTUALLY drawn. `--card-w-glance` is what
    // main.js projects after a player's card-size overrides and the phone's
    // own variant, and it is the same property the shelf's own cap reads, so
    // the column the shelf stands in and the cards in it cannot disagree.
    const restingWidthPx = parseFloat(style.getPropertyValue('--card-w-glance'));
    const plan = shopWorkspaceLayout({ width: frame.clientWidth, bodyWidth: body.clientWidth, bodyHeight: body.clientHeight, rem, restingWidthPx });
    // Rail or selector is the kit categoryNav's decision (it writes
    // data-shop-rail); this plan sizes the rail when there is one and lays
    // out the pane.
    root.dataset.shopMode = plan.mode;
    root.dataset.shopPane = plan.pane;
    if (plan.railWidth > 0) root.style.setProperty('--shop-rail-width', `${plan.railWidth}px`);
    else root.style.removeProperty('--shop-rail-width');
    root.style.setProperty('--shop-offers-fr', `${plan.offersFr}fr`);
    root.style.setProperty('--shop-detail-fr', `${plan.detailFr}fr`);
    root.style.setProperty('--shop-gap', `${plan.gap}px`);
    if (root.classList.contains('merchant-workspace')) {
      const port = root.querySelector('.shop-offers');
      const gap = 6;
      // Five compact rows plus four gaps and the shelf's two 2px padding edges.
      // Short landscape windows retain a readable minimum and scroll.
      root.style.setProperty('--merchant-row-height', `${Math.max(72 / zoom, Math.floor((port.clientHeight - gap * 4 - 4) / 5))}px`);
    }
    if (plan.detailMax == null) root.style.removeProperty('--shop-detail-max');
    else root.style.setProperty('--shop-detail-max', `${plan.detailMax}px`);
  }
  // ResizeObserver delivers during layout; defer writes to the next frame.
  const schedule = () => { if (!pending) pending = requestAnimationFrame(apply); };
  function release() {
    if (pending) cancelAnimationFrame(pending);
    pending = 0;
    if (observer) observer.disconnect();
    observer = null;
  }
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(schedule);
    observer.observe(frame);
    observer.observe(body);
    if (hud) observer.observe(hud);
  }
  apply();
  return { apply, release };
}
