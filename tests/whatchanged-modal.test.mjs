// The what-changed receipt modal draws a diff's rows, locks the page, and closes on Continue.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { createRunState } from '../src/model/state.js';
import { snapshotRunForDiff, diffRunSnapshots } from '../src/model/runChangeReceipt.js';
import { nextUpgradeStep } from '../src/model/cardUpgradeLimits.js';
import { openWhatChangedModal } from '../src/ui/components/whatChangedModal.js';
import { withKitDom } from './helpers/kit-dom.mjs';

const newRun = () => createRunState({ registries, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });

test('rows, faces and the cost strip are drawn; Continue closes and calls onClose', () => {
  withKitDom((dom) => {
    const run = newRun();
    const before = snapshotRunForDiff(run);
    const card = run.deck.find((c) => c.cardId === 'core.strike');
    card.upgradeSteps = [nextUpgradeStep(run, card, registries.cards.get('core.strike'), registries)]; card.upgraded = true;
    run.cinders -= 15; run.hp += 3;
    const diff = diffRunSnapshots(before, snapshotRunForDiff(run), registries);
    let closed = 0;
    openWhatChangedModal({ title: 'The Anvil', lead: 'You strike true.', rows: diff.rows, registries, costLine: { cinders: 15 }, onClose: () => { closed += 1; } });
    const panel = dom.document.body.querySelector('.what-changed-modal');
    assert.ok(panel, 'modal mounted');
    assert.equal(panel.dataset.uiComponent, 'what-changed-modal');
    assert.equal(panel.querySelectorAll('[data-what-changed-kind]').length, diff.rows.length);
    assert.ok(panel.querySelector('[data-what-changed-faces]'), 'card faces drawn');
    assert.ok(panel.querySelector('.what-changed-cost'), 'cost strip');
    assert.ok(panel.querySelector('.what-changed-lead'), 'lead line');
    dom.document.body.querySelector('#what-changed-continue').click();
    assert.equal(closed, 1);
    assert.equal(dom.document.body.querySelector('.what-changed-modal'), null);
  });
});
