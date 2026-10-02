// Sealed and Draft runs reload (Custom Climb deck modes, main.js newRun).
//
// The bug: both modes deal the starting deck from a pool AFTER createRunState
// composed one from the equipment, so the run kept a birth attack quota
// (`equipmentAttackSlotCount`) its deck held none of. The load door's full
// restamp then refused every such save — "attack instance count 0 does not
// match authored N" — and archived it. Found while building the Unity save
// import, whose room-reference exporter recorded both modes as `archived`.
//
// The rule now (model/cardRemoval.js): a pool-built deck's birth attack quota
// is the slots it was dealt — none — written at the deal with the
// `poolDeckRule` marker; a save written before that (no marker) is healed once
// at the load door and marked, and a marked save is held to its quota like any
// run. A pool deck is never dealt the equipment's lent cards (kit basics,
// weapon arts, Dodge Roll) at any restamp door: the load, the end of a fight,
// an Armoury change, a mid-fight swap, a resumed fight.
// A Standard run keeps the composed rule: a deck missing its slots is refused.
//
// main.js cannot be imported headless, so `deal` mirrors newRun's non-UI half
// for these modes line for line (sealedDeckIds, draftBaseIds, the draft
// screen's pick), and the last test reads main.js as text to hold that mirror.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState, createIdGen, createDeck } from '../src/model/state.js';
import { createRng, seedToString } from '../src/engine/rng.js';
import { createSaveManager, createMemoryStorage } from '../src/engine/save.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { commitCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { dispatch } from '../src/engine/combat.js';
import { isPoolDeckRun, dealtAttackSlotCount, POOL_DECK_RULE } from '../src/model/cardRemoval.js';
import { stampDeck } from '../src/model/loadout.js';

const registries = createRegistries(contentBundle);
const SEED = 5;
const BASE = ['strike', 'strike', 'strike', 'strike', 'defend', 'defend', 'defend'];

// main.js newRun → (showDraft) → startClimb's persist. `fixed: false` writes
// the save the way builds before this fix wrote it.
function deal(classId, deckMode, { fixed = true } = {}) {
  const storage = createMemoryStorage();
  const saves = createSaveManager(storage);
  saves.ensureProfile();
  const run = createRunState({ seed: SEED, classId, registries, profileMeta: saves.loadMeta() });
  run.seedString = seedToString(SEED);
  run.customization = { name: 'Forsaken', glyph: '⚔', tint: 'gold' };
  run.custom = { ascension: 0, mods: {}, deckMode };
  run.stats = { fightsWon: 0, damageDealt: 0, damageTaken: 0 };
  run.path = [];
  run.seenEvents = [];
  run.lastEncounters = [];
  const rng = createRng(SEED);
  const pool = registries.classes.get(classId).cardPool.slice();
  if (deckMode === 'sealed') {
    const ids = BASE.slice();
    for (let i = 0; i < 3 && pool.length; i++) { const id = rng.pick('misc', pool); pool.splice(pool.indexOf(id), 1); ids.push(id); }
    run.deck = createDeck(ids, createIdGen('rc'));
  } else if (deckMode === 'draft') {
    run.deck = createDeck(BASE, createIdGen('rc'));
  }
  const composedQuota = run.equipmentAttackSlotCount;
  if (fixed && isPoolDeckRun(run)) { run.equipmentAttackSlotCount = dealtAttackSlotCount(run.deck); run.poolDeckRule = POOL_DECK_RULE; }
  if (deckMode === 'draft') {
    // ui/screens/draft.js: three rounds of three offers; take the first.
    const idGen = createIdGen('df');
    for (let round = 0; round < 3; round++) {
      const local = pool.slice();
      const offer = [];
      for (let i = 0; i < 3 && local.length; i++) { const id = rng.pick('cardRewards', local); local.splice(local.indexOf(id), 1); offer.push(id); }
      run.deck.push({ instanceId: idGen(), cardId: offer[0], upgraded: false });
      pool.splice(pool.indexOf(offer[0]), 1);
    }
  }
  // main.js startClimb: the dealt deck (picks included) gets its equipment faces.
  if (fixed && isPoolDeckRun(run)) stampDeck(registries, run, undefined, { adoptEquipmentBonuses: false, reconcileEquipmentPools: false });
  saves.saveRun(run, rng);
  return { run, rng, saves, storage, composedQuota };
}

