import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat, previewCard, previewCardHit } from '../src/engine/combat.js';
import { resolveCombatCard } from '../src/engine/combatExpansion.js';
import { createRng } from '../src/engine/rng.js';
import { cardTargetPlan } from '../src/model/cardTargets.js';
import { cardAffectsEnemies, hitBadgeTargetIds } from '../src/model/hitBadge.js';
import { rangeHitLabel } from '../src/ui/models/CombatRangeActionModel.js';
import { upcastOptions } from '../src/model/upcasting.js';
import { upcastChoicePlan } from '../src/ui/components/upcastChoice.js';
import { withKitDom } from './helpers/kit-dom.mjs';

// A pending reaction offer pauses the hand: its quotes are reused, then re-taken once it resolves.
// Run the shipped screen functions, real engine quotes and the repository DOM
// fixture. The full mount requires browser geometry/art; this fixture claims
// ordering, emitted UI content and live quote freshness, not native hit testing.
const source = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
const names = ['renderHand', 'syncCardSelection', 'syncHitChances', 'hitChanceBadge', 'cardTargets', 'wireUpcastControl', 'previewAimedTarget'];
const shipped = names.map(name => {
  const start = source.indexOf(`  function ${name}(`), end = source.indexOf('\n  }', start);
  assert.ok(start >= 0 && end > start, name);
  return source.slice(start, end + 4);
}).join('\n');
const registries = createRegistries(contentBundle);

function fixture(document) {
  const combat = createCombat({ registries, rng: createRng(5), combatExpansionVersion: 2,
    player: { classId: 'starseer', hp: 80, maxHp: 80, maxMana: 30, mana: 30,
      maxStamina: 30, stamina: 30, energyMax: 10, drawPerTurn: 1,
      deck: [{ instanceId: 'spark-1', cardId: 'starSpark' }] },
    enemyIds: ['wanderingSoldier', 'wanderingSoldier'] });
  const node = (name, parent) => { const el = document.createElement('div'); el.className = name; parent?.append(el); return el; };
  const combatEl = node('combat', document.body), hand = node('hand', combatEl);
  node('turn-ribbon', combatEl); const player = node('combatant player', combatEl);
  const enemyFrames = new Map(combat.enemies.map(enemy => {
    const box = node('combatant enemy', combatEl); box.dataset.eid = enemy.id;
    return [enemy.id, { box }];
  }));
  const calls = [], quotes = [], rendered = [];
  const context = {
    combat, registries, combatEl, enemyFrames, document, CSS: { escape: value => value },
    selected: null, selfArm: null, selectedFlask: null, lastTargetId: combat.enemies[0].id,
    heldTurnHand: null, disp: null, busy: false, enemyPlayback: false, upcastPreviewRefresh: false,
    handRenderKey: null, handPreviewCache: { stateKey: null, cards: new Map() }, upcastRanksByCard: new Map(), rangeRoutesByCard: new Map(),
    resolveCombatCard, previewCard: (...args) => { calls.push('quote'); return previewCard(...args); }, previewCardHit, cardTargetPlan, cardAffectsEnemies, hitBadgeTargetIds,
    rangeHitLabel, upcastOptions, upcastChoicePlan, esc: value => String(value),
    findInst: id => combat.piles.hand.find(card => card.instanceId === id),
    getEntity: (_combat, id) => [combat.player, ...combat.enemies].find(entity => entity.id === id),
    $: selector => combatEl.querySelector(selector), readSettings: () => ({}),
    stackedCardIds: () => new Set(), isUnplayable: () => false, playAvailability: () => true,
    syncHandPager() {}, selectCombatant() {}, decorateRoundsScreen() {}, cardKind: () => 'spell',
    syncPlayerPreview: () => calls.push('stance'), applyTargetLayer() {}, setHintMode() {}, hideTooltip() {}, refreshAim() {},
    releaseRangeAction() {}, clearSelection() {},
    battlefieldStage: { placeHitBadges: () => calls.push('odds') },
    mountCombatRangeAction: (card, quote, actions) => {
      quotes.push({ card, quote, actions }); return () => calls.push('release-range');
    },
    handStrip: { render({ cards }) {
      rendered.push(cards);
      hand.replaceChildren();
      for (const entry of cards) {
        const card = node('card', hand); card.dataset.instanceId = entry.inst.instanceId;
        card.classList.toggle('selected', entry.selected);
        context.wireUpcastControl(card, entry.inst, entry.preview);
      }
    } },
  };
  runInNewContext(shipped + '\nObject.assign(globalThis, { ' + names.join(',') + ' });', context);
  return { context, combat, hand, player, enemyFrames, calls, quotes, rendered,
    oddsCount: () => calls.filter(call => call === 'odds').length };
}


test('quotes are reused while a reaction offer is pending, and re-taken after it resolves', () => withKitDom(({ document }) => {
  const f = fixture(document);
  const quotes = () => f.calls.filter(call => call === 'quote').length;
  f.context.renderHand();
  const first = quotes();
  assert.ok(first >= 1, 'the first render quotes the hand');
  f.combat.player.hp -= 7; // the enemy's action lands: the state key changes
  f.combat.pendingReaction = { id: 'g:p', groupKey: 'g', ownerId: f.combat.player.id, options: [] };
  f.context.renderHand();
  assert.equal(quotes(), first, 'the paused hand is not re-quoted');
  assert.equal(f.rendered.length, 1, 'the unchanged, inert hand is not repainted');
  f.combat.piles.hand.pop(); // a reaction card leaves the hand: that does repaint
  f.context.renderHand();
  assert.equal(f.rendered.length, 2, 'a changed hand repaints even while paused');
  f.combat.piles.hand.push({ instanceId: 'spark-1', cardId: 'starSpark' });
  delete f.combat.pendingReaction;
  f.context.renderHand();
  assert.ok(quotes() > first, 'the first render after the offer quotes against the new state');
  const settled = quotes();
  f.context.renderHand();
  assert.equal(quotes(), settled, 'and that quote is then cached');
}));
