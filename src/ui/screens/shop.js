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
import { ModalHead, ModalFooter } from '../components/modalShell.js';
import { button, statusText, el, railItem } from '../kit/index.js';
// Every sentence this screen says is a row in content/source/uiStrings.csv.
import { t } from '../strings.js';
import { renderEquipmentCard } from '../components/equipmentCard.js';
import { renderCollectibleCard } from '../components/collectibleCard.js';
import { RenderRankUpOfferCard } from '../components/rankUpOfferCard.js';
import { RenderCardCopyOfferCard } from '../components/cardCopyOfferCard.js';
import { CardCopyUsesLeft } from '../../model/cardCopyService.js';
import { shopOfferPrice } from '../../model/shopOfferPrice.js';
import { gameProfileShopPurchasePlan } from '../../model/gameProfileRewards.js';
import { gameProfileShopSalePlans } from '../../model/gameProfileShopSales.js';
import { runHudHtml, wireRunHud, RefreshRunHud, RunHudRefreshSignature } from '../components/runHud.js';
import { clearSelection } from '../components/cardSelection.js';
import { shopWorkspaceLayout } from '../models/ShopWorkspaceModel.js';
import { purchaseReview, ShopPurchaseKind } from '../models/ConfirmationReviewModel.js';

// Configured stock uses the same merchant frame, category dock, offer rows,
// inspections and purchase review as the full game. The host retains ownership
// of saved stock and its atomic transaction; this adapter only presents it.
// Merchant rows open the card's own reading and supply the same Buy/Sell
// action as the row, so both routes retain the host's guarded transaction.
const shopCardOptions = Object.freeze({ level: 'glance', surface: 'shop', only: [] });

// A configured-shop row's description: the resolved text the card face / relic tooltip shows (cardPlainText and
// relicText fill the {tokens}), never the raw textTemplate. Equipment and other kinds have no template to fill.
export function ConfiguredOfferText(registries, run, kind, def, ref) {
  if (['combatCards', 'weaponArts'].includes(kind)) return ref ? cardPlainText(registries, ref, { rules: run }) : '';
  if (['relics', 'potions'].includes(kind)) return relicText(def, registries);
  return '';
}

