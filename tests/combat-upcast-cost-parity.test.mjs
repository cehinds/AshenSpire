import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch, previewCard, cardPlayCosts } from '../src/engine/combat.js';
import { grantAbilityCharge } from '../src/engine/abilityRiders.js';
import { payAshenBlight, chooseAshenBlightFeat } from '../src/engine/ashenBlight.js';
import { playingCardModel } from '../src/model/playingCard.js';
import { renderCard } from '../src/ui/components/card.js';
import { upcastChoicePlan } from '../src/ui/components/upcastChoice.js';
import { cardMarkupDom } from './helpers/card-markup-dom.mjs';

// Record the production renderer's resource markup, not browser geometry.
Object.assign(globalThis, cardMarkupDom());
const id = 'paid-tier-fixture';
const ref = { instanceId: 'paid-tier-instance', cardId: id };
const tiers = { baseTier: 2, unlockedTiers: [3, 5], maximumTier: 5, blockPerRank: 1 };
function registry({ cost = 1, manaCost = 1, upcast = tiers } = {}) {
  return createRegistries({ ...contentBundle, cards: [...contentBundle.cards, {
    // costRule 'fixed': this fixture prices its own cost; the cost formula does not apply (SPEC §4.3a).
    id, name: 'Paid Tier Fixture', type: 'skill', kindIds: ['classification.skill'], cost, manaCost, costRule: 'fixed',
    tags: ['camp:physical', 'maneuver:defend', 'range:melee', 'targeting:single'],
    effects: [{ op: 'block', target: 'self', amount: 2 }], textTemplate: 'Gain {block} Block.',
    ...(upcast ? { upcast } : {}),
  }] });
}
function fixture({ version = 2, stamina = 10, mana = 10, ...configuration } = {}) {
  const registries = registry(configuration);
  const input = playerId => ({ id: playerId, classId: 'reaver', combatExpansionVersion: version,
    hp: 80, maxHp: 80, maxMana: 10, mana, maxStamina: 10, stamina, energyMax: stamina,
    drawPerTurn: 1, relicIds: [], orderedDraw: true,
    deck: [{ ...ref, instanceId: playerId === 'b' ? 'other-instance' : ref.instanceId }] });
  const combat = createCombat({ registries, rng: createRng(11), combatExpansionVersion: version,
      player: input('player'), enemyIds: ['wanderingSoldier'] });
  return { combat, registries };
}
const actor = fixture => fixture.combat.player;
const preview = (fixture, tier = 5) => previewCard(fixture.combat, ref.instanceId, 'player', tier);
const play = (fixture, tier = 5) => dispatch(fixture.combat, { type: 'playCard', cardInstanceId: ref.instanceId, targetId: 'player', upcastTier: tier });
const state = combat => JSON.stringify({ player: combat.player,
  piles: combat.piles, enemies: combat.enemies, events: combat.eventLog, queue: combat.queue, rng: combat.rng.getCounters() });
function badges(registries, receipt, energy, mana) {
  const model = playingCardModel(registries, ref, { preview: receipt });
  assert.equal(model.costs.action, energy);
  assert.equal(model.costs.stamina, energy);
  assert.equal(model.costs.mana, mana);
  const html = renderCard(registries, ref, { preview: receipt, tooltip: false, inspection: false }).innerHTML;
  assert.match(html, new RegExp(`data-card-binding="stamina"[^>]*>${energy}</div>`));
  if (mana) assert.match(html, new RegExp(`data-card-binding="mana"[^>]*>${mana}</div>`));
  else assert.doesNotMatch(html, /data-component="mana-(icon|value)"/);
}
function convert(fixture) {
  const owner = actor(fixture);
  const paid = payAshenBlight({ combatExpansionVersion: 2, draw: () => .99 }, owner,
    { amount: 100, receiptId: 'conversion', combatKey: fixture.combat.combatKey });
  assert.equal(paid.converted, true);
  for (const threshold of [25, 50, 75]) chooseAshenBlightFeat(fixture.combat, owner, { threshold, path: 'martial' });
}

for (const converted of [false, true]) {
  test(`solo base 2 to tier 5 ${converted ? 'converted Blight' : 'normal'} preview, badge and payment agree`, () => {
    const f = fixture();
    if (converted) convert(f);
    const before = state(f.combat), receipt = preview(f);
    const energy = converted ? 3 : 4;
    assert.deepEqual([receipt.cost, receipt.staminaCost, receipt.manaCost], [energy, energy, 4]);
    badges(f.registries, receipt, energy, 4);
    assert.equal(state(f.combat), before, 'pricing is pure, including RNG and Blight payment history');
    const oldSP = actor(f).energy, oldMana = actor(f).mana;
    play(f);
    assert.equal(actor(f).energy, oldSP - energy);
    assert.equal(actor(f).stamina, oldSP - energy);
    assert.equal(actor(f).mana, oldMana - 4);
  });
}
test(`solo insufficient selected-tier SP refuses atomically while base is affordable`, () => {
  const f = fixture({ cost: 0, stamina: 2 });
  actor(f).energy = actor(f).stamina = 2;
  const base = preview(f, 2), selected = preview(f, 5);
  assert.equal(base.cost, 0);
  assert.equal(selected.cost, 3);
  badges(f.registries, selected, 3, 4);
  assert.equal(actor(f).energy >= selected.cost && actor(f).stamina >= selected.staminaCost, false);
  const before = state(f.combat);
  assert.throws(() => play(f), /Not enough (energy|stamina|Actions)/i);
  assert.equal(state(f.combat), before, 'no card, resources, statuses, RNG or queued work committed');
});
for (const preparing of [false, true]) {
  test(`solo ${preparing ? 'preparing' : 'live'} over-base Mana discount clamps the complete tier price`, () => {
    const f = fixture({ cost: 0, mana: 0 });
    const effect = { op: 'grantCardCharge', target: 'self', key: 'paid-price-discount', manaDiscount: 5 };
    if (preparing) {
      const key = 'player';
      f.combat.propertyMounts[key] ||= {};
      f.combat.propertyMounts[key].probe = { kind: 'feat', id: 'paid-price-discount', instanceId: 'paid-price-discount',
        rules: [{ tag: 'probe', triggers: [{ on: 'cardPreparing', do: [effect] }] }] };
    } else grantAbilityCharge(actor(f), effect);
    const before = state(f.combat), receipt = preview(f);
    assert.deepEqual([receipt.cost, receipt.staminaCost, receipt.manaCost], [3, 3, 0]);
    badges(f.registries, receipt, 3, 0);
    const option = upcastChoicePlan(receipt.resolvedDefinition).options.find(option => option.id === '5');
    assert.ok(option && !option.active, 'the shared rank chooser does not disable a free-Mana rank using base+surcharge guesses');
    assert.equal(state(f.combat), before);
    play(f);
    assert.equal(actor(f).energy, 7);
    assert.equal(actor(f).mana, 0);
  });
}

