> Current authority: [CURRENT-SPECIFICATION.md](CURRENT-SPECIFICATION.md). It supersedes conflicting earlier iteration notes. Documentation only.

# Frontend redesign and wireframe implementation contract

**Shared colors and interaction states:** read COLOR-INTERACTION-CONTRACT.md. W0 descendants use five configurable palette groups: Surfaces, Text, Gold accents, Positive green, Exit/danger red. Exit/Close/Back highlights red; normal ready/selected primary actions highlight green; neutral/unready controls retain dark brown/gold. Disabled/busy state wins over active emphasis. Explicit exceptions cover destructive commits, End Turn's earlier guidance rule, resources/tags/rarities/targets, accessibility themes, and media. Never encode per-screen colors in a child view model.

**Single-row-first:** related labels/values/controls stay inline when possible. Prefer concise copy, flexible spacing, and bounded shared compact typography while respecting user text size/readability. Body content wraps only when needed; footer controls never wrap. State styling must not alter geometry or anchor positions.

**Master inheritance (latest): W0 → W1/W2/W3/W4 → lettered children.** W0 is the box with title, top-right exit, bottom-left Back, bottom-right Primary, and a body host. It owns shared corner insets, sizing, effects, transitions, focus and lifecycle. W1 adds workspace navigation; W2 supplies a compact decision; W3 supplies the title-menu body; W4 supplies gameplay regions. This supersedes references below that call W1 the base: W1 is now a specialization of W0. Show W0 first, then each family followed by its children, with Wide/Compact/Vertical ASCII for every entry in RESPONSIVE-WIREFRAMES.md.

Anchoring rules: align chrome to the frame, never spaces proportional to label length. Header close stays top-right when titles wrap. Back stays bottom-left, Primary bottom-right. Exactly one footer action spans the full usable footer width with a centered label, regardless of whether it is Close, Back, or Primary. Two actions retain the left/right roles; zero actions omit the footer. Footer has reserved space outside scrollable body. Footer buttons must remain inline on one horizontal row in wide, compact, and portrait layouts. Use concise meaningful action labels and shared responsive sizing; never stack buttons, wrap a button label, clip a target, or shrink below the input minimum. W3 explicitly keeps its title screen-centered and Profile in the top-right action group. W4a explicitly keeps the requested tightly centered combat control group; that is a declared W0 footer variant, not a second shell. Capabilities specify unavailable actions without inventing navigation or duplicating an existing primary control.

Part of the AshenSpire architecture handoff, 2026-09-12. These are proposed structural wireframes derived from source inspection and the owner's requirements. They are not screenshots, a pixel-accurate visual audit, or implemented game UI. Read EXECUTION-PLAN.md for sequencing, 3NF, source ownership, and verification.

**Three-view requirement:** [RESPONSIVE-WIREFRAMES.md](RESPONSIVE-WIREFRAMES.md) contains wide landscape, compact landscape, and vertical portrait versions of every shared wireframe and distinct flow composition. It is the authoritative responsive drawing set; the drawings below explain structure and behavior. All three modes share view models/components. Latest refinements: character creation minimizes scrolling by showing only one category with a small portrait and persistent controls; map uses the configured 10/60/20/10 height budget and approximately 95% viewport width.

## 1. Design direction

Retain AshenSpire's existing dark fantasy art, palette roles, and visual identity. Improve the hierarchy and interaction consistency through reusable layouts. The owner requests minimal px use and very little stacking of subtitles when they add no information.

Every surface answers three questions clearly: where am I, what can I do, and what happens if I do it? Decorative copy does not get a row by default.

Required rules:

1. One visible main title per screen/dialog. One semantic heading hierarchy; section headings only distinguish real regions.
2. Optional context text must change interpretation: location, target, remaining capacity, or a necessary instruction. Omit redundant labels such as `Smith → Upgrade → Improve your equipment → Choose your upgrade` above the same chooser.
3. Costs, disabled reasons, required stats, risk, and consequences are functional content, not optional subtitles. Keep them near the choice/action they explain.
4. Do not render empty context/help containers. Do not hide duplicated markup with CSS as a substitute for model composition.
5. One primary action per decision scope. Use verb labels: `Upgrade`, `Buy`, `Equip`, `Continue`. Secondary actions have lower emphasis; destructive emphasis follows the existing consequence policy.
6. Consistent alignment, spacing, sizes, status rows, selection indication, focus rings, and action placement come from shared components/tokens.
7. Prefer a flat composition. Do not wrap every row in a bordered card or create nested modal-like boxes inside a modal.
8. Selected, focused, disabled, and unavailable are distinct states. Explain blocked actions in text; color alone is insufficient.
9. Essential actions remain reachable with scrolling, keyboard, controller, and touch. A sticky footer must not obscure focused controls or content.
10. Keep content and DOM reading order consistent across responsive layouts. Reflow one component tree rather than render separate desktop/mobile copies.

11. Every menu with multiple categories uses W1: a left category rail and right content pane on wide screens, with the same category navigation above the content on compact screens. This applies to Shop, Character Creation, Town service menus, Armoury, Compendium, Profile categories, and other categorized menus. Do not use horizontal category tabs or an accordion as an alternative menu shell. selection body/inspection body/choice body may compose the selected category's body. A flat action menu, such as Main Menu, need not invent categories.

## 2. CSS sizing and unit policy

The current game already distinguishes text size from overall UI scale and compensates physical tap targets for `--ui-zoom`. Preserve that behavior. Do not mechanically convert every px to rem: root text scaling must not accidentally enlarge every panel and hit target twice.

