import test from 'node:test';
import assert from 'node:assert/strict';
import { withKitDom } from './helpers/kit-dom.mjs';
import { rewardDom } from './helpers/reward-dom.mjs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { mountGameProfileOffers } from '../src/ui/components/gameProfileOffers.js';
import { runHeaderStripHtml } from '../src/ui/components/hudmeta.js';
import { runHeaderModel } from '../src/ui/models/RunHeaderModel.js';

import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
const core = resolveGameProfile('core');
const registriesFor = id => id.startsWith('core.') ? bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, core)), core) : createRegistries(contentBundle);
test('configured choices stage review, return to selection, commit once, and preserve Cinders on Skip', async () => {
  const dom = rewardDom();
  const before = Object.fromEntries(Object.keys(dom).map(key => [key, globalThis[key]]));
  Object.assign(globalThis, dom);
  try {
    {
      const app = document.createElement('main'); document.body.append(app);
      const offer = { id: 'exit-retry', options: [{ kind: 'combatCards', id: 'frostNova' }], taken: [], claimed: null, takeCount: 1 };
      let grants = 0, exits = 0;
      mountGameProfileOffers(app, { registries: registriesFor('frostNova'), run: { class: 'reaver' }, offer, title: 'Reward',
        onTake(index) { grants++; offer.taken.push(index); offer.claimed = index; },
        onContinue() { exits++; if (exits === 1) throw new Error('exit save refused'); },
      });
      app.querySelector('.reward-pick').click();
      const confirm = app.querySelector('#reward-card-confirm');
      confirm.click(); confirm.click(); await Promise.resolve();
      assert.equal(grants, 1); assert.equal(exits, 1); assert.equal(confirm.disabled, false);
      confirm.click(); await Promise.resolve();
      assert.equal(grants, 1, 'exit retry must not grant twice'); assert.equal(exits, 2);
      app.remove();
    }
    for (const cardId of ['core.strike', 'frostNova']) {
      const registries = registriesFor(cardId);
      const app = document.createElement('main'); document.body.append(app);
      const run = { class: 'reaver', cinders: 37, deck: [] };
      const offer = { id: cardId, options: [{ kind: 'combatCards', id: cardId }, { kind: 'combatCards', id: cardId.startsWith('core.') ? 'core.defend' : 'scholarsInsight' }], taken: [], claimed: null, takeCount: 1 };
      let writes = 0, exits = 0, refuse = true;
      const mount = () => mountGameProfileOffers(app, { registries, run, offer, title: 'Victory rewards',
        onTake: index => { if (refuse) throw new Error('save refused'); writes++; run.deck.push(offer.options[index].id); offer.taken.push(index); offer.claimed = index; },
        onContinue: () => { exits++; },
      });
      mount();
      const confirm = app.querySelector('#reward-card-confirm');
      const left = app.querySelector('#reward-continue');
      assert.equal(left.textContent, 'Skip'); assert.ok(left.classList.contains('danger')); assert.ok(confirm.disabled);
      app.querySelectorAll('.reward-pick')[0].click(); assert.equal(confirm.disabled, false);
      confirm.click(); assert.equal(confirm.textContent, 'Continue'); assert.equal(left.textContent, 'Back');
      assert.deepEqual(run.deck, []); assert.equal(writes, 0);
      assert.deepEqual([...app.querySelector('.reward-row').children].map(node => node.hidden), [false, true]);
      left.click(); assert.equal(confirm.textContent, 'Confirm'); assert.equal(left.textContent, 'Skip');
      app.querySelectorAll('.reward-pick')[1].click(); confirm.click(); confirm.click();
      await Promise.resolve();
      assert.equal(app.querySelector('.reward-confirm-status').textContent, 'save refused'); assert.equal(exits, 0); assert.equal(confirm.disabled, false);
      refuse = false; confirm.click(); confirm.click(); await Promise.resolve();
      assert.deepEqual(run.deck, [offer.options[1].id]); assert.equal(writes, 1); assert.equal(exits, 1);
      app.remove();
      const skipApp = document.createElement('main'); document.body.append(skipApp);
      mountGameProfileOffers(skipApp, { registries, run, offer: { ...offer, id: `${cardId}:skip`, taken: [], claimed: null }, title: 'Reward', onTake() { throw new Error('Skip must never take'); }, onContinue() { exits++; } });
      skipApp.querySelector('#reward-continue').click(); assert.equal(run.cinders, 37); assert.equal(exits, 2); skipApp.remove();
    }
  } finally {
    for (const [key, value] of Object.entries(before)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
});

test('existing HUD purse follows current value and layer visibility', () => {
  withKitDom(() => {
    // This uses the existing model/renderer, including its layer switch.
    const header = amount => runHeaderModel({ cinders: amount }, { cinders: true });
    for (const amount of [37, 49]) {
      const rendered = runHeaderStripHtml(header(amount));
      assert.match(rendered, new RegExp(`aria-label="${amount} cinders"`));
      assert.match(rendered, /<span class="ck">Cinders<\/span>/);
      assert.match(rendered, new RegExp(`<span class="cv">${amount}</span>`));
    }
    assert.equal(runHeaderStripHtml(runHeaderModel({}, { cinders: false })), '');
  });
});

test('configured save transaction restores claim and pending state, and returns fresh offer after cloned claim', async () => {
  const { persistRewardChange } = await import('../src/model/rewardTransaction.js');
  const offer = { id: 'a', taken: [], claimed: null };
  const run = { cinders: 10, sideboard: [], gameProfilePendingReward: { offerId: 'a' }, gameProfileRewardOffers: { a: offer } };
  const before = structuredClone(run);
  const change = () => {
    const draft = structuredClone(run);
    draft.sideboard.push({ cardId: 'core.strike' }); draft.gameProfileRewardOffers.a.taken.push(0); draft.gameProfileRewardOffers.a.claimed = 0;
    Object.assign(run, draft);
  };
  assert.throws(() => persistRewardChange(run, 'a', change, () => { throw new Error('save failed'); }), /save failed/);
  assert.deepEqual(run, before); assert.equal(run.gameProfileRewardOffers.a, offer);
  const updated = persistRewardChange(run, 'a', change, () => {});
  assert.notEqual(updated, offer); assert.equal(updated.claimed, 0);
  const claimed = structuredClone(run);
  assert.throws(() => persistRewardChange(run, 'a', () => { delete run.gameProfilePendingReward; }, () => { throw new Error('save failed'); }), /save failed/);
  assert.deepEqual(run, claimed);
});

test('cloned configured offers support partial and final claims without replaying an old offer', async () => {
  const dom = rewardDom(); const before = Object.fromEntries(Object.keys(dom).map(key => [key, globalThis[key]])); Object.assign(globalThis, dom);
  try {
    const app = document.createElement('main'); document.body.append(app);
    let offer = { id: 'two', options: [{ kind: 'combatCards', id: 'frostNova' }, { kind: 'combatCards', id: 'scholarsInsight' }], taken: [], claimed: null, takeCount: 2 };
    let grants = 0, exits = 0;
    mountGameProfileOffers(app, { registries: registriesFor('frostNova'), run: { class: 'reaver' }, offer, title: 'Reward', onTake(index) {
      offer = structuredClone(offer); offer.taken.push(index); if (offer.taken.length === 2) offer.claimed = index; grants++; return offer;
    }, onContinue() { exits++; } });
    app.querySelectorAll('.reward-pick')[0].click(); app.querySelector('#reward-card-confirm').click(); app.querySelector('#reward-card-confirm').click(); await Promise.resolve();
    assert.equal(grants, 1); assert.equal(exits, 0); assert.ok(app.querySelectorAll('.reward-pick')[0].disabled);
    app.querySelectorAll('.reward-pick')[1].click(); app.querySelector('#reward-card-confirm').click(); app.querySelector('#reward-card-confirm').click(); await Promise.resolve();
    assert.equal(grants, 2); assert.equal(exits, 1);
  } finally { for (const [key,value] of Object.entries(before)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } }
});
