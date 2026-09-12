// Documentation reference contracts. These do not change shipped game mechanics.
export const componentCompletionDefaults = {
  spacing: { gapRem: 0.2, insetRem: 0.75, sectionGapRem: 0.75 },
  target: { minRem: 2.75, iconRem: 1.575, largeRem: 3.4, smallRem: 2.75 },
  meter: { healthHeightRem: 1.4, secondaryHeightRatio: 0.5, stanceHeightRatio: 1, maxRows: 5 },
  selection: { revealDelayMs: 1000, tooltipDelayMs: 1000, liftRem: 0.25 },
  overlay: { defenseAnchorRatio: 0.5, defenseGapRem: 0.5, playerIntent: false, enemyIntent: true },
  scene: { floorHeightPercent: 35, playerWidthPercent: 25, enemyWidthPercent: 65, playerCount: 1, enemyCount: 2, skyline: true, floor: true },
  hand: { cardWidthRem: 7, cardAspectRatio: '5 / 8', gapRem: 0.2, fixtureIds: ['WC1a', 'WC1b', 'WC1c'] },
  tooltip: { widthRem: 18, maxWidthPercent: 95 },
  map: { viewBox: '0 0 100 100', selectedNode: 'town', nodeSizeRem: 2.75 },
  dialogue: { speakingId: 'keeper', autoAdvance: false, currentBeat: 'welcome' },
  samples: {
    health: { label: 'HP', current: 32, maximum: 40 },
    resource: { label: 'Mana', current: 6, maximum: 10 },
    buildup: { label: 'Burn buildup', current: 65, maximum: 100 },
    stance: { label: 'Aggressive', active: true },
    intent: { label: 'Attack', icon: '⚔', amount: 12, active: true },
    defense: { label: 'Block', icon: '◇', amount: 8, active: true },
    footer: { actions: 3, draw: 12, discard: 4, exhaust: 1, potions: 2 },
    statuses: [{ id: 'regen', icon: '✚', name: 'Regeneration', detail: '2 stacks · 3 turns' }, { id: 'poison', icon: '☠', name: 'Poison', detail: '3 stacks · 2 turns' }, { id: 'weak', icon: '↓', name: 'Weakened', detail: '1 stack · 1 turn' }],
    mapNodes: [{ id: 'start', label: 'Visited', icon: '●', x: 50, y: 82, state: 'visited' }, { id: 'combat', label: 'Combat', icon: '⚔', x: 25, y: 53, state: 'reachable' }, { id: 'town', label: 'Town', icon: '⌂', x: 73, y: 53, state: 'reachable' }, { id: 'unknown', label: 'Unknown', icon: '?', x: 50, y: 18, state: 'blocked' }],
    mapEdges: [['start', 'combat'], ['start', 'town'], ['combat', 'unknown'], ['town', 'unknown']],
    beats: [{ id: 'welcome', speaker: 'The Keeper', text: 'The forge is still warm. What brings you here?' }, { id: 'offer', speaker: 'The Keeper', text: 'I can mend what the ash has taken.', choices: ['Ask about the forge', 'Leave the forge'] }]
  }
};

