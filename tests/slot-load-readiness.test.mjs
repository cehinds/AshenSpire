import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../tools/slot-load-door.mjs', import.meta.url), 'utf8');
const start = source.indexOf('  const advanceTurn = async () => {');
const end = source.indexOf("\n  await cdp.send('Page.navigate'", start);
assert.ok(start >= 0 && end > start, 'exercise the actual turn-advance helper');
const advance = source.slice(start, end);

async function run({ retained = false } = {}, code = advance) {
  let shield = false, shieldReads = 0;
  const window = { __combat: { turn: 1, phase: 'player' }, __fx: { open: 0, finished: 0 } };
  const document = { querySelector: selector => {
    assert.equal(selector, '.confirmation-input-shield');
    if (!retained && ++shieldReads > 2) shield = false;
    return shield ? {} : null;
  } };
  let shieldDeadline;
  await runInNewContext(code + '\nadvanceTurn()', {
    window, document,
    ev: expression => runInNewContext(expression, { window, document }),
    click: async selector => { assert.equal(selector, '.end-turn'); window.__combat.phase = 'enemy'; },
    wait: async () => {},
    confirmIfAsked: async () => {
      // The engine and FX can finish before the confirmation service releases
      // its real 600ms input shield after destination paint.
      window.__combat.turn = 2;
      window.__combat.phase = 'player';
      shield = true;
    },
    until: async (expression, label, timeout = 20000) => {
      if (expression.includes('.confirmation-input-shield')) shieldDeadline = timeout;
      for (let elapsed = 0; elapsed < timeout; elapsed += 70) {
        if (runInNewContext(expression, { window, document })) return true;
      }
      throw new Error('timeout waiting for ' + label);
    },
  });
  return { shield, shieldReads, shieldDeadline };
}

test('Load probe waits for the real confirmation shield after player phase and FX settle', async () => {
  const state = await run();
  assert.equal(state.shield, false, 'the next real menu click must have an unobstructed destination');
  assert.equal(state.shieldDeadline, 20000, 'keep the existing interactive deadline');
});

test('a shield that never releases fails within the existing deadline', async () => {
  await assert.rejects(run({ retained: true }), /timeout waiting for .*input shield/);
});
