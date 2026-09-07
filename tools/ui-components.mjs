#!/usr/bin/env node
// Reusable UI component contract: stable semantic ids, one shared Map/Combat
// HUD composition, one player/enemy Combatant Frame, and no simulation state
// imported into component modules.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

// A composition names a stable id as the literal attribute, or through the
// ONE home of ids (UI.<camelKey>) when it builds its markup from the kit.
const camel = (id) => id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const mentionsId = (src, id) => src.includes(`data-component="${id}"`) || src.includes(`UI.${camel(id)}`);

const REQUIRED_IDS = Object.freeze([
  'startup-gate', 'startup-ash-field', 'startup-ash-particle', 'startup-mark',
  'startup-wordmark', 'startup-subtitle', 'startup-divider', 'startup-prompt',
  'title-brand-lockup', 'title-wordmark', 'title-subtitle', 'title-divider',
  'title-menu', 'title-menu-item', 'title-menu-gem', 'title-tagline',
  'title-menu-modal', 'title-modal-close-control', 'title-modal-heading',
  'title-modal-divider', 'title-save-slot-list', 'title-save-slot',
  'title-save-slot-copy', 'title-save-slot-state', 'title-save-slot-delete',
  'title-modal-actions', 'title-modal-back-control', 'title-modal-continue-control',
  'shared-run-hud', 'act-route-strip', 'run-header-strip', 'identity-cluster', 'portrait-badge',
  'character-title', 'cinders-counter', 'build-metadata-trail', 'primary-hud-row',
  'vitals-panel', 'resource-meter', 'quick-access-panel', 'armoury-control',
  'quick-menu-control', 'hud-quick-settings', 'hud-mode-grip', 'fullscreen-control', 'music-control',
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
  'save-quit-control', 'controls-rebind-capture', 'controls-key-rebind-control',
  'armoury-overlay', 'armoury-panel',
  'armoury-header', 'armoury-view-switcher', 'armoury-body', 'armoury-figure',
  'equipment-slot', 'equipment-set-cell', 'armoury-inventory', 'inventory-item-card',
  'inventory-detail-card', 'equipment-comparison', 'armoury-stats-panel',
  'armoury-card-strip', 'armoury-region-header',
  'folding-tray', 'tray-header', 'tray-resize-handle', 'tray-content',
  'character-disclosure', 'class-preview-pane', 'class-resource-grid',
  'class-choice-card', 'view-mode-toggle', 'boolean-setting-toggle',
  'selection-section-face', 'primary-stat-card', 'resource-strip', 'mode-choice',
  'stat-allocation-row', 'shrine-option-card', 'smith-upgrade-modal',
  'smith-candidate-card', 'smith-upgrade-preview',
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
      'QuickAccessPanelModel', 'InventoryBeltModel', 'HudQuickSettingsModel', 'HudModeModel',
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
    foldGlyph: read('src/ui/components/foldGlyph.js'),
    traySizeService: read('src/ui/services/TraySizeService.js'),
    armouryUiSource: read('content/source/armouryUi.json'),
    creationCards: read('src/ui/components/creationCards.js'),
    statAllocationCard: read('src/ui/components/statAllocationCard.js'),
    creationBrief: read('src/model/creationBrief.js'),
    customize: read('src/ui/screens/customize.js'),
    rest: read('src/ui/screens/rest.js'),
    smithSelectionModel: read('src/ui/models/SmithSelectionModel.js'),
    saveSlotSelectionModel: read('src/ui/models/SaveSlotSelectionModel.js'),
    smithUpgradeModal: read('src/ui/components/smithUpgradeModal.js'),
    catalogMarkdown: read('docs/COMPONENT-CATALOG.md'),
    catalogHtml: read('docs/component-catalog.html'),
    frame: read('src/ui/components/combatantFrame.js'),
    battlefieldStage: read('src/ui/components/battlefieldStage.js'),
    battlefieldStageModel: read('src/ui/models/BattlefieldStageModel.js'),
    tooltip: read('src/ui/components/tooltip.js'),
    exposure: read('src/ui/components/arcaneExposure.js'),
    fx: read('src/ui/fx.js'),
    buildstamp: read('src/ui/components/buildstamp.js'),
    startupGate: read('src/ui/components/startupGate.js'),
    startupGateModel: read('src/ui/models/StartupGateModels.js'),
    title: read('src/ui/screens/title.js'),
    saveSlotSelector: read('src/ui/components/saveSlotSelector.js'),
    balance: read('src/content/balance.js'),
    main: read('src/main.js'),
    validate: read('src/model/validate.js'),
    map: read('src/ui/screens/map.js'),
    combat: read('src/ui/screens/combat.js'),
    coop: read('src/ui/screens/coop.js'),
    quicknav: read('src/ui/components/quicknav.js'),
    overlay: read('src/ui/components/overlay.js'),
    controls: read('src/ui/screens/controls.js'),
    input: read('src/ui/input.js'),
    equipment: read('src/ui/screens/equipment.js'),
    css: read('styles/combat.css'),
    kit: read('styles/kit.css'),
    uiCss: read('styles/ui.css'),
    kitCss: read('styles/kit.css'),
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
  // The one-line header is class | Cinders | Act/Floor. Build/seed/source stay
  // off this compact surface, but their presentation-model fields remain for
  // consumers that need them.
  if (/buildStampHtml/.test(r.hud)
      || !/class: 'as-chip hud-class'/.test(r.hud)
      || !/class: 'hud-run-meta as-statstrip trail'/.test(r.hud)
      || !/childModel\(model, UI\.metadataField, 'act'\)[\s\S]*childModel\(model, UI\.metadataField, 'floor'\)/.test(r.hud)
      || !/metadataFieldModel\('act'[\s\S]*metadataFieldModel\('floor'[\s\S]*metadataFieldModel\('build'[\s\S]*metadataFieldModel\('seed'[\s\S]*metadataFieldModel\('source'/.test(r.hudModels)
      || !/\.as-statstrip, \.as-kitline \{ display: flex; flex-wrap: wrap;/.test(r.kit)
      || /\.hud-run-meta[^{]*\{/.test(r.css + r.uiCss)) {
    bad.push('C6 the run header is not the one-line Class, Cinders, Act/Floor composition');
  }
  // On a phone a trail keeps the HEAD of each compound fact and drops its TAIL,
  // and there are two shapes of fact in it: the build stamp keeps its number and
  // drops its source, and a progress Chip keeps its value and drops the "/ total"
  // — never the value itself, which one blanket `:nth-child(n+2)` did (measured
  // at 390x844: "ACT" and "FLOOR" with no numbers under them).
  if (!/@media \(max-width: 640px\) \{[\s\S]*?\.as-statstrip\.trail > \.build-stamp > :nth-child\(n\+2\) \{ display: none; \}/.test(r.kit)
      || !/@media \(max-width: 640px\) \{[\s\S]*?\.as-statstrip\.trail > \.as-chip > \.cv > \* \{ display: none; \}/.test(r.kit)
      || !/build-number[\s\S]*build-source/.test(r.buildstamp)) {
    bad.push('C7 metadata does not hide Source then Seed while preserving Build ink');
  }
  if (!/UI\.battlefieldStage/.test(r.combat)
      || !/centerHeightRatio/.test(r.battlefieldStageModel)
      || !/availableHeight \* centerHeightRatio/.test(r.battlefieldStage)
      || !/measureFrame\(frame, model\.tokens\.intentGapPx, model\.tokens\.centerHeightRatio\)/.test(r.battlefieldStage)
      // ONE SCALE FOR THE STAGE (2026-09-04). The stage used to divide each
      // card by its OWN sprite's natural height, so every combatant rendered a
      // different width. It now measures every frame and applies the smallest
      // scale any of them needs — this asserts the reduce and the apply, so a
      // return to per-frame scaling is red.
      || !/measures\.reduce\(\(least, m\) => Math\.min\(least, m\.fits\), 1\)/.test(r.battlefieldStage)
      || !/for \(const measure of measures\) applyFrame\(measure, scale\)/.test(r.battlefieldStage)
      || !/function renderCombatantStage\(\)[\s\S]*?renderPlayer\(\);\s*renderEnemies\(\);[\s\S]*?battlefieldStage\.refresh\(\);[\s\S]*?function render\(\)/.test(r.combat)
      || (r.combat.match(/renderCombatantStage\(\);/g) || []).length < 2
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
  const startupParts = [
    'startup-gate', 'startup-ash-field', 'startup-ash-particle', 'startup-mark',
    'startup-wordmark', 'startup-subtitle', 'startup-divider', 'startup-prompt',
  ];
  const titleParts = [
    'title-brand-lockup', 'title-wordmark', 'title-subtitle', 'title-divider',
    'title-menu', 'title-menu-item', 'title-menu-gem', 'title-tagline',
    'title-menu-modal', 'title-modal-close-control', 'title-modal-heading',
    'title-modal-divider', 'title-save-slot-list', 'title-save-slot',
    'title-save-slot-copy', 'title-save-slot-state', 'title-save-slot-delete',
    'title-modal-actions', 'title-modal-back-control', 'title-modal-continue-control',
  ];
  if (!/export function startupGateModel/.test(r.startupGateModel)
      || !/componentModel\(UI\.startupGate/.test(r.startupGateModel)
      || !/export function mountStartupGate/.test(r.startupGate)
      || !/buildStampHtml\('startup'\)/.test(r.startupGate)
      // The gate's lockup is built by the kit's element factory now
      // (src/ui/kit/index.js `el`), which spells the same attribute as
      // `dataset: { component: '<id>' }`; the ash field and the section are
      // still template strings. Either spelling is the one attribute.
      || !startupParts.every((id) => r.startupGate.includes(`data-component="${id}"`) || r.startupGate.includes(`component: '${id}'`))
      || !titleParts.every((id) => mentionsId(r.title + r.saveSlotSelector, id))
      || ![...startupParts, ...titleParts].every((id) => r.catalogMarkdown.includes(`\`${id}\``)
        && r.catalogHtml.includes(`['${id}'`))
      || /from ['"](?:\.\.\/)+(?:engine|model)\//.test(r.startupGate + r.startupGateModel)) {
    bad.push('C18 startup/title compositions lost a stable subcomponent, immutable gate model, or shared build stamp');
  }
  if (!/hudPresentation:\s*\{[\s\S]*componentBackgroundOpacityPct:\s*0,[\s\S]*metadataFontPx:\s*11,[\s\S]*beltItemGapPx:\s*2,[\s\S]*portraitScale:\s*0\.58,[\s\S]*primaryRowGapPx:\s*4,[\s\S]*controlGapPx:\s*0,[\s\S]*resourceRowGapPx:\s*3,[\s\S]*panelPadPx:\s*0,[\s\S]*mobilePanelPadPx:\s*0,[\s\S]*mobileControlGapPx:\s*1,[\s\S]*mobileOuterPadPx:\s*4,[\s\S]*mobileRowGapPx:\s*3,[\s\S]*cindersMaxWidthPct:\s*30,[\s\S]*metadataMaxWidthPct:\s*30,[\s\S]*metadataShowTotals:\s*false,[\s\S]*\}/.test(r.balance)
      || !/hudQuickSettings:\s*\{[\s\S]*places:\s*\['title', 'map', 'combat'\],[\s\S]*edgeGapPx:\s*4,[\s\S]*stackGapPx:\s*0,[\s\S]*cardSizePx:\s*40,[\s\S]*glyphSizePx:\s*28,[\s\S]*stateDotPx:\s*6,[\s\S]*activeTintPct:\s*14,[\s\S]*showCardBackground:\s*true,[\s\S]*showLabels:\s*false,[\s\S]*\}/.test(r.balance)
      || !/\.resbars\[data-surface="main"\]\s*\{[^}]*gap:\s*calc\(var\(--hud-resource-row-gap-px\)\s*\/\s*var\(--ui-zoom, 1\)\);/.test(r.kit)
      || !['--hud-component-background-opacity', '--hud-metadata-font-px', '--hud-belt-item-gap-px', '--hud-portrait-scale', '--hud-primary-row-gap-px', '--hud-control-gap-px', '--hud-resource-row-gap-px', '--hud-panel-pad-px', '--hud-mobile-panel-pad-px', '--hud-mobile-control-gap-px', '--hud-mobile-outer-pad-px', '--hud-mobile-row-gap-px', '--hud-cinders-max-width', '--hud-metadata-max-width', '--hud-quick-edge-gap', '--hud-quick-stack-gap', '--hud-quick-card-size', '--hud-quick-glyph-size', '--hud-quick-state-dot', '--hud-quick-active-tint'].every((name) => r.main.includes(`'${name}'`))
      || !['componentBackgroundOpacityPct', 'metadataFontPx', 'beltItemGapPx', 'portraitScale', 'primaryRowGapPx', 'controlGapPx', 'resourceRowGapPx', 'panelPadPx', 'mobilePanelPadPx', 'mobileControlGapPx', 'mobileOuterPadPx', 'mobileRowGapPx', 'cindersMaxWidthPct', 'metadataMaxWidthPct', 'metadataShowTotals', 'hudQuickSettings', 'edgeGapPx', 'stackGapPx', 'cardSizePx', 'glyphSizePx', 'stateDotPx', 'activeTintPct', 'showCardBackground', 'showLabels'].every((name) => r.validate.includes(name))) {
    bad.push('C11 HUD presentation defaults are no longer data-owned, projected, and validated');
  }
  // THE RENDERED HUD IS KIT ATOMS: a Band of rows, identity as a StatStrip,
  // receipts as StatChips, a smaller 2 × 2 Quick Access square with protected
  // tap regions, equal Slot faces in the detached under-HUD rail, resources as
  // Meters — and the map alone carries the act route strip.
  if (!/class="topbar combat-hud shared-hud as-band stack/.test(r.hud)
      || !/class: 'hud-identity as-statstrip'/.test(r.hud)
      || !/class: 'as-chip hud-cinders'/.test(r.hud)
      || !/class="hud-control-grid as-cluster stack"/.test(r.hud)
      || !/class="hud-resource-row as-band-row"/.test(r.hud)
      || !/--hud-quick-tile-size:\s*1\.8rem;/.test(r.kit)
      || !/--hud-quick-tile-gap:\s*0\.45rem;/.test(r.kit)
      || !/\.shared-hud \.hud-control-grid :is\(\.as-iconbtn, \.as-slot\) \{[\s\S]*?width: var\(--hud-quick-tile-size\); height: var\(--hud-quick-tile-size\);/.test(r.kit)
      || !/\.shared-hud \.hud-bottom \{[\s\S]*?position: absolute;[\s\S]*?top: calc\(100% \+ 0\.4rem\);[\s\S]*?left: 1\.6rem; right: 1\.6rem;/.test(r.kit)
      || !/\.shared-hud \.hud-bottom \.as-slot \{[\s\S]*?width: var\(--iconbtn-size\); height: var\(--iconbtn-size\);/.test(r.kit)
      || !/\.shared-hud \.hud-bottom \.as-slot::before \{[\s\S]*?width: var\(--hud-belt-tile-face-size\); height: var\(--hud-belt-tile-face-size\);/.test(r.kit)
      || !/iconButton\(\{/.test(r.hud)
      || !/class="as-iconbtn modal-iconbtn hud-quick-setting/.test(r.quickSettings)
      || !/\.as-iconbtn, \.modal-iconbtn, \.modal-close \{[\s\S]*?width: var\(--iconbtn-size\); height: var\(--iconbtn-size\);/.test(r.kit)
      || !/\.as-slot \{[^}]*width: var\(--iconbtn-size\); height: var\(--iconbtn-size\);/.test(r.kit)
      || !/\.as-meter \{/.test(r.kit)
      || /^\s*\.(?:topbar|hud-top|hud-info-row|hud-resource-row|hud-bottom|hud-control-grid|hud-quick-setting)\b[^{]*\{/m.test(r.css)
      || !/actRouteStripHtml\(\{\s*title:\s*actTitle\(run\.actNumber\)\s*\}\)/.test(r.map)
      || /routeTitle|actRouteStripHtml|act-route-strip/.test(r.combat)) {
    bad.push('C12 rendered HUD no longer consumes the horizontal, transparent, uniformly spaced component tokens');
  }
  if (!/export function componentModel/.test(r.componentModel)
      || !/Object\.freeze\(\{[\s\S]*component,[\s\S]*properties:[\s\S]*tokens:[\s\S]*accessibility:[\s\S]*behaviors:[\s\S]*children:/.test(r.componentModel)
      || !/export function behaviorModel/.test(r.behaviorModel)
      || !/export function runHudViewModel/.test(r.hudViewModel)
      // The composition is four children since 2026-09-05, not five: the
      // fullscreen/music pair left the band ("the full screen and music buttons
      // don't need to be there since we have it in the quick and main menu
      // settings"), so there is no `hudQuickSettingsModel` child to compose.
      // The ORDER of what remains is still pinned, which is what this line is
      // for, and the second clause pins the removal itself so the child cannot
      // reappear without a finding.
      || !/runHeaderModel\([\s\S]*vitalsPanelModel\(\)[\s\S]*quickAccessPanelModel\(controls\)[\s\S]*inventoryBeltModel\(place\)[\s\S]*hudModeGripModel\(\{ mode: hudMode \}\)/.test(r.hudViewModel)
      || /hudQuickSettingsModel\(\{ place/.test(r.hudViewModel)
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
      // THE EDGE TABLE MOVED, AND THE ASSERTION FOLLOWED IT RATHER THAN BEING
      // DROPPED. What C15 has always guarded is that a tray's mark is EDGE-AWARE
      // and frozen — four edges, each with a closed and an open answer — not
      // which file holds it or which characters it spends. Both changed on
      // 2026-09-02: the table is foldGlyph.js (one home for every disclosure
      // mark in the tree, after a census found four families for one idea) and
      // the ASCII letters `v ^ < >` became the triangle family `▾ ▴ ◂ ▸`. The
      // shape of the guard is identical; a hand that deletes an edge, unfreezes
      // the table, or lets trayComponents.js grow a second one still reds.
      || !/right: Object\.freeze\(\{ closed: '◂', open: '▸' \}\)/.test(r.foldGlyph)
      || !/top: Object\.freeze\(\{ closed: '▾', open: '▴' \}\)/.test(r.foldGlyph)
      || !/bottom: Object\.freeze\(\{ closed: '▴', open: '▾' \}\)/.test(r.foldGlyph)
      || !/left: Object\.freeze\(\{ closed: '▸', open: '◂' \}\)/.test(r.foldGlyph)
      || !/export const TRAY_FOLD_GLYPH = Object\.freeze\(/.test(r.foldGlyph)
      || !/TRAY_FOLD_GLYPH as GLYPHS/.test(r.trayComponents)
      || !/aria-expanded/.test(r.trayComponents)
      || !/aria-controls/.test(r.trayComponents)
      || !/content\.hidden = !tray\.expanded/.test(r.trayComponents)
      || !/if \(tray\.sortable && tray\.expanded\)/.test(r.trayComponents)
      || !/if \(renderContent\) renderContent\(content, contentModel\.children\)/.test(r.trayComponents)
      // 2026-09-04 (the sweep): the Folding Tray is the kit's `.as-tray`
      // (styles/kit.css FOLDING TRAY). Its header is a kit Row — the count is
      // the Row's StatusText, pushed to the trailing edge by the Row's own rule
      // — the side trays carry their margin on the kit frame, and the resize
      // grip's touch surface is the tap floor itself, not a typed 44px.
      || !/\.as-row > \.as-status, \.as-row > \.r-trail \{ margin-left: auto; \}/.test(r.kitCss)
      || !/\.as-tray > \.tray-header \{[^}]*gap: 0\.75rem;/.test(r.kitCss)
      || !/\.as-tray\[data-tray-edge="left"\] \{ margin-block: 0\.6rem; margin-left: 0\.6rem; \}/.test(r.kitCss)
      || !/\.as-tray > \.tray-resize-handle\[data-ui-variant="top"\], \.as-tray > \.tray-resize-handle\[data-ui-variant="bottom"\] \{[^}]*height: var\(--tap-floor\);/.test(r.kitCss)
      || !/pointerdown/.test(r.trayComponents)
      || !/sizeService\.write/.test(r.trayComponents)
      || !/reset\(\)/.test(r.traySizeService)
      || !/return null;/.test(r.traySizeService)
      || !/"defaultHeightRatio": 0\.45/.test(r.armouryUiSource)
      || !/"minimumHeightRatio": 0\.3/.test(r.armouryUiSource)
      || !/"snapRatios": \[0\.3, 0\.4, 0\.5, 0\.6, 0\.7, 0\.8, 0\.9\]/.test(r.armouryUiSource)
      || /meta\.settings\.armouryTrayHeights/.test(r.equipment)
      || !/resetArmouryTraySession/.test(r.equipment)
      // 2026-09-04 (the sweep): a tray's share is a share of the DOOR'S BODY,
      // never of the glass — `vh` below the zoomed <body> is the law this file
      // is named for. The remembered height is a percentage of the host the
      // screen measures (`hostHeight`), and an arrival without one hugs its
      // content under the kit's compact cap instead of claiming a share.
      || !/const hostHeight = \(\) => Math\.max\(1, wrap\.querySelector\('\.armoury-shell-body'\)\?\.clientHeight \|\| 1\)/.test(r.equipment)
      || !/style\.minHeight = `\$\{layout\.trays\.multipleExpandedMinimumRatio \* 100\}%`/.test(r.equipment)
      || !/style\.height = `\$\{savedRatio \* 100\}%`/.test(r.equipment)
      || /\d\s*}?vh`/.test(r.equipment)
      || /\b(document|window)\b|innerHTML|createElement/.test(r.trayModels)) {
    bad.push('C15 folding regions no longer use the shared edge-aware Tray model and renderer');
  }
  const creationExports = [
    'primaryStatCard', 'resourceStrip', 'viewModeToggle', 'booleanSettingToggle',
    'classChoiceCard', 'classPreviewPane', 'classResourceGrid', 'selectionSectionFace',
    'modeChoiceButton', 'spriteChoiceButton', 'tintChoiceButton', 'sigilChoiceButton',
    'keepsakeChoiceButton', 'relicChoiceButton',
  ];
  const creationIds = [
    'character-disclosure', 'class-preview-pane', 'class-resource-grid', 'class-choice-card',
    'view-mode-toggle', 'boolean-setting-toggle', 'selection-section-face', 'primary-stat-card',
    'stat-allocation-row', 'shrine-option-card', 'resource-strip', 'mode-choice',
    'sprite-choice', 'tint-choice', 'sigil-choice', 'keepsake-choice',
    'equipment-choice-card', 'relic-choice-card',
  ];
  if (!creationExports.every((name) => r.creationCards.includes(`export function ${name}`))
      || !['primaryStatCard', 'resourceStrip', 'viewModeToggle', 'booleanSettingToggle',
        'classChoiceCard', 'classPreviewPane', 'classResourceGrid', 'selectionSectionFace',
        'modeChoice', 'spriteChoice', 'tintChoice', 'sigilChoice', 'keepsakeChoice',
        'relicChoiceCard'].every((name) => r.creationCards.includes(`UI.${name}`))
      || !/UI\.characterDisclosure/.test(r.customize)
      || !/UI\.equipmentChoiceCard/.test(r.customize)
      || !/export function attributeCardModels/.test(r.creationBrief)
      || !/mountDisclosure\(host, \[model\]\)/.test(r.creationCards)
      || !/primaryStatCard\(/.test(r.statAllocationCard)
      || !/UI\.statAllocationRow/.test(r.statAllocationCard)
      || !/UI\.shrineOptionCard/.test(r.rest)
      || !/attributeCardModels\(registries, state\.attributes,/.test(r.customize)
      || !/attributeCardModels\(registries, values,/.test(r.rest)
      || !/attributeCardModels\(registries, run\.attributes/.test(r.equipment)
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
  const smithIds = ['smith-upgrade-modal', 'smith-candidate-card', 'smith-upgrade-preview'];
  if (!/export function smithSelectionModel/.test(r.smithSelectionModel)
      || /\b(document|window)\b|innerHTML|createElement/.test(r.smithSelectionModel)
      || !/function groupedAffected\(cards\)/.test(r.smithSelectionModel)
      || !/itemRef,/.test(r.smithSelectionModel)
      || !/currentLevel:\s*candidate\.currentLevel[\s\S]*nextLevel:\s*candidate\.nextLevel[\s\S]*cost:\s*candidate\.cost[\s\S]*stones:\s*candidate\.stones[\s\S]*shortfall:\s*candidate\.shortfall[\s\S]*affordable:\s*candidate\.affordable/.test(r.smithSelectionModel)
      || !/affectedRows:\s*itemKind === 'armament'[\s\S]*groupedAffected\(candidate\.previewCards \|\| candidate\.affectedCards\)[\s\S]*genericAffected\(candidate\)/.test(r.smithSelectionModel)
      || !/canConfirm:\s*Boolean\(selected\?\.affordable\)/.test(r.smithSelectionModel)
      || !/export function mountSmithUpgradeModal/.test(r.smithUpgradeModal)
      || !/role', 'dialog'/.test(r.smithUpgradeModal)
      || !/aria-modal/.test(r.smithUpgradeModal)
      // The two ways out are kit buttons now (builder form), or literal markup.
      || !/(<button[^>]+smith-back|className: '[^']*smith-back')/.test(r.smithUpgradeModal)
      || !/(<button[^>]+smith-confirm|className: '[^']*smith-confirm')/.test(r.smithUpgradeModal)
      || !/attachTooltip\(card/.test(r.smithUpgradeModal)
      || !/card\.dataset\.itemRef = item\.itemRef/.test(r.smithUpgradeModal)
      || !/Tier \$\{item\.currentLevel\} → \$\{item\.nextLevel\}/.test(r.smithUpgradeModal)
      || !/selected\.affectedRows\.map/.test(r.smithUpgradeModal)
      || !/confirm\.disabled = !selected/.test(r.smithUpgradeModal)
      || !/confirm\.setAttribute\('aria-disabled', String\(!model\.properties\.canConfirm\)\)/.test(r.smithUpgradeModal)
      || !/canCommit: \(\) => Boolean\(currentModel\.properties\.canConfirm\)/.test(r.smithUpgradeModal)
      || !/blockedTitle: `Cannot upgrade \$\{selected\.name\}`/.test(r.smithUpgradeModal)
      || !/onConfirm\(selectedId\)/.test(r.smithUpgradeModal)
      || !/returnFocusElement: smithOption/.test(r.rest)
      || !/const smith = smithingPlan\(registries, run\)/.test(r.rest)
      // #522: the Shrine hands the model its multi-use mode, and the model —
      // never the modal — derives every stay/leave sentence from it.
      || !/smithSelectionModel\(registries, smithingPlan\(registries, run\), selectedItemRef, \{ multiUse \}\)/.test(r.rest)
      || !/mountSmithUpgradeModal\(app, model\(\)/.test(r.rest)
      || !/commitSmithing\(registries, run, itemRef\)/.test(r.rest)
      || !smithIds.every((id) => r.catalogMarkdown.includes(`\`${id}\``)
        && r.catalogHtml.includes(`'${id}'`))) {
    bad.push('C19 Smith selection no longer uses its model-driven Back/preview/Confirm modal contract');
  }
  if (!/export function saveSlotSelectionModel/.test(r.saveSlotSelectionModel)
      || /\b(document|window)\b|innerHTML|createElement/.test(r.saveSlotSelectionModel)
      || !/componentModel\(UI\.titleSaveSlotList/.test(r.saveSlotSelectionModel)
      || !/componentModel\(UI\.titleSaveSlot,/.test(r.saveSlotSelectionModel)
      || !/componentModel\(UI\.titleModalContinueControl/.test(r.saveSlotSelectionModel)
      || !/command: 'select-save-slot'/.test(r.saveSlotSelectionModel)
      || !/command: kind === 'new' \|\| !selected\.hasSave \? 'create-in-save-slot' : 'load-save-slot'/.test(r.saveSlotSelectionModel)
      || !/import \{ saveSlotSelectionModel \}/.test(r.title)
      || !/const selectionModel = \(kind = modal\) => saveSlotSelectionModel\(slots, \{ kind, selectedSlot \}\)/.test(r.title)
      || !/openNewReview\(selectionModel\(\)\.properties\.actionSlot\)/.test(r.title)) {
    bad.push('C20 title save slots no longer derive selected styling and the primary command target from one immutable model');
  }
  const controlsIds = ['controls-rebind-capture', 'controls-key-rebind-control'];
  if (!/export const REBIND_CAPTURE_SERVICE_ID = 'rebind-capture-service'/.test(r.input)
      || !/ev\.stopImmediatePropagation\(\);[\s\S]*if \(k === 'Escape'\)/.test(r.input)
      || !/capture\.onCancel\?\.\(\)/.test(r.input)
      || !/UI\.controlsRebindCapture/.test(r.controls)
      || !/UI\.controlsKeyRebindControl/.test(r.controls)
      || !/onCancel:[\s\S]*reset\(btn, 'Key'\)[\s\S]*btn\.focus/.test(r.controls)
      || !controlsIds.every((id) => r.catalogMarkdown.includes(`\`${id}\``)
        && r.catalogHtml.includes(`['${id}'`))) {
    bad.push('C21 Controls rebind capture lost its stable ids or armed-Escape ownership contract');
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
    ['remove Floor from the header trail', 'C6 ', (r) => ({ ...r, hud: r.hud.replace("childModel(model, UI.metadataField, 'floor')", "childModel(model, UI.metadataField, 'seed')") })],
    ['restore oversized Quick Access tiles', 'C12 ', (r) => ({ ...r, kit: r.kit.replace('--hud-quick-tile-size: 1.8rem', '--hud-quick-tile-size: var(--iconbtn-size)') })],
    ['put Relics and potions back inside the HUD flow', 'C12 ', (r) => ({ ...r, kit: r.kit.replace('position: absolute;\n  z-index: 85;', 'position: static;\n  z-index: auto;') })],
    ['remove Source priority', 'C7 ', (r) => ({ ...r, kit: r.kit.replace('.as-statstrip.trail > .build-stamp > :nth-child(n+2) { display: none; }', '.as-statstrip.trail > .build-stamp > :nth-child(n+1) { display: none; }') })],
    // The other half of the same rung: a phone that drops the chip's VALUE
    // instead of its total is the defect the photograph caught.
    ['the phone trail drops each fact value instead of its tail', 'C7 ', (r) => ({ ...r, kit: r.kit.replace('.as-statstrip.trail > .as-chip > .cv > * { display: none; }', '.as-statstrip.trail > .as-chip > :nth-child(n+2) { display: none; }') })],
    ['remove Hand reference', 'C8 ', (r) => ({ ...r, combat: r.combat.replace('UI.playerHandTray', "'anonymous-hand'") })],
    ['bottom-align enemies', 'C9 ', (r) => ({ ...r, css: r.css.replace('align-items: center; justify-content: space-evenly;', 'align-items: flex-end; justify-content: space-evenly;') })],
    ['remove public id from spec', 'C10 ', (r) => ({ ...r, spec: r.spec.replace('`potion-tray`', 'Potion tray') })],
    ['change transparent default', 'C11 ', (r) => ({ ...r, balance: r.balance.replace('componentBackgroundOpacityPct: 0', 'componentBackgroundOpacityPct: 25') })],
    ['draw a fourth button weight for the HUD', 'C12 ', (r) => ({ ...r, hud: r.hud.replace(/iconButton\(\{/g, 'button({') })],
    ['make HUD ViewModel mutable', 'C13 ', (r) => ({ ...r, componentModel: r.componentModel.replace(/return Object\.freeze\(\{\r?\n\s*component,/, 'return ({\n    component,') })],
    ['flatten Menu model into Quick Nav', 'C14 ', (r) => ({ ...r, menuModels: r.menuModels.replace('export function quickMenuPanelModel', 'function quickMenuPanelModel') })],
    ['hand-roll an Armoury tray', 'C15 ', (r) => ({ ...r, equipment: r.equipment.replace('renderTray(', 'renderLegacyRegion(') })],
    ['remove class resource renderer', 'C16 ', (r) => ({ ...r, creationCards: r.creationCards.replace('export function classResourceGrid', 'function classResourceGrid') })],
    ['remove co-op quick settings', 'C17 ', (r) => ({ ...r, coop: r.coop.replace('wireHudQuickSettings(app, { settings: meta.settings || {}, onSettingsChange });', '') })],
    ['detach startup from its component model', 'C18 ', (r) => ({ ...r, startupGateModel: r.startupGateModel.replace('export function startupGateModel', 'function startupGateModel') })],
    ['remove Smith Back control', 'C19 ', (r) => ({ ...r, smithUpgradeModal: r.smithUpgradeModal.replace('smith-back', 'smith-return') })],
    ['detach title from save-slot selection model', 'C20 ', (r) => ({ ...r, title: r.title.replace('import { saveSlotSelectionModel }', 'import { detachedSaveSlotSelectionModel }') })],
    ['let armed Escape reach the overlay', 'C21 ', (r) => ({ ...r, input: r.input.replace('ev.stopImmediatePropagation();\n    const capture = keyCapture;', 'ev.stopPropagation();\n    const capture = keyCapture;') })],
  ];
  let failures = 0;
  const cleanBad = findings(clean);
  if (cleanBad.length) { failures++; console.error(`FAIL clean source: ${cleanBad.join('; ')}`); }
  else console.log('PASS clean source: 21/21 reusable component contracts hold');
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
  else console.log('ui-components: OK — 21/21 reusable component contracts hold');
}