const sourceGroups = {
  contract: ['src/ui/models/ComponentModel.js', 'src/ui/components/uiComponents.js', 'styles/kit.css'],
  buttons: ['src/ui/kit/index.js', 'src/ui/components/modalShell.js', 'src/ui/components/confirmationModal.js', 'styles/kit.css'],
  inspect: ['src/ui/components/card.js', 'src/ui/screens/combat.js', 'src/ui/components/combatantInspector.js'],
  identity: ['src/ui/components/combatantFrame.js', 'src/ui/components/card.js', 'styles/combat.css'],
  selection: ['src/ui/components/card.js', 'src/ui/components/hand.js', 'styles/combat.css'],
  meter: ['src/ui/components/resbars.js', 'src/model/resources.js', 'styles/kit.css'],
  status: ['src/ui/screens/combat.js', 'src/ui/components/combatantFrame.js', 'styles/combat.css'],
  overlay: ['src/ui/screens/combat.js', 'src/ui/components/combatantFrame.js', 'styles/combat.css'],
  inspector: ['src/ui/components/combatantInspector.js', 'src/ui/models/CombatantInspectorModel.js', 'styles/ui.css'],
  tooltip: ['src/ui/components/tooltip.js', 'src/ui/models/TooltipPlacementModel.js', 'styles/ui.css'],
  background: ['src/ui/screens/combat.js', 'src/ui/uiContent.js', 'styles/combat.css'],
  hud: ['src/ui/components/hudmeta.js', 'src/ui/viewModels/RunHudViewModel.js', 'styles/ui.css'],
  stage: ['src/ui/components/battlefieldStage.js', 'src/ui/models/BattlefieldStageModel.js', 'styles/combat.css'],
  hand: ['src/ui/components/hand.js', 'src/ui/components/card.js', 'styles/combat.css'],
  footer: ['src/ui/screens/combat.js', 'src/ui/components/piles.js', 'src/ui/components/flask.js', 'styles/combat.css'],
  map: ['src/ui/components/mapboard.js', 'styles/map.css'],
  dialogue: ['src/ui/screens/event.js', 'src/model/quests.js', 'src/ui/components/optionDecision.js', 'styles/ui.css']
};

