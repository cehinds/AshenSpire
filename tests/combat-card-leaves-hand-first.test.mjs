import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat, dispatch, previewCard, getEntity } from '../src/engine/combat.js';
import { resolveCombatCard } from '../src/engine/combatExpansion.js';
import { createRng } from '../src/engine/rng.js';
import { withKitDom } from './helpers/kit-dom.mjs';

// "When playing a card remove the card from hand first and then play animations."
// Run the shipped renderHand and playCard against the real engine and the kit DOM fixture:
// the hand DOM must already lack the played card when the action timeline is handed its events.
const source = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
const names = ['renderHand', 'playCard'];
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
    heldTurnHand: null, disp: null, busy: false, enemyPlayback: false, upcastPreviewRefresh: false,
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
    render() { timeline.push('render'); },
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
