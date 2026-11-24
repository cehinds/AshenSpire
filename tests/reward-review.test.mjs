import test from 'node:test';
import assert from 'node:assert/strict';
import { withKitDom } from './helpers/dom.mjs';
import { rewardDom } from './helpers/dom.mjs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { MountGameProfileOffers } from '../src/ui/components/gameProfileOffers.js';
import { runHeaderStripHtml } from '../src/ui/components/hudmeta.js';
import { runHeaderModel } from '../src/ui/models/RunHeaderModel.js';

import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
const core = resolveGameProfile('core');
const registriesFor = id => id.startsWith('core.') ? bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, core)), core) : createRegistries(contentBundle);
// The fake DOM's textContent is a node's own text only.
const textOf = node => (node.textContent || '') + (node.children || []).map(textOf).join(' ');
globalThis.HTMLElement ??= class HTMLElement {}; // the confirmation's Back restores focus only to a real element
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const modalConfirm = () => document.querySelector('.confirmation-confirm');
const modalBack = () => document.querySelector('.confirmation-cancel');
const picked = app => [...app.querySelectorAll('.reward-pick')].map(node => node.getAttribute('aria-checked') === 'true');

// Owner 2026-11-18: cards are chosen on the strip, Continue opens a confirmation, and Confirm claims them.
test('configured choices are confirmed in a modal, Back keeps the selection, commit once, and preserve Cinders on Skip', async () => {
  const dom = rewardDom();
  const before = Object.fromEntries(Object.keys(dom).map(key => [key, globalThis[key]]));
  Object.assign(globalThis, dom);
  try {
    {
      const app = document.createElement('main'); document.body.append(app);
      const offer = { id: 'exit-retry', options: [{ kind: 'combatCards', id: 'frostNova' }], taken: [], claimed: null, takeCount: 1 };
      let grants = 0, exits = 0;
      MountGameProfileOffers(app, { registries: registriesFor('frostNova'), run: { class: 'reaver' }, offer, title: 'Reward',
        onTake(index) { grants++; offer.taken.push(index); offer.claimed = index; },
        onContinue() { exits++; if (exits === 1) throw new Error('exit save refused'); },
      });
      app.querySelector('.reward-pick').click();
      const confirm = app.querySelector('#reward-card-confirm');
      confirm.click(); modalConfirm().click(); await tick();
      assert.equal(grants, 1); assert.equal(exits, 1); assert.equal(confirm.disabled, false);
      confirm.click(); await tick();
      assert.equal(document.querySelector('.confirmation-modal'), null, 'the retry goes straight to the exit, no second confirmation');
      assert.equal(grants, 1, 'exit retry must not grant twice'); assert.equal(exits, 2);
      app.remove();
      await new Promise(resolve => setTimeout(resolve, 800));
    }
    for (const cardId of ['core.strike', 'frostNova']) {
      const registries = registriesFor(cardId);
      const app = document.createElement('main'); document.body.append(app);
      const run = { class: 'reaver', cinders: 37, deck: [] };
      const offer = { id: cardId, options: [{ kind: 'combatCards', id: cardId }, { kind: 'combatCards', id: cardId.startsWith('core.') ? 'core.defend' : 'scholarsInsight' }], taken: [], claimed: null, takeCount: 1 };
      let writes = 0, exits = 0, refuse = true;
      MountGameProfileOffers(app, { registries, run, offer, title: 'Victory rewards',
        onTake: index => { if (refuse) throw new Error('save refused'); writes++; run.deck.push(offer.options[index].id); offer.taken.push(index); offer.claimed = index; },
        onContinue: () => { exits++; },
      });
      const confirm = app.querySelector('#reward-card-confirm');
      const left = app.querySelector('#reward-continue');
      assert.equal(left.textContent, 'Skip'); assert.ok(left.classList.contains('danger'));
      assert.equal(confirm.disabled, false, 'Continue is always enabled'); assert.ok(!confirm.classList.contains('primary'), 'neutral until the pick is made');
      app.querySelectorAll('.reward-pick')[0].click(); assert.ok(confirm.classList.contains('primary'), 'green once every pick is made');
      confirm.click();
      assert.ok(document.querySelector('.confirmation-modal'), 'Continue opens the confirmation');
      assert.match(textOf(document.querySelector('.confirmation-modal')), new RegExp(registries.cards.get(cardId).name));
      assert.deepEqual(run.deck, []); assert.equal(writes, 0);
      modalBack().click();
      assert.equal(document.querySelector('.confirmation-modal'), null, 'Back closes the confirmation');
      assert.deepEqual(picked(app), [true, false], 'and keeps the selection editable');
      app.querySelectorAll('.reward-pick')[1].click(); assert.deepEqual(picked(app), [false, true], 'with one pick the choice moves');
      confirm.click(); modalConfirm().click(); await tick();
      assert.equal(app.querySelector('.reward-confirm-status').textContent, 'save refused'); assert.equal(exits, 0); assert.equal(app.querySelector('#reward-card-confirm').disabled, false, 'the door is redrawn live after a refusal');
      refuse = false;
      app.querySelectorAll('.reward-pick')[1].click();
      app.querySelector('#reward-card-confirm').click(); modalConfirm().click(); await tick();
      assert.deepEqual(run.deck, [offer.options[1].id]); assert.equal(writes, 1); assert.equal(exits, 1);
      app.remove();
      const skipApp = document.createElement('main'); document.body.append(skipApp);
      MountGameProfileOffers(skipApp, { registries, run, offer: { ...offer, id: `${cardId}:skip`, taken: [], claimed: null }, title: 'Reward', onTake() { throw new Error('Skip must never take'); }, onContinue() { exits++; } });
      // Skip with a choice still open and nothing taken asks once (owner, 2026-11-14): the modal's default answer goes back.
      skipApp.querySelector('#reward-continue').click(); assert.equal(exits, 1, 'Skip asks before leaving');
      assert.equal(document.querySelector('.confirmation-modal h2, .confirmation-modal [id=confirmation-modal-title]')?.textContent, 'Leave without taking a reward?');
      assert.equal(document.querySelector('.confirmation-cancel').textContent, 'Take a reward');
      document.querySelector('.confirmation-confirm').click();
      assert.equal(run.cinders, 37); assert.equal(exits, 2); skipApp.remove();
      // The confirmed modal holds a short input shield; let its timers finish while the DOM globals still stand.
      await new Promise((resolve) => setTimeout(resolve, 800));
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

test('cloned configured offers claim every chosen card, and name the picks left unused', async () => {
  const dom = rewardDom(); const before = Object.fromEntries(Object.keys(dom).map(key => [key, globalThis[key]])); Object.assign(globalThis, dom);
  try {
    const app = document.createElement('main'); document.body.append(app);
    let offer = { id: 'two', options: [{ kind: 'combatCards', id: 'frostNova' }, { kind: 'combatCards', id: 'scholarsInsight' }, { kind: 'combatCards', id: 'guardCounter' }], taken: [], claimed: null, takeCount: 2 };
    let grants = 0, exits = 0;
    MountGameProfileOffers(app, { registries: registriesFor('frostNova'), run: { class: 'reaver' }, offer, title: 'Reward', onTake(index) {
      offer = structuredClone(offer); offer.taken.push(index); if (offer.taken.length === 2) offer.claimed = index; grants++; return offer;
    }, onContinue() { exits++; } });
    const prompt = () => app.querySelector('.reward-pick-prompt').textContent;
    const picks = app.querySelectorAll('.reward-pick'), confirm = app.querySelector('#reward-card-confirm');
    assert.equal(prompt(), 'Select 2 card rewards');
    picks[0].click(); assert.equal(prompt(), 'Select 1 card reward'); assert.ok(!confirm.classList.contains('primary'));
    // One of two picks: the confirmation says one is unused; Back keeps the selection.
    confirm.click(); assert.match(textOf(document.querySelector('.confirmation-modal')), /1 pick unused\./); modalBack().click();
    picks[2].click(); assert.equal(prompt(), 'Select 0 card rewards'); assert.ok(confirm.classList.contains('primary'));
    picks[1].click(); assert.deepEqual(picked(app), [true, false, true], 'a third card cannot be chosen past the two picks');
    picks[0].click(); assert.equal(prompt(), 'Select 1 card reward', 'tapping a chosen card puts it back');
    picks[0].click();
    confirm.click(); modalConfirm().click(); await tick();
    assert.equal(grants, 2); assert.equal(exits, 1);
    await new Promise(resolve => setTimeout(resolve, 800));
  } finally { for (const [key,value] of Object.entries(before)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } }
});
