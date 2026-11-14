// Owner, 2026-11-14: the number shown, the number floated and the HP that changes are one number, and the cost shown is the cost paid.
//   node --test tests/core-shown-equals-dealt.test.mjs
//
// (a) before every player card play the face number of each hit (previewCard against the aimed target) and the face cost are read; after it
//     resolves each hit's HP loss equals the number shown and the SP / MP spent equal the cost shown;
// (b) before every enemy action the intent number against the player is read (the enemyMoveStarted receipt); with reactions declined the
//     player's HP loss equals it, with a reaction taken it equals the number the prompt showed for that option;
// (c) for every damage event the floater model's number equals the HP lost, and a 0-HP hit that something absorbed yields the absorbed word;
// (d) named cases: Block, Poise, a defensive stance, a Counter stance, an undiscovered weakness, a multi-hit card, an ALL card with unequal
//     targets, an Evade stack, a farther target that needs Advance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch, previewCard } from '../src/engine/combat.js';
import { IncomingHpLoss } from '../src/engine/enemyIntentReceipt.js';
import { firstAffordableCard, botCardTargetId, refusalsFor } from '../tools/simbot.mjs';
import { guardHitFloatParts, outcomeKindForEvent } from '../src/ui/fx.js';
import { floaterWordShown } from '../src/ui/models/FloaterPolicyModel.js';
import { withoutWeaknesses } from './withoutWeaknesses.mjs';
import { summarizeCardOption } from '../src/ui/models/CardOptionSummaryModel.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const META = { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } };
const CLASSES = ['reaver', 'rogue', 'starseer', 'herald'];
const FIGHTS = 152;
const POOL = reg.encounters.all().filter(row => ['normal', 'elite'].includes(row.pool)).map(row => row.enemies);

function fightFor(classId, seed, enemyIds = null, { weaknesses = true } = {}) {
  const run = createRunState({ registries: reg, classId, seed, profileMeta: META });
  // A few of the class's own cards beside the starting deck, so multi-hit, ALL-enemy and spell cards are played too.
  const own = reg.cards.all().filter(card => card.class === classId && card.type !== 'power' && !card.id.startsWith('core.')).slice(seed % 7, (seed % 7) + 5);
  own.forEach((card, i) => run.deck.push({ instanceId: `x${i}`, cardId: card.id, upgraded: false }));
  const combat = createRunCombat({ registries: reg, run, rng: createRng(seed), enemyIds: enemyIds || POOL[seed % POOL.length] });
  return weaknesses ? combat : withoutWeaknesses(combat);
}

const livingEnemies = combat => combat.enemies.filter(enemy => enemy.alive);
const isRefusal = error => !!error?.playRefusal || /refus|cannot|not enough|illegal|unknown/i.test(String(error?.message));

/** What the face says before `cardInstanceId` is played at `targetId`: per-enemy damage sequences and the three costs. */
function faceOf(combat, cardInstanceId, targetId) {
  const preview = previewCard(combat, cardInstanceId, targetId, undefined, { rangeRoute: 'advance' });
  // Rows that only run when a condition holds are priced at their potential value, so the rows are kept apart: `rows` per enemy, in order.
  const perEnemy = new Map(), rows = new Map();
  preview.values.forEach((row, index) => {
    if (row.op !== 'damage' || row.target === 'self' || row.target === 'randomEnemy' || row.target === 'ally') return;
    for (const [id, hits] of Object.entries(row.perTargetHitDamages || {})) {
      if (row.target === 'enemy' && id !== targetId) continue;
      const list = hits.map(Math.floor);
      perEnemy.set(id, [...(perEnemy.get(id) || []), ...list]);
      rows.set(id, [...(rows.get(id) || []), { hits: list, conditional: !!preview.chargedEffects?.[index]?.if }]);
    }
  });
  return { preview, perEnemy, rows, energy: preview.costIsX ? null : preview.cost, stamina: preview.costIsX ? null : preview.staminaCost || 0, mana: preview.manaCost || 0 };
}