| Need | Preferred mechanism | Conditions |
|---|---|---|
| Width/distribution | Grid `fr`, `%`, `minmax(0,1fr)`, auto sizing | Child min-inline-size zero where shrink is intended |
| Text | `rem`/`em`, unitless line-height | Preserve user text scaling; no font shrink to hide overflow |
| Text measure | `ch` and max-inline-size | Prose measure, not currency/button clipping |
| Spacing/radius | Named semantic tokens using the appropriate UI/text scale | One owner for value; avoid per-screen literal geometry |
| Media | `aspect-ratio`, intrinsic dimensions, object-fit | Preserve art aspect; layout does not depend on image load timing |
| Responsive layout | Container queries and intrinsic wrapping | Transition when content no longer fits, not device-name branches |
| Dialog size | Max available host size plus named size token | Use host-relative sizing inside scaled app; do not introduce raw vw/vh there |
| Fine borders | Small px values allowed | A documented shared hairline token is acceptable |
| Input target minimum | Existing zoom-aware `--tap-floor`/`--iconbtn-size` | Physical target size is a justified px boundary, authored once |
| Pointer/canvas/art coordinates | Measured pixels at rendering/input boundary | Convert through existing coordinate helpers, not scattered ad hoc division |
| Browser geometry APIs | Pixel measurements are expected | Do not confuse measured output with authored layout constants |

No arbitrary fixed heights for copy, modal bodies, or variable lists. Use `min-block-size`, content flow, and bounded scrolling where appropriate. Do not introduce `!important` to compensate for conflicting component ownership. No arbitrary negative margins to force a wireframe to fit.

NEW implementation document `docs/refactor/PX-EXCEPTIONS.csv` records `path,symbolOrToken,purpose,coordinateSpace,reason`. It is an audit aid, not a request for a new approval ceremony or blanket px ban. Existing pointer thresholds and physical input settings may remain px when justified. Remove gratuitous authored px as each feature migrates.

Responsive pseudocode:

```text
IF choices.minimumReadableWidth + details.minimumReadableWidth + gap fits container:
    layout = twoColumns
ELSE:
    layout = oneColumn

heading = title
contextLine = meaningfulContext OR absent
helpLine = requiredInstruction OR absent
actions = primary + applicableSecondary
bodyHeight = availableHostHeight - actualHeaderHeight - actualFooterHeight
// No guessed header height and no shrinking text to force a fit.
```

Use CSS intrinsic sizing/container queries for the implementation; do not add a resize listener that sets widths after every render unless a measured interactive splitter requires it.

## 3. Shared parent frames and reusable body variants

Square brackets show actions/slots; these drawings describe hierarchy, not exact dimensions or literal copy. The compact version uses the same records and command bindings.

These are shared renderers, not templates to copy into every screen. Feature view models supply titles, records, selections, availability, actions, and context. Expanded flow examples later in this document are instances of these families, not additional component implementations.

**W1 is the default base modal framework.** Its shared header, optional navigation rail, active content host, and footer underpin Settings, Character Creation, Town, Shop, Armoury, and comparable workspaces. selection body selection, inspection body inspection/status, and choice body choices are reusable BODY compositions inside that frame. For a single-category modal, omit the rail without reserving an empty column. W2 remains a compact confirmation variant using the same header/footer/lifecycle primitives. Do not nest a full shell inside another shell. Main Menu, the gameplay canvas, and the portrait-dialogue scene retain their intentionally distinct compositions while sharing primitives and behavior services.

| Shared wireframe | View models / consumers | What changes through data |
|---|---|---|
| selection body Selection/detail | SaveSlotSelection, SmithService, InventorySelection | Rows, optional detail pane, selected identity, blockers, actions |
| inspection body Inspection/status | ItemDetail, CombatantDetail, SaveStatus | Art/facts/status and applicable actions; art slot may be absent |
| W2 Confirmation | DeleteSave, ReplaceSave, LoadOverActiveRun, Quit, ServiceConfirmation | Target, consequence, tone and command; same lifecycle and action slots |
| W1 Navigable workspace | Settings, Shop, CharacterCreation, Armoury, TownServices, Compendium, Profile, Piles | Categories and selected-pane model; selection body/inspection body/choice body can render inside the pane |
| choice body Choice/progression body | Rest, Reward, Event, ShopOffers | Choices, narrative, costs, claim states, continuation |

Reuse the existing TitleMenu composition for the main menu. Combat/map retain their shared gameplay-region shell; portrait dialogue replaces its lower body with a dedicated conversation component. Those distinct composition needs do not justify separate copies of headers, action rows, modals, or category navigation.

View-model boundary: `sharedRenderer(viewModel, commandBindings)`. A renderer may select a registered body component by layout ID, but must not branch on feature names such as `if screen == shop`. A different view model alone is sufficient whenever the structure and behavior contract match. Create a specialized body only for a genuinely different interaction, such as a battlefield or audio dialogue.

### selection body — Selection and detail: Smith, inventory selection, card services

Wide:

```text
┌──────────────────────────────────────────────────────────┐
│ Upgrade equipment                                    [×] │
├────────────────────────┬─────────────────────────────────┤
│ [Filter, if useful]    │ Selected item                   │
│                        │ [Art]  Current → Proposed       │
│ ○ Item A               │ Attack rating          12 → 15  │
│ ● Item B               │ Guard                    4 → 5  │
│ ○ Item C               │ Requirements        [changes]   │
│                        │                                 │
│                        │ Cost                2 stones    │
│                        │ Available           5 stones    │
│                        │ [Blocker only when applicable]  │
├────────────────────────┴─────────────────────────────────┤
│ [Back]                                       [Upgrade]  │
└──────────────────────────────────────────────────────────┘
```

Compact:

```text
┌────────────────────────────┐
│ Upgrade equipment      [×] │
├────────────────────────────┤
│ [Item selector / list]      │
│ Selected item              │
│ [Art] [Before → After]      │
│ Relevant stat changes      │
│ Cost 2 · Available 5       │
│ [Blocker if needed]         │
├────────────────────────────┤
│ [Back]           [Upgrade] │
└────────────────────────────┘
```

The compact selector remains keyboard/controller accessible. If a long list requires a selection step, declare it as an explicit registered layout mode with preserved selection and back behavior; do not silently hide choices on phones. For extract/install, add the mount/card selection region only when the service model declares it. Clear dependent selections when parent changes. Do not show the same cost or consequence in three locations.

### inspection body — Inspection: item, combatant, flask, pile detail

