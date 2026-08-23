#!/usr/bin/env node
// Reusable UI component contract: stable semantic ids, one shared Map/Combat
// HUD composition, one player/enemy Combatant Frame, and no simulation state
// imported into component modules.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

const REQUIRED_IDS = Object.freeze([
  'shared-run-hud', 'run-header-strip', 'identity-cluster', 'portrait-badge',
  'character-title', 'cinders-counter', 'build-metadata-trail', 'primary-hud-row',
  'vitals-panel', 'resource-meter', 'quick-access-panel', 'armoury-control',
  'quick-menu-control', 'crimson-flask-control', 'azure-flask-control',
  'inventory-belt', 'relic-tray', 'potion-tray', 'battlefield-stage',
  'combatant-frame', 'player-combatant-frame', 'enemy-combatant-frame',
  'player-hand-tray', 'combat-action-rail',
]);

export function receipt() {
  return {
    registry: read('src/ui/components/uiComponents.js'),
    hud: read('src/ui/components/hudmeta.js'),
    frame: read('src/ui/components/combatantFrame.js'),
    buildstamp: read('src/ui/components/buildstamp.js'),
    map: read('src/ui/screens/map.js'),
    combat: read('src/ui/screens/combat.js'),
    css: read('styles/combat.css'),
    spec: read('SPEC.md'),
  };
}

