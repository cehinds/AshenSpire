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
import { upgradeChoiceCount } from '../src/model/cardUpgradeLimits.js';
import { upgradePreviewHtml } from '../src/ui/components/card.js';
import { projectGameCard } from '../src/model/gameProfile.js';
import { CloseConfirmationModal } from '../src/ui/components/confirmationModal.js';

// The picker is the list; a chosen card's own modal is the shared confirmation modal, in the document body.
const modalOf = dom => dom.document.querySelector('.confirmation-modal');

// Seed 504: every copy of a card rolls the same next step, so the identical-copies row tests do not depend on luck (re-recorded 2026-10-31 when the pool grew; was 511).
// The Reaver's greatsword is smithed to +9 so a card has all ten upgrade slots (rank + weapon level + 1, SPEC card upgrades); slot limits are tested in w25-upgrade-slots.test.mjs.
const newRun = () => Object.assign(createRunState({ registries, classId: 'reaver', seed: 504, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } }), { itemUpgradeLevels: { 'armament/greatsword': 9 } });
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
  assert.equal(model.rows.filter(row => !row.weaponBound).at(-1).instanceId, card.instanceId);
  assert.deepEqual(model.rows.filter(row => !row.disabled).map(row => row.instanceId),
    run.deck.filter((instance, i, deck) => instance.instanceId !== card.instanceId
      && planCardUpgrade(run, registries, instance.instanceId).ok
      // identical copies share the first copy's row
      && deck.findIndex(other => other.cardId === instance.cardId && !(other.upgradeSteps || []).length === !(instance.upgradeSteps || []).length) === i)
      .map(instance => instance.instanceId));
  run.smithingStones = 1;
  const replenished = cardUpgradeModel(registries, run, card.instanceId);
  assert.equal(replenished.rows.filter(row => !row.weaponBound)[0].instanceId, card.instanceId, 'affordable cards return to deck order');
  assert.equal(replenished.canConfirm, true);
});

test('a spent service disables every remaining upgrade and keeps its reason in the selected preview', () => {
  const run = newRun();
  const model = cardUpgradeModel(registries, run, strike(run).instanceId, { blockedReason: 'This service has already been used.' });
  assert.ok(model.rows.length > 0);
  assert.ok(model.rows.filter(row => !row.weaponBound).every(row => row.disabled && row.blockedReason === 'This service has already been used.'));
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
  run.mapNodeId = Object.values(run.mapGraph.nodes).find(n => n.type === 'shrine').id;
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
    assert.match(html, new RegExp(`(Weak|Bleed)[^<]*<span class="val up">${model.selected.plan.step.stacks}`), 'the new status is named and marked as raised');
  }
  assert.ok(found, 'some seed rolls an added status');
});

test('the picker omits capped cards and draws available cards with their upgrade cost', async () => {
  const { withKitDom } = await import('./helpers/dom.mjs');
  const { MountCardUpgradeModal } = await import('../src/ui/components/cardUpgradeModal.js');
  await withKitDom(dom => {
    const run = newRun(); run.smithingStones = 1;
    const capped = strike(run);
    capped.upgraded = true; capped.upgradeSteps = Array.from({ length: 10 }, () => ({ k: 'dmg', n: 1 }));
    const fresh = run.deck.find(c => c.cardId === 'core.defend');
    const host = dom.document.createElement('main'); dom.document.body.append(host);
    const model = cardUpgradeModel(registries, run, fresh.instanceId);
    const door = MountCardUpgradeModal(host, model, { registries, meta: {}, onSelect() {}, onBack() {}, onConfirm() {} });
    const rowOf = id => host.querySelector(`.card-upgrade-row[data-instance-id="${id}"]`);
    assert.equal(rowOf(capped.instanceId), null);
    assert.equal(rowOf(fresh.instanceId).dataset.upgradeState, 'free');
    assert.match(rowOf(fresh.instanceId).outerHTML, /No charge/);
    assert.equal(host.querySelector('.card-upgrade-preview'), null, 'the list has no in-picker preview');
    assert.equal(modalOf(dom), null, 'selecting a card opens no confirmation by itself');
    assert.match(host.querySelector('.card-upgrade-confirm').textContent, /Upgrade \(0\)/, 'the primary names the upgrade it commits');
    door.close();
  });
});

