// Floaters at one anchor within one floater life take different lanes (ui/fx.js floatNum);
// the lane frees when the life ends, and another anchor starts at lane 0.
import test from 'node:test';
import assert from 'node:assert/strict';
import { floatNum } from '../src/ui/fx.js';
import { floaterLifeMs, setCombatPacing } from '../src/ui/animationPace.js';
import { flushMeasureJobs } from '../src/ui/frameMeasure.js';
import { withKitDom } from './helpers/kit-dom.mjs';

test('floaters on one anchor take separate lanes, reset after the life, and are per anchor', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  setCombatPacing({ combatSpeed: 1 });
  withKitDom(({ document }) => {
    const create = document.createElement.bind(document);
    document.createElement = (name) => {
      const node = Object.assign(create(name), { offsetWidth: 40, offsetHeight: 20 });
      const props = node.props = {};
      const set = node.style.setProperty?.bind(node.style);
      node.style.setProperty = (key, value) => { props[key] = value; return set?.(key, value); };
      return node;
    };
    const fx = document.createElement('div'); fx.className = 'fx-layer';
    const a = document.createElement('div'); a.box = { left: 100, top: 100, width: 80, height: 120 };
    const b = document.createElement('div'); b.box = { left: 300, top: 100, width: 80, height: 120 };
    fx.box = { left: 0, top: 0, width: 600, height: 700 };
    const opts = { jitter: false };
    const one = floatNum(fx, a, '-11', 'dmg', null, opts);
    const two = floatNum(fx, a, '4', 'poise', null, opts);
    const three = floatNum(fx, a, '2', 'heal', null, opts);
    const four = floatNum(fx, a, '1', 'heal', null, opts);
    const other = floatNum(fx, b, '-3', 'dmg', null, opts);
    flushMeasureJobs();
    assert.deepEqual([one, two, three, four, other].map((n) => n.dataset.floatLane), ['0', '1', '2', '0', '0']);
    assert.equal(one.props['--float-lane'], undefined, 'lane 0 is not lifted');
    assert.equal(two.props['--float-lane'], '22px', 'lane 1 lifts one line (20 x 1.1)');
    assert.equal(three.props['--float-lane'], '44px');
    t.mock.timers.tick(floaterLifeMs() + 1);
    const later = floatNum(fx, a, '-9', 'dmg', null, opts);
    assert.equal(later.dataset.floatLane, '0', 'the lanes reset once the life has expired');
  });
});

test('a lane freed by an expired floater is reused before a lane still occupied (Reduced motion: nothing rises)', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  setCombatPacing({ combatSpeed: 1 });
  withKitDom(({ document }) => {
    document.body.classList.add('reduced-motion');
    const create = document.createElement.bind(document);
    document.createElement = (name) => Object.assign(create(name), { offsetWidth: 40, offsetHeight: 20 });
    const fx = document.createElement('div'); fx.className = 'fx-layer';
    const a = document.createElement('div'); a.box = { left: 100, top: 100, width: 80, height: 120 };
    fx.box = { left: 0, top: 0, width: 600, height: 700 };
    const opts = { jitter: false };
    const life = floaterLifeMs();
    const first = floatNum(fx, a, '-1', 'dmg', null, opts);
    t.mock.timers.tick(Math.floor(life / 3));
    const second = floatNum(fx, a, '-2', 'dmg', null, opts);
    t.mock.timers.tick(life - Math.floor(life / 3) + 1);
    // first has expired, second is still showing in lane 1: the newcomer takes lane 0, not lane 1.
    const third = floatNum(fx, a, '-3', 'dmg', null, opts);
    const fourth = floatNum(fx, a, '-4', 'dmg', null, opts);
    flushMeasureJobs();
    assert.deepEqual([first, second, third, fourth].map((n) => n.dataset.floatLane), ['0', '1', '0', '2']);
    // All three lanes taken: the lane whose floater expires soonest (lane 1) is reused.
    const fifth = floatNum(fx, a, '-5', 'dmg', null, opts);
    assert.equal(fifth.dataset.floatLane, '1');
  });
});

test('a floater placed in a fixed slot (lane: false) takes no lane and holds none', () => {
  setCombatPacing({ combatSpeed: 1 });
  withKitDom(({ document }) => {
    const create = document.createElement.bind(document);
    document.createElement = (name) => Object.assign(create(name), { offsetWidth: 40, offsetHeight: 20 });
    const fx = document.createElement('div'); fx.className = 'fx-layer';
    const a = document.createElement('div'); a.box = { left: 100, top: 100, width: 80, height: 120 };
    fx.box = { left: 0, top: 0, width: 600, height: 700 };
    const guard = floatNum(fx, a, '4', 'blk', null, { x: -26, jitter: false, lane: false });
    const damage = floatNum(fx, a, '-7', 'dmg', null, { x: 26, jitter: false, lane: false });
    const next = floatNum(fx, a, '-3', 'dmg', null, { jitter: false });
    flushMeasureJobs();
    assert.deepEqual([guard, damage, next].map((n) => n.dataset.floatLane), ['0', '0', '0']);
  });
});

