import test from 'node:test';
import assert from 'node:assert/strict';
import { combatantFrame, updateCombatantFrame, updateCombatantSlots } from '../src/ui/components/combatantFrame.js';
import { applyDisplayAppearance } from '../src/ui/displayAppearance.js';
import { withKitDom } from './helpers/kit-dom.mjs';

// Slot-level updates must leave the frame exactly as a fresh combatantFrame() would
// be for the same slots: same nodes, same order, same attributes.
const SLOT_NAMES = ['leading', 'name', 'meters', 'statuses', 'chips'];
const SUBSETS = [
  [], ['leading'], ['name'], ['meters'], ['statuses'], ['chips'],
  ['meters', 'statuses'], ['name', 'chips'], ['leading', 'statuses', 'chips'],
  ['name', 'meters'], ['leading', 'name', 'meters', 'statuses', 'chips'],
];

function kit(document) {
  const el = (tag, className, text = '') => { const n = document.createElement(tag); n.className = className; n.textContent = text; return n; };
  return (role, tag) => ({
    role,
    entityId: role === 'player' ? 'player' : 'e1',
    classNames: [`c-${tag}`, tag === 'b' ? 'armed' : ''],
    leading: [el('button', 'combatant-info', 'i'), ...(role === 'enemy' ? [el('button', 'intent', `intent-${tag}`)] : [])],
    sprite: el('div', 'art'),
    name: el('div', 'nm', `name-${tag}`),
    meters: el('div', 'meters', `meters-${tag}`),
    trailing: [el('div', 'stance-chip', `chip-a-${tag}`), el('div', 'statuses', `statuses-${tag}`), el('div', 'foundation-evade', `chip-b-${tag}`)],
  });
}
const slotsOf = (spec) => ({
  classNames: spec.classNames,
  leading: spec.leading,
  name: spec.name,
  meters: spec.meters,
  statuses: spec.trailing.filter(n => n.classList.contains('statuses')),
  chips: spec.trailing.filter(n => !n.classList.contains('statuses')),
});

for (const appearance of ['alternative', 'classic']) for (const role of ['player', 'enemy']) {
  test(`${appearance} ${role} frame: a slot update equals a fresh frame`, () => withKitDom(({ document }) => {
    document.documentElement ||= document.createElement('html');
    applyDisplayAppearance({ displayAppearance: appearance, appearance }, document.documentElement);
    for (const subset of SUBSETS) {
      const make = kit(document);
      const frame = combatantFrame(make(role, 'a'));
      document.body.appendChild(frame);
      const untouched = frame.querySelector('.sprite');
      const next = make(role, 'b');
      const all = slotsOf(next);
      const passed = { classNames: all.classNames };
      for (const slot of subset) passed[slot] = all[slot];
      assert.equal(updateCombatantSlots(frame, passed), true);
      // Expected: a fresh frame whose passed slots are the new ones and the rest the old.
      // Separate node instances: the expected frame must not steal the actual frame's nodes.
      const before = make(role, 'a'), again = make(role, 'b');
      const merged = { ...before, classNames: next.classNames };
      if (subset.includes('leading')) merged.leading = again.leading;
      if (subset.includes('name')) merged.name = again.name;
      if (subset.includes('meters')) merged.meters = again.meters;
      const old = slotsOf(before), fresh2 = slotsOf(again);
      const status = subset.includes('statuses') ? fresh2.statuses : old.statuses;
      const chips = subset.includes('chips') ? fresh2.chips : old.chips;
      merged.trailing = [...chips.slice(0, 1), ...status, ...chips.slice(1)];
      const fresh = combatantFrame(merged);
      assert.equal(frame.outerHTML, fresh.outerHTML, `${role} ${appearance} subset [${subset}]`);
      assert.equal(frame.querySelector('.sprite'), untouched, 'sprite host is never touched');
    }
  }));
}

test('a player slot update keeps the action glyph last in the leading host and leaves it in place', () => withKitDom(({ document }) => {
  document.documentElement ||= document.createElement('html');
  applyDisplayAppearance({ displayAppearance: 'alternative' }, document.documentElement);
  const make = kit(document);
  const frame = combatantFrame(make('player', 'a'));
  document.body.appendChild(frame);
  const action = document.createElement('button'); action.className = 'player-action-intent';
  frame.querySelector('.combatant-leading').appendChild(action);
  updateCombatantSlots(frame, { leading: slotsOf(make('player', 'b')).leading, meters: make('player', 'b').meters });
  const host = frame.querySelector('.combatant-leading');
  assert.equal(host.children.at(-1), action);
  assert.equal(host.querySelectorAll('.player-action-intent').length, 1);
  // The full update leaves the same arrangement.
  const full = combatantFrame(make('player', 'a')); document.body.appendChild(full);
  full.querySelector('.combatant-leading').appendChild(action.cloneNode(true));
  updateCombatantFrame(full, { ...make('player', 'b'), classNames: make('player', 'b').classNames });
  assert.equal(host.children.map(n => n.className).join('|').replace(/c-\w/g, ''),
    full.querySelector('.combatant-leading').children.map(n => n.className).join('|').replace(/c-\w/g, ''));
}));

test('node slots are refused (nothing touched) while the target-HUD rack holds the meters', () => withKitDom(({ document }) => {
  document.documentElement ||= document.createElement('html');
  const make = kit(document);
  const frame = combatantFrame(make('enemy', 'a'));
  const rack = document.createElement('div'); rack.className = 'target-hud-overhead-meters';
  frame.append(rack);
  const html = frame.outerHTML;
  assert.equal(updateCombatantSlots(frame, { meters: make('enemy', 'b').meters }), false);
  assert.equal(frame.outerHTML, html);
  assert.equal(updateCombatantSlots(frame, { classNames: ['dead'] }), true);
  assert.ok(frame.classList.contains('dead'));
}));
