import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const combat = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
assert.doesNotMatch(combat, /function combatantInspectControl/);
assert.match(combat, /label: 'Inspect', attrs: \{ 'aria-label': `Inspect/);
assert.match(combat, /openCombatantDoor\(combatantSubject\(role, entity\), box\)/);
assert.match(combat, /action: inspect/);
assert.match(combat, /scheduleTooltipClose\(box\)/);
console.log('PASS 5/5; combat inspection belongs to the interactive tooltip, with no sprite icon');
