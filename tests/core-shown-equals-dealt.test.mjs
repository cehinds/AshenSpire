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
import { projectCombatIntent } from '../src/ui/models/CombatIntentProjectionModel.js';
import { DragFaceQuote, DragFaceTargetId } from '../src/ui/models/DragFaceModel.js';

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
    // The HP actually lost: a killing blow's overkill is not part of it.
    const lost = Number.isFinite(event.hpRemoved) ? Math.min(event.hpLoss, event.hpRemoved) : event.hpLoss;
    if (lost > 0) assert.equal(parts.damage?.text, `-${lost}`, `${label}: the floater is the HP lost`);
    else if (event.hpLoss > 0) assert.equal(parts.damage, null, `${label}: a hit on an already-empty target floats no number`);
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

/**
 * The number each attacking enemy shows on its intent as the player's turn ends (the screen's own projectCombatIntent) is what its first action
 * then costs the player, enemies acting in order: a later attacker's number already holds the Block and Poise the earlier ones spend.
 */
function forecastBeforeTurn(combat) {
  const out = new Map();
  // An armed Counter answers the first hit it covers, kills or staggers the attacker mid-phase and moves what the next one meets; that
  // interplay is priced per action at its own receipt (checkEnemyActions), not forecast across the turn.
  if (combat.player.combatCounter?.charges > 0) return out;
  for (const enemy of livingEnemies(combat)) {
    if (enemy.intent?.kind !== 'attack' || enemy.intent.damage == null) continue;
    const shown = projectCombatIntent(combat, enemy.id)?.projectedDamage;
    if (shown && shown.basis === 'hp' && shown.min === shown.max) out.set(enemy.id, { moveId: enemy.intent.moveId, shown: shown.max });
  }
  return out;
}
function checkForecast(forecast, events, tally, label) {
  for (const [id, { moveId, shown }] of forecast) {
    const start = events.findIndex(event => event.type === 'enemyMoveStarted' && event.sourceId === id);
    if (start < 0 || events[start].moveId !== moveId) continue;
    let lost = 0;
    for (const event of events.slice(start + 1)) {
      if (event.type === 'enemyMoveEnded' && event.sourceId === id) break;
      if (event.type === 'damageDealt' && event.sourceId === id && event.targetId === 'player') lost += event.hpLoss;
    }
    assert.equal(lost, shown, `${label}: ${id} ${moveId} was shown at ${shown} and cost the player ${lost}`);
    tally.forecasts++;
  }
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
    const forecast = takeReactions ? new Map() : forecastBeforeTurn(combat);
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
    checkForecast(forecast, events, tally, label);
    reactionNumbers.clear();
  }
}

test(`${FIGHTS} seeded fights across the four classes: face = dealt, intent = lost, floater = HP lost, cost shown = cost paid`, () => {
  const tally = { hits: 0, costs: 0, actions: 0, floaters: 0, reactions: 0, forecasts: 0 };
  for (let i = 0; i < FIGHTS; i++) playFight(CLASSES[i % CLASSES.length], 100 + i, tally);
  if (process.env.TALLY) console.log(JSON.stringify(tally));
  assert.ok(tally.hits > 300, `enough damaging hits were checked: ${tally.hits}`);
  assert.ok(tally.costs > 400, `enough costs were checked: ${tally.costs}`);
  assert.ok(tally.forecasts > 60, `enough shown intents were compared with what they cost: ${tally.forecasts}`);
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
      assert.ok(summarizeCardOption(reg, c, option).costs.includes(`${option.staminaCost} Stamina`), `the label shows ${option.staminaCost} Stamina`);
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

// ---- W2-J (b): a later attacker's intent holds EVERY action of the enemies ahead of it, not only their first ----------------------

test('a later attacker is forecast after an earlier enemy has played all of its planned actions', () => {
  let checked = 0;
  for (const block of [0, 6, 10, 13, 20, 30]) {
    const { combat } = fixture({ enemies: ['wanderingSoldier', 'wanderingSoldier'] });
    const [first, second] = combat.enemies;
    // The earlier enemy has three attacks this turn (its head and two planned follow-ups); the later one has one.
    for (const enemy of [first, second]) { enemy.intent = { ...enemy.intent, kind: 'attack', moveId: 'slash', damage: 8, hits: 1 }; enemy.planDue = true; enemy.skipNextTurn = false; }
    first.plannedMoves = [{ moveId: 'slash', sp: 1 }, { moveId: 'slash', sp: 1 }];
    first.maxStamina = first.stamina = first.fixCoreStaminaRemaining = 12;
    combat.player.block = block; combat.player.hp = 100; combat.player.maxHp = 100;
    const shown = projectCombatIntent(combat, second.id)?.projectedDamage;
    assert.ok(shown && shown.min === shown.max, `block ${block}: the later number is exact (${JSON.stringify(shown)})`);
    const start = combat.eventLog.length;
    dispatch(combat, { type: 'endTurn' });
    while (combat.pendingReaction) dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null });
    const events = combat.eventLog.slice(start);
    const firstHits = events.filter(event => event.type === 'damageDealt' && event.sourceId === first.id).length;
    let lost = 0, open = false;
    for (const event of events) {
      if (event.type === 'enemyMoveStarted' && event.sourceId === second.id) open = true;
      if (open && event.type === 'damageDealt' && event.sourceId === second.id && event.targetId === 'player') lost += event.hpLoss;
    }
    assert.ok(firstHits >= 2, `block ${block}: the earlier enemy acted more than once (${firstHits})`);
    assert.equal(lost, shown.max, `block ${block}: the later attacker was shown at ${shown.max} and cost ${lost}`);
    checked++;
  }
  assert.equal(checked, 6);
});