```text
┌──────────────────────────────────────────────┐
│ Item or subject name                     [×] │
├────────────────┬─────────────────────────────┤
│                │ Type · meaningful tags      │
│     [Art]      │ Relevant stats              │
│                │ Effects / useful prose      │
│                │ [Optional related detail]   │
├────────────────┴─────────────────────────────┤
│ [Applicable secondary]    [Applicable action]│
└──────────────────────────────────────────────┘
```

Compact: art followed by facts; reduce art prominence before sacrificing readability. Read-only inspection needs no invented primary action or redundant footer Close when the accessible header close is sufficient under the existing navigation contract. Pile viewers can use a collection body instead of art/facts with the same lifecycle. Flavor text remains optional body content, not a second title.

### W2 — Confirmation: consequence and two clear answers

```text
┌────────────────────────────────────────┐
│ Sell this item?                    [×] │
│ Item name                              │
│ Receive 12 cinders.                    │
│ This removes the item from inventory. │
│                                        │
│ [Back]                         [Sell] │
└────────────────────────────────────────┘
```

No `Confirmation` eyebrow and no generic `Are you sure?` subtitle above the actual question. Include concrete target and consequence. Preserve existing policy-specific hold/review behavior and input shielding. Safe initial focus follows the policy. Closing equals cancellation only where declared. Use alert semantics for the policies that require them.

### W1 — Settings and navigable workspace

```text
┌──────────────────────────────────────────────────────────┐
│ Settings                                             [×] │
├──────────────┬───────────────────────────────────────────┤
│ Display      │ Text size                       [control] │
│ Audio        │ Necessary explanation, if any             │
│ Accessibility│                                           │
│ Advanced     │ UI scale                        [control] │
│              │                                           │
│              │ [Other settings in selected category]     │
├──────────────┴───────────────────────────────────────────┤
│ [Existing relevant navigation/save action if required]   │
└──────────────────────────────────────────────────────────┘
```

Compact: category selector above settings; no duplicate heading repeating `Settings / Display / Display settings`. Selected category is already labeled by its navigation control. Show help only for settings whose effect is not obvious. Keep actual save feedback and capabilities. Tabbed workspaces can use the selected tab as the header identity instead of adding another identical title; accessible naming must still resolve. Menu entry controls appear only when they offer meaningful navigation.

### choice body — Choices with continuation: Rest, Reward, Event; Shop content inside W1

```text
┌──────────────────────────────────────────────────────────┐
│ Merchant                          Cinders 120 · HP 38/50 │
├──────────────────────────────────────────────────────────┤
│ Cards      │ [Item + price] [Item + price]                │
│ Relics     │                                            │
│ Flasks     │ [Availability/reason with each item]        │
│ Services   │                                            │
│ Sell       │ [Selected choice detail when required]     │
├────────────┴─────────────────────────────────────────────┤
│ [Leave]                                                  │
└──────────────────────────────────────────────────────────┘
```

Shop uses the W1 navigation rail shown above, with choice body choices inside the selected pane. Every other multi-category menu follows W1 too; disclosures may group details inside a category but never replace category navigation. Rest uses service options and useful recovery values. Reward shows claimable content and one continuation action. Event shows its name, story text, and choices; story prose is meaningful content and must not be deleted as subtitle cleanup. Mandatory choice screens are nonmodal surfaces with no misleading close control.

## 4. Screen-to-wireframe mapping

| Surface | Family/composition | Redesign instructions |
|---|---|---|
| Smith upgrade/extract/install | selection body | One title; choices and meaningful comparisons; shared cost/blocker/action slots |
| Armoury | W1 workspace + selection body detail | Keep Character/Inventory/Hybrid concepts and saved IDs; shared pane/tray headers; avoid repeating active tab as nested titles |
| Character creation | W1 + selection body/choice body body | Left stage/category rail; class/kit/stat choices with visible consequences; existing stat allocation component |
| Settings/title and in-run | W1 | One component path; no repeated category title/caption/help stack |
| Shop | W1 + choice body body | Left category rail; compact resource status; item-local prices and blockers |
| Rest | choice body | Recovery/services as meaningful choices; remove redundant shrine/service introductions |
| Rewards | choice body | Rewards, claim state, continuation; no duplicated result/claim/continue instructions |
| Events | choice body | Preserve authored narrative; clean title and choices; no close path invented |
| Item/combatant/flask inspector | inspection body | Same title/facts/actions structure; context controls capabilities |
| Confirmation/load-overwrite/quit | W2 | Exact target and consequence; consistent action order and focus |
| Save slots/profile archive | selection body or choice body | Slot identity, timestamp/status, selected action; preserve destructive distinctions |
| Compendium/history | W1 + inspection body | Collection navigation and detail; no nested cards without grouping purpose |
| Startup/title/lobby | Purposeful page composition using same primitives | Brand art and primary start/resume intent; compact secondary navigation; preserve input setup |
| Map | Shared HUD + map canvas + inspection body/choice body contextual panels | Protect map area; resource/header facts appear once; clear next action |
| Combat/co-op | Shared HUD + battlefield + hand/action region | Protect gameplay space; no blanket W1 wrapper; preserve targeting and input timing |
| Game over/about/controls/tutorial | choice body/inspection body where applicable | Clear outcome or instruction; tutorials may use necessary help; avoid decorative headings |
| Debug/showcase surfaces | Same primitive vocabulary | Technical diagnostics belong here, not in normal player flows |

### W4a — Combat composition (map: W4b)

```text
Wide combat
┌──────────────────────────────────────────────────────────────────┐
│ Identity · Resources                                      [Menu] │
│                                                                  │
│ Battlefield + intentions                                         │
│                                                                  │
│ Hand                                                             │
│                                                                  │
│                 (A)[Draw][END TURN][D/E](P)                       │
└──────────────────────────────────────────────────────────────────┘

Compact combat
┌────────────────────────────────────────────┐
│ Compact shared HUD                         │
│                                            │
│ Battlefield + intentions                   │
│                                            │
│ Hand                                       │
│                                            │
│         (A)[D][END TURN][D/E](P)            │
└────────────────────────────────────────────┘
  A = Actions · P = Potions · D/E = Discard/Exhaust
```

