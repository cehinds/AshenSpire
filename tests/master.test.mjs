// SPEC §14.5, §14.6 step 7 — the wise master, built to the shapes of the
// SPEC-only PR #1431.
//
// docs/FINISH.md §14 "Wise master" is the acceptance line: a level-4 track
// respecs to level 1 with xp 0 and the pool gains floor((respecRefundPct /
// 100) × spent) (60% of 500 XP spent adds 300); level 1 is refused;
// respecRefundPct 80 clamps to 75; a master with 2 skills, or with an armour
// or `class:` track, is refused by name; training and redistribute level a
// track through the one writer, and training an unheld track across its
// upgrade threshold upgrades its owned cards; a master holding `dualWield`
// stocks one-handed armaments and their arts; a lesson rolls through
// rollSkillDraftIds from the master's schools and adds one card, a level-0
// track still draws commons, and a lesson whose roll is empty is refused
// before payment; appraisal changes nothing. The rest is what the step must
// also hold: the kind registered with its offerings classified truthfully,
// every number a noted Settings row with its floor, the masters list
// validated, services that stay once rolled, one schema bump, and the load
// door's pruning.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { shops as shippedShops } from '../src/content/shops.js';
import { NOTE } from '../src/content/balance.js';
import { createRegistries } from '../src/model/registries.js';
import { advancedConfigRows, configuredContentBundle } from '../src/model/advancedConfig.js';
import { createRng } from '../src/engine/rng.js';
import { buildMasterStock, buildMerchantStock, masterVisitStock, marketVisitStock, rollMasterLesson, rollShopOfferings } from '../src/engine/shopKinds.js';
import { rollSkillDraftIds } from '../src/engine/encounters.js';
import { createRunState, RUN_SCHEMA_VERSION, validateRunShape } from '../src/model/state.js';
import { validateContent } from '../src/model/validate.js';
import { createSaveManager, createMemoryStorage, RUN_KEY } from '../src/engine/save.js';
import { SHOP_KIND_SCREENS, shopSettingsProblems, shopSentence, shopStockProblems } from '../src/model/shopKinds.js';
import { awardSkillXp, skillSchools, xpToNext, rarityUnlockedAt } from '../src/model/skills.js';
import { carriedIds } from '../src/model/loadout.js';
import { consumableSalePlan } from '../src/model/consumables.js';
import {
  MASTER_SERVICES, masterOf, masterSchools, masterPieces, masterArmamentPool, masterArtPool, masterBookPool,
  respecRefundPct, trainingPlan, commitTraining, respecPlan, commitRespec,
  redistributePlan, commitRedistribute, lessonPool, lessonPlan, commitLesson,
  masterAppraisal, masterServiceCandidates,
} from '../src/model/master.js';
import { createAtlasIndex, generateJourney, journeyProblems } from '../src/model/worldAtlas.js';
import { worldAtlas } from '../src/content/generated/worldAtlas.js';
import { withKitDom } from './helpers/kit-dom.mjs';
import { mountMaster } from '../src/ui/screens/master.js';

const REG = createRegistries(contentBundle);
const PREFIX = 'gameConfig.shops.';
const registriesWith = (settings) => createRegistries(configuredContentBundle(contentBundle, settings));
const OFFERINGS = shippedShops.master.offerings.map((row) => row.id);
const ALL_OUT = Object.fromEntries(OFFERINGS.map((id) => [`${PREFIX}master.${id}.chance`, 100]));
const OUT = registriesWith(ALL_OUT);
const offeringOf = (registries, id) => registries.shops.master.offerings.find((row) => row.id === id);
const bundleWithShops = (mutate) => {
  const table = structuredClone(shippedShops);
  mutate(table);
  return { ...contentBundle, shops: table };
};
const errorsOf = (bundle) => validateContent(bundle).errors.map((e) => `${e.path} ${e.msg}`);
// A registry whose only master is `master` (tests that never reload).
const withMaster = (master, base = contentBundle) => createRegistries({ ...base, shops: { ...structuredClone(shippedShops), ...configuredShops(base), masters: [master] } });
function configuredShops(base) { return base === contentBundle ? {} : { ...base.shops }; }

function masterRun(registries = OUT, { seed = 21, cinders = 5000, classId = 'reaver' } = {}) {
  const run = createRunState({ seed, classId, registries });
  run.cinders = cinders;
  run.seenEvents = [];
  const rng = createRng(seed);
  run.shopStock = buildMasterStock(registries, rng, run);
  return { run, rng };
}

function reload(run, rng, registries = OUT) {
  const storage = createMemoryStorage();
  createSaveManager(storage).saveRun(run, rng);
  const back = createSaveManager(storage).loadRun(registries);
  assert.ok(back, 'the save loads');
  return back;
}

const track = (run, skillId, row) => { run.skills = { ...(run.skills || {}), [skillId]: { xp: 0, level: 0, pendingDrafts: 0, ...row } }; };

// ---------------------------------------------------------------------------
// The kind, its offerings and their numbers
// ---------------------------------------------------------------------------

test('the master screen is registered; its weight ships 0 with a Settings row; the shipped content validates', () => {
  assert.ok(SHOP_KIND_SCREENS.includes('master'));
  assert.equal(shippedShops.kindWeights.master, 0, 'the owner raises the weight, not this step');
  const rows = new Map(advancedConfigRows(contentBundle).map((row) => [row.key, row]));
  assert.equal(rows.get(`${PREFIX}kindWeights.master`)?.def, 0, 'the master weight has its row');
  assert.deepEqual(validateContent(contentBundle).errors, []);
  assert.deepEqual(errorsOf(bundleWithShops((t) => { t.kindWeights.master = 50; })).filter((m) => /kindWeights/.test(m)), [], 'a raised weight is accepted');
  assert.deepEqual(shopSettingsProblems(contentBundle, {}), []);
});

