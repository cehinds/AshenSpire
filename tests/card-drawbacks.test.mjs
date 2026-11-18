// Playtest 2026-11-17, theme C: every card that grants Evade carries a drawback, and its upgrades may ease it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { createRunState } from '../src/model/state.js';
import { gameProfileRewardPools, gameProfileWeaponArtIds } from '../src/model/gameProfileRewards.js';

const unlocked = { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } };
const CLASSES = ['reaver', 'starseer', 'rogue', 'herald'];

/** Every card a Core run can meet: offered as a reward, sold as a weapon art, or dealt in a starter deck. */
export function coreReachableCardIds() {
  const ids = new Set();
  for (const classId of CLASSES) {
    const run = createRunState({ registries, classId, seed: 1, profileMeta: unlocked });
    run.maxMana = 20;
    for (const id of gameProfileRewardPools(registries, run).combatCards) ids.add(id);
    for (const id of gameProfileWeaponArtIds(registries, run)) ids.add(id);
    for (const card of run.deck) ids.add(card.cardId ?? card.id ?? card);
  }
  return [...ids].filter((id) => registries.cards.has(id));
}

const grantsEvade = (card) => (card.effects || []).some((e) => e.op === 'applyStatus' && e.target === 'self' && /(^|\.)evade$/.test(e.status));
const stamina = (card) => (Number.isInteger(card.staminaCost) ? card.staminaCost : Number.isInteger(card.cost) ? card.cost : 0);

/** The drawbacks the owner listed: 2 or more Stamina, a Mana cost, Exhaust or Ethereal, a rising cost, or damage to yourself. */
export function drawbacksOf(card) {
  const keywords = card.keywords || [];
  const found = [];
  if (stamina(card) >= 2) found.push('stamina');
  if ((card.manaCost || 0) > 0) found.push('mana');
  if (keywords.includes('exhaust')) found.push('exhaust');
  if (keywords.includes('ethereal')) found.push('ethereal');
  if ((card.costGrowth?.stamina || 0) > 0 || (card.costGrowth?.mana || 0) > 0) found.push('risingCost');
  if ((card.effects || []).some((e) => e.op === 'loseHp' && e.target === 'self')) found.push('selfDamage');
  return found;
}

test('every Core card that grants Evade carries a drawback', () => {
  const evaders = coreReachableCardIds().map((id) => registries.cards.get(id)).filter(grantsEvade);
  assert.ok(evaders.some((card) => card.id === 'core.backstep'), 'Backstep is reachable and grants Evade');
  for (const card of evaders) assert.ok(drawbacksOf(card).length, `${card.id} grants Evade with no drawback`);
});

test('the 1-Stamina Evade cards Exhaust, and Sidestep does too', () => {
  for (const id of ['core.backstep', 'quickstep', 'base.evade']) assert.ok(registries.cards.get(id).keywords.includes('exhaust'), id);
});

test('Hold Block costs 1 more Stamina each play, up to +2, and its authored upgrade holds the cost', () => {
  const hold = registries.cards.get('base.retain-block');
  assert.deepEqual(drawbacksOf(hold), ['risingCost']);
  assert.deepEqual({ stamina: hold.costGrowth.stamina, max: hold.costGrowth.max }, { stamina: 1, max: 2 });
  assert.equal(hold.upgrade.costGrowth.stamina, 0, 'the upgrade stops the rising cost');
  assert.ok(registries.cards.get('base.retain-block').effects.some((e) => e.op === 'block' && e.amount === 6), 'still 6 Block');
});

