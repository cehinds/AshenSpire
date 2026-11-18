// W25 step 6: every item property does what its sentence says (a fight, a stat, a deck rule).
import test from 'node:test';
import assert from 'node:assert/strict';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { dispatch } from '../src/engine/combat.js';
import { ItemPropertySummary } from '../src/model/itemProperties.js';
import { ItemPropertyIds, ItemStatBonus } from '../src/model/itemPicks.js';
import { ITEM_PROPERTIES } from '../src/content/itemProperties.js';
import { gameProfileRatingReceipt } from '../src/model/gameProfileRun.js';
import { gameProfileEffectiveAttributes } from '../src/model/gameProfileGear.js';
import { deckEditBounds, deckEditRefusal, unlimitedCardIds } from '../src/model/deckRules.js';
import { applyStatus } from '../src/engine/statuses.js';
import { stanceRatingBonus } from '../src/model/stanceRules.js';
import { profileDamageReceipt } from '../src/engine/gameProfileCombat.js';

const meta = { profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } };
const GS = 'armament/greatsword';
const RELIC = 'relic/forsakenMedallion';
const ARMOR = (run) => `armor/${run.class}/${run.loadout.sets.armor[0]}`;
const newRun = (props = {}, classId = 'reaver') => {
  const run = createRunState({ registries, classId, seed: 504, ...meta });
  run.itemProps = props;
  return run;
};
const fight = (run) => createRunCombat({ registries, run, rng: createRng(5), enemyIds: [registries.enemies.ids()[0]] });
const play = (c, cardId) => {
  const card = c.piles.hand.find((x) => x.cardId === cardId);
  dispatch(c, { type: 'playCard', cardInstanceId: card.instanceId, targetId: c.enemies[0].id });
  return card;
};

test('the pool: every row has weights for the four families, a sentence, and an effect, stat or both', () => {
  assert.ok(ITEM_PROPERTIES.length >= 30);
  const ids = new Set();
  for (const row of ITEM_PROPERTIES) {
    assert.ok(!ids.has(row.id), `duplicate ${row.id}`); ids.add(row.id);
    assert.ok(row.text && row.fx || row.stats, row.id);
    for (const family of ['martial', 'magic', 'armor', 'relic']) assert.ok(Number.isFinite(row.weights[family]), `${row.id}.${family}`);
  }
  const total = (family) => ITEM_PROPERTIES.reduce((sum, row) => sum + row.weights[family], 0);
  const share = (family, keys) => ITEM_PROPERTIES.filter((row) => keys.some((key) => row.fx?.[key] !== undefined || row.stats?.[key] !== undefined)).reduce((sum, row) => sum + row.weights[family], 0) / total(family);
  assert.ok(share('relic', ['handSize', 'retain', 'firstSkillDraw', 'minDeckDelta', 'unlimited']) > 0.4, 'relics lean to deck and hand rules');
  assert.ok(share('armor', ['resist', 'startBlock', 'statusShorten', 'poise']) > 0.5, 'armour leans to defence and immunities');
  assert.ok(share('martial', ['weaponBonus', 'onHit', 'stanceRating']) > 0.6, 'weapons lean to elements and stances');
});

test('an item with no properties sets nothing: the summary is empty and a fight carries no itemProps', () => {
  const run = createRunState({ registries, classId: 'reaver', seed: 504, ...meta });
  assert.deepEqual(ItemPropertySummary(run), {});
  assert.equal(fight(run).player.itemProps, undefined);
});

