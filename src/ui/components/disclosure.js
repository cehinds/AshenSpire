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

/** The same words the panel shows, for the hover/focus tip. One source. */
function tipHtml(entry) {
  return revealHtml(entry);
}

/**
 * mountDisclosure(host, entries, { moreLabel }) → { open(key), close() }
 *
 * `entries` is the model's list, in model order. WHICH ONES ARE DRAWN UP FRONT
 * IS READ OFF `entry.disclosure` — there is no id list here, and adding one is
 * the defect tools/creationbrief.mjs plants.
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

  function close() {
    openKey = null;
    panel.hidden = true;
    panel.innerHTML = '';
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
    panel.innerHTML = revealHtml(entry);
    panel.hidden = false;
    panel.dataset.revealFor = key;
    const button = buttons.get(key);
    if (button) {
      button.setAttribute('aria-expanded', 'true');
      button.dataset.reveal = 'open';
    }
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
    button.innerHTML = `<b class="disc-name">${esc(entry.face.label)}</b>`
      + (entry.face.value === '' || entry.face.value == null ? '' : `<span class="disc-value">${esc(entry.face.value)}</span>`);
    button.addEventListener('click', () => {
      hideTooltip();
      if (openKey === entry.key) close(); else open(entry.key);
    });
    attachTooltip(button, () => tipHtml(entry));
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

  return { open, close, get openKey() { return openKey; } };
}
