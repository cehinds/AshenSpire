// The independent review of #1377 (SPEC §14.3, step 5b): each finding with
// its test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { shops as shippedShops } from '../src/content/shops.js';
import { createRegistries } from '../src/model/registries.js';
import { configuredContentBundle } from '../src/model/advancedConfig.js';
import { createRng } from '../src/engine/rng.js';
import { buildMarketStock } from '../src/engine/shopKinds.js';
import { eligibleEventIds } from '../src/engine/encounters.js';
import { createRunState, validateRunShape } from '../src/model/state.js';
import { shopStockProblems } from '../src/model/shopKinds.js';
import { combatSnapshotProblems } from '../src/model/combatSnapshot.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { serializeCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { skillBookReadPlan } from '../src/model/consumables.js';
import { questEventPlan } from '../src/model/marketAdditions.js';
import { withKitDom } from './helpers/kit-dom.mjs';
import { mountEquipment } from '../src/ui/screens/equipment.js';

const REG = createRegistries(contentBundle);
const PREFIX = 'gameConfig.shops.';
const registriesWith = (settings) => createRegistries(configuredContentBundle(contentBundle, settings));
const book = () => REG.consumables.all().find((def) => def.kind === 'skillBook');

// The kit DOM fixture lacks four things the Armoury reads; each is supplied
// here, minimally, for this file only.
function armouryDom(dom) {
  if (!dom.document.documentElement) dom.document.documentElement = dom.document.createElement('html');
  globalThis.NodeFilter = globalThis.NodeFilter || { SHOW_TEXT: 4 };
  dom.document.createTreeWalker = () => ({ nextNode: () => false, currentNode: null });
  const proto = Object.getPrototypeOf(dom.document.body);
  proto.replaceWith = proto.replaceWith || function replaceWith(node) {
    const parent = this.parentNode;
    if (!parent) return;
    const at = parent.children.indexOf(this);
    node.remove?.();
    node.parentNode = parent;
    parent.children.splice(at, 1, node);
    this.parentNode = null;
  };
  if (!Object.getOwnPropertyDescriptor(proto, 'parentElement')) {
    Object.defineProperty(proto, 'parentElement', { configurable: true, get() { return this.parentNode || null; } });
  }
}

test('review 1 (DOM): the Armoury offers Read on a skill book out of combat, reading it pays the track, and in combat there is no Read', () => {
  withKitDom((dom) => {
    armouryDom(dom);
    for (const inCombat of [false, true]) {
      const run = createRunState({ seed: 3, classId: 'reaver', registries: REG });
      run.consumables = { [book().id]: 2 };
      const app = dom.document.createElement('main');
      dom.document.body.replaceChildren(app);
      let changed = 0;
      mountEquipment(app, { registries: REG, run, meta: { settings: { equipView: 'hybrid' } }, inCombat, onClose() {}, onChange() { changed += 1; } });
      const face = dom.document.body.querySelectorAll('.inventory-face').find((node) => node.dataset.inventoryItem === `consumable:${book().id}`);
      assert.ok(face, `inCombat ${inCombat}: the book is listed in the Inventory`);
      face.parentNode.click();
      const read = dom.document.body.querySelectorAll('.armoury-read-book');
      const foot = dom.document.body.querySelectorAll('.armoury-foot-action').filter((node) => node.dataset.footAct === 'read');
      if (inCombat) {
        assert.equal(read.length, 0, 'no Read in combat');
        assert.equal(foot.length, 0, 'and no Read in the footer');
      } else {
        assert.equal(read.length, 1, 'Read out of combat');
        assert.equal(foot.length, 1, 'and in the footer');
        const before = run.skills[book().skill]?.xp ?? 0;
        read[0].click();
        assert.equal(run.consumables[book().id], 1, 'one book used');
        assert.ok(run.skills[book().skill], 'the track was paid');
        assert.ok(changed >= 1, 'the change persisted');
        assert.ok(run.skills[book().skill].xp !== before || run.skills[book().skill].level > 0);
      }
    }
  });
});

test('review 1 (model): skillBookReadPlan refuses a read in combat by name', () => {
  const run = createRunState({ seed: 3, classId: 'reaver', registries: REG });
  run.consumables = { [book().id]: 1 };
  assert.equal(skillBookReadPlan(REG, run, book().id).ok, true);
  const plan = skillBookReadPlan(REG, run, book().id, { inCombat: true });
  assert.equal(plan.ok, false);
  assert.match(plan.reason, /fight|combat/i);
});

