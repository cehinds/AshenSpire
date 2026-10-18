import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handLayout, responsiveHandLayout } from '../src/ui/models/HandLayout.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const css = read('../styles/combat-layers.css');
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
  // Owner decision (2026-10-11): at rest a player folds only its name and
  // resource rows; the stance chip and status icons stay visible.
  assert.match(css, /\.player:not\(\.context-selected\):not\(\.selected-target\)[^{]*\[data-meter-row='resource'\]\s*\{\s*display:\s*none !important;/s);
  const restHide = css.match(/\.player:not\(\.context-selected\):not\(\.selected-target\)[^{]*\{\s*display:\s*none !important;/s)?.[0] ?? '';
  assert.doesNotMatch(restHide, /data-meter-row='stance'|\.statuses/, 'the stance chip and statuses are not hidden at rest');
});

test('compact hand leaves the footer tool and Grid rows below its resting cards', () => {
  assert.match(hand, /const toolsHeight = 0;/, 'the toolbar is outside the fan, so no row is reserved above it');
  assert.match(tools, /const footerControls = combatEl.querySelector\('\.combat-action-row'\)/, 'tools dock against the footer rather than the hand top');
  for (const zoom of [.74, 1, 1.2]) for (const count of [3, 5, 7]) {
    const input = { width: 390 / zoom, height: 250 / zoom, count, zoom, compact: true, formFactor: 'mobile' };
    const plan = responsiveHandLayout(input, handLayout(input));
    const bottom = Math.max(...plan.cards.map(card => {
      const radians = card.angle * Math.PI / 180;
      return plan.top + card.y + plan.cardHeight / 2
        + (Math.abs(Math.sin(radians)) * plan.cardWidth + Math.abs(Math.cos(radians)) * plan.cardHeight) / 2;
    }));
    assert.ok((input.height - bottom) * zoom >= 62, `${count} cards at zoom ${zoom} clear the 30px tools and 28px Grid rows plus their gap`);
  }
});

test('unarmed intent taps preserve the selection-first tooltip path', () => {
  assert.match(combat, /selectCombatant\(enemy\.id\);[\s\S]*?return false;/);
  assert.match(coop, /selectCombatant\((?:e\.id|enemyId)\);[\s\S]*?return false;/);
});

test('an armed self-target HUD click reaches only one frame listener', () => {
  assert.match(combat,
    /if \(!selfArm \|\| !event\.target\.closest\('\.combatant-mini-hud'\)\) return;[\s\S]*?event\.stopImmediatePropagation\(\);[\s\S]*?playCard\(selfArm, null\);/);
});

test('the log drawer opens beside the left-aligned Log button', () => {
  const css = readFileSync(new URL('../styles/combat-layers.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const top = css.replace(/@media[^{]*\{(?:[^{}]*\{[^}]*\})*[^{}]*\}/g, '');
  const panels = [...top.matchAll(/\.combat-tools \.combat-log-panel\s*\{([^}]*)\}/g)].map(match => match[1]);
  assert.ok(panels.length, 'the drawer has a formation anchor');
  const last = panels.at(-1);
  assert.match(last, /left:\s*0/); assert.match(last, /right:\s*auto/);
  const logRules = [...top.matchAll(/\.combat-tools > \[data-combat-tool='log'\]\s*\{([^}]*)\}/g)];
  assert.ok(logRules.length, 'the Log button has a formation anchor');
  const declarations = logRules.at(-1)[1];
  assert.match(declarations, /(?:^|;)\s*justify-self:\s*start\s*(?:;|$)/);
  assert.match(declarations, /(?:^|;)\s*grid-column:\s*1\s*(?:;|$)/, 'Log occupies the leftmost tools column');
});

test('a tap on a playable card plays it only when its target is unambiguous (owner, 2026-10-18)', () => {
  const wire = combat.match(/function wireCardInput\(el, inst, pv, affordable\) \{([\s\S]*?)\n  \}\n\n  combatEl\.addEventListener\('click'/)?.[1] || '';
  assert.match(wire, /const oneTapOn = \(\) => \(readSettings \? readSettings\(\) : meta\.settings \|\| \{\}\)\.oneTapPlay === true;\s*const oneTapPlays = \(\) => oneTapOn\(\) && playIsUnambiguous\(\);/, 'the setting is opt-in (exactly true) and gates the one-tap play (owner ruling 2026-10-18 14:15)');
  assert.match(wire, /const tap = \(\) => \{[\s\S]*?if \(!affordable\) \{[\s\S]*?return;\s*\}\s*(?:\/\/[^\n]*\n\s*)*if \(oneTapPlays\(\)\) \{ play\(\); return; \}\s*if \(selected !== inst\.instanceId && selfArm !== inst\.instanceId\) \{ select\(\); return; \}/, 'after the unaffordable branch, a tap plays when unambiguous (selected by a hold or not) or selects');
  assert.match(wire, /if \(lastConfirmTap && now - lastConfirmTap <= 350\) \{ lastConfirmTap = 0; confirm\(\); \}/, 'the double-tap confirm of the ambiguous case is kept');
  assert.match(wire, /const tap = \(\) => \{\s*\/\/[^\n]*\n\s*if \(isRoundQueued\(inst\.instanceId\)\) \{ unqueueCard\(inst\.instanceId\); return; \}/, 'a queued card still unqueues first');
  assert.match(read('../src/ui/screens/settings.js'), /key: 'oneTapPlay', def: false/, 'the setting is offered, default off');
});

test('One-tap play reads the setting live, so a mid-combat toggle changes the next tap', () => {
  assert.doesNotMatch(combat, /\(meta\.settings \|\| \{\}\)\.oneTapPlay/, 'no read of oneTapPlay is frozen to the settings captured at mount');
  const wire = combat.match(/function wireCardInput\(el, inst, pv, affordable\) \{([\s\S]*?)\n  \}\n\n  combatEl\.addEventListener\('click'/)?.[1] || '';
  // oneTapOn is a function called on every tap (not a const evaluated once), and it asks readSettings().
  assert.match(wire, /const oneTapOn = \(\) => \(readSettings \?/);
  assert.match(wire, /if \(oneTapPlays\(\)\) \{ play\(\); return; \}/, 'each tap re-evaluates the setting');
  assert.match(combat, /readSettings = \(\) => meta\.settings \|\| \{\}/, 'mountCombat falls back to meta when no reader is passed');
});