const savedDeck = (storage) => JSON.parse(storage.getItem('sote_run_v1')).deck;
const ids = (deck) => deck.map((c) => `${c.instanceId}:${c.cardId}`);
const cards = (deck) => JSON.parse(JSON.stringify(deck));
const lent = (deck) => deck.filter((c) => c && (c.grantedBy || c.kitRole || c.equipmentRole === 'weaponArt' || c.equipmentRole === 'granted'));
const piles = (p) => Object.fromEntries(['draw', 'hand', 'discard', 'exhaust'].map((k) => [k, ids(p[k])]));
const fight = (run, rng) => createRunCombat({ registries, rng, run, settings: {}, enemyIds: registries.encounters.get('loneSoldier').enemies, hpMult: 1, enemyStatuses: [], playerStatuses: [] });

for (const [classId, deckMode] of [['starseer', 'sealed'], ['rogue', 'draft'], ['reaver', 'sealed'], ['herald', 'draft']]) {
  test(`${deckMode} (${classId}): a save the game writes reloads with its deck exactly`, () => {
    const { run, saves, storage, composedQuota } = deal(classId, deckMode);
    assert.ok(composedQuota > 0, 'the fixture needs a class whose composed deck has attack slots');
    assert.equal(run.deck.filter((c) => c.equipmentRole === 'attack').length, 0, 'a dealt deck holds no composed attack slot');
    assert.equal(run.equipmentAttackSlotCount, 0, 'the dealt deck\'s quota is what it was dealt');
    assert.equal(run.poolDeckRule, POOL_DECK_RULE, 'the deal marks the run as held to the dealt-deck rule');
    assert.deepEqual(lent(run.deck), [], 'the deal and its stamp deal no lent card');
    // The live climb's first full restamp (an Armoury swap) used to throw too.
    assert.doesNotThrow(() => stampDeck(registries, structuredClone(run)));
    const before = cards(savedDeck(storage));
    const back = saves.loadRun(registries, 1);
    const status = saves.runStatus();
    assert.ok(back, `reload refused: ${status.reason}`);
    assert.equal(status.state, 'ok', 'nothing to heal in a save the fixed game wrote');
    assert.deepEqual(cards(back.deck), before, 'reload restores the deck exactly: no card dropped, dealt back or restamped differently');
    assert.equal(back.custom.deckMode, deckMode);
  });

  test(`${deckMode} (${classId}): the end-of-fight restamp and an Armoury change keep the dealt deck`, () => {
    const { run, rng, saves, storage } = deal(classId, deckMode);
    const dealt = ids(run.deck);
    // main.js after every fight: stampDeck(registries, run, undefined, …) — the full
    // restamp that threw "attack instance count 0 does not match authored N" before.
    stampDeck(registries, run, undefined, { adoptEquipmentBonuses: false });
    assert.deepEqual(ids(run.deck), dealt, 'the end of a fight deals no lent card');
    // main.js's Armoury onChange: a new loadout, then the full restamp.
    run.loadout.sets.rightHand[1] = 'dagger';
    run.loadout.active.rightHand = 1;
    stampDeck(registries, run);
    assert.deepEqual(ids(run.deck), dealt, 'an Armoury change deals no lent card either');
    assert.deepEqual(lent(run.deck), []);
    saves.saveRun(run, rng);
    const before = cards(savedDeck(storage));
    const back = saves.loadRun(registries, 1);
    assert.ok(back, `reload refused: ${saves.runStatus().reason}`);
    assert.equal(saves.runStatus().state, 'ok');
    assert.deepEqual(cards(back.deck), before);
  });

  test(`${deckMode} (${classId}): a save written before the fix reloads, healed and named`, () => {
    const { saves, storage, composedQuota } = deal(classId, deckMode, { fixed: false });
    assert.equal(JSON.parse(storage.getItem('sote_run_v1')).equipmentAttackSlotCount, composedQuota, 'the old save kept the composed quota');
    const before = ids(savedDeck(storage));
    const back = saves.loadRun(registries, 1);
    const status = saves.runStatus();
    assert.ok(back, `reload refused: ${status.reason}`);
    assert.equal(status.state, 'healed');
    const row = status.ledger.entries.find((e) => e.site === 'save.js:dealtAttackSlotCount');
    assert.ok(row, 'the heal is in the ledger, by site');
    assert.equal(row.field, 'equipmentAttackSlotCount');
    assert.deepEqual(row.was, { run: composedQuota, snapshot: null, poolDeckRule: undefined });
    assert.equal(back.equipmentAttackSlotCount, 0);
    assert.equal(back.poolDeckRule, POOL_DECK_RULE, 'the heal marks the run, so it runs once');
    assert.deepEqual(ids(back.deck), before, 'the kit and weapon arts the deal took are not dealt back');
    // Healed once: the next save and load has nothing left to heal.
    saves.saveRun(back, createRng(SEED));
    assert.ok(saves.loadRun(registries, 1));
    assert.equal(saves.runStatus().state, 'ok');
  });
}

