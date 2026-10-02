// src/ui/screens/master.js — the wise master (SPEC §14.5, §14.6 step 7).
//
// The blacksmith's W1d workspace (ui/screens/blacksmith.js) for the master:
// the same category rail beside (or above) one W1v pane, one rail item per
// offering the visit laid out, in content/shops.js order, and after them the
// Sell consumables pane (the market's plan/commit, governed by the same
// `shopSell` toggle; shown beside the offerings, not one of them). Every fact
// is read from the saved stock or a plan in model/master.js; nothing here
// prices, rolls or decides. Each action commits the plan it was drawn from,
// so a quote made stale since is refused by name and the screen redraws.
//
// A SERVICE STAYS ONCE ROLLED (§14.4's ruling, extended by §14.5): a service
// with nothing to act on now is shown unavailable with its reason, and
// becomes usable on this visit once the run holds something for it (a respec
// fills the training pool, and redistribute opens).
//
// THE LESSON ROLLS WHEN ASKED. A track's lesson has no cards until the player
// asks for it; the roll (engine/shopKinds.js rollMasterLesson, on the run's
// `shopOffers` stream) is persisted with the stock, so a reload shows the
// same cards (balance.skill.draftSize of them) and never rolls the track again.
import { esc } from '../components/tooltip.js';
import { engravedIconHtml, engravedGlyphId } from '../components/engravedIcon.js';
import { sfx } from '../sfx.js';
import { modalHead, modalFooter } from '../components/modalShell.js';
import { button, statusText, el, railItem, categoryNav } from '../kit/index.js';
import { t } from '../strings.js';
import { settingOn } from './settings.js';
import { runHudHtml, wireRunHud } from '../components/runHud.js';
import { wireShopLayout } from './shop.js';
import { shopStockOfferings } from '../../model/shopKinds.js';
import { skillTracks, xpToNext, skillKindOf, skillLevel } from '../../model/skills.js';
import { armamentPurchasePlan, commitArmamentPurchase } from '../../model/armamentTrading.js';
import { consumablePurchasePlan, commitConsumablePurchase } from '../../model/marketAdditions.js';
import { consumableText, consumableSalePlan, commitConsumableSale } from '../../model/consumables.js';
import { rollMasterLesson } from '../../engine/shopKinds.js';
import {
  MASTER_SERVICES, masterOf, masterServiceCandidates, masterServiceIdleReason, trackLabel,
  trainingPlan, commitTraining, respecPlan, commitRespec,
  redistributePlan, commitRedistribute, lessonPlan, commitLesson, masterAppraisal,
} from '../../model/master.js';

const GLYPH = Object.freeze({
  skillBooks: '📖', weaponArts: '✧', armaments: '⚔', training: '⚒', respec: '↺',
  lesson: '✎', appraisal: '◎', redistribute: '⇄', sell: '◆',
});
// An element id for a track id (`item:magic-focus` → `item-magic-focus`).
const slug = (id) => String(id).replace(/[^a-z0-9]/gi, '-');

