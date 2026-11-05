import test from 'node:test';
import assert from 'node:assert/strict';
import { withKitDom } from './helpers/kit-dom.mjs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { mountGameProfileOffers } from '../src/ui/components/gameProfileOffers.js';
import { clearSelection } from '../src/ui/components/cardSelection.js';
import { readFileSync } from 'node:fs';

// Owner 2026-11-05: "No way to inspect reward cards." The selected reward card wears the
// hand's (i) badge; the badge, or a second tap on the selected face, opens the inspector.
const registries = createRegistries(contentBundle);

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

function mount() {
  const app = document.createElement('main'); app.id = 'app'; document.body.append(app);
  const run = { class: 'reaver', deck: [], sideboard: [], cinders: 0, xp: 0, skills: {} };
  const ids = ['frostNova', 'scholarsInsight', 'guardCounter'];
  const offer = { id: 'victory-inspect', options: ids.map(id => ({ kind: 'combatCards', id })), taken: [], claimed: null, takeCount: 1 };
  mountGameProfileOffers(app, { registries, run, offer, title: 'Victory rewards', onTake() {}, onContinue() {}, onAddToDeck() {} });
  return { app, faces: [...app.querySelectorAll('.reward-choice-face')], ids };
}
const modal = () => document.querySelector('.card-inspection-modal');
const tap = face => { face.dispatchEvent(new Event('pointerdown', { pointerType: 'touch', bubbles: true })); face.click(); };

test('every reward card carries a badge, and only the selected one is shown', () => withGlobalDom(() => {
  const { faces } = mount();
  assert.equal(faces.length, 3);
  for (const face of faces) assert.ok(face.querySelector('.card-info-button'), 'built with an (i)');
  assert.deepEqual(faces.map(f => f.classList.contains('inspection-selected')), [false, false, false]);
  tap(faces[1]);
  assert.deepEqual(faces.map(f => f.classList.contains('is-chosen')), [false, true, false], 'badge shows on the chosen card only');
  const css = readFileSync(new URL('../styles/kit.css', import.meta.url), 'utf8');
  assert.match(css, /\.reward-door \.reward-choice-face\.is-chosen > \.card-info-button \{ visibility:visible; pointer-events:auto; \}/);
}));

test('the first face tap only selects; the second opens the inspector', () => withGlobalDom(() => {
  const { faces } = mount();
  tap(faces[0]);
  assert.equal(modal(), null, 'first tap does not inspect');
  assert.ok(faces[0].classList.contains('reward-selected'));
  tap(faces[0]);
  assert.ok(modal(), 'second tap on the selected face inspects');
  modal().querySelector('.modal-close').click();
  assert.equal(modal(), null);
  tap(faces[2]);
  assert.equal(modal(), null, 'a tap on another card selects it, never inspects');
}));

test('the (i) badge opens the inspector for that card and closing restores focus to it', () => withGlobalDom(() => {
  const { faces } = mount();
  tap(faces[1]);
  const info = faces[1].querySelector('.card-info-button');
  info.click();
  const dialog = modal();
  assert.ok(dialog, 'badge opens the shared inspector');
  assert.equal(dialog.querySelector('.card[data-level="inspect"]')?.dataset.cardId, 'scholarsInsight', 'the inspector shows that card');
  dialog.querySelector('.modal-close').click();
  assert.equal(modal(), null);
  assert.equal(document.activeElement, info, 'focus returns to the opener');
  assert.ok(faces[1].classList.contains('reward-selected'), 'inspecting keeps the selection');
}));

const names = app => [...app.querySelectorAll('.reward-choice-button')];
const chosen = faces => faces.map(f => f.classList.contains('is-chosen'));

test('selecting by name button chooses that card, so its (i) is the one shown', () => withGlobalDom(() => {
  const { app, faces } = mount();
  names(app)[2].click();
  assert.deepEqual(chosen(faces), [false, false, true], 'the badge is keyed to the chooser state, not the face-tap light');
  assert.equal(modal(), null, 'selecting never inspects');
}));

test('face A then name B moves the (i) to B', () => withGlobalDom(() => {
  const { app, faces } = mount();
  tap(faces[0]);
  assert.deepEqual(chosen(faces), [true, false, false]);
  names(app)[1].click();
  assert.deepEqual(chosen(faces), [false, true, false], 'A loses the (i), B has it');
  faces[1].querySelector('.card-info-button').click();
  assert.equal(modal().querySelector('.card[data-level="inspect"]')?.dataset.cardId, 'scholarsInsight', 'the inspector shows B');
  modal().querySelector('.modal-close').click();
}));

test('tapping B face after its name select opens the inspector; A face then only selects', () => withGlobalDom(() => {
  const { app, faces } = mount();
  names(app)[1].click();
  assert.equal(modal(), null);
  tap(faces[1]);
  assert.ok(modal(), 'the chosen card inspects on a face tap');
  modal().querySelector('.modal-close').click();
  tap(faces[0]);
  assert.equal(modal(), null, 'an unchosen face only selects');
  assert.deepEqual(chosen(faces), [true, false, false]);
}));
