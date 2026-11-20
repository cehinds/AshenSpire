import { legacyGearRegistries } from './helpers/legacy-gear.mjs';
// Owner ruling 2026-10-19 (Core): equipped gear grants cards; the Bone Sceptre grants Mana Surge
// (1 SP, gain 2 Mana) to any class holding it.
import test from 'node:test';
import assert from 'node:assert/strict';

// Kernel validation of gear.grantedCards (like classDecks: names the item and row).
test('gear.grantedCards is validated at profile construction, naming the item and row', async () => {
  const { compileGameProfiles } = await import('../tools/game-config.mjs');
  const { resolveGameAuthor } = await import('../engine/kernel/gameConfig.js');
  const { catalog, authors } = compileGameProfiles();
  const pack = catalog.bundles[authors.core.core].manifest.packs.find(row => row.id === 'ashen.core-content');
  const build = (mutate) => {
    const copy = JSON.parse(JSON.stringify(catalog));
    mutate(copy.packs[`${pack.id}@${pack.version}`].content.gear.find(item => item.id === 'boneSceptre'));
    return () => resolveGameAuthor(authors.core, copy);
  };
  assert.doesNotThrow(build(() => {}), 'the shipped Core bundle validates');
  assert.throws(build(g => { g.grantedCards[0].card = 'core.missing'; }), /gear\/boneSceptre\/grantedCards\/0\/card.*unknown card reference "core.missing" for item boneSceptre row 0/);
  assert.throws(build(g => { g.grantedCards[0].copies = 0; }), /gear\/boneSceptre\/grantedCards\/0\/copies.*positive integer copies for item boneSceptre row 0/);
  assert.throws(build(g => { g.grantedCards[0].copies = '1'; }), /positive integer copies/);
  assert.throws(build(g => { g.grantedCards[0].copies = 1.5; }), /positive integer copies/);
  assert.throws(build(g => { g.grantedCards[0].copies = 2 ** 60; }), /positive integer copies/);
  assert.throws(build(g => { g.grantedCards = 'x'; }), /grantedCards.*expected an array/);
});

import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries, projectGameCard } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { withGameProfileService } from '../src/model/gameProfileRun.js';
import { applyLevelUp } from '../src/model/levelup.js';
import { equipPiece, stampDeck, reconcileGrantedCards, isItemOwned } from '../src/model/loadout.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat, runCombatEnd } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { commitCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { createSaveManager, createMemoryStorage } from '../src/engine/save.js';
import { withWeaponRack } from './withWeaponRack.mjs';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(withWeaponRack(applyGameProfileToContent(contentBundle, profile))), profile);
const meta = { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } };
const start = (classId, seed = 511) => createRunState({ registries: reg, classId, seed, profileMeta: meta });
const surges = (run) => run.deck.filter((c) => c.cardId === 'core.manaSurge');
const owns = { has: () => true };
const equip = (run, id) => assert.ok(equipPiece(reg, run.loadout, 'rightHand', 0, id, owns, { inCombat: false, attributes: run.attributes }));

function spendEarnedPoints(registries, run, attribute, count) {
  run.level.level += count;
  run.level.unspentPoints += count;
  withGameProfileService(run, 'levelUp', () => {
    for (let point = 0; point < count; point++) applyLevelUp(registries, run, attribute);
  });
}

test('the card is Mana Surge: 1 SP, no Mana cost, gains 2 Mana, reads "Gain 2 Mana."', async () => {
  const def = reg.cards.get('core.manaSurge');
  assert.equal(def.name, 'Mana Surge');
  assert.equal(def.type, 'skill');
  assert.equal(def.staminaCost, 1);
  assert.equal(def.manaCost, 0);
  assert.deepEqual(def.effects, [{ op: 'restoreMana', target: 'self', amount: 2 }]);
  assert.ok(def.tags.includes('camp:spell') && def.kindIds.includes('classification.skill'));
  assert.ok(!def.tags.includes('maneuver:attack'));
  const { cardFaceText } = await import('../src/model/cardFaceText.js').catch(() => ({}));
  if (cardFaceText) assert.match(JSON.stringify(cardFaceText(def)), /Gain 2 Mana/);
});

test('fresh Core Starseer and Herald each hold exactly one granted Mana Surge; Reaver and Rogue none', () => {
  for (const id of ['starseer', 'herald']) {
    const run = start(id);
    const found = surges(run);
    assert.equal(found.length, 1, id);
    assert.equal(found[0].equipmentRole, 'granted');
    assert.equal(found[0].grantedBy, 'boneSceptre');
    assert.equal(found[0].instanceId, 'granted:boneSceptre:core.manaSurge:0');
  }
  for (const id of ['reaver', 'rogue']) assert.equal(surges(start(id)).length, 0, id);
});