const sum = (events, type) => events.filter(event => event.type === type).reduce((total, event) => total + (event.amount || 0), 0);

const enemyAlive = (combat, id) => !!combat.enemies.find(row => row.id === id)?.alive;

/** Plays one card and asserts the face against what happened. Returns false when the engine refused the play. */
function playChecked(combat, card, targetId, tally, label) {
  let face;
  try { face = faceOf(combat, card.instanceId, targetId); } catch (error) { if (isRefusal(error)) return false; throw error; }
  const def = face.preview.resolvedDefinition;
  const counterCard = def?.cardTags?.includes?.('maneuver:counter') || face.preview.type === 'counter' || face.preview.values.some(row => row.counterReturn);
  const enemiesBefore = new Map(combat.enemies.map(enemy => [enemy.id, enemy.hp]));
  const start = combat.eventLog.length;
  try { dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId, rangeRoute: 'advance' }); } catch (error) { if (isRefusal(error)) return false; throw error; }
  // An enemy that answers the card with a reaction of its own changes the target mid-card, which no face can price: the prompt is declined
  // and only the cost is compared for that play.
  let safety = 0;
  while (combat.pendingReaction && safety++ < 20) dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null });
  const events = combat.eventLog.slice(start);
  const enemyAnswered = events.some(event => event.type === 'combatEnemyReactionStacked');
  const played = events.findIndex(event => event.type === 'cardPlayed');
  assert.ok(played >= 0, `${label}: the card was played`);
  // (a) cost: what the face said is what was spent.
  const paid = events.slice(0, played);
  if (face.energy !== null) {
    assert.equal(sum(paid, 'energySpent'), face.energy, `${label}: ${card.cardId} energy paid equals the face cost`);
    assert.equal(sum(paid, 'staminaSpent'), face.stamina, `${label}: ${card.cardId} stamina paid equals the face cost`);
    assert.equal(sum(paid, 'manaSpent'), face.mana, `${label}: ${card.cardId} mana paid equals the face cost`);
    tally.costs++;
  }
  // (a) damage: each hit's HP loss equals the number shown.
  if (!counterCard && !enemyAnswered) {
    const dealt = new Map();
    // A Counter's return can stagger the player in the middle of a multi-hit card, which changes the later hits (no matching-stance bonus,
    // Vulnerable): the hits from that point are another action's business, and the ones before it must match the face.
    const cut = events.findIndex(event => event.type === 'playerStaggered');
    for (const event of cut >= 0 ? events.slice(0, cut) : events) {
      if (event.type !== 'damageDealt' || event.sourceId !== 'player' || event.cardInstanceId !== card.instanceId || !event.isAttack) continue;
      (dealt.get(event.targetId) || dealt.set(event.targetId, []).get(event.targetId)).push(event.hpLoss);
    }
    // An Evade stack cancels a hit outright (an attackMissed event, no damage event): the face priced those leading hits at 0.
    const evaded = new Map();
    for (const event of events) if (event.type === 'attackMissed' && event.cardInstanceId === card.instanceId) evaded.set(event.targetId, (evaded.get(event.targetId) || 0) + 1);
    for (const [id, priced] of face.perEnemy) {
      const gone = Math.min(evaded.get(id) || 0, priced.length);
      assert.ok(priced.slice(0, gone).every(amount => amount === 0), `${label}: ${card.cardId} -> ${id} the ${gone} evaded hit(s) were priced at 0 (${priced})`);
      const got = dealt.get(id) || [];
      // The rows' hits, without the leading ones an Evade stack cancelled.
      let skip = gone;
      const list = (face.rows.get(id) || []).map(row => {
        const drop = Math.min(skip, row.hits.length);
        skip -= drop;
        return { conditional: row.conditional, hits: row.hits.slice(drop) };
      });
      // A conditional row that did not run is not dealt: the hits are the rows' hits with each such row either run or skipped. Hits a death
      // cuts off the end are not dealt either.
      const explains = (at, from) => {
        if (from === got.length) return true;
        if (at === list.length) return false;
        const { hits, conditional } = list[at];
        const take = Math.min(hits.length, got.length - from);
        return (got.slice(from, from + take).every((amount, i) => amount === hits[i]) && explains(at + 1, from + take)) || (conditional && explains(at + 1, from));
      };
      assert.ok(explains(0, 0), `${label}: ${card.cardId} -> ${id} HP lost per hit [${got}] equals the face [${priced}]`);
      const sure = list.filter(row => !row.conditional).reduce((n, row) => n + row.hits.length, 0);
      if (enemyAlive(combat, id) && cut < 0) assert.ok(got.length >= sure, `${label}: ${card.cardId} -> ${id} hits are missing without a death`);
      tally.hits += got.length;
    }
    void enemiesBefore;
  }
  return true;
}