// Each row declares a real composition or leaf, not a label-only fallback.
const rows = [
 ['WCF0','Component foundations',['WCF1','WCF2','WCF3','WCF4'],'contract','MODEL → CONTRACT → VIEW\n                ↘ Selection / active stack / inspector facts','Project immutable values; validate registered component; compose contract, state projection, selection, and facts.'],
 ['WCF1','Component contract',[],'contract','Immutable model ──► validated component\nOwner state ──────► presentation\nActivation ───────► semantic intent','Validate required identity and provider fields. Resolve inherited tokens. Render only active providers. Dispatch semantic intents without changing domain state.'],
 ['WCF2','Ordered active stack',['WCM1','WCM2','WCM3','WCM4','WCM6'],'status','HP        [████████░░]\nResource  [██████░░░░]  if active\nBuildup   [██████░░░░]  if budget admits\nStance    [Aggressive]  if active\nEffects   [✚][☠][↓][+N] if present','Filter inactive providers before sorting by configured order. Reserve HP, present stance and icon row. Admit optional bars within config.meter.maxRows. Convert excess buildup to progress icons; collapse absent rows and gaps.'],
 ['WCF3','Selection effect',['WCB1','WCI1','WCI2'],'selection','              (i) ← delayed reveal\n  glow ╭────────────────────╮\n       │ entire owner       │\n       │ art + name + parts │\n       ╰────────────────────╯','Observe owner selection once. Apply inherited glow to the entire visible assembly. Reveal inspect after config.selection.revealDelayMs. Cancel pending reveal on deselection and disposal.'],
 ['WCF4','Inspector facts',['WCM1','WCO1','WCO2'],'inspector','HP 32/40   Intent Attack 12   Defense 8\nCurrent state   Mana 6/10 · Aggressive\nPrevious actions  Attack → Defend\nKnown abilities   Cleave\nKnown traits      Fire weakness\nLore              Knowledge-filtered prose','Project known values using registered detail providers. Render shared label/value columns in declared section order. Unknown is distinct from absent. Preserve one independently scrolling details pane.'],
 ['WCB0','Buttons and inspection',['WCB1','WCB2','WCB3','WCB4','WCB5'],'buttons','Header  Title                         [×]\nOwner               (i)\nFooter  [Back]                   [Confirm]\nSelected card       [Context action]','Resolve every control through the shared action contract. Keep footer actions inline; sole action spans its footer. Inherit focus, disabled, busy, selected, and semantic role tokens.'],
 ['WCB1','Inspect control',[],'inspect','              (i)\n               │ center anchor\n         selected owner','Schedule visibility with config.selection.revealDelayMs. Open knowledge-filtered W1w on activation; stop owner activation propagation and restore source focus on dismissal.'],
 ['WCB2','Context action',['WCB3'],'buttons','          selected card\n           [ Use ] ← outside card footer','Project domain action and readiness. Omit absent actions. Await required target when applicable; revalidate once on commit. Never place Use inside metadata footer.'],
 ['WCB3','Primary / confirmation',[],'buttons','Footer right      [Confirm]\nSole action       [       Confirm       ]','Bind model.label and model.intent. Ready and focused primary uses configured green; disabled and busy states take precedence. Revalidate command at activation.'],
 ['WCB4','Back / cancel',[],'buttons','Footer left [Back]        [Primary]','Apply shared action contract with dismissal role. Use configured danger highlight on focus and pointer hover. Cancel presentation state and restore originating focus.'],
 ['WCB5','Exit',[],'buttons','Title                     [×] ← top-right','Use Close accessible label and shared dismissal policy. Respect pending modal decisions. Keep aligned to the header inset.'],
 ['WCI0','Identity and artwork',['WCI1','WCI2','WCI3'],'identity','Name\n┌──────── Artwork ────────┐\n│    intrinsic ratio     │\n└────────────────────────┘\nRarity             Owned','Compose identity, contained artwork, and metadata only where the owner contract provides their slots. Do not copy the owner domain model into leaf state.'],
 ['WCI1','Nameplate',[],'identity','       Ashen Sentinel\n       [ HP 32 / 40 ]','Resolve localized display name from the identity provider; render text safely. Anchor to owner name slot immediately above HP for combatants.'],
 ['WCI2','Sprite / artwork',[],'identity','     ╭─ sprite bounds ─╮\n     │      ◯          │\n     │     ╱│╲         │\n     │     ╱ ╲         │\n     ╰──── baseline ───╯','Resolve asset and pose from the registry. Preserve intrinsic aspect ratio in allocated bounds. Mirror artwork for facing; do not mirror text or controls.'],
 ['WCI3','Metadata footer',[],'identity','Common                     Owned: 1','Project applicable metadata. Place rarity at start and ownership at end of the card metadata band. No domain action belongs in this band.'],
 ['WCM0','Meters and statuses',['WCM1','WCM2','WCM3','WCM4','WCM5','WCM6'],'meter','HP      [████████░░] 32/40\nMana    [██████░░░░]  6/10\nBuildup [██████░░░░] 65/100\nStance  [  Aggressive  ]\nIcons   [✚][☠][↓][+N]','Compose the same meter primitive for health, resource and buildup with semantic model metadata. Stance and icons use shared tokens and active filtering.'],
 ['WCM1','Health meter',[],'meter','[HP ████████░░ 32 / 40]','Read model.current and model.maximum. Clamp visual fill to valid display range, preserve original domain values. Provide accessible current and maximum labels.'],
 ['WCM2','Resource meter',['WCM1'],'meter','[Mana ██████░░░░ 6 / 10]','Render only active resource providers in configured priority. Set height to config.meter.secondaryHeightRatio times HP height. Reuse meter semantics and color registry.'],
 ['WCM3','Buildup meter',['WCM2'],'meter','[Burn buildup ██████░░░░ 65 / 100]','Use threshold progress model distinct from status duration. Render admitted bars at configured secondary height; otherwise project a progress icon with stable identity.'],
 ['WCM4','Stance strip',[],'status','[          Aggressive          ]','Show active stance only. Set width equal to HP and height from config.meter.stanceHeightRatio. The informational strip does not issue a stance change.'],
 ['WCM5','Status icon',[],'status','[☠]  ← icon only; details in tooltip','Use configured square icon size, icon asset and accessible name. Schedule shared tooltip for stacks, duration and effect description. Do not print extra counters inside icon boxes.'],
 ['WCM6','Icon overflow',['WCM5'],'status','[✚][☠][↓][+N] ← final reserved tile','Measure available inline width and configured icon size and gap. If overflow exists, reserve final tile; N equals hidden count. Open complete inspector status section; never wrap into another row.'],
 ['WCO0','Combat overlays',['WCO1','WCO2','WCO3','WCO4'],'overlay','         Intent\n      ┌─ aura ───┐\n      │ sprite  │  Defense ← midpoint\n      │ + buff  │\n      └─────────┘','Compose active layers around a shared sprite rectangle. Keep effect layers noninteractive and controls above effects. Resolve role-facing placement from configuration.'],
 ['WCO1','Intent indicator',[],'overlay','       (i)\n   [⚔ Attack · 12]\n      sprite','Require active announced intent and configured role visibility. Project preview supplied by domain; never reproduce AI calculations. Place below inspect above sprite.'],
 ['WCO2','Defense badge',[],'overlay',' sprite             [◇ 8]\n         ← gap →    midpoint','Show active defense only. Anchor at config.overlay.defenseAnchorRatio of sprite height with config.overlay.defenseGapRem external gap. Player right, enemy left.'],
 ['WCO3','Aura layer',['WCI2'],'overlay','┌── full sprite bounds ──┐\n│ aura behind artwork   │\n│                       │\n└───────────────────────┘','Resolve active effect provider. Fill complete sprite bounds behind artwork. Omit absent effect; never intercept pointer input or create domain buffs.'],
 ['WCO4','Buff layer',['WCI2'],'overlay','┌── full sprite bounds ──┐\n│ buff above artwork    │\n│                       │\n└───────────────────────┘','Resolve active buff visual provider. Cover full sprite height above artwork beneath controls. Respect reduced motion and disposal lifecycle.'],
 ['WCT0','Tooltip components',['WCT1'],'tooltip','[ Trigger ] ── delay ──► ┌ Tooltip ┐\n                         │ detail  │\n                         └────▽────┘','Reuse one tooltip presenter with configured size variant and placement policy. Keep tooltips in current modal overlay layer.'],
 ['WCT1','Tooltip presenter',[],'tooltip','┌ Poison ────────────────────┐\n│ Damage over time.          │\n│ 3 stacks · 2 turns         │\n└────────────▽───────────────┘\n             [☠]','On hover or focus schedule after config.selection.tooltipDelayMs. Cancel stale requests, flip and shift to viewport bounds, dismiss on Escape or outside activation.'],
 ['WGS0','Shared scene layers',['WGS1','WGS2'],'background','Shared HUD\n┌ Skyline ─────────────────┐\n│ world scene              │\n├ Floor ───────────────────┤\n│ baseline / actors        │\n└──────────────────────────┘','Compose HUD once and background layers below. Apply visibility flags independently; shared domain facts remain owned by the HUD model.'],
 ['WGS1','Background composition',['WGS6','WGS7'],'background','┌ Skyline · behind ────────┐\n│ distant sky and scenery  │\n│                         │\n├ Floor · bottom ──────────┤\n│ ground under actors      │\n└──────────────────────────┘','Resolve skyline and floor asset providers. Paint only enabled layers; floor height follows config.scene.floorHeightPercent and anchors bottom. Preserve shared actor baseline.'],
 ['WGS2','Shared HUD',['WGH4'],'hud','Class          Cinders          Act / Floor\nResource meters               Armoury Menu\nRelic rail                      Potion rail','Render the shared RunHud view model through WGH4. Toggle configured children before layout; never maintain separate combat and map HUD facts.'],
 ['WGS3','HUD identity',['WCI1'],'hud','Class            Cinders            Act / Floor','Project class identity and run metadata from RunHeaderModel. Reuse shared header renderer rather than adding portrait, XP or duplicate character facts.'],
 ['WGS4','HUD resource strip',['WCM1','WCM2'],'hud','HP 32/40  [████████░░]\nMana 6/10 [██████░░░░]','Read active resource plan and semantic order from resource providers. Reuse resourceBars main surface and shared meter primitive.'],
 ['WGS5','HUD menu button',['WCB3'],'hud','HUD right        [Armoury] [Menu]','Compose shared menu action with accessible label and command intent. Opening a menu follows configured simulation/input policy.'],
 ['WGS6','Skyline layer',[],'background','┌──────────────────────────┐\n│ sky · distant silhouettes│\n│       /\    /\          │\n│      /  \__/  \         │\n└──────────────────────────┘','Paint configured distant-art asset across scene bounds with intrinsic crop policy. Layer behind floor and actors. Omit when config.scene.skyline is disabled.'],
 ['WGS7','Floor layer',[],'background','                 scene top\n┌──────────────────────────┐\n│ floor at bottom          │\n└──────── actor baseline ──┘','Paint floor at scene bottom using config.scene.floorHeightPercent. Omit when config.scene.floor is disabled without shifting the actor placement model.'],
 ['WGC0','Combat composition',['WGH4','WGC1','WGC5','WGC6'],'stage','Shared HUD\nBattlefield: player →   ← enemies\nHand: [card] [card] [card]\n(A)[Draw][End turn][Discard](P)','Compose shared HUD, stage, hand and footer using scene band config. Child modules receive the same immutable snapshot and emit domain intents through the host dispatcher.'],
 ['WGC1','Battlefield stage',['WGS1','WGC2','WGC3','WGC4'],'stage','┌ Skyline / floor ──────────────┐\n│                              │\n│ Player →      ← Foe  ← Foe   │\n└──────── shared baseline ─────┘','Project authored formation slots from host size and stable actor IDs. Compose player and enemy WC4 instances on the same baseline above background with target overlay.'],
 ['WGC2','Player placement',['WC4a'],'stage','Player slot →\n   sprite          defense\n   name\n   HP / active stack','Allocate the player slot and render shared combatant card with player-facing context. Intent is hidden by role default but configurable. Preserve sprite proportions.'],
 ['WGC3','Enemy placements',['WC4a'],'stage','       ← Enemy       ← Enemy\n       sprite        sprite\n       name / HP     name / HP','Project stable enemy IDs to authored slots. Render the same combatant component with enemy-facing context and active intent; do not mirror controls or names.'],
 ['WGC4','Target layer',['WCF3'],'stage','Player       [eligible enemy]   unavailable\n                    ↑ active target outline','Use domain-eligible entity IDs for hit regions and keyboard navigation. Highlight eligible and selected targets without selecting impossible targets. Clear stale selection on model change.'],
 ['WGC5','Hand region',['WC1'],'hand','[Attack] [Skill] [Power]\n    proportional cards, shared selection','Project stable hand cards through the shared WC1 renderer. Use configured spacing and card ratio; fit/paginate when minimum readable width cannot fit. Do not implement draw or damage logic here.'],
 ['WGC6','Packed action footer',['WGC7','WGC8','WGC9','WGC10','WGC11'],'footer','(Actions)[Draw][ End turn ][Discard](Potions)','Compose controls in configured order as one tightly packed centered group. Large outer circles and center control share size token; empty non-End-turn controls fade.'],
 ['WGC7','Actions remaining',[],'footer','  ( 3 )\n Actions','Read remaining actions from snapshot. Use large circular control size. Empty state fades and is announced accessibly; display does not spend actions.'],
 ['WGC8','Draw pile button',['WCB3'],'footer','[Draw · 12] → shared pile workspace','Open draw pile inspector on activation. Use current pile count; no invented draw-card command. Empty state follows configured faded styling.'],
 ['WGC9','End turn button',['WCB3'],'footer','[ End turn ]  ← center / large','Project turn readiness. Highlight green when legal and remaining actions exhausted or selected. Never fade solely because actions are empty. Revalidate end-turn command on activation.'],
 ['WGC10','Discard / exhaust',['WCB3'],'footer','[Discard · 4 / Exhaust · 1]','Open shared categorized pile workspace with selected category. Counts come from snapshot; preserve one control between End turn and Potions.'],
 ['WGC11','Potion control',['WCB3'],'footer',' ( 2 )\nPotions','Open owned potion selection. Resolve selected item action and target through domain. Use the shared large circular footer control and fade empty state.'],
 ['WGM0','Map composition',['WGH4','WGM1','WGM4','WGM6','WGM7'],'map','Shared HUD\nMap viewport: connected node graph\nSelected node: known details\n[Recenter]                 [Enter town]','Compose shared HUD, camera viewport, selected-node details and inline footer. Use configured map bands; selection projects details and never enters a node immediately.'],
 ['WGM1','Map viewport',['WGM2','WGM3','WGM5'],'map','         [?]\n        /   \\\n   [Combat] [Town]\n        \\   /\n       [Visited]','Render graph paths and buttons in a shared camera coordinate space. Preserve node identity during pan/zoom. Apply knowledge filtering before rendering unknown node labels.'],
 ['WGM2','Map paths',[],'map','      ●\n     / \\\n    ●   ●\n     \\ /\n      ●','Read graph edges and registered node positions. Render noninteractive SVG paths beneath buttons; expose graph connections in accessible node descriptions.'],
 ['WGM3','Node button',['WCB3'],'map','Visited ●   Reachable [⌂]   Blocked [?]','Render node state from knowledge-filtered graph. Selection only updates preview state. Blocked nodes explain unavailable reason without permitting entry.'],
 ['WGM4','Node details',['WCF4'],'map','Town · Reachable\nServices   Smith · Merchant · Rest\nRisk       Known safe\nEntry      Select Enter town to travel','Project known selected-node identity, services, risk and entry reason. Use aligned label/value rows. Do not disclose unseen or unprovided node data.'],
 ['WGM5','Region selector',[],'map','Region [Ashen March ▾]','Populate available regions from model. Selecting changes the local map view while preserving run location; no travel command is emitted.'],
 ['WGM6','Recenter button',['WCB4'],'map','[Recenter]                 [Enter town]','Emit local camera recenter intent for current node. Reset view transform without changing selected destination or run graph.'],
 ['WGM7','Enter node button',['WCB3'],'map','[Recenter]                 [Enter town]','Project node-specific label and readiness. Revalidate reachability and entry command against latest domain state before transition.'],
 ['WGQ0','Dialogue composition',['WGQ1','WGQ4','WGQ5','WGQ6','WGQ7','WGQ8'],'dialogue','Player portrait      NPC portrait\nSpeaker: short current caption\n[Available authored choices]\n[Back]       [Skip speech]       [Continue]','Compose scene portraits, current authored beat, progression controller and inline navigation. Keep quest effects behind explicit domain choice commit.'],
 ['WGQ1','Dialogue scene',['WGS1','WGQ2','WGQ3'],'dialogue','┌─────── authored scene ─────────┐\n│ Player →             ← Keeper │\n│ portrait              portrait│\n└───────────────────────────────┘','Resolve authored scene and speaker portraits. Preserve left/right roles and sprite proportions; apply speaking emphasis only to the current speaker.'],
 ['WGQ2','Player portrait',['WCI2'],'dialogue','Player →           NPC\nportrait           portrait','Use the shared artwork component and player-facing context. Anchor left and baseline bottom; no portrait interaction duplicates dialogue choices.'],
 ['WGQ3','NPC portrait',['WCI2'],'dialogue','Player         ← NPC speaking\nportrait         portrait','Use the shared artwork component with NPC asset and speaking state. Anchor right; mirror artwork only when authored facing requires it.'],
 ['WGQ4','Caption / choices',['WCB3'],'dialogue','The Keeper\nThe forge is still warm.\n[Ask about the forge] [Leave]','Project one short authored beat and only known eligible choices. Choice activation records selection; explicit Continue commits through domain. Keep text size readable and choices inline when they fit.'],
 ['WGQ5','Speech progression',[],'dialogue','Idle → Playing → Ended → Next eligible beat\n                 ↘ Await choice','Subscribe to authored audio ended event with current generation token. Advance only linear eligible beats when config.dialogue.autoAdvance is enabled. Cancel stale events on skip/back/dispose; never invent audio timing.'],
 ['WGQ6','Dialogue Back',['WCB4'],'dialogue','[Back]         [Skip speech]     [Continue]','Move to previous permitted caption without replaying domain effects. Disable when history does not allow navigation. Cancel current media generation.'],
 ['WGQ7','Skip speech',['WCB3'],'dialogue','[Back]         [Skip speech]     [Continue]','Stop current media and reveal caption. Do not skip quest content or choose a response. Ignore stale audio ended events.'],
 ['WGQ8','Dialogue Continue',['WCB3'],'dialogue','[Back]         [Skip speech]     [Continue]','Advance once to next permitted beat or commit explicitly selected choice. Honor readiness; cancel prior media generation and reject duplicate activation.']
];

