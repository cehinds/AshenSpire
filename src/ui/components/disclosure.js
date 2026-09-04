// src/ui/components/disclosure.js — THE FACE / REVEAL RENDERER.
//
// D26. The words are model/disclosure.js; this is the one thing that draws
// them, so the creation screen and (by the handover packet, 2026-08-16) the F1
// combat frame render entries with one renderer instead of two that agree
// today. Two hand renderers cost this house a whole act once already.
//
// WHAT IT DRAWS, per group:
//
//   .disc-faces      the row of FACES — one control per entry whose own
//                    `disclosure` says 'face'. A face is a <button>: name and
//                    number, no prose, tap floor on both axes.
//   .disc-more       present ONLY when the data puts at least one entry behind
//                    it. Its count is the count — never a typed number — and
//                    when every entry is face-tier the control does not exist,
//                    because an expander that opens nothing is a lie about
//                    there being more.
//   .disc-reveal     ONE panel, holding the open entry: title, the authored
//                    sentence, the derived lines, and the RECEIPT last. One at
//                    a time on purpose — the short form stays short, and a
//                    phone that opens five sentences is the screen he asked us
//                    to stop shipping. It opens UNDER THE ROW THE TAPPED FACE
//                    IS ON — see WHERE IT OPENS, below.
//
// WHERE IT OPENS (MR-287, 2026-08-16). Constantine, on the shipped build:
// "in character creation, I would slect an item and instead of expanding under
// the ubtton it shows up at hte bottom for all of them as if I expanded the
// bottom button". He is describing this file. The panel used to be the NEXT
// SIBLING of `.disc-faces` — one fixed spot, after every face — so on any host
// whose faces occupy more than one line, a face on an earlier line opened a
// panel lines away from itself. Measured at 9d7764f, headless Chromium, the
// gap from the tapped face's bottom edge to the panel's top edge:
//
//   390x844   stats host    54.78 px on all five attribute faces (row 1 of 2)
//             armament host 153.56 / 104.17 / 54.78 px on rows 1-3 of 4
//   1200x730  stats host    56 px on eight of nine faces (rows 1-2 of 3)
//             armament host 156 / 106 / 56 px on rows 1-3 of 4
//
//   8 of 13 faces adrift at 390x844, 11 of 13 at 1200x730 — and the armament
//   host is the worse of the two per row, because every one of its faces is a
//   full-width line, so a four-row host has three wrong answers and one right
//   one. Both hosts, not one.
//
// THE PANEL IS NOW A ROW OF `.disc-faces` ITSELF — a `flex: 1 1 100%` item
// moved to just after the last face sharing the tapped face's line. The wrap
// then does the work: the panel lands on the line below, and the space between
// them is the container's OWN `row-gap`. That is the whole of it, and the
// reason it is done this way rather than by positioning: THE SEPARATION IS
// DERIVED, NOT TYPED. `tools/creationbrief.mjs` (MR-287) measures the gap
// against `getComputedStyle('.disc-faces').rowGap` read off the layout, so a
// panel placed by arithmetic would need a JS constant that agrees with a
// stylesheet number — a second copy of one fact, which is Law 0 clause 4 and
// the defect this house exists to catch. A flex row cannot disagree with its
// own container's gap.
//
// NOT DONE, and it was the instruction I was given: `place(anchor)` from
// components/tooltip.js was NOT extracted and wired here. Three reasons, and
// the first is the one that would have shipped a worse screen than the defect:
//   1. `place()` positions a `position: fixed` element against the VIEWPORT.
//      This panel is click-persistent inside `.cz-scroll`, which scrolls. A
//      tooltip gets away with the viewport because it dies on pointerleave; a
//      panel that stays open would detach from its face on the first scroll.
//      (Reasoned from `position: fixed`, not measured — named as reasoning.)
//   2. `place()` answers "beside it" — right, left, below, above, first that
//      fits — and at 1200x730 there is room to the right of most faces, so it
//      would open the panel BESIDE the face. He asked for *under the button*.
//   3. There was no second copy to collapse. Neither host places anything by
//      hand: both call one renderer, this one, and this one placed nothing.
//      Extracting `place()` would have ADDED a caller, not removed one. The
//      shared coordinate/clamp arithmetic already has one home in `ui/fx.js`.
//
// A LIVE REVEAL — the same mechanism, folding a PICKER instead of words.
// Constantine, 2026-08-16: "go ahead and allow the fold" (MR-151: default
// folded, expandable, D26's own mechanism applied to more items). An entry may
// hand this renderer a NODE (`reveal.node`) rather than a sentence: a picker
// that already exists on the screen and carries its own listeners. The renderer
// ADOPTS it — once, at mount, into the same one panel — and the fold is that
// panel's `hidden`. It never re-draws it, because re-drawing it is how a screen
// grows a second renderer.
//
// THIS BRANCH IS THREE LINES AND IT IS WHY THERE IS NO SECOND FILE. The
// creation screen's KEEPSAKE / SIGIL / TINT / SPRITE rows fold by the same
// face, the same tap, and the same published state as D26's stat entries.
// tools/handrenderers.mjs is already counting what a second hand renderer cost
// this house; tools/onefold.mjs counts the same debt here, and goes red on a
// planted second one.
//
// AND A FOLDED PICKER STILL NAMES WHAT IS CHOSEN. A face is a label AND a
// value — that is the contract the stat faces already keep, and a fold whose
// face said only SIGIL would hide the one thing a folded row exists to report.
// `setValue(key, value)` is how the screen keeps it true after a tap; the
// markup for a face lives in ONE place (faceHtml) so the two paths cannot
// drift into two shapes.
//
// HOW IT OPENS, and no second gesture is minted (model/disclosure.js says why):
//   TAP the face      → its reveal. Tap it again → closed. This is the whole
//                       affordance and it is the one a thumb already has.
//   HOVER / GP FOCUS  → the same words in the shared tooltip. A pointer and the
//                       pad get the tip for free; neither is required to read.
//
// WHAT IT PUBLISHES, so an instrument and a screenshot can read the state
// without becoming the finger (armInspect's rule, applied here):
//   data-face="<key>"        on every face, the model's own entry key
//   data-disclosure="face|reveal"  the tier the ENTRY declared, echoed as
//                            drawn — an instrument compares this against the
//                            content table and catches a screen that ignored it
//   aria-expanded + data-reveal="open|closed"  on the face
//   data-reveal-for="<key>"  on the panel while it is open
//
// REMOVAL CONDITION: deleted with model/disclosure.js — it has no other job.

