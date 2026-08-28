// Presentation component identifiers. This is the UI equivalent of a small
// enum: Component Models and Views share the names without either owning the
// other's implementation.
export const UI_COMPONENTS = Object.freeze({
  sharedRunHud: 'shared-run-hud',
  runHeaderStrip: 'run-header-strip',
  identityCluster: 'identity-cluster',
  portraitBadge: 'portrait-badge',
  characterTitle: 'character-title',
  cindersCounter: 'cinders-counter',
  buildMetadataTrail: 'build-metadata-trail',
  metadataField: 'metadata-field',
  primaryHudRow: 'primary-hud-row',
  panel: 'panel',
  vitalsPanel: 'vitals-panel',
  resourceMeter: 'resource-meter',
  quickAccessPanel: 'quick-access-panel',
  actionControl: 'action-control',
  hotkeyBadge: 'hotkey-badge',
  armouryControl: 'armoury-control',
  quickMenuControl: 'quick-menu-control',
  crimsonFlaskControl: 'crimson-flask-control',
  azureFlaskControl: 'azure-flask-control',
  inventoryBelt: 'inventory-belt',
  itemTray: 'item-tray',
  itemSlot: 'item-slot',
  relicTray: 'relic-tray',
  relicSlot: 'relic-slot',
  potionTray: 'potion-tray',
  potionControl: 'potion-control',
  battlefieldStage: 'battlefield-stage',
  combatantFrame: 'combatant-frame',
  playerCombatantFrame: 'player-combatant-frame',
  enemyCombatantFrame: 'enemy-combatant-frame',
  playerHandTray: 'player-hand-tray',
  combatActionRail: 'combat-action-rail',
});

const KNOWN_COMPONENTS = new Set(Object.values(UI_COMPONENTS));

export function isUiComponentId(component) {
  return KNOWN_COMPONENTS.has(component);
}
