// The Smith upgrade confirmation ("Upgrade <item>?"): collapsed recovery rows, the single-word
// no-requirement row, and the name-left / change-right structure that lets it fit without scrolling.
// The live fit probe is tests/smith-confirm-fit.browser.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { recoveryLedgerHtml } from '../src/ui/components/recoveryLedger.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n?/g, '\n');
const run = (over = {}) => ({ hp: 73, mana: 1, stamina: 3, flaskCharges: { hpCurrent: 2, manaCurrent: 1 }, ...over });
const same = (r) => ({ hp: r.hp, mana: r.mana, stamina: r.stamina, flaskCharges: { ...r.flaskCharges } });

test('recovery preview: nothing changing collapses to one line, no rows and no dash column', () => {
  const html = recoveryLedgerHtml(run(), same(run()));
  assert.match(html, /class="rest-recovery-none"[^>]*>No recovery changes</);
  assert.doesNotMatch(html, /rest-recovery-row/);
  assert.doesNotMatch(html, /rest-recovery-gain|—/);
});

test('recovery preview: only changing pools keep a row, each with its gain', () => {
  const r = run();
  const after = { ...same(r), hp: 80, mana: 4 };
  const html = recoveryLedgerHtml(r, after);
  assert.equal((html.match(/class="rest-recovery-row"/g) || []).length, 2);
  assert.match(html, /73 → <strong>80<\/strong>/);
  assert.match(html, /\+7</);
  assert.match(html, /\+3</);
  assert.doesNotMatch(html, /rest-recovery-none/);
  assert.doesNotMatch(html, /Healing flasks|SP</);
});

const modal = read('src/ui/components/smithUpgradeModal.js');
const css = read('styles/kit.css');

test('no attribute requirement is one "None", with no duplicate wording to wrap', () => {
  assert.match(modal, /smith-requirement-none[^\n]*text: 'None'/);
  assert.doesNotMatch(modal, /No attribute requirement'/);
  assert.doesNotMatch(modal, /text: 'NONE'/);
});

test('confirmation rows are name-left, change-right grids, scoped to the Smith confirmation', () => {
  assert.match(modal, /className: 'smith-confirm-row'/);
  assert.match(modal, /'div', \{ class: 'smith-confirm-details' \}/);
  const rule = (sel) => css.split('\n').find((line) => line.startsWith(sel + ' {')) || '';
  const row = rule('.smith-confirm-row.as-statrow.flat');
  assert.match(row, /grid-template-columns: minmax\(0, 1fr\) auto/);
  const vals = rule('.smith-confirm-row .sr-vals');
  assert.match(vals, /justify-self: end/);
  assert.match(vals, /text-align: right/);
  assert.match(vals, /white-space: nowrap/);
  assert.match(rule('.smith-confirm-row .smith-fold-values'), /flex-wrap: nowrap/);
  assert.match(rule('.modal .smith-confirm-row.as-statrow > .sr-id'), /max-width: 100%/);
  // The intro sentence is shrunk only for this confirmation, never the shared modal.
  assert.match(css, /\.confirmation-modal:has\(\.smith-confirm-details\) \.confirmation-copy/);
});

test('Smith data rows carry no grey sub-label under their titles', () => {
  assert.doesNotMatch(modal, /text: 'Equipment Stats'\}\), el\('small'/);
  assert.doesNotMatch(modal, /text: 'attribute'/);
  assert.doesNotMatch(modal, /text: selected\.kindLabel\}\)\]\)/);
  assert.doesNotMatch(modal, /sr-hint/);
  assert.doesNotMatch(modal, /Selected item/);
});

test('Smith item header: tier beside the name, type and tags in one row', () => {
  assert.match(modal, /smith-title-row[\s\S]*sr-name[\s\S]*dc-meta/);
  assert.match(modal, /smith-tag-row[\s\S]*smith-item-type-row[\s\S]*smith-weapon-tags/);
  assert.match(css, /\.smith-tag-row \{ display: flex; flex-wrap: wrap/);
});

test('the shrine recovery panel has no heading and keeps every pool row', () => {
  const rest = read('src/ui/screens/rest.js');
  assert.doesNotMatch(rest, /recovery\.append\(el\('h3'/);
  assert.match(rest, /\['health', 'HP'/);
  assert.match(rest, /\['mana', 'Mana'/);
});

test('the Stone cost sits on the item row, compact, with no footer strip when affordable', () => {
  assert.match(modal, /smith-head-cost smith-preview-economy/);
  assert.doesNotMatch(modal, /economyNode\(selected\)\),\n\s*selected\.affordable/);
  assert.match(modal, /selected\.affordable \? null : el\('div', \{ class: 'smith-cost-strip'/);
  assert.match(css, /\.smith-head-cost \{[^}]*margin-left: auto/);
});

test('the Smith item pane draws no recovery rows; the confirmation keeps its ledger', () => {
  const pane = modal.slice(modal.indexOf('function previewCard'), modal.indexOf('function draw'));
  assert.doesNotMatch(pane, /servicePreviewHtml|rest-recovery/);
  assert.match(modal, /class: 'smith-confirm-recovery'/);
});

test('shared kit rules are scoped so the card-upgrade and mount-service heads keep their layout', () => {
  // display:contents only inside the new .smith-tag-row; the unscoped form flattens the old heads.
  assert.match(css, /\.smith-tag-row > \.smith-item-type-row, \.smith-tag-row > \.smith-weapon-tags \{ display: contents; \}/);
  assert.doesNotMatch(css, /^\.smith-item-type-row, \.smith-weapon-tags \{ display: contents/m);
  // The span-2 art well applies only when the head uses the .smith-title-row structure.
  assert.match(css, /\.smith-selected-head > \.as-artwell \{ grid-row: 1 \/ span 5;/);
  assert.match(css, /\.smith-selected-head:has\(> \.smith-title-row\) > \.as-artwell \{ grid-row: 1 \/ span 2; \}/);
});
