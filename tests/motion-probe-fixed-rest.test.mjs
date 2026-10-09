import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../tools/motion-probe.mjs', import.meta.url), 'utf8');
const predicate = source.slice(source.indexOf('async function fixedRest('), source.indexOf('// Every living combatant'));

async function inspect({ blank = false, lateBlank = false, pixelChange = false, hidden = false, parentHidden = false, move = false,
  scale = false, canvasMove = false, poseChange = false, wrongPose = false, displacing = false,
  left = 20, width = 100, tone = 0, pose = 'ready', rest = 'idle', baseline = [] } = {}) {
  let frames = 0, reads = 0;
  const body = { parentElement: null, getAnimations: () => [] };
  const frame = { dataset: { eid: 'p1' }, classList: { contains: name => name === 'player' },
    parentElement: body, getAnimations: () => [] };
  const changing = () => frames > 8;
  const rect = (canvas = false) => ({ left: left + ((move || canvas && canvasMove) && changing() ? 4 : 0),
    top: 30, width: width + (scale && changing() ? 8 : 0), height: 190 });
  const stage = { parentElement: frame,
    get dataset() { return { pose: wrongPose ? 'attack-load' : poseChange && changing() ? 'counter-load' : pose,
      rest, stance: rest === 'counter' ? 'counter' : 'neutral' }; },
    getBoundingClientRect: () => rect(),
    getAnimations: () => displacing ? [{ playState: 'running', effect: {
      getKeyframes: () => [{ scale: '1' }, { scale: '1.1' }]
    } }] : [] };
  const canvas = { parentElement: stage, width: 2, height: 2,
    getBoundingClientRect: () => rect(true), getAnimations: () => [],
    getContext: () => ({ getImageData() {
      reads++;
      return { data: new Uint8ClampedArray([
        pixelChange && changing() ? 120 : tone, 0, 0, blank || lateBlank && changing() ? 0 : 255
      ]) };
    } }) };
  stage.querySelector = () => canvas;
  frame.querySelector = () => stage;
  const browser = { document: { querySelectorAll: () => [frame] },
    requestAnimationFrame(callback) { frames++; callback(frames * 16); },
    getComputedStyle(node) { return { opacity: parentHidden && node === body ? '0' : '1',
      display: hidden && node === canvas ? 'none' : 'block', visibility: 'visible' }; } };
  const verdicts = [];
  const fixedRest = runInNewContext(`${predicate}\nfixedRest`, {
    check: (ok, label, detail) => verdicts.push({ ok, label, detail })
  });
  const sampled = await fixedRest({ evaluate: expression => runInNewContext(expression, browser) }, 'IDLE', baseline);
  return { verdicts, sampled, frames, reads };
}

test('Default fixed-rest browser predicate requires painted stable stage and canvas geometry', async () => {
  const result = await inspect();
  assert.ok(result.verdicts.every(v => v.ok));
  assert.equal(result.frames, 22, 'two settling frames and twenty sampled frames remain real RAF observations');
  assert.equal(result.reads, 2, 'only first and last samples materialize pixels');
  assert.match(result.verdicts.at(-1).detail, /painted canvas holds its fixed rest/);
  assert.equal(result.sampled[0].id, 'p1');
});

test('Default rest rejects blank, hidden, translated, resized and changing action frames', async () => {
  for (const fault of [{ blank: true }, { lateBlank: true }, { pixelChange: true }, { hidden: true }, { parentHidden: true }, { move: true },
    { scale: true }, { canvasMove: true }, { poseChange: true }, { wrongPose: true }, { displacing: true }]) {
    const result = await inspect(fault);
    assert.equal(result.verdicts.at(-1).ok, false, JSON.stringify(fault));
  }
});

test('after-turn checks retain the original anchor/scale while allowing a legitimate held stance', async () => {
  const before = await inspect();
  const held = await inspect({ pose: 'stance-counter', rest: 'counter', tone: 120, baseline: before.sampled });
  assert.ok(held.verdicts.every(v => v.ok), 'held pose differs across actions but stays stable during rest');
  const moved = await inspect({ left: 24, baseline: before.sampled });
  assert.equal(moved.verdicts.at(-1).ok, false, 'a turn cannot silently move a fixed resting root');
  const resized = await inspect({ width: 108, baseline: before.sampled });
  assert.equal(resized.verdicts.at(-1).ok, false, 'a turn cannot silently resize a fixed resting root');
});

test('Classic bob checks boot the actual display appearance rather than only changing sprite style', async () => {
  const bootCode = source.slice(source.indexOf('async function boot('), source.indexOf('\nconst point ='));
  for (const classic of [false, true]) {
    let navigation;
    const boot = runInNewContext(`${bootCode}\nboot`, { CLASSIC: false, SEED: 'MOTION1',
      wait: async () => {}, until: async () => {} });
    await boot({ send: async (method, options) => { if (method === 'Page.navigate') navigation = options.url; },
      evaluate: async () => ({ cls: false, os: false, appearance: classic ? 'classic' : 'alternative' }) },
      'http://localhost/', { setting: false, os: false, classic });
    const settings = JSON.parse(new URL(navigation).searchParams.get('shotSettings'));
    assert.equal(settings.classicAppearance, classic);
    assert.equal(settings.showPlayedCard, true);
  }
});
