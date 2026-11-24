import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState, projectZones } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { pinLegacyRewards } from './helpers/legacy-core-rewards.mjs';
import { gameProfileRewardOffers, claimGameProfileReward, claimGameProfileRewardToDeck, rewardDeckAddRefusal, rewardInstanceId } from '../src/model/gameProfileRewards.js';

const p = resolveGameProfile('core'), reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, p)), p);
const fresh = () => {
  const run = createRunState({ seed: 1, classId: 'reaver', registries: reg });
  const offer = gameProfileRewardOffers(reg, run, createRng(19), { offerId: 'level1', source: 'level' });
  return { run, offer };
};
const idOf = (offer) => rewardInstanceId(offer.id, 0);

test('add to deck claims the card and moves that instance into the deck', () => {
  const { run, offer } = fresh();
  const size = run.deck.length, side = run.sideboard.length;
  assert.equal(rewardDeckAddRefusal(reg, run, offer.id, 0), '');
  const option = claimGameProfileRewardToDeck(reg, run, offer.id, 0);
  assert.equal(option.id, offer.options[0].id);
  assert.equal(run.deck.length, size + 1);
  assert.equal(run.deck.at(-1).instanceId, idOf(offer));
  assert.equal(run.sideboard.length, side);
  assert.equal(JSON.stringify(run.zones), JSON.stringify(projectZones(run).zones), 'zones follow the deck');
  assert.equal(run.gameProfileRewardOffers[offer.id].claimed, 0);
});

test('add to deck is idempotent on a double click', () => {
  const { run, offer } = fresh();
  claimGameProfileRewardToDeck(reg, run, offer.id, 0);
  const after = JSON.stringify(run);
  claimGameProfileRewardToDeck(reg, run, offer.id, 0);
  assert.equal(JSON.stringify(run), after);
});

test('add to deck refuses a full deck and leaves run and offer untouched', () => {
  const { run, offer } = fresh();
  const settings = { deckMaxUnlimited: false, deckMaxSize: run.deck.length };
  assert.equal(rewardDeckAddRefusal(reg, run, offer.id, 0, settings), 'full');
  const before = JSON.stringify(run);
  assert.throws(() => claimGameProfileRewardToDeck(reg, run, offer.id, 0, settings), error => error.code === 'full');
  assert.equal(JSON.stringify(run), before);
  assert.equal(run.gameProfileRewardOffers[offer.id].claimed, null);
});

test('add to deck works after an earlier claim to the sideboard (edit-deck path)', () => {
  const { run, offer } = fresh();
  claimGameProfileReward(reg, run, offer.id, 0);
  assert.ok(run.sideboard.some(c => c.instanceId === idOf(offer)));
  claimGameProfileRewardToDeck(reg, run, offer.id, 0);
  assert.ok(run.deck.some(c => c.instanceId === idOf(offer)));
  assert.ok(!run.sideboard.some(c => c.instanceId === idOf(offer)));
});

test('add to deck refuses non-card rewards', () => {
  const run = createRunState({ seed: 1, classId: 'reaver', registries: reg });
  let found = null;
  for (let seed = 0; seed < 300 && !found; seed++) {
    // The shipped combat mix is cards only (2026-11-14), so a non-card reward comes from a run pinned to the old 66/4/18/2/10 mix.
    const r = pinLegacyRewards(createRunState({ seed: 1, classId: 'reaver', registries: reg }));
    const o = gameProfileRewardOffers(reg, r, createRng(seed), { offerId: 'fight' });
    const at = o.options.findIndex(row => !['combatCards', 'weaponArts'].includes(row.kind));
    if (at >= 0) found = { r, o, at };
  }
  assert.ok(found);
  assert.equal(rewardDeckAddRefusal(reg, found.r, found.o.id, found.at), 'notCard');
  void run;
});

// ---- review step UI ----------------------------------------------------------
import { withKitDom } from './helpers/dom.mjs';
import { MountGameProfileOffers } from '../src/ui/components/gameProfileOffers.js';

async function withDom(fn) {
  const { globals } = withKitDom((dom, globals) => ({ globals }));
  const before = Object.fromEntries(Object.keys(globals).map(key => [key, globalThis[key]]));
  Object.assign(globalThis, globals);
  document.documentElement = document.body;
  document.getSelection = () => null;
  // The minimal DOM has no insertAdjacentHTML; the equipment face paints with it and is not under test.
  const make = document.createElement.bind(document);
  document.createElement = (...args) => { const node = make(...args); node.insertAdjacentHTML ||= () => {}; return node; };
  try { await fn(); } finally { for (const [key, value] of Object.entries(before)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } }
}
function mount(extra = {}) {
  const run = { class: 'reaver', deck: [], cinders: 0 };
  const app = document.createElement('main'); document.body.append(app);
  const offer = { id: 'ui', options: [{ kind: 'combatCards', id: 'core.strike' }], taken: [], claimed: null, takeCount: 1 };
  const calls = [];
  MountGameProfileOffers(app, { registries: reg, run, offer, title: 'Reward',
    onTake(i) { calls.push('take'); offer.taken.push(i); offer.claimed = i; },
    onAddToDeck(i) { calls.push('add'); offer.taken.push(i); offer.claimed = i; },
    addRefusal: () => '', onEditDeck: (i, back) => { calls.push('edit'); back(); },
    onContinue() { calls.push('continue'); }, canEditDeck: true, ...extra });
  return { app, calls };
}
// Owner 2026-11-18: a card door is the multi-pick door. A tap on the name selects, Continue opens a confirmation.
// Owner 2026-11-20: that confirmation's own answers are Add to deck (primary) and Send to library, one click each;
// no destination radio group. Edit deck lives on the card's own modal (one-pick door).
const review = app => { app.querySelector('.reward-pick').click(); app.querySelector('#reward-card-confirm').click(); };
const footLabels = app => [...app.querySelectorAll('.reward-foot button')].filter(b => !b.hidden).map(b => b.textContent);
const settle = async () => { await new Promise(resolve => setTimeout(resolve, 0)); };
const answer = async selector => { document.querySelector(selector).click(); await settle(); await new Promise(resolve => setTimeout(resolve, 650)); };
const confirmAnswers = () => [...document.querySelectorAll('.confirmation-footer button')].filter(b => !b.hidden).map(b => b.textContent);

