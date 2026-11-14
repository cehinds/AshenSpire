// W2-E: a won fight is ONE screen (spoils strip + card choice), and taking advances without a Continue press.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { rewardDom } from './helpers/dom.mjs';
import { mountGameProfileOffers } from '../src/ui/components/gameProfileOffers.js';
import { VictorySpoils } from '../src/ui/components/victorySpoils.js';
import { mountRewards } from '../src/ui/screens/reward.js';

const p = resolveGameProfile('core'), reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, p)), p);

async function withDom(fn) {
  const dom = { customElements: { define() {}, get: () => true }, HTMLElement: class {}, ...rewardDom() };
  const before = Object.fromEntries(Object.keys(dom).map(key => [key, globalThis[key]]));
  Object.assign(globalThis, dom);
  const make = document.createElement.bind(document);
  document.createElement = (...args) => { const node = make(...args); node.insertAdjacentHTML ||= () => {}; return node; };
  try { await fn(); } finally { for (const [key, value] of Object.entries(before)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } }
}
const settle = async () => { await Promise.resolve(); await Promise.resolve(); };
const receipt = (extra = {}) => ({ title: 'VICTORY', cinders: { gained: 58, total: 78 }, xpBefore: null, xpGains: { level: 22, tracks: {} }, ...extra });
const text = node => [node.textContent, ...(node.children || []).map(text)].join(' ');

test('the combined door carries the title, "Cinders +N (total)" and the offer on ONE door', async () => {
  await withDom(async () => {
    const run = { class: 'reaver', deck: [], cinders: 78, level: { level: 1, xp: 22, unspentPoints: 0 }, attributes: {} };
    const app = document.createElement('main'); document.body.append(app);
    const offer = { id: 'one', options: [{ kind: 'combatCards', id: 'core.strike' }], taken: [], claimed: null, takeCount: 1 };
    const spoils = VictorySpoils(reg, run, receipt(), {});
    mountGameProfileOffers(app, { registries: reg, run, offer, title: 'VICTORY', spoils, onTake() {}, onContinue() {} });
    assert.equal(app.querySelectorAll('.reward-door').length, 1, 'one door');
    assert.equal(app.querySelector('.reward-door').getAttribute('aria-label'), 'VICTORY');
    assert.match(app.querySelector('.spoils-cinders').textContent, /^Cinders \+58 \(78\)$/);
    assert.ok(app.querySelector('.reward-choice-grid'), 'the offer is on the same door');
    assert.equal(app.querySelector('.victory-spoils') !== null, true);
  });
});

test('the cinders line comes from the receipt, never from the live purse', async () => {
  await withDom(async () => {
    const run = { class: 'reaver', deck: [], cinders: 9999, level: {}, attributes: {} };
    const strip = VictorySpoils(reg, run, receipt({ cinders: { gained: 12, total: 34 } }), {});
    assert.match(text(strip), /Cinders \+12 \(34\)/);
    assert.ok(!/9999/.test(text(strip)));
    const none = VictorySpoils(reg, run, receipt({ cinders: undefined }), {});
    assert.ok(!/Cinders/.test(text(none)), 'an older receipt without the number shows no cinders line');
  });
});

test('Add to deck, Add to library and a relic Confirm leave without a Continue press', async () => {
  await withDom(async () => {
    const run = { class: 'reaver', deck: [], cinders: 0 };
    const kinds = [
      ['combatCards', 'core.strike', '#reward-card-confirm'],
      ['combatCards', 'core.strike', '#reward-keep'],
      ['relics', reg.relics.all()[0].id, '#reward-card-confirm'],
    ];
    for (const [kind, id, button] of kinds) {
      const app = document.createElement('main'); document.body.append(app);
      const offer = { id: `o-${kind}-${button}`, options: [{ kind, id }], taken: [], claimed: null, takeCount: 1 };
      const calls = [];
      const claim = i => { calls.push('claim'); offer.taken.push(i); offer.claimed = i; };
      mountGameProfileOffers(app, { registries: reg, run, offer, title: 'VICTORY', onTake: claim, onAddToDeck: claim, addRefusal: () => '', onContinue() { calls.push('continue'); } });
      app.querySelector('.reward-pick').click();
      app.querySelector(button).click(); await settle();
      assert.deepEqual(calls, ['claim', 'continue'], `${kind} ${button}: two clicks (select + take) reach what follows`);
      app.remove();
    }
  });
});

