// tests/reward-choice-grid.test.mjs — the card chooser (a card reward's
// three-card choice) lays each option out as a column: the card face over its
// text button, the same grid the boss relic chooser uses.
//   node --test tests/reward-choice-grid.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { mountRewards } from '../src/ui/screens/reward.js';
import { withKitDom } from './helpers/kit-dom.mjs';

const REG = createRegistries(contentBundle);
const CARDS = ['frostNova', 'starstoneArc', 'scholarsInsight'];

function mountCardReward(dom) {
  dom.document.documentElement ??= dom.document.body;
  const app = dom.document.createElement('main');
  dom.document.body.replaceChildren(app);
  const run = { cinders: 0, deck: [], flasks: [], relics: [], loadout: { storage: [] } };
  const checkpoint = { states: {}, chosenCardId: null };
  mountRewards(app, {
    registries: REG, run, checkpoint, rewards: { cardIds: CARDS }, onDone() {},
    onPersist: () => true,
    saves: { loadMeta: () => ({ settings: { levelUpRefillSeconds: 0 } }), saveMeta() {} },
  });
  app.querySelector('[data-kind="card"]').click();
  return { app };
}

test('the card chooser lays out three option columns, each a card face above its text button', () => {
  withKitDom((dom) => {
    const { app } = mountCardReward(dom);
    const strip = app.querySelector('.reward-row');
    assert.ok(strip.classList.contains('reward-choice-grid'), 'the strip carries the shared grid class');
    const columns = app.querySelectorAll('.reward-row .reward-choice-option');
    assert.equal(columns.length, 3, 'three option columns');
    columns.forEach((column, i) => {
      assert.equal(column.querySelectorAll('.card').length, 1, `column ${i} has one card face`);
      const button = column.querySelector('button.reward-pick');
      assert.ok(button, `column ${i} has a text button`);
      assert.equal(button.querySelector('h3').textContent, REG.cards.get(CARDS[i]).name, `column ${i} button names the card`);
      assert.equal(button.getAttribute('role'), 'radio');
    });
  });
});

test('selecting a card puts the chosen trim on that column\'s card face and button only', () => {
  withKitDom((dom) => {
    const { app } = mountCardReward(dom);
    app.querySelectorAll('.reward-row .reward-choice-option')[1].querySelector('.card').click();
    assert.equal(app.querySelector('#reward-card-confirm').disabled, false, 'a face click enables Confirm');
    app.querySelectorAll('.reward-row .reward-choice-option').forEach((column, i) => {
      const chosen = i === 1;
      const face = column.querySelector('.card');
      const button = column.querySelector('button.reward-pick');
      assert.equal(face.classList.contains('is-chosen'), chosen, `face ${i} green trim`);
      assert.equal(face.classList.contains('reward-selected'), chosen, `face ${i} lift`);
      assert.equal(button.classList.contains('is-chosen'), chosen, `button ${i} green trim`);
      assert.equal(button.classList.contains('reward-selected'), false, `button ${i} carries no lift`);
      assert.equal(button.getAttribute('aria-checked'), String(chosen), `button ${i} aria-checked`);
    });
  });
});

test('clicking a card\'s text button selects that card and moves the trim', () => {
  withKitDom((dom) => {
    const { app } = mountCardReward(dom);
    const buttons = () => app.querySelectorAll('.reward-row button.reward-pick');
    buttons()[2].click();
    buttons()[0].click();
    const columns = app.querySelectorAll('.reward-row .reward-choice-option');
    assert.equal(columns[0].querySelector('button.reward-pick').classList.contains('is-chosen'), true);
    assert.equal(columns[0].querySelector('.card').classList.contains('is-chosen'), true);
    assert.equal(columns[2].querySelector('.card').classList.contains('is-chosen'), false);
    assert.equal(columns[2].querySelector('button.reward-pick').classList.contains('is-chosen'), false);
  });
});