test('a lane lifts by the measured heights of the lanes below it', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  setCombatPacing({ combatSpeed: 1 });
  withKitDom(({ document }) => {
    const create = document.createElement.bind(document);
    let nextHeight = 20;
    document.createElement = (name) => {
      const node = Object.assign(create(name), { offsetWidth: 40, offsetHeight: nextHeight });
      const props = node.props = {};
      const set = node.style.setProperty?.bind(node.style);
      node.style.setProperty = (key, value) => { props[key] = value; return set?.(key, value); };
      return node;
    };
    const fx = document.createElement('div'); fx.className = 'fx-layer';
    const a = document.createElement('div'); a.box = { left: 100, top: 100, width: 80, height: 120 };
    fx.box = { left: 0, top: 0, width: 600, height: 700 };
    const opts = { jitter: false };
    nextHeight = 60; const crit = floatNum(fx, a, '-40', 'dmg crit', null, opts);
    nextHeight = 20; const small = floatNum(fx, a, '-2', 'dmg small', null, opts);
    const third = floatNum(fx, a, '-3', 'dmg small', null, opts);
    flushMeasureJobs();
    assert.equal(crit.props['--float-lane'], undefined);
    assert.equal(small.props['--float-lane'], '22px', 'lane 1 lifts by its own height: its bottom lands on the crit top');
    assert.equal(third.props['--float-lane'], '44px', 'lane 2 lifts by its own height plus lane 1 (22 + 22)');
    // Reversed: a crit over a small number must lift by the crit's own height.
    const b = document.createElement('div'); b.box = { left: 300, top: 100, width: 80, height: 120 };
    nextHeight = 20; floatNum(fx, b, '-2', 'dmg small', null, opts);
    nextHeight = 60; const bigOver = floatNum(fx, b, '-40', 'dmg crit', null, opts);
    nextHeight = 20; const smallOver = floatNum(fx, b, '-3', 'dmg small', null, opts);
    flushMeasureJobs();
    assert.equal(bigOver.props['--float-lane'], '66px', 'the 60px crit in lane 1 clears lane 0 by its own height');
    assert.equal(smallOver.props['--float-lane'], '88px', 'lane 2 sits above the crit (66 + 22)');
  });
});

test('a taller number reusing a lower lane re-lifts the live floaters above it (Reduced motion)', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  setCombatPacing({ combatSpeed: 1 });
  withKitDom(({ document }) => {
    document.body.classList.add('reduced-motion');
    const create = document.createElement.bind(document);
    let nextHeight = 20;
    document.createElement = (name) => {
      const node = Object.assign(create(name), { offsetWidth: 40, offsetHeight: nextHeight });
      const props = node.props = {};
      const set = node.style.setProperty?.bind(node.style);
      node.style.setProperty = (key, value) => { props[key] = value; return set?.(key, value); };
      return node;
    };
    const fx = document.createElement('div'); fx.className = 'fx-layer';
    const a = document.createElement('div'); a.box = { left: 100, top: 100, width: 80, height: 120 };
    fx.box = { left: 0, top: 0, width: 600, height: 700 };
    const opts = { jitter: false };
    const life = floaterLifeMs();
    const step = Math.floor(life / 4);
    floatNum(fx, a, '-1', 'dmg small', null, opts);
    t.mock.timers.tick(step);
    floatNum(fx, a, '-2', 'dmg small', null, opts);
    t.mock.timers.tick(step);
    const upper = floatNum(fx, a, '-3', 'dmg small', null, opts);
    flushMeasureJobs();
    assert.equal(upper.dataset.floatLane, '2');
    assert.equal(upper.props['--float-lane'], '44px');
    // Lanes 0 and 1 expire; lane 2 is still showing. A small number takes lane 0, a crit lane 1.
    t.mock.timers.tick(life - step + 1);
    floatNum(fx, a, '-4', 'dmg small', null, opts);
    nextHeight = 60; const crit = floatNum(fx, a, '-40', 'dmg crit', null, opts);
    flushMeasureJobs();
    assert.equal(crit.dataset.floatLane, '1');
    assert.equal(crit.props['--float-lane'], '66px');
    assert.equal(upper.props['--float-lane'], '88px', 'the surviving lane-2 number rises above the taller crit (66 + 22)');
  });
});

test('with motion, a number that has risen past its own height no longer blocks: the newcomer starts at lane 0', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  setCombatPacing({ combatSpeed: 1 });
  withKitDom(({ document }) => {
    const create = document.createElement.bind(document);
    document.createElement = (name) => {
      const node = Object.assign(create(name), { offsetWidth: 40, offsetHeight: 20 });
      const props = node.props = {};
      const set = node.style.setProperty?.bind(node.style);
      node.style.setProperty = (key, value) => { props[key] = value; return set?.(key, value); };
      return node;
    };
    const fx = document.createElement('div'); fx.className = 'fx-layer';
    const a = document.createElement('div'); a.box = { left: 100, top: 100, width: 80, height: 120 };
    fx.box = { left: 0, top: 0, width: 600, height: 700 };
    const opts = { jitter: false };
    const life = floaterLifeMs();
    floatNum(fx, a, '-1', 'dmg', null, opts);
    flushMeasureJobs();
    // A quarter of a life in, the first number has risen about 9 px: still in the way, so the second
    // is lifted past its current top (9 + 22), not a bare lane height.
    t.mock.timers.tick(Math.round(life * 0.25));
    const second = floatNum(fx, a, '-2', 'dmg', null, opts);
    flushMeasureJobs();
    assert.equal(second.dataset.floatLane, '1');
    const lift = parseFloat(second.props['--float-lane']);
    assert.ok(lift > 28 && lift < 36, `lifted past the risen first number: ${lift}`);
    // Two thirds in, the first has risen 30 px, past its 20 px height: it no longer blocks, and the
    // second (risen ~9 px, lifted ~31) sits far above, so the third starts at lane 0 under both.
    t.mock.timers.tick(Math.round(life * 0.42));
    const third = floatNum(fx, a, '-3', 'dmg', null, opts);
    flushMeasureJobs();
    assert.equal(third.dataset.floatLane, '0', 'the first number no longer blocks lane 0; the second still holds lane 1');
    assert.equal(third.props['--float-lane'], undefined, 'lane 0 is not lifted: the risen numbers are above it');
  });
});
