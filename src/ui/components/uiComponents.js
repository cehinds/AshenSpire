// Stable public names for reusable DOM UI assets. Screens may select a
// component by this semantic id, but never duplicate its structure.
export const UI_COMPONENTS = Object.freeze({
  sharedRunHud: 'shared-run-hud',
  runHeaderStrip: 'run-header-strip',
  identityCluster: 'identity-cluster',
  portraitBadge: 'portrait-badge',
  characterTitle: 'character-title',
  cindersCounter: 'cinders-counter',
  buildMetadataTrail: 'build-metadata-trail',
  primaryHudRow: 'primary-hud-row',
  vitalsPanel: 'vitals-panel',
  resourceMeter: 'resource-meter',
  quickAccessPanel: 'quick-access-panel',
  armouryControl: 'armoury-control',
  quickMenuControl: 'quick-menu-control',
  crimsonFlaskControl: 'crimson-flask-control',
  azureFlaskControl: 'azure-flask-control',
  inventoryBelt: 'inventory-belt',
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

export function uiComponentAttrs(component, variant = '') {
  if (!KNOWN_COMPONENTS.has(component)) throw new Error(`Unknown UI component: ${component}`);
  return `data-ui-component="${component}"${variant ? ` data-ui-variant="${variant}"` : ''}`;
}

export function markUiComponent(element, component, variant = '') {
  if (!element) throw new Error(`Cannot mark missing UI component: ${component}`);
  if (!KNOWN_COMPONENTS.has(component)) throw new Error(`Unknown UI component: ${component}`);
  element.dataset.uiComponent = component;
  if (variant) element.dataset.uiVariant = variant;
  return element;
}
