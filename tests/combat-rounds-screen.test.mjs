// Combat Rounds Preview, screen rules (SPEC §4.11, PREVIEW-PLAN "Screen", P5). Headless: the model, the
// engine forecast the screen reads, and the contract that the preview adds nothing when it is off.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch, previewIntent, roundCardForecast } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { cardKind } from '../src/model/tree.js';
import { COMBAT_ROUNDS_KEY } from '../src/model/combatRounds.js';
import * as Rounds from '../src/engine/combatRoundsAdapter.js';
import { targetOutline, parseStanceAdvantage } from '../src/engine/combatRounds/resolver.js';
import * as roundsContent from '../src/content/combatRounds.js';
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

test('with the preview off, the decorator creates no element: the outline is its only write, and only while a card is aimed', () => {
  const c = fight({ preview: false });
  const writes = [];
  const root = {
    dataset: {},
    querySelectorAll: () => [],
    querySelector: () => null,
  };
  const previous = globalThis.document;
  const previousCss = globalThis.CSS;
  // Any element creation would reach here: the preview-off path must not build one.
  globalThis.document = { createElement: () => { writes.push('created'); throw new Error('no element when off'); } };
  globalThis.CSS = { escape: String }; // the browser's CSS.escape, for the enemy-box selector the outline pass builds
  try {
    decorateCombatRoundsScreen(root, c, { armedCardId: attackCard(c).instanceId, targetedId: liveEnemy(c).id });
  } finally {
    globalThis.document = previous;
    globalThis.CSS = previousCss;
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

test('owner 2026-10-12: a targeted attack, faster than a revealed smash or sweep, outlines green', () => {
  const stanceTable = parseStanceAdvantage(roundsContent.STANCE_ADVANTAGE_CSV);
  const card = { target: 'enemy1', stance: 'attack' };
  for (const foeStance of ['smash', 'sweep']) {
    const foe = { stance: foeStance };
    assert.equal(targetOutline({ card, foe, cardSpeed: 5, foeSpeed: 3, stage: 3, stanceTable }), 'green',
      `faster attack vs revealed ${foeStance} is green`);
  }
  assert.equal(targetOutline({ card, foe: { stance: 'smash' }, cardSpeed: 3, foeSpeed: 5, stage: 3, stanceTable }), 'yellow',
    'a slower attack vs smash has only the stance in its favour, so yellow not green');
});

test('owner 2026-10-12: the target outline lists the dark shadow first, then the coloured 1px rings outermost', () => {
  // The outline is on in every fight now, so it lives in the always-on stylesheet (combat-visuals.css).
  const css = readFileSync(new URL('../styles/combat-visuals.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const [tone, colour] of [['green', '#5ccf6a'], ['yellow', '#e7c65c'], ['red', '#ef4949']]) {
    const rule = css.match(new RegExp(`data-target-outline='${tone}'\\] \\{\\s*filter: ([^;]+?)(?: !important)?;`));
    assert.ok(rule, `${tone} outline rule exists`);
    const shadows = rule[1].split('drop-shadow(').slice(1).map((chunk) => chunk.trim().replace(/\)$/, ''));
    const dark = shadows.filter((args) => /#000\b|rgba\(0,0,0/.test(args));
    const rings = shadows.filter((args) => args.includes(colour));
    assert.equal(rings.length, 4, `${tone}: four coloured 1px rings`);
    assert.equal(dark.length, 2, `${tone}: two dark shadows`);
    assert.deepEqual(shadows.slice(0, 2).map((args) => /#000\b|rgba\(0,0,0/.test(args)), [true, true], `${tone}: the dark shadow is first`);
    assert.deepEqual(shadows.slice(2).every((args) => args.includes(colour)), true, `${tone}: the rings come last, outermost`);
    for (const args of dark) {
      const blur = Number((args.match(/calc\((\d+(?:\.\d+)?)px/) ?? args.match(/\s(\d+(?:\.\d+)?)px/))[1]);
      assert.ok(blur <= 1.5, `${tone}: shadow blur ${blur}px is at most 1.5px so the ring stays thin`);
    }
  }
});

test('the preview stylesheet scopes every rule to the preview or to the classes the screen adds', () => {
  const css = readFileSync(new URL('../styles/combat-rounds-preview.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = [...css.matchAll(/([^{}]+)\{/g)].map(m => m[1].trim()).filter(Boolean);
  assert.ok(selectors.length > 10);
  for (const selector of selectors) {
    const scoped = /^(:root )?\.combat\[data-combat-rounds='preview'\]/.test(selector) || /^\.cr-/.test(selector);
    assert.ok(scoped, `unscoped selector: ${selector}`);
  }
  assert.doesNotMatch(css, /data-target-outline|--selection-color/, 'the always-on outline and selection colour are not in the preview file');
});

test('the always-on stylesheet: the blue selection, the thin coloured outline and no glow or halo', () => {
  const css = readFileSync(new URL('../styles/combat-visuals.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = [...css.matchAll(/([^{}]+)\{/g)].map(m => m[1].trim()).filter(Boolean);
  for (const selector of selectors) assert.match(selector, /^\.combat\b/, `always-on rules are scoped to the combat screen: ${selector}`);
  assert.match(css, /\.combat \{ --selection-color: #4f8fff; \}/, 'the selection is blue in every fight');
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

// Review item 2: the round decays each enemy's momentum by one step before it orders anything (startRound, decay
// from the rules), so the forecast and the banner must read the decayed value too.
import { makeFight, plannedQueueSpeeds } from '../src/engine/combatRounds/timeline.js';
import { startRound } from '../src/engine/combatRounds/round.js';
import { momentumSpeed } from '../src/engine/combatRounds/resolver.js';
import { staggerEnemy } from '../src/engine/actions.js';

// The real round's speeds, built as commitRound builds them: the stored momentum goes in, and startRound decays it.
function realRoundEntries(c, enemyId) {
  const cr = c.combatRounds;
  const tables = { armor: new Map(Object.entries(cr.rules.tables.evasionArmor)), cards: new Map(Object.entries(cr.rules.tables.evasionCards)) };
  const enemy = c.enemies.find((e) => e.id === enemyId);
  const specs = [
    { id: 'player', side: 'player', name: 'player', attrs: {}, level: 0, hp: c.player.hp, sp: 99, wis: 0, tags: [], stance: null, hand: [] },
    ...c.enemies.map((e) => ({ id: e.id, side: 'enemy', name: e.name ?? e.enemyId, attrs: {}, level: 0, hp: e.hp, sp: 3, wis: 0, tags: [], stance: null, hand: [] })),
  ];
  const state = makeFight(specs, tables);
  Object.assign(state.momentum, cr.momentum ?? {});
  const queues = { player: cr.playerQueue.map((r) => ({ ...r.tl })) };
  queues[enemy.id] = Rounds.enemyActions(c, enemy.id);
  const round = startRound(state, { queues, rng: () => 0.5, merge: cr.rules.merge, decay: cr.rules.decay, liveDefence: true });
  return round.timeline.entries;
}

for (const stored of [2, -2]) {
  test(`momentum ${stored}: the forecast speeds equal the speeds the real round orders by (decay first)`, () => {
    const c = fight();
    const enemy = liveEnemy(c);
    c.combatRounds.momentum = { [enemy.id]: stored };
    Rounds.buildEnemyQueues(c, { isFirstTurn: true, pick: (_e, def) => Object.keys(def.moves)[0], held: () => false });
    // As rollIntents does: the live intent is the queue's slot 0.
    enemy.intent = { kind: 'attack', moveId: c.combatRounds.enemyQueues[enemy.id][0].moveId };
    const card = attackCard(c);
    dispatch(c, { type: 'playCard', cardInstanceId: card.instanceId, targetId: enemy.id });
    const entries = realRoundEntries(c, enemy.id);
    const foeEntry = entries.find((e) => e.actor === enemy.id);
    const playerEntry = entries.find((e) => e.card?.instanceId === card.instanceId);
    assert.ok(foeEntry && playerEntry, 'both the foe and the player act in the real round');
    const realFoe = foeEntry.speed.effective - foeEntry.speed.d4;
    const realCard = playerEntry.speed.effective - playerEntry.speed.d4;
    const forecast = Rounds.screenForecast(c, enemy.id, roundCardForecast(c, card.instanceId, enemy.id));
    assert.equal(forecast.foeSpeed, realFoe, 'the foe forecast uses the decayed momentum the round uses');
    assert.equal(forecast.cardSpeed, realCard, 'the card forecast uses the decayed momentum the round uses');
  });
}

test('the banner momentum is the decayed value that applies this round', () => {
  const c = fight();
  const enemy = liveEnemy(c);
  c.combatRounds.momentum = { [enemy.id]: 2 };
  assert.equal(Rounds.roundMomentum(c)[enemy.id], 1, 'M=+2 decays to +1 for this round');
  c.combatRounds.momentum = { [enemy.id]: -3 };
  assert.equal(Rounds.roundMomentum(c)[enemy.id], -2, 'M=-3 decays to -2 for this round');
  assert.equal(c.combatRounds.momentum[enemy.id], -3, 'the stored value is not changed by the read');
  assert.equal(momentumSpeed(Rounds.roundMomentum(c)[enemy.id]), -1);
});

test('the banner tab reads the decayed momentum, not the stored one', () => {
  const screen = readFileSync(new URL('../src/ui/components/combatRoundsScreen.js', import.meta.url), 'utf8');
  // Rounds mode reads roundMomentum (the decayed value); a normal fight reads displayedMomentum, which is already decayed
  // at its turn start (SPEC §4.11, owner decision 2026-10-12). Neither reads the stored rounds momentum directly.
  assert.match(screen, /combat\.combatRounds \? roundMomentum\(combat\) : displayedMomentum\(combat\)/, 'the banner reads the decayed value of the fight');
  assert.match(screen, /momentumTab\(values\[targetedId\]/, 'the tab reads that value for the targeted enemy');
  assert.doesNotMatch(screen, /momentumTab\(cr\.momentum/, 'the banner no longer reads the stored momentum');
});

// Review item 3: the queued dim is a ::after, and illustrated cards hide every ::after with a higher-specificity rule.
// The preview's dim must out-rank that rule inside the preview scope and set its own display.
function specificityOf(selector) {
  const bare = selector.replace(/\[[^\]]*\]/g, '[]');
  const a = (selector.match(/#[\w-]+/g) || []).length;
  const b = (bare.match(/\.[\w-]+|\[\]|(?<!:):[a-z-]+/gi) || []).length;
  const c = (bare.match(/::[a-z-]+|(?<![.#:\w-])[a-z][\w-]*/gi) || []).length;
  return [a, b, c];
}
const outranks = (x, y) => {
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
};

test('the queued dim outranks the illustrated card rule that hides every ::after, and shows itself', () => {
  const css = readFileSync(new URL('../styles/combat-rounds-preview.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const illustrated = readFileSync(new URL('../styles/illustrated-cards.css', import.meta.url), 'utf8');
  const hidden = illustrated.match(/:root \.card\.illustrated-card::before,\s*:root \.card\.illustrated-card::after\s*\{\s*display:\s*none/);
  assert.ok(hidden, 'the illustrated card still hides its ::after (the rule this test guards against)');
  const hiddenSpec = specificityOf(':root .card.illustrated-card::after');
  const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter((m) => /cr-queued::after/.test(m[1]));
  assert.equal(rules.length, 1, 'one rule paints the queued dim');
  const [, selector, body] = rules[0];
  assert.match(body, /display:\s*block/, 'the dim sets its own display, so the hidden ::after does not win');
  assert.match(selector.trim(), /^\.combat\[data-combat-rounds='preview'\]/, 'the dim is scoped to the preview');
  assert.ok(outranks(specificityOf(selector.trim()), hiddenSpec),
    `the dim (${specificityOf(selector.trim())}) outranks the hidden ::after (${hiddenSpec})`);
});

// Review item 4: the decorator reads layout (getClientRects, getComputedStyle) before it writes the DOM, and the
// engine tables are built once per rules, not on every forecast.
test('the engine tables a forecast reads are built once and reused, not rebuilt per call', () => {
  const c = fight();
  const enemy = liveEnemy(c);
  const first = Rounds.screenForecast(c, enemy.id, null).stanceTable;
  const second = Rounds.screenForecast(c, enemy.id, null).stanceTable;
  assert.ok(first instanceof Map);
  assert.equal(second, first, 'the same Map serves every forecast of one rules object');
});

test('the decorator reads layout before its first DOM write (one layout pass, not one per enemy)', () => {
  const screen = readFileSync(new URL('../src/ui/components/combatRoundsScreen.js', import.meta.url), 'utf8');
  const body = screen.slice(screen.indexOf('export function decorateCombatRoundsScreen'));
  const reads = [body.indexOf('getClientRects('), body.indexOf('getComputedStyle(')];
  assert.ok(reads.every((i) => i >= 0), 'the decorator measures the outline art');
  const write = body.search(/\.remove\(\)|\.append\(|\.dataset\.\w+ =|\.classList\.toggle\(|\.textContent =/);
  assert.ok(write >= 0);
  assert.ok(Math.max(...reads) < write, 'every layout read comes before the first write');
});

// Review item 5: a stagger that lands during planning makes the enemy's intent 'staggered' and its queue will not be
// played (enemyMoveAt drops it at commit). The preview must not show that queue: no follow-ups, no forecast.
test('a stagger during planning shows no follow-ups and gives no forecast against that enemy', () => {
  const c = fight();
  const enemy = liveEnemy(c);
  const before = Rounds.enemyActions(c, enemy.id);
  assert.ok(before.length > 0, 'the enemy has a queue before the stagger');
  assert.equal(enemy.intent.moveId, before[0].id, 'the live intent is queue slot 0');
  staggerEnemy(c, enemy);
  assert.equal(enemy.intent.kind, 'staggered');
  assert.deepEqual(Rounds.enemyActions(c, enemy.id), [], 'the stale queue is not shown');
  const card = attackCard(c);
  const forecast = Rounds.screenForecast(c, enemy.id, roundCardForecast(c, card.instanceId, enemy.id));
  assert.equal(forecast.foe, null, 'no foe stance to outline against');
  assert.equal(forecast.foeSpeed, null, 'no foe speed to compare');
});

test('a queue whose slot 0 no longer matches the live intent is not shown either', () => {
  const c = fight();
  const enemy = liveEnemy(c);
  const queue = Rounds.enemyActions(c, enemy.id);
  assert.ok(queue.length > 0);
  enemy.intent = { kind: 'attack', moveId: 'noSuchMove' };
  assert.deepEqual(Rounds.enemyActions(c, enemy.id), [], 'a mismatched slot 0 shows no queue');
  enemy.intent = { kind: 'attack', moveId: queue[0].id };
  assert.equal(Rounds.enemyActions(c, enemy.id).length, queue.length, 'a matching slot 0 shows the queue');
});

// Review item 6: the preview's thin outline replaces the live aim halo only on an enemy that has an outline drawn.
test('the aim halo is hidden only on an enemy whose outline is drawn', () => {
  const css = readFileSync(new URL('../styles/combat-visuals.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(css, /\.enemy \.aim-silho\s*\{\s*display:\s*none/, 'no unconditional hide of the aim halo');
  assert.match(css, /\.combat \.enemy\[data-cr-outline\] \.aim-silho\s*\{\s*display:\s*none/,
    'the halo is hidden only where the screen marks a drawn outline');
});

// A stub DOM with one enemy box, just enough for the decorator's reads and writes.
function decorateWithStubbedBox(combat, armedCardId, targetedId) {
  const img = { getClientRects: () => [{}], closest: () => null, dataset: {} };
  const box = {
    dataset: {},
    querySelector: (sel) => (sel === '.intent' ? null : null),
    querySelectorAll: (sel) => (sel === '.sprite img' ? [img] : []),
  };
  const root = {
    dataset: {},
    querySelector: (sel) => (sel.startsWith('.combatant.enemy') ? box : null),
    querySelectorAll: () => [],
  };
  const previous = { CSS: globalThis.CSS, getComputedStyle: globalThis.getComputedStyle, document: globalThis.document };
  globalThis.CSS = { escape: (s) => String(s) };
  globalThis.getComputedStyle = () => ({ visibility: 'visible' });
  globalThis.document = { createElement: () => { throw new Error('no follow-up symbols in this fixture'); } };
  try {
    decorateCombatRoundsScreen(root, combat, { armedCardId, targetedId });
  } finally {
    Object.assign(globalThis, { CSS: previous.CSS, getComputedStyle: previous.getComputedStyle, document: previous.document });
    if (previous.CSS === undefined) delete globalThis.CSS;
    if (previous.getComputedStyle === undefined) delete globalThis.getComputedStyle;
    if (previous.document === undefined) delete globalThis.document;
  }
  return { box, img };
}

test('the decorator marks an enemy only when it draws a preview outline on it', () => {
  // Find a fight where the aimed card draws an outline on the enemy (the forecast needs a stage-3 read).
  let found = null;
  for (let seed = 1; seed < 300 && !found; seed++) {
    const c = fight({ seed });
    const enemy = liveEnemy(c);
    const card = attackCard(c);
    const forecast = roundCardForecast(c, card.instanceId, enemy.id);
    const screen = forecast ? Rounds.screenForecast(c, enemy.id, forecast) : null;
    const colour = screen?.foe ? targetOutline({ card: forecast, foe: screen.foe, cardSpeed: screen.cardSpeed,
      foeSpeed: screen.foeSpeed, stage: Screen.readStage(previewIntent(c, enemy.id)), stanceTable: screen.stanceTable }) : null;
    if (colour) found = { c, card, enemy };
  }
  assert.ok(found, 'a fixture with a drawn outline exists');
  const drawn = decorateWithStubbedBox(found.c, found.card.instanceId, found.enemy.id);
  assert.ok(drawn.box.dataset.crOutline, 'an enemy with a drawn outline is marked');
  const idle = decorateWithStubbedBox(found.c, null, found.enemy.id);
  assert.equal(idle.box.dataset.crOutline, undefined, 'with no card aimed, nothing is marked');
  assert.equal(idle.img.dataset.targetOutline, undefined, 'and the art is left unpainted');
});
