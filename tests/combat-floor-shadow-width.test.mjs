import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Owner (2026-10-11): each combatant's floor shadow is as wide as its health bar.
const stage = readFileSync(new URL('../src/ui/components/battlefieldStage.js', import.meta.url), 'utf8');
const kit = readFileSync(new URL('../styles/kit.css', import.meta.url), 'utf8');
const combat = readFileSync(new URL('../styles/combat.css', import.meta.url), 'utf8');

function fakeFrame({ spriteWidth, barWidth, selected = false, dataset = {} }) {
  const sprite = { style: { props: {}, setProperty(k, v) { this.props[k] = v; }, getPropertyValue(k) { return this.props[k] ?? ''; } },
    getBoundingClientRect: () => ({ width: spriteWidth }) };
  const bar = { getBoundingClientRect: () => ({ width: barWidth }) };
  return { sprite, bar, dataset, classList: { contains: name => name === 'context-selected' && selected },
    querySelector: sel => (sel === '.sprite' ? sprite : sel === '.combat-health-meter' ? bar : null) };
}

test('a floor shadow spans its health bar as a share of the figure, at rest and when selected', () => {
  const start = stage.indexOf('  function syncFloorShadows() {'), end = stage.indexOf('  // Every living enemy', start);
  assert.ok(start > 0 && end > start, 'syncFloorShadows is declared in the stage refit');
  const player = fakeFrame({ spriteWidth: 99, barWidth: 112 });
  const enemy = fakeFrame({ spriteWidth: 64.6, barWidth: 88 });
  const field = { querySelectorAll: () => [player, enemy] };
  const sync = runInNewContext(`${stage.slice(start, end)}\nsyncFloorShadows`, { field });
  sync();
  assert.equal(player.sprite.style.getPropertyValue('--floor-shadow-width'), '113.13%');
  assert.equal(enemy.sprite.style.getPropertyValue('--floor-shadow-width'), '136.22%');
  // A selected player's bar widens into the reading panel; its resting width holds.
  const selected = fakeFrame({ spriteWidth: 104, barWidth: 174, selected: true, dataset: { healthBarWidth: '112' } });
  runInNewContext(`${stage.slice(start, end)}\nsyncFloorShadows`, { field: { querySelectorAll: () => [selected] } })();
  assert.equal(selected.sprite.style.getPropertyValue('--floor-shadow-width'), '107.69%');
  assert.equal(selected.dataset.healthBarWidth, '112', 'the resting width is not overwritten by the selected bar');
});

test('the refit runs the floor shadow sync and both ground-shadow rules read its width', () => {
  assert.match(stage, /\n    placeEnemyInspect\(\);\n    syncFloorShadows\(\);\n/);
  assert.match(kit, /\.combat\[data-layout='formation'\] \.combatant \.sprite::before \{\s*content: ''; position: absolute; left: 50%; bottom: 0;\s*width: var\(--floor-shadow-width, 70%\);/);
  assert.match(combat, /\.combat \.combatant \.sprite::before \{[^}]*width: var\(--floor-shadow-width, 76%\)/);
});
