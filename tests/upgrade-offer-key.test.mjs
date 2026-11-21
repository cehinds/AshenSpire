// Upgrade options are rolled once per upgrade source (owner, 2026-11-20): the visit's offer key is folded into every
// upgrade seed, so the same stay shows the same options and the next source re-rolls them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { shops as shippedShops } from '../src/content/shops.js';
import { createRegistries } from '../src/model/registries.js';
import { configuredContentBundle } from '../src/model/advancedConfig.js';
import { applyGameProfileToContent, bindGameProfileRegistries, resolveGameProfile } from '../src/model/gameProfile.js';
import { createRunState, validateRunShape } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { buildBlacksmithStock } from '../src/engine/shopKinds.js';
import { planCardUpgrade, commitCardUpgrade } from '../src/model/cardUpgradeService.js';
import { cardUpgradeModel } from '../src/ui/models/CardUpgradeModel.js';
import { RollSmithOptions } from '../src/model/smithUpgrade.js';
import { PlanCategoryChange, KeepableProperties } from '../src/model/smithCategory.js';
import { TakeOfferKey, StampOfferKey, UpgradeOfferKey, OfferSalted } from '../src/model/upgradeOffer.js';
import '../src/engine/runCombat.js';

const profile = resolveGameProfile(JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url))));
const OUT_ROWS = Object.fromEntries(shippedShops.blacksmith.offerings.map((row) => [`gameConfig.shops.blacksmith.${row.id}.chance`, 100]));
const registries = bindGameProfileRegistries(createRegistries(configuredContentBundle(applyGameProfileToContent(contentBundle, profile), OUT_ROWS)), profile);
const GS = 'armament/greatsword';

function smithRun(seed = 31) {
  const run = createRunState({ seed, classId: 'reaver', registries, runId: 'offer-key', profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  run.smithingStones = 9; run.cinders = 5000; run.seenEvents = [];
  run.shopStock = buildBlacksmithStock(registries, createRng(seed), run);
  run.gameProfileOpenShop = `${run.actNumber}:${run.mapNodeId}`;
  return run;
}
// Enter another upgrade source: the stock is rebuilt and takes the next key.
const nextVisit = (run) => { delete run.shopStock.offerKey; return StampOfferKey(run, run.shopStock); };
const optionsOf = (run, instanceId) => JSON.stringify((planCardUpgrade(run, registries, instanceId, { choices: 3 }).options || []).map((o) => o.step));

test('the serial counts up and a stamped record keeps its key', () => {
  const run = smithRun();
  assert.equal(UpgradeOfferKey(run), 0, 'an unstamped visit has no key');
  assert.equal(TakeOfferKey(run), 1);
  assert.equal(StampOfferKey(run, run.shopStock), 2);
  assert.equal(StampOfferKey(run, run.shopStock), 2, 'a reload or reopen keeps the key');
  assert.equal(run.upgradeOfferSerial, 2);
  assert.equal(UpgradeOfferKey(run), 2);
  assert.equal(OfferSalted(run, 'x'), 'x@offer2');
  assert.deepEqual(validateRunShape(run), []);
  run.shopStock.offerKey = 7;
  assert.ok(validateRunShape(run).some((p) => p.includes('shopStock.offerKey must not exceed')));
});

test('no key rolls exactly as before (an old save mid-visit)', () => {
  const run = smithRun();
  const card = run.deck[0];
  const bare = optionsOf(run, card.instanceId);
  delete run.gameProfileOpenShop;
  StampOfferKey(run, run.shopStock);
  assert.equal(UpgradeOfferKey(run), 0, 'a closed shop lends no key');
  assert.equal(optionsOf(run, card.instanceId), bare);
});

test('same offer key: repeated plans and a reopened picker show identical options', () => {
  const run = smithRun();
  StampOfferKey(run, run.shopStock);
  for (const card of run.deck) {
    const first = optionsOf(run, card.instanceId);
    assert.equal(optionsOf(run, card.instanceId), first);
  }
  const open = () => JSON.stringify(cardUpgradeModel(registries, run, run.deck[0].instanceId, { blacksmith: true }).rows.map((row) => row.options.map((o) => o.step)));
  const shown = open();
  assert.equal(open(), shown, 'close and reopen: same options');
});

test('a new offer key re-rolls the options for most cards', () => {
  let differ = 0, total = 0;
  for (let seed = 1; seed <= 12; seed += 1) {
    const run = smithRun(seed);
    StampOfferKey(run, run.shopStock);
    const ids = [...new Set(run.deck.map((c) => c.cardId))].map((id) => run.deck.find((c) => c.cardId === id).instanceId).filter((id) => optionsOf(run, id) !== "[]");
    const before = ids.map((id) => optionsOf(run, id));
    nextVisit(run);
    ids.forEach((id, i) => { total += 1; if (optionsOf(run, id) !== before[i]) differ += 1; });
  }
  assert.ok(differ / total > 0.5, `${differ} of ${total} cards re-rolled`);
});

test('preview equals commit under a key, for every offered option', () => {
  const run = smithRun();
  StampOfferKey(run, run.shopStock);
  const card = run.deck.find((c) => c.cardId === 'core.strike') || run.deck[0];
  const plan = planCardUpgrade(run, registries, card.instanceId, { choices: 3 });
  const pick = plan.options[plan.options.length - 1];
  const receipt = commitCardUpgrade(run, registries, { ...plan, step: pick.step, after: pick.after });
  assert.deepEqual(receipt.step, pick.step);
});

test('item options and a category change hold for the visit and re-roll at the next one', () => {
  const run = smithRun();
  StampOfferKey(run, run.shopStock);
  const options = JSON.stringify(RollSmithOptions(run, GS));
  assert.equal(JSON.stringify(RollSmithOptions(run, GS)), options);
  let rerolled = 0;
  for (let i = 0; i < 8; i += 1) { nextVisit(run); if (JSON.stringify(RollSmithOptions(run, GS)) !== options) rerolled += 1; }
  assert.ok(rerolled >= 4, `item options re-rolled at ${rerolled} of 8 visits`);
  // Ticking a keep box never re-rolls the new properties, except to skip one the weapon keeps.
  run.itemUpgradePicks = { [GS]: [{ id: 'prop:x', k: 'stat', stat: 'strength', n: 1 }, { id: 'poise', k: 'stat', stat: 'poise', n: 3 }] };
  const keys = KeepableProperties(run, GS).map((row) => row.key);
  const a = PlanCategoryChange(run, GS, 'katana', [keys[0]]).newProperties;
  const b = PlanCategoryChange(run, GS, 'katana', [keys[1]]).newProperties;
  const c = PlanCategoryChange(run, GS, 'katana', [keys[1], keys[0]]).newProperties;
  assert.deepEqual(a, b);
  assert.deepEqual(a, c);
});
