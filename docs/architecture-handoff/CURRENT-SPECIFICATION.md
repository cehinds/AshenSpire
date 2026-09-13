# Current wireframe specification

This document is the consolidated presentation specification for this documentation-only handoff. It supersedes conflicting earlier iteration notes in this folder. It does not change game mechanics or claim production implementation. SPEC.md remains the mechanics authority.

## Shared surfaces

W0 owns title top-left, exit top-right, back bottom-left, primary bottom-right, shared insets and effects. One footer action spans usable width; multiple actions remain inline. W1 is the category workspace and inspector shell; W2 confirmations; W3 main menu; W4 gameplay. All have wide/compact/portrait variants. Child models compose shared primitives. Relative dimensions and min/max constraints are configurable; avoid scattered pixels. Five palette groups: surfaces, text, gold, positive, danger. Exit/back highlight red, valid primary green; disabled/busy wins.

## Data and architecture

Normalized source relations follow 3NF. JSON/CSV/database adapters compile the same validated registries. Models own facts; immutable view models project display state; components render and emit intents; domain commands revalidate. Tags select registered components/providers, never executable strings or entity-name branches. Source descriptions identify current modules as migration anchors, not claims that proposed APIs exist. Knowledge filters apply before inspector projection.

## Cards

WC0 shared aspect ratio is proposed5:8, clamped width with derived height. Header/art/body/footer10/40/40/10 percent of card height. Meaningful tags sit at art bottom. Footer holds rarity/owned metadata, no Use button. Selection lifts and highlights the card; info appears above after1s. Host action below selected card is context-driven; valid targets highlight and required targeting gates command availability. Inspector uses the same component with context-specific visibility.

## Combatants

WC4 is a borderless transparent entity presentation, not an item-card face. Compact/standard/expanded sizes share a model. Artwork preserves intrinsic proportions. Name sits immediately above HP. Intent sits above sprite; info above intent (above sprite directly when intent omitted). Player intent hidden by default, enemy visible, configurable override. Defense is large, at50% sprite height with0.5rem gap outside sprite: player right/enemy left. Flip art only. Aura and buff layers span full sprite height; aura behind art, buff in front, input transparent.

Lower components filter by domain activity, then stack in order: HP, other resources, buildup, stance, status icons. No empty rows or gaps. HP always; each other resource and buildup meter half HP height; stance same height/width as HP. Shared small gap. Maximum5 rows AFTER filtering. Optional bars ranked by configured priority; excess buildup becomes status-row icons. Icons are1.575rem squares (30% smaller than original tiles), icon only; details in tooltips. If width overflows, last tile is+N hidden count and opens inspector with all effects. No wrapping or horizontal icon scrolling.

Selection applies one shared glow to the entire visible combatant assembly, without additive per-child glow. Hidden components stay hidden. Info delay remains1s. Preview controls expose orientation, selection, intent policy, active-component toggles, resource count, status presets, effect count0–20 and tooltip size. These are test controls, not invented game settings/mechanics.

## Inspector W1w

Modal title is entity name. Left contains only sprite/name/HP, bounded and aspect-preserving. No intent, defense, aura, buff, resource/status overlays there. Right: HP/Intent/Defense summary; Current state with uniform label/value rows for active stance/resources/statuses/buildup; Previous actions newest-first; Known abilities; Known traits including discovered weaknesses/resistances; Lore last. Unknown and none are distinct. Stable shared text alignment; right pane scrolls, header/footer stay anchored. No placeholder primary; Back spans footer if it is the sole real action. All details derive from one knowledge-filtered snapshot and registered providers. HTML records are illustrative.

## Tooltips

WT0 shared overlay; WT1 compact, WT2 standard, WT3 expanded. Configurable1s delay for hover/focus/tap; cancel on leave/blur/Escape/outside tap/disposal. Repeated events do not reset the same pending timer. Anchor above trigger, flip below/shift within viewport, arrow follows trigger. Keep open across pointer transition. Render in active modal layer. Content grows naturally; longer interactive information uses inspection.

