# AshenSpire component catalog

This is the quick-reference library for the reusable UI vocabulary. The visual
catalog is available at [`component-catalog.html`](./component-catalog.html).
Select any component card there to open its detail drawer. The dedicated
[`tray-gallery.html`](./tray-gallery.html) shows all eight top/right/bottom/left
folded and unfolded Tray states using the production renderer.

Use the catalog's **Grid / List** switch to choose card tiles or a compact
vertical list. In Grid view, use the **− / reset / +** controls, Ctrl/Command +
mouse wheel, or a trackpad pinch to change card size and the number of visible
columns. View and density preferences persist in the browser. The catalog
header also links back to the repository, README, issue list, Daily Status, and
the current GitHub Pages preview.

Search accepts multiple terms and matches each term across the component ID,
model, renderer/view, role, reuse surface, and cataloged children. Press `/` to
focus search. Results can be sorted by ID, group, model, or view and filtered to
composite or leaf components. **Copy view link** preserves the active search,
group, kind, and sort in a shareable URL; **Clear** resets discovery filters.

Stable IDs live in [`UiComponentId.js`](../src/ui/models/UiComponentId.js). Model
factories live under [`src/ui/models/`](../src/ui/models/) and the shared HUD
projection is [`RunHudViewModel.js`](../src/ui/viewModels/RunHudViewModel.js).

