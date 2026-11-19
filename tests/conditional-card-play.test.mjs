// Theme G of the 2026-11-17 playtest (owner): the new self-buff and conditional payoff cards, played for real in a
// Core fight. Each conditional card pays its bonus when its condition holds and not otherwise; the reach-only cards
// refuse to play at melee. Self-buffs only ever target the player.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries, projectGameCard } from '../src/model/gameProfile.js';
import { claimGameProfileReward, gameProfileRewardOffers, gameProfileRewardPools } from '../src/model/gameProfileRewards.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch, previewCard } from '../src/engine/combat.js';
import { PlayConditionTargetPlan } from '../src/engine/cardBehavior.js';
import { actorRangeKey, rangePairKey } from '../src/model/combatEngagement.js';
import { cardTargetPlan, forbiddenCardDrop } from '../src/model/cardTargets.js';
import { ResolveTargetHudAction } from '../src/ui/models/CombatTargetingModel.js';
import { targetLayer } from '../src/ui/models/TargetLayerModel.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: { effects: { physicalDamageMultiplier: 1, playerDamageMultiplier: 1 } } });
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);

export const SELF_BUFF_CARDS = Object.freeze({
  reaver: ['steelResolve', 'ironHide'], herald: ['hearthVigil', 'zealousFervor'], starseer: ['innerOrbit', 'starlitSkin'], rogue: ['keenEdge'],
});
export const CONDITIONAL_CARDS = Object.freeze({
  reaver: ['openingCut', 'holdTheLine', 'lungingThrust'], herald: ['sanctifiedGuard', 'pyreBrand'],
  starseer: ['unguardedBolt', 'focusedStar', 'rimeLance', 'distantStar'], rogue: ['breakFocus', 'dirtyStrike', 'closeQuarters'],
});

const newRun = (classId, seed) => createRunState({ registries, classId, seed,
  profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });

function live(classId, seed = 433, enemyIds = ['wanderingSoldier']) {
  const run = newRun(classId, seed);
  const combat = createRunCombat({ registries, run, rng: createRng(seed), enemyIds });
  const enemy = combat.enemies[0];
  delete combat.reactionRules.contactPolicy;
  Object.assign(combat.player, { basePrecisionBonus: 1000, hp: 999, maxHp: 999, energy: 99, stamina: 99, maxStamina: 99, mana: 99, maxMana: 99, statuses: {} });
  Object.assign(enemy, { hp: 5000, maxHp: 5000, statuses: {}, ratingSources: [], basePrecisionBonus: 0, block: 0 });
  dispatch(combat, { type: 'setReactions', enabled: false });
  return { combat, player: combat.player, enemy };
}
const setBand = (combat, enemy, band) => {
  combat.rangeState.engagements[rangePairKey(actorRangeKey(combat, combat.player), actorRangeKey(combat, enemy))] = band;
};
const play = (combat, cardId, target) => {
  const id = `t-${cardId}-${combat.piles.hand.length}`;
  combat.piles.hand.push({ instanceId: id, cardId });
  dispatch(combat, { type: 'playCard', cardInstanceId: id, ...(target ? { targetId: target.id } : {}) });
};
/** One fresh fight per side of the condition: `setup(world, met)` arranges it, `measure(world)` reads the payoff. */
function bothSides(classId, cardId, setup, measure) {
  return [true, false].map(met => {
    const world = live(classId);
    setup(world, met);
    const before = measure(world);
    play(world.combat, cardId, registries.cards.get(cardId).type === 'attack' ? world.enemy : null);
    return measure(world) - before;
  });
}
const damageTaken = ({ enemy }) => -enemy.hp;
const blockHeld = ({ player }) => player.block;
const stance = maneuver => ({ maneuver, camp: maneuver === 'casting' ? 'spell' : 'physical', range: 'melee' });

