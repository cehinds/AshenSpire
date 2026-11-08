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
import { closeConfirmationModal } from '../src/ui/components/confirmationModal.js';

// The picker is the list; a chosen card's own modal is the shared confirmation modal, in the document body.
const modalOf = dom => dom.document.querySelector('.confirmation-modal');

// Seed 504: every copy of a card rolls the same next step, so the identical-copies row tests do not depend on luck (re-recorded 2026-10-31 when the pool grew; was 511).
const newRun = () => createRunState({ registries, classId: 'reaver', seed: 504, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
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
  assert.ok(['maxed', 'cap'].includes(plan.code), 'the real upgrade sequence ends at maxed or the 10-upgrade cap');
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
  const { withKitDom } = await import('./helpers/dom.mjs');
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
    assert.equal(host.querySelector('.card-upgrade-preview'), null, 'the list has no in-picker preview');
    assert.match(modalOf(dom).querySelector('.confirmation-confirm').textContent, /Upgrade \(0\)/, 'the chosen card\'s own modal offers the upgrade');
    closeConfirmationModal();
    door.close();
  });
});

test('picker updates disable unaffordable upgrades, reorder rows, and use the current selection rules', async () => {
  const { withKitDom } = await import('./helpers/dom.mjs');
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
    assert.equal(host.querySelector('.smith-confirm'), null, 'the list holds no Upgrade button');
    closeConfirmationModal();
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
    assert.equal(commits, 0);

    run.smithingStones = 1;
    door.update(cardUpgradeModel(registries, run, paid.instanceId));
    assert.equal(rows()[0].dataset.instanceId, paid.instanceId);
    assert.equal(paidRow().getAttribute('aria-disabled'), 'false');
    paidRow().click();
    assert.deepEqual(selected, [paid.instanceId, paid.instanceId]);
    closeConfirmationModal();
    door.close();
  });
});

