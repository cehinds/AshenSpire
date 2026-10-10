// Review threads on #1773/#1781: the enemy target picker must keep the unified
// focus cursor on the focused enemy, number formation cells, keep cards, combat
// tools and action buttons as hard obstacles, and pick its grid by appearance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const picker = readFileSync(new URL('../src/ui/components/enemyTargetPicker.js', import.meta.url), 'utf8');

test('keyboard target button focus syncs the unified focus cursor', () => {
  assert.match(picker, /addEventListener\('focus', \(\) => \{ if \(button\.matches\(':focus-visible'\)\) focusElement\(button\); \}\)/);
});

test('a pointer press on a target button does not move the unified cursor', () => {
  // Unguarded, the press moved the cursor onto the button; restore after the
  // play then selected the enemy and refit the stage under reduced motion.
  assert.doesNotMatch(picker, /addEventListener\('focus', \(\) => focusElement\(button\)\)/);
  // Any pointer press on a target clears the cursor, not only one on the
  // focused target: a cursor left on target A must not be restored onto A's
  // combatant after a click on target B.
  assert.match(picker, /addEventListener\('pointerdown', \(\) => clearFocus\(\)\);/);
  assert.doesNotMatch(picker, /if \(button\.classList\.contains\('gp-focus'\)\) clearFocus\(\)/);
});

test('target buttons carry data-number for the formation ::before label', () => {
  assert.match(picker, /button\.dataset\.number = String\(index \+ 1\)/);
});

test('hard obstacles include visible cards, combat tools and action buttons', () => {
  assert.match(picker, /'\.combat-tools, \.combat-action-row button, \.hand \.card'/);
});

test('grid is chosen by classicAppearance: Classic uses EnemyTargetGridModel', () => {
  assert.match(picker, /import \{ enemyTargetGrid as classicEnemyTargetGrid \} from '\.\.\/models\/EnemyTargetGridModel\.js'/);
  assert.match(picker, /import \{ alternativeEnemyTargetGrid \} from '\.\.\/models\/AlternativeEnemyTargetGridModel\.js'/);
  assert.match(picker, /const enemyTargetGrid = classicAppearance\(\) \? classicEnemyTargetGrid : alternativeEnemyTargetGrid;/);
});