test('Core stocks every new card for its class; older rules omit them and the buffs target only the player', () => {
  for (const [classId, ids] of Object.entries(SELF_BUFF_CARDS)) {
    const run = newRun(classId, 433);
    run.maxMana = Math.max(run.maxMana, 2);
    const pool = gameProfileRewardPools(registries, run).combatCards;
    for (const id of [...ids, ...CONDITIONAL_CARDS[classId]]) {
      const def = registries.cards.get(id);
      assert.ok(def, `${id} is registered`);
      assert.equal(def.class, classId, `${id} belongs to ${classId}`);
      assert.equal(def.minCombatExpansionVersion, 2);
      assert.ok(pool.includes(id), `${id} is offered by Core to ${classId}`);
      assert.ok(!registries.classes.get(classId).cardPool.includes(id), `${id} stays out of the older rules' pool`);
    }
    for (const id of ids) {
      const def = registries.cards.get(id);
      const statusEffects = [...def.effects, ...(def.upgrade?.effects || [])].filter(effect => effect.op === 'applyStatus');
      assert.ok(statusEffects.length, `${id} buffs`);
      assert.ok(statusEffects.every(effect => effect.target === 'self'), `${id} buffs the player only`);
    }
  }
});

test('a real Core reward offers and grants a new class card', () => {
  const run = newRun('reaver', 433);
  const ids = [...SELF_BUFF_CARDS.reaver, ...CONDITIONAL_CARDS.reaver];
  for (let seed = 0; seed < 40; seed++) {
    const offerId = `level:${seed}`;
    const offer = gameProfileRewardOffers(registries, run, createRng(seed), { offerId, source: 'level' });
    const index = offer.options.findIndex(row => ids.includes(row.id));
    if (index < 0) continue;
    const claimed = claimGameProfileReward(registries, run, offerId, index);
    assert.equal(claimed.id, offer.options[index].id);
    assert.ok(run.sideboard.some(row => row.cardId === claimed.id));
    return;
  }
  assert.fail('no Core level-up offer included a new Reaver card');
});

test('configured rewards keep conditional cards while removing unreachable range requirements', () => {
  for (const [classId, reachOnly, other] of [['reaver', 'lungingThrust', 'openingCut'], ['starseer', 'distantStar', 'focusedStar']]) {
    const run = newRun(classId, 433);
    const pool = () => gameProfileRewardPools(registries, run).combatCards;
    assert.ok(pool().includes(reachOnly));
    run.rangePolicy = { ...run.rangePolicy, maxRange: 'melee' };
    assert.ok(!pool().includes(reachOnly));
    assert.ok(pool().includes(other));
    run.rangePolicy = { ...run.rangePolicy, enabled: false, maxRange: 'reach' };
    assert.ok(!pool().includes(reachOnly));
    assert.ok(pool().includes(other));
  }
});

test('shared cards keep their upgrades and respect disabled resource pools', () => {
  const mpOff = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: { resources: { include: ['sp'] } } });
  const spOff = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: { resources: { include: ['mp'] } } });
  const orbit = { cardId: 'innerOrbit', upgraded: true };
  assert.deepEqual(projectGameCard(profile, orbit).resourceCosts, { sp: 1, mp: 1 });
  assert.deepEqual(projectGameCard(mpOff, orbit).resourceCosts, { sp: 1, mp: 0 });
  const hide = { cardId: 'ironHide', upgraded: true };
  assert.equal(projectGameCard(profile, hide).resourceCosts.sp, 0);
  assert.equal(projectGameCard(spOff, hide).costGrowth.stamina, 0);
});

test('Core quotes and pays the authored self-buff price before and after its upgrade', () => {
  for (const [cardId, prices] of [['steelResolve', [2, 1]], ['ironHide', [1, 0]]]) {
    for (const [index, price] of prices.entries()) {
      const { combat, player } = live('reaver');
      combat.piles.hand.push({ instanceId: 'price', cardId, upgraded: index > 0 });
      assert.equal(previewCard(combat, 'price').staminaCost, price, `${cardId} preview`);
      const before = player.energy;
      const out = dispatch(combat, { type: 'playCard', cardInstanceId: 'price' });
      assert.equal(out.events.find(event => event.type === 'cardPlayed').staminaSpent, price, `${cardId} receipt`);
      assert.equal(before - player.energy, price, `${cardId} payment`);
    }
  }
});