test('picker updates disable unaffordable upgrades, reorder rows, and use the current selection rules', async () => {
  const { withKitDom } = await import('./helpers/dom.mjs');
  const { MountCardUpgradeModal } = await import('../src/ui/components/cardUpgradeModal.js');
  await withKitDom(dom => {
    const run = newRun(); run.smithingStones = 1;
    const paid = strike(run);
    paid.upgraded = true; paid.upgradeSteps = [{ k: 'authored' }];
    const host = dom.document.createElement('main'); dom.document.body.append(host);
    const selected = [];
    let commits = 0;
    const door = MountCardUpgradeModal(host, cardUpgradeModel(registries, run, paid.instanceId), {
      registries, meta: {}, onSelect: id => selected.push(id), onBack() {}, onConfirm() { commits += 1; },
    });
    const rows = () => [...host.querySelectorAll('.card-upgrade-row')];
    const paidRow = () => rows().find(row => row.dataset.instanceId === paid.instanceId);
    CloseConfirmationModal();
    paidRow().click();
    assert.deepEqual(selected, [paid.instanceId]);

    run.smithingStones = 0;
    door.update(cardUpgradeModel(registries, run, paid.instanceId));
    assert.equal(rows().filter(row => row.dataset.upgradeState !== 'blocked' || row.dataset.instanceId === paid.instanceId).at(-1).dataset.instanceId, paid.instanceId);
    assert.equal(paidRow().getAttribute('aria-disabled'), 'true');
    assert.equal(paidRow().dataset.upgradeState, 'blocked');
    assert.match(paidRow().querySelector('.co-effect').textContent, /Smithing Stone/);
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
    CloseConfirmationModal();
    door.close();
  });
});