test("Star Seer's Ethereal starter keeps 10 Block and is offered Reaction, dropping Ethereal, or more Block", async () => {
  const { nextUpgradeOptions } = await import('../src/model/cardUpgradeLimits.js');
  const { applyUpgradeSteps } = await import('../src/model/cardUpgrade.js');
  const ethereal = registries.cards.get('base.ethereal');
  assert.ok(ethereal.effects.some((e) => e.op === 'block' && e.amount === 10));
  assert.ok(ethereal.keywords.includes('ethereal'));
  for (const seed of [1, 2, 3, 4, 5]) {
    const offered = nextUpgradeOptions({ seed, gameProfile: registries.gameProfile, rangePolicy: {} }, { instanceId: `e${seed}`, cardId: ethereal.id, upgraded: false }, ethereal, registries, 3);
    const kinds = offered.map((s) => (s.k === 'fx' ? `fx:${s.fx}` : s.k)).sort();
    assert.deepEqual(kinds, ['blk', 'fx:reaction', 'fx:unethereal'], `seed ${seed}: ${JSON.stringify(offered)}`);
  }
  const kept = applyUpgradeSteps(ethereal, [{ k: 'fx', fx: 'unethereal' }]);
  assert.ok(!kept.keywords.includes('ethereal'));
  assert.ok((applyUpgradeSteps(ethereal, [{ k: 'fx', fx: 'reaction' }]).tags || []).includes('trait:reaction'));
});

test('Pebble Throw is a Reach attack', async () => {
  const { combatCardRange } = await import('../src/model/combatCardProfile.js');
  const pebble = registries.cards.get('core.pebbleThrow');
  assert.ok((pebble.cardTags ?? pebble.tags).includes('range:reach'));
  assert.equal(combatCardRange(pebble), 'reach');
  assert.equal(combatCardRange(registries.cards.get('core.flick')), 'melee', 'Flick, its zero-cost sibling, stays Melee');
});

// Owner 2026-11-17: no ally mechanics exist yet, so every card that targets, buffs or costs an ally is disabled until they do.
const ALLY_CARDS = ['base.buff-ally', 'base.drain-allies', 'base.guard-allies', 'rallyingBanner', 'sharedFlame', 'ashOath'];
const touchesAllies = (card) => /"target":"(ally|allAllies)"/.test(JSON.stringify([card.effects, card.upgrade, card.gradeProfiles]))
  || /guard-allies/.test(JSON.stringify(card.effects));

test('the ally-card list is every card that targets, buffs or costs an ally', () => {
  const found = registries.cards.all().filter(touchesAllies).map((card) => card.id).sort();
  assert.deepEqual(found, [...ALLY_CARDS].sort());
});

test('ally cards are in no Core reward, shop or starter pool, nor any class pool, but stay defined', async () => {
  const { contentBundle } = await import('../src/content/index.js');
  for (const id of ALLY_CARDS) assert.ok(registries.cards.has(id), `${id} stays defined for saved decks`);
  for (const classId of CLASSES) {
    const run = createRunState({ registries, classId, seed: 1, profileMeta: unlocked });
    run.maxMana = 20;
    const pools = gameProfileRewardPools(registries, run);
    const offered = Object.values(pools).flat().filter((id) => ALLY_CARDS.includes(id));
    assert.deepEqual(offered, [], `${classId} reward and shop pools`);
    assert.deepEqual(run.deck.map((card) => card.cardId ?? card).filter((id) => ALLY_CARDS.includes(id)), [], `${classId} starter deck`);
  }
  for (const cls of contentBundle.classes) assert.deepEqual(cls.cardPool.filter((id) => ALLY_CARDS.includes(id)), [], `${cls.id} class pool`);
});