for (const version of [1, 2]) test(`version ${version} fixed and X card prices preserve their existing resource rules`, () => {
  const fixed = fixture({ version, cost: 2, manaCost: 1, upcast: null });
  const fReceipt = previewCard(fixed.combat, ref.instanceId, 'player');
  assert.deepEqual([fReceipt.cost, fReceipt.staminaCost, fReceipt.manaCost], [2, 2, 1]);
  const fCost = cardPlayCosts(fixed.combat, ref.instanceId);
  assert.deepEqual(fCost, { energy: 2, mana: 1, stamina: 2 });
  // Omit tier explicitly: legacy runs do not admit the v2 upcast selection.
  dispatch(fixed.combat, { type: 'playCard', cardInstanceId: ref.instanceId, targetId: 'player' });
  assert.deepEqual([fixed.combat.player.energy, fixed.combat.player.mana], [8, 9]);
  const variable = fixture({ version, cost: 'X', manaCost: 0, upcast: null });
  const receipt = previewCard(variable.combat, ref.instanceId, 'player');
  assert.equal(receipt.costIsX, true);
  assert.deepEqual([receipt.cost, receipt.staminaCost, receipt.manaCost], [10, 10, 0]);
  const html = renderCard(variable.registries, ref, { preview: receipt, tooltip: false, inspection: false }).innerHTML;
  assert.match(html, /data-card-binding="stamina"[^>]*>X<\/div>/);
  dispatch(variable.combat, { type: 'playCard', cardInstanceId: ref.instanceId, targetId: 'player' });
  assert.equal(variable.combat.player.energy, 0);
});

test(`solo authored Shield Bash tier 2 badge is its SP plus two, matching payment`, () => {
  const registries = createRegistries(contentBundle);
  const shield = { instanceId: 'shield-price-probe', cardId: 'shieldBash' };
  const input = { id: 'a', classId: 'reaver', combatExpansionVersion: 2, hp: 80, maxHp: 80,
    stamina: 10, maxStamina: 10, energyMax: 10, mana: 10, maxMana: 10,
    drawPerTurn: 1, deck: [shield], orderedDraw: true };
  const combat = createCombat({ registries,
    rng: createRng(11), combatExpansionVersion: 2, player: input, enemyIds: ['wanderingSoldier'] });
  const owner = combat.player;
  const receipt = previewCard(combat, shield.instanceId, 'player', 2);
  // Shield Bash's SP is the cost formula's (SPEC §4.3a), plus the tier-2 surcharge of 2.
  const base = resolveCard(registries, { cardId: 'shieldBash' });
  const sp = base.cost + 2, mp = base.manaCost + 2;
  assert.deepEqual([receipt.cost, receipt.staminaCost, receipt.manaCost], [sp, sp, mp]);
  const html = renderCard(registries, shield, { preview: receipt, tooltip: false, inspection: false }).innerHTML;
  assert.match(html, new RegExp(`data-card-binding="stamina"[^>]*>${sp}</div>`));
  assert.match(html, new RegExp(`data-card-binding="mana"[^>]*>${mp}</div>`));
  dispatch(combat, { type: 'playCard', cardInstanceId: shield.instanceId, targetId: 'player', upcastTier: 2 });
  const paid = combat.player;
  assert.deepEqual([paid.energy, paid.stamina, paid.mana], [10 - sp, 10 - sp, 10 - mp]);
  assert.equal(paid.combatCounter.charges, 1);
});

test(`solo upcast X keeps its badge and cannot spend more than the whole SP pool`, () => {
  const f = fixture({ cost: 'X', manaCost: 0 });
  const receipt = preview(f, 3);
  assert.equal(receipt.costIsX, true);
  assert.deepEqual([receipt.cost, receipt.staminaCost, receipt.manaCost], [11, 11, 1]);
  const html = renderCard(f.registries, ref, { preview: receipt, tooltip: false, inspection: false }).innerHTML;
  assert.match(html, /data-card-binding="stamina"[^>]*>X<\/div>/);
  const before = state(f.combat);
  assert.throws(() => play(f, 3), /Not enough (energy|stamina|Actions)/i);
  assert.equal(state(f.combat), before);
});
