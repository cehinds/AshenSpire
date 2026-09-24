#!/usr/bin/env node
// tools/settings-defaults.mjs — promote a settings profile to the build's defaults.
//
//   node tools/settings-defaults.mjs <profile.json>   write src/content/settingsDefaults.js
//   node tools/settings-defaults.mjs --clear           back to the code defaults
//   node tools/settings-defaults.mjs --check           the module parses and every value is legal
//
// The profile is any file Settings exports (Export configuration, or a
// Defaults & sync profile from the settings-profiles branch). It goes through
// parseAdvancedConfigFile — the same all-or-nothing door a player's import
// uses — so a promoted default can never be a value the game would refuse.
// Screen-size keys (DEVICE_KEYS) describe a device, not a player, and are left out.
// Rebuild afterwards (node tools/launch.mjs --build-only) and write a receipt.

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = resolve(ROOT, 'src/content/settingsDefaults.js');
const DEVICE_KEYS_FALLBACK = ['uiScale', 'textSize', 'tapFloor', 'fullscreen', 'quickNav', 'armamentsPhonePlacement'];

async function modules() {
  const { contentBundle } = await import('../src/content/index.js');
  const { parseAdvancedConfigFile } = await import('../src/model/advancedConfig.js');
  const { settingsRows } = await import('../src/ui/screens/settings.js');
  const sync = await import('../src/model/settingsSync.js');
  return { contentBundle, parseAdvancedConfigFile, rows: settingsRows(), deviceKeys: sync.DEVICE_KEYS || DEVICE_KEYS_FALLBACK };
}

export function moduleText(values) {
  const sorted = Object.fromEntries(Object.entries(values).sort(([a], [b]) => a.localeCompare(b)));
  const body = JSON.stringify(sorted, null, 2).split('\n').map((line, i) => (i ? `  ${line}` : line)).join('\n');
  const version = Object.keys(sorted).length ? createHash('sha1').update(JSON.stringify(sorted)).digest('hex').slice(0, 10) : 'none';
  const head = readFileSync(TARGET, 'utf8').split('export const SETTINGS_DEFAULTS')[0];
  return `${head}export const SETTINGS_DEFAULTS = Object.freeze({\n  version: '${version}',\n  values: Object.freeze(${body}),\n});\n`;
}

async function main(argv) {
  const { contentBundle, parseAdvancedConfigFile, rows, deviceKeys } = await modules();
  if (argv.includes('--check')) {
    const { SETTINGS_DEFAULTS } = await import('../src/content/settingsDefaults.js');
    const file = JSON.stringify({ game: 'Ashen Spire', schemaVersion: 1, overrides: Object.fromEntries(Object.entries(SETTINGS_DEFAULTS.values)
      .map(([key, value]) => [key.startsWith('gameConfig.') ? key : `settings.${key}`, value])) });
    parseAdvancedConfigFile(file, contentBundle, {}, rows, []);
    console.log(`settings-defaults: OK — ${Object.keys(SETTINGS_DEFAULTS.values).length} promoted value(s), version ${SETTINGS_DEFAULTS.version}`);
    return;
  }
  if (argv.includes('--clear')) {
    writeFileSync(TARGET, moduleText({}));
    console.log('settings-defaults: cleared — the code defaults stand.');
    return;
  }
  const path = argv.find((arg) => !arg.startsWith('--'));
  if (!path) { console.error('usage: node tools/settings-defaults.mjs <profile.json> | --clear | --check'); process.exit(2); }
  const warnings = [];
  const changes = parseAdvancedConfigFile(readFileSync(path, 'utf8'), contentBundle, {}, rows, warnings);
  const values = Object.fromEntries(Object.entries(changes).filter(([key]) => !deviceKeys.includes(key)));
  writeFileSync(TARGET, moduleText(values));
  for (const warning of warnings) console.warn(`  note: ${warning}`);
  console.log(`settings-defaults: wrote ${Object.keys(values).length} promoted value(s) to src/content/settingsDefaults.js`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => { console.error(`settings-defaults: ${error.message}`); process.exit(1); });
}
