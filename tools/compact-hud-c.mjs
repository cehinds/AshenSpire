#!/usr/bin/env node
// Variant C source receipt. Browser-free by design: the implementation task
// forbids Chrome/browser use, so this gate proves the authored composition,
// event ownership, touch/visual split, and catalog contract before bundling.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');
const source = {
  settings: read('src/ui/screens/settings.js'),
  content: read('src/ui/uiContent.js'),
  main: read('src/main.js'),
  overlay: read('src/ui/components/overlay.js'),
  map: read('src/ui/screens/map.js'),
  mapboard: read('src/ui/components/mapboard.js'),
  combat: read('src/ui/screens/combat.js'),
  equipment: read('src/ui/screens/equipment.js'),
  hud: read('src/ui/components/hudmeta.js'),
  hudView: read('src/ui/viewModels/RunHudViewModel.js'),
  quick: read('src/ui/components/hudQuickSettings.js'),
  css: read('styles/combat.css'),
  uiCss: read('styles/ui.css'),
  mapCss: read('styles/map.css'),
  catalog: read('docs/COMPONENT-CATALOG.md') + read('docs/component-catalog.html'),
};

const findings = [];
const demand = (ok, message) => { if (!ok) findings.push(message); };

demand(/Changelog:\s*\{\s*mount:\s*'set-changelog-mount'/.test(source.settings)
  && /CATEGORY_ORDER\s*=\s*\['Display', 'Audio', 'Accessibility', 'Advanced', 'Changelog', 'About'\]/.test(source.settings),
  'C1 Changelog is not a first-level Settings category');
demand(/set-tab-face/.test(source.settings) && /\.set-tabs \.set-tab-face/.test(source.uiCss)
  && /min-height:\s*var\(--tap-floor\)/.test(source.uiCss),
  'C2 Settings category cards do not separate compact visual faces from the touch floor');

const requiredOrder = [
  "tab: 'settings'", "tab: 'controls'", "act: 'fullscreen'", "act: 'music'",
  "act: 'inventory'", "act: 'character'", "act: 'load'", "act: 'save'",
  "act: 'saveQuit'", "act: 'quitNoSave'",
];
let at = -1;
let ordered = true;
for (const token of requiredOrder) {
  const next = source.content.indexOf(token, at + 1);
  if (next < 0) { ordered = false; break; }
  at = next;
}
demand(ordered && /Quit Without Saving/.test(source.content),
  'C3 Quick Menu does not expose the requested ordered groups and destructive label');
demand(/confirmDiscardProgress/.test(source.main) && /onQuitWithoutSaving/.test(source.overlay)
  && /resumeRun\(activeSlot\)/.test(source.main),
  'C4 Load/Quit Without Saving lack explicit discard confirmation and title-safe actions');
demand(/initialView/.test(source.equipment) && /openCombatArmoury\('rack'\)/.test(source.combat)
  && /openCombatArmoury\('grid'\)/.test(source.combat),
  'C5 Inventory and Character do not open their dedicated Armoury views');

demand(/data-hud-mode/.test(source.hud) && /data-hud-resize-grip/.test(source.hud)
  && /HUD_MODE_KEY/.test(source.hud),
  'C6 shared HUD has no remembered expanded/compact snap-state owner');
demand(/hud-compact-run/.test(source.hud) && /hud-compact-vitals/.test(source.hud)
  && /hud-compact-command/.test(source.hud),
  'C7 Variant C Asymmetric Command Shelf is not rendered');
demand(/data-compact-slot/.test(source.quick) && /\.shared-hud\[data-hud-mode='compact'\][\s\S]*\.hud-quick-settings/.test(source.css),
  'C8 compact Fullscreen/Music controls are not under potions and right anchored');
demand(/hud-resize-grip-face/.test(source.css) && /width:\s*16px/.test(source.css)
  && /min-width:\s*var\(--tap-floor\)/.test(source.css),
  'C9 grip is not a tiny visible dash inside a 44px interaction target');
demand(/@media \(max-width:\s*700px\)[\s\S]*--hud-quick-card-size-mobile:\s*32px/.test(source.uiCss),
  'C10 mobile Fullscreen/Music cards are not 20% smaller');
demand(/scheduleViewportRecenter/.test(source.mapboard)
  && /visualViewport/.test(source.mapboard)
  && /fullscreenchange/.test(source.mapboard),
  'C11 map camera does not recenter after settled fullscreen/viewport changes');
demand(/--hud-utility-safe-inset/.test(source.mapCss) && /1\.2/.test(source.mapCss)
  && /map-entrance-orientation/.test(source.mapCss),
  'C12 Act Route Strip does not reserve equal 1.2x utility-rail safe insets');
demand(/Asymmetric Command Shelf/.test(source.catalog) && /Quit Without Saving/.test(source.catalog),
  'C13 component catalogs do not describe the new HUD/Menu contracts');

if (findings.length) {
  findings.forEach((line) => console.error(`FAIL ${line}`));
  console.error(`compact-hud-c: ${findings.length} finding(s)`);
  process.exit(1);
}
console.log('compact-hud-c: OK - 13/13 Variant C source contracts hold');
