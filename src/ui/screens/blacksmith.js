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
import { runHudHtml, wireRunHud, RefreshRunHud, RunHudRefreshSignature } from '../components/runHud.js';
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
import { beatArmer } from '../../framework/optionDecision.js';
import { purchaseReview, ShopPurchaseKind, SmithRankReview } from '../models/ConfirmationReviewModel.js';
import { BLACKSMITH_SERVICES, serviceCandidates, serviceIdleReason, rankUpCards, rankUpPlan, commitRankUp, upgradeArtPlan, commitUpgradeArt, blacksmithWithholds, plural, blacksmithUpgradePlan, commitBlacksmithUpgrade, CanChangeCategory, CategoryChangePlan, CommitCategoryChange, ItemRankUpPlan, CommitItemRankUp } from '../../model/blacksmith.js';
import { SmithPickChangeText } from '../../model/smithUpgrade.js';

const GLYPH = Object.freeze({ armaments: 'attack', upgrade: 'smith', upgradeArt: 'vulnerable', rankUp: 'skill', weaponArts: 'attack' });

export function mountBlacksmith(app, { registries, run, meta, onLeave, onChanged = () => {}, onArmamentPurchased = () => {}, onCardPurchased = () => {}, priceMult = 1, hud = null }) {
  const stock = run.shopStock;
  const stoneDiscount = blacksmithStoneDiscount(run);
  let activeCategory = null;
  let layout = null;
  // The frame is drawn once; each refresh rebuilds the rows' descriptions and swaps in only the rows that changed,
  // so the shelf, its scroll position and the focused control stay mounted between purchases.
  let root = null;
  let frame;
  let railed;
  let paneHead;
  let purse;
  let switchNode = null;
  let railItems = [];
  let categorySignature = '';
  let hudMarkup = '';
  const shelves = new Map();
  const rows = new Map();
  // Every purchase asks first (owner, 2026-11-19): a row whose action spends on one click (buy, rank up) is armed
  // through the shared review (secondbeat 'smithBuy'); the services that open their own modal confirm there.
  const arm = beatArmer(meta, registries);
  // A retained row's action object takes each refresh's fresh plan (syncShelf), so the listener reads `action.run`
  // at the click, never the function the row was first built with.
  function wireAction(control, action) {
    if (!action.review) { control.addEventListener('click', (event) => action.run(event)); return; }
    const review = () => action.review();
    arm(control, 'smithBuy', {
      question: () => review().question, target: () => review().target, message: () => review().message,
      confirmLabel: review().confirmLabel, policyAction: 'action.purchase', onConfirm: () => action.run(),
    });
  }

  function refuse(host, error) {
    // The refusal reads inside the row's details column, as the merchant's own unaffordable reason does.
    const row = host.closest?.('.merchant-offer') || host;
    row.querySelector('.bs-refusal')?.remove();
    (row.querySelector('.merchant-offer-details') || row).append(statusText(error.message, { class: 'shop-offer-avail bs-refusal', role: 'status' }));
  }

  // One action: commit, sound, persist, redraw — or show the refusal in place.
  function act(tile, commit) {
    // A retained row's fresh descriptor was built on a detached node; the refusal and focus belong to the live one.
    tile = tile._liveHost || tile;
    tile = tile.closest?.('.merchant-offer') || tile;
    const focusKey = tile.dataset.smithKey;
    const actionIndex = Math.max(0, [...tile.querySelectorAll('.merchant-offer-action')].indexOf(document.activeElement));
    const before = snapshotRunForDiff(run);
    try { commit(); }
    catch (error) {
      refuse(tile, error);
      return false; // a refused commit: a list modal that asked does not reopen over the refusal (modalReturn.js)
    }
    sfx.play('shrine');
    onChanged();
    render({ focusKey, actionIndex });
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
  function actionButton(host, { id, label, plan, commit, kind = 'service', cost = null, price = null, review = null }) {
    return addAction(host, { id: id || '', label, kind, ok: !!plan.ok, reason: plan.reason, price: price ?? (cost == null ? '' : t('shop.price', { cost })), run: () => act(host, commit), review });
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
      if (first.ok) wireAction(control, first);
      if (!first.ok && first.reason) control.title = first.reason;
    }
    // A disabled action beside an affordable one still says why, in the row, not only as a tooltip.
    if (available && first && !first.ok && first.reason) host.querySelector('.merchant-offer-details').append(statusText(first.reason, { class: 'shop-offer-avail' }));
    const actions = host.querySelector('.merchant-offer-actions');
    for (const action of rest) {
      const extra = button({ label: action.label, className: 'merchant-offer-action', disabled: !action.ok, attrs: action.ok ? {} : { title: action.reason } });
      extra.dataset.shopAction = action.kind;
      extra.addEventListener('click', (event) => event.stopPropagation());
      if (action.ok) wireAction(extra, action);
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
      purchase: (plan) => onArmamentPurchased(commitCoreArmament(registries, run, plan).id, render),
    },
    weaponArts: {
      planOf: (itemId) => coreWeaponArtPlan(registries, run, itemId),
      isStocked: (plan) => Boolean(plan.name),
      describe: () => t('blacksmith.weaponArt.desc'),
      visualOf: (itemId) => cardVisual(itemId),
      decorate: () => {},
      purchase: (plan) => {
        const receipt = commitCoreWeaponArt(registries, run, plan);
        onCardPurchased({ kind: 'weaponArts', id: receipt.id, instanceId: receipt.instanceId }, render);
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
      host.dataset.smithKey = `${shelfKind}:${item.id}`;
      buyShelf.decorate(host, plan);
      actionButton(host, {
        label: t('blacksmith.action.buy'),
        kind: 'buy',
        cost: plan.cost,
        plan,
        commit: () => buyShelf.purchase(plan),
        review: () => purchaseReview({ kind: ShopPurchaseKind(shelfKind), name: plan.name, cost: plan.cost, cinders: run.cinders }),
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
        host.dataset.smithKey = `rankUp:${card.instanceId}`;
        const price = priceLine({ stones: plan.stones, cinders: plan.cost });
        actionButton(host, { label: t('blacksmith.action.rankUp'), price, plan, commit: () => commitRankUp(registries, run, plan, { priceMult }),
          review: () => SmithRankReview({ kind: 'card', name: plan.name, price, stones: run.smithingStones || 0, cinders: run.cinders }) });
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
          host.dataset.smithKey = `upgrade:${candidate.itemRef}`;
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
          third.review = () => SmithRankReview({ kind: 'item', name: candidate.itemName, price: third.price, stones: run.smithingStones || 0, cinders: run.cinders });
          shelf.append(host);
        }
        return;
      }
      // An item with no name of its own is a raw id; the screen never shows one.
      for (const candidate of smithingPlan(registries, run, undefined, { stoneDiscount }).candidates.filter((row) => row.itemName)) {
        const host = tile(GLYPH.upgrade, candidate.itemName, t('blacksmith.upgrade.line', { from: candidate.currentLevel, to: candidate.nextLevel }), '', { visual: equipmentVisual(candidate.itemId) });
        host.dataset.smithKey = `upgrade:${candidate.itemRef}`;
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
      host.dataset.smithKey = 'upgradeArt';
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
      // Each option names its change on the item (owner, 2026-11-20): "STR +1 → +2", or the property it adds.
      options: plan.options.map((option) => ({ id: option.id, name: option.text, text: SmithPickChangeText(run, plan.itemRef, option) })),
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

  const HUD_OPTIONS = { place: 'shop', headerClass: 'map-header room-header workspace-hud' };
  function mountFrame() {
    const markup = hud ? runHudHtml({ registries, run, meta, ...HUD_OPTIONS }) : '';
    hudMarkup = hud ? RunHudRefreshSignature({ registries, run, meta, ...HUD_OPTIONS }) : '';
    app.innerHTML = `${markup}
      <div class="screen room-screen shop-workspace merchant-workspace blacksmith-workspace" data-wireframe="W1d" data-shop-kind="blacksmith">
        <div class="shop-frame">
          <div class="as-railed shop-railed">
            <div class="as-pane shop-pane" data-wireframe="W1v" id="shop-pane">
              <div class="as-pane-head shop-pane-head"></div>
              <div class="shop-body"><div class="shop-offers"></div></div>
            </div>
          </div>
        </div>
      </div>`;
    if (hud) wireRunHud(app, { ...hud, registries, run, meta, remount: render });
    root = app.querySelector('.shop-workspace');
    root.prepend(servicePortrait('smith'));
    frame = root.querySelector('.shop-frame');
    railed = root.querySelector('.shop-railed');
    paneHead = root.querySelector('.shop-pane-head');
    // Core has no refining, so its purse never names refined stones; render() writes its text.
    purse = statusText('', { class: 'modal-head-status' });
    frame.prepend(ModalHead({ title: t('blacksmith.title'), closeLabel: t('blacksmith.leave'), onClose: onLeave, showMenuButton: false, extras: purse }));
    const leave = button({ label: t('blacksmith.leave'), role: 'exit', id: 'leave-shop' });
    leave.addEventListener('click', onLeave);
    const footHost = el('div', { class: 'shop-foot-host' });
    footHost.append(ModalFooter({ secondary: [leave], primary: null, className: 'shop-foot' }));
    frame.appendChild(footHost);
    root.dataset.shopRail = 'top';
    root.classList.add('blacksmith-compact');
    layout = wireShopLayout(root);
  }

  function statusOf(key) {
    const n = readyCount(key);
    return n ? t('blacksmith.status.ready', { count: n }) : t('blacksmith.status.idle');
  }

  function paint() {
    MarkSelected(railItems, item => item.dataset.shopCategory === activeCategory, { className: 'on', ariaAttribute: 'aria-selected', ariaCurrent: 'true' });
    for (const [key, shelf] of shelves) shelf.hidden = key !== activeCategory;
    if (activeCategory) {
      root.querySelector('.shop-pane').setAttribute('aria-labelledby', `shop-cat-${activeCategory}`);
      const text = statusOf(activeCategory);
      if (paneHead.firstChild?.textContent !== text) paneHead.replaceChildren(statusText(text, { class: 'shop-pane-status', role: 'status' }));
    }
  }

  // Core's five-way switch is narrow on a phone, so its tabs wear the one-word `blacksmith.tab.*` labels, in a
  // compact switch at the top of the pane (like the card upgrade picker's own controls) instead of a rail.
  // It is rebuilt only when the offered categories change.
  function syncSwitch(categories) {
    const signature = JSON.stringify(categories);
    if (signature === categorySignature) return;
    categorySignature = signature;
    const next = segmented({
      options: categories.map((key) => ({ label: t(`blacksmith.tab.${key}`), value: key, pressed: key === activeCategory, attrs: { id: `shop-cat-${key}`, role: 'tab', 'aria-controls': 'shop-pane', dataset: { shopCategory: key } } })),
      attrs: { class: 'shop-switch', role: 'tablist', 'aria-label': t('blacksmith.rail.aria') },
    });
    railItems = [...next.querySelectorAll('button')];
    for (const item of railItems) {
      item.removeAttribute('aria-pressed');
      item.addEventListener('click', () => { activeCategory = item.dataset.shopCategory; paint(); });
    }
    if (switchNode) switchNode.replaceWith(next); else railed.prepend(next);
    switchNode = next;
  }

  // What a row shows. Builders hand fresh plans every refresh; a row whose presentation is unchanged keeps its node
  // and takes the fresh descriptor, so its controls run the current quote.
  function rowSignature(host) {
    const row = host._row;
    return JSON.stringify([row.name, row.desc, row.reason, row.price, { ...host.dataset },
      row.actions.map(({ run: _run, review: _review, ...action }) => action)]);
  }

  function syncShelf(key, port) {
    let shelf = shelves.get(key);
    if (!shelf) {
      shelf = el('div', { class: 'card-shelf shop-shelf', id: `blacksmith-${key}`, dataset: { shopShelf: key } });
      shelves.set(key, shelf);
      port.append(shelf);
    }
    // A service with nothing to act on now says why, and stays on the rail.
    const idleReason = (BLACKSMITH_SERVICES.includes(key) || key === 'rankUp') && !readyCount(key) ? serviceIdleReason(key, run) : '';
    let idle = [...shelf.children].find(node => node.classList.contains('bs-idle')) || null;
    if (!idleReason) { idle?.remove(); idle = null; }
    else if (idle) { if (idle.textContent !== idleReason) idle.textContent = idleReason; }
    else { idle = statusText(idleReason, { class: 'shop-offer-avail bs-idle', role: 'status' }); shelf.prepend(idle); }
    const candidates = el('div');
    SHELVES[key](candidates);
    const seen = [];
    let index = idle ? 1 : 0;
    for (const fresh of [...candidates.children]) {
      const id = fresh.dataset.smithKey;
      seen.push(id);
      const signature = rowSignature(fresh);
      const previous = rows.get(id);
      let host;
      if (previous?.signature === signature) {
        host = previous.host;
        // The retained controls hold their action objects: refresh those in place with the fresh quotes.
        host._row.actions.forEach((action, at) => Object.assign(action, fresh._row.actions[at]));
        host._row = { ...fresh._row, actions: host._row.actions };
        fresh._liveHost = host;
      } else {
        finishRow(fresh);
        host = fresh;
        if (previous) previous.host.replaceWith(host);
        rows.set(id, { host, signature });
      }
      const at = shelf.children[index++];
      if (at !== host) shelf.insertBefore(host, at || null);
    }
    return seen;
  }

  // Focus returns to the control the player pressed, or to its row's nearest surviving neighbour.
  function restoreFocus(focusKey, actionIndex, previousKeys) {
    if (!focusKey || document.querySelector('.modal-veil:not(.confirmation-input-shield)')) return;
    const surviving = [...rows.values()].map(row => row.host).filter(host => host.closest('[data-shop-shelf]')?.dataset.shopShelf === activeCategory);
    const neighbour = surviving.find(host => previousKeys.indexOf(host.dataset.smithKey) >= previousKeys.indexOf(focusKey)) || surviving.at(-1);
    const host = rows.get(focusKey)?.host || neighbour;
    const controls = host ? [...host.querySelectorAll('.merchant-offer-action')].filter(control => !control.disabled) : [];
    const target = controls[Math.min(actionIndex, controls.length - 1)] || host || switchNode?.querySelector(`[data-shop-category="${activeCategory}"]`);
    target?.focus?.({ preventScroll: true });
  }

  function render({ focusKey = null, actionIndex = 0 } = {}) {
    // A refresh that lands after the player left must not draw over the next screen.
    if (root && !root.isConnected) return;
    if (!root) mountFrame();
    const categories = shopStockOfferings(stock).filter((key) => SHELVES[key] && !blacksmithWithholds(run, key));
    if (!categories.includes(activeCategory)) activeCategory = categories[0] || null;
    const focusedRow = document.activeElement?.closest?.('[data-smith-key]');
    if (focusedRow) {
      focusKey ||= focusedRow.dataset.smithKey;
      actionIndex = Math.max(0, [...focusedRow.querySelectorAll('.merchant-offer-action')].indexOf(document.activeElement));
    }
    const previousKeys = [...rows.keys()];
    const scroll = [root, frame, ...root.querySelectorAll('.shop-pane, .shop-body, .shop-offers'), ...shelves.values()]
      .map(node => [node, node.scrollTop, node.scrollLeft]);
    syncSwitch(categories);
    const port = root.querySelector('.shop-offers');
    const seen = new Set(categories.flatMap(key => syncShelf(key, port)));
    for (const [id, row] of rows) if (!seen.has(id)) { row.host.remove(); rows.delete(id); }
    for (const [key, shelf] of shelves) if (!categories.includes(key)) { shelf.remove(); shelves.delete(key); }
    const stonesHeld = run.smithingStones || 0;
    purse.textContent = t('blacksmith.purse.core', { stones: stonesHeld, plural: plural(stonesHeld), cinders: run.cinders });
    if (hud) {
      const next = RunHudRefreshSignature({ registries, run, meta, ...HUD_OPTIONS });
      if (next !== hudMarkup) {
        hudMarkup = next;
        RefreshRunHud(app, { registries, run, meta, ...HUD_OPTIONS, hud, remount: render });
      }
    }
    paint();
    layout.apply();
    restoreFocus(focusKey, actionIndex, previousKeys);
    for (const [node, top, left] of scroll) if (node.isConnected) { node.scrollTop = top; node.scrollLeft = left; }
  }

  render();
  return { render, refresh: render };
}
