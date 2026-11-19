import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Combat wiring: a held or right-clicked combatant opens the inspector; a tap keeps selecting.
const src = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
const begin = src.indexOf('function wireCombatantContext(');
const end = src.indexOf('// The snapshot is the PACED state', begin);
const wiring = src.slice(begin, end);

test('every combatant box arms the shared long-press helper at the combat-inspection hold', () => {
  assert.ok(begin > 0 && end > begin);
  assert.match(wiring, /ArmLongPress\(box,/);
  assert.match(wiring, /holdMs: uiConfig\.presentation\.combatInspection\.behavior\.holdMs/);
  assert.match(wiring, /tolerancePx: uiConfig\.presentation\.combatInspection\.behavior\.movementTolerancePx/);
});

test('a fired hold opens the combatant door and swallows the click (no target or play action)', () => {
  const at = wiring.indexOf('onHold:');
  const onHold = wiring.slice(at, wiring.indexOf('});', at));
  assert.match(onHold, /inspectTarget\(\)/);
  assert.match(onHold, /return true;/);
  assert.match(wiring, /openCombatantDoor\(combatantSubject\(/);
});

test('right-click and the phone long-press menu read the fighter unless a card or flask is armed', () => {
  const ctx = wiring.slice(wiring.indexOf("'contextmenu'"));
  assert.match(ctx, /if \(selected \|\| selectedFlask != null \|\| selfArm\) return;/);
  assert.match(ctx, /event\.preventDefault\(\);\s*if \(!modalOpen\(\)\) inspectTarget\(\);/);
});