test('Starseer replaces Resource Gain and both sceptre classes start with eleven cards', () => {
  const run = start('starseer');
  assert.equal(run.deck.filter((c) => c.cardId === 'base.gain-resource').length, 0);
  assert.equal(run.deck.length, 11, 'the starting weapon art replaces the class special');
  assert.equal(run.deck.filter((c) => !isItemOwned(c)).length, 9);
  const herald = start('herald');
  assert.equal(herald.deck.length, 11, 'Herald authors nine cards plus granted Mana Surge and Blight Touch');
  assert.equal(herald.deck.filter(c => c.cardId === 'base.ethereal').length, 2);
});

test('a Reaver gains Mana Surge on equipping a Bone Sceptre, loses it on unequip, never duplicates', () => {
  const run = start('reaver');
  const authored = run.deck.length;
  equip(run, 'boneSceptre');
  stampDeck(reg, run);
  assert.equal(surges(run).length, 1);
  stampDeck(reg, run); reconcileGrantedCards(reg, run); stampDeck(reg, run);
  assert.equal(surges(run).length, 1, 're-reconcile does not duplicate');
  assert.equal(run.deck.length, authored + 1);
  assert.ok(equipPiece(reg, run.loadout, 'rightHand', 0, null, owns, { inCombat: false, attributes: run.attributes }));
  stampDeck(reg, run);
  assert.equal(surges(run).length, 0);
  equip(run, 'boneSceptre');
  stampDeck(reg, run);
  assert.equal(surges(run).length, 1, 're-equip grants once');
  equip(run, 'greatsword');
  stampDeck(reg, run);
  assert.equal(surges(run).length, 0, 'swapping to another weapon removes it');
  assert.equal(run.deck.length, authored);
});

test('Core mints only weapon arts from a weapon, never kits or the Dodge Roll (owner 2026-11-01)', () => {
  const run = start('reaver');
  const before = run.deck.filter((c) => !isItemOwned(c)).map((c) => c.cardId).sort();
  equip(run, 'boneSceptre');
  stampDeck(reg, run);
  const after = run.deck.filter((c) => !isItemOwned(c)).map((c) => c.cardId).sort();
  assert.deepEqual(after, before);
  assert.ok(run.deck.every((c) => !isItemOwned(c) || c.cardId === 'core.manaSurge' || c.equipmentRole === 'weaponArt'));
  assert.ok(run.deck.every((c) => !c.kitRole && !String(c.grantedBy || '').startsWith('unarmed:')));
});

test('an older Core save without the card gets it on the next reconcile', () => {
  const run = start('herald');
  run.deck = run.deck.filter((c) => c.cardId !== 'core.manaSurge');
  run.sideboard = [];
  assert.equal(surges(run).length, 0);
  stampDeck(reg, run);
  assert.equal(surges(run).length, 1);
  assert.equal(JSON.parse(JSON.stringify(run)).deck.length, run.deck.length, 'JSON round trip keeps it');
});

// As a cantrip, Mana Surge stays at 1 SP. The sceptre's Focus cancels the spell's MP surcharge.
for (const [intelligencePoints, maxMana] of [[0, 1], [1, 2]]) {
  test(`Mana Surge costs 1 SP and restores Mana up to the Herald's ${maxMana} MP cap`, () => {
    // These 1/2 MP cap examples predate robe-type capacity; the swap/save integration below keeps current gear.
    const historical = legacyGearRegistries(reg);
    const run = createRunState({ registries: historical, classId: 'herald', seed: 511, profileMeta: meta });
    if (intelligencePoints) spendEarnedPoints(historical, run, 'wisdom', intelligencePoints);
    const combat = createRunCombat({ registries: historical, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
    assert.equal(combat.player.maxMana, maxMana);
    const card = [...combat.piles.hand, ...combat.piles.draw, ...combat.piles.discard].find((c) => c.cardId === 'core.manaSurge');
    assert.ok(card, 'Mana Surge reaches the fight piles');
    combat.piles.draw = combat.piles.draw.filter((c) => c !== card);
    combat.piles.discard = combat.piles.discard.filter((c) => c !== card);
    if (!combat.piles.hand.includes(card)) combat.piles.hand.push(card);
    combat.player.mana = 0;
    const sp = combat.player.stamina;
    dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId });
    assert.equal(combat.player.stamina, sp - 1, 'costs 1 SP');
    assert.equal(combat.player.mana, maxMana, 'restores as much of the 2 Mana as the pool can hold');
  });
}