| Component ID | Model / factory | View or renderer | Reuse | Purpose |
|---|---|---|---|---|
| `startup-gate` | `startupGateModel` | `startupGate.mountStartupGate` | Cold boot | Input-gated wordmark, deterministic ash, family prompt, and shared build receipt; Title is not mounted behind it. |
| `startup-ash-field` | `startupGateModel.properties.particles` | `startupGate.mountStartupGate` | Startup Gate | Decorative particle host; visual-only and removed with the boot gate. |
| `startup-ash-particle` | deterministic particle record | `startupGate.mountStartupGate` | Startup Ash Field | One data-driven ash mote with position, delay, duration, and size. |
| `startup-mark` | startup copy + responsive presentation | `startupGate.mountStartupGate` | Startup Gate | Centered folded-title content group; its phone backing is fully transparent. |
| `startup-wordmark` | `startupGateModel.properties.wordmark` | `startupGate.mountStartupGate` | Startup Mark | Replaceable Ashen Spire wordmark text. |
| `startup-subtitle` | `startupGateModel.properties.subtitle` | `startupGate.mountStartupGate` | Startup Mark | Replaceable genre subtitle. |
| `startup-divider` | semantic child | `startupGate.mountStartupGate` | Startup Mark | Decorative gold rule separating title copy from the prompt. |
| `startup-prompt` | input-family prompt record | `startupGate.mountStartupGate` | Startup Mark | Polite live-region invitation updated for pointer, touch, keyboard, or controller. |
| `title-brand-lockup` | title content records | `title.mountTitle` | Title screen | Centered wordmark, subtitle, and divider composition. |
| `title-wordmark` | title content record | `title.mountTitle` | Title Brand Lockup | Main Ashen Spire title text. |
| `title-subtitle` | title content record | `title.mountTitle` | Title Brand Lockup | Main title genre subtitle. |
| `title-divider` | semantic child | `title.mountTitle` | Title Brand Lockup | Gold rule and diamond under the title. |
| `title-menu` | title content records | `title.mountTitle` | Title screen | Centered unfurled Continue / Load / New / Collection / Settings / Quit menu. |
| `title-menu-item` | action content record + availability | `title.mountTitle` | Title Menu | One keyboard, pointer, touch, and controller-ready menu action. |
| `title-menu-gem` | semantic child | `title.mountTitle` | Title Menu Item | Decorative diamond separator shown beneath a menu label. |
| `title-tagline` | title content record | `title.mountTitle` | Title screen | Replaceable centered closing line beneath the main menu. |
| `title-menu-modal` | `saveSlotSelectionModel` + save-slot records | `title.mountTitle` | Title screen | Reusable LOAD GAME / NEW GAME modal; selected card, accessibility state, and primary action target share one immutable projection, while `load-review` confirms a twice-activated save before loading. |
| `title-modal-close-control` | modal action record + authored tap floor | `title.mountTitle` | Title Menu Modal | Close control with a 75%-sized visible square inside its full tap-safe target; restores focus to the title menu. |
| `title-modal-heading` | modal-kind projection | `title.mountTitle` | Title Menu Modal | LOAD GAME or NEW GAME accessible dialog heading. |
| `title-modal-divider` | semantic child | `title.mountTitle` | Title Menu Modal | Gold rule and diamond beneath the dialog heading. |
| `title-save-slot-list` | `saveSlotSelectionModel` | `title.mountTitle` | Title Menu Modal | Immutable Load/New selection aggregate whose child records identify the selected slot and semantic select command. |
| `title-save-slot` | `saveSlotSelectionModel` child + save summary + `balance.ui.titleLoadHold` | `title.mountTitle` | Load/New modal | Occupied, empty, selected, focused, disabled, and hoverable slot surface; New Game keeps focus and selected styling on the same empty slot, while occupied Load slots support one-tap selection, second-activation review, and pointer/touch hold-to-load. |
| `title-save-slot-copy` | save summary record | `title.mountTitle` | Title Save Slot | Slot number, class, act, floor, HP, and seed receipt, or Empty copy. |
| `title-save-slot-state` | slot availability projection | `title.mountTitle` | Title Save Slot | READY or EMPTY trailing state label. |
| `title-save-slot-delete` | slot id + hold-confirm behavior + authored tap floor | `title.mountTitle` | Occupied Title Save Slot | Tap-floor-sized destructive control with shared hold-confirm timing. |
| `title-modal-actions` | `saveSlotSelectionModel` action projection + modal kind | `title.mountTitle` | Title Menu Modal | Responsive Back/Continue group; Continue remains enabled for and targets the selected slot, while the `load-review` variant becomes Back to Saves / Load Save. |
| `title-modal-back-control` | modal action record | `title.mountTitle` | Title Modal Actions | Returns to the title menu, or from `load-review` to the Load Game slot list with selection preserved. |
| `title-modal-continue-control` | `saveSlotSelectionModel` action child | `title.mountTitle` | Title Modal Actions | Carries the selected slot as its semantic load/create command payload; the review variant exposes a positive Load Save action. |
| `shared-run-hud` | `runHudViewModel` | `hudmeta.sharedRunHudHtml` | Map + Combat | One shared run HUD composition with remembered Expanded and Razor Strip snap states. |
| `run-header-strip` | `runHeaderModel` | `runHeaderStripHtml` | Map + Combat | Identity, cinders, and prioritized metadata. |
| `identity-cluster` | `identityClusterModel` | `identityClusterHtml` | Map + Combat | Character identity cluster. |
| `portrait-badge` | `componentModel` child | `hudmeta.identityClusterHtml` | Map + Combat | Character glyph/badge. |
| `character-title` | `componentModel` child | `hudmeta.identityClusterHtml` | Map + Combat | Name and class label. |
| `cinders-counter` | `cindersCounterModel` | `cindersCounterHtml` | Map + Combat | Live cinders count. |
| `build-metadata-trail` | `buildMetadataTrailModel` | `buildMetadataTrailHtml` | Map + Combat | Act, floor, seed, build, source. |
| `metadata-field` | `metadataFieldModel` | `hudmeta` metadata spans | Map + Combat | One prioritized metadata field. |
| `primary-hud-row` | `componentModel` composition | `primaryHudRowHtml` | Map + Combat | Vitals and Quick Access row. |
| `panel` | `panelModel` child | Shared panel frame | HUD panels | Common panel semantic/frame component. |
| `component-background` | `componentModel` child | Panel + combatant CSS | Panels + combat cards | Reusable opacity, tint, border, and backing layer. |
| `vitals-panel` | `vitalsPanelModel` | `vitalsPanelHtml` | Map + Combat | HP, MP, and SP panel. |
| `resource-meter` | `componentModel` child | `resbars.resourceBars` | HUD + combat cards | Data-driven resource trough/fill. |
| `quick-access-panel` | `quickAccessPanelModel` | `quickAccessPanelHtml` | Map + Combat | Armoury, menu, and charge flasks. |
| `action-control` | `actionControlModel` child | `quickAccessPanelHtml` | HUD controls | Shared activation semantics. |
| `hotkey-badge` | `componentModel` semantic ID | View-owned | HUD controls | Configurable key hint badge. |
| `armoury-control` | `actionControlModel` | Quick Access view | Map + Combat | Opens Armoury. |
| `quick-menu-control` | `actionControlModel` | Quick Access view | Map + Combat | Opens quick menu. |
| `hud-quick-settings` | `hudQuickSettingsModel` | `hudQuickSettingsHtml` | Title + Map + Combat | Shared right-anchored Fullscreen/Music utility rail. Phone faces are 32px (20% smaller) inside unchanged 44px touch targets; compact HUD anchors the pair below potions. |
| `hud-mode-grip` | `hudModeGripModel` | `sharedRunHudHtml` + `wireHudModeGrip` | Map + Combat | Two-state HUD snap control: an 18x3 visible border notch within a 44x44 pointer/keyboard/drag target. |
| `fullscreen-control` | `componentModel` child | `hudQuickSettingsHtml` | HUD Quick Settings | Live browser-state Fullscreen action mirrored by Quick Menu and Settings; unavailable when the platform exposes no API. |
| `music-control` | `componentModel` child | `hudQuickSettingsHtml` | HUD Quick Settings | Positive-state Music toggle mirrored by Quick Menu and Settings and persisted through the shared settings owner. |
| `crimson-flask-control` | `componentModel` | `flask.flaskPresentation` | Map + Combat | Health charge flask. |
| `azure-flask-control` | `componentModel` | `flask.flaskPresentation` | Map + Combat | Mana charge flask. |
| `inventory-belt` | `inventoryBeltModel` | `inventoryBeltHtml` | Map + Combat | Shared relic/potion belt. |
| `item-tray` | `itemTrayModel` child | Belt view | Inventory | Shared horizontal tray behavior. |
| `item-slot` | `componentModel` semantic ID | Item view | Inventory | Generic item slot contract. |
| `folding-tray` | `trayModel` | `trayComponents.renderTray` | Armoury + future menus | Edge-aware disclosure composition. |
| `tray-header` | `trayHeaderModel` child | `trayComponents.renderTray` | Folding Tray | Arrow, name, quantity, and optional sort action. |
| `tray-resize-handle` | `trayResizeHandleModel` child | `trayComponents.renderTray` | Resizable expanded Folding Tray | Optional 44px pointer/touch/keyboard resize surface; emitted only when that tray enables resizing. |
| `tray-content` | `trayContentModel` child | `trayComponents.renderTray` | Folding Tray | Pluggable item-model content host. |
| `relic-tray` | `itemTrayModel` | Belt view | Map + Combat | Relics under SP. |
| `relic-slot` | `componentModel` semantic ID | Item view | Map + Combat | Individual relic tile. |
| `potion-tray` | `itemTrayModel` | Belt view | Map + Combat | Utility potion tray, right anchored. |
| `potion-control` | `componentModel` semantic ID | Item view | Inventory | Individual utility potion control. |
| `battlefield-stage` | `battlefieldStageModel` | `battlefieldStage.js` + `combat.js` | Combat | Data-driven protected corridor that centers combatants between the HUD and hand. |
| `combatant-frame` | `combatantFrame` | `combatantFrame.js` + `battlefieldStage.js` | Combat | Shared intent-and-card stack with responsive card-only scaling. |
| `player-combatant-frame` | `combatantFrame` variant | `combatantFrame.js` | Combat | Player combatant card. |
| `enemy-combatant-frame` | `combatantFrame` variant | `combatantFrame.js` | Combat | Enemy combatant card. |
| `combatant-sprite` | `combatantFrame` child | `combatantFrame.js` + `assets.js` | Combat cards | Rendered player or enemy figure. |
| `combatant-nameplate` | `combatantFrame` child | `combatantFrame.js` | Combat cards | Combatant name label. |
| `intent-indicator` | semantic component | `combat.js` + `uiContent.js` | Enemy cards | Telegraphed enemy action and amount. |
| `block-badge` | semantic component | `combat.js` | Combat cards | Current Guard/Block over the sprite. |
| `health-status-bar` | `resourceMeter` variant | `resbars.js` | Combat cards | Individual combatant HP bar. |
| `poise-status-bar` | `resourceMeter` variant | `resbars.js` | Combat cards | Individual combatant Poise bar. |
| `proc-status-bar` | semantic component | `combat.js` | Enemy cards | Individual Bleed/Frost/Insanity buildup bar. |
| `arcane-exposure-bar` | semantic component | `arcaneExposure.js` | Enemy cards | Individual Arcane Exposure meter. |
| `status-effect-tray` | semantic component | `combat.js` | Combat cards | Active status icons and stacks. |
| `tooltip` | semantic component | `tooltip.js` | All interactive surfaces | Shared contextual explanation. |
| `damage-feedback` | semantic component | `fx.js` | Combat feedback | One hit receipt containing Guard and HP channels. |
| `guarded-damage-indicator` | `damageFeedback` variant | `fx.js` | Combat feedback | Amount absorbed by Guard. |
| `health-damage-indicator` | `damageFeedback` variant | `fx.js` | Combat feedback | Residual damage applied to HP. |
| `player-hand-tray` | `componentModel` | `combat.js` + `hand.js` | Combat | Player card hand. |
| `combat-action-rail` | `componentModel` | `combat.js` | Combat | Edge-anchored Actions and Exhaust around a tight Draw / End Turn / Discard cluster. |
| `kit.pageDoor` | `pageDoor(spec)` | `kit/index.js` pageDoor | Every screen that asks something | The one door-opener: head with eyebrow, title and a single close control, a body the surface owns, and a foot on the button ladder. Four named widths (sm, md, lg, xl) or full; Escape, veil click and focus return are bound here once. |
| `kit.optionCard` | `optionCard(spec)` | `kit/index.js` optionCard | Every list of ways on | One choosable way on — glyph or art, name, description, optional badge, meta and trail — carrying its own selected and disabled states. |
| `kit.detailCard` | `detailCard(spec)` | `kit/index.js` detailCard | Inspectors and summaries | One subject described: eyebrow, name, line, meta, and any body the caller adds. The muted variant is the same card standing back. |
| `kit.statRow` | `statRow(spec)` | `kit/index.js` statRow | Character, Armoury, inspectors | One named quantity and its values, with an optional hint and a drill affordance; the flat variant drops the frame for rows already inside one. |
| `kit.band` | `band(spec)` | `kit/index.js` band | Run HUD, co-op board, screen feet | A horizontal strip of related facts; foot places it at the bottom, stack lets it wrap, quiet lowers its weight. |
| `kit.buttonRow` | `buttonRow(spec)` | `kit/index.js` buttonRow | Every modal foot and control row | A row of buttons on one ladder step, so siblings share a width and rows across the game land on one of four. |
| `kit.iconButton` | `iconButton(spec)` | `kit/index.js` iconButton | Chrome corners, trays, headers | A glyph in a square box with a real accessible name — the one shape for ✕, ☰ and the quick-settings pair. |
| `kit.segmented` | `segmented(spec)` | `kit/index.js` segmented | Settings, Armoury views, Custom Climb | One choice out of a small named set, drawn as joined segments rather than separate buttons. |
| `kit.stepper` | `stepper(spec)` | `kit/index.js` stepper | Stat points, flask counts, Custom Climb | A value between a decrement and an increment control, each addressable on its own. |
| `kit.labelStack` | `labelStack(spec)` | `kit/index.js` labelStack | Settings rows, forms, summaries | A label with its hint beneath it, so the pair never separates and a control is never left unexplained. |
| `kit.delta` | `delta(spec)` | `kit/index.js` delta | Comparison receipts, upgrade previews | Before and after drawn as one thing: what a swap or an upgrade would change a number from and to. |
| `kit.pip` | `pip(spec)` | `kit/index.js` pip | Belts, trays, status marks | A small glyph token with an optional count, tone and ring — the shape a slot, a charge or a mark takes. |
| `kit.artWell` | `artWell(spec)` | `kit/index.js` artWell | Cards, inspectors, class figures | A framed well holding either an image or a glyph, so art and its placeholder occupy the same box; hidden from assistive technology when it holds a glyph. |
| `kit.railItem` | `railItem(spec)` | `kit/index.js` railItem | Compendium, settings rails, owner pages | One entry in a navigation rail, which marks itself as current rather than being marked from outside. |
| `kit.popover` | `popover(spec)` | `kit/index.js` popover | Quick menu, flask menu, armament radial | A caption above grouped rows, hung off the control that opened it. |
| `kit.decide` | `decide(spec)` | `kit/index.js` decide | Every door that asks a question | The body of a decision — the question, what it costs, and the ways to answer — the shape a page door wraps when the surface is a question rather than a place. |

