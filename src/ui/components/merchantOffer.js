import { button, el, statusText } from '../kit/index.js';
import { t } from '../strings.js';
import { openModal } from './modalShell.js';

/** Small art target; the complete description and original visual stay inspectable. */
export function merchantThumbnail({ visual, detail = visual, name, desc = '', inspect = null }) {
  const control = button({ label: '', className: 'merchant-thumbnail', attrs: { 'aria-label': t('deckEditor.inspectNamed', { name }) } });
  control.append(visual, el('span', { class: 'merchant-inspect-label', text: t('deckEditor.inspectAction') }));
  control.addEventListener('keydown', event => event.stopPropagation());
  control.addEventListener('click', event => {
    event.stopPropagation();
    if (inspect) { inspect(); return; }
    const back = button({ label: t('shop.back'), role: 'exit' });
    const shell = openModal({ title: name, bodyClassName: 'merchant-inspection', body: host => {
      host.append(detail, el('p', { text: desc }));
    }, secondary: [back] });
    back.addEventListener('click', shell.close);
  });
  return control;
}

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
  const image = visual.matches('img') ? visual : visual.querySelector('.epc-art img, img');
  // Clone only artwork, never miniature card text or interactive card controls.
  const art = offer.thumbnail || (image || visual).cloneNode(true);
  const media = merchantThumbnail({ visual: art, detail: visual, name, desc, inspect: offer.inspect });
  tile.replaceChildren(el('div', { class: 'merchant-offer-media' }, media), details, actions);
  return control;
}
