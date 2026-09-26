// tests/deck-rules.test.mjs — SPEC §14.1: the deck editor's rules, without its
// screen. The size bounds and their refusal sentence, the sideboard that keeps
// every limited card the run owns, the basics that stay slot-true, and the
// ordered draw (solo, co-op and a saved fight).
//   node --test tests/deck-rules.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { contentBundle } from '../src/content/index.js';
import { deckRules as DECK_RULES } from '../src/content/deckRules.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState, createCardInstance, RUN_SCHEMA_VERSION } from '../src/model/state.js';
import {
  deckEditBounds, deckEditRefusal, playInDeckOrder, isUnlimitedBasic, ownedCopies,
  moveToSideboard, moveFromSideboard, addBasicCard, orderedDrawPile, orderedReturn,
} from '../src/model/deckRules.js';
import { stampDeck } from '../src/model/loadout.js';
import { projectZones } from '../src/model/zones.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { drawCards } from '../src/engine/actions.js';
import { createCoopCombat } from '../src/engine/coopCombat.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { createSaveManager, createMemoryStorage, RUN_KEY } from '../src/engine/save.js';

const REG = createRegistries(contentBundle);
const ENEMY = contentBundle.enemies[0].id;
const freshRun = (seed = 0x10a5) => createRunState({ seed, classId: 'reaver', registries: REG });
const ordinary = (run) => run.deck.find((c) => !c.equipmentRole && !c.grantedBy);

test('the defaults are data, and the bounds read them', () => {
  assert.equal(DECK_RULES.defaults.deckEditing, true);
  assert.equal(DECK_RULES.defaults.deckEditingWhere, 'free');
  assert.equal(DECK_RULES.defaults.deckMinSize, 10);
  assert.deepEqual(deckEditBounds({}), { min: DECK_RULES.defaults.deckMinSize, max: Infinity, problem: '' });
  assert.deepEqual(deckEditBounds({ deckMinUnlimited: true }), { min: 0, max: Infinity, problem: '' });
  assert.deepEqual(deckEditBounds({ deckMaxUnlimited: false, deckMaxSize: 12 }), { min: 10, max: 12, problem: '' });
  assert.equal(playInDeckOrder({}), DECK_RULES.defaults.playInDeckOrder);
});

test('an out-of-bounds draft is refused with a sentence naming its count and the bound', () => {
  const short = deckEditRefusal(9, {});
  assert.match(short, /\b9\b/);
  assert.match(short, /\b10\b/);
  assert.equal(deckEditRefusal(9, { deckMinUnlimited: true }), '');
  assert.equal(deckEditRefusal(10, {}), '');
  const long = deckEditRefusal(13, { deckMaxUnlimited: false, deckMaxSize: 12 });
  assert.match(long, /\b13\b/);
  assert.match(long, /\b12\b/);
  const bad = { deckMaxUnlimited: false, deckMaxSize: 5 };
  assert.match(deckEditBounds(bad).problem, /below the minimum/, 'a max below the effective min is refused by name');
  assert.match(deckEditRefusal(10, bad), /below the minimum/, 'and the editor refuses with that sentence, never a throw');
});

test('a limited card moves to the sideboard with its fields and back, never minted or destroyed', () => {
  const run = freshRun();
  const card = ordinary(run);
  card.upgraded = true;
  const before = structuredClone(card);
  const size = run.deck.length;
  assert.equal(moveToSideboard(REG, run, card.instanceId), true);
  assert.equal(run.deck.length, size - 1);
  assert.deepEqual(run.sideboard, [before]);
  assert.equal(ownedCopies(run, card.cardId), 1);
  assert.ok(projectZones(run).collection.some((c) => c.instanceId === card.instanceId),
    'a sideboarded card is still in the collection');
  assert.equal(moveFromSideboard(REG, run, card.instanceId), true);
  assert.equal(run.sideboard.length, 0);
  assert.deepEqual(run.deck.find((c) => c.instanceId === card.instanceId), before);
  assert.equal(moveFromSideboard(REG, run, card.instanceId), false, 'no copy left to add');
});

test('an item-owned card is locked in the deck', () => {
  const run = freshRun();
  const granted = run.deck.find((c) => c.grantedBy);
  assert.equal(moveToSideboard(REG, run, granted.instanceId), false);
  assert.ok(run.deck.includes(granted));
});

