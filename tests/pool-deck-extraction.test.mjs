// Sealed and Draft runs cannot extract (owner ruling, 2026-10-02).
//
// A pool-built deck is never dealt the equipment's lent cards (kit basics,
// weapon arts, Dodge Roll — model/cardRemoval.js isPoolDeckRun). Extraction
// moves a lent card out of an item's mount into the run's own deck, so in
// those modes it would hand the run a free copy of exactly what they exclude.
// The rule, held at every door (model/cardExtraction.js extractionRefusal):
//   · the plan offers no candidate and names the refusal (`poolDeck`);
//   · commitExtraction refuses, free grants included, and touches nothing;
//   · the blacksmith quotes the refusal, its idle line says why, and the
//     Shrine/merchant smith card is shown unavailable with the same sentence;
//   · the answer is read from the run's own Custom Climb rules every time,
//     so no save can carry extraction into a pool run;
//   · installing a card the run owns is untouched.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { shops as shippedShops } from '../src/content/shops.js';
import { createRegistries } from '../src/model/registries.js';
import { configuredContentBundle } from '../src/model/advancedConfig.js';
import { createRunState, createIdGen, createDeck } from '../src/model/state.js';
import { createRng, seedToString } from '../src/engine/rng.js';
import { createSaveManager, createMemoryStorage, RUN_KEY } from '../src/engine/save.js';
import { buildBlacksmithStock } from '../src/engine/shopKinds.js';
import { dealtAttackSlotCount, POOL_DECK_RULE } from '../src/model/cardRemoval.js';
import { stampDeck } from '../src/model/loadout.js';
import { extractionPlan, extractionRefusal, commitExtraction, installPlan, commitInstall } from '../src/model/cardExtraction.js';
import { shopSentence } from '../src/model/shopKinds.js';
import {
  blacksmithExtractPlan, commitBlacksmithExtract, blacksmithInstallPlan,
  serviceCandidates, serviceIdleReason,
} from '../src/model/blacksmith.js';
import { mountServiceOffer } from '../src/ui/screens/smithServices.js';

const PREFIX = 'gameConfig.shops.';
const ALL_OUT = Object.fromEntries(shippedShops.blacksmith.offerings.map((row) => [`${PREFIX}blacksmith.${row.id}.chance`, 100]));
const REG = createRegistries(configuredContentBundle(contentBundle, ALL_OUT));
const KATANA = 'armament/katana';
const SEED = 21;
const BASE = ['strike', 'strike', 'strike', 'strike', 'defend', 'defend', 'defend'];
const REFUSAL = shopSentence('blacksmith.refuse.extract.poolDeck');

// A run at a blacksmith with every service laid out and a katana in the pack.
// `deckMode` sealed/draft deals the deck the way main.js newRun does (the
// dealt quota, the marker, the stamp that deals no lent card).
function smithRun(deckMode = 'standard') {
  const run = createRunState({ seed: SEED, classId: 'reaver', registries: REG });
  run.seedString = seedToString(SEED);
  run.customization = { name: 'Forsaken', glyph: '⚔', tint: 'gold' };
  run.custom = { ascension: 0, mods: {}, deckMode };
  run.stats = { fightsWon: 0, damageDealt: 0, damageTaken: 0 };
  run.path = [];
  run.seenEvents = [];
  run.lastEncounters = [];
  run.cinders = 5000;
  run.smithingStones = 50;
  if (deckMode !== 'standard') {
    run.deck = createDeck(BASE, createIdGen('rc'));
    run.equipmentAttackSlotCount = dealtAttackSlotCount(run.deck);
    run.poolDeckRule = POOL_DECK_RULE;
  }
  run.loadout.storage.push('katana');
  stampDeck(REG, run, undefined, deckMode === 'standard' ? undefined : { adoptEquipmentBonuses: false, reconcileEquipmentPools: false });
  const rng = createRng(SEED);
  run.shopStock = buildBlacksmithStock(REG, rng, run);
  return { run, rng };
}

const katanaArt = (run) => extractionPlan(REG, run).candidates.find((c) => c.itemRef === KATANA)?.mounts.find((m) => m.cardId === 'katanaDrawCut');
// The mount key the katana's art sits in, read from a Standard twin (a pool plan lists none).
const ART_MOUNT = katanaArt(smithRun().run).mountKey;

test('a Standard run still extracts: the fixture reaches the katana\'s art', () => {
  const { run } = smithRun();
  assert.equal(extractionRefusal(run), null);
  assert.equal(extractionPlan(REG, run).refusal, null);
  assert.ok(katanaArt(run), 'the katana\'s Draw Cut is extractable in a Standard run');
  assert.ok(run.shopStock.offerings.includes('extractArt'), 'the fixture lays the service out');
  const quote = blacksmithExtractPlan(REG, run, KATANA, ART_MOUNT);
  assert.equal(quote.ok, true, quote.reason);
  const receipt = commitBlacksmithExtract(REG, run, quote);
  assert.ok(run.deck.some((c) => c.instanceId === receipt.instanceId));
});

