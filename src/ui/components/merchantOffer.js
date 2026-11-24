import { engravedIcon } from './engravedIcon.js';
import { uiIconText } from '../../content/uiIcons.js';
import { button, el, statusText } from '../kit/index.js';
import { t } from '../strings.js';
import { openBoundCardInspection, openCardInspection } from './cardInspection.js';
import { BindMerchantItemArtFit } from './merchantItemArtFit.js';

// A playing-card image is a background plus object/effect layers. The first
// image in the face is its decorative frame, not its artwork. Preserve the
// complete art well, including the renderer's missing-art fallback behavior.
function merchantArtwork(visual) {
  const source = () => visual.querySelector('.playing-card-art')?.parentNode
    || visual.querySelector('.epc-art') || (visual.matches('img') ? visual : visual.querySelector('img')) || visual;
  const host = el('span', { class: `merchant-artwork${visual.querySelector('.playing-card-art') ? ' illustrated-card-face' : ''}` });
  host.style.cssText = 'position:relative;display:block;width:100%;height:100%;overflow:hidden;isolation:isolate';
  let generation = 0;
  function paint() {
    const currentGeneration = ++generation;
    const original = source();
    const copy = original.cloneNode(true);
    const originals = original.matches('img') ? [original] : [...original.querySelectorAll('img')];
    const copies = copy.matches('img') ? [copy] : [...copy.querySelectorAll('img')];
    copy.style.setProperty('width', '100%');
    copy.style.setProperty('height', '100%');
    originals.forEach((image, index) => copies[index].addEventListener('error', () => {
      if (generation !== currentGeneration || host.firstElementChild !== copy) return;
      const before = originals.map(node => node.getAttribute('src')).join('|');
      image.dispatchEvent(new Event('error'));
      const next = source();
      const after = (next.matches('img') ? [next] : [...next.querySelectorAll('img')]).map(node => node.getAttribute('src')).join('|');
      // Do not retry an exhausted fallback indefinitely.
      if (next !== original || before !== after) paint();
    }, { once: true }));
    host.replaceChildren(copy);
    if (original.classList.contains('epc-art')) for (const image of copies) {
      BindMerchantItemArtFit(image, { isCurrent: () => generation === currentGeneration && image.parentNode === copy && host.firstElementChild === copy });
    }
  }
  paint();
  return host;
}

/** Small art target; the complete description and original visual stay inspectable. */
export function merchantThumbnail({ visual, detail = visual, name, desc = '', inspect = null, actions = null, commands = {}, boundActions = false }) {
  const control = button({ label: '', className: 'merchant-thumbnail', attrs: { 'aria-label': t('deckEditor.inspectNamed', { name }) } });
  control.append(visual);
  control.addEventListener('keydown', event => event.stopPropagation());
  control.addEventListener('click', event => {
    event.stopPropagation();
    if (inspect) { inspect(control); return; }
    if (openBoundCardInspection(detail, control, { allowDetached: true, ...(boundActions ? { actions, commands } : {}) })) return;
    openCardInspection({ title: name, card: detail, details: el('div', {}, el('p', { text: desc })),
      opener: control, actions, commands });
  });
  return control;
}

// Reuse the offer's live card/inspection node, so its existing interactions
// remain available alongside the explicit row action. No prices are derived here.
export function arrangeMerchantOffer(offer, { fallback = 'dexterity' } = {}) {
  const { tile, name, desc, price, avail } = offer;
  const visual = offer.visual || tile.querySelector('.shop-inspect-card')
    || tile.querySelector('.card') || tile.querySelector('.equipment-poker-card')
    || tile.querySelector('.glyph') || el('span', { class: 'merchant-offer-glyph', 'aria-hidden': 'true' }, engravedIcon(fallback) || uiIconText(fallback));
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
  tile.tabIndex = 0;
  tile.setAttribute('aria-label', t('deckEditor.inspectNamed', { name }));
  tile.removeAttribute('aria-pressed');
  tile.style.cssText = '';
  visual.querySelectorAll('.card-info-button').forEach(node => node.remove());
  const art = offer.thumbnail || merchantArtwork(visual);
  const media = merchantThumbnail({ visual: art, detail: visual, name, desc, inspect: offer.inspect,
    boundActions: ['buy', 'sell'].includes(action?.kind),
    actions: () => control ? [{ id: action.kind, verb: label, enabled: !control.disabled, reason: avail.reason || '' }] : [],
    commands: control ? { [action.kind]: () => control.click() } : {} });
  const mediaBox = el('div', { class: 'merchant-offer-media' }, media);
  tile.replaceChildren(mediaBox, details, actions);
  tile.addEventListener('click', event => {
    if (event.target.closest?.('button, a, input, select, textarea')) return;
    media.click();
  });
  tile.addEventListener('keydown', event => {
    if (event.target !== tile || !['Enter', ' ', 'i', 'I'].includes(event.key)) return;
    event.preventDefault();
    media.click();
  });
  return control;
}
