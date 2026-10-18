// tests/gameover-run-again.test.mjs — the end-of-run door offers Run again.
//   node --test tests/gameover-run-again.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { mountGameOver } from '../src/ui/screens/gameover.js';
import { withKitDom } from './helpers/kit-dom.mjs';

const REG = createRegistries(contentBundle);

function mount({ victory = false, ...options } = {}) {
  const run = createRunState({ seed: 0x10a5, classId: 'reaver', registries: REG });
  run.seedString = 'TESTSEED';
  run.floor = 4;
  run.stats = { fightsWon: 3, damageDealt: 214, damageTaken: 96 };
  let app;
  withKitDom((dom) => {
    app = dom.document.createElement('div');
    dom.document.body.replaceChildren(app);
    mountGameOver(app, { registries: REG, game: run, victory, onTitle() {}, earned: [], ...options });
  });
  return app;
}

for (const victory of [false, true]) {
  const face = victory ? 'victory' : 'defeat';

  test(`${face}: Run again calls onRunAgain and is the primary button`, () => {
    let calls = 0;
    const app = mount({ victory, onRunAgain: () => { calls += 1; } });
    const again = app.querySelector('#run-again');
    assert.ok(again, 'Run again rendered');
    assert.equal(again.textContent, 'Run again');
    assert.equal(again.classList.contains('primary'), true, 'Run again is the primary button');
    assert.equal(app.querySelector('#to-title').classList.contains('primary'), false, 'Return to title is secondary');
    again.click();
    assert.equal(calls, 1);
  });

  test(`${face}: without onRunAgain there is no Run again and the title stays primary`, () => {
    const app = mount({ victory });
    assert.equal(app.querySelector('#run-again'), null);
    assert.equal(app.querySelector('#to-title').classList.contains('primary'), true);
  });
}

test('the save-failure Retry button stays beside the title when no Run again is offered', () => {
  let retried = 0;
  const app = mount({ onRetry: () => { retried += 1; } });
  const retry = app.querySelector('#retry-finish');
  assert.ok(retry);
  retry.click();
  assert.equal(retried, 1);
  assert.equal(app.querySelector('#run-again'), null);
});
