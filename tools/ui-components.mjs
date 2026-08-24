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
  'quick-menu-control', 'hud-quick-settings', 'fullscreen-control', 'music-control',
  'crimson-flask-control', 'azure-flask-control',
  'inventory-belt', 'relic-tray', 'potion-tray', 'battlefield-stage',
  'combatant-frame', 'player-combatant-frame', 'enemy-combatant-frame',
  'player-hand-tray', 'combat-action-rail', 'metadata-field', 'panel',
  'component-background', 'action-control', 'hotkey-badge', 'item-tray', 'item-slot',
  'combatant-sprite', 'combatant-nameplate', 'intent-indicator', 'block-badge',
  'health-status-bar', 'poise-status-bar', 'proc-status-bar', 'arcane-exposure-bar',
  'status-effect-tray', 'tooltip', 'damage-feedback', 'guarded-damage-indicator',
  'health-damage-indicator',
  'quick-menu-panel', 'quick-menu-caption', 'quick-menu-row', 'menu-overlay',
  'menu-tab-strip', 'menu-tab', 'menu-panel', 'menu-footer', 'save-game-control',
  'save-quit-control', 'armoury-overlay', 'armoury-panel',
  'armoury-header', 'armoury-view-switcher', 'armoury-body', 'armoury-figure',
  'equipment-slot', 'equipment-set-cell', 'armoury-inventory', 'inventory-item-card',
  'inventory-detail-card', 'equipment-comparison', 'armoury-stats-panel',
  'armoury-card-strip', 'armoury-region-header',
  'folding-tray', 'tray-header', 'tray-resize-handle', 'tray-content',
  'character-disclosure', 'class-preview-pane', 'class-resource-grid',
  'class-choice-card', 'view-mode-toggle', 'boolean-setting-toggle',
  'selection-section-face', 'primary-stat-card', 'resource-strip', 'mode-choice',
  'sprite-choice', 'tint-choice', 'sigil-choice', 'keepsake-choice',
  'equipment-choice-card', 'relic-choice-card',
]);