test('a saved deck that still holds an ally card plays it safely: the ally part does nothing', async () => {
  const { createRng } = await import('../src/engine/rng.js');
  const { createRunCombat } = await import('../src/engine/runCombat.js');
  const { dispatch } = await import('../src/engine/combat.js');
  const played = {};
  for (const id of ALLY_CARDS) {
    const run = createRunState({ registries, classId: 'reaver', seed: 511, profileMeta: unlocked });
    const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
    for (const pile of Object.values(combat.piles)) pile.length = 0;
    combat.piles.hand.push({ instanceId: 'x', cardId: id, upgraded: false });
    combat.player.stamina = combat.player.maxStamina = 20;
    combat.player.mana = combat.player.maxMana = 20;
    const hp = combat.player.hp;
    assert.doesNotThrow(() => dispatch(combat, { type: 'playCard', cardInstanceId: 'x' }), id);
    assert.ok(!combat.piles.hand.some((card) => card.instanceId === 'x'), `${id} left the hand`);
    played[id] = { hp: hp - combat.player.hp, block: combat.player.block, strength: combat.player.statuses.strength?.stacks || 0 };
  }
  assert.deepEqual(played['base.buff-ally'], { hp: 0, block: 0, strength: 0 }, 'no ally, so no Strength lands on the player');
  assert.equal(played['base.drain-allies'].hp, 0, 'no ally loses HP, and neither does the player');
  assert.ok(played['base.drain-allies'].block > 0, 'its own Block still applies');
  assert.deepEqual(played.rallyingBanner, { hp: 0, block: 0, strength: 0 }, 'the ally Block reaches no one');
  assert.equal(played.ashOath.strength, 1, 'Oath of Ash: only its own 1 Strength applies');
});
// Item 14: an unupgraded card that deals at least OVERTUNED times Strike's damage for each Stamina and Mana it costs pays a penalty.
const OVERTUNED = 2.5;
const PENALTIES = ['exhaust', 'ethereal', 'risingCost', 'selfDamage'];
// Owner, 2026-11-18: the Core side damage scale (x0.7, floored) cuts every card alike but rounds small hits unevenly, so the tuning rule is measured with it at 1.
// Card power is compared as before; the base-damage halving and every card's own numbers are untouched.
async function tuningRegistries() {
  const { gameDigest } = await import('../engine/kernel/gameConfig.js');
  const { contentBundle } = await import('../src/content/index.js');
  const { createRegistries } = await import('../src/model/registries.js');
  const Profile = await import('../src/model/gameProfile.js');
  const profile = structuredClone(Profile.resolveGameProfile('default'));
  profile.modules.effects.playerDamageMultiplier = 1;
  profile.modules.effects.enemyDamageMultiplier = 1;
  delete profile.hash;
  profile.hash = gameDigest(profile);
  return Profile.bindGameProfileRegistries(createRegistries(Profile.applyGameProfileToContent(contentBundle, profile)), profile);
}
let tuning;
async function damagePerPoint(cardId, upgraded = false) {
  tuning ||= await tuningRegistries();
  const registries = tuning;
  const { createRng } = await import('../src/engine/rng.js');
  const { createRunCombat } = await import('../src/engine/runCombat.js');
  const { dispatch } = await import('../src/engine/combat.js');
  const run = createRunState({ registries, classId: 'starseer', seed: 511, profileMeta: unlocked });
  const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  for (const pile of Object.values(combat.piles)) pile.length = 0;
  combat.piles.hand.push({ instanceId: 'x', cardId, upgraded });
  for (let i = 0; i < 8; i += 1) combat.piles.draw.push({ instanceId: `f${i}`, cardId: 'core.defend', upgraded: false });
  for (const enemy of combat.enemies) Object.assign(enemy, { hp: 5000, maxHp: 5000, block: 0 });
  combat.player.stamina = combat.player.maxStamina = 20;
  combat.player.mana = combat.player.maxMana = 20;
  const enemy = combat.enemies[0];
  const before = { hp: enemy.hp, stamina: combat.player.stamina, mana: combat.player.mana };
  try { dispatch(combat, { type: 'playCard', cardInstanceId: 'x', targetId: enemy.id }); } catch { return null; }
  const paid = before.stamina - combat.player.stamina + before.mana - combat.player.mana;
  return (before.hp - enemy.hp) / Math.max(1, paid);
}

test('every overtuned unupgraded damage card pays a penalty', async () => {
  const strike = await damagePerPoint('core.strike');
  assert.ok(strike > 0);
  const overtuned = [];
  for (const id of coreReachableCardIds()) {
    const card = registries.cards.get(id);
    if (!(card.effects || []).some((e) => e.op === 'damage')) continue;
    const perPoint = await damagePerPoint(id);
    if (perPoint == null || perPoint < OVERTUNED * strike) continue;
    overtuned.push(id);
    assert.ok(drawbacksOf(card).some((kind) => PENALTIES.includes(kind)), `${id} deals ${perPoint} per point (Strike ${strike}) with no penalty`);
  }
  // Damage numbers move with other balance passes; the rule is what is pinned, plus one card that must stay in it.
  assert.ok(overtuned.includes('core.pyreLash'), JSON.stringify(overtuned));
});

