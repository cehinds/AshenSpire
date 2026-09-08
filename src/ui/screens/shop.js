import { bindCardInspection } from '../components/cardInspection.js';
// The wandering merchant. Stock is rolled once, saved with the run, and read
// through shared disclosure shelves. Armament inspection uses the Armoury
// card components; transactions revalidate through armamentTrading.js.

import { renderCard } from '../components/card.js';
import { attachTooltip, esc } from '../components/tooltip.js';
import { relicText } from '../components/card.js';
import { sfx } from '../sfx.js';
import { isEngaged, focusFirst } from '../input.js';
import { beatArmer } from '../../framework/optionDecision.js';
import { syncFlaskGrowth } from '../../model/flaskgrowth.js';
import { flaskIdentityHtml } from '../components/flask.js';
import { isEquipmentComposedInstance, carriedIds } from '../../model/loadout.js';
import { armamentPurchasePlan, armamentSalePlan, commitArmamentPurchase, commitArmamentSale } from '../../model/armamentTrading.js';
import { openModal } from '../components/modalShell.js';
import { button, statusText, el } from '../kit/index.js';
import { renderEquipmentCard, renderEquipmentInspection } from '../components/equipmentCard.js';
import { renderCollectibleCard } from '../components/collectibleCard.js';
import { flaskSlotCap } from '../../model/gracerefill.js';
import { mountDisclosure } from '../components/disclosure.js';
import { settingOn } from './settings.js';
import { commitSmithing, smithingPlan } from '../../model/smithing.js';
import { smithSelectionModel } from '../models/SmithSelectionModel.js';
import { mountSmithUpgradeModal } from '../components/smithUpgradeModal.js';
import { mountServiceOffer, openMountService } from './smithServices.js';
import { UI_COMPONENTS as UI, markUiComponent } from '../components/uiComponents.js';

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

