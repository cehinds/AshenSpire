import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COMBAT_TOOLS_HEIGHT_PX } from '../src/ui/models/HandLayout.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const css = read('../styles/combat-layers.css');
const battlefield = read('../src/ui/components/battlefieldStage.js');
const hand = read('../src/ui/components/hand.js');
const tools = read('../src/ui/components/combatTools.js');
const combat = read('../src/ui/screens/combat.js');
const coop = read('../src/ui/screens/coop.js');

test('approved compact Inspect and HP shapes retain active paging', () => {
  const inspectSizes = [...css.matchAll(/[^{}]*\.combatant-leading > \.combatant-info\s*\{([^}]*)\}/g)]
    .flatMap(match => [...match[1].matchAll(/--inspect-box:\s*calc\((\d+)px \/ var\(--ui-zoom,\s*1\)\)/g)].map(size => Number(size[1])));
  assert(inspectSizes.length > 0, 'the Inspect size contract must be present');
  assert(inspectSizes.every(size => size === 22), 'player-specific overrides cannot enlarge the approved 22px Inspect control');
  assert.match(css, /\.combatant:not\(\.context-selected\) \.combat-health-row\s*\{[^}]*--health-row-h:\s*calc\(7px \/ var\(--ui-zoom,1\)\)/s);
  assert.match(css, /\.hand-overlay > :is\(\.hand-prev,\.hand-next,\.hand-info-portal\)\s*\{\s*pointer-events:\s*auto;/);
});

test('expanded combat panels and selected details stay in the correct layer', () => {
  assert.match(css, /\.combat-tools:has\(\.combat-log-panel:not\(\[hidden\]\)\)\s*\{[^}]*z-index:\s*calc\(var\(--combat-layer-hud\) \+ 1\)/s);
  assert.match(css, /\.player:not\(\.context-selected\):not\(\.selected-target\)[^{]*\.statuses\s*\{\s*display:\s*none !important;/s);
});

test('compact geometry reserves the measured controls and overhead gaps', () => {
  assert.match(battlefield, /setProperty\('--overhead-top', `\$\{-overheadGap \/ zoom\}px`\)/);
  const reserve = COMBAT_TOOLS_HEIGHT_PX;
  assert.match(hand, /const toolsHeight = COMBAT_TOOLS_HEIGHT_PX \/ zoom;/);
  const dockOffset = Number(tools.match(/top: \(handBox\?\.top \|\| 0\) \+ (\d+)/)?.[1] ?? (tools.includes('top: handBox?.top || 0') ? 0 : NaN));
  const toolHeight = Number(css.match(/\.combat-tools > button\s*\{[^}]*height:\s*calc\((\d+)px \/ var\(--ui-zoom,1\)\)/s)?.[1]);
  assert([reserve, dockOffset, toolHeight].every(Number.isFinite), 'all toolbar dimensions must be accounted for');
  assert.equal(toolHeight, 30, 'approved compact toolbar height');
  assert.equal(reserve, 34, 'the compact fan reserves the toolbar and its clearance');
  assert(reserve >= dockOffset + toolHeight + 4, 'card reservation must include toolbar offset, height and clearance');
});

test('unarmed intent taps preserve the selection-first tooltip path', () => {
  assert.match(combat, /selectCombatant\(enemy\.id\);[\s\S]*?return false;/);
  assert.match(coop, /selectCombatant\(e\.id\);[\s\S]*?return false;/);
});

test('an armed self-target HUD click reaches only one frame listener', () => {
  assert.match(combat,
    /if \(!selfArm \|\| !event\.target\.closest\('\.combatant-mini-hud'\)\) return;[\s\S]*?event\.stopImmediatePropagation\(\);[\s\S]*?playCard\(selfArm, null\);/);
});
