import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { learnClassCard } from '../src/model/classLibraryState.js';
import { mountEquipment } from '../src/ui/screens/equipment.js';
import { resetModalState } from '../src/ui/modalManager.js';
import { withKitDom } from './helpers/dom.mjs';
import '../src/engine/runCombat.js';

const registries = createRegistries(contentBundle);
function fixture(dom, { classChoice = false } = {}) {
  resetModalState();
  dom.document.documentElement = dom.document.body;
  const run = createRunState({ seed: 11, classId: 'reaver', registries });
  run.loadout.storage = ['ashStaff'];
  run.attributes = { ...run.attributes, intelligence: 10, strength: 10 };
  if (classChoice) learnClassCard(registries, run, 'starseer');
  const screen = mountEquipment(dom.document.body, { registries, run, meta: { settings: { equipView: 'rack', holdConfirm: 'off' } }, inCombat: false,
    onChange(loadout) { run.loadout = loadout; }, onClose() {} });
  const root = dom.document.querySelector('.armoury-overlay');
  return { root, run, screen };
}
const position = (root, key) => root.querySelector(`[data-slot-position="${key}"]`);

test('Armoury redraw retains the shell, header, footer, pane and unchanged position cards', () => withKitDom(dom => {
  const { root, screen } = fixture(dom);
  const panel = root.querySelector('.armoury');
  const head = root.querySelector('.armoury-head');
  const foot = root.querySelector('.armoury-foot');
  const pane = root.querySelector('.armoury-pane');
  const list = root.querySelector('.armoury-position-list');
  const rows = [...root.querySelectorAll('[data-slot-position]')];
  pane.scrollTop = 142;
  screen.redraw();
  assert.equal(root.querySelector('.armoury'), panel);
  assert.equal(root.querySelector('.armoury-head'), head);
  assert.equal(root.querySelector('.armoury-foot'), foot);
  assert.equal(root.querySelector('.armoury-pane'), pane);
  assert.equal(root.querySelector('.armoury-position-list'), list);
  assert.deepEqual([...root.querySelectorAll('[data-slot-position]')], rows);
  assert.equal(pane.scrollTop, 142);
  position(root, 'rightHand:0').querySelector('.armament-replace').click();
  const picker = root.querySelector('.equip-picker');
  assert(picker.closest('.equip-item-choice'), 'replacement opens a modal');
  assert.equal(root.querySelector('.armoury-inventory .equip-picker'), null, 'no picker below the equipment rows');
  const candidate = root.querySelector('.equip-picker-row[data-item-id="ashStaff"]');
  screen.redraw();
  assert.equal(root.querySelector('.equip-picker'), picker, 'unchanged picker keeps its controls and holds');
  assert.equal(root.querySelector('.equip-picker-row[data-item-id="ashStaff"]'), candidate);
  screen.close();
}));

test('equipping from a child comparison updates the slot and preserves unrelated position DOM', () => withKitDom(dom => {
  const { root, run, screen } = fixture(dom);
  const panel = root.querySelector('.armoury');
  const pane = root.querySelector('.armoury-pane');
  const armor = position(root, 'armor:0');
  position(root, 'rightHand:0').querySelector('.armament-replace').click();
  const picked = root.querySelector('.equip-picker-row[data-item-id="ashStaff"]');
  assert(picked, 'staff candidate is offered');
  picked.querySelector('.equip-picker-act').click();
  const modal = root.querySelector('.equip-compare-modal');
  assert(modal, 'occupied position opens comparison');
  assert.equal(root.querySelector('.armoury'), panel);
  modal.querySelector('.equip-compare-equip').click();
  assert.equal(run.loadout.sets.rightHand[0], 'ashStaff');
  assert.equal(root.querySelector('.armoury'), panel);
  assert.equal(root.querySelector('.armoury-pane'), pane);
  assert.equal(position(root, 'armor:0'), armor, 'unchanged armor row retained');
  assert.match(position(root, 'rightHand:0').querySelector('.armament-position-name').textContent, /Ash Staff/);
  screen.close();
}));

test('switching between Character and Armory retains their modal shell and updates tab state', () => withKitDom(dom => {
  const { root, screen } = fixture(dom);
  const panel = root.querySelector('.armoury');
  const head = root.querySelector('.armoury-head');
  head.querySelector('[data-modal-tab="character"]').click();
  assert(root.querySelector('.armoury-character'));
  assert.equal(root.querySelector('.armoury'), panel);
  assert.equal(head.querySelector('[data-modal-tab="character"]').getAttribute('aria-selected'), 'true');
  const character = root.querySelector('.armoury-character');
  screen.redraw();
  assert.equal(root.querySelector('.armoury-character'), character, 'no unchanged figure rebuild');
  head.querySelector('[data-modal-tab="armory"]').click();
  assert(root.querySelector('.armoury-position-list'));
  assert.equal(root.querySelector('.armoury-head'), head);
  assert.equal(head.querySelector('[data-modal-tab="armory"]').getAttribute('aria-selected'), 'true');
  screen.close();
}));

test('redrawing a selected inventory card preserves its footer action and registered hold', () => withKitDom(dom => {
  const { root, screen } = fixture(dom, { classChoice: true });
  const face = root.querySelector('.inventory-face[data-inventory-item="class:starseer"]');
  assert(face, 'learned class choice is offered');
  face.parentNode.click();
  const action = root.querySelector('.armoury-foot-action');
  assert(action, 'selecting a class installs its action in the footer');
  assert.equal(action.dataset.footAct, 'class');
  const inventory = root.querySelector('.ep-list');
  screen.redraw();
  assert.equal(root.querySelector('.armoury-foot-action'), action);
  assert.equal(root.querySelector('.ep-list'), inventory);
  screen.close();
}));
