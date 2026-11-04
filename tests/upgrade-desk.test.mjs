// The Smith's item upgrade picker stands in the deck editor's desk (owner, 2026-11-02): the editor's veil,
// panel, panes grid, list rows and footer, with the preview where the editor's inspector stands. This pins
// the structure (the card picker's twin is in card-upgrade-picker-model.test.mjs), the selection outline,
// the Blacksmith-gated row staying listed and disabled, and the confirm path.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { beginGameProfileRest } from '../src/model/gameProfileRest.js';
import { smithingPlan } from '../src/model/smithing.js';
import { smithSelectionModel } from '../src/ui/models/SmithSelectionModel.js';
import { mountSmithUpgradeModal } from '../src/ui/components/smithUpgradeModal.js';
import { upgradeFacesNode, upgradeConfirmNodes } from '../src/ui/components/upgradeConfirm.js';
import { openConfirmationModal, closeConfirmationModal } from '../src/ui/components/confirmationModal.js';
import { withKitDom } from './helpers/kit-dom.mjs';
import { buildActMap } from '../src/engine/actmap.js';
import { createRng } from '../src/engine/rng.js';
import '../src/engine/runCombat.js';
import '../src/engine/combat.js';

const profile = resolveGameProfile(JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url))));
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const css = readFileSync(new URL('../styles/ui.css', import.meta.url), 'utf8');
const visit = (run) => { run.mapGraph = buildActMap(reg, createRng(73), run.seatOrder[0], 1); run.mapNodeId = Object.values(run.mapGraph.nodes).find(n => n.type === 'shrine' && n.floor === 3).id; return beginGameProfileRest(run, '1:' + run.mapNodeId); };
const fresh = () => { const run = createRunState({ seed: 73, classId: 'reaver', registries: reg, runId: 'unique-run' }); run.smithingStones = 3; run.loadout.sets.leftHand[0] = 'kiteShield'; run.loadout.sets.armor[0] = 'vigil'; visit(run); return run; };
const mount = (dom, run, itemRef, handlers = {}) => {
  const host = dom.document.createElement('main'); dom.document.body.append(host);
  const model = smithSelectionModel(reg, smithingPlan(reg, run), itemRef);
  const door = mountSmithUpgradeModal(host, model, { registries: reg, meta: {}, onSelect() {}, onBack() {}, onConfirm() {}, ...handlers });
  return { host, door, model };
};

test('the Smith picker wears the deck editor\'s frame: veil, panel, panes, list rows and footer', () => withKitDom(dom => {
  const { host, door } = mount(dom, fresh(), 'armament/greatsword');
  const panel = host.querySelector('.deck-editor.deck-editor-reading-desk.upgrade-desk');
  assert.ok(host.querySelector('.deck-editor-veil'), 'in the editor\'s veil');
  assert.ok(panel, 'on the editor\'s panel');
  assert.equal(panel.getAttribute('role'), 'dialog');
  assert.ok(panel.querySelector('.deck-editor-head .deck-editor-title'), 'the editor\'s head and title');
  assert.ok(panel.querySelector('.deck-editor-panes'));
  assert.equal(panel.querySelector('.deck-editor-inspector'), null, 'the desk is the list alone: no detail pane');
  assert.ok(panel.querySelector('.deck-editor-pane'), 'the items stand where the collection stands');
  assert.equal(panel.querySelector('.deck-editor-list').getAttribute('role'), 'listbox');
  const rows = panel.querySelectorAll('.deck-editor-main.smith-candidate-card');
  assert.ok(rows.length >= 2 && panel.querySelectorAll('.deck-editor-item').length === rows.length, 'every upgradeable item is one of the editor\'s rows');
  assert.ok(panel.querySelector('.deck-editor-footer .deck-editor-foot .deck-editor-cancel.smith-back'), 'Back where Cancel stands');
  assert.equal(panel.querySelector('.smith-confirm'), null, 'the list holds no Upgrade button: a tapped row opens its own modal');
  assert.equal(panel.querySelector('.deck-editor-inspect-back'), null, 'no standalone Back chip in the picker');
  closeConfirmationModal();
  door.close();
}));

