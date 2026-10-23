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
    selected: 'spark-1', selfArm: null, selectedFlask: null, lastTargetId: combat.enemies[0].id,
    heldTurnHand: null, disp: null, busy: false, enemyPlayback: false, upcastPreviewRefresh: false,
    handRenderKey: null, upcastRanksByCard: new Map(), rangeRoutesByCard: new Map(),
    resolveCombatCard, previewCard, previewCardHit, cardTargetPlan, cardAffectsEnemies, hitBadgeTargetIds,
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

for (const cached of [false, true]) test(`selection places current odds exactly once after stance (${cached ? 'cached' : 'rebuilt'} hand)`, () => withKitDom(({ document }) => {
  const f = fixture(document);
  if (cached) f.context.renderHand();
  f.calls.length = 0;
  const before = JSON.stringify({ combat: f.combat.player, piles: f.combat.piles, rng: f.combat.rng.getCounters() });
  f.context.syncCardSelection();
  assert.equal(f.oddsCount(), 1);
  assert.ok(f.calls.indexOf('stance') < f.calls.indexOf('odds'));
  assert.equal(f.hand.querySelectorAll('.card-hit-chances').length, 1);
  assert.equal(f.hand.querySelectorAll('.card-hit-chance').length, 2);
  assert.equal(JSON.stringify({ combat: f.combat.player, piles: f.combat.piles, rng: f.combat.rng.getCounters() }), before);
}));

test('standalone hand repaint refreshes odds after enemy change and target focus uses its latest quote', () => withKitDom(({ document }) => {
  const f = fixture(document); f.context.renderHand(); assert.equal(f.oddsCount(), 1);
  f.combat.enemies[0].alive = false;
  f.context.renderHand(); assert.equal(f.oddsCount(), 2);
  assert.equal(f.hand.querySelectorAll('.card-hit-chance').length, 1, 'dead target badge is removed');
  const target = f.combat.enemies[1]; target.block = 8;
  f.context.previewAimedTarget({ target: f.enemyFrames.get(target.id).box });
  assert.equal(f.context.lastTargetId, target.id);
  assert.equal(f.oddsCount(), 3, 'focus-triggered standalone hand refresh retains immediate odds');
  assert.deepEqual(f.quotes.at(-1).quote, previewCard(f.combat, 'spark-1', target.id));
  assert.deepEqual(f.rendered.at(-1)[0].preview.values, previewCard(f.combat, 'spark-1', target.id).values);
}));

test('range route selection rebuilds the hand and places final odds once', () => withKitDom(({ document }) => {
  const f = fixture(document); f.context.syncCardSelection(); const before = f.oddsCount();
  f.quotes.at(-1).actions.onChoose('throw');
  assert.equal(f.context.rangeRoutesByCard.get('spark-1'), 'throw');
  assert.equal(f.oddsCount(), before + 1);
  assert.equal(f.context.upcastPreviewRefresh, false);
  assert.equal(f.hand.querySelectorAll('.card-hit-chances').length, 1);
}));

test('inline upcast change keeps selection and publishes the new paid tier once', () => withKitDom(({ document, Event }) => {
  const f = fixture(document); f.context.syncCardSelection();
  const before = f.oddsCount(), oldQuote = f.quotes.at(-1).quote;
  const picker = f.hand.querySelector('.card-upcast-rank'); assert.ok(picker);
  const ranks = upcastChoicePlan(resolveCombatCard(f.combat, f.combat.piles.hand[0])).options.map(row => Number(row.id));
  picker.value = String(Math.max(...ranks)); picker.dispatchEvent(new Event('change'));
  assert.equal(f.oddsCount(), before + 1);
  assert.equal(f.context.selected, 'spark-1');
  const rank = Number(picker.value), latest = f.quotes.at(-1).quote;
  assert.deepEqual(latest, previewCard(f.combat, 'spark-1', f.context.lastTargetId, rank));
  assert.ok(latest.manaCost > oldQuote.manaCost, 'rank change reaches the live engine quote');
  assert.equal(f.hand.querySelectorAll('.card-hit-chances').length, 1);
}));


