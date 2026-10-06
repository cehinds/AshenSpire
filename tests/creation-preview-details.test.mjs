import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { statProjection, handResourceRows, withHandResources, startingResourceRows } from '../src/model/statProjection.js';
import { classChoiceCard, classUnfold, classResourceGrid } from '../src/ui/components/creationCards.js';
import { focusCreationClassPreview, openCreationStatDetail, openCreationRelicDetail } from '../src/ui/components/creationPreviewDetails.js';
import { relicText } from '../src/ui/components/card.js';
import { withKitDom } from './helpers/kit-dom.mjs';

const registries = createRegistries(contentBundle);
const run = createRunState({ registries, classId: 'reaver', seed: 7 });
const names = { hp: 'Health Points (HP)', mana: 'Mana Points (MP)', stamina: 'Stamina Points (SP)', openingHand: 'Opening hand', draw: 'Cards drawn each turn' };
const resources = (character, reg = registries) => startingResourceRows(withHandResources(statProjection(reg, character).derived, handResourceRows(reg, character)))
  .map(row => ({ ...row, inspectionLabel: names[row.id] }));

test('expanded class is an article with native detail buttons, while folded classes remain choices', () => withKitDom((dom) => {
  const cls = registries.classes.get(run.class);
  let choices = 0;
  const card = classChoiceCard(cls, { selected: true, expanded: true, onChoose: () => { choices += 1; } });
  const relic = registries.relics.get(cls.startingRelic);
  card.append(classUnfold({ cls, relic,
    resources: classResourceGrid(resources(run), { onInspect: openCreationStatDetail }),
    onRelicInspect: (item, opener) => openCreationRelicDetail(item, relicText(item, registries), opener),
  }));
  dom.document.body.append(card);
  assert.equal(card.tagName, 'ARTICLE');
  assert.match(card.getAttribute('aria-label'), /selected class/);
  const controls = card.querySelectorAll('button');
  assert.equal(controls.length, 6);
  for (const control of controls) {
    assert.equal(control.getAttribute('type'), 'button', 'native buttons provide Enter/Space activation');
    assert.equal(control.getAttribute('aria-haspopup'), 'dialog');
    assert.equal(control.parentNode.closest('button'), null, 'no interactive ancestor');
  }
  controls[0].click();
  assert.equal(choices, 0, 'inspecting a stat never reselects or resets the class');
  dom.document.querySelector('.modal-close').click();
  const folded = classChoiceCard(cls, { onChoose: () => { choices += 1; } });
  assert.equal(folded.tagName, 'BUTTON');
  folded.click();
  assert.equal(choices, 1);
}));

test('every starting stat opens its definition and exact calculation, then returns focus on close', () => withKitDom((dom) => {
  let door;
  const rows = resources(run);
  const grid = classResourceGrid(rows, { onInspect: (entry, opener) => { door = openCreationStatDetail(entry, opener); } });
  dom.document.body.append(grid);
  for (const entry of rows) {
    const control = grid.querySelector(`[data-stat="${entry.id}"]`);
    control.focus(); control.click();
    assert.equal(door.head.querySelector('h2').textContent, names[entry.id]);
    assert.equal(door.body.querySelector('.cc-preview-detail-definition').textContent, entry.sense);
    assert.equal(door.body.querySelector('.sp-v').textContent, String(entry.value));
    const body = door.body.querySelector('.cc-preview-detail-body');
    assert.equal(body.children.at(-1).classList.contains('cc-preview-detail-calculation'), true, 'calculation is last');
    assert.equal(body.querySelector('.cc-preview-detail-formula').textContent, entry.formula);
    door.head.querySelector('.modal-close').click();
    assert.equal(dom.document.querySelector('[aria-modal="true"]'), null);
    assert.equal(dom.document.activeElement, control);
  }
}));

test('class replacement preserves its whole name and transfers both native and unified focus', () => withKitDom((dom) => {
  const cls = { ...registries.classes.get(run.class), name: 'Keeper of the Last Unbroken Ember' };
  const host = dom.document.createElement('div'); dom.document.body.append(host);
  const card = classChoiceCard(cls, { selected: true, expanded: true });
  card.append(classUnfold({ cls }));
  const folded = classChoiceCard(cls, { onChoose: () => {
    host.replaceChildren(card);
    focusCreationClassPreview(card);
  } });
  host.append(folded); folded.focus(); folded.click();
  assert.equal(card.querySelector('.cc-unfold-heading').textContent, cls.name);
  assert.equal(card.getAttribute('aria-label'), `${cls.name}, selected class`);
  assert.equal(dom.document.activeElement, card, 'the real production helper transfers native focus from the removed button');
  assert.equal(card.classList.contains('gp-focus'), true, 'the same article receives the unified cursor');
}));

test('stat details follow changed attributes and hand-cap calculations', () => withKitDom((dom) => {
  const changed = { ...run, attributes: { ...run.attributes, constitution: run.attributes.constitution + 1 } };
  const hp = resources(changed).find(row => row.id === 'hp');
  assert.equal(hp.value, resources(run).find(row => row.id === 'hp').value + 1);
  const opener = dom.document.createElement('button'); dom.document.body.append(opener);
  const door = openCreationStatDetail(hp, opener);
  assert.ok(door.body.querySelector('.cc-preview-detail-formula').textContent.endsWith(`= ${hp.value}`));
  door.close();
  const bundle = { ...contentBundle, derivedStatRules: structuredClone(contentBundle.derivedStatRules) };
  bundle.derivedStatRules.rules.handSize = { base: 2, min: 1, max: 2 };
  const small = createRegistries(bundle);
  const capped = createRunState({ registries: small, classId: 'reaver', seed: 8 });
  for (const entry of resources(capped, small).filter(row => ['openingHand', 'draw'].includes(row.id))) {
    assert.equal(entry.value, 2);
    const detail = openCreationStatDetail(entry, opener);
    assert.match(detail.body.querySelector('.cc-preview-detail-formula').textContent, /limited to hand capacity 2 = 2/);
    detail.close();
  }
}));

test('relic opens its resolved rules text; Escape closes only the detail and restores its opener', () => withKitDom((dom, win) => {
  const relic = registries.relics.get(registries.classes.get(run.class).startingRelic);
  let door;
  const face = classUnfold({ cls: registries.classes.get(run.class), relic,
    onRelicInspect: (item, opener) => { door = openCreationRelicDetail(item, relicText(item, registries), opener); },
  });
  dom.document.body.append(face);
  const control = face.querySelector('button');
  control.focus(); control.click();
  assert.equal(door.head.querySelector('h2').textContent, relic.name);
  const description = door.body.querySelector('.cc-preview-detail-definition').textContent;
  assert.equal(description, relicText(relic, registries));
  assert.match(description, /10/);
  let backs = 0;
  dom.document.addEventListener('keydown', () => { backs += 1; });
  const event = win.press('Escape', { cancelable: true });
  assert.equal(event.defaultPrevented, true);
  assert.equal(backs, 0);
  assert.equal(door.veil.isConnected, false);
  assert.equal(dom.document.activeElement, control);
}));
