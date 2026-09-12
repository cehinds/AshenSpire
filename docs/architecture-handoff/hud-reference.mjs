export const hudConfig = {
  context: 'combat', enabled: true, layoutPreset: 'proposed', hudMode: 'expanded',
  layers: { header: true, class: true, cinders: true, position: true, vitality: true, health: true, mana: true, stamina: true, armoury: true, menu: true, rail: true, relics: true, potions: true, experience: true, chargeFlasks: true, modeGrip: false },
  vitality: { referenceMaximum: { health: 200, mana: 20, stamina: 20 }, maximumWidthPercent: 100, scaleByMaximum: true },
  potions: { placement: 'footerOnly', componentId: 'WGC11', contentsComponentId: 'WGH8', openIntent: 'openPotions', combineChargeFlasks: true, combineCarriedPotions: true },
  experience: { contexts: ['combat'], color: '#398bd1', heightRem: 0.35, animationMs: 650, awardPreview: 15 },
  diagram: { columns: { wide: 62, compact: 48, portraitSE: 40, portraitS24: 42 }, trackColumns: 20, labelColumns: 8 },
  layout: { gapRem: 0.35, insetRem: 0.5, meterHeightRem: 1.15, actionHeightRem: 2.75, radiusRem: 0.25 },
  colors: { background: '#211a12', gold: '#d5af68', text: '#eee2ca', health: '#668c46', mana: '#478dbc', stamina: '#bf9949' },
  sample: { className: 'Warden', cinders: 120, act: 1, floor: 4, health: { value: 32, maximum: 40 }, mana: { value: 6, maximum: 10 }, stamina: { value: 8, maximum: 10 }, experience: { value: 40, maximum: 100 }, relics: ['Ash seal', 'Ember charm'], potions: ['Smoke vial ×1'], chargeFlasks: ['HP ×2', 'MP ×1'] }
};
export const hudSourceSnapshots={ current:{commit:'3c70be90',root:'D:/repos/AshenSpire',status:'Owner checkout including local edits; see CURRENT-SOURCE-AUDIT.md'},baseline:{commit:'c618177a',root:'D:/repos/AshenSpire-wireframe-docs',status:'Documentation branch baseline'} };
export const hudSources = {
  WGH0: ['src/ui/viewModels/RunHudViewModel.js', 'src/ui/components/hudmeta.js'],
  WGH1: ['src/ui/components/hudmeta.js#vitalsPanelHtml', 'src/ui/components/resbars.js', 'src/ui/models/VitalsPanelModel.js', 'src/model/resources.js#resourceBarPlan', 'src/content/resources.js'],
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
// One Potions control owns flask charges and carried consumables.
potionEntries = ProjectPotions(snapshot, visible.chargeFlasks, visible.potions)
ComposeDetachedRail(visible.relics)
// Top HUD never renders Potions in either preset. Footer owns WGC11.
PublishFooterPotionsModel(config.potions.componentId, potionEntries)
// HP, MP and Smoke vial are revealed inside the FOOTER Potions control only.
OnPotionsActivate: OpenSharedPotionContents(potionEntries)
OnPotionChoice: EmitRegisteredUseIntent(); DomainRevalidatesReadiness()
IF visible.experience AND context IN config.experience.contexts
  RenderExperienceStrip(model.experience, config.experience)
// XP animation consumes an authoritative before/after settlement event.
ON combatSettled(event): AnimateProjectedFill(event.before, event.after, config.experience.animationMs)
ON action(intent): commandRegistry.dispatch(intent)
ON configurationChanged: ReprojectAndRender(); RestoreFocusedControl()`;
export const hudDefinitions = [
['WGH8','Potions contents','WCB2','[WGC11 Potions]\n    └─ on open: [HP ×2] [MP ×1] [Smoke vial ×1]','Shared footer Potions control contents; WGC11 owns presentation','inside footer WGC11 disclosure; never in top HUD','shared Potions content host width','content-fit; action height config.layout.actionHeightRem','// Proposed owner correction supersedes separate flask buttons.\nentries = ProjectPotionEntries(snapshot.chargeFlasks, snapshot.carriedPotions, config.potions)\nRenderInsideSharedControl(config.potions.componentId, entries)\n// Footer-only placement applies to current and proposed preview presets.\n// Data keeps charge providers separate from owned item instances; view combines references only.\nOnChoose(entry): EmitRegisteredUseIntent(entry.id); DomainRevalidatesChargesAndTarget()'],
['WGH9','HUD mode grip','WCB2','[⌃ Compact HUD / ⌄ Expand HUD]','Current-checkout expanded/compact HUD model','HUD bottom center','content-fit','config.layout.actionHeightRem','// Compatibility reference to current checkout HudModeModel.\nProjectNextMode(config.hudMode)\nOnActivate: SetPresentationMode(nextMode); RecomposeActiveLayers()'],
['WGH0','HUD composition contract','WCF2','[WGH7 Run header]\n[WGH1 Vitality] [WGH2 Armoury] [WGH3 Menu]\n[WGH6 Relics rail]\n[WGH5 Experience strip when configured]','WGH4 concrete composition; WGS2 shared scene slot','scene top; shared parent bounds','100% host width','content-fit within configured scene band',behavior],
['WGH1','Vitality HUD','WCF2','Generated from hudConfig','WGH4; WGS2; combat and map HUD','primary row left; align meter edges','remaining primary row width','active meters × config.layout.meterHeightRem',`INPUT resource snapshot, config.vitality, availableWidth
// Current source resourceBarPlan separates track length from fill.
FOR each configured active resource
  reference = config.vitality.referenceMaximum[resource.id]
  meterLaneWidth = ReserveExternalLabelColumns(availableWidth, localizedLabels, currentMaxValues)
  allowedWidth = meterLaneWidth * ClampUnit(PercentFraction(config.vitality.maximumWidthPercent))
  trackWidth = IF config.vitality.scaleByMaximum THEN ClampToRange(resource.maximum / reference * allowedWidth, EmptyLength(), allowedWidth) ELSE allowedWidth
  fillWidth = SafeProgressFraction(resource.current, resource.maximum) * trackWidth
  RenderTrack(trackWidth); RenderFill(fillWidth)
  RenderExternalValue(resource.current, resource.maximum)
// Current/max label occupies a shared outside column, never squeezed inside a short track.
// Reference maximum caps presentation width only; never caps domain maximum or value.
// Defaults and source references currently agree; read config rather than retyping their maxima.`],
['WGH2','Armoury control','WCB2','[ ⚔ Armoury ]','WGH4 primary row; equipment workspace','right of vitality; before Menu','content-fit','config.layout.actionHeightRem','// Reuse WCB2. Project armoury command readiness; dispatch openArmoury intent. No loadout mutation in this control.'],
['WGH3','Menu control','WCB2','[ ☰ Menu ]','WGH4 primary row; quick menu','primary row far right','content-fit','config.layout.actionHeightRem','// Reuse WCB2. Dispatch openMenu; focus first available menu control and restore trigger on dismissal.'],
['WGH4','Total HUD','WCF2','Generated from hudConfig','W4a W4b; WGS2 aliases this composition','top full-width; XP directly below entire HUD','100% host / 100vw in full-screen scene','content-fit within configured scene HUD band',behavior],
['WGH5','Experience strip','WCM2','████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░\nBlue fill / full host width / no permanent caption','WGH4 below detached rail; combat-only default','below total HUD; left-to-right','100% host; 100vw when host is viewport','config.experience.heightRem',`// Proposed owner extension; not existing game XP rules.
IF config.layers.experience AND context IN config.experience.contexts
  ratio = SafeNormalizedProgress(snapshot.experience)
  RenderMeter(ratio, config.experience.color, config.experience.heightRem)
ON authoritativeCombatSettlement(event)
  AnimateFill(event.previousProgress, event.currentProgress, config.experience.animationMs)
// Announce progress through accessible meter label; level thresholds come from domain.
// Ignore duplicate settlement IDs; reduced-motion uses immediate final projection.`],
['WGH6','Relic rail','WCF2','[Relic: Ash seal] [Relic: Ember charm]','WGH4; separate source inventoryBelt model','below primary row; relics left; no potion controls','100% usable HUD width','content-fit','// Filter layers and preserve stable entity IDs. Relics use shared cards. Potions are exclusively footer-owned: WGC11 opens WGH8 contents combining HP/MP charge providers and carried consumables. Never render any potion control in this top-HUD rail, regardless of preset. Resource meters remain distinct information components.'],
['WGH7','Run header strip','WCF2','Class: Warden           Cinders: 120           Act 1 · Floor 4','WGH4; map/combat run header','top baseline; left / center / right','100% usable HUD width','content-fit','// Project class, Cinders, Act and Floor from run snapshot. Filter config layers before arranging tracks. Use localization and semantic fields, not parsed text.']
];