## Composition at a glance

```text
shared-run-hud
├─ run-header-strip
│  ├─ identity-cluster ── portrait-badge + character-title
│  ├─ cinders-counter
│  └─ build-metadata-trail ── metadata-field × 5
├─ primary-hud-row
│  ├─ vitals-panel ── panel + resource-meter
│  └─ quick-access-panel ── panel + action-control + flasks
└─ inventory-belt
   ├─ relic-tray ── item-tray + relic-slot × N
   └─ potion-tray ── item-tray + potion-control × N
```

Map and Combat mount the same shared HUD model. Combat adds the Battlefield
Stage, Combatant Frames, Player Hand Tray, and Combat Action Rail.

## Startup and Title components

The folded startup surface and the full title menu are separate compositions.
The startup gate consumes the first complete input and unmounts before Title is
created. Title then owns the reusable Load/New shell and supplies its save-slot
content as records, so changing art or copy does not require separate modal
markup.

```text
startup-gate
├─ startup-ash-field
│  └─ startup-ash-particle × N
└─ startup-mark
   ├─ startup-wordmark
   ├─ startup-subtitle
   ├─ startup-divider
   └─ startup-prompt

title screen
├─ title-brand-lockup
│  ├─ title-wordmark
│  ├─ title-subtitle
│  └─ title-divider
├─ title-menu
│  └─ title-menu-item × 6
│     └─ title-menu-gem
├─ title-tagline
└─ title-menu-modal
   ├─ title-modal-close-control
   ├─ title-modal-heading + title-modal-divider
   ├─ title-save-slot-list
   │  └─ title-save-slot × N
   │     ├─ title-save-slot-copy
   │     ├─ title-save-slot-state
   │     └─ title-save-slot-delete (occupied slots only)
   └─ title-modal-actions
      ├─ title-modal-back-control
      └─ title-modal-continue-control
```