test('the master offerings are classified: training and appraisal are not conditional, everything else is', () => {
  const byId = Object.fromEntries(shippedShops.master.offerings.map((row) => [row.id, row]));
  assert.equal(byId.training.conditional, false);
  assert.equal(byId.training.stockKey, 'shops.master.training.training.perVisit');
  assert.equal(byId.appraisal.conditional, false);
  assert.equal(byId.appraisal.stockKey, undefined, 'there is always a track to show');
  for (const id of OFFERINGS.filter((id) => !['training', 'appraisal'].includes(id))) {
    assert.equal(byId[id].conditional, true, `${id} is conditional`);
    assert.ok(typeof byId[id][NOTE].conditional === 'string' && byId[id][NOTE].conditional.length > 20, `${id} says why`);
  }
  // Disabling one of the two leaves one: refused by name, in Settings and content.
  const off = shopSettingsProblems(contentBundle, { [`${PREFIX}master.appraisal.enabled`]: false });
  assert.ok(off.some((p) => p.kind === 'master' && p.id === 'settings.shops.refuse.conditional'), JSON.stringify(off));
  const empty = shopSettingsProblems(contentBundle, { [`${PREFIX}master.training.training.perVisit`]: 0 });
  assert.ok(empty.some((p) => p.kind === 'master' && p.id === 'settings.shops.refuse.emptyStock'), JSON.stringify(empty));
  assert.ok(errorsOf(bundleWithShops((t) => { t.master.offerings.find((r) => r.id === 'training').enabled = false; })).some((m) => /^shops\.master .*can never come up empty/.test(m)));
  // Their authored pool is the masters list: an empty one is refused by name.
  assert.ok(errorsOf(bundleWithShops((t) => { t.masters = []; })).some((m) => /^shops\.masters/.test(m)));
});

test('every master number is a noted Settings row with its floor; a bad one is refused by name', () => {
  const rows = new Map(advancedConfigRows(contentBundle).map((row) => [row.key, row]));
  const floors = {
    'skillBooks.stock': 0, 'weaponArts.stock': 0, 'armaments.stock': 0,
    'training.training.cinders': 1, 'training.training.xp': 1, 'training.training.perVisit': 0,
    'respec.respec.cost.base': 1, 'respec.respec.cost.perLevel': 0, 'lesson.cinders': 1,
  };
  for (const [path, floor] of Object.entries(floors)) {
    const row = rows.get(`${PREFIX}master.${path}`);
    assert.ok(row, `${path} has a row`);
    assert.equal(row.integer, true, `${path} is whole`);
    assert.equal(row.min, floor, `${path} starts at ${floor}`);
    assert.ok(row.note.length > 20, `${path} carries its sentence`);
  }
  const pct = rows.get(`${PREFIX}master.respecRefundPct`);
  assert.equal(pct.min, 50);
  assert.equal(pct.max, 75);
  const find = (t, id) => t.master.offerings.find((row) => row.id === id);
  const refused = (mutate, pattern) => assert.ok(errorsOf(bundleWithShops(mutate)).some((m) => pattern.test(m)), String(pattern));
  refused((t) => { find(t, 'training').training.xp = 0; }, /shops\.master\.training\.training\.xp/);
  refused((t) => { find(t, 'training').training.cinders = 0; }, /shops\.master\.training\.training\.cinders/);
  refused((t) => { find(t, 'lesson').cinders = 0; }, /shops\.master\.lesson\.cinders/);
  refused((t) => { find(t, 'respec').respec.cost.base = 0; }, /shops\.master\.respec\.respec\.cost\.base/);
  refused((t) => { find(t, 'respec').respec.cost.perLevel = 1.5; }, /shops\.master\.respec\.respec\.cost\.perLevel/);
  refused((t) => { find(t, 'armaments').stock = -1; }, /shops\.master\.armaments\.stock/);
  refused((t) => { find(t, 'skillBooks').stock = 0.5; }, /shops\.master\.skillBooks\.stock/);
  refused((t) => { t.master.respecRefundPct = 60.5; }, /shops\.master\.respecRefundPct/);
  // A required number that is missing is refused by name, not only an invalid one (Copilot on #1438).
  refused((t) => { delete find(t, 'training').training.xp; }, /shops\.master\.training\.training\.xp is missing/);
  refused((t) => { delete find(t, 'lesson').cinders; }, /shops\.master\.lesson\.cinders is missing/);
  refused((t) => { delete t.master.respecRefundPct; }, /shops\.master\.respecRefundPct is missing/);
  // The blacksmith's and the market's validators had the same gap.
  refused((t) => { delete t.blacksmith.offerings.find((row) => row.id === 'refineStones').refine.value; }, /shops\.blacksmith\.refineStones\.refine\.value is missing/);
  refused((t) => { delete t.market.offerings.find((row) => row.id === 'smithStones').price; }, /shops\.market\.smithStones\.price is missing/);
  // The refund is clamped, not refused: 80 is accepted and read as 75.
  assert.deepEqual(errorsOf(bundleWithShops((t) => { t.master.respecRefundPct = 80; })).filter((m) => /respecRefundPct/.test(m)), []);
});

test('FINISH: the masters list is refused by name — 2 or 5 skills, an armour or class: track, an unknown or repeated track, a repeated id, an unknown speaker', () => {
  const base = shippedShops.masters[0];
  const refuses = (masters, pattern) => {
    const errors = errorsOf(bundleWithShops((t) => { t.masters = masters; }));
    assert.ok(errors.some((m) => /^shops\.masters/.test(m) && pattern.test(m)), `${JSON.stringify(masters)} → ${JSON.stringify(errors.slice(0, 3))}`);
  };
  refuses([{ ...base, skills: ['item:blade', 'item:shield'] }], /3 or 4/);
  refuses([{ ...base, skills: ['item:blade', 'item:shield', 'item:magic-focus', 'dualWield', 'item:blade'] }], /3 or 4/);
  refuses([{ ...base, skills: ['item:blade', 'item:shield', 'armour:heavy'] }], /armour:heavy/);
  refuses([{ ...base, skills: ['item:blade', 'item:shield', 'class:reaver'] }], /class:reaver/);
  refuses([{ ...base, skills: ['item:blade', 'item:shield', 'item:spear'] }], /item:spear/);
  refuses([{ ...base, skills: ['item:blade', 'item:blade', 'item:magic-focus'] }], /twice|distinct/);
  refuses([base, { ...base }], /twice|unique/);
  refuses([{ ...base, speakerId: 'nobodyAtAll' }], /nobodyAtAll/);
  // Each shipped master teaches 3 or 4 distinct weapon, focus or dual tracks.
  for (const master of shippedShops.masters) {
    assert.ok(master.skills.length >= 3 && master.skills.length <= 4, master.id);
    assert.equal(new Set(master.skills).size, master.skills.length, master.id);
  }
  // No Settings row is generated for the list.
  assert.equal(advancedConfigRows(contentBundle).some((row) => /\.masters\b/.test(row.key)), false);
});

// ---------------------------------------------------------------------------
// The stock
// ---------------------------------------------------------------------------

