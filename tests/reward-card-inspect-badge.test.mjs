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
    // As the model does: an offer is claimed once its last pick is taken.
    onTake(i) { calls.push(['library', i]); offer.taken.push(i); if (offer.taken.length >= takeCount) offer.claimed = i; },
    onAddToDeck(i) { calls.push(['deck', i]); offer.taken.push(i); if (offer.taken.length >= takeCount) offer.claimed = i; },
    onContinue() { calls.push(['continue']); }, ...extra });
  return { app, run, offer, calls, faces: [...app.querySelectorAll('.reward-choice-face')], ids };
}
const modal = () => document.querySelector('.card-inspection-modal');
const tap = face => { face.dispatchEvent(new Event('pointerdown', { pointerType: 'touch', bubbles: true })); face.click(); };
// Owner 2026-11-20: a tap selects; the selected card's (i) opens its modal.
const info = face => face.querySelector('.card-info-button');
const inspect = face => { tap(face); info(face).click(); };

// Owner 2026-11-20: the card's own modal answers where it goes. Add to deck and Send to library stand side by side
// and one click claims the card; there is no Select step and no second page.
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
const acts = () => [...modal().querySelectorAll('.card-inspection-act')].map(node => [node.dataset.act, node.textContent]);

test('a reward face tap selects it and shows its (i); the (i) opens Add to deck and Send to library without a claim', () => withGlobalDom(() => {
  const { faces, calls, ids } = mount();
  for (const face of faces) assert.ok(info(face), 'every selectable reward card carries an (i)');
  tap(faces[1]);
  assert.equal(modal(), null, 'a tap never opens the modal');
  assert.deepEqual(faces.map(face => face.classList.contains('is-chosen')), [false, true, false]);
  info(faces[1]).click();
  assert.equal(modal().querySelector('.card').dataset.cardId, ids[1]);
  assert.deepEqual(acts().sort(), [['addToDeck', 'Add to deck'], ['addToLibrary', 'Send to library']]);
  modal().querySelector('.card-inspection-back').click();
  assert.equal(modal(), null);
  assert.deepEqual(calls, []);
}));

test('a press-and-hold on a reward card opens its modal and the release does not toggle it', () => withGlobalDom(async () => {
  const { faces, calls } = mount();
  faces[0].dispatchEvent(Object.assign(new Event('pointerdown', { bubbles: true }), { pointerType: 'touch', button: 0, clientX: 5, clientY: 5 }));
  await new Promise(resolve => setTimeout(resolve, 760));
  assert.ok(modal(), 'the hold opened the modal');
  faces[0].dispatchEvent(new Event('pointerup', { bubbles: true }));
  faces[0].click();
  assert.deepEqual(faces.map(face => face.classList.contains('is-chosen')), [false, false, false], 'the click after a completed read is swallowed: reading never picks');
  modal().querySelector('.card-inspection-back').click();
  assert.deepEqual(calls, []);
}));

for (const [action, destination] of [['addToDeck', 'deck'], ['addToLibrary', 'library']]) {
  test(`single-pick ${action} from the card modal claims it in one click and leaves`, () => withGlobalDom(async () => {
    const { faces, calls } = mount();
    inspect(faces[2]);
    const commit = modal().querySelector(`[data-act="${action}"]`);
    commit.click(); commit.click();
    await settle();
    assert.equal(modal(), null);
    assert.equal(document.querySelector('.confirmation-modal'), null, 'no second page');
    assert.deepEqual(calls, [[destination, 2], ['continue']]);
  }));
}

test('multi-pick: a card modal claim spends that pick and keeps the door open for the rest', () => withGlobalDom(async () => {
  const { app, faces, calls, offer } = mount({}, null, 2);
  inspect(faces[0]); modal().querySelector('[data-act="addToDeck"]').click();
  await settle();
  assert.deepEqual(calls, [['deck', 0]]);
  assert.deepEqual(offer.taken, [0]);
  const redrawn = [...app.querySelectorAll('.reward-choice-face')];
  inspect(redrawn[1]); modal().querySelector('[data-act="addToLibrary"]').click();
  await settle();
  assert.deepEqual(calls, [['deck', 0], ['library', 1], ['continue']]);
}));

test('a refused Add to deck is disabled with the reason; Send to library still claims', () => withGlobalDom(async () => {
  const { faces, calls } = mount({ addRefusal: () => 'full', deckMax: 40 });
  inspect(faces[0]);
  assert.equal(modal().querySelector('[data-act="addToDeck"]').disabled, true);
  assert.equal(modal().querySelector('[data-act="addToLibrary"]').disabled, false);
  modal().querySelector('[data-act="addToLibrary"]').click();
  await settle();
  assert.deepEqual(calls, [['library', 0], ['continue']]);
}));

test('a one-pick door with the deck editor open adds Edit deck to the card modal', () => withGlobalDom(async () => {
  const edits = [];
  const { faces, calls } = mount({ canEditDeck: true, onEditDeck: (i, back) => { edits.push(i); back(); } });
  inspect(faces[1]);
  assert.deepEqual(acts().map(([id]) => id).sort(), ['addToDeck', 'addToLibrary', 'editDeck']);
  modal().querySelector('[data-act="editDeck"]').click();
  await settle();
  assert.deepEqual(edits, [1]);
  assert.deepEqual(calls, [['library', 1], ['continue']]);
}));

test('duplicate card offers stay separate picks', () => withGlobalDom(async () => {
  const options = [{ kind: 'combatCards', id: 'frostNova' }, { kind: 'combatCards', id: 'frostNova' }];
  const { faces, calls } = mount({}, options, 2);
  inspect(faces[1]); modal().querySelector('[data-act="addToLibrary"]').click();
  await settle();
  assert.deepEqual(calls, [['library', 1]]);
}));

for (const [action, destination] of [['addToDeck', 'deck'], ['addToLibrary', 'library']]) {
  test(`mixed reward inspect ${action} claims one selected offer once`, () => withGlobalDom(async () => {
    const { faces, calls } = mount({}, [{ kind: 'combatCards', id: 'frostNova' }, { kind: 'relics', id: registries.relics.all()[0].id }]);
    inspect(faces[0]);
    const commit = modal().querySelector(`[data-act="${action}"]`);
    commit.click(); commit.click();
    await Promise.resolve();
    assert.equal(modal(), null);
    assert.deepEqual(calls, [[destination, 0], ['continue']]);
  }));
}

test('an offer claimed while its inspector stands cannot be claimed again', () => withGlobalDom(() => {
  const { faces, calls, offer } = mount();
  inspect(faces[0]);
  offer.taken.push(0); offer.claimed = 0;
  modal().querySelector('[data-act="addToDeck"]').click();
  assert.deepEqual(calls, []);
  assert.equal(modal().querySelector('[data-act="addToDeck"]').disabled, true);
  modal().querySelector('.card-inspection-back').click();
}));

test('a free armament reward opens Back and Confirm, and Confirm claims that offer once', () => withGlobalDom(async () => {
  const { faces, calls } = mount({}, [{ kind: 'weapons', id: registries.equipment.armaments[0].id }]);
  inspect(faces[0]);
  assert.ok(modal().querySelector('.equipment-poker-card'));
  const confirm = modal().querySelector('[data-act="take"]');
  assert.equal(confirm.textContent, 'Confirm');
  confirm.click(); confirm.click();
  await Promise.resolve();
  assert.deepEqual(calls, [['library', 0], ['continue']]);
}));
