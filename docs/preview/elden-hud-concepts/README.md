# AshenSpire title, quick-menu, and combat-HUD concept prompt

## Goal

Design and prototype a conservative evolution of the current AshenSpire presentation. Keep the shipped warm soot-and-brown palette, parchment-and-gold typography, rounded outlined buttons, compact resource plates, tall framed cards, mountain/moon combat field, and controller-native interaction. Apply the requested Elden-like hierarchy and restraint without replacing AshenSpire's established visual identity or copying FromSoftware artwork, logos, icons, sounds, typefaces, or exact layouts.

AshenSpire is a dark-fantasy roguelike deckbuilder viewed as a 2D combat board. The player reads cards, targets combatants, manages HP/MP/SP, uses flasks, changes armaments, opens piles, and ends the turn. The center battlefield and the hand must remain visually dominant.

## 1. Startup and title flow

- On first load, show a quiet, nearly empty title gate: the AshenSpire logo in the center, subtle ash/ember motion, and the exact development BUILD/source stamp at the bottom.
- Do not show save slots or menu buttons yet.
- Continue to the existing title menu after any of:
  - pointer click or touch;
  - `Enter` or `Space`;
  - controller A / Cross;
  - controller Start / Menu.
- Show one restrained prompt such as `PRESS ANY BUTTON` and change it to the active input family when known.
- The first input only opens the title menu. It must not also activate a title-menu control.
- Respect reduced motion. The transition should be a short logo lift/fade and menu reveal, not a long cinematic.
- Keep the current title-menu destinations and save-slot behavior unless a separate acceptance decision changes them.

## 2. Quick menu and Settings

- The phrase **quick menu** means the existing in-run `☰` dropdown, not the title menu and not a second settings system.
- Make **Mirror** the default quick-menu presentation.
- Remove all `TEST`, experiment, and “change or turn off” copy. Present the quick menu as a shipped feature.
- Add two immediate, stateful rows near the top:
  1. Fullscreen — shows the live on/off state and uses the existing fullscreen action.
  2. Music — shows the live on/off state and uses the existing audio setting path.
- Keep Fullscreen and Music in Settings too, but place them first in Settings before the longer display/audio lists.
- Preserve the single source of truth: quick-menu rows call existing actions/settings writers and reflect the resulting state; they do not own a second copy.
- Keep context-specific destinations in the middle.
- Keep `Save` and `Save & Quit to Title` as the last two rows, separated from the navigation rows. Save gives in-place confirmation; Save & Quit retains its existing confirmation and persistence rules.
- Maintain keyboard, touch, focus-cursor, gamepad, Escape-layer, and modal input ownership.

## 3. Combat top HUD

Reorganize the current AshenSpire HUD without replacing its panel and control grammar. Keep the center playfield clear.

### Primary top line

- Left: `<character name> · <class>`
- True center: `<act/floor>`
- Right: `<cinders> · Lv. <level> · [quick menu]`

The centered floor label must remain geometrically centered in the viewport, not merely centered between unequal left/right content.

### Player resource cluster

- Left-aligned below the identity:
  - HP current/max;
  - MP current/max;
  - SP current/max.
- Bar fill uses current/max. Bar maximum also influences trough length:
  - small maxima begin compact;
  - HP may grow toward roughly half the viewport on desktop;
  - never let a bar cover the centered floor or right utility cluster;
  - on narrow screens, use the available row width rather than preserving a desktop length.
- Preserve exact numbers, accessible names, contrast, and truthful minimum-width/broken-scale behavior.

### Relics and flasks

- Relics form a slim horizontal strip beneath the resources and may span the available width. On narrow screens they scroll or collapse without covering the battlefield.
- Place flask shortcuts near the right utility cluster on desktop and in a compact sub-row on mobile:
  - utility/other flasks in the middle;
  - healing flask with count and hotkey;
  - MP flask with count and hotkey.
- Keep each flask at the tap-target floor and preserve its existing action menu and one-action dispatch behavior.

## 4. Combat command rail

Make the bottom command rail one semantic, non-overlapping grid. Left to right:

1. Armaments — compact icon button, shaped and sized like Draw/Discard.
2. Actions — current/maximum action or energy count.
3. End Turn — more compact; `END TURN` on top with its bound key or controller glyph centered underneath.
4. Draw — pile icon and count.
5. Discard — pile icon and count.

Requirements:

- Every visible control remains at least the configured tap-target floor.
- Zero painted-box and hit-box intersections at supported phone, tablet, landscape, and desktop shapes.
- Keep hand/card-cost/pager space separate from the rail.
- Preserve End Turn confirmation, actions, cancel behavior, keyboard/controller rebinding, focus order, and co-op ownership.
- Do not use absolute positioning to escape the shared rail.

Armament radial placement:

- On desktop and short-wide layouts, use one smaller radial offset near the lower-left, above the command rail and clear of the hand and player plate.
- On phone, expose a testing setting with three placements: lower-left, lower-center, and lower-right. Lower-left is the default.
- The phone placement setting changes geometry only; it must not create separate action ownership or change the A/B/C aesthetic selection.
- Releasing the Armaments control or selecting an ordinary shortcut does not close the radial. Pressing Armaments again, clicking/tapping away, or Cancel closes it. Opening Full Armaments closes it through screen takeover.

## 5. Character and enemy plates

Each combatant plate uses this hierarchy:

- `<name> · Lv. <level>`
- HP bar and exact value
- Poise bar only when poise damage is present or changing
- Status buildup bars only for active buildup

When both poise and status buildup exist, show poise first, then status rows. Show at most three status rows. If more exist, show a compact `+N` overflow control with an icon; hover, focus, click, or tap reveals the complete list in an accessible tooltip/popover.

Do not confuse persistent applied-status icons with buildup meters. Preserve intent, target selection, hover/focus tooltips, death/down states, and co-op distinctions.

## 6. Development identity

- Startup gate: exact build stamp at the bottom.
- During development builds: a quiet bottom-edge line reading `DEVELOPMENT BUILD · <version> · src <digest>`.
- It must never overlap the hand, pager, command rail, phone safe area, or browser controls.
- Release builds follow the existing build-identity policy; do not infer release authority from this visual.

## 7. Responsive concepts to compare

Prototype and measure three variants with the same semantics:

- **Original + (recommended):** the smallest visual change—current AshenSpire surfaces with identity/resources left, floor at true center, and currency/menu right.
- **Original + Wide:** the same shipped motif with wider resource and flask allocation on desktop/tablet.
- **Original + Compact:** the same shipped motif with tighter spacing on narrow/short screens; exact values and accessible names remain.

The comparison changes layout and emphasis only. It must not create three code paths for behavior or data.

## 8. Motion and material direction

- Palette: retain the current tokens—soot `#0d0b08`, raised brown `#171310`, panel brown `#241d15`, parchment `#e8dcc0`, saturated gold `#c9a227`, rust/blood red, strong mana blue, and stamina green.
- Material: retain visible brown/gold outlines, rounded raised panels, framed card wells, restrained amber bloom, and sparse drifting ash.
- Typography: retain the current Cinzel-style display hierarchy and compact Inter-style body/value text.
- Meaningful motion only: title reveal, menu open/close, resource loss/gain, danger, status overflow, reward.
- Respect `prefers-reduced-motion`.

## 9. Avoid

- Copying Elden Ring assets, typefaces, iconography, logo treatment, audio, or pixel layouts.
- Generic dashboard cards, equal-weight boxes in every corner, or opaque full-width chrome.
- A permanent center panel over combat.
- Hiding exact resource values.
- A second state owner for music, fullscreen, quick-menu mode, save, piles, or End Turn.
- Desktop-only absolute offsets, controls below the tap floor, or mobile labels that imply keyboard-only input.

## 10. Preview and delivery gates

- Interactive startup gate: pointer, touch, Enter, Space, controller A/Cross, controller Start/Menu.
- Quick menu: Mirror default; no test copy; live Fullscreen/Music state; Save and Save & Quit remain last.
- Settings: Fullscreen and Music first, with identical underlying state.
- Combat source and selected standalone: desktop, phone, tablet, short landscape; text/UI size matrix; keyboard, touch, and gamepad.
- Conditional poise/status rows including 0, 1, 3, and 4+ statuses; overflow works by hover/focus/click/tap.
- Command rail: all five controls, exact order, tap floor, zero intersections, hand/pager separation, co-op parity.
- Matching before/after phone and desktop evidence from exact reviewed standalone bytes.
- Current-base focused gates, discriminating plants, full relevant regression gates, build/provenance identity, and independent non-author review.
- README and in-game-changelog disposition must be recorded before any production artifact build. Release remains RED unless Constantine separately authorizes it.