// ---- W2-J (a): a card dragged over a farther enemy shows THAT enemy's number and cost before release ----------------------------------

test('a drag over a farther enemy: the ghost face (DragFaceQuote) is the cost paid and the HP lost, and leaving restores the reference', () => {
  for (const hand of ['core.strike', 'greatswordSunderingHew']) {
    const { combat, card } = fixture({ enemies: ['wanderingSoldier', 'wanderingSoldier', 'wanderingSoldier'], hand });
    combat.rangeState.engagements['["enemy:e3","player:player"]'] = 1;
    combat.enemies[2].block = 5; // the far enemy also holds Block, so its number differs from the reference's
    const preview = (target, id, targetId, ranks) => previewCard(target, id, targetId, ranks, { rangeRoute: 'advance' });
    const quoteFor = targetId => DragFaceQuote({ preview, combat, instanceId: card.instanceId, targetId, targetName: id => id });
    const reference = quoteFor(DragFaceTargetId({ legal: false }));
    const far = quoteFor(DragFaceTargetId({ legal: true, targetId: 'e3' }));
    assert.equal(DragFaceTargetId({ legal: false, targetId: 'e3' }), null, 'a drop that is not legal prices no enemy');
    assert.equal(far.preview.targetName, 'e3', 'the quote names the enemy it prices');
    assert.ok(far.preview.cost > reference.preview.cost, `${hand}: Advance is in the far enemy's face cost (${far.preview.cost} against ${reference.preview.cost})`);
    const shownHits = far.preview.values.filter(row => row.op === 'damage').flatMap(row => row.perTargetHitDamages?.e3 || []).map(Math.floor);
    assert.ok(shownHits.length >= 1 && shownHits.every(amount => amount >= 0), `${hand}: the quote carries the hits against e3 (${shownHits})`);
    const start = combat.eventLog.length, hp = combat.enemies[2].hp;
    dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: 'e3', rangeRoute: 'advance' });
    while (combat.pendingReaction) dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null });
    const events = combat.eventLog.slice(start), played = events.findIndex(event => event.type === 'cardPlayed');
    assert.equal(sum(events.slice(0, played), 'energySpent'), far.preview.cost, `${hand}: the energy paid is what the ghost showed`);
    assert.equal(sum(events.slice(0, played), 'staminaSpent'), far.preview.staminaCost || 0, `${hand}: the stamina paid is what the ghost showed`);
    const lost = events.filter(event => event.type === 'damageDealt' && event.targetId === 'e3' && event.cardInstanceId === card.instanceId).map(event => event.hpLoss);
    assert.deepEqual(lost, shownHits.slice(0, lost.length), `${hand}: each hit's HP loss is the number the ghost showed`);
    assert.ok(hp - combat.enemies[2].hp === lost.reduce((a, b) => a + b, 0) && lost.length >= 1, `${hand}: the HP that left e3 is the hits shown`);
  }
});

test('the ghost prices the aimed enemy without moving the fight', () => {
  const { combat, card } = fixture({ enemies: ['wanderingSoldier', 'wanderingSoldier'] });
  const before = JSON.stringify([combat.player, combat.enemies, combat.piles.hand.length, combat.eventLog.length]);
  const preview = (target, id, targetId, ranks) => previewCard(target, id, targetId, ranks, { rangeRoute: 'advance' });
  DragFaceQuote({ preview, combat, instanceId: card.instanceId, targetId: 'e2' });
  DragFaceQuote({ preview, combat, instanceId: card.instanceId, targetId: null });
  assert.equal(JSON.stringify([combat.player, combat.enemies, combat.piles.hand.length, combat.eventLog.length]), before);
});

// ---- Review fix 2: a later intent holds what earlier enemies do to the player, not only their damage ------------------------------------

