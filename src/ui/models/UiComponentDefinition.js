// Canonical presentation-component manifest. The runtime ID registry and the
// developer component catalog both project from these immutable definitions,
// so a merged dev change cannot update one without updating the other.

const COMPOSITIONS = Object.freeze({
  quickMenuPanel: ['quick-menu-caption', 'quick-menu-row × N'],
  menuOverlay: ['menu-tab-strip', 'menu-tab × N', 'menu-panel'],
  armouryOverlay: ['armoury-panel'],
  foldingTray: ['tray-header', 'tray-resize-handle (expanded)', 'tray-content → context region component'],
  armouryPanel: ['armoury-header', 'armoury-view-switcher', 'subject region (default: armoury-body)', 'folding-tray × 3'],
  armouryBody: ['armoury-figure', 'equipment-slot × N'],
  equipmentSlot: ['equipment-set-cell × N'],
  armouryInventory: ['inventory-item-card × N', 'inventory-detail-card', 'equipment-comparison'],
  battlefieldStage: ['component-background', 'player-combatant-frame', 'enemy-combatant-frame × N'],
  combatantFrame: ['component-background', 'combatant-sprite', 'combatant-nameplate', 'health-status-bar', 'poise-status-bar', 'proc-status-bar', 'arcane-exposure-bar', 'status-effect-tray', 'intent-indicator', 'block-badge'],
  playerCombatantFrame: ['combatant-frame'],
  enemyCombatantFrame: ['combatant-frame', 'intent-indicator'],
  damageFeedback: ['guarded-damage-indicator', 'health-damage-indicator'],
});