test('a master visit picks its master on `shop`, rolls its offerings and shelves on `shopOffers`, and its shelves are the master\'s', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const { run, rng } = masterRun(OUT, { seed });
    const stock = run.shopStock;
    assert.equal(stock.kind, 'master');
    assert.equal(rng.getCounters().shop, 1, `seed ${seed}: one draw on shop, the master pick`);
    const master = masterOf(OUT, run);
    assert.ok(master && shippedShops.masters.some((row) => row.id === stock.masterId));
    assert.deepEqual(shopStockProblems(stock, 'shopStock', { required: true }), []);
    assert.ok(stock.offerings.length >= shippedShops.master.guaranteedMinimum);
    assert.equal('smith' in stock, false, 'no smith add-on rides a master');
    assert.deepEqual(stock.training, { left: offeringOf(OUT, 'training').training.perVisit });
    assert.equal(stock.lessons, undefined, 'no lesson is rolled until one is asked for');
    const books = new Set(masterBookPool(OUT, master).map((def) => def.id));
    for (const item of stock.skillBooks || []) {
      assert.ok(books.has(item.id));
      assert.ok(master.skills.includes(OUT.consumables.get(item.id).skill));
    }
    const arts = new Set(masterArtPool(OUT, master));
    for (const item of stock.weaponArts || []) assert.ok(arts.has(item.id), `${item.id} is an art of the master's pieces`);
    const rack = new Set(masterArmamentPool(OUT, run, master).map((piece) => piece.id));
    for (const item of stock.armaments || []) {
      assert.ok(rack.has(item.id));
      assert.equal(carriedIds(run.loadout).includes(item.id), false);
    }
    for (const shelf of ['skillBooks', 'weaponArts', 'armaments']) {
      for (const item of stock[shelf] || []) assert.ok(Number.isSafeInteger(item.cost) && item.cost >= 1);
      assert.ok((stock[shelf] || []).length <= offeringOf(OUT, shelf).stock);
    }
  }
  // The master is the nth of shops.masters, n drawn on `shop` over the list in written order.
  const { run } = masterRun(OUT, { seed: 3 });
  const n = shippedShops.masters.length;
  assert.equal(run.shopStock.masterId, shippedShops.masters[createRng(3).int('shop', 0, n - 1)].id);
});

test('FINISH: a master teaching dualWield stocks one-handed armaments and their arts, never an art only a two-handed piece carries', () => {
  // A content edit makes the greatsword two-handed, so a blade art (its Sundering Hew) is carried only by a two-handed piece.
  const bundle = structuredClone({ equipment: contentBundle.equipment });
  const greatsword = bundle.equipment.armaments.find((piece) => piece.id === 'greatsword');
  greatsword.weaponCardPackage = { ...greatsword.weaponCardPackage, handsRequired: 2 };
  const twoHandedArt = greatsword.weaponCardPackage.weaponArtDefaults[0];
  const dual = { id: 'pairedMaster', name: 'The Paired Master', speakerId: shippedShops.masters[0].speakerId, skills: ['dualWield', 'item:shield', 'item:magic-focus'] };
  const registries = createRegistries({ ...contentBundle, equipment: bundle.equipment, shops: { ...structuredClone(shippedShops), masters: [dual] } });
  const pieces = masterPieces(registries, 'dualWield');
  assert.ok(pieces.length > 0);
  assert.equal(pieces.some((piece) => piece.id === 'greatsword'), false, 'the two-handed piece is not the dual-wield master\'s');
  assert.ok(pieces.some((piece) => piece.id === 'katana'), 'a one-handed blade is');
  const arts = masterArtPool(registries, dual);
  assert.equal(arts.includes(twoHandedArt), false, 'no art only a two-handed piece carries');
  assert.ok(arts.includes('katanaDrawCut'), 'the katana\'s art is stocked');
  const run = createRunState({ seed: 4, classId: 'reaver', registries });
  assert.equal(masterArmamentPool(registries, run, dual).some((piece) => piece.id === 'greatsword'), false);
  // An explicitly taught blade track keeps every piece of its type.
  assert.ok(masterPieces(registries, 'item:blade').some((piece) => piece.id === 'greatsword'));
  // The stocked shelves draw from those pools only.
  const settings = registriesWith(ALL_OUT).shops;
  const out = createRegistries({ ...contentBundle, equipment: bundle.equipment, shops: { ...settings, masters: [dual] } });
  for (let seed = 1; seed <= 15; seed++) {
    const r = createRunState({ seed, classId: 'reaver', registries: out });
    const stock = buildMasterStock(out, createRng(seed), r);
    assert.equal((stock.armaments || []).some((item) => item.id === 'greatsword'), false);
    assert.equal((stock.weaponArts || []).some((item) => item.id === twoHandedArt), false);
  }
});

test('services stay once rolled: a respec on a visit with no pool lays out a rolled redistribute shown unavailable, and the respec makes it usable on the same visit', () => {
  const { run } = masterRun(OUT, { seed: 7 });
  const master = masterOf(OUT, run);
  assert.ok(run.shopStock.offerings.includes('redistribute'), 'rolled at chance 100, so laid out');
  assert.equal(run.trainingPool, 0);
  assert.equal(masterServiceCandidates(OUT, run, 'redistribute').length, 0);
  track(run, master.skills[0], { level: 3, xp: 10 });
  withKitDom((dom) => {
    const app = dom.document.createElement('main');
    dom.document.body.replaceChildren(app);
    const screen = mountMaster(app, { registries: OUT, run, meta: { settings: {} }, onChanged() {}, onLeave() {} });
    assert.ok(app.querySelector('#shop-cat-redistribute'), 'the redistribute rail item is drawn');
    assert.ok(app.querySelector('#master-redistribute .bs-idle')?.textContent.includes(shopSentence('master.idle.redistribute')));
    commitRespec(OUT, run, respecPlan(OUT, run, master.skills[0]));
    screen.render();
    assert.equal(app.querySelector('#master-redistribute .bs-idle'), null, 'usable once the pool holds something');
  });
  assert.ok(masterServiceCandidates(OUT, run, 'redistribute').length > 0);
  // With every chance 0 the build-time refill adds only offerings usable now,
  // past the rolled ones (which stay, idle or not), until 2 are usable.
  const zero = registriesWith(Object.fromEntries(OFFERINGS.map((id) => [`${PREFIX}master.${id}.chance`, 0])));
  for (let seed = 1; seed <= 20; seed++) {
    const { run: r } = masterRun(zero, { seed });
    const rng = createRng(seed);
    rng.int('shop', 0, zero.shops.masters.length - 1);
    const rolled = rollShopOfferings(zero.shops.master, rng);
    const usableNow = (id) => !MASTER_SERVICES.includes(id) || masterServiceCandidates(zero, r, id).length > 0;
    assert.ok(r.shopStock.offerings.filter(usableNow).length >= 2, `seed ${seed}: ${r.shopStock.offerings}`);
    for (const id of rolled) assert.ok(r.shopStock.offerings.includes(id), `seed ${seed}: rolled ${id} stays`);
    for (const id of r.shopStock.offerings.filter((id) => !rolled.includes(id))) assert.ok(usableNow(id), `seed ${seed}: the refill added ${id}, which is usable`);
  }
});