## Reference and implementation boundary

wireframe-gallery-template.html and card-anatomy.html are executable documentation examples. Generators produce wireframe.md, responsive/card/tooltip documents, catalogs and the self-contained gallery. This handoff proposes production refactoring; it is not an implementation of it. Earlier source-map hashes are a historical audit snapshot and must be revalidated before implementation.

Regenerate in order: generate-tooltip-wireframes.mjs, generate-card-wireframes.mjs, generate-responsive-wireframes.mjs, generate-wireframe-gallery.mjs. Validation should include syntax, catalog coverage, pseudocode presence, and rendered interaction/geometry checks. Browser visual verification remains outstanding because the local-file browser navigation was blocked in this session.

## Component catalog

WCF1–WCT1 document shared reusable parts with three views, measurements, positioning, pseudocode and use cases. Inspect is one uniform delayed2.75rem circular control; all card families propagate selection glow to it and every visible child. Read-only inspector previews omit recursive inspect. Run generate-component-wireframes.mjs before the responsive/gallery generators.

Pseudocode tuning uses injected config variables. pseudocode-config.json lists explicit defaults and units, also exposed in the gallery Configuration defaults panel and wireframe.md. Reference-only tokens are documentation defaults; implementing runtime config adapters remains a separate task. Domain facts are not configurable presentation defaults.

Component library hierarchy: Screens / Cards / Shared components. Shared families: WCF0 foundations, WCB0 buttons/inspection, WCI0 identity/artwork, WCM0 meters/statuses, WCO0 combat overlays, WCT0 tooltips. Each child uses its family prefix and number; component-id-migration.json maps former WP IDs for compatibility. Navigation labels include IDs.

Gallery navigation uses five grandparents: Foundations, Menus & Workspaces, Gameplay, Cards, Components. Each contains category branches and linked wireframe leaves. Search filters leaves and opens matching ancestry; current selection opens its own branch. Existing IDs/links remain stable; the dropdown is a shortcut within the selected category.

## Gameplay assembly references

WGS shared scene layers, WGC combat components, WGM map components and WGQ quest-dialogue components break the scenes down to command buttons. Each component identifies reusable parent primitives and includes three diagrams, placement contracts and pseudocode. gameplay-config.json is the scene composition default; gameplay-components.json records slots and reuse. W4a/W4b/W4c gallery entries include editable band JSON and independent layer toggles. Sample geometry/actions are illustrative, not production gameplay. Hidden layers preserve region budgets in this diagnostic view so composition can be inspected. Production optional-slot collapse follows the scene definition.

Background composition WGS1 contains WGS6 Skyline and WGS7 Floor. Skyline fills scene bounds behind the bottom-anchored floor. Floor height/asset and skyline asset/color are separately configurable; both are noninteractive below actors and HUD. Independent gallery toggles test each layer.

Every gallery entry exposes Actual reference code: shared renderer functions, exact wireframe model JSON, reference CSS, and a downloadable complete runnable HTML. This is executable documentation code, not an assertion of production implementation. Shared child components reference their renderer; placeholder previews accompany component schematics.

Portrait reference profiles: iPhone SE3 at375×667 CSS px and Galaxy S24 at360×780 CSS px. Every entry has wide, compact and both portrait views. portrait-devices.json owns profile defaults. These are layout references, not native-resolution screenshots or a claim of on-device validation. Shared portrait structural layout resolves against each profile. Source reference: https://www.floow.design/free-tools/device-size-reference .

Preview tabs: Wireframe shows the structural schematic; Example renders illustrative data; Component composition executes the shared reference component factories. It does not embed or modify the production game.