/** (c) every damage event's floater number is the HP lost; a 0-HP hit something absorbed shows the absorbed word. */
function checkFloaters(events, tally, label) {
  for (const event of events) {
    if (event.type !== 'damageDealt') continue;
    const parts = guardHitFloatParts(event, 0);
    if (event.hpLoss > 0) assert.equal(parts.damage?.text, `-${event.hpLoss}`, `${label}: the floater is the HP lost`);
    else {
      assert.equal(parts.damage, null, `${label}: a hit that cost no HP floats no number`);
      if ((event.blocked || 0) > 0 || (event.poiseAbsorbed || 0) > 0) assert.equal(floaterWordShown(outcomeKindForEvent(event)), 'blocked', `${label}: a hit absorbed whole shows the Blocked word ${JSON.stringify({ ...event, abilityBefore: undefined, cardTags: undefined, rangeOrigin: undefined, damageReceipt: undefined })}`);
    }
    tally.floaters++;
  }
}

/**
 * (b) walks an enemy turn's events: each action's opening receipt (enemyMoveStarted / combatHitStarted) names the HP the player will lose;
 * the player's HP lost in that action equals it, or the number the taken reaction's option showed.
 */
function checkEnemyActions(events, reactionNumbers, tally, label) {
  let action = null;
  let contact = null;
  const settle = (row, what) => {
    if (!row) return;
    const want = row.reaction !== undefined ? row.reaction : row.shown;
    assert.equal(row.lost, want, `${label}: ${what} ${row.moveId} cost the player ${row.lost} HP, the intent said ${want}${row.reaction !== undefined ? ' (the taken reaction option)' : ''}`);
    tally.actions++;
  };
  for (const event of events) {
    if (event.type === 'combatReactionOffered') continue;
    if ((event.type === 'enemyMoveStarted' || event.type === 'combatHitStarted') && event.intentPreview) {
      const shown = IncomingHpLoss(event.intentPreview);
      const row = shown === null ? null : { moveId: event.moveId, shown, lost: 0, reaction: reactionNumbers.get(event.sourceId) };
      if (event.intentPreview.damageScope === 'contact') { settle(contact, 'contact'); contact = row; } else { settle(action, 'action'); action = row; }
      if (row && reactionNumbers.has(event.sourceId)) reactionNumbers.delete(event.sourceId);
    }
    if (event.type === 'damageDealt' && event.targetId === 'player' && event.sourceId !== 'player') {
      if (action) action.lost += event.hpLoss;
      if (contact) contact.lost += event.hpLoss;
    }
    if (event.type === 'enemyMoveEnded') { settle(contact, 'contact'); settle(action, 'action'); action = contact = null; }
  }
  settle(contact, 'contact'); settle(action, 'action');
}