test('picker updates remove an exhausted upgrade and clear its selection', async () => {
  const { withKitDom } = await import('./helpers/dom.mjs');
  const { MountCardUpgradeModal } = await import('../src/ui/components/cardUpgradeModal.js');
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
    const door = MountCardUpgradeModal(host, model, { registries, meta: {}, onSelect() {}, onBack() {}, onConfirm() {} });
    commitCardUpgrade(run, registries, model.selected.plan);
    door.update(cardUpgradeModel(registries, run, card.instanceId));
    assert.equal(host.querySelector(`.card-upgrade-row[data-instance-id="${card.instanceId}"]`), null);
    assert.equal(host.querySelector('.card-upgrade-preview'), null);
    CloseConfirmationModal();
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

test('the picker is the reaction modal\'s design: option rows, a chosen card opens its own modal, Back and one primary', async () => {
  const { withKitDom } = await import('./helpers/dom.mjs');
  const { MountCardUpgradeModal } = await import('../src/ui/components/cardUpgradeModal.js');
  await withKitDom(dom => {
    const run = newRun(); run.smithingStones = 1;
    const host = dom.document.createElement('main'); dom.document.body.append(host);
    let door;
    const pick = id => door.update(cardUpgradeModel(registries, run, id));
    door = MountCardUpgradeModal(host, cardUpgradeModel(registries, run, null), { registries, meta: {}, onSelect: pick, onBack() {}, onConfirm() {} });
    const rows = () => [...host.querySelectorAll('.card-upgrade-row')];
    assert.ok(host.querySelector('.card-upgrade-modal.option-choice'), 'it wears the reaction modal\'s look');
    assert.ok(rows().length >= 2 && rows().every(row => row.classList.contains('option-row')), 'every card is an optionRowList row');
    assert.ok(host.querySelector('.option-row-list'), 'in one option list');
    assert.equal(host.querySelector('.smith-back').textContent.trim(), 'Back', 'Back is the exit');
    const upgrade = host.querySelector('.card-upgrade-confirm');
    assert.ok(upgrade, 'one primary Upgrade button');
    assert.equal(upgrade.disabled, true, 'disabled until a card is selected');
    assert.equal(host.querySelector('.card-upgrade-detail-modal'), null, 'nothing chosen: no card modal');
    assert.equal(host.querySelector('.option-row-detail'), null, 'and nothing opens inline');
    assert.equal(modalOf(dom), null, 'nothing chosen: no confirmation');
    // Click 1: choosing a card opens its own modal (owner, 2026-11-17), not a detail under the row.
    host.querySelector(`.card-upgrade-row[data-instance-id="${strike(run).instanceId}"]`).click();
    assert.equal(modalOf(dom), null, 'a tapped card opens no second confirmation');
    assert.equal(host.querySelectorAll('.card-upgrade-row.selected').length, 1, 'exactly one row is outlined');
    assert.equal(host.querySelector('.card-upgrade-row.selected').getAttribute('aria-selected'), 'true');
    assert.equal(host.querySelector('.card-upgrade-confirm').disabled, false, 'the primary enables');
    assert.equal(host.querySelector('.option-row-detail'), null, 'nothing expands inline');
    const card = host.querySelector('.card-upgrade-detail-modal');
    assert.ok(card, 'the chosen card\'s modal opens');
    assert.ok(card.querySelector('.upgrade-confirm-faces, .card-upgrade-faces'), 'with the before and after faces');
    assert.ok(card.querySelector('.card-upgrade-inspect'), 'and an (i) that reads the whole card');
    const commit = card.querySelector('.card-upgrade-detail-confirm');
    assert.equal(commit.disabled, false, 'its Upgrade is live');
    // Back returns to the list with the choice kept; choosing again reopens the modal.
    card.querySelector('.card-upgrade-detail-back').click();
    assert.equal(host.querySelector('.card-upgrade-detail-modal'), null, 'Back closes the card\'s modal');
    assert.ok(host.querySelector('.card-upgrade-modal'), 'and leaves the picker open');
    host.querySelector('.card-upgrade-row.selected').click();
    // Click 2: the modal's Upgrade commits at once.
    host.querySelector('.card-upgrade-detail-confirm').dispatchEvent(new dom.Event('click', { detail: 0 }));
    assert.equal(modalOf(dom), null, 'Confirm commits at once: no second confirmation (playtest 2026-11-17 item 36)');
    assert.equal(host.querySelector('.card-upgrade-detail-modal'), null, 'the card\'s modal closes on the commit');
    assert.equal(host.querySelector('.card-upgrade-modal'), null, 'and so does the picker');
  });
});

test('the desk lists a blocked card dimmed and disabled, and choosing it does nothing', async () => {
  const { withKitDom } = await import('./helpers/dom.mjs');
  const { MountCardUpgradeModal } = await import('../src/ui/components/cardUpgradeModal.js');
  await withKitDom(dom => {
    const run = newRun(); run.smithingStones = 0;
    const paid = strike(run);
    paid.upgraded = true; paid.upgradeSteps = [{ k: 'authored' }];
    const host = dom.document.createElement('main'); dom.document.body.append(host);
    const picks = [];
    const door = MountCardUpgradeModal(host, cardUpgradeModel(registries, run, null), { registries, meta: {}, onSelect: id => picks.push(id), onBack() {}, onConfirm() {} });
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

test('copies whose next upgrade rolls differently share one row that shows the first copy and says so', () => {
  const run = newRun();
  const strikes = run.deck.filter(c => c.cardId === 'core.strike');
  for (const s of strikes) { s.upgraded = true; s.upgradeSteps = [{ k: 'authored' }]; }
  run.smithingStones = 4;
  const rows = cardUpgradeModel(registries, run).rows.filter(r => r.cardId === 'core.strike');
  const steps = new Set(strikes.map(s => JSON.stringify(planCardUpgrade(run, registries, s.instanceId).step)));
  assert.equal(rows.length, 1, 'identical copies are one row however their next step rolls');
  assert.equal(rows[0].copies, strikes.length);
  assert.equal(rows[0].instanceId, strikes[0].instanceId, 'the first copy in deck order is the one upgraded');
  assert.equal(JSON.stringify(rows[0].plan.step), JSON.stringify(planCardUpgrade(run, registries, strikes[0].instanceId).step));
  assert.equal(rows[0].nextDiffers, steps.size > 1, 'the row says so when the copies would roll differently');
});

test('the smith list: two Strikes, an upgraded Strike and the weapon art are three rows, the art disabled with its reason', () => {
  const run = newRun(); run.smithingStones = 3;
  run.deck.push({ ...strike(run), instanceId: 'extra-strike' });
  const strikes = run.deck.filter(c => c.cardId === 'core.strike');
  assert.equal(strikes.length, 3);
  strikes[2].upgraded = true; strikes[2].upgradeSteps = [{ k: 'authored' }];
  const art = run.deck.find(c => c.cardId === 'greatswordSunderingHew');
  assert.ok(art && (art.grantedBy || art.sourceArmamentId), 'the starting weapon grants its art');
  const rows = cardUpgradeModel(registries, run).rows.filter(r => r.cardId === 'core.strike' || r.cardId === art.cardId);
  assert.equal(rows.length, 3);
  const plain = rows.find(r => r.cardId === 'core.strike' && r.upgrades === 0);
  const upgraded = rows.find(r => r.cardId === 'core.strike' && r.upgrades === 1);
  const weapon = rows.find(r => r.cardId === art.cardId);
  assert.equal(plain.copies, 2);
  assert.equal(upgraded.copies, 1);
  assert.equal(weapon.disabled, true);
  assert.equal(weapon.ok, false);
  assert.equal(weapon.blockedReason, 'Upgrades with its weapon (Smith)');
  const model = cardUpgradeModel(registries, run, art.instanceId);
  assert.equal(model.canConfirm, false, 'the weapon art cannot be confirmed');
  assert.equal(model.rows.at(-1).instanceId, weapon.instanceId, 'listed after the available rows');
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
  const { MountCardUpgradeModal } = await import('../src/ui/components/cardUpgradeModal.js');
  await withKitDom(dom => {
    const run = newRun(); run.smithingStones = 0;
    const card = strike(run);
    card.upgraded = true; card.upgradeSteps = [{ k: 'authored' }];
    const host = dom.document.createElement('main'); dom.document.body.append(host);
    const door = MountCardUpgradeModal(host, cardUpgradeModel(registries, run, card.instanceId), { registries, meta: {}, onSelect() {}, onBack() {}, onConfirm() {} });
    // One click commits (playtest 2026-11-17 item 36), so the shared body is the detail under the selected row.
    const body = host.querySelector('.card-upgrade-modal-details');
    const kids = [...body.children].map(n => n.className.split(' ')[0]);
    assert.deepEqual([kids[0], kids[1], kids.at(-1)].filter(Boolean).slice(0, 2), ['confirmation-cost', 'card-upgrade-faces'], 'cost first, then the faces');
    assert.ok(kids.indexOf('card-upgrade-faces') < kids.indexOf('confirmation-change-list'), 'the stat rows are under the faces');
    door.close();
  });
});

// ---- Owner ask 2026-10-31: the blacksmith's choice ----
test('blacksmith rows list 2 options for a Basic card and 3 for a ranked one; the rest-site model stays at one', () => {
  const run = newRun(); run.smithingStones = 3;
  const smith = cardUpgradeModel(registries, run, null, { blacksmith: true });
  const plain = cardUpgradeModel(registries, run);
  assert.ok(plain.rows.filter(r => !r.weaponBound).every(r => r.options.length === 1 && r.plan.options === undefined));
  const strikeRow = smith.rows.find(r => r.cardId === 'core.strike');
  assert.equal(strikeRow.options.length, 2, 'Strike is Basic');
  assert.equal(strikeRow.plan.options.length, 2);
  assert.deepEqual(strikeRow.options[0].step, plain.rows.find(r => r.cardId === 'core.strike').plan.step);
  // Ironbreaker and Rallying Roar are Reaver starters now (0 MP, so few distinct rolls): the rule asks for 3 slots on a ranked card,
  // and a card with fewer distinct candidates shows fewer rows (cardUpgradeLimits.nextUpgradeOptions).
  for (const id of ['core.ironbreaker', 'core.rallyingRoar']) {
    const row = smith.rows.find(r => r.cardId === id);
    assert.ok(row, `${id} is in the Reaver deck`);
    assert.equal(upgradeChoiceCount(registries.cards.get(id), row.instance || {}, { blacksmith: true }), 3, `${id} is ranked`);
    assert.ok(row.options.length >= 2 && row.options.length <= 3, `${id} lists 2 or 3 options`);
  }
  for (const row of smith.rows) for (const option of row.options) assert.ok(option.changes.length >= 1, `${row.cardId} option changes something`);
});

test('the choice dialog shows every option and highlights the picked one', async () => {
  const { withKitDom } = await import('./helpers/dom.mjs');
  const { MountCardUpgradeModal } = await import('../src/ui/components/cardUpgradeModal.js');
  await withKitDom(async dom => {
    const run = newRun(); run.smithingStones = 3;
    const card = strike(run);
    const host = dom.document.createElement('main'); dom.document.body.append(host);
    const door = MountCardUpgradeModal(host, cardUpgradeModel(registries, run, card.instanceId, { blacksmith: true }), { registries, meta: {}, onSelect() {}, onBack() {}, onConfirm() {} });
    // The choice sits under the selected row (owner, 2026-11-14), not in the confirmation.
    const options = [...host.querySelectorAll('.card-upgrade-option')];
    assert.equal(options.length, 2);
    assert.deepEqual(options.map(o => o.getAttribute('aria-checked')), ['true', 'false']);
    options[1].click();
    const after = [...host.querySelectorAll('.card-upgrade-option')];
    assert.deepEqual(after.map(o => o.getAttribute('aria-checked')), ['false', 'true']);
    assert.ok(after[1].classList.contains('selected'));
    CloseConfirmationModal();
    door.close();
  });
});

test('clicking or tapping an option\'s card face picks that option (the face does not swallow the click)', async () => {
  const { withKitDom } = await import('./helpers/dom.mjs');
  const { MountCardUpgradeModal } = await import('../src/ui/components/cardUpgradeModal.js');
  await withKitDom(async dom => {
    const run = newRun(); run.smithingStones = 3;
    const card = strike(run);
    const host = dom.document.createElement('main'); dom.document.body.append(host);
    const door = MountCardUpgradeModal(host, cardUpgradeModel(registries, run, card.instanceId, { blacksmith: true }), { registries, meta: {}, onSelect() {}, onBack() {}, onConfirm() {} });
    const options = () => host.querySelectorAll('.card-upgrade-option');
    const checked = () => [...options()].map(o => o.getAttribute('aria-checked'));
    for (const pointerType of ['mouse', 'touch']) {
      options()[0].click();
      const face = i => options()[i].querySelector('.card-upgrade-option-face > *');
      assert.ok(face(1), 'the option draws a card face');
      face(1).dispatchEvent(Object.assign(new dom.Event('pointerdown', { bubbles: true }), { pointerType }));
      face(1).click();
      assert.deepEqual(checked(), ['false', 'true'], `${pointerType}: a face click moved the selection`);
    }
    CloseConfirmationModal();
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
  const { MountCardUpgradeModal } = await import('../src/ui/components/cardUpgradeModal.js');
  await withKitDom(async dom => {
    const run = newRun(); run.smithingStones = 3;
    const card = strike(run);
    const host = dom.document.createElement('main'); dom.document.body.append(host);
    let confirmed = null;
    const model = () => cardUpgradeModel(registries, run, card.instanceId, { blacksmith: true });
    const row = model().selected;
    const door = MountCardUpgradeModal(host, model(), { registries, meta: {}, onSelect() {}, onBack() {}, onConfirm: (id, plan) => { confirmed = { id, plan }; } });
    const priorTimeout = globalThis.setTimeout;
    globalThis.setTimeout = () => 0; // committing arms the confirmation door's input shield; it must not outlive the fixture
    try {
      [...host.querySelectorAll('.card-upgrade-option')][1].click();
      host.querySelector('.card-upgrade-confirm').click(); // one click commits: no second confirmation
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
  const { MountCardUpgradeModal } = await import('../src/ui/components/cardUpgradeModal.js');
  await withKitDom(async dom => {
    const run = newRun(); run.smithingStones = 3;
    const card = strike(run);
    const host = dom.document.createElement('main'); dom.document.body.append(host);
    const full = cardUpgradeModel(registries, run, card.instanceId, { blacksmith: true });
    const door = MountCardUpgradeModal(host, full, { registries, meta: {}, onSelect() {}, onBack() {}, onConfirm() {} });
    const options = () => [...host.querySelectorAll('.card-upgrade-option')];
    options()[1].click();
    const shrunk = { ...full, selected: { ...full.selected, options: full.selected.options.slice(0, 1) } };
    door.update({ ...shrunk, rows: [shrunk.selected] });
    CloseConfirmationModal();
    door.update(full);
    door.update({ ...full });
    assert.ok(door, 'a redraw after a shrunken list does not throw');
    // Read the clamped pick off the options under the selected row.
    assert.deepEqual(options().map(o => o.getAttribute('aria-checked')).filter(v => v === 'true').length, 1, 'exactly one option is highlighted');
    CloseConfirmationModal();
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

test('the picker lists deck cards first, then the library, and marks each deck card (playtest 2026-11-17 item 45b)', async () => {
  const run = newRun(); run.smithingStones = 3;
  run.sideboard.push({ instanceId: 'lib:defend', cardId: 'core.defend' });
  const rows = cardUpgradeModel(registries, run).rows;
  const flags = rows.map((row) => row.inDeck);
  assert.ok(flags.includes(false), 'a library card is listed');
  assert.ok(flags.slice(flags.indexOf(false)).every((flag) => !flag), 'no deck card after the first library card');
  const { withKitDom } = await import('./helpers/dom.mjs');
  const { MountCardUpgradeModal } = await import('../src/ui/components/cardUpgradeModal.js');
  await withKitDom(dom => {
    const host = dom.document.createElement('main'); dom.document.body.append(host);
    const door = MountCardUpgradeModal(host, cardUpgradeModel(registries, run), { registries, meta: {}, onSelect() {}, onBack() {}, onConfirm() {} });
    const shown = [...host.querySelectorAll('.card-upgrade-row')];
    assert.ok(shown.filter((row) => row.dataset.inDeck === 'true').every((row) => row.querySelector('.in-deck-badge')), 'every deck row wears the marker');
    assert.equal(host.querySelector('.card-upgrade-row[data-instance-id="lib:defend"] .in-deck-badge'), null, 'a library row does not');
    door.close();
  });
});

// Owner screenshot 2026-11-17: the EFFECTS row read "EFFECTS EFFECTS draw → addCard, draw" (the label twice, op names).
test('the EFFECTS row reads like card text, in the card\'s order, with amounts summed', async () => {
  const { UpgradeEffectWords } = await import('../src/ui/models/CardUpgradeModel.js');
  const { applyUpgradeSteps } = await import('../src/model/cardUpgrade.js');
  const plain = registries.cards.get('core.strike');
  const after = (step) => UpgradeEffectWords(registries, applyUpgradeSteps(plain, [step]));
  assert.equal(UpgradeEffectWords(registries, plain), 'None');
  assert.equal(after({ k: 'fx', fx: 'copy' }), 'Adds a copy');
  assert.equal(after({ k: 'fx', fx: 'cull' }), 'Exhausts 1, Draws 2');
  assert.equal(after({ k: 'fx', fx: 'shuffle' }), 'Shuffles discard into draw');
  const drawThenCopy = { id: 'x', effects: [{ op: 'draw', amount: 1 }, { op: 'addCard', card: 'x', count: 1, pile: 'discard' }] };
  assert.equal(UpgradeEffectWords(registries, drawThenCopy), 'Draws 1, Adds a copy');
  const boosts = { id: 'x', effects: [{ op: 'changeAttribute', attribute: 'strength', amount: 2, thisTurn: true }, { op: 'damage', target: 'otherEnemy', amount: 3 }], runAttributeBonus: { dexterity: 1 } };
  assert.equal(UpgradeEffectWords(registries, boosts), '+2 STR this turn, Hits another enemy, +1 DEX for the run');
  for (const words of [UpgradeEffectWords(registries, drawThenCopy), UpgradeEffectWords(registries, boosts)]) {
    assert.doesNotMatch(words, /addCard|changeAttribute|otherEnemy|shuffleDiscardIntoDraw/, 'no internal names');
  }
});

// Owner screenshot 2026-11-17 (the option modal): "EFFECTS None → Hit another enemy" should read "Also hits another enemy".
test('an upgrade that adds effects says only what it adds: ALSO, no "None →"', async () => {
  const { UpgradeEffectGain, cardUpgradeChanges } = await import('../src/ui/models/CardUpgradeModel.js');
  const plain = { id: 'x', effects: [{ op: 'damage', target: 'enemy', amount: 6 }] };
  const other = { ...plain, effects: [...plain.effects, { op: 'damage', target: 'otherEnemy', amount: 3 }] };
  assert.equal(UpgradeEffectGain(registries, plain, other), 'Hits another enemy');
  const drawOne = { id: 'x', effects: [{ op: 'draw', amount: 1 }] };
  const drawTwoCopy = { id: 'x', effects: [{ op: 'draw', amount: 2 }, { op: 'addCard', card: 'x', count: 1, pile: 'discard' }] };
  assert.equal(UpgradeEffectGain(registries, drawOne, drawTwoCopy), 'Draws 1, Adds a copy', 'a raised count reads as the extra');
  assert.equal(UpgradeEffectGain(registries, drawOne, drawOne), '', 'nothing added: nothing to say');
  assert.equal(UpgradeEffectGain(registries, drawTwoCopy, drawOne), null, 'a loss needs a before and after');
  const changes = cardUpgradeChanges(registries, plain, other);
  const also = changes.find(change => change.adds);
  assert.equal(also?.label, 'ALSO');
  assert.equal(also.after, 'Hits another enemy');
  assert.equal(changes.some(change => change.label === 'EFFECTS'), false, 'no EFFECTS row beside it');
  const { withKitDom } = await import('./helpers/dom.mjs');
  const { MountCardUpgradeModal } = await import('../src/ui/components/cardUpgradeModal.js');
  await withKitDom(dom => {
    const run = newRun(); run.smithingStones = 3;
    const host = dom.document.createElement('main'); dom.document.body.append(host);
    // The first option is given an added effect, so its line and the change row can be read.
    const model = cardUpgradeModel(registries, run, strike(run).instanceId, { blacksmith: true });
    const options = model.selected.options.map((option, index) => (index === 0 ? { ...option, changes } : option));
    const door = MountCardUpgradeModal(host, { ...model, selected: { ...model.selected, options } }, { registries, meta: {}, onSelect() {}, onBack() {}, onConfirm() {} });
    const lines = [...host.querySelectorAll('.card-upgrade-option')[0].querySelectorAll('.card-upgrade-option-changes li')].map(li => li.textContent);
    assert.ok(lines.includes('Also hits another enemy'), `the option says what it adds: ${lines.join(' | ')}`);
    for (const line of lines) assert.doesNotMatch(line, /EFFECTS|None →/, `"${line}" names no EFFECTS and no None`);
    const row = host.querySelector('.confirmation-change-list .card-upgrade-gain .d-to');
    assert.equal(row?.textContent, 'Hits another enemy', 'the change row shows the added words alone');
    door.close();
  });
});

test('each change row in the card\'s modal names its label once', async () => {
  const { withKitDom } = await import('./helpers/dom.mjs');
  const { MountCardUpgradeModal } = await import('../src/ui/components/cardUpgradeModal.js');
  await withKitDom(dom => {
    const run = newRun(); run.smithingStones = 3;
    const card = strike(run);
    const host = dom.document.createElement('main'); dom.document.body.append(host);
    const door = MountCardUpgradeModal(host, cardUpgradeModel(registries, run, card.instanceId), { registries, meta: {}, onSelect() {}, onBack() {}, onConfirm() {} });
    const rows = [...host.querySelectorAll('.confirmation-change-list .as-statrow')];
    assert.ok(rows.length >= 1, 'the upgrade lists its changes');
    for (const row of rows) {
      const label = row.querySelector('.sr-name').textContent;
      assert.ok(label, 'the row names its change');
      assert.equal(row.querySelector('.sr-vals .sp-k'), null, `${label}: the value carries no second label`);
      assert.ok(row.querySelector('.sr-vals .as-delta'), `${label}: the value is the before -> after delta`);
    }
    door.close();
  });
});

// Owner screenshot 2026-11-17 (390px): "0 → 1 upgrade · No charge" was one chip and "In deck" was cut to "In de".
test('a row\'s step and price are separate chips that may wrap, so a phone row is never cut', async () => {
  const { withKitDom } = await import('./helpers/dom.mjs');
  const { MountCardUpgradeModal } = await import('../src/ui/components/cardUpgradeModal.js');
  await withKitDom(dom => {
    const run = newRun(); run.smithingStones = 3;
    const host = dom.document.createElement('main'); dom.document.body.append(host);
    const door = MountCardUpgradeModal(host, cardUpgradeModel(registries, run), { registries, meta: {}, onSelect() {}, onBack() {}, onConfirm() {} });
    const chips = [...host.querySelector(`.card-upgrade-row[data-instance-id="${strike(run).instanceId}"]`).querySelectorAll('.co-chip')].map(chip => chip.textContent);
    assert.deepEqual(chips, ['0 → 1 upgrade', 'No charge']);
    door.close();
  });
  const css = readFileSync(new URL('../styles/combat.css', import.meta.url), 'utf8');
  const chipRule = css.match(/\.card-upgrade-modal \.option-row \.co-chip \{([^}]*)\}/)?.[1] || '';
  assert.match(chipRule, /white-space:\s*normal/, 'a chip wraps rather than overflowing its row');
  assert.match(css, /\.card-upgrade-modal \.option-row \.co-costs \{[^}]*flex-wrap:\s*wrap/, 'the chips wrap onto a second line');
});

test('choosing another card under an open card modal reopens it for that card', async () => {
  const { withKitDom } = await import('./helpers/dom.mjs');
  const { MountCardUpgradeModal } = await import('../src/ui/components/cardUpgradeModal.js');
  await withKitDom(dom => {
    const run = newRun(); run.smithingStones = 3;
    const defend = run.deck.find(c => c.cardId === 'core.defend');
    const host = dom.document.createElement('main'); dom.document.body.append(host);
    const door = MountCardUpgradeModal(host, cardUpgradeModel(registries, run, strike(run).instanceId), { registries, meta: {}, onSelect() {}, onBack() {}, onConfirm() {} });
    const titles = () => [...host.querySelectorAll('.card-upgrade-detail-modal .modal-head-id h2')].map(h => h.textContent);
    assert.deepEqual(titles(), ['Strike']);
    door.update(cardUpgradeModel(registries, run, defend.instanceId));
    assert.deepEqual(titles(), ['Defend'], 'one modal, now titled for the new card');
    door.update(cardUpgradeModel(registries, run, null));
    assert.deepEqual(titles(), [], 'no selection: the card modal closes');
    door.close();
  });
});
