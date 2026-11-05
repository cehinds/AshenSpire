// The floater column over one combatant (ui/fx.js floatNum + callout, owner 2026-11-05): sequenced spawns,
// one x, one font size, a rising list, a cap with an early fade, Reduced motion, and the combat-speed tie-in.
// The pure queue is tests/floater-stack.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { floatNum, callout, clearCallouts, floaterLanesFit, setAnimSpeed } from '../src/ui/fx.js';
import { floaterLifeMs, floaterStaggerMs, setCombatPacing } from '../src/ui/animationPace.js';
import { FLOATER_STACK } from '../src/ui/floaterStack.js';
import { flushMeasureJobs } from '../src/ui/frameMeasure.js';
import { withKitDom } from './helpers/kit-dom.mjs';

const GAP = FLOATER_STACK.floaterLineGapPx;
// A layer and anchors with fixed boxes; every element measures 40 x 20. `spawns` records each floater as it joins the layer.
function scene(document, { combat = false } = {}) {
  const create = document.createElement.bind(document);
  document.createElement = (name) => {
    const node = Object.assign(create(name), { offsetWidth: 40, offsetHeight: 20 });
    Object.defineProperty(node, 'isConnected', { value: true }); // a live combatant: its waiting floaters still spawn
    const props = node.props = {};
    const set = node.style.setProperty?.bind(node.style);
    const remove = node.style.removeProperty?.bind(node.style);
    node.style.setProperty = (key, value) => { props[key] = value; return set?.(key, value); };
    node.style.removeProperty = (key) => { delete props[key]; return remove?.(key); };
    return node;
  };
  const fx = document.createElement('div'); fx.className = 'fx-layer';
  fx.box = { left: 0, top: 0, width: 600, height: 700 };
  const anchor = (left) => { const a = document.createElement('div'); a.box = { left, top: 200, width: 80, height: 120 }; return a; };
  const spawns = [];
  const append = fx.appendChild.bind(fx);
  fx.appendChild = (node) => { spawns.push({ node, at: Date.now() }); return append(node); };
  return { fx, a: anchor(100), b: anchor(300), spawns, anchor };
}
// The mocked clock jumps to the end of a tick before its timers run, so a long wait is taken in small steps.
const advance = (t, ms) => { for (let left = ms; left > 0; left -= 5) t.mock.timers.tick(Math.min(5, left)); };
const lift = (node) => parseFloat(node.props['--float-lift'] ?? '0');
const setup = (t, fn) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  setCombatPacing({ combatSpeed: 1 });
  setAnimSpeed('normal');
  try { withKitDom(({ document }) => fn(scene(document), document)); }
  finally { setAnimSpeed('normal'); setCombatPacing({ combatSpeed: 1 }); }
};

test('floaters over one combatant spawn one stagger apart, in order, never two at once', (t) => setup(t, ({ fx, a, spawns }) => {
  const stagger = floaterStaggerMs();
  assert.equal(stagger, 320, 'the default stagger at Combat speed x1');
  const nodes = [['-11', 'heal'], ['+5', 'blk'], ['+2', 'heal'], ['BURN', 'heal']].map(([text, cls]) => floatNum(fx, a, text, cls));
  assert.deepEqual(spawns.map((s) => s.node.textContent), ['-11'], 'only the first is in the layer yet');
  advance(t, stagger * 3);
  flushMeasureJobs();
  assert.deepEqual(spawns.map((s) => s.node.textContent), ['-11', '+5', '+2', 'BURN']);
  assert.deepEqual(spawns.map((s) => s.at), [0, stagger, 2 * stagger, 3 * stagger]);
  assert.deepEqual(spawns.map((s) => s.node), nodes, 'the returned element is the one that spawns');
}));

test('floaters of two combatants spawn independently', (t) => setup(t, ({ fx, a, b, spawns }) => {
  floatNum(fx, a, '-1', 'heal'); floatNum(fx, a, '-2', 'heal'); floatNum(fx, b, '-3', 'heal');
  assert.deepEqual(spawns.map((s) => s.node.textContent), ['-1', '-3'], 'each combatant starts its own sequence');
}));

