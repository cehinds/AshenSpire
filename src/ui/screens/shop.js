// src/ui/screens/shop.js — the wandering merchant (SPEC §7.1; prices from
// balance.shop via engine/encounters.js buildShopStock)
//
// The stock lives on run.shopStock (rolled once on first entry and saved),
// so a reload restores the exact same shelves — SPEC §3.11 determinism.

import { renderCard } from '../components/card.js';
import { attachTooltip, esc } from '../components/tooltip.js';
import { sfx } from '../sfx.js';
import { isEngaged, focusFirst } from '../input.js';

export function mountShop(app, { registries, run, onLeave, onChanged }) {
  const stock = run.shopStock;
  const slotsFree = () => run.flasks.length < (registries.balance.flaskSlots || 3);

  function render() {
    app.innerHTML = `
      <div class="screen" style="justify-content:flex-start;overflow-y:auto;gap:14px;padding-top:28px">
        <h2 style="color:var(--gold);font-size:24px">THE WANDERING MERCHANT</h2>
        <p class="subtitle">"I'VE CLIMBED HIGHER THAN YOU. I CAME BACK. DRAW YOUR OWN CONCLUSIONS."</p>
        <p style="color:var(--gold)">Runes: <b>${run.runes}</b> · HP ${run.hp}/${run.maxHp}</p>
        <div class="reward-row" id="shop-cards"></div>
        <div class="class-row" id="shop-items"></div>
        <div class="class-row">
          <div class="class-pick${run.runes >= stock.removeCost && run.deck.length > 1 ? '' : ' locked'}" id="remove-opt">
            <div class="glyph">✂</div><h3>Remove a card</h3><p>${stock.removeCost} runes. The deck remembers what you cut.</p>
          </div>
        </div>
        <div id="remove-grid" class="deck-strip" style="display:none;max-width:900px"></div>
        <button id="leave-shop">LEAVE</button>
      </div>`;

    const cardsRow = app.querySelector('#shop-cards');
    stock.cards.forEach((item, i) => {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:6px';
      const el = renderCard(registries, { cardId: item.id, upgraded: false }, { small: true });
      const tag = document.createElement('span');
      tag.className = 'mini';
      tag.textContent = `${item.cost} runes`;
      tag.style.color = run.runes >= item.cost ? 'var(--gold)' : 'var(--muted)';
      if (run.runes >= item.cost) {
        el.addEventListener('click', () => {
          run.runes -= item.cost;
          run.deck.push({ instanceId: `s${run.deck.length}_${item.id}`, cardId: item.id, upgraded: false });
          stock.cards.splice(i, 1);
          sfx.play('buy');
          onChanged();
          render();
        });
      } else {
        el.classList.add('unaffordable');
      }
      wrap.appendChild(el);
      wrap.appendChild(tag);
      cardsRow.appendChild(wrap);
    });

    const items = app.querySelector('#shop-items');
    stock.relics.forEach((item, i) => {
      const def = registries.relics.get(item.id);
      items.appendChild(shopItem(`${def.icon || '◆'} ${def.name}`, def.textTemplate.replace(/[{}]/g, ''), item.cost, run.runes >= item.cost, () => {
        run.runes -= item.cost;
        run.relics.push(item.id);
        stock.relics.splice(i, 1);
        sfx.play('buy');
        onChanged();
        render();
      }));
    });
    stock.flasks.forEach((item, i) => {
      const def = registries.flasks.get(item.id);
      const can = run.runes >= item.cost && slotsFree();
      items.appendChild(shopItem(`${def.icon || '🧪'} ${def.name}`, slotsFree() ? def.textTemplate : 'Flask slots full.', item.cost, can, () => {
        run.runes -= item.cost;
        run.flasks.push({ flaskId: item.id });
        stock.flasks.splice(i, 1);
        sfx.play('buy');
        onChanged();
        render();
      }));
    });

    if (run.runes >= stock.removeCost && run.deck.length > 1) {
      app.querySelector('#remove-opt').addEventListener('click', () => {
        const grid = app.querySelector('#remove-grid');
        if (grid.style.display !== 'none') return;
        grid.style.display = 'flex';
        grid.style.flexWrap = 'wrap';
        grid.style.gap = '14px';
        grid.style.justifyContent = 'center';
        run.deck.forEach((inst, idx) => {
          const el = renderCard(registries, inst, { small: true });
          el.addEventListener('click', () => {
            run.runes -= stock.removeCost;
            run.deck.splice(idx, 1);
            run.removesPurchased = (run.removesPurchased || 0) + 1;
            stock.removeCost = registries.balance.shop.removeBase + registries.balance.shop.removeStep * run.removesPurchased;
            sfx.play('buy');
            onChanged();
            render();
          });
          grid.appendChild(el);
        });
      });
    }

    app.querySelector('#leave-shop').addEventListener('click', onLeave);
  }

  function shopItem(title, desc, cost, affordable, onBuy) {
    const el = document.createElement('div');
    el.className = `class-pick${affordable ? '' : ' locked'}`;
    el.innerHTML = `<h3 style="font-size:13px">${esc(title)}</h3><p>${esc(desc)}</p><span class="chip" style="color:${affordable ? 'var(--gold)' : 'var(--muted)'}">${cost} runes</span>`;
    if (affordable) el.addEventListener('click', onBuy);
    return el;
  }

  render();

  // Smart default (keyboard/gamepad): land on the first purchasable card, else
  // the Leave button.
  if (isEngaged()) setTimeout(() => focusFirst('#shop-cards .card') || focusFirst('#leave-shop'), 0);
}