// Exercise the shipped full-render ordering with real hand faces, live engine
// quotes and badge DOM. Art/field hosts are effect spies; their own default
// refresh contract is checked separately below.
test('full board render publishes one fresh quote after hand costs and HP change', () => withKitDom(({ document }) => {
  const f = fixture(document), c = f.context;
  const field = document.createElement('div'); field.className = 'field'; c.combatEl.append(field);
  Object.assign(c, {
    paintedAppearance: 'test', displayAppearance: () => 'test', selectedCombatantId: null,
    formationOccupancy: () => [], renderPlayer() {},
    renderEnemies: options => { assert.equal(options.refreshTargets, false); f.calls.push('enemies'); },
    syncEditLock() {}, renderPotionTray() {}, renderTopbar() {}, renderControls() {}, renderCombatTools() {},
    combatTools: { flushGeometry: () => f.calls.push('tools-fit') }, formationMovement: null,
    scheduleAutoCombat() {}, applyTargetLayer: () => f.calls.push('targets'),
  });
  c.battlefieldStage.refresh = () => f.calls.push('field-fit');
  const renderSource = ['renderCombatantStage', 'render'].map(name => {
    const start = source.indexOf(`  function ${name}(`), end = source.indexOf('\n  }', start);
    return source.slice(start, end + 4);
  }).join('\n');
  runInNewContext(renderSource + '\nglobalThis.renderFull = render;', c);
  for (const [mana, block, hp] of [[30, 0, 50], [0, 8, 5]]) {
    c.combat.player.mana = mana; c.combat.enemies[0].block = block; c.combat.enemies[0].hp = hp;
    const before = f.oddsCount(), targetBefore = f.calls.filter(call => call === 'targets').length;
    c.renderFull();
    assert.equal(f.oddsCount(), before + 1, 'one badge/quote publication per complete render');
    assert.equal(f.calls.filter(call => call === 'targets').length, targetBefore + 1, 'one final target layer publication');
    const face = f.rendered.at(-1)[0].preview, expected = previewCard(c.combat, 'spark-1', c.lastTargetId);
    assert.deepEqual(face.values, expected.values);
    assert.equal(face.manaCost, expected.manaCost);
    assert.equal(face.staminaCost, expected.staminaCost);
    assert.deepEqual(f.quotes.at(-1).quote, previewCard(c.combat, 'spark-1', c.lastTargetId));
    assert.equal(f.rendered.at(-1)[0].affordable, mana >= f.rendered.at(-1)[0].preview.manaCost);
    assert.equal(f.hand.querySelectorAll('.card-hit-chances').length, 1);
    for (const enemy of c.combat.enemies) {
      const hit = previewCardHit(c.combat, c.selected, enemy.id, undefined, { observerId: 'player', rangeRoute: 'advance' });
      assert.equal(f.enemyFrames.get(enemy.id).box.querySelector('.combat-hit-chance')?.textContent, rangeHitLabel(hit, { targetId: enemy.id }));
    }
    assert.ok(f.calls.lastIndexOf('odds') < f.calls.lastIndexOf('field-fit'), 'final badge DOM exists before field fitting');
    assert.ok(f.calls.lastIndexOf('field-fit') < f.calls.lastIndexOf('targets'));
  }
  c.combat.enemies[0].hp = 0; c.combat.enemies[0].alive = false;
  const before = f.oddsCount(); c.renderFull();
  assert.equal(f.oddsCount(), before + 1);
  assert.equal(f.enemyFrames.get(c.combat.enemies[0].id).box.querySelector('.combat-hit-chance'), null, 'the final pass removes the defeated target odds');
  assert.equal(f.hand.querySelectorAll('.card-hit-chance').length, 1);
  c.renderEnemies = options => assert.equal(options.refreshTargets, true, 'an isolated stage keeps immediate target refresh by default');
  c.renderCombatantStage();
}));

test('standalone enemy render refreshes immediately unless its caller owns the final update', () => {
  const start = source.indexOf('  function renderEnemies('), end = source.indexOf('\n  }', start);
  const calls = [], context = {
    combat: { enemies: [] }, enemyFrames: new Map(), selected: null, selectedFlask: null,
    $: () => ({}), targetLayer: () => ({ eligibleIds: [] }),
    syncHitChances: () => calls.push('odds'), applyTargetLayer: () => calls.push('targets'),
  };
  runInNewContext(source.slice(start, end + 4) + '\nglobalThis.renderEnemies = renderEnemies;', context);
  context.renderEnemies(); assert.deepEqual(calls, ['odds', 'targets']);
  context.renderEnemies({ refreshTargets: false }); assert.deepEqual(calls, ['odds', 'targets']);
  context.renderEnemies(); assert.deepEqual(calls, ['odds', 'targets', 'odds', 'targets']);
});