test('a classic merchant that rolls master opens a master visit; the atlas service type exists and no shipped point carries it', () => {
  const run = createRunState({ seed: 5, classId: 'reaver', registries: REG });
  const forced = { ...REG, shops: { ...REG.shops, kindWeights: { market: 0, blacksmith: 0, master: 1 } } };
  const stock = buildMerchantStock(forced, createRng(5), run);
  assert.equal(stock.kind, 'master');
  const atlas = JSON.parse(readFileSync(new URL('../content/source/worldAtlas.json', import.meta.url), 'utf8'));
  assert.ok(atlas.service_handlers.some((row) => row.handlerId === 'master'));
  const type = atlas.service_types.find((row) => row.serviceTypeId === 'master');
  assert.equal(type?.handlerId, 'master');
  const service = atlas.services.find((row) => row.serviceTypeId === 'master');
  assert.ok(service, 'one services row names the type');
  assert.equal(atlas.node_services.some((row) => row.serviceId === service.serviceId), false, 'no shipped atlas point carries it');
  const priced = masterVisitStock(OUT, createRng(9), createRunState({ seed: 9, classId: 'reaver', registries: OUT }), { priceMult: 1.5 });
  const plain = buildMasterStock(OUT, createRng(9), createRunState({ seed: 9, classId: 'reaver', registries: OUT }));
  for (const shelf of ['skillBooks', 'weaponArts', 'armaments']) {
    assert.deepEqual(priced[shelf], plain[shelf]?.map((item) => ({ ...item, cost: Math.ceil(item.cost * 1.5) })), `${shelf} scales, rounding up`);
  }
});

test('declaring the unplaced master service moves no atlas revision, so no seed reroutes and no journey is stranded', () => {
  // The revision every World Journey was generated under before this step.
  assert.equal(createAtlasIndex().revision, 'atlas-1-3e9433d6-d1447e50');
  // Placing it on a point is a route change and does move the revision.
  const placed = structuredClone(worldAtlas);
  placed.node_services.push({ nodeId: 'crownfall/market', serviceId: 'master' });
  assert.notEqual(createAtlasIndex(placed).revision, createAtlasIndex().revision);
});

test('a saved journey standing in an atlas smith or master visit validates (the active service names its handler)', () => {
  const smith = generateJourney('SMITH');
  assert.equal(smith.currentNodeId, 'crownfall');
  smith.serviceStates['crownfall/forge'] = {};
  smith.activeService = { ownerId: 'crownfall', pointId: 'crownfall/forge', handlerId: 'smith' };
  assert.deepEqual(journeyProblems(smith), []);
  const data = structuredClone(worldAtlas);
  data.node_services.push({ nodeId: 'crownfall/market', serviceId: 'master' });
  const atlas = createAtlasIndex(data);
  const j = generateJourney('MASTER', 'wanderer', atlas);
  j.serviceStates['crownfall/market'] = {};
  j.activeService = { ownerId: j.currentNodeId, pointId: 'crownfall/market', handlerId: 'master' };
  assert.deepEqual(journeyProblems(j, atlas), []);
});

// ---------------------------------------------------------------------------
// Training
// ---------------------------------------------------------------------------

test('FINISH: training levels a master track through the one writer, takes one session, and refuses by name', () => {
  const { run } = masterRun(OUT);
  const master = masterOf(OUT, run);
  const row = offeringOf(OUT, 'training').training;
  const skillId = master.skills[0];
  const quote = trainingPlan(OUT, run, skillId);
  assert.equal(quote.ok, true, quote.reason);
  assert.deepEqual({ skillId: quote.skillId, cost: quote.cost, xp: quote.xp }, { skillId, cost: row.cinders, xp: row.xp });
  const cinders = run.cinders;
  commitTraining(OUT, run, quote);
  assert.equal(run.cinders, cinders - row.cinders);
  assert.equal(run.skills[skillId].xp, row.xp);
  assert.equal(run.shopStock.training.left, row.perVisit - 1);
  assert.throws(() => commitTraining(OUT, run, quote), (e) => e.message === shopSentence('shop.refuse.stale'), 'one quote commits once');
  const untaught = ['item:blade', 'item:shield', 'item:magic-focus', 'dualWield'].find((id) => !master.skills.includes(id)) || 'class:reaver';
  assert.equal(trainingPlan(OUT, run, untaught).ok, false);
  run.cinders = 0;
  assert.equal(trainingPlan(OUT, run, skillId).reason, shopSentence('shop.refuse.cinders'));
  run.cinders = 5000;
  run.shopStock.training.left = 0;
  const none = trainingPlan(OUT, run, skillId);
  assert.equal(none.ok, false);
  const before = JSON.stringify(run);
  assert.throws(() => commitTraining(OUT, run, none));
  assert.equal(JSON.stringify(run), before, 'a refusal changes nothing');
});

test('FINISH: training an unheld track across its upgrade threshold upgrades the owned cards of that track\'s schools', () => {
  const focusMaster = shippedShops.masters.find((m) => m.skills.includes('item:magic-focus'));
  assert.ok(focusMaster, 'a shipped master teaches the focus track');
  const registries = createRegistries({ ...contentBundle, shops: { ...registriesWith(ALL_OUT).shops, masters: [focusMaster] } });
  const { run } = masterRun(registries);
  assert.equal(skillSchools(registries, run.loadout, 'item:magic-focus').length, 0, 'the reaver holds no focus');
  const schools = masterSchools(registries, 'item:magic-focus');
  assert.ok(schools.includes('ritual'));
  run.deck.push({ instanceId: 'test:ember', cardId: 'emberVigil', upgraded: false });
  run.sideboard.push({ instanceId: 'test:mote', cardId: 'ashenMote', upgraded: false });
  const xp = offeringOf(registries, 'training').training.xp;
  const upgradeAt = registries.balance.skill.upgradeAt;
  track(run, 'item:magic-focus', { level: upgradeAt - 1, xp: xpToNext(registries, 'focus', upgradeAt - 1) - xp });
  commitTraining(registries, run, trainingPlan(registries, run, 'item:magic-focus'));
  assert.equal(run.skills['item:magic-focus'].level, upgradeAt);
  assert.equal(run.deck.find((c) => c.instanceId === 'test:ember').upgraded, true, 'the deck card is upgraded');
  assert.equal(run.sideboard.find((c) => c.instanceId === 'test:mote').upgraded, true, 'and the sideboard one');
  // awardSkillXp without the input still reads the held pieces, as before.
  const other = createRunState({ seed: 21, classId: 'reaver', registries });
  other.deck.push({ instanceId: 'test:ember', cardId: 'emberVigil', upgraded: false });
  track(other, 'item:magic-focus', { level: upgradeAt - 1, xp: 0 });
  awardSkillXp(registries, other, 'item:magic-focus', xpToNext(registries, 'focus', upgradeAt - 1));
  assert.equal(other.deck.find((c) => c.instanceId === 'test:ember').upgraded, false);
});