export function mountConfiguredShop(app, { registries, run, offer, onTake, onSell, onLeave, onSmith = null, shelfKinds = null, meta, hud = null }) {
  const previousCategory = app.querySelector('.merchant-workspace')?.dataset.shopContent;
  clearSelection();
  app.replaceChildren();
  const HUD_OPTIONS = { place: 'shop', headerClass: 'map-header room-header workspace-hud' };
  let hudMarkup = '';
  if (hud) {
    const band = el('div'); band.innerHTML = runHudHtml({ registries, run, meta, ...HUD_OPTIONS });
    app.append(...band.childNodes);
    hudMarkup = RunHudRefreshSignature({ registries, run, meta, ...HUD_OPTIONS });
    wireRunHud(app, { ...hud, registries, run, meta, remount: () => refresh() });
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
  const purse = hud ? null : statusText(t('shop.purse', { cinders: run.cinders }));
  const frame = el('div', { class: 'shop-frame' }, [ModalHead({ title: t('shop.title'), closeLabel: t('shop.leave'), onClose: onLeave, showMenuButton: false, extras: purse }), railed, dock, foot]);
  root.append(servicePortrait('merchant'), frame); app.append(root);
  const status = statusText('', { role: 'alert' });
  const leave = button({ label: t('shop.leave'), role: 'exit', id: 'leave-shop' }); leave.addEventListener('click', onLeave);
  foot.append(status, ModalFooter({ secondary: [leave], className: 'shop-foot' }));
  const labels = { combatCards: 'shop.bar.combatCards', weaponArts: 'shop.bar.weaponArts', weapons: 'shop.bar.armaments', armor: 'shop.bar.armour', relics: 'shop.bar.relics', potions: 'shop.bar.flasks', sell: 'shop.bar.sell', rankUps: 'shop.bar.rankUps', cardCopies: 'shop.bar.cardCopies' };
  const sellEnabled = onSell && registries?.balance?.shop?.sellBack !== false;
  // `shelfKinds` is the dock the host allows (the 3-6 options rule); an offer on a shelf left off is not drawn.
  // The copy service shares the SERVICES tab with a rank-up shelf (owner 2026-11-20).
  const shelfOf = kind => (kind === 'cardCopies' && offer.options.some(option => option.kind === 'rankUps') && (!shelfKinds || shelfKinds.includes('rankUps')) ? 'rankUps' : kind);
  const stocked = [...new Set(offer.options.map(option => shelfOf(option.kind)))].filter(kind => !shelfKinds || shelfKinds.includes(kind));
  const categories = [...stocked, ...(sellEnabled ? ['sell'] : [])];
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
  // Some traders also keep a Blacksmith's workshop (playtest 2026-11-17 item 42): its dock item opens the Blacksmith,
  // whose Leave comes back here.
  if (onSmith) {
    const smith = railItem({ label: t('shop.bar.smith'), member: 'smith', current: false, className: 'with-status shop-railitem', attrs: { dataset: { shopCategory: 'smith' } } });
    smith.removeAttribute('role'); smith.addEventListener('click', onSmith); dock.append(smith);
  }
  const arm = beatArmer(meta, registries);
  // Rows are keyed (`buy:<index>`, `sell:<kind>:<identity>`) and kept between refreshes while what they show is
  // unchanged, so a purchase or a sale swaps only its own row and the shelf keeps its scroll and focus.
  const entries = new Map();
  const emptySales = statusText(t('shop.status.nothingWanted'));
  let shelfLayout;
  let busy = false;
  let pendingFocusKey = null;

  // One transaction at a time: a second confirm while one is pending (an asynchronous rank-up pick) does nothing,
  // and a refusal reads in the footer without redrawing the merchant.
  function transact(key, action) {
    if (busy) return undefined;
    busy = true;
    pendingFocusKey = key;
    status.textContent = '';
    const finish = () => { busy = false; refresh({ focusKey: key }); };
    try {
      const result = action();
      if (result && typeof result.then === 'function') {
        return Promise.resolve(result).catch(error => { status.textContent = error.message; }).finally(finish);
      }
      finish();
      return result;
    } catch (error) {
      status.textContent = error.message;
      finish();
      return undefined;
    }
  }

  // Trade revisions change after every transaction. A row whose presentation is unchanged keeps its control, but
  // always takes the current quote, which its armed confirm reads.
  function put(key, kind, signature, build, quote) {
    let entry = entries.get(key);
    if (!entry || entry.signature !== signature) {
      const previous = entry;
      entry = { key, kind, signature, quote };
      const { tile, control } = build(entry);
      entry.tile = tile; entry.control = control;
      tile.dataset.shopKey = key;
      if (previous) previous.tile.replaceWith(tile);
      else shelves.get(kind).append(tile);
      entries.set(key, entry);
    } else entry.quote = quote;
    return entry;
  }

  function offerDef(option) {
    if (option.kind === 'cardCopies') return { name: t('cardCopy.name') };
    if (option.kind === 'rankUps') return { name: t('rankUp.name') };
    if (['combatCards', 'weaponArts'].includes(option.kind)) return registries.cards.get(option.id);
    if (option.kind === 'relics') return registries.relics.get(option.id);
    if (option.kind === 'potions') return registries.flasks.get(option.id);
    if (option.kind === 'weapons') return registries.equipment.armaments.find(row => row.id === option.id);
    return registries.equipment.armour.find(row => row.id === option.id && row.classId === run.class);
  }

  function putBuyRow(index, option) {
    const key = `buy:${index}`;
    const card = ['combatCards', 'weaponArts'].includes(option.kind);
    const service = option.kind === 'rankUps';
    const copyService = option.kind === 'cardCopies';
    const def = offerDef(option);
    const quote = gameProfileShopPurchasePlan(registries, run, shopId, index);
    const price = shopOfferPrice(offer, index);   // each offer has its own price; stock saved before that has one for all
    // The copy service names its uses left (owner 2026-11-20); they come from `option`, which the signature holds.
    const desc = copyService ? `${t('cardCopy.blurb')} ${t('cardCopy.uses', { uses: CardCopyUsesLeft(option) })}` : service ? t('rankUp.blurb') : ConfiguredOfferText(registries, run, option.kind, def, { cardId: option.id, instanceId: `shop:${index}`, upgraded: false });
    const signature = JSON.stringify([option, shelfOf(option.kind), price, quote.ok, quote.reason, desc]);
    put(key, shelfOf(option.kind), signature, entry => {
      const tile = el('div', { class: 'class-pick shop-offer' });
      const visual = copyService ? RenderCardCopyOfferCard(registries, CardCopyUsesLeft(option), { interactive: false, level: 'glance', surface: 'shop' }).card : service ? RenderRankUpOfferCard(registries, { interactive: false, level: 'glance', surface: 'shop' }).card : card ? renderCard(registries, { cardId: option.id, instanceId: `shop:${index}`, upgraded: false }, shopCardOptions) : ['weapons', 'armor'].includes(option.kind) ? renderEquipmentCard(registries, def, { interactive: false, level: 'glance', surface: 'shop' }).card : renderCollectibleCard(registries, def, option.kind === 'potions' ? 'Potion' : 'Relic', { interactive: false, surface: 'shop' }).card;
      const action = { kind: 'buy', label: t('shop.action.buy', { cost: price }), enabled: quote.ok };
      // A copy shelf's price is a "from" price: a ranked card costs more (owner, 2026-11-23), named in the card pick.
      const control = arrangeMerchantOffer({ tile, name: def?.name || option.id, desc, visual, price: copyService ? t('cardCopy.price.from', { cost: price }) : t('shop.price', { cost: price }), avail: { available: quote.ok, reason: quote.reason || null, because: 'cinders' }, action });
      // Every purchase asks first (owner, 2026-11-19): the review names the offer, its price and the purse left.
      // The row's Buy and the inspector's Buy press the same armed control, so both routes reach this review.
      const review = () => purchaseReview({ kind: ShopPurchaseKind(option.kind), name: def?.name || option.id, cost: price, cinders: run.cinders });
      if (quote.ok) arm(control, 'shopBuy', {
        question: () => review().question,
        target: () => review().target,
        message: () => review().message,
        confirmLabel: t('shop.buy.confirm'),
        policyAction: 'action.purchase',
        onConfirm: () => transact(key, () => onTake(index, entry.quote)),
      });
      return { tile, control };
    }, quote);
    return key;
  }

  function putSaleRow(quote) {
    const { def, kind, price } = quote;
    const key = `sell:${kind}:${quote.identity}`;
    const saleRef = ['combatCards', 'weaponArts'].includes(kind) ? run.sideboard.find(card => card.instanceId === quote.identity) : null;
    const desc = ConfiguredOfferText(registries, run, kind, def, saleRef) || def.blurb || '';
    const signature = JSON.stringify([def, quote.signature, price, quote.ok, quote.reason, desc]);
    put(key, 'sell', signature, entry => {
      const tile = el('div', { class: 'class-pick shop-offer', dataset: { saleKind: kind } });
      const visual = saleRef ? renderCard(registries, saleRef, shopCardOptions)
        : ['weapons', 'armor'].includes(kind) ? renderEquipmentCard(registries, def, { interactive: false, level: 'glance', surface: 'shop' }).card
        : kind === 'consumables' ? null : renderCollectibleCard(registries, def, kind === 'potions' ? 'Potion' : 'Relic', { interactive: false, surface: 'shop' }).card;
      const control = arrangeMerchantOffer({ tile, name: def.name, desc, visual,
        price: t('shop.price.back', { price }), avail: { available: quote.ok, reason: quote.reason || null },
        action: { kind: 'sell', label: t('shop.action.sell', { price }), enabled: quote.ok } });
      // A sale asks for confirmation (playtest 2026-11-17 item 37): the review names the item and the cinders it returns.
      if (quote.ok) arm(control, 'shopSell', {
        question: t('shop.sell.question', { name: def.name }),
        target: def.name,
        message: t('shop.sell.message', { price }),
        confirmLabel: t('shop.action.sell', { price }),
        onConfirm: () => transact(key, () => onSell(entry.quote)),
      });
      return { tile, control };
    }, quote);
    return key;
  }

  // Focus returns to the row the player acted on, or to the nearest surviving row on the same shelf.
  function restoreFocus(restoreKey, previousKeys) {
    if (!restoreKey || document.querySelector('.modal-veil:not(.confirmation-input-shield)')) return;
    let target = entries.get(restoreKey);
    if (!target || target.control.disabled) {
      const at = previousKeys.indexOf(restoreKey);
      const neighbours = [...previousKeys.slice(at + 1), ...previousKeys.slice(0, at).reverse()];
      target = neighbours.map(key => entries.get(key)).find(entry => entry?.kind === active && !entry.control.disabled);
    }
    const control = target?.kind === active && !target.control.disabled ? target.control : tabs.get(active);
    control?.focus?.({ preventScroll: true });
    pendingFocusKey = null;
  }

  function refresh({ focusKey = null } = {}) {
    // A refresh that lands after the player left must not draw over the next screen.
    if (!root.isConnected) return;
    // The host's transaction replaces the saved stock object; read the current one.
    offer = run.gameProfileRewardOffers?.[`shop:${shopId}`] || offer;
    const scroll = [root, frame, pane, body, offersBox, ...shelves.values()].map(node => [node, node.scrollTop, node.scrollLeft]);
    const focused = document.activeElement?.closest?.('[data-shop-key]');
    const previousKeys = [...entries.keys()];
    const restoreKey = focusKey || focused?.dataset.shopKey || pendingFocusKey;
    const seen = new Set();
    for (const [index, option] of offer.options.entries()) {
      if (shelves.has(shelfOf(option.kind))) seen.add(putBuyRow(index, option));
    }
    if (sellEnabled) {
      const sales = gameProfileShopSalePlans(registries, run, shopId);
      for (const quote of sales) seen.add(putSaleRow(quote));
      if (sales.length) emptySales.remove();
      else if (!emptySales.parentNode) shelves.get('sell').append(emptySales);
    }
    for (const [key, entry] of entries) if (!seen.has(key)) { entry.tile.remove(); entries.delete(key); }
    const purseText = t('shop.purse', { cinders: run.cinders });
    if (purse && purse.textContent !== purseText) purse.textContent = purseText;
    if (hud) {
      const next = RunHudRefreshSignature({ registries, run, meta, ...HUD_OPTIONS });
      if (next !== hudMarkup) {
        hudMarkup = next;
        RefreshRunHud(app, { registries, run, meta, ...HUD_OPTIONS, hud, remount: refresh });
      }
    }
    layout?.apply(); shelfLayout?.apply();
    restoreFocus(restoreKey, previousKeys);
    for (const [node, top, left] of scroll) { node.scrollTop = top; node.scrollLeft = left; }
  }
  showCategory(active); layout = wireShopLayout(root); shelfLayout = wireCardShelf(offersBox);
  refresh();
  return { root, refresh };
}

/**
 * Measure the W1d frame and write the model's layout: rail beside or above
 * the pane, offers and detail side by side or stacked, and the numbers CSS
 * places them with. The model owns every number (ShopWorkspaceModel.js).
 */
export function wireShopLayout(root) {
  const frame = root.querySelector('.shop-frame');
  const body = root.querySelector('.shop-body');
  let hud = root.parentElement?.querySelector(':scope > .shared-hud');
  let pending = 0;
  let observer = null;
  function apply() {
    pending = 0;
    if (!root.isConnected) { release(); return; }
    // A refreshed run HUD is a new band: measure and observe the live one.
    const currentHud = root.parentElement?.querySelector(':scope > .shared-hud');
    if (currentHud !== hud) {
      if (hud) observer?.unobserve(hud);
      hud = currentHud;
      if (hud) observer?.observe(hud);
    }
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
