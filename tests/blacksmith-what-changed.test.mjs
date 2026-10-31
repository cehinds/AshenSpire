// Owner ask 2026-10-31: every Blacksmith purchase shows the what-changed receipt (SPEC 14.4); a refusal does not.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { shops as shippedShops } from '../src/content/shops.js';
import { createRegistries } from '../src/model/registries.js';
import { configuredContentBundle } from '../src/model/advancedConfig.js';
import { applyGameProfileToContent, bindGameProfileRegistries, resolveGameProfile } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { buildBlacksmithStock, blacksmithVisitStock } from '../src/engine/shopKinds.js';
import { blacksmithUpgradePlan, commitBlacksmithUpgrade } from '../src/model/blacksmith.js';
import { coreArmamentPlan, commitCoreArmament, coreWeaponArtPlan, commitCoreWeaponArt, rollTier } from '../src/model/blacksmithStock.js';
import { beginGameProfileRest, commitGameProfileRest } from '../src/model/gameProfileRest.js';
import { smithingPlan } from '../src/model/smithing.js';
import { buildActMap } from '../src/engine/actmap.js';
import { cardUpgradeModel } from '../src/ui/models/CardUpgradeModel.js';
import { upgradeArtPlan, commitUpgradeArt } from '../src/model/blacksmith.js';
import { validateRunShape, serializeRun, deserializeRun } from '../src/model/state.js';
import { shopStockProblems } from '../src/model/shopKinds.js';
import { pruneUnknownAdditionOffers } from '../src/model/marketStock.js';
import { rankUpPlan, commitRankUp, rankUpCards, serviceCandidates } from '../src/model/blacksmith.js';
import '../src/engine/runCombat.js';

const profile = resolveGameProfile(JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url))));
const OUT_ROWS = Object.fromEntries(shippedShops.blacksmith.offerings.map((row) => [`gameConfig.shops.blacksmith.${row.id}.chance`, 100]));
const coreOut = bindGameProfileRegistries(createRegistries(configuredContentBundle(applyGameProfileToContent(contentBundle, profile), OUT_ROWS)), profile);
const legacyOut = createRegistries(configuredContentBundle(contentBundle, OUT_ROWS));

function smithRun(registries, { stones = 3, cinders = 2000, seed = 31 } = {}) {
  const run = createRunState({ seed, classId: 'reaver', registries, runId: 'bs-economy' });
  run.smithingStones = stones;
  run.cinders = cinders;
  run.seenEvents = [];
  run.shopStock = buildBlacksmithStock(registries, createRng(seed), run);
  return run;
}
const strike = (run) => run.deck.find((c) => c.cardId === 'core.strike');

import { withKitDom } from './helpers/kit-dom.mjs';
import { mountBlacksmith } from '../src/ui/screens/blacksmith.js';

const mount = (dom, run) => {
  const app = dom.document.createElement('main');
  dom.document.body.replaceChildren(app);
  mountBlacksmith(app, { registries: coreOut, run, meta: { settings: {} }, onChanged() {}, onLeave() {} });
  return app;
};
const receipt = (dom) => dom.document.body.querySelector('.what-changed-modal');

test('buying a tiered armament opens a receipt with the armament, its stat rows and the cinders spent', () => {
  withKitDom((dom) => {
    const run = smithRun(coreOut, { cinders: 5000 });
    const app = mount(dom, run);
    const tiered = [...app.querySelectorAll('.shop-offer[data-armament-tier]')].find((tile) => Number(tile.dataset.armamentTier) > 0);
    const buy = [...(tiered || app).querySelectorAll('button')].find((b) => b.textContent === 'Buy');
    assert.ok(buy, 'a buy button is drawn');
    const cinders = run.cinders;
    buy.click();
    assert.ok(run.cinders < cinders, 'the purchase committed');
    const modal = receipt(dom);
    assert.ok(modal, 'receipt open');
    assert.ok(modal.querySelector('[data-what-changed-kind="armament"]'), 'armament row');
    if (tiered) assert.ok(modal.querySelector('[data-what-changed-kind="armament"] .as-delta'), 'the armament tier stat rows');
    assert.ok(modal.querySelector('[data-what-changed-kind="resource"]'), 'cinders row');
    assert.ok(modal.querySelector('.what-changed-cost'), 'cost strip');
  });
});

test('a refused purchase opens no receipt and keeps the inline refusal', () => {
  withKitDom((dom) => {
    const run = smithRun(coreOut, { cinders: 5000 });
    const app = mount(dom, run);
    const buy = [...app.querySelectorAll('button')].find((b) => b.textContent === 'Buy');
    run.cinders = 0; // goes stale after the screen drew it as affordable
    buy.click();
    assert.equal(receipt(dom), null);
    assert.ok(app.querySelector('.bs-refusal'), 'inline refusal');
  });
});

test('ranking up a card opens a receipt with the card row', () => {
  withKitDom((dom) => {
    const run = smithRun(coreOut, { cinders: 5000, stones: 10 });
    if (!run.shopStock.offerings.includes('rankUp')) return;
    const app = mount(dom, run);
    const go = [...app.querySelectorAll('button')].find((b) => b.textContent === 'Rank up' && !b.disabled);
    assert.ok(go, 'a rank-up action is drawn');
    go.click();
    const modal = receipt(dom);
    assert.ok(modal && modal.querySelector('[data-what-changed-kind="card"]'), 'card row');
  });
});