## Character Creation components

These components are the production renderers used by Character Creation and
its `?shot=components` reference page. Art-bearing components receive their
visual node or content row from the existing asset/content registries, so later
custom art does not require a second card implementation.

| Component ID | Model / input | Renderer | Reuse |
|---|---|---|---|
| `character-disclosure` | disclosure entries | `disclosure.mountDisclosure` | Character Creation + catalog |
| `class-preview-pane` | class preview presentation | `creationCards.classPreviewPane` | Class preview + catalog |
| `class-resource-grid` | `statProjection.derived[]` | `creationCards.classResourceGrid` | Class preview + catalog |
| `class-choice-card` | class row + selected/locked state | `creationCards.classChoiceCard` | Class selection + catalog |
| `view-mode-toggle` | view-mode state | `creationCards.viewModeToggle` | Class/Equipment + catalog |
| `boolean-setting-toggle` | boolean setting state | `creationCards.booleanSettingToggle` | Auto-advance + future settings |
| `selection-section-face` | label/value/visual receipt | `creationCards.selectionSectionFace` | Equipment disclosures + catalog |
| `primary-stat-card` | `creationBrief.attributeCardModels` entry | `creationCards.primaryStatCard` + `disclosure.mountDisclosure` | Character Creation + Shrine allocation + Armoury + catalog |
| `stat-allocation-row` | one attribute allocation row | `statAllocationCard.renderStatAllocationCard` | Character Creation + Shrine allocation + catalog |
| `resource-strip` | derived rows + Poise receipt | `creationCards.resourceStrip` | Character stats + catalog |
| `mode-choice` | creation mode + selected state | `creationCards.modeChoiceButton` | Standard/Assign Points + catalog |
| `sprite-choice` | sprite-style row + selected state | `creationCards.spriteChoiceButton` | Appearance + catalog; Animated is the default when no explicit style is stored. |
| `tint-choice` | tint row + selected state | `creationCards.tintChoiceButton` | Appearance + catalog |
| `sigil-choice` | glyph + selected state | `creationCards.sigilChoiceButton` | Appearance + catalog |
| `keepsake-choice` | keepsake row + selected state | `creationCards.keepsakeChoiceButton` | Keepsake + catalog |
| `equipment-choice-card` | equipment row + selected state | `equipment.pieceChip` | Starting Equipment + Armoury/catalog |
| `relic-choice-card` | relic row + selected state | `creationCards.relicChoiceButton` | Starting Equipment + catalog |

