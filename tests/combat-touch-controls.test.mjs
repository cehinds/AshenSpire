import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const css = read('../styles/combat-layers.css');
const battlefield = read('../src/ui/components/battlefieldStage.js');
const hand = read('../src/ui/components/hand.js');
const tools = read('../src/ui/components/combatTools.js');
const combat = read('../src/ui/screens/combat.js');
const coop = read('../src/ui/screens/coop.js');

test('formation controls retain 44px physical touch targets and active paging', () => {
  assert.match(css, /\.combat-tools > button\s*\{[^}]*min-height:\s*calc\(44px \/ var\(--ui-zoom,1\)\);[^}]*height:\s*calc\(44px \/ var\(--ui-zoom,1\)\)/s);
  assert.match(css, /--inspect-box:\s*calc\(44px \/ var\(--ui-zoom,1\)\)/);
  assert.match(css, /\.combat-health-row\s*\{[^}]*min-height:\s*calc\(44px \/ var\(--ui-zoom,1\)\)/s);
  assert.match(css, /\.hand-overlay > :is\(\.hand-prev,\.hand-next,\.hand-info-portal\)\s*\{\s*pointer-events:\s*auto;/);
});

test('expanded combat panels and selected details stay in the correct layer', () => {
  assert.match(css, /\.combat-tools:has\(\.combat-log-panel:not\(\[hidden\]\)\)\s*\{[^}]*z-index:\s*calc\(var\(--combat-layer-hud\) \+ 1\)/s);
  assert.match(css, /\.player:not\(\.context-selected\):not\(\.selected-target\)[^{]*\.statuses\s*\{\s*display:\s*none !important;/s);
});

test('compact geometry reserves the measured controls and overhead gaps', () => {
  assert.match(battlefield, /setProperty\('--overhead-top', `\$\{-overheadGap \/ zoom\}px`\)/);
  assert.match(hand, /const toolsHeight = 48 \/ zoom;/);
  assert.match(hand, /setProperty\('--hand-rest-top', \(toolsHeight \+ plan\.restTop\) \+ 'px'\)/);
  assert.match(hand, /setProperty\('--hand-clearance-top', \(toolsHeight \+ plan\.clearanceTop\) \+ 'px'\)/);
  assert.match(tools, /top: handBox\?\.top \|\| 0/);
  assert.doesNotMatch(tools, /top: \(handBox\?\.top \|\| 0\) \+ 30/);
  assert.match(battlefield, /\.player \.combatant-leading, \.player \.combatant-info/);
  assert.match(battlefield, /playerControl = node\.matches\('\.player \.combatant-leading, \.player \.combatant-info'\)/);
});

test('unarmed intent taps preserve the selection-first tooltip path', () => {
  assert.match(combat, /selectCombatant\(enemy\.id\);[\s\S]*?return false;/);
  assert.match(coop, /selectCombatant\(e\.id\);\s*\/\/ Leave unarmed taps[\s\S]*?return false;/);
  assert.doesNotMatch(coop, /selectCombatant\(e\.id\); render\(\);\s*\/\/ Leave unarmed taps/);
});
