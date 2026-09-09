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
    for (const pointerType of ['touch', 'mouse', 'pen']) {
      const app = document.createElement('main'); document.body.append(app);
      const run = { cinders: 0, deck: [], flasks: [], relics: [], loadout: { storage: [] } };
      const checkpoint = { states: {}, chosenCardId: null };
      let savedDeck = null, fail = false, writes = 0;
      mountRewards(app, { registries, run, checkpoint, rewards: { cardIds: ['frostNova', 'starstoneArc', 'scholarsInsight'] }, onDone() {},
        onPersist() { writes++; if (fail === 'throw') throw new Error('disk full'); if (fail) return false; savedDeck = [...run.deck]; },
      });
      const open = () => app.querySelector('[data-kind="card"]').click();
      const tap = card => { card.dispatchEvent(new dom.Event('pointerdown', { pointerType, button: 0, bubbles: true })); card.click(); };
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
      app.remove();
    }
    return checks;
  } finally { for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } }
}
if (process.argv[1]?.endsWith('reward-confirm.test.mjs')) console.log(`reward-confirm: OK — ${runRewardConfirmTests()} checks passed`);
