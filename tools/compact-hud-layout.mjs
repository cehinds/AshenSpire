import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const files = {
  css: read('styles/combat.css'),
  hud: read('src/ui/components/hudmeta.js'),
  map: read('src/ui/screens/map.js'),
  combat: read('src/ui/screens/combat.js'),
};

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

const compact = files.css.match(/\/\* Variant D — Strict Compact HUD[\s\S]*?\/\* End Variant D \*\//)?.[0] || '';
check(compact, 'D1 missing the authored Variant D compact-HUD block');
check(/grid-template-areas:\s*["']vitals center right["'][\s\S]*["']relics center right["']/.test(compact)
    && (compact.match(/grid-area:\s*right/g) || []).length >= 3
    && /\.hud-info-row\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/.test(compact)
    && /margin-top:\s*calc\(var\(--compact-right-step\) \+ var\(--tap-floor\) \+ var\(--compact-gap\)\)/.test(compact),
  'D2 compact HUD is not the strict vitals/center/right-rail, relics/center/right-rail composition');
check(/data-has-utility-potions='false'[\s\S]*\.hud-potions\s*\{\s*display:\s*none/.test(compact),
  'D3 an empty utility-potion row does not collapse');
check(/data-has-utility-potions='false'[\s\S]*\.hud-quick-settings[\s\S]*margin-top:\s*var\(--compact-right-step\)/.test(compact),
  'D4 Fullscreen/Music do not rise immediately below Quick Access when no utility potions exist');
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

if (failures.length) {
  console.error(`compact-hud-layout: ${failures.length} failure(s)`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log('compact-hud-layout: OK — 10 compact composition contracts passed');
