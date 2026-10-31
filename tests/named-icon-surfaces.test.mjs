import test from 'node:test';
import assert from 'node:assert/strict';
import { withKitDom } from './helpers/kit-dom.mjs';
import { uiIconId, uiIconText, uiIconGlyph } from '../src/content/uiIcons.js';
import { sigilChoiceButton, characterSigilPreview, classChoiceCard, classUnfold, selectionSectionFace } from '../src/ui/components/creationCards.js';
import { kitItem, optionCard, ornament } from '../src/ui/kit/index.js';
import { mountGameOver } from '../src/ui/screens/gameover.js';
import { mountRewards } from '../src/ui/screens/reward.js';
import { mountShop } from '../src/ui/screens/shop.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { buildMarketStock } from '../src/engine/shopKinds.js';
import { createRng } from '../src/engine/rng.js';
const registries = createRegistries(contentBundle);
const saves = { loadMeta: () => ({ settings: { levelUpRefillSeconds: 0 } }), saveMeta() {} };

const readableText = node => node.textContent + node.children.map(readableText).join('');

function expectArt(node, id) {
  assert.ok(node, 'production surface mounted');
  assert.equal(node.querySelector('[data-engraved-icon]')?.dataset.engravedIcon, id);
  assert.doesNotMatch(node.textContent, new RegExp(id));
}

test('saved named and legacy sigils paint choices and glyph-only previews without changing stored values', () => withKitDom(() => {
  for (const value of ['sword', String.fromCodePoint(0x2694)]) {
    let chosen = false;
    const choice = sigilChoiceButton(value, true, () => { chosen = true; });
    expectArt(choice, uiIconId(value));
    assert.equal(choice.dataset.sigil, value, 'save/selection identity is preserved');
    assert.equal(choice.getAttribute('aria-label'), `Sigil ${uiIconText(value)}`);
    choice.click(); assert.equal(chosen, true);
    const preview = characterSigilPreview(value);
    expectArt(preview, uiIconId(value));
    assert.equal(preview.getAttribute('role'), 'img');
    assert.equal(preview.getAttribute('aria-label'), `Sigil ${uiIconText(value)}`);
  }
  assert.equal(readableText(characterSigilPreview('custom mark')), 'custom mark');
}));

test('kit deck items and option glyphs resolve names while retaining their readable titles', () => withKitDom(() => {
  const item = kitItem({ glyph: 'staggered', name: 'Upgraded Strike' });
  expectArt(item.querySelector('.kg'), 'staggered');
  assert.equal(item.querySelector('.kn').textContent, 'Upgraded Strike');
  const option = optionCard({ glyph: 'flask-health', name: 'Crimson Flask' });
  expectArt(option.querySelector('.og'), 'flask-health');
  assert.match(readableText(option.querySelector('.as-label-text')), /Crimson Flask/);
}));

test('game-over identity paints the sigil beside the name and the final deck uses icons', () => withKitDom(({ document }) => {
  document.documentElement ??= document.body;
  const app = document.createElement('main'); document.body.append(app);
  const run = createRunState({ registries, classId: 'reaver', seed: 21 });
  run.customization = { name: 'Astra', glyph: 'sword' };
  run.stats = { fightsWon: 1, damageDealt: 8, damageTaken: 9 };
  mountGameOver(app, { registries, game: run, victory: false, onTitle() {} });
  expectArt(app.querySelector('.dc-name'), 'sword');
  assert.equal(app.querySelector('.dc-name').getAttribute('aria-label'), 'Astra, sigil Blade');
  assert.ok(app.querySelector('.deck-strip .kg [data-engraved-icon]'));
  assert.equal(run.customization.glyph, 'sword');
}));

test('reward menu rows and class-node choices render their tokens as actual icon DOM', () => withKitDom(({ document }) => {
  document.documentElement ??= document.body;
  const app = document.createElement('main'); document.body.append(app);
  const run = createRunState({ registries, classId: 'reaver', seed: 21 });
  mountRewards(app, { registries, run, checkpoint: { states: {} },
    rewards: { cinders: 10, classDrafts: [{ classId: 'reaver', level: 1, nodeIds: ['ironFooting', 'bloodTempo'] }] },
    onDone() {}, onPersist: () => true, saves });
  expectArt(app.querySelector('[data-kind="cinders"] .glyph'), 'cinders');
  expectArt(app.querySelector('[data-kind="classDraft"] .glyph'), 'progression');
  app.querySelector('[data-kind="classDraft"]').click();
  for (const node of app.querySelectorAll('.reward-node')) {
    const def = registries.nodes.find(row => row.id === node.dataset.nodeId);
    const icon = uiIconId(def.glyph || 'progression');
    if (icon) expectArt(node.querySelector('.glyph'), icon);
    else assert.equal(readableText(node.querySelector('.glyph')), def.glyph);
  }
  assert.ok(app.querySelector('.reward-node h3').textContent);
}));

