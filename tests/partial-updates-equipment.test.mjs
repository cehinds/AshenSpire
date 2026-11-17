// The Armoury updates the part that changed (CLEAN-CODE-PROMPT §3): a refusal shows its toast or its
// line and nothing else, and Back out of a picked position deselects it and swaps only the Inventory
// block. Each test holds the nodes that must survive and checks they are the same objects afterwards.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { sigils as shippedSigils } from '../src/content/sigils.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { learnClassCard } from '../src/model/classLibraryState.js';
import { t } from '../src/ui/strings.js';
import { withKitDom } from './helpers/dom.mjs';
import { mountEquipment } from '../src/ui/screens/equipment.js';

const REG = createRegistries(contentBundle);
const LEGENDARIES = shippedSigils.filter((row) => row.rarity === 'legendary').map((row) => row.id);

function freshRun() {
  const run = createRunState({ seed: 7, classId: 'reaver', registries: REG });
  run.seenEvents = [];
  return run;
}

function armouryDom(dom) {
  if (!dom.document.documentElement) dom.document.documentElement = dom.document.createElement('html');
  globalThis.NodeFilter = globalThis.NodeFilter || { SHOW_TEXT: 4 };
  dom.document.createTreeWalker = () => ({ nextNode: () => false, currentNode: null });
  const proto = Object.getPrototypeOf(dom.document.body);
  if (!Object.getOwnPropertyDescriptor(proto, 'parentElement')) {
    Object.defineProperty(proto, 'parentElement', { configurable: true, get() { return this.parentNode || null; } });
  }
}

function mount(dom, run, options = {}) {
  const app = dom.document.createElement('main');
  dom.document.body.replaceChildren(app);
  const screen = mountEquipment(app, { registries: REG, run, meta: { settings: { equipView: 'hybrid' } }, inCombat: false, onClose() {}, onChange() {}, ...options });
  return { app, screen };
}

const armoury = (dom) => dom.document.body.querySelector('.armoury');
const backButton = (dom) => dom.document.body.querySelector('.armoury-back');

test('Armoury: a refusal to leave shows the toast over the same panel and redraws nothing', () => {
  withKitDom((dom) => {
    armouryDom(dom);
    const run = freshRun();
    mount(dom, run);
    const panel = armoury(dom);
    const body = panel.querySelector('.armoury-body');
    const back = backButton(dom);
    run.deck.splice(0);
    back.click();
    const toast = panel.querySelector('.as-toast');
    assert.ok(toast, 'the refusal is a toast on the panel');
    assert.match(toast.textContent, /Your deck holds 0 cards/);
    assert.equal(armoury(dom), panel, 'the panel is the same node');
    assert.equal(panel.querySelector('.armoury-body'), body, 'the slots are the same node');
    assert.equal(backButton(dom), back, 'Back is the same node');
  });
});

test('Armoury: a refused attunement adds only its line; the panel, the section and its rows stay', () => {
  withKitDom((dom) => {
    armouryDom(dom);
    const [first, second] = LEGENDARIES;
    const run = freshRun();
    run.sigils = [first, second];
    mount(dom, run);
    const actOn = (id) => dom.document.body.querySelector(`[data-sigil="${id}"] button`);
    actOn(first).click();
    const panel = armoury(dom);
    const section = panel.querySelector('.armoury-sigils');
    const rows = section.querySelectorAll('[data-sigil]');
    actOn(second).click();
    assert.deepEqual(run.attunedSigils, [first], 'nothing changed');
    const line = section.querySelector('.armoury-sigils-refusal');
    assert.ok(line && line.textContent.includes(REG.sigils.get(second).name), 'the refusal is shown');
    assert.equal(section.children[section.children.indexOf(line) - 1].classList.contains('armoury-sigils-count'), true, 'under the count, where a draw puts it');
    assert.equal(armoury(dom), panel);
    assert.equal(panel.querySelector('.armoury-sigils'), section);
    assert.deepEqual(section.querySelectorAll('[data-sigil]'), rows, 'the rows are the same nodes');
    actOn(second).click();
    assert.equal(section.querySelectorAll('.armoury-sigils-refusal').length, 1, 'a second refusal replaces the first');
  });
});

// The parts of a node a player or a screen reader can tell apart: tag, classes, ARIA, data, text, order.
function shape(node) {
  const attributes = [...node.attributes].filter(([key]) => key === 'class' || key.startsWith('aria-') || key.startsWith('data-') || key === 'role').sort();
  return { tag: node.tagName, attributes, text: node.children.length ? '' : node.textContent, children: node.children.map(shape) };
}

test('Armoury: Back out of a picked position deselects it and swaps only the Inventory block', () => {
  withKitDom((dom) => {
    armouryDom(dom);
    const run = freshRun();
    // A second class card is a usable Inventory row, so the Inventory outlives the pick.
    learnClassCard(REG, run, REG.classes.ids().find((id) => id !== run.class));
    const { screen } = mount(dom, run);
    dom.document.body.querySelector('.armament-replace').click();
    const panel = armoury(dom);
    const back = backButton(dom);
    assert.ok(panel.classList.contains('picking'), 'a position is picked');
    assert.equal(back.textContent, t('armoury.destination.back'));
    const body = panel.querySelector('.armoury-body');
    const positions = panel.querySelectorAll('[data-slot-position]');
    const head = panel.querySelector('.armoury-head');
    back.click();
    assert.equal(armoury(dom), panel, 'the panel is the same node');
    assert.equal(backButton(dom), back, 'Back is the same node');
    assert.equal(panel.querySelector('.armoury-head'), head, 'the head is the same node');
    assert.equal(panel.querySelector('.armoury-body'), body, 'the slots are the same node');
    assert.deepEqual(panel.querySelectorAll('[data-slot-position]'), positions, 'every position is the same node');
    assert.equal(panel.classList.contains('picking'), false);
    assert.equal(back.textContent, t('common.back'));
    assert.equal(panel.querySelectorAll('[data-slot-position].is-selected').length, 0, 'the position is deselected');
    const partial = shape(panel);
    screen.redraw();
    assert.deepEqual(shape(armoury(dom)), partial, 'the same DOM a full draw gives');
  });
});