W4a composition: WGS2 shared HUD + WGC1 battlefield + WGC5 hand + WGC6 packed action footer. WGS2 and WGC6 standalone examples call exactly the same reference renderers as the W4a example. Footer children reference WGC7–WGC11; scene component links navigate to each reusable definition.



HUD composition WGH0: WGH1 Vitality, WGH2 Armament, WGH3 Menu, WGH4 Total HUD. WGS2 uses the same total renderer; scene preview now composes WC4a combatants and WC1 playing-card renderers rather than chess-piece/card-box placeholders. Links expose referenced definitions. Reference composition scales components uniformly for diagram fit; production layout validation remains required.

## Completed atlas and configurable progression

The atlas contains 151 entries, each with Wide, Compact, iPhone SE and Galaxy S24 layouts. Every entry includes a model, defaults, commented pseudocode, dimensions, source/inheritance descriptions and actual reference code/styles. Component composition shares factories with the individual component examples. Current source anchors and baseline differences are recorded in CURRENT-SOURCE-AUDIT.md; they do not assert that proposed APIs already exist in the game.

WGH0–WGH9 cover the HUD contract, vitality, armoury, menu, total HUD, XP, inventory rail, run header, charge controls and mode grip. Their playground exposes context, placement preset and layer toggles. WGH5 is a proposed blue full-width XP strip directly below the HUD, combat-only by default; sample combat awards animate its progress. Visibility, color, height, duration and sample award are configurable. Scene HUDs default the inventory rail, charge controls and stamina off; standalone HUD previews expose them. Nominal combat bands are 10/55/30/5 percent. Configured physical minimums for the HUD, hand and footer can override those shares on small hosts; the current sizing contract below is authoritative.

W1x, W1x1 and W1x2 reuse W1 for progression overview, weapons and skills. WGP0–WGP4 supply shared proficiency components. Practice, thresholds, unlocks and event history come from data; rank/progress are derived. The playground can preview awards and visibility without mutating game state. PROGRESSION-SPECIFICATION.md defines the proposed normalized schema and domain boundary. Exact mechanics require a separate SPEC.md change before implementation.

Build the complete package with build-reference.mjs. reference-defaults.json and reference-coverage.json are generated alongside the atlas. Browser validation exercises every entry and all preview tabs; see VALIDATION.md for coverage and limits.

## Potions ownership

WGC11 is the single Potions control. WGH8 supplies its contents: HP potion, MP potion and carried consumables such as Smoke vial, with their counts. The HUD must not render these as sibling buttons or duplicate them in its inventory rail. Only the footer HUD renders the Potions control; the top HUD never renders it, in either placement preset. WGC11 consumes the shared WGH8 contents projection. Config can hide provider categories; selecting an entry emits a host intent and does not bypass targeting or confirmation.

## Vitality length and fill

WGH1 uses separate capacity and fill calculations. Track width = clamp(characterMaximum / configuredReferenceMaximum, 0, 1) × maximumAllowedWidth. Filled width = clamp(current / characterMaximum, 0, 1) × track width. Defaults are 200 HP, 20 MP and 20 SP reference maxima; these are presentation scales, not gameplay stat limits. Above-reference maxima saturate track length while the exact current/maximum label remains visible. At zero maximum, render an empty track without division by zero. Do not impose a minimum track length that hides differences in maximum stats. All tracks share a left anchor; current/maximum labels sit outside narrow tracks.

The generated hud-config.json contains the complete editable preview defaults. Change its vitality and sample sections in the HUD playground Configuration JSON and select Apply configuration to compare outcomes. Persistent generator defaults live in hud-reference.mjs; rebuild rather than hand-edit generated files. Example: 32/40 HP uses 20% of the allowed track envelope and fills that track to 80%; 6/10 MP uses half the envelope with 60% fill. This updates the documentation reference only.

## Shared button widths