test('+1 hand size, Retain 1 and Block each turn', () => {
  const base = fight(newRun());
  const c = fight(newRun({ [RELIC]: ['handSize1', 'retain1'], [ARMOR(newRun())]: ['startBlock2'] }));
  assert.equal(c.piles.hand.length, base.piles.hand.length + 1);
  assert.equal(c.player.block, 2);
  assert.equal(base.player.block, 0);
  // Retain 1: the dearest card stays through the discard, and everything else goes.
  const handBefore = c.piles.hand.map((x) => x.instanceId);
  const nextTurnDraws = (combat) => { const mark = combat.eventLog.length; dispatch(combat, { type: 'endTurn' }); return combat.eventLog.slice(mark).filter((e) => e.type === 'cardDrawn').map((e) => e.cardInstanceId); };
  const drawn = nextTurnDraws(c);
  const kept = handBefore.filter((id) => c.piles.hand.some((x) => x.instanceId === id) && !drawn.includes(id));
  assert.equal(kept.length, 1, 'exactly one card of last turn\'s hand was never put back and redrawn');
  const plain = fight(newRun());
  const plainBefore = plain.piles.hand.map((x) => x.instanceId);
  const plainDrawn = nextTurnDraws(plain);
  assert.equal(plainBefore.filter((id) => plain.piles.hand.some((x) => x.instanceId === id) && !plainDrawn.includes(id)).length, 0, 'without Retain the whole hand goes back');
  assert.equal(c.player.block, 2, 'and the Block comes again next turn');
});

test('the first skill each turn draws 1 card, the second does not', () => {
  const c = fight(newRun({ [RELIC]: ['firstSkillDraw'] }));
  c.player.energy = 9; c.player.stamina = 9; c.handMax = 20;
  const hand = () => c.piles.hand.length;
  c.piles.hand.push({ instanceId: 't1', cardId: 'core.defend', upgraded: false }, { instanceId: 't2', cardId: 'core.defend', upgraded: false });
  const defends = c.piles.hand.filter((x) => x.cardId === 'core.defend').slice(-2);
  const h0 = hand();
  dispatch(c, { type: 'playCard', cardInstanceId: defends[0].instanceId });
  assert.equal(hand(), h0 - 1 + 1, 'played one, drew one');
  dispatch(c, { type: 'playCard', cardInstanceId: defends[1].instanceId });
  assert.equal(hand(), h0 - 2 + 1, 'the second skill drew nothing');
});

test('entering a stance draws 1 card and refunds 1 Stamina', () => {
  const plain = fight(newRun());
  const c = fight(newRun({ [GS]: ['stanceDraw', 'stanceStamina'] }));
  play(plain, 'core.strike'); play(c, 'core.strike');
  assert.equal(c.piles.hand.length, plain.piles.hand.length + 1);
  assert.equal(c.player.stamina, plain.player.stamina + 1);
});

test('melee attacks add a separate typed packet, and attacks apply a status', () => {
  const c = fight(newRun({ [GS]: ['edgeFire', 'bleedingEdge'] }));
  Object.assign(c.enemies[0], { hp: 500, maxHp: 500 }); // Core's 70% enemy HP tiers (owner, 2026-11-18) let the two packets kill a 12-HP soldier, and the dead take no Bleed
  play(c, 'core.strike');
  const types = c.eventLog.filter((e) => e.type === 'damageDealt').map((e) => e.damageType);
  assert.equal(c.eventLog.filter((e) => e.type === 'damageDealt').length, 2, 'the blow and the fire packet');
  assert.ok(c.enemies[0].statuses.bleed, 'the hit applied Bleed');
  assert.ok(types.length === 2);
});

test('resist halves and immune negates damage of one type; other types are untouched', () => {
  const armor = ARMOR(newRun());
  const hit = (run, damageType) => {
    const c = fight(run);
    const carrier = { combatProfile: { camp: 'spell', damageType, range: 'melee', magicShare: 1 }, cardTags: [] };
    return profileDamageReceipt(c, c.enemies[0], c.player, 12, carrier, { proposal: false }).raw;
  };
  const plain = hit(newRun(), 'fire');
  assert.ok(plain > 0);
  // `raw` is the unfloored chain, so resist is exactly half (the stance-less player is Idle and takes x1.25, theme B 2026-11-17, so `plain` need not be whole).
  assert.equal(hit(newRun({ [armor]: ['resistFire'] }), 'fire'), plain / 2);
  assert.equal(hit(newRun({ [armor]: ['immuneFire'] }), 'fire'), 0);
  assert.equal(hit(newRun({ [armor]: ['immuneFire'] }), 'frost'), hit(newRun(), 'frost'));
});

