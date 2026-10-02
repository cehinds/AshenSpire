// tests/disabled-reason.test.mjs — "A disabled Next button shows its reason as
// visible text" (docs/FINISH.md §6), the node half.
//
// The browser half is tools/disabled-reason.mjs: it mounts a representative
// set of refusing Next / Continue / Confirm controls (ten screens; the atlas,
// the Smith, mount service and the reward menu's level hold are pinned here or
// by review, not there) in a real Chromium and measures the reason line
// (laid out, not display:none, not visibility:hidden, at least 11 px). This
// file pins the parts a fake DOM can: the one writer of the line
// (refusal.js reasonNote / reasonWhenDisabled / refusesWhen), the title menu's
// disabled entry, the event screen's Continue, the reward menu's level hold,
// a hidden row taking its line with it, and the stylesheet floor.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { withKitDom } from './helpers/kit-dom.mjs';

const REG = createRegistries(contentBundle);
const noteOf = (control) => {
  const ids = (control.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
  const named = ids.map((id) => document.getElementById(id)).filter(Boolean);
  return named.find((n) => n.classList?.contains('as-reasonnote')) || named[0] || null;
};
const shows = (note) => !!note && !note.hidden && note.isConnected && note.textContent.trim().length > 0;

test('reasonWhenDisabled: a disabled control in a button row gets its reason as text under the row', async () => {
  const { reasonWhenDisabled } = await import('../src/ui/components/refusal.js');
  const { button, buttonRow } = await import('../src/ui/kit/index.js');
  withKitDom((dom) => {
    const next = button({ label: 'Next', weight: 'primary', disabled: true });
    const row = buttonRow({ buttons: [button({ label: 'Back' }), next] });
    const host = dom.document.createElement('footer');
    host.append(row);
    dom.document.body.replaceChildren(host);
    const refresh = reasonWhenDisabled(next, () => 'Choose a class first.');
    refresh();
    const note = noteOf(next);
    assert.ok(note, 'the control names its note in aria-describedby');
    assert.equal(note.parentNode, host, 'the note sits under the row, not inside it');
    assert.ok(note.classList.contains('as-reasonnote') && note.classList.contains('as-fieldnote'), 'it wears the kit FieldNote');
    assert.ok(shows(note));
    assert.equal(note.textContent, 'Choose a class first.');
    next.disabled = false; refresh();
    assert.equal(note.hidden, true, 'usable again: the line is gone');
    next.setAttribute('aria-disabled', 'true'); refresh();
    assert.ok(shows(note), 'aria-disabled refuses too');
  });
});

test('refusesWhen: the tooltip reason is also visible text, and follows the control', async () => {
  const { refusesWhen } = await import('../src/ui/components/refusal.js');
  const { button } = await import('../src/ui/kit/index.js');
  withKitDom((dom) => {
    let problem = 'Choose a keepsake.';
    const start = button({ label: 'Begin', weight: 'primary' });
    dom.document.body.replaceChildren(start);
    const refresh = refusesWhen(start, () => problem, 'Begin.');
    const note = noteOf(start);
    assert.ok(shows(note), 'a refusing control shows its reason');
    assert.equal(note.textContent, 'Choose a keepsake.');
    start.hidden = true; refresh();
    assert.equal(note.hidden, true, 'a hidden control shows no reason');
    start.hidden = false; problem = null; refresh();
    assert.equal(note.hidden, true, 'a usable control shows no reason');
  });
});

test('titleMenu: a disabled entry with a reason wears it as text', async () => {
  const { titleMenu } = await import('../src/ui/kit/index.js');
  withKitDom((dom) => {
    const menu = titleMenu({ name: 'X', entries: [{ label: 'Continue', disabled: true, reason: 'No saved climb yet.' }, { label: 'New' }] });
    dom.document.body.replaceChildren(menu);
    const entry = menu.querySelector('.tm-entry');
    assert.equal(entry.disabled, true);
    assert.ok(shows(noteOf(entry)));
    assert.equal(noteOf(entry).textContent, 'No saved climb yet.');
  });
});

test('event screen: Continue before a response is taken says why, as text', async () => {
  const { mountEvent } = await import('../src/ui/screens/event.js');
  withKitDom((dom) => {
    const app = dom.document.createElement('main');
    dom.document.body.replaceChildren(app);
    const run = createRunState({ seed: 7, classId: 'reaver', registries: REG });
    mountEvent(app, { registries: REG, run, meta: { settings: {} }, rng: createRng(3), eventId: 'abandonedCart', onDone() {} });
    const cont = app.querySelector('#event-continue');
    assert.equal(cont.disabled, true);
    const note = noteOf(cont);
    assert.ok(shows(note), 'the reason is shown');
    assert.match(note.textContent, /response/i);
  });
});

test('stylesheet: the reason line is never display:none when shown, and is at least 11 px', () => {
  const css = readFileSync(new URL('../styles/kit.css', import.meta.url), 'utf8');
  const rule = css.match(/\.as-reasonnote\s*\{([^}]*)\}/);
  assert.ok(rule, '.as-reasonnote has a rule');
  assert.match(rule[1], /display:\s*block/);
  assert.doesNotMatch(rule[1], /visibility:\s*hidden|opacity:\s*0\b/);
  const floor = rule[1].match(/font-size:\s*max\(\s*(\d+(?:\.\d+)?)px/);
  assert.ok(floor && Number(floor[1]) >= 11, 'its font-size has an 11 px floor');
  assert.match(css, /\.as-reasonnote\[hidden\]\s*\{\s*display:\s*none;?\s*\}/, 'only [hidden] takes it away');
});

test('a hidden button row takes its reason line with it (review of #1459: character creation)', async () => {
  const { refusesWhen } = await import('../src/ui/components/refusal.js');
  const { button, buttonRow } = await import('../src/ui/kit/index.js');
  withKitDom((dom) => {
    const next = button({ label: 'Continue', weight: 'primary' });
    const row = buttonRow({ className: 'cc-primary-continue-row', buttons: [next] });
    const host = dom.document.createElement('section');
    host.append(row);
    dom.document.body.replaceChildren(host);
    // customize.js's showNode: the row is stashed, the button itself is not.
    row.hidden = true; row.style.display = 'none';
    const refresh = refusesWhen(next, () => 'Choose how to assign your stats.', 'On.');
    const note = noteOf(next);
    assert.equal(note.parentNode, host, 'the line sits after the row, outside it');
    assert.equal(note.hidden, true, 'a stashed row shows no orphaned reason');
    row.hidden = false; row.style.display = ''; refresh();
    assert.ok(shows(note), 'the row is back: so is its reason');
  });
  const css = readFileSync(new URL('../styles/kit.css', import.meta.url), 'utf8');
  assert.match(css, /\[hidden\]\s*\+\s*\.as-reasonnote/, 'a row hidden after the paint still takes the line (adjacent-sibling rule)');
});

test('reward menu: Continue held for an unclaimed level says why, as text (review of #1459)', async () => {
  const { mountRewards } = await import('../src/ui/screens/reward.js');
  const { xpToNext } = await import('../src/model/levelup.js');
  withKitDom((dom) => {
    const app = dom.document.createElement('main');
    dom.document.body.replaceChildren(app);
    const run = createRunState({ seed: 7, classId: 'reaver', registries: REG });
    run.level = { ...(run.level || {}), level: 3, xp: xpToNext(REG, 3) + 5, unspentPoints: 0 };
    mountRewards(app, {
      registries: REG, run, onDone() {},
      rewards: { xpGains: { level: 30, tracks: {} }, levelCards: [{ ordinal: 0, cardIds: ['rend', 'stomp'] }] },
      saves: { loadMeta: () => ({ settings: { levelUpRefillSeconds: 0 } }) },
    });
    const cont = app.querySelector('#reward-continue');
    assert.equal(cont.disabled, true, 'a waiting level holds Continue');
    const note = noteOf(cont);
    assert.ok(shows(note), 'the hold is explained on screen, not only in the title');
    assert.match(note.textContent, /claim your levels/i);
  });
});