test('the overtuned cards pay their penalty in HP, and their upgrade drops it', async () => {
  const { upgradedDefinition } = await import('../src/model/cardUpgrade.js');
  for (const id of ['core.pyreLash', 'core.forkedBolt', 'core.batteringGale', 'core.witherDraught', 'core.glacialSpike', 'core.radiantVerdict', 'core.meteor', 'colossusSmash']) {
    const card = registries.cards.get(id);
    assert.ok(drawbacksOf(card).includes('selfDamage'), id);
    assert.ok(!drawbacksOf(upgradedDefinition(card)).includes('selfDamage'), `${id}+ keeps no self-damage`);
  }
});

test('the Core content with these card changes validates (faces, upgrade faces and tokens)', async () => {
  const { contentBundle } = await import('../src/content/index.js');
  const { validateContent } = await import('../src/model/validate.js');
  const { resolveGameProfile, applyGameProfileToContent } = await import('../src/model/gameProfile.js');
  const core = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
  const cards = (errors) => errors.filter((row) => row.path.startsWith('cards.'));
  assert.deepEqual(cards(validateContent(applyGameProfileToContent(contentBundle, core)).errors), []);
});

// Review of #2819: the HP cost is nonlethal. A play it would kill is refused before anything resolves; the hand and the simbot say so first.
async function lowHpFight(hp) {
  const { createRng } = await import('../src/engine/rng.js');
  const { createRunCombat } = await import('../src/engine/runCombat.js');
  const run = createRunState({ registries, classId: 'starseer', seed: 511, profileMeta: unlocked });
  const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  for (const pile of Object.values(combat.piles)) pile.length = 0;
  combat.piles.hand.push({ instanceId: 'p', cardId: 'core.pyreLash', upgraded: false });
  combat.player.stamina = combat.player.maxStamina = 20;
  combat.player.mana = combat.player.maxMana = 20;
  combat.player.hp = hp;
  return combat;
}

test('an HP cost that would kill refuses the play and leaves every HP as it was', async () => {
  const { dispatch } = await import('../src/engine/combat.js');
  const { NonlethalHpRefusal } = await import('../src/model/cardHpCost.js');
  for (const id of ['core.pyreLash', 'core.forkedBolt', 'core.batteringGale', 'core.witherDraught', 'core.glacialSpike', 'core.radiantVerdict', 'core.meteor', 'colossusSmash']) {
    assert.ok(registries.cards.get(id).effects.some((e) => e.op === 'loseHp' && e.nonlethal === true), `${id}: its HP cost is nonlethal`);
  }
  const combat = await lowHpFight(2);
  const enemyHp = combat.enemies[0].hp;
  assert.match(NonlethalHpRefusal(registries.cards.get('core.pyreLash'), combat.player), /Not enough HP: it costs 2 HP/);
  assert.throws(() => dispatch(combat, { type: 'playCard', cardInstanceId: 'p', targetId: combat.enemies[0].id }), /Not enough HP/);
  assert.equal(combat.player.hp, 2, 'the player keeps their HP');
  assert.equal(combat.enemies[0].hp, enemyHp, 'the enemy is untouched');
  assert.ok(combat.piles.hand.some((card) => card.instanceId === 'p'), 'the card stays in hand');
  const enough = await lowHpFight(3);
  assert.equal(NonlethalHpRefusal(registries.cards.get('core.pyreLash'), enough.player), '');
  dispatch(enough, { type: 'playCard', cardInstanceId: 'p', targetId: enough.enemies[0].id });
  assert.equal(enough.player.hp, 1, 'at 3 HP the card is paid down to 1');
  assert.ok(enough.enemies[0].hp < enough.enemies[0].maxHp, 'and the hit lands');
});

test('the simbot never offers a play whose HP cost would kill', async () => {
  const { affordableCards } = await import('../tools/simbot.mjs');
  assert.deepEqual(affordableCards(registries, await lowHpFight(2)).map((card) => card.cardId), []);
  assert.deepEqual(affordableCards(registries, await lowHpFight(10)).map((card) => card.cardId), ['core.pyreLash']);
});

