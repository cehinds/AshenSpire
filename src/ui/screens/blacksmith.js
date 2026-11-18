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
// stone purse. Only Core ships, so this is the Core Blacksmith: the legacy
// refine, sigil, stack, extract and install services went with the legacy shops.
import { servicePortrait } from '../components/servicePortrait.js';
import { engravedIconHtml, engravedGlyphId } from '../components/engravedIcon.js';
import { sfx } from '../sfx.js';
import { ModalHead, ModalFooter } from '../components/modalShell.js';
import { button, statusText, el, segmented } from '../kit/index.js';
import { t } from '../strings.js';
import { MarkSelected } from '../selection.js';
import { snapshotRunForDiff } from '../../model/runChangeReceipt.js';
import { showRunReceipt } from '../components/whatChangedModal.js';
import { runHudHtml, wireRunHud } from '../components/runHud.js';
import { smithSelectionModel } from '../models/SmithSelectionModel.js';
import { mountSmithUpgradeModal } from '../components/smithUpgradeModal.js';
import { MountCardUpgradeModal } from '../components/cardUpgradeModal.js';
import { cardUpgradeModel } from '../models/CardUpgradeModel.js';
import { wireShopLayout } from './shop.js';
import { arrangeMerchantOffer } from '../components/merchantOffer.js';
import { renderCard } from '../components/card.js';
import { renderEquipmentCard } from '../components/equipmentCard.js';
import { shopStockOfferings } from '../../model/shopKinds.js';
import { smithingPlan } from '../../model/smithing.js';
import { coreSmithingActive } from '../../model/smithingCore.js';
import { OpenSmithOptionsModal, OpenSmithKeepModal } from '../components/smithOptionsModal.js';
import { KeepableProperties, KeepLimit, CategoryChoices } from '../../model/smithCategory.js';
import { blacksmithStoneDiscount } from '../../model/blacksmithConfig.js';
import { coreArmamentPlan, commitCoreArmament, coreWeaponArtPlan, commitCoreWeaponArt } from '../../model/blacksmithStock.js';
import { BLACKSMITH_SERVICES, serviceCandidates, serviceIdleReason, rankUpCards, rankUpPlan, commitRankUp, upgradeArtPlan, commitUpgradeArt, blacksmithWithholds, plural, blacksmithUpgradePlan, commitBlacksmithUpgrade, CanChangeCategory, CategoryChangePlan, CommitCategoryChange, ItemRankUpPlan, CommitItemRankUp } from '../../model/blacksmith.js';