```text
class-preview-pane
└─ class-resource-grid

character-disclosure
├─ mode-choice + primary-stat-card × N + resource-strip
├─ sprite-choice + sigil-choice + tint-choice
└─ keepsake-choice

stat-allocation-row (invisible composition parent)
├─ primary-stat-card + current value + decrement/increment controls
└─ unfolded reveal spans the full row width

primary-stat-card
├─ folded: short label + one-line summary + current value
└─ unfolded/tooltip: authored description + derived benefits and equipment gates
```

## Shrine components

| Stable ID | Model | Renderer | Reuse |
|---|---|---|---|
| `shrine-option-card` | `balance.ui.shrinePresentation` + option plan | `rest.mountRest` | Rest / Smith / Flask Allocation / Level Up |
| `smith-upgrade-modal` | `SmithSelectionModel` | `smithUpgradeModal.mountSmithUpgradeModal` | Dedicated Smith choose/review transaction |
| `smith-candidate-card` | `SmithSelectionModel.properties.candidates[]` | shared `card.renderCard` plus armament-tier banner inside Smith modal | One distinct owned armament below the run tier cap |
| `smith-upgrade-preview` | `SmithSelectionModel.properties.selected` | grouped delta renderer inside Smith modal | Tier, cost, purse, shortfall, and every sourced basic-card delta |

The default Shrine presentation is one vertical list. Every folded option uses
the same data-owned viewport footprint: width and height percentages come from
`balance.ui.shrinePresentation`, with accessible and wide-screen bounds. Opening
Flask Allocation or Level Up expands only that card's content below its unchanged
folded face.

Smith is a modal composition rather than an inline card dump:

```text
smith-upgrade-modal
├─ smith-candidate-card × distinct eligible owned armaments
├─ smith-upgrade-preview × selected armament's grouped card deltas
├─ Back to Shrine (also Escape)
└─ Confirm selected armament (disabled until selected and affordable)
```

Selection is reversible presentation state. Back and Escape restore the Shrine
without mutation. Confirm spends the displayed Smithing Stone cost, promotes exactly one
armament for the run, refreshes every sourced basic card from that armament, and leaves the
Shrine. Ordinary non-equipment cards retain their independent per-copy upgrade behavior.

## Folding Tray session geometry

Armoury supporting instances of `folding-tray` open at the data-authored 45vh
default, preserve at least 30vh for every expanded tray, and snap to 30, 40, 50,
60, 70, 80, or 90vh after drag or keyboard resizing. Fold and expanded-size
memory is keyed by tray ID for the current play session only; new/resumed runs
and returning to Title reset it. `tray-resize-handle` remains the shared 44px
mouse, touch-hold, and keyboard surface, while `tray-content` owns scrolling.

## Menu components

The production Quick Menu has one stable **Quick Menu** caption and defaults to
**Mirror** when the stored value is absent or invalid. Mirror keeps the
Settings/Controls tab strip and adds the contextual dropdown; legacy `off` and
`switcher` values remain explicit presentation modes. Settings and Controls lead,
followed by Fullscreen and Music, Inventory and Character, then Load, Save,
Save and Quit, and Quit Without Saving. The Quick Menu rows, Settings rows, and
`hud-quick-settings` controls project the same Fullscreen and Music owners; none
of those renderers keeps a second copy of browser or audio state.

PR #344's in-run overlay remains a separate composition: its only tabs are
Settings and Controls, while Save Game and Save and Quit stay in the persistent
footer. Fullscreen and Music remain the first relevant controls in Settings, so
the complete configuration surface and the two quick-control surfaces stay in
sync without duplicating persistence.

