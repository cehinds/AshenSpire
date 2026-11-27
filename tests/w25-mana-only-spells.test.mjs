// Mana-only membership and balance are authored data. Small explicit spells
// below protect the cost exemption, payment and flux mechanics.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries, projectGameCard } from '../src/model/gameProfile.js';
import { cardPlayCosts, dispatch } from '../src/engine/combat.js';
import { w25Fight } from './helpers/w25-rules-contract.mjs';

const read = path => JSON.parse(readFileSync(new URL('../' + path, import.meta.url), 'utf8'));
const source = read('games/ashenspire/packs/core/cards.json');
const variants = read('games/ashenspire/packs/core/resourceVariants.json');
const author = read('games/ashenspire/game.json');
const marked = source.filter(card => card.tags.includes('cost.manaOnly'));

test('current mana-only definitions and every resource variant reach runtime at base and upgraded grades', () => {
  for (const include of [[], ['sp'], ['mp'], ['sp', 'mp']]) {
    const profile = resolveGameProfile({ ...author, modules: { ...author.modules, resources: { include } } });
    const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
    const key = include.join(',') || 'none';
    for (const row of marked) {
      const installed = profile.content.cards.find(card => card.id === row.id);
      for (const field of ['class', 'rarity', 'tags', 'effects', 'upgrade']) assert.deepEqual(installed[field], row[field], row.id + '.' + field);
      assert.deepEqual(profile.content.resourceVariants[row.id], variants[row.id], row.id + ' resource variants');
      const alternate = variants[row.id]?.[key] || {};
      const chosen = { ...row, ...alternate };
      const projection = projectGameCard(profile, row.id);
      assert.equal(projection.cost, chosen.cost, row.id + ' SP');
      assert.equal(projection.manaCost || 0, chosen.manaCost || 0, row.id + ' MP');
      for (const upgraded of [false, true]) {
        const ref = { cardId: row.id, upgraded };
        const expected = projectGameCard(profile, ref), actual = resolveCard(reg, ref);
        for (const field of ['cost', 'manaCost', 'effects', 'keywords']) assert.deepEqual(actual[field], expected[field], row.id + '/' + upgraded + '/' + field);
      }
    }
  }
});

function held(combat, cardId, instanceId) {
  const ref = Object.values(combat.piles).flat().find(card => card.cardId === cardId && (!instanceId || card.instanceId === instanceId));
  assert.ok(ref, cardId);
  for (const pile of Object.values(combat.piles)) { const at = pile.indexOf(ref); if (at >= 0) pile.splice(at, 1); }
  combat.piles.hand.push(ref);
  return ref;
}

test('a marked spell pays zero SP with plain, Prepared and Focus quotes, and the actual play pays that quote', () => {
  for (const focus of [false, true]) for (const prepared of [false, true]) {
    const { combat, enemy } = w25Fight({ focus, prepared });
    const card = held(combat, 'fixture.fire'), quote = cardPlayCosts(combat, card.instanceId);
    assert.deepEqual([quote.energy, quote.stamina, quote.mana], [0, 0, focus ? 1 : 2]);
    const before = { energy: combat.player.energy, stamina: combat.player.stamina, mana: combat.player.mana };
    const out = dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: enemy.id });
    const paid = out.events.find(event => event.type === 'cardPlayed');
    assert.deepEqual([paid.energySpent, paid.staminaSpent, paid.manaSpent], [quote.energy, quote.stamina, quote.mana]);
    assert.deepEqual([combat.player.energy, combat.player.stamina, combat.player.mana], [before.energy, before.stamina, before.mana - quote.mana]);
  }
});

test('unmarked spells follow the saved surcharge and a fight without manaOnlyTag has no exemption', () => {
  const { combat } = w25Fight();
  const unmarked = held(combat, 'fixture.unmarked');
  combat.fixCoreRules.spellCosts.staminaSurcharge = 0;
  assert.deepEqual(cardPlayCosts(combat, unmarked.instanceId), { energy: 0, stamina: 0, mana: 2 });
  combat.fixCoreRules.spellCosts.staminaSurcharge = 1;
  assert.deepEqual(cardPlayCosts(combat, unmarked.instanceId), { energy: 1, stamina: 1, mana: 2 });
  const marked = held(combat, 'fixture.fire');
  assert.equal(cardPlayCosts(combat, marked.instanceId).stamina, 0);
  delete combat.fixCoreRules.spellCosts.manaOnlyTag;
  assert.equal(cardPlayCosts(combat, marked.instanceId).stamina, 1);
  delete combat.fixCoreRules.spellCosts;
  assert.deepEqual(cardPlayCosts(combat, marked.instanceId), { energy: 0, stamina: 0, mana: 1 }, 'a pre-rule fight keeps its printed price');
});

test('same-element flux starts after the first cast and scales the next cast without changing its quoted payment', () => {
  const { combat, enemy } = w25Fight();
  const first = held(combat, 'fixture.fire');
  const firstOut = dispatch(combat, { type: 'playCard', cardInstanceId: first.instanceId, targetId: enemy.id });
  const firstHit = firstOut.events.find(event => event.type === 'damageDealt').damageReceipt.hits[0];
  assert.equal(firstHit.sources.find(row => row.id === 'base').amount, 8, 'the first cast is not lifted by its own new flux');
  assert.ok(!firstHit.sources.some(row => row.id === 'element-flux'));
  assert.equal(combat.player.elementFlux, 'fire');
  const second = held(combat, 'fixture.fire', 'fixture:fire2');
  const quote = cardPlayCosts(combat, second.instanceId), mana = combat.player.mana, energy = combat.player.energy;
  const out = dispatch(combat, { type: 'playCard', cardInstanceId: second.instanceId, targetId: enemy.id });
  const hit = out.events.find(event => event.type === 'damageDealt').damageReceipt.hits[0];
  const flux = hit.sources.find(row => row.id === 'element-flux');
  assert.ok(flux, 'the second matching spell carries the flux stage');
  assert.equal(flux.multiplier, 1.25);
  assert.equal(flux.requested, firstHit.incoming, 'same spell and rating enter the flux stage');
  assert.equal(flux.effective, Math.floor(flux.requested * 1.25));
  assert.equal(hit.incoming, flux.effective);
  assert.equal(combat.player.mana, mana - quote.mana);
  assert.equal(combat.player.energy, energy);
});

test('a non-element spell draws, restores its explicit Mana, exhausts and clears flux', () => {
  const { combat } = w25Fight();
  const card = held(combat, 'fixture.archive');
  const other = combat.piles.hand.filter(row => row !== card);
  combat.piles.hand = [card]; combat.piles.draw.push(...other);
  combat.player.elementFlux = 'fire'; combat.player.mana = 10;
  const quote = cardPlayCosts(combat, card.instanceId), mana = combat.player.mana;
  const out = dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId });
  assert.equal(combat.player.mana, mana - quote.mana + 2);
  assert.equal(combat.player.elementFlux ?? null, null);
  assert.equal(combat.piles.hand.length, 1, 'one card was drawn after the cast left the hand');
  assert.ok(out.events.some(event => event.type === 'cardDrawn'));
  assert.ok(combat.piles.exhaust.some(row => row.instanceId === card.instanceId));
});
