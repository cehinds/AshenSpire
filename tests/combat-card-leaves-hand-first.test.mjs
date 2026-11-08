import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat, dispatch, previewCard, getEntity } from '../src/engine/combat.js';
import { resolveCombatCard } from '../src/engine/combatExpansion.js';
import { createRng } from '../src/engine/rng.js';
import { withKitDom } from './helpers/dom.mjs';

// "When playing a card remove the card from hand first and then play animations."
// Run the shipped renderHand and playCard against the real engine and the kit DOM fixture:
// the hand DOM must already lack the played card when the action timeline is handed its events.
const source = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
const names = ['renderHand', 'playCard', 'commitPlay', 'enqueuePlay', 'queuedPlayProblem', 'drainPlayQueue', 'canQueue', 'inputBusy'];
const shipped = names.map(name => {
  const start = source.indexOf(`  function ${name}(`), end = source.indexOf('\n  }', start);
  assert.ok(start >= 0 && end > start, name);
  return source.slice(start, end + 4);
}).join('\n');
const registries = createRegistries(contentBundle);

function fixture(document, { energy } = {}) {
  const combat = createCombat({ registries, rng: createRng(5), combatExpansionVersion: 2,
    player: { classId: 'starseer', hp: 80, maxHp: 80, maxMana: 30, mana: 30,
      maxStamina: 30, stamina: 30, energyMax: energy ?? 10, drawPerTurn: 3,
      deck: [1, 2, 3].map(n => ({ instanceId: 'spark-' + n, cardId: 'starSpark' })) },
    enemyIds: ['wanderingSoldier'] });
  const node = (name, parent) => { const el = document.createElement('div'); el.className = name; parent?.append(el); return el; };
  const combatEl = node('combat', document.body), hand = node('hand', combatEl);
  node('turn-ribbon', combatEl);
  const timeline = [];
  const context = {
    combat, registries, combatEl, document, CSS: { escape: value => value }, console,
    selected: null, selfArm: null, selectedFlask: null, lastTargetId: combat.enemies[0].id,
    heldTurnHand: null, playQueue: [], endTurnAfterQueue: false, disp: null, busy: false, enemyPlayback: false, upcastPreviewRefresh: false,
    handRenderKey: null, handPreviewCache: { stateKey: null, cards: new Map() }, upcastRanksByCard: new Map(), rangeRoutesByCard: new Map(),
    resolveCombatCard, previewCard, dispatch, getEntity, esc: String,
    $: selector => combatEl.querySelector(selector), readSettings: () => ({}),
    stackedCardIds: () => new Set(), isUnplayable: () => false, playAvailability: () => true,
    inspectionPlayAction: () => ({}), syncHandPager() {}, syncHitChances() {}, hideTooltip() {}, clearAim() {},
    hasCardChoice: () => false, refusePlay: (_id, why) => timeline.push('refused:' + why), lockReport: () => ({}), logIgnored() {}, dlog() {},
    unplayableReason: () => null, cardTargets: () => ({ legalIds: combat.enemies.map(e => e.id) }),
    upcastOptions: () => [], cardChoicePlan: () => null, resolveCard: () => ({}),
    takeSnapshot: () => ({ ents: {}, hand: [...combat.piles.hand], handPreviews: new Map(combat.piles.hand.map(c => [c.instanceId, previewCard(combat, c.instanceId)])) }),
    flyCard: () => timeline.push('fly'), sfx: { play() {} }, haptic: { play() {} }, t: x => x,
    render() { timeline.push('render'); }, renderPlayQueue() {}, queueToast: { show: text => timeline.push('toast:' + text) },
    commitEndTurn: () => timeline.push('end-turn'),
    setBusy(value) { context.busy = value; },
    afterDispatch: () => { timeline.push('timeline-start:' + hand.children.map(c => c.dataset.instanceId).join(',')); },
    handStrip: { render({ cards }) {
      hand.replaceChildren();
      for (const entry of cards) { const card = node('card', hand); card.dataset.instanceId = entry.inst.instanceId; }
    } },
  };
  runInNewContext(shipped + '\nObject.assign(globalThis, { ' + names.join(',') + ' });', context);
  return { context, combat, hand, timeline };
}