export function receipt() {
  return {
    registry: read('src/ui/models/UiComponentId.js'),
    componentModel: read('src/ui/models/ComponentModel.js'),
    behaviorModel: read('src/ui/models/BehaviorModel.js'),
    hudModels: [
      'HudPrimitiveModels', 'RunHeaderModel', 'VitalsPanelModel',
      'QuickAccessPanelModel', 'InventoryBeltModel', 'HudQuickSettingsModel',
    ].map((name) => read(`src/ui/models/${name}.js`)).join('\n'),
    hudViewModel: read('src/ui/viewModels/RunHudViewModel.js'),
    menuModels: read('src/ui/models/MenuModels.js'),
    armouryModels: read('src/ui/models/ArmouryModels.js'),
    trayModels: read('src/ui/models/TrayModels.js'),
    hud: read('src/ui/components/hudmeta.js'),
    quickSettings: read('src/ui/components/hudQuickSettings.js'),
    menuComponents: read('src/ui/components/menuComponents.js'),
    armouryComponents: read('src/ui/components/armouryComponents.js'),
    trayComponents: read('src/ui/components/trayComponents.js'),
    creationCards: read('src/ui/components/creationCards.js'),
    customize: read('src/ui/screens/customize.js'),
    catalogMarkdown: read('docs/COMPONENT-CATALOG.md'),
    catalogHtml: read('docs/component-catalog.html'),
    frame: read('src/ui/components/combatantFrame.js'),
    tooltip: read('src/ui/components/tooltip.js'),
    exposure: read('src/ui/components/arcaneExposure.js'),
    fx: read('src/ui/fx.js'),
    buildstamp: read('src/ui/components/buildstamp.js'),
    balance: read('src/content/balance.js'),
    main: read('src/main.js'),
    validate: read('src/model/validate.js'),
    map: read('src/ui/screens/map.js'),
    combat: read('src/ui/screens/combat.js'),
    coop: read('src/ui/screens/coop.js'),
    quicknav: read('src/ui/components/quicknav.js'),
    overlay: read('src/ui/components/overlay.js'),
    equipment: read('src/ui/screens/equipment.js'),
    css: read('styles/combat.css'),
    uiCss: read('styles/ui.css'),
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
      || !r.hud.includes('export const hudShellHtml = sharedRunHudHtml;')
      || !/export function hudQuickSettingsHtml/.test(r.quickSettings)
      || !/export function wireHudQuickSettings/.test(r.quickSettings)) {
    bad.push('C2 the shared HUD is no longer composed from exported reusable assets');
  }
  if (![r.map, r.combat].every((text) => /import \{ hudShellHtml \}/.test(text)
      && /import \{ runHudViewModel \}/.test(text)
      && /\$\{hudShellHtml\(runHudViewModel\(\{/.test(text))) {
    bad.push('C3 Map and Combat no longer consume the same shared HUD composition');
  }
  if (!/export function combatantFrame/.test(r.frame)
      || (r.combat.match(/combatantFrame\(\{/g) || []).length !== 2
      || /document\.createElement\('div'\);\s*\n\s*box\.className = `combatant/.test(r.combat)) {
    bad.push('C4 player and enemy no longer consume one Combatant Frame component');
  }
  if (/from ['"](?:\.\.\/)+(?:engine|model)\//.test(r.hud + r.quickSettings + r.frame + r.registry + r.componentModel + r.hudModels + r.hudViewModel + r.menuModels + r.armouryModels + r.menuComponents + r.armouryComponents)
      || /\b(run|combat)\s*=/.test(r.hud + r.quickSettings + r.frame + r.hudModels + r.hudViewModel + r.menuModels + r.armouryModels)) {
    bad.push('C5 reusable component modules crossed the simulation-state boundary');
  }
  if (!/hud-act[\s\S]*hud-floor[\s\S]*buildStampHtml\(model\.properties\.place, \{ split: true, seed: model\.properties\.seed \}\)/.test(r.hud)
      || !/metadataFieldModel\('act'[\s\S]*metadataFieldModel\('floor'[\s\S]*metadataFieldModel\('build'[\s\S]*metadataFieldModel\('seed'[\s\S]*metadataFieldModel\('source'/.test(r.hudModels)
      || /hud-context|grid-row:\s*2/.test(r.hud + r.css)
      || !/flex-wrap:\s*nowrap/.test(r.css)) {
    bad.push('C6 Run Header is not the corrected one-row Act/Floor/Build/Seed/Source trail');
  }
  if (!/max-width:\s*720px[\s\S]*build-source[\s\S]*max-width:\s*620px[\s\S]*build-stamp\[data-seed\]::before[\s\S]*max-width:\s*520px[\s\S]*build-number/.test(r.css)) {
    bad.push('C7 metadata does not hide Source, then Seed, then Build without wrapping');
  }
  if (!/UI\.battlefieldStage/.test(r.combat)
      || !/UI\.playerHandTray/.test(r.combat)
      || !/UI\.combatActionRail/.test(r.combat)
      || !/markUiComponent\(frame, UI\.combatantFrame, role\)/.test(r.frame)
      || !/UI\.combatantSprite/.test(r.frame)
      || !/UI\.combatantNameplate/.test(r.frame)
      || !/UI\.healthStatusBar/.test(r.combat)
      || !/UI\.poiseStatusBar/.test(r.combat)
      || !/UI\.procStatusBar/.test(r.combat)
      || !/UI\.statusEffectTray/.test(r.combat)
      || !/UI\.intentIndicator/.test(r.combat)
      || !/UI\.blockBadge/.test(r.combat)
      || !/UI\.arcaneExposureBar/.test(r.exposure)
      || !/UI\.tooltip/.test(r.tooltip)
      || !/UI\.guardedDamageIndicator/.test(r.fx)
      || !/UI\.healthDamageIndicator/.test(r.fx)) {
    bad.push('C8 combat composition lacks stable Battlefield/Frame/Hand/Action references');
  }
  if (!/UI\.quickMenuPanel/.test(r.menuModels)
      || !/UI\.quickMenuRow/.test(r.menuModels)
      || !/UI\.menuOverlay/.test(r.menuModels)
      || !/UI\.menuTab/.test(r.menuModels)
      || !/UI\.menuPanel/.test(r.menuModels)
      || !/UI\.menuFooter/.test(r.menuModels)
      || !/UI\.saveGameControl/.test(r.menuModels)
      || !/UI\.saveQuitControl/.test(r.menuModels)
      || !/UI\.armouryOverlay/.test(r.armouryModels)
      || !/UI\.armouryPanel/.test(r.armouryModels)
      || !/UI\.equipmentSlot/.test(r.armouryModels)
      || !/UI\.armouryInventory/.test(r.armouryModels)
      || !/UI\.equipmentComparison/.test(r.equipment)) {
    bad.push('C8 menu and Armoury composition lacks stable component references');
  }
  if (!/\n\.player-zone\s*\{[^}]*justify-content:\s*center;/.test(r.css)
      || !/\n\.enemy-row\s*\{[^}]*align-items:\s*center;/.test(r.css)) {
    bad.push('C9 combatants are no longer vertically centered in the Battlefield Stage');
  }
  if (!REQUIRED_IDS.every((id) => r.spec.includes(`\`${id}\``))) {
    bad.push('C10 SPEC no longer codifies every public component id');
  }
  if (!/hudPresentation:\s*\{[\s\S]*componentBackgroundOpacityPct:\s*0,[\s\S]*metadataFontPx:\s*11,[\s\S]*beltItemGapPx:\s*2,[\s\S]*portraitScale:\s*0\.7,[\s\S]*primaryRowGapPx:\s*8,[\s\S]*controlGapPx:\s*2,[\s\S]*resourceRowGapPx:\s*2,[\s\S]*cindersMaxWidthPct:\s*30,[\s\S]*metadataMaxWidthPct:\s*30,[\s\S]*metadataShowTotals:\s*false,[\s\S]*\}/.test(r.balance)
      || !/hudQuickSettings:\s*\{[\s\S]*places:\s*\['title', 'map', 'combat'\],[\s\S]*edgeGapPx:\s*8,[\s\S]*stackGapPx:\s*4,[\s\S]*showLabels:\s*true,[\s\S]*\}/.test(r.balance)
      || !['--hud-component-background-opacity', '--hud-metadata-font-px', '--hud-belt-item-gap-px', '--hud-portrait-scale', '--hud-primary-row-gap-px', '--hud-control-gap-px', '--hud-resource-row-gap-px', '--hud-cinders-max-width', '--hud-metadata-max-width'].every((name) => r.main.includes(`'${name}'`))
      || !['componentBackgroundOpacityPct', 'metadataFontPx', 'beltItemGapPx', 'portraitScale', 'primaryRowGapPx', 'controlGapPx', 'resourceRowGapPx', 'cindersMaxWidthPct', 'metadataMaxWidthPct', 'metadataShowTotals', 'hudQuickSettings', 'edgeGapPx', 'stackGapPx', 'showLabels'].every((name) => r.validate.includes(name))) {
    bad.push('C11 HUD presentation defaults are no longer data-owned, projected, and validated');
  }
  if (!/build-stamp\[data-seed\]\s*\{[^}]*display:\s*inline-flex;[^}]*align-items:\s*center;[^}]*flex-wrap:\s*nowrap;/.test(r.css)
      || !/font-size:\s*calc\(var\(--hud-metadata-font-px\) \/ var\(--ui-zoom, 1\)\)/.test(r.css)
      || !/background:\s*color-mix\(in srgb, var\(--panel\) var\(--hud-component-background-opacity\), transparent\)/.test(r.css)
      || !/gap:\s*calc\(var\(--hud-belt-item-gap-px\) \/ var\(--ui-zoom, 1\)\)/.test(r.css)
      || !/width:\s*calc\(3\.8rem \* var\(--hud-portrait-scale\)\)/.test(r.css)
      || !/gap:\s*calc\(var\(--hud-primary-row-gap-px\) \/ var\(--ui-zoom, 1\)\)/.test(r.css)
      || !/gap:\s*calc\(var\(--hud-resource-row-gap-px\) \/ var\(--ui-zoom, 1\)\)/.test(r.css)
      || !/grid-template-columns:\s*minmax\(0, 1fr\) fit-content\(var\(--hud-cinders-max-width\)\) minmax\(0, 1fr\)/.test(r.css)
      || !/width:\s*min\(100%, var\(--hud-metadata-max-width\)\)/.test(r.css)
      || !/data-hud-metadata-show-totals='false'/.test(r.css)
      || !/\.hud-potions \.flask-slot\s*\{[^}]*width:\s*var\(--hud-utility-visual-size\);[^}]*min-width:\s*var\(--hud-utility-visual-size\);/.test(r.css)
      || !/@media \(max-width:\s*350px\)[\s\S]*hud-progress-total\s*\{\s*display:\s*none;/.test(r.css)
      || !/\.hud-quick-settings\s*\{[\s\S]*flex-direction:\s*column;/.test(r.uiCss)
      || !/@media \(max-width:\s*420px\)[\s\S]*\.hud-quick-settings\s*\{\s*width:\s*var\(--tap-floor\);/.test(r.uiCss)) {
    bad.push('C12 rendered HUD no longer consumes the horizontal, transparent, uniformly spaced component tokens');
  }
  if (!/export function componentModel/.test(r.componentModel)
      || !/Object\.freeze\(\{[\s\S]*component,[\s\S]*properties:[\s\S]*tokens:[\s\S]*accessibility:[\s\S]*behaviors:[\s\S]*children:/.test(r.componentModel)
      || !/export function behaviorModel/.test(r.behaviorModel)
      || !/export function runHudViewModel/.test(r.hudViewModel)
      || !/runHeaderModel\([\s\S]*vitalsPanelModel\(\)[\s\S]*quickAccessPanelModel\(controls\)[\s\S]*inventoryBeltModel\(place\)[\s\S]*hudQuickSettingsModel\(\{ place, \.\.\.quickSettings \}\)/.test(r.hudViewModel)
      || !/UI\.componentBackground/.test(r.hudModels)
      || !/\.NET-inspired application and Component Model contract/.test(r.spec)) {
    bad.push('C13 shared HUD no longer follows the immutable MVVM Component Model composition');
  }
  const presentationModels = r.menuModels + r.armouryModels;
  if (!/export function quickMenuPanelModel/.test(r.menuModels)
      || !/export function menuOverlayModel/.test(r.menuModels)
      || !/export function armouryPanelModel/.test(r.armouryModels)
      || !/export function equipmentSlotModel/.test(r.armouryModels)
      || !/export function inventoryItemCardModel/.test(r.armouryModels)
      || !/export function renderQuickMenu/.test(r.menuComponents)
      || !/export function renderMenuOverlay/.test(r.menuComponents)
      || !/export function renderArmouryPanel/.test(r.armouryComponents)
      || !/export function renderEquipmentSlot/.test(r.armouryComponents)
      || !/export function renderEquipmentSetCell/.test(r.armouryComponents)
      || !/export function renderInventoryItemCard/.test(r.armouryComponents)
      || !/quickMenuPanelModel\([\s\S]*renderQuickMenu\(/.test(r.quicknav)
      || !/menuOverlayModel\([\s\S]*renderMenuOverlay\(/.test(r.overlay)
      || !/armouryPanelModel\([\s\S]*renderArmouryPanel\(/.test(r.equipment)
      || !/equipmentSlotModel\([\s\S]*renderEquipmentSlot\(/.test(r.equipment)
      || /\b(document|window)\b|innerHTML|createElement/.test(presentationModels)) {
    bad.push('C14 Menu and Armoury no longer compose immutable models into renderer components');
  }
  if (!/export function trayModel/.test(r.trayModels)
      || !/UI\.trayHeader/.test(r.trayModels)
      || !/UI\.trayResizeHandle/.test(r.trayModels)
      || !/UI\.trayContent/.test(r.trayModels)
      || !/export function renderTray/.test(r.trayComponents)
      || /\btrayModel\s*\(/.test(r.armouryModels)
      || !/const regionModels = regions\.map\([\s\S]*return item;/.test(r.armouryModels)
      || !/renderArmouryPanel\([\s\S]*markUiComponent\(wrap\.querySelector\('\.armoury-inventory'\)/.test(r.armouryComponents)
      || !/renderTray\(trayModel\(/.test(r.equipment)
      || !/renderTray\([\s\S]*renderContent:/.test(r.equipment)
      || !/right: Object\.freeze\(\{ closed: '<', open: '>' \}\)/.test(r.trayComponents)
      || !/top: Object\.freeze\(\{ closed: 'v', open: '\^' \}\)/.test(r.trayComponents)
      || !/bottom: Object\.freeze\(\{ closed: '\^', open: 'v' \}\)/.test(r.trayComponents)
      || !/left: Object\.freeze\(\{ closed: '>', open: '<' \}\)/.test(r.trayComponents)
      || !/aria-expanded/.test(r.trayComponents)
      || !/aria-controls/.test(r.trayComponents)
      || !/content\.hidden = !tray\.expanded/.test(r.trayComponents)
      || !/if \(tray\.sortable && tray\.expanded\)/.test(r.trayComponents)
      || !/if \(renderContent\) renderContent\(content, contentModel\.children\)/.test(r.trayComponents)
      || !/\.tray-header \.tray-count\s*\{[^}]*margin-left:\s*auto;/.test(r.uiCss)
      || !/--ui-section-control-gap/.test(r.uiCss)
      || !/--ui-tray-side-margin/.test(r.uiCss)
      || !/--ui-tray-resize-surface:\s*44px/.test(r.uiCss)
      || !/pointerdown/.test(r.trayComponents)
      || !/sizeService\.write/.test(r.trayComponents)
      || /\b(document|window)\b|innerHTML|createElement/.test(r.trayModels)) {
    bad.push('C15 folding regions no longer use the shared edge-aware Tray model and renderer');
  }
  const creationExports = [
    'primaryStatCard', 'resourceStrip', 'viewModeToggle', 'booleanSettingToggle',
    'classChoiceCard', 'classPreviewPane', 'classResourceGrid', 'selectionSectionFace',
    'modeChoiceButton', 'spriteChoiceButton', 'tintChoiceButton', 'sigilChoiceButton',
    'keepsakeChoiceButton', 'relicChoiceButton',
  ];
  const creationIds = REQUIRED_IDS.slice(-16);
  if (!creationExports.every((name) => r.creationCards.includes(`export function ${name}`))
      || !['primaryStatCard', 'resourceStrip', 'viewModeToggle', 'booleanSettingToggle',
        'classChoiceCard', 'classPreviewPane', 'classResourceGrid', 'selectionSectionFace',
        'modeChoice', 'spriteChoice', 'tintChoice', 'sigilChoice', 'keepsakeChoice',
        'relicChoiceCard'].every((name) => r.creationCards.includes(`UI.${name}`))
      || !/UI\.characterDisclosure/.test(r.customize)
      || !/UI\.equipmentChoiceCard/.test(r.customize)
      || !creationIds.every((id) => r.catalogMarkdown.includes(`\`${id}\``)
        && r.catalogHtml.includes(`'${id}'`))) {
    bad.push('C16 Character Creation renderers, stable ids, and both catalogs are no longer synchronized');
  }
  if (!/import \{ hudQuickSettingsHtml, wireHudQuickSettings \}/.test(r.coop)
      || !/import \{ hudQuickSettingsModel \}/.test(r.coop)
      || (r.coop.match(/hudQuickSettingsHtml\(hudQuickSettingsModel\(\{/g) || []).length !== 2
      || (r.coop.match(/wireHudQuickSettings\(app, \{ settings: meta\.settings \|\| \{\}, onSettingsChange \}\)/g) || []).length !== 2
      || !/mountCoop\(app, \{[\s\S]*onSettingsChange/.test(r.main)) {
    bad.push('C17 LAN Map and Combat no longer mount and persist the shared quick settings');
  }
  return bad;
}

function selftest() {
  const clean = receipt();
  const plants = [
    ['remove Vitals id', 'C1 ', (r) => ({ ...r, registry: r.registry.replace("vitalsPanel: 'vitals-panel',", '') })],
    ['remove Vitals export', 'C2 ', (r) => ({ ...r, hud: r.hud.replace('export function vitalsPanelHtml', 'function vitalsPanelHtml') })],
    ['give Map a second HUD', 'C3 ', (r) => ({ ...r, map: r.map.replace('${hudShellHtml(runHudViewModel({', '${(() => "")({') })],
    ['duplicate enemy frame', 'C4 ', (r) => ({ ...r, combat: r.combat.replace(/const box = combatantFrame\(\{\r?\n\s*role: 'enemy'/, "const box = document.createElement('div');\n      box.className = `combatant enemy`;\n      void ({\n        role: 'enemy'") })],
    ['import model into component', 'C5 ', (r) => ({ ...r, hud: `${r.hud}\nimport { resourceBarPlan } from '../../model/resources.js';\n` })],
    ['restore a second header row', 'C6 ', (r) => ({ ...r, css: `${r.css}\n.hud-run-meta { grid-row: 2; }\n` })],
    ['remove Source priority', 'C7 ', (r) => ({ ...r, css: r.css.replace('@container run-header (max-width: 720px)', '@container run-header (max-width: 721px)') })],
    ['remove Hand reference', 'C8 ', (r) => ({ ...r, combat: r.combat.replace('UI.playerHandTray', "'anonymous-hand'") })],
    ['bottom-align enemies', 'C9 ', (r) => ({ ...r, css: r.css.replace('align-items: center; justify-content: space-evenly;', 'align-items: flex-end; justify-content: space-evenly;') })],
    ['remove public id from spec', 'C10 ', (r) => ({ ...r, spec: r.spec.replace('`potion-tray`', 'Potion tray') })],
    ['change transparent default', 'C11 ', (r) => ({ ...r, balance: r.balance.replace('componentBackgroundOpacityPct: 0', 'componentBackgroundOpacityPct: 25') })],
    ['let metadata grid into rows', 'C12 ', (r) => ({ ...r, css: r.css.replace('display: inline-flex;', 'display: inline-grid;') })],
    ['make HUD ViewModel mutable', 'C13 ', (r) => ({ ...r, componentModel: r.componentModel.replace(/return Object\.freeze\(\{\r?\n\s*component,/, 'return ({\n    component,') })],
    ['flatten Menu model into Quick Nav', 'C14 ', (r) => ({ ...r, menuModels: r.menuModels.replace('export function quickMenuPanelModel', 'function quickMenuPanelModel') })],
    ['hand-roll an Armoury tray', 'C15 ', (r) => ({ ...r, equipment: r.equipment.replace('renderTray(', 'renderLegacyRegion(') })],
    ['remove class resource renderer', 'C16 ', (r) => ({ ...r, creationCards: r.creationCards.replace('export function classResourceGrid', 'function classResourceGrid') })],
    ['remove co-op quick settings', 'C17 ', (r) => ({ ...r, coop: r.coop.replace('wireHudQuickSettings(app, { settings: meta.settings || {}, onSettingsChange });', '') })],
  ];
  let failures = 0;
  const cleanBad = findings(clean);
  if (cleanBad.length) { failures++; console.error(`FAIL clean source: ${cleanBad.join('; ')}`); }
  else console.log('PASS clean source: 17/17 reusable component contracts hold');
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
  else console.log('ui-components: OK — 17/17 reusable component contracts hold');
}