const proposed = {
  background: 'The current working game uses backdropClass in combat.js; the documentation dev baseline adds environmentArt with a cropped SVG painting. Independent skyline and floor layers are a proposed documentation contract.',
  dialogue: 'Current event screen renders authored prose and domain-backed choices. Two portraits and audio-paced caption progression are proposed; sample text is illustrative.',
  hud: 'Source HUD is class/Cinders/Act/Floor, resource meters, Armoury/Menu, and detached relic/potion rail. Newly requested experience bar is separately configured by the HUD reference.',
  status: 'The current working game renders status pips and collapsed proc progress in combat.js; the documentation dev baseline also has statusTray overflow disclosure. The five-row budget, icon-only tiles and inspector overflow route are owner-requested reference changes.',
  footer: 'Current combat and pile/flask source provides command and inspection behavior. The tightly packed circular footer is the proposed presentation layout.',
  stage: 'Current stage derives safe formation geometry from host and actor models. Reference section percentages and layer toggles are proposed, not replacements for production geometry validation.'
};

export const componentCompletions = Object.fromEntries(rows.map(([id,name,children,group,diagram,behavior]) => [id, {
  id, name, children, diagram, diagrams: { wide: diagram, compact: diagram, iphoneSE: diagram, galaxyS24: diagram },
  sourceReferences: sourceGroups[group],
  sourceDescription: `Reuses the ${group} source boundary. ${proposed[group] || 'Reference sample data and interaction styling are proposed; source modules establish ownership and behavior.'}`,
  model: { id, entityRef: 'sample:combatant', active: true, selected: false, children: children.map(componentId=>({componentId, modelRef:`model:${componentId}`})), configRef:'componentCompletionDefaults', dataSource:'immutable snapshot and knowledge-filtered registered providers', sampleDataRef:'componentCompletionDefaults.samples' },
  config: componentCompletionDefaults,
  pseudo: `INPUT: snapshot, knowledge, ownerState, context, config\n// Load shared tokens; numeric defaults live in componentCompletionDefaults.\nmodel = ProjectRegisteredModel(snapshot, knowledge, context)\n// ${behavior}\nFilterInactiveProviders(model)\nchildren = ResolveDeclaredChildReferences(model.children)\nRenderRegisteredComponent(model, children, config)\n// Local preview actions never mutate the game. Production host revalidates commands.\nOn activation: DispatchSemanticIntent(model.intent, context)\nOn disposal: ReleaseTimersObserversAndSubscriptions()`,
  actualCode: { renderer: 'component-completion-client.js#renderCompletedComponent', model:'component-completion.mjs#componentCompletions', styles:'component-completion.css', contract:id }
}]));

export function applyComponentCompletions(definitions) {
  for (const def of definitions) {
    const item = componentCompletions[def[0]];
    if (!item) continue;
    def[3] = item.diagram;
    def[8] = item.pseudo;
  }
  return definitions;
}
