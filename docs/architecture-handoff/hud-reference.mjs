export const hudConfig = {
  context: 'combat', enabled: true, layoutPreset: 'proposed', hudMode: 'expanded',
  layers: { header: true, class: true, cinders: true, position: true, vitality: true, health: true, mana: true, stamina: true, armoury: true, menu: true, rail: true, relics: true, potions: true, experience: true, chargeFlasks: true, modeGrip: false },
  experience: { contexts: ['combat'], color: '#398bd1', heightRem: 0.35, animationMs: 650, awardPreview: 15 },
  layout: { gapRem: 0.35, insetRem: 0.5, meterHeightRem: 1.15, actionHeightRem: 2.75, radiusRem: 0.25 },
  colors: { background: '#211a12', gold: '#d5af68', text: '#eee2ca', health: '#668c46', mana: '#478dbc', stamina: '#bf9949' },
  sample: { className: 'Warden', cinders: 120, act: 1, floor: 4, health: { value: 32, maximum: 40 }, mana: { value: 6, maximum: 10 }, stamina: { value: 8, maximum: 12 }, experience: { value: 40, maximum: 100 }, relics: ['Ash seal', 'Ember charm'], potions: ['Smoke vial ×1'], chargeFlasks: ['HP ×2', 'MP ×1'] }
};
export const hudSourceSnapshots={ current:{commit:'3c70be90',root:'D:/repos/AshenSpire',status:'Owner checkout including local edits; see CURRENT-SOURCE-AUDIT.md'},baseline:{commit:'c618177a',root:'D:/repos/AshenSpire-wireframe-docs',status:'Documentation branch baseline'} };
export const hudSources = {
  WGH0: ['src/ui/viewModels/RunHudViewModel.js', 'src/ui/components/hudmeta.js'],
  WGH1: ['src/ui/components/hudmeta.js#vitalsPanelHtml', 'src/ui/components/resbars.js', 'src/ui/models/VitalsPanelModel.js'],
  WGH2: ['src/ui/components/hudmeta.js#quickAccessPanelHtml', 'src/ui/models/QuickAccessPanelModel.js'],
  WGH3: ['src/ui/components/hudmeta.js#quickAccessPanelHtml', 'src/ui/models/QuickAccessPanelModel.js'],
  WGH4: ['src/ui/components/hudmeta.js#sharedRunHudHtml', 'src/ui/viewModels/RunHudViewModel.js', 'src/ui/components/runHud.js'],
  WGH5: ['PROPOSED: combat settlement experience projection; no production mechanic implemented'],
  WGH6: ['src/ui/components/hudmeta.js#inventoryBeltHtml', 'src/ui/models/InventoryBeltModel.js'],
  WGH7: ['src/ui/components/hudmeta.js#runHeaderStripHtml', 'src/ui/models/RunHeaderModel.js'],
  WGH8: ['src/ui/components/hudmeta.js#quickAccessPanelHtml', 'src/ui/components/flask.js'],
  WGH9: ['PROPOSED: baseline compatibility view of current checkout src/ui/models/HudModeModel.js at 3c70be90; file absent in documentation baseline']
};
const behavior = `INPUT snapshot, context, config, commandRegistry
// This is a reference projection. Never award XP or spend inventory in a view.
model = ProjectKnownHudFields(snapshot, config.sample)
visible = FilterConfiguredActiveLayers(model, config.layers)
// Collapsed layers leave no reserved row or gap.
ComposeHeader(visible.class, visible.cinders, visible.position)
ComposePrimaryRow(visible.vitality, visible.armoury, visible.menu)
ComposeDetachedRail(visible.relics, visible.potions)
IF visible.experience AND context IN config.experience.contexts
  RenderExperienceStrip(model.experience, config.experience)
// XP animation consumes an authoritative before/after settlement event.
ON combatSettled(event): AnimateProjectedFill(event.before, event.after, config.experience.animationMs)
ON action(intent): commandRegistry.dispatch(intent)
ON configurationChanged: ReprojectAndRender(); RestoreFocusedControl()`;
export const hudDefinitions = [
['WGH8','Charge flask controls','WCB2','[HP flask ×2] [MP flask ×1]','Current-checkout quick access 2×2 grid; separate from resource meters and carried potions','beneath Armoury/Menu','quick access group width','config.layout.actionHeightRem','// Current source renders HP and MP charge controls, not duplicate health meters.\nProjectFlaskReadiness(snapshot, config.layers.chargeFlasks)\nOnActivate: EmitRegisteredFlaskIntent(); DomainRevalidatesCharges()'],
['WGH9','HUD mode grip','WCB2','[⌃ Compact HUD / ⌄ Expand HUD]','Current-checkout expanded/compact HUD model','HUD bottom center','content-fit','config.layout.actionHeightRem','// Compatibility reference to current checkout HudModeModel.\nProjectNextMode(config.hudMode)\nOnActivate: SetPresentationMode(nextMode); RecomposeActiveLayers()'],
['WGH0','HUD composition contract','WCF2','[WGH7 Run header]\n[WGH1 Vitality] [WGH2 Armoury] [WGH3 Menu]\n[WGH6 Relics / potions rail]\n[WGH5 Experience strip when configured]','WGH4 concrete composition; WGS2 shared scene slot','scene top; shared parent bounds','100% host width','content-fit within configured scene band',behavior],
['WGH1','Vitality HUD','WCF2','[HP       ████████░░ 32/40]\n[Mana     ██████░░░░  6/10]\n[Stamina  ███████░░░  8/12]','WGH4; WGS2; combat and map HUD','primary row left; align meter edges','remaining primary row width','active meters × config.layout.meterHeightRem',behavior],
['WGH2','Armoury control','WCB2','[ ⚔ Armoury ]','WGH4 primary row; equipment workspace','right of vitality; before Menu','content-fit','config.layout.actionHeightRem','// Reuse WCB2. Project armoury command readiness; dispatch openArmoury intent. No loadout mutation in this control.'],
['WGH3','Menu control','WCB2','[ ☰ Menu ]','WGH4 primary row; quick menu','primary row far right','content-fit','config.layout.actionHeightRem','// Reuse WCB2. Dispatch openMenu; focus first available menu control and restore trigger on dismissal.'],
['WGH4','Total HUD','WCF2','┌─────────────────────────────────────────────────────┐\n│ Class: Warden       Cinders: 120       Act 1 Floor 4 │\n│ HP      ████████░░ 32/40     [Armoury] [Menu]        │\n│ Mana    ██████░░░░  6/10                            │\n│ Stamina ███████░░░  8/12                            │\n├─────────────────────────────────────────────────────┤\n│ [Ash seal] [Ember charm]       [Crimson ×2][Azure ×1]│\n└─────────────────────────────────────────────────────┘\n████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░','W4a W4b; WGS2 aliases this composition','top full-width; XP directly below entire HUD','100% host / 100vw in full-screen scene','content-fit within configured scene HUD band',behavior],
['WGH5','Experience strip','WCM2','████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░\nBlue fill / full host width / no permanent caption','WGH4 below detached rail; combat-only default','below total HUD; left-to-right','100% host; 100vw when host is viewport','config.experience.heightRem',`// Proposed owner extension; not existing game XP rules.
IF config.layers.experience AND context IN config.experience.contexts
  ratio = SafeNormalizedProgress(snapshot.experience)
  RenderMeter(ratio, config.experience.color, config.experience.heightRem)
ON authoritativeCombatSettlement(event)
  AnimateFill(event.previousProgress, event.currentProgress, config.experience.animationMs)
// Announce progress through accessible meter label; level thresholds come from domain.
// Ignore duplicate settlement IDs; reduced-motion uses immediate final projection.`],
['WGH6','Inventory rail','WCF2','[Relic: Ash seal] [Relic: Ember charm]    [Crimson ×2] [Azure ×1]','WGH4; separate source inventoryBelt model','below primary row; relics left / potions right','100% usable HUD width','content-fit','// Filter config layers, project actual inventory entries, preserve stable entity IDs. Reuse card/slot views. Emit inspect or potion-use intent through command registry; never duplicate resource flask ownership.'],
['WGH7','Run header strip','WCF2','Class: Warden           Cinders: 120           Act 1 · Floor 4','WGH4; map/combat run header','top baseline; left / center / right','100% usable HUD width','content-fit','// Project class, Cinders, Act and Floor from run snapshot. Filter config layers before arranging tracks. Use localization and semantic fields, not parsed text.']
];
export const hudDiagrams = Object.fromEntries(hudDefinitions.map(def => [def[0], { wide: def[3], compact: def[3], portraitSE: def[0] === 'WGH4' ? '┌──────────────────────────────┐\n│ Warden    ⛁120    Act1 Floor4│\n│ HP  █████░░ 32/40 [⚔] [☰]   │\n│ MP  ███░░░░  6/10           │\n│ STA ████░░░  8/12           │\n│ [Relics]      [Red2][Blue1]  │\n└──────────────────────────────┘\n████████████░░░░░░░░░░░░░░░░░░' : def[3], portraitS24: def[3] }]));
