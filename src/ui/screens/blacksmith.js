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
import { snapshotRunForDiff } from '../../model/runChangeReceipt.js';
import { showRunReceipt } from '../components/whatChangedModal.js';
import { runHudHtml, wireRunHud } from '../components/runHud.js';
import { smithSelectionModel } from '../models/SmithSelectionModel.js';
import { mountSmithUpgradeModal } from '../components/smithUpgradeModal.js';
import { mountCardUpgradeModal } from '../components/cardUpgradeModal.js';
import { cardUpgradeModel } from '../models/CardUpgradeModel.js';
import { openMountService } from './smithServices.js';
import { wireShopLayout } from './shop.js';
import { arrangeMerchantOffer } from '../components/merchantOffer.js';
import { renderCard } from '../components/card.js';
import { renderEquipmentCard } from '../components/equipmentCard.js';
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

export function mountBlacksmith(app, { registries, run, meta, onLeave, onChanged = () => {}, onArmamentPurchased = () => {}, onCardPurchased = () => {}, priceMult = 1, hud = null }) {
  const stock = run.shopStock;
  const stoneDiscount = blacksmithStoneDiscount(run);
  let activeCategory = null;
  let layout = null;

  function refuse(host, error) {
    // The refusal reads inside the row's details column, as the merchant's own unaffordable reason does.
    const row = host.closest?.('.merchant-offer') || host;
    row.querySelector('.bs-refusal')?.remove();
    (row.querySelector('.merchant-offer-details') || row).append(statusText(error.message, { class: 'shop-offer-avail bs-refusal', role: 'status' }));
  }

  // One action: commit, sound, persist, redraw — or show the refusal in place.
  function act(tile, commit) {
    const before = snapshotRunForDiff(run);
    try { commit(); }
    catch (error) {
      refuse(tile, error);
      return;
    }
    sfx.play('shrine');
    onChanged();
    render();
    // The what-changed receipt (SPEC §14.4): after the redraw, so the page lock covers the new screen. Refusals
    // above keep the inline .bs-refusal and open nothing.
    showRunReceipt({ run, registries, before, title: t('whatChanged.blacksmith') });
  }

  // Every offer is one merchant row (components/merchantOffer.js, the shop's own markup and CSS): art, name and
  // description, the action beside the price. A shelf builder describes the row with tile() and actionButton();
  // finishRow() lays it out once the shelf is filled, so the Blacksmith and the Merchant cannot drift apart.
  const shopCardOptions = Object.freeze({ level: 'glance', infoBadge: true, surface: 'shop', only: [] });
  function cardVisual(card) {
    const ref = typeof card === 'string' ? { cardId: card, instanceId: `smith:${card}`, upgraded: false } : card;
    try { return renderCard(registries, ref, shopCardOptions); } catch { return null; }
  }
  function equipmentVisual(id) {
    const def = (registries.equipment.armaments || []).find((row) => row.id === id) || (registries.equipment.armour || []).find((row) => row.id === id);
    if (!def) return null;
    try { return renderEquipmentCard(registries, def, { interactive: false, level: 'glance', surface: 'shop' }).card; } catch { return null; }
  }
  // The price line under a paid action: stones, cinders or both, never in the button's own label.
  function priceLine({ stones = 0, cinders = 0 } = {}) {
    if (stones && cinders) return t('blacksmith.price.stonesCinders', { stones, plural: plural(stones), cinders });
    if (stones) return t('blacksmith.price.stones', { count: stones, plural: plural(stones) });
    return cinders ? t('shop.price', { cost: cinders }) : '';
  }
  function tile(glyph, title, desc, reason = '', { visual = null } = {}) {
    const node = el('div', { class: 'class-pick shop-offer' });
    node.innerHTML = `<div class="glyph">${engravedIconHtml(engravedGlyphId(glyph)) || glyph}</div>`;
    node._row = { name: title, desc: desc || '', visual, reason, price: '', actions: [] };
    return node;
  }
  function addAction(host, action) { host._row.actions.push(action); return action; }
  function actionButton(host, { id, label, plan, commit, kind = 'service', cost = null, price = null }) {
    return addAction(host, { id: id || '', label, kind, ok: !!plan.ok, reason: plan.reason, price: price ?? (cost == null ? '' : t('shop.price', { cost })), run: () => act(host, commit) });
  }
  function finishRow(host) {
    const row = host._row;
    if (!row) return;
    const [first, ...rest] = row.actions;
    const failing = row.actions.filter((a) => !a.ok);
    const available = !row.reason && (!row.actions.length || row.actions.some((a) => a.ok));
    const reason = row.reason || (available ? '' : failing.find((a) => a.reason)?.reason || '');
    const control = arrangeMerchantOffer({
      tile: host, name: row.name, desc: row.desc, visual: row.visual || undefined, price: first?.price || row.price,
      avail: { available, reason: reason || null },
      action: first ? { kind: first.kind, label: first.label, enabled: first.ok } : null,
    }, { fallback: 'smith' });
    host.classList.toggle('locked', !available);
    if (control) {
      if (first.id) control.id = first.id;
      if (first.serviceId) control.dataset.smithService = first.serviceId;
      if (first.ok) control.addEventListener('click', first.run);
      if (!first.ok && first.reason) control.title = first.reason;
    }
    const actions = host.querySelector('.merchant-offer-actions');
    for (const action of rest) {
      const extra = button({ label: action.label, className: 'merchant-offer-action', disabled: !action.ok, attrs: action.ok ? {} : { title: action.reason } });
      extra.dataset.shopAction = action.kind;
      extra.addEventListener('click', (event) => event.stopPropagation());
      if (action.ok) extra.addEventListener('click', action.run);
      actions.append(extra);
      if (action.price) actions.append(statusText(action.price, { class: 'merchant-offer-price' }));
      if (!action.ok && available && action.reason) host.querySelector('.merchant-offer-details').append(statusText(action.reason, { class: 'shop-offer-avail' }));
    }
  }

  // ---- each offering's shelf ------------------------------------------------
  const SHELVES = {
    armaments(shelf) {
      // Core: the rack is tiered (each piece is sold at the tier it shows) and bought with the Core model's quote.
      if (coreCardUpgrades(run)) {
        for (const item of stock.armaments || []) {
          const plan = coreArmamentPlan(registries, run, item.id);
          if (!plan.def) continue;
          const host = tile(GLYPH.armaments, plan.name, t('blacksmith.armament.tierOnly', { tier: plan.tier }), '', { visual: equipmentVisual(item.id) });
          host.dataset.armamentTier = String(plan.tier);
          actionButton(host, { label: t('blacksmith.action.buy'), kind: 'buy', cost: plan.cost, plan, commit: () => onArmamentPurchased(commitCoreArmament(registries, run, plan).id) });
          shelf.append(host);
        }
        return;
      }
      for (const item of stock.armaments || []) {
        const plan = armamentPurchasePlan(registries, run, item);
        if (!plan.def) continue;
        const host = tile(GLYPH.armaments, plan.def.name, plan.def.blurb || '', '', { visual: equipmentVisual(plan.def.id) });
        actionButton(host, { label: t('blacksmith.action.buy'), kind: 'buy', cost: item.cost, plan, commit: () => {
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
        const host = tile(GLYPH.weaponArts, plan.name, t('blacksmith.weaponArt.desc'), '', { visual: cardVisual(item.id) });
        actionButton(host, { label: t('blacksmith.action.buy'), kind: 'buy', cost: plan.cost, plan, commit: () => {
          const receipt = commitCoreWeaponArt(registries, run, plan);
          onCardPurchased({ kind: 'weaponArts', id: receipt.id, instanceId: receipt.instanceId });
        } });
        shelf.append(host);
      }
    },
    rankUp(shelf) {
      for (const card of rankUpCards(registries, run)) {
        const plan = rankUpPlan(registries, run, card.instanceId, { priceMult });
        const host = tile(GLYPH.rankUp, plan.name, t('blacksmith.rankUp.desc', { from: plan.from, to: plan.to }), '', { visual: cardVisual(card) });
        actionButton(host, { label: t('blacksmith.action.rankUp'), price: priceLine({ stones: plan.stones, cinders: plan.cost }), plan, commit: () => commitRankUp(registries, run, plan, { priceMult }) });
        shelf.append(host);
      }
    },
    smithStones(shelf) {
      const offer = stock.smithStones;
      if (!offer) return;
      const plan = smithStonePurchasePlan(registries, run, 1);
      const host = tile(GLYPH.smithStones, t('shop.stones.name'), t('blacksmith.stones.left', { left: offer.left }));
      actionButton(host, { id: 'blacksmith-stone', label: t('blacksmith.action.buy'), kind: 'buy', cost: offer.price, plan, commit: () => commitSmithStonePurchase(registries, run, plan) });
      shelf.append(host);
    },
    upgrade(shelf) {
      // An item with no name of its own is a raw id; the screen never shows one.
      for (const candidate of smithingPlan(registries, run, undefined, { stoneDiscount }).candidates.filter((row) => row.itemName)) {
        const host = tile(GLYPH.upgrade, candidate.itemName, t('blacksmith.upgrade.line', { from: candidate.currentLevel, to: candidate.nextLevel }), '', { visual: equipmentVisual(candidate.itemId) });
        // The stone purse opens the smith's own upgrade modal (SmithSelectionModel),
        // whose confirm commits the blacksmith's quote.
        const stonesPlan = blacksmithUpgradePlan(registries, run, candidate.itemRef, { purse: 'stones', priceMult });
        const stoneAction = addAction(host, { label: t('blacksmith.verb.upgrade'), kind: 'service', ok: !!stonesPlan.ok, reason: stonesPlan.reason, price: priceLine({ stones: candidate.cost, cinders: stonesPlan.cost }) });
        stoneAction.run = (event) => openUpgradeModal(candidate.itemRef, event.currentTarget);
        // Core has no refining, so there is no refined purse to offer.
        if (candidate.refinedCost !== null && !blacksmithWithholds(run, 'refineStones')) {
          const refinedPlan = blacksmithUpgradePlan(registries, run, candidate.itemRef, { purse: 'refined' });
          actionButton(host, { label: t('blacksmith.verb.upgradeRefined'), price: t('blacksmith.price.refined', { cost: candidate.refinedCost }), plan: refinedPlan, commit: () => commitBlacksmithUpgrade(registries, run, refinedPlan, { priceMult }) });
        }
        shelf.append(host);
      }
    },
    refineStones(shelf) {
      const plan = refinePlan(registries, run, { priceMult });
      const host = tile(GLYPH.refineStones, t('blacksmith.refine.title'), t('blacksmith.refine.desc', { from: plan.stones, cost: plan.cost, value: plan.value ?? 0, plural: plural(plan.stones), valuePlural: plural(plan.value ?? 0) }));
      actionButton(host, { id: 'blacksmith-refine', label: t('blacksmith.action.refine'), price: priceLine({ stones: plan.stones, cinders: plan.cost }), plan, commit: () => commitRefine(registries, run, plan, { priceMult }) });
      shelf.append(host);
    },
    sigilSlots(shelf) {
      for (const piece of sigilSlotPieces(registries, run)) {
        const plan = sigilSlotPlan(registries, run, piece.itemRef, { priceMult });
        const host = tile(GLYPH.sigilSlots, piece.name, t('blacksmith.slots.line', { count: piece.slots.length, max: piece.max, plural: plural(piece.max) }));
        actionButton(host, { label: t('blacksmith.verb.cutSlot'), cost: plan.cost, plan, commit: () => commitSigilSlot(registries, run, plan, { priceMult }) });
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
        addAction(host, { id: 'blacksmith-upgrade-card', label: t('blacksmith.cardUpgrade.open'), kind: 'service', ok: ready, reason: '', price: '', run: (event) => openCardUpgradeModal(event.currentTarget, host) });
        shelf.append(host);
        return;
      }
      for (const card of upgradeableArts(registries, run)) {
        const plan = upgradeArtPlan(registries, run, card.instanceId);
        const name = registries.cards.get(card.cardId)?.name || card.cardId;
        const host = tile(GLYPH.upgradeArt, name, t('blacksmith.art.line'), '', { visual: cardVisual(card) });
        actionButton(host, { label: t('blacksmith.verb.upgrade'), price: priceLine({ stones: plan.stones }), plan, commit: () => commitUpgradeArt(registries, run, plan, { priceMult }) });
        shelf.append(host);
      }
    },
    stackCopy(shelf) {
      for (const cardId of stackableCardIds(registries, run, meta?.settings)) {
        const plan = stackCopyPlan(registries, run, cardId, { priceMult, settings: meta?.settings });
        const host = tile(GLYPH.stackCopy, plan.name, t('blacksmith.stack.line', { owned: plan.owned }), '', { visual: cardVisual(cardId) });
        actionButton(host, { label: t('blacksmith.verb.stack'), price: priceLine({ stones: plan.stones, cinders: plan.cost }), plan, commit: () => commitStackCopy(registries, run, plan, { priceMult, settings: meta?.settings }) });
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
    addAction(host, { label: t('blacksmith.action.open'), kind: 'service', ok: ready, reason: '', price: '', serviceId: id, run: (event) => { const control = event.currentTarget; let before; openMountService(app, {
      service, registries, run, meta, returnFocusElement: control, multiUse: true, place: 'merchant',
      quote: (chosen) => (service === 'extract'
        ? blacksmithExtractPlan(registries, run, chosen.itemRef, chosen.mountKey)
        : blacksmithInstallPlan(registries, run, chosen.itemRef, chosen.mountKey, chosen.instanceId)),
      commit: (_chosen, quote) => { before = snapshotRunForDiff(run); return service === 'extract'
        ? commitBlacksmithExtract(registries, run, quote)
        : commitBlacksmithInstall(registries, run, quote); },
      onError: (error) => refuse(host, error),
      // The receipt, as the other purchases show it (SPEC §14.4), after the redraw.
      onCommitted: () => { sfx.play('shrine'); onChanged(); render(); showRunReceipt({ run, registries, before, title: t('whatChanged.blacksmith') }); },
    }); } });
    shelf.append(host);
  }

  function openUpgradeModal(itemRef, returnFocusElement) {
    let selection = itemRef;
    let displayedQuote;
    const model = () => {
      displayedQuote = blacksmithUpgradePlan(registries, run, selection, { purse: 'stones', priceMult });
      const base = smithSelectionModel(registries, smithingPlan(registries, run, undefined, { stoneDiscount }), selection, { multiUse: true, autoSelect: false });
      // The stone-priced model knows nothing of cinders: route the Blacksmith's own quote (its cinder price and whether the
      // purse can pay it) into the per-selection model, so confirm is blocked, with the reason, when cinders are short.
      const blocked = base.properties.selected && !displayedQuote.ok;
      return { ...base, properties: { ...base.properties,
        ...(coreCardUpgrades(run) ? { purseLabel: `${base.properties.purseLabel} · ${t('blacksmith.modal.cinders', { cinders: run.cinders })}` } : {}),
        // The quote's cinder charge for the item selected NOW; the shared modal shows it beside the Stone cost.
        ...(base.properties.selected && displayedQuote.cost ? { cinderCost: displayedQuote.cost, cinderHave: run.cinders } : {}),
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
    const model = () => cardUpgradeModel(registries, run, selection, { quote, blacksmith: true });
    const modal = mountCardUpgradeModal(app, model(), {
      registries, meta, returnFocusElement, backLabel: t('smith.back.shrine'),
      decisionConsequence: t('blacksmith.cardUpgrade.decision'),
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
      <div class="screen room-screen shop-workspace merchant-workspace blacksmith-workspace" data-wireframe="W1d" data-shop-kind="blacksmith">
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
      for (const host of shelf.querySelectorAll(':scope > .shop-offer')) finishRow(host);
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
