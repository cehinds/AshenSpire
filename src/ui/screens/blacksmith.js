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
import { servicePortrait } from '../components/servicePortrait.js';
import { engravedIconHtml, engravedGlyphId } from '../components/engravedIcon.js';
import { sfx } from '../sfx.js';
import { modalHead, modalFooter } from '../components/modalShell.js';
import { button, statusText, el, railItem, categoryNav, segmented } from '../kit/index.js';
import { t } from '../strings.js';
import { runHudHtml, wireRunHud } from '../components/runHud.js';
import { smithSelectionModel } from '../models/SmithSelectionModel.js';
import { mountSmithUpgradeModal } from '../components/smithUpgradeModal.js';
import { mountCardUpgradeModal } from '../components/cardUpgradeModal.js';
import { cardUpgradeModel } from '../models/CardUpgradeModel.js';
import { openMountService } from './smithServices.js';
import { wireShopLayout } from './shop.js';
import { shopStockOfferings } from '../../model/shopKinds.js';
import { smithingPlan } from '../../model/smithing.js';
import { blacksmithStoneDiscount } from '../../model/blacksmithConfig.js';
import { armamentPurchasePlan, commitArmamentPurchase } from '../../model/armamentTrading.js';
import { coreArmamentPlan, commitCoreArmament, coreWeaponArtPlan, commitCoreWeaponArt } from '../../model/blacksmithStock.js';
import { smithStonePurchasePlan, commitSmithStonePurchase } from '../../model/marketAdditions.js';
import {
  BLACKSMITH_SERVICES, serviceCandidates, serviceIdleReason,
  refinePlan, commitRefine,
  sigilSlotPieces, sigilSlotPlan, commitSigilSlot,
  sigilInstallPlan, commitSigilInstall, sigilRemovePlan, commitSigilRemove,
  rankUpCards, rankUpPlan, commitRankUp,
  upgradeableArts, upgradeArtPlan, commitUpgradeArt, coreCardUpgrades, blacksmithWithholds, plural,
  stackableCardIds, stackCopyPlan, commitStackCopy,
  blacksmithUpgradePlan, commitBlacksmithUpgrade,
  blacksmithExtractPlan, commitBlacksmithExtract,
  blacksmithInstallPlan, commitBlacksmithInstall,
} from '../../model/blacksmith.js';

const GLYPH = Object.freeze({
  armaments: 'attack', upgrade: 'smith', smithStones: 'skill', refineStones: 'skill', sigilSlots: 'dexterity',
  sigils: 'staggered', extractArt: 'settings', installArt: 'smith', upgradeArt: 'vulnerable', stackCopy: 'relic',
  rankUp: 'skill', weaponArts: 'attack',
});