Use uniform gaps between the HUD, battlefield, hand, and bottom control row. The bottom controls form one tightly packed, centered group: `(Actions)[Draw][End Turn][Discard/Exhaust](Potions)`. Keep the gap between adjacent controls minimal in BOTH wide and compact layouts. Scale the group as available space requires while preserving readable labels and minimum input targets. Actions, End Turn, and Potions are the largest controls and visually raised; Draw and Discard/Exhaust are smaller. Leave bottom clearance so the group does not clip or cover the hand.

This supersedes the earlier screen-corner anchoring: Actions and Potions sit at the left/right ends of the group, not at distant viewport corners. Do not use `space-between`, flexible spacer columns, or wider gaps to fill a wide screen. Extra width stays outside the centered group. Use one minimal shared gap token and paired sizes for the two circle controls and the two pile controls so End Turn stays centered. Keep touch targets separate even when painted faces are close; scaling must not shrink hit areas below the configured floor.

The order is Actions → Draw → End Turn → Discard/Exhaust → Potions. Draw sits between Actions and End Turn; the combined Discard/Exhaust control sits between End Turn and Potions. Compact abbreviations are diagram shorthand: real controls need clear accessible labels and recognizable presentation. These controls open their respective pile views; do not invent a draw-card gameplay action. The combined pile viewer uses W1 for its Discard and Exhaust categories.

Empty action/potion/pile indicators fade while remaining readable; the combined pile indicator is empty when both Discard and Exhaust are empty. Empty appearance does not remove labels or change existing inspection/activation legality. End Turn never uses the empty-state fade; it turns green when ending the turn is legal and no actions remain. Keep its label and focus treatment clear in every state.

The map reuses the HUD and spacing system, with the map and contextual node actions replacing combat content. End Turn and the combat control group belong to combat, not the map.

## 5. Frontend schema extension: normalized presentation data

Add these relations to Task 01/03 schema work when consumed. They supplement EXECUTION-PLAN.md Section 5, not a separate configuration system.

| Relation | Key and fields | Purpose/constraints |
|---|---|---|
| `uiSurfacePresentation` | `surfaceId` PK/FK; optional `contextProviderId`, optional `instructionTextId`, `headerVariantId` | Context is absent by default; title stays owned by `uiSurfaces`; provider allowlist |
| `uiHeaderVariants` | `id` PK; `rendererId` | Registered title or navigation identity forms; no arbitrary HTML |
| `uiLayoutModes` | `(layoutId,modeId)` PK; `rendererVariantId` | E.g. wide selection-detail versus stacked; code owns layout algorithm |
| `uiLayoutTransitions` | `(layoutId,ordinal)` PK; `minimumInlineSize`, `unit`, `modeId` | Composite FK to layout mode; bounded supported units; no conflicting thresholds |
| `uiSpacingTokens` | `id` PK; `value`, `unit`, `scaleKind` | Unit allowlist; text/UI/physical distinction; numerical domain constraints |
| `uiTypographyTokens` | `id` PK; `sizeRem`, `lineHeight`, `weight`, `fontRoleId` | Typed text-scale fields; font role FK |
| `uiBorderTokens` | `id` PK; `width`, `unit`, `colorRoleId` | px allowed for shared hairlines; color role FK |
| `uiThemeSpacing` | `(themeId,roleId)` PK; `tokenId` FK | Logical role maps to one typed token per theme |
| `uiThemeTypography` | `(themeId,roleId)` PK; `tokenId` FK | Shared heading/body/caption roles |
| `uiThemeBorders` | `(themeId,roleId)` PK; `tokenId` FK | Typed relation avoids universal unvalidated value strings |

Reference existing theme/color/font registries if authoritative; otherwise declare typed parents during schema design. Do not create duplicate IDs and palette ownership in `src/framework/data/theme.js` and `styles/base.css`. Until moved, use a compatibility projection with one source owner. A theme role mapping is a relationship between typed entities, not an arbitrary gameplay EAV store.

CSS custom properties cannot be assumed to work in container query conditions. The build should emit literal validated query thresholds from `uiLayoutTransitions` into generated styling, or use an approved intrinsic CSS layout that requires no query. Do not ship invalid `@container (min-width: var(--breakpoint))` and assume it responds.

Generated styling strategy: extend the content build to emit `src/content/generated/uiPresentation.js` as typed data and, if needed, a generated stylesheet consumed by the existing bundler. Verify `tools/bundle.mjs` and `index.html` stylesheet order before choosing the integration point. A JS boot adapter may assign validated custom properties to the root; default offline first paint must receive the same data without a visible unstyled flash. Never add a second hand-coded default palette/spacing scale as a fallback.

## 6. File-by-file frontend instructions

Current lines refer to the source snapshot; resolve symbols again before editing.