test('a mid-fight swap to a sceptre lends the card to the pile, and away again', async () => {
  const { reconcileGrantedCardsInCombat } = await import('../src/model/loadout.js');
  const run = start('reaver');
  const piles = { hand: [], draw: [], discard: [], exhaust: [] };
  const synthetic = (loadout) => ({ class: 'reaver', loadout, deck: [] });
  equip(run, 'boneSceptre');
  reconcileGrantedCardsInCombat(reg, synthetic(run.loadout), piles);
  assert.equal(piles.discard.filter((c) => c.cardId === 'core.manaSurge').length, 1);
  reconcileGrantedCardsInCombat(reg, synthetic(run.loadout), piles);
  assert.equal(piles.discard.filter((c) => c.cardId === 'core.manaSurge').length, 1, 'idempotent');
  equip(run, 'greatsword');
  reconcileGrantedCardsInCombat(reg, synthetic(run.loadout), piles);
  assert.equal(piles.discard.filter((c) => c.cardId === 'core.manaSurge').length, 0);
  assert.deepEqual(piles.discard.map((c) => c.cardId), ['greatswordSunderingHew'], 'the greatsword lends only its art');
});

test('deck editor shows the granted card with the existing equipment presentation and mints nothing unowned', async () => {
  const { deckEditorModel } = await import('../src/ui/models/DeckEditorModel.js');
  const { unlimitedCardIds, moveToSideboard } = await import('../src/model/deckRules.js');
  const run = start('herald');
  assert.deepEqual(unlimitedCardIds(run), []);
  const model = deckEditorModel({ registries: reg, run });
  const rows = model.deck.filter((r) => r.cardId === 'core.manaSurge');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].source, 'item', 'sourced from the equipped item, like any granted card');
  assert.ok(model.collection.every((r) => !r.unlimited), 'no unowned unlimited tile');
  // Set aside (the existing granted-card door), then reconcile: held aside, not re-minted.
  assert.equal(moveToSideboard(reg, run, rows[0].instanceId), true);
  stampDeck(reg, run);
  assert.equal(surges(run).length, 0);
  assert.equal(run.sideboard.filter((c) => c.cardId === 'core.manaSurge').length, 1);
  // Unequipping while set aside sweeps it from the sideboard too.
  assert.ok(equipPiece(reg, run.loadout, 'rightHand', 0, null, owns, { inCombat: false, attributes: run.attributes }));
  stampDeck(reg, run);
  assert.equal(run.sideboard.filter((c) => c.cardId === 'core.manaSurge').length, 0);
});

test('an unprofiled run with a Bone Sceptre grants no Core card', () => {
  const unprofiled = createRegistries(contentBundle);
  const run = createRunState({ seed: 17, classId: 'starseer', registries: unprofiled });
  assert.equal(run.deck.filter((c) => c.cardId === 'core.manaSurge').length, 0);
  stampDeck(unprofiled, run);
  assert.equal(run.deck.filter((c) => c.cardId === 'core.manaSurge').length, 0);
});

// The shipped setting locks combat equipment; exercise the supported intent
// with that setting enabled, as older/configured saves can do.
function equipmentFight(classId, wisdomPoints = 0) {
  const registries = { ...reg, balance: structuredClone(reg.balance) };
  registries.balance.equipment.allowChangesInCombat = true;
  registries.balance.equipment.swapEndsTurn = false;
  const run = createRunState({ registries, classId, seed: 511, profileMeta: meta });
  if (wisdomPoints) spendEarnedPoints(registries, run, 'wisdom', wisdomPoints);
  if (classId === 'reaver') run.loadout.storage.push('boneSceptre');
  const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  combat.player.stamina = 99;
  combat.swapsLeft = 99;
  return { registries, run, combat };
}
const pileSurges = (combat) => Object.values(combat.piles).flat().filter(card => card.cardId === 'core.manaSurge');

