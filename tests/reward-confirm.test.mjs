import assert from 'node:assert/strict';
import { mountRewards } from '../src/ui/screens/reward.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { rewardDom } from './helpers/reward-dom.mjs';

export function runRewardConfirmTests() {
  const dom = rewardDom();
  const saved = Object.fromEntries(Object.keys(dom).map(key => [key, globalThis[key]]));
  Object.assign(globalThis, dom);
  let checks = 0;
  const check = (value, expected, why) => { assert.deepEqual(value, expected, why); checks++; };
  try {
    const registries = createRegistries(contentBundle);
    for (const pointerType of ['touch', 'mouse', 'pen', 'synthetic']) {
      const app = document.createElement('main'); document.body.append(app);
      const run = { cinders: 0, deck: [], flasks: [], relics: [], loadout: { storage: [] } };
      const checkpoint = { states: {}, chosenCardId: null };
      let savedDeck = null, fail = false, writes = 0;
      mountRewards(app, { registries, run, checkpoint, rewards: { cardIds: ['frostNova', 'starstoneArc', 'scholarsInsight'] }, onDone() {},
        onPersist() { writes++; if (fail === 'throw') throw new Error('disk full'); if (fail) return false; savedDeck = [...run.deck]; },
      });
      // W1t claim status: the head count and status column follow the menu rows.
      const claimed = () => app.querySelector('.modal-head-status').textContent;
      check(claimed(), '0 of 1 claimed', 'nothing claimed yet');
      check([...app.querySelectorAll('.reward-claim-row')].map(row => row.dataset.state), ['available'], 'a pending row reads available');
      check(!!app.querySelector('.reward-claim-required'), true, 'the card choice is required');
      const open = () => app.querySelector('[data-kind="card"]').click();
      const tap = card => { if (pointerType !== 'synthetic') card.dispatchEvent(new dom.Event('pointerdown', { pointerType, button: 0, bubbles: true })); card.click(); };
      open();
      check(app.querySelector('#reward-card-confirm').disabled, true, 'no selection cannot confirm');
      tap(app.querySelectorAll('.reward-row .card')[2]);
      check(app.querySelector('#reward-card-confirm').disabled, false, `${pointerType} first tap enables Confirm`);
      check(run.deck.length, 0, 'selection never collects');
      check(app.querySelectorAll('.reward-selected').length, 1, 'one visible reward selection');
      app.querySelector('#reward-back').click(); open();
      check(app.querySelectorAll('.reward-selected')[0].dataset.cardId, 'scholarsInsight', 'Back keeps selection');
      tap(app.querySelectorAll('.reward-row .card')[0]);
      check(app.querySelectorAll('.reward-selected').length, 1, 'switch replaces prior selection');
      const confirm = app.querySelector('#reward-card-confirm');
      for (const failure of ['throw', true]) {
        fail = failure; confirm.click();
        check(run.deck.length, 0, 'failed save rolls deck back');
        check(checkpoint, { states: {}, chosenCardId: null }, 'failed save rolls checkpoint back');
        check(confirm.disabled, false, 'failed save permits retry');
        check(app.querySelector('.reward-confirm-status').hidden, false, 'save failure is visible');
      }
      fail = false; confirm.click(); confirm.click();
      check(run.deck.map(card => card.cardId), ['frostNova'], 'Confirm collects selected card exactly once');
      check(savedDeck, run.deck, 'selected card persisted');
      check(writes, 3, 'duplicate confirm cannot persist twice');
      check(checkpoint.states.card, 'taken', 'successful checkpoint records Taken');
      check(claimed(), '1 of 1 claimed', 'the head counts the taken card');
      check([...app.querySelectorAll('.reward-claim-row')].map(row => row.dataset.state), ['taken'], 'the status row matches the menu');
      check(app.querySelector('.reward-claim-required'), null, 'no choice waits once the card is taken');
      app.remove();
    }
    // THE CLASS DRAFT (plan phase 5b): node tiles carry the node's name and its
    // sentence with the numbers read; one selection path; Confirm picks the
    // node once, spends the draft and writes the checkpoint's node.
    {
      const app = document.createElement('main'); document.body.append(app);
      const run = { class: 'reaver', cinders: 0, deck: [], flasks: [], relics: [], loadout: { storage: [] }, coreTags: [], skills: { 'class:reaver': { xp: 0, level: 1, pendingDrafts: 1 } } };
      const checkpoint = { states: {}, chosenCardId: null, chosenDraftNodeIds: {} };
      let writes = 0;
      mountRewards(app, { registries, run, checkpoint, rewards: { classDrafts: [{ classId: 'reaver', level: 1, nodeIds: ['ironFooting', 'bloodTempo'] }] }, onDone() {}, onPersist() { writes++; } });
      check(!!app.querySelector('.reward-claim-required'), true, 'the node choice is required');
      app.querySelector('[data-kind="classDraft"]').click();
      const tiles = app.querySelectorAll('.reward-row .reward-node');
      check(tiles.map(tile => tile.querySelector('h3').textContent), ['Iron Footing', 'Blood Tempo'], 'each tile names its node');
      check(tiles.map(tile => /\d/.test(tile.querySelector('p').textContent) && !/\{\w+\}/.test(tile.querySelector('p').textContent)), [true, true], 'each sentence reads its numbers');
      const confirm = app.querySelector('#reward-card-confirm');
      check(confirm.disabled, true, 'no selection cannot confirm');
      tiles[1].click();
      check(confirm.disabled, false, 'a tapped tile enables Confirm');
      check(app.querySelectorAll('.reward-selected').map(tile => tile.dataset.nodeId), ['bloodTempo'], 'one tile is lit');
      check(app.querySelectorAll('.is-chosen').map(tile => tile.dataset.nodeId), ['bloodTempo'], 'and rings');
      check(run.coreTags, [], 'selection never picks');
      tiles[0].click();
      check(app.querySelectorAll('.reward-selected').map(tile => tile.dataset.nodeId), ['ironFooting'], 'switch replaces the prior tile');
      confirm.click(); confirm.click();
      check(run.coreTags, ['ironFooting'], 'Confirm picks the node exactly once');
      check(run.skills['class:reaver'].pendingDrafts, 0, 'and spends the draft');
      check(checkpoint.states['classDraft:reaver:0'], 'taken', 'the checkpoint records Taken');
      check(checkpoint.chosenDraftNodeIds['classDraft:reaver:0'], 'ironFooting', 'and the node');
      check(writes, 1, 'one persist');
      check(app.querySelector('.reward-claim-required'), null, 'no choice waits once the node is picked');
      app.remove();
    }
    return checks;
  } finally { for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } }
}
if (process.argv[1]?.endsWith('reward-confirm.test.mjs')) console.log(`reward-confirm: OK — ${runRewardConfirmTests()} checks passed`);