test('the card door footer is just Skip and Continue; the confirmation answers Add to deck or Send to library', async () => {
  await withDom(async () => {
    const { app } = mount();
    app.querySelector('.reward-pick').click();
    assert.deepEqual(footLabels(app), ['Skip', 'Continue']);
    assert.equal(app.querySelector('#reward-inspect'), null);
    app.querySelector('#reward-card-confirm').click();
    assert.deepEqual(confirmAnswers().sort(), ['Add to deck', 'Back', 'Send to library']);
    assert.equal(document.querySelector('.confirmation-confirm').textContent, 'Add to deck');
    assert.equal(document.querySelector('.confirmation-alternate').textContent, 'Send to library');
    assert.equal(document.querySelector('[role=radiogroup]'), null, 'no inner destination group');
    document.querySelector('.confirmation-cancel').click();
  });
});
test('Add to deck claims straight into the deck once', async () => {
  await withDom(async () => {
    const { app, calls } = mount();
    review(app);
    await answer('.confirmation-confirm');
    assert.deepEqual(calls, ['add', 'continue']);
  });
});
test('Send to library claims into the collection only, never the deck', async () => {
  await withDom(async () => {
    const { app, calls } = mount();
    review(app);
    await answer('.confirmation-alternate');
    assert.deepEqual(calls, ['take', 'continue']);
  });
});
test('a refused deck leaves Send to library as the only answer', async () => {
  await withDom(async () => {
    const full = mount({ addRefusal: () => 'full', deckMax: 40 });
    review(full.app);
    assert.equal(document.querySelector('.confirmation-confirm').textContent, 'Send to library');
    assert.equal(document.querySelector('.confirmation-alternate'), null);
    await answer('.confirmation-confirm');
    assert.deepEqual(full.calls, ['take', 'continue']);
  });
});

test('an armament reward offers Equip now when the Armoury is open, claims first, and returns into the reward', async () => {
  await withDom(async () => {
    const ids = { weapons: reg.equipment.armaments[0].id, armor: reg.equipment.armour.find(row => row.classId === 'reaver').id };
    for (const gate of [true, false]) for (const kind of ['weapons', 'armor']) {
      const run = { class: 'reaver', deck: [], cinders: 0 };
      const app = document.createElement('main'); document.body.append(app);
      const offer = { id: `eq-${kind}-${gate}`, options: [{ kind, id: ids[kind] }], taken: [], claimed: null, takeCount: 1 };
      const calls = [];
      MountGameProfileOffers(app, { registries: reg, run, offer, title: 'Reward',
        onTake(i) { calls.push('take'); offer.taken.push(i); offer.claimed = i; },
        onAddToDeck() { calls.push('add'); }, onEditDeck() { calls.push('deck'); },
        canEditEquipment: gate, onEditEquipment: (i, back) => { calls.push('equip'); back(); }, onContinue() { calls.push('continue'); } });
      // Owner 2026-11-20: a face tap selects; its (i) opens the inspect door.
      app.querySelector('.reward-choice-face').click();
      app.querySelector('.reward-choice-face .card-info-button').click();
      const inspection = document.querySelector('.card-inspection-modal');
      assert.ok(inspection, 'an armament face opens the inspect door');
      inspection.querySelector('.card-inspection-back').click();
      assert.equal(document.querySelector('.card-inspection-modal'), null, 'Back leaves without claiming');
      app.querySelector('.reward-pick').click();
      app.querySelector('#reward-card-confirm').click();
      const equip = app.querySelector('#reward-equip-now');
      assert.equal(app.querySelector('#reward-card-confirm').textContent, 'Continue');
      assert.equal(app.querySelector('#reward-edit-deck'), null, 'no deck editor for an item');
      if (!gate) { assert.equal(equip, null); app.remove(); continue; }
      assert.equal(equip.textContent, 'Equip now');
      equip.click(); await Promise.resolve(); await Promise.resolve();
      assert.deepEqual(calls, ['take', 'equip', 'continue']);
      app.remove();
    }
  });
});
