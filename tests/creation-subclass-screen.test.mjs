import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { withKitDom } from './helpers/kit-dom.mjs';

const registries = createRegistries(contentBundle);

function creationDom(fn) {
  return withKitDom((dom, win) => {
    const proto = Object.getPrototypeOf(dom.document.body);
    Object.defineProperty(proto, 'parentElement', { configurable: true, get() { return this.parentNode; } });
    Object.defineProperty(proto, 'value', { configurable: true, get() { return this.getAttribute('value') || ''; }, set(value) { this.setAttribute('value', value); } });
    proto.replaceWith = function replaceWith(node) { this.before(node); this.remove(); };
    proto.hidePopover = function hidePopover() {};
    proto.showPopover = function showPopover() {};
    proto.toggleAttribute = function toggleAttribute(name, force) { const on = force ?? !this.hasAttribute(name); if (on) this.setAttribute(name, ''); else this.removeAttribute(name); return on; };
    dom.document.documentElement = dom.document.body;
    dom.document.getSelection = () => null;
    dom.document.createDocumentFragment = () => dom.document.createElement('fragment');
    globalThis.getComputedStyle = () => ({ fontSize: '16px', display: 'block', columnGap: '0px', rowGap: '0px', paddingLeft: '0px', paddingRight: '0px', paddingTop: '0px', paddingBottom: '0px', getPropertyValue: () => '' });
    const app = dom.document.createElement('div');
    dom.document.body.append(app);
    return fn(app, dom, win);
  });
}

for (const [classId, subclassId] of [['reaver', 'heavyKnight'], ['starseer', 'battleMage'], ['rogue', 'ranger'], ['herald', 'cleric']]) {
  test(`actual ${classId} creation mounts with empty ability picks and can change subclass`, () => creationDom(async app => {
    const { mountCustomize } = await import('../src/ui/screens/customize.js');
    mountCustomize(app, { registries, defaultSeedString: 'GOLDBOUGH', shotPose: { classId }, onBack() {}, onStart() {} });
    app.querySelector('#cz-tab-subclass').click();
    assert.equal(app.querySelector('#cz-subclass-selector-host .cc-subclass-selector').dataset.subclass, subclassId);
    assert.equal(app.querySelectorAll('#cz-starting-deck-host .cc-subclass-deck-card').length, 11);
    const second = app.querySelectorAll('#cz-subclass-selector-host button[data-subclass]')[1];
    second.click();
    assert.equal(second.getAttribute('aria-pressed'), 'true');
    assert.equal(app.querySelectorAll('#cz-starting-deck-host .cc-subclass-deck-card').length, 11);
    assert.equal(app.querySelector('#cz-start').getAttribute('aria-disabled'), 'true', 'final Begin still requires complete ability picks');
  }));
}

test('actual caster screen previews first pick and removal before final required count is met', () => creationDom(async app => {
  const { mountCustomize } = await import('../src/ui/screens/customize.js');
  mountCustomize(app, { registries, defaultSeedString: 'GOLDBOUGH', shotPose: { classId: 'starseer' }, onBack() {}, onStart() {} });
  app.querySelector('#cz-tab-spells').click();
  const choose = app.querySelector('#cz-spell-choices .cc-ability-choose');
  assert.ok(choose);
  choose.click();
  assert.equal(app.querySelector('#cz-start').getAttribute('aria-disabled'), 'true');
  choose.click();
  assert.equal(app.querySelector('#cz-start').getAttribute('aria-disabled'), 'true');
  app.querySelector('#cz-tab-subclass').click();
  assert.equal(app.querySelectorAll('#cz-starting-deck-host .cc-subclass-deck-card').length, 11);
}));

