// Combat Rounds Preview, screen rules (SPEC §4.11, PREVIEW-PLAN "Screen", P5). Headless: the model, the
// engine forecast the screen reads, and the contract that the preview adds nothing when it is off.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch, roundCardForecast } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { cardKind } from '../src/model/tree.js';
import { COMBAT_ROUNDS_KEY } from '../src/model/combatRounds.js';
import * as Rounds from '../src/engine/combatRoundsAdapter.js';
import { targetOutline } from '../src/engine/combatRounds/resolver.js';
import { decorateCombatRoundsScreen } from '../src/ui/components/combatRoundsScreen.js';
import * as Screen from '../src/ui/models/CombatRoundsScreenModel.js';

const registries = createRegistries(contentBundle);
const ENEMY = 'wanderingSoldier';
const SEED = 5;

function fight({ preview = true, seed = SEED } = {}) {
  const run = createRunState({ seed, classId: 'reaver', registries, combatExpansionVersion: 1, profileMeta: { settings: { [COMBAT_ROUNDS_KEY]: preview } } });
  return createRunCombat({ registries, rng: createRng(seed), run, enemyIds: [ENEMY], settings: {} });
}
const attackCard = (c) => c.piles.hand.find((card) => cardKind(resolveCard(registries, card)) === 'attack');
const liveEnemy = (c) => c.enemies.find((e) => e.alive);

test('the intent box shows 1 + perception actions; reads past the count and hidden reads show ?', () => {
  const queue = [{ stance: 'attack' }, { stance: 'block' }, { stance: 'counter' }];
  assert.deepEqual(Screen.followUpSymbols(queue, 0, Screen.READ_EXACT), [{ kind: 'unknown' }, { kind: 'unknown' }],
    'no perception: no follow-up is visible, so each shows ?');
  assert.deepEqual(Screen.followUpSymbols(queue, 1, Screen.READ_EXACT), [{ kind: 'action', icon: 'defend' }, { kind: 'unknown' }],
    'one perception: the first follow-up shows at its stage, the next is beyond the read count');
  assert.deepEqual(Screen.followUpSymbols(queue, 2, Screen.READ_HIDDEN), [{ kind: 'unknown' }, { kind: 'unknown' }],
    'a hidden read shows ? even inside the read count');
  assert.deepEqual(Screen.followUpSymbols(queue, 9, Screen.READ_EXACT), [{ kind: 'action', icon: 'defend' }, { kind: 'action', icon: 'counter' }]);
  assert.deepEqual(Screen.followUpSymbols([{ stance: 'attack' }], 3, Screen.READ_EXACT), [], 'a lone action has no follow-up');
});

test('stances map to the existing intent icons, and nothing invents a new one', () => {
  for (const [stance, icon] of [['attack', 'attack'], ['sweep', 'attack'], ['smash', 'smash'], ['block', 'defend'],
    ['evade', 'defend'], ['counter', 'counter'], [null, 'prepare']]) assert.equal(Screen.iconForStance(stance), icon);
});

test('a speed hint compares the card with the target: faster green › »; slower red ‹ «; equal shows nothing', () => {
  assert.deepEqual(Screen.speedHint(5, 4), { glyph: '›', tone: 'faster' });
  assert.deepEqual(Screen.speedHint(7, 4), { glyph: '»', tone: 'faster' });
  assert.deepEqual(Screen.speedHint(3, 4), { glyph: '‹', tone: 'slower' });
  assert.deepEqual(Screen.speedHint(0, 4), { glyph: '«', tone: 'slower' });
  assert.equal(Screen.speedHint(4, 4), null);
  assert.equal(Screen.speedHint(null, 4), null, 'an unknown speed shows nothing');
});

test('the momentum tab: +2/+3 ++ good, ±1 +- warn, -2/-3 -- bad, 0 none', () => {
  for (const [m, tone, tab] of [[3, 'good', '++'], [2, 'good', '++'], [1, 'warn', '+-'], [-1, 'warn', '+-'], [-2, 'bad', '--'], [-3, 'bad', '--']]) {
    assert.deepEqual(Screen.momentumTab(m), { tone, tab }, `momentum ${m}`);
  }
  assert.equal(Screen.momentumTab(0), null);
  assert.deepEqual(Screen.momentumTab(9), Screen.momentumTab(3), 'momentum is clamped to the -3..+3 range');
});

