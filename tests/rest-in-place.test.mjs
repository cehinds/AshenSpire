import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/engine/runCombat.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { beginGameProfileRest, commitGameProfileRest } from '../src/model/gameProfileRest.js';
import { buildActMap } from '../src/engine/actmap.js';
import { createRng } from '../src/engine/rng.js';
import { mountGameProfileRest } from '../src/ui/components/gameProfileRest.js';
import { withKitDom } from './helpers/dom.mjs';

const profile = resolveGameProfile('core');
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
function fixture() {
  const run = createRunState({ seed: 73, classId: 'reaver', registries });
  run.mapGraph = buildActMap(registries, createRng(73), run.seatOrder[0], 1);
  run.mapNodeId = Object.values(run.mapGraph.nodes).find(node => node.type === 'shrine').id; // the first Shrine on the route (Core acts moved them in 0f95ea6805)
  const visit = beginGameProfileRest(run, `1:${run.mapNodeId}`);
  const app = document.createElement('main'); document.body.append(app);
  let opened = 0;
  let commits = 0;
  let screen;
  screen = mountGameProfileRest(app, { registries, run, visit, meta: { settings: {} },
    deckEditor: { onOpen() { opened++; } }, onLeave() {}, onStrategize() {},
    onCommit(service, payload) { commits++; commitGameProfileRest(registries, run, service, payload); screen.refresh({ focusId: service }); },
  });
  return { run, visit, app, screen, opened: () => opened, commits: () => commits };
}

test('Shrine refresh retains parent, choices, unchanged services, deck door and scroll', () => withKitDom(() => {
  const { app, screen } = fixture();
  const root = app.querySelector('.rest-screen'), frame = app.querySelector('.rest-door');
  const choices = app.querySelector('.rest-choices'), body = app.querySelector('.choice-body');
  const cards = [...app.querySelectorAll('.class-pick')];
  body.scrollTop = 188; choices.scrollTop = 93;
  screen.refresh();
  assert.equal(app.querySelector('.rest-screen'), root);
  assert.equal(app.querySelector('.rest-door'), frame);
  assert.equal(app.querySelector('.rest-choices'), choices);
  assert.deepEqual([...app.querySelectorAll('.class-pick')], cards);
  assert.equal(body.scrollTop, 188); assert.equal(choices.scrollTop, 93);
}));

test('Shrine service commit refreshes the replaced visit and dependent choices without recreating the deck door', () => withKitDom(() => {
  const { app, screen, run, visit, opened, commits } = fixture();
  const root = screen.root, deck = app.querySelector('#deck-opt'), rest = app.querySelector('#rest-opt');
  const body = app.querySelector('.choice-body'); body.scrollTop = 143;
  rest.click();
  assert.equal(commits(), 1);
  assert.notEqual(run.gameProfileRestVisits[visit.id], visit, 'committing replaces the persisted visit');
  assert.equal(app.querySelector('.rest-screen'), root);
  assert.equal(app.querySelector('#deck-opt'), deck);
  assert.notEqual(app.querySelector('#rest-opt'), rest);
  assert.equal(app.querySelector('#rest-opt').getAttribute('aria-disabled'), 'true');
  assert.equal(body.scrollTop, 143);
  app.querySelector('#rest-opt').click();
  assert.equal(commits(), 1, 'spent services cannot commit through their refreshed handler');
  deck.click(); assert.equal(opened(), 1, 'free editing remains available after the service');
}));

test('Shrine refresh updates dynamic recovery text while preserving independent service cards', () => withKitDom(() => {
  const { app, run, screen } = fixture();
  const root = screen.root, upgrade = app.querySelector('#upgrade-card-opt'), deck = app.querySelector('#deck-opt');
  run.hp = Math.max(1, Math.floor(run.maxHp / 2)); screen.refresh();
  const rest = app.querySelector('#rest-opt'), description = rest.querySelector('.cp-body p').textContent;
  run.hp = run.maxHp; screen.refresh();
  assert.equal(app.querySelector('.rest-screen'), root);
  assert.equal(app.querySelector('#upgrade-card-opt'), upgrade);
  assert.equal(app.querySelector('#deck-opt'), deck);
  assert.notEqual(app.querySelector('#rest-opt').querySelector('.cp-body p').textContent, description);
}));

test('a late Shrine refresh cannot replace the next mounted screen', () => withKitDom(() => {
  const { app, screen } = fixture();
  const next = document.createElement('section'); app.replaceChildren(next);
  screen.refresh(); assert.equal(app.firstElementChild, next);
}));
