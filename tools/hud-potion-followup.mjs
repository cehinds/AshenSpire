#!/usr/bin/env node
// Focused, browser-free contract for the approved shared-HUD potion follow-up.
// It checks the configuration and source wiring. Rendered geometry remains a
// separate Chrome gate; this tool cannot claim pixels it never measured.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(ROOT, path), 'utf8');

export function hudPotionFindings({ balance, main, css, combat }) {
  const findings = [];
  const pct = /availableWidthPct:\s*(\d+(?:\.\d+)?)/.exec(balance);
  if (!pct || Number(pct[1]) < 80 || Number(pct[1]) > 85) {
    findings.push('H1 availableWidthPct is not configured in the approved 80-85 range');
  }
  if (!main.includes("setProperty('--hud-resource-available-pct', `${hudAvailableWidthPct}%`)")) {
    findings.push('H2 main does not project the configured available-width percentage');
  }
  if (!css.includes('width: var(--hud-resource-available-pct);')
      || !css.includes(".topbar.combat-hud.shared-hud .resbars-host {\n  width: 100%;\n  max-width: 100%;")) {
    findings.push('H3 shared HP/MP/SP host does not consume the available-width token');
  }
  if (!css.includes('grid-template-rows: repeat(2, var(--tap-floor));')
      || !css.includes('width: var(--tap-floor); height: var(--tap-floor);')) {
    findings.push('H4 Armoury/Menu/Health/Mana are not four equal non-stretching tap-floor cells');
  }
  if (!combat.includes('el.dataset.flaskHotkeySlot = String(hotkeySlot);')
      || !combat.includes('appendFlaskHotkey(el, hotkeySlot);')
      || !combat.includes('.flask-slot[data-flask-hotkey-slot="${slot}"]')) {
    findings.push('H5 charge controls are not wired to the visible rebindable flask hotkeys');
  }
  if (!css.includes('.hud-potions .flask-identity {')
      || !css.includes('width: var(--hud-utility-visual-size);')
      || !css.includes('flex-direction: row;')) {
    findings.push('H6 utility potions do not use a relic-sized visual anchored to grow left');
  }
  if (!css.includes(":root:not([data-layout='narrow']) .topbar.combat-hud.shared-hud .flask-charge-count")) {
    findings.push('H7 charge counts do not scale from the existing wide-layout state');
  }
  if (!css.includes('--hud-utility-visual-size: 2.6rem;')) {
    findings.push('H8 utility potion size has no single shared relic-size token');
  }
  return findings;
}

const files = {
  balance: read('src/content/balance.js'),
  main: read('src/main.js'),
  css: read('styles/combat.css'),
  combat: read('src/ui/screens/combat.js'),
};

if (process.argv.includes('--selftest')) {
  const plants = [
    ['H1 ', 'balance', 'availableWidthPct: 82', 'availableWidthPct: 70'],
    ['H2 ', 'main', "setProperty('--hud-resource-available-pct', `${hudAvailableWidthPct}%`)", "setProperty('--hud-resource-width', `${hudAvailableWidthPct}%`)"],
    ['H3 ', 'css', 'width: var(--hud-resource-available-pct);', 'width: 79%;'],
    ['H4 ', 'css', 'grid-template-rows: repeat(2, var(--tap-floor));', 'grid-template-rows: repeat(2, minmax(var(--tap-floor), 1fr));'],
    ['H5 ', 'combat', 'el.dataset.flaskHotkeySlot = String(hotkeySlot);', 'el.dataset.flaskVisualSlot = String(hotkeySlot);'],
    ['H6 ', 'css', '.hud-potions .flask-identity {', '.hud-potions .potion-identity {'],
    ['H7 ', 'css', ":root:not([data-layout='narrow']) .topbar.combat-hud.shared-hud .flask-charge-count", ":root[data-layout='narrow'] .topbar.combat-hud.shared-hud .flask-charge-count"],
    ['H8 ', 'css', '--hud-utility-visual-size: 2.6rem;', '--hud-utility-size-copy: 2.6rem;'],
  ];
  let failures = 0;
  if (hudPotionFindings(files).length) {
    failures++;
    console.log('FAIL clean HUD potion contract is not green');
  }
  for (const [expected, file, find, replace] of plants) {
    if (!files[file].includes(find)) {
      failures++;
      console.log(`FAIL ${expected.trim()} plant site drifted`);
      continue;
    }
    const planted = { ...files, [file]: files[file].replace(find, replace) };
    const got = hudPotionFindings(planted);
    if (got.some((finding) => finding.startsWith(expected))) console.log(`RED  ${expected.trim()} discriminator fired`);
    else {
      failures++;
      console.log(`MISS ${expected.trim()} — ${got.join('; ') || 'no finding'}`);
    }
  }
  if (!failures) console.log(`hud-potion-followup selftest: ${plants.length} checks passed`);
  else console.log(`hud-potion-followup selftest: ${failures} failure(s)`);
  process.exit(failures ? 1 : 0);
}

const findings = hudPotionFindings(files);
for (const finding of findings) console.log(`FAIL ${finding}`);
if (!findings.length) console.log('hud-potion-followup: 8 checks passed');
else console.log(`hud-potion-followup: ${findings.length} failure(s)`);
process.exit(findings.length ? 1 : 0);
