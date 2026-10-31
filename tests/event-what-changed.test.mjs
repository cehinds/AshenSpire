// Every committed event choice shows the what-changed receipt (SPEC 5.6); a pure flavour choice shows none.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { mountEvent } from '../src/ui/screens/event.js';
import { withKitDom } from './helpers/kit-dom.mjs';

const pick = (_dom, app, choiceIndex) => {
  app.querySelector(`#choices [data-choice="${choiceIndex}"]`).click();
  // With the hold dial off a press commits at once (holdconfirm.js armHold ms 0).
};
const mount = (dom, eventId, mutate) => {
  const app = dom.document.createElement('main');
  dom.document.body.replaceChildren(app);
  const run = createRunState({ seed: 7, classId: 'reaver', registries });
  mutate?.(run);
  mountEvent(app, { registries, run, meta: { settings: { holdConfirm: 'off' } }, rng: createRng(3), eventId, onDone() {} });
  return { app, run };
};

test('a choice that adds a relic and moves cinders opens the receipt with both rows', () => {
  withKitDom((dom) => {
    const { app, run } = mount(dom, 'weepingPilgrim', (r) => { r.cinders = 200; r.relics = []; });
    pick(dom, app, 0);
    const modal = dom.document.body.querySelector('.what-changed-modal');
    assert.ok(modal, 'receipt open');
    assert.ok(modal.querySelector('[data-what-changed-kind="relic"]'), 'relic row');
    assert.ok(modal.querySelector('[data-what-changed-kind="resource"]'), 'cinders row');
    assert.equal(run.relics.length, 1);
    assert.ok(modal.querySelector('.what-changed-lead'), 'authored result line leads');
    assert.ok(app.querySelector('#event-continue'), 'the event screen is still underneath');
  });
});

test('a flavour-only choice opens no receipt', () => {
  withKitDom((dom) => {
    const { app } = mount(dom, 'weepingPilgrim', (r) => { r.cinders = 200; });
    const flavour = registries.events.get('weepingPilgrim').choices.findIndex((c) => !(c.effects || []).length);
    assert.ok(flavour >= 0, 'the fixture event has a choice with no effects');
    pick(dom, app, flavour);
    assert.equal(dom.document.body.querySelector('.what-changed-modal'), null);
  });
});
