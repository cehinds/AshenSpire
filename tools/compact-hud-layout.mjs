import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const files = {
  css: read('styles/combat.css'),
  hud: read('src/ui/components/hudmeta.js'),
  route: (() => { try { return read('src/ui/components/actRouteStrip.js'); } catch { return ''; } })(),
  map: read('src/ui/screens/map.js'),
  combat: read('src/ui/screens/combat.js'),
};

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

// THE COMPACT HUD, AFTER THE KIT SWEEP (2026-09-04).
//
// Variant D was a second composition: its own grid areas, its own control cell,
// its own absolute rail for Fullscreen/Music, its own 18×2 px dash. The HUD is
// one kit Band now (styles/kit.css `.as-band`), and compact is that Band FOLDED
// — `data-hud-mode="compact"` hides whatever the composition marked `.fold`,
// which is one statement in one place instead of thirty overrides. So these
// contracts hold the fold, not the variant; every clause below is the same
// promise its D-number made, restated against what the game now draws.
const kit = read('styles/kit.css');
const grip = read('src/ui/components/hudModeGrip.js');

check(/\.as-band\[data-hud-mode="compact"\] \.fold, \.as-band\[data-fold="compact"\] \.fold \{ display: none; \}/.test(kit),
  'D1 the kit Band has no compact fold, so there is no compact HUD');
check(/class="hud-bottom as-band-row fold"/.test(files.hud),
  'D2 the belt of relics and potions is not what compact folds away');
check(/data-has-utility-potions="false"/.test(files.hud),
  'D3 the shared HUD does not default to an empty collapsed potion row');
check(/class: 'hud-identity as-labelstack'/.test(files.hud) && /hud-context fold/.test(files.hud),
  'D4 the identity\'s context line is not part of the fold');
check(/@media \(max-width: 640px\)[\s\S]*?\.as-statstrip\.trail > \* > :nth-child\(n\+2\) \{ display: none; \}/.test(kit),
  'D5 the run trail has no rung at which Build\'s source and Seed yield');
check(/iconButton\(\{[\s\S]*?className: 'hud-mode-grip as-grip'/.test(files.hud)
    && /grip\.textContent = mode === 'compact' \? '⌄' : '⌃'/.test(grip),
  'D6 the fold control is not one kit IconButton whose glyph says which way it folds');
check(!/height:\s*calc\(132px/.test(files.css),
  'D7 compact HUD still has the rejected fixed 132px height');

const actionsStart = files.hud.indexOf('<div class="hud-actions as-cluster">');
const quickStart = files.hud.indexOf('${quickSettingsHtml}', actionsStart);
const actionsEnd = files.hud.indexOf('</div>', quickStart);
check(actionsStart >= 0 && quickStart > actionsStart && actionsEnd > quickStart,
  'D8 Fullscreen/Music are not in the same cluster as Armoury and the Menu');
check(/class="as-iconbtn modal-iconbtn hud-quick-setting/.test(read('src/ui/components/hudQuickSettings.js')),
  'D9 Fullscreen/Music are not kit IconButtons');

for (const [surface, source] of [['map', files.map], ['combat', files.combat]]) {
  check(/dataset\.hasUtilityPotions\s*=\s*[^;]*children\.length\s*\?\s*'true'\s*:\s*'false'/.test(source),
    `D10 ${surface} does not publish whether its utility-potion row has content`);
}

check(/actRouteStripHtml\(\{\s*title:\s*actTitle\(run\.actNumber\)\s*\}\)/.test(files.map)
    && !/routeTitle|actRouteStripHtml|act-route-strip/.test(files.combat),
  'D11 the Act route strip is not Map-only');
check(/export function actRouteStripHtml[\s\S]*class: 'act-route-strip map-entrance-orientation'/.test(files.route)
    && !/actRouteStripHtml|act-route-strip|routeTitle/.test(files.hud),
  'D12 the Act route strip remains owned by the shared HUD instead of a Map component');
check(/band\(\{[\s\S]*quiet: true/.test(files.route),
  'D13 the Act route strip is not a quiet kit Band');

if (failures.length) {
  console.error(`compact-hud-layout: ${failures.length} failure(s)`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log('compact-hud-layout: OK — 13 compact composition contracts passed');
