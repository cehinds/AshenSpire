# Approved wireframes: implementation

Reference: documentation commit `dcb3d1cd`, draft PR #1005. The owner requested
rebasing the implementation onto current dev after finding that the preview
used an old build. The branch now starts at `1b72522d`; the original
`09bda158` implementation commit was replayed as `18a44b28`. Existing work was
preserved. The owner’s unrelated primary checkout was not edited.

The subsequent merge preparation rebased onto `e017ef1d` (documentation-only
updates); the original implementation commit is now `b07b8747`. Runtime source,
tests, tools, and generated artifacts are byte-identical to the validated tree.
Implementation delivery is tracked in issue #1008.

## Coverage and current behavior

The adjacent `wireframe-coverage.json` lists all 152 approved entries and
separate structural, viewport, and interaction verification states. No entry
is complete yet. A component’s existence does not establish visual parity.

The shared card face now uses the approved 5:8 proportions, four bands, and
left cost rail. Live projections, X costs, and runtime registries still own
the values. The hand has uniform sizing, exclusive selection, instance-keyed
local reordering, and an inspection control outside the clipping scroller.
The inspector reuses real card details and domain actions.

Battlefield geometry uses fixed mirrored slots, front/back layering, equal
vertical ground-anchor intervals, role-specific guard anchors, and separate
selected growth. Existing sprite geometry and size-category ratios remain
authoritative. Shared modal footer actions use equal tracks.

## Reference reconciliation

- CURRENT-SPECIFICATION.md’s latest configuration governs accepted appearance;
  earlier hand fan and battlefield layout CSS is superseded.
- Current dev contains models and components missing from the old base. Reuse
  those runtime authorities; source paths in the reference are not evidence
  that a proposed adapter exists.
- Progression XP/practice examples do not authorize new mechanics. SPEC.md
  remains authoritative; do not turn illustrative reference data into gameplay.
- Stacked, the hand/footer minimums leave insufficient readable battlefield
  height at 844×390. Short landscape now folds the footer into rails beside
  the hand and plans supported; see "Compact landscape combat".

## Validation evidence and limits

Targeted card-cost, hand-layout, formation, and sprite-scale tests pass, as do
selection-store tests. The reference validator reports 152 entries and 608
views with no consistency failures; this is not runtime parity evidence.

Browser checks covered 1440×860, 375×667, 360×780, and 844×390. On iPhone SE,
selecting an adjacent card changed exclusive selection without spending an
action; its information control opened the real inspector, and Back restored
focus. Wide selection preserved the measured ground anchors and shared base
sprite scales. Compact landscape was too compressed then; the rails
arrangement below addresses it. Full drag/snapping,
all roster sizes, and all dependent screens still need browser verification.

Generated HTML was rebuilt with `node tools/launch.mjs --build-only`.
`verify-shipped` passed six checks and `buildversion --check` passed eight.
The first full Node run found two overlay coordinate writes that bypassed the
shared conversion helper. After converting them through `anchorLocalBox`, the
full Node rerun completed with exit code 0. Targeted zoom checks also pass.
Test logs and temporary images stay outside commits.

## Map: select, then Enter (classic act map)

Branch `feature/wireframe-map-bands`, based on dev `3c72a6df`. The owner
chose full W4b on both maps. This branch covers the classic act map, which
standard runs use; the world-journey atlas follows in its own branch.

- **Select, then Enter.** A tap on a lit node selects it; it no longer
  travels. Enter, or picking the selected node again, travels through the
  existing `enterNode` callback.
  - `src/ui/models/MapSelectionModel.js` owns the rule: an unreachable node
    is never selectable.
  - Keyboard and gamepad activation reach the same click path, so pressing
    confirm twice on a node also travels.
  - A repeat pick enters only once the selection has stood
    `wireframeUi.map.repeatPickDelayMs` (400 ms, kept by the owner on
    2026-09-13), so a fast
    double tap selects but never travels in one gesture.
- **Context band (WGM4).** Below the scene, the band shows the selected
  node's floor, kind, and description from the same `NODE_TYPES` table the
  legend and tooltip read. It adds a boss destination and the Sealstone Key
  reveal when they apply.
  - Under fog it shows the kind the board drew, never the hidden one. The
    board now passes its own reading with each pick.
  - The band has a fixed height, min(20% of the height, 8rem), and scrolls
    its own overflow, so a pick never shrinks the scene under the finger.
  - Without the board's reading a node reads as unknown; the hidden kind
    cannot leak through a caller that forgot to pass one.