for (const deckMode of ['sealed', 'draft']) {
  test(`${deckMode}: extraction is never offered and every door refuses it by name`, () => {
    const { run } = smithRun(deckMode);
    assert.equal(extractionRefusal(run), 'poolDeck');
    const plan = extractionPlan(REG, run);
    assert.equal(plan.refusal, 'poolDeck');
    assert.deepEqual(plan.candidates, [], 'no item lists an extractable mount');

    // The blacksmith: the rolled service stays laid out, shown unavailable with the reason.
    assert.ok(run.shopStock.offerings.includes('extractArt'));
    assert.deepEqual(serviceCandidates(REG, run, 'extractArt'), []);
    assert.equal(serviceIdleReason('extractArt', run), REFUSAL);
    assert.notEqual(serviceIdleReason('extractArt'), REFUSAL, 'without the run the generic idle line is unchanged');
    const quote = blacksmithExtractPlan(REG, run, KATANA, ART_MOUNT);
    assert.equal(quote.ok, false);
    assert.equal(quote.reason, REFUSAL);

    // The Shrine's and the merchant's smith card.
    const offer = mountServiceOffer(REG, run, 'extract');
    assert.equal(offer.available, false);
    assert.equal(offer.refusal, 'poolDeck');
    assert.equal(offer.summary, REFUSAL);

    // The commits: paid, free (an event's grant) and through a forged blacksmith quote.
    const bytes = JSON.stringify(run);
    assert.throws(() => commitExtraction(REG, run, KATANA, ART_MOUNT), /Sealed or Draft run cannot extract/);
    assert.throws(() => commitExtraction(REG, run, KATANA, ART_MOUNT, undefined, { free: true }), /Sealed or Draft run cannot extract/);
    assert.throws(() => commitBlacksmithExtract(REG, run, { ...quote, ok: true, reason: '' }), new RegExp(REFUSAL));
    assert.equal(JSON.stringify(run), bytes, 'a refused extraction changes nothing');
  });

  test(`${deckMode}: installing a card the run owns is unaffected`, () => {
    const { run } = smithRun(deckMode);
    // An emptied mount (a save from before this rule) and a loose copy of the art.
    run.itemMounts = { [KATANA]: { [ART_MOUNT]: { card: null, extractions: 1 } } };
    run.deck.push({ instanceId: 'bought:1', cardId: 'katanaDrawCut', upgraded: false });
    const mount = installPlan(REG, run).candidates.find((c) => c.itemRef === KATANA)?.mounts.find((m) => m.mountKey === ART_MOUNT);
    assert.ok(mount, 'the emptied mount is open to seat');
    assert.equal(blacksmithInstallPlan(REG, run, KATANA, ART_MOUNT, 'bought:1').ok, true);
    assert.equal(mountServiceOffer(REG, run, 'install').available, true);
    commitInstall(REG, run, KATANA, ART_MOUNT, 'bought:1');
    assert.equal(run.itemMounts[KATANA][ART_MOUNT].card, 'katanaDrawCut');
  });
}

test('a fight\'s synthetic run carrying the poolDeck flag is refused too', () => {
  const { run } = smithRun();
  run.poolDeck = true;
  assert.equal(extractionRefusal(run), 'poolDeck');
  assert.throws(() => commitExtraction(REG, run, KATANA, ART_MOUNT, undefined, { free: true }), /Sealed or Draft/);
});

test('sealed: no save carries extraction into a pool run', () => {
  const { run, rng } = smithRun('sealed');
  const storage = createMemoryStorage();
  const saves = createSaveManager(storage);
  saves.saveRun(run, rng);
  const pristine = storage.getItem(RUN_KEY);

  // 1. The save the game writes: the laid-out service comes back, still refused.
  const back = saves.loadRun(REG, 1);
  assert.ok(back, `reload refused: ${saves.runStatus().reason}`);
  assert.ok(back.shopStock.offerings.includes('extractArt'), 'the persisted stock still lays the service out');
  assert.equal(extractionPlan(REG, back).refusal, 'poolDeck');
  assert.deepEqual(extractionPlan(REG, back).candidates, []);
  assert.equal(blacksmithExtractPlan(REG, back, KATANA, ART_MOUNT).reason, REFUSAL);
  assert.throws(() => commitExtraction(REG, back, KATANA, ART_MOUNT, undefined, { free: true }), /Sealed or Draft/);

  // 2. Edited saves. Each is either refused at the load door or loads still refused.
  const edits = {
    'poolDeck: false on the run': (s) => { s.poolDeck = false; },
    'deckMode removed, marker kept': (s) => { delete s.custom.deckMode; },
    'deckMode standard, marker kept': (s) => { s.custom.deckMode = 'standard'; },
    'marker removed from a schema-current save': (s) => { delete s.poolDeckRule; },
    'a forged extract receipt': (s) => { s.lastMountReceipt = { schemaVersion: 1, service: 'extract', itemRef: KATANA, cardId: 'katanaDrawCut', authoredCost: 0, spent: 0, cost: 0, stoneBalanceBefore: 50, stoneBalanceAfter: 50, transaction: 1 }; },
  };
  const outcomes = {};
  for (const [why, edit] of Object.entries(edits)) {
    const saved = JSON.parse(pristine);
    edit(saved);
    storage.setItem(RUN_KEY, JSON.stringify(saved));
    const loaded = createSaveManager(storage).loadRun(REG, 1);
    outcomes[why] = loaded ? 'loaded' : 'refused';
    if (!loaded) continue; // the load door refused the edit
    assert.equal(extractionRefusal(loaded), 'poolDeck', `${why}: a loaded pool run is still refused`);
    assert.throws(() => commitExtraction(REG, loaded, KATANA, ART_MOUNT, undefined, { free: true }), /Sealed or Draft/, why);
  }
  assert.deepEqual(outcomes, {
    'poolDeck: false on the run': 'refused',
    'deckMode removed, marker kept': 'refused',
    'deckMode standard, marker kept': 'refused',
    'marker removed from a schema-current save': 'refused',
    'a forged extract receipt': 'loaded',
  }, 'the load door refuses every edit that would make the run stop reading as a pool run');
});