test('review 3: an empty offering list is refused while any shelf still holds stock, and allowed when none does', () => {
  const run = createRunState({ seed: 4, classId: 'reaver', registries: REG });
  run.seenEvents = [];
  const stock = buildMarketStock(REG, createRng(4), run, { meta: {} });
  const tampered = { ...structuredClone(stock), offerings: [] };
  assert.ok(stock.cards.length > 0);
  assert.ok(shopStockProblems(tampered).some((p) => /shopStock\.offerings is empty/.test(p) && /cards/.test(p)), shopStockProblems(tampered).join(' | '));
  const withBooks = { kind: 'market', offerings: [], cards: [], skillBooks: [{ id: book().id, cost: 5 }] };
  assert.ok(shopStockProblems(withBooks).some((p) => /skillBooks/.test(p)));
  const pruned = { kind: 'market', offerings: [], cards: [], relics: [], flasks: [], armaments: [], weaponArts: [], removeCost: 75 };
  assert.deepEqual(shopStockProblems(pruned), [], 'every shelf empty: the prune\'s honest result');
  assert.ok(validateRunShape({ ...run, shopStock: tampered }).some((p) => /offerings is empty/.test(p)));
});

test('review 4: the quest event never pre-empts an event assigned to an unvisited Unknown node on the current map', () => {
  const registries = registriesWith({ ...Object.fromEntries(shippedShops.market.offerings.map((row) => [`${PREFIX}market.${row.id}.chance`, 0])), [`${PREFIX}market.questEvent.chance`]: 100, [`${PREFIX}market.questEvent.weight`]: 1000 });
  const run = createRunState({ seed: 9, classId: 'reaver', registries });
  const pool = eligibleEventIds(registries, { history: run.history });
  const [held, visited, ...rest] = pool;
  run.seenEvents = [...rest];
  run.path = ['n2'];
  run.mapGraph = { floors: 2, nodes: {
    n1: { id: 'n1', type: 'event', resolved: { kind: 'event', eventId: held } },
    n2: { id: 'n2', type: 'event', resolved: { kind: 'event', eventId: visited } },
  } };
  for (let seed = 1; seed <= 12; seed++) {
    const stock = buildMarketStock(registries, createRng(seed), run, { meta: {} });
    assert.equal(stock.questEvent?.eventId, visited, `seed ${seed}: only the event not waiting on an unvisited node is offered`);
  }
  // Once the visited node's event is seen too, nothing is left: not stocked, and the guarantee fills.
  run.seenEvents.push(visited);
  const stock = buildMarketStock(registries, createRng(3), run, { meta: {} });
  assert.ok(!stock.offerings.includes('questEvent'));
  assert.equal(stock.offerings.length, registries.shops.market.guaranteedMinimum);
});

test('review 5: the quest event plan refuses too few cinders by name, and changes nothing', () => {
  const registries = registriesWith({ [`${PREFIX}market.questEvent.chance`]: 100 });
  const run = createRunState({ seed: 5, classId: 'reaver', registries });
  run.seenEvents = [];
  run.shopStock = buildMarketStock(registries, createRng(5), run, { meta: {} });
  const offer = run.shopStock.questEvent;
  assert.ok(offer);
  run.cinders = offer.price - 1;
  const plan = questEventPlan(registries, run);
  assert.equal(plan.ok, false);
  assert.match(plan.reason, /cinders/i);
  assert.equal(run.shopStock.questEvent.taken, false);
  run.cinders = offer.price;
  assert.equal(questEventPlan(registries, run).ok, true);
});

test('review 6: a combat snapshot\'s consumable counts are whole numbers of at least 1, as the run\'s are', () => {
  const run = createRunState({ seed: 4, classId: 'reaver', registries: REG });
  run.consumables = { [book().id]: 1 };
  const combat = createRunCombat({ registries: REG, rng: createRng(4), run, enemyIds: REG.encounters.all()[0].enemies });
  const snapshot = serializeCombatSnapshot(combat);
  assert.deepEqual(combatSnapshotProblems(snapshot), []);
  for (const bad of [0, -1, 1.5]) {
    assert.ok(combatSnapshotProblems({ ...snapshot, consumables: { [book().id]: bad } }).some((p) => /consumables\./.test(p)), `count ${bad} is refused`);
  }
});