test('a weapon keeps the review foot (Equip now / Continue)', async () => {
  await withDom(async () => {
    const run = { class: 'reaver', deck: [], cinders: 0 };
    const app = document.createElement('main'); document.body.append(app);
    const offer = { id: 'wep', options: [{ kind: 'weapons', id: reg.equipment.armaments[0].id }], taken: [], claimed: null, takeCount: 1 };
    const calls = [];
    mountGameProfileOffers(app, { registries: reg, run, offer, title: 'VICTORY', canEditEquipment: true, onEditEquipment() {}, onTake: i => { calls.push('claim'); offer.taken.push(i); offer.claimed = i; }, onContinue() { calls.push('continue'); } });
    app.querySelector('.reward-pick').click(); app.querySelector('#reward-card-confirm').click(); await settle();
    assert.deepEqual(calls, [], 'Confirm only opens the review');
    assert.equal(app.querySelector('#reward-card-confirm').textContent, 'Continue');
    assert.ok(app.querySelector('#reward-equip-now'));
  });
});

test('Skip then "Leave it" is two clicks', async () => {
  await withDom(async () => {
    const run = { class: 'reaver', deck: [], cinders: 0 };
    const app = document.createElement('main'); document.body.append(app);
    const offer = { id: 'skip', options: [{ kind: 'combatCards', id: 'core.strike' }], taken: [], claimed: null, takeCount: 1 };
    let exits = 0;
    mountGameProfileOffers(app, { registries: reg, run, offer, title: 'VICTORY', onTake() { throw new Error('never'); }, onContinue() { exits++; } });
    app.querySelector('#reward-continue').click();
    document.querySelector('.confirmation-confirm').click();
    assert.equal(exits, 1);
    await new Promise(resolve => setTimeout(resolve, 800));
  });
});

test('points to spend: the strip offers a compact control that opens the allocation UI and never blocks the choice', async () => {
  await withDom(async () => {
    const run = { class: 'reaver', deck: [], cinders: 0, level: { level: 2, xp: 0, unspentPoints: 1 }, attributes: {} };
    const spent = [];
    const strip = VictorySpoils(reg, run, receipt(), { onAllocateStat: id => { spent.push(id); run.level.unspentPoints -= 1; } });
    const toggle = strip.querySelector('#spoils-points');
    assert.equal(toggle.textContent, '1 point to spend');
    assert.equal(strip.querySelector('.reward-stat-allocation'), null, 'closed until asked');
    toggle.click();
    assert.ok(strip.querySelector('.reward-stat-allocation'), 'the receipt allocation UI');
    const none = VictorySpoils(reg, { ...run, level: { unspentPoints: 0 } }, receipt(), { onAllocateStat() {} });
    assert.equal(none.querySelector('#spoils-points'), null);
  });
});

test('a receipt without an offer still mounts the receipt screen, with the cinders line and a Continue', async () => {
  await withDom(async () => {
    const run = { class: 'reaver', deck: [], cinders: 78, level: { level: 1, xp: 22 }, attributes: {} };
    const app = document.createElement('main'); document.body.append(app);
    let done = 0;
    mountRewards(app, { registries: reg, run, rewards: receipt(), receiptOnly: true, onDone() { done++; } });
    assert.equal(app.querySelectorAll('.reward-door').length, 1);
    assert.match(text(app), /Cinders \+58 \(78\)/);
    assert.ok(app.querySelector('#reward-continue'));
  });
});
