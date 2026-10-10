# AshenSpire component catalog

The map's `act-route-strip` uses `ActRouteModel` and `actRouteStripHtml` to show
the act title, Entrance, a fixed evenly spaced circle for each non-boss floor,
and Boss on one desktop row. Committed visits fill circles with the shared map
glyph; the current node receives a ring and future kinds stay undisclosed.
On phones the title moves above the rail. The authored dungeon adapter uses
its numbered room positions and visited history. This is a read-only receipt;
selecting a destination for inspection does not record travel.

`prologue-screen` composes text-free WebP paintings, a class item layer, motif
wash, live narration, and a control band that is the frame's own last row — the
buttons and the scene counter stay at the bottom whichever wireframe is standing
(caption below the art, text over it, letterbox, or a side panel), unless
`controlsPosition` puts them back under the text. `src/model/prologue.js`
projects Advanced → Opening settings; `src/ui/screens/prologue.js` is shared by
new games and the settings preview. The opening is nine authored scenes — five
shipped and four empty slots a scene can be added into — played in a configured
order over a configured subset, each with its own artwork, banner, hold, music
and stinger. Staging (`PROLOGUE_STAGE_FIELDS`) is answered by the opening or by
a single scene that sets `ownStaging`: wireframe, artwork scale/fit/focus and
picture treatment, camera, wash, every part of the text and its container, the
reveal, and the transition. All of it rides in configuration exports, in a scene
file of its own, and in three named preset slots. Interrupted saves resume at a
scene boundary — on the next scene still in the opening when the one they
stopped on has been switched off; Set forth reveals the first playable map.
`node tools/screenshot.mjs --only prologue` photographs it (`?shot=prologue`,
staged with `?shotSettings={…}`).

`equipment-animation-reference` derives the active presentation from class,
armour, ordered right/left weapon groups and optional grip. Its model is
`src/model/equipmentAnimation.js`; authored references live in
`content/config/ui/presentation/equipmentAnimations.json`. The painted stage,
Armoury, conversation and portrait views share those references. The visual
catalog includes greatsword, sword/shield and unarmed ready stances. Each family serves 35 armor entries with 32 outfit appearances; catalog art aliases reuse their corresponding frames. Unarmed physical attacks and casting have separate references within one shared profile.
Twin swords add 32 appearances across those 35 entries, sharing one motion profile. Optional per-hand item constraints select only the authored right Straight Sword / left Katana order; reversed hands retain existing art. The [twin-sword workshop](../art/twin-sword-reference-2026-09-19/index.html) compares outfits and edits playback order.
See [equipment animation references](EQUIPMENT-ANIMATION-REFERENCES.md).

Empty-hand magic adds 16 addressable poses for each of the 32 appearances,
covering all 35 armor entries. The shared unarmed profile uses the nine-step
magic channel/release clip for casting and a self-directed magic buff pose;
physical references remain the defaults for ordinary attacks and other roles.
The [magic gallery](../art/unarmed-magic-2026-09-19/index.html) includes class and
armor filters, labeled sheets and synchronized playback.

`offlinePlay.js` supplies the shared **Download & saves** modal, opened from
Title and Settings (including in-run Settings). Release metadata supplies its
version, size, and numbered download; `src/content/offlinePlay.js` owns the feed,
instructions, and transfer limits. The save-transfer engine validates all slots
before replacing storage and preserves a recovery copy. Import is available from
Title, with a preview and confirmation. For a pack-shaped build the modal also
offers **Download a folder copy (zip)** (`offline-folder-copy`, step 7 of
docs/EXTERNAL-ASSETS-PLAN.md): the game assembles the page, its light and common
packs and their objects into one zip, checking each file as it is written. See
[offline play](offline-play.md).

All run maps share the vector face in `mapNodeInk.js`: opaque dark discs, readable
glyphs, a pale current-node marker and reachable halos. `mapview.js` owns the
node radii; `AtlasCameraModel.js` frames a journey junction using that same close-up
scale. World map fog compositing is bounded to the visible viewport.

Card flick controls: Accessibility offers Card flick to play and a 32–160 CSS-pixel
distance setting (64 default), synchronized numeric field/slider, Reset, and a
harmless practice surface. `TouchFlickModel.js` resolves distance, recent speed and
nearest-target ties; `flickPractice.js` shares that recognition with the combat
hand for touch, mouse, trackpad dragging and pen. Existing saved settings retain
their values. The selected card and separate Information button remain unchanged.
See [card removal and touch flick validation](qa/card-removal-touch-flick.md).

`card-shelf` is the one row of resting cards. Up to four stand across it; every
track is the same width, floored at a legible minimum and capped at the card's
resting width, and when the room for four is not there it drops a column rather
than shaving the cards. The three numbers are authored at
`content/config/ui/components/card.json -> sizing.shelf`;
`src/ui/models/CardSizeModel.js` owns the arithmetic
(`cardShelf`, `cardShelfColumnsAt`, `cardShelfTrackPx`),
`styles/kit.css` draws it, and `src/ui/components/cardShelf.js` measures each
shelf so a last row of two is not drawn wider than the four above it. The
card-removal grid and mount service deck list retain this card-grid layout.
Merchant buy, sell and service shelves override the track layout with
`merchant-offer`: full-width artwork/details/action rows sharing the book
shelf's spacing tokens. Compact artwork opens inspection with the complete
description. Four equal-height offers fit the pane on portrait and desktop
hosts; additional stock scrolls. A fixed bottom category dock keeps navigation
and the selected purchase footer below the offers. Short landscape hosts scroll
at a readable minimum row height.
Direct Cards and loose Weapon Arts purchases are absent from the merchant,
including saved visits. Books, armaments, relics, supplies and services remain.

`skill-book-offer` is the market's full-width `[book | details | Buy]` row.
`src/ui/components/skillBookOffer.js` renders live consumable copy and price;
`shop.js` binds the existing purchase review/hold and revalidating commit.
Four equal-height rows fit the merchant pane; compact hosts retain all three columns.
Shared tokens live in `ui/screens/shop.json` → `components.bookOffers`; the merchant's
four-row height is measured by `wireShopLayout`, with its compact composition in
`styles/player-polish.css`. Artwork
resolves through `bookArt.renderBookArt` / `assetUrl`. The book shelf uses the selected footer Buy and an Inspect thumbnail for full details. See the real
[shop preview](../docs/preview/book-library/preview.html).

This is the quick-reference library for the reusable UI vocabulary. The visual
catalog is available at [`component-catalog.html`](./component-catalog.html).
Select any component card there to open its detail drawer. The dedicated
[`tray-gallery.html`](./tray-gallery.html) shows all eight top/right/bottom/left
folded and unfolded Tray states using the production renderer.

The [Pose & Effects Studio](../art/pose-studio/index.html) provides a reusable
animation-authoring workspace: effect library, anchored stage, five-to-seven
pose strip, layered cue timeline, selection inspector, binding rule builder,
and relationship view. Its stage and library provide live visual miniatures
of all 80 effect sets. The shared `presentationSequence` model owns project
validation and matching; the optional gameplay adapter preserves existing FX.
See [launch, package and integration instructions](../pose-studio/README.md).
The authoring flow uses template starts, immediate effect previews, a direct
card connection action, progressive disclosure for precise controls, and
an inline effect tray at narrow widths. The preview has visible size, hide,
duplicate and remove controls, corner resize handles and independent view zoom.
Each effect has a six-frame strip with move/trim handles and a removal button.
The tray and inspector reuse the original DOM and restore focus on close.
`pose-studio/tests/direct-editing.mjs` checks pointer/touch manipulation;
`pose-studio/tests/usability.mjs` covers this
workflow at desktop and phone sizes; no game presentation rules are replaced.