export function mountShop(app, { registries, run, meta, onLeave, onChanged, onArmamentPurchased = () => {} }) {
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

  // The open bar OUTLIVES the render — see THE BARS above.
  let fold = null;
  let openBar = 'bar:cards';

  function render() {
    if (fold && fold.openKey) openBar = fold.openKey;
    app.innerHTML = `
      <div class="screen" style="justify-content:flex-start;overflow-y:auto;gap:14px;padding-top:28px">
        <h2>The Wandering Merchant</h2>
        <p class="subtitle">"I've climbed higher than you. I came back. Draw your own conclusions."</p>
        <p class="as-status" style="text-align:center">Cinders <b>${run.cinders}</b> · HP ${run.hp}/${run.maxHp}</p>
        <div class="shop-bars cz-disc">
          <div class="reward-row" id="shop-cards"></div>
          <div class="reward-row" id="shop-armaments"></div>
          <div class="reward-row" id="shop-weapon-arts"></div>
          <div class="class-row" id="shop-relics"></div>
          <div class="class-row" id="shop-flasks"></div>
          <div id="shop-remove">
            <div class="class-row">
              <div class="class-pick${run.cinders >= stock.removeCost && run.deck.length > 1 ? '' : ' locked'}" id="remove-opt">
                <div class="glyph">✂</div><h3>Remove a card</h3><p>${stock.removeCost} cinders. The deck remembers what you cut.</p>
              </div>
            </div>
            <div id="remove-grid" class="deck-strip" style="display:none;max-width:900px"></div>
          </div>
          <div class="class-row" id="shop-sell"></div>
          <div class="class-row" id="shop-smith"></div>
        </div>
        <button id="leave-shop" class="primary">Leave</button>
      </div>`;

    const cardsRow = app.querySelector('#shop-cards');
    stock.cards.forEach((item, i) => {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:6px';
      const el = renderCard(registries, { cardId: item.id, upgraded: false }, { small: true });
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
      if (run.cinders >= item.cost) {
        // ROUTED THROUGH THE MACHINERY EVEN THOUGH IT OWES NO BEAT, and that is
        // the falsifier for Law 0 on this control rather than a formality:
        // change `shopBuy`'s characteristics in model/secondbeat.js — say the
        // day a purse can strand a run — and a purchase starts asking, with
        // ZERO commits outside that table. An action wired with a bare
        // `addEventListener` can only ever be changed by editing this line.
        arm(el, 'shopBuy', {
          hintHost: wrap,
          question: `Buy ${registries.cards.get(item.id).name} for ${item.cost} cinders? You have ${run.cinders}.`,
          confirmLabel: 'BUY IT',
          onConfirm: () => {
            run.cinders -= item.cost;
            run.deck.push({ instanceId: `s${run.deck.length}_${item.id}`, cardId: item.id, upgraded: false });
            stock.cards.splice(i, 1);
            sfx.play('buy');
            onChanged();
            render();
          },
        });
      } else {
        el.classList.add('unaffordable');
      }
      cardsRow.appendChild(wrap);
    });

    const armamentsRow = app.querySelector('#shop-armaments');
    for (const item of stock.armaments || []) {
      const plan = armamentPurchasePlan(registries, run, item);
      if (plan.def) armamentsRow.appendChild(armamentOffer(plan.def, () => inspectArmament(item, 'buy'), plan.ok ? `${plan.cost} cinders` : plan.reason));
    }
    if (!(stock.armaments || []).length) armamentsRow.appendChild(statusText('No armaments for sale on this visit.'));
    const artsRow = app.querySelector('#shop-weapon-arts');
    for (const item of stock.weaponArts || []) {
      const card = renderCard(registries, { cardId: item.id, upgraded: false }, { small: true });
      card.setAttribute('role', 'button');
      card.tabIndex = 0;
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); card.click(); }
      });
      const wrap = el('div', {}, [card, statusText(`${item.cost} cinders · loose card`)]);
      card.addEventListener('click', () => {
        const quote = armamentPurchasePlan(registries, run, item, 'weaponArt');
        const buy = button({ label: `Buy · ${quote.cost} cinders`, weight: 'primary', disabled: !quote.ok });
        const message = statusText(quote.reason || 'Adds a loose card to your deck. A smith can seat it in a compatible open mount.');
        const shell = openModal({ title: quote.def.name, eyebrow: 'Weapon art', bodyClassName: 'as-pane', opener: card, body: (host) => host.append(renderCard(registries, { cardId: item.id, upgraded: false }, { small: true }), message), primary: buy });
        buy.addEventListener('click', () => {
          try { commitArmamentPurchase(registries, run, quote); }
          catch (error) { message.textContent = error.message; buy.disabled = true; return; }
          finishTrade(shell);
        });
      });
      artsRow.appendChild(wrap);
    }
    if (!(stock.weaponArts || []).length) artsRow.appendChild(statusText('No mountable weapon arts for sale on this visit.'));

    const relicsRow = app.querySelector('#shop-relics');
    stock.relics.forEach((item, i) => {
      const def = registries.relics.get(item.id);
      relicsRow.appendChild(shopItem(`${def.icon || '◆'} ${def.name}`, relicText(def, registries), item.cost, run.cinders >= item.cost, () => {
        run.cinders -= item.cost;
        run.relics.push(item.id);
        syncFlaskGrowth(registries, run); // growth chain: a relic source binds the moment it is held
        stock.relics.splice(i, 1);
        sfx.play('buy');
        onChanged();
        render();
      }, { card: renderCollectibleCard(registries, def, 'Relic', { interactive: false }).card }));
    });
    const flasksRow = app.querySelector('#shop-flasks');
    stock.flasks.forEach((item, i) => {
      const def = registries.flasks.get(item.id);
      const can = run.cinders >= item.cost && slotsFree();
      flasksRow.appendChild(shopItem(flaskIdentityHtml(def), slotsFree() ? def.textTemplate : 'Flask slots full.', item.cost, can, () => {
        run.cinders -= item.cost;
        run.flasks.push({ flaskId: item.id });
        stock.flasks.splice(i, 1);
        sfx.play('buy');
        onChanged();
        render();
      }, { titleHtml: true, card: renderCollectibleCard(registries, def, 'Potion', { interactive: false }).card }));
    });

    if (run.cinders >= stock.removeCost && run.deck.length > 1) {
      app.querySelector('#remove-opt').addEventListener('click', () => {
        const grid = app.querySelector('#remove-grid');
        if (grid.style.display !== 'none') return;
        grid.style.display = 'flex';
        grid.style.flexWrap = 'wrap';
        grid.style.gap = '14px';
        grid.style.justifyContent = 'center';
        run.deck.forEach((inst, idx) => {
          // An equipment-COMPOSED instance is one the next authoritative
          // reconcile recreates under the same id — a package output
          // (grantedBy) or a generated attack slot. Offering either would
          // charge cinders for a card that comes straight back.
          if (isEquipmentComposedInstance(inst)) return;
          const el = renderCard(registries, inst, { small: true });
          const def = registries.cards.get(inst.cardId);
          // Same fixed box, same host: the hold hint stands under the card.
          const wrap = document.createElement('div');
          wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:6px';
          wrap.appendChild(el);
          arm(el, 'shopRemove', {
            hintHost: wrap,
            question: `Burn ${def.name} out of the deck? ${stock.removeCost} cinders, and the card is gone.`,
            confirmLabel: 'BURN IT',
            onConfirm: () => {
              run.cinders -= stock.removeCost;
              run.deck.splice(idx, 1);
              run.removesPurchased = (run.removesPurchased || 0) + 1;
              stock.removeCost = registries.balance.shop.removeBase + registries.balance.shop.removeStep * run.removesPurchased;
              sfx.play('buy');
              onChanged();
              render();
            },
          });
          grid.appendChild(wrap);
        });
      });
    }

    // ---- the SELL shelf: the player's own goods, priced by the table ------
    const sellRow = app.querySelector('#shop-sell');
    const goods = sellOn() ? sellables() : [];
    const armamentGoods = sellOn() ? carriedIds(run.loadout).map((id) => armamentSalePlan(registries, run, id)).filter((plan) => plan.def) : [];
    for (const plan of armamentGoods) {
      sellRow.appendChild(armamentOffer(plan.def, () => inspectArmament(plan.id, 'sell'), plan.ok ? `${plan.price} cinders back` : plan.reason));
    }
    goods.forEach((row) => {
      const el = shopItem(row.title, row.desc, row.price, true, null, { titleHtml: !!row.titleHtml, costWord: 'cinders back' });
      arm(el, 'shopSell', {
        question: `Sell ${row.def.name} back to the merchant? ${row.price} cinders, and it is gone.`,
        confirmLabel: 'SELL IT',
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
      });
      sellRow.appendChild(el);
    });

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
      if (available) {
        el.addEventListener('click', open);
        el.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          open();
        });
      }
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

    app.querySelector('#leave-shop').addEventListener('click', onLeave);

    // ---- the fold: one mount, one open bar, faces that answer in words ----
    const BARS = [
      { key: 'bar:cards', label: 'CARDS', node: cardsRow,
        value: () => (stock.cards.length ? `${stock.cards.length} for sale` : 'sold out'),
        tip: 'Cards for cinders. Tap to browse the shelf.' },
      { key: 'bar:armaments', label: 'ARMAMENTS', node: armamentsRow,
        value: () => `${(stock.armaments || []).length} for sale`, tip: 'Inspect an armament before buying it for your inventory.' },
      { key: 'bar:weapon-arts', label: 'WEAPON ARTS', node: artsRow,
        value: () => `${(stock.weaponArts || []).length} for sale`, tip: 'Loose weapon-art cards. A smith can seat compatible cards in an open mount.' },
      { key: 'bar:relics', label: 'RELICS', node: relicsRow,
        value: () => (stock.relics.length ? `${stock.relics.length} for sale` : 'sold out'),
        tip: 'Relics for cinders.' },
      { key: 'bar:flasks', label: 'FLASKS', node: flasksRow,
        value: () => (stock.flasks.length ? `${stock.flasks.length} for sale` : 'sold out'),
        tip: 'Flasks for cinders.' },
      { key: 'bar:remove', label: 'REMOVE A CARD', node: app.querySelector('#shop-remove'),
        value: () => `${stock.removeCost} cinders`,
        tip: 'Pay the merchant to burn a card out of the deck.' },
      // ABSENT, never greyed, when his toggle is off — the recorded answer.
      ...(sellOn() ? [{ key: 'bar:sell', label: 'SELL', node: sellRow,
        value: () => (goods.length + armamentGoods.filter((plan) => plan.ok).length ? `${goods.length + armamentGoods.filter((plan) => plan.ok).length} the merchant will take` : 'nothing he wants'),
        tip: 'Sell stored armaments, relics and flasks. Equipped armaments must be unequipped first.' }] : []),
      // ABSENT when the roll at the door said no smith travels with him.
      ...(smithCards.length ? [{ key: 'bar:smith', label: 'THE SMITH', node: smithRow,
        value: () => `${smithCards.filter((el) => !el.classList.contains('locked')).length} of ${smithCards.length} services open`,
        tip: 'A smith travels with this merchant: upgrade an item, lift a card out of one, or seat a card in one.' }] : []),
    ];
    fold = mountDisclosure(app.querySelector('.shop-bars'), BARS.map((bar) => ({
      key: bar.key, kind: 'pick', disclosure: 'face',
      face: { label: bar.label, value: bar.value() },
      reveal: { node: bar.node, sense: bar.tip },
    })));
    // Re-open the bar the player was in — or CARDS on arrival, the shelf he
    // said he could not see. A bar that vanished mid-visit (SELL emptied and
    // the toggle is a rebuild away) falls back to CARDS rather than throwing.
    if (!BARS.some((bar) => bar.key === openBar)) openBar = 'bar:cards';
    fold.open(openBar);
  }

  function armamentOffer(def, inspect, summary) {
    const face = renderEquipmentCard(registries, def, { interactive: false, inspection: false }).card;
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
    const detail = renderEquipmentInspection(registries, def);
    const upgrades = statusText(`Smithing tier ${packageInfo.tier}. Attached cards: ${packageInfo.mounts.map((mount) => mount.cardName).join(', ') || 'none'}.`);
    const cancel = button({ label: 'Back' });
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
    const shelf = openBar === 'bar:sell' ? '#shop-sell' : openBar === 'bar:weapon-arts' ? '#shop-weapon-arts' : '#shop-armaments';
    (app.querySelector(`${shelf} button, ${shelf} [role="button"]`) || app.querySelector('#leave-shop'))?.focus({ preventScroll: true });
  }

  function shopItem(title, desc, cost, affordable, onBuy, { titleHtml = false, costWord = 'cinders', card = null } = {}) {
    const el = document.createElement('div');
    el.className = `class-pick${affordable ? '' : ' locked'}`;
    el.innerHTML = `<div class="cp-body"><h3>${titleHtml ? title : esc(title)}</h3><p>${esc(desc)}</p><span class="chip" style="color:${affordable ? 'var(--gold)' : 'var(--muted)'}">${cost} ${esc(costWord)}</span></div>`;
    const itemName = el.querySelector('h3')?.textContent?.trim() || 'this item';
    if (card) {
      el.classList.add('shop-collectible-offer');
      el.querySelector('h3').remove();
      if (affordable) el.querySelector('p').remove();
      el.prepend(card);
      el.setAttribute('aria-label', itemName);
    }
    if (affordable && onBuy) {
      arm(el, 'shopBuy', {
        question: `Buy ${itemName} for ${cost} ${costWord}? You have ${run.cinders} cinders.`,
        confirmLabel: 'BUY IT',
        onConfirm: onBuy,
      });
    }
    return el;
  }

  render();

  // Smart default (keyboard/gamepad): land on the first purchasable card, else
  // the Leave button.
  if (isEngaged()) setTimeout(() => focusFirst('#shop-cards .card') || focusFirst('#leave-shop'), 0);
}
