// After a shop purchase (owner, 2026-11-05) a card may go to the deck or stay in the library, and an armament may be
// equipped now or kept in the inventory. Dismissing the modal (Escape, close, veil) takes the secondary answer, which is
// exactly what the purchase did before: the item is already owned when this opens. The host owns every refusal.
import { openModal, button, el } from '../kit/index.js';
import { t } from '../strings.js';

function openChoice({ title, body, primaryLabel, secondaryLabel, onPrimary, onSecondary, refusal = '' }) {
  const secondary = button({ label: secondaryLabel, role: 'exit', id: 'shop-buy-keep' });
  const primary = button({ label: primaryLabel, weight: 'primary', id: 'shop-buy-primary', disabled: !!refusal });
  const status = el('p', { class: 'reward-confirm-status', role: 'alert', text: refusal });
  let settled = false;
  const shell = openModal({
    title, size: 'sm', className: 'shop-buy-choice', bodyClassName: 'as-pane', closeLabel: secondaryLabel, secondary: [secondary], primary,
    initialFocus: () => (primary.disabled ? secondary : primary),
    onClose: () => { if (!settled) { settled = true; onSecondary?.(); } },
    body(host) { host.append(el('p', { text: body }), status); },
  });
  secondary.addEventListener('click', () => shell.close());
  primary.addEventListener('click', () => {
    try { onPrimary?.(); } catch (error) { status.textContent = error.message; return; }
    settled = true; shell.close();
  });
  return shell;
}

/** openShopCardChoice({ name, refusal, onDeck, onLibrary }) — onDeck may throw (the message shows and the modal stays). */
export function openShopCardChoice({ name, refusal = '', onDeck, onLibrary }) {
  return openChoice({ title: t('shop.buyChoice.card.title'), body: t('shop.buyChoice.card.body', { name }), primaryLabel: t('reward.configured.addToDeck'), secondaryLabel: t('reward.configured.addToLibrary'), onPrimary: onDeck, onSecondary: onLibrary, refusal });
}
/** openShopArmamentChoice({ name, onEquip, onKeep }). */
export function openShopArmamentChoice({ name, onEquip, onKeep }) {
  return openChoice({ title: t('shop.buyChoice.armament.title'), body: t('shop.buyChoice.armament.body', { name }), primaryLabel: t('armoury.picker.act.equip'), secondaryLabel: t('shop.buyChoice.keepInventory'), onPrimary: onEquip, onSecondary: onKeep });
}