function playFight(classId, seed, tally) {
  const combat = fightFor(classId, seed);
  const label = `${classId} seed ${seed}`;
  const takeReactions = seed % 2 === 1;
  for (let turn = 0; turn < 5 && !combat.result; turn++) {
    const refused = refusalsFor(combat);
    for (let plays = 0; plays < 12 && !combat.result && combat.phase === 'player'; plays++) {
      if (combat.pendingReaction || combat.pendingCardChoice || combat.pendingAbilityDiscard) break;
      const card = firstAffordableCard(reg, combat, refused);
      if (!card) break;
      const living = livingEnemies(combat);
      if (!living.length) break;
      const targetId = botCardTargetId(reg, combat, card, living[(turn + plays) % living.length].id);
      const mark = combat.eventLog.length;
      if (!playChecked(combat, card, targetId, tally, label)) refused.add(card.instanceId);
      checkFloaters(combat.eventLog.slice(mark), tally, label);
      if (combat.pendingReaction || combat.pendingCardChoice || combat.pendingAbilityDiscard) break;
    }
    if (combat.result) break;
    // End the turn; every enemy action resolves, pausing at each reaction prompt.
    const mark = combat.eventLog.length;
    const reactionNumbers = new Map();
    let safety = 0;
    if (combat.phase === 'player' && !combat.pendingReaction) dispatch(combat, { type: 'endTurn' });
    while ((combat.pendingReaction || combat.pendingCardChoice || combat.pendingAbilityDiscard) && safety++ < 40 && !combat.result) {
      if (combat.pendingReaction) {
        const offer = combat.pendingReaction;
        const option = takeReactions ? offer.options.find(row => Number.isFinite(row.incomingHp)) : null;
        // The prompt states the incoming action and each option's result as the HP the player will lose.
        if (Number.isFinite(offer.incomingHp)) assert.ok(offer.incomingHp >= 0, `${label}: the prompt's incoming HP`);
        if (option) { reactionNumbers.set(offer.sourceId, option.incomingHp); tally.reactions++; }
        dispatch(combat, { type: 'chooseReaction', offerId: offer.id, optionId: option ? option.id : null });
      } else if (combat.pendingCardChoice) {
        const pending = combat.pendingCardChoice;
        dispatch(combat, { type: 'chooseCards', cardInstanceIds: pending.candidateIds.slice(0, pending.count) });
      } else dispatch(combat, { type: 'chooseDiscard', cardInstanceIds: [] });
    }
    const events = combat.eventLog.slice(mark);
    checkFloaters(events, tally, label);
    // With a reaction taken the number to match is the option's; a multi-action turn mixes both, so only the actions with no reaction are
    // compared against their own intent receipt, and the reaction ones against the option.
    checkEnemyActions(events, reactionNumbers, tally, label);
    reactionNumbers.clear();
  }
}

test(`${FIGHTS} seeded fights across the four classes: face = dealt, intent = lost, floater = HP lost, cost shown = cost paid`, () => {
  const tally = { hits: 0, costs: 0, actions: 0, floaters: 0, reactions: 0 };
  for (let i = 0; i < FIGHTS; i++) playFight(CLASSES[i % CLASSES.length], 100 + i, tally);
  if (process.env.TALLY) console.log(JSON.stringify(tally));
  assert.ok(tally.hits > 300, `enough damaging hits were checked: ${tally.hits}`);
  assert.ok(tally.costs > 400, `enough costs were checked: ${tally.costs}`);
  assert.ok(tally.actions > 150, `enough enemy actions were checked: ${tally.actions}`);
  assert.ok(tally.floaters > 300, `enough floaters were checked: ${tally.floaters}`);
});

// ---- (d) the named cases, each on a fixture that sets exactly that state ----------------------------------------------------------

function fixture({ classId = 'reaver', enemies = ['wanderingSoldier'], hand = 'core.strike', weaknesses = false } = {}) {
  const combat = fightFor(classId, 7, enemies, { weaknesses });
  combat.enemies.forEach(enemy => { Object.assign(enemy, { hp: 400, maxHp: 400, block: 0, statuses: {}, attributes: { ...enemy.attributes, dexterity: 0 }, persistentPoise: { value: 0, max: 20 } }); delete enemy.combatStance; delete enemy.combatCounter; });
  combat.player.energy = 9; combat.player.stamina = 9; combat.player.mana = 9; combat.player.hp = 100; combat.player.maxHp = 100;
  const card = combat.piles.hand[0];
  card.cardId = hand; card.upgraded = false;
  return { combat, card };
}
const check = (combat, card, targetId, label) => {
  const tally = { hits: 0, costs: 0 };
  assert.ok(playChecked(combat, card, targetId, tally, label), `${label}: the card was played`);
  return tally;
};

