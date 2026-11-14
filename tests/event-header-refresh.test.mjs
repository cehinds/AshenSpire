// The run header follows an event or dialogue choice on the same screen: cinders and HP paid or taken show at once.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { mountEvent } from '../src/ui/screens/event.js';
import { withKitDom } from './helpers/dom.mjs';

const cindersShown = (app) => app.querySelector('.shared-hud [data-ui-component="cinders-counter"]')?.getAttribute('aria-label') || '';

test('an event choice that moves cinders redraws the header on the same screen', () => {
  withKitDom((dom) => {
    const app = dom.document.createElement('main');
    dom.document.body.replaceChildren(app);
    const run = createRunState({ seed: 7, classId: 'reaver', registries });
    run.cinders = 200; run.relics = [];
    mountEvent(app, { registries, run, meta: { settings: { holdConfirm: 'off' } }, rng: createRng(3), eventId: 'weepingPilgrim', onDone() {}, hud: {} });
    const before = cindersShown(app);
    assert.match(before, /200/);
    app.querySelector('#choices [data-choice="0"]').click();
    assert.notEqual(run.cinders, 200, 'the choice moved cinders');
    const after = cindersShown(app);
    assert.notEqual(after, before, 'the header changed');
    assert.match(after, new RegExp(String(run.cinders)), 'and shows the run amount');
    assert.equal(app.querySelectorAll('.shared-hud').length, 1, 'one band');
  });
});

test('the dialogue screen redraws the header after a committed choice', () => {
  const src = readFileSync(new URL('../src/ui/screens/dialogue.js', import.meta.url), 'utf8');
  const commit = src.indexOf('const receipt = options.commitChoice');
  const refresh = src.indexOf('RefreshRunHud(app', commit);
  const receipt = src.indexOf('showRunReceipt({ run, registries, before', commit);
  assert.ok(commit > 0 && refresh > commit && refresh < receipt, 'RefreshRunHud runs right after the commit, before the receipt');
});