// All resource numbers and proportions originate in the same defaults as the
// HTML preview. Text-column rounding is solely an ASCII illustration concern.
const unit = value => Math.max(0, Math.min(1, value));
function resourceDiagramRows(config) {
  const lane = config.diagram.trackColumns;
  return ['health','mana','stamina'].filter(key => config.layers[key]).map(key => {
    const resource = config.sample[key];
    const allowance = lane * unit(config.vitality.maximumWidthPercent / 100);
    const fraction = config.vitality.scaleByMaximum ? unit(resource.maximum / config.vitality.referenceMaximum[key]) : 1;
    const track = Math.round(fraction * allowance);
    const fill = Math.round(unit(resource.value / resource.maximum) * track);
    const graphic = track ? '['+'█'.repeat(fill)+'░'.repeat(track-fill)+']' : '';
    return (key==='health'?'HP':key==='mana'?'MP':'Stamina').padEnd(config.diagram.labelColumns)+graphic.padEnd(lane+2)+resource.value+' / '+resource.maximum;
  });
}
function experienceDiagram(config, columns) {
  const fill=Math.round(unit(config.sample.experience.value/config.sample.experience.maximum)*columns);
  return '█'.repeat(fill)+'░'.repeat(columns-fill);
}
function framedDiagram(lines,width) {
  // Wide line examples are wrapped instead of silently clipping documentation.
  const rows=lines.flatMap(line=>{const result=[];while(line.length>width){result.push(line.slice(0,width));line=line.slice(width);}result.push(line);return result;});
  return '┌'+'─'.repeat(width)+'┐\n'+rows.map(line=>'│'+line.padEnd(width)+'│').join('\n')+'\n└'+'─'.repeat(width)+'┘';
}
export function buildHudDiagram(id,mode='wide',config=hudConfig) {
  const width=config.diagram.columns[mode];
  const meters=resourceDiagramRows(config);
  const header=config.sample.className+' · Cinders '+config.sample.cinders+' · Act '+config.sample.act+' Floor '+config.sample.floor;
  const relics=config.sample.relics.map(name=>'['+name+']').join(' ');
  if(id==='WGH1')return meters.join('\n');
  if(id==='WGH7')return header;
  if(id==='WGH6')return relics;
  if(id==='WGH8')return '['+config.potions.componentId+' Potions · footer only]\n'+[...config.sample.chargeFlasks,...config.sample.potions].map(name=>'['+name+']').join(' ');
  if(id==='WGH5')return experienceDiagram(config,width)+'\nBlue strip · '+config.experience.heightRem+'rem · full host width';
  if(id==='WGH4'){
    const lines=[];
    if(config.layers.header)lines.push(header);
    if(config.layers.vitality)lines.push(...meters);
    lines.push([config.layers.armoury?'[Armoury]':'',config.layers.menu?'[Menu]':''].filter(Boolean).join(' '));
    if(config.layers.rail&&config.layers.relics)lines.push(relics);
    if(config.layers.modeGrip)lines.push('[HUD mode: '+config.hudMode+']');
    const xp=config.layers.experience&&config.experience.contexts.includes(config.context)?'\n'+experienceDiagram(config,width):'';
    return framedDiagram(lines.filter(Boolean),width)+xp;
  }
  return hudDefinitions.find(def=>def[0]===id)[3];
}
// Update the tuple diagrams too: generators consuming only definitions remain current.
for(const definition of hudDefinitions)if(['WGH1','WGH4','WGH5','WGH6','WGH7','WGH8'].includes(definition[0]))definition[3]=buildHudDiagram(definition[0]);
export const hudDiagrams=Object.fromEntries(hudDefinitions.map(def=>[def[0],Object.fromEntries(Object.keys(hudConfig.diagram.columns).map(mode=>[mode,buildHudDiagram(def[0],mode)]))]));
