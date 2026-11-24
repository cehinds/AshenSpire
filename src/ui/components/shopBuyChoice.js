// After a shop purchase (owner, 2026-11-05) a card may go to the deck or stay in the library, and an armament may be
// equipped now or kept in the inventory. Dismissing the modal (Escape, close, veil) takes the secondary answer, which is
// exactly what the purchase did before: the item is already owned when this opens. The host owns every refusal.
import { openModal, button, el } from '../kit/index.js';
import { t } from '../strings.js';
import { moveToSideboard, deckEditBounds } from '../../model/deckRules.js';
import { addPurchasedCardToDeck, shopCardDeckRefusal } from '../../model/gameProfileRewards.js';
import { syncZones } from '../../model/state.js';

function openChoice({ title, body, primaryLabel, secondaryLabel, onPrimary, onSecondary, onDismiss, refusal = '' }) {
  const secondary = button({ label: secondaryLabel, role: 'exit', id: 'shop-buy-keep' });
  const primary = button({ label: primaryLabel, weight: 'primary', id: 'shop-buy-primary', disabled: !!refusal });
  const status = el('p', { class: 'reward-confirm-status', role: 'alert', text: refusal });
  let settled = false;
  const shell = openModal({
    title, size: 'sm', className: 'shop-buy-choice', bodyClassName: 'as-pane', closeLabel: onDismiss ? primaryLabel : secondaryLabel, secondary: [secondary], primary,
    initialFocus: () => (primary.disabled ? secondary : primary),
    onClose: () => { if (!settled) { settled = true; (onDismiss || onSecondary)?.(); } },
    body(host) { host.append(el('p', { text: body }), status); },
  });
  // With an onDismiss, Escape/close/veil take that answer and only the secondary button itself takes onSecondary.
  secondary.addEventListener('click', () => {
    if (!onDismiss) return shell.close();
    try { onSecondary?.(); } catch (error) { status.textContent = error.message; return; }
    settled = true; shell.close();
  });
  primary.addEventListener('click', () => {
    try { onPrimary?.(); } catch (error) { status.textContent = error.message; return; }
    settled = true; shell.close();
  });
  return shell;
}

/** openShopCardChoice({ name, refusal, onDeck, onLibrary, onDismiss }) — onDeck may throw (the message shows and the modal stays).
 *  Dismissing runs onLibrary unless onDismiss is given (the Master's art is already in the deck, so dismissing keeps it there). */
export function openShopCardChoice({ name, refusal = '', onDeck, onLibrary, onDismiss, title = t('shop.buyChoice.card.title') }) {
  return openChoice({ title, body: t('shop.buyChoice.card.body', { name }), primaryLabel: t('reward.configured.addToDeck'), secondaryLabel: t('reward.configured.sendToLibrary'), onPrimary: onDeck, onSecondary: onLibrary, onDismiss, refusal });
}
/** openShopArmamentChoice({ name, onEquip, onKeep }). */
export function openShopArmamentChoice({ name, onEquip, onKeep, title = t('shop.buyChoice.armament.title') }) {
  return openChoice({ title, body: t('shop.buyChoice.armament.body', { name }), primaryLabel: t('armoury.picker.act.equip'), secondaryLabel: t('shop.buyChoice.keepInventory'), onPrimary: onEquip, onSecondary: onKeep });
}

/** OpenReceivedRelic({ name, onDone }) — the same receive modal for a relic: it is already worn, so one answer. */
export function OpenReceivedRelic({ name, onDone }) {
  const ok = button({ label: t('receive.relic.ok'), weight: 'primary', id: 'shop-buy-primary' });
  const shell = openModal({
    title: t('receive.relic.title'), size: 'sm', className: 'shop-buy-choice', bodyClassName: 'as-pane', closeLabel: t('receive.relic.ok'), primary: ok,
    initialFocus: () => ok, onClose: () => onDone?.(),
    body(host) { host.append(el('p', { text: t('receive.relic.body', { name }) })); },
  });
  ok.addEventListener('click', () => shell.close());
  return shell;
}

/**
 * OfferReceivedItems({ registries, run, items, settings, onPersist, onEquip, onDone }) — playtest 2026-11-17 item 41:
 * what an event handed over (model/receivedItems.js) opens the shop's receive modal, one item after another.
 * A card in the deck may go to the library (dismissing keeps it in the deck); a card in the library may join the deck;
 * an armament may be equipped (onEquip(id) leaves for the Armoury and ends the chain); a relic is announced.
 */
export function OfferReceivedItems({ registries, run, items, settings = {}, onPersist = () => {}, onEquip = null, onDone = () => {} }) {
  const queue = [...(items || [])];
  const next = () => {
    const item = queue.shift();
    if (!item) return onDone();
    if (item.kind === 'relic') return OpenReceivedRelic({ name: item.name, onDone: next });
    if (item.kind === 'armament') {
      if (!onEquip) return next();
      let equipping = false;
      return openShopArmamentChoice({ name: item.name, title: t('receive.armament.title'),
        onEquip: () => { equipping = true; queueMicrotask(() => onEquip(item.id)); },
        onKeep: () => { if (!equipping) queueMicrotask(next); } });
    }
    if (item.zone === 'deck') {
      return openShopCardChoice({ name: item.name, title: t('receive.card.title'),
        onDeck: () => queueMicrotask(next),
        onLibrary: () => { if (moveToSideboard(registries, run, item.instanceId)) { syncZones(run); onPersist(); } queueMicrotask(next); },
        onDismiss: () => queueMicrotask(next) });
    }
    const code = shopCardDeckRefusal(registries, run, item.instanceId, settings);
    return openShopCardChoice({ name: item.name, title: t('receive.card.title'),
      refusal: !code ? '' : code === 'full' ? t('reward.configured.deckFull', { max: deckEditBounds(settings).max }) : t('reward.configured.deckLimit'),
      onDeck: () => { addPurchasedCardToDeck(registries, run, item.instanceId, settings); onPersist(); queueMicrotask(next); },
      onLibrary: () => queueMicrotask(next) });
  };
  next();
}
