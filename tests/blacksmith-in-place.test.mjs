import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contentBundle } from '../src/content/index.js';
import { shops } from '../src/content/shops.js';
import { configuredContentBundle } from '../src/model/advancedConfig.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { buildBlacksmithStock } from '../src/engine/shopKinds.js';
import { mountBlacksmith } from '../src/ui/screens/blacksmith.js';
import { withKitDom as baseDom } from './helpers/dom.mjs';
import '../src/engine/runCombat.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const settings = Object.fromEntries(shops.blacksmith.offerings.map(row => [`gameConfig.shops.blacksmith.${row.id}.chance`, 100]));
const registries = bindGameProfileRegistries(createRegistries(configuredContentBundle(applyGameProfileToContent(contentBundle, profile), settings)), profile);

function fixture(dom) {
  const run = createRunState({ seed: 31, classId: 'reaver', registries, runId: 'smith-in-place' });
  run.cinders = 100000;
  run.smithingStones = 20;
  run.seenEvents = [];
  run.shopStock = buildBlacksmithStock(registries, createRng(31), run);
  const app = dom.document.createElement('main');
  dom.document.body.replaceChildren(app);
  let persisted = 0;
  const screen = mountBlacksmith(app, { registries, run, meta: { settings: {} }, onLeave() {}, onChanged() { persisted++; } });
  return { run, app, screen, persisted: () => persisted };
}

const offers = app => [...app.querySelectorAll('[data-shop-shelf="armaments"] .merchant-offer')];
const action = row => row.querySelector('.merchant-offer-action');
// A browser's element.click() is a synthetic click with detail 0, which an armed Buy reads as a tap that opens its
// review (tests/purchase-confirm.test.mjs); the kit DOM omits detail, which reads as a click with no press behind it.
function withKitDom(fn) {
  const timers = [], timeout = globalThis.setTimeout;
  globalThis.setTimeout = (...args) => { const timer = timeout(...args); timers.push(timer); return timer; };
  try {
    return baseDom((dom, globals) => {
      const proto = Object.getPrototypeOf(dom.document.createElement('button'));
      const click = proto.click;
      proto.click = function () { if (!this.disabled) this.dispatchEvent(new globals.Event('click', { bubbles: true, detail: 0 })); };
      try { return fn(dom); } finally { proto.click = click; }
    });
  } finally { for (const timer of timers) clearTimeout(timer); globalThis.setTimeout = timeout; }
}

test('Blacksmith armament and art purchases ask before changing funds, stock or inventory', () => withKitDom(dom => {
  const { app, run, persisted } = fixture(dom);
  for (const kind of ['armaments', 'weaponArts']) {
    app.querySelector(`[data-shop-category="${kind}"]`).click();
    const control = [...app.querySelectorAll(`[data-shop-shelf="${kind}"] [data-shop-action="buy"]`)].find(control => !control.disabled);
    assert.ok(control, `${kind}: an affordable item is available`);
    const before = JSON.stringify(run);
    control.click(); control.click();
    assert.ok(document.querySelector('.confirmation-modal'));
    assert.match(document.querySelector('#confirmation-modal-copy').outerHTML, /cinders/);
    assert.equal(JSON.stringify(run), before); assert.equal(persisted(), 0);
    document.querySelector('.confirmation-cancel').click();
    assert.equal(JSON.stringify(run), before);
  }
}));

test('Blacksmith refresh preserves the shell, category, shelf, rows and scroll', () => withKitDom(dom => {
  const { app, screen } = fixture(dom);
  const root = app.querySelector('.blacksmith-workspace');
  const frame = app.querySelector('.shop-frame');
  const port = app.querySelector('.shop-offers');
  const shelf = app.querySelector('[data-shop-shelf="armaments"]');
  const tab = app.querySelector('[data-shop-category="armaments"]');
  const rows = offers(app);
  tab.click();
  port.scrollTop = 237; shelf.scrollTop = 119;
  screen.refresh();
  assert.equal(app.querySelector('.blacksmith-workspace'), root);
  assert.equal(app.querySelector('.shop-frame'), frame);
  assert.equal(app.querySelector('.shop-offers'), port);
  assert.equal(app.querySelector('[data-shop-shelf="armaments"]'), shelf);
  assert.equal(app.querySelector('[data-shop-category="armaments"]'), tab);
  assert.equal(tab.getAttribute('aria-selected'), 'true');
  assert.deepEqual(offers(app), rows);
  assert.equal(port.scrollTop, 237);
  assert.equal(shelf.scrollTop, 119);
}));

