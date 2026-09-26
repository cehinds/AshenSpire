> Current authority: [CURRENT-SPECIFICATION.md](CURRENT-SPECIFICATION.md). It supersedes conflicting earlier iteration notes. Documentation only.

# WC0 proportions, selection and inspector

This owner revision supersedes previous fixed card band heights and footer-collapse behavior in card diagrams. It applies to every WC descendant. W0 modal footer omission behavior remains unchanged.

## Geometry

Card height H: header 0.10H, art 0.40H, body 0.40H, footer 0.10H. These are card-relative percentages, not CSS viewport vh. Existing size tables express the resulting nominal viewport equivalents. For a 35vh card: 3.5vh / 14vh / 14vh / 3.5vh. Padding belongs inside each band. Meaningful tag badges occupy the bottom of the art band, as in the owner’s selected-card example; blockers subdivide the body. Keep the footer band even if the context omits an action; never invent a Play button. Art preserves aspect ratio. Overflow rules/details belong in the inspector. Readability may enlarge the entire card with the ratios retained.

## Shared selected state

All card families inherit a configurable semantic selection outline, visual lift and selected elevation. Proposed lift: 1vh; info gap: 0.75vh; info appearance delay: 1000ms; fade duration: 180ms. Reuse gold selection emphasis and existing semantic palette mappings; do not confuse selection with green command readiness. Outline thickness, lift, duration and offsets are shared tokens, never per-entity styles.

The (i) control anchors horizontally centered ABOVE the visually lifted card. It is an overlay, outside the 100% height budget. Hosts reserve top headroom for lift, info gap and minimum input target, including the first grid row and hand. Do not clip it with scrolling/overflow or cover adjacent controls. Keep it within the visible safe area by adjusting host headroom/scroll position, not by moving it to a different card corner. Whole selection region includes the card and info control so moving to (i) does not deselect the card.

After one second of continuous selection, fade in (i). Before appearing it cannot capture pointer input or focus. Cancel pending timer/fade on deselection, removal, disposal or identity change; stale callbacks cannot reveal another card's button. Selection transfers reset the delay. Keyboard/controller selection supports the same delayed control; a named Inspect shortcut can open immediately. Reduced motion retains the delay but removes movement/fade animation. Selecting does not silently execute Play, Equip or Use. Existing deliberate command gestures remain separate from info activation.

## W1w inspector

Inherit W1 and W0 title/exit/back/primary anchors, palette, focus containment, transitions and lifecycle. Replace the category navigation with a read-only card preview left; details right. All three orientations use two columns: left 38% of usable body width, gap 2vw, right remaining. Right pane contains tag-driven facts, effects, requirements and current contextual state. It may scroll independently. Preview suppresses its own info button and command footer control to prevent recursion/duplicate actions, retaining WC0 proportions. Provide accessible full text in the details pane; do not shrink body text to force all details to fit portrait.

Info click stops propagation and never triggers the underlying gameplay action. Close returns focus and selection to the originating card if it exists, otherwise a logical surviving host control. Domain commands revalidate current identity/state. Show a clear unavailable state if the item disappears while inspecting. Only relevant actions appear; one footer action fills width, two remain inline with Back left and primary right.

## Data and pseudocode contract

Store band ratios and shared motion/input timing in typed layout/interaction token relations keyed by token ID and variant. Card families inherit WC0. Tag rules attach detail providers; no card-name branching. Inspector uses the same immutable entity projection and WC0 renderer in read-only context. Update normalized schema relations and compiled validation with ratio sum=1, nonnegative durations, known token references, and explicit accessibility overrides. No per-entity duplicate ratio/timer columns.

## Acceptance checks

Every card family: verify all three modes, 10/40/40/10 band sum, tags within art, selection without reflow, delayed reveal, cancellation before one second, rapid reselection, info pointer transition, keyboard/controller access, reduced motion, first-row clipping, and no accidental domain action. Verify W1w preview/details stay left/right, footer stays inline, close restores focus, and stale entity state cannot commit an action.

## Latest owner revision — aspect ratio and contextual action ownership

