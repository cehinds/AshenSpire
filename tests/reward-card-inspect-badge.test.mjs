import test from 'node:test';
import assert from 'node:assert/strict';
import { withKitDom } from './helpers/dom.mjs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { MountGameProfileOffers } from '../src/ui/components/gameProfileOffers.js';
import { clearSelection } from '../src/ui/components/cardSelection.js';

const registries = createRegistries(contentBundle);
function withGlobalDom(fn) {
  const { dom, globals } = withKitDom((dom, globals) => ({ dom, globals }));
  const saved = Object.fromEntries(Object.keys(globals).map(key => [key, globalThis[key]]));
  Object.assign(globalThis, globals);
  dom.document.documentElement = dom.document.body;
  dom.document.getSelection = () => null;
  const cleanup = () => {
    clearSelection();
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  };
  try {
    const result = fn(dom);
    if (result?.then) return result.finally(cleanup);
    cleanup(); return result;
  } catch (error) { cleanup(); throw error; }
}
function mount(extra = {}, options = null) {
  const app = document.createElement('main'); app.id = 'app'; document.body.append(app);
  const run = { class: 'reaver', deck: [], sideboard: [], cinders: 0, xp: 0, skills: {} };
  const ids = ['frostNova', 'scholarsInsight', 'guardCounter'];
  const offer = { id: 'victory-inspect', options: options || ids.map(id => ({ kind: 'combatCards', id })), taken: [], claimed: null, takeCount: 1 };
  const calls = [];
  MountGameProfileOffers(app, { registries, run, offer, title: 'Victory rewards',
    onTake(i) { calls.push(['library', i]); offer.taken.push(i); offer.claimed = i; },
    onAddToDeck(i) { calls.push(['deck', i]); offer.taken.push(i); offer.claimed = i; },
    onContinue() { calls.push(['continue']); }, ...extra });
  return { app, run, offer, calls, faces: [...app.querySelectorAll('.reward-choice-face')], ids };
}
const modal = () => document.querySelector('.card-inspection-modal');
const tap = face => { face.dispatchEvent(new Event('pointerdown', { pointerType: 'touch', bubbles: true })); face.click(); };

test('first reward face press opens that card with Back and both acquire destinations, without a badge or claim', () => withGlobalDom(() => {
  const { faces, calls, ids } = mount();
  for (const face of faces) assert.equal(face.querySelector('.card-info-button'), null);
  tap(faces[1]);
  assert.equal(modal().querySelector('.card').dataset.cardId, ids[1]);
  assert.deepEqual([...modal().querySelectorAll('.card-inspection-act')].map(node => node.textContent).sort(), ['Add to deck', 'Add to library']);
  modal().querySelector('.card-inspection-back').click();
  assert.equal(modal(), null);
  assert.deepEqual(calls, []);
  assert.equal(document.activeElement, faces[1]);
  tap(faces[2]);
  assert.equal(modal().querySelector('.card').dataset.cardId, ids[2]);
  modal().querySelector('.card-inspection-back').click();
}));

test('reward name selection opens the same acquire inspector', () => withGlobalDom(() => {
  const { app, faces } = mount();
  app.querySelectorAll('.reward-choice-button')[2].click();
  assert.equal(modal().querySelector('.card').dataset.cardId, 'guardCounter');
  assert.equal(faces[2].classList.contains('is-chosen'), true);
  modal().querySelector('.card-inspection-back').click();
}));

for (const [action, destination] of [['addToDeck', 'deck'], ['addToLibrary', 'library']]) {
  test(`reward inspect ${action} claims one selected offer once`, () => withGlobalDom(async () => {
    const { faces, calls } = mount();
    tap(faces[1]);
    const commit = modal().querySelector(`[data-act="${action}"]`);
    commit.click(); commit.click();
    await Promise.resolve();
    assert.equal(modal(), null);
    assert.deepEqual(calls, [[destination, 1], ['continue']]);
  }));
}

test('a full deck disables only Add to deck, leaving Add to library available', () => withGlobalDom(() => {
  const { faces, calls } = mount({ addRefusal: () => 'full', deckMax: 10 });
  tap(faces[0]);
  assert.equal(modal().querySelector('[data-act="addToDeck"]').disabled, true);
  assert.equal(modal().querySelector('[data-act="addToLibrary"]').disabled, false);
  assert.match(modal().querySelector('.card-action-reason').textContent, /10/);
  modal().querySelector('.card-inspection-back').click();
  assert.deepEqual(calls, []);
}));

test('an offer claimed while its inspector stands cannot be acquired again', () => withGlobalDom(() => {
  const { faces, calls, offer } = mount();
  tap(faces[0]);
  offer.taken.push(0); offer.claimed = 0;
  modal().querySelector('[data-act="addToDeck"]').click();
  assert.deepEqual(calls, []);
  assert.equal(modal().querySelector('[data-act="addToDeck"]').disabled, true);
  modal().querySelector('.card-inspection-back').click();
}));

test('a free armament reward opens Back and Confirm, and Confirm claims that offer once', () => withGlobalDom(async () => {
  const { faces, calls } = mount({}, [{ kind: 'weapons', id: registries.equipment.armaments[0].id }]);
  tap(faces[0]);
  assert.ok(modal().querySelector('.equipment-poker-card'));
  const confirm = modal().querySelector('[data-act="take"]');
  assert.equal(confirm.textContent, 'Confirm');
  confirm.click(); confirm.click();
  await Promise.resolve();
  assert.deepEqual(calls, [['library', 0], ['continue']]);
}));