| Component ID | Model | Renderer | Purpose |
|---|---|---|---|
| `quick-menu-panel` | `quickMenuPanelModel` | `menuComponents.renderQuickMenu` | Mirror-default contextual dropdown opened from Map, Combat, or the mirrored overlay launcher. |
| `quick-menu-caption` | `quickMenuCaptionModel` | `menuComponents.renderQuickMenu` | Stable production **Quick Menu** caption; no test/experiment copy. |
| `quick-menu-row` | `quickMenuRowModel` | `menuComponents.renderQuickMenu` | Contextual destination/action or synchronized `role="switch"` Fullscreen/Music row with live state and condition copy. |
| `menu-overlay` | `menuOverlayModel` | `menuComponents.renderMenuOverlay` | In-run Settings/Controls dialog with persistent run-action footer. |
| `menu-tab-strip` | `menuTabStripModel` | `menuComponents.renderMenuOverlay` | Shared Settings/Controls navigation. |
| `menu-tab` | `menuTabModel` | `menuComponents.renderMenuOverlay` | One declared tab control. |
| `menu-panel` | `menuPanelModel` | `menuComponents.updateMenuSelection` | Content host for the selected tab. |
| `menu-footer` | `menuFooterModel` | `menuComponents.renderMenuOverlay` | Persistent run-action footer beneath Settings/Controls. |
| `save-game-control` | `componentModel` child + `CombatSnapshotService` command | `menuComponents.renderMenuOverlay` | Save the exact committed combat turn to the active slot and remain in the run. |
| `save-quit-control` | `componentModel` child + `CombatSnapshotService` command | `menuComponents.renderMenuOverlay` | Save the exact committed combat turn and return to the title screen. |
| `confirmation-modal` | `ConfirmationService` state + semantic callbacks | `confirmationModal.openConfirmationModal` | Shared themed Load / Quit Without Saving review surface. Danger variants expose `alertdialog`, focus neutral Back first, trap focus, cancel without mutation, restore the launcher, preserve the covered menu on Escape, and retain a bounded top-layer input shield across committed navigation. Parchment eyebrow text preserves blood/ember on borders while clearing 4.5:1; real hit-tested behavior and computed contrast are covered from Map and Combat at 1200×730, 390×844, and 320×640. |
| `confirmation-cancel-control` | confirmation cancel command | `confirmationModal.openConfirmationModal` | Stable neutral Back action; initial focus target for danger decisions, with launcher restoration and no state mutation. |
| `confirmation-action` | confirmation commit command | `confirmationModal.openConfirmationModal` | Explicit danger action; parchment text clears 4.5:1 while the danger border retains blood/ember, and the destructive callback runs exactly once and never before activation. |
| `controls-rebind-capture` | `rebind-capture-service` state | `controls.renderControls` | Controls keyboard/pad binding surface. An armed keyboard capture owns its keydown before the surrounding overlay. |
| `controls-key-rebind-control` | action id + capture state | `controls.renderControls` | Stable keyboard rebind action. Press… is cancelled by Escape without mutation, then focus returns to this control; re-arming accepts a free key. |

```text
quick-menu-panel
├─ quick-menu-caption
├─ quick-menu-row × 2: Settings + Controls
├─ quick-menu-row × 2: Fullscreen + Music
├─ quick-menu-row × 2: Inventory + Character
└─ quick-menu-row × 4: Load + Save + Save and Quit + Quit Without Saving

menu-overlay
├─ menu-tab-strip
│  └─ menu-tab × N
├─ menu-panel
└─ menu-footer
   ├─ save-game-control
   └─ save-quit-control

confirmation-modal
├─ confirmation-cancel-control
└─ confirmation-action
```

Both lifecycle controls enter the same `commitCombatSnapshot` boundary. The
focused rendered contract (`node tools/combat-save.mjs`) advances beyond combat
entry, saves in place, uses Save and Quit, loads through the occupied-slot
review action, and proves exact snapshot identity at 1200×730 and 390×844.
Its `--selftest` corpus plants a restarted encounter, a missing commit, and a
restore that drops the saved hand through copied real source doors.

Weapon-package migration adds no component ID or renderer family. At the load
door, an active exact snapshot keeps its saved loadout authoritative and reuses
`WeaponDeckCompositionService` across the stable generated attacks in draw,
hand, discard, and exhaust. The player-facing Armoury remains the existing
`armoury.cardsCard`, `armoury.cardRow`, and `equipment-comparison` composition;
snapshot migration is model/service state only.

Load and Quit Without Saving use `confirmation-modal` rather than the browser's
native prompt. `node tools/confirmation-modal.mjs` proves both commands from Map
and Combat, cancellation/focus restoration, layered Escape, exact-once commit,
real coordinate-based double activation without Title/enemy click-through,
computed action/eyebrow contrast of at least 4.5:1, viewport fit, 44px actions,
and captured console/network diagnostics at
1200×730, 390×844, and 320×640. Its `--selftest` corpus plants bypass, unsafe
initial focus, underlying-overlay Escape, cancel mutation, double commit, broken
focus return, target/overflow regressions, premature input-shield removal, and
low-contrast danger text.

## Armoury components

