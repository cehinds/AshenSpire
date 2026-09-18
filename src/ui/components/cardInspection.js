import { openModal } from './modalShell.js';
import { hideTooltip } from './tooltip.js';
import { decorateKeywords } from './tooltipGlossary.js';
import { lightCard, countBeat, spendSelectingBeat, litCard } from './cardSelection.js';
import { selectionRevealDelayMs } from '../models/SelectionEffectModel.js';
import { cardDoorStackBelowPx, doorReadableMinPx } from '../models/CardSizeModel.js';

// WHICH CARD IS LIT AND HOW MANY BEATS IT HAS SPENT now live in
// ./cardSelection.js. They were two module-level `let`s here — shared by every
// card on the page, with `.inspection-selected` in the DOM as a second copy of
// the same fact and a `document.querySelectorAll` sweep reconciling them. That
// is why three shipped changes in three days broke the tap accounting: the
// state had no name, no test, and no way to be asked a question.
//
// The behaviour is unchanged. Selection is still page-wide; the sweep is gone
// because a card now hands the store the callback that puts it out.

// THE DOOR'S SHAPE BELONGS TO THE DOOR, NOT TO THE APP SHELL.
//
// Below the inspect card's own width plus the readable measure beside it there
// is no room for two columns, and the door reads top to bottom instead. A media
// query cannot read a custom property, so the comparison happens in JS and the
// stylesheet keys on `data-card-door` — which keeps card.json the one home for
// both numbers rather than having a breakpoint restate one of them.
//
// This lived in `src/main.js` and was WRONG THERE, measured rather than argued.
// Walking the import graph from every module script in every page at the repo
// root, FIVE pages reach this module and only ONE of them boots `main.js`:
//
//   index.html                  -> src/main.js                  door + main
//   armament-kits-preview.html  -> inline module script          door, no main
//   item-cards-preview.html     -> src/ui/previews/itemCards.js  door, no main
//   tooltip-review-scene.html   -> .../tooltipReviewEntry.js     door, no main
//   weapon-cards-preview.html   -> .../weaponCards.js            door, no main
//
// On those four the attribute was never written, so the door kept two columns
// at every width — measured on weapon-cards-preview.html at 390x844, the
// details column was 24.969px. That is not a column, it is a seam. The fix was
// in the app and the defect was in the component.
//
// (An earlier version of this comment named `docs/architecture-handoff/wireframe-gallery.html`
// as a host. It is not one and never was: it has a single CLASSIC script tag
// and no module script at all, and its 86 mentions of this file are embedded
// source-listing TEXT, not imports. The list above is the measured one.)
//
// So the decision sits beside the layout it governs. One listener for this
// module's life rather than one per door: the attribute is on `:root`, one door
// is open at a time, and a per-door listener would be a leak with no reader.
// THE THRESHOLD IS READ, NOT REMEMBERED. It was a module-level `const`
// computed once from the authored config, which was fine while the widths were
// authored-only and wrong the moment they became tunable: turning the inspect
// slider up moved `--card-w-inspect` and left the breakpoint at the old 704, so
// the door would sit beside a card too wide to fit next to it. The effective
// inspect width is whatever has been projected onto `:root`; the authored sum
// is the fallback for a page that projects nothing.
let doorShapeWatched = false;
function doorStackBelowPx() {
  const projected = getComputedStyle(document.documentElement).getPropertyValue('--card-w-inspect').trim();
  const inspect = Number.parseFloat(projected);
  if (!Number.isFinite(inspect) || inspect <= 0) return cardDoorStackBelowPx();
  return inspect + doorReadableMinPx();
}
function applyCardDoorShape() {
  const stacked = window.innerWidth < doorStackBelowPx();
  document.documentElement.dataset.cardDoor = stacked ? 'stacked' : 'beside';
}
function watchCardDoorShape() {
  applyCardDoorShape();
  if (doorShapeWatched) return;
  doorShapeWatched = true;
  window.addEventListener('resize', applyCardDoorShape);
}