test('one column: the same x for every floater, earlier ones lifted a line plus the gap each, y strictly decreasing', (t) => setup(t, ({ fx, a, spawns }) => {
  const step = 20 + GAP;
  ['-11', '+5', '+2', '-7'].forEach((text, i) => floatNum(fx, a, text, ['heal crit', 'blk small', 'heal', 'heal'][i]));
  advance(t, floaterStaggerMs() * 3);
  flushMeasureJobs();
  const nodes = spawns.map((s) => s.node);
  assert.equal(new Set(nodes.map((n) => n.style.left)).size, 1, 'no side lanes and no jitter: one x');
  assert.equal(nodes[0].style.left, '140px', 'centred on the combatant (100 + 80 / 2)');
  assert.deepEqual(nodes.map((n) => n.dataset.floatSlot), ['3', '2', '1', '0']);
  assert.deepEqual(nodes.map(lift), [3 * step, 2 * step, step, 0]);
  const y = nodes.map((n) => parseFloat(n.style.top) - lift(n));
  assert.ok(y.every((v, i) => i === 0 || v < y[i - 1] === false), 'newer floaters sit lower');
  assert.ok(y.every((v, i) => i === 0 || v > y[i - 1]), 'y strictly increases from the oldest (top) to the newest');
}));

test('the column only moves up: an expired floater leaves the newer ones where they are', (t) => setup(t, ({ fx, a, spawns }) => {
  floatNum(fx, a, '-1', 'heal'); floatNum(fx, a, '-2', 'heal');
  advance(t, floaterStaggerMs());
  flushMeasureJobs();
  const [first, second] = spawns.map((s) => s.node);
  assert.equal(lift(first), 20 + GAP);
  advance(t, floaterLifeMs() + 70);
  assert.ok(!fx.children.includes(first), 'the first has expired');
  assert.equal(lift(second), 0);
}));

test('the cap: a fifth floater makes the oldest fade early, and every queued floater still spawns', (t) => setup(t, ({ fx, a, spawns }) => {
  const cap = FLOATER_STACK.floaterMaxVisible;
  assert.equal(cap, 4);
  const nodes = [1, 2, 3, 4, 5].map((n) => floatNum(fx, a, `+${n}`, 'blk'));
  advance(t, floaterStaggerMs() * 4);
  assert.equal(spawns.length, 5, 'all queued floaters spawn, none dropped');
  assert.ok(nodes[0].className.includes('float-early'), 'the oldest fades early when the fifth spawns');
  assert.ok(!nodes[1].className.includes('float-early'));
  assert.ok(fx.children.filter((n) => !n.className.includes('float-early')).length <= cap, 'never more than the cap showing');
  advance(t, 250);
  assert.ok(!fx.children.includes(nodes[0]), 'the early-fading one is gone');
  const sixth = floatNum(fx, a, '+6', 'blk');
  advance(t, floaterStaggerMs());
  assert.equal(spawns.length, 6);
  assert.ok(nodes[1].className.includes('float-early'));
  assert.ok(sixth);
}));

