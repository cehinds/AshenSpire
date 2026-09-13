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
- The hand/footer minimums leave insufficient readable battlefield height at
  844×390. The compact landscape appearance remains unresolved, not verified.

## Validation evidence and limits

Targeted card-cost, hand-layout, formation, and sprite-scale tests pass, as do
selection-store tests. The reference validator reports 152 entries and 608
views with no consistency failures; this is not runtime parity evidence.

Browser checks covered 1440×860, 375×667, 360×780, and 844×390. On iPhone SE,
selecting an adjacent card changed exclusive selection without spending an
action; its information control opened the real inspector, and Back restored
focus. Wide selection preserved the measured ground anchors and shared base
sprite scales. Compact landscape remains too compressed. Full drag/snapping,
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
- The run HUD plus route strip still take about 17% rather than W4b's 10%
  header; narrowing them means redesigning the shared HUD.
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
  844×390 reports unsupported; text and targets are not shrunk.
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

Limits: compact landscape still needs an owner decision (suggest rotation,
scroll, or relax minimums). `tools/combat-action-row.mjs`, which is not in
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

## Remaining integration

Complete the card and hand interaction matrix, compact containment, combatant
inspection and roster stress cases; then integrate and verify dependent
screen shells, equipment, progression, rewards, and remaining overlays against
every coverage entry. No issue or draft implementation PR has been published
for these uncommitted changes.