// ---------------------------------------------------------------------------
// Respec and redistribute
// ---------------------------------------------------------------------------

test('FINISH: a level-4 track respecs to level 1 with xp 0, and the pool gains floor(respecRefundPct% of spent) — 60% of 500 adds 300', () => {
  // A flat curve (every step 100 XP) makes a level-4 track with 200 row XP one that spent 500 above level 1.
  const balance = structuredClone(contentBundle.balance);
  balance.skill.xp.multScaler = 0;
  balance.skill.xp.growth = 1;
  const registries = createRegistries({ ...contentBundle, balance, shops: registriesWith(ALL_OUT).shops });
  assert.equal(respecRefundPct(registries), 60);
  const { run } = masterRun(registries);
  const skillId = masterOf(registries, run).skills[0];
  track(run, skillId, { level: 4, xp: 200, pendingDrafts: 2 });
  const quote = respecPlan(registries, run, skillId);
  assert.equal(quote.ok, true, quote.reason);
  const cost = offeringOf(registries, 'respec').respec.cost;
  assert.deepEqual({ level: quote.level, cost: quote.cost, refund: quote.refund }, { level: 4, cost: cost.base + cost.perLevel * 4, refund: 300 });
  const cinders = run.cinders;
  commitRespec(registries, run, quote);
  assert.deepEqual(run.skills[skillId], { xp: 0, level: 1, pendingDrafts: 0 }, 'level 1, xp 0, drafts down by the 3 levels lost, floored at 0');
  assert.equal(run.trainingPool, 300);
  assert.equal(run.cinders, cinders - quote.cost);
  assert.throws(() => commitRespec(registries, run, quote), 'one quote commits once');
  // With the shipped curve the refund is the same formula over xpToNext.
  const { run: r } = masterRun(OUT);
  const id = masterOf(OUT, r).skills[1];
  track(r, id, { level: 4, xp: 37 });
  const spent = [1, 2, 3].reduce((sum, l) => sum + xpToNext(OUT, 'weapon', l), 0) + 37;
  assert.equal(respecPlan(OUT, r, id).refund, Math.floor((60 * spent) / 100));
});

test('FINISH: a level-1 track is refused by name; a respec refuses a stale quote and changes nothing', () => {
  const { run } = masterRun(OUT);
  const skillId = masterOf(OUT, run).skills[0];
  track(run, skillId, { level: 1, xp: 50 });
  const low = respecPlan(OUT, run, skillId);
  assert.equal(low.ok, false);
  assert.match(low.reason, /level 2/i);
  track(run, skillId, { level: 3, xp: 0, pendingDrafts: 1 });
  const quote = respecPlan(OUT, run, skillId);
  awardSkillXp(OUT, run, skillId, xpToNext(OUT, 'weapon', 3));
  const before = JSON.stringify(run);
  assert.throws(() => commitRespec(OUT, run, quote), (e) => e.message === shopSentence('shop.refuse.stale'));
  assert.equal(JSON.stringify(run), before);
  run.cinders = 0;
  assert.equal(respecPlan(OUT, run, skillId).reason, shopSentence('shop.refuse.cinders'));
  const untaught = 'class:reaver';
  track(run, untaught, { level: 3 });
  assert.equal(respecPlan(OUT, run, untaught).ok, false, 'only a track the visiting master teaches');
});

test('FINISH: respecRefundPct 80 clamps to 75, and 40 to 50', () => {
  const at = (pct) => createRegistries({ ...contentBundle, shops: { ...structuredClone(shippedShops), master: { ...structuredClone(shippedShops.master), respecRefundPct: pct } } });
  assert.equal(respecRefundPct(at(80)), 75);
  assert.equal(respecRefundPct(at(40)), 50);
  assert.equal(respecRefundPct(at(66)), 66);
});

test('FINISH: redistribute spends the pool on any track through the one writer, from 1 to the pool, free', () => {
  const { run } = masterRun(OUT);
  run.trainingPool = 250;
  const cinders = run.cinders;
  const quote = redistributePlan(OUT, run, 'class:reaver', 240);
  assert.equal(quote.ok, true, quote.reason);
  commitRedistribute(OUT, run, quote);
  assert.equal(run.trainingPool, 10);
  assert.equal(run.cinders, cinders, 'it is free');
  assert.equal(run.skills['class:reaver'].level, 1, 'levelled through awardSkillXp');
  assert.equal(run.skills['class:reaver'].xp, 240 - xpToNext(OUT, 'class', 0));
  for (const amount of [0, 11, 1.5, -1]) assert.equal(redistributePlan(OUT, run, 'item:blade', amount).ok, false, `amount ${amount}`);
  assert.equal(redistributePlan(OUT, run, 'item:spear', 5).ok, false, 'an unknown track');
  assert.throws(() => commitRedistribute(OUT, run, quote), 'stale');
});

// ---------------------------------------------------------------------------
// The lesson
// ---------------------------------------------------------------------------

test('FINISH: a lesson rolls through rollSkillDraftIds from the master\'s schools on shopOffers, and adds one card', () => {
  const { run, rng } = masterRun(OUT, { seed: 12 });
  const master = masterOf(OUT, run);
  const skillId = master.skills[0];
  const before = rng.getCounters();
  const roll = rollMasterLesson(OUT, rng, run, skillId);
  const after = rng.getCounters();
  assert.equal(after.cardRewards, before.cardRewards, 'the reward door\'s stream does not move');
  assert.ok(after.shopOffers > before.shopOffers, 'drawn on shopOffers');
  assert.deepEqual(run.shopStock.lessons[skillId], { cardIds: roll.cardIds, taken: false });
  assert.ok(roll.cardIds.length > 0 && roll.cardIds.length <= OUT.balance.skill.draftSize);
  assert.equal(new Set(roll.cardIds).size, roll.cardIds.length, 'distinct');
  const schools = new Set(masterSchools(OUT, skillId));
  const pool = new Set(OUT.classes.get(run.class).cardPool);
  for (const id of roll.cardIds) {
    assert.ok(pool.has(id));
    assert.ok((OUT.cards.get(id).tags || []).some((tag) => schools.has(tag)), `${id} is of the master's schools`);
  }
  // It is the same draw rollSkillDraftIds makes with the master's inputs.
  const twin = createRng(12, before);
  assert.deepEqual(rollSkillDraftIds(OUT, twin, { classId: run.class, loadout: run.loadout, skillId, level: 1, schools: [...schools], stream: 'shopOffers' }), roll.cardIds);
  // Asked again, it never rolls the track again.
  const again = rollMasterLesson(OUT, rng, run, skillId);
  assert.deepEqual(again.cardIds, roll.cardIds);
  assert.deepEqual(rng.getCounters(), after);
  // The quote and the commit.
  const cardId = roll.cardIds[0];
  const quote = lessonPlan(OUT, run, skillId, cardId);
  assert.equal(quote.ok, true, quote.reason);
  assert.equal(quote.cost, offeringOf(OUT, 'lesson').cinders);
  const deck = run.deck.length;
  const cinders = run.cinders;
  const drafts = run.skills?.[skillId]?.pendingDrafts ?? 0;
  commitLesson(OUT, run, quote);
  assert.equal(run.deck.length, deck + 1);
  const card = run.deck.at(-1);
  assert.equal(card.cardId, cardId);
  assert.match(card.instanceId, /^r/);
  assert.equal(card.upgraded, false);
  assert.equal(run.cinders, cinders - quote.cost);
  assert.equal(run.shopStock.lessons[skillId].taken, true);
  assert.equal(run.skills?.[skillId]?.pendingDrafts ?? 0, drafts, 'it spends no queued draft');
  assert.equal(lessonPlan(OUT, run, skillId, roll.cardIds[1] || cardId).ok, false, 'one lesson per track per visit');
});