| File/anchor | Specific change | Required proof |
|---|---|---|
| `styles/base.css`, root tokens and `--tap-floor` near beginning | Map approved authored tokens to CSS roles; preserve physical tap-floor conversion and themes | UI zoom/text scale/tap target remain independent as currently specified |
| `styles/kit.css:34` typography; `:54` row fitting; `:379` veil; `:386` modal; `:399` sizes | Implement shared header/body/footer and the shared wireframe families layouts; remove unused decorative subtitle styling only after consumer migration | Narrow/large text reflows; no conflicting size authority |
| `styles/ui.css` feature overrides | Move repeated geometry into owning shared component; retain genuinely unique battlefield/map behavior | Each removed selector has mapped consumers and screenshot/interaction check |
| `src/ui/components/modalShell.js:201` modalHead | Accept header presentation record; title or navigation identity; context only when supplied; no automatic eyebrow stack | Accessible dialog name exists and close remains labeled |
| `src/ui/components/modalShell.js:81` footer | Model-driven primary/secondary slots and meaningful status; avoid repeated explanatory notes | Action hierarchy and reachability at narrow widths |
| `src/ui/kit/index.js` primitives | Add/reuse semantic header, status, field, cost, blocker, selection and detail slots | Consistent markup and states with no per-screen layout code |
| NEW `src/ui/components/serviceComponents.js` | selection body choices/detail/optional mount/card panes from model | Both Smith services share rendered regions and interaction contract |
| `src/ui/models/SmithSelectionModel.js:71`, `MountServiceModel.js:53` | Project only meaningful title/context/detail/cost/help; no prebuilt HTML | Serialization and complete player-visible consequence |
| `src/ui/screens/shop.js:117` render block | Replace literal spacing/markup and repeated introductions with choice body composition | All operations remain available; no hidden price/eligibility info |
| `src/ui/screens/rest.js:168` initial markup | choice body recovery/services layout, concise title and necessary status | Recovery effects clear without duplicate captions |
| `src/ui/screens/event.js:47` header/body construction | choice body nonmodal event; title + narrative + choices; stop building then hiding a close control | Mandatory choice behavior and story content preserved |
| `src/ui/screens/reward.js:65` mountRewards | choice body reward list and continuation with state feedback | Claim status and optional/automatic choice distinctions clear |
| `src/ui/screens/settings.js:617`, `:1200`, `:1525` | W1 via SettingsViewModel; metadata from normalized rows | Both entry paths have same hierarchy and behavior |
| `src/ui/screens/equipment.js:337`, `:621` | W1/selection body panes, existing trays, no nested repeated active-view titles | All saved modes, resizing, card visibility, selection and stats retained |
| `src/ui/screens/customize.js:51`, `:59`, `:63` | Shared step header/action row and budget; reuse allocation card | Correct choices and stats, no unnecessary heading stacks |
| `src/ui/screens/combat.js:63`, `map.js`, `coop.js:74` | Shared HUD and context panels; preserve unique game canvas layout | Gameplay input/card targeting remains functional |

For title/inspectors/save slots/tutorial/remaining screens, map every baseline surface through Section 4 and record source anchors in MIGRATION-MAP before its Task 15 change. No screen is exempt merely because it is small; equally, a screen already meeting the contract should not be rebuilt for the sake of a file move.

## 7. Copy and state rules expressed as pseudocode

```text
FUNCTION projectHeader(surface, context):
    title = resolveText(surface.titleTextId)
    meaningfulContext = runRegisteredContextProviderIfAny(surface, context)
    instruction = resolveOptionalText(surface.instructionTextId)
    RETURN {
        title,
        context: meaningfulContext OR absent,
        instruction: instruction OR absent,
        accessibleName: title,
        variant: surface.headerVariantId
    }

FUNCTION projectAction(domainPlan, actionDefinition):
    RETURN {
        id: actionDefinition.id,
        label: resolveText(actionDefinition.labelTextId),
        enabled: domainPlan.allowed,
        disabledReason: IF domainPlan.allowed THEN absent ELSE resolveReason(domainPlan),
        consequence: domainPlan.consequence,
        cost: domainPlan.cost,
        command: actionDefinition.commandId
    }
```

Do not use string similarity heuristics at runtime to guess which subtitles are redundant. Resolve that during configuration authoring: omit redundant fields from the definition. The renderer faithfully displays the meaningful fields it receives.

State handling:

- Empty: concise explanation and a relevant next action if one exists; no fake cards.
- Unavailable: show why if the player can act on it; distinguish not offered from temporarily blocked.
- Selected: one clear selected state, with focus independent from selection.
- Busy: block repeated commit and retain meaningful context; do not show a loading skeleton for synchronous local computation.
- Rejected/stale: keep the surface open, refresh plan, explain the changed condition.
- Success: update state or navigate according to existing flow; no decorative success modal for every operation.
- Error: actionable message, preserved state, correct retry semantics; persistence errors do not repeat transactions.

## 8. Verification and handoff acceptance

Task 00 captures current visuals and input behavior. Task 04A builds a small showcase using actual components/model fixtures, not a separate mock implementation. Feature tasks apply the matching wireframe and verify intentional presentation changes. Final comparison distinguishes permitted layout/copy cleanup from accidental game-behavior changes.

Test:

1. Wide desktop and narrow phone; use existing project viewport fixtures and include text/UI scale extremes.
2. Long item names, large costs, verbose localization fixture, missing art, empty lists, all-disabled actions, full inventory, and selected-item removal.
3. Keyboard Tab/Shift-Tab/Escape, controller focus/activation, pointer gesture across backdrop, touch scrolling, and opening a confirmation above a service.
4. One meaningful heading per region; no repeated title/context/section title saying the same thing. Narrative, requirements, and risk stay intact.
5. Shared tokens actually affect all consumers; changing one token requires no screen edit.
6. No unexplained new px geometry, raw viewport dimensions inside the zoomed app, clipped primary action, inaccessible overflow, or unreadably shrunken copy.
7. Focus indicators, accessible names, disabled reasons, readable status, and non-color-only state cues remain present. If formal accessibility-standard compliance is claimed later, verify against current authoritative guidance and real test evidence; this planning document makes no compliance certification.

The deliverable is complete only when architecture, normalized configuration, and these wireframes are implemented together. A schema-only refactor, a visual-only reskin, or models that still hide duplicated rule/markup paths do not satisfy the request.

## 9. Expanded player-flow wireframes

Owner extension: include Main Menu, Character Creation, New Game, Load, Save, Delete, Map, Town, and portrait-based quest dialogue. These are concrete proposed layouts, not screenshots of implemented features. Town and voiced dialogue extend the earlier refactor scope and require the dedicated specification task in EXECUTION-PLAN.md before implementation. Keep all existing identity, progression, persistence, and confirmation rules unless that specification explicitly changes them.

### W3a / W3b — Main menu, centered title and contextual Continue preview

DEFAULT: Continue is not highlighted

```text
┌────────────────────────────────────────────────────────────┐
│                                                  [Profile]│
│                       ASHEN SPIRE                          │
│                                                            │
│                         Continue                           │
│                         New game                           │
│                         Load game                          │
│                         Multiplayer                        │
│                         Settings                           │
│                         Quit                               │
│                                                            │
│                       [Build stamp]                        │
└────────────────────────────────────────────────────────────┘
```

CONTINUE HIGHLIGHTED: a resumable save is available