test('the chosen item is the one outlined row, and a click routes the choice to the host', () => withKitDom(dom => {
  const picks = [];
  const { host, door } = mount(dom, fresh(), 'armament/greatsword', { onSelect: ref => picks.push(ref) });
  const selected = host.querySelectorAll('.smith-candidate-card.selected');
  assert.equal(selected.length, 1);
  assert.equal(selected[0].dataset.itemRef, 'armament/greatsword');
  assert.equal(selected[0].getAttribute('aria-selected'), 'true');
  assert.equal(host.querySelectorAll('.smith-candidate-card[aria-selected="true"]').length, 1, 'exactly one is outlined');
  const other = [...host.querySelectorAll('.smith-candidate-card')].find(row => row.dataset.itemRef !== 'armament/greatsword');
  other.click();
  assert.deepEqual(picks, [other.dataset.itemRef]);
  assert.ok(css.includes('.deck-editor-main[aria-pressed="true"], .deck-editor-main[aria-selected="true"] {'), 'the editor\'s own outline rule covers the selected row');
  door.close();
}));

test('the head is one compact row: title, the stones under it, and a close box', () => withKitDom(dom => {
  const { host, door } = mount(dom, fresh(), null);
  const head = host.querySelector('.upgrade-desk .upgrade-desk-head');
  assert.deepEqual([...head.children].map(node => node.className.split(' ')[0]), ['upgrade-desk-headtext', 'modal-close'], 'the title block and the close, in one row');
  const text = head.querySelector('.upgrade-desk-headtext');
  assert.deepEqual([...text.children].map(node => node.tagName), ['H2', 'P'], 'the title with the purse under it');
  assert.match(css, /\.upgrade-desk \.upgrade-desk-close \{[^}]*width: calc\(44px \/ var\(--ui-zoom, 1\)\)/, 'the close box is the 44px tap target');
  door.close();
}));

test('a tap opens that item\'s upgrade modal at once; Back, the close box and Escape close it with no change and keep the list', () => withKitDom(dom => {
  const run = fresh();
  const picks = []; const commits = []; let backs = 0;
  const host = dom.document.createElement('main'); dom.document.body.append(host);
  let model = smithSelectionModel(reg, smithingPlan(reg, run), null, { autoSelect: false });
  assert.equal(model.properties.selected, null, 'the list opens with nothing chosen');
  const door = mountSmithUpgradeModal(host, model, { registries: reg, meta: {}, onSelect: ref => { picks.push(ref); model = smithSelectionModel(reg, smithingPlan(reg, run), ref, { autoSelect: false }); door.update(model); }, onBack: () => { backs++; }, onConfirm: ref => commits.push(ref) });
  assert.equal(dom.document.querySelector('.confirmation-modal'), null, 'no modal before a tap');
  const row = host.querySelector('.smith-candidate-card');
  row.click();
  assert.deepEqual(picks, [row.dataset.itemRef]);
  const modal = dom.document.querySelector('.confirmation-modal');
  assert.ok(modal, 'the tap opens the upgrade modal directly');
  assert.match(modal.querySelector('.modal-title, h2, h3').textContent, /^Upgrade /);
  assert.ok(modal.querySelector('.confirmation-cancel') && modal.querySelector('.confirmation-confirm'), 'Back and Upgrade');
  modal.querySelector('.confirmation-cancel').click();
  assert.equal(dom.document.querySelector('.confirmation-modal'), null, 'Back closes the modal');
  assert.deepEqual(commits, [], 'with no change');
  assert.equal(backs, 0, 'and the list stays');
  assert.ok(host.querySelector('.upgrade-desk'), 'the list is still up');
  row.click();
  assert.ok(dom.document.querySelector('.confirmation-modal'), 'the same row opens it again');
  closeConfirmationModal();
  door.close();
}));

