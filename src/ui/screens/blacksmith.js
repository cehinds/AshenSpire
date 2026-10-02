// src/ui/screens/blacksmith.js — the blacksmith (SPEC §14.4, §14.6 step 6).
//
// A screen of its own on the shop's W1d workspace: the same category rail
// beside (or above) one W1v pane, one rail item per offering the visit laid
// out, in content/shops.js order. Every fact is read from the saved stock or
// a plan in model/blacksmith.js; nothing here prices, rolls or decides. Each
// action commits the plan it was drawn from, so a quote made stale since is
// refused by name and the screen redraws.
//
// A SERVICE STAYS ONCE ROLLED (coordinator ruling on #1378): a service with
// nothing to act on now is shown unavailable with its reason, and becomes
// usable on this visit once the run holds something for it (buy an armament
// on the rack, then upgrade it).
//
// The upgrade reuses SmithSelectionModel and the smith's upgrade modal for the
// stone purse, with a refined-purse action beside each candidate; extract and
// install reuse the smith's mount-service modals with the blacksmith's
// quote-checked commits.
import { esc } from '../components/tooltip.js';
import { sfx } from '../sfx.js';
import { modalHead, modalFooter } from '../components/modalShell.js';
import { button, statusText, el, railItem, categoryNav } from '../kit/index.js';
import { t } from '../strings.js';
import { runHudHtml, wireRunHud } from '../components/runHud.js';
import { smithSelectionModel } from '../models/SmithSelectionModel.js';
import { mountSmithUpgradeModal } from '../components/smithUpgradeModal.js';
import { openMountService } from './smithServices.js';
import { wireShopLayout } from './shop.js';
import { shopStockOfferings } from '../../model/shopKinds.js';
import { smithingPlan } from '../../model/smithing.js';
import { armamentPurchasePlan, commitArmamentPurchase } from '../../model/armamentTrading.js';
import { smithStonePurchasePlan, commitSmithStonePurchase } from '../../model/marketAdditions.js';
import {
  BLACKSMITH_SERVICES, serviceCandidates, serviceIdleReason,
  refinePlan, commitRefine,
  sigilSlotPieces, sigilSlotPlan, commitSigilSlot,
  sigilInstallPlan, commitSigilInstall, sigilRemovePlan, commitSigilRemove,
  upgradeableArts, upgradeArtPlan, commitUpgradeArt,
  stackableCardIds, stackCopyPlan, commitStackCopy,
  blacksmithUpgradePlan, commitBlacksmithUpgrade,
  blacksmithExtractPlan, commitBlacksmithExtract,
  blacksmithInstallPlan, commitBlacksmithInstall,
} from '../../model/blacksmith.js';

const GLYPH = Object.freeze({
  armaments: '⚔', upgrade: '⚒', smithStones: '◆', refineStones: '◈', sigilSlots: '◇',
  sigils: '✦', extractArt: '⚙', installArt: '⚒', upgradeArt: '✧', stackCopy: '❖',
});