for (const fixed of [true, false]) {
  test(`sealed: a mid-fight Save Game ${fixed ? 'the game writes' : 'written before the fix'} reloads its fight pile for pile`, () => {
    const { run, rng, saves } = deal('starseer', 'sealed', { fixed });
    const combat = fight(run, rng);
    assert.equal(combat.poolDeck, true, 'a dealt deck\'s fight carries the rule');
    commitCombatSnapshot({ run, combat, nodeId: 'n0', encounterId: 'loneSoldier' });
    // A fight saved before the fix knew nothing of the rule.
    if (!fixed) delete run.combatEntered.snapshot.poolDeck;
    else assert.equal(run.combatEntered.snapshot.poolDeck, true, 'the snapshot carries the rule');
    const before = piles(run.combatEntered.snapshot.piles);
    saves.saveRun(run, rng);
    const back = saves.loadRun(registries, 1);
    assert.ok(back, `reload refused: ${saves.runStatus().reason}`);
    const snap = back.combatEntered.snapshot;
    assert.equal(snap.equipmentAttackSlotCount, 0);
    assert.deepEqual(piles(snap.piles), before, 'no lent card is dealt into the resumed fight');
    if (!fixed) {
      const row = saves.runStatus().ledger.entries.find((e) => e.site === 'save.js:dealtAttackSlotCount');
      assert.ok(row && row.was.snapshot > 0 && row.now.snapshot === 0, 'the snapshot heal is named');
    }
  });
}

test('sealed: a mid-fight weapon swap deals no lent card into the piles', () => {
  const { run, rng } = deal('starseer', 'sealed');
  run.loadout.sets.rightHand[1] = 'dagger';
  const combat = fight(run, rng);
  combat.player.energy = 10;
  const before = Object.values(piles(combat.piles)).flat().sort();
  dispatch(combat, { type: 'swapArmament', slotId: 'rightHand', setIndex: 1 });
  assert.equal(combat.loadout.active.rightHand, 1, 'the swap happened');
  assert.deepEqual(Object.values(piles(combat.piles)).flat().sort(), before);
});

test('sealed: a marked save that lost an attack card is refused, not healed (Codex review)', () => {
  // A current pool run that grew an attack basic (deck editor: quota 1,
  // attack:0) and then lost the card: the marker says this is no pre-fix
  // save, so the quota is not rewritten to 0 and the damage is refused.
  const { run, rng, saves } = deal('starseer', 'sealed');
  run.equipmentAttackSlotCount = 1;
  saves.saveRun(run, rng);
  assert.equal(saves.loadRun(registries, 1), null);
  assert.equal(saves.runStatus().state, 'archived');
  assert.match(saves.runStatus().reason, /attack instance count 0 does not match authored 1/);
});