This section supersedes earlier embedded footer actions and independent card width/height allocations. Every WC0 descendant uses one shared aspect ratio (proposed 5:8 width:height), clamped width, and height derived from width. Never clamp width and height independently or stretch a card to fill its host. Shared min/max size tokens are configurable. When the host is too small for readable cards, page/scroll the host or open inspection rather than distort the shape. The inspector may show a reduced visual preview while the full accessible details remain on the right.

Header/art/body/footer remain 10/40/40/10 percent of card height. Footer is supplementary metadata, not Use/Play/Equip. Selecting highlights the card and domain-eligible targets and reveals a contextual action OUTSIDE the card in the owning modal footer or host action area. If a target is required, the action remains disabled until a valid target is selected. Untargeted actions do not invent a targeting step. The domain revalidates availability and target on confirmation; cancellation clears targeting and context actions. The info control retains its one-second delayed reveal and opens inspection without committing the action. HTML target choices are explicitly illustrative, not mechanics changes.

Footer content: compact rarity (left) and owned count (right). Values come from registered metadata/inventory providers and applicable tags. Omit unsupported fields; one surviving field retains its semantic anchor. Do not repeat body charge counts. The healing-draught HTML uses illustrative Common / Owned: 1 values; catalog cards show placeholders.

## Component ownership and inspector sizing

WC0 owns the immutable card view model, aspect ratio, four internal bands and intrinsic rendering. Menus compose this same component through a host slot; they may supply available width and read-only interaction context, but never a competing height, stretch alignment or internal row sizing. Derive height from the single resolved width. Use minmax(0, ...) rows so intrinsic content cannot expand a 10/40/40/10 track. Overflow/long details are handled explicitly, not by distorting the card. Verify bounding width/height = 5/8 in the gallery and inspector (proposed shared ratio) and each band's rendered height fraction.

Tag badges use the shared tooltip presenter: hover, keyboard focus and tap reveal registered tag descriptions; Escape dismisses. Tooltip activation never selects/uses the underlying card. Use the same presenter in inspector previews; keep it above modal content and within viewport bounds. Production descriptions belong in localized tag metadata, not per-card text.

## Combatant presentation correction

WC4 inherits identity, tag providers and inspection interactions, but overrides the item-card surface. Borderless sprite85% / HP5% / status10% of component height; no item header, art box, rarity footer or card outline. Selection emphasizes sprite/target. Existing source: src/ui/components/combatantFrame.js, function combatantFrame, contains leading slots, sprite/block badge, optional name, meters and trailing slots; battlefieldStage.js owns shared stage scaling. Preserve those mechanics and art proportions. Three size variants share the same combatant model and renderer.

Combatant nameplate: bind entity display name, centered immediately above the sprite envelope; info anchors above the nameplate. Reserve headroom in the owning host so neither overlaps neighboring UI. Name is outside the sprite/HP/status 85/5/10 height budget and does not stretch the component. Demo name: Ashen Sentinel.

## Resource bars revision

Combatant resource region is a data-driven meter stack: HP always, additional meters only when the combatant model exposes them. Each bar has label, current/max and semantic color; status icons remain in the bottom10% region. Nominal bars use5% of component height each, sprite receives90% minus total bar allocation. Readable minimums win: enlarge uniformly or use inspection if the host cannot fit; never stretch the component or silently hide required HP. HTML Resource A/B values are illustrative only. Add a resource-count selector to exercise one/two/three bars; production visibility is model-driven, not a user preference.

## Status-density examples

The gallery offers light/typical/crowded sample states with stance, status icon, stack count, remaining turns and independent buildup meters. Buildup is progression toward a threshold, distinct from current resource values or an active status duration. Sample names/values are illustrative, not new mechanics. Status region may grow above its nominal10% to accommodate content, taking space from the sprite while keeping the frame ratio. Preserve readable minima; dense compact displays may scroll status content or use inspection, never distort sprites or bars. All actual effects, limits, durations, stance and progress providers must come from the domain model and tag registry.

## Ordered combatant subcomponents