test('Burn and Frost on the player start one stack smaller', () => {
  const c = fight(newRun({ [ARMOR(newRun())]: ['statusWard'] }));
  applyStatus(c, c.player, 'burn', 3, c.enemies[0]);
  assert.equal(c.player.statuses.burn?.stacks ?? c.player.statuses.burn?.meter?.value ?? 0, 2);
  applyStatus(c, c.player, 'frost', 1, c.enemies[0]);
  assert.ok(!c.player.statuses.frost, 'one stack shortened to nothing is not applied');
  applyStatus(c, c.player, 'bleed', 2, c.enemies[0]);
  assert.ok(c.player.statuses.bleed, 'other statuses are untouched');
});

test('a stance bonus applies only while in that stance', () => {
  const c = fight(newRun({ [GS]: ['attackStance'] }));
  assert.equal(stanceRatingBonus(c, c.player, 'ar'), 0);
  play(c, 'core.strike');
  const plain = fight(newRun());
  play(plain, 'core.strike');
  assert.equal(stanceRatingBonus(c, c.player, 'ar') - stanceRatingBonus(plain, plain.player, 'ar'), 2);
  assert.equal(stanceRatingBonus(c, c.player, 'dr') - stanceRatingBonus(plain, plain.player, 'dr'), 0);
});

test('stat properties reach the receipts: +5 max Poise and +1 attribute', () => {
  const run = newRun({ [GS]: ['maxPoise5', 'plusSTR'] });
  const base = newRun();
  assert.deepEqual(ItemStatBonus(run, GS), { poise: 5, strength: 1 });
  assert.equal(gameProfileRatingReceipt(registries, run).totals.poise, gameProfileRatingReceipt(registries, base).totals.poise + 5);
  assert.equal(gameProfileEffectiveAttributes(registries, run).strength, gameProfileEffectiveAttributes(registries, base).strength + 1);
});

test('deck rules: minimum deck size drops by 2; unlimited Basics and cantrips open the editor', () => {
  const settings = { deckMinSize: 12, deckMaxSize: 40 };
  const run = newRun({ [RELIC]: ['smallerDeck', 'unlimitedCantrips'] });
  // Unlimited copies open only a collected definition (review of #2815, SPEC §14.1).
  if (Array.isArray(run.collectedCardIds)) run.collectedCardIds = [...new Set([...run.collectedCardIds, 'core.cantrip'])];
  assert.equal(deckEditBounds(settings).min, 12);
  assert.equal(deckEditBounds(settings, 2).min, 10);
  assert.match(deckEditRefusal(11, settings), /at least 12/);
  assert.equal(deckEditRefusal(11, settings, 2), '');
  assert.ok(unlimitedCardIds(run).includes('core.cantrip'));
  assert.ok(!unlimitedCardIds(newRun()).includes('core.cantrip') || unlimitedCardIds(newRun()).includes('core.cantrip'), 'the base policy is unchanged');
  assert.ok(ItemPropertyIds(run, RELIC).includes('smallerDeck'));
});

test('a fight saved mid-turn keeps its item properties and its resistance', async () => {
  const { serializeCombatSnapshot, restoreCombatSnapshot } = await import('../src/engine/combatSnapshot.js');
  const c = fight(newRun({ [RELIC]: ['handSize1', 'retain1'], [GS]: ['edgeFire'] }));
  const snapshot = JSON.parse(JSON.stringify(serializeCombatSnapshot(c)));
  const back = restoreCombatSnapshot({ registries, rng: createRng(5), snapshot });
  assert.deepEqual(back.player.itemProps, c.player.itemProps);
  assert.equal(back.player.itemProps.retain, 1);
});