test('FINISH: a level-0 track still draws commons; a roll-less, unrolled card or empty roll is refused before payment', () => {
  const { run, rng } = masterRun(OUT, { seed: 30 });
  const skillId = masterOf(OUT, run).skills[1];
  assert.equal(run.skills?.[skillId]?.level ?? 0, 0);
  assert.equal(lessonPlan(OUT, run, skillId, 'strike').ok, false, 'no roll yet');
  const { cardIds } = rollMasterLesson(OUT, rng, run, skillId);
  assert.ok(cardIds.length > 0);
  for (const id of cardIds) assert.equal(OUT.cards.get(id).rarity, 'common');
  assert.equal(lessonPlan(OUT, run, skillId, 'notRolledCard').ok, false);
  run.cinders = 0;
  assert.equal(lessonPlan(OUT, run, skillId, cardIds[0]).reason, shopSentence('shop.refuse.cinders'));
  // An empty roll: no rarity opens at level 1, so the roll draws nothing and is refused, naming the track.
  const balance = structuredClone(contentBundle.balance);
  balance.skill.rarityUnlock = { common: 99, uncommon: 99, rare: 99 };
  const closed = createRegistries({ ...contentBundle, balance, shops: registriesWith(ALL_OUT).shops });
  const made = masterRun(closed, { seed: 30 });
  const id = masterOf(closed, made.run).skills[0];
  assert.deepEqual(rollMasterLesson(closed, made.rng, made.run, id).cardIds, []);
  const before = JSON.stringify(made.run);
  const quote = lessonPlan(closed, made.run, id, 'strike');
  assert.equal(quote.ok, false);
  assert.ok(quote.reason.includes(closed.nodes.find((n) => n.id === id)?.label || id), quote.reason);
  assert.throws(() => commitLesson(closed, made.run, quote));
  assert.equal(JSON.stringify(made.run), before, 'nothing paid');
});

test('Copilot on #1438: the lesson check and appraisal use the roll\'s own odds — a rarity at weight 0 is out, Chaos Rewards puts it back', () => {
  const balance = structuredClone(contentBundle.balance);
  balance.rewards.rarityWeights.normal = { ...balance.rewards.rarityWeights.normal, common: 0 };
  const registries = createRegistries({ ...contentBundle, balance, shops: registriesWith(ALL_OUT).shops });
  const { run, rng } = masterRun(registries, { seed: 30 });
  const skillId = masterOf(registries, run).skills[0];
  assert.equal(run.skills?.[skillId]?.level ?? 0, 0, 'a level-0 track opens commons only');
  assert.deepEqual(lessonPool(registries, run, skillId), [], 'commons at weight 0: nothing to draw');
  assert.equal(masterServiceCandidates(registries, run, 'lesson').includes(skillId), false, 'so the lesson is not usable for it');
  assert.deepEqual(masterAppraisal(registries, run).find((row) => row.skillId === skillId).cardIds, []);
  assert.deepEqual(rollMasterLesson(registries, createRng(30, rng.getCounters()), structuredClone(run), skillId).cardIds, [], 'and the roll agrees');
  // Chaos Rewards gives every rarity equal odds, as the roll does.
  assert.ok(lessonPool(registries, run, skillId, { flatRarity: true }).length > 0);
  assert.ok(masterServiceCandidates(registries, run, 'lesson', { flatRarity: true }).includes(skillId));
  assert.ok(rollMasterLesson(registries, rng, run, skillId, { flatRarity: true }).cardIds.length > 0);
});

test('Codex and Copilot on #1438: a custom price multiplier scales the master\'s weapon arts once, through the atlas and the merchant alike', () => {
  const plainRun = () => createRunState({ seed: 9, classId: 'reaver', registries: OUT });
  const plain = buildMasterStock(OUT, createRng(9), plainRun());
  assert.ok((plain.weaponArts || []).length > 0, 'the visit stocks arts to price');
  const up = (list) => list?.map((item) => ({ ...item, cost: Math.ceil(item.cost * 1.5) }));
  const atlas = masterVisitStock(OUT, createRng(9), plainRun(), { priceMult: 1.5 });
  assert.deepEqual(atlas.weaponArts, up(plain.weaponArts), 'atlas: scaled once, rounding up');
  const forced = createRegistries({ ...contentBundle, shops: { ...OUT.shops, kindWeights: { market: 0, blacksmith: 0, master: 1 } } });
  const merchantPlain = marketVisitStock(forced, createRng(9), createRunState({ seed: 9, classId: 'reaver', registries: forced }), { meta: {}, door: 'merchant' });
  const merchant = marketVisitStock(forced, createRng(9), createRunState({ seed: 9, classId: 'reaver', registries: forced }), { meta: {}, door: 'merchant', priceMult: 1.5 });
  assert.equal(merchant.kind, 'master');
  assert.ok((merchantPlain.weaponArts || []).length > 0);
  for (const shelf of ['skillBooks', 'weaponArts', 'armaments']) assert.deepEqual(merchant[shelf], up(merchantPlain[shelf]), `merchant: ${shelf} scaled once`);
  // The market's own art shelf takes the same multiplier now; under the
  // defaults it is byte-identical (tests/master-shop-identity.test.mjs).
  const market = (mult) => marketVisitStock(REG, createRng(4), createRunState({ seed: 4, classId: 'reaver', registries: REG }), { meta: {}, door: 'atlas', priceMult: mult });
  const base = market(1);
  assert.ok(base.weaponArts.length > 0);
  assert.deepEqual(market(1.5).weaponArts, up(base.weaponArts));
});

