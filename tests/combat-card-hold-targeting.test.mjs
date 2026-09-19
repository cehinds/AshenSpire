// A combat-card hold is another entrance to the existing play interaction.
// Targeted cards arm and wait for the target; untargeted cards may commit at
// the end of the hold. Tap, double-tap and drag keep their existing routes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
const strip = (text) => text.split('\n')
  .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line)).join('\n');
const combat = strip(source);
let checks = 0;
const ok = (condition, message) => { checks++; assert.ok(condition, message); };

const wire = combat.match(/function wireCardInput\(el, inst, pv, affordable\) \{([\s\S]*?)\n  \}\n\n  combatEl\.addEventListener\('click'/);
ok(!!wire, 'combat still owns one readable card-input function');

const hold = wire?.[1].match(/return armHold\(el, \{([\s\S]*?)\n    \}\);/);
ok(!!hold, 'combat cards still route holds through the shared hold control');
ok(/tapOnPointerRelease:\s*true/.test(hold?.[1] || ''),
  'combat selection completes on pointer release even if card repaint suppresses click');
ok(!/settleMs\s*:/.test(hold?.[1] || ''),
  'combat-card progress starts immediately instead of waiting through an invisible drag settle');
ok(/onHoldStart:\s*\(\)\s*=>\s*\{\s*el\.dispatchEvent\(new CustomEvent\('cardholdstart'\)\);\s*\}/.test(hold?.[1] || ''),
  'starting the visible hold preserves the shared card-selection signal without arming combat early');

const completion = hold?.[1].match(/onConfirm:\s*\(\)\s*=>\s*\{([\s\S]*)\n      \},?/)?.[1] || '';
ok(/if \(pv\.needsTarget\) \{\s*select\(\);\s*focusTargeting\(\);\s*return;\s*\}/.test(completion),
  'a completed hold on a single-target card arms the existing target-selection flow');
ok(!/dragTargetMode === 'all'/.test(completion),
  'a card that sweeps every enemy has no target to choose, so its completed hold plays it');
ok(/playCard\(inst\.instanceId, null\);/.test(completion),
  'a completed hold on an untargeted card retains direct play');
ok(!/confirm\(\)/.test(completion),
  'the completed hold does not reuse the old same-press confirm path');

ok(/const tap = \(\) => \{[\s\S]*?if \(selected !== inst\.instanceId && selfArm !== inst\.instanceId\) \{ select\(\); return; \}/.test(wire?.[1] || ''),
  'the existing tap-to-select route remains present');
ok(/const plan = dropPlan\(up, true\);\s*if \(plan\.legal\) playCard\(inst\.instanceId, plan\.targetId \|\| null\);/.test(wire?.[1] || ''),
  'the existing legal drag-to-play route remains present');
ok(/if \(selected\) playCard\(selected, enemy\.id\);/.test(combat),
  'choosing an enemy after the hold still commits through the existing selected-card route');

// A hold lights the card from pointer-down; a press that becomes a drag was
// never a selection, so the inspection layer puts that light out again and
// leaves a card lit before the press alone.
const inspection = strip(readFileSync(new URL('../src/ui/components/cardInspection.js', import.meta.url), 'utf8'));
ok(/card\.addEventListener\('cardholdstart', \(\) => \{ litByHold = litCard\(\) !== identity; select\(\); \}\);/.test(inspection),
  'the inspection layer remembers whether the hold, not an earlier tap, lit the card');
ok(/card\.addEventListener\('carddragstart', \(\) => \{ if \(litByHold && litCard\(\) === identity\) clearSelection\(\); litByHold = false; \}\);/.test(inspection),
  'a hold that becomes a drag douses the light it lent and no other');

console.log(`PASS ${checks}/${checks}; combat-card holds arm targeting without replacing tap or drag`);