export function mountBlacksmith(app, { registries, run, meta, onLeave, onChanged = () => {}, onArmamentPurchased = () => {}, priceMult = 1, hud = null }) {
  const stock = run.shopStock;
  let activeCategory = null;
  let layout = null;

  function refuse(host, error) {
    host.querySelector('.bs-refusal')?.remove();
    host.append(statusText(error.message, { class: 'shop-offer-avail bs-refusal', role: 'status' }));
  }

  // One action: commit, sound, persist, redraw — or show the refusal in place.
  function act(tile, commit) {
    try { commit(); }
    catch (error) {
      refuse(tile, error);
      return;
    }
    sfx.play('shrine');
    onChanged();
    render();
  }

  function tile(glyph, title, desc, reason = '') {
    const node = el('div', { class: `class-pick shop-offer${reason ? ' locked' : ''}` });
    node.innerHTML = `<div class="glyph">${glyph}</div><div class="cp-body"><h3>${esc(title)}</h3>${desc ? `<p>${esc(desc)}</p>` : ''}</div>`;
    if (reason) node.append(statusText(reason, { class: 'shop-offer-avail' }));
    return node;
  }
  function actionButton(host, { id, label, plan, commit }) {
    const control = button({ label, id: id || '', weight: 'primary', disabled: !plan.ok, attrs: plan.ok ? {} : { title: plan.reason } });
    if (plan.ok) control.addEventListener('click', () => act(host, commit));
    host.append(control);
    if (!plan.ok) host.append(statusText(plan.reason, { class: 'shop-offer-avail' }));
    return control;
  }

  // ---- each offering's shelf ------------------------------------------------
  const SHELVES = {
    armaments(shelf) {
      for (const item of stock.armaments || []) {
        const plan = armamentPurchasePlan(registries, run, item);
        if (!plan.def) continue;
        const host = tile(GLYPH.armaments, plan.def.name, t('blacksmith.armament.line', { name: plan.def.name, cost: item.cost }));
        actionButton(host, { label: t('blacksmith.action.buy'), plan, commit: () => {
          const receipt = commitArmamentPurchase(registries, run, plan);
          onArmamentPurchased(receipt.id);
        } });
        shelf.append(host);
      }
    },
    smithStones(shelf) {
      const offer = stock.smithStones;
      if (!offer) return;
      const plan = smithStonePurchasePlan(registries, run, 1);
      const host = tile(GLYPH.smithStones, t('shop.stones.name'), t('blacksmith.stones.line', { left: offer.left, price: offer.price }));
      actionButton(host, { id: 'blacksmith-stone', label: t('blacksmith.action.buy'), plan, commit: () => commitSmithStonePurchase(registries, run, plan) });
      shelf.append(host);
    },
    upgrade(shelf) {
      for (const candidate of smithingPlan(registries, run).candidates) {
        const host = tile(GLYPH.upgrade, candidate.itemName, t('blacksmith.upgrade.line', { name: candidate.itemName, from: candidate.currentLevel, to: candidate.nextLevel }));
        // The stone purse opens the smith's own upgrade modal (SmithSelectionModel),
        // whose confirm commits the blacksmith's quote.
        const stonesPlan = blacksmithUpgradePlan(registries, run, candidate.itemRef, { purse: 'stones' });
        const control = button({ label: t('blacksmith.action.upgrade', { cost: candidate.cost }), weight: 'primary', disabled: !stonesPlan.ok });
        if (stonesPlan.ok) control.addEventListener('click', () => openUpgradeModal(candidate.itemRef, control));
        host.append(control);
        if (!stonesPlan.ok) host.append(statusText(stonesPlan.reason, { class: 'shop-offer-avail' }));
        if (candidate.refinedCost !== null) {
          const refinedPlan = blacksmithUpgradePlan(registries, run, candidate.itemRef, { purse: 'refined' });
          actionButton(host, { label: t('blacksmith.action.upgradeRefined', { cost: candidate.refinedCost }), plan: refinedPlan, commit: () => commitBlacksmithUpgrade(registries, run, refinedPlan) });
        }
        shelf.append(host);
      }
    },
    refineStones(shelf) {
      const plan = refinePlan(registries, run, { priceMult });
      const host = tile(GLYPH.refineStones, t('blacksmith.refine.title'), t('blacksmith.refine.desc', { from: plan.stones, cost: plan.cost, value: plan.value ?? 0 }));
      actionButton(host, { id: 'blacksmith-refine', label: t('blacksmith.action.refine'), plan, commit: () => commitRefine(registries, run, plan, { priceMult }) });
      shelf.append(host);
    },
    sigilSlots(shelf) {
      for (const piece of sigilSlotPieces(registries, run)) {
        const plan = sigilSlotPlan(registries, run, piece.itemRef, { priceMult });
        const host = tile(GLYPH.sigilSlots, piece.name, t('blacksmith.slots.line', { name: piece.name, count: piece.slots.length, max: piece.max }));
        actionButton(host, { label: t('blacksmith.action.cutSlot', { cost: plan.cost }), plan, commit: () => commitSigilSlot(registries, run, plan, { priceMult }) });
        shelf.append(host);
      }
    },
    sigils(shelf) {
      const pieces = sigilSlotPieces(registries, run);
      const records = Object.entries(run.sigilSlots || {}).filter(([ref]) => !pieces.some((piece) => piece.itemRef === ref));
      const all = [...pieces.map((piece) => [piece.itemRef, piece.slots, piece.name]), ...records.map(([ref, slots]) => [ref, slots, ref.replace(/^armament\//, '')])];
      for (const [itemRef, slots, name] of all) {
        slots.forEach((slot, index) => {
          const sigilName = slot && registries.sigils.has(slot) ? registries.sigils.get(slot).name : t('blacksmith.slot.empty');
          const host = tile(GLYPH.sigils, `${name} · ${index + 1}`, sigilName);
          if (typeof slot === 'string') {
            const plan = sigilRemovePlan(registries, run, itemRef, index);
            actionButton(host, { label: t('blacksmith.action.removeSigil', { name: sigilName }), plan, commit: () => commitSigilRemove(registries, run, plan) });
          } else {
            for (const sigilId of [...new Set(run.sigils || [])]) {
              const plan = sigilInstallPlan(registries, run, itemRef, index, sigilId);
              if (!registries.sigils.has(sigilId)) continue;
              actionButton(host, { label: t('blacksmith.action.setSigil', { name: registries.sigils.get(sigilId).name }), plan, commit: () => commitSigilInstall(registries, run, plan) });
            }
          }
          shelf.append(host);
        });
      }
    },
    extractArt(shelf) { mountServiceTile(shelf, 'extract'); },
    installArt(shelf) { mountServiceTile(shelf, 'install'); },
    upgradeArt(shelf) {
      for (const card of upgradeableArts(registries, run)) {
        const plan = upgradeArtPlan(registries, run, card.instanceId);
        const name = registries.cards.get(card.cardId)?.name || card.cardId;
        const host = tile(GLYPH.upgradeArt, name, t('blacksmith.art.line', { name }));
        actionButton(host, { label: t('blacksmith.action.upgradeArt', { cost: plan.stones }), plan, commit: () => commitUpgradeArt(registries, run, plan) });
        shelf.append(host);
      }
    },
    stackCopy(shelf) {
      for (const cardId of stackableCardIds(registries, run, meta?.settings)) {
        const plan = stackCopyPlan(registries, run, cardId, { priceMult, settings: meta?.settings });
        const host = tile(GLYPH.stackCopy, plan.name, t('blacksmith.stack.line', { name: plan.name, owned: plan.owned }));
        actionButton(host, { label: t('blacksmith.action.stack', { stones: plan.stones, cost: plan.cost }), plan, commit: () => commitStackCopy(registries, run, plan, { priceMult, settings: meta?.settings }) });
        shelf.append(host);
      }
    },
  };

  function mountServiceTile(shelf, service) {
    const id = service === 'extract' ? 'extractArt' : 'installArt';
    const host = tile(GLYPH[id], t(`blacksmith.bar.${id}`), t(`settings.shops.offering.${id}`));
    // Nothing to act on (or the run's rules refuse it, as extraction in a
    // Sealed or Draft run): the control is disabled, as the Shrine and the
    // merchant's smith lock theirs on `offer.available`, so the shelf's idle
    // line is the whole answer and no dead-end modal opens.
    const ready = readyCount(id) > 0;
    const control = button({ label: t('blacksmith.action.open'), weight: 'primary', disabled: !ready, attrs: { dataset: { smithService: id } } });
    if (ready) control.addEventListener('click', () => openMountService(app, {
      service, registries, run, meta, returnFocusElement: control, multiUse: true, place: 'merchant',
      quote: (chosen) => (service === 'extract'
        ? blacksmithExtractPlan(registries, run, chosen.itemRef, chosen.mountKey)
        : blacksmithInstallPlan(registries, run, chosen.itemRef, chosen.mountKey, chosen.instanceId)),
      commit: (_chosen, quote) => (service === 'extract'
        ? commitBlacksmithExtract(registries, run, quote)
        : commitBlacksmithInstall(registries, run, quote)),
      onError: (error) => refuse(host, error),
      onCommitted: () => { sfx.play('shrine'); onChanged(); render(); },
    }));
    host.append(control);
    shelf.append(host);
  }

  function openUpgradeModal(itemRef, returnFocusElement) {
    let selection = itemRef;
    let displayedQuote;
    const model = () => {
      displayedQuote = blacksmithUpgradePlan(registries, run, selection, { purse: 'stones' });
      return smithSelectionModel(registries, smithingPlan(registries, run), selection, { multiUse: true });
    };
    const modal = mountSmithUpgradeModal(app, model(), {
      registries, meta, returnFocusElement,
      onSelect: (ref) => { selection = ref; modal.update(model()); },
      onBack: () => {},
      onConfirm: () => act(returnFocusElement.parentNode, () => commitBlacksmithUpgrade(registries, run, displayedQuote)),
    });
  }

  // How many things each offering can act on now: the rail's {Status}.
  const readyCount = (key) => {
    if (key === 'armaments') return (stock.armaments || []).length;
    if (key === 'smithStones') return stock.smithStones ? stock.smithStones.left : 0;
    return BLACKSMITH_SERVICES.includes(key) ? serviceCandidates(registries, run, key, meta?.settings).length : 0;
  };

  function render() {
    if (layout) layout.release();
    const categories = shopStockOfferings(stock).filter((key) => SHELVES[key]);
    if (!categories.includes(activeCategory)) activeCategory = categories[0] || null;
    app.innerHTML = `
      ${hud ? runHudHtml({ registries, run, meta, place: 'shop', headerClass: 'map-header room-header' }) : ''}
      <div class="screen room-screen shop-workspace blacksmith-workspace" data-wireframe="W1d" data-shop-kind="blacksmith">
        <div class="shop-frame">
          <div class="as-railed shop-railed">
            <div class="as-pane shop-pane" data-wireframe="W1v" id="shop-pane">
              <div class="as-pane-head shop-pane-head"></div>
              <div class="shop-body">
                <div class="shop-offers">
                  ${categories.map((key) => `<div class="card-shelf shop-shelf" id="blacksmith-${key}" data-shop-shelf="${key}"></div>`).join('')}
                </div>
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
    const purse = t('blacksmith.purse', { stones: run.smithingStones || 0, refined: run.smithingStonesRefined || 0, cinders: run.cinders });
    frame.prepend(modalHead({ title: t('blacksmith.title'), closeLabel: t('blacksmith.leave'), onClose: onLeave, showMenuButton: false, extras: statusText(purse, { class: 'modal-head-status' }) }));

    const idle = {};
    for (const key of categories) {
      const shelf = root.querySelector(`#blacksmith-${key}`);
      SHELVES[key](shelf);
      // A service with nothing to act on now says why, and stays on the rail.
      if (BLACKSMITH_SERVICES.includes(key) && !readyCount(key)) {
        idle[key] = serviceIdleReason(key, run);
        shelf.prepend(statusText(idle[key], { class: 'shop-offer-avail bs-idle', role: 'status' }));
      }
    }
    const statusOf = (key) => {
      const n = readyCount(key);
      return n ? t('blacksmith.status.ready', { count: n }) : t('blacksmith.status.idle');
    };
    const railItems = categories.map((key) => {
      const item = railItem({
        label: t(`blacksmith.bar.${key}`), member: key, current: key === activeCategory, id: `shop-cat-${key}`,
        className: 'with-status shop-railitem', attrs: { dataset: { shopCategory: key }, 'aria-controls': 'shop-pane' },
      });
      item.appendChild(statusText(statusOf(key)));
      item.addEventListener('click', () => { activeCategory = key; paint(); });
      return item;
    });
    const nav = categoryNav({
      items: railItems, ariaLabel: t('blacksmith.rail.aria'), railAttrs: { class: 'shop-rail' }, toggleId: 'shop-cat-select',
      onChange: ({ mode }) => { root.dataset.shopRail = mode === 'rail' ? 'side' : 'top'; },
    });
    railed.prepend(nav.rail);
    nav.attach(railed);
    const leave = button({ label: t('blacksmith.leave'), role: 'exit', id: 'leave-shop' });
    leave.addEventListener('click', onLeave);
    const footHost = el('div', { class: 'shop-foot-host' });
    footHost.append(modalFooter({ secondary: [leave], primary: null, className: 'shop-foot' }));
    frame.appendChild(footHost);

    function paint() {
      for (const item of railItems) {
        const on = item.dataset.shopCategory === activeCategory;
        item.classList.toggle('on', on);
        item.setAttribute('aria-selected', on ? 'true' : 'false');
        if (on) item.setAttribute('aria-current', 'true'); else item.removeAttribute('aria-current');
      }
      for (const shelf of root.querySelectorAll('[data-shop-shelf]')) shelf.hidden = shelf.dataset.shopShelf !== activeCategory;
      if (activeCategory) {
        root.querySelector('.shop-pane').setAttribute('aria-labelledby', `shop-cat-${activeCategory}`);
        paneHead.replaceChildren(statusText(statusOf(activeCategory), { class: 'shop-pane-status', role: 'status' }));
      }
    }
    paint();
    layout = wireShopLayout(root);
  }

  render();
  return { render };
}