test('merchant smith services paint named icons inside real mounted service cards', () => withKitDom(({ document }) => {
  document.documentElement ??= document.body;
  const app = document.createElement('main'); document.body.append(app);
  const run = createRunState({ registries, classId: 'reaver', seed: 21 });
  run.cinders = 1000;
  run.shopStock = buildMarketStock(registries, createRng(21), run, { meta: {} });
  run.shopStock.smith = { offered: true, services: ['upgrade', 'extract', 'install'] };
  mountShop(app, { registries, run, meta: { settings: {} }, onLeave() {}, onChanged() {} });
  expectArt(app.querySelector('#shop-upgrade .glyph'), 'smith');
  expectArt(app.querySelector('#shop-extract .glyph'), 'settings');
  expectArt(app.querySelector('#shop-install .glyph'), 'smith');
  assert.equal(app.querySelector('#shop-upgrade h3').textContent, 'Upgrade an Item');
}));

test('skill attribute reward choices render the attribute marker instead of its icon token', () => withKitDom(({ document }) => {
  document.documentElement ??= document.body;
  const app = document.createElement('main'); document.body.append(app);
  const run = createRunState({ registries, classId: 'reaver', seed: 21 });
  run.skills['item:blade'] = { level: 1, xp: 0, pendingDrafts: 0 };
  mountRewards(app, { registries, run, checkpoint: { states: {} },
    rewards: { skillAttributes: [{ skillId: 'item:blade', ordinal: 0, attributeIds: ['strength', 'dexterity'] }] },
    onDone() {}, onPersist: () => true, saves });
  expectArt(app.querySelector('[data-kind="skillAttribute"] .glyph'), 'strength');
  app.querySelector('[data-kind="skillAttribute"]').click();
  const choices = app.querySelectorAll('.reward-node');
  assert.equal(choices.length, 2);
  for (const choice of choices) expectArt(choice.querySelector('.glyph'), 'strength');
}));


test('the mounted skill rank-up offer uses the named progression icon', () => withKitDom(({ document }) => {
  document.documentElement ??= document.body;
  const app = document.createElement('main'); document.body.append(app);
  const run = createRunState({ registries, classId: 'reaver', seed: 21 });
  run.skills['item:blade'] = { level: 1, xp: 0, pendingDrafts: 0 };
  mountRewards(app, { registries, run, checkpoint: { states: {} },
    rewards: { skillRankUps: [{ skillId: 'item:blade', level: 1 }] },
    onDone() {}, onPersist: () => true, saves });
  expectArt(app.querySelector('[data-kind="skillRankUp"] .glyph'), 'progression');
}));


test('shared ornamental span paints skill artwork without adding glyph sizing or visible IDs', () => withKitDom(({document}) => {
  const node=ornament({class:'test-rule'});document.body.append(node);
  assert.equal(node.getAttribute('aria-hidden'),'true');
  assert.ok(node.classList.contains('test-rule'));
  const span=node.firstElementChild;
  assert.equal(span.tagName,'SPAN');assert.equal(span.className,'');
  assert.equal(span.querySelector('[data-engraved-icon]')?.dataset.engravedIcon,'skill');
  assert.doesNotMatch(node.outerHTML,/>skill</);
  assert.equal(node.querySelector('.as-glyph'),null,'ornament keeps its own sizing span');
}));


test('class choices and expanded previews paint each production class icon without exposing source IDs', () => withKitDom(({ document }) => {
  for (const cls of registries.classes.all()) {
    for (const render of [() => classChoiceCard(cls, { visual: cls.glyph }), () => classUnfold({ cls, visual: cls.glyph })]) {
      const card = render();
      const visual = card.querySelector('.og') || card.querySelector('.cc-unfold-class-icon');
      expectArt(visual, uiIconId(cls.glyph));
      assert.equal(readableText(visual), uiIconGlyph(cls.glyph) || '', 'the icon well contains the glyph, never its source identifier');
      assert.match(readableText(card), new RegExp(cls.name));
    }
  }
  const cls = registries.classes.all()[0];
  const custom = document.createElement('img');
  assert.equal(classChoiceCard(cls, { visual: custom }).querySelector('.og').firstChild, custom);
  assert.equal(readableText(classChoiceCard(cls, { visual: 'custom mark' }).querySelector('.og')), 'custom mark');
  expectArt(selectionSectionFace('Class', cls.name, 'attack').node, 'attack');
}));