| Component ID | Model | Renderer | Purpose |
|---|---|---|---|
| `armoury-overlay` | `armouryOverlayModel` | `armouryComponents.renderArmouryOverlay` | Modal veil and Armoury focus scope. |
| `armoury-panel` | `armouryPanelModel` | `armouryComponents.renderArmouryPanel` | Complete responsive Armoury surface. |
| `armoury-header` | `armouryHeaderModel` | `armouryComponents.renderArmouryPanel` | Title, view switcher, and close action. |
| `armoury-view-switcher` | `armouryViewSwitcherModel` | `armouryComponents.renderArmouryPanel` | Player labels are Character / Inventory / Hybrid; the compatibility keys remain `grid` / `rack` / `hybrid` internally. |
| `armoury-body` | `armouryBodyModel` | `armouryComponents.renderArmouryPanel` | Responsive Character and Armaments workspace selected by the current player view. |
| `armoury-figure` | semantic child model | `equipment.js` + `assets.js` | Layered equipped character figure. |
| `equipment-slot` | `equipmentSlotModel` | `armouryComponents.renderEquipmentSlot` | One named equipment socket. |
| `equipment-set-cell` | `equipmentSetCellModel` | `armouryComponents.renderEquipmentSetCell` | One active, empty, or locked set cell. |
| `armoury-inventory` | `armouryInventoryModel` | `equipment.js` inside `renderTray` | Inventory tray content and the single carried-item list. |
| `inventory-item-card` | `inventoryItemCardModel` | `armouryComponents.renderInventoryItemCard` | Folded carried-item face. The current `inventoryItem` class explicitly enables `holdAction`; its folded and expanded states are one action/progress surface, and an early release aborts without changing equipment. In combat its Equip/Move/Unequip action dispatches the priced player-turn `changeEquipment` intent. |
| `inventory-detail-card` | `inventoryDetailCardModel` | `armouryComponents.renderInventoryDetailCard` | Expanded art, tags, mods, and action label inside the same whole-card hold surface; the label is not a second action button while hold confirmation owns the action. |
| `equipment-comparison` | semantic child model + `armouryUi.layout.comparison` | `equipmentReceipts.js` in shared tooltip or item card | Full before/after receipt, including exact weapon-package card counts and slot-bound upgrade changes. Authored presentation chooses a sustained-hold tooltip or inline content, with data-owned hold threshold, width, and viewport cap. |
| `armoury-stats-panel` | `armouryStatsPanelModel` | `equipment.js` inside `renderTray` | Stats tray content: attributes, combat values, resources, relic summary, and the equipment receipts (card packages, requirements, Poise threshold, Equip load with its Weight Class — `armoury.playerLoadReceipt`). |
| `armoury-card-strip` | `armouryCardStripModel` | `equipment.js` + `card.js` inside `renderTray` | Cards tray content: exact equipment-associated card counts grouped by card/profile in list or grid presentation. |
| `armoury-region-header` | compatibility semantic ID | replaced by `tray-header` | Historical Armoury-only fold header name. |

```text
armoury-overlay
└─ armoury-panel
   ├─ armoury-header ── armoury-view-switcher
   ├─ player view: Character / Inventory / Hybrid
   │  └─ compatibility key: grid / rack / hybrid
   ├─ responsive subject region (armoury-body)
   │  ├─ armoury-figure
   │  └─ equipment-slot × N ── equipment-set-cell × N
   ├─ shared folding-tray family × 4
   │  ├─ tray-header
   │  ├─ tray-resize-handle (optional; expanded when enabled)
   │  └─ tray-content
   │     ├─ Armaments
   │     ├─ Inventory ── armoury-inventory
   │     ├─ Cards ── armoury-card-strip
   │     └─ Stats ── armoury-stats-panel
   └─ armoury-inventory
      └─ inventory-item-card × N ── inventory-detail-card
         └─ equipment-comparison (delayed tooltip/focus or inline)
```

The four current Armoury tray families are Armaments, Inventory, Cards, and
Stats. They share the same `folding-tray` shell while their content components
remain independent. The current `inventoryItem` class enables whole-card hold
confirmation in both disclosure states; comparison presentation remains a
sustained-hold tooltip or inline receipt. Hover/focus alone does not open it. See the
[four-edge ASCII and interaction contract](./TRAY-COMPONENTS.md).

Armaments uses the shared shell without a resize handle. Inventory has a height
handle only when rendered as a supporting tray; it has no tray-height handle
when it fills the Inventory pane. Cards and Stats may expose their configured
expanded-state handles. Folding, sorting, and resizing are independent
capabilities rather than guarantees of every tray instance.

### Asset Components / Rendered Armoury

The dotted IDs below are stable references for rendered Armoury pieces called
out by design screenshots and implementation notes. They complement the
semantic IDs above rather than replacing them. Select a dotted ID in the
[interactive catalog](./component-catalog.html?group=armoury-assets), or use the
full selector/owner cross-reference in
[`ASSET-COMPONENTS.md`](./ASSET-COMPONENTS.md). The machine-readable authority
is [`assets/components/armoury.json`](../assets/components/armoury.json).