test('standard: a deck missing its composed attack slots is still refused', () => {
  const { run, rng, saves } = deal('reaver', 'standard');
  run.deck = run.deck.filter((c) => c.equipmentRole !== 'attack');
  saves.saveRun(run, rng);
  assert.equal(saves.loadRun(registries, 1), null);
  const status = saves.runStatus();
  assert.equal(status.state, 'archived');
  assert.match(status.reason, /attack instance count 0 does not match authored [1-9]/);
});

test('standard: a Sealed-shaped deck saved under Standard rules is still refused', () => {
  const { run, rng, saves } = deal('starseer', 'standard');
  run.deck = createDeck(BASE, createIdGen('rc'));
  saves.saveRun(run, rng);
  assert.equal(saves.loadRun(registries, 1), null);
  assert.match(saves.runStatus().reason, /attack instance count 0 does not match authored/);
});

test('sealed: a malformed attack slot is refused, not renumbered', () => {
  for (const [what, corrupt, reason] of [
    ['more slots than the quota', (run) => { for (let i = 0; i <= run.equipmentAttackSlotCount; i++) run.deck.push({ instanceId: `x${i}`, cardId: 'strike', upgraded: false, equipmentRole: 'attack', equipmentAttackSlotId: `attack:${i}` }); }, /attack instance count \d+ does not match authored \d+|unknown equipmentAttackSlotId/],
    ['a gap in the dealt slots', (run) => { run.deck.push({ instanceId: 'x1', cardId: 'strike', upgraded: false, equipmentRole: 'attack', equipmentAttackSlotId: 'attack:1' }); }, /attack:0 is missing/],
    ['a slot two instances claim', (run) => { for (const n of ['x1', 'x2']) run.deck.push({ instanceId: n, cardId: 'strike', upgraded: false, equipmentRole: 'attack', equipmentAttackSlotId: 'attack:0' }); }, /duplicate equipmentAttackSlotId 'attack:0'/],
    ['an attack instance with no slot', (run) => { run.deck.push({ instanceId: 'x1', cardId: 'strike', upgraded: false, equipmentRole: 'attack' }); }, /has no valid equipmentAttackSlotId/],
  ]) {
    const { run, rng, saves } = deal('starseer', 'sealed', { fixed: false });
    corrupt(run);
    saves.saveRun(run, rng);
    assert.equal(saves.loadRun(registries, 1), null, `${what} must be refused`);
    assert.equal(saves.runStatus().state, 'archived', what);
    assert.match(saves.runStatus().reason, reason, what);
  }
});

test('main.js newRun writes the dealt deck\'s quota after the deal, and startClimb stamps it', () => {
  const src = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const sealed = src.indexOf("run.deck = createDeck(sealedDeckIds(classId), createIdGen('rc'));");
  const draft = src.indexOf("run.deck = createDeck(draftBaseIds(), createIdGen('rc'));");
  const quota = src.indexOf('run.equipmentAttackSlotCount = dealtAttackSlotCount(run.deck);\n    run.poolDeckRule = POOL_DECK_RULE;');
  const showDraft = src.indexOf("if (deckMode === 'draft') return showDraft();");
  assert.ok(sealed > 0 && draft > sealed, 'the deal this test mirrors moved');
  assert.ok(quota > draft && quota < showDraft, 'the quota must follow the deal and precede the draft and the first persist');
  const climb = src.slice(src.indexOf('function startClimb()'), src.indexOf('function showPrologue()'));
  const stamp = climb.indexOf('if (isPoolDeckRun(run)) stampDeck(registries, run, undefined, { adoptEquipmentBonuses: false, reconcileEquipmentPools: false });');
  assert.ok(stamp > 0 && stamp < climb.indexOf('persist();'), 'startClimb must stamp a dealt deck before its first persist');
  const body = src.slice(src.indexOf('function sealedDeckIds'), src.indexOf('function draftBaseIds'));
  assert.match(body, /\['strike', 'strike', 'strike', 'strike', 'defend', 'defend', 'defend'\]/);
  assert.match(body, /rng\.pick\('misc', pool\)/);
});
