// Survey wave 6 (docs/ai/CLEAN-CODE-PROMPT.md §3, "Components that update themselves"): a flask, a purchase or a
// Shrine service changes a few numbers, so only the components that show them change. Each test proves the
// targeted node changed and the rest of the screen is the SAME node (identity, not equal markup), and where a fresh
// render is cheap to compare, that the updated screen is what a fresh render of the same run draws.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withKitDom } from './helpers/dom.mjs';
import { registries as hudRegistries } from './helpers/fixcore-combat-rules.mjs';
import { contentBundle } from '../src/content/index.js';
import { shops as shippedShops } from '../src/content/shops.js';
import { createRegistries } from '../src/model/registries.js';
import { configuredContentBundle } from '../src/model/advancedConfig.js';
import { applyGameProfileToContent, bindGameProfileRegistries, resolveGameProfile } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { buildBlacksmithStock } from '../src/engine/shopKinds.js';
import { runHudHtml, wireRunHud } from '../src/ui/components/runHud.js';
import { mountBlacksmith } from '../src/ui/screens/blacksmith.js';
import { mountRest } from '../src/ui/screens/rest.js';
import { createLocationVisit } from '../src/engine/locations.js';

const hpShown = (app) => app.querySelector('.shared-hud .resbars [data-res="hp"]')?.getAttribute('data-cur')
  ?? app.querySelector('.shared-hud .resbars .m-value')?.textContent;
const cindersShown = (app) => app.querySelector('.shared-hud [data-ui-component="cinders-counter"]')?.getAttribute('aria-label') || '';

test('RunHud update writes HP and cinders into the band it drew, keeping the band', () => {
  withKitDom((dom) => {
    const app = dom.document.createElement('main');
    dom.document.body.replaceChildren(app);
    const run = createRunState({ seed: 7, classId: 'reaver', registries: hudRegistries });
    run.cinders = 200;
    run.hp = run.maxHp - 10;
    app.innerHTML = runHudHtml({ registries: hudRegistries, run, meta: { settings: {} }, place: 'event', headerClass: 'map-header room-header' });
    const handle = wireRunHud(app, { registries: hudRegistries, run, meta: { settings: {} } });
    const band = app.querySelector('.shared-hud');
    const host = band.querySelector('.resbars-host');
    const bars = host.querySelector('.resbars');
    const hpBefore = hpShown(app);
    assert.ok(hpBefore, 'the HP bar is drawn');
    run.hp += 5;
    run.cinders = 150;
    handle.update();
    assert.equal(app.querySelector('.shared-hud'), band, 'the band is the same node');
    assert.equal(band.querySelector('.resbars-host'), host, 'the bar host is the same node');
    assert.notEqual(host.querySelector('.resbars'), bars, 'the HP bar was drawn again');
    assert.notEqual(hpShown(app), hpBefore, 'and shows the new HP');
    assert.match(hpShown(app), new RegExp(String(run.hp)));
    assert.match(cindersShown(app), /^150/, 'the cinders counter shows the new purse');
    assert.equal(app.querySelectorAll('.shared-hud').length, 1, 'one band');
  });
});


// ---- The Blacksmith: a purchase updates the purse, the shelves and the status in place --------------------------
const profile = resolveGameProfile(JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url))));
const OUT_ROWS = Object.fromEntries(shippedShops.blacksmith.offerings.map((row) => [`gameConfig.shops.blacksmith.${row.id}.chance`, 100]));
const coreOut = bindGameProfileRegistries(createRegistries(configuredContentBundle(applyGameProfileToContent(contentBundle, profile), OUT_ROWS)), profile);

function smithRun() {
  const run = createRunState({ seed: 31, classId: 'reaver', registries: coreOut, runId: 'bs-partial' });
  run.smithingStones = 3;
  run.cinders = 5000;
  run.seenEvents = [];
  run.shopStock = buildBlacksmithStock(coreOut, createRng(31), run);
  return run;
}
const mountSmith = (dom, run) => {
  const app = dom.document.createElement('main');
  dom.document.body.append(app);
  mountBlacksmith(app, { registries: coreOut, run, meta: { settings: {} }, onChanged() {}, onLeave() {}, hud: {} });
  return app;
};

test('a Blacksmith purchase updates the purse and the rows in place, and matches a fresh render', () => {
  withKitDom((dom) => {
    const run = smithRun();
    const app = mountSmith(dom, run);
    const root = app.querySelector('.shop-workspace');
    const frame = app.querySelector('.shop-frame');
    const band = app.querySelector('.shared-hud');
    const purse = app.querySelector('.modal-head-status');
    const shelf = app.querySelector('#blacksmith-armaments');
    const switchNode = app.querySelector('.shop-switch');
    const purseBefore = purse.textContent;
    const rowsBefore = [...shelf.querySelectorAll('.shop-offer')];
    const buy = [...shelf.querySelectorAll('button')].find((b) => b.textContent === 'Buy');
    assert.ok(buy, 'a buy button is drawn');
    const cinders = run.cinders;
    buy.click();
    assert.ok(run.cinders < cinders, 'the purchase committed');
    assert.equal(app.querySelector('.shop-workspace'), root, 'the workspace is the same node');
    assert.equal(app.querySelector('.shop-frame'), frame, 'the frame is the same node');
    assert.equal(app.querySelector('.shared-hud'), band, 'the HUD band is the same node');
    assert.equal(app.querySelector('.shop-switch'), switchNode, 'the category switch is the same node');
    assert.equal(app.querySelector('#blacksmith-armaments'), shelf, 'the shelf is the same node');
    assert.equal(app.querySelector('.modal-head-status'), purse, 'the purse is the same node');
    assert.notEqual(purse.textContent, purseBefore, 'the purse shows the new amount');
    assert.match(purse.textContent, new RegExp(String(run.cinders)));
    assert.match(cindersShown(app), new RegExp(`^${run.cinders}`), 'the HUD cinders follow the purchase');
    assert.ok([...shelf.querySelectorAll('.shop-offer')].every((row) => !rowsBefore.includes(row)), 'the rows were drawn from the new plans');

    const fresh = mountSmith(dom, run);
    assert.equal(app.querySelector('.shop-workspace').outerHTML, fresh.querySelector('.shop-workspace').outerHTML,
      'the updated workspace is what a fresh render of the same run draws (classes, aria, order)');
  });
});