```text
┌────────────────────────────────────────────────────────────┐
│                                                  [Profile]│
│                       ASHEN SPIRE                          │
│                                                            │
│       [Continue]                  [World / character art]  │
│       New game                    [Saved-character preview]│
│       Load game                                            │
│       Multiplayer                                          │
│       Settings                                             │
│       Quit                                                 │
│                                                            │
│ Active save: Character · Class · Current location           │
│                       [Build stamp]                        │
└────────────────────────────────────────────────────────────┘
```

ASHEN SPIRE remains horizontally centered across the full screen, in the same position in both states. It belongs to the full-width header, never the menu column. Profile stays top-right. Keep the existing ember background and title visual treatment; the diagrams simplify ornamentation. The same menu component/model renders both states.

Center the menu by default and render no world/character preview or empty preview placeholder. When an available Continue item is the actively highlighted item, move only the menu region left and reveal the selected save's world/character art on the right. Show the matching save summary with that preview. When highlight moves away, hide preview/summary and center the menu again. No preview for a disabled/unavailable Continue.

Drive this through `MainMenuViewModel`: `highlightedActionId`, `canContinue`, `continueSlotId`, `preview`, and derived `layoutMode`. `showPreview = canContinue AND highlightedActionId == continue`; `layoutMode = showPreview ? continuePreview : centered`. Preview data must correspond to the exact slot Continue would load. Highlight is shared state for keyboard/controller focus and pointer hover; ignore stale pointer-leave events after another input selected an item. Moving the menu must not cause hover oscillation or lost focus: preserve element identity and keep the triggering pointer within the active item during the transition, or use a stable pointer interaction region. Highlighting never loads a save or writes storage.

For compact layouts, keep the title screen-centered and the menu centered; reveal a smaller preview below the menu only while Continue is highlighted. No unreadable side-by-side squeeze. Respect reduced motion. The menu may initially highlight Continue through the existing default focus behavior, in which case the preview is visible immediately; do not simulate a different selection solely to hide it.

Use the owner-requested menu labels/order shown here through validated menu definitions. Wire only existing supported destinations; verify Multiplayer against the existing lobby/connection entry before exposing it. Retain other supported destinations such as Collection through the approved menu/profile navigation definition, rather than deleting their capability during layout work. Profile replaces title-only fullscreen/music shortcuts; those capabilities remain in Settings. This two-state design supersedes the earlier always-centered/no-preview rule and the always-split art/menu proposal.

### W1l / W1m — New game and Load, one slot-selection wireframe

```text
┌────────────────────────────────────────────────────────────┐
│ {New game / Load game}                                 [×] │
│                                                            │
│ ● Slot 1   Empty                                           │
│ ○ Slot 2   Character · Class · Location       Last saved …  │
│ ○ Slot 3   Character · Class · Location       Last saved …  │
│                                                            │
│ [Delete selected, only where offered]                      │
│ [Back]                          [{Create character / Load}]│
└────────────────────────────────────────────────────────────┘
```

Selecting a slot does not delete or overwrite it. Carry a proposed destination through creation; perform the existing required replacement confirmation at the actual write boundary. If existing mechanics require earlier reservation, document and preserve the non-destructive behavior explicitly. An occupied destination shows its exact replacement consequence before commit. Use the shared slot selector and W2 confirmation, not a separate slot implementation.

One `SaveSlotSelectionViewModel` supplies mode, slot records, selectability, selected-slot actions, and primary label to selection body. Empty slots are selectable for New and unavailable for Load. The detail pane is optional for this compact collection. Do not author separate New/Load slot markup or duplicate models with only renamed labels.

### W1c — Character creation, one category, minimal scrolling

```text
┌────────────────────────────────────────────────────────────┐
│ Create character                       [Small portrait]    │
├──────────────┬─────────────────────────────────────────────┤
│ Class        │ ATTRIBUTES                  Remaining: 3    │
│ Starting kit │                                             │
│ Attributes ● │ Strength       [−] 8 [+]  Dexterity [−]8[+] │
│ Review       │ Constitution   [−]10 [+]  …                 │
│              │                                             │
│              │ Derived effects: [compact comparison row]   │
│              │ [Required feedback / blocker, if present]   │
├──────────────┴─────────────────────────────────────────────┤
│ [Back]                                      [Next / Begin] │
└────────────────────────────────────────────────────────────┘
```

W1 remains the shell. Show ONLY the selected category: Class shows class choices, Starting kit shows kit choices, Attributes shows the allocation controls, and Review shows a concise final summary. Do not render a class chooser, equipment preview, and attribute editor together. The small portrait belongs to the header/summary slot; it must not consume a large body column or push controls below the fold. The illustrated names/values are placeholders for current definitions.

Optimize the default supported layouts to fit the category and navigation without page scrolling. Use compact choice grids and a shared two-column attribute grid when it fits; use one column in narrow portrait. Keep the point budget beside the attribute heading and show derived effects in one concise comparison region rather than multiple stacked cards. Reveal long descriptions through the shared detail view. If a choice collection is too large, use explicit pages with Previous/Next and a count; retain selection across pages. Pagination must not conceal selected state or block access to choices.

Keep Back and Next/Begin visible in a persistent bottom row, with real layout space reserved so it cannot cover content. On Review, present identity, loadout, key derived values, seed/options, and destination slot in compact groups; detailed inspection is available without losing the draft. Category navigation preserves draft edits and validation. Any unavailable stage explains its prerequisite.

No forced no-scroll policy: at extreme text/UI sizes or unusually long content, let the active pane scroll with visible focus and reachable controls. Do not shrink text/hit targets, clip attributes, or hide required consequences to force a fit. Prefer one controlled body scroll region over page-plus-nested-panel scrolling. See RESPONSIVE-WIREFRAMES.md for all three views.

### W1r / W2b / W2c — Save, delete, and replace

```text
inspection body STATUS INSTANCE                   W2 DECISION INSTANCE
┌──────────────────────────────┐    ┌──────────────────────────────┐
│ Save game                [×] │    │ {Delete / Replace} save? [×] │
│ Current character            │    │ Selected slot · Character    │
│ Class · Location             │    │ [Replacement, if applicable] │
│ Destination: active slot     │    │                              │
│ Last saved: …                │    │ Exact consequence            │
│ [Save status / error]        │    │                              │
│ [Back]                [Save] │    │ [Back]  [{Delete / Replace}] │
└──────────────────────────────┘    └──────────────────────────────┘
```