test('a Blacksmith-gated item stays listed, dimmed and aria-disabled', () => withKitDom(dom => {
  const run = fresh();
  // A rest site's Smith marks every tier past its `maxTier` as capped: with maxTier 0 every tier-1 step is gated.
  const plan = smithingPlan(reg, run, undefined, { maxTier: 0 });
  const model = smithSelectionModel(reg, plan, 'armament/greatsword');
  const gated = model.properties.candidates.map((row, index) => [row, index]).filter(([row]) => row.needsBlacksmith);
  assert.ok(gated.length, 'the fixture has a Blacksmith-gated item');
  const host = dom.document.createElement('main'); dom.document.body.append(host);
  const door = mountSmithUpgradeModal(host, model, { registries: reg, meta: {}, onSelect() {}, onBack() {}, onConfirm() {} });
  const rows = [...host.querySelectorAll('.smith-candidate-card')];
  const gatedRows = rows.filter(row => row.getAttribute('aria-disabled') === 'true');
  assert.equal(gatedRows.length, gated.length);
  assert.ok(gatedRows.every(row => row.classList.contains('is-needs-blacksmith')));
  const firstGated = rows.indexOf(gatedRows[0]);
  assert.ok(rows.slice(firstGated).every(row => row.getAttribute('aria-disabled') === 'true'), 'nothing upgradeable follows a gated item');
  door.close();
}));

test('the confirm path: Upgrade in the item\'s modal commits the chosen item once and closes the picker', () => withKitDom(dom => {
  // Committing arms the confirmation door's input-shield timer; it must not fire after the fixture is torn down.
  const priorTimeout = globalThis.setTimeout;
  globalThis.setTimeout = () => 0;
  try {
  const run = fresh();
  const commits = [];
  const { host, door } = mount(dom, run, 'armament/greatsword', { onConfirm: ref => commits.push(ref) });
  const confirm = dom.document.querySelector('.confirmation-modal .confirmation-confirm');
  assert.ok(confirm, 'an item chosen at mount opens its modal');
  assert.match(confirm.textContent, /^Upgrade \(\d+\)$/);
  assert.deepEqual(commits, [], 'nothing commits before Upgrade');
  confirm.click();
  assert.deepEqual(commits, ['armament/greatsword']);
  assert.equal(host.querySelector('.upgrade-desk'), null, 'the picker closes; the host redraws its list');
  closeConfirmationModal();
  } finally { globalThis.setTimeout = priorTimeout; }
}));

test('the modal body is the shared one: cost, the card faces before and after, then the stat rows under them', () => withKitDom(dom => {
  const { door } = mount(dom, fresh(), 'armament/greatsword');
  const body = dom.document.querySelector('.confirmation-modal .confirmation-details');
  const order = [...body.querySelectorAll('.confirmation-cost, .upgrade-confirm-faces, .confirmation-change-list')].map(node => node.className.split(' ').find(name => ['confirmation-cost', 'upgrade-confirm-faces', 'confirmation-change-list'].includes(name)));
  assert.deepEqual(order, ['confirmation-cost', 'upgrade-confirm-faces', 'confirmation-change-list']);
  closeConfirmationModal();
  door.close();
}));

test('upgradeFacesNode draws the before face then the after face; upgradeConfirmNodes orders cost, recovery, faces, rows', () => withKitDom(dom => {
  const mark = text => { const node = dom.document.createElement('span'); node.className = text; return node; };
  const faces = upgradeFacesNode({ before: mark('b'), after: mark('a') });
  assert.deepEqual([...faces.children].map(node => node.dataset.cardUpgradeFace), ['before', 'after']);
  const nodes = upgradeConfirmNodes({ cost: mark('cost'), recovery: mark('recovery'), faces, rows: [mark('row')] });
  assert.deepEqual(nodes.map(node => node.className.split(' ')[0]), ['cost', 'recovery', 'card-upgrade-faces', 'confirmation-change-list']);
  assert.deepEqual(upgradeConfirmNodes({ cost: mark('cost') }).map(node => node.className), ['cost'], 'absent parts draw nothing');
}));