for (const classId of ['reaver', 'starseer']) {
  test(`actual ${classId} pages collect traits, abilities and separated relics before Begin`, () => creationDom(async app => {
    const { mountCustomize } = await import('../src/ui/screens/customize.js');
    let payload;
    const meta = {}; const original = structuredClone(meta);
    mountCustomize(app, { registries, meta, defaultSeedString: 'GOLDBOUGH', shotPose: { classId }, onBack() {}, onStart(value) { payload = value; } });
    assert.equal(app.querySelector('#cz-subclass-selector-host'), null, 'Class contains only the base class');
    app.querySelector('#cz-next').click();
    assert.ok(app.querySelector('#cz-subclass-panel'));
    assert.ok(app.querySelector('#cz-subclass-traits h3').textContent.includes('Subclass traits'));
    assert.equal(app.querySelector('#cz-next').getAttribute('aria-disabled'), 'true');
    const trait = app.querySelector('[data-creation-trait]'); const id = trait.dataset.creationTrait;
    trait.click();
    assert.notEqual(app.querySelector('#cz-next').getAttribute('aria-disabled'), 'true');
    app.querySelector('#cz-next').click(); assert.ok(app.querySelector('#cz-character-panel'));
    app.querySelector('#cz-next').click(); assert.ok(app.querySelector('#cz-feats-panel'));
    app.querySelector('#cz-next').click();
    const casting = classId === 'starseer';
    assert.ok(app.querySelector(casting ? '#cz-spells-panel' : '#cz-maneuvers-panel'));
    const choices = app.querySelectorAll(casting ? '#cz-spell-choices .cc-ability-choose' : '#cz-maneuver-choices .cc-ability-choose');
    for (const choice of choices) {
      if (app.querySelector('#cz-next').getAttribute('aria-disabled') !== 'true') break;
      choice.click();
    }
    assert.notEqual(app.querySelector('#cz-next').getAttribute('aria-disabled'), 'true');
    app.querySelector('#cz-next').click(); assert.ok(app.querySelector('#cz-equipment-panel'));
    assert.equal(app.querySelector('#cz-relics'), null, 'equipment contains no relic choices');
    assert.equal(app.querySelector('#cz-maneuver-choices'), null, 'equipment contains no maneuver choices');
    app.querySelector('#cz-tab-keepsake').click(); assert.ok(app.querySelector('#cz-relics'));
    app.querySelector('#cz-next').click(); assert.ok(app.querySelector('#cz-review-summary'));
    app.querySelector('#cz-start').click();
    assert.ok(payload); assert.deepEqual(payload.initialClassTreeChoices, [id]);
    assert.equal(payload.startingAbilityIds.length, casting ? 2 : 1);
    assert.deepEqual(meta, original);
    app.querySelector('#cz-tab-subclass').click();
    app.querySelectorAll('#cz-subclass-selector-host button[data-subclass]')[1].click();
    assert.equal(app.querySelectorAll('[data-creation-trait][aria-pressed="true"]').length, 0, 'subclass changes clear earlier traits');
    assert.equal(app.querySelector('#cz-start').getAttribute('aria-disabled'), 'true');
  }));
}

test('native keyboard trait activation and reselection retain focus on the replacement canonical choice', () => creationDom(async (app, dom) => {
  const { mountCustomize } = await import('../src/ui/screens/customize.js');
  mountCustomize(app, { registries, defaultSeedString: 'GOLDBOUGH', onBack() {}, onStart() {} });
  app.querySelector('#cz-tab-subclass').click();
  await Promise.resolve();
  const original = app.querySelector('[data-creation-trait]');
  const id = original.dataset.creationTrait;
  original.focus();
  assert.equal(dom.document.activeElement, original);
  // Native Enter/Space activation arrives as click; the fixture models the
  // resulting activation and focus lifecycle without claiming trusted input.
  original.click();
  await Promise.resolve();
  const selected = [...app.querySelectorAll('[data-creation-trait]')].find(choice => choice.dataset.creationTrait === id);
  assert.notEqual(selected, original);
  assert.equal(selected.getAttribute('aria-pressed'), 'true');
  assert.equal(dom.document.activeElement, selected);
  assert.ok(app.contains(dom.document.activeElement));
  selected.click();
  await Promise.resolve();
  const reselectable = [...app.querySelectorAll('[data-creation-trait]')].find(choice => choice.dataset.creationTrait === id);
  assert.notEqual(reselectable, selected);
  assert.equal(reselectable.getAttribute('aria-pressed'), 'false');
  assert.equal(dom.document.activeElement, reselectable);
  assert.ok(app.contains(dom.document.activeElement));
}));