Button width is a named presentation preset, not the length of its text. button-widths.json exposes quarter=25%, third=30%, half=50% and full=100%, with half-width choices by default. These percentages are relative to the owning action region: they equal vw only when the region fills the viewport. Sibling options use one preset and align their edges. Narrow hosts preserve the shared width and wrap labels when needed. Header exit and compact stepper/icon controls use the icon-size exception. Footer buttons share the available width equally after subtracting gaps; a single footer action fills the region. WCB0–WCB4 define the shared contract; W1 workspaces consume it.

## Nine standard button sizes

button-widths.json defines nine size IDs: third-standard, third-tall, third-double, half-standard, half-tall, half-double, full-standard, full-tall and full-double. Widths are 30%, 50% and 100% of the owning region; heights are the configured standardHeight multiplied by 1, 1.5 or 2. The default standard height is 2.75rem. Host-relative percentages become vw only for a viewport-wide host; height uses a readable shared token rather than shrinking with the viewport. The quarter-width option and compact icon size remain explicit additional variants. All values reside in shared configuration. Equal footer shares subtract gaps before sizing. Proficiency selection uses full-double within its column; category navigation uses full-standard.

WCB5 exit geometry: width and height both resolve from buttonWidths.iconSize. Preserve a 1:1 aspect ratio with no flex shrinking/stretching, zero padding and a centered glyph. W0/W1 headers, progression workspaces, component samples and inspectors all consume this same rule; the square remains anchored at the shared top-right inset. Footer Back is a separate component and retains its action-row proportions.

WGC6 footer layout owns all five control tracks, including the WGC11 disclosure wrapper. Potions uses the same major size and lift as Actions/End turn. Its details wrapper contributes no border, margin or padding; only the circular summary is visible when closed. Draw and Discard use the minor size. The footer uses one centered grid and one shared gap so independent wrappers cannot change the controls' baseline.

Battlefield WGC1: background WGS1 consists of skyline WGS6 beneath a foreground ground cutout WGS7. The cutout has transparent upper contours, configured by scene.groundCutout; its height is scene.floorHeightPercent. The skyline fills the full background bounds behind it. Combatant sprite feet anchor at scene.actorBaselinePercent (default66.667) of battlefield height measured from its top; name/HP/status content may extend below the baseline. This is battlefield-local height, not total browser vh. The reference observes battlefield resizing and measures sprite bounds once the preview is visible, scaling each assembly to fit its slot before aligning feet. Layer visibility does not move the configured baseline.

Battlefield vertical order: skyline above; floor begins around55% and ends at100%; sprite feet sit inside the floor at66.667%. W4a inherits the45% floor-height default. Ground contours must remain above the feet baseline.

Ground contact supersedes the sprite-container baseline: use the visible artwork bounds (or an authored foot pivot), excluding transparent SVG/image margins. Place the soles at ground.top + ground.height × scene.groundContactDepthFraction (default0.3), inside the ground cutout. The battlefield-percent baseline is only a fallback when the ground layer is hidden. Scale around the artwork's foot contact; status panels are not part of the ground anchor.

WCO5 Ground shadow is a reusable, noninteractive ellipse under sprite artwork. Its center defines the ground-contact pivot shared by the sprite and battlefield placement adapter. groundShadow configuration owns visibility, relative width/height, opacity, color and horizontal anchor. The logical pivot remains when shadow visibility is off. Sprite size changes caused by active status rows trigger re-anchoring to the same ground point. WCO5 has its own diagrams, model, pseudocode and executable reference; combatants reference it through WCO0. Inspector-only previews omit the ground effect.

WGS7 Floor owns WGS8 Ground formation grid. Reserve four ally slots on the left and four enemy slots on the right. Fill each side leftmost-first without recentering occupied slots. Fixed configurable outer padding1rem, slot gaps0.5rem and central gap2rem separate the two sides. Slot centers provide WCO5 shadow anchors; active status rows never change assignments. The reference applies actorScale0.8 after fitting to slots. W4a uses the current 10% HUD /55% battlefield /30% hand /5% footer sizing contract below.