- **Footer (WGM6, WGM7).** Recenter (the board's existing `resetFraming`)
  sits on the left and Enter on the right. Enter is disabled until a
  reachable node is selected and then names the kind.
- **Co-op.** The co-op map shares the board but keeps its own pick; nothing
  changes there.
- **Wording.** New text lives in `uiStrings.csv` (`map.*`).
- **Tools.** `tutorial-reach`, `offline-play-qa`, and
  `map-camera-persistence` now press Enter after selecting a node. The
  camera tool's self-test seam matches the board's new `onPick` call.
- **Camera.** The band and footer are built before the board mounts. The
  board checks a saved fit camera against the scene's height, so the bands
  must already take theirs, or every remount (Armoury, Continue) would drop
  the player's pan.
- **Selection mark.** A glow marks the selected node, because the pad
  cursor and hover both repaint the node's stroke.

Browser evidence (emulation, `?shot=map`):
- At 1280×800 one tap selected the lone reachable node, filled the band
  ("Floor 1 · Monster · A fight — cinders and a card reward."), enabled
  "Enter Monster", and stayed on the map. Enter opened combat.
- At 390×844 the second tap on the selected node opened combat.
- At both sizes the footer is in view and the page does not scroll. The map
  takes 58% of the height at 1280×800 and 66% at 390×844.

Limits:
- ~~The run HUD plus route strip still take about 17% rather than W4b's 10%
  header.~~ Superseded by *Map header: W4b's 10 vh* below: the header is now
  10% of the height, with a 52 px physical floor on short hosts.
- The zoom bar's ⊙ remains beside the footer's Recenter (the co-op map shares
  that bar).
## Combatant inspector

Branch `feature/wireframe-combatant-inspector`, based on dev `3c72a6df`.
W1w/W1p now have one DOM-free projection,
`src/ui/models/CombatantInspectorSections.js`, rendered by
`combatantDetailBody`. The door and the edge tray share it.

- The combat door is a two-column layout. The left preview is only sprite,
  name, and HP; it is a fresh still from the field's own asset functions,
  with no intent, defense, aura, or overlays. The right details take the
  rest of the width and are the only part that scrolls. The preview share is
  `wireframeUi.inspector.previewFraction` (0.38).
- Section order: Summary (HP, intent, defense), Current state, Previous
  actions newest first, Known abilities, Known traits, Lore last.
- Each section is `known`, `none`, or `unknown`, and the two empty
  states never share wording ("None." and "Unknown.").
- Previous actions come from `enemy.movesHistory` with the current intent's
  entry excluded. Traits are the enemy's tags. Lore is unknown because no
  enemy lore is authored yet.

Limits:
- No knowledge-filtering system exists for combatants yet, so everything
  the engine knows is shown. Weaknesses and resistances are not authored,
  so traits list tags only.
- The player's play history, traits, and lore are reported as unknown.
- The door's Close is still a primary button on this base; #1013 gives
  exits their own role.
## Main menu save preview

Branch `feature/wireframe-title-menu`, based on dev `3c72a6df`.

- **W3b.** With a save to continue, the title highlights Continue (gold) and
  shows that exact save beside the menu:
  - the class;
  - `slotFacts` (act, floor, HP);
  - "Slot n · Seed x".

  It reuses the save facts the slot doors already print. On narrow hosts the
  preview stacks below the menu. Only the menu list and the preview become
  columns; the wordmark stays centred on the screen. Continue keeps its
  `.title-menu .slot-continue` hook, so the default focus and the tools
  that click it are unchanged.
- **W3a.** With no save, the lone centred menu is unchanged and has no empty
  preview placeholder.
- **Strings.** The new wording is in `uiStrings.csv`
  (`title.save.eyebrow`, `title.save.identity`, `title.save.aria`).
- **W2.** Confirmations already match W2 through `openConfirmationModal`:
  - a question title and a close control;
  - the message plus a consequence details card;
  - Back on the left and an action-named primary on the right;
  - danger tone as an alert dialog.

  Only the Back button's exit role remains, and it belongs with #1013.

Browser evidence (emulation): the production `mountTitle` was mounted with
a fixture save (slot 1: Reaver, Act 2, Floor 5, 48/62 HP).
- At 1280×800 the menu and preview sit in two columns, Continue is
  highlighted and focused, the wordmark is within 2.3px of centre, and nothing
  overflows.
- At 390×844 the preview stacks below the menu in view.
- The no-save title keeps the centred menu with Continue disabled.

Limits:
- A real new climb could not be started on the preview origin (Begin stayed
  on character creation), so W3b was verified with a fixture save, not a
  played one.
- The menu order and labels differ from W3: this build has Load, New,
  Collection, and Download & saves where W3 shows New game, Load game, and
  Multiplayer. That is an owner decision; this branch does not change it.
## Rewards claim status

Branch `feature/wireframe-rewards`, based on dev `3c72a6df`. W1t's
`{Status}` and claim-status regions now come from one model function,
`rewardClaimStatus(plan, states)` in `src/model/rewardplan.js`, beside the
reward menu it describes.

- The reward door's head shows "{claimed} of {total} claimed", using the
  shared `modal-head-status` slot that the piles viewer uses.
- The body pairs the reward choices with a claim-status column. The column
  lists every row as Taken, Skipped, Full (blocked), or Available. When a
  card choice is still waiting, it adds "Required choice", an optional slot
  that collapses otherwise. The two columns sit side by side on wide hosts
  and stack on narrow hosts, as W1t specifies.
- The new wording lives in `uiStrings.csv` (`reward.status.claimed`,
  `reward.claim.heading`, `reward.state.available`,
  `reward.claim.required`).
- Select-then-confirm for card offers, and Back/primary footers, were
  already in place and are unchanged.

Browser evidence (emulation):
- At 1280×800 the columns sit side by side and the head reads "2 of 6
  claimed". After a card is chosen it reads "3 of 6 claimed" and the
  required-choice line disappears.
- At 390×844 the claim column stacks after the rewards with no horizontal
  scroll.

Limits: the reward door keeps its medium modal width over the battlefield
rather than W1t's 95vw frame, so each wide column is narrow. On Windows,
`tools/uistrings.mjs --check` reports 124 files as changed. The cause is
backslash versus forward-slash paths; the check is not run in CI.
## Combatant lower stack

Branch `feature/wireframe-combatant-stack`, based on dev `3c72a6df`. WCF2 now
has one pure plan, `src/ui/models/CombatantStackModel.js`, with values in
`wireframeUi.combatantStack`.

- Rows arrive already filtered by activity. Order: HP (always), other
  resources, buildup ranked by fill, stance, then the status-icon row.
- At most five rows. Stance and the icon row are reserved before optional
  bars. Buildup that does not fit becomes a ring pip in the icon row.
  Resources that do not fit stay readable in the inspector.
- `procDisplayPlan` uses this plan. It replaces the former fixed cap of two
  buildup bars, and arcane exposure counts as a resource row when it renders.
- The icon row never wraps. Its capacity comes from the configured 1.575rem
  tile plus its gap; a reference rem is at least 16 physical px, as in the
  hand and footer plans. When icons overflow, the last tile is `+N`. Where
  the combat screen registers the inspector, `+N` opens it with every
  effect. Co-op keeps its popover.

Browser evidence (emulation): at 390×844 an enemy with poise and three
buildup meters showed HP, poise, two buildup bars, and an icon row. The
third buildup became a ring pip. The player's `+N` opened the inspector
with all six added effects.

Limits: on narrow slots the contract tile size leaves room for few icons, so
`+N` carries most effects there. The player's evade chip and Dodge receipt
are ability chips outside this plan. WT0/WCT1 timing already runs through
one tooltip service whose default delay is 1s. It is not changed here.
## Control roles and appearance

Branch `feature/wireframe-control-roles`, based on dev
`3c72a6df`. COLOR-INTERACTION-CONTRACT §3 now has one resolver,
`src/ui/models/ControlAppearance.js`. It applies the contract's precedence:
absent, then unavailable/busy, then destructive, then exit, then primary, then
utility/selection. Registered exceptions are validated by name.

- The kit `button()` stamps `data-control-role`, derived from its weight
  (a danger class is destructive), or from an explicit `role`. A registered
  `exception` is stamped as `data-control-exception`.
- Close (both shell builders), Back, Cancel, and Leave carry the exit role.
  They stay brown/gold at rest and turn red under pointer, keyboard, or pad
  highlight. A sole exit in the modal primary slot no longer receives
  primary green.
- `combatEndTurn` exception: a legal early End Turn stays neutral at rest and
  turns green while highlighted. Spent actions still mark it ready. Legality is
  unchanged.
- The positive (ready) colours now live in one set of
  `--control-positive-*` tokens.

WGH1 needed no change. `HUD_REFERENCE_MAX` (200/20/20) scales each track by
maximum/reference; the fill is current/maximum; there is no minimum track
length; `balance.ui.hudBars.main.scaleByMax` is on.

Not in this task: the nine size presets (WCB0). Grid button rows resolve
percentages against their own tracks, so presets need a workspace migration
that consumes them. They were not added as unused tokens.
## Combat bands and packed footer

Branch `feature/wireframe-combat-footer`, based on dev `3c72a6df`. W4a band
sizes and the WGC6 footer come from one pure model,
`src/ui/models/CombatLayout.js`, with every value in `wireframeUi.combat`,
`wireframeUi.hand`, and `wireframeUi.footer`. `components/combatLayout.js`
measures the combat root and the footer's host band, then writes custom
properties. `kit.css` places them; its old literals remain only as first-paint
and co-op fallbacks.

- Bands: nominal 10/55/30/5; the hand keeps 208 px and the footer 56 px
  (physical, after `--ui-zoom`); the battlefield absorbs the difference.
  When the remainder cannot hold one readable combatant (minimum sprite plus
  detail reserve), the root carries `data-combat-geometry="unsupported"`.
  Stacked, 844×390 is unsupported; text and targets are not shrunk. The
  rails arrangement in "Compact landscape combat" now supports it.
- Footer: one centered, gap-first grid. Actions and Potions share one circle
  at 95% of footer height, capped at 20% of the width; End Turn shares that
  height up to 40%; Draw and Discard use up to 10%.
- Resolved conflict: on narrow hosts the 10% pile envelope is smaller than
  the 44 px target and the two-line Discard/Exhaust face. The target and the
  `pileMinimumRem: 4` readable floor win; End Turn gives up width. The floor
  uses the same reference rem as the hand (at least 16 physical px), so it is
  64 physical px, not CSS 4rem, and does not follow the text-size setting.
  The owner confirmed this floor on 2026-09-13.
  Below about 290 px physical the floors cannot all fit; the footer reports
  `data-footer-geometry="unsupported"` and keeps the unpacked layout.

Browser evidence (emulation, animations finished):
- 1440×860: circles 53.2 px, piles 142.7 px, End Turn 570.7 px, centered.
- 375×667 and 360×780: piles hold their content without overflow; every
  footer target is at least 44 px; no overlap with the hand or viewport.
- A live resize from 375×667 to 360×780 re-planned the bands and tracks
  without remounting.

Limits: compact landscape needed an owner decision; the owner asked for it
to be supported, and "Compact landscape combat" records the result.
`tools/combat-action-row.mjs`, which is not in
CI, still describes edge-anchored Actions and Potions. The packed-centered
WGC6 contract supersedes that and the tool needs updating. The hidden
preview pane throttles animation frames, so measurements were taken after
forcing a render.

## Identity and artwork (WCI0–WCI3)

Branch `feature/wireframe-identity`, based on dev `d2ea5bcd`. The rules the
three identity parts share live in one pure model,
`src/ui/models/IdentityModel.js`, with values in `wireframeUi.identity`.
Cards, combatants and the inspector preview stamp `data-identity-part`
(`name`, `artwork`, `metadata`) on the parts they own; the values stay with
the owner.

- **WCI3 metadata band.** `metadataFooter` puts rarity at the start and
  "Owned: n" at the end (`identity.metadataSlots`). A fact the surface cannot
  state is absent, never a blank label or an invented zero. Offers pass the
  run's deck count: reward cards, shop cards and weapon arts, and the draft
  (its picks so far). Deck, pile and hand views pass none, so their band
  shows rarity alone. No action enters the band. The wording is
  `card.meta.owned` in `uiStrings.csv`.
- **WCI2 artwork.** `artworkAnchor(host)`: cards and the inspector preview
  centre their artwork; combatants stand it on the baseline. Artwork is
  contained at its intrinsic ratio. Facing still mirrors only the `.facing`
  art layer, and no text, meter or badge lives inside it.
- **WCI1 nameplate.** The card header, the combatant nameplate and the
  inspector preview title are the name parts. The combatant nameplate is the
  card child directly above the meters, HP first.

Browser evidence (emulation, `?shot=shop` and `?shot=combat`, 1280×800 and
390×844):
- Shop cards: rarity starts 3.9 px (3.3 px on the phone) from the band's
  left edge, and "Owned: 0" ends the same distance from its right. The band
  is 9.9% of the card height, against the wireframe's 10%. Nothing overflows.
- Combat: with each combatant selected, its nameplate sits 3 px (the meter
  gap) above the HP row, for the player and both enemies at both sizes.

Limits:
- Equipment cards were WC2's; the section below moves them onto the same
  metadata band.
- Co-op reward and shop offers do not pass an owned count.
- Unselected combatants hide their names in formation (the selected-only
  default, kept by #1029), so adjacency was measured with each one selected.

## Possession cards (WC2, WC2a, WC2b, WC2c)

Branch `feature/wireframe-possession-card`, stacked on
`feature/wireframe-identity` (#1036). Equipment, relic and potion cards share
one poker canvas (`equipmentCard.js`, with `collectibleCard.js` supplying
relic and potion presentations). That canvas now follows WC2 and WC2a:

- **Footer:** metadata only, built by WCI3's `metadataFooter`. Rarity starts
  the band; "Owned: n" ends it when the host knows the count. The requirement
  no longer sits there.
- **Body row one, "Slot / requirements":** the type band shows the slot or
  type label, then the requirement (for example "Weapon · Blade · Requires
  STR 10"). Both keep their own tooltips and shrink with an ellipsis rather
  than overflow.
- **Owned counts:** the Armoury inventory passes each row's `count`, and the
  Smith's candidates pass `inventoryCount`. Creation, shop, reward and preview
  hosts pass none, so the band shows rarity alone.

Browser evidence (emulation, `item-cards-preview.html`, 1280×800 and
390×844):
- All 103 equipment, relic and potion cards start the footer with rarity. No
  footer overflows, and no type band clips.
- An armament rendered with `owned: 2` ends the band with "Owned: 2", flush
  with the right edge.

Limits:
- WC2a's "Equipped comparison" row is not built.
- The weapon/armour and relic/consumable sub-variants (WC2a1–WC2c3) share
  this canvas; their own rows are not added.
## Selection effect (WCF0, WCF1, WCF3)

Branch `feature/wireframe-selection-effect`, based on dev `d2ea5bcd`. WCF3's
one shared glow and the reveal delay come from one pure model,
`src/ui/models/SelectionEffectModel.js`, with values in
`wireframeUi.selection` (`glowRem: 0.35`, `revealDelayMs: 1000`).

- **One glow per owner.** `main.js` writes `selectionGlowFilter()` to `:root`
  as `--selection-glow`: a gold `drop-shadow` whose radius is 0.35 reference
  rems (at least 16 physical px each, as in the hand and footer plans), not
  the game's 10 px root.
  - A selected card wears it as a filter, so its inspect control, a child,
    glows with it. The hand moves that control into an overlay, so the portal
    wears the same filter.
  - A selected combatant wears it on its whole `.combatant-stack`: intent,
    the delayed inspect control, art, name and the lower stack.
- **No per-child marks.** These are removed:
  - the combatant card's own drop-shadow;
  - the card's 3 px `inspection-selected` outline;
  - the `.card.selected` glow box-shadow;
  - the hand's parchment outline;
  - the mount list's outline.

  Elevation shadows and the gold border stay; they are not glow.
- **One reveal delay.** `selection.revealDelayMs` replaces
  `wireframeUi.card.inspectDelayMs` and the equipment card's own
  `balance.ui…info.revealDelayMs`. Card inspection, equipment cards and
  combatant inspection all read it.
- **WCF1.** `ComponentModel.js` already validates and freezes component
  records. Owner selection is the only selected state: the card selection
  store for cards, and `context-selected` for combatants.

Browser evidence (emulation, `?shot=combat`, 1280×800 at UI zoom 1.07 and
390×844 at 0.9):
- The glow radius resolves to 5.23 local px at zoom 1.07 and 6.22 at 0.9.
  Both are 5.6 physical px, 0.35 reference rems. At the game's 10 px root, a
  plain `0.35rem` would have given 3.5 px.
- A selected enemy's stack carries the one gold drop-shadow. Its card has no
  filter, and no other gold glow exists inside the stack. Its inspect control
  is inside the glow and appears after the delay.
- A selected hand card and its portalled inspect control both carry the same
  filter, with no outline.

Limits:
- The reward door's green "chosen" highlight is a separate state tied to
  Confirm and stays as it is.
- The creation selectors keep their corner inspect control (contested in
  #994/#996).
- The inspect control's own size and label are WCB1's (next section).

## Inspect control (WCB1)

Branch `feature/wireframe-inspect-control`, stacked on
`feature/wireframe-selection-effect` (#1037). One control for every
selectable card, combatant and inventory tile, from
`src/ui/models/InspectControlModel.js` with values in `wireframeUi.inspect`
(`sizeRem: 2.75`, `labelPx: 16`, `gapPx: 10`).

- `main.js` writes `--inspect-size` (2.75 reference rems, a 44 physical px
  target), `--inspect-label` (16 physical px) and `--inspect-gap` (10
  physical px) to `:root`.
- The card, equipment card, combatant and hand-portal controls all read
  them. Removed:
  - the combatant's 36 px override;
  - the card's tap-floor size;
  - the equipment card's raw 44 CSS px (and `balance.ui…info.sizePx`);
  - the 20 px label.
- The hand overlay places its portal `inspectControlRisePx()` (size + gap)
  above the card instead of a hard-coded 48 px.
- The reveal still waits `selection.revealDelayMs`. The combatant control
  stays above the intent, centred on the sprite.

Browser evidence (emulation, 1280×800 at UI zoom 1.07 and 390×844 at 0.9):
- **Combatant control:** 44×44 physical px with a 16 px label, 4 px above the
  intent, horizontally centred on the sprite art (offset 0).
- **Hand portal:** 44×44 with a 16 px label, 10 px above the selected card,
  centred on it.
- **Equipment card control** (`item-cards-preview.html`): 44×44 with a 16 px
  label, 10 px above the card, centred.

Limits: the creation selectors still declare a 32 px corner control through
`--card-info-size` (contested in #994/#996).
## Button size presets

Branch `feature/wireframe-button-sizes`, based on dev `d2ea5bcd`; issue #1042.
The nine WCB0 sizes that the control-roles task left out now have one config
block, `wireframeUi.buttons` (a mirror of `button-widths.json`), and one pure
plan, `src/ui/models/ButtonSizeModel.js`. The kit writes the model's tokens
onto `:root`, and `kit.css` only combines them. The two consumers below read
the tokens, so none of them is declared and unused.

- A size ID is width × height: {third 30%, half 50%, full 100%} ×
  {standard, tall, double}. Heights are 2.75 reference rem × 1, 1.5 or 2. A
  reference rem is at least 16 physical px, the same unit as the hand and
  footer plans. Unknown sizes, groups or counts throw.
- The kit `button({ size })` stamps `data-button-size`, which sets the
  height. The width belongs to the group that owns the action region.
- Every `modalFooter` plans a `footer` group. That covers the confirmation
  door and every `openModal` and `pageDoor` foot. Siblings take equal shares
  after the shared gap, and a sole action fills the foot. Its buttons are
  `full-standard` of their share. The gap is now 0.5 reference rem (8
  physical px); before, it was 0.5 CSS rem (5 px at the 10 px root).
- The new `choiceRow()` gives every sibling one size (`half-standard` by
  default). Each width is the preset capped by the equal share after gaps, so
  a longer label never widens its button, and on narrow hosts labels wrap. A
  sole choice keeps its preset, but never below the 8 rem readable minimum
  and never wider than the host. The game-over door's "Run history / Return
  to title" row is the first consumer; it replaces a `medium` ladder row.
- The quarter preset stays in the config and the model but writes no token,
  because nothing consumes it yet. The icon size matches the existing exit
  square: `--iconbtn-size` is the tap floor, and its default of 44 equals
  2.75 × 16. A test holds that agreement. Header exits, steppers, inspect,
  map nodes, status icons and the packed WGC6 footer are unchanged.
- `tests/wireframe-button-sizes.test.mjs` checks four things: that the
  config matches `button-widths.json`, the size and group arithmetic, that
  `kit.css` reads every token the model writes, and that it reads nothing
  undefined.

Browser evidence (emulation, source tree; CSS px after layout, compared with
`resolveButtonGroupWidths` for the measured host):
- 1440×860 (zoom 1.18): the game-over row is 518 px, so each of the two half
  choices resolves to its 255.6 px share (half would be 259). The
  confirmation foot is 400 px, giving two 196.6 px shares. The detail door's
  sole Close fills its 540 px foot. Heights are 37.3 px (44 physical px) and
  gaps are 8 physical px.
- 390×844 (zoom 0.9) and 375×667 (zoom 0.85): the same rules hold on hosts of
  341 and 395 px, and of 349 and 403 px. Every button is 44 physical px tall.
  No label overflows its button, and nothing scrolls horizontally.
- Primary buttons measure about 3 px wider, but only in
  `getBoundingClientRect`. The difference is their existing lift
  (`scale: 1.015`, `translate: 0 -2px`); their layout boxes (`offsetWidth`)
  equal their siblings'.

Limits:
- Footer labels still never wrap. The shell's containment recipe
  (`white-space: nowrap`, then ellipsis) is asserted by
  `tools/modal-shell-contract.mjs` and follows the owner's 2026-09-03 rule "a
  label never wraps". That conflicts with the specification's "narrow hosts
  wrap labels". On this branch choice rows wrap and footers do not; that is
  an owner decision.
- The creation foot (`.cz-actions`) keeps its ladder-capped width once Begin
  is ready. Other ladder rows (`buttonRow` short, medium, long, fill) are not
  migrated.
- Galaxy S24 (360×780) was not measured. The Playwright-based QA tools could
  not run here, because there are no node_modules.
- `tools/modal-shell-contract.mjs` reports 58 passed and 2 failed on both dev
  `d2ea5bcd` and this branch. The two failures are "the footer appends every
  way back before the one way forward" and "no rule reorders or re-spans the
  foot primary". Both predate this branch and are unchanged by it.
## Combatant meters (WCM0–WCM4)

Branch `feature/wireframe-meters`, based on dev `d2ea5bcd`, issue #1028.
`src/ui/models/CombatantMeterModel.js` owns the row geometry and which rows
wait for selection, from `wireframeUi.combatantMeters`. The combat layout
adapter writes the geometry as CSS variables beside the band and footer plans.

- WCM1 Health: at least max(0.85rem, 14 physical px), carrying the compact
  current/maximum at 12 physical px. The full accessible label is kept.
- WCM2 Resource and WCM3 Buildup: half the HP height, at least 0.45rem. A row
  that short cannot hold 12 px text, so its exact values live in its tooltip
  and the inspector. Buildup keeps its glyph nub.
- WCM4 Stance: the stance chip is a strip the size of HP, after the buildup
  rows and before the status icons.
- One shared gap between rows.
- Selection: unselected combatants show sprite, HP, block, intent, status
  icons, aura, buffs and shadow. Name, secondary resources, buildup and stance
  appear only while selected (`selectedOnly`; empty it to show every row).
  HP never waits. Co-op keeps its own name-only rule.
- The minimums hold after perspective scaling: the depth scale zooms only the
  sprite, never the information rows.

Behaviour change to confirm: enemy poise and buildup, and the player's
stance, no longer show until that combatant is selected.
## Combat overlays (WCO0–WCO3)

Branch `feature/wireframe-overlays`, based on dev `d2ea5bcd`, issue #1030.
`src/ui/models/CombatOverlayModel.js` owns intent visibility and the guard
badge's geometry from `wireframeUi.overlay`. The combat layout adapter writes
them as CSS variables, and the stylesheet reads them rather than hard-coding
the numbers. The unused `formation.guardAnchor` / `guardGapRem` values are
replaced by `overlay.defenseAnchorByRole` and `overlay.defenseGapRem`.

- WCO1 Intent: above the sprite, below Inspect, at least 2.8rem tall, with a
  value font of at least 13.2 physical px. `overlay.intentVisibleByRole`
  decides it per role: enemies show it; the player has no intent to show.
- WCO2 Guard badge: outside the sprite by 0.5rem, player upper-right at 12%
  of sprite height and enemy lower-left at 88% (CURRENT-SPECIFICATION's
  accepted guard geometry, which supersedes the earlier 50% rule). At least
  3.5rem, a 13.2 physical px value, never mirrored.
- WCO3 Aura: the stance aura spans the sprite's own bounds (it previously
  overflowed them by 7–24%) and paints behind the artwork. It stays input
  transparent.
- WCO4 Buff layer: not built. No buff visuals exist to fill a front layer.

Defect fixed on the way: on dev the guard badge sat inside the zoomed sprite
host, inherited its zoom, and stayed in the host's flex row. On a phone the
player's badge was about 8 px wide with a roughly 3 px number, and every
badge floated far from its sprite. The battlefield stage now publishes the
sprite's zoom and the drawn art's box. The badge counter-zooms, is absolutely
positioned, and anchors to that box.

Browser evidence (headless Chrome, `?shot=combat`, block set on every
combatant), measured against the drawn art:

| Shape | Role | Side | Gap | Centre | Smallest side | Value font |
|---|---|---|---|---|---|---|
| 1365×1000 | player | right | 7.9 px | 0.120 | 56 px | 13.7 px |
| 1365×1000 | enemy | left | 7.9 px | 0.880 | 56 px | 13.7 px |
| 390×844 | player | right | 7.9 px | 0.121 | 56 px | 13.2 px |
| 390×844 | enemy | left | 8.0 px | 0.879 | 56 px | 13.2 px |

The stance aura's box equals its pose stage in both shapes, at z-index −1.
## Compact landscape combat

Branch `feature/wireframe-compact-landscape`, based on dev `d2ea5bcd`. The
owner asked that 844×390 be supported, using the HTML reference.
`allocateCombatBands` in `src/ui/models/CombatLayout.js` now takes the host
width. When the stacked W4a plan cannot hold one readable combatant, it tries
a rails arrangement. `wireframeUi.combat.shortHostRails` switches it.

- Rails: the footer row goes. The same WGC6 grid overlays the hand band and
  wraps the hand: (Actions)[Draw] on the leading rail, [End Turn] over
  [Discard](Potions) on the trailing rail. Order, the lower row's shared
  baseline, and sizes match the packed row on a minimum footer: circles at
  95% of the 56 px footer minimum, piles at the 44 px target and 64 px
  readable floor. `packCombatRails` owns every number.
- Hand: keeps its 208 px minimum when it can. It yields to the battlefield
  only down to one whole 5rem card with its lift, arc, and insets
  (`minimumHandHeight`, 161.6 physical px). `handLayout` still sizes cards,
  text, and exposed touch widths.
- Supported only if the battlefield then holds the minimum sprite plus detail
  reserve and the hand between the rails exposes five minimum cards at 44 px.
  Otherwise the root keeps `data-combat-geometry="unsupported"`: 844×330, or a
  440 px wide short host, which stays stacked.
- Stacked hosts plan exactly as before. A test compares plans with and
  without width at 1440×860, 1280×800, 390×844, 375×667, and 360×780.
- Why rails: stacked needs 39 (HUD) + 148 (one combatant) + 56 (footer) + 162
  (one minimum card) = 405 px against 390, before the 208 px hand minimum.
  Moving the footer beside the hand frees 56 px of height and uses spare
  width. The reference's (A)[D][END TURN][E](P) order, sizes, and baseline
  survive; only the row wraps. Rotation or scrolling would not be "supported
  without page scrolling".

Browser evidence (emulation, `?shot=combat`, reduced motion):
- 844×390 (zoom 0.62, short-wide): rails, supported. HUD 39, battlefield 148,
  hand 597×203 px, cards 113×174, sprites 54 px visible (dev: battlefield 87,
  sprites 44). Circles 53.2 px, piles 64×44, End Turn 120×53. Every control
  and all five card lanes hit-test to themselves; no page scroll or overlap.
  A tap selected a card and its inspect control stayed reachable above it.
  Slashing Strike took an enemy from 16 to 9 HP; a held End Turn reached
  turn 2. Rotating to 390×844 re-planned stacked, and back to rails, without
  remounting.
- 915×412: rails, battlefield 163, hand 668×208.
- 740×360 and 667×375: rails plans are supported (battlefield 148, hands 176
  and 190 high). By default the upright gate still covers both
  (`data-short="true"`; under 1200 local px wide). With Short-screen warning
  off the board shows whole.
- 1440×860, 1280×800, 390×844, 375×667, 360×780: band, card, and control
  measurements identical to dev.
- Map (`?shot=map`) and reward (`?shot=reward`) at 844×390: no page scroll.
  The reward door fits; its rewards column scrolls inside. The map scene
  band is only about 110 px tall.
- `hudparity` reports the same 9 findings at 844×340 as dev (HUD top row,
  metadata priority, vertical lines; three poses).

Limits: at 844×390 the battlefield gets exactly its configured minimum, so
sprites stay small; more battlefield means smaller cards, an owner call. The
gate at 740×360 and 667×375 is a separate measured decision (`gateBelowH`,
`shortWideMinH`). Playwright QA tools could not run here. The intents under
the HUD band and the missing notch margins are fixed; see "Compact landscape:
HUD headroom and notch margins". The formation's leading reserve is still a
quarter of the field, so on these hosts the intent now comes down over the
top of the sprite.
## Map header: W4b's 10 vh

Branch `feature/wireframe-map-header`, based on dev `d2ea5bcd`. The owner
chose "10 vh for w4b", with the HTML reference as the guide. This applies it
to the classic act map. The run HUD and the route strip now share one band of
10% of the visible height, and the map scene gains the rest.

- **A HUD context, not a new HUD.** `runHudHtml` and `RunHudViewModel` accept
  `layout: 'map-compact'` and `orientationHtml`. The map passes both; the
  route strip is laid out inside the band. Combat, the merchant, the Shrine
  and events pass neither, and their markup is unchanged.
- **Sizing (WGH0).** `src/ui/models/MapHeaderLayout.js` is a DOM-free model
  over `wireframeUi.map.header`. The band is `max(10% of the visible height,
  tap row + 2 × 4 px)`. The tap row is the player's `--tap-target` (44 px by
  default), so the floor is 52 px physical. The model also picks the
  composition:
  - wide (640 px and over): route | facts over meters | Armoury · Menu;
  - narrow: facts, meters and route as three lines beside the controls.
    A narrow band too short for three lines drops the route line.
  `src/ui/components/mapHeader.js` writes the answer as custom properties.
  `styles/kit.css` § MAP HEADER converts them through `--ui-zoom`.
- **Fit (WGH4).** HP, MP and SP sit side by side on one meter line. The fact
  line keeps three tracks, so Cinders stays centred. The class name and the
  act's seat name ellipsize within their track, because the route strip
  carries the act's full name. On narrow hosts the route's "Entrance" label
  yields; its title stands at the rail's start.
- **Readable minimums.** Header text has a 10 px physical floor. On dev,
  route labels fell to 5.6 px at 844×390. Armoury and Menu stay 44 × 44.
- **Camera.** `sizeMapHeader` runs before the board mounts, and again on
  every resize ahead of the camera. The scene height is final when the board
  checks a saved fit camera, so a pan survives the Armoury remount.
- **Atlas.** The world-journey atlas (#1027) draws its own `.atlas-header`.
  To adopt the band, it would draw `runHudHtml({ …, layout: MAP_HEADER_LAYOUT,
  orientationHtml })` and call `sizeMapHeader(app)` before its board mounts
  and on resize. This branch does not touch the atlas's files.

Browser evidence (CDP emulation, `?shot=map&shotSeed=SHOWCASE`; header is
the run HUD including the route strip, before → after):

| Viewport | Header | Map scene | Smallest header target | Page scrolls |
|---|---|---|---|---|
| 1280×800 | 137.5 px (17.2%) → 80 px (10%) | 51.7% → 58.9% | 44 px | no |
| 1440×860 | 150 px (17.4%) → 86 px (10%) | 52.3% → 59.7% | 44 px | no |
| 390×844 | 147 px (17.4%) → 84.4 px (10%) | 61.2% → 68.6% | 44 px | no |
| 375×667 | 141.4 px (21.2%) → 66.7 px (10%) | 52.5% → 63.7% | 44 px | no |
| 844×390 | 101.8 px (26.1%) → 52 px (13.3%, floor) | 22.6% → 35.4% | 44 px | no |

- The footer is in view at every size. No header text overlaps another cell.
- After a wheel pan, the Armoury remount restored the camera exactly at four
  sizes. At 844×390 it drifted 19 px, the same drift dev shows there.

Limits:
- At 844×390, 10 vh (39 px) is shorter than one 44 px tap row, so the band
  takes the 52 px floor. That exception is deliberate.
- On narrow hosts each meter's trough is short. The trough keeps its exact
  max/reference length and is never floored.
- Not measured: Text size XL, a raised tap size, and real devices.
  `tools/map-camera-persistence.mjs --entry AshenSpire.html` passes its
  remount cases, then stalls at its known Save & Quit flush case, as on dev.
- `tools/ui-components.mjs` C12 pins an older `actRouteStripHtml({ title:
  actTitle(run.actNumber) })` call that dev had already changed. It is not in
  the suite and is left as it was.
## Pile viewer and inspection doors (W1h, W1o)

Branch `feature/wireframe-inspection-bodies`, based on dev `d2ea5bcd`.

- **W1h Discard / Exhaust viewer.** The piles are W1 categories, so they now
  sit on the kit's rail (`railed` / `rail` / `railItem`) instead of tabs
  across the head; compact hosts put the rail above the pane.
  - The pane shows the pile's cards beside the reading of the selected card.
    `cardDetailHtml` supplies that reading: the same body the card's inspect
    door and tooltip use. Selecting a card (its first tap) moves the reading;
    before any selection it shows the pile's first card.
  - A single Close ends the viewer, and the title is "Card piles".
  - `src/ui/models/PileViewerModel.js` (`spentPileView`) projects the rail
    labels, counts, empty state and reading; four node:tests cover it.
  - The rail items keep `role=tab`, `aria-selected` and `data-modal-tab`,
    so the HUD tools that click the pile tabs still find them.
- **W1o item inspection.** The card inspection door no longer adds a footer
  Back beside the header close it duplicated. The footer holds only
  applicable actions, and one fills it. A read-only door has no footer at
  all, which is what the door's own comment already promised.

Browser evidence (emulation, `?shot=combat` with seeded piles, 1280×800 and
390×844):
- Desktop: the rail is 185 px on the left, and the collection and the reading
  are two equal 370 px columns. Phone: the rail is a row above, with the
  collection and then the reading below it.
- The reading starts on the first card, "Slashing Strike". Selecting "Shield
  Strike" moves the reading to it. Exhaust shows its one card and that card's
  reading.
- Close is the only footer button, and the page does not scroll.
- A hand card's read-only inspection door has no footer and no Back; its
  header close remains.

Limits:
- The draw-pile viewer (`openPileModal`) stays a single collection with its
  count; it has no categories.
- W1q potion inspection (charges, eligibility, "Use if legal") lives in the
  flask menu and is not changed here.
## Potion inspection (W1q)

Branch `feature/wireframe-potion-inspection`, based on dev `d2ea5bcd`. The
flask inspect door (`openFlaskInspectModal`) now follows W1q. A pure view,
`src/ui/models/PotionInspectionModel.js` (`potionInspectionView`), decides
what it shows, with three node:tests.

- **Body:** the art sits beside the effect and the remaining charges, as
  before. When the potion cannot be used here, the door states why: the Use
  row's own refusal from the host's `flaskActionPlan`. An enabled Use needs no
  caption.
- **Footer:** Use is the one action whenever the host's plan offers it. It is
  disabled, with the reason as its title, when refused. The footer Close is
  gone; the header close is the way out.
- **Commit path:** the flask menu passes its Use row into the door. Pressing
  the door's Use rings the host's own `onAction('use')`, the same call the
  menu row makes, and each host re-checks there. No caller wraps flask
  actions, so no confirmation is bypassed. Reading alone rings nothing.

Browser evidence (emulation, `?shot=map`, the run HUD's Crimson Flask,
1280×800 and 390×844):
- The door reads "Crimson Flask", with "3 charges remaining.".
- With "Use flasks outside combat" off, the footer holds only a disabled
  "Use" titled "Enable 'Use flasks outside combat' in Settings", and the body
  states the same eligibility line.
- There is no footer Close; the header close remains.

Limits:
- Capacity is not shown: flask definitions carry no capacity field.
- The enabled-Use path is covered by the unit test and the host's own
  revalidation, not measured in the browser.
- Combat's potions menu (WGC11) builds its own flask plan and does not open
  this door.
## Inspector side-tray meters

Branch `fix/inspector-tray-meters`, based on dev `d2ea5bcd`. Owner-approved
follow-up: restore the HP/MP/Poise meters in the inspector's side tray.

- Root cause: `52bc33db` swapped the detail body's pool meters
  (`resourceMeters(subject.resources)`) for the ordered text sections. After
  that the door's left column kept one HP meter under the sprite and nothing
  else. The old edge Folding Tray has not been mounted by combat since
  `2ba87601`, so the door's side column is the side tray.
- `CombatantInspectorSections.js` now projects `preview.meters`: HP, MP,
  Poise in that order, taken from the live subject. MP and Poise appear only
  when the combatant has the pool (max > 0), and Block never appears there.
  The preview still names the sprite and HP as before.
- `combatantInspectorPreview` renders the rows with the existing
  `resourceMeters`, the stacked kit Meters the tray used for its pools, so
  there is no second meter renderer. The details pane is unchanged.
- This supersedes the W1w line "left contains only sprite/name/HP" for
  resource meters only. Intent, defense, aura and status overlays still stay
  out of the preview.

Browser evidence (headless Chrome, `?shot=combat-test&build=caster`):
- 1280×800 and 390×844: the player door shows HP 80 / 80 and MP 3 / 3, with
  no Poise meter because the player's poise max is 0. The enemy door shows
  HP 55 / 55 and Poise 0 / 18, with no MP meter. Values match the live
  combatant, the preview fits the door, and nothing scrolls sideways. 20/20
  probe checks passed, with no page errors.

Limits: the co-op door renders only the detail body (no preview column), so
it does not gain meters. The door is a snapshot taken when it opens; it does
not redraw meters while it stays open.
## Map node: selection glow only

Branch `fix/map-node-tooltip-outline`, based on dev `d2ea5bcd`.
Owner-approved follow-up: remove the tooltip's gold outline beside the
selection glow on map nodes.

- Root cause: a press on a node also runs the shared tooltip's
  tap-to-select (`explainOnSecondTap` in `tooltip.js`), which marks the node
  `.tooltip-selected`. Then `kit.css` draws
  `.tooltip-selected:not(.overhead-control)` as a 2px gold rounded box
  beside the map's own `.selected` stroke and glow. It is not the pad cursor
  and not the open-tooltip ring, although `[data-tip-open]` (1px gold at
  0.45 alpha) can land on a node the same way.
- `styles/map.css`: `g.map-node.tooltip-selected,
  g.map-node[data-tip-open="true"] { outline: none; }`. The `g.` is needed
  because the kit rule has the same specificity and loads later. Only map
  nodes change, and every other tooltip target keeps the kit outline.
- What keyboard and pad users keep:
  - The `.gp-focus` cursor keeps its focus ring and its 4px gold circle
    stroke (`ui.css`).
  - `.selected` keeps its stroke and drop-shadow glow.
  - Reachable nodes keep the pulsing halo.

Browser evidence (headless Chrome, `?shot=map`, 1280×800 and 390×844):
- After a press, the selected node computes `outline-style: none`, with the
  tooltip open on the phone. The glow `drop-shadow(0 0 5px parchment)` and
  the 4px stroke remain.
- A control run that re-injects the old rule draws the solid gold box.
- A top-bar tooltip target still computes the kit's 0.45-alpha gold
  outline.
- Arrow keys still land the cursor on a node, with its ring and gold
  stroke.
- 20/20 probe checks passed, with no page errors.

Limits: a keyboard or pad user whose cursor rests on the selected node
still sees the `.gp-focus` ring beside the glow. It is kept on purpose as
the focus indication; the owner can ask to drop it.
## Compendium and Profile workspaces

Branch `feature/wireframe-compendium-profile`, based on dev `d2ea5bcd`. W1f
and W1g are now the W1 workspace: a header title with its exit, a category
rail on wide hosts, an active pane in two slots, and one footer action. The
frame shares (95% × 90% of the visible viewport, a 21.6vw rail held between
11 and 24 rem, 2vw and 2vh slot gaps) are `wireframeUi.workspace`, written as
custom properties by `components/w1Workspace.js` and read by one
`.w1-workspace` block in `kit.css`.

- W1f: `mountCompendium` is a page door titled Compendium, with the held count
  as its eyebrow. The armament kinds stay on the rail with their counts. The
  pane holds the entry list beside the selected entry's known facts.
  `CompendiumModel.entryDetail` withholds the name (unless listed), mods and
  tags exactly as the tooltip does. A cell click now selects; the tooltips
  remain.
- W1g: the Profile door's categories are the two kinds of entry the drawer
  holds (set-aside profiles, set-aside runs), the only groups `save.js`
  writes. The current profile's identity sits beside the selected category's
  records. Export, restore and its confirmation, the status line and the
  drawer notice are unchanged. `ProfileWorkspaceModel` picks the first
  non-empty category and says whether the whole drawer or only this category
  is empty.
- Compact hosts put the navigation above the pane as one `[Kind ▾]` selector.
  It opens the same rail as a list under it; rule 11 rules out horizontal tabs
  and accordions. While the list is open the pane is hidden. Escape closes the
  list, not the door. The two slots stack.
- Keys and the pad stay with `input.js`: arrows or the d-pad move the cursor,
  and Enter or A selects a category. Home and End jump to the ends.
  Programmatic focus goes through `focusElement`. Rail items keep `role=tab`
  and `aria-selected`.
- New copy lives in `uiStrings.csv` (`compendium.*`, `profile.*`).
  `compendium.js` holds no literal copy now; the uistrings baseline records
  it as migrated (461 → 456 sites).

Browser evidence (Chrome, CDP emulation, `?shot=compendium` and
`?shot=profile`):
- 1440×860: frame 1368×774; rail 282 px; pane slots 500 and 501 px.
- 1280×800: frame 1216×720; rail 256 px; pane slots 441 px each.
- 390×844 and 375×667: selector 351 and 337 px wide, 44 px tall; slots
  stacked at 270 and 194 px each.
- 844×390 (wide layout): frame 802×351; rail 148 px; slots 298 px each.
- At every size: no document or screen scroll, every visible target at least
  44 px, and no duplicate headings. The footer holds one Back spanning the
  usable width, with the exit in the header corner.
- Keyboard: arrow then Enter changed the category; Home and End jumped. On
  compact, Enter opened the list, ArrowDown and Enter picked, and Escape
  closed only the list.
- The CDP profile tools do not reach W1g on this machine, on dev `d2ea5bcd`
  and on this branch alike, so they are no evidence either way.
  `profile-surface-drive.mjs` and `restore-settings-drive.mjs` stop at a null
  `.click()` before any profile screen. `profile-first-run.mjs` reports 0/6
  on both.

Limits: Galaxy S24 (360×780) was not measured. Playwright tools
(`tooltip-review-qa.mjs`, `screenshot.mjs`) were not run. The kit's global
narrow rule still lays other screens' rails out as a horizontal strip, which
rule 11 forbids; that is outside this change. W1g does not bind the
Overview/History/Discoveries/Progression categories from the gallery example,
because History and Compendium are separate title routes; this needs an owner
decision. `?shot=compendium&shotFound=…` shows 0 held on dev and on this
branch alike.

## Rest and Event choice body

Branch `feature/wireframe-rest-event`, based on dev `d2ea5bcd`. W1s (Rest) and
W1u (Event) now stand in one W1 frame, `src/ui/components/choiceBody.js`,
under the run HUD. Its shares live in `wireframeUi.choiceBody`.
`src/ui/models/ChoiceBodyModel.js` turns them into zoom-divided viewport
lengths and projects each screen's `{Status}`
(`tests/wireframe-choice-body.test.mjs`).

- **Frame.** A head (eyebrow, title, `{Status}`), a body that alone scrolls,
  and a foot when the surface has a continuation. It is 95% of the viewport
  wide; its height is what the HUD leaves, capped at 90%. The two body slots
  sit side by side on wide hosts and stack on narrow ones (`data-layout`). No
  close control: the head's close is removed rather than built and hidden.
- **Rest (W1s).** The title is the Shrine's name under the eyebrow "Rest"; the
  flavour subtitle is gone. The option cards are unchanged and fill the first
  slot. The second holds the arrival refill sentence and an Availability list
  (Available, Unavailable, Rested) from `restChoiceStatus`, read off the same
  plans that build the cards. The head reads "{available} of {total}
  available".
  - Multi-use's LEAVE THE SHRINE is now the foot's single Continue.
  - A single-use Shrine still has no foot, because taking a choice is its
    way on.
- **Event (W1u).** The title is the event's name. `{Status}` reads "Choose a
  response", then "{available} of {total} available" when a price closes a
  response, then "Resolved" (`eventResponseStatus`).
  - The narrative (art and authored prose) is the first slot and the
    responses the second. The result sentence replaces the responses, as
    before.
  - Continue is in the foot from the start, disabled until a response is
    taken, and reads "Steel yourself" when the response starts a fight.
  - Cost and consequence stay in the authored labels; "Cannot afford" is
    unchanged.
- **Unchanged.** Every option and what it does, the hold/confirm beats
  (`beatArmer`), `data-binding` and `data-requires`, and the hooks the tools
  read (`#rest-opt`, `#smith-opt`, `#level-opt`, `#flask-reallocate`,
  `#choices`, `.ev-choice`, the shrine card tokens on `.screen`).
- **Wording.** New `uiStrings.csv` rows `rest.*` and `event.*`.
- **Tools.** `tools/screenreach.mjs` now finds Shrine cards as descendants of
  the screen, since they sit in the body slot, so its `.cp-body` check still
  covers them.

Browser evidence (emulation, `?shot=rest`, `?shot=smith`, `?shot=event`,
reduced motion). Frame size, then head / body / foot as a share of the
viewport height; the body share is without and with a foot.
- 1440×860 (wide, zoom 1.18): 1368×659, 10% / 66.4–56.4% / 10%; slots side
  by side, 628 px each.
- 1280×800 (wide, 1.07): 1216×610, 10% / 66–56% / 10%; side by side, 557 px.
- 390×844 (narrow, 0.9): 371×639, 10% / 65.4–55.4% / 10%; stacked, 349 px.
- 375×667 (narrow, 0.85): 356×474, 10% / 60.8–50.8% / 10%; stacked, 336 px.
- 844×390 (wide, 0.62): 802×244, 12.7% / 49.3–33.3% / 16%; side by side,
  370 px. The tap floor enlarges the head and foot.
- No page or screen scroll at any size. Every control in the frame is
  hit-testable once scrolled into view.
- At 1280×800 and 375×667, a flask step moved 3/1 to 4/0, and Level up opened
  the shared allocator, with Cancel returning. A short tap on Rest opened
  review and kept the Shrine; a 1.1 s hold rested and left. Multi-use
  Continue returned to the map, and the Smith modal opens over the Shrine.
- On the event, Continue was disabled before a response. "Leave" (tap,
  review, CHOOSE) showed the result, "Resolved", and an enabled Continue that
  returned to the map. The priced Wayward Pilgrim reads "1 of 2 available",
  with its priced response disabled.
- Browser tools that touch these screens (all CDP; none is Playwright-based).
  `flaskbox`, `ui-sweep --only event,rest,smith` and `holdbeat` pass. The
  rest fail the same way on dev `d2ea5bcd`:
  - `holdconfirm`: 1 finding over 137 checks. `smithExtract` and
    `smithInstall` draw no armed control at `?shot=rest`.
  - `armament-smithing-ui`: 66 passed, 15 failed, the same RED set as dev.
  - `uprightgate`: its rest-smith drive still looks for `#smith-grid .card`.
  - `screenreach`: 8 findings, none on rest or event (dev has 11).
  - `presentation-matrix` crashes when its first Shrine cell misses the tool's
    12 s wait (3 of 4 runs here, 2 of 3 on dev). The Shrine mounts in the same
    time on both trees from the same drive, and the completed run matched
    dev's 0/12.

Limits:
- The run HUD takes 16–19% of the height above the frame, so the frame is
  71–77% of the height rather than W1's 90%, as on W4b.
- At 844×390 the Shrine cards are 37 px tall, under 44 px. Dev is the same
  (`--shrine-card-h` at zoom 0.62). Dev's screen scrolled 91 px there; now
  only the body scrolls.
- Galaxy S24 (360×780) was not measured.
- W1s draws a Continue; a single-use Shrine has none. Leaving without taking
  a choice would be a new mechanic, so that is an owner decision.
- `ui-components` C12, `flaskpresentation` (overlay.js) and
  `flask-data-authority` (flaskCapacity) are red on dev `d2ea5bcd` too.
## Merchant workspace (W1d / W1v)

Branch `feature/wireframe-shop`, based on dev `d2ea5bcd`. The merchant is
now a W1d workspace, not a disclosure fold (FRONTEND-WIREFRAMES rule 11: no
accordion as a menu shell). One pure model,
`src/ui/models/ShopWorkspaceModel.js`, owns the rail, status, selection,
availability and layout rules; every number is in `wireframeUi.shop`.

- **Frame (W1d).** Under the run band: a W0 head (title, exit), a category
  rail, one W1v pane, and a W0 foot with Leave on the left and the selected
  offer's action on the right. With no applicable action, Leave spans the
  foot.
  - Rail: Cards, Armaments, Weapon arts, Relics, Flasks, Services (remove a
    card and the smith's services) and Sell. Sell is absent, not greyed, when
    its toggle is off.
  - Frames at least 60rem wide put the rail beside the pane at W1's 21.6/95
    share, clamped to 11–28rem. Narrower frames put it above as one strip.
- **Pane (W1v).** The head carries the category status ("5 for sale", "2 he
  will take", "1 of 1 open"). Offers and the selected offer's detail sit side
  by side on wide frames and stack on compact ones, with the detail capped at
  half the body. Only the offers and the detail scroll; the page never does.
  - Each tile shows its price, and a reason when it cannot be taken. Reasons
    come only from existing plans: armament and weapon-art plan reasons, a
    full flask belt, the purse, and the remove service's existing lock.
  - The detail shows the name, description, price and availability.
- **Select, then act.** A tap on a relic, flask or sell tile selects it. The
  footer action ("Buy · N cinders", "Sell · N cinders") carries the existing
  `shopBuy` / `shopSell` beat, with the same questions and commits.
  - Cards keep their own armed second tap; the footer is a second door to the
    same beat.
  - Armaments and weapon arts keep their inspection doors; the footer opens
    the same modal. Services open their existing doors, and the burn grid
    keeps its three doors.
  - A shelf's first visit selects its first offer the player can take. After
    a purchase the category is kept and the selection moves to the offer now
    in the bought one's place. Offers are keyed by kind, id and occurrence,
    never by bare index.
- **Wording.** New copy is in `uiStrings.csv` (`shop.title`, `shop.leave`,
  `shop.purse`, `shop.bar.services`, `shop.status.*`, `shop.price*`,
  `shop.avail.*`, `shop.action.*`, `shop.detail.*`). The purse stays in the
  run band; the head shows it only when the shop is mounted without the band
  (instrument mounts).
- **Tools.**
  - `shopbars` is rewritten for the rail (S1–S6, new plants, plantsites
    digest re-recorded). It now imports `serve.mjs` through a file URL, so it
    runs on Windows.
  - `holdconfirm` presses the Services and Sell rail items.
  - `flaskbox` selects a flask, then uses the footer Buy.
  - `weapon-card-preview`, `card-inspection-qa` and `card-removal-flick-qa`
    use the rail selectors.
  - `foldsurvivors` no longer watches the shop, which has no fold.

Browser evidence (CDP emulation, `?shot=shop`):
- 1440×860: rail 310 px of a 1368 px frame; offers and detail 500 px each.
- 1280×800: rail 276 of 1216 px; offers and detail 444 px each.
- 390×844 and 375×667: the rail strip sits above the pane; offers are 346 and
  184 px tall, with the detail stacked below (113 and 106 px).
- 844×390: side rail, its seven items scrolling inside it; offers and detail
  127 px tall.
- 360×780 (Galaxy S24): the rail strip sits above the pane; offers 305 px
  tall, detail 103 px.
- At every size: no page scroll and no target under 44 px. Selecting a relic
  and pressing Buy opened "Buy Golden Sprout for 437 cinders? You have 999
  cinders." with nothing spent. Confirming took 999 → 562 cinders and 2 → 1
  relics, and the pane stayed on Relics.
- `shopbars`: 12/12 at 390×844 and 1200×730, including the exact sell price
  (+75) through the beat and Sell absent with its toggle off.
- `holdconfirm`: 1 finding over 137 checks on this branch and on dev
  `d2ea5bcd` alike, with the same merchant section. The finding is the
  Shrine smith census line "2 absent: smithExtract, smithInstall". The shop census draws the same three actions with the same
  forms as dev (`shopBuy=none shopRemove=confirm shopSell=confirm`); 21
  armed controls instead of dev's 25, because relic, flask and sell tiles
  now select and the footer carries their beat. The merchant section passes:
  a brazier card arms the burn without burning, and the question names the
  card and its price.

Limits:
- The run band and the room's belt padding stay above the frame, so at
  1440×860 the frame is about 80% of the height, not W1's 90vh.
- At 844×390 the offers region is 127 px tall, and tall relic and armament
  faces scroll. W1d's compact drawing puts the rail above; this branch keeps
  it beside, because the frame is wide enough and that leaves more height.
  The owner may prefer the drawn form.
- Compact frames use the shared kit's horizontal rail strip, not W1's
  `[Category ▾]` selector. Rule 11 forbids horizontal tabs, so the owner
  should confirm the strip or ask for a selector in the shared W1 shell.
- The shared 64 px inspection reserve above card grids leaves a gap over the
  card shelf.
- The Playwright tools (`card-inspection-qa`, `card-removal-flick-qa`,
  `world-atlas-qa`) were updated where needed but not run. `scroll-cue-bleed` still names `.screen`
  as the shop's scrollport, and on this screen that no longer scrolls; it
  needs re-aiming at `.shop-offers`, with its plants.
## Armoury on the W1 shell

Branch `feature/wireframe-armoury`, based on dev `d2ea5bcd`. W1e is the
Armoury's shell and W1n its Inventory body, rendered inside it: one shell,
not two. Presentation only; no item, stat, comparison, persistence or
equip rule changed.

- Head: one title, Armoury, and the close. The views left the head's tab
  strip for the W1 category rail (kit `.as-railed`): beside the pane on
  wide hosts, above it on narrow hosts, where it is a grid of equal cells
  that never scrolls sideways. Rail items keep `role=tab`,
  `aria-selected`, `data-modal-tab` and `data-member` under
  `[data-surface="armouryView"]`, so the tools' selectors still resolve.
- Saved ids are unchanged: the views `grid`, `rack`, `hybrid` and `cards`
  (`meta.settings.equipView`) and `armouryArmamentView`. The rail shows
  the authored labels Character, Equipment, Inventory and Cards.
- The pane split comes from `wireframeUi.armoury` (0.5 / 0.5, the
  drawings' 31.95 / 31.95 and 44 / 44) through
  `src/ui/models/ArmouryWorkspaceModel.js`, tested by
  `tests/wireframe-armoury.test.mjs`. Columns on wide hosts, rows on phone
  hosts (the Armoury's own 760 px breakpoint).
- Inventory (W1n): the disclosure keeps its faces in the collection and
  renders the selected item's reveal in its own detail column
  (`mountDisclosure` gains additive `revealHost` and `onReveal` options).
  Before a selection that column carries the instruction. The reveal adds
  "Compared with equipped" (what the target position holds and the role
  values that move, from the candidate receipt) and an eligibility line
  (the `canEquip` or `equipTransitionReceipt` refusal; unmet attribute
  minima are stated as a fact, because `equipPiece` does not refuse on
  them).
- Footer: Back (it leaves, like the close and Escape) and, for a selected
  Inventory item with an equipment position, that item's action. It runs
  the same act through the same hold as the card; a refused change keeps
  its control and its reason. With no selection, Back spans the footer.
- Equipment in its grid presentation puts the slot tiles beside the shared
  detail, and the active view fills the pane instead of hugging its
  content.
- The shared equipment inspection stacks inside a narrow Armoury detail
  column (a container query), as it already did under the phone media
  rule.
- Copy: `armoury.*` rows in `uiStrings.csv`. `ArmouryModels.js` lost two
  literals (copy baseline 10 to 8).

Tools: `ui-sweep` R6 now asks for the compact rail contract (above the
pane, inside the rail, no sideways scroll) instead of head tabs beside
the close. `armoury-inventory-disclosure` finds the face in the list
rather than among the reveal's siblings.

Browser evidence (headless Chrome over CDP, `?shot=map`, emulated
viewports, source tree):
- 1440×860 (zoom 1.18): modal 1133×740, head 78 px, rail 204 px with four
  170×44 items, pane 917×582, footer 78 px. Inventory splits 430 | 430;
  Equipment's grid presentation 417 | 417.
- 1280×800 (1.07): modal 1027×689, rail 185 px (154×44 items), pane
  831×537, Inventory 389 | 389.
- 390×844 (0.90, narrow): the rail sits above the pane as one row of four
  86×44 cells with no sideways scroll; pane 374×546; Inventory stacks
  256 over 256; footer Back 176 and the action 178 on one row.
- 375×667 (0.85, narrow): four 83×44 cells; pane 359×394; Inventory
  stacks 181 over 181; footer 169 and 172.
- 844×390 (0.62, short-wide, not narrow): the rail stays left (107 px,
  89×44 items); pane 486×208; Inventory 231 | 231.
- Every viewport and view: no page scroll and no horizontal overflow in
  the pane. Rail items, the close (44×44) and the footer buttons are at
  least 44 px.
- Equip: at every viewport, a real mouse hold on the footer's action
  unequipped Wayfarer Plate, and a hold on the footer's "Equip to Armour"
  put it back, with no refusal notice.
- Keyboard: at 1440×860 and 1280×800 the shared cursor reaches the rail
  with ArrowLeft, ArrowDown moves to the next category and Enter selects
  it.
  At 390×844 and 375×667 ArrowDown from the close reaches the rail,
  ArrowLeft moves along it and Enter opens the chosen category; at 844×390
  ArrowLeft reaches the rail and ArrowUp moves along it. The rail adds no
  arrow handler of its own, so the cursor never double-steps.
- Tools: `armoury-arrival-figure` 42/42; `ui-sweep --only armoury` passes
  (R6 at 390×844); `armoury-inventory-disclosure` 27 passed, 3 failed, the
  same three as dev. It was run from a scratch copy with its 8 s map wait
  raised to 60 s because this machine was heavily loaded.

Limits:
- The drawings show three categories (Character, Inventory, Hybrid); the
  game authors four views with other labels. Ids and labels were kept.
  Renaming or merging them is an owner decision.
- Compact landscape (844×390) is not `narrow`, so the rail stays at the
  left, as on every kit W1 door. The W1 compact drawing puts it above;
  choosing between them is an owner decision.
- Equipment's list presentation (the default) keeps each position's
  detail in place; only the grid presentation splits.
- The full comparison receipt stays behind the authored hold preview
  (`armouryUi.json` `comparison.presentation: "tooltip"`); `"inline"`
  would put it in the detail column.
- Only the Inventory fills the footer's primary. Equipment's Change and
  Equip stay on the position cards.
- Inventory faces are still the large equipment cards (`inventoryFace`,
  which #1049 also edits), so a stacked phone collection shows about one
  card at a time.
- The shared inspection's tags are 29 to 36 px tall (18 px at 844×390),
  under the 44 px target; that component is unchanged here. Equipment's
  Change buttons are 40×44 at 844×390, the same on dev.
- Same on dev: `armoury-inventory-disclosure` fails the same three checks
  (model panel, hold fill, hold preview), `modal-shell-contract` has its
  two known failures, `ui-components` fails C12, and `uistrings --check`
  is red on Windows path separators. Playwright-based tools were not run.

## Remaining integration

Complete the card and hand interaction matrix, compact containment, combatant
inspection and roster stress cases; then integrate and verify dependent
screen shells, equipment, progression, rewards, and remaining overlays against
every coverage entry. No issue or draft implementation PR has been published
for these uncommitted changes.

## Settings workspace (W1a)

Branch `feature/wireframe-settings`, based on dev `d2ea5bcd`. Settings keeps
its rows, persistence, validation and capabilities; only the presentation
changed, in both doors (the title modal and the in-run overlay's Settings
tab), which share `renderSettings`.

- Rail or selector: `src/ui/models/SettingsWorkspaceModel.js` decides from
  the host width, the viewport height, one rem and the tap floor. A rail
  needs `wireframeUi.settings.railMinHostWidthRem` (60) and room for every
  category at the tap floor inside the W1 body band (70% of the viewport).
  Otherwise one selector sits above the pane, naming the selected category;
  it opens the same tab list in place and closes on a pick. A 1 rem
  hysteresis stops a host at the edge from flapping. The result is written
  as `data-settings-nav`; CSS measures nothing. This replaces a 600 px media
  query and a `data-short` rule that decided the same thing a second way.
- No pane heading. The pane used to print "Settings / category / tip" under a
  door titled Settings, beside a tab already naming the category. The
  selected tab labels the panel (`aria-labelledby`) and keeps its tooltip.
- Header: title and exit only; the "Title" eyebrow is gone.
- Help only where the effect is not obvious: seven rows (accent, screen
  shake, music volume, sound effects, relics and seed in map header, motif
  strength) are marked `selfEvident` and draw no note. Condition lines,
  fullscreen status and applied readouts are feedback and always draw.
- The first category is labelled Display, as in W1a (it read "Game").
  Changelog and About stay in the rail after the four W1a categories.
- New copy in `content/source/uiStrings.csv` (`settings.*`) via `t()`.

Browser evidence (CDP emulation against `dist/AshenSpire.html`, title door
via `?shot=title`, stored settings cleared):

| Viewport | Zoom | Navigation | Header h / exit | Rail or selector | Pane | Page scroll |
|---|---:|---|---|---|---|---:|
| 1440×860 | 1.18 | rail | 78 / 44×44 | rail 203.5 w | 681.3×683.1 | 0 |
| 1280×800 | 1.07 | rail | 74.9 / 44×44 | rail 184.6 w | 616.6×631 | 0 |
| 390×844 | 0.90 | selector | 63 / 44×44 | 355.6×44 | 373.6×648.6 | 0 |
| 375×667 | 0.85 | selector | 62 / 44×44 | 342.4×44 | 359.4×474.9 | 0 |
| 844×390 | 0.62 | selector | 62.3 / 44×44 | 441.8×44 | 459.2×200.7 | 0 |

- Headings: the only visible heading in the door is "Settings" at every
  viewport; the pane has none. Display draws 12 notes for 14 rows.
- Targets: every visible navigation, header and footer control is at least
  44 px. Row controls are unchanged by this branch and some are not: choice
  chips measure 41.6–42.8 px tall, several segmented chips 25–31 px wide on
  wide hosts, and toggles 17.4–33 px tall.
- Keyboard: `]` six times and `[` six times cycle all six categories and wrap
  at every viewport (the LB/RB path runs the same ring). Selector hosts:
  Enter on the selector opens six tabs with focus and the pad cursor on the
  selected one, ArrowDown moves to Audio, Enter selects it, closes the list
  and returns focus to the selector, now reading "Audio". Rail hosts
  (1440×860, 1280×800): arrow keys move the pad cursor from the pane's
  controls left onto the rail (it lands on Advanced), ArrowDown steps to
  Changelog, and Enter selects it. Native focus does not follow the pad
  cursor there; that is existing `input.js` behaviour.
- In-run overlay at 390×844: selector shown, tabs closed, no pane heading,
  no page scroll.

Tools: `tools/settingsreach.mjs`, `tools/tapsize.mjs` and the T4 probe in
`tools/watched-probes.json` now read the selector as the section control on
compact hosts (a hidden tab measures zero). `settingsreach` could not
measure here: it opens the bare bundle URL, which stops at the startup
gate, so it finds no Settings button before any settings code runs. That
navigation is unchanged by this branch and needs `?shot=title` (as
`tools/about-changelog.mjs` uses); it was left for a separate fix.
Playwright-based tools were not run.

Limits: the rail/selector threshold is a budget, not a measurement of the
drawn rail. The label change to Display and hiding seven notes are owner
decisions to confirm. Escape closes the whole door even while the selector
list is open. No gamepad was attached; the ring was driven by `[` and `]`.

## Service and Quit confirmations (W2a / W2e)

Branch `claude/w2a-w2e-confirmation-audit`, based on dev `8797fc9a`. Every
W2a and W2e review was audited against W2 in the browser and in code. All of
them go through the one door, `openConfirmationModal`. Only the gaps changed;
the hold and second-beat policies did not.

- **Already conforming everywhere:**
  - a question title and a 44×44 close control top-right;
  - Back bottom-left with the action-named primary bottom-right (WCB0 footer);
  - Back takes initial focus; Escape and the close control cancel;
  - `aria-modal`; W2e stays an alertdialog.
- **W2e Quit Without Saving** had no target. It now names the run it leaves,
  e.g. "Reaver · Slot 1 · Act 1 · Floor 0 · 62/62 HP". The class and slot are
  followed by the save slots' own `slotFacts`, so the two cannot disagree.
  The title keeps the actual operation's label ("Quit without saving?").
  The message is unchanged.
- **W2a merchant and Shrine reviews** (via `beatArmer`) printed the generic
  line "Review this change before confirming…". Buy also wore the category
  eyebrow "STATE CHANGE", and each title crammed in the cost ("Buy X for N
  cinders? You have M."). They now fill the three W2 slots from
  `src/ui/models/ConfirmationReviewModel.js`:
  - Buy card/relic/flask: "Buy this card?", then the offer, then "Spend 242
    of your 999 cinders (757 left). The card joins your deck."
  - Burn: "Burn this card?", then the card, then the exact cinders.
  - Sell: "Sell this flask?", then the item, then the price.
  - Rest: "Rest at this Shrine?", then the Shrine with HP and Mana, then the
    exact heal and whether you stay or leave.
- **Burn is an alertdialog now.** `action.removeCard` is DESTRUCTIVE in the
  ConfirmationRegistry, but the review was a plain dialog. `beatArmer` takes
  an optional `policyAction` and reads its tone through
  `registries.framework.confirmationTone`. The secondbeat profile rule
  still applies, so W2b Delete is unchanged.
- **Smith upgrade and mount install/extract** said "Keep reviewing" on the
  way out. It is Back (`common.back`). Their titles, details card and
  blocked state were already W2.
- **Shared door.** It had a generic "Confirm"/"Careful" eyebrow fallback,
  which is gone: the eyebrow is a concrete tag or nothing. There is a new
  optional `target` slot (`.confirmation-target`, kit `as-title-s`) above the
  message, added to `aria-describedby`. Callers that pass no target,
  including W2b/W2c/W2d, render exactly as before.
- **Copy.** New rows in `uiStrings.csv`: `shop.review.*`, `rest.review.*`,
  `confirm.eyebrow.permanent`, `quit.review.target`.
- **Tests.** `tests/wireframe-confirmation.test.mjs` (7 tests), registered in
  `run-node.mjs`.

Browser evidence (CDP, source `index.html`). The reviews were Quit (`?shot=map`
quick menu), Buy, Burn and Sell (`?shot=shop`), Rest, and Smith upgrade
(`?shot=rest`):

| Viewport | Dialog (w×h, Quit / Buy / Smith) | Page overflow | Body scroll | Back → primary x |
|---|---|---:|---:|---|
| 1440×860 | 507×308 / 507×281 / 507×488 | 0 | 0 | 484 → 722–958 |
| 390×844 | 376×244 / 376×223 / 376×394 | 0 | 0 | 17 → 198–374 |
| 844×390 | 267×249 / 267×210 / 267×374 | 0 | 0 | 298 → 425–547 |

- Roles at every viewport: Quit and Burn are `alertdialog`; Buy, Sell,
  Rest and Smith are `dialog`. Focus lands on `.confirmation-cancel`.
- Every dialog fits inside the viewport.
- Every target line is filled except Smith's, whose title already names the
  item.

Tools:
- `holdconfirm` shows the 1 finding over 137 checks it has on dev
  (`smithExtract` and `smithInstall` draw no control at `?shot=rest`).
- `modal-shell-contract` is 58 passed with its two known failures.
- `confirmation-modal` (browser) was not rerun.
- Standalone, the confirmation-modal node contract throws importing
  `tooltip.js` in its fake DOM. It throws identically on a clean dev export,
  and it passes inside `run-node.mjs`.
- Playwright-based tools were not run.

Limits:
- Mount install/extract reviews were checked in code only; `?shot=rest` does
  not offer those services.
- The dev Sell review was read from code (my first probe missed its tile).
- Owner decision: W2's wireframe shows no eyebrow at all. The concrete
  consequence tags ("CANNOT BE UNDONE", "LEAVES THE RUN", "PERMANENT FOR THIS
  RUN") still sit as the eyebrow above the question. Moving them into the
  body consequence slot is a shared-door change that also moves W2b–W2d, so it
  was left alone.
- The eyebrow change reaches every `beatArmer` review. Event choice, flask
  use, End Turn and reward Continue no longer wear "STATE CHANGE" when they
  can be undone. They still print the generic review line, because they
  author no message; they are W2 instances outside W2a/W2e.
## Tooltips (WCT0 / WT1 / WT2 / WT3)

Branch `claude/tooltip-wireframes-wt`, based on dev `8797fc9a`. One
presenter (`tooltip.js`, two panels) keeps every existing behaviour; this
names its sizes after the wireframes and fixes the four places it failed
CURRENT-SPECIFICATION "Tooltips".

- Sizes: no second size system. The presenter still measures content into
  four height rungs and steps up until it fits. `wireframeUi.tooltip`
  names the wireframe each rung draws: small is WT1, medium WT2, large and
  expanded WT3 (same width; expanded only reaches further down). `fitRung`
  stamps it as `data-wireframe` on `#tooltip` / `#tooltip-2`. The rung list
  now lives once, as `TooltipPlacementModel.TOOLTIP_RUNGS`;
  `tooltipWireframeConfig` refuses a mapping that drops a rung, names
  another id, leaves one of WT1–WT3 undrawn, or runs backwards.
- Arrow (WT0.arrow, new): 0.75 × 0.375 reference rems (12 × 6 physical px)
  on the panel edge that faces the trigger, pointing at its centre after
  any flip or shift, held 0.5 reference rem clear of the corners.
  `tooltipArrow` (pure) computes the box; `pointArrow` writes `data-arrow`
  and four custom properties; `#tooltip::after` draws it in gold as a
  `fixed` triangle, so the panel's overflow clip does not cut it. It is
  re-pointed with the panel on resize. `data-arrow="none"` when the panel
  sits on its trigger.
- Flip below: `placeAnchored`'s `'above'` intent tried right and left
  before under. It now tries under first, which is what its own comment
  already said. Only `tooltip.js` places with `'above'` (flask and
  quick-nav use `'under'`), so no other surface moves.
- Pending timer: a repeated hover or focus on the element already counting
  down restarted the countdown. It now keeps it.
- Unchanged: delays, cancellation paths, the two levels, the stick, the
  veil/scene watch, rung sizes, the tap-to-select rule, and `map.css`'s
  removal of the tooltip-selected outline on map nodes.

Browser evidence (CDP emulation against the source tree, `?shot=combat`,
the shipped tooltip module driven through real `Input` mouse and key
events; triggers 48 px; scratch probe kept outside the repo).

Before, dev at 1440×860: a second `pointerenter` 600 ms into the wait
opened the panel at 1621 ms (after: 1003); a second focus at 300 ms opened
at 816 ms (after: 524); a trigger at the top edge put its panel beside it
(right, or left at the top-right corner) instead of below; no panel had an
arrow; no panel carried a wireframe id.

| Viewport | Zoom | Hover | Repeat | Top-edge trigger | Arrow off centre | WT1 panel (short) | WT3 panel (list) | Modal | Page scroll |
|---|---:|---:|---:|---|---:|---|---|---|---:|
| 1440×860 | 1.18 | 1011 ms | 1003 ms | below | 0.01 px | 300.9×51 (20.9vw) | 442.5×153.3 (30.7vw) | above veil, hit | 0 |
| 1280×800 | 1.07 | 1013 ms | 1013 ms | below | 0 px | 272.8×46.5 (21.3vw) | 401.3×139.1 (31.3vw) | above veil, hit | 0 |
| 390×844 | 0.90 | 1007 ms | 1009 ms | below | 0 px | 229.5×39.4 (58.8vw) | 337.5×117.3 (86.5vw) | above veil, hit | 0 |
| 375×667 | 0.85 | 1014 ms | 1010 ms | below | 0 px | 216.8×37.3 (57.8vw) | 318.8×110.9 (85vw) | above veil, hit | 0 |
| 844×390 | 0.62 | 1022 ms | 1022 ms | below | 0 px | 158.1×27.8 (18.7vw) | 232.5×81.4 (27.5vw) | above veil, hit | 0 |

The table is the final run: 215 of 215 checks pass, 43 per viewport.
"Repeat" is the open time with a second `pointerenter` fired 600 ms in.

- Delay: the 0.5 s setting opens at 502–514 ms. Focus (`gpfocus`) opens
  at 516–600 ms at every viewport; see Limits.
- Cancel: leaving, blur, Escape, an outside press and removing the trigger
  before the delay each leave the panel closed at every viewport; Escape
  and an outside press also close an open panel.
- Pointer transition: moving from the trigger across the gap into the
  panel keeps it open for 1.2 s; leaving both closes it after the close
  delay.
- Placement: eight trigger spots per viewport (centre, four edges, three
  corners); every panel stays inside the viewport, and the arrow sits on
  the edge facing its trigger (0–0.01 px from that edge).
- Modal layer: a trigger inside a real `openModal` door opens its panel
  above the veil (`z-index` 1000 over 500); the panel is the topmost
  element at its centre.
- Real trigger: the combat HUD's first hint, hovered for real, opens after
  1003–1010 ms below the HUD with a 12 × 6 px arrow on its centre: WT2
  371.7×148 (25.8vw) at 1440×860, 283.5×113.4 (72.7vw) at 390×844, and
  WT1 158.1×54.4 (18.7vw) at 844×390.
- Touch (390×844, 375×667): the first tap selects the detail and opens
  nothing; the second opens it at once.
- Targets: the panels carry no controls in these readings; probe triggers
  are 48 px. The HUD hint triggers are not 44 px tall; see Limits.
- Trigger parent: an earlier run placed each probe trigger directly in
  `<body>` and failed 7 of 215 geometry checks. Edge triggers at 390×844
  and top and bottom triggers at 844×390 opened beside, and one arrow sat
  46.7 px off its trigger. That is the existing `clear` preference, not the
  reorder: the panel keeps off the trigger's parent, and there `<body>`
  overlapped the space above more than the space beside. Above comes
  before right and left in both orders. With each trigger in its own
  group, as real hints are, every check passes.

Tools: `tools/placement.mjs` gives the same 12 findings as dev, line for
line (P3 expects hover tooltips on hand cards, which e305c64b removed; P5
finds no flask slots on `?shot=combat`). `tools/tooltippersist.mjs` stops
on Windows before any check: it imports `serve.mjs` by a raw `d:` path.
That predates this branch and was left alone. `tools/tooltip-review-qa.mjs`
is Playwright and was not run.

Limits: focus opens after its own 500 ms (`tooltipHelp.focusMs`, from
e305c64b) and tap is select-then-explain (owner, 2026-09-11); the spec's
line asks for the configurable 1 s for both, so that is an owner decision.
Panel widths are the rungs' rem widths, not the wireframe's vw nominals
(WT1 12vw wide host / 36vw portrait, WT2 20vw / 60vw, WT3 28vw / 84vw):
WT1 measures 18.7–58.8vw. The panel still aligns to the trigger's start
edge rather than its centre, and the gap stays `--place-gap` 14 px, not
0.5rem; the arrow points at the centre either way. Content past the
expanded rung still scrolls inside the panel unless the surface routes it
to inspection (`expand: true`). The arrow is clipped for the 150 ms rung
step reveal. A hint whose parent is a page-sized container can still open
beside its trigger, by the `clear` preference above. The HUD hint triggers
measure 87.4×19.4 px at 1440×860, 72×15.7 px at 390×844 and 44×32 px at
844×390, below the 44 px target; they are HUD labels this branch does not
change. Emulation only: no touch device, no gamepad.
## Combat composition and scene layers (WGC0, WGC2–WGC4, WC4b/c, WGS0/1/6/7, W4)

Branch `claude/combat-composition-scene-layers`, based on dev `8797fc9a`.
Most of this family was already on dev. Two gaps were real: the scene plate
ignored the floor band, and the target layer thinned on phones and outlived
its command.

- WGS1 Background composition, WGS6 Skyline, WGS7 Floor:
  `src/ui/models/SceneLayerModel.js`. Each scene is one painted plate, so
  skyline and floor are two regions of it. The plate covers the battlefield
  undistorted, and its authored ground line (`floorStart` in
  `content/environments.js`) sits at the floor band's top edge. That gives
  80% ground and 20% sky, as CURRENT-SPECIFICATION's accepted formation says.
  `wireframeUi.scene` holds `floorFraction` 0.8 (moved from the unused
  `formation.floorFraction`), `bleedFraction` 0.02 and the two toggles. The
  battlefield stage writes the crop as the SVG `viewBox` and drops the
  1.06/1.02 CSS zoom about the centre, which would move the ground. Combat
  and co-op share the stage, so both get it. Feet are untouched.
- Toggles: `scene.floor: false` falls back to a centred cover crop, and
  `scene.skyline: false` paints no plate. Neither moves an actor.
- WGC4 Target layer: `src/ui/models/TargetLayerModel.js` is the one home for
  eligibility (living enemies while a targeted card or flask is armed) and
  for the outline geometry (`wireframeUi.targetLayer`). `combat.js` applies
  it from selection changes and from every `render()`.
  - Defect fixed on the way: on dev, selection toggled `targetable` directly,
    and the frame update only removes classes it added itself. After a play,
    both enemies kept the dashed outline.
  - A defeated enemy is never highlighted.
  - The outline and its offset are authored in sprite px (2 / 6, as before)
    and held at 2 / 4 physical px under the depth zoom. Browsers floor these
    to whole device pixels, so the model asks for half a pixel of headroom.
  - Required targeting still gates the command: a card that needs an enemy
    arms instead of playing.
- Already met, no change: WGC0 (HUD, battlefield, hand and packed footer
  from the W4a band plan, with one Potions control). WGC2 and WGC3 (mirrored
  reserved slots by stable id, shared category fit, row and selected-growth
  factors at the foot anchor, intent by role). W4 (its combat and map bodies
  are W4a and W4b; this branch changes neither band plan; W4c dialogue was
  not assessed).
- WC4b Standard and WC4c Expanded: their anatomy is on dev through
  WCM0–WCM4, WCO1–WCO3, WCF3 and WCB1. The fixed clamp sizes are not built,
  because no production host uses a fixed-size combatant: formation fit sizes
  the battlefield, and W1w bounds the inspector preview.

Browser evidence (CDP emulation, `?shot=combat`, reduced motion, scene
`pale-marches-2`). "Ground" is where the painted ground line falls, as a
fraction of field height, read through the SVG's screen CTM. Dev values use
the same formula, which matched a dev probe of this scene within 0.002.

| Viewport | Zoom | Plan | Field px | Ground dev → branch | Highest foot | Outline / offset px, dev → branch | Scroll |
|---|---:|---|---|---|---:|---|---:|
| 1440×860 | 1.18 | stacked | 1440×459.9 | 0.457 → 0.1998 | 0.504 | 3/11 → 3/11 | 0 |
| 1280×800 | 1.07 | stacked | 1280×423.9 | 0.457 → 0.1999 | 0.502 | 3/9 → 3/9 | 0 |
| 390×844 | 0.90 | stacked | 390×450.4 | 0.479 → 0.1994 | 0.503 | 1/4 → 2/4 | 0 |
| 375×667 | 0.85 | stacked | 375×336.4 | 0.480 → 0.1997 | 0.498 | 1/4 → 2/4 | 0 |
| 360×780 | 0.83 | stacked | 360×411.9 | 0.480 → 0.2003 | 0.502 | — → 2/4 | 0 |
| 844×390 | 0.62 | rails | 844×148 | 0.420 → 0.1997 | 0.641 | 1/2 → 2/4 | 0 |

- All 20 scenes, full 6-v-6 formation (analytic, same formula): on dev the
  ground line fell between 0.19 and 0.74 of the field, and back-tier feet
  stood above the painted ground in 3, 3, 3, 6 and 2 of 20 scenes at the
  five viewports above. On the branch it is 0.200 everywhere, with 0/20.
- Tap-to-play at all six viewports: tap the first hand card (it arms both
  enemies), then tap the first enemy. Hand 5 → 4, enemy 16 → 9 HP, then
  `data-target-layer="idle"` with 0 targetable and 0 aiming. On desktop, hover gives the solid active
  outline.
- Co-op (`?shot=coop`, 390×844 and 1440×860, scene `cinder-reach-3`): ground
  0.1994 / 0.1997, floor top 0.200, feet from 0.502.
- Targets: every combat button at least 44 px, except the two HUD icon
  buttons at 844×390 (44×32), which are the same on dev.
- `hudparity --only-shape 844x340`: 15 findings, 140 checks passed, identical
  to dev today (dev has moved since the 9 recorded earlier).

Limits: phones now crop the plate harder. At 390×844 it is drawn at
1.12–1.63× instead of 0.90×, because 80% ground needs more of the painting's
ground than a phone field shows. That is an owner decision; `floorFraction`
tunes it. There is no separate skyline or ground-cutout art, so
`scene.groundCutout` has no counterpart and the floor is a region of the
plate, not a foreground layer. `environments.js` still carries
`fieldRatio: 0.6` (the earlier 60% ground review); nothing reads it. A CSS
rule gives a keyboard-focused target the solid outline, but keyboard
targeting was not verified: CDP key events did not reach the shortcut
handler. Playwright-based tools were not run.
## Compact landscape: HUD headroom and notch margins

Branch `claude/compact-landscape-headroom-safearea`, based on dev `8797fc9a`,
issue #1076. This fixes two defects that "Compact landscape combat" left open.
Neither needed an owner call.

- **Headroom (WCO1).** `overheadStackBottom` in
  `src/ui/models/CombatOverlayModel.js` clamps the overhead stack (Inspect
  over the intent), so its top edge never rises above the HUD band's bottom.
  - On every refit, `battlefieldStage` measures each stack's height and the
    band's bottom edge. It refits again when a stack changes size, for example
    when Inspect appears.
  - The stack keeps its minimums and its order. On a short field it moves
    down over the top of the sprite instead.
  - The sprite fit, the formation and `wireframeUi.overlay` are unchanged. A
    stack that already clears the band does not move.
- **Relic row.** The relic row's box spans the band's width just under the
  HUD row. On desktop it took presses on the top of every intent; on short
  hosts it already let them through. It now lets presses through on every
  combat host, and the relics themselves still respond.
- **Notch margins.** kit.css applies combat.css's `--safe-*-local` insets
  (the device's `env(safe-area-inset-left/right)` divided by the UI zoom):
  - The hand band is padded, and the battlefield is inset by margins.
  - The HUD's two ends and the relic/potion belt use `max(existing, inset)`.
  - Both HTML heads already carried `viewport-fit=cover`.
  - The layout adapter plans the rails for the width between the insets. It
    re-plans when that padding changes.

  Every inset is zero on hosts without a notch, so nothing moves there.

Browser evidence (headless Chrome 152, CDP emulation, `?shot=combat`, reduced
motion, Short-screen warning off). Each figure is the top of the intent or
Inspect minus the bottom of the HUD band; negative means it sits under the
band. The "Selected" columns select enemy 1 and wait for its Inspect.

| Viewport | HUD band | Intent at rest, dev → branch | Selected intent, dev → branch | Selected Inspect, dev → branch |
|---|---|---|---|---|
| 844×390 | 39 px | −13 → 0 | −18.4 → +48 | −66.4 → 0 |
| 915×412 | 41.2 px | −7.5 → 0 | −12.4 → +48 | −60.5 → 0 |
| 740×360 | 36 px | −13 → 0 | −18.4 → +48 | −66.4 → 0 |
| 667×375 | 37.5 px | −13 → 0 | −18.4 → +48 | −66.4 → 0 |
| 1440×860 | 86 px | +29.1 (same) | +14.3 → +48 | −33.7 → 0 |
| 1280×800 | 80 px | +28.3 (same) | +15.2 → +48 | −32.8 → 0 |
| 390×844 | 84.4 px | +119 (same) | +113.6 (same) | +65.6 (same) |
| 375×667 | 66.7 px | +62.2 (same) | +57 (same) | +9 (same) |

- Hit tests (nine points on each control): at the rails and desktop sizes, no
  intent point and no Inspect point lands on another element. Inspect misses
  only its four corners, as every round control does. On dev, the HUD, or on
  desktop the relic row, took the top points of every intent.
- Every other measurement matches dev at all eight sizes: bands, sprite
  sizes and feet, hand and card boxes, rail and footer controls, topbar
  padding, HUD and formation edges. No page scrolls.
- Notch emulation: 47 px insets left and right, set with CDP
  `Emulation.setSafeAreaInsetsOverride`; `env()` read 47px. Checked at
  844×390, 915×412, 740×360 and 667×375:
  - Every size planned rails, supported.
  - Rail controls, the HUD's ends and the relic belt sit exactly 47 px from
    each edge. On dev they sat at 0, 0 and 9.9 px.
  - Formation meters sit 63 px in (16 + 47).
  - The hand keeps five cards at their dev widths: 502.9 px at 844×390, down
    to 325.8 px at 667×375. Every control and card hit-tests to itself.

Tools:
- `hudparity --only-shape 844x340`: 15 findings on dev and 15 on this
  branch, the same five in each pose (P8 top row, P8 metadata priority, P1V
  vertical). The full run reported 27 on dev and 34 here. The difference is
  P0 population misses, which move between cells from run to run, including
  map cells this branch does not touch. A pose that misses population
  reports no other findings, which is why dev showed 9 at 844×340 before.
- `hudbars`: 22 assertions ok on both dev and this branch, with no A11
  failure in either run.
- `combat-test-browser.mjs`: stops at the same point on dev and here, after
  52 passes, at "Unreachable hover target .hand .card .cost".

Limits:
- When an enemy is selected at 844×390, Inspect (44 px), its gap and the
  intent (48 px) stack 96 px tall in a 148 px field. The Inspect and intent
  cover most of the selected sprite, which is 59 px tall. An unselected
  intent covers the top 7 px of a 54 px sprite. Keeping the art clear needs
  an owner call: Inspect beside the intent on short hosts, or a taller
  battlefield with smaller cards.
- The relic belt still hangs under the HUD row. With enough relics to wrap
  across, its slots would draw over enemy intents, as they do on dev.
- In portrait (390×844, 375×667) the two enemies' intents overlap each other
  by about 8 px, as on dev.
- The bottom inset (the home indicator) is not applied. The rails' lower row
  sits at the bottom corners, clear of the centred indicator.
- Safe areas were emulated through CDP, not tested on a phone. Playwright
  tools did not run. The rotate-your-phone threshold is unchanged.
## Shared run HUD (WGH2, WGH3, WGH6–WGH8, WGS2–WGS5)

Branch `claude/hud-remaining-wireframes`, based on dev `8797fc9a`; issue
#1075. WGH5 (Experience strip) is skipped: it shows XP, and progression
(XP and proficiency) is blocked on owner decisions (plan §12.5). WGH0,
WGH1, WGH4 and WGS8 were already in progress and are not re-opened.

- WGH0 layers are data: `wireframeUi.hud.layers` (header, class, cinders,
  position, vitality, armoury, menu, rail, relics). The pure
  `models/RunHudLayerModel.js` resolves them per place before layout; a
  layer that is off contributes no model child, so it leaves no row, track
  or gap. Defaults draw exactly what dev drew.
- Potions ownership: `FOOTER_HUD_PLACES` is combat. Combat's top HUD no
  longer renders a potion tray at all (dev rendered an empty, hidden one),
  and Quick Access no longer models the charge flasks as siblings of
  Armoury and Menu.
- WGH8: `models/PotionContentsModel.js` is the one projection of the HP and
  MP charge flasks and the carried consumables, each with its count.
  Carried flasks of one kind are one entry with a count and the slots that
  hold them; Use spends the first slot, through the unchanged hold/confirm
  beat and targeting. Flask hotkeys (F/G/H) open the entry that owns their
  action id rather than a list position. `wireframeUi.hud.potions` hides
  either category. The combat footer Potions list (WGC11) and the room rail
  tiles both read it. Count copy is `potions.count.*` in uiStrings, so the
  Azure Flask reads "1 charge" (dev: "1 charges").
- WGH6: `components/relicRail.js` is the one relic tile renderer for
  combat and the rooms. Room tiles now carry `data-relic-id` (dev: only
  combat's did) and open the shared collectible card as before.
- WGH7 / WGS3: the header labels are uiStrings rows (`hud.class`,
  `hud.cinders`, `hud.act`, `hud.floor`, `hud.position`) through `t()`, and
  the act's seat is its own model field printed after the act number,
  instead of text concatenated into the act value. Rendered text is
  unchanged.
- WGH2, WGH3, WGS4, WGS5 were already met (see limits); they gained layer
  switches only. The map-compact header (PR #1052) is untouched.
- `tools/hudparity.mjs`: four selftest plants re-aimed at the refactored
  `hudmeta.js` lines (the Cinders label and the Act/Floor trail's
  accessible name now come from the model). Same mutations, same expected
  findings; `plantsites --write-baseline` changed only that tool's digest.

Browser evidence (CDP emulation against `dist/AshenSpire.html` over
`tools/serve.mjs`, `?shot=map|combat|shop|rest|event`, 25 cells):

| Viewport | Zoom | HUD h: map / combat / rooms | Armoury, Menu | Page scroll |
|---|---:|---|---|---:|
| 1440×860 | 1.18 | 86 / 86 / 95.3 | 44×44 | 0 |
| 1280×800 | 1.07 | 80 / 80 / 88.6 | 44×44 | 0 |
| 390×844 | 0.90 | 84.4 / 84.4 / 104.8 | 44×44 | 0 |
| 375×667 | 0.85 | 66.7 / 66.7 / 101.9 | 44×44 | 0 |
| 844×390 | 0.62 | 52 / 39 / 73 | 44×44; combat 44×32 | 0 |

- Geometry is identical to dev in every cell; no page exceptions.
- Combat, every viewport: no potion tray in the top HUD; the footer
  Potions list shows Crimson Flask "3 charges", Azure Flask "1 charge",
  and the two carried flasks with `data-potion-count`.
- Shop: the rail shows Crimson ×3, Azure ×1 and the carried Crimson Flask
  now with its count pill (dev: none). Rest and event: the two charge
  tiles. Relic tiles carry `forsakenMedallion` on every room.
- Map: the rail stays hidden, as on dev.

Instruments (headless Chrome, `CHROME` set):

- `tests/run-node.mjs`: 138 passed, 0 failed. The new
  `tests/wireframe-run-hud.test.mjs` (9 tests) runs inside the wireframe
  line, which now counts 26 test files.
- `hudparity`: the same 33 finding keys as dev `8797fc9a`. On the map
  that is P8 top-row and P1V at every shape; on combat at 844×340 it is
  P8 top-row, P8/metadata-priority and P1V. The full run lost eight cells
  to 25 s mount timeouts under machine load (P0, no page exceptions).
  Rerunning those cells alone (1440×860 high, 320×640 low and shipped,
  844×340 shipped) measured all of them, with dev's 11 keys.
- `hudparity --selftest` (22 plants): every `hudmeta.js` plant is caught
  by its own named red, including the four re-aimed here. One
  `styles/combat.css` plant, "visible resource cards paint through the
  centred Cinders receipt", is red for the wrong reason. Its named red
  needs combat's 844×340 top row, which dev already leaves unmeasured
  (Cinders centre 0). The selftest was not re-run on dev.
- `hudbars`: 22 assertions ok, on dev and on this branch. A11 passes at
  both shapes.
- `verify-shipped`: 6 OK. `buildversion --check`: 8 OK.
  `plantsites --check`: OK.
- Two gates fail, exactly as they do on dev: `flaskbox --source-selftest`
  (1 MISS) and the `hud-potion-followup` source gate (S2–S9).

Limits: the visible "⚔ Armoury" / "☰ Menu" labels drawn in WGH2/WGH3 are
not added; the band keeps its icon controls with accessible names. Combat
at 844×390 still draws Armoury and Menu 44×32 inside its 39 px band (a
short-landscape rule in `styles/combat.css`); the sizing contract names
physical minimums for the hand and footer only, so a HUD floor is an owner
decision. Rooms without a footer HUD (shop, rest, event) keep their flask
tiles in the rail (`wireframeUi.hud.potions.roomRail`), because that rail
is the only place a charge flask is drunk, or a carried one dropped,
outside combat; `false` applies the footer-only rule there and removes
that capability. The specification's "stamina off by default in scene
HUDs" is not applied: resource rows are `content/resources.js`'s, and
hudparity P1 requires HP, MP and SP on both screens. Playwright-based
tools were not run; no gamepad was attached.

### One icon tray for status effects, relics and the Potions minis

Owner, 2026-09-14: potions still showed in the rooms' top band, the relics
were gone from the map's HUD, relic tiles sat far apart and did not look like
the combatant card's status icons. The owner asked for relics, potion mini
icons and status effects to share one parent, with the combatant card's
status row as its reference — its look, its non-wrapping row and padding, and
its tooltip.

- `components/iconTray.js` is that parent (`statusTray.js` is folded into it).
  A tray is the kit Pips row; an icon is the kit Pip with its count pill.
  `models/IconTrayModel.js` plans size, gap and the `+N` tile from
  `wireframeUi.iconTray` (the old `combatantStack.iconRem/iconGapRem`). Hover
  and focus explain after the shared delay; a tap explains at once; an icon
  with an action does it on the second tap or Enter. `yieldTap` hands a tap
  on while a card or flask is armed.
- Status effects (solo and co-op), the WGH6 relic rail and the Potions minis
  all build their icons with it. Relics are ~25 px round Pips 3 px apart
  (they were 44 px Slots); a second tap opens the collectible card.
- Potions leave every top HUD: `wireframeUi.hud.potions.roomRail` is false.
  The owner chose "footer Potions only": the minis hang over the combat
  footer's Potions control (`wireframeUi.iconTray.footerPotionIcons` wide), a
  second tap opens that entry in the Potions list. Out of combat nothing
  drinks a charge flask or drops a carried one until the Potions control has
  a room home; with `roomRail` back on, the room rail draws tray icons too.
- The map shows the relic rail again (`styles/map.css` hid `.hud-bottom`).
  Only the icons take a press, so the board under the empty row stays live.
## One W1 category selector for every workspace (W1a, W1d, W1e, W1f, W1g, W1h)

Branch `claude/w1-compact-category-selector`, based on dev `8797fc9a`
(issue #1081). FRONTEND-WIREFRAMES rule 11: a menu with several categories is
W1, a rail beside the pane on wide screens and the same navigation above the
pane on compact ones, never horizontal tabs or an accordion; the W1 compact
wireframes draw one `[Category ▾]` selector. Dev had two selectors decided
two ways (Settings measured, Compendium/Profile on `data-layout`), and the
Shop, the pile viewer and the Armoury laid the rail down as a strip (or a
grid of cells) on narrow hosts.

- One model: `src/ui/models/CategoryNavModel.js`. `categoryNavPlan` chooses
  rail or selector from the host's width, the viewport height, one rem, the
  tap floor and the category count, with hysteresis (the W1a rule, now for
  every surface). `categoryNavKey` answers Escape (close, and only while a
  compact list is open), Home and End; arrows and Enter stay the input
  router's. `categoryNavLanding`, `categoryNavAfterPick` and
  `categoryNavFace` say where the cursor goes and what the selector reads.
  The budget moved from `wireframeUi.settings` to a new
  `wireframeUi.categoryNav` block with the same numbers;
  `settingsNavigationPlan` is now that one function. Tests:
  `tests/wireframe-category-nav.test.mjs` (in `tests/run-node.mjs`'s
  wireframe line), covering the six surfaces' category counts at the five
  viewports and a check that no top-level key of `wireframeUi` is declared
  twice.
- One kit component: `src/ui/kit/categoryNav.js`, exported by the kit, with
  `railed(nav, pane)`. It writes `data-cat-nav="rail|selector"` and
  `data-cat-open` on the `.as-railed` host and kit.css keys off them. The
  compact form is one selector (`.as-catnav-toggle`, gold, at the tap floor)
  above the pane. It opens the same rail as a vertical list over the pane's
  area; the list scrolls inside itself, never the page, and the pane is
  `visibility: hidden` while it is open so the cursor cannot reach behind it.
  The selector reads the selected item's label and status ("Cards 5 for
  sale", "Swords 3/9") and follows `aria-selected` by itself.
- Used by all six categorized W1 surfaces: Settings (adopts its `.set-tabs`;
  `#set-cat-select.set-cat-select`, `data-settings-nav` and `data-nav-open`
  are kept for the instruments), Shop (`data-shop-rail` now mirrors the
  nav's decision), Armoury, Compendium and Profile (the private selector in
  `components/w1Workspace.js` is gone), and the pile viewer (its own
  arrow-key handler is gone).
- Strips removed: the kit's `:root[data-layout='narrow'] .as-railed > .as-rail
  { flex-direction: row }`, the Shop's top-rail strip, the Armoury's narrow
  grid of view cells, the `.w1-nav*` rules and Settings' selector rules in
  `styles/ui.css`.
- Hooks: rail items keep `role=tab`, `aria-selected`, `data-member`,
  `data-modal-tab` and `data-shop-category`; the pile items gained
  `data-member`. Stable selector ids: `set-cat-select`, `shop-cat-select`,
  `armoury-view-select`.
- Escape: one `window` capture listener, installed when the kit loads and so
  ahead of every door's own (modalShell on `document`, the in-run overlay on
  `window`, the Armoury on `document`), claims Escape only while a compact
  list is open and closes that list. The pad's B arrives as the same
  synthetic Escape. This fixes the W1a limit above.
- Settings row controls at the tap floor (`--tap-floor`), with behaviour
  unchanged. Toggles: the kit's `.as-toggle::after` already asked for the
  floor, but `button { overflow: hidden }` clipped it to the pill, so the
  pill now overflows and the pseudo spans the floor on both axes. Choice and
  segmented chips: each chip's own `::after` spans the floor's height, the
  chip clips with a margin (`overflow: clip; overflow-clip-margin`) so a long
  label still ellipsizes, and the segment stops clipping its chips. A chip
  narrower than the floor takes the floor as its width, because chips sit
  edge to edge and have no free space beside them to borrow. Wrapped rows of
  five or more chips stand 2 px apart, so no chip's floor overlaps the row
  below. Row buttons (Open, Reset) take the floor's width.
- Copy: `nav.categorySelector` in `content/source/uiStrings.csv`.

Browser evidence (CDP emulation against `dist/AshenSpire.html` through
`tools/serve.mjs` and `tools/browser.mjs`, scratch probe, stored settings
cleared; DPR 1, so CSS px are physical; hit spans are found with
`elementFromPoint`, binary-searched to 0.05 px along each control's centre
lines):

| Viewport | Zoom | Settings (6) | Shop (7) | Armoury (4) | Compendium (3) | Profile (2) | Piles (2) |
|---|---:|---|---|---|---|---|---|
| 1440×860 | 1.18 | rail | rail | rail | rail | rail | rail |
| 1280×800 | 1.07 | rail | rail | rail | rail | rail | rail |
| 390×844 | 0.90 | selector | selector | selector | selector | selector | selector |
| 375×667 | 0.85 | selector | selector | selector | selector | selector | selector |
| 844×390 | 0.62 | selector | selector | rail | rail | rail | rail |

- Every cell: the rail is one vertical column with no sideways scroll, and
  page scroll is 0 × 0. Rail items and the selector are at least 44 px (the
  selector is 44 px tall and 325–783 px wide); head exits and footer buttons
  are at least 44 px.
- Compact list open (all 24 selector cells): every category in one vertical
  list, at least 44 px each, its box inside the viewport, and the pane hidden.
  Where the pane area is short the list scrolls inside itself: the Shop at
  375×667 and 844×390, Settings at 844×390. The Shop's list at 844×390 is
  99 px tall (about two items visible) because the run band, head and foot
  take the rest.
- Escape (a trusted key) with the list open closes the list, leaves the door
  open and puts focus on the selector, in all 24 cells; the pad's synthetic
  Escape does the same. With the list closed, Escape still closes Settings,
  the Armoury, Profile and the pile viewer. The Shop and the Compendium have
  no Escape exit; the kit's listener acts only while a list is open.
  Against dev's committed bundle at 390×844, Escape with Settings' list open
  closes all of Settings; on this branch it closes the list only.
- Keyboard through the router, in every selector cell (844×390 included):
  Enter on the selector opens the list with the cursor on the selected
  category, ArrowDown moves to the next, Enter picks it, the list closes, and
  the cursor returns to the selector, which now names the pick.
- Settings rows. Visited: Display, Audio, Accessibility and the four Advanced
  groups, which hold 22 toggles, 83 choice chips, 16 segmented tabs, 3
  ranges, 3 number fields, 1 text field, Open and Reset. Every control's hit
  span is at least 44 px (43.9 is the search tolerance against a 44 px
  floor). The dev figures are the W1a section's; before the 2 px row gap,
  this branch measured 41 px on wrapped chip rows.

| Viewport | Toggle drawn → hit | Chip height drawn → hit | Narrowest chip | Segmented height → hit | Open |
|---|---|---|---:|---|---:|
| 1440×860 | 61.4×33.0 → 61.9×44.9 | 41.6 → ≥ 43.9 | 44.0 | 41.6 → 44.9 | 81.2×44 |
| 1280×800 | 55.6×30.0 → 56.6×44.9 | 41.9 → ≥ 43.9 | 44.0 | 41.9 → 44.9 | 73.8×44 |
| 390×844 | 46.8×25.2 → 47.8×44.2 | 42.2 → ≥ 43.9 | 64.6 | 42.2 → 44.9 | 62.4×44 |
| 375×667 | 44.2×23.8 → 45.0×44.0 | 42.3 → ≥ 43.9 | 62.4 | 42.3 → 44.9 | 59.0×44 |
| 844×390 | 32.2×17.4 → 44.9×44.0 | 42.8 → 44.9 | 44.0 | 42.8 → 44.9 | 44.0×44 |

Tools: `tools/shopbars.mjs` S1 now opens the compact selector before it
reads every item on the glass; `tools/ui-sweep.mjs` R6 asks for the selector
contract (one selector above the pane that opens the views as a vertical
list); `tools/combat-hud-menus.mjs` opens the `[Pile ▾]` selector before
choosing Exhaust on a compact shape. `tools/tapsize.mjs` and
`tools/settingsreach.mjs` read `.set-cat-select`, which the kit's selector
keeps. `shopbars` and `ui-sweep` also wait up to a minute for their first
mount: the unbundled module route they open took 21.4 s to mount the Shop
here, past their 20 s and 15 s waits, and both timed out before any check
ran. Runs: `shopbars` all green, 12 checks (390×844 through the selector,
1200×730 on the rail). `ui-sweep --only armoury` passes R6 at 390×844 (one
selector above the pane, four views in a vertical list, no sideways scroll). `combat-hud-menus`: 13
passed and 4 failed. The pile viewer's checks pass at the desktop shape;
the four failures are the combat action-row geometry and the potion menu,
which this branch does not touch, and the potion failure stops the run
before the phone shape. `tapsize --quick` stops with "timed out waiting for
the overlay strip", and it does so identically against dev's committed
bundle. `settingsreach` still finds no Settings button at the bare bundle
URL (the startup gate, as recorded above). Playwright-based tools were not
run.

Limits: the threshold is still a budget, not a measurement of the drawn rail.
Chips narrower than the floor (S, L, XL) are now 44 px wide, a change of
drawn width that is an owner decision to confirm; their height and every
other control's drawn size are unchanged. In rail mode at 1440×860, Escape
does not close Settings on dev or on this branch; that is unchanged here. No
gamepad was attached; B was driven as the poller's synthetic Escape. Galaxy
S24 was not measured. The unbundled module route (`/?shot=…`) took about
21 s to mount the Shop on this loaded machine, and drive C: was nearly full
during the browser runs.
## Smith services on the W1 workspace (W1i / W1j / W1k)

Branch `claude/smith-w1ijk-workspace`, based on dev `8797fc9a`. The Smith's
three doors (Upgrade an Item, Extract a Card, Seat a Card) are W1 children
with no categories, so they draw no category rail. One pure model,
`src/ui/models/SmithWorkspaceModel.js`, decides the item rows, the compact
selector's face and which pane slots each service registers; the item
column's share is `wireframeUi.smith`. Every fact still comes from
`SmithSelectionModel` and `MountServiceModel`, and every commit still goes
through `smithServices.js` / the Shrine, unchanged.

- **Frame (W1).** `workspaceFrame` gives all three doors the W1 share of the
  viewport (95 × 90, centred). The header is the title and its exit only:
  the "Shrine action" eyebrow and the LEAVES/STAYS badge are gone. The
  footer is Back on the left and the service's verb on the right, equal
  halves; the consequence sentence moved out of the footer note.
- **Item column.** One kit `railItem` row per candidate (small art, name,
  "Tier 0 → 1" or "worn · 1 mount", and the owned-count pill), built by the
  shared `categoryNav` with `role=listbox`. Wide hosts show it as the left
  column at W1i's 44vw (clamped to 14–60rem); compact hosts fold it into one
  `[Selection ▾]` selector above the pane that opens the same rows as a list
  (rule 11: no tabs, no accordion). The rows are divs (`railItem` gained a
  `tag` option) because the shared inspection door hangs its `i` inside them.
- **Two taps kept.** Each row is bound to the inspection door before the
  navigation listens, so on touch the first tap lights the row and reveals
  its `i`, and the second chooses it (Constantine, 2026-09-12). Mouse and
  keyboard choose on one press, as before.
- **Pane (selection body).** A status line ("1 Smithing Stone · 3
  eligible"), then a DetailCard with only the slots the service declares, in
  the drawings' order:
  - W1i: selected item (art, name, tier step, owned count, kind and tags,
    which moved here from the old candidate cards), current → proposed stats
    and requirements, every affected card, then the cost.
  - W1j: selected item, mount selector, and once a mount is chosen the
    extraction preview (the card, "Sundering Hew leaves Greatsword and joins
    your deck.", and what the mount then shows), then the cost.
  - W1k: selected item, mount selector, the compatible deck cards once a
    mount is chosen, the install preview once a card is chosen, then the
    cost. Dependent choices still clear when a parent changes.
  - The cost row (REQ/AVAIL and any shortfall) is pinned at the foot of the
    scrolling card; the consequence line closes the pane. With nothing
    selected the pane shows the service's instruction.
- **Unchanged.** Plans, prices, revalidation, `armOptionDecision` (one tap
  reviews, a held press commits, a blocked action explains), focus
  containment, Escape/veil/✕ as Back, and the upgrade and receipt paths. An
  open compact list takes Escape first; the next Escape leaves the door.
- **Wording.** New copy in `uiStrings.csv`: `smith.selector.none`,
  `smith.items.*`, `smith.pane.status`, `smith.row.*`, `smith.preview.*`,
  `smith.heading.deck`.
- **Tools.** `armament-smithing-ui` reaches candidates through the compact
  selector, reads kind and tags from the selected item's head, checks the
  centred W1 frame instead of a full-viewport pane, expects selector + Back
  + Upgrade on compact hosts, and gains `COMPACT-LIST`. `holdconfirm` opens
  the Smith list before its two-tap candidate helper and its census.
- **Tests.** `tests/wireframe-smith-workspace.test.mjs` (5 tests) runs inside
  the existing wireframe line of `tests/run-node.mjs`.

Browser evidence (CDP emulation against the source tree; W1i through
`?shot=rest&shotSmithingStones=1`, W1j and W1k on a run built in the page
from source modules, see Limits):

| Viewport | Zoom | Frame | Header / exit | Items | Pane | Footer buttons | Page scroll |
|---|---:|---|---|---|---|---|---:|
| 1440×860 | 1.18 | 1368×774 | 78 / 44×44 | rail 633 w | 722×616 | 663 + 672 × 44 | 0 |
| 1280×800 | 1.07 | 1216×720 | 74.9 / 44×44 | rail 562 w | 641×568 | 588 + 597 × 44 | 0 |
| 390×844 | 0.90 | 370.5×759.6 | 63 / 44×44 | selector 350.5×44 | 368.5×575.8 | 171 + 174 × 44 | 0 |
| 375×667 | 0.85 | 356.3×600.3 | 62 / 44×44 | selector 337.3×44 | 354.3×419.1 | 165 + 167 × 44 | 0 |
| 844×390 | 0.62 | 801.8×351 | 62.3 / 44×44 | rail 370 w | 428×224 | 387 + 393 × 44 | 0 |

- The same frame, header, item column, pane and footer measure identically
  for all three doors at each size. The only visible heading is the door's
  title. The cost row stays inside the card at every size.
- Targets: every row, selector, mount row, deck card, fold, Back and verb is
  at least 44 px and centre-hit-testable, open compact list included. The one
  smaller control is the shared card `i` on W1k's deck cards (40.5 px), drawn
  by `renderCard` and unchanged here.
- Flows, at every size: Upgrade → review "Upgrade Straight Sword? … 1/1" →
  confirm left for the map. Extract → review → confirm moved Sundering Hew
  from Greatsword into the deck (10 → 11 cards). Seat, on the emptied mount,
  → review → confirm moved it back (11 → 10). Compact: Escape closed the open
  list and kept the door.
- `armament-smithing-ui`: 73 passed, 9 failed. On dev `8797fc9a` it is 66
  passed, 15 failed.
  - The 9 REDs all fail on dev too: SELECTED-NAME-TYPE and ROLE-USAGE at both
    sizes, ARMOURY-RECEIPT and ARMOURY-CARDS at both sizes, and
    COOP-SHOT-DOOR.
  - The four FIT checks and the two 390×844 TARGETS checks that fail on dev
    now pass, and COMPACT-LIST is new.
  - Two earlier runs died at the tool's fixed 15 s first load, with CPU at
    100% under other sessions' suites. That is a load-induced timeout,
    identical on dev under the same load; the 60 s-wait probe above is the
    functional evidence.
- `holdconfirm` on dev `8797fc9a`: 1 finding over 137 checks, the Shrine smith
  census's "2 absent: smithExtract, smithInstall" already recorded above. The
  branch run did not finish inside the time budget under that load.
- `run-node` 138 passed, 0 failed. One run under load failed only its
  `linkcheck --selftest` line (no result line). Run alone, the selftest
  passes: 5/5 planted breakages go red and the clean tree comes back with 0.

Limits:
- A fresh class kit carries no card tagged `extractable`, so the Shrine shot
  offers no extraction and no seating. W1j and W1k were driven through
  `openMountService` on a run built in the page (the first armament whose
  mount holds an extractable card: Greatsword), not reached from a Shrine.
  No reach door was added.
- W1j/W1k's tables stack items, mounts and preview as three rows; their wide
  drawings put the items beside the pane, as W1i does. This branch follows
  the drawings; the owner should confirm.
- At 844×390 the host is `data-layout=wide`, so the items stay a rail beside
  a 224 px pane, as the Shop does; W1's compact drawing puts a selector
  above.
- The consequence sentence left the footer for the pane's last line, beside
  the cost; the LEAVES/STAYS badge is gone from the header. Both are owner
  decisions to confirm. Extract and install cost 0 Stones under the current
  balance, so their shortfall row was not exercised.
- Playwright tools (`card-inspection-qa`, `world-atlas-qa`) were not run;
  their Smith selectors (`.smith-candidate-card`, `.card-info-button`,
  `.smith-upgrade-modal .modal-close`) still exist.
## Possession sub-variants (WC2a1, WC2a2, WC2b1, WC2b2, WC2c1–WC2c3)

Branch `claude/possession-subvariants`, based on dev `8797fc9a`. The one
poker canvas still draws every possession card; a new DOM-free
`src/ui/models/PossessionVariantModel.js` decides which wireframe rows each
of its regions carries, from the item's own data. No row switches on an item
id, and a row the data cannot state is left off and recorded in the model's
`omitted` list rather than filled in. Families compose: four relics are both
WC2b1 and WC2b2.

- Classification: armour is `kind: 'armor'` or the `item:armor` tag; an
  armament is a weapon because it authors the hand it is held in. A relic is
  passive when `passives` sets a modifier or key, triggered when it authors
  `triggers`. A potion's purpose comes from each effect opcode: `heal` →
  WC2c1, `restore<Resource>` naming a registered resource → WC2c2, any other
  op → WC2c3; a scripted effect states no purpose.
- WC2a1 weapon: row one is Hand / requirements (the authored attribute
  requirement, else the authored hand, now read from `hand` instead of a
  literal). Detail one keeps Attack / Defense / Weight. The effect row is
  Granted card package: the weapon-art card name(s) from `weaponCardPackage`,
  then the authored modifiers.
- WC2a2 armour: detail one is the authored Poise threshold; row one keeps the
  class-outfit requirement; the effect row is Granted modifiers.
- WC2b1 / WC2b2 relic: row one reads Relic / Active while owned (it used to
  call every relic Passive, and 48 of 55 are triggered). The fact region
  becomes two text lines, detail one of each family first: `Passive:` the
  numeric modifiers as authored, `Trigger:` the event labels; then
  `Affects:` and `Limit:` (once per combat / per turn / No limit). The effect
  row is the relic's effect text.
- WC2c1–WC2c3 potion: row one names the purpose (Potion · Healing). Lines:
  `Heals 25% of max HP`, `Restores 1 MP` (marked with the registered MP
  tint), `Strength 2 · Self`, `Crimson Blight 4 · Enemy`, `Block 15 · Self`;
  `Charges: n` only when a host passes `charges`.
- Face budget (`wireframeUi.possession`): two lines, one effect entry. Later
  rows stay on the card with `hidden`, so the inspection lists all of them;
  a hidden effect entry shows the existing `…`.
- A card with no tag badges (every relic and potion) collapses the empty tag
  row (`equipmentCardTokens(…, { collapse: ['tags'] })`); the effect row gets
  its 14 px, so two-line relic text is no longer cut. Artwork stays 270 px.
- The Damage / Defense value cells drop their row padding and value margin
  so value and label fit the solved 40 px row.
- New copy is `possession.*` in `content/source/uiStrings.csv`; the model is
  covered by `tests/wireframe-possession-variants.test.mjs` (in the run-node
  wireframe line) and a collapse case in `tests/equipmentCard.test.mjs`.

Browser evidence (CDP against `item-cards-preview.html`, all 103 item cards,
each 280 px wide at card scale 0.8; the same probe on a dev `8797fc9a` tree):

| Viewport | Page scroll | Cards with a clipped or overflowing region | Of which relic / potion |
|---|---:|---|---|
| 1280×800, dev | 0 | 103 of 103 | 60 of 60 |
| 1280×800, branch | 0 | 22 of 103 | 0 of 62 |
| 390×844, dev | 0 | 103 of 103 | 60 of 60 |
| 390×844, branch | 0 | 22 of 103 | 0 of 62 |

- The 22 remaining are weapons whose tag row is wider than the card
  (333–397 px in 310 px); that row is unchanged from dev and not a WC2a1 row.
- Region heights (layout px): equipment art 268, row one 20, detail one 39
  (content 39, was 44 on dev), tags 18, effects 54, flavour 13, footer 16;
  relic and potion tags 0, effects 68, flavour 17.
- Ellipsis (text kept whole in its tooltip and the inspection): five relic
  effect texts past two lines and Cutpurse's Coin's paired `Limit:` line.
- Inspection of Forsaken Medallion lists the two face-hidden lines; the
  greatsword inspection lists its weapon art and all three modifiers; the
  flask door (no registries) still reads `Restores 1 MP`. No page errors.

Tools: `tools/armament-smithing-ui.mjs` (CDP) reports 66 passed, 15 failed,
the same 15 RED checks by name as on dev `8797fc9a`. Two earlier runs here
stopped at its 15 s wait for the Shrine Smith option, while other jobs
shared the machine: boot served from the worktree root took 16–27 s. The
same query served from a clean tree reaches the option in 2.0–3.0 s with
this branch's sources and 2.2–9.9 s with dev's, so the branch does not slow
boot. Its screenshots under `docs/preview/` were restored, not committed.
`tools/weapon-card-preview.mjs` (CDP) stops at "Timed out: preview and art"
on dev and on this branch alike, before any card check; it was not fixed
here. `tools/onevocab.mjs` passes 7/7: the model names all three declared
relic-modifier tags, including `resource.attributeTier`, which no shipped
relic uses yet. Its self-test catches 12 of 12 plants.
`tools/character-creation-check.mjs` (CDP, clicks the creation equipment
cards) passes 128/128. Served from clean trees, dev `8797fc9a` gives the
same check list.
Playwright-based tools (`card-inspection-qa`, `starting-equipment-qa`,
`tooltip-review-qa`) were not run. The selectors they read
(`.equipment-poker-card`, `.epc-name`, `.epc-flavor`, `.epc-art img`,
`.card-info-button`) are unchanged by this branch.

Limits: WC2a Equipped comparison is still not built (the face has no loadout).
No per-weapon attribute scaling, armour weight or armour resistance is
authored, so those parts of their rows are absent. The heal line is the
authored base amount, not a live capped preview. No host passes potion
charges yet. Trigger `if` conditions are not described beyond the event; the
effect text states them. Row one shows the hand only when no attribute
requirement is authored (every armament is `either` today). Wide, compact,
iPhone SE and Galaxy S24 host geometry was not re-measured beyond the two
viewports above.
## Tool upkeep

Branch `claude/repair-stale-qa-tools`, based on dev `8797fc9a` (#1080).
Only tools changed; no game source, stylesheet or bundle was edited. Each tool
was run on dev before the change and on the branch after, in headless Chrome
driven over CDP with `CHROME` set. Playwright-based tools were not run.

- `tools/ui-components.mjs` C12: matches the current call,
  `actRouteStripHtml({ title: actTitle(run.actNumber, …) })`. Since the W4b
  header (#1052), `actTitle` also receives the seat name, so the check pins
  the call and its first argument and lets the rest vary. Dev: C12 red.
  Branch: 21/21 contracts hold, and `--selftest` sees 26/26 plants red.
- `tools/scroll-cue-bleed.mjs`: measures the Shop at its two W1d
  scrollports, `.shop-offers` and `.shop-detail`, as the surfaces
  `shop-offers` and `shop-detail` (`--surface shop` selects both).
  `.screen.shop-workspace` never scrolls, so on dev every Shop cell passed
  with 0 px of travel and measured nothing. At 360×640 the offers pane now
  travels 806 px (Text M) and 1785 px (Text XL), each with a measured
  right-edge cue. The three plants now target these panes:
  - the house thumb the panes inherit from `.as-pane`;
  - a cue forced to show in an emptied offers pane;
  - a pane drawn with `scrollbar-width: none`.

  `--selftest-source` catches 3/3 and the clean copy passes. Navigation
  waits are 45 s, because a cold `?shot=` boot ran past the old 12 s limit
  on this host. Full run: GREEN across 65 cells. On phones the offers pane travels 505 to
  1785 px, and 580 px at 1200×730. The detail pane never travels, and no
  cue is left standing.
- `tools/combat-action-row.mjs` (not in CI) asserts the WGC6 footer,
  (Actions) [Draw] [End Turn] [Discard] (Potions), in one grid on a supported
  `packCombatFooter` plan. Each size is read back from the `--footer-*`
  properties the layout adapter wrote:
  - circles share the model diameter;
  - piles take the pile width and target height, and End Turn takes the
    End Turn width;
  - the controls are separated by the model gap;
  - on a stacked host the group is centred.

  On a rails host (844×390), (Actions)[Draw] must lead the hand and End
  Turn must stand over [Discard](Potions). The tool also changed how it
  measures:
  - round controls are hit-tested inside their circle;
  - cards and pagers are clipped to their scroll area before overlap is
    tested;
  - the W1h pile viewer closes by its single Close;
  - on narrow hosts the Exhaust rail item is scrolled into view the way a
    swipe does, and the tool says when that was needed.

  Co-op is held to its own rail: Actions and End Turn in flow under the
  hand, at opposite edges. The plants moved to the WGC6 and co-op rules.
  Dev: exit 1, with 240 findings before the co-op probe crashed. Branch:
  GREEN, solo 112 and co-op 2; the Exhaust rail item needed rail travel in
  24 narrow cells. `--selftest-source`: 10/10 plants caught (7 narrow, 1 wide, 2
  co-op), and each clean copy passes. The centring
  plant runs on 1200×730, because on a phone the packed group fills the
  whole row.
- `tools/settingsreach.mjs` passes the startup gate with a real CDP Enter
  press, as `tools/startup-gate.mjs` does. It keeps the durable boot,
  because `?shot=title` runs on memory storage and the tool sets Text size
  and reads the remembered section through real storage. It waits on the
  page, not on fixed sleeps. Four more readings from before W1a were
  repaired:
  - the Display scroller is found from its last row, because the pane sits
    inside the settings host;
  - the selector is judged against the door, not the pane;
  - the tooltip ruler polls through the player's delay and starts each fire
    from a tooltip closed by `tooltip.js`, with the Actions orb as the
    known-good control, since cards no longer carry one;
  - the stored-category edge reboots before reading.

  Dev: exit 2, no Settings button in any cell. Branch: OK across 8 cells,
  with 6/6 tabs answering both hover and the pad. Door 2 (two tab sets in
  the in-run overlay) still skips as it did on dev; the OK line now says so
  instead of claiming it.
- `tools/profile-surface-drive.mjs`, `tools/restore-settings-drive.mjs`,
  `tools/profile-first-run.mjs`: unchanged. The startup gate is not the
  root cause. Title → Profile was removed in `e5df3fec`: `title.js` voids
  `onProfile`, and Settings says it does not duplicate the drawer. So no
  player door reaches `openProfileArchive`, only `?shot=profile`. All three
  also used fixed sleeps shorter than a cold boot here. Dev and branch:
  exit 1, before any Profile screen.
- `tools/map-camera-persistence.mjs`: #1039 is still open, so the tool was
  left alone and not run.
- `tools/plantsites-baseline.json` was re-recorded, because the
  scroll-cue-bleed and combat-action-row plant sites were replaced.

Limits: on narrow hosts the pile viewer's rail shows one pile name at a
time, and Exhaust starts off the edge until the rail scrolls; that is
recorded, not judged. The comment beside the Shop pane rule in
`styles/kit.css` says the thumb colour comes from `.screen`; it comes from
`.as-pane`. Both are left for the owner.
