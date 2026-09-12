import { openModal } from './modalShell.js';
import { hideTooltip } from './tooltip.js';
import { decorateKeywords } from './tooltipGlossary.js';

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
  const tags = details.querySelector('.inspection-tags');
  if (tags) art.append(tags);
  details.classList.add('card-inspection-details');
  decorateKeywords(details);
  body.append(art, details);
  return body;
}

export function openCardInspection({ title, card, details, opener, getAction = null }) {
  hideTooltip();
  document.getSelection()?.removeAllRanges();
  const action = getAction?.();
  const play = action ? document.createElement('button') : null;
  const reason = action ? document.createElement('p') : null;
  if (reason) {
    reason.className = 'card-play-reason'; reason.setAttribute('role', 'status');
    reason.textContent = action.reason || (action.needsTarget ? 'Choose a target after playing.' : 'Ready to play.');
    details.append(reason);
  }
  if (play) {
    play.type = 'button'; play.className = 'card-inspection-play';
    play.textContent = 'Play card'; play.disabled = !action.enabled;
    play.title = action.reason || (action.needsTarget ? 'Choose a target after closing this window.' : 'Play this card.');
  }
  const shell = openModal({ title, eyebrow: 'Card information', size: 'lg',
    className: 'card-inspection-modal', opener,
    primary: play,
    body: cardInspectionLayout(card, details) });
  play?.addEventListener('click', () => {
    const current = getAction();
    if (!current.enabled) {
      play.disabled = true; play.title = current.reason;
      if (reason) reason.textContent = current.reason;
      return;
    }
    play.disabled = true;
    shell.close();
    current.play();
  });
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
  // Keyboard focus selects the card before exposing its information control.
  card.addEventListener('focusin', () => {
    if (card.matches(':focus-visible')) select();
  });
  card.addEventListener('keydown', event => {
    if (event.key === 'Tab' && event.target === card) select();
  });
  const info = document.createElement('button');
  info.type = 'button';
  info.className = 'card-info-button';
  info.textContent = 'i';
  info.setAttribute('aria-label', `Information about ${title}`);
  let touch = false;
  let revealTimer = null;
  // The delay is read from the card's own custom property so one authored
  // number reaches CSS and JS alike; a card rendered without tokens still gets
  // the documented default rather than an instant flash.
  const revealDelayMs = () => {
    const raw = getComputedStyle(card).getPropertyValue('--card-info-delay').trim();
    const ms = raw.endsWith('ms') ? parseFloat(raw) : raw.endsWith('s') ? parseFloat(raw) * 1000 : parseFloat(raw);
    return Number.isFinite(ms) && ms >= 0 ? ms : 125;
  };
  const revealInfo = () => {
    if (card.classList.contains('inspection-info-visible')) return;
    clearTimeout(revealTimer);
    revealTimer = setTimeout(() => card.classList.add('inspection-info-visible'), revealDelayMs());
  };
  const identity = card.dataset.instanceId || card.dataset.item || card.dataset.cardId || title;
  const select = () => {
    document.querySelectorAll('.inspection-selected').forEach(other => {
      if (other !== card) {
        other.classList.remove('inspection-selected', 'inspection-info-visible');
        other.removeAttribute('aria-current');
        // A pending reveal on the card being deselected would otherwise land
        // after it lost selection, showing a button on a card nobody chose.
        other.dispatchEvent(new CustomEvent('cardinspectioncancelreveal'));
      }
    });
    card.classList.add('inspection-selected');
    card.setAttribute('aria-current', 'true');
    revealInfo();
    card.dispatchEvent(new CustomEvent('cardinspectionselect', { bubbles: true }));
  };
  card.addEventListener('cardholdstart', select);
  card.addEventListener('cardinspectionrequest', () => { select(); revealInfo(); });
  for (const type of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'keydown', 'keyup']) {
    info.addEventListener(type, event => event.stopImmediatePropagation());
  }
  // THE SELECTING BEAT IS SPENT, NOT RESET. This used to zero the count, so a
  // player who read a card's information and then tapped it had their tap
  // swallowed as a fresh selection — the card was already lit and the tap did
  // nothing visible. Reading is something you do TO a selected card; the beat
  // it stands on is still spent, so the next tap on the face is the action's.
  info.addEventListener('click', event => {
    event.preventDefault(); event.stopImmediatePropagation();
    touchedIdentity = identity; touchTaps = 1;
    select(); open(info);
  });
  card.addEventListener('cardinspectioncancelreveal', () => {
    clearTimeout(revealTimer);
    card.classList.remove('inspection-info-visible');
  });
  // TRUNCATED IS NEVER A DEAD END, AND IT IS STILL THE SAME TWO BEATS
  // (Constantine, 2026-09-12: *"it should still select and show the (i) button
  // for more information. all cards should react this way"*).
  //
  // A face whose text is clipped (fitCardFace → data-truncated) carries a `›`
  // in its corner. It began as a muted CSS hint a thumb could not act on;
  // #987 made it a control that opened the inspect door on ONE tap, and that
  // is the half that was wrong — it gave one kind of card a private shortcut
  // past the selecting beat every other card owes, so the same gesture meant
  // two different things depending on whether a card's text happened to fit.
  //
  // The chevron is still a real tap-floor control, and what it does now is
  // what a tap on the card's own face does: SELECT, draw the selection border,
  // and reveal the `i` after the authored delay. The `i` is the one door into
  // information, on every card, truncated or not. The chevron's job is to say
  // "there is more here" somewhere a thumb can reach — not to be a second
  // door with its own rules.
  //
  // It still swallows its own pointer and touch so the card's tap accounting
  // never sees it; the chevron begins the two beats rather than spending one.
  const more = document.createElement('button');
  more.type = 'button';
  more.className = 'card-more-button';
  more.textContent = '›';
  more.setAttribute('aria-label', `Select ${title} to read its full text`);
  for (const type of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'keydown', 'keyup']) {
    more.addEventListener(type, event => event.stopImmediatePropagation());
  }
  more.addEventListener('click', event => {
    event.preventDefault(); event.stopImmediatePropagation();
    // The chevron IS the selecting beat, so it spends it rather than zeroing
    // the count: the next tap on the face is the card's own act.
    touchedIdentity = identity; touchTaps = 1;
    select(); revealInfo();
  });
  card.append(info, more);
  card.addEventListener('pointerdown', event => { touch = event.pointerType === 'touch'; });
  card.addEventListener('click', event => {
    if (event.target === info) return;
    select();
    revealInfo();
    if (touch) {
      touchTaps = touchedIdentity === identity ? touchTaps + 1 : 1;
      touchedIdentity = identity;
      // ONE PRESS REVEALS IT. This waited for touchTaps >= 2, so the button
      // that explains a card could only be found by someone who already knew
      // it was there — every first-time player selected a card and saw nothing.
      // Selection is the signal; the reveal is a fade so it does not snap into
      // place under a thumb already on the glass. Both the delay and the fade
      // are authored in balance.ui.equipmentCard.info.
      revealInfo();
      // TWO TAPS, AND THE SECOND ONE IS THE ACTION'S (Constantine, 2026-09-12:
      // *"it should be two taps. the first selects and the information icon (i)
      // should appear after the set delay ... the second tap should select the
      // card or press and hold should work as well"*).
      //
      // THIS LINE USED TO SWALLOW TWO, and that is the defect #980 answered
      // from the wrong end. `touchTaps === 2` reserved the second tap for the
      // information button nobody had asked for, so a card's own act — choose
      // this candidate, arm this burn — could only be reached on the THIRD.
      // #980 fixed the count by handing tap ONE to the action (`actionOwnsTouch`
      // on the Smith and the merchant), which cost the selecting beat: a thumb
      // committed to a candidate it had not yet been shown.
      //
      // The rule now is the one he asked for, and it is the same rule for every
      // card that has an act: THE FIRST TAP SELECTS AND NOTHING ELSE; every tap
      // after it on the SAME card reaches the host's own handler. The `i` the
      // first tap reveals is a door beside the act, never in front of it, and a
      // press-and-hold is unaffected — it never came through `click` at all.
      //
      // `actionOwnsTouch` survives for the surfaces with no selecting beat to
      // spend (a card in the combat hand, the reward chooser whose click only
      // selects); `touchSelectionSafe` still lets a card whose act needs a
      // target keep its first tap.
      if (!actionOwnsTouch && touchTaps === 1 && !touchSelectionSafe) {
        // The selecting tap cannot reach buy, equip, burn or play handlers.
        event.preventDefault(); event.stopImmediatePropagation();
      }
    } else if (readOnly) open(card);
    if (readOnly) { event.preventDefault(); event.stopPropagation(); }
  });
  if (readOnly) {
    card.tabIndex = 0;
    card.setAttribute('role', 'group');
    card.setAttribute('aria-label', `${title}. Enter to inspect. On touch, tap then Information.`);
    card.addEventListener('keydown', event => {
      if (event.target !== card || !['Enter', ' '].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation(); select(); open(card);
    });
  }
  return info;
}