export function mountMaster(app, { registries, run, meta, rng = null, flatRarity = false, onLeave, onChanged = () => {}, onArmamentPurchased = () => {}, priceMult = 1, hud = null }) {
  const stock = run.shopStock;
  let activeCategory = null;
  let layout = null;
  const sellOn = () => settingOn((meta || {}).settings, 'shopSell');

  function refuse(host, error) {
    host.querySelector('.bs-refusal')?.remove();
    host.append(statusText(error.message, { class: 'shop-offer-avail bs-refusal', role: 'status' }));
  }

  // One action: commit, sound, persist, redraw — or show the refusal in place.
  function act(tile, commit, sound = 'shrine') {
    try { commit(); }
    catch (error) {
      refuse(tile, error);
      return;
    }
    sfx.play(sound);
    onChanged();
    render();
  }

  function tile(glyph, title, desc, reason = '') {
    const node = el('div', { class: `class-pick shop-offer${reason ? ' locked' : ''}` });
    node.innerHTML = `<div class="glyph">${engravedIconHtml(engravedGlyphId(glyph)) || glyph}</div><div class="cp-body"><h3>${esc(title)}</h3>${desc ? `<p>${esc(desc)}</p>` : ''}</div>`;
    if (reason) node.append(statusText(reason, { class: 'shop-offer-avail' }));
    return node;
  }
  function actionButton(host, { id, label, plan, commit, sound }) {
    const control = button({ label, id: id || '', weight: 'primary', disabled: !plan.ok, attrs: plan.ok ? {} : { title: plan.reason } });
    if (plan.ok) control.addEventListener('click', () => act(host, commit, sound));
    host.append(control);
    if (!plan.ok) host.append(statusText(plan.reason, { class: 'shop-offer-avail' }));
    return control;
  }
  const master = () => masterOf(registries, run);
  const levelLine = (skillId) => {
    const kind = skillKindOf(registries, skillId);
    const level = skillLevel(run, skillId);
    return t('master.track.line', { level, xp: run.skills?.[skillId]?.xp ?? 0, next: kind ? xpToNext(registries, kind, level) : 0 });
  };
  const cardNames = (ids) => ids.map((id) => registries.cards.get(id)?.name || id).join(', ');

  // ---- each offering's shelf ------------------------------------------------
  const SHELVES = {
    skillBooks(shelf) {
      for (const item of stock.skillBooks || []) {
        const plan = consumablePurchasePlan(registries, run, 'skillBooks', item);
        if (!plan.def) continue;
        const host = tile(GLYPH.skillBooks, plan.def.name, t('master.offer.line', { text: consumableText(registries, plan.def), cost: item.cost }));
        actionButton(host, { label: t('master.action.buy'), plan, sound: 'buy', commit: () => commitConsumablePurchase(registries, run, 'skillBooks', plan) });
        shelf.append(host);
      }
    },
    weaponArts(shelf) {
      for (const item of stock.weaponArts || []) {
        const plan = armamentPurchasePlan(registries, run, item, 'weaponArt');
        if (!plan.def) continue;
        const host = tile(GLYPH.weaponArts, plan.def.name, t('master.offer.line', { text: t('shop.weaponArt.eyebrow'), cost: item.cost }));
        actionButton(host, { label: t('master.action.buy'), plan, sound: 'buy', commit: () => commitArmamentPurchase(registries, run, plan) });
        shelf.append(host);
      }
    },
    armaments(shelf) {
      for (const item of stock.armaments || []) {
        const plan = armamentPurchasePlan(registries, run, item);
        if (!plan.def) continue;
        const host = tile(GLYPH.armaments, plan.def.name, t('blacksmith.armament.line', { name: plan.def.name, cost: item.cost }));
        actionButton(host, { label: t('master.action.buy'), plan, sound: 'buy', commit: () => {
          const receipt = commitArmamentPurchase(registries, run, plan);
          onArmamentPurchased(receipt.id);
        } });
        shelf.append(host);
      }
    },
    training(shelf) {
      for (const skillId of master()?.skills || []) {
        const plan = trainingPlan(registries, run, skillId, { priceMult });
        const host = tile(GLYPH.training, trackLabel(registries, skillId), levelLine(skillId));
        actionButton(host, { id: `master-train-${slug(skillId)}`, label: t('master.action.train', { cost: plan.cost, xp: plan.xp }), plan, commit: () => commitTraining(registries, run, plan, { priceMult }) });
        shelf.append(host);
      }
    },
    respec(shelf) {
      for (const skillId of master()?.skills || []) {
        const plan = respecPlan(registries, run, skillId, { priceMult });
        const host = tile(GLYPH.respec, trackLabel(registries, skillId), `${levelLine(skillId)} · ${t('master.respec.line', { refund: plan.refund })}`);
        actionButton(host, { id: `master-respec-${slug(skillId)}`, label: t('master.action.respec', { cost: plan.cost }), plan, commit: () => commitRespec(registries, run, plan, { priceMult }) });
        shelf.append(host);
      }
    },
    lesson(shelf) {
      for (const skillId of master()?.skills || []) {
        const entry = stock.lessons?.[skillId] || null;
        const host = tile(GLYPH.lesson, trackLabel(registries, skillId), entry ? (entry.cardIds.length ? cardNames(entry.cardIds) : '') : t('master.lesson.unasked', { count: registries.balance.skill.draftSize }));
        if (!entry) {
          // Asking rolls the track's cards once, kept with the stock.
          const ask = button({ label: t('master.action.askLesson'), id: `master-ask-${slug(skillId)}`, weight: 'primary', disabled: !rng });
          if (rng) ask.addEventListener('click', () => act(host, () => rollMasterLesson(registries, rng, run, skillId, { flatRarity }), 'shrine'));
          host.append(ask);
        } else if (!entry.cardIds.length || entry.taken) {
          host.append(statusText(lessonPlan(registries, run, skillId, entry.cardIds[0] || '', { priceMult }).reason, { class: 'shop-offer-avail' }));
        } else {
          for (const cardId of entry.cardIds) {
            const plan = lessonPlan(registries, run, skillId, cardId, { priceMult });
            actionButton(host, { id: `master-lesson-${slug(skillId)}-${cardId}`, label: t('master.action.lesson', { name: registries.cards.get(cardId)?.name || cardId, cost: plan.cost }), plan, commit: () => commitLesson(registries, run, plan, { priceMult }) });
          }
        }
        shelf.append(host);
      }
    },
    appraisal(shelf) {
      for (const row of masterAppraisal(registries, run, { priceMult, flatRarity })) {
        const draws = row.cardIds.length ? t('master.appraisal.draws', { names: cardNames(row.cardIds) }) : t('master.appraisal.drawsNone');
        const respec = row.respec.ok ? t('master.appraisal.respec', { refund: row.respec.refund, cost: row.respec.cost }) : row.respec.reason;
        shelf.append(tile(GLYPH.appraisal, row.label, `${t('master.track.line', { level: row.level, xp: row.xp, next: row.toNext })} · ${draws} · ${respec}`));
      }
    },
    redistribute(shelf) {
      const pool = run.trainingPool || 0;
      // An empty pool draws no track and no "Spend 0 XP" control: the idle
      // reason, prepended once by render(), says why.
      if (!pool) return;
      for (const { id: skillId, label } of skillTracks(registries)) {
        const host = tile(GLYPH.redistribute, label, levelLine(skillId));
        const kind = skillKindOf(registries, skillId);
        const need = kind ? xpToNext(registries, kind, skillLevel(run, skillId)) - (run.skills?.[skillId]?.xp ?? 0) : 0;
        const amounts = [...new Set([need > 0 && need < pool ? need : null, pool].filter((n) => n > 0))];
        for (const amount of amounts) {
          const plan = redistributePlan(registries, run, skillId, amount);
          actionButton(host, { id: `master-spend-${slug(skillId)}-${amount}`, label: t('master.action.spend', { amount }), plan, commit: () => commitRedistribute(registries, run, plan) });
        }
        shelf.append(host);
      }
    },
    // THE SELL CONSUMABLES PANE (SPEC §14.3, §14.5): the market's plan and
    // commit; the price is never above what one costs now.
    sell(shelf) {
      const ids = Object.keys(run.consumables || {});
      if (!ids.length) shelf.append(statusText(t('master.sell.none'), { class: 'shop-offer-avail' }));
      for (const id of ids) {
        const plan = consumableSalePlan(registries, run, id, { priceMult });
        if (!plan.def) continue;
        const host = tile(GLYPH.sell, plan.def.name, t('shop.consumable.sellDesc', { text: consumableText(registries, plan.def), count: run.consumables[id] }));
        actionButton(host, { id: `master-sell-${slug(id)}`, label: t('shop.action.sell', { price: plan.price }), plan, sound: 'buy', commit: () => commitConsumableSale(registries, run, plan, { priceMult }) });
        shelf.append(host);
      }
    },
  };

  // How many things each offering can act on now: the rail's {Status}.
  const readyCount = (key) => {
    if (key === 'skillBooks' || key === 'weaponArts' || key === 'armaments') return (stock[key] || []).length;
    if (key === 'sell') return Object.keys(run.consumables || {}).length;
    return MASTER_SERVICES.includes(key) ? masterServiceCandidates(registries, run, key, { flatRarity }).length : 0;
  };

  function render() {
    if (layout) layout.release();
    const categories = [...shopStockOfferings(stock).filter((key) => SHELVES[key]), ...(sellOn() ? ['sell'] : [])];
    if (!categories.includes(activeCategory)) activeCategory = categories[0] || null;
    app.innerHTML = `
      ${hud ? runHudHtml({ registries, run, meta, place: 'shop', headerClass: 'map-header room-header' }) : ''}
      <div class="screen room-screen shop-workspace master-workspace" data-wireframe="W1d" data-shop-kind="master">
        <div class="shop-frame">
          <div class="as-railed shop-railed">
            <div class="as-pane shop-pane" data-wireframe="W1v" id="shop-pane">
              <div class="as-pane-head shop-pane-head"></div>
              <div class="shop-body">
                <div class="shop-offers">
                  ${categories.map((key) => `<div class="card-shelf shop-shelf" id="master-${key}" data-shop-shelf="${key}"></div>`).join('')}
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
    const purse = t('master.purse', { cinders: run.cinders, pool: run.trainingPool || 0, left: stock.training?.left ?? 0 });
    frame.prepend(modalHead({ title: master()?.name || t('master.title'), closeLabel: t('master.leave'), onClose: onLeave, showMenuButton: false, extras: statusText(purse, { class: 'modal-head-status' }) }));

    for (const key of categories) {
      const shelf = root.querySelector(`#master-${key}`);
      SHELVES[key](shelf);
      // A service with nothing to act on now says why, and stays on the rail.
      if (MASTER_SERVICES.includes(key) && !readyCount(key)) {
        shelf.prepend(statusText(masterServiceIdleReason(key), { class: 'shop-offer-avail bs-idle', role: 'status' }));
      }
    }
    const statusOf = (key) => {
      const n = readyCount(key);
      return n ? t('blacksmith.status.ready', { count: n }) : t('blacksmith.status.idle');
    };
    const railItems = categories.map((key) => {
      const item = railItem({
        label: t(`master.bar.${key}`), member: key, current: key === activeCategory, id: `shop-cat-${key}`,
        className: 'with-status shop-railitem', attrs: { dataset: { shopCategory: key }, 'aria-controls': 'shop-pane' },
      });
      item.appendChild(statusText(statusOf(key)));
      item.addEventListener('click', () => { activeCategory = key; paint(); });
      return item;
    });
    const nav = categoryNav({
      items: railItems, ariaLabel: t('master.rail.aria'), railAttrs: { class: 'shop-rail' }, toggleId: 'shop-cat-select',
      onChange: ({ mode }) => { root.dataset.shopRail = mode === 'rail' ? 'side' : 'top'; },
    });
    railed.prepend(nav.rail);
    nav.attach(railed);
    const leave = button({ label: t('master.leave'), role: 'exit', id: 'leave-shop' });
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