test('the played card is gone from the hand DOM before the action timeline starts', () => withKitDom(({ document }) => {
  const f = fixture(document);
  f.context.renderHand();
  const ids = f.combat.piles.hand.map(c => c.instanceId);
  assert.ok(ids.length >= 2, 'a hand of several cards');
  const [played, ...rest] = ids;
  assert.deepEqual(f.hand.children.map(c => c.dataset.instanceId), ids, 'the hand starts fully painted');
  f.context.playCard(played, f.combat.enemies[0].id);
  const start = f.timeline.find(line => line.startsWith('timeline-start:'));
  assert.ok(start, 'the timeline was started');
  assert.equal(start, 'timeline-start:' + rest.join(','), 'only the unplayed cards remain, closed up, when the timeline starts');
  assert.ok(f.timeline.indexOf('fly') < f.timeline.indexOf(start), 'the fly-out is handed the card before it leaves');
  assert.equal(f.context.busy, true, 'the resolution still holds input');
}));

// Plays queued while a card resolves; `finish` is the timeline's end (busy off, snapshot dropped), then the queue drains.
const finish = f => { f.context.busy = false; f.context.disp = null; f.context.drainPlayQueue(); };
const starts = f => f.timeline.filter(line => line.startsWith('timeline-start:'));

test('two cards played back to back both resolve, in order, each leaving the hand at once', () => withKitDom(({ document }) => {
  const f = fixture(document);
  f.context.renderHand();
  const [a, b, c] = f.combat.piles.hand.map(card => card.instanceId);
  const enemy = f.combat.enemies[0].id;
  f.context.playCard(a, enemy);
  assert.equal(f.context.canQueue(), true, 'input stays open while the first resolves');
  f.context.playCard(b, enemy); // queued: no second dispatch yet
  assert.equal(starts(f).length, 1, 'the second play waits for the first');
  assert.deepEqual(f.hand.children.map(x => x.dataset.instanceId), [c], 'the queued card has left the hand too');
  assert.deepEqual(f.combat.piles.hand.map(x => x.instanceId).sort(), [b, c].sort(), 'the engine has not played it yet');
  finish(f);
  assert.equal(starts(f).length, 2, 'the queued play resolved when the first ended');
  assert.ok(!f.combat.piles.hand.some(x => x.instanceId === b), 'and the engine now has it played');
  const played = f.combat.eventLog.filter(e => e.type === 'cardPlayed').map(e => e.cardInstanceId);
  assert.deepEqual(played, [a, b], 'both cards played, first then second');
}));

test('an unaffordable queued card returns to the hand unspent, with a toast', () => withKitDom(({ document }) => {
  const f = fixture(document);
  f.context.renderHand();
  const [a, b] = f.combat.piles.hand.map(card => card.instanceId);
  const enemy = f.combat.enemies[0].id;
  f.context.playCard(a, enemy);
  f.context.playCard(b, enemy);
  f.combat.player.mana = 0; // what the first play left cannot pay for the second
  f.combat.player.energy = 0;
  const before = { ...f.combat.player };
  finish(f);
  assert.equal(starts(f).length, 1, 'the queued card did not play');
  assert.ok(f.combat.piles.hand.some(x => x.instanceId === b), 'it is still in the engine hand');
  assert.ok(f.hand.children.some(x => x.dataset.instanceId === b), 'and back in the painted hand');
  assert.equal(f.combat.player.energy, before.energy, 'no cost was spent');
  assert.ok(f.timeline.some(line => line.startsWith('toast:')), 'the player is told why');
}));

test('End Turn pressed with a queue waits for the queue to drain', () => withKitDom(({ document }) => {
  const f = fixture(document);
  f.context.renderHand();
  const [a, b] = f.combat.piles.hand.map(card => card.instanceId);
  f.context.playCard(a, f.combat.enemies[0].id);
  f.context.playCard(b, f.combat.enemies[0].id);
  f.context.endTurnAfterQueue = true;
  finish(f);
  assert.ok(!f.timeline.includes('end-turn'), 'not while the drained play is still resolving');
  finish(f);
  assert.ok(f.timeline.includes('end-turn'), 'once the queue is empty the turn ends');
}));
