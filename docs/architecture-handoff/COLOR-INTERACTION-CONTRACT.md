# Shared palette and interaction states

Owner requirement: exit/close/back highlight red when selected; primary actions highlight green when selected or ready; neutral/unready controls use the dark-brown/gold motif. This contract is inherited from W0 by every parent and child. It is a proposed implementation contract, not a claim that the game styles have changed.

## 1. Five configurable palette sections

Expose five small groups of named colors, each with clear previews. Most UI objects resolve their appearance from these roles. Keep actual values in one normalized authoritative source; do not copy hex values into each component or view model. Start from the existing palette during migration, then adjust the shared values with visual verification.

| Section | Configurable roles | Main consumers |
|---|---|---|
| Surfaces | canvas, panel, control | Dark-brown game background, modal bodies, neutral buttons |
| Text | normal, muted, onEmphasis | Main copy, subdued/disabled copy, text on highlighted controls |
| Gold accents | normal, strong | Neutral borders, selected category/item marks, ornaments, default focus cues |
| Positive green | normal, strong | Ready primary actions, selected/pressed positive actions, success feedback |
| Exit / danger red | normal, strong | Selected Close/Back/Exit, destructive actions, error feedback |

Use normal/strong roles for a small predictable emphasis ladder. Hover overlays, pressed shading, subtle fills, and disabled treatments derive through shared state styles; they do not require a separate authored color for every button state. If a derived combination is unreadable in a theme, correct the shared role or mapping rather than patching a screen.

Palette UI itself is a W1a Settings category with the same inherited controls. A palette preview must show neutral, ready, focused, pressed, disabled, exit, and destructive controls together. Reset is a deliberate settings action using existing persistence semantics. Do not add an independent theme save system.

## 2. Role and state matrix

Keep action role separate from state. `primary` describes emphasis/placement; it does not prove an action is allowed or safe. View models receive `canActivate` and reasons from domain/application policy. Rendering never derives affordability or legality from a CSS class.

| Role | Neutral / not highlighted | Available / ready | Highlighted: hover, keyboard/controller focus, or selected | Unavailable / busy |
|---|---|---|---|---|
| Exit / Close / Back | Brown control, gold label/border | Same neutral motif | Red emphasis, readable text and visible focus | Muted brown/gold; no red activation signal |
| Primary interaction / confirmation | Brown/gold while not ready | Brown surface with clear green border/accent | Stronger green treatment, visible focus, readable text | Muted brown/gold, clear reason, no green |
| Secondary utility | Brown/gold | Brown/gold | Stronger gold treatment | Muted brown/gold |
| Category / item selection | Brown/gold | Brown/gold | Gold selection marker; distinct keyboard focus outline | Muted brown/gold with reason if useful |
| Explicit destructive commit | Brown/gold pending eligibility | Red accent when actionable | Stronger red treatment | Muted brown/gold; no positive-green signal |

"Selected" includes input-family highlight, not just an `aria-selected` attribute. Pointer hover and keyboard/controller focus get equivalent role colors. A persistent category/item selection remains gold; not every selected object is a primary action.

For ordinary primary buttons, green-ready is a restrained accent, not every enabled button shouting with a bright fill. Hover/focus/press increases emphasis. This preserves the dark motif while making the next available action obvious. A single full-width footer button keeps its role color; stretching it does not change semantics.

States must not depend on color alone: keep names, selected markers, focus outlines, disabled reasons, and applicable icons. Fading cannot make essential labels or target boundaries unreadable. Use shared text/border/fill combinations validated in the actual UI and supported accessibility themes.

## 3. Precedence and explicit exceptions

Resolve states in this order:

1. Absent by capability: render no component; do not reserve fake buttons.
2. Unavailable/busy: neutral muted motif, no active red/green encouragement. If focusable for explanation, keep a visible focus outline without implying activation.
3. Destructive commit: red takes precedence over primary-green. Delete/Replace/irreversible loss should not look like a positive outcome just because the button is bottom-right. This is an explicitly listed exception; actual consequence policies determine which operations qualify. Saving and ordinary navigation are not automatically destructive.
4. Exit/Close/Back highlight: red only while highlighted/pressed; default brown/gold.
5. Primary ready/highlight: green, with stronger emphasis for highlight/press.
6. Secondary/selection: gold emphasis.

Named exceptions, centrally registered:

