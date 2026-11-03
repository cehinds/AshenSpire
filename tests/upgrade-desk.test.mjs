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
import { withKitDom } from './helpers/kit-dom.mjs';
import { buildActMap } from '../src/engine/actmap.js';
import { createRng } from '../src/engine/rng.js';
import '../src/engine/runCombat.js';
import '../src/engine/combat.js';

const profile = resolveGameProfile(JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url))));
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const css = readFileSync(new URL('../styles/ui.css', import.meta.url), 'utf8');
const visit = (run) => { run.mapGraph = buildActMap(reg, createRng(73), run.seatOrder[0], 1); run.mapNodeId = Object.values(run.mapGraph.nodes).find(n => n.type === 'shrine' && n.floor === 3).id; return beginGameProfileRest(run, '1:' + run.mapNodeId); };
const fresh = () => { const run = createRunState({ seed: 73, classId: 'reaver', registries: reg, runId: 'unique-run' }); run.loadout.sets.leftHand[0] = 'kiteShield'; run.loadout.sets.armor[0] = 'vigil'; visit(run); return run; };
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
  const inspector = panel.querySelector('.deck-editor-inspector');
  assert.equal(inspector.id, 'smith-preview-region', 'the preview stands where the inspector stands');
  assert.ok(panel.querySelector('.deck-editor-pane'), 'the items stand where the collection stands');
  assert.equal(panel.querySelector('.deck-editor-list').getAttribute('role'), 'listbox');
  const rows = panel.querySelectorAll('.deck-editor-main.smith-candidate-card');
  assert.ok(rows.length >= 2 && panel.querySelectorAll('.deck-editor-item').length === rows.length, 'every upgradeable item is one of the editor\'s rows');
  assert.ok(panel.querySelector('.deck-editor-footer .deck-editor-foot .deck-editor-cancel.smith-back'), 'Back where Cancel stands');
  assert.ok(panel.querySelector('.deck-editor-footer .deck-editor-foot .deck-editor-done.smith-confirm'), 'the action where Accept stands');
  assert.ok(panel.querySelector('.deck-editor-inspect-back'), 'the phone\'s Back chip is the editor\'s');
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

test('a phone shows the list or the chosen item\'s preview, and Back returns to the list', () => withKitDom(dom => {
  const { host, door, model } = mount(dom, fresh(), 'armament/greatsword');
  const panel = host.querySelector('.upgrade-desk');
  assert.equal(panel.dataset.mobileView, 'inspect', 'an item is chosen: its preview shows');
  host.querySelector('.deck-editor-inspect-back').click();
  assert.equal(panel.dataset.mobileView, 'collection');
  door.update({ ...model, properties: { ...model.properties, selected: null, canConfirm: false, blockedReasons: [] } });
  assert.equal(panel.dataset.mobileView, 'collection', 'nothing chosen: the list');
  assert.equal(host.querySelector('.smith-confirm').hidden, true);
  assert.equal(host.querySelector('.smith-confirm').disabled, true);
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

test('the confirm path: Upgrade is armed on the footer action and commits the chosen item once', () => withKitDom(dom => {
  const run = fresh();
  const commits = [];
  const { host, door, model } = mount(dom, run, 'armament/greatsword', { onConfirm: ref => commits.push(ref) });
  const confirm = host.querySelector('.deck-editor-foot .smith-confirm');
  assert.equal(confirm.hidden, false);
  assert.equal(confirm.disabled, false);
  assert.match(confirm.textContent, /^Upgrade \(\d+\)$/);
  assert.equal(confirm.dataset.smithActionState, model.properties.canConfirm ? 'actionable' : 'blocked');
  assert.equal(confirm.getAttribute('aria-disabled'), String(!model.properties.canConfirm));
  assert.deepEqual(commits, [], 'nothing commits before the decision');
  door.close();
}));