test('basics are matched by role and stay slot-true', () => {
  const run = freshRun();
  const strike = run.deck.find((c) => c.equipmentRole === 'attack');
  assert.ok(isUnlimitedBasic(strike));
  assert.ok(!isUnlimitedBasic(run.deck.find((c) => c.grantedBy && c.cardId === 'strike')), 'a kit strike is item-owned, not a basic');
  const born = run.equipmentAttackSlotCount;

  assert.equal(moveToSideboard(REG, run, strike.instanceId), true);
  assert.deepEqual(run.removedAttackSlotIds, [strike.equipmentAttackSlotId], 'removing a basic retires its slot');
  assert.ok(run.sideboard.some((c) => c.instanceId === strike.instanceId));

  const back = addBasicCard(REG, run, 'attack');
  assert.equal(back.instanceId, strike.instanceId, 'adding first un-retires the retired slot');
  assert.deepEqual(run.removedAttackSlotIds, []);
  assert.equal(run.sideboard.length, 0);

  const grown = addBasicCard(REG, run, 'attack');
  assert.equal(run.equipmentAttackSlotCount, born + 1, 'with none retired, the allocation grows');
  assert.equal(grown.equipmentAttackSlotId, `attack:${born}`);
  assert.doesNotThrow(() => stampDeck(REG, run));
  assert.equal(grown.cardId, strike.cardId, 'the new slot wears the weapon face');

  const guards = run.deck.filter((c) => c.equipmentRole === 'guard').length;
  const guard = addBasicCard(REG, run, 'guard');
  assert.equal(guard.equipmentRole, 'guard');
  assert.equal(run.deck.filter((c) => c.equipmentRole === 'guard').length, guards + 1);
  assert.doesNotThrow(() => stampDeck(REG, run));
  assert.equal(moveToSideboard(REG, run, guard.instanceId), true);
  assert.equal(addBasicCard(REG, run, 'guard').instanceId, guard.instanceId, 'a sideboarded guard comes back first');
});

test('a run with no equipment mints plain unlimited basics with counted ids', () => {
  const run = freshRun();
  run.deck = run.deck.filter((c) => !c.equipmentRole && !c.grantedBy);
  run.deck.push(createCardInstance('strike', false, () => 'plain1'));
  const minted = addBasicCard(REG, run, 'strike', { plain: true });
  assert.equal(minted.cardId, 'strike');
  assert.equal(minted.instanceId, 'edit:1');
  assert.equal(run.editMintCounter, 1);
  assert.equal(moveToSideboard(REG, run, minted.instanceId), true);
  assert.ok(!run.sideboard.some((c) => c.instanceId === minted.instanceId), 'a pristine plain basic is deleted, not kept');
  const plain = run.deck.find((c) => c.instanceId === 'plain1');
  plain.upgraded = true;
  assert.equal(moveToSideboard(REG, run, 'plain1'), true);
  assert.ok(run.sideboard.some((c) => c.instanceId === 'plain1'), 'an upgraded plain basic is kept');
  assert.equal(addBasicCard(REG, run, 'strike', { plain: true }).instanceId, 'plain1', 'and comes back before a fresh one');
});

test('ordered draw piles and returns follow the deck, Innate first, consuming no shuffle value', () => {
  const deck = ['a', 'b', 'c', 'd'].map((id) => ({ instanceId: id }));
  assert.deepEqual(orderedDrawPile(deck, (c) => c.instanceId === 'c').map((c) => c.instanceId), ['c', 'a', 'b', 'd']);
  const order = ['a', 'b', 'c', 'd'];
  const discard = [{ instanceId: 'd' }, { instanceId: 'x' }, { instanceId: 'a' }, { instanceId: 'y' }];
  assert.deepEqual(orderedReturn(discard, order).map((c) => c.instanceId), ['a', 'd', 'x', 'y']);
});

test('a solo fight in deck order opens with the deck\'s first cards, and off is unchanged', () => {
  const run = freshRun();
  const rngOn = createRng(7);
  const on = createRunCombat({ registries: REG, rng: rngOn, run, enemyIds: [ENEMY], settings: { playInDeckOrder: true } });
  assert.ok(on.orderedDraw, 'the fight carries the rule');
  const opened = [...on.piles.hand, ...on.piles.draw].map((c) => c.instanceId);
  assert.deepEqual(opened, run.deck.map((c) => c.instanceId), 'hand then draw are the deck in order');
  assert.equal(rngOn.getCounters().shuffle, 0, 'no shuffle value was consumed');

  const a = createRunCombat({ registries: REG, rng: createRng(7), run: freshRun(), enemyIds: [ENEMY], settings: {} });
  const b = createRunCombat({ registries: REG, rng: createRng(7), run: freshRun(), enemyIds: [ENEMY], settings: { playInDeckOrder: false } });
  assert.equal(a.orderedDraw, null);
  assert.deepEqual(a.piles.hand.map((c) => c.instanceId), b.piles.hand.map((c) => c.instanceId));

  // The empty-pile return is ordered too.
  on.piles.discard.push(...on.piles.draw.splice(0).reverse());
  const counter = rngOn.getCounters().shuffle;
  on.piles.hand.length = 0;
  drawCards(on, 1);
  assert.equal(rngOn.getCounters().shuffle, counter, 'the ordered return rolls nothing');
  const wanted = on.orderedDraw.order.filter((id) => [...on.piles.hand, ...on.piles.draw].some((c) => c.instanceId === id));
  assert.deepEqual([...on.piles.hand, ...on.piles.draw].map((c) => c.instanceId), wanted);
});