test('sequential purchases retain unaffected rows and dispatch their refreshed quotes', () => withKitDom(dom => {
  const { app, run, persisted } = fixture(dom);
  app.querySelector('[data-shop-category="armaments"]').click();
  const root = app.querySelector('.blacksmith-workspace');
  const port = app.querySelector('.shop-offers');
  port.scrollTop = 211;
  const [first, second] = offers(app).filter(row => !action(row).disabled);
  assert(first && second, 'two affordable rack items');
  const secondControl = action(second);
  const before = run.cinders;
  action(first).click();
  dom.document.querySelector('.confirmation-confirm').click();
  assert.equal(app.querySelector('.blacksmith-workspace'), root);
  assert.equal(port.scrollTop, 211);
  assert.equal(second.isConnected, true, 'unaffected row retains DOM');
  assert.equal(action(second), secondControl);
  assert.equal(first.isConnected, false, 'bought row is removed');
  const afterFirst = run.cinders;
  assert(afterFirst < before);
  dom.document.querySelector('#what-changed-continue').click();
  secondControl.click();
  dom.document.querySelector('.confirmation-confirm').click();
  assert(run.cinders < afterFirst, 'retained handler uses a current trade revision');
  assert.equal(persisted(), 2);
  assert.equal(app.querySelector('.bs-refusal'), null);
}));

test('purse changes update dependent action availability without replacing the parent shelf', () => withKitDom(dom => {
  const { app, run, screen } = fixture(dom);
  const shelf = app.querySelector('[data-shop-shelf="armaments"]');
  assert(offers(app).some(row => !action(row).disabled));
  run.cinders = 0;
  screen.refresh();
  assert.equal(app.querySelector('[data-shop-shelf="armaments"]'), shelf);
  assert(offers(app).every(row => action(row).disabled));
  assert(offers(app).some(row => row.querySelector('.shop-offer-avail')));
  run.cinders = 100000;
  screen.refresh();
  assert(offers(app).some(row => !action(row).disabled));
}));

test('a refresh after leaving cannot replace the next screen', () => withKitDom(dom => {
  const { app, screen } = fixture(dom);
  const next = dom.document.createElement('section');
  app.replaceChildren(next);
  screen.refresh();
  assert.equal(app.firstElementChild, next);
}));

// A retained row's own button must run the plan of the latest refresh: upgrading Y moves the trade revision, and
// X's kept Upgrade button used to pass its first-build plan, which the commit refused as stale.
test('upgrading a retained row after another upgrade commits its current plan', () => withKitDom(dom => {
  const { app, run } = fixture(dom);
  app.querySelector('[data-shop-category="upgrade"]').click();
  const upgradeRows = () => [...app.querySelectorAll('[data-shop-shelf="upgrade"] .merchant-offer')].filter(row => !action(row).disabled);
  const [x, y] = upgradeRows();
  assert(x && y, 'two upgradable items');
  const choose = () => {
    dom.document.querySelector('[data-smith-option]:not([disabled])').click();
    [...dom.document.querySelectorAll('button')].find(node => node.textContent === 'Choose').click();
  };
  action(y).click(); choose();
  dom.document.querySelector('#what-changed-continue')?.click();
  assert.equal(x.isConnected, true, 'the untouched row is retained');
  const stones = run.smithingStones;
  action(x).click(); choose();
  assert.equal(x.querySelector('.bs-refusal'), null, 'the retained Upgrade is not refused as stale');
  assert(run.smithingStones < stones, 'the second upgrade committed');
}));

// Every row is keyed: a copy shelf with several owned cards draws one row per card, not one row that the next
// card's row replaces.
test('the card-copy shelf keeps one keyed row per owned card', () => withKitDom(dom => {
  const { app } = fixture(dom);
  const tab = app.querySelector('[data-shop-category="cardCopy"]');
  assert.ok(tab, 'every offering is stocked, the copy shelf included');
  tab.click();
  const copyRows = [...app.querySelectorAll('[data-shop-shelf="cardCopy"] .merchant-offer')];
  assert(copyRows.length > 1, 'several owned cards can be copied');
  assert.equal(new Set(copyRows.map(row => row.dataset.smithKey)).size, copyRows.length, 'each copy row has its own key');
}));