test('the strong self-buffs carry a penalty that the upgrade eases', () => {
  const penalty = def => (def.keywords || []).filter(k => ['exhaust', 'ethereal'].includes(k)).length * 10 + (def.manaCost || 0) + (def.cost || 0) + (def.costGrowth ? 5 : 0);
  for (const ids of Object.values(SELF_BUFF_CARDS)) for (const id of ids) {
    const def = registries.cards.get(id);
    const upgraded = { ...def, ...def.upgrade, costGrowth: def.costGrowth };
    assert.ok(penalty(upgraded) < penalty(def), `${id}: the upgrade eases its penalty`);
  }
});

test('self-buffs grant their status to the player', () => {
  for (const [classId, ids] of Object.entries(SELF_BUFF_CARDS)) for (const id of ids) {
    const { combat, player } = live(classId);
    play(combat, id);
    const statuses = registries.cards.get(id).effects.filter(effect => effect.op === 'applyStatus').map(effect => effect.status);
    for (const status of statuses) assert.ok((player.statuses[status]?.stacks || 0) > 0, `${id} gives the player ${status}`);
  }
});

test('Opening Cut and Unguarded Bolt pay off against an Idle target', () => {
  const idle = ({ enemy }, met) => { if (met) delete enemy.combatStance; else enemy.combatStance = stance('attack'); };
  const [met, unmet] = bothSides('reaver', 'openingCut', idle, damageTaken);
  assert.ok(met > unmet, `Idle target takes more (${met} > ${unmet})`);
  const [boltMet, boltUnmet] = bothSides('starseer', 'unguardedBolt', idle, damageTaken);
  assert.ok(boltMet > boltUnmet, `Idle target takes more (${boltMet} > ${boltUnmet})`);
});

// Owner, 2026-11-17 (#2816 review): the stance payoffs must not double-dip with the ×1.25 stance weakness. Against a matching
// target the whole play (weakness included) lands at 1.5–2× the same card's hit on a target in an ordinary stance (Sweep),
// the rider is a flat HP loss (no Vulnerable), and the preview's rows add up to the live HP lost.
test('the stance payoffs land at 1.5–2× an ordinary hit, and the preview equals the live play', () => {
  for (const [classId, cardId, matching] of [['reaver', 'openingCut', 'idle'], ['rogue', 'breakFocus', 'casting'], ['starseer', 'unguardedBolt', 'idle']]) {
    for (const upgraded of [false, true]) {
      const hit = maneuver => {
        const world = live(classId);
        if (maneuver === 'idle') delete world.enemy.combatStance; else world.enemy.combatStance = stance(maneuver);
        world.combat.piles.hand.push({ instanceId: 'probe', cardId, upgraded });
        const preview = previewCard(world.combat, 'probe', world.enemy.id);
        const rows = preview.values.filter(row => ['damage', 'loseHp'].includes(row.op)).map(row => row.perTarget?.[world.enemy.id] ?? row.value);
        const hp = world.enemy.hp;
        dispatch(world.combat, { type: 'playCard', cardInstanceId: 'probe', targetId: world.enemy.id });
        return { rows, lost: hp - world.enemy.hp, vulnerable: world.enemy.statuses.vulnerable?.stacks || 0 };
      };
      const ordinary = hit('sweep'), matched = hit(matching);
      const ratio = matched.lost / ordinary.lost;
      assert.ok(ratio >= 1.5 && ratio <= 2, `${cardId}${upgraded ? '+' : ''}: ${matched.lost} vs ${ordinary.lost} is ${ratio.toFixed(2)}×`);
      assert.equal(matched.vulnerable, 0, `${cardId}: no Vulnerable on top of the stance weakness`);
      assert.equal(matched.rows.reduce((sum, value) => sum + value, 0), matched.lost, `${cardId}: preview rows add up to the live HP lost`);
      assert.equal(ordinary.rows[0], ordinary.lost, `${cardId}: unmatched, only the hit lands`);
    }
  }
});