import { attachTooltip, esc, hideTooltip } from './tooltip.js';
import { el, detailCard } from '../kit/index.js';

// THE KIT DRAWS IT (2026-09-04, the sweep). A face is an OptionCard
// (`.as-option`, kit §03) — a node face rides in a bare `hosts-face` card so the
// face can paint the whole surface — and the one reveal is a DetailCard. The
// `.disc-*` names stay on the kit elements because the tools read them; the
// stylesheet draws nothing for those names.

/** The reveal's words as a DetailCard's parts: name, the sense as prose, the derived lines, the receipt last. */
function revealHtml(entry) {
  const lines = (entry.reveal.lines || []).filter(Boolean);
  return `<p class="dc-name">${esc(entry.reveal.title)}</p>`
    + (entry.reveal.sense ? `<p class="as-prose disc-sense">${esc(entry.reveal.sense)}</p>` : '')
    + (lines.length ? `<ul class="dc-lines disc-lines">${lines.map((line) => `<li>${esc(line)}</li>`).join('')}</ul>` : '')
    + (entry.reveal.receipt ? `<span class="dc-meta disc-receipt">${esc(entry.reveal.receipt)}</span>` : '');
}

/** A FACE IS A LABEL, AN OPTIONAL ONE-LINE SUMMARY, AND A VALUE — an OptionCard's
 *  name, description and trailing StatusText. One home for that markup, because
 *  it is drawn at mount and re-drawn every time a folded picker's choice changes;
 *  two spellings of it would be two answers to "what did I pick?". */