test('review of #1438: training, respec and lesson quotes scale by a custom price multiplier, rounding up, and a quote made at another multiplier is refused as stale', () => {
  const mult = 1.5;
  const { run, rng } = masterRun(OUT, { seed: 12 });
  const [first, second] = masterOf(OUT, run).skills;
  const training = offeringOf(OUT, 'training').training;
  const cost = offeringOf(OUT, 'respec').respec.cost;
  const lesson = offeringOf(OUT, 'lesson').cinders;
  // Training.
  const train = trainingPlan(OUT, run, first, { priceMult: mult });
  assert.equal(train.cost, Math.ceil(training.cinders * mult));
  let before = JSON.stringify(run);
  assert.throws(() => commitTraining(OUT, run, train), (e) => e.message === shopSentence('shop.refuse.stale'), 'a 1.5× quote at 1× is stale');
  assert.equal(JSON.stringify(run), before);
  let cinders = run.cinders;
  commitTraining(OUT, run, train, { priceMult: mult });
  assert.equal(run.cinders, cinders - train.cost);
  // Respec.
  track(run, second, { level: 3, xp: 0 });
  const respec = respecPlan(OUT, run, second, { priceMult: mult });
  assert.equal(respec.cost, Math.ceil((cost.base + cost.perLevel * 3) * mult));
  before = JSON.stringify(run);
  assert.throws(() => commitRespec(OUT, run, respec, { priceMult: 2 }), (e) => e.message === shopSentence('shop.refuse.stale'), 'a 1.5× quote at 2× is stale');
  assert.equal(JSON.stringify(run), before);
  cinders = run.cinders;
  commitRespec(OUT, run, respec, { priceMult: mult });
  assert.equal(run.cinders, cinders - respec.cost);
  // Lesson.
  const { cardIds } = rollMasterLesson(OUT, rng, run, first);
  const quote = lessonPlan(OUT, run, first, cardIds[0], { priceMult: mult });
  assert.equal(quote.cost, Math.ceil(lesson * mult));
  before = JSON.stringify(run);
  assert.throws(() => commitLesson(OUT, run, quote), (e) => e.message === shopSentence('shop.refuse.stale'));
  assert.equal(JSON.stringify(run), before);
  cinders = run.cinders;
  commitLesson(OUT, run, quote, { priceMult: mult });
  assert.equal(run.cinders, cinders - quote.cost);
});

test('review of #1438: with an empty training pool the redistribute shelf draws no Spend control, only its idle reason, once', () => {
  withKitDom((dom) => {
    const { run } = masterRun(OUT, { seed: 7 });
    assert.equal(run.trainingPool, 0);
    const app = dom.document.createElement('main');
    dom.document.body.replaceChildren(app);
    mountMaster(app, { registries: OUT, run, meta: { settings: {} }, onChanged() {}, onLeave() {} });
    const shelf = app.querySelector('#master-redistribute');
    assert.equal(shelf.querySelectorAll('button').filter((b) => String(b.id).startsWith('master-spend-')).length, 0, 'no Spend 0 XP button');
    assert.equal(shelf.querySelectorAll('.bs-idle').length, 1, 'the idle reason, once');
    assert.equal(shelf.children.length, 1, 'and nothing else');
  });
});

test('rollSkillDraftIds without schools or stream draws exactly as the reward door always has', () => {
  const run = createRunState({ seed: 3, classId: 'reaver', registries: REG });
  const args = { classId: 'reaver', loadout: run.loadout, skillId: 'item:blade', level: 4 };
  const a = createRng(77);
  const b = createRng(77);
  assert.deepEqual(rollSkillDraftIds(REG, a, args), rollSkillDraftIds(REG, b, { ...args, stream: 'cardRewards', schools: skillSchools(REG, run.loadout, 'item:blade') }));
  assert.deepEqual(a.getCounters(), b.getCounters());
  assert.equal(a.getCounters().shopOffers, 0);
});

// ---------------------------------------------------------------------------
// Appraisal
// ---------------------------------------------------------------------------

test('FINISH: appraisal is a read — level, XP, the cards a lesson could draw, the respec quote — and changes nothing', () => {
  const { run } = masterRun(OUT, { seed: 8 });
  const master = masterOf(OUT, run);
  track(run, master.skills[0], { level: 2, xp: 15 });
  const before = JSON.stringify(run);
  const rows = masterAppraisal(OUT, run);
  assert.equal(JSON.stringify(run), before, 'appraisal writes nothing');
  assert.deepEqual(rows.map((row) => row.skillId), master.skills);
  const first = rows[0];
  assert.equal(first.level, 2);
  assert.equal(first.xp, 15);
  assert.equal(first.toNext, xpToNext(OUT, 'weapon', 2));
  assert.deepEqual(first.cardIds, lessonPool(OUT, run, master.skills[0]));
  assert.ok(first.respec.ok, first.respec.reason);
  assert.equal(rows[1].respec.ok, false, 'a level-0 track shows the refusal');
  const unlocked = rarityUnlockedAt(OUT, 1);
  for (const id of rows[1].cardIds) assert.ok(unlocked.includes(OUT.cards.get(id).rarity));
});

// ---------------------------------------------------------------------------
// The screen
// ---------------------------------------------------------------------------

test('the master screen lays out one rail item per offering, then Sell under shopSell, and trains through its action', () => {
  withKitDom((dom) => {
    const { run } = masterRun(OUT);
    run.consumables = { bladeManual: 1 };
    const app = dom.document.createElement('main');
    dom.document.body.replaceChildren(app);
    let changed = 0;
    mountMaster(app, { registries: OUT, run, meta: { settings: {} }, onChanged: () => { changed++; }, onLeave: () => {} });
    const keys = [...app.querySelectorAll('.shop-rail [data-shop-category]')].map((el) => el.dataset.shopCategory);
    assert.deepEqual(keys, [...run.shopStock.offerings, 'sell'], 'one rail item per laid-out offering, in order, then Sell');
    app.querySelector('#shop-cat-training').click();
    const skillId = masterOf(OUT, run).skills[0];
    const action = app.querySelector(`#master-train-${skillId.replace(/[^a-z0-9]/gi, '-')}`);
    assert.ok(action, 'the training action is drawn');
    action.click();
    assert.equal(run.skills[skillId].xp, offeringOf(OUT, 'training').training.xp);
    assert.equal(changed, 1);
    // The Sell consumables pane is the market's plan: the price never above what one costs now.
    app.querySelector('#shop-cat-sell').click();
    const sell = app.querySelector('#master-sell-bladeManual');
    assert.ok(sell, 'the consumable sale is drawn');
    const plan = consumableSalePlan(OUT, run, 'bladeManual');
    const cinders = run.cinders;
    sell.click();
    assert.equal(run.cinders, cinders + plan.price);
    assert.equal(run.consumables.bladeManual, undefined);
  });
  withKitDom((dom) => {
    const { run } = masterRun(OUT);
    const app = dom.document.createElement('main');
    dom.document.body.replaceChildren(app);
    mountMaster(app, { registries: OUT, run, meta: { settings: { shopSell: false } }, onChanged() {}, onLeave() {} });
    assert.equal(app.querySelector('#shop-cat-sell'), null, 'absent with shopSell off');
  });
});

