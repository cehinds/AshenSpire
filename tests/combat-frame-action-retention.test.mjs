import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { combatantFrame, updateCombatantFrame } from '../src/ui/components/combatantFrame.js';
import { playerActionIntent, RESTING_PLAYER_ACTION } from '../src/ui/components/combatantOverhead.js';
import { withKitDom } from './helpers/kit-dom.mjs';

const source = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
const start = source.indexOf('  function syncPlayerActionIntent('), end = source.indexOf('  function armSelf(', start);

for (const racked of [false, true]) test(`player action survives actual frame update (${racked ? 'overhead rack' : 'leading host'})`, () => withKitDom(({ document, Event }) => {
  document.documentElement ||= document.createElement('html');
  const node = className => { const el = document.createElement('div'); el.className = className; return el; };
  const oldMeters = node('meters'), player = combatantFrame({ role: 'player', entityId: 'player', sprite: node('art'), name: node('nm'), meters: oldMeters });
  document.body.appendChild(player);
  const combatEl = node('combat'), events = [], calls = [];
  combatEl.addEventListener('combatantselectionchange', e => events.push(e.detail));
  const context = { combat: {}, upcastRanksByCard: new Map(), RESTING_PLAYER_ACTION, playerActionIntent,
    resolveCombatCard: (_combat, inst) => inst, kindForCard: def => def.profile,
    selfArm: null, selectCombatant: id => calls.push(['select', id]), playCard: (...args) => calls.push(['play', ...args]),
    combatEl, CustomEvent: class extends Event { constructor(type, options) { super(type); this.detail = options.detail; } } };
  const sync = runInNewContext(source.slice(start, end) + '\nsyncPlayerActionIntent', context);
  sync(player, null, { maneuver: 'defend', camp: 'physical' });
  const action = player.querySelector('.player-action-intent');
  assert.ok(action); action.focus();
  let oldRack;
  if (racked) {
    oldRack = node('target-hud-overhead-meters'); oldRack.append(action, oldMeters); player.append(oldRack);
  }
  events.length = 0;
  const nextMeters = node('meters');
  updateCombatantFrame(player, { leading: [node('combatant-info')], name: node('nm'), meters: nextMeters });
  sync(player, null, { maneuver: 'defend', camp: 'spell', range: 'ranged' });
  assert.equal(player.querySelector('.player-action-intent'), action, 'maneuver alone controls the rendered glyph and label');
  assert.equal(player.querySelectorAll('.player-action-intent').length, 1);
  assert.equal(document.activeElement, action);
  assert.equal(events.length, 0, 'same action does not request redundant overhead geometry');
  assert.equal(player.querySelector('.meters'), nextMeters, 'only the action survives, never stale meters/rack');
  assert.equal(oldMeters.parentNode === oldRack && oldRack?.parentNode === player, false);
  context.selfArm = 'newly-selected-card';
  action.dispatchEvent(new Event('click'));
  assert.deepEqual(calls.at(-1), ['play', 'newly-selected-card', null], 'retained callback reads current selection');
  context.selfArm = null; action.dispatchEvent(new Event('click'));
  assert.deepEqual(calls.at(-1), ['select', 'player']);
  sync(player, { profile: { maneuver: 'attack' } });
  const replacement = player.querySelector('.player-action-intent');
  assert.notEqual(replacement, action); assert.equal(replacement.getAttribute('aria-label'), 'Selected action: attack');
  assert.equal(player.querySelectorAll('.player-action-intent').length, 1);
  assert.equal(events.length, 1, 'a changed action still requests fresh geometry');
}));
