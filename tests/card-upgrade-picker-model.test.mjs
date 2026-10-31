// Card upgrades UI 2/5: completed cards leave the picker; unaffordable cards
// follow available cards, and the preview faces match the committed upgrade.
import test from 'node:test';
import { readFileSync } from 'node:fs';
import '../src/engine/runCombat.js';
import assert from 'node:assert/strict';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { createRunState } from '../src/model/state.js';
import { cardUpgradeModel } from '../src/ui/models/CardUpgradeModel.js';
import { commitCardUpgrade, planCardUpgrade } from '../src/model/cardUpgradeService.js';
import { upgradePreviewHtml } from '../src/ui/components/card.js';
import { projectGameCard } from '../src/model/gameProfile.js';

const newRun = () => createRunState({ registries, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
const strike = run => run.deck.find(c => c.cardId === 'core.strike');

test('rows: a fresh Strike costs nothing, its second upgrade is 1 Smithing Stone', () => {
  const run = newRun(); run.smithingStones = 1;
  const row = () => cardUpgradeModel(registries, run).rows.find(r => r.instanceId === strike(run).instanceId);
  assert.equal(row().costLabel, 'No charge');
  assert.equal(row().disabled, false);
  commitCardUpgrade(run, registries, row().plan);
  assert.equal(row().costLabel, '1 Smithing Stone');
  assert.equal(row().upgrades, 1);
});

test('rows: capped and fully upgraded cards are absent and cannot be selected', () => {
  const run = newRun(); run.smithingStones = 50;
  const card = strike(run);
  card.upgraded = true; card.upgradeSteps = Array.from({ length: 10 }, () => ({ k: 'dmg', n: 1 }));
  const model = cardUpgradeModel(registries, run, card.instanceId);
  assert.equal(model.rows.some(r => r.instanceId === card.instanceId), false);
  assert.equal(model.selected, null);
  assert.equal(model.canConfirm, false);

  card.upgradeSteps = [];
  let plan = planCardUpgrade(run, registries, card.instanceId);
  while (plan.ok) {
    commitCardUpgrade(run, registries, plan);
    plan = planCardUpgrade(run, registries, card.instanceId);
  }
  assert.equal(plan.code, 'maxed', 'the real upgrade sequence exhausts before the cap');
  const maxedModel = cardUpgradeModel(registries, run, card.instanceId);
  assert.equal(maxedModel.rows.some(r => r.instanceId === card.instanceId), false);
  assert.equal(maxedModel.selected, null);
});

test('rows: a short purse disables and moves paid cards after free cards while preserving the selected preview', () => {
  const run = newRun(); run.smithingStones = 0;
  const card = strike(run);
  card.upgraded = true; card.upgradeSteps = [{ k: 'authored' }];
  const model = cardUpgradeModel(registries, run, card.instanceId);
  assert.equal(model.selected.instanceId, card.instanceId);
  assert.equal(model.selected.disabled, true);
  assert.ok(model.faces?.after, 'an existing selection retains its upgrade preview');
  assert.equal(model.canConfirm, false);
  assert.match(model.blockedReasons[0], /Smithing Stone/);
  assert.equal(model.selected.blockedReason, model.blockedReasons[0]);
  assert.equal(model.rows.at(-1).instanceId, card.instanceId);
  assert.deepEqual(model.rows.filter(row => !row.disabled).map(row => row.instanceId),
    run.deck.filter((instance, i, deck) => instance.instanceId !== card.instanceId
      && planCardUpgrade(run, registries, instance.instanceId).ok
      // identical copies share the first copy's row
      && deck.findIndex(other => other.cardId === instance.cardId && !(other.upgradeSteps || []).length === !(instance.upgradeSteps || []).length) === i)
      .map(instance => instance.instanceId));
  run.smithingStones = 1;
  const replenished = cardUpgradeModel(registries, run, card.instanceId);
  assert.equal(replenished.rows[0].instanceId, card.instanceId, 'affordable cards return to deck order');
  assert.equal(replenished.canConfirm, true);
});

test('a spent service disables every remaining upgrade and keeps its reason in the selected preview', () => {
  const run = newRun();
  const model = cardUpgradeModel(registries, run, strike(run).instanceId, { blockedReason: 'This service has already been used.' });
  assert.ok(model.rows.length > 0);
  assert.ok(model.rows.every(row => row.disabled && row.blockedReason === 'This service has already been used.'));
  assert.equal(model.canConfirm, false);
  assert.deepEqual(model.blockedReasons, ['This service has already been used.']);
  assert.ok(model.faces?.after);
});

test('the preview shows the plan face, so it equals the card after commit', () => {
  const run = newRun();
  const model = cardUpgradeModel(registries, run, strike(run).instanceId);
  const html = upgradePreviewHtml(registries, { cardId: 'core.strike' }, model.faces);
  assert.match(html, /Strike → Strike\+/);
  commitCardUpgrade(run, registries, model.selected.plan);
  assert.equal(model.faces.after.name, projectGameCard(run, strike(run)).name);
  assert.deepEqual(JSON.parse(JSON.stringify(model.faces.after)), JSON.parse(JSON.stringify(projectGameCard(run, strike(run)))));
});

test('the preview without faces is unchanged (authored upgrade)', () => {
  assert.match(upgradePreviewHtml(registries, { cardId: 'core.strike' }), /Strike → Strike\+/);
});

test('the Core rest model lists Upgrade Card with a preview per upgradable deck card, and none for a Current profile', async () => {
  const { contentBundle } = await import('../src/content/index.js');
  const { createRegistries } = await import('../src/model/registries.js');
  const { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } = await import('../src/model/gameProfile.js');
  const { beginGameProfileRest } = await import('../src/model/gameProfileRest.js');
  const { buildActMap } = await import('../src/engine/actmap.js');
  const { createRng } = await import('../src/engine/rng.js');
  const { gameProfileRestModel } = await import('../src/ui/models/GameProfileRestModel.js');
  const profile = resolveGameProfile('core');
  const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const run = createRunState({ seed: 73, classId: 'reaver', registries: reg, runId: 'picker-rest' });
  run.mapGraph = buildActMap(reg, createRng(73), run.seatOrder[0], 1);
  run.mapNodeId = Object.values(run.mapGraph.nodes).find(n => n.type === 'shrine' && n.floor === 3).id;
  const visit = beginGameProfileRest(run, '1:' + run.mapNodeId);
  const model = gameProfileRestModel(reg, run, visit);
  const service = model.services.find(s => s.id === 'upgradeCard');
  assert.equal(service.available, true);
  assert.equal(service.title, 'Upgrade Card');
  assert.ok(model.cardPreviews.size > 0);
  assert.ok([...model.cardPreviews.values()].every(p => p.available));
});

test('a procedural step the template does not mention (an added status) still shows in the preview', () => {
  let found = 0;
  for (let seed = 1; seed <= 40 && !found; seed += 1) {
    const run = createRunState({ registries, classId: 'reaver', seed, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
    const model = cardUpgradeModel(registries, run, strike(run).instanceId);
    if (model.selected.plan.step.k !== 'addStatus') continue;
    found = seed;
    const html = upgradePreviewHtml(registries, { cardId: 'core.strike' }, model.faces);
    assert.match(html, /(Weak|Bleed)[^<]*<span class="val up">1/, 'the new status is named and marked as raised');
  }
  assert.ok(found, 'some seed rolls an added status');
});

test('the picker omits capped cards and draws available cards with their upgrade cost', async () => {
  const { withKitDom } = await import('./helpers/kit-dom.mjs');
  const { mountCardUpgradeModal } = await import('../src/ui/components/cardUpgradeModal.js');
  await withKitDom(dom => {
    const run = newRun(); run.smithingStones = 1;
    const capped = strike(run);
    capped.upgraded = true; capped.upgradeSteps = Array.from({ length: 10 }, () => ({ k: 'dmg', n: 1 }));
    const fresh = run.deck.find(c => c.cardId === 'core.defend');
    const host = dom.document.createElement('main'); dom.document.body.append(host);
    const model = cardUpgradeModel(registries, run, fresh.instanceId);
    const door = mountCardUpgradeModal(host, model, { registries, meta: {}, onSelect() {}, onBack() {}, onConfirm() {} });
    const rowOf = id => host.querySelector(`.card-upgrade-row[data-instance-id="${id}"]`);
    assert.equal(rowOf(capped.instanceId), null);
    assert.equal(rowOf(fresh.instanceId).dataset.upgradeState, 'free');
    assert.match(rowOf(fresh.instanceId).outerHTML, /No charge/);
    assert.equal(host.querySelector('.card-upgrade-preview').dataset.cardUpgradePreview, fresh.instanceId);
    assert.match(host.querySelector('.smith-confirm').outerHTML, /Upgrade \(0\)/);
    door.close();
  });
});

test('picker updates disable unaffordable upgrades, reorder rows, and use the current selection rules', async () => {
  const { withKitDom } = await import('./helpers/kit-dom.mjs');
  const { mountCardUpgradeModal } = await import('../src/ui/components/cardUpgradeModal.js');
  await withKitDom(dom => {
    const run = newRun(); run.smithingStones = 1;
    const paid = strike(run);
    paid.upgraded = true; paid.upgradeSteps = [{ k: 'authored' }];
    const host = dom.document.createElement('main'); dom.document.body.append(host);
    const selected = [];
    let commits = 0;
    const door = mountCardUpgradeModal(host, cardUpgradeModel(registries, run, paid.instanceId), {
      registries, meta: {}, onSelect: id => selected.push(id), onBack() {}, onConfirm() { commits += 1; },
    });
    const rows = () => [...host.querySelectorAll('.card-upgrade-row')];
    const paidRow = () => rows().find(row => row.dataset.instanceId === paid.instanceId);
    const confirm = host.querySelector('.smith-confirm');
    assert.equal(confirm.disabled, false);
    paidRow().click();
    assert.deepEqual(selected, [paid.instanceId]);

    run.smithingStones = 0;
    door.update(cardUpgradeModel(registries, run, paid.instanceId));
    assert.equal(rows().at(-1).dataset.instanceId, paid.instanceId);
    assert.equal(paidRow().getAttribute('aria-disabled'), 'true');
    assert.equal(paidRow().dataset.upgradeState, 'blocked');
    assert.match(paidRow().querySelector('.card-upgrade-reason').textContent, /Smithing Stone/);
    paidRow().click();
    paidRow().dispatchEvent(new dom.Event('keydown', { key: 'Enter' }));
    assert.deepEqual(selected, [paid.instanceId], 'disabled rows cannot be selected by click or keyboard');
    assert.equal(confirm.disabled, true);
    assert.equal(confirm.getAttribute('aria-disabled'), 'true');
    assert.equal(confirm.hidden, false, 'keep the selected preview and its blocked action visible');
    assert.match(host.querySelector('.as-reasonnote').textContent, /Smithing Stone/);
    confirm.click();
    assert.equal(commits, 0);
    assert.equal(host.querySelectorAll('[aria-modal="true"]').length, 1, 'a disabled action opens no decision');

    run.smithingStones = 1;
    door.update(cardUpgradeModel(registries, run, paid.instanceId));
    assert.equal(rows()[0].dataset.instanceId, paid.instanceId);
    assert.equal(paidRow().getAttribute('aria-disabled'), 'false');
    assert.equal(confirm.disabled, false);
    paidRow().click();
    assert.deepEqual(selected, [paid.instanceId, paid.instanceId]);
    door.close();
  });
});

test('picker updates remove an exhausted upgrade and clear its selection', async () => {
  const { withKitDom } = await import('./helpers/kit-dom.mjs');
  const { mountCardUpgradeModal } = await import('../src/ui/components/cardUpgradeModal.js');
  await withKitDom(dom => {
    const run = newRun(); run.smithingStones = 50;
    const card = strike(run);
    let plan = planCardUpgrade(run, registries, card.instanceId);
    while (plan.ok) {
      const before = structuredClone(card);
      commitCardUpgrade(run, registries, plan);
      const next = planCardUpgrade(run, registries, card.instanceId);
      if (!next.ok) { Object.assign(card, before); break; }
      plan = next;
    }
    const model = cardUpgradeModel(registries, run, card.instanceId);
    assert.equal(model.canConfirm, true);
    const host = dom.document.createElement('main'); dom.document.body.append(host);
    const door = mountCardUpgradeModal(host, model, { registries, meta: {}, onSelect() {}, onBack() {}, onConfirm() {} });
    commitCardUpgrade(run, registries, model.selected.plan);
    door.update(cardUpgradeModel(registries, run, card.instanceId));
    assert.equal(host.querySelector(`.card-upgrade-row[data-instance-id="${card.instanceId}"]`), null);
    assert.equal(host.querySelector('.card-upgrade-preview'), null);
    assert.equal(host.querySelector('.smith-confirm').disabled, true);
    door.close();
  });
});

test('rows carry a plain chip: rank and upgrade count', () => {
  const run = newRun();
  const card = strike(run);
  const row = () => cardUpgradeModel(registries, run).rows.find(r => r.instanceId === card.instanceId);
  assert.equal(row().chipLabel, 'Rank 1 · 0 upgrades');
  card.upgraded = true; card.upgradeSteps = [{ k: 'authored' }];
  assert.equal(row().chipLabel, 'Rank 1 · 1 upgrade');
  card.rank = 3;
  assert.equal(row().chipLabel, 'Rank 3 · 1 upgrade');
});

test('the preview shows the card\'s main lines only: no Entry bonus line, no recovery block', () => {
  const run = newRun();
  const model = cardUpgradeModel(registries, run, strike(run).instanceId);
  const html = upgradePreviewHtml(registries, { cardId: 'core.strike' }, model.faces);
  assert.doesNotMatch(html, /Entry:/);
  assert.doesNotMatch(html, /Recovery|rest-recovery/i);
  const rest = readFileSync(new URL('../src/ui/components/gameProfileRest.js', import.meta.url), 'utf8');
  const open = rest.slice(rest.indexOf('const openUpgradeCard'), rest.indexOf('const openLevel'));
  assert.ok(open.length > 100 && !/servicePreviewHtml|recoveryHtml/.test(open), 'the Upgrade Card picker draws no recovery rows');
});

test('compact host: picking a row closes the list so the pane is not hidden', async () => {
  const { withKitDom } = await import('./helpers/kit-dom.mjs');
  const { mountCardUpgradeModal } = await import('../src/ui/components/cardUpgradeModal.js');
  await withKitDom(dom => {
    // The fixture has no layout: the player's own wireframe choice forces the compact selector.
    dom.document.documentElement = { dataset: { wireframeMenuNav: 'selector' }, style: {}, getBoundingClientRect: () => ({ width: 390, height: 844 }) };
    const savedStyle = globalThis.getComputedStyle;
    globalThis.getComputedStyle = () => ({ fontSize: '16px', minHeight: '44px', getPropertyValue: () => '' });
    const run = newRun(); run.smithingStones = 1;
    const host = dom.document.createElement('main'); dom.document.body.append(host);
    let door;
    const pick = id => door.update(cardUpgradeModel(registries, run, id));
    door = mountCardUpgradeModal(host, cardUpgradeModel(registries, run, null), { registries, meta: {}, onSelect: pick, onBack() {}, onConfirm() {} });
    const railed = () => host.querySelector('.as-railed');
    assert.equal(railed().dataset.catNav, 'selector');
    assert.equal(railed().dataset.catOpen, 'true', 'nothing chosen: the list is open');
    host.querySelector(`.card-upgrade-row[data-instance-id="${strike(run).instanceId}"]`).click();
    assert.equal(railed().dataset.catOpen, 'false', 'a chosen card closes the list');
    assert.ok(host.querySelector('#card-upgrade-preview-region'), 'the preview region is drawn');
    assert.equal(host.querySelector('.smith-confirm').hidden, false);
    door.close();
    if (savedStyle) globalThis.getComputedStyle = savedStyle; else delete globalThis.getComputedStyle;
  });
});

test('identical copies collapse into one row that selects the first instance', () => {
  const run = newRun();
  const strikes = run.deck.filter(c => c.cardId === 'core.strike');
  assert.ok(strikes.length > 1);
  const model = cardUpgradeModel(registries, run, strikes[1].instanceId);
  const rows = model.rows.filter(r => r.cardId === 'core.strike');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].instanceId, strikes[0].instanceId);
  assert.equal(rows[0].copies, strikes.length);
  assert.equal(model.selected, rows[0], 'any copy resolves to the collapsed row');
  strikes[0].upgraded = true; strikes[0].upgradeSteps = [{ k: 'authored' }];
  assert.equal(cardUpgradeModel(registries, run).rows.filter(r => r.cardId === 'core.strike').length, 2, 'a differently upgraded copy is its own row');
  // An old save marks an upgrade with the flag alone; upgradeStepsOf reads it as the authored step, so it is not a fresh copy.
  delete strikes[0].upgradeSteps;
  const legacyRows = cardUpgradeModel(registries, run).rows.filter(r => r.cardId === 'core.strike');
  assert.equal(legacyRows.length, 2, 'an old-style upgraded copy is its own row');
  assert.equal(legacyRows.find(r => r.instanceId === strikes[1].instanceId)?.copies, strikes.length - 1, 'the fresh copies stay free and selectable');
});

test('rows carry levels, tags, art and the changed face numbers', () => {
  const run = newRun();
  const row = cardUpgradeModel(registries, run).rows.find(r => r.cardId === 'core.strike');
  assert.deepEqual([row.levelFrom, row.levelTo], [0, 1]);
  assert.ok(row.tags.includes('Attack'));
  assert.ok(row.artGlyph);
  const dmg = row.changes.find(c => c.label === 'DAMAGE');
  if (row.plan.step.k === 'dmg') assert.equal(Number(dmg.after), Number(dmg.before) + row.plan.step.n);
  assert.ok(row.changes.length >= 1, 'an upgrade changes at least one face number');
  for (const change of row.changes) assert.notEqual(change.before, change.after);
});

test('the pane reads like the item pane: head, stats deltas, faces fold, cost strip, Upgrade (N)', async () => {
  const { withKitDom } = await import('./helpers/kit-dom.mjs');
  const { mountCardUpgradeModal } = await import('../src/ui/components/cardUpgradeModal.js');
  await withKitDom(dom => {
    const run = newRun(); run.smithingStones = 0;
    const card = strike(run);
    card.upgraded = true; card.upgradeSteps = [{ k: 'authored' }];
    const host = dom.document.createElement('main'); dom.document.body.append(host);
    const door = mountCardUpgradeModal(host, cardUpgradeModel(registries, run, card.instanceId), { registries, meta: {}, onSelect() {}, onBack() {}, onConfirm() {} });
    const html = host.querySelector('.smith-preview-card').outerHTML;
    assert.match(html, /Selected card/);
    assert.match(html, /Card Stats/);
    assert.match(html, /d-from/);
    assert.match(html, /Smithing Stone Cost/);
    assert.match(html, /smith-cost-required/);
    assert.match(html, /Short by 1 Smithing Stone\./);
    assert.equal(host.querySelectorAll('[data-card-upgrade-face]').length, 2, 'before and after faces');
    assert.match(host.querySelector('.smith-confirm').textContent, /^Upgrade \(1\)$/);
    assert.equal(host.querySelector('.smith-confirm').getAttribute('aria-label'), `Upgrade ${cardUpgradeModel(registries, run, card.instanceId).selected.name} for 1 Smithing Stone`);
    door.close();
  });
});