test('Break Focus pays off against a target in Prepared', () => {
  const [met, unmet] = bothSides('rogue', 'breakFocus', ({ enemy }, on) => { enemy.combatStance = stance(on ? 'casting' : 'attack'); }, damageTaken);
  assert.ok(met > unmet, `${met} > ${unmet}`);
});

test('Hold the Line and Sanctified Guard read your stance before the card', () => {
  const inDefense = ({ player }, on) => { player.combatStance = stance(on ? 'defend' : 'attack'); };
  const [lineMet, lineUnmet] = bothSides('reaver', 'holdTheLine', inDefense, blockHeld);
  assert.ok(lineMet > lineUnmet, `Hold the Line Block ${lineMet} > ${lineUnmet}`);
  const [guardMet, guardUnmet] = bothSides('herald', 'sanctifiedGuard', inDefense, blockHeld);
  assert.ok(guardMet > guardUnmet, `Sanctified Guard Block ${guardMet} > ${guardUnmet}`);
});

test('Focused Star pays off when you were in Prepared', () => {
  const [met, unmet] = bothSides('starseer', 'focusedStar', ({ player }, on) => { player.combatStance = stance(on ? 'casting' : 'attack'); }, damageTaken);
  assert.ok(met > unmet, `${met} > ${unmet}`);
});

test('Pyre Brand, Dirty Strike and Rime Lance read the target status', () => {
  const [burnMet, burnUnmet] = bothSides('herald', 'pyreBrand', ({ enemy }, on) => { if (on) enemy.statuses.burn = { stacks: 1 }; }, damageTaken);
  assert.ok(burnMet > burnUnmet, `Burning target takes more (${burnMet} > ${burnUnmet})`);
  const [weakMet, weakUnmet] = bothSides('rogue', 'dirtyStrike', ({ enemy }, on) => { if (on) enemy.statuses.weak = { stacks: 2 }; }, damageTaken);
  assert.ok(weakMet > weakUnmet, `a Weak target takes more (${weakMet} > ${weakUnmet})`);
  const vulnerable = [true, false].map(on => {
    const world = live('starseer');
    if (on) world.enemy.statuses.frost = { stacks: 1 };
    play(world.combat, 'rimeLance', world.enemy);
    return world.enemy.statuses.vulnerable?.stacks || 0;
  });
  assert.ok(vulnerable[0] > 0 && vulnerable[1] === 0, `Vulnerable only on a Frosted target (${vulnerable})`);
});

test('Lunging Thrust and Distant Star play only at Reach', () => {
  for (const [classId, cardId] of [['reaver', 'lungingThrust'], ['starseer', 'distantStar']]) {
    const near = live(classId);
    setBand(near.combat, near.enemy, 0);
    assert.throws(() => play(near.combat, cardId, near.enemy), error => error.playRefusal?.reason === 'unplayable', `${cardId} refuses at Melee`);
    const far = live(classId);
    setBand(far.combat, far.enemy, 1);
    const hp = far.enemy.hp;
    play(far.combat, cardId, far.enemy);
    assert.ok(far.enemy.hp < hp, `${cardId} hits at Reach`);
  }
});