WGS8 formation revision: each faction now has nine reserved positions in a3×3 grid, filled row-major left to right. Configured rowStepRem controls overlap; front rows paint above rear rows. Each shadow anchors to its own slot center instead of sharing a single baseline. The preview shows nine allies and nine enemies to expose the formation. W4a ground/sky allocation is80%/20% (4:1), superseding45% ground. Grid dimensions and row spacing remain configurable.

Current formation:2×2 per faction, four reserved slots each. This replaces3×3. Increase slotGapRem to1.5 and centerGapRem to3; rowStepRem is4. Restore actorScale to1 (25% larger than the prior0.8 multiplier, with wider slots also allowing larger actors). Ground/sky remains80/20. Fill each side row-major left to right; empty slots remain reserved and shadow anchors persist.

Formation spacing revision: actorScale0.85 reduces actor size15% from the2×2 preview; rowStepRem5.5 separates back/front rows. Reserve centerGapPercent10 of battlefield width between faction regions (10vw when the battlefield fills the viewport). Back-row slots shift outward by backRowOffsetPercent3, allies left and enemies right. Actor fit remains bounded by its slot before scaling; empty slots stay reserved. These values supersede prior fixed central-gap and scale values.

Battlefield selection is exclusive: one selectedCombatantId per battlefield view model. Selecting another actor replaces that ID, removes the previous selection glow, resets its pressed state and hides its delayed inspect control. Selecting the same actor may clear selection. Selection state is separate from eligibility indicators; eligibility must not masquerade as multiple selected combatants. Each independent preview has its own selection scope.

Back-row stagger: offset the ally rear row toward the left outer edge and enemy rear row toward the right outer edge by groundGrid.backRowOffsetPercent of battlefield width (default3%). The front row remains unshifted. This uses battlefield width, not individual slot width, making the stagger visible while preserving the central exclusion gap.

Current formation is three rows by two columns per faction (six slots each). Row offsets are -5%,0%,+5% of battlefield width for allies and mirrored for enemies, producing an inward staircase toward the front while reserving the central10% exclusion gap. actorScale0.78 slightly reduces the previous0.85 size. rowStepRem4.5 fits the three rows inside the ground. The preview shows six actors per faction; slot count, row count, scale and stagger are configurable. This supersedes prior2×2 and rear-row-only offset descriptions.

Combatants expose inspection only through the delayed shared(i) control. Do not append a duplicate Inspect action button or the generic Eligible target demo panel beneath a selected combatant. Selection glow and actual battlefield target selection remain; item/playing cards retain their contextual action controls.

Formation alignment follows continuous mirrored diagonal tracks: each column uses a fixed horizontal row step and each row uses the same vertical advance. Shadow centers, not status-panel bounds, define the track. Fit each faction as a group inside its reserved area rather than independently pushing actors away from the central gap. Combat feedback must not occupy a layout row, and battlefield content must not create horizontal or vertical scrolling.

Combatant depth and selection: rowScaleFactors defaults to[0.9,0.95,1] from rear to front. Apply perspective scale about the ground shadow contact pivot. Essential information compensates for this small reduction when preserveInformationSize is enabled. Unselected combatants retain sprite, HP, active block, eligible intent, status icons, aura, buffs and ground shadow; name, secondary resources, buildup bars and stance appear only while selected. Inspector preview remains sprite/name/HP. The visibility list is configurable; selection remains exclusive per battlefield.

## Responsive combat legibility, hand and footer

Current W4a allocation is10% HUD /55% battlefield /30% hand /5% footer. Combatant screen-space minimums are configurable: value text12px, HP0.85rem, secondary/buildup0.45rem, stance0.85rem and status icons1rem. Apply these after perspective scaling, without increasing the sprite itself. Compact HP text uses current/maximum, with its full accessible health label retained.