test('a saved fight keeps the rule it started with; a snapshot without it resumes unordered', () => {
  const run = freshRun();
  const combat = createRunCombat({ registries: REG, rng: createRng(9), run, enemyIds: [ENEMY], settings: { playInDeckOrder: true } });
  const snapshot = serializeCombatSnapshot(combat);
  const back = restoreCombatSnapshot({ registries: REG, rng: createRng(9), snapshot });
  assert.deepEqual(back.orderedDraw, combat.orderedDraw);
  const older = structuredClone(snapshot);
  delete older.orderedDraw;
  assert.equal(restoreCombatSnapshot({ registries: REG, rng: createRng(9), snapshot: older }).orderedDraw, null);
});

test('each co-op seat draws in its own owner\'s order', () => {
  const run = freshRun();
  const C = createCoopCombat({ registries: REG, rng: createRng(11), enemyIds: [ENEMY],
    players: [{ ...run, id: 'p1', classId: run.class, relicIds: run.relics, orderedDraw: true }] });
  const seat = C.players.get('p1');
  assert.ok(seat.orderedDraw);
  const opened = [...seat.piles.hand, ...seat.piles.draw].map((c) => c.instanceId);
  assert.deepEqual(opened, run.deck.map((c) => c.instanceId));
});

test(`the sideboard rides the save: a fresh run carries it, and schema 10 loads with an empty one (schema ${RUN_SCHEMA_VERSION})`, () => {
  assert.deepEqual(freshRun().sideboard, []);
  const corpus = JSON.parse(readFileSync(new URL('./fixtures/run-save-schema-versions.json', import.meta.url), 'utf8'));
  const storage = createMemoryStorage();
  storage.setItem(RUN_KEY, corpus.versions['10'].bytes);
  const run = createSaveManager(storage).loadRun(REG);
  assert.ok(run, 'the schema-10 save loads');
  assert.deepEqual(run.sideboard, []);
});

test('the skill threshold upgrades a sideboarded card, and it comes back upgraded', async () => {
  const { applySkillUpgrades } = await import('../src/model/skills.js');
  const run = freshRun();
  const slash = run.deck.find((c) => c.cardId === 'gorefireSlash');
  moveToSideboard(REG, run, slash.instanceId);
  assert.ok(applySkillUpgrades(REG, run, 'item:blade').includes(slash.instanceId));
  moveFromSideboard(REG, run, slash.instanceId);
  assert.equal(run.deck.find((c) => c.instanceId === slash.instanceId).upgraded, true);
});

test('a sideboarded art is installable, and installing takes it from the sideboard', async () => {
  const { extractionPlan, commitExtraction, installPlan, commitInstall } = await import('../src/model/cardExtraction.js');
  const { mountKey: mountKeyOf } = await import('../src/model/cardMounts.js');
  // The engine test 26w fixture: a sword whose art is tagged extractable.
  const b = JSON.parse(JSON.stringify(contentBundle));
  b.equipment.armaments = b.equipment.armaments.map((piece) => (piece.id === 'straightSword'
    ? { ...piece, weaponCardPackage: { compatibility: 'attack-v1', fillerAttackProfileId: 'bladeAttack', grantedCards: [], weaponArtDefaults: ['crimsonCleave'] } }
    : piece));
  b.tagging.push({ family: 'card', scope: '', objectId: 'crimsonCleave', tagId: 'extractable' });
  b.scripts = contentBundle.scripts;
  const reg = createRegistries(b);
  const run = createRunState({ seed: 21, classId: 'reaver', registries: reg });
  const sword = 'armament/straightSword';
  const artKey = mountKeyOf.weaponArt('straightSword', 'crimsonCleave');
  assert.ok(extractionPlan(reg, run).candidates.length);
  const receipt = commitExtraction(reg, run, sword, artKey);
  assert.equal(moveToSideboard(reg, run, receipt.instanceId), true);
  const seats = installPlan(reg, run).candidates.flatMap((c) => c.mounts.flatMap((m) => m.cards.map((card) => card.instanceId)));
  assert.ok(seats.includes(receipt.instanceId), 'the sideboarded art is offered');
  commitInstall(reg, run, sword, artKey, receipt.instanceId);
  assert.ok(!run.sideboard.some((c) => c.instanceId === receipt.instanceId));
  assert.ok(!run.deck.some((c) => c.instanceId === receipt.instanceId));
});

