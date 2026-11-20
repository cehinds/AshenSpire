// Owner, 2026-11-14: "enemy buffs and status effects need to be shown. Half the time I don't see them."
// A status an enemy gives itself and one the player applies both reach the enemy's displayed statuses on the beat that caused them,
// and an enemy's status tray keeps every icon in the row (no +N tile) so each shows without selecting the enemy.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ApplyCombatBeat } from '../src/ui/models/CombatPlaybackModel.js';
import { fitBadgeRowTray, setIconTrayOverflow } from '../src/ui/components/iconTray.js';
import { withKitDom } from './helpers/dom.mjs';

test('statuses applied to an enemy by its own move and by the player both reach the displayed enemy on their beats', () => {
  const combat = { eventLog: [], enemies: [], getEntity: null };
  const enemy = { statuses: {}, kind: 'enemy', alive: true };
  const disp = { ents: { e1: enemy, player: { statuses: {}, kind: 'player' } }, hand: [], handPreviews: new Map(), logLength: 0 };
  const tools = { combat: { ...combat, player: { id: 'player' }, enemies: [{ id: 'e1' }], eventLog: [], piles: {} }, registries: { enemies: new Map() },
    projectCombatIntent: () => null, findInst: () => null, playbackEvents: null, reduceFollowRows() {} };
  const own = { type: 'statusApplied', sourceId: 'e1', targetId: 'e1', status: 'strength', stacks: 2, previousTotal: 0, total: 2 };
  const byPlayer = { type: 'statusApplied', sourceId: 'player', targetId: 'e1', status: 'silenced', stacks: 1, previousTotal: 0, total: 1 };
  ApplyCombatBeat(disp, [own], tools);
  assert.equal(enemy.statuses.strength?.stacks, 2, 'the enemy\'s own buff is on its display');
  ApplyCombatBeat(disp, [byPlayer], tools);
  assert.equal(enemy.statuses.silenced?.stacks, 1, 'a status the player applied is on the enemy\'s display');
  assert.deepEqual(Object.keys(enemy.statuses).sort(), ['silenced', 'strength']);
});

function tray(document, side, count) {
  const frame = document.createElement('div'); frame.className = `combatant ${side}`;
  const row = document.createElement('div'); row.className = 'combat-health-badges';
  const statuses = document.createElement('div'); statuses.className = 'statuses';
  for (let i = 0; i < count; i++) { const icon = document.createElement('span'); icon.className = 'status-icon'; statuses.append(icon); }
  row.append(statuses); frame.append(row); document.body.append(frame);
  setIconTrayOverflow(statuses, () => {});
  return { statuses, row };
}

test('an enemy\'s tray keeps all of its icons however narrow the row; the player\'s keeps the +N fold', () => withKitDom(({ document }) => {
  const sizes = { getBoundingClientRect: () => ({ width: 40, height: 18, x: 0, y: 0 }) };
  const original = globalThis.getComputedStyle;
  globalThis.getComputedStyle = () => ({ minHeight: '18px' });
  try {
  for (const [side, folded] of [['enemy', false], ['player', true]]) {
    const { statuses, row } = tray(document, side, 6);
    Object.assign(row, sizes); Object.assign(statuses, sizes);
    fitBadgeRowTray(statuses);
    assert.equal(statuses.querySelectorAll('.status-icon').length === 6, !folded, `${side}: ${statuses.children.length} children`);
    assert.equal(!!statuses.querySelector('.status-overflow'), folded, `${side}: +N tile`);
  }
  } finally { if (original) globalThis.getComputedStyle = original; else delete globalThis.getComputedStyle; }
}));

test('the enemy tray wraps under the badges in the stylesheet', () => {
  const css = readFileSync(new URL('../styles/combat-mini-hud.css', import.meta.url), 'utf8');
  assert.match(css, /\.combatant:not\(\.player\) > \.target-hud-overhead-meters \.combat-health-badges > \.statuses \{\s*flex: 1 1 100%; flex-wrap: wrap;/);
});
