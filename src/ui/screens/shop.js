import { bindCardInspection } from '../components/cardInspection.js';
import { wireCardShelf } from '../components/cardShelf.js';
// The wandering merchant. Stock is rolled once, saved with the run, and read
// through the W1d workspace: a category rail beside (or above) one W1v pane of
// offers, the selected offer's detail, and a footer whose right-hand action is
// the selected offer's. Armament inspection uses the Armoury card components;
// transactions revalidate through armamentTrading.js.

import { renderCard } from '../components/card.js';
import { attachTooltip, esc } from '../components/tooltip.js';
import { relicText } from '../components/card.js';
import { sfx } from '../sfx.js';
import { isEngaged, focusFirst } from '../input.js';
import { beatArmer } from '../../framework/optionDecision.js';
import { syncFlaskGrowth } from '../../model/flaskgrowth.js';
import { flaskIdentityHtml } from '../components/flask.js';
import { canRemoveDeckCard, removeDeckCard } from '../../model/cardRemoval.js';
import { carriedIds } from '../../model/loadout.js';
import { joinDeck } from '../../model/skills.js';
import { armamentPurchasePlan, armamentSalePlan, commitArmamentPurchase, commitArmamentSale } from '../../model/armamentTrading.js';
import { openModal, modalHead, modalFooter } from '../components/modalShell.js';
import { button, statusText, el, railItem, categoryNav } from '../kit/index.js';
// Every sentence this screen says is a row in content/source/uiStrings.csv.
import { t } from '../strings.js';
import { purchaseReview, burnReview, sellReview } from '../models/ConfirmationReviewModel.js';
import { renderEquipmentCard, renderEquipmentInspection } from '../components/equipmentCard.js';
import { renderCollectibleCard } from '../components/collectibleCard.js';
import { flaskSlotCap } from '../../model/gracerefill.js';
import { runHudHtml, wireRunHud } from '../components/runHud.js';
import { settingOn } from './settings.js';
import { commitSmithing, smithingPlan } from '../../model/smithing.js';
import { smithSelectionModel } from '../models/SmithSelectionModel.js';
import { mountSmithUpgradeModal } from '../components/smithUpgradeModal.js';
import { mountServiceOffer, openMountService } from './smithServices.js';
import { UI_COMPONENTS as UI, markUiComponent } from '../components/uiComponents.js';
import { clearSelection } from '../components/cardSelection.js';
import {
  shopCategories, shopCategoryStatus, offerRefs, resolveShopSelection,
  offerAvailability, shopFooterActions, shopWorkspaceLayout,
} from '../models/ShopWorkspaceModel.js';

/**
 * The merchant's buy-back price, DERIVED — never typed per item. The base is
 * the LOW END of the same cost table the shop's own stock rolls from
 * (balance.shop.relicCost / flaskCost), so a possession is always worth less
 * than the cheapest the merchant would sell one for, and no rng: the same
 * item fetches the same cinders every visit. `sellFraction` lives in the
 * balance table with this derivation restated at the number.
 */
function sellPriceFor(balance, kind, def) {
  const shop = balance.shop;
  const fraction = shop.sellFraction;
  if (!(fraction > 0)) return 0;
  if (kind === 'relic') {
    const range = shop.relicCost[def.rarity];
    return range ? Math.floor(range[0] * fraction) : 0; // no table row (starter) → not priced
  }
  return Math.floor(shop.flaskCost[0] * fraction);
}

// The rail label for each category key (the shelves' existing rows).
const RAIL_LABEL = {
  cards: 'shop.bar.cards', armaments: 'shop.bar.armaments', weaponArts: 'shop.bar.weaponArts',
  relics: 'shop.bar.relics', flasks: 'shop.bar.flasks', services: 'shop.bar.services', sell: 'shop.bar.sell',
};

