import { openModal } from './modalShell.js';
import { hideTooltip } from './tooltip.js';

// Logical identity survives a host re-render after its first selection tap.
let touchedIdentity = null;
let touchTaps = 0;

/** Read-only composition shared by equipment and playing-card detail surfaces. */
export function cardInspectionLayout(card, details) {
  const body = document.createElement('section');
  body.className = 'card-inspection-layout';
  const art = document.createElement('div');
  art.className = 'card-inspection-art';
  art.append(card);
  details.classList.add('card-inspection-details');
  body.append(art, details);
  return body;
}

export function openCardInspection({ title, card, details, opener }) {
  hideTooltip();
  document.getSelection()?.removeAllRanges();
  const shell = openModal({ title, eyebrow: 'Card information', size: 'lg',
    className: 'card-inspection-modal', opener,
    body: cardInspectionLayout(card, details) });
  shell.panel.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const targets = [...shell.panel.querySelectorAll('button:not([disabled]), [tabindex="0"], a[href]')].filter(el => el.getClientRects().length);
    const first = targets[0], last = targets.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  return shell;
}

/** Information owns only its own button; action/hold/drag handlers stay on hosts. */
export function bindCardInspection(card, { title, open, readOnly = false, touchSelectionSafe = false, actionOwnsTouch = false }) {
  card.style.userSelect = 'none';
  card.classList.add('card-inspection-target');
  if (!card.hasAttribute('tabindex')) card.tabIndex = 0;
  // Keep the button visible while keyboard focus moves from the card to it.
  // A touch focus alone must still wait for the second selection tap.
  card.addEventListener('focusin', () => {
    if (card.matches(':focus-visible')) card.classList.add('inspection-info-visible');
  });
  card.addEventListener('keydown', event => {
    if (event.key === 'Tab') card.classList.add('inspection-info-visible');
  });
  const info = document.createElement('button');
  info.type = 'button';
  info.className = 'card-info-button';
  info.textContent = 'i';
  info.setAttribute('aria-label', `Information about ${title}`);
  let touch = false;
  const identity = card.dataset.instanceId || card.dataset.item || card.dataset.cardId || title;
  const select = () => {
    document.querySelectorAll('.inspection-selected').forEach(other => {
      if (other !== card) {
        other.classList.remove('inspection-selected', 'inspection-info-visible');
        other.removeAttribute('aria-current');
      }
    });
    card.classList.add('inspection-selected');
    card.setAttribute('aria-current', 'true');
  };
  for (const type of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'keydown', 'keyup']) {
    info.addEventListener(type, event => event.stopImmediatePropagation());
  }
  info.addEventListener('click', event => {
    event.preventDefault(); event.stopImmediatePropagation();
    touchedIdentity = null; touchTaps = 0;
    select(); open(info);
  });
  card.append(info);
  card.addEventListener('pointerdown', event => { touch = event.pointerType === 'touch'; });
  card.addEventListener('click', event => {
    if (event.target === info) return;
    select();
    card.dispatchEvent(new CustomEvent('cardinspectionselect', { bubbles: true }));
    if (touch) {
      touchTaps = touchedIdentity === identity ? touchTaps + 1 : 1;
      touchedIdentity = identity;
      if (touchTaps >= 2) {
        card.classList.add('inspection-info-visible');
      }
      if (!actionOwnsTouch && (touchTaps === 2 || (touchTaps === 1 && !touchSelectionSafe))) {
        // Selection/information taps cannot reach buy, equip or play handlers.
        event.preventDefault(); event.stopImmediatePropagation();
      }
    } else if (readOnly) open(card);
    if (readOnly) { event.preventDefault(); event.stopPropagation(); }
  });
  if (readOnly) {
    card.tabIndex = 0;
    card.setAttribute('role', 'group');
    card.setAttribute('aria-label', `${title}. Enter to inspect. On touch, tap twice then Information.`);
    card.addEventListener('keydown', event => {
      if (event.target !== card || !['Enter', ' '].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation(); select(); open(card);
    });
  }
  return info;
}
