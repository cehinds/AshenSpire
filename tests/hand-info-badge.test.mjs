import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { withKitDom } from './helpers/kit-dom.mjs';
import { renderCard } from '../src/ui/components/card.js';
import { clearSelection } from '../src/ui/components/cardSelection.js';

// Owner 2026-11-04: "I meant for the (i) over cards to show up when selecting a
// card so that I don't accidentally inspect when I didn't want to." The combat
// hand (and only it) has the (i) badge, visible while the card is selected; a
// touch long press selects and never inspects.
const reg = createRegistries(contentBundle);
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

function withGlobalDom(fn) {
  const { dom, globals } = withKitDom((dom, globals) => ({ dom, globals }));
  const saved = Object.fromEntries(Object.keys(globals).map(key => [key, globalThis[key]]));
  Object.assign(globalThis, globals);
  dom.document.documentElement = dom.document.body;
  dom.document.getSelection = () => null;
  try { return fn(dom); } finally {
    clearSelection();
    for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
}

test('only a card that asks for it (the combat hand) is built with an (i) badge', () => withGlobalDom(() => {
  const plain = renderCard(reg, { cardId: 'strike' }, {});
  const hand = renderCard(reg, { cardId: 'strike' }, { infoBadge: true });
  assert.equal(plain.querySelector('.card-info-button'), null, 'a reward/shop/deck card has no badge');
  assert.ok(hand.querySelector('.card-info-button'), 'a hand card carries the badge');
}));

test('the badge opens the inspector; a tap on an unselected card only selects it', () => withGlobalDom(() => {
  const card = renderCard(reg, { cardId: 'strike' }, { infoBadge: true });
  document.body.append(card);
  card.click();
  assert.equal(document.querySelector('.card-inspection-modal'), null, 'tapping the face does not inspect');
  assert.ok(card.classList.contains('inspection-selected'), 'the tap selected the card');
  card.querySelector('.card-info-button').click();
  assert.ok(document.querySelector('.card-inspection-modal'), 'the (i) opens the shared inspector');
}));

test('a touch long press (contextmenu) on a hand card does not inspect; a mouse right-click and I still do', () => withGlobalDom(({ Event }) => {
  const card = renderCard(reg, { cardId: 'strike' }, { infoBadge: true });
  document.body.append(card);
  const touchMenu = new Event('contextmenu', { cancelable: true });
  touchMenu.pointerType = 'touch';
  card.dispatchEvent(touchMenu);
  assert.equal(document.querySelector('.card-inspection-modal'), null, 'long press opens nothing');
  card.dispatchEvent(new Event('contextmenu', { cancelable: true }));
  assert.ok(document.querySelector('.card-inspection-modal'), 'right-click opens the reading');
  document.querySelector('.card-inspection-modal .modal-close').click();
  card.dispatchEvent(new Event('keydown', { key: 'i', target: card, cancelable: true }));
  assert.ok(document.querySelector('.card-inspection-modal'), 'the I key opens it');
}));

test('the badge is shown only for the selected hand card, lifted above neighbouring cards', () => {
  const overlay = read('../src/ui/components/handInspectionOverlay.js');
  assert.match(overlay, /hand\.querySelector\('\.card\.inspection-selected'\)/, 'the portal follows the selected card only');
  assert.match(overlay, /if \(!selected\) return;/, 'no selection, no portal');
  assert.match(overlay, /restore\(\);/, 'losing the selection puts the badge back (hidden)');
  const kit = read('../styles/kit.css');
  assert.match(kit, /\.hand \.card-inspection-target > \.card-info-button \{ visibility:hidden; pointer-events:none; \}/);
  assert.match(kit, /\.hand-overlay > \.hand-info-portal\s*\{[^}]*z-index: 500/);
  assert.match(read('../styles/combat-layers.css'), /\.hand-info-portal\) \{\s*--inspect-box: calc\(44px/, '44px target');
  assert.equal(read('../src/ui/components/hand.js').match(/actionOwnsTouch: true, infoBadge: true/g)?.length, 2, 'both hand renderCard option sites ask for the badge');
});

test('no white Inspect cue returns to the card face', () => {
  assert.doesNotMatch(read('../src/ui/components/illustratedCard.js'), /inspect-cue/);
});

test('the (i) button keeps only Enter/Space; other keys reach the window handler', () => withGlobalDom(({ Event }) => {
  const card = renderCard(reg, { cardId: 'strike' }, { infoBadge: true });
  document.body.append(card);
  const info = card.querySelector('.card-info-button');
  const reached = [];
  const onKey = event => reached.push(event.key);
  card.addEventListener('keydown', onKey);
  for (const key of ['ArrowRight', 'Escape', '1', 'Enter', ' ']) {
    const event = new Event('keydown', { bubbles: true, cancelable: true });
    event.key = key;
    info.dispatchEvent(event);
  }
  card.removeEventListener('keydown', onKey);
  assert.deepEqual(reached, ['ArrowRight', 'Escape', '1'], 'only activation keys are isolated');
}));
