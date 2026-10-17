import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Exercise the exact browser expression without launching the probe's CLI.
const source = readFileSync(new URL('../tools/tutorial-reach.mjs', import.meta.url), 'utf8');
const start = source.indexOf('const SETTLED_MS =');
const end = source.indexOf('\nasync function main()', start);
const expression = runInNewContext(`${source.slice(start, end)}\nSETTLED;`);

async function measure({ movingFrame = false, movingSpot = false, lateFrameMove = false, bobbingIntent = true } = {}) {
  let now = 0;
  const frames = [];
  const rect = (selector) => {
    const relocated = selector === '.enemy-row .enemy' && (movingFrame || (lateFrameMove && now >= 600));
    const bob = bobbingIntent && selector === '.enemy-row .intent' ? 4 * Math.sin(now / 500) : 0;
    const motion = (relocated && movingFrame) || (selector === '.tut-spot' && movingSpot) ? now / 10 : 0;
    return { left: 20 + motion + (relocated && !movingFrame ? 80 : 0), top: 40 + bob, width: 100, height: 80 };
  };
  const result = runInNewContext(expression, {
    innerWidth: 1440, innerHeight: 900,
    performance: { now: () => now },
    requestAnimationFrame: (callback) => frames.push(callback),
    getComputedStyle: () => ({ getPropertyValue: () => '1.2' }),
    document: { documentElement: {}, querySelector: (selector) => ({ getBoundingClientRect: () => rect(selector) }) },
  });
  while (frames.length) { now += 1000 / 60; frames.shift()(); }
  return result;
}

test('tutorial rest permits intentional overhead bob while layout stays fixed', async () => {
  const result = await measure();
  assert.equal(result.settled, true);
  assert.ok(result.ms >= 700 && result.ms < 800);
});

test('tutorial rest rejects continuous enemy frame relocation at the existing budget', async () => {
  const result = await measure({ movingFrame: true, bobbingIntent: false });
  assert.equal(result.settled, false);
  assert.ok(result.ms > 15000 && result.ms < 15020);
});

test('tutorial rest still waits for late frame relocation and spotlight movement', async () => {
  const moved = await measure({ lateFrameMove: true, bobbingIntent: false });
  assert.equal(moved.settled, true);
  assert.ok(moved.ms >= 1300);
  assert.equal((await measure({ movingSpot: true, bobbingIntent: false })).settled, false);
});