test('an earlier enemy that applies Vulnerable, then attacks, is in the later enemy\'s number (and a planned follow-up of the same enemy too)', () => {
  const base = reg.enemies.get('wanderingSoldier');
  const curse = { ...base, id: 'w2rCurser', moves: { hex: { intent: 'debuff', weight: 1, effects: [{ op: 'applyStatus', target: 'player', status: 'vulnerable', stacks: 2 }] },
    slash: base.moves.slash } };
  const custom = bindGameProfileRegistries(createRegistries({ ...applyGameProfileToContent(contentBundle, profile), enemies: [...applyGameProfileToContent(contentBundle, profile).enemies, curse] }), profile);
  for (const plan of [[], ['slash']]) {
    const run = createRunState({ registries: custom, classId: 'reaver', seed: 7, profileMeta: META });
    const combat = createRunCombat({ registries: custom, run, rng: createRng(7), enemyIds: ['w2rCurser', 'wanderingSoldier'] });
    const [first, second] = combat.enemies;
    for (const enemy of combat.enemies) Object.assign(enemy, { hp: 400, maxHp: 400, statuses: {}, planDue: true, skipNextTurn: false, maxStamina: 12, stamina: 12, fixCoreStaminaRemaining: 12 });
    first.intent = { ...first.intent, kind: 'debuff', moveId: 'hex', damage: null, hits: 1 };
    first.plannedMoves = plan.map(moveId => ({ moveId, sp: 1 }));
    second.intent = { ...second.intent, kind: 'attack', moveId: 'slash', damage: 8, hits: 1 };
    second.plannedMoves = [];
    combat.player.block = 0; combat.player.hp = 100; combat.player.maxHp = 100; combat.player.statuses = {};
    const shown = projectCombatIntent(combat, second.id)?.projectedDamage;
    assert.ok(shown && shown.min === shown.max, `plan ${plan}: exact (${JSON.stringify(shown)})`);
    const start = combat.eventLog.length;
    dispatch(combat, { type: 'endTurn' });
    while (combat.pendingReaction) dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null });
    const events = combat.eventLog.slice(start);
    assert.ok(events.some(event => event.type === 'statusApplied' && event.status === 'vulnerable' && event.targetId === 'player'), 'the earlier enemy applied Vulnerable');
    let lost = 0, open = false;
    for (const event of events) {
      if (event.type === 'enemyMoveStarted' && event.sourceId === second.id) open = true;
      if (open && event.type === 'damageDealt' && event.sourceId === second.id && event.targetId === 'player') lost += event.hpLoss;
    }
    assert.ok(lost > 0);
    assert.equal(lost, shown.max, `plan ${plan}: shown ${shown.max}, lost ${lost}`);
  }
});

// ---- Review fix 3: the preview spends a prepared Evade charge the way the real hit does ------------------------------------------------

test('a target holding one Evade stack AND a prepared Evade charge: one evaded hit spends both, in the preview as in the play', () => {
  const { combat, card } = fixture({ hand: 'base.multi-hit' });
  combat.enemies[0].statuses = { evade: { stacks: 1 } };
  combat.enemies[0].combatEvade = { charges: 1, bonus: 0 };
  const shown = faceOf(combat, card.instanceId, 'e1').perEnemy.get('e1');
  assert.equal(shown[0], 0, 'the first hit is evaded');
  assert.ok(shown.slice(1).every(amount => amount > 0), `the stack and the charge went together, so every later hit lands: ${shown}`);
  const tally = check(combat, card, 'e1', 'Evade stack + prepared charge');
  assert.ok(tally.hits >= 2);
  assert.equal(combat.enemies[0].combatEvade.charges, 0);
  assert.equal(combat.enemies[0].statuses.evade?.stacks || 0, 0);
});

// ---- Review fix 6: an enemy Smash into Block (Elite Wyrm Aspirant, tailSlam) ------------------------------------------------------------
// Reproduced at model level: the number on the intent IS the HP the move's first hit costs, at every Block and with or without a defensive
// stance. What the player saw as "0 shown, 22 lost" is the Elite's SECOND tailSlam (it plays two this turn): the first one spends the Block,
// the follow-up is a new action with its own number, shown when it begins. So the case asserts the shown number per action.

