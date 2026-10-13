// workbench/modules/layout/card-layers-render.mjs — Layout Studio's Card layers render page. Served by
// the GAME server (the Workbench origin cannot import /src/*), it draws one card with the game's own
// card renderer (renderCard, src/ui/components/card.js, on the illustrated-card layers) and talks to
// the Workbench module over postMessage. Both directions are origin-checked: the parent origin comes
// from ?po=, and only messages from window.parent at that origin are obeyed.
//
// The draft is drawn by replacing the shared card template for this page only: the game's
// CARD_COMPONENTS.template is read at draw time, and this page is not the game, so nothing else changes.
//
// Page -> parent:  { source:'ashen-card-render', type:'ready', protocol, width, height }
//                  { source:'ashen-card-render', type:'refused' | 'failed' }
// Parent -> page:  { source:'ashen-card-module', type:'set', layout }   the draft layout document

import { renderCard } from '../../../src/ui/components/card.js';
import { fitIllustratedCards } from '../../../src/ui/components/illustratedCard.js';
import { createRegistries } from '../../../src/model/registries.js';
import { contentBundle } from '../../../src/content/index.js';
import { CARD_COMPONENTS } from '../../../src/content/cardComponents.generated.js';
import { RENDER_PROTOCOL, RENDER_SOURCE, MODULE_SOURCE, layoutProblems } from './card-layers-model.mjs';

const params = new URLSearchParams(location.search);
const parentOrigin = params.get('po') || '';
const stage = document.getElementById('stage');
const note = stage.querySelector('.cl-note');
// The sample card is a real ability card, so the game's own text, costs and tags are drawn.
const SAMPLE = { cardId: 'gorefireSlash', abilityRank: 1 };
const registries = createRegistries(contentBundle);
const post = (msg) => { if (parentOrigin) window.parent.postMessage({ source: RENDER_SOURCE, ...msg }, parentOrigin); };

/** Draw the card from a layout document (the saved one at load, a draft after each edit). */
function draw(layout) {
  CARD_COMPONENTS.template = layout;
  CARD_COMPONENTS.cards = {};
  note.hidden = true;
  let card;
  try {
    card = renderCard(registries, SAMPLE, { level: 'inspect' });
  } catch (err) {
    stage.replaceChildren(note);
    note.hidden = false;
    note.textContent = `The game could not draw the card: ${err.message}`;
    return false;
  }
  stage.replaceChildren(card);
  fitIllustratedCards([card]);
  return true;
}

window.addEventListener('message', (ev) => {
  if (!parentOrigin || ev.origin !== parentOrigin || ev.source !== window.parent) return;
  const d = ev.data;
  if (!d || d.source !== MODULE_SOURCE || d.type !== 'set') return;
  // A draft the schema check refuses is not drawn; the Workbench inspector shows why.
  if (!d.layout || layoutProblems(d.layout).length) { post({ type: 'refused' }); return; }
  if (!draw(d.layout)) post({ type: 'failed' });
});

const saved = CARD_COMPONENTS.template;
if (!draw(saved)) post({ type: 'failed' });
else post({ type: 'ready', protocol: RENDER_PROTOCOL, width: saved.width, height: saved.height });
