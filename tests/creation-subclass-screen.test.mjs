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
  app.querySelector('#cz-tab-class').click();
  assert.equal(app.querySelectorAll('#cz-starting-deck-host .cc-subclass-deck-card').length, 11);
}));