for (const [classId, pieceId, expected] of [['reaver', 'boneSceptre', 1], ['herald', null, 0]]) {
  test(`a Core ${classId} combat equipment change persists Mana Surge ownership through save and the next fight`, () => {
    const { registries, run, combat } = equipmentFight(classId);
    // A removed run-owned card must never be rebuilt from the combat piles.
    const removedId = run.deck.find(card => !isItemOwned(card)).instanceId;
    run.deck = run.deck.filter(card => card.instanceId !== removedId);
    dispatch(combat, { type: 'changeEquipment', slotId: 'rightHand', setIndex: 0, pieceId });
    assert.equal(pileSurges(combat).length, expected);
    const piles = structuredClone(combat.piles);
    commitCombatSnapshot({ run, combat, nodeId: 'n1_4', encounterId: 'patrol' });
    assert.equal(surges(run).length, expected, 'persisted deck agrees with the live loadout');
    assert.ok(!run.deck.some(card => card.instanceId === removedId), 'run-owned removals stay removed');
    assert.deepEqual(combat.piles, piles, 'checkpoint does not reset or move live cards');
    const saves = createSaveManager(createMemoryStorage());
    saves.saveRun(run, combat.rng);
    const loaded = saves.loadRun(registries);
    assert.ok(loaded, JSON.stringify(saves.runStatus()));
    assert.equal(surges(loaded).length, expected);
    const resumed = restoreCombatSnapshot({ registries, rng: createRng(511), expectedGameProfile: loaded.gameProfile, snapshot: loaded.combatEntered.snapshot });
    assert.equal(pileSurges(resumed).length, expected);
    runCombatEnd(loaded, resumed);
    const next = createRunCombat({ registries, run: loaded, rng: createRng(512), enemyIds: ['wanderingSoldier'] });
    assert.equal(pileSurges(next).length, expected, 'the next fight keeps the new ownership');
  });
  test(`ending a Core ${classId} fight reconciles Mana Surge without a checkpoint`, () => {
    const { registries, run, combat } = equipmentFight(classId);
    dispatch(combat, { type: 'changeEquipment', slotId: 'rightHand', setIndex: 0, pieceId });
    runCombatEnd(run, combat);
    assert.equal(run.loadout.sets.rightHand[0], pieceId);
    assert.equal(surges(run).length, expected);
    const saves = createSaveManager(createMemoryStorage());
    saves.saveRun(run, combat.rng);
    assert.ok(saves.loadRun(registries), JSON.stringify(saves.runStatus()));
  });
}

test('Core combat checkpoints preserve a set-aside Mana Surge', async () => {
  const { moveToSideboard } = await import('../src/model/deckRules.js');
  const { registries, run } = equipmentFight('herald');
  assert.equal(moveToSideboard(registries, run, surges(run)[0].instanceId), true);
  const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  commitCombatSnapshot({ run, combat, nodeId: 'n1_4', encounterId: 'patrol' });
  assert.equal(surges(run).length, 0);
  assert.equal(run.sideboard.filter(card => card.cardId === 'core.manaSurge').length, 1);
  assert.equal(pileSurges(combat).length, 0);
});

