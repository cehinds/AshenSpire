import { button, el, statusText } from '../kit/index.js';
import { shopBuyArtwork } from '../assets.js';
import { renderBookArt } from './bookArt.js';
import { t } from '../strings.js';
import { uiConfig } from '../../config/generated/ui.js';

/** Shared geometry comes from the shop's authored presentation document. */
export function applySkillBookOfferTokens(root) {
  for (const [key, value] of Object.entries(uiConfig.screens.shop.components.bookOffers)) {
    const name = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    root.style.setProperty(`--book-${name}`, `${value}rem`);
  }
}

/** A real purchase control beside readable details, never a nested button. */
export function renderSkillBookOffer({ def, description, cost, available, reason = '' }) {
  const artwork = renderBookArt(def, { className: 'shop-book-art' });
  const details = el('div', { class: 'cp-body shop-book-details' }, [
    el('h3', { class: 'shop-book-name', text: def.name }),
    el('p', { text: description }),
    el('p', { class: 'shop-book-usage', text: t('shop.book.desc', { text: '' }).trim() }),
  ]);
  const buy = button({
    label: t('shop.book.buy'), className: 'shop-book-buy', disabled: !available,
    attrs: { 'aria-label': `${def.name}: ${t('shop.action.buy', { cost })}` },
  });
  // Custom-property URLs are resolved at the consuming stylesheet. Resolve
  // here so external source, content-addressed packs and data URLs all work.
  const art = shopBuyArtwork();
  const artUrl = document.baseURI ? new URL(art, document.baseURI).href : art;
  buy.style.setProperty('--book-buy-art', `url("${artUrl}")`);
  const actions = el('div', { class: 'shop-book-actions' }, [
    buy, el('span', { class: 'shop-book-price', text: t('shop.price', { cost }) }),
  ]);
  if (!available) details.appendChild(statusText(reason || t('shop.avail.cinders'), { class: 'shop-offer-avail', role: 'status' }));
  const tile = el('article', {
    class: `shop-book-offer${available ? '' : ' locked'}`,
    'aria-label': def.name, dataset: { bookId: def.id },
  }, [artwork, details, actions]);
  return { tile, buy };
}
