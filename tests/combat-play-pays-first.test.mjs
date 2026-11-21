import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat, dispatch, previewCard, getEntity } from '../src/engine/combat.js';
import { resolveCombatCard } from '../src/engine/combatExpansion.js';
import { createRng } from '../src/engine/rng.js';
import { ApplyCombatBeat, CaptureCombatDisplay, PlayCostEvents, RequoteHeldHand } from '../src/ui/models/CombatPlaybackModel.js';
import { withKitDom } from './helpers/dom.mjs';

// Owner: "when I play a card, before anything else happens, the cost must be paid then the effects and animations
// happen. That includes updating cost or card values." Run the shipped commitPlay against the real engine: in the
// frame before the action timeline starts, the orb shows the cost paid, the played card is gone, and a card that the
// play's stance discounts shows its new price.
const source = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
const names = ['renderHand', 'playCard', 'commitPlay', 'enqueuePlay', 'queuedPlayProblem', 'drainPlayQueue', 'canQueue', 'inputBusy', 'payPlayAtCommit', 'applyBeatToDisp'];
const shipped = names.map(name => {
  const start = source.indexOf(`  function ${name}(`), end = source.indexOf('\n  }', start);
  assert.ok(start >= 0 && end > start, name);
  return source.slice(start, end + 4);
}).join('\n');
const registries = createRegistries(contentBundle);

function fixture(document) {
  const combat = createCombat({ registries, rng: createRng(5), combatExpansionVersion: 2,
    player: { classId: 'reaver', hp: 80, maxHp: 80, maxMana: 30, mana: 30, maxStamina: 30, stamina: 30, energyMax: 10, drawPerTurn: 3,
      deck: [{ instanceId: 'a', cardId: 'strike' }, { instanceId: 'b', cardId: 'executioner' }, { instanceId: 'c', cardId: 'executioner' }] },
    enemyIds: ['wanderingSoldier'] });
  const node = (name, parent) => { const el = document.createElement('div'); el.className = name; parent?.append(el); return el; };
  const combatEl = node('combat', document.body), hand = node('hand', combatEl);
  node('turn-ribbon', combatEl);
  const seen = {};
  const painted = [];
  const context = {
    combat, registries, combatEl, document, CSS: { escape: value => value }, console, WeakSet,
    selected: null, selfArm: null, selectedFlask: null, lastTargetId: combat.enemies[0].id,
    heldTurnHand: null, playQueue: [], endTurnAfterQueue: false, disp: null, busy: false, enemyPlayback: false, upcastPreviewRefresh: false,
    handRenderKey: null, handPreviewCache: { stateKey: null, cards: new Map() }, upcastRanksByCard: new Map(), rangeRoutesByCard: new Map(),
    resolveCombatCard, previewCard, dispatch, getEntity, esc: String, ApplyCombatBeat, PlayCostEvents, RequoteHeldHand,
    paidAtCommit: new WeakSet(), projectCombatIntent: () => null, findInst: () => null, playbackEvents: null, reduceFollowRows() {},
    $: selector => combatEl.querySelector(selector), readSettings: () => ({}),
    stackedCardIds: () => new Set(), isUnplayable: () => false, playAvailability: () => true,
    inspectionPlayAction: () => ({}), syncHandPager() {}, syncHitChances() {}, hideTooltip() {}, clearAim() {},
    hasCardChoice: () => false, refusePlay() {}, lockReport: () => ({}), logIgnored() {}, dlog() {},
    unplayableReason: () => null, cardTargets: () => ({ legalIds: combat.enemies.map(e => e.id) }),
    upcastOptions: () => [], UPCASTING_ENABLED: false, ASK_TO_UPCAST_AFTER_TARGET: false, UpcastingOffered: () => false, cardChoicePlan: () => null, resolveCard: () => ({}),
    takeSnapshot: () => CaptureCombatDisplay(combat, { registries, projectCombatIntent: () => null, previewCard, followMemo: { plan: () => null }, upcastRanksByCard: context.upcastRanksByCard, paintedHandQuotes: new Map() }),
    flyCard() {}, sfx: { play() {} }, haptic: { play() {} }, t: x => x, render() {}, renderPlayQueue() {}, queueToast: { show() {} },
    renderTopbar() {},
    paintActionCounts() { seen.orb = context.disp.ents.player.energy; },
    setBusy(value) { context.busy = value; },
    afterDispatch: () => { seen.atTimelineStart = hand.children.map(c => c.dataset.instanceId + ':' + c.dataset.cost).join(','); seen.orbAtStart = context.disp.ents.player.stamina; },
    handStrip: { render({ cards }) {
      hand.replaceChildren();
      for (const entry of cards) { const card = node('card', hand); card.dataset.instanceId = entry.inst.instanceId; card.dataset.cost = String(entry.preview?.cost); painted.push(entry.preview?.cost); }
    } },
  };
  runInNewContext(shipped + '\nObject.assign(globalThis, { ' + names.join(',') + ' });', context);
  return { context, combat, hand, seen };
}

test('a play pays its cost and re-prices the held hand before the timeline starts', () => withKitDom(({ document }) => {
  const f = fixture(document);
  f.context.renderHand();
  const strike = f.combat.piles.hand.find(c => c.cardId === 'strike');
  assert.equal(f.combat.player.stamina, 30);
  const before = f.hand.children.filter(c => c.dataset.instanceId !== strike.instanceId).map(c => c.dataset.cost);
  assert.deepEqual(before, ['2', '2'], 'the Executioners cost 2 before the Strike');
  const energyBefore = f.combat.player.energy;
  f.context.playCard(strike.instanceId, f.combat.enemies[0].id);
  assert.equal(f.seen.orbAtStart, 29, 'the stamina read-out already shows the 1 paid');
  assert.equal(f.seen.orb, energyBefore - 1, 'the energy orb was painted with the 1 paid, before the timeline');
  const rest = f.seen.atTimelineStart.split(',');
  assert.equal(rest.length, 2, 'the played card has left the hand');
  assert.ok(rest.every(cell => !cell.startsWith(strike.instanceId + ':')));
  assert.ok(rest.every(cell => cell.endsWith(':1')), 'the same-stance cards already show their new price: ' + rest);
}));

test('the timeline does not charge the commit-time payment a second time', () => withKitDom(({ document }) => {
  const f = fixture(document);
  f.context.renderHand();
  const strike = f.combat.piles.hand.find(c => c.cardId === 'strike');
  f.context.playCard(strike.instanceId, f.combat.enemies[0].id);
  const paid = PlayCostEvents(f.combat.eventLog.slice(-20));
  assert.ok(paid.length >= 1);
  f.context.applyBeatToDisp({ events: paid });
  assert.equal(f.context.disp.ents.player.stamina, 29, 'replaying the lead events leaves the orb alone');
}));