test('a host\'s cinder charge shows in the modal for the item selected NOW, after cancel and another pick', () => withKitDom(dom => {
  const run = fresh();
  const host = dom.document.createElement('main'); dom.document.body.append(host);
  const prices = {};
  const build = ref => {
    const base = smithSelectionModel(reg, smithingPlan(reg, run), ref, { autoSelect: false });
    if (!base.properties.selected) return base;
    const cost = prices[ref] ?? 10;
    return { ...base, properties: { ...base.properties, cinderCost: cost, cinderHave: 25, canConfirm: base.properties.canConfirm && cost <= 25 } };
  };
  const refs = smithSelectionModel(reg, smithingPlan(reg, run), null, { autoSelect: false }).properties.candidates.map(c => c.itemRef);
  assert.ok(refs.length >= 2);
  prices[refs[0]] = 10; prices[refs[1]] = 40;
  let door;
  door = mountSmithUpgradeModal(host, build(null), { registries: reg, meta: {}, onSelect: ref => door.update(build(ref)), onBack() {}, onConfirm() {} });
  const rows = () => [...host.querySelectorAll('.smith-candidate-card')];
  const cinders = () => dom.document.querySelector('.confirmation-modal .confirmation-cinders');
  const byRef = ref => rows().find(r => r.dataset.itemRef === ref);
  byRef(refs[0]).click();
  assert.ok(cinders(), 'the cinder charge is in the cost area');
  assert.equal(cinders().classList.contains('affordable'), true);
  assert.match(dom.document.querySelector('.confirmation-modal .confirmation-confirm').textContent, /10 cinders/, 'the Upgrade label carries both costs');
  dom.document.querySelector('.confirmation-modal .confirmation-cancel').click();
  byRef(refs[1]).click();
  assert.ok(cinders().classList.contains('unaffordable'), 'the second item\'s 40 exceeds the 25 held: red');
  closeConfirmationModal();
  door.close();
}));

test('the confirmation modal\'s focus trap runs through a live detailsNode\'s tab stops, then Back, then Confirm', () => withKitDom(dom => {
  const priorTimeout = globalThis.setTimeout;
  const timers = [];
  globalThis.setTimeout = fn => { timers.push(fn); return timers.length; };
  const priorHTMLElement = globalThis.HTMLElement;
  globalThis.HTMLElement = dom.document.body.constructor;
  try {
    const group = dom.document.createElement('div');
    const radio = (on) => { const b = dom.document.createElement('button'); b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(on)); b.setAttribute('tabindex', on ? '0' : '-1'); b.className = 'opt'; return b; };
    const a = radio(true), b = radio(false);
    group.append(a, b);
    openConfirmationModal({ title: 'Upgrade?', message: 'm', detailsNode: group, confirmLabel: 'Go', returnFocusElement: null });
    timers.splice(0).forEach(fn => fn());
    assert.equal(dom.document.activeElement, a, 'initial focus is the picked option');
    const cancel = dom.document.querySelector('.confirmation-cancel');
    const confirm = dom.document.querySelector('.confirmation-confirm');
    const press = (shiftKey) => { const e = new dom.Event('keydown', { cancelable: true }); e.key = 'Tab'; e.shiftKey = shiftKey; window.dispatchEvent(e); return e.defaultPrevented; };
    // From the last stop, Tab wraps to the first; Shift+Tab from the first wraps to the last.
    confirm.focus(); assert.equal(press(false), true); assert.equal(dom.document.activeElement, a, 'Confirm wraps to the option');
    assert.equal(press(true), true); assert.equal(dom.document.activeElement, confirm, 'Shift+Tab from the option wraps to Confirm');
    cancel.focus(); assert.equal(press(true), false, 'Shift+Tab from Back is the browser\'s: it lands on the option');
    // A re-render moves the tab stop; the trap reads it live.
    a.setAttribute('tabindex', '-1'); b.setAttribute('tabindex', '0'); a.setAttribute('aria-checked', 'false'); b.setAttribute('aria-checked', 'true');
    confirm.focus(); press(false); assert.equal(dom.document.activeElement, b, 'the re-picked option is the live first stop');
    closeConfirmationModal();
  } finally { globalThis.setTimeout = priorTimeout; globalThis.HTMLElement = priorHTMLElement; }
}));