| Rendered family | Searchable asset IDs |
|---|---|
| Shell and player views | `armoury.shell`, `armoury.viewSwitcher`, `armoury.characterView`, `armoury.inventoryView`, `armoury.hybridView`, `armoury.characterViewButton`, `armoury.inventoryViewButton`, `armoury.hybridViewButton` |
| Character composition | `armoury.characterPane`, `armoury.spritePane`, `armoury.characterSummary`, `armoury.combatPowerCard`, `armoury.combatPowerGroup`, `armoury.combatPowerMetric`, `armoury.attributesCard`, `armoury.attributeCard`, `armoury.relicsCard` |
| Armaments tray and pane | `armoury.equipmentPane`, `armoury.armamentsCard`, `armoury.armamentsHeader`, `armoury.armamentsFoldButton`, `armoury.armamentsExpanded`, `armoury.armamentsFolded`, `armoury.armamentViewToggle`, `armoury.hybridPaneSplitter` |
| Procedural equipment-position cards | `armoury.equipmentPositionCard`, `armoury.occupiedPositionCard`, `armoury.emptyPositionCard`, `armoury.lockedPositionCard`, `armoury.positionLabelPane`, `armoury.positionSpritePane`, `armoury.summaryDivider`, `armoury.positionSummaryPane`, `armoury.positionAction`, `armoury.armamentItemCard`, `armoury.armamentDetailPane`, `armoury.armamentGridGroup`, `armoury.positionGridCard`, `armoury.occupiedPositionGridCard`, `armoury.emptyPositionGridCard`, `armoury.lockedPositionGridCard`, `armoury.armamentGridDetails` |
| Inventory and comparison | `armoury.inventoryCard`, `armoury.paneSplitter`, `armoury.itemCard`, `armoury.inventoryItemClass`, `armoury.itemReveal`, `armoury.comparisonTooltipAnchor`, `armoury.equipmentComparison`, `armoury.inventoryTrayResizeHandle` |
| Cards, Stats, and disclosure | `armoury.cardsCard`, `armoury.cardList`, `armoury.cardRow`, `armoury.cardDetail`, `armoury.cardViewToggle`, `armoury.cardsTrayResizeHandle`, `armoury.statsTray`, `armoury.statsSummary`, `armoury.statsTrayResizeHandle`, `armoury.disclosure` |

Within each procedural equipment group, empty positions are ordered after the
occupied and locked positions. Their Grid presentation spans every column,
making the empty drop target a full-width bottom row.

### Combatant card detail

```text
combatant-frame
├─ component-background
├─ intent-indicator                 enemy variant
├─ combatant-sprite
│  └─ block-badge                   when Guard > 0
├─ combatant-nameplate
├─ health-status-bar
├─ poise-status-bar
├─ proc-status-bar × 0..2           Bleed/Frost/Insanity buildup
├─ arcane-exposure-bar              enemy, when available
└─ status-effect-tray

damage-feedback
├─ guarded-damage-indicator         Guard absorbed
└─ health-damage-indicator          residual HP loss
```

`tooltip` is a shared overlay used by these parts and by controls throughout the
game. The catalog expands this combatant family because its pieces have distinct
behavior and visual meaning; this does not declare that every other catalog item
is indivisible.

## Merge/PR rule

Any UI element or component change should link this catalog in the merge or PR
summary. If the change alters a stable ID, model/factory, renderer, composition,
or reuse surface, update this catalog and the matching visual miniature before
the merge.

## Current shared HUD tuning

The catalog's shared HUD currently uses a 70% portrait-badge scale, an 8 px
primary-row gap, a 2 px Quick Access card gap, and a 2 px vertical vital-row
gap. These are data-owned in `balance.ui.hudPresentation`, projected once by
`src/main.js`, and consumed by the shared Map/Combat stylesheet.

### Data-driven presentation tokens

| Setting | Default | Runtime projection | What it controls |
|---|---:|---|---|
| `componentBackgroundOpacityPct` | `0` | `--hud-component-background-opacity` | Shared component-card background opacity. |
| `metadataFontPx` | `11` | `--hud-metadata-font-px` | One font size for Act, Floor, Build, Seed, and Source. |
| `beltItemGapPx` | `2` | `--hud-belt-item-gap-px` | Uniform relic/potion slot spacing. |
| `portraitScale` | `0.7` | `--hud-portrait-scale` | Portrait-badge size without changing identity semantics. |
| `primaryRowGapPx` | `8` | `--hud-primary-row-gap-px` | Gap between Vitals and Quick Access. |
| `controlGapPx` | `2` | `--hud-control-gap-px` | Gap inside the Quick Access 2×2 control grid. |
| `resourceRowGapPx` | `3` | `--hud-resource-row-gap-px` | Vertical spacing between HP, MP, and SP. |
| `cindersMaxWidthPct` | `30` | `--hud-cinders-max-width` | Maximum centered Cinders track width in viewport units. |
| `metadataMaxWidthPct` | `30` | `--hud-metadata-max-width` | Maximum right metadata-trail width in viewport units. |
| `metadataShowTotals` | `false` | `data-hud-metadata-show-totals` | Whether Act/Floor include their `/ total` values. |

Changing these defaults is a data edit. `src/main.js` validates and projects
them; Map and Combat then consume the same runtime values through the shared HUD.

### Run-header layout contract

```text
┌──────────────────────────── run-header-strip ────────────────────────────┐
│ identity-cluster      cinders-counter       build-metadata-trail          │
│ [◎ NAME · CLASS]          ⛁ 42              ACT 1 · FLOOR 1 · BUILD …    │
│      flexible             ≤ 30vw              ≤ 30vw; hides rightmost     │
└───────────────────────────────────────────────────────────────────────────┘
```

The three columns negotiate inside one grid. `cinders-counter` stays centered;
`build-metadata-trail` is capped and progressively hides Source, Seed, then
Build. `metadataShowTotals` is false by default, so only current Act/Floor are
shown.