export function mountShop(app, { registries, run, meta, onLeave, onChanged, onArmamentPurchased = () => {}, hud = null }) {
  // A SPENT BEAT BELONGS TO THE SCREEN THAT SPENT IT. cardSelection is a
  // page-wide store, and nothing in production ever emptied it — so a card
  // whose `i` had been read kept its first beat for the life of the page, and
  // meeting the same logical id on a later surface handed that surface a card
  // already one beat in: its first touch acted instead of selecting.
  clearSelection();
  const stock = run.shopStock;
  // BUYING AND BURNING ARE NOT THE SAME ACTION and the table says why: a
  // purchase spends cinders, which the run refills (`shopBuy`: tempo, faucet —
  // the same ruling consequence.js makes about every cinder spend). Removing a
  // card takes something out of the deck for good, from a wrapped grid of small
  // cards, one tap. Nobody asked for this one; it is here because the Smith's
  // machinery answers it for free and it is the same mistake. Selling is the
  // remove's mirror — a possession gone for good — so `shopSell` sits in the
  // same table and takes whatever beat the table derives.
  const arm = beatArmer(meta, registries);
  const slotsFree = () => run.flasks.length < flaskSlotCap(registries.balance);
  const sellOn = () => settingOn((meta || {}).settings, 'shopSell');

  /** Everything the player could sell right now, each row priced by the table. */
  function sellables() {
    const out = [];
    run.relics.forEach((rid, at) => {
      const def = registries.relics.get(rid);
      const price = sellPriceFor(registries.balance, 'relic', def);
      if (price > 0) out.push({ kind: 'relic', at, def, price, title: `${def.icon || '◆'} ${def.name}`, desc: relicText(def, registries) });
    });
    run.flasks.forEach((f, at) => {
      const def = registries.flasks.get(f.flaskId);
      const price = sellPriceFor(registries.balance, 'flask', def);
      if (price > 0) out.push({ kind: 'flask', at, def, price, title: flaskIdentityHtml(def), titleHtml: true, desc: def.textTemplate || '' });
    });
    return out;
  }

  // THE CATEGORY AND EACH CATEGORY'S SELECTION OUTLIVE THE RENDER. A purchase
  // re-renders the screen; the player stays on the shelf he was on, and the
  // selection moves to the offer now standing where the bought one stood
  // (ShopWorkspaceModel.resolveShopSelection), never back to the first shelf.
  let activeCategory = 'cards';
  const picks = {};
  let primaryDisarm = null;
  let layout = null;
  let shelves = null;

  function releaseFooter() {
    const disarm = primaryDisarm;
    primaryDisarm = null;
    if (disarm) { try { disarm(); } catch { /* the control is already gone */ } }
  }

  function render() {
    releaseFooter();
    if (layout) layout.release();
    if (shelves) shelves.release();
    const categories = shopCategories({ sellOn: sellOn() });
    if (!categories.includes(activeCategory)) activeCategory = 'cards';
    // THE PURSE IS THE BAND'S. This screen used to print its own "Cinders N ·
    // HP" line here as a `.as-status`, and the kit's ellipsis rule (overflow:
    // hidden) let the overflowing column crush it to 0 px — measured at both
    // widths on 2026-09-11: the player bought blind. The band the map draws
    // (components/runHud.js) carries cinders, HP and the act, and it cannot be
    // crushed because it is not a flex child of this column. Only a mount
    // without the band (the instruments' disposable merchants) puts the purse
    // in the W1d header instead, so it is always said exactly once.
    //
    // SELL IS ABSENT, NEVER GREYED, WHEN HIS TOGGLE IS OFF — the recorded
    // answer: no rail item and no #shop-sell node at all.
    app.innerHTML = `
      ${hud ? runHudHtml({ registries, run, meta, place: 'shop', headerClass: 'map-header room-header' }) : ''}
      <div class="screen room-screen shop-workspace" data-wireframe="W1d">
        <div class="shop-frame">
          <div class="as-railed shop-railed">
            <div class="as-pane shop-pane" data-wireframe="W1v" id="shop-pane">
              <div class="as-pane-head shop-pane-head"></div>
              <div class="shop-body">
                <div class="shop-offers">
                  <div class="card-shelf shop-shelf" id="shop-cards" data-shop-shelf="cards"></div>
                  <div class="card-shelf shop-shelf" id="shop-armaments" data-shop-shelf="armaments"></div>
                  <div class="card-shelf shop-shelf" id="shop-weapon-arts" data-shop-shelf="weaponArts"></div>
                  <div class="card-shelf shop-shelf" id="shop-relics" data-shop-shelf="relics"></div>
                  <div class="card-shelf shop-shelf" id="shop-flasks" data-shop-shelf="flasks"></div>
                  <div class="shop-shelf shop-services" data-shop-shelf="services">
                    <div id="shop-remove">
                      <div class="class-row">
                        <div class="class-pick shop-offer${run.cinders >= stock.removeCost && run.deck.length > 1 ? '' : ' locked'}" id="remove-opt" role="button" tabindex="0">
                          <div class="glyph">✂</div><div class="cp-body"><h3>Remove a card</h3><p>${stock.removeCost} cinders. The deck remembers what you cut.</p></div>
                        </div>
                      </div>
                      <div id="remove-grid" class="deck-strip card-shelf" style="display:none"></div>
                    </div>
                    <div class="class-row" id="shop-smith"></div>
                  </div>
                  ${sellOn() ? '<div class="card-shelf shop-shelf" id="shop-sell" data-shop-shelf="sell"></div>' : ''}
                </div>
                <section class="shop-detail" aria-label="${esc(t('shop.detail.aria'))}" aria-live="polite"></section>
              </div>
            </div>
          </div>
        </div>
      </div>`;

    if (hud) wireRunHud(app, { ...hud, registries, run, meta, remount: render });

    const root = app.querySelector('.shop-workspace');
    const frame = root.querySelector('.shop-frame');
    const railed = root.querySelector('.shop-railed');
    const paneHead = root.querySelector('.shop-pane-head');
    const offersBox = root.querySelector('.shop-offers');
    const detailBox = root.querySelector('.shop-detail');
    frame.prepend(modalHead({
      title: t('shop.title'), closeLabel: t('shop.leave'), onClose: onLeave, showMenuButton: false,
      extras: hud ? null : statusText(t('shop.purse', { cinders: run.cinders }), { class: 'modal-head-status' }),
    }));

    // ---- the offers, one list per category: what each tile is, what it
    // costs, whether the player can take it and why not, and the action the
    // footer offers for it. Every fact is read from the saved stock or an
    // existing plan; nothing here prices or rolls. ------------------------
    const offers = Object.fromEntries(categories.map((key) => [key, []]));
    const addOffer = (key, offer) => {
      offer.tile.dataset.shopRef = offer.ref;
      offer.tile.classList.add('shop-offer');
      offers[key].push(offer);
    };
    const availLine = (avail) => statusText(avail.reason
      || t(avail.because === 'capacity' ? 'shop.avail.full' : avail.because === 'cinders' ? 'shop.avail.cinders' : 'shop.avail.locked'),
    { class: 'shop-offer-avail' });

    const cardsRow = app.querySelector('#shop-cards');
    // WCI3: an offer's metadata band ends with how many the deck already holds.
    const ownedCopies = (cardId) => run.deck.filter((c) => c.cardId === cardId).length;
    const cardRefs = offerRefs('cards', stock.cards.map((item) => item.id));
    stock.cards.forEach((item, i) => {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:6px';
      const el = renderCard(registries, { cardId: item.id, upgraded: false }, { small: true, owned: ownedCopies(item.id) });
      const tag = document.createElement('span');
      tag.className = 'mini';
      tag.textContent = `${item.cost} cinders`;
      tag.style.color = run.cinders >= item.cost ? 'var(--gold)' : 'var(--muted)';
      // THE CARD IS A FIXED BOX (kit CARD: fixed name, fixed ArtWell, fixed
      // band, one shared row budget below it). Appending the hold hint INTO it
      // — which is what `arm` does with no host — put the word inside that
      // budget, where the card's own bottom edge clipped it: photographed at
      // 390x844 as half a line of letters under every price. The hint's host
      // is the wrap that already holds the card and its price, so the word
      // stands outside the box it describes. Both children are in place first,
      // so HOLD reads last, after the cost.
      wrap.appendChild(el);
      wrap.appendChild(tag);
      const def = registries.cards.get(item.id);
      const avail = offerAvailability({ price: item.cost, cinders: run.cinders });
      if (!avail.available) wrap.appendChild(availLine(avail));
      const buy = {
        ...purchaseReview({ kind: 'card', name: def.name, cost: item.cost, cinders: run.cinders }),
        onConfirm: () => {
          run.cinders -= item.cost;
          joinDeck(registries, run, { instanceId: `s${run.deck.length}_${item.id}`, cardId: item.id, upgraded: false });
          stock.cards.splice(i, 1);
          sfx.play('buy');
          onChanged();
          render();
        },
      };
      if (run.cinders >= item.cost) {
        // ROUTED THROUGH THE MACHINERY EVEN THOUGH IT OWES NO BEAT, and that is
        // the falsifier for Law 0 on this control rather than a formality:
        // change `shopBuy`'s characteristics in model/secondbeat.js — say the
        // day a purse can strand a run — and a purchase starts asking, with
        // ZERO commits outside that table. An action wired with a bare
        // `addEventListener` can only ever be changed by editing this line.
        // The card keeps its own beat (select, then act on it) and the W1v
        // footer is a second door to the same `shopBuy`, the way the burn
        // grid's button is to `shopRemove`.
        arm(el, 'shopBuy', { hintHost: wrap, ...buy });
      } else {
        el.classList.add('unaffordable');
      }
      addOffer('cards', {
        ref: cardRefs[i], tile: wrap, name: def.name, desc: def.rarity || '',
        price: t('shop.price', { cost: item.cost }), avail,
        action: { kind: 'buy', label: t('shop.action.buy', { cost: item.cost }), enabled: avail.available, beat: { id: 'shopBuy', opts: buy } },
      });
      el.addEventListener('cardinspectionselect', () => select('cards', cardRefs[i]));
      cardsRow.appendChild(wrap);
    });

    const armamentsRow = app.querySelector('#shop-armaments');
    const armamentItems = (stock.armaments || []).map((item) => ({ item, plan: armamentPurchasePlan(registries, run, item) })).filter(({ plan }) => plan.def);
    const armamentRefs = offerRefs('armaments', armamentItems.map(({ item }) => item.id));
    armamentItems.forEach(({ item, plan }, i) => {
      const tile = armamentOffer(plan.def, () => inspectArmament(item, 'buy'), plan.ok ? `${plan.cost} cinders` : plan.reason);
      addOffer('armaments', {
        ref: armamentRefs[i], tile, name: plan.def.name, desc: '',
        price: t('shop.price', { cost: plan.cost }), avail: offerAvailability({ reason: plan.ok ? null : plan.reason }),
        action: { kind: 'buy', label: t('shop.action.buy', { cost: plan.cost }), enabled: !!plan.ok, run: () => inspectArmament(item, 'buy') },
      });
      armamentsRow.appendChild(tile);
    });
    if (!armamentItems.length) armamentsRow.appendChild(statusText('No armaments for sale on this visit.'));

    const artsRow = app.querySelector('#shop-weapon-arts');
    const artRefs = offerRefs('weaponArts', (stock.weaponArts || []).map((item) => item.id));
    (stock.weaponArts || []).forEach((item, i) => {
      const card = renderCard(registries, { cardId: item.id, upgraded: false }, { small: true, owned: ownedCopies(item.id) });
      card.setAttribute('role', 'button');
      card.tabIndex = 0;
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); card.click(); }
      });
      const quote = armamentPurchasePlan(registries, run, item, 'weaponArt');
      const avail = offerAvailability({ reason: quote.ok ? null : quote.reason });
      const wrap = el('div', {}, [card, statusText(`${item.cost} cinders · loose card`), avail.available ? null : availLine(avail)]);
      card.addEventListener('click', () => openWeaponArt(item, card));
      card.addEventListener('cardinspectionselect', () => select('weaponArts', artRefs[i]));
      addOffer('weaponArts', {
        ref: artRefs[i], tile: wrap, name: quote.def ? quote.def.name : item.id, desc: t('shop.weaponArt.eyebrow'),
        price: t('shop.price', { cost: item.cost }), avail,
        action: { kind: 'buy', label: t('shop.action.buy', { cost: item.cost }), enabled: !!quote.ok, run: () => openWeaponArt(item, card) },
      });
      artsRow.appendChild(wrap);
    });
    if (!(stock.weaponArts || []).length) artsRow.appendChild(statusText('No mountable weapon arts for sale on this visit.'));

    const relicsRow = app.querySelector('#shop-relics');
    const relicRefs = offerRefs('relics', stock.relics.map((item) => item.id));
    stock.relics.forEach((item, i) => {
      const def = registries.relics.get(item.id);
      const avail = offerAvailability({ price: item.cost, cinders: run.cinders });
      const tile = shopItem(`${def.icon || '◆'} ${def.name}`, relicText(def, registries), item.cost, avail, { card: renderCollectibleCard(registries, def, 'Relic', { interactive: false, surface: 'shop' }).card });
      addOffer('relics', {
        ref: relicRefs[i], tile, name: def.name, desc: relicText(def, registries),
        price: t('shop.price', { cost: item.cost }), avail,
        action: { kind: 'buy', label: t('shop.action.buy', { cost: item.cost }), enabled: avail.available, beat: { id: 'shopBuy', opts: buyItem('relic', def.name, item.cost, () => {
          run.cinders -= item.cost;
          run.relics.push(item.id);
          syncFlaskGrowth(registries, run); // growth chain: a relic source binds the moment it is held
          stock.relics.splice(i, 1);
          sfx.play('buy');
          onChanged();
          render();
        }) } },
      });
      relicsRow.appendChild(tile);
    });
    const flasksRow = app.querySelector('#shop-flasks');
    const flaskRefs = offerRefs('flasks', stock.flasks.map((item) => item.id));
    stock.flasks.forEach((item, i) => {
      const def = registries.flasks.get(item.id);
      const avail = offerAvailability({ price: item.cost, cinders: run.cinders, capacityFull: !slotsFree() });
      const tile = shopItem(flaskIdentityHtml(def), def.textTemplate, item.cost, avail, { titleHtml: true, card: renderCollectibleCard(registries, def, 'Potion', { interactive: false, surface: 'shop' }).card });
      addOffer('flasks', {
        ref: flaskRefs[i], tile, name: def.name, desc: def.textTemplate || '',
        price: t('shop.price', { cost: item.cost }), avail,
        action: { kind: 'buy', label: t('shop.action.buy', { cost: item.cost }), enabled: avail.available, beat: { id: 'shopBuy', opts: buyItem('flask', def.name, item.cost, () => {
          run.cinders -= item.cost;
          run.flasks.push({ flaskId: item.id });
          stock.flasks.splice(i, 1);
          sfx.play('buy');
          onChanged();
          render();
        }) } },
      });
      flasksRow.appendChild(tile);
    });

    // ---- SERVICES: the burn, and the smith the merchant keeps -------------
    let gridOpen = false;
    const removeOpt = app.querySelector('#remove-opt');
    const removeAvail = offerAvailability({ price: stock.removeCost, cinders: run.cinders, reason: null });
    const removeOpen = removeAvail.available && run.deck.length > 1;
    const openRemoveGrid = () => {
      const grid = app.querySelector('#remove-grid');
      if (grid.style.display !== 'none') return;
      gridOpen = true;
      // The grid is a `.card-shelf`: it wraps, centres and sizes its own
      // tracks. Only the reveal is written here — an inline `gap` would have
      // been a second, louder answer to how far apart the cards stand.
      grid.style.display = 'flex';
      // THE BURN IS TWO BEATS AND THREE DOORS (Constantine, 2026-09-12).
      // The first tap on a card HIGHLIGHTS it and reveals its `i`; nothing
      // is armed and nothing is spent. The second beat is the burn, and it
      // can arrive three ways, all of them the same `shopRemove` row:
      //   · a second tap on the highlighted card  → the review modal
      //   · a press-and-hold on it                → commits, fill and all
      //   · the button below, green once a card is lit → the review modal
      // The button is the beat a thumb can find without knowing the gesture,
      // and it is the same primary-greens-on-selection shape the reward
      // chooser and the Smith already use.
      //
      // ONE SELECTION, READ OFF THE SHARED EVENT. `cardinspectionselect`
      // bubbles from whichever card the first tap lit (cardInspection.js),
      // so this grid never keeps a second idea of what is selected — the
      // highlight a player can see IS the button's subject.
      let burning = null;
      const burnCost = () => stock.removeCost;
      const burnConfirm = button({
        label: t('shop.burn.idle'), weight: 'primary', className: 'shop-burn-confirm', disabled: true,
      });
      burnConfirm.dataset.burnState = 'unselected';
      const dressBurnConfirm = () => {
        const ready = !!burning && run.cinders >= burnCost();
        burnConfirm.disabled = !ready;
        burnConfirm.dataset.burnState = !burning ? 'unselected' : (ready ? 'actionable' : 'blocked');
        burnConfirm.textContent = burning
          ? t('shop.burn.ready', { name: burning.def.name, cost: burnCost() })
          : t('shop.burn.idle');
      };
      const commitBurn = () => {
        if (!burning || run.cinders < burnCost()) return;
        if (!removeDeckCard(run, burning.inst.instanceId, { keepOne: true })) return;
        run.cinders -= burnCost();
        run.removesPurchased = (run.removesPurchased || 0) + 1;
        stock.removeCost = registries.balance.shop.removeBase + registries.balance.shop.removeStep * run.removesPurchased;
        sfx.play('buy');
        onChanged();
        render();
      };
      // W2a: the brazier's review names the lit card and the exact cost. Card
      // removal is DESTRUCTIVE in the ConfirmationRegistry (action.removeCard),
      // so the review is an alertdialog with the red primary.
      const litBurn = () => burnReview({ name: burning ? burning.def.name : null, cost: burnCost(), cinders: run.cinders });
      run.deck.forEach((inst) => {
        // Basic attacks are run-owned even when equipment supplies their face.
        if (!canRemoveDeckCard(inst)) return;
        const el = renderCard(registries, inst, { small: true });
        const def = registries.cards.get(inst.cardId);
        // Same fixed box, same host: the hold hint stands under the card.
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:6px';
        wrap.appendChild(el);
        el.addEventListener('cardinspectionselect', (event) => {
          // The burn grid keeps its own selection; the shelf's selection
          // stays on the remove service it sits under.
          event.stopPropagation();
          burning = { inst, def };
          dressBurnConfirm();
        });
        arm(el, 'shopRemove', {
          hintHost: wrap,
          // The card's own beat always speaks for the card under the finger,
          // whatever the grid last highlighted.
          question: () => burnReview({ name: def.name, cost: burnCost(), cinders: run.cinders }).question,
          target: def.name,
          message: () => burnReview({ name: def.name, cost: burnCost(), cinders: run.cinders }).message,
          confirmLabel: t('shop.burn.confirm'),
          policyAction: 'action.removeCard',
          onConfirm: () => {
            burning = { inst, def };
            commitBurn();
          },
        });
        grid.appendChild(wrap);
      });
      arm(burnConfirm, 'shopRemove', {
        question: () => litBurn().question,
        target: () => litBurn().target,
        message: () => litBurn().message,
        confirmLabel: t('shop.burn.confirm'),
        policyAction: 'action.removeCard',
        onConfirm: commitBurn,
      });
      grid.after(burnConfirm);
      dressBurnConfirm();
      // The burn button in the pane is now the action; the footer keeps Leave.
      if (activeCategory === 'services') paint();
    };
    addOffer('services', {
      ref: 'services:remove#0', tile: removeOpt, name: 'Remove a card', desc: `${stock.removeCost} cinders. The deck remembers what you cut.`,
      price: t('shop.price', { cost: stock.removeCost }),
      avail: removeOpen ? removeAvail : (removeAvail.available ? offerAvailability({ reason: t('shop.avail.locked') }) : removeAvail),
      get action() { return gridOpen ? null : { kind: 'remove', label: t('shop.action.remove'), enabled: removeOpen, run: openRemoveGrid }; },
    });
    removeOpt.addEventListener('click', () => select('services', 'services:remove#0'));
    removeOpt.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      removeOpt.click();
    });
    if (removeOpen) removeOpt.addEventListener('click', openRemoveGrid);

    // ---- THE SMITH THE MERCHANT KEEPS, when the roll at the door said so ----
    // `stock.smith` is smithServicesAt(registries, 'merchant', rng), rolled
    // ONCE on arrival (main.js) on the smith's own stream and persisted with
    // the stock, so a reload does not roll again. Which services appear is
    // that table's word; each one is the same modal the Shrine opens, and a
    // commit here never leaves — the merchant is a place you stay.
    const smithRow = app.querySelector('#shop-smith');
    const smithHere = stock.smith && stock.smith.offered ? stock.smith.services : [];
    const smithCards = [];
    const smithOption = (id, glyph, title, summary, available, open) => {
      const el = document.createElement('div');
      el.className = `class-pick${available ? '' : ' locked'}`;
      el.id = id;
      el.setAttribute('role', 'button');
      el.tabIndex = available ? 0 : -1;
      el.setAttribute('aria-disabled', String(!available));
      el.innerHTML = `<div class="glyph">${glyph}</div><div class="cp-body"><h3>${esc(title)}</h3><p>${esc(summary)}</p></div>`;
      markUiComponent(el, UI.shopSmithCard, id.replace('shop-', ''));
      const ref = `services:${id.replace('shop-', '')}#0`;
      el.addEventListener('click', () => select('services', ref));
      if (available) {
        el.addEventListener('click', open);
        el.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          select('services', ref);
          open();
        });
      }
      addOffer('services', {
        ref, tile: el, name: title, desc: summary, price: '',
        avail: available ? offerAvailability() : offerAvailability({ reason: t('shop.avail.locked') }),
        action: { kind: 'open', label: t('shop.action.open'), enabled: available, run: open },
      });
      smithRow.appendChild(el);
      smithCards.push(el);
      return el;
    };
    if (smithHere.includes('upgrade')) {
      const plan = smithingPlan(registries, run);
      const el = smithOption('shop-upgrade', '⚒', 'Upgrade an Item',
        plan.candidates.length ? `${plan.stones} Smithing Stone${plan.stones === 1 ? '' : 's'} · choose one owned armament.` : 'No owned armament has an effective tier remaining.',
        plan.candidates.length > 0, () => {
          let selectedItemRef = null;
          const model = () => smithSelectionModel(registries, smithingPlan(registries, run), selectedItemRef, { multiUse: true });
          const modal = mountSmithUpgradeModal(app, model(), {
            registries, meta, returnFocusElement: el,
            onSelect: (itemRef) => { selectedItemRef = itemRef; modal.update(model()); },
            onBack: () => {},
            onConfirm: (itemRef) => {
              commitSmithing(registries, run, itemRef);
              sfx.play('shrine');
              onChanged();
              render();
            },
          });
        });
    }
    for (const service of ['extract', 'install']) {
      if (!smithHere.includes(service)) continue;
      const offer = mountServiceOffer(registries, run, service);
      const el = smithOption(`shop-${service}`, service === 'extract' ? '⚙' : '⚒',
        service === 'extract' ? 'Extract a Card' : 'Seat a Card', offer.summary, offer.available, () => openMountService(app, {
          service, registries, run, meta, returnFocusElement: el, multiUse: true, place: 'merchant',
          onCommitted: () => {
            sfx.play('shrine');
            onChanged();
            render();
          },
        }));
    }

    // ---- the SELL shelf: the player's own goods, priced by the table ------
    let sellAvailable = 0;
    if (sellOn()) {
      const sellRow = app.querySelector('#shop-sell');
      const goods = sellables();
      const armamentGoods = carriedIds(run.loadout).map((id) => armamentSalePlan(registries, run, id)).filter((plan) => plan.def);
      const armamentSellRefs = offerRefs('sell-armament', armamentGoods.map((plan) => plan.id));
      armamentGoods.forEach((plan, i) => {
        const tile = armamentOffer(plan.def, () => inspectArmament(plan.id, 'sell'), plan.ok ? `${plan.price} cinders back` : plan.reason);
        const avail = offerAvailability({ reason: plan.ok ? null : plan.reason });
        if (avail.available) sellAvailable++;
        addOffer('sell', {
          ref: armamentSellRefs[i], tile, name: plan.def.name, desc: '',
          price: t('shop.price.back', { price: plan.price }), avail,
          action: { kind: 'sell', label: t('shop.action.sell', { price: plan.price }), enabled: !!plan.ok, run: () => inspectArmament(plan.id, 'sell') },
        });
        sellRow.appendChild(tile);
      });
      const goodRefs = offerRefs('sell', goods.map((row) => `${row.kind}-${row.def.id}`));
      goods.forEach((row, i) => {
        const tile = shopItem(row.title, row.desc, row.price, offerAvailability(), { titleHtml: !!row.titleHtml, costWord: 'cinders back' });
        sellAvailable++;
        addOffer('sell', {
          ref: goodRefs[i], tile, name: row.def.name, desc: row.desc,
          price: t('shop.price.back', { price: row.price }), avail: offerAvailability(),
          action: { kind: 'sell', label: t('shop.action.sell', { price: row.price }), enabled: true, beat: { id: 'shopSell', opts: {
            ...sellReview({ kind: row.kind, name: row.def.name, price: row.price }),
            onConfirm: () => {
              if (row.kind === 'relic') {
                run.relics.splice(row.at, 1);
                syncFlaskGrowth(registries, run); // a sold growth source unbinds the same way a bought one binds
              } else {
                run.flasks.splice(row.at, 1);
              }
              run.cinders += row.price;
              sfx.play('buy');
              onChanged();
              render();
            },
          } } },
        });
        sellRow.appendChild(tile);
      });
    }

    // Selection on the relic, flask and sell tiles: a tap or Enter selects;
    // the footer's action commits through the tile's own beat.
    for (const key of ['relics', 'flasks', 'sell']) {
      for (const offer of offers[key] || []) {
        if (!offer.tile.classList.contains('class-pick')) continue;
        offer.tile.addEventListener('click', () => select(key, offer.ref));
        offer.tile.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          select(key, offer.ref);
        });
      }
    }
    // Armament tiles select through the inspection's own selecting beat.
    for (const key of ['armaments', 'sell']) {
      for (const offer of offers[key] || []) {
        if (!offer.tile.classList.contains('shop-armament-offer')) continue;
        offer.tile.addEventListener('cardinspectionselect', () => select(key, offer.ref));
      }
    }

    // ---- the rail: one item per category, each with its {Status} ---------
    const statusOf = (key) => {
      const list = offers[key] || [];
      const available = key === 'sell' ? sellAvailable : list.filter((offer) => offer.avail.available).length;
      const status = shopCategoryStatus(key, { offered: list.length, available });
      return t(status.id, status.tokens);
    };
    const railItems = categories.map((key) => {
      const item = railItem({
        label: t(RAIL_LABEL[key]), member: key, current: key === activeCategory, id: `shop-cat-${key}`,
        className: 'with-status shop-railitem', attrs: { dataset: { shopCategory: key }, 'aria-controls': 'shop-pane' },
      });
      item.appendChild(statusText(statusOf(key)));
      item.addEventListener('click', () => showCategory(key));
      return item;
    });
    // The kit's W1 category navigation: the rail beside the pane on wide
    // frames, one [Category ▾] selector above it on compact ones (rule 11: no
    // horizontal strip). `data-shop-rail` mirrors the nav's own decision so
    // the frame's grid and the nav can never disagree.
    const nav = categoryNav({
      items: railItems, ariaLabel: t('shop.rail.aria'), railAttrs: { class: 'shop-rail' }, toggleId: 'shop-cat-select',
      onChange: ({ mode }) => { root.dataset.shopRail = mode === 'rail' ? 'side' : 'top'; },
    });
    railed.prepend(nav.rail);
    nav.attach(railed);
    const footHost = document.createElement('div');
    footHost.className = 'shop-foot-host';
    frame.appendChild(footHost);

    function select(key, ref) {
      const at = (offers[key] || []).findIndex((offer) => offer.ref === ref);
      if (at < 0) return;
      picks[key] = { ref, index: at };
      if (key === activeCategory) paint();
    }

    function showCategory(key) {
      activeCategory = key;
      offersBox.scrollTop = 0;
      paint();
    }

    // THE PANE FOLLOWS THE MODEL'S SELECTION: the active shelf is the only
    // one painted, its head carries its {Status}, the detail describes the
    // selected offer, and the footer's right-hand action is that offer's.
    function paint() {
      for (const item of railItems) {
        const on = item.dataset.shopCategory === activeCategory;
        item.classList.toggle('on', on);
        item.setAttribute('aria-selected', on ? 'true' : 'false');
        if (on) item.setAttribute('aria-current', 'true'); else item.removeAttribute('aria-current');
      }
      for (const shelf of offersBox.querySelectorAll('[data-shop-shelf]')) shelf.hidden = shelf.dataset.shopShelf !== activeCategory;
      // The shelf that just appeared had no box to measure while it was
      // hidden, so it is measured now rather than on its first resize.
      shelves?.apply();
      root.querySelector('.shop-pane').setAttribute('aria-labelledby', `shop-cat-${activeCategory}`);
      paneHead.replaceChildren(statusText(statusOf(activeCategory), { class: 'shop-pane-status', role: 'status' }));

      const list = offers[activeCategory] || [];
      const ref = resolveShopSelection(list.map((offer) => offer.ref), picks[activeCategory],
        list.filter((offer) => offer.avail.available).map((offer) => offer.ref));
      const selected = list.find((offer) => offer.ref === ref) || null;
      picks[activeCategory] = selected ? { ref, index: list.indexOf(selected) } : null;
      for (const offer of list) {
        const on = offer === selected;
        offer.tile.classList.toggle('is-selected', on);
        if (offer.tile.classList.contains('class-pick')) offer.tile.setAttribute('aria-pressed', on ? 'true' : 'false');
      }

      detailBox.replaceChildren();
      detailBox.hidden = !selected;
      if (selected) {
        // Optional rows collapse: an offer without a description or a price
        // draws no empty line for it.
        detailBox.append(...[
          el('span', { class: 'as-eyebrow shop-detail-kind', text: t(RAIL_LABEL[activeCategory]) }),
          el('h3', { class: 'as-title-s shop-detail-name', text: selected.name }),
          selected.desc ? el('p', { class: 'shop-detail-desc', text: selected.desc }) : null,
          selected.price ? statusText(selected.price, { class: 'shop-detail-price' }) : null,
          statusText(selected.avail.available ? t('shop.avail.ready') : (selected.avail.reason
            || t(selected.avail.because === 'capacity' ? 'shop.avail.full' : selected.avail.because === 'cinders' ? 'shop.avail.cinders' : 'shop.avail.locked')),
          { class: `shop-detail-avail${selected.avail.available ? ' is-available' : ''}` }),
        ].filter(Boolean));
      }
      buildFooter(selected);
    }

    function buildFooter(selected) {
      releaseFooter();
      const leave = button({ label: t('shop.leave'), role: 'exit', id: 'leave-shop' });
      leave.addEventListener('click', onLeave);
      const action = selected ? selected.action : null;
      let primary = null;
      if (shopFooterActions({ action }).includes('primary')) {
        primary = button({ label: action.label, weight: 'primary', id: 'shop-primary', disabled: !action.enabled });
        primary.dataset.shopAction = action.kind;
        if (action.enabled) {
          if (action.beat) primaryDisarm = arm(primary, action.beat.id, action.beat.opts);
          else primary.addEventListener('click', action.run);
        }
      }
      footHost.replaceChildren(modalFooter({ secondary: [leave], primary, className: 'shop-foot' }));
    }

    paint();
    layout = wireShopLayout(root);
    // Every shelf in the pane is a `.card-shelf`; this tells each one how many
    // cards its measured width holds, so a last row of two is not drawn wider
    // than the four above it (components/cardShelf.js).
    shelves = wireCardShelf(offersBox);
  }

  function buyItem(kind, name, cost, onConfirm) {
    return { ...purchaseReview({ kind, name, cost, cinders: run.cinders }), onConfirm };
  }

  function openWeaponArt(item, card) {
    const quote = armamentPurchasePlan(registries, run, item, 'weaponArt');
    const buy = button({ label: `Buy · ${quote.cost} cinders`, weight: 'primary', disabled: !quote.ok });
    const message = statusText(quote.reason || 'Adds a loose card to your deck. A smith can seat it in a compatible open mount.');
    const shell = openModal({ title: quote.def.name, eyebrow: t('shop.weaponArt.eyebrow'), bodyClassName: 'as-pane', opener: card, body: (host) => host.append(renderCard(registries, { cardId: item.id, upgraded: false }, { small: true }), message), primary: buy });
    buy.addEventListener('click', () => {
      try { commitArmamentPurchase(registries, run, quote); }
      catch (error) { message.textContent = error.message; buy.disabled = true; return; }
      finishTrade(shell);
    });
  }

  function armamentOffer(def, inspect, summary) {
    const face = renderEquipmentCard(registries, def, { interactive: false, inspection: false, level: 'glance', surface: 'shop', run }).card;
    const card = el('div', { class: 'as-option noarrow hosts-face shop-inspect-card' }, face);
    card.setAttribute('aria-label', `${def.name}. ${summary}. Inspect.`);
    bindCardInspection(card, { title: def.name, readOnly: true, open: () => { card.focus({ preventScroll: true }); inspect(); } });
    return el('div', { class: 'shop-armament-offer' }, [card, statusText(summary)]);
  }

  function inspectArmament(item, mode) {
    const quote = mode === 'sell' ? armamentSalePlan(registries, run, item) : armamentPurchasePlan(registries, run, item);
    const def = quote.def;
    const packageInfo = mode === 'sell' ? quote : armamentSalePlan(registries, run, def.id);
    const label = mode === 'sell' ? `Sell · ${quote.price} cinders` : `Buy · ${quote.cost} cinders`;
    const confirm = button({ label, weight: 'primary', disabled: !quote.ok });
    const message = statusText(quote.reason || (mode === 'sell' ? 'Tier and mounted cards stay with this item if you reacquire it. Discovery is retained.' : 'Adds this armament to inventory. Equip it in the Armoury.'));
    message.setAttribute('role', 'status');
    const detail = renderEquipmentInspection(registries, def, { run });
    const upgrades = statusText(`Smithing tier ${packageInfo.tier}. Attached cards: ${packageInfo.mounts.map((mount) => mount.cardName).join(', ') || 'none'}.`);
    const cancel = button({ label: t('shop.back') });
    const shell = openModal({ title: def.name, eyebrow: mode === 'sell' ? 'Sell armament' : 'Buy armament', bodyClassName: 'as-pane', body: (host) => host.append(detail, upgrades, message), secondary: [cancel], primary: confirm });
    cancel.addEventListener('click', shell.close);
    confirm.addEventListener('click', () => {
      let receipt;
      try { receipt = mode === 'sell' ? commitArmamentSale(registries, run, quote) : commitArmamentPurchase(registries, run, quote); }
      catch (error) { message.textContent = error.message; confirm.disabled = true; return; }
      if (mode === 'buy') onArmamentPurchased(receipt.id);
      finishTrade(shell);
    });
  }

  function finishTrade(shell) {
    shell.close();
    sfx.play('buy');
    onChanged();
    render();
    const shelf = `[data-shop-shelf="${activeCategory}"]`;
    (app.querySelector(`${shelf} button, ${shelf} [role="button"]`) || app.querySelector('#leave-shop'))?.focus({ preventScroll: true });
  }

  /**
   * A relic, flask or sell tile: the face (or title and description when
   * there is no face), the price, and — when the offer cannot be taken — why,
   * in words. The tile selects; the footer's action carries the beat.
   */
  function shopItem(title, desc, cost, avail, { titleHtml = false, costWord = 'cinders', card = null } = {}) {
    const el = document.createElement('div');
    el.className = `class-pick${avail.available ? '' : ' locked'}`;
    el.setAttribute('role', 'button');
    el.tabIndex = 0;
    el.setAttribute('aria-pressed', 'false');
    el.innerHTML = `<div class="cp-body"><h3>${titleHtml ? title : esc(title)}</h3><p>${esc(desc)}</p><span class="chip" style="color:${avail.available ? 'var(--gold)' : 'var(--muted)'}">${cost} ${esc(costWord)}</span></div>`;
    const itemName = el.querySelector('h3')?.textContent?.trim() || 'this item';
    // A tile with no face is not a card on the shelf: the SELL shelf holds both
    // kinds, and only one of them wants a card's width (styles/kit.css).
    if (!card) el.classList.add('shop-text-offer');
    if (card) {
      el.classList.add('shop-collectible-offer');
      el.querySelector('h3').remove();
      // The face carries the text; the detail pane repeats it in full.
      el.querySelector('p').remove();
      el.prepend(card);
      el.setAttribute('aria-label', itemName);
    }
    if (!avail.available) {
      const why = document.createElement('span');
      why.className = 'as-status shop-offer-avail';
      why.textContent = avail.reason || t(avail.because === 'capacity' ? 'shop.avail.full' : avail.because === 'cinders' ? 'shop.avail.cinders' : 'shop.avail.locked');
      el.querySelector('.cp-body').appendChild(why);
    }
    return el;
  }

  render();

  // Smart default (keyboard/gamepad): land on the first purchasable card, else
  // the Leave button.
  if (isEngaged()) setTimeout(() => focusFirst('#shop-cards .card') || focusFirst('#leave-shop'), 0);
}

/**
 * Measure the W1d frame and write the model's layout: rail beside or above
 * the pane, offers and detail side by side or stacked, and the numbers CSS
 * places them with. The model owns every number (ShopWorkspaceModel.js).
 */
function wireShopLayout(root) {
  const frame = root.querySelector('.shop-frame');
  const body = root.querySelector('.shop-body');
  let pending = 0;
  let observer = null;
  function apply() {
    pending = 0;
    if (!root.isConnected) { release(); return; }
    const style = getComputedStyle(document.documentElement);
    const rem = parseFloat(style.fontSize) || 16;
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
  }
  apply();
  return { apply, release };
}
