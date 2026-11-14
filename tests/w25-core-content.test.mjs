// Owner, 2026-11-14 content decisions for Core (W25-B): Backstep cost, Jab as a reaction, spell damage, Ward and Barrier.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const cards = JSON.parse(readFileSync(new URL('../games/ashenspire/packs/core/cards.json', import.meta.url), 'utf8'));
const card = id => cards.find(row => row.id === id);

test('Backstep costs 2 Stamina, in the pack and under every resource profile', () => {
  const backstep = card('core.backstep');
  assert.equal(backstep.staminaCost, 2);
  assert.equal(backstep.cost, 2);
  const variants = JSON.parse(readFileSync(new URL('../games/ashenspire/packs/core/resourceVariants.json', import.meta.url), 'utf8'))['core.backstep'];
  assert.equal(variants.sp.staminaCost, 2);
  assert.equal(variants['sp,mp'].staminaCost, 2);
});

import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from './withoutWeaknesses.mjs';
import { dispatch } from '../src/engine/combat.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
function live(classId = 'reaver', seed = 511) {
  const run = createRunState({ registries: reg, classId, seed, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries: reg, run, rng: createRng(seed), enemyIds: ['wanderingSoldier'] });
  return { run, combat };
}

test('Jab is a reaction card: it is offered against an incoming melee attack when held and affordable', () => {
  assert.ok(card('core.jab').tags.includes('trait:reaction'));
  const { combat } = live();
  combat.piles.hand.length = 0;
  combat.piles.hand.push({ cardId: 'core.jab', instanceId: 'jab1', upgraded: false });
  for (const enemy of combat.enemies) enemy.intentRevealed = false;
  dispatch(combat, { type: 'endTurn' });
  const offer = combat.pendingReaction;
  assert.ok(offer, 'the enemy attack opens a reaction window');
  const option = offer.options.find(row => row.cardId === 'core.jab');
  assert.ok(option, 'Jab is among the options');
  assert.equal(option.staminaCost, 1);
});

test('played as a reaction, Jab pays 1 Stamina and strikes the attacker before the hit lands', () => {
  const { combat } = live();
  const enemy = combat.enemies[0];
  combat.piles.hand.length = 0;
  combat.piles.hand.push({ cardId: 'core.jab', instanceId: 'jab1', upgraded: false });
  const hpBefore = enemy.hp;
  dispatch(combat, { type: 'endTurn' });
  const out = dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id,
    optionId: combat.pendingReaction.options.find(row => row.cardId === 'core.jab').id });
  const types = out.events.map(event => event.type);
  assert.ok(types.includes('cardPlayed'));
  assert.ok(types.indexOf('cardPlayed') < types.indexOf('attackHit'), 'the reaction resolves before the incoming hit');
  assert.ok(enemy.hp < hpBefore, 'the Jab landed on the attacker');
  assert.equal(out.events.find(event => event.type === 'cardPlayed').staminaSpent, 1);
});

// Owner, 2026-11-14: spells deal double base damage. Pre-change damage per spell card, [base, upgraded] (the
// authored `damage` effects only; poiseDamage, Block and statuses did not change).
const SPELL_DAMAGE_BEFORE = {"starseerSpecial":[[9],[]],"cantrip":[[6],[]],"cinderDart":[[3],[4]],"galePush":[[3],[5]],"starfall":[[8],[11]],"cometLance":[[12],[16]],"searingRay":[[9],[13]],"meteor":[[30],[38]],"judgment":[[10],[13]],"arcaneSiphon":[[7],[10]],"emberWave":[[3],[5]],"eclipse":[[6],[9]],"astralBolt":[[7],[10]],"censure":[[5],[7]],"smite":[[8],[10]],"manaLash":[[6],[8]],"frostNip":[[3],[4]],"spark":[[3],[4]],"emberFlick":[[2],[3]],"dazzleFlare":[[2],[3]],"palmFlame":[[4],[5]],"rimeBite":[[2],[3]],"brittleTouch":[[1],[2]],"dawnFlame":[[4],[6]],"venomSpray":[[2],[3]],"graveToll":[[3],[4]],"rendingHex":[[2],[3]],"acidSplash":[[3],[4]],"jolt":[[4],[6]],"shockingGrasp":[[3],[4]],"stormLash":[[3],[5]]};

test('every Spell card deals twice its earlier base and upgraded damage', () => {
  const damages = effects => (effects || []).filter(effect => effect.op === 'damage').map(effect => effect.amount);
  const spells = cards.filter(row => row.tags.includes('camp:spell') && (damages(row.effects).length || damages(row.upgrade?.effects).length));
  assert.equal(spells.length, Object.keys(SPELL_DAMAGE_BEFORE).length);
  for (const row of spells) {
    const [base, upgraded] = SPELL_DAMAGE_BEFORE[row.id.replace('core.', '')];
    assert.deepEqual(damages(row.effects), base.map(n => n * 2), row.id);
    assert.deepEqual(damages(row.upgrade?.effects), upgraded.map(n => n * 2), `${row.id} upgraded`);
  }
});

test('a physical card keeps its damage', () => {
  assert.equal(card('core.jab').effects[0].amount, 4);
  assert.equal(card('core.strike').effects.find(effect => effect.op === 'damage').amount, 6);
});

test('a cast spell deals its doubled damage, and the hit meets Poise before HP', () => {
  const { combat } = live('starseer');
  const target = combat.enemies[0];
  target.hp = target.maxHp = 500; target.block = 0;
  assert.ok(target.poiseMeter.max > 0, 'the target has Poise');
  combat.piles.hand.push({ cardId: 'core.cantrip', instanceId: 'c1', upgraded: false });
  const out = dispatch(combat, { type: 'playCard', cardInstanceId: 'c1', targetId: target.id });
  const dealt = out.events.find(event => event.type === 'damageDealt');
  const hit = dealt.damageReceipt.hits[0];
  assert.equal(hit.sources.find(row => row.id === 'base').amount, 12, 'Cantrip dealt 6 before the change');
  assert.ok(dealt.poiseAbsorbed > 0, 'Poise took its share first');
  assert.equal(hit.hpLoss, hit.incoming - hit.poiseReduced, 'HP only took what Poise left');
  assert.equal(500 - target.hp, dealt.hpLoss);
});