const GLYPH = Object.freeze({ armaments: 'attack', upgrade: 'smith', upgradeArt: 'vulnerable', rankUp: 'skill', weaponArts: 'attack' });

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
      return false; // a refused commit: a list modal that asked does not reopen over the refusal (modalReturn.js)
    }
    sfx.play('shrine');
    onChanged();
    render();
    // The what-changed receipt (SPEC §14.4): after the redraw, so the page lock covers the new screen. Refusals
    // above keep the inline .bs-refusal and open nothing.
    showRunReceipt({ run, registries, before, title: t('whatChanged.blacksmith') });
    return true;
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
      // No reason to print means no reason line (the shelf's idle line already says why); the lock is applied below.
      avail: { available: available || !reason, reason: reason || null },
      action: first ? { kind: first.kind, label: first.label, enabled: first.ok } : null,
    }, { fallback: 'smith' });
    host.classList.toggle('locked', !available);
    if (control) {
      if (first.id) control.id = first.id;
      if (first.serviceId) control.dataset.smithService = first.serviceId;
      if (first.ok) control.addEventListener('click', first.run);
      if (!first.ok && first.reason) control.title = first.reason;
    }
    // A disabled action beside an affordable one still says why, in the row, not only as a tooltip.
    if (available && first && !first.ok && first.reason) host.querySelector('.merchant-offer-details').append(statusText(first.reason, { class: 'shop-offer-avail' }));
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

  const BUY_SHELVES = {
    armaments: {
      planOf: (itemId) => coreArmamentPlan(registries, run, itemId),
      isStocked: (plan) => Boolean(plan.def),
      describe: (plan) => t('blacksmith.armament.tierOnly', { tier: plan.tier }),
      visualOf: (itemId) => equipmentVisual(itemId),
      decorate: (host, plan) => {
        host.dataset.armamentTier = String(plan.tier);
      },
      purchase: (plan) => onArmamentPurchased(commitCoreArmament(registries, run, plan).id),
    },
    weaponArts: {
      planOf: (itemId) => coreWeaponArtPlan(registries, run, itemId),
      isStocked: (plan) => Boolean(plan.name),
      describe: () => t('blacksmith.weaponArt.desc'),
      visualOf: (itemId) => cardVisual(itemId),
      decorate: () => {},
      purchase: (plan) => {
        const receipt = commitCoreWeaponArt(registries, run, plan);
        onCardPurchased({ kind: 'weaponArts', id: receipt.id, instanceId: receipt.instanceId });
      },
    },
  };

  const renderBuyShelf = (shelfKind, shelf) => {
    const buyShelf = BUY_SHELVES[shelfKind];
    for (const item of stock[shelfKind] || []) {
      const plan = buyShelf.planOf(item.id);
      if (!buyShelf.isStocked(plan)) continue;
      const host = tile(
        GLYPH[shelfKind],
        plan.name,
        buyShelf.describe(plan),
        '',
        { visual: buyShelf.visualOf(item.id) },
      );
      buyShelf.decorate(host, plan);
      actionButton(host, {
        label: t('blacksmith.action.buy'),
        kind: 'buy',
        cost: plan.cost,
        plan,
        commit: () => buyShelf.purchase(plan),
      });
      shelf.append(host);
    }
  };

  // ---- each offering's shelf ------------------------------------------------
  const SHELVES = {
    armaments: (shelf) => renderBuyShelf('armaments', shelf),
    weaponArts: (shelf) => renderBuyShelf('weaponArts', shelf),
    rankUp(shelf) {
      for (const card of rankUpCards(registries, run)) {
        const plan = rankUpPlan(registries, run, card.instanceId, { priceMult });
        const host = tile(GLYPH.rankUp, plan.name, t('blacksmith.rankUp.desc', { from: plan.from, to: plan.to }), '', { visual: cardVisual(card) });
        actionButton(host, { label: t('blacksmith.action.rankUp'), price: priceLine({ stones: plan.stones, cinders: plan.cost }), plan, commit: () => commitRankUp(registries, run, plan, { priceMult }) });
        shelf.append(host);
      }
    },
    upgrade(shelf) {
      if (coreSmithingActive(run)) {
        // Core 2: every owned weapon, shield, armour and relic with a slot left. The action opens its rolled options.
        for (const candidate of serviceCandidates(registries, run, 'upgrade')) {
          const plan = blacksmithUpgradePlan(registries, run, candidate.itemRef, { purse: 'stones', priceMult });
          const held = KeepableProperties(run, candidate.itemRef).map((row) => row.text);
          const host = tile(GLYPH.upgrade, candidate.itemName, [t('blacksmith.upgrade.slotLine', { n: candidate.nextLevel, max: candidate.slots }), ...(held.length ? [held.join(', ')] : [])].join(' · '), '', { visual: equipmentVisual(candidate.itemId) });
          host.dataset.itemRef = candidate.itemRef;
          const action = addAction(host, { label: t('blacksmith.verb.upgrade'), kind: 'service', ok: !!plan.ok, reason: plan.reason, price: priceLine({ stones: plan.stones, cinders: plan.cost }) });
          action.run = (event) => openItemOptions(plan, event.currentTarget, host);
          // A weapon can also be reforged into another category (W25 step 5): the same Smith row, a second action.
          if (CanChangeCategory(registries, run, candidate.itemRef)) {
            const change = CategoryChangePlan(registries, run, candidate.itemRef, CategoryChoices(run, candidate.itemRef)[0], KeepableProperties(run, candidate.itemRef).slice(0, 1).map((row) => row.key), { priceMult });
            const second = addAction(host, { label: t('blacksmith.category.action'), kind: 'service', ok: change.ok || change.code === 'category', reason: change.ok ? '' : change.reason, price: priceLine({ stones: change.stones, cinders: change.cinders }) });
            second.run = (event) => openCategoryChange(candidate, event.currentTarget, host);
          }
          const rank = ItemRankUpPlan(registries, run, candidate.itemRef, { priceMult });
          const third = addAction(host, { label: t('blacksmith.itemRank.action'), kind: 'service', ok: rank.ok, reason: rank.reason, price: priceLine({ stones: rank.stones, cinders: rank.cost }) });
          third.run = () => act(host, () => CommitItemRankUp(registries, run, rank, { priceMult }));
          shelf.append(host);
        }
        return;
      }
      // An item with no name of its own is a raw id; the screen never shows one.
      for (const candidate of smithingPlan(registries, run, undefined, { stoneDiscount }).candidates.filter((row) => row.itemName)) {
        const host = tile(GLYPH.upgrade, candidate.itemName, t('blacksmith.upgrade.line', { from: candidate.currentLevel, to: candidate.nextLevel }), '', { visual: equipmentVisual(candidate.itemId) });
        // The stone purse opens the smith's own upgrade modal (SmithSelectionModel),
        // whose confirm commits the blacksmith's quote.
        const stonesPlan = blacksmithUpgradePlan(registries, run, candidate.itemRef, { purse: 'stones', priceMult });
        const stoneAction = addAction(host, { label: t('blacksmith.verb.upgrade'), kind: 'service', ok: !!stonesPlan.ok, reason: stonesPlan.reason, price: priceLine({ stones: candidate.cost, cinders: stonesPlan.cost }) });
        stoneAction.run = (event) => openUpgradeModal(candidate.itemRef, event.currentTarget);
        shelf.append(host);
      }
    },
    upgradeArt(shelf) {
      // One tile opens the card picker; any deck card, as many upgrades as the purse pays for.
      const host = tile(GLYPH.upgradeArt, t('blacksmith.cardUpgrade.title'), t('blacksmith.cardUpgrade.desc'));
      const ready = readyCount('upgradeArt') > 0;
      addAction(host, { id: 'blacksmith-upgrade-card', label: t('blacksmith.cardUpgrade.open'), kind: 'service', ok: ready, reason: '', price: '', run: (event) => openCardUpgradeModal(event.currentTarget, host) });
      shelf.append(host);
    },
  };

  // Core 2 item upgrade: the player picks one of the rolled options; the quote is the plan the modal showed.
  function openItemOptions(plan, opener, host) {
    OpenSmithOptionsModal({
      title: t('blacksmith.options.title', { name: plan.name }),
      eyebrow: t('blacksmith.upgrade.slotLine', { n: plan.n, max: plan.smith.slots }),
      price: t('blacksmith.options.price', { stones: plan.stones, plural: plural(plan.stones), cinders: plan.cost }),
      options: plan.options.map((option) => ({ id: option.id, name: option.text, text: '' })),
      opener,
      onChoose: (optionId) => act(host, () => commitBlacksmithUpgrade(registries, run, { ...plan, optionId }, { priceMult })),
    });
  }

  // Core 2 category change: pick the new category, then the old properties to keep (the new ones roll live from that choice).
  function openCategoryChange(candidate, opener, host) {
    const base = CategoryChangePlan(registries, run, candidate.itemRef, CategoryChoices(run, candidate.itemRef)[0], [], { priceMult });
    OpenSmithOptionsModal({
      title: t('blacksmith.category.title', { name: candidate.itemName }),
      price: t('blacksmith.category.price', { stones: base.stones, plural: plural(base.stones), cinders: base.cinders }),
      options: CategoryChoices(run, candidate.itemRef).map((category) => ({ id: category, name: category.charAt(0).toUpperCase() + category.slice(1), text: '' })),
      opener,
      onChoose: (category) => OpenSmithKeepModal({
        title: t('blacksmith.category.keepTitle', { name: candidate.itemName, category }),
        price: t('blacksmith.category.price', { stones: base.stones, plural: plural(base.stones), cinders: base.cinders }),
        rows: KeepableProperties(run, candidate.itemRef), limit: KeepLimit(run, candidate.itemRef),
        quoteFor: (keys) => CategoryChangePlan(registries, run, candidate.itemRef, category, keys, { priceMult }),
        opener,
        onConfirm: (keys) => act(host, () => CommitCategoryChange(registries, run, CategoryChangePlan(registries, run, candidate.itemRef, category, keys, { priceMult }), { priceMult })),
      }),
    });
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
        purseLabel: `${base.properties.purseLabel} · ${t('blacksmith.modal.cinders', { cinders: run.cinders })}`,
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

  function openCardUpgradeModal(returnFocusElement, host, focusInstanceId = null) {
    let selection = null;
    // The rows are priced as the Blacksmith charges (cinders, no stones), not as a rest site does.
    const quote = (instanceId) => { const p = upgradeArtPlan(registries, run, instanceId, { priceMult }); return { ok: p.ok, cost: p.stones, reason: p.reason, cinders: p.cost }; };
    const model = () => cardUpgradeModel(registries, run, selection, { quote, blacksmith: true });
    const modal = MountCardUpgradeModal(app, model(), {
      registries, meta, returnFocusElement, focusInstanceId,
      // A confirmed upgrade lands back on this list, refreshed (modalReturn.js); Back names the Blacksmith, not the Shrine.
      parent: { place: t('common.place.blacksmith'), reopen: (focus) => {
        const control = app.querySelector('#blacksmith-upgrade-card');
        if (control && !control.disabled) openCardUpgradeModal(control, control.parentNode, focus);
      } },
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
    // Core has no refining, so its purse never names refined stones.
    const purse = t('blacksmith.purse.core', { stones: stonesHeld, plural: plural(stonesHeld), cinders: run.cinders });
    frame.prepend(ModalHead({ title: t('blacksmith.title'), closeLabel: t('blacksmith.leave'), onClose: onLeave, showMenuButton: false, extras: statusText(purse, { class: 'modal-head-status' }) }));

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
    // Core's five-way switch is narrow on a phone, so its tabs wear the one-word `blacksmith.tab.*` labels, in a
    // compact switch at the top of the pane (like the card upgrade picker's own controls) instead of a rail.
    const labelOf = (key) => t(`blacksmith.tab.${key}`);
    const switchNode = segmented({
      options: categories.map((key) => ({ label: labelOf(key), value: key, pressed: key === activeCategory, attrs: { id: `shop-cat-${key}`, role: 'tab', 'aria-controls': 'shop-pane', dataset: { shopCategory: key } } })),
      attrs: { class: 'shop-switch', role: 'tablist', 'aria-label': t('blacksmith.rail.aria') },
    });
    const railItems = [...switchNode.querySelectorAll('button')];
    for (const item of railItems) {
      item.removeAttribute('aria-pressed');
      item.addEventListener('click', () => { activeCategory = item.dataset.shopCategory; paint(); });
    }
    root.dataset.shopRail = 'top';
    railed.prepend(switchNode);
    root.classList.add('blacksmith-compact');
    const leave = button({ label: t('blacksmith.leave'), role: 'exit', id: 'leave-shop' });
    leave.addEventListener('click', onLeave);
    const footHost = el('div', { class: 'shop-foot-host' });
    footHost.append(ModalFooter({ secondary: [leave], primary: null, className: 'shop-foot' }));
    frame.appendChild(footHost);

    function paint() {
      MarkSelected(railItems, item => item.dataset.shopCategory === activeCategory, { className: 'on', ariaAttribute: 'aria-selected', ariaCurrent: 'true' });
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