// Review of #2819: a step that eases a drawback drops its words from the rules text, the face and the picker shows the change.
test('drawback-easing upgrade steps drop the drawback from the text and face, and the picker names the change', async () => {
  const { applyUpgradeSteps } = await import('../src/model/cardUpgrade.js');
  const { cardPlainText } = await import('../src/ui/components/card.js');
  const { cardUpgradeChanges } = await import('../src/ui/models/CardUpgradeModel.js');
  const { profile } = await import('./helpers/fixcore-combat-rules.mjs');
  const rules = { combatExpansionVersion: 2, gameProfile: profile };
  const face = (cardId, steps) => cardPlainText(registries, { cardId, instanceId: `t-${cardId}`, upgraded: !!steps, ...(steps ? { upgradeSteps: steps } : {}) }, { rules });
  const cases = [
    ['base.ethereal', { k: 'fx', fx: 'unethereal' }, /Ethereal/, 'keywords'],
    ['base.retain-block', { k: 'fx', fx: 'steady' }, /Stamina each play/, 'COST'],
    ['base.cost-per-use', { k: 'fx', fx: 'steady' }, /Stamina each play/, 'COST'],
    ['core.backstep', { k: 'fx', fx: 'unexhaust' }, /Exhaust/, 'keywords'],
  ];
  for (const [cardId, step, drawback, label] of cases) {
    const base = registries.cards.get(cardId);
    const after = applyUpgradeSteps(base, [step]);
    assert.match(face(cardId), drawback, `${cardId}: the drawback shows before the step`);
    assert.doesNotMatch(face(cardId, [step]), drawback, `${cardId} after ${step.fx}: ${face(cardId, [step])}`);
    assert.doesNotMatch(after.textTemplate || '', drawback, `${cardId} after ${step.fx}: rules text`);
    for (const line of after.faceTemplate || []) assert.doesNotMatch(line, drawback, `${cardId} after ${step.fx}: face line`);
    const changes = cardUpgradeChanges(registries, base, after);
    assert.ok(changes.some((row) => row.label.toLowerCase().includes(label.toLowerCase())), `${cardId} after ${step.fx}: the picker names a change (${JSON.stringify(changes)})`);
  }
});

test("a lesson card's grade text names its drawback keyword (Quickstep's Exhaust shows in Core)", async () => {
  const { playingCardDefinition } = await import('../src/model/playingCard.js');
  const { profile } = await import('./helpers/fixcore-combat-rules.mjs');
  for (const ref of [{ cardId: 'quickstep' }, { cardId: 'quickstep', abilityRank: 3 }]) {
    const def = playingCardDefinition(registries, ref, { rules: { combatExpansionVersion: 2, gameProfile: profile } });
    assert.match(def.textTemplate, /Exhaust\.$/, JSON.stringify(ref));
  }
  for (const grade of registries.cards.get('quickstep').gradeProfiles) assert.match(grade.textTemplate, /Exhaust\.$/, `rank ${grade.rank}`);
});

// Review of #2819 (item 12): each reachable Evade card's upgrade eases its drawback.
test("each reachable Evade card's upgrade eases its drawback", async () => {
  const { createRng } = await import('../src/engine/rng.js');
  const { createRunCombat } = await import('../src/engine/runCombat.js');
  const { cardPlayCosts } = await import('../src/engine/combat.js');
  const { nextUpgradeOptions } = await import('../src/model/cardUpgradeLimits.js');
  const cost = (cardId, upgraded) => {
    const run = createRunState({ registries, classId: 'rogue', seed: 511, profileMeta: unlocked });
    const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
    combat.piles.hand.push({ instanceId: 'e', cardId, upgraded });
    combat.player.stamina = combat.player.maxStamina = 20;
    return cardPlayCosts(combat, 'e').stamina;
  };
  assert.equal(cost('core.evade', true), cost('core.evade', false) - 1, 'Evade+ costs 1 Stamina less');
  assert.equal(cost('core.closingDodge', true), cost('core.closingDodge', false) - 1, 'Closing Dodge+ costs 1 Stamina less');
  const { upgradedDefinition } = await import('../src/model/cardUpgrade.js');
  assert.ok(!upgradedDefinition(registries.cards.get('core.backstep')).keywords.includes('exhaust'), 'Backstep+ no longer Exhausts');
  // Quickstep is a ranked ability card: an authored upgrade never applies to it (projectGameCard), so its upgrade path is the
  // rolled menu, which offers removing Exhaust on every roll it can.
  const quickstep = registries.cards.get('quickstep');
  const offered = new Set();
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) for (const step of nextUpgradeOptions({ seed, gameProfile: registries.gameProfile, rangePolicy: {} }, { instanceId: `q${seed}`, cardId: 'quickstep', upgraded: false }, quickstep, registries, 40, { noAuthored: true })) if (step.k === 'fx') offered.add(step.fx);
  assert.ok(offered.has('unexhaust'), 'Quickstep may roll the drop-Exhaust upgrade');
});

