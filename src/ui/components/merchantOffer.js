import { button, el, statusText } from '../kit/index.js';
import { t } from '../strings.js';

// Reuse the offer's live card/inspection node, so its existing interactions
// remain available alongside the explicit row action. No prices are derived here.
export function arrangeMerchantOffer(offer, { fallback = '◇' } = {}) {
  const { tile, name, desc, price, avail } = offer;
  const visual = offer.visual || tile.querySelector('.shop-inspect-card')
    || tile.querySelector('.card') || tile.querySelector('.equipment-poker-card')
    || tile.querySelector('.glyph') || el('span', { class: 'merchant-offer-glyph', text: fallback, 'aria-hidden': 'true' });
  const details = el('div', { class: 'cp-body merchant-offer-details' }, [
    el('h3', { text: name }),
    desc ? el('p', { text: desc }) : null,
  ].filter(Boolean));
  if (!avail.available) details.append(statusText(avail.reason || t(avail.because === 'capacity' ? 'shop.avail.full' : avail.because === 'cinders' ? 'shop.avail.cinders' : 'shop.avail.locked'), { class: 'shop-offer-avail' }));
  const action = offer.action;
  const label = action?.kind === 'buy' ? t('shop.book.buy') : action?.kind === 'sell' ? t('shop.bar.sell') : action?.label;
  const control = action ? button({ label, disabled: !action.enabled, className: 'merchant-offer-action', attrs: { 'aria-label': `${name}: ${action.label}` } }) : null;
  if (control) {
    control.dataset.shopAction = action.kind;
    // The row may retain an existing select/open listener. A button owns its
    // action exclusively, including keyboard activation of a service.
    control.addEventListener('click', (event) => event.stopPropagation());
    control.addEventListener('keydown', (event) => event.stopPropagation());
  }
  const actions = el('div', { class: 'merchant-offer-actions' }, [control, price ? statusText(price, { class: 'merchant-offer-price' }) : null].filter(Boolean));
  tile.classList.add('merchant-offer');
  tile.removeAttribute('role');
  // Service dialogs return focus to their original tile after closing.
  tile.tabIndex = -1;
  tile.removeAttribute('aria-pressed');
  tile.style.cssText = '';
  tile.replaceChildren(el('div', { class: 'merchant-offer-media' }, visual), details, actions);
  return control;
}
