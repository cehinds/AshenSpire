import test from 'node:test';
import assert from 'node:assert/strict';
import { rewardDom } from './helpers/dom.mjs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { mountGameProfileOffers } from '../src/ui/components/gameProfileOffers.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';

const core = resolveGameProfile('core');
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, core)), core);

// Owner 2026-11-05: selecting a card must not reload the modal.
test('selecting a reward card keeps the door and card nodes and updates selection and buttons in place', () => {
  const dom = rewardDom();
  const before = Object.fromEntries(Object.keys(dom).map(key => [key, globalThis[key]]));
  Object.assign(globalThis, dom);
  try {
    const app = document.createElement('main'); document.body.append(app);
    const offer = { id: 'in-place', options: [{ kind: 'combatCards', id: 'core.strike' }, { kind: 'combatCards', id: 'core.defend' }], taken: [], claimed: null, takeCount: 1 };
    mountGameProfileOffers(app, { registries, run: { class: 'reaver', deck: [] }, offer, title: 'Reward',
      onTake() {}, onContinue() {}, onAddToDeck() {}, onEditDeck() {}, canEditDeck: true });
    const door = app.querySelector('.reward-door');
    const strip = app.querySelector('.reward-row');
    const body = door.children.find(node => node.classList.contains('reward-body'));
    const columns = [...strip.children];
    const picks = [...app.querySelectorAll('.reward-pick')];
    const faces = [...app.querySelectorAll('.reward-choice-face')];
    const confirm = app.querySelector('#reward-card-confirm');
    assert.ok(confirm.disabled);

    picks[0].click();
    assert.equal(app.querySelector('.reward-door'), door, 'same modal node');
    assert.equal(app.querySelector('.reward-row'), strip);
    assert.equal(door.children.find(node => node.classList.contains('reward-body')), body, 'body is not rebuilt');
    assert.deepEqual([...strip.children], columns, 'same option columns');
    assert.deepEqual([...app.querySelectorAll('.reward-pick')], picks, 'same card buttons');
    assert.deepEqual([...app.querySelectorAll('.reward-choice-face')], faces, 'same card faces');
    assert.equal(picks[0].getAttribute('aria-checked'), 'true');
    assert.equal(picks[1].getAttribute('aria-checked'), 'false');
    assert.ok(picks[0].classList.contains('is-chosen') && faces[0].classList.contains('is-chosen'));
    assert.equal(confirm.disabled, false);
    assert.equal(confirm.textContent, 'Add to deck', 'action button relabelled');
    assert.equal(app.querySelector('#reward-keep').hidden, false);
    assert.ok(app.querySelector('#reward-keep').isConnected && app.querySelector('#reward-edit-deck').isConnected, 'new buttons are in the footer');

    picks[1].click();
    assert.equal(app.querySelector('.reward-door'), door);
    assert.deepEqual([...app.querySelectorAll('.reward-pick')], picks);
    assert.equal(picks[0].getAttribute('aria-checked'), 'false');
    assert.equal(picks[1].getAttribute('aria-checked'), 'true');
    assert.ok(!picks[0].classList.contains('is-chosen') && picks[1].classList.contains('is-chosen'));
    app.remove();
  } finally {
    for (const [key, value] of Object.entries(before)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
});
