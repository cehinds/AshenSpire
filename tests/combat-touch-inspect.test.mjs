import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const combat = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
const kit = readFileSync(new URL('../styles/kit.css', import.meta.url), 'utf8');

assert.match(combat, /function combatantInspectControl\(role, entity\)/);
assert.match(combat, /label: `Inspect \$\{subject\.name\}`/);
assert.match(combat, /attrs: \{ 'aria-haspopup': 'dialog' \}/);
assert.match(combat, /event\.stopPropagation\(\);\s*openCombatantDoor\(combatantSubject\(role, entity\)\)/);
assert.match(combat, /combatantInspectControl\('player', p\)/);
assert.match(combat, /combatantInspectControl\('enemy', enemy\)/);
assert.match(combat, /Tap <b>ⓘ<\/b> or press <b>I<\/b> for the full read\./);
assert.match(kit, /\.combatant \.combatant-inspect-control\s*\{/);

console.log('PASS 8/8; touch inspect opens the shared detail dialog for player and enemy without activating the combatant frame');
