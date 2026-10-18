// tests/gameover-cause.test.mjs — the defeat screen names what landed the last blow.
//   node --test tests/gameover-cause.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { mountGameOver, slainByLine } from '../src/ui/screens/gameover.js';
import { withKitDom } from './helpers/kit-dom.mjs';

const REG = createRegistries(contentBundle);

function finishedRun(lastHit) {
  const run = createRunState({ seed: 0x10a5, classId: 'reaver', registries: REG });
  run.seedString = 'TESTSEED';
  run.floor = 4;
  run.stats = { fightsWon: 3, damageDealt: 214, damageTaken: 96, ...(lastHit ? { lastHit } : {}) };
  return run;
}
function mount(run, { victory = false, ...options } = {}) {
  let app;
  withKitDom((dom) => {
    app = dom.document.createElement('div');
    dom.document.body.replaceChildren(app);
    mountGameOver(app, { registries: REG, game: run, victory, onTitle() {}, earned: [], ...options });
  });
  return app;
}

test('slainByLine names the striker, the move and the amount', () => {
  assert.equal(slainByLine({ sourceName: 'Ash Warden', move: 'Cleave', amount: 14 }), 'Slain by Ash Warden · Cleave for 14');
  assert.equal(slainByLine({ sourceName: 'Bleed', move: null, amount: 5 }), 'Slain by Bleed for 5');
  assert.equal(slainByLine(undefined), '', 'an older save has no lastHit');
});

test('the defeat screen shows the cause line when lastHit is present', () => {
  const app = mount(finishedRun({ sourceId: 'e1', sourceName: 'Ash Warden', move: 'Cleave', amount: 14 }));
  const line = app.querySelector('.go-cause');
  assert.ok(line, 'cause line rendered');
  assert.equal(line.textContent, 'Slain by Ash Warden · Cleave for 14');
});

test('the defeat screen omits the cause line when lastHit is missing', () => {
  assert.equal(mount(finishedRun(null)).querySelector('.go-cause'), null);
});

test('a victory never claims a cause of death', () => {
  const run = finishedRun({ sourceId: 'e1', sourceName: 'Ash Warden', move: 'Cleave', amount: 14 });
  assert.equal(mount(run, { victory: true }).querySelector('.go-cause'), null);
});
