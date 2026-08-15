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
//   .disc-reveal     ONE panel, below the row, holding the open entry: title,
//                    the authored sentence, the derived lines, and the RECEIPT
//                    last. One at a time on purpose — the short form stays
//                    short, and a phone that opens five sentences is the
//                    screen he asked us to stop shipping.
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

function revealHtml(entry) {
  const lines = (entry.reveal.lines || []).filter(Boolean);
  return `<h4>${esc(entry.reveal.title)}</h4>`
    + (entry.reveal.sense ? `<p class="disc-sense">${esc(entry.reveal.sense)}</p>` : '')
    + (lines.length ? `<ul class="disc-lines">${lines.map((line) => `<li>${esc(line)}</li>`).join('')}</ul>` : '')
    + (entry.reveal.receipt ? `<p class="disc-receipt">${esc(entry.reveal.receipt)}</p>` : '');
}

/** A FACE IS A LABEL AND A VALUE. One home for that markup, because it is
 *  drawn at mount and re-drawn every time a folded picker's choice changes;
 *  two spellings of it would be two answers to "what did I pick?". */
function faceHtml(entry) {
  return `<b class="disc-name">${esc(entry.face.label)}</b>`
    + (entry.face.value === '' || entry.face.value == null ? '' : `<span class="disc-value">${esc(entry.face.value)}</span>`);
}

/** The same words the panel shows, for the hover/focus tip. One source.
 *  A LIVE REVEAL has no words of its own — the picker IS the panel — so it
 *  gets whatever short sentence the screen authored beside it, or no tip at
 *  all. An empty tooltip is worse than none: it is a pointer that promises. */
function tipHtml(entry) {
  if (entry.reveal && entry.reveal.node) {
    return entry.reveal.sense ? `<p class="disc-sense">${esc(entry.reveal.sense)}</p>` : '';
  }
  return revealHtml(entry);
}

/**
 * mountDisclosure(host, entries, { moreLabel })
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
export function mountDisclosure(host, entries, { moreLabel = 'more' } = {}) {
  const rows = [...(entries || [])];
  const faces = rows.filter((entry) => entry.disclosure === 'face');
  const behind = rows.filter((entry) => entry.disclosure !== 'face');
  host.innerHTML = `<div class="disc-faces"></div><div class="disc-reveal" hidden></div>`;
  const faceBox = host.querySelector('.disc-faces');
  const panel = host.querySelector('.disc-reveal');
  const buttons = new Map();
  let openKey = null;
  // The one live node this host folds, if any. It is adopted ONCE: a picker
  // re-parented on every open would lose nothing visible and would still be a
  // second renderer's habit — move it in, then only `hidden` moves.
  const held = rows.find((entry) => entry.reveal && entry.reveal.node) || null;
  if (held) panel.appendChild(held.reveal.node);

  function close() {
    openKey = null;
    panel.hidden = true;
    if (!held) panel.innerHTML = '';
    panel.removeAttribute('data-reveal-for');
    for (const button of buttons.values()) {
      button.setAttribute('aria-expanded', 'false');
      button.dataset.reveal = 'closed';
    }
  }

  function open(key) {
    const entry = rows.find((row) => row.key === key);
    if (!entry) return;
    close();
    openKey = key;
    if (!held) panel.innerHTML = revealHtml(entry);
    panel.hidden = false;
    panel.dataset.revealFor = key;
    const button = buttons.get(key);
    if (button) {
      button.setAttribute('aria-expanded', 'true');
      button.dataset.reveal = 'open';
    }
  }

  /** The folded row keeps reporting the current choice after it changes. */
  function setValue(key, value) {
    const entry = rows.find((row) => row.key === key);
    const button = buttons.get(key);
    if (!entry || !button) return;
    entry.face.value = value;
    button.innerHTML = faceHtml(entry);
  }

  function drawFace(entry) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `disc-face disc-${entry.kind}`;
    button.dataset.face = entry.key;
    // The tier as the ENTRY declared it, echoed on the control that was drawn.
    // A screen that stopped reading the field prints the contradiction here.
    button.dataset.disclosure = entry.disclosure;
    button.dataset.reveal = 'closed';
    button.setAttribute('aria-expanded', 'false');
    button.innerHTML = faceHtml(entry);
    button.addEventListener('click', () => {
      hideTooltip();
      if (openKey === entry.key) close(); else open(entry.key);
    });
    if (tipHtml(entry)) attachTooltip(button, () => tipHtml(entry));
    buttons.set(entry.key, button);
    faceBox.appendChild(button);
  }

  for (const entry of faces) drawFace(entry);

  // The expander exists only if the data put something behind it, and its
  // count is counted.
  if (behind.length) {
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'disc-face disc-more';
    more.dataset.more = String(behind.length);
    more.setAttribute('aria-expanded', 'false');
    more.innerHTML = `<b class="disc-name">+${behind.length} ${esc(moreLabel)}</b>`;
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
    });
    attachTooltip(more, () => `${behind.length} more, kept out of the way until you ask.`);
    faceBox.appendChild(more);
  }

  return { open, close, setValue, get openKey() { return openKey; } };
}