function faceHtml(entry) {
  return `<span class="ob"><span class="on"><b class="disc-name">${esc(entry.face.label)}</b></span>`
    + (entry.face.summary ? `<span class="od disc-summary">${esc(entry.face.summary)}</span>` : '')
    + '</span>'
    + (entry.face.value === '' || entry.face.value == null ? '' : `<span class="r-trail"><span class="as-status disc-value">${esc(entry.face.value)}</span></span>`);
}

/** The same words the panel shows, for the hover/focus tip. One source.
 *  A LIVE REVEAL has no words of its own — the picker IS the panel — so it
 *  gets whatever short sentence the screen authored beside it, or no tip at
 *  all. An empty tooltip is worse than none: it is a pointer that promises. */
function tipHtml(entry) {
  if (entry.reveal && entry.reveal.node) {
    return entry.reveal.sense ? `<p class="disc-sense">${esc(entry.reveal.sense)}</p>` : '';
  }
  const lines = (entry.reveal.lines || []).filter(Boolean);
  return `<div class="tt-title">${esc(entry.reveal.title)}</div>`
    + (entry.reveal.sense ? `<p>${esc(entry.reveal.sense)}</p>` : '')
    + (lines.length ? `<ul class="ti-list">${lines.map((line) => `<li>${esc(line)}</li>`).join('')}</ul>` : '')
    + (entry.reveal.receipt ? `<span class="as-flavor">${esc(entry.reveal.receipt)}</span>` : '');
}

/**
 * mountDisclosure(host, entries, { moreLabel, armFace? })
 *   → { open(key), close(), setValue(key, value), openKey }
 *
 * `entries` is the model's list, in model order. WHICH ONES ARE DRAWN UP FRONT
 * IS READ OFF `entry.disclosure` — there is no id list here, and adding one is
 * the defect tools/creationbrief.mjs plants.
 *
 * An entry whose `reveal.node` is a live element folds THAT ELEMENT: it is
 * adopted into the panel at mount and the panel starts `hidden`, so the
 * arrival screen is short and one tap opens it. Default folded — his word.
 */