test('Settings → Advanced → Deck shows one row per rule, each defaulting from content', async () => {
  const { settingsRows } = await import('../src/ui/screens/settings.js');
  const rows = settingsRows().filter((row) => row.advancedGroup === 'Deck');
  assert.deepEqual(rows.map((row) => row.key).sort(), Object.keys(DECK_RULES.defaults).sort());
  for (const row of rows) assert.equal(row.def, DECK_RULES.defaults[row.key], `${row.key} defaults from content/deckRules.js`);
  assert.deepEqual(rows.find((row) => row.key === 'deckEditingWhere').choices, [...DECK_RULES.where]);
});

test('review fixes: a merchant-retired slot is reused, a malformed ordered snapshot is refused, a dangling sideboard id archives', async () => {
  const { removeDeckCard } = await import('../src/model/cardRemoval.js');
  const { combatSnapshotProblems } = await import('../src/model/combatSnapshot.js');
  const run = freshRun();
  const strike = run.deck.find((c) => c.equipmentRole === 'attack');
  const born = run.equipmentAttackSlotCount;
  assert.ok(removeDeckCard(run, strike.instanceId), 'the merchant removes it for good');
  const added = addBasicCard(REG, run, 'attack');
  assert.equal(added.equipmentAttackSlotId, strike.equipmentAttackSlotId, 'the retired slot is reused');
  assert.equal(run.equipmentAttackSlotCount, born, 'the allocation did not grow');
  assert.deepEqual(run.removedAttackSlotIds, []);
  assert.doesNotThrow(() => stampDeck(REG, run));

  const combat = createRunCombat({ registries: REG, rng: createRng(3), run: freshRun(), enemyIds: [ENEMY], settings: { playInDeckOrder: true } });
  const snap = serializeCombatSnapshot(combat);
  assert.deepEqual(combatSnapshotProblems(snap), []);
  assert.ok(combatSnapshotProblems({ ...snap, orderedDraw: {} }).some((p) => /orderedDraw/.test(p)));

  const saved = freshRun();
  saved.sideboard.push({ instanceId: 'gone1', cardId: 'noSuchCard', upgraded: false });
  saved.contentVersion = 'older';
  const storage = createMemoryStorage();
  const saves = createSaveManager(storage);
  saves.saveRun(saved, createRng(1));
  assert.equal(createSaveManager(storage).loadRun(REG), null, 'a dangling sideboard card archives the save');
});

test('a LAN seat carries its owner\'s Play in deck order into the fight', async () => {
  const { createSession } = await import('../tools/session.mjs');
  const game = createSession({ registries: REG, seedString: 'ORDER' });
  const m = game.addMember({ id: 'p1', name: 'Wren', classId: 'reaver', playInDeckOrder: true });
  assert.equal(m.playInDeckOrder, true);
  const restored = JSON.parse(JSON.stringify(game.serialize()));
  assert.equal(restored.members[0].playInDeckOrder, true, 'the seat keeps it across a host save');
});

test('Settings paints the min-above-max refusal on both rows', async () => {
  const { deckSettingsProblems } = await import('../src/model/deckRules.js');
  assert.deepEqual(deckSettingsProblems({}), []);
  const [problem] = deckSettingsProblems({ deckMinSize: 30, deckMaxUnlimited: false, deckMaxSize: 20 });
  assert.deepEqual(problem.keys, ['deckMinSize', 'deckMaxSize']);
  assert.match(problem.message, /20.*30/);
});

test('a restored ordered fight returns its discard in deck order, Innate cards opening first', () => {
  const run = freshRun();
  run.deck.push(createCardInstance('warriorsVow', false, () => 'innate1'));
  const combat = createRunCombat({ registries: REG, rng: createRng(5), run, enemyIds: [ENEMY], settings: { playInDeckOrder: true } });
  assert.equal([...combat.piles.hand, ...combat.piles.draw][0].instanceId, 'innate1', 'the Innate card opens the pile');
  const back = restoreCombatSnapshot({ registries: REG, rng: createRng(5), snapshot: serializeCombatSnapshot(combat) });
  back.piles.discard.push(...back.piles.draw.splice(0).reverse(), ...back.piles.hand.splice(0).reverse());
  drawCards(back, 1);
  const order = back.orderedDraw.order;
  const pile = [...back.piles.hand, ...back.piles.draw].map((c) => c.instanceId);
  assert.deepEqual(pile, [...pile].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
});