| Exception | Rule / owner |
|---|---|
| Combat End Turn | Retain the earlier explicit guidance rule: neutral when an early end is legal but actions remain; green when legal and actions are exhausted, or when the legal End Turn action is highlighted. This changes the hint, never turn legality. Never use the empty-resource fade on End Turn. |
| Destructive confirmation | Red when actionable/highlighted; never green merely because it occupies the primary slot. Resolve from consequence policy, not action-label matching. |
| Resource identities | HP, mana, stamina, potion types retain their registered semantic colors. Empty indicators fade without pretending they are disabled navigation controls. |
| Rarity / damage / status / tags | Resolve through their existing registered semantic palette. Do not recolor an element green merely because its card is playable. Primary action affordances may carry the green cue separately. |
| Targets / factions | Preserve distinct targeting/friendly/hostile cues and non-color indicators. These are not button selection states. |
| Accessibility themes | May replace literal hues to preserve distinguishability/readability; retain role relationships and non-color cues. |
| Art / video / portraits | Authored media is not recolored by the UI palette unless a specific supported asset treatment requests it. |

An exception needs a registered ID, semantic scope, reason, and role mapping. No per-screen hard-coded color override. Adding an exception is a normal reviewed configuration/schema change, not a new permission framework. A component cannot bypass the palette with a local hex literal.

## 4. Normalized authoring and implementation

Extend the existing theme/token schema from the handoff rather than introduce a competing palette. Proposed logical relations:

```text
PaletteGroup(id PK, labelTextId, ordinal UNIQUE)
ColorRole(id PK, groupId FK, labelTextId)
Theme(id PK, nameTextId)
ThemeColor(themeId FK, roleId FK, value; PK themeId+roleId)
InteractionStyle(id PK, fillRoleId FK, textRoleId FK, borderRoleId FK)
InteractionStateStyle(controlRoleId, stateId, styleId FK;
                      PK controlRoleId+stateId)
ColorException(id PK, reasonTextId)
ColorExceptionStateStyle(exceptionId FK, stateId, styleId FK;
                         PK exceptionId+stateId)
```

Control roles and states reference registered enums/relations in the reviewed schema; unknown roles/states fail validation. Theme values exist once per `(themeId, roleId)`; style records reference roles, not repeated color values. CSS custom properties and effective inheritance are derived outputs. Avoid storing palette group labels, theme names, or parent styles again in every component. Exception assignments reference existing component/action definitions through validated typed relationships.

Implementation sequence:

1. Inventory current roles in `styles/base.css`, control styles in `styles/kit.css`, feature overrides in `styles/ui.css`, and `src/framework/data/theme.js`. Assign one source owner per role.
2. Add typed source tables through the content compiler and existing validation/registry pipeline. Reuse authoritative existing color roles for resources/tags.
3. Derive shared CSS variables and semantic state classes from the configuration. W0's controls consume them; descendants inherit without redefining colors.
4. Put `role`, `canActivate`, `busy`, `selected`, and optional `colorExceptionId` in immutable presentation records. Input adapters supply hover/focus/press state; models never hold DOM references.
5. Replace feature-specific action coloring with the shared style resolver. Preserve explicitly registered resource/media exceptions.
6. Verify every action role across wide/compact/portrait, pointer/keyboard/controller, readiness transitions, dark/high-contrast/color-adjusted themes, and single/two-button footers.

```text
FUNCTION controlAppearance(model, inputState, palette):
    IF NOT model.visible: RETURN absent
    highlighted = inputState.hovered OR inputState.focused OR model.selected
    IF model.busy OR NOT model.canActivate:
        RETURN palette.style(model.role, unavailable, focus=inputState.focused)
    IF model.colorExceptionId:
        RETURN registeredExceptionStyle(model, inputState, palette)
    IF model.role == exit:
        RETURN palette.style(exit, highlighted ? highlighted : neutral)
    IF model.role == primary:
        RETURN palette.style(primary, highlighted ? highlighted : ready)
    RETURN palette.style(model.role, highlighted ? highlighted : neutral)
```

Press adds the same shared pressed effect without changing the role. Destructive policy must assign its role/exception before resolving generic primary styling. Color never makes an invalid command valid; commands revalidate on activation.

## 5. Single-row-first typography and layout

Keep related labels, values, and controls on one row whenever they fit. Prefer concise labels, flexible spacing, and one bounded shared compact text-size variant over unnecessary wrapping. Preserve the user's text-size setting and minimum input targets; do not auto-shrink essential copy arbitrarily. Necessary body prose may wrap. Footer controls and their labels remain inline and unwrapped in all supported layouts. State explanations belong in the body, not inside a long button label.

This requirement applies alongside the palette: focus borders, selected emphasis, or pressed effects must not change control dimensions, introduce wrapping, or move corner anchors.