Empty/unreadable/incompatible slots cannot load; explain the distinction. Delete is secondary and separated from selecting/loading, available only for a deletable selected slot. Confirm the exact slot and identity, and refresh if that identity changed before commit. Do not claim irreversible deletion if the existing save manager archives the run; derive copy from its actual policy. Run deletion never implies profile deletion.

Save targets the active slot by default. A Save As destination selector is a separate capability and must not be introduced unless the approved persistence contract supports it. Successful save reports Saved; failure preserves the run and offers retry of the save, not repetition of gameplay actions. Loading from an active run uses the existing unsaved-progress confirmation. New Game, Load, Save, Delete, and Replace reuse the same slot records and action policies.

`SaveStatusViewModel` uses inspection body without art; `SaveDecisionViewModel` uses W2 for delete/replace/load-over-active-run. Their differing consequences and handlers live in data and bindings, not distinct confirmation renderers. Character Creation, Town services, and Shop drawings are likewise examples of W1 with feature view models, not new workspace shells.

### W4b — Map, 10 / 60 / 20 / 10 screen-height composition

```text
┌────────────────────────────────────────────────────────────┐
│ Character · Resources · [Act/region ▾]             [Menu] │ 10% top HUD
├────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────┐ │
│ │                                                        │ │
│ │                  MAP / CONNECTED NODES                 │ │
│ │                                                        │ │ 60% map band
│ │               Current · Reachable · Visited            │ │ map ≈ 95% screen width
│ │                                                        │ │
│ └────────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────┤
│ Selected node: Town                                        │
│ Known services · Relevant risk                             │ 20% details
│ [Unavailable reason / meaningful selected-node detail]     │
├────────────────────────────────────────────────────────────┤
│ [Recenter]                                   [Enter town] │ 10% bottom HUD
└────────────────────────────────────────────────────────────┘
```

Use the requested approximate 10vh top HUD / 60vh map / 20vh details / 10vh bottom HUD allocation across wide, compact, and portrait views. Center the map at about 95vw. The region selector belongs in the top HUD, not a fifth vertical band. Map navigation uses its own pan/zoom interaction rather than scrolling the entire page. Details update from selected-node state and obey reveal rules; bottom action names the actual destination.

Implementation: treat these as percentages of the available visible game viewport, adjusted for safe areas/browser chrome and the existing UI zoom. Use one bounded host with `10fr 60fr 20fr 10fr` tracks (`minmax(0, …)` as appropriate); map inline size is 95% of that full-width host. Put uniform padding/gaps INSIDE the allocated bands, so 100% plus extra gaps does not overflow. Do not scatter raw vh/vw calculations inside the zoomed app. Resolve visual-viewport-to-local sizing through the existing shared adapter. If dynamic viewport units are used at the outer unscaled host, document that single boundary.

The proportions are the normal layout target, not permission to clip text or undersize controls. For large text, short landscape heights, or expanded details, honor minimum HUD/control heights, provide controlled details overflow, and let the map yield only as needed; retain the nominal ratios in data and test the exception. No combat action group belongs in this bottom HUD. See RESPONSIVE-WIREFRAMES.md for all three views.

### W1b — Town interaction

```text
┌────────────────────────────────────────────────────────────┐
│ Town name                     Resources         [Menu][×] │
├──────────────┬─────────────────────────────────────────────┤
│ Smith        │ [Small NPC portrait] NPC name                │
│ Merchant     │                                             │
│ Rest         │ Active service choices                      │
│ Quest NPC    │ [Option] [Option] [Option]                  │
│              │                                             │
│              │ Relevant cost / availability / quest state   │
│              │ [Required feedback, if any]                 │
├──────────────┴─────────────────────────────────────────────┤
│ [Leave town]                          [Talk / Open service] │
└────────────────────────────────────────────────────────────┘
```

Use exactly the W1 structural shell used by Settings and Character Creation: header → category rail + active pane → persistent action footer. Town name is the single main title. Resources are concise header context, not a separate HUD band. There is no town-scene/hero band above the category workspace. Any useful scene art is optional content inside the active pane and must not displace choices, status, or actions.

`TownViewModel` supplies NPC/service categories, selected NPC portrait/name, active service content, availability, and footer actions. `SettingsViewModel` and `CharacterCreationViewModel` populate the same shell with different records. Do not implement town-specific navigation/header/footer markup. Only the active pane is mounted; preserve selection when switching categories or returning from dialogue/service interaction. Reuse selection body/inspection body/choice body bodies inside that pane as appropriate, rather than stacking complete modal shells.

Use a compact portrait and concise necessary feedback to minimize scrolling. In compact landscape and portrait, W1 moves category navigation above the content and preserves the footer. NPC/service availability remains data-driven. Close/Leave behavior uses the approved location policy; do not invent an exit around a mandatory interaction. See RESPONSIVE-WIREFRAMES.md for all three views.

### W4c — Quest conversation: portraits and voice-led dialogue

```text
WIDE
┌────────────────────────────────────────────────────────────┐
│ Character · Resources                              [Menu] │
│                                                            │
│ [Player portrait]       [Location / scene]   [NPC portrait] │
│ Character name                                   NPC name │
│                                                            │
│ Speaker name                                  [Voice Ⅱ]  │
│ “One short spoken beat, with readable captions.”            │
│ [Response choices only when the conversation reaches them] │
│                                                            │
│ [Back]             [Skip speech]                [Continue] │
└────────────────────────────────────────────────────────────┘

COMPACT
┌──────────────────────────────────┐
│ Compact shared HUD               │
│                                  │
│ [Player portrait] [NPC portrait]  │
│ Player name             NPC name │
│                                  │
│ Speaker name           [Voice Ⅱ]│
│ “One short caption beat.”        │
│ [Response choices when needed]   │
│                                  │
│ [Back] [Skip speech] [Continue]   │
└──────────────────────────────────┘
```

