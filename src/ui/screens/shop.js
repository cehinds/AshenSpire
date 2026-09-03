// src/ui/screens/shop.js — the wandering merchant (SPEC §7.1; prices from
// balance.shop via engine/encounters.js buildShopStock)
//
// The stock lives on run.shopStock (rolled once on first entry and saved),
// so a reload restores the exact same shelves — SPEC §3.11 determinism.
//
// ---- THE BARS (E2 / #247) -----------------------------------------------
// Constantine, 2026-08-15, verbatim: "the shop is really hard to see cards...
// relics cards and weapons/armaments, and a sell function should be
// horizontal buttons that expand and collapse. show examples." Dealt by
// Marina's wave-two (family f30e1ca) as ONE pattern with B9/B10/E4 — the
// same mountDisclosure, never a second renderer (tools/onefold.mjs counts).
//
// FIVE BARS over the stock this merchant actually rolls — CARDS · RELICS ·
// FLASKS · REMOVE A CARD · SELL — each a full-width face carrying its label
// and its answer in words (what is left, what it costs), one open at a time,
// CARDS open on arrival because the cards are what he said he could not see.
// There is deliberately NO weapons/armaments bar: buildShopStock rolls no
// armament stock (balance.equipment.drops has no shop channel), and a bar
// for a category that cannot occur is a lie about the shop. The day the
// merchant stocks armaments, its bar is one entry in BARS below.
//
// SELL, and whose numbers these are. The recorded answer on the E2 row:
// Sell is its own bar, conditional on a NEW Settings toggle ('Merchant buys
// back', Advanced, DEFAULT ON until he says otherwise), and ABSENT — not
// greyed — when the toggle is off, because a feature he switched off that
// still greys at him is a nag. WHAT is sellable is OUR derivation, labelled:
// the merchant buys back what the merchant SELLS — relics and flasks, never
// deck cards, because burning a card already COSTS cinders at this same
// counter (Remove), and a shop that pays you for the thing it charges to
// destroy is two prices for one act. Starter-rarity relics are not offered:
// they are the class's identity, not goods, and no cost table prices them.
// The PRICE is table arithmetic, not a typed number per item — see
// sellPriceFor and balance.shop.sellFraction, whose comment states the same
// derivation. One word from him flips any clause of this paragraph.
//
// THE FOLD SURVIVES THE RE-RENDER. Every purchase re-renders the whole
// screen (the stock moved); the open bar is read off the mount before the
// rebuild and re-opened after, so buying a flask leaves you looking at
// flasks, not snapped back to cards.
//
// The rendered check on all of it is tools/shopbars.mjs, both shapes.

import { renderCard } from '../components/card.js';
import { attachTooltip, esc } from '../components/tooltip.js';
import { relicText } from '../components/card.js';
import { sfx } from '../sfx.js';
import { isEngaged, focusFirst } from '../input.js';
import { beatArmer } from '../../framework/optionDecision.js';
import { syncFlaskGrowth } from '../../model/flaskgrowth.js';
import { flaskIdentityHtml } from '../components/flask.js';
import { isEquipmentComposedInstance } from '../../model/loadout.js';
import { flaskSlotCap } from '../../model/gracerefill.js';
import { mountDisclosure } from '../components/disclosure.js';
import { settingOn } from './settings.js';

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

export function mountShop(app, { registries, run, meta, onLeave, onChanged }) {
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
        <h2 style="color:var(--gold);font-size:24px">THE WANDERING MERCHANT</h2>
        <p class="subtitle">"I'VE CLIMBED HIGHER THAN YOU. I CAME BACK. DRAW YOUR OWN CONCLUSIONS."</p>
        <p style="color:var(--gold)">Cinders: <b>${run.cinders}</b> · HP ${run.hp}/${run.maxHp}</p>
        <div class="shop-bars cz-disc">
          <div class="reward-row" id="shop-cards"></div>
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
        </div>
        <button id="leave-shop">LEAVE</button>
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
      if (run.cinders >= item.cost) {
        // ROUTED THROUGH THE MACHINERY EVEN THOUGH IT OWES NO BEAT, and that is
        // the falsifier for Law 0 on this control rather than a formality:
        // change `shopBuy`'s characteristics in model/secondbeat.js — say the
        // day a purse can strand a run — and a purchase starts asking, with
        // ZERO commits outside that table. An action wired with a bare
        // `addEventListener` can only ever be changed by editing this line.
        arm(el, 'shopBuy', {
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
      wrap.appendChild(el);
      wrap.appendChild(tag);
      cardsRow.appendChild(wrap);
    });

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
      }));
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
      }, { titleHtml: true }));
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
          arm(el, 'shopRemove', {
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
          grid.appendChild(el);
        });
      });
    }

    // ---- the SELL shelf: the player's own goods, priced by the table ------
    const sellRow = app.querySelector('#shop-sell');
    const goods = sellOn() ? sellables() : [];
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

    app.querySelector('#leave-shop').addEventListener('click', onLeave);

    // ---- the fold: one mount, one open bar, faces that answer in words ----
    const BARS = [
      { key: 'bar:cards', label: 'CARDS', node: cardsRow,
        value: () => (stock.cards.length ? `${stock.cards.length} for sale` : 'sold out'),
        tip: 'Cards for cinders. Tap to browse the shelf.' },
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
        value: () => (goods.length ? `${goods.length} the merchant will take` : 'nothing he wants'),
        tip: 'The merchant buys back relics and flasks, at his prices.' }] : []),
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

  function shopItem(title, desc, cost, affordable, onBuy, { titleHtml = false, costWord = 'cinders' } = {}) {
    const el = document.createElement('div');
    el.className = `class-pick${affordable ? '' : ' locked'}`;
    el.innerHTML = `<h3 style="font-size:13px">${titleHtml ? title : esc(title)}</h3><p>${esc(desc)}</p><span class="chip" style="color:${affordable ? 'var(--gold)' : 'var(--muted)'}">${cost} ${esc(costWord)}</span>`;
    if (affordable && onBuy) {
      const itemName = el.querySelector('h3')?.textContent?.trim() || 'this item';
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