Hand capacity interpolates from config.hand.minCapacity to config.hand.maxCapacity according to host width, constrained by the exposed touch target. Selected/focused cards rise above neighbors for inspection. Beyond the resolved capacity, scrolling is horizontal only. Card faces show bounded summaries instead of inner scrollbars; full details remain in the inspector.

Footer tracks keep Actions and Potions circular and equal in diameter; End turn shares their height and baseline. Circle diameter is bounded by20% host width and available footer height. Draw/Discard share widths capped at10% each, End turn at40%; gaps subtract from the available width. Rectangular controls may stretch horizontally, circles may only scale uniformly. Footer sizing stays within its allocated band and must not overlap the hand. All dimensions come from the shared footerLayout and hand configuration.


## Current hand, focus and footer sizing

Combat nominal regions are 10% HUD, 55% battlefield, 30% hand and 5% footer. The hand has a 208px physical minimum and the footer a 56px physical minimum. Host layout reserves those readable minimums before allocating remaining scene space; it must not fund the footer by shrinking the hand below its minimum. These are explicit accessibility exceptions to percentage bands. The large Actions, End turn and Potions controls use 95% of available footer height, subject to their width allocation, preserving a 44px minimum touch target. The group stays tightly packed and centered.

The hand uses one uniform card scale and preserves 5:8 aspect ratio. Configured card widths range from 5rem to 9rem. Capacity interpolates from five cards at 22rem host width to fifteen at 75rem, constrained by 44px exposed touch width per card. Excess cards use one horizontal hand scroller; never independently resize card faces or add vertical/inner-card scrollbars. Center the actual card bodies vertically in the hand region, not an enclosing box enlarged by inspection controls. Reserve bounded headroom for the configured selection lift and delayed inspect control, with the shared vertical inset. The body remains contained when selected.

Combatants share one unselected base fit per size category across player and enemy allocations. Back/middle/front row factors are 0.9/0.95/1; selected growth factors are 1.1/1.05/1.1. All values come from combatantFocusConfig. Selection details never affect base fitting. The sprite-foot ground anchor stays fixed and selected actors paint on the highest focus layer.

Combatant inspect legibility: the selected info control remains a44px square with circular outline and a centered16px label after perspective scaling. Its horizontal anchor is the original sprite center, never the center of a widened status or resource lane. The delayed reveal and whole-owner selection glow remain shared. Exact health and resource values use at least12px physical text; compact HP uses current/maximum. Existing HP, secondary, buildup, stance and icon minimums remain configurable and unchanged.

Combatant sizing uses the sprite frame width for horizontal fit, excluding external intent and guard badges. The default formation scale is 1 and the minimum sprite-height allocation is 84px; row depth and selection growth remain unchanged.
Hand selection is exclusive within its hand: selecting a new card clears the previous selected state, lift, glow, aria-pressed value and delayed inspect control. Stale inspect timers cannot reveal an unselected card.

The hand uses a curved fan with configurable angle and arc, raised within its section. Resolve one uniform card size from available height and the configured size bounds, preserving 5:8 proportions; five cards remain exposed on narrow hosts before horizontal overflow. The combatant inspect disk is 80% of its former diameter inside the same 44px touch target. Footer reference feedback is announced without covering controls. Sprite allocation is 92px with a 4.5rem lower-details reserve.

The default hand fixture contains five cards and is centered as one fan. Its inspect control overlaps the card upper edge while retaining its hit target, reducing reserved blank space so cards can be larger without changing aspect ratio.

Combatants apply a configurable 1.1 display multiplier after shared fitting. Guard and intent use a 13.2px minimum value font and 22px intent reserve. The hand inspect control overlaps the selected card upper edge to allow approximately 10% larger cards within the same section; the fan angle is 2.5 degrees.

Hand hover does not change card position, rotation or paint order. Only explicit selection raises and straightens a card, preventing pointer-enter/leave oscillation along overlapping edges.