The player's portrait stays on the left and the NPC's on the right, including compact layout. Indicate the current speaker without adding another subtitle. The lower card/hand region is replaced by the dialogue region; combat cards and End Turn are absent during conversation. Maintain uniform gaps and clear, reachable navigation actions. Limit captions through authored short beats, not clipping, truncation, tiny text, or inaccessible fixed-height boxes. Long localized captions reflow; essential quest consequences remain readable.

### Dialogue progression and button meanings

Proposed default: voice-led playback with auto progression between linear dialogue beats after the audio finishes and a configured readable pause. Always pause at a response choice, an explicit gameplay consequence, or the end. Auto progression is configurable; manual mode remains fully usable.

| Control/state | Behavior |
|---|---|
| Continue during speech | Stop the current clip and advance one beat; invalidate its pending completion callback |
| Continue after speech | Advance one beat; at a choice, require the selected response's existing confirmation policy |
| Skip speech | Stop current speech and advance to the next required choice/consequence/end boundary; never choose a response or commit rewards |
| Back | Review the previous visited beat; no reversal or repetition of committed game effects; auto progression pauses while reviewing |
| Back on first beat | Return to the parent interaction when legal; otherwise unavailable with a reason |
| Voice pause/resume | Pause/resume current clip and associated auto-advance timing |
| Missing/muted/blocked audio | Show captions immediately; Continue remains available; default to manual progression rather than hang or skip unseen text |
| Dialogue close/navigation | Stop clip, cancel timers, release listeners, preserve committed domain state |

These semantics distinguish presentation history from quest history. Quest choices/actions are committed only through registered domain commands and recorded once. Back and Skip never replay effects. An audio-ended event is not a gameplay command. Where a conversation cannot be exited, the definition must say so and the UI must still offer a legal choice path. At conversation end, Continue is labeled for its actual destination, such as Return to town.

Voice assets are referenced by data, loaded through a dedicated speech adapter, and coordinated with existing music/SFX settings. The source's current audio module is not assumed to already implement recorded NPC speech. No microphone or speech recognition is implied. Missing voice assets are a content-production dependency, not permission to invent prerecorded dialogue or block caption-only play.

### Additional normalized relations

Extend the same authoritative schema; do not store a second copy of NPC names, portraits, quest effects, or settings inside each dialogue line. Exact IDs and existing quest references are mapped during the dedicated spec task.

| Relation | Key / fields | Constraints |
|---|---|---|
| `npcs` | `id` PK, `nameTextId`, `portraitAssetId` | Text and asset references validated |
| `towns` | `id` PK, `nameTextId`, `sceneAssetId` | Location mapping uses existing node identity contract |
| `townNpcs` | `(townId,npcId)` PK, `ordinal`, optional `availabilityRuleId` | Both FKs; unique ordinal per town |
| `npcServices` | `(npcId,serviceId)` PK, optional `availabilityRuleId` | Service FK points to existing service authority |
| `dialogues` | `id` PK, `entryBeatId`, `progressionPolicyId` | Entry beat must belong to dialogue; policy FK |
| `dialogueBeats` | `id` PK, `dialogueId`, `speakerRole`, nullable `npcId`, `textId` | NPC required only for NPC speaker; player resolves from current context |
| `dialogueBeatAudio` | `(beatId,locale)` PK, `audioAssetId` | FK beat/asset; no duplicate caption text |
| `dialogueTransitions` | `(fromBeatId,ordinal)` PK, `toBeatId`, optional `predicateId` | Typed predicates; deterministic priority; no unbounded auto loops |
| `dialogueChoices` | `id` PK, `beatId`, `ordinal`, `labelTextId`, `commandId`, `nextBeatId` | Unique ordinal per beat; command resolves existing effect/quest operation |
| `npcDialogues` | `(npcId,dialogueId)` PK, `priority`, optional `availabilityRuleId` | Deterministic available conversation resolution |
| `dialogueProgressionPolicies` | `id` PK, `autoAdvance`, `pauseAfterSpeechMs`, `missingAudioMode` | Typed bounded timing; manual fallback; choices never auto-selected |

Audio duration comes from the asset, not a second hand-maintained timer column. Timing in milliseconds is appropriate media timing, unrelated to minimizing CSS px. Runtime dialogue cursor/visited beats are separate presentation state; persistent resume, if required, needs an explicit save migration and versioned references. Do not add it implicitly.

### Dialogue controller pseudocode

```text
FUNCTION showBeat(beatId, reviewing = false):
    cancelPreviousAudioAndTimers()
    generation = generation + 1
    thisGeneration = generation
    model = projectBeat(beatId, player, npc, locale)
    renderPortraitsCaptionAndControls(model)
    IF reviewing OR noPlayableAudio(model):
        awaitManualContinue()
        RETURN
    speech.play(model.audio, onEnded = FUNCTION:
        IF thisGeneration != generation OR viewDisposed: RETURN
        IF autoAdvance AND linearNonCommittingSuccessorExists(beatId):
            scheduleReadablePauseThenAdvance(thisGeneration)
        ELSE:
            awaitManualContinueOrChoice()
    )

ON skipSpeech:
    cancelPreviousAudioAndTimers()
    generation = generation + 1
    destination = nextRequiredBoundaryAlongCurrentLinearPath()
    showBeat(destination, reviewing = true)
    // Stop before any branch, command, or consequence; never execute it.

ON chooseResponse(choiceId):
    validateChoiceAgainstCurrentQuestState()
    runExistingConfirmationPolicy()
    result = dispatchDomainCommandOnce(choiceId)
    IF result.committed: showBeat(result.nextBeatId)
    ELSE: refreshChoicesAndShowReason(result)
```

### Expanded flow acceptance

Verify main-menu primary action with and without saves; cancel New Game without altering an occupied slot; preserve draft creation state on Back; select/load/delete the correct slot; failed save does not lose the active run; town Back restores selected NPC; hidden map information stays hidden; dialogue portraits retain left/right positions; captions work without sound; stale audio completion cannot double-advance; Back/Skip never grants rewards or commits choices; auto progression stops at choice boundaries; keyboard/controller/touch can reach all controls at large text sizes. Add real audio failure/pause/navigation tests, not only mocked happy-path end events.