test('the master screen refuses a displayed training quote after another trade', () => {
  withKitDom((dom) => {
    const { run } = masterRun(OUT);
    const app = dom.document.createElement('main');
    dom.document.body.replaceChildren(app);
    let changed = 0;
    mountMaster(app, { registries: OUT, run, meta: { settings: {} }, onChanged: () => { changed++; }, onLeave: () => {} });
    app.querySelector('#shop-cat-training').click();
    const skillId = masterOf(OUT, run).skills[0];
    const action = app.querySelector(`#master-train-${skillId.replace(/[^a-z0-9]/gi, '-')}`);
    commitTraining(OUT, run, trainingPlan(OUT, run, masterOf(OUT, run).skills[1]));
    const before = JSON.stringify(run);
    action.click();
    assert.equal(JSON.stringify(run), before, 'the stale quote spends nothing');
    assert.equal(changed, 0);
    assert.ok(app.querySelector('.bs-refusal').textContent.includes(shopSentence('shop.refuse.stale')));
  });
});

// ---------------------------------------------------------------------------
// Schema 18 and the load door
// ---------------------------------------------------------------------------

test('schema 18: the bump, run.trainingPool, the appended corpus entry, and a schema-17 save loads with a pool of 0', () => {
  // §15.4 (legendary sigils) bumped once more; this entry and its migration stay.
  assert.ok(RUN_SCHEMA_VERSION >= 18);
  const corpus = JSON.parse(readFileSync(new URL('./fixtures/run-save-schema-versions.json', import.meta.url), 'utf8'));
  const v18 = JSON.parse(corpus.versions['18'].bytes);
  assert.equal(v18.schemaVersion, 18);
  assert.equal(v18.trainingPool, 0);
  assert.deepEqual(validateRunShape(v18, { preAttunedSigils: true }), [], 'a schema-18 save, before attunedSigils (SPEC §15.4)');
  const v17 = JSON.parse(corpus.versions['17'].bytes);
  assert.equal(v17.schemaVersion, 17, 'the schema-17 entry is untouched');
  assert.equal('trainingPool' in v17, false);
  const storage = createMemoryStorage();
  storage.setItem(RUN_KEY, JSON.stringify(v17));
  const run = createSaveManager(storage).loadRun(REG);
  assert.ok(run);
  assert.equal(run.schemaVersion, RUN_SCHEMA_VERSION);
  assert.equal(run.trainingPool, 0);
  const fresh = createRunState({ seed: 1, classId: 'reaver', registries: REG });
  assert.equal(fresh.trainingPool, 0);
  for (const bad of [-1, 1.5, '3']) assert.ok(validateRunShape({ ...fresh, trainingPool: bad }).some((p) => /trainingPool/.test(p)), `${bad} refused`);
  const { trainingPool, ...missing } = fresh;
  assert.ok(validateRunShape(missing).some((p) => /trainingPool/.test(p)), 'required at 18');
});

test('stock, lessons and prices survive a reload', () => {
  const { run, rng } = masterRun(OUT, { seed: 14 });
  rollMasterLesson(OUT, rng, run, masterOf(OUT, run).skills[0]);
  const before = structuredClone(run.shopStock);
  const back = reload(run, rng);
  assert.deepEqual(back.shopStock, before);
  assert.equal(back.trainingPool, 0);
});

test('a malformed master stock is refused by name; the load door prunes unknown unsold offers and lesson cards', () => {
  const { run, rng } = masterRun(OUT, { seed: 16 });
  const master = masterOf(OUT, run);
  const untaught = 'class:reaver';
  const cases = [
    [{ masterId: 'noSuchMaster' }, /shopStock\.masterId/],
    [{ skillBooks: [{ id: 'bladeManual', cost: 0 }] }, /shopStock\.skillBooks\[0\]/],
    [{ weaponArts: {} }, /shopStock\.weaponArts/],
    [{ armaments: [{ id: 'dagger' }] }, /shopStock\.armaments\[0\]/],
    [{ training: { left: -1 } }, /shopStock\.training/],
    [{ training: 3 }, /shopStock\.training/],
    [{ lessons: { [untaught]: { cardIds: [], taken: false } } }, /shopStock\.lessons/],
    [{ lessons: { [master.skills[0]]: { cardIds: 'strike', taken: false } } }, /shopStock\.lessons/],
    [{ lessons: { [master.skills[0]]: { cardIds: ['strike', 'strike'], taken: false } } }, /shopStock\.lessons/],
  ];
  for (const [patch, pattern] of cases) {
    const bad = { ...run, shopStock: { ...run.shopStock, ...patch } };
    assert.ok(validateRunShape(bad).some((p) => pattern.test(p)), `${JSON.stringify(patch)} refused`);
  }
  const { cardIds } = rollMasterLesson(OUT, rng, run, master.skills[0]);
  run.shopStock.lessons[master.skills[0]].cardIds = [...cardIds, 'retiredCard'];
  run.shopStock.offerings = [...new Set([...run.shopStock.offerings, 'skillBooks', 'weaponArts', 'armaments'])];
  run.shopStock.skillBooks = [...(run.shopStock.skillBooks || []), { id: 'retiredBook', cost: 50 }];
  run.shopStock.weaponArts = [...(run.shopStock.weaponArts || []), { id: 'retiredArt', cost: 50 }];
  run.shopStock.armaments = [...(run.shopStock.armaments || []), { id: 'retiredBlade', cost: 50 }];
  const back = reload(run, rng);
  assert.deepEqual(back.shopStock.lessons[master.skills[0]].cardIds, cardIds, 'the unknown card id is dropped');
  for (const [shelf, id] of [['skillBooks', 'retiredBook'], ['weaponArts', 'retiredArt'], ['armaments', 'retiredBlade']]) {
    assert.equal((back.shopStock[shelf] || []).some((item) => item.id === id), false, `${shelf}: pruned, not rerolled`);
  }
  assert.equal(back.shopStock.kind, 'master');
});
