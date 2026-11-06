// The parent -> child modal return (src/ui/modalReturn.js): a confirmed child lands back on its parent, redrawn;
// a cancel never strands the parent; only the parent's own close exits; the Back label names the opening place.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../src/engine/runCombat.js';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { createRunState } from '../src/model/state.js';
import { cardUpgradeModel } from '../src/ui/models/CardUpgradeModel.js';
import { closeConfirmationModal } from '../src/ui/components/confirmationModal.js';
import { pushModalParent, modalParent, dropModalParent, returnToModalParent, modalParentLabel, resetModalParents, flushModalReturns } from '../src/ui/modalReturn.js';
import { t } from '../src/ui/strings.js';
import { resetModalState } from '../src/ui/modalManager.js';

const tick = () => new Promise((r) => setTimeout(r, 5));

test('confirm returns to the parent with the focus key; a second return has nothing to do', async () => {
  resetModalParents();
  const seen = [];
  pushModalParent({ place: 'Blacksmith', reopen: (focus) => seen.push(focus) });
  assert.equal(returnToModalParent('row-1'), true);
  await tick();
  assert.deepEqual(seen, ['row-1']);
  assert.equal(returnToModalParent('x'), false);
});

test('the parent closing on its own forgets it and its children: nothing reopens', async () => {
  resetModalParents();
  const seen = [];
  const outer = pushModalParent({ place: 'Shrine', reopen: () => seen.push('outer') });
  pushModalParent({ place: 'List', reopen: () => seen.push('inner') });
  dropModalParent(outer);
  assert.equal(modalParent(), null);
  assert.equal(returnToModalParent(), false);
  await tick();
  assert.deepEqual(seen, []);
});

test('the Back label names the place that opened the flow', () => {
  assert.equal(modalParentLabel({ place: t('common.place.blacksmith') }), 'Back to Blacksmith');
  assert.equal(modalParentLabel({ place: t('common.place.shrine') }), 'Back to Shrine');
  assert.equal(modalParentLabel({ place: t('common.place.merchant') }), 'Back to Merchant');
  assert.equal(modalParentLabel(null), t('common.back'));
});

test('Blacksmith card list: confirm lands back on a refreshed list, Back exits fully', async () => {
  const { withKitDom } = await import('./helpers/kit-dom.mjs');
  const { mountCardUpgradeModal } = await import('../src/ui/components/cardUpgradeModal.js');
  await withKitDom(async (dom) => {
    resetModalParents(); resetModalState();
    // Timers the shell sets run inside this DOM (withKitDom restores the globals when the callback returns).
    const realSet = globalThis.setTimeout; const timers = [];
    globalThis.setTimeout = (fn) => { timers.push(fn); return 0; };
    const drain = () => { while (timers.length) timers.shift()(); };
    const run = createRunState({ registries, classId: 'reaver', seed: 3 }); run.smithingStones = 3;
    const host = dom.document.createElement('main'); dom.document.body.append(host);
    const strike = run.deck.find((c) => c.cardId === 'core.strike');
    let opens = 0, backs = 0, confirmed = null;
    const open = (focus) => {
      opens++;
      let door;
      door = mountCardUpgradeModal(host, cardUpgradeModel(registries, run, null), {
        registries, meta: {}, focusInstanceId: focus,
        parent: { place: t('common.place.blacksmith'), reopen: open },
        onSelect: (id) => door.update(cardUpgradeModel(registries, run, id)), onBack() { backs++; }, onConfirm(id) { confirmed = id; },
      });
      return door;
    };
    open(null);
    assert.equal(host.querySelector('.smith-back').textContent.trim(), 'Back to Blacksmith');
    // The row's own review confirms: the list closes, commits, and reopens.
    host.querySelector(`.card-upgrade-row[data-instance-id="${strike.instanceId}"]`).click();
    dom.document.querySelector('.confirmation-modal .confirmation-confirm').click();
    assert.equal(confirmed, strike.instanceId);
    flushModalReturns(); drain();
    assert.equal(opens, 2, 'the list was drawn again');
    assert.equal(host.querySelectorAll('.card-upgrade-modal').length, 1, 'exactly one list stands');
    // Back is a full exit: no reopen.
    host.querySelector('.smith-back').click();
    flushModalReturns();
    assert.equal(backs, 1); assert.equal(opens, 2);
    assert.equal(modalParent(), null);
    drain(); globalThis.setTimeout = realSet;
    closeConfirmationModal();
  });
});