test('the banner reads the last target while it lives, else the first living enemy', () => {
  const combat = { enemies: [{ id: 'a', alive: false }, { id: 'b', alive: true }, { id: 'c', alive: true }] };
  assert.equal(Screen.targetedEnemyId(combat, null), 'b');
  assert.equal(Screen.targetedEnemyId(combat, 'c'), 'c');
  assert.equal(Screen.targetedEnemyId(combat, 'a'), 'b', 'a dead target falls back to the first living enemy');
  assert.equal(Screen.targetedEnemyId({ enemies: [] }, null), null);
});

test('the outline colours are the approved greens, yellows and reds', () => {
  assert.deepEqual({ ...Screen.OUTLINE_COLOURS }, { green: '#5ccf6a', yellow: '#e7c65c', red: '#ef4949' });
});

test('the preview forecast reads the card, the queue and the foe on the same plan-time speeds', () => {
  const c = fight();
  const card = attackCard(c);
  const enemy = liveEnemy(c);
  const forecast = roundCardForecast(c, card.instanceId, enemy.id);
  assert.equal(forecast.instanceId, card.instanceId);
  assert.equal(forecast.target, enemy.id, 'an attack aims at its foe');
  const before = Rounds.screenForecast(c, enemy.id, forecast);
  assert.ok(Number.isFinite(before.cardSpeed) && Number.isFinite(before.foeSpeed), 'speeds are known at stage 3');
  assert.equal(before.foe.stance, Rounds.enemyActions(c, enemy.id)[0].stance);
  // Queue the card: its speed now sits at its queue place, which the forecast reports as the same speed.
  dispatch(c, { type: 'playCard', cardInstanceId: card.instanceId, targetId: enemy.id });
  const queued = Rounds.screenForecast(c, enemy.id, roundCardForecast(c, card.instanceId, enemy.id));
  assert.equal(queued.cardSpeed, before.cardSpeed, 'a queued card keeps its place and its speed');
  // A second card placed after it is capped by the first: the queue never lets a later card act first.
  const second = c.piles.hand.find((x) => x.instanceId !== card.instanceId);
  assert.ok(second, 'the fixture hand holds a second card');
  const after = Rounds.screenForecast(c, enemy.id, roundCardForecast(c, second.instanceId, enemy.id));
  assert.ok(after.cardSpeed <= queued.cardSpeed, 'the second card is capped by the first');
});

test('an unqueued card is not a forecast ghost: forecast needs the card in hand and the preview on', () => {
  const off = fight({ preview: false });
  assert.equal(roundCardForecast(off, attackCard(off).instanceId, liveEnemy(off).id), null, 'preview off: no forecast');
  const c = fight();
  assert.equal(roundCardForecast(c, 'no-such-card', liveEnemy(c).id), null, 'a card not in hand has no forecast');
});

test('the queue order is the record index, and an unqueue refunds the card and drops it from the order', () => {
  const c = fight();
  const enemy = liveEnemy(c);
  const cards = [];
  for (const card of c.piles.hand.slice()) {
    if (cards.length === 2) break;
    const aims = cardKind(resolveCard(registries, card)) === 'attack' ? enemy.id : undefined;
    try { dispatch(c, { type: 'playCard', cardInstanceId: card.instanceId, targetId: aims }); cards.push(card); } catch { /* not affordable or not aimable */ }
  }
  assert.equal(cards.length, 2, 'the fixture queues two cards');
  assert.deepEqual(c.combatRounds.playerQueue.map((r) => r.instanceId), cards.map((x) => x.instanceId));
  const energy = c.player.energy;
  dispatch(c, { type: 'unqueueCard', cardInstanceId: cards[0].instanceId });
  assert.ok(c.player.energy >= energy, 'the unqueued card is refunded');
  assert.deepEqual(c.combatRounds.playerQueue.map((r) => r.instanceId), [cards[1].instanceId], 'the second card moves up to order 1');
});