export function mountDisclosure(host, entries, { moreLabel = 'more', armFace = null, layout = 'flow' } = {}) {
  const rows = [...(entries || [])];
  const faces = rows.filter((entry) => entry.disclosure === 'face');
  const behind = rows.filter((entry) => entry.disclosure !== 'face');
  // The panel is a CHILD of `.disc-faces`, not its sibling: it is a full-width
  // row of the same wrap, so `open()` can move it under the tapped face's line
  // and the gap it lands with is the container's own `row-gap` (see WHERE IT
  // OPENS, top of file). While shut it is `hidden` — `display: none` — so it is
  // not a flex item at all and contributes no row and no gap.
  //
  // The faces are the kit's option list — a wrapping `flow` of self-sized
  // cards, or a `column` where every face is a full-width row (the Armoury's
  // inventory and character numbers). The panel starts LAST, not first: an
  // instrument asking for "the first inventory item" must meet a face, never
  // the shut reveal that carries the same item key.
  host.replaceChildren(el('div', { class: `as-options disc-faces${layout === 'column' ? '' : ' flow'}` }));
  const faceBox = host.querySelector('.disc-faces');
  const panel = detailCard({ attrs: { class: 'disc-reveal', hidden: true } });
  const buttons = new Map();
  let openKey = null;
  // The live nodes this host folds — ONE PER ENTRY since E4 (#249), because a
  // host with six folded pickers is the creation screen and a host with four
  // is the shop, and "one held node per mount" was a limit of the first
  // caller, not a rule of the mechanism. Each is adopted ONCE, at mount: a
  // picker re-parented on every open would lose nothing visible and would
  // still be a second renderer's habit — move it in, then only `hidden` moves.
  // INLINE display, NOT the hidden attribute, and the choice is a measured
  // one (E4): `[hidden]`'s UA rule is `display: none` at attribute-selector
  // specificity, and the adopted pickers carry author display rules at the
  // same specificity (`.cz-opts { display: flex }`, `.class-row`,
  // `.cz-keepsakes`) — author origin wins, so `hidden` on these nodes paints
  // ANYWAY. Watched red through creationbrief before this line: five shut
  // sections with every option on the glass. An inline style loses to
  // nothing but !important, which nothing here uses. The attribute is still
  // set for what it is — semantics — while the inline style owns the paint.
  const held = new Map();
  const stash = (node) => { node.hidden = true; node.style.display = 'none'; };
  const surface = (node) => { node.hidden = false; node.style.display = ''; };
  for (const entry of rows) {
    if (entry.reveal && entry.reveal.node) {
      stash(entry.reveal.node);
      held.set(entry.key, entry.reveal.node);
      panel.appendChild(entry.reveal.node);
    }
  }
  // Word reveals render HERE, never into panel.innerHTML: the panel now owns
  // adopted nodes, and innerHTML on the shared parent would destroy them. The
  // wrapper is invisible to every selector in ui.css (all descend from
  // `.disc-reveal`) and to onefold.mjs's vocabulary count, checked when added.
  const words = document.createElement('div');
  words.className = 'disc-words';
  words.hidden = true;
  panel.appendChild(words);

  function close() {
    openKey = null;
    panel.hidden = true;
    words.hidden = true;
    words.innerHTML = '';
    for (const node of held.values()) stash(node);
    panel.removeAttribute('data-reveal-for');
    for (const button of buttons.values()) {
      button.setAttribute('aria-expanded', 'false');
      button.dataset.reveal = 'closed';
      button.classList.remove('is-selected');
    }
  }

  /**
   * Move the panel to just after the last face sharing `button`'s line, so the
   * wrap drops it onto the line below with one `row-gap` between them.
   *
   * IT IS READ, NOT COUNTED. "Same line" is `getBoundingClientRect().top`, the
   * laid-out answer — not an index, not a faces-per-row arithmetic, and not a
   * breakpoint. `.disc-faces` wraps by flex, and how many faces fit a line is
   * decided by the widths the browser resolved at this Text size, this UI zoom
   * and this viewport. Anything that predicts that number is a second copy of
   * the layout's own decision and will be wrong on the shape nobody photographed.
   *
   * MUST BE CALLED WHILE THE PANEL IS SHUT. A visible panel is a flex item and
   * occupies a line of its own, so measuring with it open measures the layout
   * the last open made — the same "where it was decided how big it is, which
   * decided where it goes next" trap tooltip.js's place() zeroes itself for.
   */
  function placeUnderRow(button) {
    if (!button) return;
    const kin = [...faceBox.children].filter((el) => el !== panel);
    const line = button.getBoundingClientRect().top;
    // The first sibling that starts a LATER line — the panel goes before it.
    // `+ 1` is subpixel slack, not a tolerance on the question: faces on one
    // line share a top exactly, because `.disc-faces` is `align-items: stretch`.
    const next = kin.find((el) => el.getBoundingClientRect().top > line + 1);
    faceBox.insertBefore(panel, next || null);
  }

  function open(key) {
    const entry = rows.find((row) => row.key === key);
    if (!entry) return;
    close();
    openKey = key;
    const node = held.get(key);
    if (node) surface(node);
    else {
      words.innerHTML = revealHtml(entry);
      words.hidden = false;
    }
    const button = buttons.get(key);
    // Placed BEFORE it is un-hidden: see placeUnderRow.
    placeUnderRow(button);
    panel.hidden = false;
    panel.dataset.revealFor = key;
    if (button) {
      button.setAttribute('aria-expanded', 'true');
      button.dataset.reveal = 'open';
      button.classList.add('is-selected');
    }
  }

  /** The folded row keeps reporting the current choice after it changes. */
  function setValue(key, value) {
    const entry = rows.find((row) => row.key === key);
    const button = buttons.get(key);
    if (!entry || !button) return;
    // A NODE FACE HAS NO VALUE SLOT — see drawFace. Rewriting innerHTML here
    // would delete the adopted card and leave a button with a name in it, which
    // reads as "it worked" and is the failure this seat is for.
    if (entry.face && entry.face.node) return;
    entry.face.value = value;
    button.innerHTML = faceHtml(entry);
  }

  function drawFace(entry) {
    const button = document.createElement('button');
    button.type = 'button';
    // An OptionCard without the chevron: the tap opens under it, not onward.
    button.className = `as-option noarrow disc-face disc-${entry.kind}${entry.face && entry.face.node ? ' hosts-face' : ''}${entry.face && entry.face.compact ? ' compact' : ''}`;
    button.dataset.face = entry.key;
    // The tier as the ENTRY declared it, echoed on the control that was drawn.
    // A screen that stopped reading the field prints the contradiction here.
    button.dataset.disclosure = entry.disclosure;
    button.dataset.reveal = 'closed';
    button.setAttribute('aria-expanded', 'false');
    // A FACE MAY BE A NODE (Viki, 2026-08-21, for the Armoury's item panes).
    // Constantine: *"it should be part of the card and is revealed pressing the
    // card instead"* — so the CARD has to be the pressable thing, and a card is
    // art plus four spans, not a label and a value. The alternative was a second
    // hand-built fold in equipment.js, which is the debt tools/onefold.mjs
    // exists to count; this keeps ONE renderer of the affordance.
    //
    // ADDITIVE AND GUARDED: no existing caller passes `face.node`, so both
    // shipped callers (customize.js, shop.js) take the `faceHtml` road exactly
    // as before. `setValue` below refuses to touch a node face rather than
    // clobbering it — a word-reveal's value has no meaning for a face that is
    // an object, and silently erasing the card would be the plausible failure.
    if (entry.face && entry.face.node) button.appendChild(entry.face.node);
    else button.innerHTML = faceHtml(entry);
    const toggle = () => {
      hideTooltip();
      if (openKey === entry.key) close(); else open(entry.key);
    };
    // Composite Inventory faces use the same physical card for a short reveal
    // tap and a configured hold action. The caller owns that action and returns
    // true when it armed the face; every existing disclosure keeps the ordinary
    // one-click toggle path.
    const armed = armFace ? armFace({ button, entry, onTap: toggle }) === true : false;
    if (!armed) button.addEventListener('click', toggle);
    if (tipHtml(entry)) attachTooltip(button, () => tipHtml(entry));
    buttons.set(entry.key, button);
    faceBox.appendChild(button);
  }

  for (const entry of faces) drawFace(entry);
  // The panel joins the row AFTER the faces (see the note at the top of this
  // function); open() moves it under the tapped face's line.
  faceBox.appendChild(panel);

  // The expander exists only if the data put something behind it, and its
  // count is counted.
  if (behind.length) {
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'as-option noarrow more disc-face disc-more';
    more.dataset.more = String(behind.length);
    more.setAttribute('aria-expanded', 'false');
    more.innerHTML = `<span class="ob"><span class="on"><b class="disc-name">+${behind.length} ${esc(moreLabel)}</b></span></span>`;
    more.addEventListener('click', () => {
      const opened = more.getAttribute('aria-expanded') === 'true';
      if (opened) {
        for (const entry of behind) {
          const button = buttons.get(entry.key);
          if (button) button.remove();
          buttons.delete(entry.key);
        }
        if (behind.some((entry) => entry.key === openKey)) close();
        more.setAttribute('aria-expanded', 'false');
      } else {
        for (const entry of behind) drawFace(entry);
        faceBox.appendChild(more); // stays last, so the row reads in one order
        more.setAttribute('aria-expanded', 'true');
      }
      // THE EXPANDER RE-WRAPS THE HOST, so an open panel's line is no longer
      // the line it was placed for — adding four faces above it, or removing
      // them, moves every face after them. Re-opening the same key is the one
      // path that recomputes it, rather than a second copy of open()'s tail.
      if (openKey) open(openKey);
    });
    attachTooltip(more, () => `${behind.length} more, kept out of the way until you ask.`);
    faceBox.appendChild(more);
  }

  return { open, close, setValue, get openKey() { return openKey; } };
}