export function mountBlacksmith(app, { registries, run, meta, onLeave, onChanged = () => {}, onArmamentPurchased = () => {}, priceMult = 1, hud = null }) {
  const stock = run.shopStock;
  const stoneDiscount = blacksmithStoneDiscount(run);
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
    node.innerHTML = `<div class="glyph">${engravedIconHtml(engravedGlyphId(glyph)) || glyph}</div><div class="cp-body"><h3>${esc(title)}</h3>${desc ? `<p>${esc(desc)}</p>` : ''}</div>`;
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
      // Core: the rack is tiered (each piece is sold at the tier it shows) and bought with the Core model's quote.
      if (coreCardUpgrades(run)) {
        for (const item of stock.armaments || []) {
          const plan = coreArmamentPlan(registries, run, item.id);
          if (!plan.def) continue;
          const host = tile(GLYPH.armaments, plan.name, t('blacksmith.armament.lineTier', { tier: plan.tier, cost: plan.cost }));
          host.dataset.armamentTier = String(plan.tier);
          actionButton(host, { label: t('blacksmith.action.buy'), plan, commit: () => onArmamentPurchased(commitCoreArmament(registries, run, plan).id) });
          shelf.append(host);
        }
        return;
      }
      for (const item of stock.armaments || []) {
        const plan = armamentPurchasePlan(registries, run, item);
        if (!plan.def) continue;
        const host = tile(GLYPH.armaments, plan.def.name, t('blacksmith.armament.line', { cost: item.cost }));
        actionButton(host, { label: t('blacksmith.action.buy'), plan, commit: () => {
          const receipt = commitArmamentPurchase(registries, run, plan);
          onArmamentPurchased(receipt.id);
        } });
        shelf.append(host);
      }
    },
    weaponArts(shelf) {
      for (const item of stock.weaponArts || []) {
        const plan = coreWeaponArtPlan(registries, run, item.id);
        if (!plan.name) continue;
        const host = tile(GLYPH.weaponArts, plan.name, t('blacksmith.weaponArt.line', { cost: plan.cost }));
        actionButton(host, { label: t('blacksmith.action.buy'), plan, commit: () => commitCoreWeaponArt(registries, run, plan) });
        shelf.append(host);
      }
    },
    rankUp(shelf) {
      for (const card of rankUpCards(registries, run)) {
        const plan = rankUpPlan(registries, run, card.instanceId, { priceMult });
        const host = tile(GLYPH.rankUp, plan.name, t('blacksmith.rankUp.line', { from: plan.from, to: plan.to, cost: plan.cost, stones: plan.stones, plural: plural(plan.stones) }));
        actionButton(host, { label: t('blacksmith.action.rankUp'), plan, commit: () => commitRankUp(registries, run, plan, { priceMult }) });
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
      // An item with no name of its own is a raw id; the screen never shows one.
      for (const candidate of smithingPlan(registries, run, undefined, { stoneDiscount }).candidates.filter((row) => row.itemName)) {
        const host = tile(GLYPH.upgrade, candidate.itemName, t('blacksmith.upgrade.line', { from: candidate.currentLevel, to: candidate.nextLevel }));
        // The stone purse opens the smith's own upgrade modal (SmithSelectionModel),
        // whose confirm commits the blacksmith's quote.
        const stonesPlan = blacksmithUpgradePlan(registries, run, candidate.itemRef, { purse: 'stones', priceMult });
        const control = button({ label: t(!stonesPlan.cost ? 'blacksmith.action.upgrade' : candidate.cost ? 'blacksmith.action.upgradeCoin' : 'blacksmith.action.upgradeCinders', { cost: candidate.cost, plural: plural(candidate.cost), cinders: stonesPlan.cost }), weight: 'primary', disabled: !stonesPlan.ok });
        if (stonesPlan.ok) control.addEventListener('click', () => openUpgradeModal(candidate.itemRef, control));
        host.append(control);
        if (!stonesPlan.ok) host.append(statusText(stonesPlan.reason, { class: 'shop-offer-avail' }));
        // Core has no refining, so there is no refined purse to offer.
        if (candidate.refinedCost !== null && !blacksmithWithholds(run, 'refineStones')) {
          const refinedPlan = blacksmithUpgradePlan(registries, run, candidate.itemRef, { purse: 'refined' });
          actionButton(host, { label: t('blacksmith.action.upgradeRefined', { cost: candidate.refinedCost }), plan: refinedPlan, commit: () => commitBlacksmithUpgrade(registries, run, refinedPlan, { priceMult }) });
        }
        shelf.append(host);
      }
    },
    refineStones(shelf) {
      const plan = refinePlan(registries, run, { priceMult });
      const host = tile(GLYPH.refineStones, t('blacksmith.refine.title'), t('blacksmith.refine.desc', { from: plan.stones, cost: plan.cost, value: plan.value ?? 0, plural: plural(plan.stones), valuePlural: plural(plan.value ?? 0) }));
      actionButton(host, { id: 'blacksmith-refine', label: t('blacksmith.action.refine'), plan, commit: () => commitRefine(registries, run, plan, { priceMult }) });
      shelf.append(host);
    },
    sigilSlots(shelf) {
      for (const piece of sigilSlotPieces(registries, run)) {
        const plan = sigilSlotPlan(registries, run, piece.itemRef, { priceMult });
        const host = tile(GLYPH.sigilSlots, piece.name, t('blacksmith.slots.line', { count: piece.slots.length, max: piece.max, plural: plural(piece.max) }));
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
      // Core: one tile opens the card picker; any deck card, as many upgrades as the purse pays for.
      if (coreCardUpgrades(run)) {
        const host = tile(GLYPH.upgradeArt, t('blacksmith.cardUpgrade.title'), t('blacksmith.cardUpgrade.desc'));
        const ready = readyCount('upgradeArt') > 0;
        const control = button({ label: t('blacksmith.cardUpgrade.open'), id: 'blacksmith-upgrade-card', weight: 'primary', disabled: !ready });
        if (ready) control.addEventListener('click', () => openCardUpgradeModal(control, host));
        host.append(control);
        shelf.append(host);
        return;
      }
      for (const card of upgradeableArts(registries, run)) {
        const plan = upgradeArtPlan(registries, run, card.instanceId);
        const name = registries.cards.get(card.cardId)?.name || card.cardId;
        const host = tile(GLYPH.upgradeArt, name, t('blacksmith.art.line'));
        actionButton(host, { label: t('blacksmith.action.upgradeArt', { cost: plan.stones, plural: plural(plan.stones) }), plan, commit: () => commitUpgradeArt(registries, run, plan, { priceMult }) });
        shelf.append(host);
      }
    },
    stackCopy(shelf) {
      for (const cardId of stackableCardIds(registries, run, meta?.settings)) {
        const plan = stackCopyPlan(registries, run, cardId, { priceMult, settings: meta?.settings });
        const host = tile(GLYPH.stackCopy, plan.name, t('blacksmith.stack.line', { owned: plan.owned }));
        actionButton(host, { label: t('blacksmith.action.stack', { stones: plan.stones, cost: plan.cost, plural: plural(plan.stones) }), plan, commit: () => commitStackCopy(registries, run, plan, { priceMult, settings: meta?.settings }) });
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
      displayedQuote = blacksmithUpgradePlan(registries, run, selection, { purse: 'stones', priceMult });
      const base = smithSelectionModel(registries, smithingPlan(registries, run, undefined, { stoneDiscount }), selection, { multiUse: true });
      // The stone-priced model knows nothing of cinders: route the Blacksmith's own quote (its cinder price and whether the
      // purse can pay it) into the per-selection model, so confirm is blocked, with the reason, when cinders are short.
      const blocked = base.properties.selected && !displayedQuote.ok;
      return { ...base, properties: { ...base.properties,
        ...(coreCardUpgrades(run) ? { purseLabel: `${base.properties.purseLabel} · ${t('blacksmith.modal.cinders', { cinders: run.cinders })}` } : {}),
        ...(base.properties.selected && displayedQuote.cost ? { consequence: `${t('blacksmith.modal.price', { cinders: displayedQuote.cost })} ${base.properties.consequence}` } : {}),
        canConfirm: base.properties.canConfirm && !blocked,
        blockedReasons: blocked && base.properties.canConfirm ? [displayedQuote.reason] : base.properties.blockedReasons,
      } };
    };
    const modal = mountSmithUpgradeModal(app, model(), {
      registries, meta, returnFocusElement,
      onSelect: (ref) => { selection = ref; modal.update(model()); },
      onBack: () => {},
      onConfirm: () => act(returnFocusElement.parentNode, () => commitBlacksmithUpgrade(registries, run, displayedQuote, { priceMult })),
    });
  }

  function openCardUpgradeModal(returnFocusElement, host) {
    let selection = null;
    // The rows are priced as the Blacksmith charges (cinders, no stones), not as a rest site does.
    const quote = (instanceId) => { const p = upgradeArtPlan(registries, run, instanceId, { priceMult }); return { ok: p.ok, cost: p.stones, reason: p.reason, cinders: p.cost }; };
    const model = () => cardUpgradeModel(registries, run, selection, { quote });
    const modal = mountCardUpgradeModal(app, model(), {
      registries, meta, returnFocusElement, backLabel: t('smith.back.shrine'),
      consequence: t('blacksmith.cardUpgrade.consequence'), decisionConsequence: t('blacksmith.cardUpgrade.decision'),
      onSelect: (instanceId) => { selection = instanceId; modal.update(model()); },
      onBack: () => {},
      // The quote is the plan the modal showed (rolled step included); a stale one is refused by name.
      onConfirm: (instanceId, cardQuote) => act(host, () => commitUpgradeArt(registries, run, { ...upgradeArtPlan(registries, run, instanceId, { priceMult }), cardQuote }, { priceMult })),
    });
  }

  // How many things each offering can act on now: the rail's {Status}.
  const readyCount = (key) => {
    if (key === 'armaments') return (stock.armaments || []).length;
    if (key === 'weaponArts') return (stock.weaponArts || []).length;
    if (key === 'rankUp') return serviceCandidates(registries, run, key, meta?.settings).length;
    if (key === 'smithStones') return stock.smithStones ? stock.smithStones.left : 0;
    return BLACKSMITH_SERVICES.includes(key) ? serviceCandidates(registries, run, key, meta?.settings).length : 0;
  };

  function render() {
    if (layout) layout.release();
    const categories = shopStockOfferings(stock).filter((key) => SHELVES[key] && !blacksmithWithholds(run, key));
    if (!categories.includes(activeCategory)) activeCategory = categories[0] || null;
    app.innerHTML = `
      ${hud ? runHudHtml({ registries, run, meta, place: 'shop', headerClass: 'map-header room-header workspace-hud' }) : ''}
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
    root.prepend(servicePortrait('smith'));
    const frame = root.querySelector('.shop-frame');
    const railed = root.querySelector('.shop-railed');
    const paneHead = root.querySelector('.shop-pane-head');
    const stonesHeld = run.smithingStones || 0;
    const refinedHeld = run.smithingStonesRefined || 0;
    // Core has no refining, so its purse never names refined stones.
    const purse = coreCardUpgrades(run)
      ? t('blacksmith.purse.core', { stones: stonesHeld, plural: plural(stonesHeld), cinders: run.cinders })
      : t('blacksmith.purse', { stones: stonesHeld, plural: plural(stonesHeld), refined: refinedHeld, refinedPlural: plural(refinedHeld), cinders: run.cinders });
    frame.prepend(modalHead({ title: t('blacksmith.title'), closeLabel: t('blacksmith.leave'), onClose: onLeave, showMenuButton: false, extras: statusText(purse, { class: 'modal-head-status' }) }));

    const idle = {};
    for (const key of categories) {
      const shelf = root.querySelector(`#blacksmith-${key}`);
      SHELVES[key](shelf);
      // A service with nothing to act on now says why, and stays on the rail.
      if ((BLACKSMITH_SERVICES.includes(key) || key === 'rankUp') && !readyCount(key)) {
        idle[key] = serviceIdleReason(key, run);
        shelf.prepend(statusText(idle[key], { class: 'shop-offer-avail bs-idle', role: 'status' }));
      }
    }
    const statusOf = (key) => {
      const n = readyCount(key);
      return n ? t('blacksmith.status.ready', { count: n }) : t('blacksmith.status.idle');
    };
    // Core offers two services: a compact switch at the top of the pane, like the card upgrade picker's own controls,
    // instead of a rail. Legacy keeps the category rail.
    const compact = coreCardUpgrades(run);
    // Core's five-way switch is narrow on a phone, so its tabs wear the one-word `blacksmith.tab.*` labels.
    const labelOf = (key) => t(compact ? `blacksmith.tab.${key}` : `blacksmith.bar.${key}`);
    let railItems;
    if (compact) {
      const switchNode = segmented({
        options: categories.map((key) => ({ label: labelOf(key), value: key, pressed: key === activeCategory, attrs: { id: `shop-cat-${key}`, role: 'tab', 'aria-controls': 'shop-pane', dataset: { shopCategory: key } } })),
        attrs: { class: 'shop-switch', role: 'tablist', 'aria-label': t('blacksmith.rail.aria') },
      });
      railItems = [...switchNode.querySelectorAll('button')];
      for (const item of railItems) item.addEventListener('click', () => { activeCategory = item.dataset.shopCategory; paint(); });
      root.dataset.shopRail = 'top';
      railed.prepend(switchNode);
    } else {
      railItems = categories.map((key) => {
        const item = railItem({
          label: labelOf(key), member: key, current: key === activeCategory, id: `shop-cat-${key}`,
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
    }
    root.classList.toggle('blacksmith-compact', compact);
    const leave = button({ label: t('blacksmith.leave'), role: 'exit', id: 'leave-shop' });
    leave.addEventListener('click', onLeave);
    const footHost = el('div', { class: 'shop-foot-host' });
    footHost.append(modalFooter({ secondary: [leave], primary: null, className: 'shop-foot' }));
    frame.appendChild(footHost);

    function paint() {
      for (const item of railItems) {
        const on = item.dataset.shopCategory === activeCategory;
        item.classList.toggle('on', on);
        if (compact) item.setAttribute('aria-pressed', on ? 'true' : 'false');
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