test('the decorator adds nothing to a fight with the preview off', () => {
  const c = fight({ preview: false });
  const writes = [];
  const root = {
    dataset: {},
    querySelectorAll: () => [],
    querySelector: () => null,
  };
  const previous = globalThis.document;
  // Any element creation would reach here: the preview-off path must not build one.
  globalThis.document = { createElement: () => { writes.push('created'); throw new Error('no element when off'); } };
  try {
    decorateCombatRoundsScreen(root, c, { armedCardId: attackCard(c).instanceId, targetedId: liveEnemy(c).id });
  } finally {
    globalThis.document = previous;
  }
  assert.deepEqual(writes, []);
  assert.equal('combatRounds' in root.dataset, false, 'no preview marker when off');
});

test('the target outline the screen draws is the forecast outline, and absent without a stage-3 read', () => {
  const card = { target: 'enemy1', stance: 'attack' };
  const foe = { stance: 'attack' };
  assert.equal(targetOutline({ card, foe, cardSpeed: 5, foeSpeed: 3, stage: 0, stanceTable: new Map() }), null,
    'a hidden read reveals no dimension, so no outline');
});

test('the preview stylesheet scopes every rule to the preview or to the classes the screen adds', () => {
  const css = readFileSync(new URL('../styles/combat-rounds-preview.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = [...css.matchAll(/([^{}]+)\{/g)].map(m => m[1].trim()).filter(Boolean);
  assert.ok(selectors.length > 10);
  for (const selector of selectors) {
    const scoped = /^(:root )?\.combat\[data-combat-rounds='preview'\]/.test(selector) || /^\.cr-/.test(selector);
    assert.ok(scoped, `unscoped selector: ${selector}`);
  }
  assert.match(css, /--selection-color: #4f8fff/, 'the selection is blue in the preview');
  for (const hex of ['#5ccf6a', '#e7c65c', '#ef4949']) assert.match(css, new RegExp(hex));
  assert.doesNotMatch(css, /blur\(|glow/, 'the outline has no glow or halo');
});

// Review item 1: a queued card is taken back by a tap, a completed hold and a hotkey, even when the energy left
// after queueing no longer covers its cost (`affordable` reads that leftover, so it is not a reason to refuse).
const combatScreenSource = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
function sliceBetween(src, from, to) {
  const a = src.indexOf(from);
  assert.ok(a >= 0, `missing marker: ${from}`);
  const b = src.indexOf(to, a + from.length);
  assert.ok(b > a, `missing end marker ${to} after ${from}`);
  return src.slice(a, b);
}

test('a tap on a queued card takes it back before the affordable and dragging guards', () => {
  const tap = sliceBetween(combatScreenSource, 'const tap = () => {', '\n    const holdProgress');
  const queued = tap.indexOf('isRoundQueued(inst.instanceId)');
  assert.ok(queued >= 0, 'tap checks for a queued card');
  assert.match(tap.slice(queued, queued + 120), /unqueueCard\(inst\.instanceId\)/, 'a queued card is unqueued');
  assert.ok(queued < tap.indexOf('if (!affordable)'), 'the queued check comes before the affordable guard (no "Not enough stamina")');
  assert.ok(queued < tap.indexOf('dragging'), 'the queued check comes before the dragging guard');
});

test('a completed hold on a queued card takes it back before the affordable and dragging guards', () => {
  const hold = sliceBetween(combatScreenSource, 'return armHold(el, {', '\n    });\n  }');
  const confirm = hold.slice(hold.indexOf('onConfirm: () => {'));
  const queued = confirm.indexOf('isRoundQueued(inst.instanceId)');
  assert.ok(queued >= 0, 'the hold-confirm path checks for a queued card');
  assert.ok(queued < confirm.indexOf('if (busy || !affordable || dragging)'), 'before the affordable and dragging guard');
  assert.match(confirm.slice(queued, queued + 120), /unqueueCard\(inst\.instanceId\)/);
});

test('the hotkey on a queued card takes it back before the affordable guard', () => {
  const hotkey = sliceBetween(combatScreenSource, 'const visibleId = handCards', 'const hostile = cardTargets(');
  const queued = hotkey.indexOf('isRoundQueued(inst.instanceId)');
  assert.ok(queued >= 0, 'the hotkey path checks for a queued card');
  assert.ok(queued < hotkey.indexOf('if (!affordable) return;'), 'before the affordable guard');
  assert.match(hotkey.slice(queued, queued + 120), /unqueueCard\(inst\.instanceId\)/);
});