test('Reduced motion: still sequenced and stacked (the CSS makes it fade only, with no glide)', (t) => setup(t, ({ fx, a, spawns }, document) => {
  document.body.classList.add('reduced-motion');
  floatNum(fx, a, '-1', 'heal'); floatNum(fx, a, '+2', 'blk'); floatNum(fx, a, '+3', 'heal');
  advance(t, floaterStaggerMs() * 2);
  flushMeasureJobs();
  assert.deepEqual(spawns.map((s) => s.at), [0, floaterStaggerMs(), 2 * floaterStaggerMs()]);
  assert.deepEqual(spawns.map((s) => lift(s.node)), [2 * (20 + GAP), 20 + GAP, 0]);
  const css = readFileSync(new URL('../styles/combat.css', import.meta.url), 'utf8');
  assert.match(css, /\.reduced-motion \.float-num \{ animation: num-life-still/, 'no rise: a plain fade');
  assert.match(css, /\.reduced-motion \.float-num, \.reduced-motion \.fx-callout \{ transition: none; \}/, 'no glide when the column shifts');
}));

test('stagger scales with the Combat speed the way the lifetime does, and shortens on Instant', (t) => setup(t, ({ fx, a, spawns }) => {
  const ratio = (life) => life / 1650;
  assert.equal(floaterStaggerMs(), Math.round(320 * ratio(floaterLifeMs())));
  setCombatPacing({ combatSpeed: 2 });
  assert.equal(floaterLifeMs(), 825);
  assert.equal(floaterStaggerMs(), 160, 'half the life, half the stagger');
  setCombatPacing({ combatSpeed: 8 });
  assert.equal(floaterLifeMs(), 400, 'the life floors at 400 ms');
  assert.equal(floaterStaggerMs(), Math.round(320 * 400 / 1650), 'and the stagger floors with it');
  setCombatPacing({ combatSpeed: 1 });
  setAnimSpeed('instant');
  assert.equal(floaterLifeMs(), 480);
  assert.equal(floaterStaggerMs(), Math.round(320 * 480 / 1650));
  setAnimSpeed('normal');
  setCombatPacing({ combatSpeed: 2 });
  floatNum(fx, a, '-1', 'heal'); floatNum(fx, a, '-2', 'heal');
  advance(t, 160);
  assert.deepEqual(spawns.map((s) => s.at), [0, 160]);
}));

test('words and numbers share one column and one clock', (t) => setup(t, ({ fx, a, spawns }) => {
  const word = callout(fx, a, 'e1', 'staggered');
  const num = floatNum(fx, a, '-9', 'heal');
  assert.equal(word.textContent, 'STAGGERED');
  assert.equal(callout(fx, a, 'e1', 'staggered'), null, 'the same word is not repeated while it waits or shows');
  advance(t, floaterStaggerMs());
  flushMeasureJobs();
  assert.deepEqual(spawns.map((s) => s.node), [word, num]);
  assert.deepEqual(spawns.map((s) => s.at), [0, 320]);
  assert.equal(word.dataset.calloutFor, 'e1');
  assert.equal(lift(word), 20 + GAP, 'the word is a slot above the number that followed it');
  assert.equal(num.style.left, word.style.left, 'same x');
}));

test('words waiting together spawn by priority; a number keeps its place', (t) => setup(t, ({ fx, a, spawns }) => {
  callout(fx, a, 'e1', 'staggered');                  // spawns now
  callout(fx, a, 'e1', 'blocked');
  floatNum(fx, a, '-4', 'heal');
  callout(fx, a, 'e1', 'status:burn');
  callout(fx, a, 'e1', 'resisted');
  advance(t, floaterStaggerMs() * 4);
  // waiting: blocked(2), number, burn(6), resisted(1) -> ranked slots hold burn, blocked, resisted around the number
  assert.deepEqual(spawns.map((s) => s.node.dataset.calloutKind ?? s.node.textContent), ['staggered', 'status:burn', '-4', 'blocked', 'resisted']);
}));

test('a skip drops the waiting floaters and the visible words; visible numbers keep their life', (t) => setup(t, ({ fx, a, spawns }) => {
  const word = callout(fx, a, 'e1', 'critical');
  const num = floatNum(fx, a, '-3', 'heal');
  floatNum(fx, a, '-4', 'heal');
  clearCallouts(fx);
  assert.ok(!fx.children.includes(word));
  advance(t, floaterStaggerMs() * 3);
  assert.deepEqual(spawns.map((s) => s.node.textContent), ['CRITICAL'], 'nothing waiting survives the skip');
  assert.ok(num && !fx.children.includes(num));
  const kept = floatNum(fx, a, '-5', 'heal');
  clearCallouts(fx);
  assert.ok(fx.children.includes(kept), 'a visible number keeps its lifetime');
}));

test('the slot-0 floater sits just above the overhead HUD, at the same x, with no side lane', (t) => setup(t, ({ fx, a, spawns }, document) => {
  const hud = document.createElement('div'); hud.box = { left: 100, top: 230, width: 80, height: 20 };
  a.closest = () => ({ querySelectorAll: () => [hud] });
  a.contains = () => false;
  const first = floatNum(fx, a, '+5', 'blk');
  flushMeasureJobs();
  assert.equal(first.style.top, '206px', 'bottom edge 4px above the HUD top (230 - 4 - 20)');
  assert.equal(first.style.left, '140px');
  const second = floatNum(fx, a, '+6', 'blk');
  advance(t, floaterStaggerMs());
  flushMeasureJobs();
  assert.equal(second.style.left, '140px', 'every floater keeps the same x');
}));

test('with no room above the HUD the column starts on the figure and rises over the HUD', (t) => setup(t, ({ fx, a, spawns }, document) => {
  const hud = document.createElement('div'); hud.box = { left: 100, top: 40, width: 80, height: 20 };
  a.closest = () => ({ querySelectorAll: () => [hud] });
  a.contains = () => false;
  const nodes = [1, 2, 3, 4].map((n) => floatNum(fx, a, `+${n}`, 'blk'));
  advance(t, floaterStaggerMs() * 3);
  flushMeasureJobs();
  assert.equal(nodes[0].style.top, '230px', 'a quarter of the way down the figure (200 + 120 x 0.25), the old damage spot');
  assert.equal(spawns.length, 4);
  assert.ok(nodes.every((n) => !n.className.includes('float-early')), 'there is room for the whole cap above the figure');
  assert.deepEqual(nodes.map(lift), [3 * 26, 2 * 26, 26, 0]);
}));

test('little room above the figure caps the column, never below two on the figure, and drops none', (t) => setup(t, ({ fx, a, spawns }, document) => {
  a.box = { left: 100, top: 20, width: 80, height: 120 };
  const hud = document.createElement('div'); hud.box = { left: 100, top: 20, width: 80, height: 10 };
  a.closest = () => ({ querySelectorAll: () => [hud] });
  a.contains = () => false;
  const nodes = [1, 2, 3, 4].map((n) => floatNum(fx, a, `+${n}`, 'blk'));
  advance(t, floaterStaggerMs() * 3);
  assert.equal(spawns.length, 4, 'every queued floater still spawns');
  assert.ok(nodes[0].className.includes('float-early') && nodes[1].className.includes('float-early'), 'only two show at once');
  assert.ok(!nodes[2].className.includes('float-early') && !nodes[3].className.includes('float-early'));
}));

test('lane fit: one line, then a line plus the gap per extra floater, minus the 40 px edge reserve', () => {
  assert.equal(floaterLanesFit(59, 20), 0);
  assert.equal(floaterLanesFit(60, 20), 1);
  assert.equal(floaterLanesFit(40 + 20 + 27, 20), 2);
  assert.equal(floaterLanesFit(40 + 20 + 54, 20), 3);
  assert.equal(floaterLanesFit(40 + 20 + 26, 20, 6), 2, 'an explicit gap replaces the 35% default');
  assert.equal(floaterLanesFit(6 + 20 + 26, 20, 6, 6), 2, 'an explicit edge reserve replaces the 40 px default');
});

test('one font size for every floater: damage, heal, Block, words and crits differ by colour and weight only', () => {
  const css = readFileSync(new URL('../styles/combat.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [...css.matchAll(/(?:^|\n)([^{}\n@][^{}]*?)\{([^}]*)\}/g)].map((m) => ({ sel: m[1].trim(), body: m[2] }));
  const floaterRules = rules.filter((r) => /(^|,)\s*\.(float-num|fx-callout)\b/.test(r.sel));
  const sized = floaterRules.filter((r) => /(^|[;\s])font-size\s*:/.test(r.body));
  assert.deepEqual(sized.map((r) => r.sel), ['.float-num', '.fx-callout'], 'only the two base rules set a size');
  for (const r of sized) assert.match(r.body, /font-size: var\(--floater-font, 2\.8rem\)/);
  assert.doesNotMatch(css, /\.float-num\.(crit|heavy|small|pct\d+|burst)\s*\{[^}]*font-size/);
  assert.doesNotMatch(css, /\.fx-callout\[data-callout-kind\^='action:'\]\s*\{[^}]*font-size/);
});

test('a measured line that differs from the fallback keeps one strictly ordered column (text 20 px, HUD top 70, figure top 200)', (t) => setup(t, ({ fx, a, spawns }, document) => {
  const hud = document.createElement('div'); hud.box = { left: 100, top: 70, width: 80, height: 20 };
  a.closest = () => ({ querySelectorAll: () => [hud] });
  a.contains = () => false;
  const nodes = [1, 2, 3].map((n) => floatNum(fx, a, `+${n}`, 'blk'));
  advance(t, floaterStaggerMs() * 2);
  flushMeasureJobs();
  assert.equal(spawns.length, 3);
  const base = nodes.map((n) => parseFloat(n.style.top));
  assert.equal(new Set(base).size, 1, `every floater shares one base (${base.join(', ')}), so the column never splits in two`);
  const y = nodes.map((n, i) => base[i] - lift(n));
  assert.ok(y.every((v, i) => i === 0 || v > y[i - 1]), `older floaters sit strictly above newer ones (${y.join(', ')})`);
}));

test('a damage number spawns at once at the bottom of the column; sibling floaters stagger after it', (t) => setup(t, ({ fx, a, spawns }) => {
  const stagger = floaterStaggerMs();
  const w1 = floatNum(fx, a, '+1', 'blk'); const w2 = floatNum(fx, a, '+2', 'blk');
  advance(t, 100);
  const dmg = floatNum(fx, a, '-9', 'dmg');
  assert.deepEqual(spawns.map((s) => [s.node, s.at]), [[w1, 0], [dmg, 100]], 'the number does not wait behind +2');
  advance(t, stagger - 1);
  assert.equal(spawns.length, 2, '+2 waits a full stagger after the number');
  advance(t, 1);
  flushMeasureJobs();
  assert.deepEqual(spawns.map((s) => s.node), [w1, dmg, w2]);
  assert.equal(lift(dmg), 20 + GAP, 'the number took a slot and +2 is below it');
}));

test('a floater\'s sound plays when it spawns, not when it queued', (t) => setup(t, ({ fx, a }) => {
  const played = [];
  floatNum(fx, a, '+1', 'blk', undefined, { onSpawn: () => played.push(['one', Date.now()]) });
  floatNum(fx, a, '+2', 'blk', undefined, { onSpawn: () => played.push(['two', Date.now()]) });
  assert.deepEqual(played, [['one', 0]], 'the second sound waits for its floater');
  advance(t, floaterStaggerMs());
  assert.deepEqual(played, [['one', 0], ['two', floaterStaggerMs()]]);
}));

test('a rebuilt figure (new element, same data-eid) receives the floaters that were waiting', (t) => setup(t, ({ fx, a, spawns }) => {
  const figure = () => ({ box: a.box, isConnected: true, closest: () => ({ dataset: { eid: 'player' } }) });
  const first = figure(), second = figure();
  Object.defineProperty(fx, 'ownerDocument', { value: { querySelector: (sel) => (sel.includes('data-eid="player"') ? second : null) } });
  floatNum(fx, first, '+1', 'blk'); floatNum(fx, first, '+2', 'blk');
  first.isConnected = false; // the player is rebuilt before the second floater's turn
  advance(t, floaterStaggerMs());
  flushMeasureJobs();
  assert.equal(spawns.length, 2, 'the waiting floater was retargeted to the rebuilt figure, not dropped');
}));

test('a queued callout word survives a figure rebuild and spawns at the new sprite', (t) => setup(t, ({ fx, a, spawns }) => {
  const figure = (left) => ({ getBoundingClientRect: () => ({ ...a.box, left, right: left + a.box.width, bottom: a.box.top + a.box.height }), isConnected: true, closest: () => ({ dataset: { eid: 'player' } }) });
  const first = figure(100), second = figure(300);
  Object.defineProperty(fx, 'ownerDocument', { value: { querySelector: (sel) => (sel.includes('data-eid="player"') ? second : null) } });
  floatNum(fx, first, '+1', 'blk');
  const word = callout(fx, first, 'player', 'staggered');
  first.isConnected = false;
  advance(t, floaterStaggerMs());
  flushMeasureJobs();
  assert.deepEqual(spawns.map((s) => s.node).pop(), word, 'the word spawned');
  assert.equal(word.style.left, '340px', 'centred on the rebuilt sprite (300 + 80 / 2), not the detached one');
}));

test('the column forgets its measured line when it empties', (t) => setup(t, ({ fx, a, spawns }) => {
  floatNum(fx, a, '+1', 'blk');
  advance(t, floaterLifeMs() + 100);
  flushMeasureJobs();
  const again = floatNum(fx, a, '+2', 'blk');
  flushMeasureJobs();
  assert.equal(again.dataset.floatSlot, '0');
  assert.equal(spawns.length, 2);
}));
