import test from 'node:test';
import assert from 'node:assert/strict';
import { withModalDom } from './helpers/dom.mjs';
import { openCardInspection, bindCardInspection, openBoundCardInspection } from '../src/ui/components/cardInspection.js';
import { resetModalState } from '../src/ui/modalState.js';

function withInspection(fn) {
  return withModalDom(({ document }) => {
    resetModalState();
    document.getSelection = () => null;
    document.documentElement = document.createElement('html');
    const opener = document.createElement('button'); document.body.append(opener);
    return fn({ document, open: options => openCardInspection({ title: 'Test card',
      card: document.createElement('article'), details: document.createElement('div'), opener, ...options }) });
  });
}

test('Back exits an actionable or read-only inspection without issuing a command', () => withInspection(({ document, open }) => {
  let plays = 0;
  for (const actions of [[], [{ id: 'play', verb: 'Play card', enabled: true }]]) {
    const shell = open({ actions, commands: { play: () => { plays++; } } });
    const back = shell.panel.querySelector('.card-inspection-back');
    assert.equal(back.textContent, 'Back');
    back.click();
    assert.equal(document.querySelector('.card-inspection-modal'), null);
  }
  assert.equal(plays, 0);
}));

test('Play closes inspection before dispatch and commits once', () => withInspection(({ document, open }) => {
  let plays = 0;
  const shell = open({ actions: [{ id: 'play', verb: 'Play card', enabled: true }], commands: { play: () => {
    assert.equal(document.querySelector('.card-inspection-modal'), null);
    plays++;
  } } });
  const play = shell.panel.querySelector('[data-act="play"]');
  play.click(); play.dispatchEvent(new Event('click'));
  assert.equal(plays, 1);
}));

test('an action rechecks live availability before dispatch', () => withInspection(({ open }) => {
  let enabled = true, plays = 0;
  const shell = open({ actions: () => [{ id: 'play', verb: 'Play card', enabled, reason: enabled ? '' : 'Not enough SP.' }],
    commands: { play: () => { plays++; } } });
  enabled = false;
  const play = shell.panel.querySelector('[data-act="play"]'); play.click();
  assert.equal(play.disabled, true);
  assert.equal(play.title, 'Not enough SP.');
  assert.equal(plays, 0);
  shell.panel.querySelector('.card-inspection-back').click();
}));

test('detached source inspection requires explicit opt-in and forwards host actions', () => withInspection(({ document }) => {
  const card = document.createElement('article');
  const overrides = { actions: [], commands: {} };
  let received;
  bindCardInspection(card, { title: 'Shop card', open: (opener, options) => { received = { opener, options }; return true; } });
  assert.equal(openBoundCardInspection(card), false);
  const opener = document.createElement('button'); document.body.append(opener);
  assert.equal(openBoundCardInspection(card, opener, { allowDetached: true, ...overrides }), true);
  assert.deepEqual(received, { opener, options: overrides });
}));