Order is name → sprite → resource meters → buildup meters → status icon row → stance badge. WC4.status composes WC4.buildup, WC4.statusIcons and WC4.stance in that order. Buildup bars span the same width as resource meters. Status tiles use shared2.25rem×2.5rem dimensions with0.3rem gaps. Stance uses a shared8rem×1.7rem box centered below icons; text changes cannot change its dimensions. The status region uses content-fit minimums and takes space from the sprite. The HTML includes a separate labeled assembly diagram; these sizes are proposed shared tokens, not per-effect styles.

Latest placement revision: resources → buildup bars → stance strip → status icons. Stance width is100% of the same parent as resource/buildup bars, with identical left/right edges; fixed shared height remains1.7rem. This replaces the earlier8rem badge and icons-before-stance ordering.

## Five-row visibility hierarchy (latest)

Default visible rows: HP, stance, status icons. Maximum five rows below the sprite. Reserve those three rows first. Up to two additional rows show applicable resource/buildup bars, using configured priority then stable ID; the demo places extra resources before buildup and sorts buildup by threshold progress. Excess buildup becomes progress icons in the single bottom icon row with tooltip values. Icon overflow scrolls horizontally, never wraps into a sixth row. Icon tiles shrink30% from2.25×2.5rem to1.575×1.75rem; preserve accessible input sizing through host interaction/inspection. Production ranking is data-driven.

Icon overflow revision: do not horizontally scroll. Measure available icon-row width after layout and on resize. If all icons cannot fit, reserve the final tile for +N, where N counts every hidden status/buildup icon. Clicking +N opens the inspector with the complete ordered list, stacks, duration and buildup values. Recompute on model/width changes; preserve stable priority ordering and accessible labels.

## Intent, defense and aura/buff presentation

Source review: src/ui/screens/combat.js passes leading intent, sprite, blockBadge, name, meterBars and statusRow into combatantFrame; blockBadge is inside sprite host. WC4.intent uses the leading slot below name, WC4.defense anchors lower-right within sprite, WC4.aura paints behind sprite, WC4.buffLayer paints above sprite but below defense/target controls. Decorative layers never capture input. These layers do not consume the five-row lower stack. Buff facts remain in the same status model; visuals reference those facts, not duplicate state. Aura/buff artwork shown in HTML is a proposed illustrative effect, not verified existing game art.

Latest combatant anchors: name centered at the sprite bottom immediately above HP; reserve name headroom inside that region so artwork cannot overlap it. Intent enlarged to1.2rem bold with2.8rem minimum height, above sprite; info centered above intent. Defense enlarged to1.65rem bold in a3.5rem minimum badge, right edge at top50% of SPRITE region with translateY(-50%). This is parent-relative50%, not screen50vh. All sizes are shared configurable tokens.

Latest relative sizing: aura bounds fill100% of sprite width and height. Each buildup/status-progress bar has50% of HP meter height; stance has100% of HP meter height, sharing its full width. These are parent-relative ratios, not literal screen vh. Status tiles are square1.575rem and show only their icon; stacks, durations and progress values move to tooltips/accessibility labels and full inspector. +N remains the explicit overflow exception. Fixed lower-row content determines remaining sprite height without stretching the overall component.

Latest preview revision: aura visibly spans the full sprite region including its top edge, not merely an invisible bounding box. HP is the reference height; every additional resource meter and buildup meter is half HP height. Defense anchors outside the sprite with0.5rem gap, center at50% sprite height; outer side changes with player/enemy facing. Flip sprite artwork only, preserving readable text and meters. Gallery selectors expose player/enemy and selected/unselected states; selection keeps the shared delayed info behavior. Real assets must use authored facing/animation rules where simple mirroring is unsuitable.

Defense side correction: player-facing-right uses a right-side defense badge; enemy-facing-left uses a left-side badge. Retain0.5rem gap outside sprite and50% vertical center.

Intent visibility defaults: player=false, enemy=true, controlled by shared role presentation configuration. Explicit context override may show/hide intent without changing AI/domain intent state. Omitted intent consumes no space; info anchors above sprite directly. Gallery Intent selector exposes Role default / Show / Hide.