for (const [classId, abilityStep] of [['reaver', 'maneuvers'], ['starseer', 'spells']]) {
  test(`actual ${classId} creation keeps one section/count selector and no header view controls`, () => creationDom(async app => {
    const { mountCustomize } = await import('../src/ui/screens/customize.js');
    mountCustomize(app, { registries, defaultSeedString: 'GOLDBOUGH', shotPose: { classId }, onBack() {}, onStart() {} });
    const selector = app.querySelector('#cz-cat-select');
    assert.ok(selector);
    assert.equal(app.querySelector('#cz-current-step'), null);
    assert.equal(app.querySelector('.modal-head .cz-head-view-tools'), null);
    assert.equal(app.querySelector('#cz-class-view-toggle'), null);
    assert.equal(app.querySelector('#cz-equipment-view-toggle'), null);
    assert.equal(selector.getAttribute('aria-controls'), app.querySelector('.cz-rail').id);
    for (const [step, count] of [['class', 1], ['subclass', 2], ['attributes', 3], ['feats', 4], [abilityStep, 5], ['equipment', 6], ['keepsake', 7], ['review', 8]]) {
      app.querySelector(`#cz-tab-${step}`).click();
      assert.equal(selector.querySelector('.cc-step-count').textContent, `${count} of 8`);
      assert.equal(selector.querySelector('.cc-step-name').textContent, app.querySelector(`#cz-tab-${step} .rail-label`).textContent);
      assert.match(selector.getAttribute('aria-label'), new RegExp(`${count} of 8`));
      assert.equal(app.querySelector('.modal-head .cc-view-toggle'), null);
    }
    assert.equal(selector.children.at(-1).className, 'as-catnav-caret');
    assert.equal(selector.querySelectorAll('.cc-step-count').length, 1);
  }));
}

test('actual spell selector refuses a newly mastery-locked card through stale button and inspector while legal spells remain choosable', () => creationDom(async (app, dom) => {
  const source = { ...createRegistries(contentBundle) };
  const { mountCustomize } = await import('../src/ui/screens/customize.js');
  mountCustomize(app, { registries: source, defaultSeedString: 'GOLDBOUGH', shotPose: { classId: 'starseer' }, onBack() {}, onStart() {} });
  app.querySelector('#cz-tab-spells').click();
  const choices = [...app.querySelectorAll('#cz-spell-choices .cc-ability-choice')];
  const locked = choices.find(choice => !source.balance.progression.lessons['item:magic-focus'].includes(choice.dataset.cardId));
  assert.ok(locked, 'fixture exercises a class offer subject to mastery');
  const id = locked.dataset.cardId;
  source.classMastery = source.classMastery.filter(row => row.ref !== id);
  source.classMastery.push({ classId: 'starseer', kind: 'cards', ref: id, level: 99 });
  const choose = locked.querySelector('.cc-ability-choose');
  choose.click();
  choose.dispatchEvent(new dom.Event('click'));
  locked.querySelector('.card').dispatchEvent(new dom.Event('cardinspectionselect'));
  assert.equal(choose.getAttribute('aria-pressed'), 'false');
  assert.equal(locked.querySelector('.card').classList.contains('selected'), false);
  const legal = choices.find(choice => source.balance.progression.lessons['item:magic-focus'].includes(choice.dataset.cardId));
  legal.querySelector('.cc-ability-choose').click();
  assert.equal(legal.querySelector('.cc-ability-choose').getAttribute('aria-pressed'), 'true');
  assert.equal(choose.getAttribute('aria-pressed'), 'false');
  app.querySelector('#cz-tab-feats').click();
  app.querySelector('#cz-tab-spells').click();
  assert.equal(app.querySelector(`#cz-spell-choices [data-card-id="${id}"]`), null, 'the authoritative refreshed pool omits mastery-locked spells');
}));