test('a target with Block, a target with Poise, and both', () => {
  for (const [label, state] of [['Block', { block: 5 }], ['Poise', { persistentPoise: { value: 10, max: 20 } }], ['Block and Poise', { block: 5, persistentPoise: { value: 10, max: 20 } }]]) {
    const { combat, card } = fixture();
    Object.assign(combat.enemies[0], state);
    const shown = faceOf(combat, card.instanceId, 'e1').perEnemy.get('e1');
    assert.ok(shown[0] < 12, `${label}: the face already is the HP after defences (${shown})`);
    assert.ok(check(combat, card, 'e1', label).hits >= 1);
  }
});

test('a target in a defensive stance', () => {
  for (const hand of ['core.strike', 'greatswordSunderingHew', 'core.reaverSpecial']) {
    const { combat, card } = fixture({ hand });
    combat.enemies[0].combatStance = { maneuver: 'defend', camp: 'physical', range: 'melee' };
    const open = fixture({ hand }).combat; // the same hit with no stance, for comparison
    const baseline = faceOf(open, open.piles.hand[0].instanceId, 'e1').perEnemy.get('e1')[0];
    const shown = faceOf(combat, card.instanceId, 'e1').perEnemy.get('e1')[0];
    if (hand !== 'core.strike') assert.notEqual(shown, baseline, `${hand}: the Defend stance moves the face (${shown} against ${baseline})`);
    check(combat, card, 'e1', `defensive stance ${hand}`);
  }
});

test('a target in a Counter stance', () => {
  const { combat, card } = fixture();
  combat.enemies[0].combatStance = { maneuver: 'counter', camp: 'physical', range: 'melee' };
  combat.enemies[0].combatCounter = { charges: 1, expiresOnOwnerCycle: 9, carrier: { combatProfile: { camp: 'physical', maneuver: 'counter', range: 'melee' } }, serial: 1 };
  check(combat, card, 'e1', 'Counter stance');
});

test('an undiscovered weakness counts in the number shown and in the hit dealt', () => {
  const { combat, card } = fixture({ weaknesses: true });
  const enemy = combat.enemies[0];
  enemy.weaknesses = [{ to: 'slashing', effect: 'damage', amount: 25 }, { to: 'blunt', effect: 'damage', amount: 25 }];
  const none = fixture().combat;
  const plain = faceOf(none, none.piles.hand[0].instanceId, 'e1').perEnemy.get('e1')[0];
  const shown = faceOf(combat, card.instanceId, 'e1').perEnemy.get('e1')[0];
  assert.ok(shown > plain, `the weakness is in the number: ${shown} > ${plain}`);
  check(combat, card, 'e1', 'weakness');
});

test('a multi-hit card shows each hit and each hit lands for it', () => {
  const { combat, card } = fixture({ classId: 'starseer', hand: 'supernova' });
  combat.enemies[0].block = 4; combat.enemies[0].persistentPoise = { value: 6, max: 20 };
  combat.player.energy = 3; combat.player.stamina = 3; combat.player.mana = 9;
  const shown = faceOf(combat, card.instanceId, 'e1').perEnemy.get('e1');
  assert.ok(shown.length >= 2, `several hits are shown: ${shown}`);
  assert.ok(check(combat, card, 'e1', 'multi-hit').hits >= 2);
});

