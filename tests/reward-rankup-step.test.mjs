import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { rewardDom } from './helpers/dom.mjs';
import { MountGameProfileOffers } from '../src/ui/components/gameProfileOffers.js';

// Owner 2026-11-18: "Rank up a card" is never a tile among the cards. It is its own step after the cards are resolved.
const p = resolveGameProfile('core'), reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, p)), p);

async function withDom(fn) {
  const dom = { customElements: { define() {}, get: () => true }, HTMLElement: class {}, ...rewardDom() };
  const before = Object.fromEntries(Object.keys(dom).map(key => [key, globalThis[key]]));
  Object.assign(globalThis, dom);
  const make = document.createElement.bind(document);
  document.createElement = (...args) => { const node = make(...args); node.insertAdjacentHTML ||= () => {}; return node; };
  try { await fn(); } finally { for (const [key, value] of Object.entries(before)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } }
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const cards = ['core.strike', 'core.defend', 'core.smash'].map(id => ({ kind: 'combatCards', id }));
// An older saved offer lists the rank-up with no `bonus` flag, among the cards.
const savedOffer = (id, extra = {}) => ({ id, options: [...cards, { kind: 'rankUps' }], taken: [], claimed: null, takeCount: 1, ...extra });

function mount(offer, { rankUp = () => Promise.resolve() } = {}) {
  const run = { class: 'reaver', deck: [], cinders: 0 };
  const app = document.createElement('main'); document.body.append(app);
  const calls = [];
  MountGameProfileOffers(app, { registries: reg, run, offer, title: 'VICTORY',
    onTake: index => {
      if (offer.options[index].kind === 'rankUps') { calls.push('rankUp'); return rankUp().then(() => { offer.taken.push(index); offer.claimed = index; return offer; }); }
      calls.push('take'); offer.taken.push(index); return offer;
    },
    onContinue() { calls.push('continue'); } });
  return { app, calls };
}

test('the rank-up is not a tile in the card strip', async () => {
  await withDom(async () => {
    const { app } = mount(savedOffer('strip'));
    assert.equal(app.querySelectorAll('.reward-choice-face').length, 3);
    assert.equal(app.querySelector('.rank-up-offer-card'), null);
    assert.equal(app.querySelector('.reward-pick-prompt').textContent, 'Select 1 card reward');
  });
});

test('Confirm claims the cards, then opens the rank-up step, then leaves the door', async () => {
  await withDom(async () => {
    const { app, calls } = mount(savedOffer('chain'));
    app.querySelectorAll('.reward-pick')[1].click();
    app.querySelector('#reward-card-confirm').click();
    document.querySelector('.confirmation-confirm').click();
    await tick(); await tick();
    assert.deepEqual(calls, ['take', 'rankUp', 'continue']);
    await new Promise(resolve => setTimeout(resolve, 700));
  });
});

test('closing the rank-up picker declines it and the chain goes on', async () => {
  await withDom(async () => {
    const { app, calls } = mount(savedOffer('cancel'), { rankUp: () => Promise.reject(new Error('')) });
    app.querySelector('.reward-pick').click();
    app.querySelector('#reward-card-confirm').click();
    document.querySelector('.confirmation-confirm').click();
    await tick(); await tick();
    assert.deepEqual(calls, ['take', 'rankUp', 'continue']);
    await new Promise(resolve => setTimeout(resolve, 700));
  });
});

test('a reload after the cards goes straight to the rank-up step', async () => {
  await withDom(async () => {
    const { app, calls } = mount(savedOffer('reload', { taken: [0] }));
    assert.equal(app.querySelectorAll('.reward-choice-face').length, 3);
    await tick(); await tick();
    assert.deepEqual(calls, ['rankUp', 'continue']);
  });
});

test('Skip leaves the cards and still offers the rank-up step', async () => {
  await withDom(async () => {
    const { app, calls } = mount(savedOffer('skip'));
    app.querySelector('#reward-continue').click();
    document.querySelector('.confirmation-confirm').click();
    await tick(); await tick();
    assert.deepEqual(calls, ['rankUp', 'continue']);
    await new Promise(resolve => setTimeout(resolve, 700));
  });
});