// Review of #2819 (Codex): a ranked ability card's grade table ignored every rolled step, so the offered drop-Exhaust did nothing.
test('a ranked ability card is offered only drawback-removal steps, and drop-Exhaust really keeps it out of the exhaust pile', async () => {
  const { createRng } = await import('../src/engine/rng.js');
  const { createRunCombat } = await import('../src/engine/runCombat.js');
  const { dispatch } = await import('../src/engine/combat.js');
  const { nextUpgradeOptions } = await import('../src/model/cardUpgradeLimits.js');
  for (const cardId of ['quickstep', 'kickOff', 'warcry', 'reclamation', 'vanish', 'smokeBomb', 'perfectHeist']) {
    const def = registries.cards.get(cardId);
    assert.ok(Array.isArray(def.gradeProfiles) && def.keywords.includes('exhaust'), `${cardId} is a ranked card that Exhausts`);
    const offered = nextUpgradeOptions({ seed: 3, gameProfile: registries.gameProfile, rangePolicy: {} }, { instanceId: `o-${cardId}`, cardId, upgraded: false }, def, registries, 40, { noAuthored: true });
    assert.deepEqual(offered.map((step) => `${step.k}:${step.fx}`), ['fx:unexhaust'], `${cardId}: only the step that applies is offered`);
    const run = createRunState({ registries, classId: 'rogue', seed: 511, profileMeta: unlocked });
    const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
    for (const pile of Object.values(combat.piles)) pile.length = 0;
    for (let i = 0; i < 6; i += 1) combat.piles.draw.push({ instanceId: `d${i}`, cardId: 'core.defend', upgraded: false });
    combat.piles.hand.push({ instanceId: 'plain', cardId, upgraded: false }, { instanceId: 'eased', cardId, upgraded: true, upgradeSteps: [{ k: 'fx', fx: 'unexhaust' }] });
    // Core's 70% enemy HP tiers (owner, 2026-11-18) leave a 12-HP soldier these damage cards can kill mid-test; keep it standing.
    Object.assign(combat.enemies[0], { hp: 500, maxHp: 500 });
    combat.player.stamina = combat.player.maxStamina = 40;
    combat.player.mana = combat.player.maxMana = 40;
    for (const id of ['plain', 'eased']) {
      try { dispatch(combat, { type: 'playCard', cardInstanceId: id, targetId: combat.enemies[0].id }); }
      catch { dispatch(combat, { type: 'playCard', cardInstanceId: id }); }
    }
    const where = (id) => Object.entries(combat.piles).filter(([, pile]) => pile.some((card) => card.instanceId === id)).map(([name]) => name);
    assert.deepEqual(where('plain'), ['exhaust'], `${cardId}: the plain copy Exhausts`);
    assert.ok(!where('eased').includes('exhaust') && where('eased').length === 1, `${cardId}: the upgraded copy does not (${where('eased')})`);
  }
});

test('a disabled ally card says plainly what its ally part does with no allies, and so do the ally tooltips', async () => {
  for (const id of ALLY_CARDS) assert.match(registries.cards.get(id).textTemplate, /with no allies|no ally/i, id);
  const raw = JSON.parse((await import('node:fs')).readFileSync(new URL('../content/framework/terms.json', import.meta.url), 'utf8'));
  const tip = (id) => raw.terms.find((row) => row.id === id)?.canonicalText || '';
  assert.doesNotMatch(tip('term.tooltip.targetAllAllies'), /including the acting character/);
  assert.match(tip('term.tooltip.targetAllAllies'), /solo fight it affects no one/);
  assert.match(tip('term.tooltip.targetAlly'), /solo fight it affects no one/);
});