test('an ALL card with unequal targets shows one number or min-max, and each enemy loses what it was shown', async () => {
  const { cardFaceLines } = await import('../src/model/cardFaceText.js');
  const { combat, card } = fixture({ enemies: ['wanderingSoldier', 'wanderingSoldier', 'wanderingSoldier'], hand: 'core.sweep' });
  combat.enemies[1].block = 5; combat.enemies[2].persistentPoise = { value: 8, max: 20 };
  const face = faceOf(combat, card.instanceId, undefined);
  const lines = cardFaceLines(face.preview.resolvedDefinition, face.preview, reg).map(line => line.html.replace(/<[^>]+>/g, '')).join(' | ');
  const perEnemy = [...face.perEnemy.values()].map(hits => hits[0]);
  assert.ok(new Set(perEnemy).size > 1, `the enemies lose different amounts: ${perEnemy}`);
  assert.match(lines, new RegExp(`${Math.min(...perEnemy)}-${Math.max(...perEnemy)}`), `the face reads min-max: ${lines}`);
  const events = [];
  const start = combat.eventLog.length;
  const tally = { hits: 0, costs: 0 };
  assert.ok(playChecked(combat, card, undefined, tally, 'ALL'), 'played');
  void events; void start;
  assert.ok(tally.hits >= 3, `every enemy was hit: ${tally.hits}`);
});

test('a target with an Evade stack is priced at 0 and spends one stack per hit', () => {
  const { combat, card } = fixture({ classId: 'starseer', hand: 'supernova' });
  combat.player.energy = 3; combat.player.stamina = 3; combat.player.mana = 9;
  // Evade belongs to the defender: the player's own Evade is read by the enemy's intent.
  combat.enemies[0].statuses = { evade: { stacks: 1 } };
  const shown = faceOf(combat, card.instanceId, 'e1').perEnemy.get('e1');
  assert.equal(shown[0], 0, 'the first hit meets the Evade stack');
  assert.ok(shown.slice(1).some(amount => amount > 0), `the stack is spent, so later hits land: ${shown}`);
  check(combat, card, 'e1', 'Evade');
});

test('a farther target that needs Advance: the face cost is the cost paid', () => {
  const { combat, card } = fixture({ enemies: ['wanderingSoldier', 'wanderingSoldier', 'wanderingSoldier'] });
  combat.rangeState.engagements['["enemy:e3","player:player"]'] = 1;
  const near = faceOf(combat, card.instanceId, 'e1'), far = faceOf(combat, card.instanceId, 'e3');
  assert.equal(far.energy, near.energy + 1, 'Advance is part of the face cost of the farther target');
  check(combat, card, 'e3', 'Advance');
});

test('the reaction prompt states the incoming action and each option as the HP the player will lose, with its real cost', () => {
  // The fight is deterministic, so searching seeds for the first prompt is too.
  for (let seed = 1; seed < 80; seed++) {
    const c = fightFor('rogue', seed, ['wanderingSoldier']);
    for (let turn = 0; turn < 3 && !c.pendingReaction && !c.result; turn++) {
      const card = c.piles.hand[0]; card.cardId = 'core.counter'; card.upgraded = false;
      dispatch(c, { type: 'endTurn' });
    }
    const offer = c.pendingReaction;
    if (!offer) continue;
    assert.ok(Number.isFinite(offer.incomingHp), 'the prompt carries the incoming HP');
    const declinedLoss = offer.incomingHp;
    for (const option of offer.options) {
      assert.ok(Number.isFinite(option.incomingHp), `option ${option.id} carries its result`);
      assert.ok(option.incomingHp <= declinedLoss, 'a reaction never raises the HP lost');
      // The label names the SP the option pays, and that is what choosing it pays.
      assert.ok(summarizeCardOption(reg, c, option).costs.includes(`${option.staminaCost} SP`), `the label shows ${option.staminaCost} SP`);
    }
    const option = offer.options[0];
    const hp = c.player.hp, start = c.eventLog.length;
    dispatch(c, { type: 'chooseReaction', offerId: offer.id, optionId: option.id });
    const events = c.eventLog.slice(start), played = events.findIndex(event => event.type === 'cardPlayed');
    assert.equal(sum(events.slice(0, played), 'staminaSpent'), option.staminaCost, 'choosing the option pays the cost its label showed');
    while (c.pendingReaction) dispatch(c, { type: 'chooseReaction', offerId: c.pendingReaction.id, optionId: null });
    assert.equal(hp - c.player.hp, option.incomingHp, 'and the HP lost is the number the prompt showed for it');
    return;
  }
  assert.fail('no reaction prompt appeared in 80 seeds');
});
