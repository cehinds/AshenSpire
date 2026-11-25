// W25 step 3, owner 2026-11-23: upgrade slots (the rank the face shows + 1; the weapon's Smith level no longer adds) and the rest-site odds (1 option up to the 3rd upgrade, then 2 options of 1 or 2 effects at 80 / 20).
import test from 'node:test';
import assert from 'node:assert/strict';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { createRunState } from '../src/model/state.js';
import { UpgradeSlots, UpgradeWeaponId, WeaponSmithLevel, canUpgrade, RestUpgradeRule, nextUpgradeOptions } from '../src/model/cardUpgradeLimits.js';
import { PlanRestCardUpgrade, planCardUpgrade, commitCardUpgrade } from '../src/model/cardUpgradeService.js';
import { upgradeStepsProblems, applyUpgradeSteps } from '../src/model/cardUpgrade.js';
import { cardUpgradeModel } from '../src/ui/models/CardUpgradeModel.js';
import { playingCardModel } from '../src/model/playingCard.js';

const newRun = (seed = 504) => createRunState({ registries, classId: 'reaver', seed, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
const strike = (run) => run.deck.find((c) => c.cardId === 'core.strike');

test(`slots = the face rank + 1: no badge 1, "Rank 1" 2, "Rank 4" 5 (the owner's three examples)`, () => {
  const run = newRun();
  const card = strike(run);
  const badge = (ref) => playingCardModel(registries, ref).rankBadge;
  assert.equal(card.rank, undefined, 'a starter Strike is unranked');
  assert.equal(badge(card), null, 'and its face shows no rank badge');
  assert.equal(UpgradeSlots(run, card), 1, 'no badge: 1 upgrade');
  card.rank = 1;
  assert.equal(badge(card), 'Rank 1');
  assert.equal(UpgradeSlots(run, card), 2, '"Rank 1": 2 upgrades');
  card.rank = 4;
  assert.equal(badge(card), 'Rank 4');
  assert.equal(UpgradeSlots(run, card), 5, '"Rank 4": 5 upgrades');
  card.rank = 99;
  assert.equal(UpgradeSlots(run, card), 10, 'never past the 10-upgrade cap');
});

test(`the weapon's Smith level no longer adds card slots`, () => {
  const run = newRun();
  const card = strike(run);
  assert.equal(UpgradeWeaponId(run, card), 'greatsword', 'a class card still belongs to the equipped main weapon');
  run.itemUpgradeLevels = { 'armament/greatsword': 3 };
  assert.equal(WeaponSmithLevel(run, card), 3);
  assert.equal(UpgradeSlots(run, card), 1);
  card.rank = 2;
  assert.equal(UpgradeSlots(run, { ...card, sourceArmamentId: 'dagger' }), 3, `a weapon card's own weapon adds nothing either`);
});

test('a card with every slot used is refused with the slots code, and a higher rank opens the next', () => {
  const run = newRun(); run.smithingStones = 50;
  const card = strike(run);
  card.rank = 1;
  for (let i = 0; i < 2; i += 1) commitCardUpgrade(run, registries, planCardUpgrade(run, registries, card.instanceId));
  const verdict = canUpgrade(registries, run, card);
  assert.deepEqual([verdict.ok, verdict.code], [false, 'slots']);
  assert.match(verdict.reason, /2 upgrade slots/);
  run.itemUpgradeLevels = { 'armament/greatsword': 1 };
  assert.equal(canUpgrade(registries, run, card).ok, false, 'smithing the weapon opens nothing');
  card.rank = 2;
  assert.equal(canUpgrade(registries, run, card).ok, true);
});

test('the rest rule: one option up to the third upgrade, two from the fourth', () => {
  const upgraded = (n) => ({ instanceId: 'x', cardId: 'core.strike', upgraded: n > 0, upgradeSteps: Array.from({ length: n }, () => ({ k: 'dmg', n: 1 })) });
  for (const n of [0, 1, 2]) assert.deepEqual(RestUpgradeRule(upgraded(n)), { choices: 1, combos: false }, `upgrade ${n + 1}`);
  for (const n of [3, 4, 5, 8]) assert.deepEqual(RestUpgradeRule(upgraded(n)), { choices: 2, combos: true }, `upgrade ${n + 1}`);
});

test('rest quotes: 1 option for upgrades 1-3 and 2 for the 4th; the picker model and a commit agree', () => {
  const run = newRun(); run.smithingStones = 50;
  const card = strike(run);
  card.rank = 9; // ten slots (rank + 1)
  const optionsOf = () => cardUpgradeModel(registries, run, card.instanceId).rows.find((r) => r.instanceIds.includes(card.instanceId)).options;
  for (let n = 1; n <= 3; n += 1) {
    assert.equal(optionsOf().length, 1, `upgrade ${n}`);
    assert.equal(PlanRestCardUpgrade(run, registries, card.instanceId).options, undefined);
    commitCardUpgrade(run, registries, PlanRestCardUpgrade(run, registries, card.instanceId));
  }
  assert.equal(optionsOf().length, 2, 'the 4th upgrade');
  const quote = PlanRestCardUpgrade(run, registries, card.instanceId);
  assert.equal(quote.options.length, 2);
  const second = { ...quote, step: quote.options[1].step };
  const done = commitCardUpgrade(run, registries, second);
  assert.deepEqual(done.step, quote.options[1].step);
  assert.deepEqual(upgradeStepsProblems(card, 'deck'), []);
});

function restComboSample(base, count) {
  const lead = [{ k: 'dmg', n: 1 }, { k: 'fx', fx: 'draw', n: 1 }, { k: 'fx', fx: 'block', n: 4 }];
  const instance = { instanceId: 'odds', cardId: 'core.strike', rank: 3, upgraded: true, upgradeSteps: lead };
  let options = 0, combos = 0, shortLists = 0;
  for (let seed = 1; seed <= count; seed += 1) {
    const run = { seed, level: { level: 4 }, gameProfile: registries.gameProfile, rangePolicy: {} };
    const list = nextUpgradeOptions(run, instance, base, registries, 2, { combos: true });
    if (list.length < 2) shortLists += 1;
    for (const step of list) { options += 1; if (step.k === 'combo') combos += 1; }
  }
  return { shortLists, share: combos / options };
}

test('over 10000 seeded rolls an option from the 4th upgrade carries two effects about 20% of the time, and never before', () => {
  const base = registries.cards.get('core.strike');
  // Use a four-family menu to keep CP gating and valid partners, without
  // rescoring the whole Strike menu for every statistical draw.
  const oddsCard = { ...base, upgradeMenu: ['dmg', 'cost', 'fx:shuffle', 'fx:retain'] };
  const { shortLists, share } = restComboSample(oddsCard, 10000);
  assert.equal(shortLists, 0);
  assert.ok(share > 0.17 && share < 0.23, `two-effect share ${share}`);
  const early = nextUpgradeOptions({ seed: 5, gameProfile: registries.gameProfile }, { instanceId: 'e', cardId: 'core.strike', upgraded: false }, base, registries, 1, {});
  assert.equal(early.length, 1);
  assert.notEqual(early[0].k, 'combo');
});

test('the full Strike menu offers both single and two-effect upgrades at eligible CP', () => {
  const { shortLists, share } = restComboSample(registries.cards.get('core.strike'), 200);
  assert.equal(shortLists, 0);
  assert.ok(share > 0.1 && share < 0.3, `two-effect share ${share}`);
});

test('a combo step resolves to a card with both effects', () => {
  const base = registries.cards.get('core.strike');
  const combo = { k: 'combo', steps: [{ k: 'fx', fx: 'block', n: 4 }, { k: 'fx', fx: 'draw', n: 1 }] };
  const face = applyUpgradeSteps(base, [combo]);
  assert.ok(face.effects.some((e) => e.op === 'block') && face.effects.some((e) => e.op === 'draw'));
});