/** Read-only composition shared by equipment and playing-card detail surfaces. */
export function cardInspectionLayout(card, details) {
  // Resolved as the layout is built, so a door opened on any host — the game,
  // the weapon preview, the wireframe gallery — reads the same shape.
  watchCardDoorShape();
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

// THE DOOR ASKS; IT DOES NOT DECIDE. This used to build exactly one button,
// label it `Play card`, and take its enabled state from a `getAction` whose
// default — set in card.js, inherited by every surface but combat — was
// "disabled, because you play cards from your combat hand". So the spoils
// screen offered a dead Play on the very card the player had come to take.
//
// It now receives a LIST of `{ id, verb, enabled, reason }` from
// services/cardActions.js and a `commands` map of `{ [id]: fn }` from the
// screen that owns the state. No verb is written in this file. A surface with
// nothing to offer passes an empty list and gets a reading door with no
// footer at all — which is the honest shape for the compendium, and is not
// the same thing as a greyed button apologising about combat.
//
// `actions` may be a function so a door that stands open while the run moves
// re-reads on press rather than acting on what was true when it opened. That
// is the one behaviour the old `getAction()`-on-click had right.
export function openCardInspection({ title, card, details, opener, actions = null, commands = {} }) {
  hideTooltip();
  document.getSelection()?.removeAllRanges();
  const read = () => {
    const rows = typeof actions === 'function' ? actions() : actions;
    return Array.isArray(rows) ? rows : [];
  };
  const rows = read();
  // The refusal sentence stands in the body, where a reader is already
  // looking, and only when there is one. An enabled act needs no caption:
  // the button says what it does.
  const blocked = rows.filter((row) => !row.enabled && row.reason);
  let note = null;
  if (blocked.length) {
    note = document.createElement('p');
    note.className = 'card-action-reason';
    note.setAttribute('role', 'status');
    note.textContent = blocked.map((row) => row.reason).join(' ');
    details.append(note);
  }
  const buttons = rows.map((row) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'card-inspection-act';
    button.dataset.act = row.id;
    button.textContent = row.verb;
    button.disabled = !row.enabled;
    if (row.reason) button.title = row.reason;
    return button;
  });
  // W1o: the header close is the way out. The footer holds only applicable
  // actions — one fills it — and a read-only door has no footer at all, not a
  // redundant Back beside the close it duplicates.
  const shell = openModal({ title, size: 'lg',
    className: 'card-inspection-modal', opener,
    primary: buttons[0] || null,
    secondary: buttons.slice(1),
    body: cardInspectionLayout(card, details) });
  for (const button of buttons) {
    button.addEventListener('click', () => {
      // Re-read rather than trusting the row this button was drawn from: the
      // door can stand open while the run moves underneath it.
      const current = read().find((row) => row.id === button.dataset.act);
      const commit = commands[button.dataset.act];
      if (!current || !current.enabled || typeof commit !== 'function') {
        button.disabled = true;
        if (current && current.reason) {
          button.title = current.reason;
          if (note) note.textContent = current.reason;
        }
        return;
      }
      button.disabled = true;
      shell.close();
      commit();
    });
  }
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
export function bindCardInspection(card, { title, open, readOnly = false, touchSelectionSafe = false, actionOwnsTouch = false, identity: givenIdentity = null }) {
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
    return Number.isFinite(ms) && ms >= 0 ? ms : selectionRevealDelayMs();
  };
  const revealInfo = () => {
    if (revealTimer !== null || card.classList.contains('inspection-info-visible')) return;
    revealTimer = setTimeout(() => {
      revealTimer = null;
      if (card.isConnected && card.classList.contains('inspection-selected')) {
        card.classList.add('inspection-info-visible');
      }
    }, revealDelayMs());
  };
  // A CALLER MAY NAME THE CARD'S LOGICAL IDENTITY. Selection is page-wide and
  // keyed by identity, so two faces of the SAME item are one lit card — which
  // is right on a screen (a picker rebuilt under you keeps your choice) and
  // wrong in the component catalogue, where three faces of one item exist
  // precisely to be compared side by side. Without this, selecting any of them
  // promoted all three to `focus` and destroyed the comparison they are there
  // to show. Defaults to the DOM's own answer, so every screen is unchanged.
  const identity = givenIdentity || card.dataset.instanceId || card.dataset.item || card.dataset.cardId || title;
  // HOW THIS CARD PUTS ITSELF OUT. The store calls this on the card that was
  // lit before, so nothing traverses the document looking for it. A pending
  // reveal is cancelled with it: otherwise it lands after the card has lost
  // selection, showing an information button on a card nobody chose.
  const douse = () => {
    card.classList.remove('inspection-selected', 'inspection-info-visible', 'selected');
    card.setAttribute('aria-pressed', 'false');
    card.removeAttribute('aria-current');
    card.dispatchEvent(new CustomEvent('cardinspectioncancelreveal'));
    // HOW A FACE LEARNS IT MUST SAY LESS AGAIN. A card's presentation level
    // (src/model/cardFields.js) is `focus` while it is lit and its floor when
    // it is not, so the two cards whose level changed on any selection are
    // exactly the one newly lit and the one the store has just doused — and
    // the store hands us that second one by calling this. The event is fired
    // ON THE CARD ITSELF, so the face that repaints is that card and no other:
    // dev deliberately deleted the `document.querySelectorAll` sweep this
    // would otherwise grow back (see the header of cardSelection.js), and a
    // sweep is also how a card removed from the DOM kept being reconciled.
    card.dispatchEvent(new CustomEvent('cardinspectiondouse'));
  };
  const select = () => {
    lightCard(identity, douse);
    card.classList.add('inspection-selected');
    card.setAttribute('aria-pressed', 'true');
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
    spendSelectingBeat(identity, douse);
    select(); open(info);
  });
  card.addEventListener('cardinspectioncancelreveal', () => {
    clearTimeout(revealTimer);
    revealTimer = null;
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
    spendSelectingBeat(identity, douse);
    select(); revealInfo();
  });
  // A REBUILT CARD ADOPTS THE SELECTION IT ALREADY HELD.
  //
  // Selection is keyed by LOGICAL identity precisely so it survives a host
  // re-render — that is the store's stated contract, and it is what lets a
  // screen repaint its grid without losing the player's choice. But the store
  // also holds the previous card's `douse`, closed over a node that the
  // rebuild has just detached. So the replacement read as lit (its level
  // resolved to `focus`) while carrying none of the selected classes, and
  // lighting a different card only doused the detached ghost — leaving the
  // replacement stuck in the focused presentation with no way out.
  //
  // Re-registering here is the fix that keeps the contract rather than
  // trading it away: clearing the selection before a rebuild would fix the
  // stuck card by discarding the very thing identity-keying exists to
  // preserve. `lightCard` replaces the douse for an already-lit id and keeps
  // its beats, so the count a player has spent survives the repaint too.
  //
  // THE STORE HOLDS ONE DOUSE PER IDENTITY, and this makes that visible rather
  // than causing it. Where several LIVE cards share one identity — the creation
  // screen's left and right hand pickers offer the same pieces, and a shop's
  // faces can fall through to `title` — every one of them lights here, and only
  // the last to bind owns the douse, so the others keep the glow until they are
  // rebuilt. That is the pre-existing shape of a page-wide store keyed by
  // identity, unchanged by this block and reproducible without it; scoping
  // selection per grid is the fix for it and is its own question.
  if (litCard() === identity) {
    lightCard(identity, douse);
    card.classList.add('inspection-selected');
    card.setAttribute('aria-pressed', 'true');
    card.setAttribute('aria-current', 'true');
  }
  card.append(info, more);
  card.addEventListener('pointerdown', event => { touch = event.pointerType === 'touch'; });
  card.addEventListener('click', event => {
    if (event.target === info) return;
    select();
    revealInfo();
    if (touch) {
      const touchTaps = countBeat(identity, douse);
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