The [combat sprite catalog](../art/combat-effects-2026-09-07/sprite-catalog.html)
shows all 56 six-frame sets. `combatEffectPlan` resolves presentation tag
combinations; `playCombatEffectPlan` renders the shared solo/co-op cast and
target sequence. `combatEffectForEvent` owns status and defensive reactions.
These transient overlays use the existing FX layer and introduce no new HUD
component IDs. The adjacent card preview names the matched rule and equipment
profile; the catalog provides visual miniatures for every exported set.

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
| `player.scenePainting` | `PlayerArtworkModel` | `scenePainting`, `servicePortrait` | Title, rest and services | Painted scenery with independent foreground layers. |
| `player.engravedIcon` | `engravedGlyphId` | `engravedIcon`, `engravedIconHtml` | Shared controls | Current-color engraved icons with tier-aware masks. |
| `illustrated-card` | `card-layout.json`, generated card objects, `extendedCardArtwork.js`, `combatSigils.js`, `combatCardDamageLabel` | `illustratedCardHtml`, `fitIllustratedCards` | All ability cards | Existing frame, live centered rules and stamina/mana banners. Nine explicit paint levels separate card background, art, heading/footer backdrops, footer trim, banner/panel fills, card/panel trims, icons, text and rank. Positive ranks appear as Rank X centered above the adaptive effect panel; Rank 0 stays hidden. The base frame contains a taller action bay with original stone texture, connected gold braces, and a larger centered inline action symbol and name. The parchment ends directly above it. A dark backdrop covers each full card name and fades into the artwork. Card names have a dark outline and shadow, and side symbols have thick black halos. Up to three primary tags use a vertical solid-symbol rail on the right; Smash is a fist and Counter is a shield with a diagonal sword. The bottom keeps the primary action sigil and name. Version-2 damage rules show actual written types, including mixed contacts and Counter HP returns; complex rules retain authored text with a short damage-type prefix. School and secondary tags stay in Information. Complete adaptive effects borrow artwork space when needed. Canonical card/profile portraits cover the artwork region with lower-action framing; upgrades reuse base artwork. |
| `combat-coop-upcast-control` | Card selection | `coopUpcastControl.wireCoopUpcastControl` | Co-op combat | Reuses the solo selected-card control wrapper and mobile touch targets. Hostile upcastable cards select before submitting; the isolated button opens the shared rank chooser without playing the card. |
| `combat-upcast-choice` | `upcastOptions` | Selected-card controls + `upcastChoice.openUpcastChoice` | Solo and co-op combat | Temporary rank choice before payment. With the default-off setting, the under-card Upcast button reveals the native inline picker in solo or the shared chooser in co-op; enabling the setting prompts with the shared modal after target choice. The shared hand reveals pager-focused faces before selection and selected controls afterward. An overflow-visible fan shifts only the active owner, keeping the chooser beneath it and the page and combat HUD still; focus alone leaves the chooser hidden. Cancel retains card, rank and target without spending resources. |
| `combat-status-recovery` | `recoveryControls`, `controlGate` | `combat`, `coop` | Solo and co-op combat | Synthetic status recovery and Stand up controls show per-stack SP cost and affordability only when needed. The standalone Block, Barrier and Ward summary box is removed. |
| `combat-blight-hud` | `ashenBlightBarHtml` | `combat`, `coop` | Solo and co-op combat | Positive Ashen Blight appears in a wide centered header meter with a broad molten-orange river between textured black basalt banks; zero is hidden. Phones reserve a separate row beneath the header controls. |
| `illustrated-background` | Environment artwork and floor model | `illustratedBackground` | Battlefields | Painting covers the combat header and leaves half a formation row of ground above the furthest row; all formation cells preserve floor anchors through defeats. |
| `illustrated-vitality-hud` | `RunHudViewModel` | `hudmeta`, `runHud` | Run screens | Enlarged HP above relics and illustrated controls; solo combat shares the cards' leather material, opaque through measured Vitality and transparent at the turn ribbon. Measured combat header clearance stays reserved. |
| `skill-book-offer` | `consumablePurchasePlan`, shop `components.bookOffers` | `skillBookOffer.renderSkillBookOffer` | Market | Uniform book sprite, live details and native Buy control. |
| `merchant-offer` | `ShopWorkspaceModel` offers + shared book-offer tokens | `merchantOffer.arrangeMerchantOffer` + `shop.mountShop` | Merchant buy, sell and service shelves | Equal full-width artwork/details/action rows, with native inspections, confirmations and holds. Four compact rows with art inspection, a fixed bottom category dock, and selected footer action; three columns remain on phones. |
| `book-art` | `BOOK_ART_PRESETS`, `bookArtRecipe`, `bookArtLayers` | `bookArt.renderBookArt` | Market, Armoury, reading modal, Book Atelier | Painted cover, independently colored leather mask, trim and symbol; three covers, thirty symbol variations and ten authored recipes. |
| `book-learning` | `skillBookReadPlan`, `bookLessons` | `bookLearning.openBookLearning` | Armoury, library preview | Searchable cross-class lesson choices, XP track selector for universal books, live card preview and atomic Read and learn. Cancelling preserves the book. |
| `startup-gate` | `startupGateModel` | `startupGate.mountStartupGate` | Cold boot | Input-gated wordmark and family prompt over River Citadel; activation lights the city, holds for Settings > General > Display > Title screen > Lit city pause, then fades into the layered hall. Title mounts after the fade. |
| `startup-ash-field` | `startupGateModel.properties.particles` | `startupGate.mountStartupGate` | Startup Gate | Decorative particle host; visual-only and removed with the boot gate. |
| `startup-ash-particle` | deterministic particle record | `startupGate.mountStartupGate` | Startup Ash Field | One data-driven ash mote with position, delay, duration, and size. |
| `startup-mark` | startup copy + responsive presentation | `startupGate.mountStartupGate` | Startup Gate | Centered folded-title content group; its phone backing is fully transparent. |
| `startup-wordmark` | `startupGateModel.properties.wordmark` | `startupGate.mountStartupGate` | Startup Mark | Replaceable Ashen Spire wordmark text with a feathered translucent backing that fades in. |
| `startup-subtitle` | `startupGateModel.properties.subtitle` | `startupGate.mountStartupGate` | Startup Mark | Replaceable genre subtitle. |
| `startup-divider` | semantic child | `startupGate.mountStartupGate` | Startup Mark | Decorative gold rule separating title copy from the prompt. |
| `startup-prompt` | input-family prompt record | `startupGate.mountStartupGate` | Startup Mark | Polite live-region invitation updated for pointer, touch, keyboard, or controller. |
| `boot-art-status` | `bootArtStatusModel` (`bootArt.bootArtLine`) | `bootArtStatus.mountBootArtStatus` (beside the gate, by `main.js showStartupGate`), rewritten by `bootArt.paintBootArt` | Cold boot, beside Startup Gate | Web edition only (a build that pins packs). Not one of the gate's parts: a sibling in `#app`, outside the gate's `role="button"`, laid over its top edge, clear of the lockup and the build stamp, and taking no input. One polite, aria-busy status line — "Loading art…", then "Loading art · n of N" over the critical set `content/config` lists, then nothing; the failure sentence when the load failed. Stays through the reveal; pulses unless Reduced motion. |
| `art-load-notice` | `artLoadNoticeModel` | `artLoadNotice.mountArtLoadNotice` (drawn by `main.js` through `mountTitle`'s `artNotice`) | Title screen | Web edition only, when the built-in art could not be loaded: a non-blocking panel at the top of the title, its FIRST child, so reading, Tab and cursor order meet it before the menu. Its message is one polite live node rewritten in place; failed, retrying and failed-again states. |
| `art-load-notice-retry` | `artLoadNoticeModel` child | `artLoadNotice.mountArtLoadNotice` | Art Load Notice | Retry: reloads the indexes through the Art quality queue (`artTier.retryBuiltInArt`, its own 60 s deadline); `aria-disabled` while it runs, keeping focus; a load that succeeds redraws the title on the new art. |
| `title-brand-lockup` | title content records | `title.mountTitle` | Title screen | Centered wordmark, subtitle, and divider composition. |
| `title-wordmark` | title content record | `title.mountTitle` | Title Brand Lockup | Main Ashen Spire title text. |
| `title-subtitle` | title content record | `title.mountTitle` | Title Brand Lockup | Main title genre subtitle. |
| `title-divider` | semantic child | `title.mountTitle` | Title Brand Lockup | Gold rule and diamond under the title. |
| `title-menu` | title content records | `title.mountTitle` | Title screen | Centered unfurled Continue / Load / New / Collection / Settings / Quit menu. Narrow layouts reserve the wordmark band and scroll the menu independently to keep every action reachable. |
| `title-menu-item` | action content record + availability | `title.mountTitle` | Title Menu | One keyboard, pointer, touch, and controller-ready menu action. A disabled entry with a `reason` (Continue with no save) wears it as a `disabled-reason-note` under it. |
| `disabled-reason-note` | `refusal.reasonNote` / `reasonWhenDisabled` / `refusesWhen`; kit `titleMenu` entry `reason` | `.as-fieldnote.as-reasonnote` line under the control's button row | Every forward control that can refuse: character creation Next / Continue / Begin, custom run and lobby Begin, event and dialogue Continue, reward Confirm, title Continue, save-slot Continue, hand-discard Confirm, atlas Enter (the act map has none: its tray only opens where Enter is live), Smith and mount-service Confirm | The reason a Next / Continue / Confirm is off, as visible text (FINISH §6): hidden while the control works or is itself hidden, named in its `aria-describedby`, an 11 px floor. Measured by `tools/disabled-reason.mjs`. |
| `title-menu-gem` | semantic child | `title.mountTitle` | Title Menu Item | Decorative diamond separator shown beneath a menu label. |
| `title-tagline` | title content record | `title.mountTitle` | Title screen | Replaceable centered closing line beneath the main menu. |
| `title-menu-modal` | `saveSlotSelectionModel` + save-slot records | `title.mountTitle` | Title screen | Reusable LOAD GAME / NEW GAME modal; selected card, accessibility state, and primary action target share one immutable projection, while `load-review` confirms a twice-activated save before loading. |
| `title-modal-close-control` | modal action record + authored tap floor | `title.mountTitle` | Title Menu Modal | Close control with a 75%-sized visible square inside its full tap-safe target; restores focus to the title menu. |
| `title-modal-heading` | modal-kind projection | `title.mountTitle` | Title Menu Modal | LOAD GAME or NEW GAME accessible dialog heading. |
| `title-modal-divider` | semantic child | `title.mountTitle` | Title Menu Modal | Gold rule and diamond beneath the dialog heading. |
| `title-save-slot-list` | `saveSlotSelectionModel` | `title.mountTitle` | Title Menu Modal | Immutable Load/New selection aggregate whose child records identify the selected slot and semantic select command. |
| `title-save-slot` | `saveSlotSelectionModel` child + save summary + `balance.ui.titleLoadHold` | `title.mountTitle` | Load/New modal | Occupied, empty, selected, focused, disabled, and hoverable slot surface; New Game keeps focus and selected styling on the same empty slot, while occupied Load slots support one-tap selection, second-activation review, and pointer/touch hold-to-load. |
| `title-save-slot-copy` | save summary record | `title.mountTitle` | Title Save Slot | The climb's name and its state line, or the empty slot's. The seed is not on the row: the confirming doors carry it, and so does the run's own header once loaded. |
| `title-save-slot-state` | slot availability projection | `title.mountTitle` | Title Save Slot | The slot's state line: the climb's act, floor and HP, or the invitation to start one. |
| `title-save-slot-delete` | slot id + hold-confirm behavior + authored tap floor | `title.mountTitle` | Occupied Title Save Slot | Tap-floor-sized destructive control with shared hold-confirm timing. |
| `title-modal-actions` | `saveSlotSelectionModel` action projection + modal kind | `title.mountTitle` | Title Menu Modal | Responsive Back/Continue group; Continue remains enabled for and targets the selected slot, while the `load-review` variant becomes Back to Saves / Load Save. |
| `title-modal-back-control` | modal action record | `title.mountTitle` | Title Modal Actions | Returns to the title menu, or from `load-review` to the Load Game slot list with selection preserved. |
| `title-modal-continue-control` | `saveSlotSelectionModel` action child | `title.mountTitle` | Title Modal Actions | Carries the selected slot as its semantic load/create command payload; the review variant exposes a positive Load Save action. |
| `offline-play-modal` | `offlinePlay` content record + build.json feed (`releasedDownload`, `releasedZip`) | `offlinePlay.openOfflinePlay` | Title and Settings → Download & saves | Shared Download & saves dialog: branch feed, the light single-file download and its direct link, the folder copy, Make available offline, and save export/import. |
| `offline-folder-copy` | `releasedZip` plan + `assembleZip` progress (`offline.zip.*` uiStrings) | `offlinePlay.openOfflinePlay` | Download & saves | Folder copy (zip) of a pack-shaped build: four instruction rows, a Download game folder (zip) button that becomes Save zip file after a Blob save, a progress bar and a polite status line; for a single-file build one line says the Download is already the whole game. |
| `shared-run-hud` | `runHudViewModel` | `hudmeta.sharedRunHudHtml` | Map + Combat | One shared run HUD composition of header, resources, controls, and belt. |
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
| `quick-access-panel` | `quickAccessPanelModel` | `quickAccessPanelHtml` | Map + Combat | Armoury and menu; deck editing stays in the Armoury. |
| `action-control` | `actionControlModel` child | `quickAccessPanelHtml` | HUD controls | Shared activation semantics. |
| `hotkey-badge` | `componentModel` semantic ID | View-owned | HUD controls | Configurable key hint badge. |
| `armoury-control` | `actionControlModel` | Quick Access view | Map + Combat | Opens Armoury. |
| `quick-menu-control` | `actionControlModel` | Quick Access view | Map + Combat | Opens quick menu. |
| `hud-quick-settings` | `hudQuickSettingsModel` | `hudQuickSettingsHtml` | Title + Map + Combat | Shared right-anchored Fullscreen/Music utility rail. Phone faces are 32px (20% smaller) inside unchanged 44px touch targets; compact HUD anchors the pair below potions. |
| `fullscreen-control` | `componentModel` child | `hudQuickSettingsHtml` | HUD Quick Settings | Live browser-state Fullscreen action mirrored by Quick Menu and Settings; unavailable when the platform exposes no API. |
| `music-control` | `componentModel` child | `hudQuickSettingsHtml` | HUD Quick Settings | Positive-state Music toggle mirrored by Quick Menu and Settings and persisted through the shared settings owner. |
| `crimson-flask-control` | `componentModel` | `flask.flaskPresentation` | Map + Combat | Health charge flask. |
| `azure-flask-control` | `componentModel` | `flask.flaskPresentation` | Map + Combat | Mana charge flask. |
| `inventory-belt` | `inventoryBeltModel` | `inventoryBeltHtml` | Map + Combat | Shared relic/potion belt, visible in combat and hidden on map screens. |
| `item-tray` | `itemTrayModel` child | Belt view | Inventory | Shared horizontal tray behavior. |
| `item-slot` | `componentModel` semantic ID | Item view | Inventory | Generic item slot contract. |
| `folding-tray` | `trayModel` | `trayComponents.renderTray` | Armoury + future menus | Edge-aware disclosure composition. |
| `tray-header` | `trayHeaderModel` child | `trayComponents.renderTray` | Folding Tray | Arrow, name, quantity, and optional sort action. |
| `tray-resize-handle` | `trayResizeHandleModel` child | `trayComponents.renderTray` | Resizable expanded Folding Tray | Optional 44px pointer/touch/keyboard resize surface; emitted only when that tray enables resizing. |
| `tray-content` | `trayContentModel` child | `trayComponents.renderTray` | Folding Tray | Pluggable item-model content host. |
| `relic-tray` | `itemTrayModel` | Icon tray (`iconTray.js`) | Every run HUD, map included | Relics under SP: the shared icon tray, one non-wrapping row with a `+N` tile. |
| `relic-slot` | `componentModel` semantic ID | Tray icon (`relicRail.js`) | Every run HUD | One relic: the round Pip the status icons wear; tap explains, a second tap opens its card. |
| `potion-tray` | `itemTrayModel` | Icon tray (`iconTray.js`) | Rooms, only with `hud.potions.roomRail` (off) | No top HUD draws potions; the combat footer's Potions minis are the same tray. |
| `potion-control` | `componentModel` semantic ID | Item view | Inventory | Individual utility potion control. |
| `battlefield-stage` | `battlefieldStageModel` + `combatFormation` | `battlefieldStage.js` + `combat.js` | Combat | Shared formation presets and uniform labeled grids, up to 3 columns × 6 rows per side. Actor feet and movement use the same anchors. Ground tilt/skew transform tiles while characters stay upright. Small grids expand for encounter capacity. |
| `formation-layout-editor` | `formationLayoutConfig` + `combatFormation` | `formationSettings.js` | Settings → Advanced → Interface → Formation layout | Live battlefield preview, illustrated named presets, shared dimensions, footprint width/depth/gap, tile outline and ground tilt/skew. Apply saves a draft through the normal settings owner; row A–F scale/layer and front/back offsets live under Character adjustments. Stacks on narrow screens. |
| `enemy-target-picker` | `cardTargetPlan` + `TargetLayerModel` legal living IDs | `enemyTargetPicker.js` | Solo combat | Separate numbered enemy buttons with names, current HP, and a 48 physical pixel touch floor. A measured clear band avoids the HUD, hand, intent and Information controls. Visible only while a hostile card or flask is armed; full-size sprites can overlap without blocking selection. Invalid sides and defeated enemies cannot spend a card. |
| `combatant-frame` | `combatantFrame` + `CombatOverheadModel.combatOverheadAnchors` + `PlayerDetailsPlacementModel` | `combatantFrame.js` + `battlefieldStage.js` | Combat | Enemy intent-and-card stack with responsive card-only scaling. Compact enemy names and HP stay below their bodies. The complete player name, resource, stance and status widget sits beside current visible sprite pixels; placement reserves its adjacent Info door, other visible panels and the hand's authored raised-card clearance before selection. Selection expands upward. Transparent margins, UI zoom, idle breathing and action poses are measured; formation fitting reserves authored pose headroom. Cards start at visible artwork, excluding transparent padding; actions stay 14 screen pixels above the card unless their measured bounds intersect the turn ribbon, when only the controls move below it. Narrow overhead controls retain their reserved formation x anchors when half-field artwork moves inward; measured control bounds keep the stack inside the field, with six screen pixels between controls sharing a physical overhead band, including separate formation rows. Measured 44-screen-pixel foot targets and their complete name/health columns pack separately when fitted formation rows share a physical band, with final visible HUD, ribbon and neighboring intent controls reserved as obstacles; artwork heights and grounds stay fixed. A transparent central frame square selects the actor above its own name/HP strips, while outer reading surfaces and explicit inspection controls remain available. Painted enemy feet use proportional image coordinates so full and mobile artwork preserve stature. Available presentation growth is shared to retain player/enemy size order. Inspect sits beside intent on short landscape screens. Updates retain the frame, sprite host and input listeners; Lite targeting uses a colored ground ring without cloning art. |
| `combat-tools` | `CombatToolsModel.combatToolsModel` | `combatTools.mountCombatTools` | Solo and co-op combat | Right dock with Combat log and Reaction switch directly below. Physical touch targets and hand clearance survive UI zoom and viewport changes. |
| `combat-log-drawer` | `CombatToolsModel` + `combatLog.combatLogEntries` | `combatTools.mountCombatTools` | Solo and co-op combat | Public executed actions grouped by round; stable event IDs survive resync and reload. Unfolds upward with translucent background and scrollable entries. Small is half card height, Medium half visible viewport, Large ends below actual menu buttons; all sizes clamp to available space. |
| `reaction-toggle` | `CombatToolsModel` | `combatTools.mountCombatTools` | Owned solo and co-op combat | Green enabled/red disabled fill, white black-outlined text and gold thumb/border. Explicit owned preference saves through the combat command door between actions; armed Counter remains active. |
| `player-combatant-frame` | `combatantFrame` variant | `combatantFrame.js` | Combat | The complete player name, resource, stance and status widget sits above current visible sprite pixels with a 10 physical pixel gap. Selection expands upward. Transparent margins, UI zoom, idle breathing and action poses are measured; formation fitting reserves authored pose headroom. |
| `alternative-sprite-renewal` | Class-card registry + `ANIM_SPEEDS` + `combatAura` | `alternativeCardStage.js`, `pose-studio/renewal/preview.mjs` | Combat and animation authoring | Four base-armour classes with attack, smash, sweep, counter, defend, spell and physical/magic ranged actions. Card-type routing is shared by solo, co-op and deck preview; equipment combinations remain deferred. Alpha-shaped auras use a reusable stage-owned independent source-alpha compositor, materialized before the authored action clock; red hit flash, reduced motion and portable Workshop/Pose Studio exports remain separate. Eight selected counter/sweep clips add four phases and separate contact/recovery trails, return to original ready, and provide held player stances without changing public enemy intent. [Runtime captures](preview/counter-sweep-20261009/README.md). [Interactive atelier](../pose-studio/renewal/index.html). |
| `enemy-combatant-frame` | `combatantFrame` variant | `combatantFrame.js` | Combat | Enemy combatant card. |
| `combatant-sprite` | `combatantFrame` child | `combatantFrame.js` + `assets.js` + `paintedOutfits.js` | Solo and co-op combat cards | Rendered player or enemy figure. Player rest resolves stance, readiness, guard, then idle through `combatPose.js`; Prepared, Starstone Charge and Blood Rite have authored outfit poses, intermediate entry/exit sprites, subtle breathing glows, and fades that survive combat redraws. Reduced motion uses a steady glow. [Interactive miniature](../art/readiness-poses/preview.html). |
| `combatant-nameplate` | `combatantFrame` child | `combatantFrame.js` | Combat cards | Combatant name label. |
| `intent-indicator` | semantic component | `combatantOverhead.js` + `uiContent.js` + `CoopIntentModel` + `enemyIntentKnowledge` | Enemy cards | Opted-in runs show ?, Attack?, Magic?, Preparing? or the exact action. Concealed reads omit stance, selected move, numeric details, tags and future animation clues. Legacy saves keep their rules. |
| `enemy-knowledge-panel` | `enemyKnowledgeView.projectEnemyKnowledge` | `enemyKnowledge.renderEnemyKnowledge` | Combat inspector and Bestiary | Five learned stages, progress and next threshold. Only learned static facts reach the DOM and accessibility tree; catalog moves never highlight a future action. |
| `enemy-intent-prediction` | `enemyKnowledge.knowledgePredictionModel` | `enemyKnowledge.renderIntentPrediction` | Owned solo and co-op inspector | One prediction for a wholly unknown action; correct actual execution pays automatic run-only XP once. Recent owned results persist in the inspector. The panel stays in the inspector scroll flow with full-width native choices and 44-screen-pixel controls. |
| `bestiary-workspace` | `enemyKnowledgeProfile` + `enemyKnowledgeView` | `bestiary.mountBestiary` | Title reference entry | Encountered-enemy list and responsive five-stage detail. Back, Close and Escape restore title focus. Lifetime learning is distinct from run Perception. |
| `block-badge` | semantic component | `components/combatHealth.js` | Combat cards | Purple Arcane Ward, then blue ordinary Block, beside HP. Missing badges return their width to HP. |
| `health-status-bar` | `resourceMeter` variant | `resbars.js` | Combat cards | Individual combatant HP bar. |
| `poise-status-bar` | `resourceMeter` variant | `resbars.js` | Combat cards | Individual combatant Poise bar. |
| `proc-status-bar` | semantic component | `combat.js` | Enemy cards | Individual Bleed/Frost/Insanity buildup bar. |
| `arcane-exposure-bar` | semantic component | `arcaneExposure.js` | Enemy cards | Individual Arcane Exposure meter. |
| `status-effect-tray` | semantic component | Icon tray (`iconTray.js`) via `combat.js`, `coop.js` | Combat cards | Active status icons and stacks. THE REFERENCE the shared icon tray was lifted from: relics and the Potions minis inherit its Pip, non-wrapping row, `+N` tile and tooltip. |
| `tooltip` | semantic component | `tooltip.js` + `tooltipGlossary.js` | All interactive surfaces | Every hover, handover and nested term waits the explanation delay (1 s default); a tap or click selects a detail and a second one explains it; keyboard focus explains after 500 ms; dismiss 500 ms after leaving owner and panel. Cards explain only through their Information button. Active-bundle keywords and touch/keyboard definitions share the renderer. |
| `damage-feedback` | semantic component | `fx.js` | Combat feedback | One hit receipt containing Guard and HP channels. |
| `guarded-damage-indicator` | `damageFeedback` variant | `fx.js` | Combat feedback | Amount absorbed by Guard. |
| `health-damage-indicator` | `damageFeedback` variant | `fx.js` | Combat feedback | Residual damage applied to HP. |
| `player-hand-tray` | `componentModel` | `combat.js` + `hand.js` | Combat | Faces fan by overlap, grow up to 184 physical pixels wide when space permits, and remain visible, inert and dim during enemy turns. The resting rotated hand edge anchors the solo figure; card selection and pile changes leave that anchor steady, while a matching completed hand layout updates it after resize or text-scale changes. The 5:7 face is the card's one authored shape (`content/config/ui/components/card.json` `sizing.ratio`, projected as `--card-ratio` by `CardSizeModel`): this row said 5:7 while the hand actually drew 5:8, and `node tools/card-one-shape.mjs` now holds every surface to the one number. |
| `combat-action-rail` | `componentModel` | `components/combatActionRow.js` (mounted by `combat.js` and `coop.js`) | Combat, Co-op combat | Single centered row: emerald stamina orb (`StaminaOrbModel` / `staminaOrb.js`) with independent number and SP label layers and an optional sapphire mana ring; flexible Draw, End Turn, flexible Discard/Exhaust, and Potions. All five controls share a vertical center at narrow widths. Co-op mounts the same row; its piles show counts (the host sends no cards) and its Potions list belongs to the seat that opened it. |
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
| `equipment-animation-reference` | `equipmentAnimationForLoadout + equipmentAnimations.json` | `paintedOutfits.createPaintedStage + assets.playerSprite` | Solo + co-op + Armoury + conversation + portrait | Derives a presentation set from class, armour, ordered hand weapon groups and optional grip. Named clips provide action and view references; missing bindings retain existing class art. Independent greatsword, sword/shield and unarmed profiles cover all four classes and 35 armor entries, preserving 32 appearances per family. Sword/shield records its authored right-sword/left-shield hands; reversed selectors share that canonical artwork without mirroring. Twin swords add 32 appearances across all 35 entries with a shared profile and optional per-hand item constraints. Only right Straight Sword / left Katana selects these paintings; reversed hands retain existing art. Empty-hand casting and buffs use magic references across all 35 armor entries; ordinary actions retain physical references. The magic gallery preserves all 16 configurable poses. |
| `touch-flick-practice` | `TouchFlickModel` | `settingsRowHtml + mountFlickPractice` | Accessibility settings + combat hand | Configurable 32–160 CSS-pixel upward flick distance, synchronized field and slider, Reset and harmless practice. Touch, mouse, trackpad and pen share nearest legal target selection on release; selection and Information stay separate. |
| `settings-choice-row` | settings `ROWS` record (`choices`, `legacyChoices`, `choiceDisabled`) | `settings.settingsRowHtml` | Settings rows | One Settings choice row: a segmented group (three choices or fewer) or a dropdown, from `settingsRowHtml`. A row may disable single choices with `choiceDisabled`: the option or segment is `disabled`/`aria-disabled`, a stored value is kept, and the row's live line says why (Art quality: Light and High in a single file). |
| `card-shelf` | `CardSizeModel.cardShelf + cardShelfColumnsAt (content/config/ui/components/card.json -> sizing.shelf)` | `cardShelf.wireCardShelf + styles/kit.css .card-shelf` | Card-removal grid and mount service deck list; merchant offer rows use a full-width override | Row of resting cards: up to four across, every track the same width, floored at a legible minimum and capped at the card resting width. Too narrow for four, it drops a column rather than shaving the cards. |
| `modal-height-policy` | `measured body overflow` | `modalShell.bindModalDismiss` | All shared dialogs | Standard widths remain independent of height. Overflow promotes the dialog to the long viewport-bounded height; body scrolls while header and footer remain pinned. Promotion remains stable until close. |
| `card-effect-layers` | `combatEffectPresentation.CARD_EFFECT_LAYERS` | `cardEffectLayers.mountCardEffectLayers / playCardEffectLayers` | Optional accepted card flight | Default OFF: Settings > General > Combat > Animation & effects > Show played card animation. Card flights are independent of caster effects. Payment receipts choose art; cancellation and accessibility preferences suppress playback. |
| `combatant-effect-layers` | `combatEffectAnchors.COMBAT_EFFECT_ANCHORS / COMBATANT_EFFECT_PLANES` | `combatantEffectLayers.mountCombatantEffectLayers / playCombatantEffectLayers` | Solo + co-op caster effects + art gallery | Pose-specific weapon, shield and hand/staff origins across 16 outfits. Rear and front planes inherit pose scale, facing and movement. Target hit impacts and resource auras remain separate. |
| `rating-calculation-receipt` | `ratingReceipt attributeReceipts + sources` | `equipmentReceipts.renderPlayerPoise` | Character Creation Review + Armoury Stats | One section per AR, DR, PR, Poise, and Ward rating: raw attribute values, weights, individually floored contributions, global multiplier, named equipment/relic additions, and final total. A rating with no active weights states that explicitly and calculates from zero. |
| `card-presentation-levels` | `cardFields(level, surface) over balance.ui.equipmentCard.regions` | `model/cardFields.js driving equipmentCard.renderEquipmentCard and card.renderCard` | Every card surface + catalog | How much a card says is authored, not decided by the pixels left over. Three levels — glance, focus, inspect — are declared in content/config/ui/components/card.json over the region keys balance.ui.equipmentCard.regions already owns, with sparse per-surface patches (the creation picker shows rarity while you choose; the Armoury glance shows the type band; the combat hand drops rarity even at focus). The level is DERIVED, never passed by a screen: cardSelection.js owns which card is lit, an unlit card draws at its surface&rsquo;s floor, a lit card is promoted to focus, and the reading door is inspect. A picker&rsquo;s grid/list toggle selects a level rather than owning a field set of its own. A region the level does not say is NOT RENDERED — not hidden — so the row solver returns its pixels and its gaps to the regions that remain (effect rows measure 136px at glance against 54px at inspect) and a screen reader never announces a field the player cannot see. Both card types share the one vocabulary. Only the two cards whose level changed repaint, from their own select and douse events; nothing sweeps the document. |
| `local-map-camera` | `LocalMapCameraModel + LocalServiceModel + SurveyQuestModel` | `localMapCamera.js + worldAtlas.js` | City and dungeon location dialogs | Tall shared layout for all 11 local maps: protected map height, scrollable service benefits, pinned Return and service actions, and a spatial Up/Left/Right/Down pad followed by minus/Fit/plus controls. Inspection and combat share normalized node profiles and weighted WebP scene pools, with stable selection and explicit day/night fallback; available travel is green and anchored bottom-right. Uses WebP artwork and adaptive WebP detail tiles; pointer, touch and keyboard navigation retain saved framing. SurveyQuestModel projects regional quest offers and claimed reports without changing saved atlas rows. |
| `map-detail` | `MapDetailModel + mapPresentation` | `mapDetail.js + mapFog.js` | All run maps | Viewport-selected native detail tiles over a bundled fallback; bounded loading and cache, engraved fog, outlined routes and one extra manual zoom step. |
| `map-node-face` | `mapview + AtlasCameraModel` | `mapNodeInk.js + mapboard.js + worldAtlas.js` | All run maps | Shared vector disc, glyph and reachable halo. Traditional/co-op and journey maps use the same close-up node scale; journey framing follows the current junction and preserves authored positions. |
| `prologue-screen` | `prologueConfig` | `screens/prologue.js` | Opening / Advanced preview | Nine authored scenes (five shipped, four addable slots) played in a configured order and subset, each with its own artwork, hold, music and stinger; staging — wireframe, picture treatment, camera, wash, text and container, reveal, transition — answered by the opening or per scene. Each scene can show or hide the traveller, rotate it and place it before or behind the wash; desktop and phone poses remain separate and survive scene duplication. The focused editor keeps rotated selection boxes and proportional width/resize controls aligned with the painted figure. Playback controls occupy the frame's last row. |

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

boot-art-status (web edition only; a sibling of startup-gate, not its child)

title screen
├─ title-brand-lockup
│  ├─ title-wordmark
│  ├─ title-subtitle
│  └─ title-divider
├─ title-menu
│  └─ title-menu-item × 6
│     └─ title-menu-gem
├─ title-tagline
├─ art-load-notice (web edition, art failed to load)
│  └─ art-load-notice-retry
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

## Terminal save recovery composition

| Component ID | Model | Renderer | Reuse surface |
|---|---|---|---|
| `run-finish-retry` | `commitRunFinish` + `SaveStatusModel` | `gameover.mountGameOver` + `main.showFinishedRun` | Victory or death after failed storage; shared status dialog Retry and persistent Game Over Retry resume one terminal receipt |

## Character Creation components

These components are the production renderers used by Character Creation and
its `?shot=components` reference page. Art-bearing components receive their
visual node or content row from the existing asset/content registries, so later
custom art does not require a second card implementation.

| Component ID | Model / input | Renderer | Reuse |
|---|---|---|---|
| `character-disclosure` | disclosure entries | `disclosure.mountDisclosure` | Character Creation + catalog |
| `class-preview-pane` | class preview presentation | `creationCards.classPreviewPane` + `classUnfold` | Class preview + catalog; compact contained sprite and icon beside class details. Native stat and relic buttons open shared modal details through `creationPreviewDetails`; stat definition and value precede the projected calculation at the bottom. |
| `class-resource-grid` | `statProjection.derived[]` + hand resource rows | `creationCards.classResourceGrid` | Class preview + catalog; HP, SP, MP, opening Hand and Draw. Optional inspection callback renders native buttons with full accessible names. |
| `class-choice-card` | class row + selected/locked/expanded state | `creationCards.classChoiceCard` | Class selection + catalog; folded choices are buttons, the expanded selected card is a labelled article so its detail buttons have no interactive ancestor. |
| `view-mode-toggle` | view-mode state | `creationCards.viewModeToggle` | Class/Equipment + catalog |
| `boolean-setting-toggle` | boolean setting state | `creationCards.booleanSettingToggle` | Auto-advance + future settings |
| `selection-section-face` | label/value/visual receipt | `creationCards.selectionSectionFace` | Equipment disclosures + catalog |
| `primary-stat-card` | `creationBrief.attributeCardModels` entry | `creationCards.primaryStatCard` + `disclosure.mountDisclosure` | Character Creation + Shrine allocation + Armoury + catalog |
| `stat-allocation-row` | one attribute allocation row | `statAllocationCard.renderStatAllocationCard` | Character Creation + Shrine allocation + catalog |
| `resource-strip` | derived rows + Poise receipt | `creationCards.resourceStrip` | Character stats + catalog |
| `settings-stat-example` | `StatsPreviewModel.statsTopicPreview` | `settings.statsTopicPreviewHtml` | Settings / Advanced / Stats |
| `settings-level-pace` | `LevelPacePreviewModel.levelPacePreview` → `levelup.levelPace` | `settings.levelPacePreviewHtml` | Settings / Advanced / Progression / Experience and Level-up |
| `victory-progress` | `rewardProgress`, `rewardXpPresentation` and saved XP receipts | `reward.mountRewards`, `coopXpProgression.mountCoopXpProgression`, `coopProgressionDoor.mountCoopProgressionDoor` | Solo Victory and co-op progression doors show only paid tracks in Class → Character → current skill level order. Bars fill sequentially at one normalized velocity; full bars turn blue immediately, but all Level up controls appear together only when every fill ends and Continue becomes green and enabled. A manual claim opens its funded chooser before residual and newly paid class-to-skill XP refill on return; other settled bars remain stable. Pending choices and co-op XP history survive reload. Capped tracks stay noninteractive; deferred banked levels remain claimable without a new XP receipt. |
| `victory-xp-receipt` | `combatXpReceipt` + `victoryXpPresentation` over the saved fight reward | `reward.mountRewards` compact Victory | Combat-power and enemy XP count in order; the total grows alongside a compact calculation, with `+…` revealing the full formula. A fixed-height list scrolls as rows arrive, then Continue turns green after its configured pause. |
| `mode-choice` | creation mode + selected state | `creationCards.modeChoiceButton` | Standard/Assign Points + catalog |
| `sprite-choice` | sprite-style row + selected state | `creationCards.spriteChoiceButton` | Appearance + catalog; Animated is the default when no explicit style is stored. |
| `tint-choice` | tint row + selected state | `creationCards.tintChoiceButton` | Appearance + catalog |
| `sigil-choice` | glyph + selected state | `creationCards.sigilChoiceButton` | Appearance + catalog |
| `keepsake-choice` | keepsake row + selected state + recoverable art fallback | `creationCards.keepsakeChoiceButton` | Keepsake + catalog |
| `equipment-choice-card` | equipment row or Empty Hand + selected/preview state | `equipment.pieceChip` | Starting Equipment + Armoury/catalog |
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
| `shrine-option-card` | `balance.ui.shrinePresentation` + option plan | `rest.mountRest` | Rest / Smith / Flask Allocation / Level Up / Deck editor (Rest sites only) |
| `smith-upgrade-modal` | `SmithSelectionModel` | `smithUpgradeModal.mountSmithUpgradeModal` | Dedicated Smith choose/review transaction |
| `smith-candidate-card` | `SmithSelectionModel.properties.candidates[]` | shared `card.renderCard` plus armament-tier banner inside Smith modal | One distinct owned armament below the run tier cap |
| `smith-upgrade-preview` | `SmithSelectionModel.properties.selected` | grouped delta renderer inside Smith modal | Tier, cost, purse, shortfall, and every sourced basic-card delta |
| `deck-editor` | `DeckEditorModel.deckEditorModel` + `openDeckEdit` session (`beginDeckEdit`/`cancelDeckEdit`) + `deckEditorDoors` | `deckEditor.mountDeckEditor` | Armoury Edit Deck tab (Free); Rest card of a `deckEdit` place — shrine, inn, chapel (Rest sites only). Two panes (collection / deck), live "N / min–max" counter with the refusal as visible text beside a disabled Done, cost curve, filter and sort chips; tap, ＋/－, drag, keyboard and pad for every move; targets ≥ 48 px on a coarse pointer. |
| `blacksmith` | `model/blacksmith.js` plans (refine, sigil slots and setting, upgrade from either purse, extract/install/upgrade art, stack copy) + `serviceCandidates` | `blacksmith.mountBlacksmith` (shop W1d workspace, `wireShopLayout`; `smithUpgradeModal` and the mount-service modals for upgrade, extract and install) | Atlas smith point; a merchant whose kind rolls `blacksmith` (SPEC §14.4). One rail item per offering the visit laid out; a service with nothing to act on stays on the rail, shown unavailable with its reason, and becomes usable on the same visit; the header carries stones, refined stones and cinders. |
| `master` | `model/master.js` plans (training, respec, redistribute, lesson, appraisal) + `masterServiceCandidates`; `engine/shopKinds.js rollMasterLesson` | `master.mountMaster` (the blacksmith's shop W1d workspace, `wireShopLayout`) | Atlas `master` point (none placed yet); a merchant whose kind rolls `master` (SPEC §14.5). One rail item per offering the visit laid out, then Sell (the market's consumable sale, under `shopSell`); a service with nothing to act on stays on the rail, shown unavailable with its reason, and becomes usable on the same visit; a lesson's cards are rolled when asked and kept with the stock; the header carries cinders, the training pool and the sessions left. |

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
├─ Header: available Smithing Stones, then the close button
├─ Upgrade selected armament in the preview pane (requires affordability)
└─ Full-width Back to Shrine footer (also Escape)
```

Selection takes one tap and opens every affected card preview expanded. The compact
item list starts open. Back, the centered close glyph, and Escape return without
spending another stone; completed upgrades remain saved. Confirm spends the displayed
cost, promotes one item, and refreshes the picker while stones remain. The last stone
uses the site's existing stay/leave rule. Ordinary non-equipment cards retain their
independent per-copy upgrade behavior.

## Folding Tray session geometry

Armoury supporting instances of `folding-tray` open at the data-authored 45vh
default, preserve at least 30vh for every expanded tray, and snap to 30, 40, 50,
60, 70, 80, or 90vh after drag or keyboard resizing. Fold and expanded-size
memory is keyed by tray ID for the current play session only; new/resumed runs
and returning to Title reset it. `tray-resize-handle` remains the shared 44px
mouse, touch-hold, and keyboard surface, while `tray-content` owns scrolling.

## Menu components

| Component ID | Model | Renderer | Role |
|---|---|---|---|
| `installer-art-options` | `desktop/windows/art-releases.ps1` + `game-releases.ps1` | `desktop/windows/art-options.ps1` + `installer.nsi` | Windows installer chooser: game branch and exact build-version selectors open the selected GitHub installer artifact; art branch and published release selectors show installed, required and latest art versions, install the compatible pack or save a verified separate ZIP; ChatGPT artwork disclosure. Native preview is included in the Windows installer artifact. |

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
| `lore-line` | card or equipment `flavor` text | `loreLine.loreLine` | The one-line identity shown in card and equipment inspection, set in the player's lore type (Advanced → Text & lore, `LoreTypeModel`). When the lore has more than its identity line it is a button with a Read cue; otherwise plain text. |
| `lore-modal` | the same `flavor` text, split by `loreParts` | `loreLine.openLoreModal` | Small shared-shell modal over the inspection: eyebrow, card name, identity line, history, and the closing line set apart under a rule. Escape, ✕ and a scrim press close only this modal and return focus to the line. |
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
| `inventory-detail-card` | `inventoryDetailCardModel` | `armouryComponents.renderInventoryDetailCard` | Expanded armament information with explicit slot selection, inline comparison, and named Equip/Move/Unequip buttons. Other inventory classes retain their authored hold capability. |
| `equipment-comparison` | semantic child model + `armouryUi.layout.comparison` | `equipmentReceipts.js` in shared tooltip or item card | Full before/after receipt, including exact weapon-package card counts and slot-bound upgrade changes. Authored presentation chooses a sustained-hold tooltip or inline content, with data-owned hold threshold, width, and viewport cap. |
| `armoury-stats-panel` | `armouryStatsPanelModel` | `equipment.js` inside `renderTray` | Stats tray content: attributes, combat values, resources, relic summary, and the equipment receipts (card packages, requirements, Poise threshold, Equip load with its Weight Class — `armoury.playerLoadReceipt`). |
| `armoury-card-strip` | `armouryCardStripModel` | `equipment.js` + `card.js` inside `renderTray` | Cards tray content: exact equipment-associated card counts grouped by card/profile in list or grid presentation. |
| `character-sheet` | `CharacterSheetModel.characterSheetModel` (`characterLadder`, `trackLadder`) + `progression.levelProgress` / `skillProgressRows` + `balance.progression.cadence` | `characterSheet.openCharacterSheet` (xl W1 modal, kit Meter, Rail, Pill) | Armoury Character view, under the level Meter (out of combat), with Respec class when available. Character tab lists levels 1–20, step XP, running total and configured grants. Expanded class ladders show guaranteed cards, feats, equipment, relics and attributes at the configured class cadence plus associated-skill XP; Spellcraft and Combat Maneuvers show authored ability grades 0–5. Legacy runs retain draft/rank-up, rarity, class-tree, every-2nd-level feat, every-4th-level linked attribute and every-5th-level card-power rules. Opens scrolled to the current level. |
| `class-respec` | `classRespec.createClassRespecDraft` / `previewClassRespec` / `classRespecView` | `classRespec.mountClassRespec` (xl kit Modal, labelled controls, keyboard focus trap) | Character sheet and Armoury between encounters; co-op map sends host-owned seat intents. Current mastery options replace earned slots, spent items remain spent. Before → After review shows changes, displaced equipment and retained upgrades/components. Free default, atomic save before charging; Cancel and stale forms leave the run unchanged. |
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
is [`asset-data/components/armoury.json`](../asset-data/components/armoury.json).

| Rendered family | Searchable asset IDs |
|---|---|
| Shell and player views | `armoury.shell`, `armoury.viewSwitcher`, `armoury.characterView`, `armoury.inventoryView`, `armoury.hybridView`, `armoury.characterViewButton`, `armoury.inventoryViewButton`, `armoury.hybridViewButton` |
| Character composition | `armoury.characterPane`, `armoury.spritePane`, `armoury.characterSummary`, `armoury.levelProgress`, `armoury.combatPowerCard`, `armoury.combatPowerGroup`, `armoury.combatPowerMetric`, `armoury.attributesCard`, `armoury.attributeCard`, `armoury.relicsCard`, `armoury.skillsCard`, `armoury.skillProgressGroup`, `armoury.skillTrack` |
| Armaments tray and pane | `armoury.equipmentPane`, `armoury.armamentsCard`, `armoury.armamentsHeader`, `armoury.armamentsFoldButton`, `armoury.armamentsExpanded`, `armoury.armamentsFolded`, `armoury.armamentViewToggle`, `armoury.hybridPaneSplitter` |
| Procedural equipment-position cards | `armoury.equipmentPositionCard`, `armoury.occupiedPositionCard`, `armoury.armamentCardThumbnail`, `armoury.armamentListInspection`, `armoury.emptyPositionCard`, `armoury.lockedPositionCard`, `armoury.positionLabelPane`, `armoury.positionSpritePane`, `armoury.summaryDivider`, `armoury.positionSummaryPane`, `armoury.positionAction`, `armoury.armamentItemCard`, `armoury.armamentDetailPane`, `armoury.armamentGridGroup`, `armoury.positionGridCard`, `armoury.occupiedPositionGridCard`, `armoury.emptyPositionGridCard`, `armoury.lockedPositionGridCard`, `armoury.armamentGridDetails` |
| Inventory and comparison | `armoury.inventoryCard`, `armoury.sigilsPanel`, `armoury.paneSplitter`, `armoury.itemCard`, `armoury.inventoryItemClass`, `armoury.itemReveal`, `armoury.comparisonTooltipAnchor`, `armoury.equipmentComparison`, `armoury.inventoryTrayResizeHandle` |
| Cards, Stats, and disclosure | `armoury.cardsCard`, `armoury.cardList`, `armoury.cardRow`, `armoury.cardDetail`, `armoury.cardViewToggle`, `armoury.cardsTrayResizeHandle`, `armoury.statsTray`, `armoury.statsSummary`, `armoury.playerLoadReceipt`, `armoury.statsTrayResizeHandle`, `armoury.disclosure` |

Within each procedural equipment group, empty positions are ordered after the
occupied and locked positions. Their Grid presentation spans every column,
making the empty drop target a full-width bottom row.

### Combatant card detail

```text
combatant-frame
├─ component-background
├─ intent-indicator                 enemy variant
├─ combatant-sprite
├─ combatant-nameplate
├─ combat-health-row               stable right edge; readable minimum width
│  ├─ block-badge (ward)            magical Block > 0; gold HP outline
│  ├─ block-badge (shield)          ordinary Block > 0; blue HP fill
│  └─ health-status-bar            expands into absent badge space; red without shield
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

Starting equipment: Empty Hand uses the normal card frame and existing null hand state.
The focused choice drives its details and a two-column starting-combat-card grid with
copy counts from the run's deck planner, grant reconciliation and card stamping. Choice
nodes persist through selection so the 180 ms lift/scale transition can settle smoothly.
Phones use a smaller lift, and OS/in-game reduced motion disables movement. Continue
opens the named next section; automatic advancement defaults off. Flavor stays on one
line with an ellipsis, and full wording is available in the inspection's lore line.
Review: `equipment-selection-preview.html`; checks: `tools/starting-equipment-qa.mjs`.

Equipment cards (#784): Inventory, starting equipment choices and equipped-item
inspection reuse `equipmentCardModel` and `equipmentCard.js`. The approved 5:7
painted card scales one 350 by 490 canvas. Each meaningful field has an authored
explanation; inspection includes keyboard tooltips and a touch-readable full-text
disclosure. Existing equip, drag, compare and navigation behavior remains.

`equipmentCard.renderEquipmentCard` and `renderEquipmentInspection` also serve
merchant armament offers and buy/sell inspection, reward armament inspection, and the complete searchable
`weapon-cards-preview.html` gallery (#799). Preview validation is
`node tools/weapon-card-preview.mjs --shots <output-directory>`.

Item cards: equipmentCard.js owns the uniformly scaled poker canvas. collectibleCard.js composes authored potion/relic effects into that frame for Inventory, merchant shelves, and potion reward inspection. Listing tracks are fixed at 280px; reveals span the grid. Delegated hold feedback paints above card art and inspection gestures reach the existing hold owner. Full-text disclosure remains independent of equip gestures.
Playing cards: card.renderCard now adds playing-poker-card. The brown-and-gold inset frame, art well and subdued type band match equipment cards. Combat dimensions, resource badges, live values, tag fitting and selected/unaffordable states retain their existing contracts. Validation: tools/card-feedback.mjs covers desktop/phone input and reduced motion; --shots also records the initial hand.
Combat sizing: fitFan hands uniformly scale the complete 178px canvas to fit the current hand area. Titles and body use 16px canvas type, and titles wrap to two lines. One cost row above the title groups action, mana and stamina badges without covering text. Full details remain available through Information. BattlefieldStage grows sprites into available space and grounds their stacks near the hand, preserving HUD/intent clearance. Three-enemy phone fields fit without horizontal scrolling; four or more may scroll. Short-height battles scroll vertically instead of shrinking below readable card sizes.

Mobile combat art: at widths up to 640px, figures render at 90% of their fitted size (157.5px reference minimum instead of 175px). Neighboring enemy artwork may overlap slightly; names, meters and intents retain their existing layout and size.

Combat card actions: selection reveals a circular Information button centered above the highlighted card. The information modal places the card beside readable details and exposes a green Play card action, or a disabled gray action with a visible reason. Stationary holds show shared progress and use the card on completion; early release cancels, and targeted cards enter the existing targeting flow. The floating information button replaces hold-to-zoom inspection for the solo combat hand.

Selected combat cards preview legal targets without committing: pure friendly cards highlight the player blue; hostile cards highlight every living enemy red. Unavailable cards and dead enemies do not glow. Selection changes and Escape clear stale highlights. Raster silhouettes retain transparent backgrounds so glow follows artwork rather than its rectangular canvas.

Co-op card definitions use `src/ui/models/CombatCardView.js` to select the owner’s authoritative preview at the chosen upcast tier. Missing preview data resolves that same tier with the owner’s saved combat and break-meter versions; a base-tier preview cannot supply a higher tier’s target plan. `CombatSnapshotCardCosts.js` projects that owner/rank’s full paid SP and Mana receipt into `playingCardModel`; missing host prices are conservative estimates with inspected help. Upcast surcharges are included once, and Mana discounts apply to the complete price. For example, Shield Bash Tier 2 shows 3 SP and 2 Mana, while insufficient SP keeps the card unavailable.

Co-op Upcast uses `coopUpcastControl.wireCoopUpcastControl` and the same selected-card `.card-upcast-controls` surface as solo, including touch targets. An upcastable hostile card first selects without submitting an intent; its next activation plays. Friendly cards keep their target-arming flow. Pointer and keyboard gestures on Upcast open only its rank chooser; Escape and seat changes clear selection.

World Journey (`src/ui/screens/worldAtlas.js`) composes fixed map terrain, discovery
masks, inspectable landmark overlays, and one native location dialog. It is laid
out in W4b bands: a header, the map scene, and a context band for the selected
place and its open roads. A Recenter / Enter footer closes the screen
(`AtlasSelectionModel.js`: a tap selects, Enter travels or opens the current
place). Local points select a detail pane instead of opening nested dialogs. The
same renderer serves `world-atlas-preview.html`; its authoring controls and ID
selector are isolated from the game. Actual service dispatch reuses the existing
merchant, smith upgrade, and grace screens. See `docs/WORLD-ATLAS.md` for the
normalized content contract and `tools/world-atlas-qa.mjs` for browser checks.

Equipment Information appears after the first touch selection, with a configurable delay and fade. Inventory short taps reveal it without equipping, and Inventory and Smith reserve room above their cards so the control remains reachable. The approved 60 percent art allocation remains; mechanics receive at least 54 pixels on the authored canvas.

Shared modals contain keyboard focus in the top dialog, restore the opener on Escape, and activate tabs with arrows, Home and End. Narrow labels scale within readable bounds and settings categories remain horizontally scrollable. See `docs/preview/responsive-type/index.html`.

Reward chooser: playing-card inspection yields face taps to reward selection; the separate Confirm control owns collection. Back retains selection and a failed save exposes a retry status without adding a duplicate card. Touch flicks retain the current shared TouchFlickModel and Accessibility controls.

Selected content inspection: reward radio choices retain Information after Back and redraw. Keyboard focus reveals the same control. Reward, merchant, pile, inventory and smith card rows reserve space above the face, including wrapped rows. Smith extraction/installation item choices and mount rows expose Information without collecting, buying or confirming the service; explicit transaction controls retain ownership.

`map-detail` shares viewport tile selection, decoded-image replacement and engraved fog between traditional/co-op and World Journey/Long Expedition. `mapPresentation.js` holds the tile budget, density cap and route widths; `mapArt.generated.js` owns asset versions and available dimensions. Tiles never carry node discovery or travel permissions.

`local-map-camera` composes fixed-size accessible markers over adaptive detail imagery. `localMapPresentation.js` holds defaults and optional map-ID overrides; `LocalMapCameraModel` derives pan and anchored zoom. `LocalServiceModel` reads existing healing, smithing, refill and level-up plans without mutating the run. World Journey and Long Expedition share this location dialog.

Relic reward rows open a collectible card and full effects before Take relic; Back leaves the reward pending. Map and combat relic slots open the same read-only collectible inspection. Playing-card inspection expands its text area and stacks card/details on phones so complete effects remain readable.

Primary confirmation buttons use green when enabled and neutral styling when native or ARIA disabled. Reward Continue stays gold while any reward remains unresolved and turns green once all rows are taken or explicitly skipped; its existing hold and auto-collect behavior is preserved.
Combatant overhead controls: `combatantOverhead.js` shares Information and enlarged intent between solo and co-op. Actions anchor 14 screen pixels above the card's visible artwork; if full-height artwork leaves the measured controls intersecting the turn ribbon, only the controls move below it with 14 screen pixels of clearance. Narrow controls retain the reserved formation x coordinate independently of the half-field sprite clamp, with their measured visible control union kept inside the field and six screen pixels between controls sharing a physical overhead band, including separate formation rows. Information stacks above intent, or beside it on short landscape screens, and empty slots collapse. Its selected outline precedes the configured tooltip delay for hover, touch, and focus. Information opens the existing detailed body; overhead input never bubbles into combat targeting.

Ready primary actions lift by 2px and scale to 1.015 without shifting surrounding layout. End Turn is ready only during the player phase when no affordable playable hand card remains; zero-Action cards still use their Mana/Stamina costs. Ready modal footers hide helper copy, retain secondary actions in their own row, and expand the primary button across the container. Reduced motion removes the transition.

Ready colors use a 240ms background-color transition, including hovered hold buttons. Hold-progress background images remain independent and uneased. Newly mounted ready controls use a starting style so modal redraws also fade into green; hover does not switch between green shades.


Single-dagger coverage adds 32 skins across all 35 catalog armor entries to the
equipment animation reference component. It selects only right dagger + left empty
with one-hand grip. The visual miniature includes Rogue single dagger; the
[full synchronized gallery](../art/dagger-outfits-2026-09-19/index.html) provides
class/outfit filters, pose order, timing, portrait and conversation references.

### Stats, conversions, and hand rules

Advanced → Stats is the one editing area for everything an attribute turns
into. Each trait is a topic — Actions, Draw & hand, HP, Stamina, Mana, Poise,
Ward, AR, DR, PR — holding its stat row (ruleset 7: one editor per row, the
same fields in the same order — Base, STR, DEX, CON, WIS, INT, Per level, Min,
Max) and related constants under subsection headings
(`models/AdvancedSettingsGroups.js` `statsSection`). Draw & hand keeps the
Opening hand, Draw / turn and Hand size rows beside Retention & discards; Poise
ends with the legacy meter rows used only while ratings are off.
`src/ui/models/StatsPreviewModel.js` computes the worked example above each
topic from the same configured bundle, derived-stat engine, hand rules and
rating receipt the game uses (a new character through `createRunState`, so
starting relics are included); `settings.js` renders it and redraws it after
every edit. In-run previews use the character's current attributes and level;
outside a run the example is a chosen class's starting attributes.

`src/ui/components/handDiscard.js` composes the shared modal shell, card grid,
read-only card faces and footer buttons into the turn-end discard selector.
Checkboxes select card instance IDs. Keep all/Confirm commit once; Close/Escape
cancel without changing combat state. `src/engine/handRules.js` validates the
selection independently before the turn can advance.

### Ratings, Poise and Ward
Advanced → Stats holds a topic for each rating's stat row, plus curves, impacts, break penalties and source/status overrides. Shared character resource strips and equipment receipts show Ward and AR/DR/PR contributions. The shared resource-bar renderer receives the new Ward source on character models, with the same selected-character visibility as Poise. Combat inspection lists both meters and the three bonus ratings. Stagger and Disruption use the shared combat banner.

### Defensive reaction composition

`reactionChoiceModal.openReactionChoiceModal` composes the existing modal shell and standard button/footer controls in solo and co-op. Owned authoritative options include normal payment, card choice and Upcast. The first option receives focus; selection only selects; Play commits once; Back or Escape skips the offered reaction and resumes the incoming action. Silent disposal removes an obsolete offer without submitting an answer. Co-op receipts use the shared actor timeline with current effects-layer anchors and per-beat Health/Block updates.

`combat-tools` composes `combat-log-drawer` and `reaction-toggle`. The log and sizing controls remain read-only during a timeline and do not skip animation. Both screens use the same renderer and model; co-op receives only public executed log entries and the active owned switch preference.

Alternative battlefield art: `alternativeArtCatalog` and `alternativeArt.js`
provide canonical idle actor lookup, desktop/phone exports, and independently
fitted four-layer scenery for 32 named combat settings. `battlefield-stage`
continues to own actor slots, floor alignment, HUD and intent clearance. The
companion indicator uses the same catalog. No review-page HUD or action anchors
are imported. The Combat Studio source package and its portable drafts remain
separate from generated runtime exports.

Both presentations now share those component IDs. `displayAppearance` selects
the default alternative formation, layered scenery and class animations, or
the previous classic art and fitting. **Classic appearance** is a saved boolean
setting under Advanced diagnostics, visible only with the debug flag on.
Changing it refreshes the mounted battlefield without changing combat rules or
run state. UI, card controls and companion icons remain shared. The
[display art libraries](../assets-display/README.md) separate classic,
alternative and shared ownership while retaining canonical packed IDs.
