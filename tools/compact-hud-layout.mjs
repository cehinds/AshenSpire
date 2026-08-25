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

const compact = files.css.match(/\/\* Variant D — Strict Compact HUD[\s\S]*?\/\* End Variant D \*\//)?.[0] || '';
check(compact, 'D1 missing the authored Variant D compact-HUD block');
check(/grid-template-areas:\s*["']vitals center right["'][\s\S]*["']relics center right["']/.test(compact)
    && (compact.match(/grid-area:\s*right/g) || []).length >= 2
    && /\.hud-info-row\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/.test(compact)
    && /\.hud-potions\s*\{[\s\S]*margin-top:\s*var\(--compact-right-step\)/.test(compact),
  'D2 utility potions do not own the compact HUD second right-rail row');
check(/data-has-utility-potions='false'[\s\S]*\.hud-potions\s*\{\s*display:\s*none/.test(compact),
  'D3 an empty utility-potion row does not collapse');
check(/\.hud-potions\s*\{[\s\S]*justify-self:\s*end[\s\S]*max-width:\s*calc\(\(var\(--compact-control-cell\) \* 4\)/.test(compact)
    && /\.hud-quick-settings\s*\{[\s\S]*position:\s*absolute[\s\S]*top:\s*calc\(100%[\s\S]*right:[\s\S]*flex-direction:\s*column/.test(compact),
  'D4 other potions do not retain the full second row or Fullscreen/Music are not vertically stacked below the HUD');
check(/\.build-stamp\[data-seed\]\s*\{\s*display:\s*none\s*!important/.test(compact),
  'D5 Build/Seed/Source can leak into compact mode');
check(/\.hud-mode-grip\s*>\s*span[\s\S]*width:\s*calc\(18px[\s\S]*height:\s*calc\(2px/.test(files.css),
  'D6 resize affordance is not the approved 18x2px border dash');
check(!/height:\s*calc\(132px/.test(compact),
  'D7 compact HUD still has the rejected fixed 132px height');

const topStart = files.hud.indexOf('<div class="hud-top">');
const quickStart = files.hud.indexOf('${hudQuickSettingsHtml', topStart);
const topEnd = files.hud.indexOf('</div>', quickStart);
check(topStart >= 0 && quickStart > topStart && topEnd > quickStart,
  'D8 Fullscreen/Music are not mounted inside the compact grid host');
check(/data-has-utility-potions="false"/.test(files.hud),
  'D9 shared HUD does not default to an empty collapsed potion row');

for (const [surface, source] of [['map', files.map], ['combat', files.combat]]) {
  check(/dataset\.hasUtilityPotions\s*=\s*[^;]*children\.length\s*\?\s*'true'\s*:\s*'false'/.test(source),
    `D10 ${surface} does not publish whether its utility-potion row has content`);
}

check(/actRouteStripHtml\(\{\s*title:\s*actTitle\(run\.actNumber\)\s*\}\)/.test(files.map)
    && !/routeTitle|actRouteStripHtml|act-route-strip/.test(files.combat),
  'D11 the Act route strip is not Map-only');
check(/function actRouteStripHtml[\s\S]*class="act-route-strip map-entrance-orientation"/.test(files.route)
    && !/actRouteStripHtml|act-route-strip|routeTitle/.test(files.hud),
  'D12 the Act route strip remains owned by the shared HUD instead of a Map component');

if (failures.length) {
  console.error(`compact-hud-layout: ${failures.length} failure(s)`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log('compact-hud-layout: OK — 13 compact composition contracts passed');