Inspector context override: combatant left preview suppresses battlefield intent and defense overlays. Project the same values as labeled Intent and Defense facts in the right pane. Do not duplicate them on the sprite or allow overlays across the pane/header bounds. Omitted/unknown intent has explicit presentation text; no invented action. Battlefield context retains its configured overlays.

Latest inspector composition: left contains ONLY sprite, name and HP. Suppress aura, buff visuals, intent, defense, extra resources, buildup, stance, status icons and info/action controls there. Right pane projects all available combatant details from the same model snapshot through registered providers: resources, intent, defense, stance, status stacks/durations and buildup, plus any other supported domain facts. Omit absent facts; no construction/debug prose in the combatant detail view. This context override does not alter battlefield rendering.

Inspector layout refinement: title Combatant details; bounded left sprite/name/HP preview max14rem wide, centered in34% pane. Right pane uses one aligned label/value grid followed by compact status rows (icon/name/stacks/duration) and labeled buildup meters. No repeated character heading, construction prose, or placeholder primary. With no real contextual command, Back fills footer width per W0. Portrait retains side-by-side panes with32% preview; right pane alone scrolls.

## Complete combatant detail model

Right pane contains current facts, statuses/buildup, lore, discovered weaknesses/resistances, known abilities, and observed action history. All sections share consistent left-aligned label/value columns and spacing; no independently drifting values or bullet indentation. Lore comes from localized definition records; current facts from a snapshot; known abilities and traits from knowledge-filtered relations; history from ordered combat events with actor/target/action/result references. Preserve 3NF source relations and derive this read model rather than duplicating facts. Distinguish unknown, unavailable and none. Never expose concealed AI abilities/traits via inspection. Example HTML lore/history/traits are labeled illustrative records, not claims about game content.

Inspector order revision: entity name in modal title; right pane starts with one HP/Intent/Defense summary row. Then Current state (stance/resources/statuses/buildup, all identical fact rows), Previous actions newest-first, Known abilities, Known traits (weakness/resistance), Lore last. Left preview remains sprite/name/HP only; header/footer stay anchored.

## Active-only composition (authoritative)

Filter optional components by domain activity before measuring/ordering. HP remains the baseline. Block/defense appears only while active; intent requires both active announced intent and role/context visibility. Additional resources, buildup, statuses and stance appear only when their domain predicate is active (do not equate zero to inactive for every resource). Lower stack order: HP → active resources → active buildup → active stance → active status icons. Omitted components consume zero height/gap and do not reserve blank rows. Example: stance alone yields HP/stance; resource plus status yields HP/resource/icons. Apply five-row budget AFTER filtering; allocate optional bars by configured priority, migrate excess buildup to icons, and reserve final icon for +N when necessary. Infer no artificial stance or status from missing values. Use the same filtered snapshot for inspector facts.

Shared selection emphasis includes visible intent and defense regardless of DOM nesting. Intent explicitly uses the same selection-glow token as defense; hidden/inactive intent stays omitted. Highlight changes no layout or command availability.

Buff overlay bounds: top0, bottom0, height100% of the sprite region, matching aura vertical bounds. Preserve existing horizontal inset; no added layout height or input capture.

Preview controls: Effect count0–20 generates sample active effects to test row fit and +N overflow; presets initialize this count. Resource/status boundary has no extra padding: shared0.2rem stack gap only, also used between resource bars and subsequent rows. Inactive stack has no margin.

Selected combatant emphasis also covers visible info control, nameplate, stance, every status/progress icon and +N. All use the shared gold selection token; highlight does not alter placement or reveal inactive components. Reserve visual glow bleed without adding layout gaps or changing icon capacity.

Selection glow revision: one shared glow on the complete combatant assembly, covering all visible sprite/effect layers, intent, defense, name, meters, stance, icons and info. Remove additive per-child glows to prevent uneven double emphasis. Inactive components remain absent. Color and radius are shared configurable tokens.

Tooltip timing: shared configurable delayMs=1000 before hover/focus/tap reveal. Cancel pending reveal on pointer leave (unless trigger retains focus), blur, outside tap, Escape or removal. Moving between tags restarts the delay; repeated events on the same pending trigger do not.
