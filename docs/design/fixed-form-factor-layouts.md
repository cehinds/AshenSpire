# Fixed layouts per form factor (proposal, 2026-11-13)

Owner: "I don't like the auto scaling. I would prefer if positions were fixed
for desktop, widescreen, mobile, and tablet."

## How it works today

- `src/ui/displaySettings.js:264` `applyUiScale` is the single layout decider, run on every resize.
  - `:269` `resolveLayout` → `layoutForCap` (`:209`) computes a continuous zoom,
    `min(w / 1200, h / 730)` clamped to 0.62–1.7 (`content/source/balanceUi.json` `uiScale`).
  - `:273` writes it to `--ui-zoom`; `styles/base.css:232` applies `zoom: var(--ui-zoom)` to `<body>`.
  - `:285` writes `data-form-factor` from `formFactorFor` (`src/ui/models/FormFactorModel.js:14`):
    widescreen (aspect ≥ 2 at w ≥ 1600, or w ≥ 2400), mobile (w ≤ 600), tablet (w ≤ 1100), desktop.
- So inside one form factor the zoom moves with every pixel of resize, and every
  `cqw`/`vw`/`%` rule in combat CSS reflows too. That is the drift.
- A fixed-canvas mode already exists: Settings → Display → View (`viewPreset`).
  - `src/ui/viewViewport.js:3` `VIEW_PRESETS`: desktop 1440×900, mobile 390×844,
    widescreen 1920×1080, tablet 1024×768.
  - `applyViewViewport` (`:56`) fixes `<html>` to that size (`--view-width/height`, `--view-vw/vh`),
    and `styles/base.css:170` fits it into the window with one uniform `transform: scale(--view-fit)`, centred.
  - `--ui-zoom` is then computed from the canvas, so it is constant per preset.
  - Combat JS geometry reads `logicalViewport()` (`viewViewport.js:27`), which returns the canvas.
- Auto (`viewPreset: auto`, the default) does not use it.

## Proposal

Auto picks the form factor from the window (same thresholds), then lays the
game out on that form factor's fixed canvas, using the existing preset machinery.

| Form factor | Canvas (CSS px) | Change |
|---|---|---|
| desktop | 1440 × 900 | as today's preset |
| widescreen | 2560 × 1080 | was 1920 × 1080; matches the HUD reference in docs/hud-layout-tokens.md |
| tablet | 1180 × 820 landscape, 820 × 1180 portrait | was 1024 × 768; follows the device's orientation |
| mobile | 390 × 844 | as today |

- Fixed: every position and size inside the canvas — combatants, HUD, hand, intent rows, `--ui-zoom`.
- Resizing within a form factor: the canvas is the same; only one uniform fit scale changes
  (the picture grows or shrinks as a whole, nothing moves relative to anything else).
- Window aspect ≠ canvas aspect: background-coloured bars on the short sides.
- Crossing a threshold: switches to the next canvas (one jump, at the threshold only).
- The manual View setting stays, as an override of the automatic pick.

## Owner's decisions (2026-11-13)

- Fit: uniform scale of the whole canvas, bars on the leftover edges.
- Scope: **combat only**. Map and menus keep today's auto scaling; the canvas switches on
  when the combat screen mounts and off when it leaves (with View = Auto).
- Tablet follows orientation: 1180 × 820 landscape, 820 × 1180 portrait.

## Traps for the implementation

- The upright/short-screen gate must still be decided from the real window, not the canvas
  (a landscape phone must still be told to turn upright).
- Popovers/dialogs already compensate (`styles/base.css:371`); pointer math uses `viewViewportBox`.
- `?shot=` screenshot boots and the sandbox QA sizes (1280×800, 390×844) must keep working.

## Relative to the canvas, never to the window (owner, 2026-11-14)

Owner: "game keeps auto scaling, it shouldn't do that" and "it can change between
desktop and mobile and tablet and wide screen, but each should have it's own
configuration that's relative".

- The rule.
  - The real window picks the form factor (and so the canvas); a resize may switch it.
  - Inside a form factor every combat element (grid and combatants, overhead HUDs,
    sky / props / ground and the floor line, hand cards, action row, header) is laid
    out only in that canvas's px. The window changes exactly one thing: the uniform
    scale and letterbox offset of `<html>`'s transform.
  - So layout is path-independent: after any chain of resizes it equals a fresh load
    at that window, and two windows of one form factor show the same picture, scaled.
  - The only real-window reads are the form-factor pick, the scale/offset, and the
    short-screen gate. Map and menus keep Auto scaling.
- How the code keeps it.
  - `CanvasBox()` / `CanvasRect()` (`src/ui/viewViewport.js`) give the canvas size,
    scale and offset, and convert a `getBoundingClientRect` (scaled real px) to
    canvas px. `<html>` carries `data-view-left` / `data-view-top` beside
    `data-view-scale`.
  - A zoom read off a rect over local px carries the fit scale. The hand plans
    (`hand.js`) and the band plans (`combatLayout.js`) take the canvas zoom, so
    their authored px are canvas px; the overhead racks scale their authored heights
    and gaps by the fit before they meet rects.
  - The battlefield relays out when its inputs change (the canvas size and the
    field's and hand's local boxes), not on window thresholds, and the fit scale and
    offset vars no longer force a refit.
- Check: `node tools/combat-canvas-qa.mjs` (`npm run qa:combat-canvas`) compares
  canvas-px rects across same-form-factor windows, a resize chain and a drag.
- Open: SPEC.md keeps the player rack's gap at "a fixed 10 screen-pixel" above the
  art (and `tools/player-hud-clearance-qa.mjs` asserts it at 320x740), so that one
  gap still follows the window's scale (up to 2.7 canvas px at 2000x1225).
