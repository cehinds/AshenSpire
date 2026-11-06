// SPEC §14.3: the Inventory may equip one learned card or leave the core slot empty. With the item grid gone (owner
// 2026-11-06) the Armory's compact Inventory section lists a learned class card whenever there is a choice to make.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { equipClassCard } from '../src/model/classLibrary.js';
import { learnClassCard } from '../src/model/classLibraryState.js';
import { withKitDom } from './helpers/kit-dom.mjs';
import { mountEquipment } from '../src/ui/screens/equipment.js';

const REG = createRegistries(contentBundle);

// The kit DOM fixture lacks four things the Armoury reads; each is supplied
// here, minimally, for this file only.
function armouryDom(dom) {
  if (!dom.document.documentElement) dom.document.documentElement = dom.document.createElement('html');
  globalThis.NodeFilter = globalThis.NodeFilter || { SHOW_TEXT: 4 };
  dom.document.createTreeWalker = () => ({ nextNode: () => false, currentNode: null });
  const proto = Object.getPrototypeOf(dom.document.body);
  proto.replaceWith = proto.replaceWith || function replaceWith(node) {
    const parent = this.parentNode;
    if (!parent) return;
    const at = parent.children.indexOf(this);
    node.remove?.();
    node.parentNode = parent;
    parent.children.splice(at, 1, node);
    this.parentNode = null;
  };
  if (!Object.getOwnPropertyDescriptor(proto, 'parentElement')) {
    Object.defineProperty(proto, 'parentElement', { configurable: true, get() { return this.parentNode || null; } });
  }
}


function mount(dom, run, inCombat = false) {
  const app = dom.document.createElement('main');
  dom.document.body.replaceChildren(app);
  mountEquipment(app, { registries: REG, run, meta: { settings: { equipView: 'hybrid' } }, inCombat, onClose() {}, onChange() {} });
  return dom.document.body.querySelectorAll('.inventory-face').filter((node) => String(node.dataset.inventoryItem).startsWith('class:'));
}

test('a lone equipped class card is not listed; a second learned card and an empty core slot are', () => {
  withKitDom((dom) => {
    armouryDom(dom);
    const run = createRunState({ seed: 3, classId: 'reaver', registries: REG });
    assert.equal(mount(dom, run).length, 0, 'one learned card, equipped: nothing to choose');
    learnClassCard(REG, run, 'starseer');
    const faces = mount(dom, run);
    assert.equal(faces.length, 2, 'two learned cards: both listed');
    faces.find((node) => node.dataset.inventoryItem === 'class:starseer').parentNode.click();
    const acts = dom.document.body.querySelectorAll('.armoury-class-action');
    const equip = acts.find((node) => /^Equip class$/.test(node.textContent.trim()));
    assert.ok(equip, 'the unequipped card offers Equip class');
    assert.ok(acts.some((node) => /^Unequip class$/.test(node.textContent.trim())), 'the equipped card offers Unequip class');
    equip.click();
    assert.equal(run.class, 'starseer', 'Equip class swapped the core card');
    assert.equal(mount(dom, run, true).length, 0, 'no class card is offered in combat');
    equipClassCard(REG, run, null);
    assert.equal(mount(dom, run).length, 2, 'an unequipped core slot lists the cards');
  });
});
