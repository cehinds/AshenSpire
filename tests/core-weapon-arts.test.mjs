// Owner ruling 2026-11-01 (Core): weapon arts turn on. A worn weapon lends its default art(s) as
// item-owned deck cards, the way the 2026-10-19 gear grants do. Kits and the Dodge Roll stay off.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { equipPiece, stampDeck, reconcileGrantedCards, reconcileGrantedCardsInCombat, isItemOwned } from '../src/model/loadout.js';
import { swapRunClass } from '../src/model/classSwap.js';
import { moveToSideboard } from '../src/model/deckRules.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { createSaveManager, createMemoryStorage } from '../src/engine/save.js';

const meta = { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } };
const owns = { has: () => true };
function world(modules = {}) {
  const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules });
  return bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
}
const reg = world();
const start = (classId, registries = reg, seed = 511) => createRunState({ registries, classId, seed, profileMeta: meta });
const equip = (run, id, registries = reg) => assert.ok(equipPiece(registries, run.loadout, 'rightHand', 0, id, owns, { inCombat: false, classId: run.class, attributes: run.attributes }));
const arts = (run) => run.deck.filter((card) => card.equipmentRole === 'weaponArt').map((card) => card.cardId).sort();
const lent = (run) => run.deck.filter((card) => isItemOwned(card));

test('equip, replace and unequip a weapon: the deck holds exactly the worn weapon art', () => {
  const run = start('reaver');
  equip(run, 'greatsword'); stampDeck(reg, run);
  assert.deepEqual(arts(run), ['greatswordSunderingHew']);
  stampDeck(reg, run); reconcileGrantedCards(reg, run);
  assert.deepEqual(arts(run), ['greatswordSunderingHew'], 're-reconcile does not duplicate');
  equip(run, 'katana'); stampDeck(reg, run);
  assert.deepEqual(arts(run), ['katanaDrawCut'], 'replacing swaps the old art for the new');
  assert.ok(equipPiece(reg, run.loadout, 'rightHand', 0, null, owns, { inCombat: false, classId: run.class, attributes: run.attributes }));
  stampDeck(reg, run);
  assert.deepEqual(arts(run), []);
});

test('only arts turn on: no kit cards, no Dodge Roll, no package grants', () => {
  const run = start('reaver');
  equip(run, 'katana'); stampDeck(reg, run);
  assert.ok(lent(run).every((card) => card.equipmentRole === 'weaponArt' || card.equipmentRole === 'granted'));
  assert.ok(!run.deck.some((card) => card.kitRole), 'no kit');
  assert.ok(!run.deck.some((card) => String(card.grantedBy || '').startsWith('unarmed:')), 'no Dodge Roll');
});

test('the shipped default configured profile (empty modules) and the Core preset both lend arts', () => {
  assert.equal(reg.gameProfile?.foundation?.mode ?? 'configured', 'configured');
  assert.ok(arts(start('reaver')).includes('greatswordSunderingHew'), 'the Reaver starts with a greatsword');
});

test('a profile that sets the equipment weaponArts flag off lends no arts', () => {
  const off = world({ equipment: { weaponArts: false } });
  const run = start('reaver', off);
  equip(run, 'katana', off); stampDeck(off, run);
  assert.deepEqual(arts(run), []);
});

test('a set-aside art stays aside through reconcile', () => {
  const run = start('reaver');
  equip(run, 'katana'); stampDeck(reg, run);
  const art = run.deck.find((card) => card.cardId === 'katanaDrawCut');
  assert.equal(moveToSideboard(reg, run, art.instanceId), true);
  stampDeck(reg, run);
  assert.deepEqual(arts(run), []);
  assert.deepEqual(run.sideboard.filter((card) => card.equipmentRole === 'weaponArt').map((card) => card.cardId), ['katanaDrawCut']);
  equip(run, 'greatsword'); stampDeck(reg, run);
  assert.deepEqual(run.sideboard.filter((card) => card.equipmentRole === 'weaponArt'), [], 'unequipping sweeps the sideboarded art');
  assert.deepEqual(arts(run), ['greatswordSunderingHew']);
});

test('save and load keep the lent art and do not duplicate it', () => {
  const run = start('reaver');
  equip(run, 'katana'); stampDeck(reg, run);
  const saves = createSaveManager(createMemoryStorage());
  saves.saveRun(run, createRng(511));
  const loaded = saves.loadRun(reg);
  assert.ok(loaded, JSON.stringify(saves.runStatus()));
  assert.deepEqual(arts(loaded), ['katanaDrawCut']);
  stampDeck(reg, loaded);
  assert.deepEqual(arts(loaded), ['katanaDrawCut']);
});

test('an older save without the art gets it on the next reconcile', () => {
  const run = start('reaver');
  run.deck = run.deck.filter((card) => card.equipmentRole !== 'weaponArt');
  stampDeck(reg, run);
  assert.deepEqual(arts(run), ['greatswordSunderingHew']);
});

test('combat starts with the art in the piles, and a mid-fight swap moves it', () => {
  const registries = { ...reg, balance: structuredClone(reg.balance) };
  registries.balance.equipment.allowChangesInCombat = true;
  registries.balance.equipment.swapEndsTurn = false;
  const run = start('reaver', registries);
  run.loadout.storage.push('katana');
  const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  combat.player.stamina = 99; combat.swapsLeft = 99;
  const all = () => Object.values(combat.piles).flat();
  assert.equal(all().filter((card) => card.cardId === 'greatswordSunderingHew').length, 1);
  dispatch(combat, { type: 'changeEquipment', slotId: 'rightHand', setIndex: 0, pieceId: 'katana' });
  assert.equal(all().filter((card) => card.cardId === 'greatswordSunderingHew').length, 0);
  assert.equal(all().filter((card) => card.cardId === 'katanaDrawCut').length, 1);
  reconcileGrantedCardsInCombat(registries, run, combat.piles);
  assert.equal(all().filter((card) => card.cardId === 'katanaDrawCut').length, 1, 'idempotent');
});

test('a Core class swap is refused, so the lent art can never be orphaned by one', () => {
  const run = start('reaver');
  assert.throws(() => swapRunClass(reg, run, 'rogue'), /Configured classes stay fixed/);
  assert.deepEqual(arts(run), ['greatswordSunderingHew']);
});

// A Core profile that turns a resource pool off refuses any card that still costs it, so the arts carry
// the same "a disabled pool costs 0" rule every Core card variant has (gameProfile.js, projectWeaponArtResources).
for (const include of [['hp', 'sp', 'mp'], ['hp', 'sp'], ['hp', 'mp'], ['hp']]) {
  test(`every default weapon art resolves and plays in a Core fight with resources ${include.join('+')}`, () => {
    const registries = world({ resources: { include } });
    const pieces = (registries.equipment.armaments || []).filter((piece) => (piece.weaponCardPackage?.weaponArtDefaults || []).length);
    assert.ok(pieces.length > 10);
    for (const piece of pieces) {
      for (const artId of piece.weaponCardPackage.weaponArtDefaults) {
        assert.ok(registries.cards.get(artId), `${piece.id}: ${artId} resolves`);
        const run = start('reaver', registries);
        const combat = createRunCombat({ registries, run, rng: createRng(7), enemyIds: ['wanderingSoldier'] });
        const card = { instanceId: `probe:${artId}`, cardId: artId, upgraded: false };
        combat.piles.hand.push(card);
        combat.player.stamina = 20; combat.player.mana = 20; combat.player.energy = 20;
        dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId });
        assert.ok(!combat.piles.hand.includes(card), `${piece.id}: ${artId} left the hand when played`);
      }
    }
  });
}
