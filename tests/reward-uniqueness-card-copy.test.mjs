// Owner 2026-11-20: rewards never offer a relic or a card the player already owns (one copy each); a copy relic and some
// vendors' copy service are the only ways to a second copy of a card.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState, validateRunShape } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { gameProfileRewardOffers, GameProfileEliteRelicOffer, gameProfileShopStock, claimGameProfileReward, purchaseGameProfileShopOffer, gameProfileShopPurchasePlan } from '../src/model/gameProfileRewards.js';
import { CardCopyCandidates, StartCardCopyOffer, GrantRelicCardCopies, CARD_COPY_OPTION, CardCopyShelf } from '../src/model/cardCopyService.js';
import '../src/engine/runCombat.js';

const profile = resolveGameProfile(JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url))));
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const fresh = (seed) => createRunState({ seed, classId: 'reaver', registries: reg, runId: `unique-${seed}` });
const ownedIds = (run) => new Set([...run.deck, ...run.sideboard].map((card) => card.cardId));

test('combat, level and shop offers never list a card the player owns (deck or library)', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const run = fresh(seed);
    // Put a few offerable cards in the library so the library counts as owned too.
    const probe = gameProfileRewardOffers(reg, structuredClone(run), createRng(seed), { offerId: 'probe' }).options.filter((o) => o.kind === 'combatCards');
    probe.forEach((o, k) => run.sideboard.push({ instanceId: `lib:${k}`, cardId: o.id, upgraded: false }));
    const owned = ownedIds(run);
    const offers = [
      gameProfileRewardOffers(reg, run, createRng(seed), { offerId: 'c' }),
      gameProfileRewardOffers(reg, run, createRng(seed), { offerId: 'l', source: 'level' }),
      gameProfileShopStock(reg, run, createRng(seed), { shopId: `s${seed}` }),
    ];
    for (const offer of offers) for (const o of offer.options) {
      if (['combatCards', 'weaponArts'].includes(o.kind)) assert.ok(!owned.has(o.id), `seed ${seed} ${offer.id}: owned ${o.id} offered`);
    }
  }
});

test('relic offers never list a relic the player owns, and an owned relic cannot be claimed twice', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const run = fresh(seed);
    const first = GameProfileEliteRelicOffer(reg, structuredClone(run), createRng(seed), { offerId: 'probe' });
    run.relics.push(first.options[0].id);
    for (const offer of [GameProfileEliteRelicOffer(reg, run, createRng(seed), { offerId: 'e' }), gameProfileRewardOffers(reg, run, createRng(seed), { offerId: 't', source: 'treasure' })]) {
      for (const o of offer?.options || []) if (o.kind === 'relics') assert.ok(!run.relics.includes(o.id), `seed ${seed}: owned relic ${o.id} offered`);
    }
  }
  const run = fresh(3);
  run.relics.push('scribesMirror');
  run.gameProfileRewardOffers = { old: { id: 'old', source: 'treasure', options: [{ kind: 'relics', id: 'scribesMirror' }], takeCount: 1, taken: [], claimed: null } };
  assert.throws(() => claimGameProfileReward(reg, run, 'old', 0), /already owned|unavailable/);
  assert.equal(run.relics.filter((id) => id === 'scribesMirror').length, 1);
});

test('Scribe\'s Mirror opens one copy door listing every owned card, once', () => {
  const run = fresh(5);
  run.gameProfileRewardOffers = { r: { id: 'r', source: 'treasure', options: [{ kind: 'relics', id: 'scribesMirror' }], takeCount: 1, taken: [], claimed: null } };
  claimGameProfileReward(reg, run, 'r', 0);
  assert.equal(run.pendingCardCopies, 1);
  const offerId = StartCardCopyOffer(reg, run);
  assert.ok(offerId);
  assert.equal(run.pendingCardCopies, undefined, 'the one chance is spent');
  assert.equal(StartCardCopyOffer(reg, run), '', 'a second door never opens');
  const door = run.gameProfileRewardOffers[offerId];
  assert.equal(door.options.length, CardCopyCandidates(reg, run).length);
  assert.deepEqual(new Set(door.options.map((o) => o.id)), new Set(CardCopyCandidates(reg, run).map((c) => c.cardId)));
  const before = run.sideboard.length, pick = door.options[0];
  claimGameProfileReward(reg, run, offerId, 0);
  assert.equal(run.sideboard.length, before + 1);
  assert.equal(run.sideboard.at(-1).cardId, pick.id);
  assert.throws(() => claimGameProfileReward(reg, run, offerId, 1), /already claimed/);
  // An event that hands the relic over queues the same one door.
  const other = fresh(6);
  GrantRelicCardCopies(reg, other, 'scribesMirror');
  assert.equal(other.pendingCardCopies, 1);
});

test('a trader copy shelf sells its uses, then is sold out', () => {
  const run = fresh(9);
  run.cinders = 100000;
  const stock = gameProfileShopStock(reg, run, createRng(9), { shopId: 'copy' });
  stock.options.push({ ...CardCopyShelf(run, 'trader'), usesLeft: 2 }); stock.takeCount += 1;
  const index = stock.options.length - 1;
  const target = run.deck[0].instanceId, before = run.sideboard.length;
  for (let use = 0; use < 2; use++) {
    const quote = gameProfileShopPurchasePlan(reg, run, 'copy', index);
    assert.ok(quote.ok, quote.reason);
    const receipt = purchaseGameProfileShopOffer(reg, run, 'copy', index, createRng(1), { ...quote, instanceId: target });
    assert.equal(receipt.kind, CARD_COPY_OPTION.kind);
  }
  assert.equal(run.sideboard.length, before + 2);
  assert.equal(gameProfileShopPurchasePlan(reg, run, 'copy', index).ok, false);
});

test('a save made before the copy service loads unchanged; a bad copy count is refused', () => {
  const run = fresh(11);
  delete run.pendingCardCopies;
  assert.deepEqual(validateRunShape(run).filter((p) => /pendingCardCopies/.test(p)), []);
  run.pendingCardCopies = -1;
  assert.ok(validateRunShape(run).some((p) => /pendingCardCopies/.test(p)));
});

test('a Blacksmith copy shelf copies the chosen card, spends a use per copy, refuses a stale quote, then runs out', async () => {
  const { cardCopyPlan, commitCardCopy } = await import('../src/model/blacksmith.js');
  const { buildBlacksmithStock } = await import('../src/engine/shopKinds.js');
  const run = fresh(13);
  run.cinders = 5000; run.smithingStones = 5;
  run.shopStock = buildBlacksmithStock(reg, createRng(13), run);
  if (!run.shopStock.offerings.includes('cardCopy')) run.shopStock.offerings.push('cardCopy');
  run.shopStock.cardCopy = { cost: 140, usesLeft: 2 };
  const target = run.deck[0];
  const first = cardCopyPlan(reg, run, target.instanceId);
  assert.ok(first.ok, first.reason);
  const receipt = commitCardCopy(reg, run, first);
  assert.equal(receipt.id, target.cardId);
  assert.equal(run.sideboard.at(-1).instanceId, receipt.instanceId);
  assert.equal(run.cinders, 5000 - 140);
  assert.throws(() => commitCardCopy(reg, run, first), /changed|stale|again/i, 'the first quote is stale once the shelf moved');
  commitCardCopy(reg, run, cardCopyPlan(reg, run, target.instanceId));
  assert.equal(run.shopStock.cardCopy.usesLeft, 0);
  assert.equal(cardCopyPlan(reg, run, target.instanceId).ok, false, 'no uses left');
});
