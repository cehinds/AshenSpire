import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './helpers/option-modal-dom.mjs';

const button = (document, label) => document.querySelectorAll('button').find(node => node.textContent === label);
const options = () => [
  { id: 'advance', name: 'Advance', costs: { energy: 1, stamina: 1, mana: 0 }, affordable: true },
  { id: 'retreat', name: 'Retreat', costs: { energy: 3, stamina: 3, mana: 1 }, affordable: false },
];

test('mode costs are visible and only the unaffordable option is disabled; Advance still commits', async () => {
  const { document, restore } = installDom();
  try {
    const { openCardChoiceModal } = await import('../src/ui/components/cardChoiceModal.js');
    const chosen = [];
    const shell = openCardChoiceModal({ cardName: 'Movement', opener: null, plan: { kind: 'mode', options: options() }, onChoose: id => chosen.push(id) });
    const rows = shell.body.querySelectorAll('[data-choice]');
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[0].querySelectorAll('.co-chip').map(node => node.textContent), ['1 Stamina']);
    assert.deepEqual(rows[1].querySelectorAll('.co-chip').map(node => node.textContent), ['3 Stamina', '1 Mana']);
    assert.equal(rows[0].disabled, false);
    assert.equal(rows[1].disabled, true);
    assert.equal(rows[1].getAttribute('aria-disabled'), 'true');
    rows[1].click();
    assert.equal(button(document, 'Choose').disabled, true);
    rows[0].click();
    assert.deepEqual(chosen, [], 'selection does not spend or commit');
    button(document, 'Choose').click();
    assert.deepEqual(chosen, ['advance']);
  } finally { restore(); }
});

test('Cancel stays available with expensive modes and commits nothing', async () => {
  const { document, restore } = installDom();
  try {
    const { openCardChoiceModal } = await import('../src/ui/components/cardChoiceModal.js');
    const chosen = [];
    openCardChoiceModal({ opener: null, plan: { kind: 'mode', options: options().map(option => ({ ...option, affordable: false })) }, onChoose: id => chosen.push(id) });
    const cancel = button(document, 'Cancel');
    assert.equal(cancel.disabled, false);
    cancel.click();
    assert.deepEqual(chosen, []);
  } finally { restore(); }
});

test('energy-priced legacy modes show their paid SP and genuinely free modes show zero', async () => {
  const { restore } = installDom();
  try {
    const { openCardChoiceModal } = await import('../src/ui/components/cardChoiceModal.js');
    const shell = openCardChoiceModal({ opener: null, onChoose() {}, plan: { kind: 'mode', options: [
      { id: 'legacy', name: 'Legacy', costs: { energy: 1, stamina: 0, mana: 0 }, affordable: true },
      { id: 'free', name: 'Free', costs: { energy: 0, stamina: 0, mana: 0 }, affordable: true },
    ] } });
    const rows = shell.body.querySelectorAll('[data-choice]');
    assert.deepEqual(rows.map(row => row.querySelector('.co-chip').textContent), ['1 Stamina', '0 Stamina']);
    shell.close();
  } finally { restore(); }
});

test('legacy plans without resolved costs keep their text and selectable rows', async () => {
  const { restore } = installDom();
  try {
    const { openCardChoiceModal } = await import('../src/ui/components/cardChoiceModal.js');
    const shell = openCardChoiceModal({ opener: null, plan: { kind: 'mode', options: [{ id: 'old', name: 'Old mode', tooltip: 'Original explanation' }] }, onChoose() {} });
    const row = shell.body.querySelector('[data-choice]');
    assert.equal(row.disabled, false);
    assert.equal(row.querySelectorAll('.co-chip').length, 0);
    assert.equal(row.querySelector('.co-effect').textContent, 'Original explanation');
    shell.close();
  } finally { restore(); }
});

test('the live mode plan keeps affordable Advance playable after Retreat grows, with exact paid cost and no Cancel mutation', async () => {
  const { bandsFight } = await import('./helpers/bands-fight.mjs');
  const { cardChoicePlan, dispatch, previewCard } = await import('../src/engine/combat.js');
  const { serializeCombatSnapshot } = await import('../src/engine/combatSnapshot.js');
  const combat = bandsFight({ hand: ['dodgeRoll'], stamina: 5 });
  dispatch(combat, { type: 'playCard', cardInstanceId: 'qa0', choice: 'retreat' });
  const discarded = combat.piles.discard.findIndex(card => card.instanceId === 'qa0');
  assert.ok(discarded >= 0);
  combat.piles.hand.push(combat.piles.discard.splice(discarded, 1)[0]);
  combat.player.energy = combat.player.stamina = 1;
  const plan = cardChoicePlan(combat, 'qa0');
  assert.deepEqual(plan.options.map(option => [option.id, option.costs.stamina, option.affordable]), [['advance', 1, true], ['retreat', 2, false]]);
  const { document, restore } = installDom();
  try {
    const { openCardChoiceModal } = await import('../src/ui/components/cardChoiceModal.js');
    const beforeCancel = JSON.stringify(serializeCombatSnapshot(combat));
    const choose = choice => dispatch(combat, { type: 'playCard', cardInstanceId: 'qa0', choice });
    const first = openCardChoiceModal({ opener: null, plan, onChoose: choose });
    first.body.querySelector('[data-choice="advance"]').click();
    button(document, 'Cancel').click();
    assert.equal(JSON.stringify(serializeCombatSnapshot(combat)), beforeCancel, 'Cancel leaves pools, cards, statuses, counters and RNG intact');
    const second = openCardChoiceModal({ opener: null, plan, onChoose: choose });
    assert.equal(second.body.querySelector('[data-choice="retreat"]').disabled, true);
    assert.equal(second.body.querySelector('[data-choice="advance"]').textContent.includes('1 Stamina'), true);
    const shown = previewCard(combat, 'qa0', undefined, undefined, { choice: 'advance' });
    second.body.querySelector('[data-choice="advance"]').click();
    const before = combat.player.stamina;
    button(document, 'Choose').click();
    assert.equal(before - combat.player.stamina, shown.staminaCost);
    assert.equal(combat.player.stamina, 0);
    assert.equal(combat.piles.hand.some(card => card.instanceId === 'qa0'), false);
  } finally { restore(); }
});
