import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat, dispatch, previewCard, getEntity } from '../src/engine/combat.js';
import { resolveCombatCard } from '../src/engine/combatExpansion.js';
import { createRng } from '../src/engine/rng.js';
import { groupBeats } from '../src/ui/fx.js';
import { withKitDom } from './helpers/kit-dom.mjs';

// Owner 2026-11-05: "When drawing cards, my hand would change." Run the shipped renderHand and applyBeatToDisp over the
// real engine's End Turn receipts, beat by beat, and read the painted hand after each beat. The old hand holds through
// the enemy beats; the draw beat then brings the new cards in draw order, never leaving the old hand up until the end.
const source = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
const names = ['renderHand', 'applyBeatToDisp', 'findInst'];
const shipped = names.map(name => {
  const start = source.indexOf(`  function ${name}(`), end = source.indexOf('\n  }', start);
  assert.ok(start >= 0 && end > start, name);
  return source.slice(start, end + 4);
}).join('\n');
const registries = createRegistries(contentBundle);
const HAND_EVENTS = new Set(['cardDrawn', 'cardPlayed', 'cardDiscarded', 'cardExhausted']);

function fixture(document, { retain = false } = {}) {
  const combat = createCombat({ registries, rng: createRng(5), combatExpansionVersion: 2,
    player: { classId: 'starseer', hp: 80, maxHp: 80, maxMana: 30, mana: 30, maxStamina: 30, stamina: 30, energyMax: 10, drawPerTurn: 3,
      deck: Array.from({ length: 9 }, (_, n) => ({ instanceId: 'spark-' + n, cardId: 'starSpark' })) },
    enemyIds: ['wanderingSoldier'] });
  const node = (name, parent) => { const el = document.createElement(name === 'hand' ? 'div' : 'div'); el.className = name; parent?.append(el); return el; };
  const combatEl = node('combat', document.body), hand = node('hand', combatEl);
  node('turn-ribbon', combatEl);
  const painted = () => hand.children.map(c => c.dataset.instanceId);
  const context = {
    combat, registries, combatEl, document, CSS: { escape: value => value }, console,
    selected: null, selfArm: null, selectedFlask: null, lastTargetId: combat.enemies[0].id,
    heldTurnHand: null, playQueue: [], disp: null, busy: true, enemyPlayback: false, upcastPreviewRefresh: false,
    handRenderKey: null, handPreviewCache: { stateKey: null, cards: new Map() }, upcastRanksByCard: new Map(), rangeRoutesByCard: new Map(),
    resolveCombatCard, previewCard, getEntity, esc: String, $: selector => combatEl.querySelector(selector), readSettings: () => ({}),
    stackedCardIds: () => new Set(), isUnplayable: () => false, playAvailability: () => true, inspectionPlayAction: () => ({}),
    syncHandPager() {}, syncHitChances() {}, inputBusy: () => false, cardTargets: () => ({ legalIds: [] }),
    reduceFollowRows() {}, applyCombatIntentReceipt() {}, applyCombatDisplayReceipt: () => false,
    handStrip: { render({ cards }) {
      // The strip keeps an existing card's element and order, and appends a new one (reconcileHandOrder).
      const have = new Map(hand.children.map(c => [c.dataset.instanceId, c]));
      const order = [...painted().filter(id => cards.some(e => e.inst.instanceId === id)), ...cards.map(e => e.inst.instanceId).filter(id => !have.has(id))];
      hand.replaceChildren();
      for (const id of order) { const card = have.get(id) || node('card', hand); card.dataset.instanceId = id; hand.append(card); }
    } },
  };
  runInNewContext(shipped + '\nObject.assign(globalThis, { ' + names.join(',') + ' });', context);
  return { context, combat, painted };
}

test('End Turn: the old hand holds through the enemy beats, then the drawn cards arrive in draw order on the draw beat', () => withKitDom(({ document }) => {
  const f = fixture(document);
  const { context, combat } = f;
  context.renderHand();
  const before = combat.piles.hand.map(c => c.instanceId);
  assert.deepEqual(f.painted(), before);
  context.disp = { ents: {}, hand: [...combat.piles.hand], handPreviews: new Map(combat.piles.hand.map(c => [c.instanceId, previewCard(combat, c.instanceId)])),
    pileCounts: { draw: combat.piles.draw.length, discard: 0, exhaust: 0 }, logLength: 0, arcaneEvents: [] };
  context.heldTurnHand = [...context.disp.hand];
  context.enemyPlayback = true;
  const start = combat.eventLog.length;
  dispatch(combat, { type: 'endTurn' });
  for (let i = 0; combat.pendingReaction && i < 20; i++) dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null });
  const events = combat.eventLog.slice(start);
  const drawOrder = events.filter(e => e.type === 'cardDrawn').map(e => e.cardInstanceId);
  assert.ok(drawOrder.length >= 2, 'a real draw of several cards');
  const afterBeat = [];
  for (const beat of groupBeats(events)) {
    context.applyBeatToDisp({ ...beat, events: beat.events.filter(e => HAND_EVENTS.has(e.type)) });
    context.renderHand();
    afterBeat.push({ kind: beat.kind, hand: f.painted() });
  }
  const draw = afterBeat.findIndex(b => b.kind === 'draw');
  assert.ok(draw > 0, 'the draw is its own beat after the enemy beats');
  for (const b of afterBeat.slice(0, draw)) assert.deepEqual(b.hand, before, `before the draw (${b.kind}) the hand is the one the player ended the turn with`);
  assert.deepEqual(afterBeat[draw].hand, drawOrder, 'the draw beat paints the drawn cards in draw order, not at playback end');
  assert.deepEqual(afterBeat[draw].hand, combat.piles.hand.map(c => c.instanceId), 'and that is the engine hand');
}));

test('a mid-turn draw keeps every card already held, in order, and appends the drawn card', () => withKitDom(({ document }) => {
  const f = fixture(document);
  const { context, combat } = f;
  context.renderHand();
  const held = combat.piles.hand.map(c => c.instanceId);
  context.disp = { ents: {}, hand: [...combat.piles.hand], handPreviews: new Map(), pileCounts: { draw: combat.piles.draw.length, discard: 0, exhaust: 0 }, logLength: 0, arcaneEvents: [] };
  const next = combat.piles.draw[0];
  combat.piles.hand.push(combat.piles.draw.shift());
  context.applyBeatToDisp({ events: [{ type: 'cardDrawn', cardInstanceId: next.instanceId, cardId: next.cardId }] });
  context.renderHand();
  assert.deepEqual(f.painted(), [...held, next.instanceId]);
}));
