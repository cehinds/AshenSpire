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

Preview tabs: Wireframe shows structural schematic, Example shows documentation renderer, Live game embeds a configurable actual game-build URL. Live game starts only on Run game, keeps real game navigation, and is never claimed to implement a proposed wireframe. Browser embedding may be restricted; Open separately exposes the same build. No gameplay script is rewritten or auto-executed to simulate passing validation.

W4a composition: WGS2 shared HUD + WGC1 battlefield + WGC5 hand + WGC6 packed action footer. WGS2 and WGC6 standalone examples call exactly the same reference renderers as the W4a example. Footer children reference WGC7–WGC11; scene component links navigate to each reusable definition.

Third preview-tab correction: Component composition replaces Live game. It executes the reference composition from shared component parts and exposes links to their definitions. It does not embed the production game. W4a composition uses the shared HUD/footer renderers and scene model.