export function findings(r) {
  const bad = [];
  const ids = [...r.registry.matchAll(/:\s*'([a-z][a-z0-9-]+)'/g)].map((m) => m[1]);
  const missing = REQUIRED_IDS.filter((id) => !ids.includes(id));
  if (missing.length || new Set(ids).size !== ids.length) {
    bad.push(`C1 registry ids missing/duplicated: ${missing.join(', ') || 'duplicate value'}`);
  }
  const hudExports = [
    'identityClusterHtml', 'cindersCounterHtml', 'buildMetadataTrailHtml',
    'runHeaderStripHtml', 'vitalsPanelHtml', 'quickAccessPanelHtml',
    'primaryHudRowHtml', 'inventoryBeltHtml', 'sharedRunHudHtml',
  ];
  if (hudExports.some((name) => !r.hud.includes(`export function ${name}`))
      || !r.hud.includes('export const hudShellHtml = sharedRunHudHtml;')) {
    bad.push('C2 the shared HUD is no longer composed from exported reusable assets');
  }
  if (![r.map, r.combat].every((text) => /import \{ hudShellHtml \}/.test(text) && /\$\{hudShellHtml\(\{/.test(text))) {
    bad.push('C3 Map and Combat no longer consume the same shared HUD composition');
  }
  if (!/export function combatantFrame/.test(r.frame)
      || (r.combat.match(/combatantFrame\(\{/g) || []).length !== 2
      || /document\.createElement\('div'\);\s*\n\s*box\.className = `combatant/.test(r.combat)) {
    bad.push('C4 player and enemy no longer consume one Combatant Frame component');
  }
  if (/from ['"]\.\.\/\.\.\/(engine|model)\//.test(r.hud + r.frame + r.registry)
      || /\b(run|combat)\s*=/.test(r.hud + r.frame)) {
    bad.push('C5 reusable component modules crossed the simulation-state boundary');
  }
  if (!/hud-act[\s\S]*hud-floor[\s\S]*buildStampHtml\(place, \{ split: true, seed \}\)/.test(r.hud)
      || /hud-context|grid-row:\s*2/.test(r.hud + r.css)
      || !/flex-wrap:\s*nowrap/.test(r.css)) {
    bad.push('C6 Run Header is not the corrected one-row Act/Floor/Build/Seed/Source trail');
  }
  if (!/max-width:\s*720px[\s\S]*build-source[\s\S]*max-width:\s*520px[\s\S]*build-stamp\[data-seed\]::before[\s\S]*max-width:\s*340px[\s\S]*build-number/.test(r.css)) {
    bad.push('C7 metadata does not hide Source, then Seed, then Build without wrapping');
  }
  if (!/UI\.battlefieldStage/.test(r.combat)
      || !/UI\.playerHandTray/.test(r.combat)
      || !/UI\.combatActionRail/.test(r.combat)
      || !/markUiComponent\(frame, UI\.combatantFrame, role\)/.test(r.frame)) {
    bad.push('C8 combat composition lacks stable Battlefield/Frame/Hand/Action references');
  }
  if (!/\n\.player-zone\s*\{[^}]*justify-content:\s*center;/.test(r.css)
      || !/\n\.enemy-row\s*\{[^}]*align-items:\s*center;/.test(r.css)) {
    bad.push('C9 combatants are no longer vertically centered in the Battlefield Stage');
  }
  if (!REQUIRED_IDS.every((id) => r.spec.includes(`\`${id}\``))) {
    bad.push('C10 SPEC no longer codifies every public component id');
  }
  return bad;
}

function selftest() {
  const clean = receipt();
  const plants = [
    ['remove Vitals id', 'C1 ', (r) => ({ ...r, registry: r.registry.replace("vitalsPanel: 'vitals-panel',", '') })],
    ['remove Vitals export', 'C2 ', (r) => ({ ...r, hud: r.hud.replace('export function vitalsPanelHtml', 'function vitalsPanelHtml') })],
    ['give Map a second HUD', 'C3 ', (r) => ({ ...r, map: r.map.replace('${hudShellHtml({', '${(() => "")({') })],
    ['duplicate enemy frame', 'C4 ', (r) => ({ ...r, combat: r.combat.replace('const box = combatantFrame({\n        role: \'enemy\'', "const box = document.createElement('div');\n      box.className = `combatant enemy`;\n      void ({\n        role: 'enemy'") })],
    ['import model into component', 'C5 ', (r) => ({ ...r, hud: `${r.hud}\nimport { resourceBarPlan } from '../../model/resources.js';\n` })],
    ['restore a second header row', 'C6 ', (r) => ({ ...r, css: `${r.css}\n.hud-run-meta { grid-row: 2; }\n` })],
    ['remove Source priority', 'C7 ', (r) => ({ ...r, css: r.css.replace('@container run-header (max-width: 720px)', '@container run-header (max-width: 721px)') })],
    ['remove Hand reference', 'C8 ', (r) => ({ ...r, combat: r.combat.replace('UI.playerHandTray', "'anonymous-hand'") })],
    ['bottom-align enemies', 'C9 ', (r) => ({ ...r, css: r.css.replace('align-items: center; justify-content: space-evenly;', 'align-items: flex-end; justify-content: space-evenly;') })],
    ['remove public id from spec', 'C10 ', (r) => ({ ...r, spec: r.spec.replace('`potion-tray`', 'Potion tray') })],
  ];
  let failures = 0;
  const cleanBad = findings(clean);
  if (cleanBad.length) { failures++; console.error(`FAIL clean source: ${cleanBad.join('; ')}`); }
  else console.log('PASS clean source: 10/10 reusable component contracts hold');
  for (const [name, code, mutate] of plants) {
    const got = findings(mutate(clean));
    const hit = got.find((line) => line.startsWith(code));
    if (hit) console.log(`RED  ${name}: ${hit}`);
    else { failures++; console.error(`MISS ${name}: ${got.join('; ') || 'no finding'}`); }
  }
  if (failures) process.exitCode = 1;
  else console.log(`ui-components --selftest: OK — ${plants.length}/${plants.length} plants observed red`);
}

if (process.argv.includes('--selftest')) selftest();
else {
  const bad = findings(receipt());
  bad.forEach((line) => console.error(`FAIL ${line}`));
  if (bad.length) process.exitCode = 1;
  else console.log('ui-components: OK — 10/10 reusable component contracts hold');
}