const DEFINITIONS = [
  ['sharedRunHud','runHudViewModel','hudmeta.sharedRunHudHtml','hud','Map + Combat','Shared composition of header, resources, controls, and belt.','sharedHud'],
  ['runHeaderStrip','runHeaderModel','hudmeta.runHeaderStripHtml','hud','Map + Combat','Identity, cinders, and prioritized metadata.','runHeader'],
  ['identityCluster','identityClusterModel','hudmeta.identityClusterHtml','hud','Map + Combat','Character identity cluster.','identityCluster'],
  ['portraitBadge','componentModel child','hudmeta.identityClusterHtml','primitive','Map + Combat','Character glyph/badge.','portraitBadge'],
  ['characterTitle','componentModel child','hudmeta.identityClusterHtml','primitive','Map + Combat','Name and class label.','characterTitle'],
  ['cindersCounter','cindersCounterModel','hudmeta.cindersCounterHtml','hud','Map + Combat','Live cinders count.','cindersCounter'],
  ['buildMetadataTrail','buildMetadataTrailModel','hudmeta.buildMetadataTrailHtml','hud','Map + Combat','Act, floor, seed, build, and source.','buildTrail'],
  ['metadataField','metadataFieldModel','hudmeta metadata spans','primitive','Map + Combat','One prioritized metadata field.','metadataField'],
  ['primaryHudRow','componentModel composition','hudmeta.primaryHudRowHtml','hud','Map + Combat','Vitals and Quick Access row.','primaryRow'],
  ['panel','panelModel child','shared panel frame','primitive','HUD panels','Common panel semantic/frame component.','panel'],
  ['componentBackground','componentModel child','panel + combatant CSS','primitive','Panels + combat cards','Reusable opacity, tint, border, and backing layer.','componentBackground'],
  ['vitalsPanel','vitalsPanelModel','hudmeta.vitalsPanelHtml','hud','Map + Combat','HP, MP, and SP panel.','vitalsPanel'],
  ['resourceMeter','componentModel child','resbars.resourceBars','hud','HUD + combat cards','Data-driven resource trough/fill.','resourceMeter'],
  ['quickAccessPanel','quickAccessPanelModel','hudmeta.quickAccessPanelHtml','hud','Map + Combat','Armoury, menu, and charge flasks.','quickPanel'],
  ['actionControl','actionControlModel child','hudmeta quick access','primitive','HUD controls','Shared activation semantics.','actionControl'],
  ['hotkeyBadge','componentModel semantic ID','view-owned','primitive','HUD controls','Configurable key hint badge.','hotkeyBadge'],
  ['armouryControl','actionControlModel','quick access view','hud','Map + Combat','Opens Armoury.','armouryControl'],
  ['quickMenuControl','actionControlModel','quick access view','hud','Map + Combat','Opens Quick Menu.','quickMenuControl'],
  ['quickMenuPanel','quickMenuPanelModel','menuComponents.renderQuickMenu','menu','Map + Combat + Overlay','Contextual Quick Menu dropdown.','quickMenuPanel'],
  ['quickMenuCaption','quickMenuCaptionModel','menuComponents.renderQuickMenu','menu','Quick Menu','Variant/status caption.','quickMenuCaption'],
  ['quickMenuRow','quickMenuRowModel','menuComponents.renderQuickMenu','menu','Quick Menu','One context-specific menu action.','quickMenuRow'],
  ['menuOverlay','menuOverlayModel','menuComponents.renderMenuOverlay','menu','Map + Combat','Full tabbed in-run menu.','menuOverlay'],
  ['menuTabStrip','menuTabStripModel','menuComponents.renderMenuOverlay','menu','Menu Overlay','Shared tab navigation strip.','menuTabStrip'],
  ['menuTab','menuTabModel','menuComponents.renderMenuOverlay','menu','Menu Overlay','One Deck/Relics/Stats/Save/Settings/Controls tab.','menuTab'],
  ['menuPanel','menuPanelModel','menuComponents.updateMenuSelection','menu','Menu Overlay','Active tab content host.','menuPanel'],
  ['crimsonFlaskControl','componentModel','flask.flaskPresentation','hud','Map + Combat','Health charge flask.','crimsonFlask'],
  ['azureFlaskControl','componentModel','flask.flaskPresentation','hud','Map + Combat','Mana charge flask.','azureFlask'],
  ['inventoryBelt','inventoryBeltModel','hudmeta.inventoryBeltHtml','inventory','Map + Combat','Shared relic/potion belt.','inventoryBelt'],
  ['itemTray','itemTrayModel child','belt view','primitive','Inventory','Shared horizontal tray behavior.','itemTray'],
  ['itemSlot','componentModel semantic ID','item view','primitive','Inventory','Generic item slot contract.','itemSlot'],
  ['foldingTray','trayModel','trayComponents.renderTray','primitive','Armoury + future menus','Edge-aware disclosure composition.','foldingTray'],
  ['trayHeader','trayHeaderModel child','trayComponents.renderTray','primitive','Folding Tray','Directional fold action, name, quantity, and optional sort.','trayHeader'],
  ['trayResizeHandle','trayResizeHandleModel child','trayComponents.renderTray','primitive','Expanded Folding Tray','44px mouse, touch-hold, and keyboard resize surface.','trayResizeHandle'],
  ['trayContent','trayContentModel child','trayComponents.renderTray','primitive','Folding Tray','Pluggable item-model content host.','trayContent'],
  ['relicTray','itemTrayModel','belt view','inventory','Map + Combat','Relics under SP.','relicTray'],
  ['relicSlot','componentModel semantic ID','item view','primitive','Map + Combat','Individual relic tile.','relicSlot'],
  ['potionTray','itemTrayModel','belt view','inventory','Map + Combat','Utility potion tray, right anchored.','potionTray'],
  ['potionControl','componentModel semantic ID','item view','primitive','Inventory','Individual utility potion control.','potionControl'],
  ['armouryOverlay','armouryOverlayModel','armouryComponents.renderArmouryOverlay','armoury','Map + Combat','Modal Armoury veil and focus scope.','armouryOverlay'],
  ['armouryPanel','armouryPanelModel','armouryComponents.renderArmouryPanel','armoury','Armoury','Complete Armoury surface.','armouryPanel'],
  ['armouryHeader','armouryHeaderModel','armouryComponents.renderArmouryPanel','armoury','Armoury','Title, view controls, and close action.','armouryHeader'],
  ['armouryViewSwitcher','armouryViewSwitcherModel','armouryComponents.renderArmouryPanel','armoury','Armoury','Grid/Rack/Hybrid view selector.','armouryViewSwitcher'],
  ['armouryBody','armouryBodyModel','armouryComponents.renderArmouryPanel','armoury','Armoury','Responsive figure and slot workspace.','armouryBody'],
  ['armouryFigure','componentModel semantic ID','equipment.js + assets.js','armoury','Armoury','Layered equipped character figure.','armouryFigure'],
  ['equipmentSlot','equipmentSlotModel','armouryComponents.renderEquipmentSlot','armoury','Armoury','One named equipment socket and its sets.','equipmentSlot'],
  ['equipmentSetCell','equipmentSetCellModel','armouryComponents.renderEquipmentSetCell','armoury','Equipment Slot','One active, empty, or locked set cell.','equipmentSetCell'],
  ['armouryInventory','armouryInventoryModel','equipment.js inside renderTray','armoury','Armoury','Shared carried-item inventory content.','armouryInventory'],
  ['inventoryItemCard','inventoryItemCardModel','armouryComponents.renderInventoryItemCard','armoury','Armoury Inventory','Collapsed carried-item summary.','inventoryItemCard'],
  ['inventoryDetailCard','inventoryDetailCardModel','armouryComponents.renderInventoryDetailCard','armoury','Armoury Inventory','Expanded item art, tags, mods, and action.','inventoryDetailCard'],
  ['equipmentComparison','componentModel semantic ID','equipmentReceipts.js','armoury','Armoury Inventory','Before/after equipment receipt.','equipmentComparison'],
  ['armouryStatsPanel','armouryStatsPanelModel','equipment.js','armoury','Armoury','Attributes and derived resource projection.','armouryStatsPanel'],
  ['armouryCardStrip','armouryCardStripModel','equipment.js + card.js','armoury','Armoury','Live card rewrites from equipped pieces.','armouryCardStrip'],
  ['armouryRegionHeader','compatibility semantic ID','replaced by tray-header','armoury','Armoury','Historical Armoury-only fold-header name.','armouryRegionHeader'],
  ['battlefieldStage','componentModel','combat.js','combat','Combat','Combat scene/stage host.','battlefieldStage'],
  ['combatantFrame','combatantFrame','combatantFrame.js','combat','Combat','Shared combatant card geometry.','combatantFrame'],
  ['playerCombatantFrame','combatantFrame variant','combatantFrame.js','combat','Combat','Player combatant card.','playerFrame'],
  ['enemyCombatantFrame','combatantFrame variant','combatantFrame.js','combat','Combat','Enemy combatant card.','enemyFrame'],
  ['combatantSprite','combatantFrame child','combatantFrame.js + assets.js','combat','Combat cards','Rendered player or enemy figure.','combatantSprite'],
  ['combatantNameplate','combatantFrame child','combatantFrame.js','combat','Combat cards','Combatant name label.','combatantNameplate'],
  ['intentIndicator','componentModel semantic ID','combat.js + uiContent.js','combat','Enemy combat cards','Telegraphed enemy action and amount.','intentIndicator'],
  ['blockBadge','componentModel semantic ID','combat.js','combat','Combat cards','Current Guard/Block value over the sprite.','blockBadge'],
  ['healthStatusBar','resourceMeter variant','resbars.js','combat','Combat cards','Individual combatant HP bar.','healthStatusBar'],
  ['poiseStatusBar','resourceMeter variant','resbars.js','combat','Combat cards','Individual combatant Poise bar.','poiseStatusBar'],
  ['procStatusBar','componentModel semantic ID','combat.js','combat','Enemy combat cards','Individual threshold buildup bar such as Bleed.','procStatusBar'],
  ['arcaneExposureBar','componentModel semantic ID','arcaneExposure.js','combat','Enemy combat cards','Individual Arcane Exposure meter.','arcaneExposureBar'],
  ['statusEffectTray','componentModel semantic ID','combat.js','combat','Combat cards','Row of active status icons and stacks.','statusEffectTray'],
  ['tooltip','componentModel semantic ID','tooltip.js','primitive','All interactive surfaces','Shared contextual explanation surface.','tooltip'],
  ['damageFeedback','componentModel semantic ID','fx.js','combat','Combat feedback','One hit receipt composed from Guard and HP channels.','damageFeedback'],
  ['guardedDamageIndicator','damageFeedback variant','fx.js','combat','Combat feedback','Amount absorbed by Guard.','guardedDamage'],
  ['healthDamageIndicator','damageFeedback variant','fx.js','combat','Combat feedback','Residual damage applied to HP.','healthDamage'],
  ['playerHandTray','componentModel','combat.js + hand.js','combat','Combat','Player card hand.','playerHand'],
  ['combatActionRail','componentModel','combat.js','combat','Combat','End-turn/action controls.','actionRail'],
];

function idFromKey(key) {
  return key.replace(/([a-z\d])([A-Z])/g, '$1-$2').toLowerCase();
}

function nameFromId(id) {
  const acronyms = Object.freeze({ hud: 'HUD', ui: 'UI' });
  return id.split('-').map((word) => acronyms[word] || `${word[0].toUpperCase()}${word.slice(1)}`).join(' ');
}

export const UI_COMPONENT_CATALOG = Object.freeze(DEFINITIONS.map(([key, model, owner, group, reuse, purpose, visual]) => {
  const id = idFromKey(key);
  return Object.freeze({
    key,
    id,
    name: nameFromId(id),
    model,
    owner,
    group,
    reuse,
    purpose,
    visual,
    composition: Object.freeze([...(COMPOSITIONS[key] || [])]),
  });
}));

export const UI_COMPONENTS = Object.freeze(Object.fromEntries(
  UI_COMPONENT_CATALOG.map((definition) => [definition.key, definition.id]),
));

export function uiComponentDefinition(componentId) {
  return UI_COMPONENT_CATALOG.find((definition) => definition.id === componentId) || null;
}