test('an enemy Smash into Block: the intent number equals the HP lost by that action, at Block 0, 10 and 32, in and out of Defend stance', () => {
  const mk = () => {
    const run = createRunState({ registries: reg, classId: 'reaver', seed: 1, profileMeta: META });
    const combat = createRunCombat({ registries: reg, run, rng: createRng(1), enemyIds: ['wyrmAspirant'] });
    combat.player.hp = combat.player.maxHp = 500;
    dispatch(combat, { type: 'endTurn' });
    while (combat.pendingReaction) dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null });
    combat.player.hp = combat.player.maxHp = 500;
    return combat;
  };
  let checked = 0, twoActions = false;
  for (const stance of [false, true]) for (const block of [0, 10, 32]) {
    const combat = mk();
    const enemy = combat.enemies[0];
    assert.equal(enemy.intent?.moveId, 'tailSlam', 'the fixture turn plays tailSlam');
    combat.player.block = block;
    if (stance) combat.player.combatStance = { maneuver: 'defend', camp: 'physical', id: 'defend' };
    const shown = projectCombatIntent(combat, enemy.id)?.projectedDamage;
    assert.ok(shown && shown.min === shown.max, `exact at block ${block}`);
    const start = combat.eventLog.length;
    dispatch(combat, { type: 'endTurn' });
    while (combat.pendingReaction) dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null });
    const events = combat.eventLog.slice(start);
    const starts = events.filter(event => event.type === 'enemyMoveStarted').length;
    twoActions ||= starts > 1;
    const first = events.find(event => event.type === 'damageDealt' && event.targetId === 'player');
    assert.equal(first.hpLoss, shown.max, `${stance ? 'Defend' : 'no stance'}, Block ${block}: shown ${shown.max}, first action lost ${first.hpLoss}`);
    checked++;
  }
  assert.equal(checked, 6);
  assert.ok(twoActions, 'the Elite plays a second tailSlam, whose number belongs to that action');
});

// ---- Review fix 7: a player attack that took no HP always has a visible cause (gildedKnight) --------------------------------------------
// Reproduced at model level: the Knight's gildedGuard reaction (it answers a player action worth 8 or more) hits the player and gains Block
// BEFORE the card lands, so the card's hit is wholly Blocked. The card face states the pre-reaction number (the rule for a play an enemy
// reaction answers); the resolution emits the damageDealt receipt whose Blocked word the floater policy shows.

test('gildedKnight: every player attack that leaves its HP unchanged emits a receipt that reads Blocked or another shown word', () => {
  let zeroHpPlays = 0;
  for (const classId of CLASSES) {
    const cards = reg.cards.all().filter(card => card.class === classId && card.type === 'attack' && !card.id.startsWith('progression-'));
    for (const card of cards) {
      const run = createRunState({ registries: reg, classId, seed: 3, profileMeta: META });
      const combat = createRunCombat({ registries: reg, run, rng: createRng(3), enemyIds: ['gildedKnight'] });
      const enemy = combat.enemies[0];
      Object.assign(combat.piles.hand[0], { cardId: card.id, upgraded: false });
      combat.player.energy = combat.player.stamina = combat.player.mana = 9;
      const hp = enemy.hp, start = combat.eventLog.length;
      try { dispatch(combat, { type: 'playCard', cardInstanceId: combat.piles.hand[0].instanceId, targetId: enemy.id }); } catch { continue; } // an unaffordable or illegal play is refused, not resolved
      while (combat.pendingReaction) dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null });
      if (enemy.hp !== hp || !enemy.alive) continue;
      const events = combat.eventLog.slice(start);
      const mine = events.filter(event => event.type === 'damageDealt' && event.sourceId === 'player' && event.targetId === enemy.id);
      // A play that dealt nothing at all is a status or Poise play with no hit; every hit that took no HP carries a shown word.
      for (const event of mine) {
        zeroHpPlays++;
        assert.equal(event.hpLoss, 0);
        assert.ok(floaterWordShown(outcomeKindForEvent(event)), `${classId} ${card.id}: the hit that took no HP has no word (${outcomeKindForEvent(event)})`);
      }
    }
  }
  assert.ok(zeroHpPlays > 0, 'the Knight absorbed at least one play');
});

// ---- Review fix 8: a killing blow floats the HP lost, not the overkill -----------------------------------------------------------------

test('a killing blow floats the HP the target had left, while the face keeps the full hit', () => {
  const { combat, card } = fixture({ hand: 'core.strike' });
  const enemy = combat.enemies[0];
  enemy.hp = 3; enemy.maxHp = 400;
  const face = faceOf(combat, card.instanceId, 'e1').perEnemy.get('e1');
  assert.ok(face[0] > 3, `the face keeps the full hit (${face[0]})`);
  const start = combat.eventLog.length;
  dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: 'e1' });
  const hit = combat.eventLog.slice(start).find(event => event.type === 'damageDealt' && event.targetId === 'e1');
  assert.ok(hit.hpLoss > 3, 'the hit overkills');
  assert.equal(hit.hpRemoved, 3);
  assert.equal(guardHitFloatParts(hit, 0).damage.text, '-3', 'the floater is the 3 HP lost');
  assert.equal(enemy.alive, false);
});
