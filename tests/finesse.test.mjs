// Finesse (owner, 2026-10-25): a finesse hit's Attack rating reads Dexterity instead of Strength in Core 2 rules
// version 2, and a finesse multi-hit floors at max(hits - 1, 1) SP (model/actionCosts.js multiHitFloorFor).
import test from 'node:test';
import assert from 'node:assert/strict';
import { live, baseRegistries } from './helpers/fixcore-combat-rules.mjs';
import { resolveCard } from '../src/model/registries.js';
import { profileDamageReceipt } from '../src/engine/gameProfileCombat.js';
import { finesseRatingView } from '../src/model/combatRatings.js';
import { cardPlayCosts } from '../src/engine/combat.js';

const physical = { maneuver: 'attack', camp: 'physical' };
function strongNotQuick() {
  const ctx = live();
  // STR 4 gives AR 4; DEX 1 gives DR 1 (derivedStatRules: ar = STR, dr = DEX).
  ctx.player.ratingSources = [{ name: 'Attributes', kind: 'attribute', ar: 4, dr: 1, pr: 1, ward: 0, poise: 0 }];
  ctx.player.ratings = { ar: 4, dr: 1, pr: 1, ward: 0, poise: 0 };
  return ctx;
}
const raw = (ctx, cardId) => profileDamageReceipt(ctx, ctx.player, ctx.enemies[0], 3, { cardId, combatProfile: physical }).raw;

test('Twinblade Flurry is a finesse card', () => {
  assert.ok(resolveCard(baseRegistries, { cardId: 'twinbladeFlurry' }).tags.includes('finesse'));
});

test('a finesse hit scales with Dexterity, an ordinary hit with Strength', () => {
  const ctx = strongNotQuick();
  assert.equal(raw(ctx, 'core.strike'), 3 + 4, 'Strength-driven Attack rating');
  assert.equal(raw(ctx, 'twinbladeFlurry'), 3 + 1, 'Dexterity-driven Attack rating');
});

test('a fight on Core 2 rules version 1 keeps Strength scaling for finesse', () => {
  const ctx = strongNotQuick();
  ctx.core2ActionRulesVersion = 1;
  assert.equal(raw(ctx, 'twinbladeFlurry'), 3 + 4);
});

test('the finesse view swaps only the attribute part of the Attack rating', () => {
  const entity = { ratings: { ar: 6, dr: 3 }, ratingSources: [{ kind: 'attribute', ar: 4, dr: 1 }, { kind: 'equipment', ar: 2, dr: 2 }] };
  const view = finesseRatingView(entity);
  assert.equal(view.ratings.ar, 3, 'weapon AR 2 + DEX-driven 1');
  assert.deepEqual(view.ratingSources[1], entity.ratingSources[1]);
  assert.equal(finesseRatingView({ ratings: { ar: 5 } }).ratings.ar, 5, 'no attribute row: unchanged');
});

test('Twinblade Flurry (3 hits, Mana, finesse) floors at 1 SP, so its derived price stands', () => {
  const ctx = live();
  ctx.piles.hand.push({ instanceId: 'tf', cardId: 'twinbladeFlurry' });
  assert.equal(cardPlayCosts(ctx, 'tf').stamina, resolveCard(baseRegistries, { cardId: 'twinbladeFlurry' }).cost);
});