// Mana's first increase is at max(INT, WIS) 4. Bone Sceptre takes the fresh Reaver to INT 3 and raises Draw.
// The pool test starts at WIS 3 so the Blight Rod's +1 WIS crosses the Mana threshold.
const POOL_PIECE = 'blightRod';
test('Core changeEquipment: the Bone Sceptre intelligence leaves Draw at 5 (INT 3 is under 4) and moves no pool', () => {
  const { combat, run } = equipmentFight('reaver');
  const p = combat.player;
  const before = { maxHp: p.maxHp, maxMana: p.maxMana, maxStamina: p.maxStamina, draw: run.drawPerTurn };
  dispatch(combat, { type: 'changeEquipment', slotId: 'rightHand', setIndex: 0, pieceId: 'boneSceptre' });
  assert.equal(p.drawPerTurn, before.draw, 'Draw is 5 + floor(INT / 4) (owner, 2026-11-18): the sceptre takes INT to 3, short of the 4 that buys a card');
  assert.deepEqual([p.maxHp, p.maxMana, p.maxStamina], [before.maxHp, before.maxMana, before.maxStamina], 'a sceptre moves no pool');
});
for (const intent of ['changeEquipment', 'swapArmament']) {
  test(`Core ${intent} preserves missing pools across repeated staff swaps and saves valid stats`, () => {
    const { registries, run, combat } = equipmentFight('reaver', 2);
    registries.balance.equipment.swapCostKind = 'allowance';
    if (intent === 'swapArmament') {
      combat.loadout.sets.rightHand[1] = POOL_PIECE;
    } else {
      combat.loadout.storage.push(POOL_PIECE);
    }
    const p = combat.player;
    const before = { maxHp: p.maxHp, maxMana: p.maxMana, maxStamina: p.maxStamina, draw: run.drawPerTurn };
    p.hp = 1; p.mana = 0; p.stamina = 0;
    const missing = { hp: p.maxHp - 1, mana: p.maxMana, stamina: p.maxStamina };
    for (let cycle = 0; cycle < 3; cycle++) {
      for (const sceptre of [true, false]) {
        dispatch(combat, intent === 'swapArmament'
          ? { type: intent, slotId: 'rightHand', setIndex: sceptre ? 1 : 0 }
          : { type: intent, slotId: 'rightHand', setIndex: 0, pieceId: sceptre ? POOL_PIECE : 'greatsword' });
        // Owner, 2026-11-20 (docs/balance/owner-ruling-2026-11-18.md §25): the Blight Rod's raw +1 max MP is a legacy item line (no signature) and its Wisdom point already
        // feeds Mana, so it is dropped: the rod adds one MP through WIS only.
        assert.equal(p.maxMana, before.maxMana + (sceptre ? 1 : 0), 'the rod adds one MP through WIS; its raw maxMana line is not counted again');
        assert.equal(p.drawPerTurn, before.draw, 'the rod carries no intelligence, so Draw holds');
        for (const field of ['hp', 'mana', 'stamina']) {
          const max = p[`max${field[0].toUpperCase()}${field.slice(1)}`];
          assert.equal(p[field], Math.max(0, max - missing[field]), `${field} never refills a spent deficit`);
          assert.ok(p[field] <= max, `${field} stays inside its pool`);
          if (!sceptre) assert.equal(max, before[`max${field[0].toUpperCase()}${field.slice(1)}`], `${field} returns to its starting maximum`);
        }
        assert.equal(p.energyMax, p.maxStamina);
        assert.equal(p.combatTraits, undefined, 'a Core swap leaves the legacy expansion equipment projection off, as combat creation does');
        commitCombatSnapshot({ run, combat, nodeId: 'n1_4', encounterId: 'patrol' });
        // §25 (2026-11-20): the rod's raw +1 is dropped, so nothing persists as an equipment bonus; the WIS-derived increase is never persisted either.
        assert.equal(run.equipmentPoolBonuses.maxMana, 0, 'no raw equipment MP persists, and never the WIS-derived increase');
        const saves = createSaveManager(createMemoryStorage());
        saves.saveRun(run, combat.rng);
        assert.ok(saves.loadRun(registries), JSON.stringify(saves.runStatus()));
      }
    }
    dispatch(combat, intent === 'swapArmament'
      ? { type: intent, slotId: 'rightHand', setIndex: 1 }
      : { type: intent, slotId: 'rightHand', setIndex: 0, pieceId: POOL_PIECE });
    combat.result = 'victory';
    runCombatEnd(run, combat);
    run.combatEntered = null; // The finished-fight transition clears its resume point.
    assert.equal(run.equipmentPoolBonuses.maxMana, 1, 'the combat-end door persists the same raw pool bonus');
    const saves = createSaveManager(createMemoryStorage());
    saves.saveRun(run, combat.rng);
    assert.ok(saves.loadRun(registries), JSON.stringify(saves.runStatus()));
  });
}

test('the rendered Mana Surge deck row shows the same zero Mana cost as live play', async () => {
  const { mountDeckEditor } = await import('../src/ui/screens/deckEditor.js');
  const { deckEditorModel } = await import('../src/ui/models/DeckEditorModel.js');
  const { withModalDom } = await import('./helpers/dom.mjs');
  const run = start('herald');
  const card = surges(run)[0];
  const model = deckEditorModel({ registries: reg, run });
  const row = model.deck.find(row => row.instanceId === card.instanceId);
  assert.equal(resolveCard(reg, row.ref).manaCost, 0, 'configured resourceCosts remain authoritative');
  withModalDom(({ document }) => {
    const previousElement = globalThis.HTMLElement;
    globalThis.HTMLElement = document.body.constructor;
    let editor;
    try {
      editor = mountDeckEditor(document.body, { registries: reg, run });
      const rendered = editor.root.querySelector(`[data-instance-id="${card.instanceId}"].deck-editor-row`);
      assert.ok(rendered);
      const value = resource => rendered.querySelector(`.resource-${resource} .deck-editor-resource-value`).textContent;
      assert.equal(value('mana'), '0');
      assert.equal(value('stamina'), '1');
    } finally {
      editor?.close();
      if (previousElement === undefined) delete globalThis.HTMLElement;
      else globalThis.HTMLElement = previousElement;
    }
  });
});

test('all configured cards retain their explicit authored Mana cost when resolved for presentation', () => {
  let checked = 0;
  for (const definition of profile.content.cards) {
    const card = projectGameCard(reg, definition.id);
    assert.ok(card.resourceCosts, definition.id);
    checked++;
    assert.equal(resolveCard(reg, { cardId: card.id }).manaCost || 0, card.resourceCosts.mp, card.id);
  }
  assert.ok(checked > 0, 'the configured registry schema strips resourceCosts; project from the profile');
});
