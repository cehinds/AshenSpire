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
function mount(extra = {}, options = null, takeCount = 1) {
  const app = document.createElement('main'); app.id = 'app'; document.body.append(app);
  const run = { class: 'reaver', deck: [], sideboard: [], cinders: 0, xp: 0, skills: {} };
  const ids = ['frostNova', 'scholarsInsight', 'guardCounter'];
  const offer = { id: 'victory-inspect', options: options || ids.map(id => ({ kind: 'combatCards', id })), taken: [], claimed: null, takeCount };
  const calls = [];
  MountGameProfileOffers(app, { registries, run, offer, title: 'Victory rewards',
    onTake(i) { calls.push(['library', i]); offer.taken.push(i); offer.claimed = i; },
    onAddToDeck(i) { calls.push(['deck', i]); offer.taken.push(i); offer.claimed = i; },
    onContinue() { calls.push(['continue']); }, ...extra });
  return { app, run, offer, calls, faces: [...app.querySelectorAll('.reward-choice-face')], ids };
}
const modal = () => document.querySelector('.card-inspection-modal');
const tap = face => { face.dispatchEvent(new Event('pointerdown', { pointerType: 'touch', bubbles: true })); face.click(); };

test('first reward face press opens that card with Back and Select, without a badge or claim', () => withGlobalDom(() => {
  const { faces, calls, ids } = mount();
  for (const face of faces) assert.equal(face.querySelector('.card-info-button'), null);
  tap(faces[1]);
  assert.equal(modal().querySelector('.card').dataset.cardId, ids[1]);
  assert.equal(modal().querySelector('[data-act="select"]').textContent, 'Select card');
  assert.deepEqual(faces.map(face => face.classList.contains('is-chosen')), [false, false, false]);
  modal().querySelector('.card-inspection-back').click();
  assert.equal(modal(), null);
  assert.deepEqual(calls, []);
  assert.equal(document.activeElement, faces[1]);
}));

test('inspector Select and Deselect change exactly that pick, preserving every other choice', () => withGlobalDom(() => {
  const { app, faces, calls } = mount({}, null, 2);
  app.querySelectorAll('.reward-choice-button')[0].click();
  tap(faces[1]); modal().querySelector('[data-act="select"]').click();
  assert.deepEqual(faces.map(face => face.classList.contains('is-chosen')), [true, true, false]);
  tap(faces[1]);
  assert.equal(modal().querySelector('[data-act="select"]').textContent, 'Deselect card');
  modal().querySelector('[data-act="select"]').click();
  assert.deepEqual(faces.map(face => face.classList.contains('is-chosen')), [true, false, false]);
  assert.deepEqual(calls, []);
}));

test('a full multi-pick selection disables selecting another card while allowing reading and Back', () => withGlobalDom(() => {
  const { app, faces, calls } = mount({}, null, 2);
  const controls = app.querySelectorAll('.reward-choice-button');
  controls[0].click(); controls[1].click();
  tap(faces[2]);
  assert.equal(modal().querySelector('[data-act="select"]').disabled, true);
  assert.match(modal().querySelector('.card-action-reason').textContent, /chosen 2/);
  modal().querySelector('.card-inspection-back').click();
  assert.deepEqual(faces.map(face => face.classList.contains('is-chosen')), [true, true, false]);
  assert.deepEqual(calls, []);
}));

test('single-pick selection moves through the inspector action without claiming', () => withGlobalDom(() => {
  const { app, faces, calls } = mount();
  app.querySelectorAll('.reward-choice-button')[0].click();
  tap(faces[2]); modal().querySelector('[data-act="select"]').click();
  assert.deepEqual(faces.map(face => face.classList.contains('is-chosen')), [false, false, true]);
  assert.deepEqual(calls, []);
}));

test('duplicate card offers stay separate picks', () => withGlobalDom(() => {
  const options = [{ kind: 'combatCards', id: 'frostNova' }, { kind: 'combatCards', id: 'frostNova' }];
  const { faces, calls } = mount({}, options, 2);
  tap(faces[1]); modal().querySelector('[data-act="select"]').click();
  assert.deepEqual(faces.map(face => face.classList.contains('is-chosen')), [false, true]);
  assert.deepEqual(calls, []);
}));

for (const [action, destination] of [['addToDeck', 'deck'], ['addToLibrary', 'library']]) {
  test(`mixed reward inspect ${action} claims one selected offer once`, () => withGlobalDom(async () => {
    const { faces, calls } = mount({}, [{ kind: 'combatCards', id: 'frostNova' }, { kind: 'relics', id: registries.relics.all()[0].id }]);
    tap(faces[0]);
    const commit = modal().querySelector(`[data-act="${action}"]`);
    commit.click(); commit.click();
    await Promise.resolve();
    assert.equal(modal(), null);
    assert.deepEqual(calls, [[destination, 0], ['continue']]);
  }));
}

test('an offer claimed while its inspector stands cannot be selected', () => withGlobalDom(() => {
  const { faces, calls, offer } = mount();
  tap(faces[0]);
  offer.taken.push(0); offer.claimed = 0;
  modal().querySelector('[data-act="select"]').click();
  assert.deepEqual(calls, []);
  assert.equal(modal().querySelector('[data-act="select"]').disabled, true);
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