test('a mixed-range fight offers and defaults to the eligible enemy for Reach-only cards', () => {
  const { combat, player } = live('reaver', 433, ['wanderingSoldier', 'wanderingSoldier']);
  const [near, far] = combat.enemies;
  setBand(combat, near, 0);
  setBand(combat, far, 1);
  const card = registries.cards.get('lungingThrust');
  const base = cardTargetPlan(card, player.id, combat.enemies);
  assert.deepEqual(base.legalIds, [near.id, far.id]);
  const ordinary = registries.cards.get('openingCut');
  assert.equal(PlayConditionTargetPlan(combat, ordinary, base), base);
  const plan = PlayConditionTargetPlan(combat, card, base);
  assert.deepEqual(plan.legalIds, [far.id]);
  assert.deepEqual(targetLayer({ armed: true, enemies: combat.enemies, legalIds: plan.legalIds }).eligibleIds, [far.id]);
  const targetHud = id => ResolveTargetHudAction(id, {
    combat, selected: 'probe', readTargetPlan: () => plan, inputBusy: () => false,
    hasCardChoice: () => false, veilIsOpen: () => false,
  });
  assert.equal(targetHud(near.id).type, 'refused');
  assert.equal(targetHud(far.id).targetId, far.id);
  assert.equal(forbiddenCardDrop(plan, { x: 1, y: 1 }, [{ id: near.id, alive: true, bounds: { left: 0, top: 0, right: 2, bottom: 2 } }]), true);
  combat.piles.hand.push({ instanceId: 'probe', cardId: card.id });
  const automatic = previewCard(combat, 'probe');
  const aimed = previewCard(combat, 'probe', far.id);
  assert.deepEqual(automatic.values, aimed.values);
  const played = dispatch(combat, { type: 'playCard', cardInstanceId: 'probe' });
  assert.equal(played.events.find(event => event.type === 'cardPlayed').targetId, far.id);
});

test('Close Quarters pays off at Melee and not at Reach', () => {
  const [met, unmet] = bothSides('rogue', 'closeQuarters', ({ combat, enemy }, on) => setBand(combat, enemy, on ? 0 : 1), damageTaken);
  assert.ok(met > unmet, `${met} > ${unmet}`);
});

// Review of #2816 (round 3): an HP loss aimed at the target is the card's payoff, not a price the player pays, and it
// goes straight to HP (applyLoseHp ignores Block, Ward and Barrier). Every text path says so: the card face lines
// (hand, inspector), the plain summary (shop, deck editor) and the reward/option tile.
test('a target HP-loss rider reads as the target losing HP that ignores Block, on every text path', async () => {
  const { cardFaceLines } = await import('../src/model/cardFaceText.js');
  const { combatCardSummary } = await import('../src/model/playingCard.js');
  const { cardEffectHtml } = await import('../src/ui/models/CardOptionSummaryModel.js');
  const plain = html => String(html ?? '').replace(/<[^>]+>/g, '');
  for (const cardId of ['openingCut', 'breakFocus', 'unguardedBolt']) {
    const def = registries.cards.get(cardId);
    const summary = combatCardSummary(def, null, registries);
    const paths = {
      face: (cardFaceLines(def, null, registries) || []).map(line => plain(line.html)).join(' | '),
      summary: plain(typeof summary === 'string' ? summary : Array.isArray(summary) ? summary.join(' ') : summary?.text),
      tile: plain(cardEffectHtml(def, null, registries)),
    };
    for (const [path, text] of Object.entries(paths)) {
      if (!text) continue;
      assert.doesNotMatch(text, /\b(Pay|Offer) \d+ HP/, `${cardId} ${path}: not a cost the player pays (${text})`);
      assert.match(text, /target loses \d+ HP \(ignores Block\)/i, `${cardId} ${path}: names the target's HP loss (${text})`);
    }
    assert.ok(paths.face || paths.summary || paths.tile, `${cardId}: some text path renders`);
    assert.match(def.textTemplate, /loses \{loseHp\} HP, ignoring Block\./, `${cardId}: the rules text says it ignores Block`);
  }
  // A card that pays HP itself still reads as a payment.
  const { cardFaceLines: lines } = await import('../src/model/cardFaceText.js');
  const payer = { ...registries.cards.get('openingCut'), effects: [{ op: 'loseHp', target: 'self', amount: 2 }, { op: 'damage', target: 'enemy', amount: 3 }] };
  assert.match((lines(payer, null, registries) || []).map(line => plain(line.html)).join(' | '), /Pay 2 HP/);
});
