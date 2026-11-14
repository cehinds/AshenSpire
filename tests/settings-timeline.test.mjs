// Settings > Combat: the Action timeline and Reaction timeline editors, and their persistence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { settingsRows, settingsRowHtml } from '../src/ui/screens/settings.js';
import { timelineEditorHtml, bindTimelineEditor } from '../src/ui/screens/settingsTimeline.js';
import { profileKeys } from '../src/model/settingsSync.js';
import { defaultTimeline, resolveTimelineSetting } from '../src/model/combatTimelinePolicy.js';
import { setCombatPacing, actionPacing, setAnimSpeed } from '../src/ui/animationPace.js';
import { withKitDom } from './helpers/dom.mjs';

const row = settingsRows().find(r => r.key === 'combatTimeline');

test('the timeline row sits in Combat, persists with the profile and defaults to the shipped timeline', () => {
  assert.equal(row.cat, 'Combat');
  assert.equal(row.type, 'timeline');
  assert.deepEqual(row.def, { shared: defaultTimeline(), reaction: null });
  assert.ok(profileKeys(settingsRows()).includes('combatTimeline'));
  assert.match(row.label, /Action timeline/);
});
test('a saved timeline reaches the pacing; an old save without the key uses the defaults', () => {
  setAnimSpeed('normal');
  setCombatPacing({});
  assert.deepEqual(actionPacing().timeline, defaultTimeline());
  const saved = defaultTimeline().map(entry => entry.id === 'end' ? { ...entry, offsetMs: 250 } : entry);
  setCombatPacing({ combatTimeline: { shared: saved, reaction: null } });
  assert.equal(actionPacing().timeline.find(entry => entry.id === 'end').offsetMs, 250);
  assert.equal(actionPacing({ reaction: true }).timeline.find(entry => entry.id === 'end').offsetMs, 250, 'no override: the shared timeline');
  setCombatPacing({ combatTimeline: { shared: saved, reaction: defaultTimeline() } });
  assert.equal(actionPacing({ reaction: true }).timeline.find(entry => entry.id === 'end').offsetMs, 100);
  setCombatPacing();
});
test('the row draws a section per timeline, one row per event, and the reaction section only when enabled', () => {
  const off = timelineEditorHtml({});
  assert.equal((off.match(/data-tl-id="[a-zA-Z]+" title/g) || []).length, 11);
  assert.ok(!off.includes('data-tl-list="reaction"'));
  assert.ok(!/data-tl-separate checked/.test(off), 'off by default');
  const on = timelineEditorHtml({ combatTimeline: { shared: defaultTimeline(), reaction: defaultTimeline() } });
  assert.ok(on.includes('data-tl-list="reaction"'));
  assert.equal((on.match(/data-tl-id="[a-zA-Z]+" title/g) || []).length, 22);
  assert.match(off, /After previous/);
  assert.match(off, /Same time as Card played/);
  assert.ok(settingsRowHtml({}, row).includes('data-timeline'));
});
test('the controls reorder, retime, offset, reset and toggle the reaction timeline', () => {
  withKitDom(dom => {
    const settings = {};
    const applied = [];
    const container = dom.document.createElement('div');
    const render = () => { container.innerHTML = timelineEditorHtml(settings); bindTimelineEditor(container, { settings, apply: value => { applied.push(value); settings.combatTimeline = value; render(); } }); };
    render();
    const click = selector => container.querySelector(selector).dispatchEvent(new dom.Event('click', { bubbles: true }));
    click('[data-tl-move="1"][data-tl-section="shared"][data-tl-id="cost"]');
    assert.deepEqual(applied.at(-1).shared.map(entry => entry.id).slice(0, 3), ['cardPlayed', 'actionWord', 'cost'], 'the cost moved later');
    const select = container.querySelector('select[data-tl-id="swing"]');
    select.value = 'actionWord'; select.dispatchEvent(new dom.Event('change', { bubbles: true }));
    assert.equal(applied.at(-1).shared.find(entry => entry.id === 'swing').with, 'actionWord');
    const offset = container.querySelector('input[data-tl-offset][data-tl-id="end"]');
    offset.value = '300'; offset.dispatchEvent(new dom.Event('change', { bubbles: true }));
    assert.equal(applied.at(-1).shared.find(entry => entry.id === 'end').offsetMs, 300);
    const toggle = container.querySelector('[data-tl-separate]');
    toggle.checked = true; toggle.dispatchEvent(new dom.Event('change', { bubbles: true }));
    assert.deepEqual(applied.at(-1).reaction, applied.at(-1).shared, 'the override starts as a copy of the shared timeline');
    click('[data-tl-reset="shared"]');
    assert.deepEqual(applied.at(-1).shared, defaultTimeline());
    const off = container.querySelector('[data-tl-separate]');
    off.checked = false; off.dispatchEvent(new dom.Event('change', { bubbles: true }));
    assert.equal(applied.at(-1).reaction, null);
    assert.deepEqual(resolveTimelineSetting(settings.combatTimeline).reaction, null);
  });
});