test('picker updates remove an exhausted upgrade and clear its selection', async () => {
  const { withKitDom } = await import('./helpers/dom.mjs');
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
    closeConfirmationModal();
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

test('the picker is the deck editor\'s desk: same frame, rows, selection outline and footer', async () => {
  const { withKitDom } = await import('./helpers/dom.mjs');
  const { mountCardUpgradeModal } = await import('../src/ui/components/cardUpgradeModal.js');
  await withKitDom(dom => {
    const run = newRun(); run.smithingStones = 1;
    const host = dom.document.createElement('main'); dom.document.body.append(host);
    let door;
    const pick = id => door.update(cardUpgradeModel(registries, run, id));
    door = mountCardUpgradeModal(host, cardUpgradeModel(registries, run, null), { registries, meta: {}, onSelect: pick, onBack() {}, onConfirm() {} });
    const panel = () => host.querySelector('.deck-editor.upgrade-desk');
    assert.ok(host.querySelector('.deck-editor-veil'), 'it stands in the editor\'s veil');
    assert.ok(panel(), 'it wears the editor\'s panel');
    assert.equal(host.querySelector('.deck-editor-inspector'), null, 'the desk is the list alone: no detail pane');
    assert.ok(host.querySelector('.deck-editor-panes .deck-editor-list'), 'the cards are the editor\'s list');
    assert.ok(host.querySelector('.deck-editor-item .deck-editor-main.card-upgrade-row'), 'each card is one of the editor\'s rows');
    assert.ok(host.querySelector('.deck-editor-foot .deck-editor-cancel.smith-back'), 'Back stands where Cancel stands');
    assert.equal(host.querySelector('.smith-confirm'), null, 'no Upgrade button in the list');
    assert.equal(host.querySelector('.deck-editor-inspect-back'), null, 'no standalone Back to cards');
    assert.deepEqual([...host.querySelector('.upgrade-desk-head').children].map(n => n.className.split(' ')[0]), ['upgrade-desk-headtext', 'modal-close'], 'one compact head row');
    assert.equal(modalOf(dom), null, 'nothing chosen: no modal');
    assert.equal(host.querySelectorAll('.card-upgrade-row.selected').length, 0);
    host.querySelector(`.card-upgrade-row[data-instance-id="${strike(run).instanceId}"]`).click();
    assert.ok(modalOf(dom), 'a tapped card opens its upgrade modal at once');
    assert.equal(host.querySelectorAll('.card-upgrade-row.selected').length, 1, 'exactly one row is outlined');
    assert.equal(host.querySelector('.card-upgrade-row.selected').getAttribute('aria-selected'), 'true');
    modalOf(dom).querySelector('.confirmation-cancel').click();
    assert.equal(modalOf(dom), null, 'Back closes the modal with no change');
    assert.ok(host.querySelector('.upgrade-desk'), 'and the list stays');
    closeConfirmationModal();
    door.close();
  });
});

test('the desk lists a blocked card dimmed and disabled, and choosing it does nothing', async () => {
  const { withKitDom } = await import('./helpers/dom.mjs');
  const { mountCardUpgradeModal } = await import('../src/ui/components/cardUpgradeModal.js');
  await withKitDom(dom => {
    const run = newRun(); run.smithingStones = 0;
    const paid = strike(run);
    paid.upgraded = true; paid.upgradeSteps = [{ k: 'authored' }];
    const host = dom.document.createElement('main'); dom.document.body.append(host);
    const picks = [];
    const door = mountCardUpgradeModal(host, cardUpgradeModel(registries, run, null), { registries, meta: {}, onSelect: id => picks.push(id), onBack() {}, onConfirm() {} });
    const blocked = [...host.querySelectorAll('.card-upgrade-row')].filter(r => r.getAttribute('aria-disabled') === 'true');
    assert.ok(blocked.length, 'a paid upgrade with no stones is listed');
    assert.ok(blocked.every(r => r.className.includes('locked')), 'and dimmed');
    blocked[0].click();
    assert.deepEqual(picks, [], 'choosing a blocked card selects nothing');
    door.close();
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

test('copies whose next upgrade rolls differently stay separate rows, each with its own preview', () => {
  const run = newRun();
  const strikes = run.deck.filter(c => c.cardId === 'core.strike');
  for (const s of strikes) { s.upgraded = true; s.upgradeSteps = [{ k: 'authored' }]; }
  run.smithingStones = 4;
  const rows = cardUpgradeModel(registries, run).rows.filter(r => r.cardId === 'core.strike');
  const steps = new Set(strikes.map(s => JSON.stringify(planCardUpgrade(run, registries, s.instanceId).step)));
  assert.equal(rows.length, steps.size, 'one row per distinct next step');
  assert.equal(rows.reduce((n, r) => n + r.copies, 0), strikes.length, 'every copy is counted once');
  for (const row of rows) assert.ok(row.instanceIds.every(id => JSON.stringify(planCardUpgrade(run, registries, id).step) === JSON.stringify(row.plan.step)), 'a row only groups copies with its own next step');
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

test('the card\'s modal is the shared body: cost, then the before and after faces, then the stat rows under them', async () => {
  const { withKitDom } = await import('./helpers/dom.mjs');
  const { mountCardUpgradeModal } = await import('../src/ui/components/cardUpgradeModal.js');
  await withKitDom(dom => {
    const run = newRun(); run.smithingStones = 0;
    const card = strike(run);
    card.upgraded = true; card.upgradeSteps = [{ k: 'authored' }];
    const host = dom.document.createElement('main'); dom.document.body.append(host);
    const door = mountCardUpgradeModal(host, cardUpgradeModel(registries, run, card.instanceId), { registries, meta: {}, onSelect() {}, onBack() {}, onConfirm() {} });
    const body = modalOf(dom).querySelector('.confirmation-details');
    const kids = [...body.firstElementChild.children].map(n => n.className.split(' ')[0]);
    assert.deepEqual([kids[0], kids[1], kids.at(-1)].filter(Boolean).slice(0, 2), ['confirmation-cost', 'card-upgrade-faces'], 'cost first, then the faces');
    assert.ok(kids.indexOf('card-upgrade-faces') < kids.indexOf('confirmation-change-list'), 'the stat rows are under the faces');
    closeConfirmationModal();
    door.close();
  });
});

// ---- Owner ask 2026-10-31: the blacksmith's choice ----
test('blacksmith rows list 2 options for a Basic card and 3 for a ranked one; the rest-site model stays at one', () => {
  const run = newRun(); run.smithingStones = 3;
  const smith = cardUpgradeModel(registries, run, null, { blacksmith: true });
  const plain = cardUpgradeModel(registries, run);
  assert.ok(plain.rows.every(r => r.options.length === 1 && r.plan.options === undefined));
  const strikeRow = smith.rows.find(r => r.cardId === 'core.strike');
  assert.equal(strikeRow.options.length, 2, 'Strike is Basic');
  assert.equal(strikeRow.plan.options.length, 2);
  assert.deepEqual(strikeRow.options[0].step, plain.rows.find(r => r.cardId === 'core.strike').plan.step);
  const ranked = smith.rows.find(r => r.cardId === 'core.ironbreaker' || r.cardId === 'core.reaverSpecial');
  if (ranked) assert.equal(ranked.options.length, 3);
  for (const row of smith.rows) for (const option of row.options) assert.ok(option.changes.length >= 1, `${row.cardId} option changes something`);
});

test('the choice dialog shows every option and highlights the picked one', async () => {
  const { withKitDom } = await import('./helpers/dom.mjs');
  const { mountCardUpgradeModal } = await import('../src/ui/components/cardUpgradeModal.js');
  await withKitDom(async dom => {
    const run = newRun(); run.smithingStones = 3;
    const card = strike(run);
    const host = dom.document.createElement('main'); dom.document.body.append(host);
    const door = mountCardUpgradeModal(host, cardUpgradeModel(registries, run, card.instanceId, { blacksmith: true }), { registries, meta: {}, onSelect() {}, onBack() {}, onConfirm() {} });
    // The choice is inside the card's own modal, not a separate step.
    const options = [...dom.document.querySelectorAll('.confirmation-modal .card-upgrade-option')];
    assert.equal(options.length, 2);
    assert.equal(host.querySelectorAll('.card-upgrade-option').length, 0, 'none in the list');
    assert.deepEqual(options.map(o => o.getAttribute('aria-checked')), ['true', 'false']);
    options[1].click();
    const after = [...dom.document.querySelectorAll('.confirmation-modal .card-upgrade-option')];
    assert.deepEqual(after.map(o => o.getAttribute('aria-checked')), ['false', 'true']);
    assert.ok(after[1].classList.contains('selected'));
    closeConfirmationModal();
    door.close();
  });
});

test('clicking or tapping an option\'s card face picks that option (the face does not swallow the click)', async () => {
  const { withKitDom } = await import('./helpers/dom.mjs');
  const { mountCardUpgradeModal } = await import('../src/ui/components/cardUpgradeModal.js');
  await withKitDom(async dom => {
    const run = newRun(); run.smithingStones = 3;
    const card = strike(run);
    const host = dom.document.createElement('main'); dom.document.body.append(host);
    const door = mountCardUpgradeModal(host, cardUpgradeModel(registries, run, card.instanceId, { blacksmith: true }), { registries, meta: {}, onSelect() {}, onBack() {}, onConfirm() {} });
    const options = () => dom.document.querySelectorAll('.confirmation-modal .card-upgrade-option');
    const checked = () => [...options()].map(o => o.getAttribute('aria-checked'));
    for (const pointerType of ['mouse', 'touch']) {
      options()[0].click();
      const face = i => options()[i].querySelector('.card-upgrade-option-face > *');
      assert.ok(face(1), 'the option draws a card face');
      face(1).dispatchEvent(Object.assign(new dom.Event('pointerdown', { bubbles: true }), { pointerType }));
      face(1).click();
      assert.deepEqual(checked(), ['false', 'true'], `${pointerType}: a face click moved the selection`);
    }
    closeConfirmationModal();
    door.close();
  });
});

test('a chosen option commits exactly that step', () => {
  const run = newRun(); run.smithingStones = 3;
  const card = strike(run);
  const row = cardUpgradeModel(registries, run, card.instanceId, { blacksmith: true }).selected;
  const quote = { ...row.plan, step: row.options[1].step, after: row.options[1].after };
  commitCardUpgrade(run, registries, quote);
  assert.deepEqual(card.upgradeSteps, [row.options[1].step]);
});

test('Confirm with a picked option hands the picked step to onConfirm, and a shrunken list clamps the pick', async () => {
  const { withKitDom } = await import('./helpers/dom.mjs');
  const { mountCardUpgradeModal } = await import('../src/ui/components/cardUpgradeModal.js');
  await withKitDom(async dom => {
    const run = newRun(); run.smithingStones = 3;
    const card = strike(run);
    const host = dom.document.createElement('main'); dom.document.body.append(host);
    let confirmed = null;
    const model = () => cardUpgradeModel(registries, run, card.instanceId, { blacksmith: true });
    const row = model().selected;
    const door = mountCardUpgradeModal(host, model(), { registries, meta: {}, onSelect() {}, onBack() {}, onConfirm: (id, plan) => { confirmed = { id, plan }; } });
    const priorTimeout = globalThis.setTimeout;
    globalThis.setTimeout = () => 0; // committing arms the confirmation door's input shield; it must not outlive the fixture
    try {
      [...dom.document.querySelectorAll('.confirmation-modal .card-upgrade-option')][1].click();
      dom.document.querySelector('.confirmation-modal .confirmation-confirm').click();
    } finally { globalThis.setTimeout = priorTimeout; }
    assert.ok(confirmed, 'onConfirm ran');
    assert.equal(confirmed.id, card.instanceId);
    assert.deepEqual(confirmed.plan.step, row.options[1].step, 'the picked option, not option 1');
    commitCardUpgrade(run, registries, confirmed.plan);
    assert.deepEqual(card.upgradeSteps, [row.options[1].step]);
  });
});

test('a pick past the end of a shrunken option list is clamped and still highlights an option', async () => {
  const { withKitDom } = await import('./helpers/dom.mjs');
  const { mountCardUpgradeModal } = await import('../src/ui/components/cardUpgradeModal.js');
  await withKitDom(async dom => {
    const run = newRun(); run.smithingStones = 3;
    const card = strike(run);
    const host = dom.document.createElement('main'); dom.document.body.append(host);
    const full = cardUpgradeModel(registries, run, card.instanceId, { blacksmith: true });
    const door = mountCardUpgradeModal(host, full, { registries, meta: {}, onSelect() {}, onBack() {}, onConfirm() {} });
    const options = () => [...dom.document.querySelectorAll('.confirmation-modal .card-upgrade-option')];
    options()[1].click();
    const shrunk = { ...full, selected: { ...full.selected, options: full.selected.options.slice(0, 1) } };
    door.update({ ...shrunk, rows: [shrunk.selected] });
    closeConfirmationModal();
    door.update(full);
    door.update({ ...full });
    assert.ok(door, 'a redraw after a shrunken list does not throw');
    // The choice only exists in the modal; re-open it from the chosen row and read the clamped pick.
    host.querySelector('.card-upgrade-row.selected').click();
    assert.deepEqual(options().map(o => o.getAttribute('aria-checked')).filter(v => v === 'true').length, 1, 'exactly one option is highlighted');
    closeConfirmationModal();
    door.close();
  });
});

// Owner screenshot 2026-11-01 (phone, ~360px): the option's face column was a fixed 8.5rem while the small card is wider,
// so the card covered the change list and its cost medallion sat on the "Option N" title. Layout needs a browser; this pins
// the CSS rule that fixed it (the column sizes to the card, pads for the medallion, the changes wrap and may drop below).
test('narrow option row: the face column fits its card and the changes list wraps', () => {
  const css = readFileSync(new URL('../styles/kit.css', import.meta.url), 'utf8');
  const narrow = css.slice(css.indexOf('.card-upgrade-option-list { flex-direction: column; }'));
  const block = narrow.slice(0, narrow.indexOf('\n}'));
  const face = block.match(/\.card-upgrade-option-face \{([^}]*)\}/)?.[1] || '';
  assert.doesNotMatch(face, /width:\s*8\.5rem/, 'no fixed face width narrower than the card');
  assert.match(face, /width:\s*auto/);
  assert.match(face, /padding:\s*1rem 0 0 1rem/, 'room for the cost medallion that hangs outside the card corner');
  assert.match(block.match(/\.card-upgrade-option-changes \{([^}]*)\}/)?.[1] || '', /flex:\s*1 1 7rem/);
});
