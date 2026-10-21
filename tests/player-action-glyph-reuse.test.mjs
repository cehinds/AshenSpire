import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { rewardDom } from './helpers/reward-dom.mjs';

test('same-maneuver preview keeps the mounted glyph and its current-selection callback', () => {
  const source = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
  const start = source.indexOf('  function syncPlayerActionIntent('), end = source.indexOf('\n  function armSelf(', start);
  const dom = rewardDom(), board = dom.document.createElement('div');
  let changes = 0, made = 0;
  board.addEventListener('combatantselectionchange', event => { changes++; assert.equal(event.detail.geometry, 'overhead'); });
  const plays = [], inspections = [];
  const scope = { combat: {}, combatEl: board, CustomEvent: dom.CustomEvent,
    upcastRanksByCard: new Map(), resolveCombatCard: (_, inst) => inst, kindForCard: def => ({ maneuver: def.maneuver }),
    RESTING_PLAYER_ACTION: { maneuver: 'ready' }, selfArm: null,
    playCard: (...args) => plays.push(args), selectCombatant: id => inspections.push(id),
    playerActionIntent: (_, activate) => { made++; const n = dom.document.createElement('button'); n.className = 'player-action-intent'; n.addEventListener('click', activate); return n; },
  };
  const sync = runInNewContext(source.slice(start, end) + '\nsyncPlayerActionIntent', scope);
  const player = dom.document.createElement('div'), leading = dom.document.createElement('div');
  leading.className = 'combatant-leading'; player.append(leading);
  const attack = { instanceId: 'a', maneuver: 'attack' };
  sync(player, attack); const glyph = player.querySelector('.player-action-intent');
  const rack = dom.document.createElement('div'); rack.className = 'target-hud-overhead-meters'; player.append(rack); rack.append(glyph);
  rack.prepend = node => { rack.append(node); rack.children.unshift(rack.children.pop()); };
  sync(player, { ...attack, instanceId: 'b' });
  assert.equal(player.querySelector('.player-action-intent'), glyph, 'HUD-reparented glyph remains mounted');
  assert.equal(glyph.parentNode, rack); assert.equal(made, 1); assert.equal(changes, 1);
  scope.selfArm = 'current'; glyph.click(); assert.deepEqual(plays, [['current', null]]);
  scope.selfArm = null; glyph.click(); assert.deepEqual(inspections, ['player']);
  sync(player, { instanceId: 'c', maneuver: 'defend' });
  assert.notEqual(player.querySelector('.player-action-intent'), glyph); assert.equal(changes, 2);
  assert.equal(player.querySelector('.player-action-intent').parentNode, rack, 'a changed maneuver stays inside the detailed HUD rack');
  assert.equal(rack.firstElementChild, player.querySelector('.player-action-intent'));
  sync(player, null, { maneuver: 'defend' }); assert.equal(changes, 2, 'confirmed held glyph stays when disarmed');
  sync(player, null); assert.equal(changes, 3, 'neutral glyph replaces a different held action');
  player.querySelector('.player-action-intent').remove(); sync(player, null);
  assert.equal(changes, 4, 'rebuilt DOM restores the glyph even when maneuver is unchanged');
});

test('selection sync sends one final HUD update for self, enemy and cleared selections', () => {
  const source = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
  const functionText = (name, next) => source.slice(source.indexOf(`  function ${name}(`), source.indexOf(`\n  ${next}`, source.indexOf(`  function ${name}(`)));
  const nodes = { classList: { contains: () => false, toggle() {} }, querySelector: () => null,
    querySelectorAll: () => [], setAttribute() {} };
  let hud = 0, info = 0;
  const scope = { selected: null, selfArm: null, selectedCombatantId: null, busy: false, enemyPlayback: false,
    combat: {}, combatEl: nodes, $: () => nodes, renderHand() {}, selectCombatantInfo() { info++; },
    updateTargetHud() { hud++; }, getEntity: () => ({ alive: true }),
    decorateRoundsScreen() {}, findInst: () => ({}), resolveCombatCard: () => ({}), upcastRanksByCard: new Map(), cardKind: () => 'skill',
    syncPlayerPreview() {}, syncHitChances() {}, applyTargetLayer() { hud++; }, setHintMode() {}, hideTooltip() {}, refreshAim() {},
  };
  const selectSource = functionText('selectCombatant', '// A blank press');
  const syncSource = functionText('syncCardSelection', '// The figure\'s glyph');
  const api = runInNewContext(selectSource + syncSource + '\n({syncCardSelection, selectCombatant})', scope);
  for (const [selected, selfArm] of [['enemy-card', null], [null, 'self-card'], [null, null]]) {
    scope.selected = selected; scope.selfArm = selfArm; hud = 0;
    api.syncCardSelection(); assert.equal(hud, 1, 'the final target layer always updates once');
  }
  assert.equal(info, 2, 'both armed routes still clear reading selection');
  hud = 0; api.selectCombatant('player'); assert.equal(hud, 1, 'ordinary inspection retains its immediate HUD update');
});
