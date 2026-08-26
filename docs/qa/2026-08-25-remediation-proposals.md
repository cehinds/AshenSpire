# AshenSpire QA remediation proposals — updated against build 0.4.0.1362

## Status

The baseline findings came from build `0.4.0.1356`. Four bounded remediations
are now implemented in the integrated delivery candidate, build `0.4.0.1362`
(`20424f3657`) on `origin/dev@16d9181d`. All remaining rows are proposals.

| Local remediation | State | Evidence still required before delivery |
|---|---|---|
| Full-width Assign Points disclosure (`stat-allocation-row`) | Implemented; in-app visual pass | phone matrix and focused browser gate |
| Uniform Shrine folded footprint (`shrine-option-card`) | Implemented; in-app visual pass | phone matrix; semantics/confirmation remain separate P1 work |
| Dedicated Smith choose/review/confirm modal (`smith-upgrade-modal`, `smith-candidate-card`, `smith-upgrade-preview`) | Exact-build browser QA PASS in 1361; exact integrated behavior recheck PASS in 1362 | Hosted deployment and real-device Safari remain separate evidence |
| Armoury 45vh default, 30vh minimum, 30–90vh snaps, session-only memory (`folding-tray`) | Implemented; one/two-tray in-app visual pass | drag, touch-hold, keyboard snap, fold/reopen, and new-session reset browser checks |

### Current verification boundary

- Exact integrated Node suite: `110 passed, 0 failed`.
- Shipped aliases: `6/6` byte/provenance checks passed and the root/build/dist
  artifacts are byte-identical for build `0.4.0.1362` (`20424f3657`).
- Smith exact-build browser recheck: desktop transaction flow and 390x844
  geometry PASS; Back/Escape restore focus; Confirm leaves the Shrine; zero
  warning/error console entries.
- Component contract check: one pre-existing unrelated failure remains:
  `C8 combat composition lacks stable Battlefield/Frame/Hand/Action references`.
- The phone viewport matrix and tray interaction transitions are still pending;
  screenshots alone do not close those behavior gates.

Evidence comes from the Codex in-app-browser QA pass documented in `2026-08-25-build-0.4.0.1356.md`. Screenshots prove visible state; behavior acceptance also requires state-transition assertions.

Four proposal owners contributed independently:

- **Core-flow lane:** persistence, rebinding, and shrine transactions.
- **Creation/controls lane:** attributes, title, slot selection, Settings/Controls, and fullscreen.
- **Armoury/inspection lane:** trays, item receipts, presentation toggles, tooltips, and combatant inspection.
- **Integration lane:** the shared event/model/service/component structure and incremental delivery order below.

## Shared structural proposal

The repeated failure pattern is split ownership: the visible card, enabled command, stored selection, and confirmation behavior can disagree. Each vertical slice should instead use one immutable presentation model, semantic events, and one service boundary.

```text
Pointer / Touch / Keyboard / Pad
                │
                v
        semantic UI event
                │
                v
 Screen controller / event reducer
                │
        ┌───────┴────────┐
        v                v
 application service   domain command
        │                │
        └───────┬────────┘
                v
 immutable presentation model
                │
                v
 shared component renderer
```

Recommended source boundaries, evolved incrementally rather than through one bulk move:

```text
src/ui/contracts/        model and event schemas
src/ui/models/           immutable screen/component presentation models
src/ui/events/           semantic UI events and reducers
src/ui/services/         selection, confirmation, input, tray, tooltip services
src/ui/infrastructure/   browser storage, fullscreen, pointer and viewport adapters
src/ui/components/       reusable DOM renderers and behavior binders
src/ui/views/            screen composition only
src/ui/screens/          compatibility controllers during migration
```

Common model shape:

```js
{
  id, kind, variant,
  props,
  slots: { header: [], body: [], actions: [] },
  behaviors: [{ event, action, enabled, policy, refusal }],
  tokens,
  accessibility
}
```

Renderers own DOM and CSS. Models own labels, ordering, selection, availability, disclosure, and composition. Services own browser or stateful behavior. Controllers translate semantic events into game commands.

## Proposal inventory — all 27 observations

| # | Observation | Proposed owner | Reusable proposal | Evidence |
|---:|---|---|---|---|
| 1 | Load slot looks selected while Continue is disabled | `LoadSelectionModel` | Required single-select card group; selected click is idempotent | `23-load-active-slot-can-deselect.png` |
| 2 | New-game slot loses selected styling | `SaveSlotSelectionModel` | Same selection card and state contract as Load | `02-main-menu.png` plus behavior trace |
| 3 | Combat Save resumes a restarted/refunded encounter | `CombatSnapshotService` | Versioned exact snapshot or explicitly renamed checkpoint contract | `22-continue-restarts-combat-resources.png` |
| 4 | Quit confirmation uses an inconsistent native prompt | `ConfirmationService` | Shared themed destructive confirmation overlay | behavior trace; screenshot blocked by native dialog |
| 5 | Escape can bind End Turn and close Controls | `RebindCaptureService` | Reserved-key cancellation before menu dispatch | `13-controls-escape-binding-conflict.png` |
| 6 | Binding conflicts have no explicit resolution | `BindingConflictModel` | Choose another / replace / cancel dialog | `13-controls-escape-binding-conflict.png` |
| 7 | D, R, and T all read “Armoury” | `ActionRegistry` | One label/accessibility registry for hints and Controls | `08-new-run-map-controls.png` |
| 8 | Wide Controls wastes space | `ControlsScreenModel` | Centered, clamped action/keyboard/pad table | `13-controls-escape-binding-conflict.png` |
| 9 | Shrine options are card-like but not semantic buttons | `ShrineOptionModel` | Shared actionable disclosure card | `28-shrine-options-no-exit-confirmation-desktop.png` |
| 10 | Rest commits without review | `PendingShrineAction` | Before/delta/after confirmation; label that it leaves shrine | `28-shrine-options-no-exit-confirmation-desktop.png` |
| 11 | Level Up needs exact cost/result confirmation | `LevelUpReviewModel` | Current value, +1, cost, remaining cinders, one-point lock | `29-shrine-expanded-desktop.png` |
| 12 | Smith is an unlabeled grid and commits on card click | `SmithSelectionModel` | **Closed locally in 1361:** dedicated modal; reversible choose/review; explicit confirm; desktop and 390x844 QA PASS; [write-up](2026-08-25-smith-modal-design.md) | `30-smith-upgrade-selection.png`; `smith-modal-1361/05-smith-review-final-1280x720.png`; `smith-modal-1361/08-smith-review-390x720.png` |
| 13 | Attribute rules disagree across screens | `AttributeRuleCatalog` | Mechanics and all copy derive from one config | `04-character-attributes-expanded.png`, `05-assign-points-strength-rule-mismatch.png` |
| 14 | Allocation disclosure only spans one column | `AttributeAllocationCardModel` | **Local 1358:** expanded child spans the full invisible allocator row | `05-assign-points-strength-rule-mismatch.png`; `ui-contract-preview-1358/attribute-allocation-desktop.png` |
| 15 | Attribute descriptions/bonuses need reusable data | `AttributePresentationModel` | Short description plus generated mechanical bullet list | `04-character-attributes-expanded.png` |
| 16 | Title panel is opaque; mobile width-centering still needs proof | `StartupGatePresentationModel` | Transparent surface, viewport-centered mark, responsive width clamp | `01-title-entry.png` |
| 17 | Fullscreen can be offered unsupported and does not prove recenter | `FullscreenCapabilityAdapter` | Drive state from actual lifecycle; recenter after viewport settles | `10-mobile-map-before-fullscreen.png`, `11-mobile-after-fullscreen-toggle.png` |
| 18 | Armoury defaults show dead space instead of a useful first opening | `TrayLayoutService` | **Local 1358:** authored 45vh first-open height | `20-armoury-inventory-default-trays.png`; `ui-contract-preview-1358/armoury-two-trays.png` |
| 19 | Expanded trays can be about 9.2vh tall | `TrayLayoutService` | **Local 1358:** every supporting tray retains at least 30vh | `18-armoury-hybrid-all-trays-open.png`; `ui-contract-preview-1358/armoury-two-trays.png` |
| 20 | Required snap stops are inconsistent | `TraySnapPolicy` | **Local 1358:** authored 30/40/50/60/70/80/90vh stops | `18-armoury-hybrid-all-trays-open.png` |
| 21 | Fold/reopen should restore last expanded size | `TrayStateStore` | **Local 1358:** in-memory per-tray state; resets on new/resumed run and Title | `19-armoury-character-trays.png` |
| 22 | Armament values/equipped receipts can be misleading | `EquipmentReceiptModel` | One computed stat receipt and one slot-specific equipped chip | `14-armoury-hybrid.png` |
| 23 | List/grid presentation needs clear accessible state | `PresentationToggleModel` | Labeled two-state control with `aria-pressed`/selected state | `14-armoury-hybrid.png` |
| 24 | Tooltips can linger and can open toward an edge | `TooltipPlacementService` | Center-seeking placement plus global dismissal lifecycle | `06-tooltip-lingers-after-assignment.png` |
| 25 | Combatants lack touch-readable details | `CombatantInspectorModel` | Tap/click expanded inspector, 0.5s folded hover, player-left/enemy-right tray | `17-combat-healing-after.png` |
| 26 | Advanced copy still claims it contains Changelog | `SettingsContentCatalog` | Current concise copy generated from category ownership | Settings QA trace |
| 27 | Shrine folded options use visibly different footprints | `ShrineOptionModel` | **Local 1358:** one data-owned viewport width/height for Rest, Smith, Flask Allocation, and Level Up | user screenshot; `ui-contract-preview-1358/shrine-uniform-folded.png` |

## A. Required selection and persistence

### Issue screenshots

![Load selection state and Continue disagree](../../tools/results/current-build-ux-audit/23-load-active-slot-can-deselect.png)

![Continue returns to a restarted combat](../../tools/results/current-build-ux-audit/22-continue-restarts-combat-resources.png)

### Proposed layout

```text
LOAD GAME
┌────────────────────────────────────────┐
│ (●) SLOT 1  Reaver · Floor 1 · 68/68  │ [Delete]
│ ( ) SLOT 2  Empty                     │
│ ( ) SLOT 3  Empty                     │
└────────────────────────────────────────┘
[ Back ]                      [ Continue ]
```

```text
SAVE & QUIT?
┌────────────────────────────────────────────┐
│ Slot 1 · Combat · Player turn              │
│ Restores this exact encounter, resources,  │
│ hand, piles, intent, phase, and turn.       │
└────────────────────────────────────────────┘
[ Cancel ]                    [ Save & Quit ]
```

Recommendation: keep the name **Save Game** only if exact combat snapshots are implemented. Otherwise rename it **Save Checkpoint** and explain that combat restarts with restored node-entry resources.

## B. Controls and command truth

### Issue screenshot

![Escape is assigned to both Cancel and End Turn](../../tools/results/current-build-ux-audit/13-controls-escape-binding-conflict.png)

### Proposed desktop layout

```text
CONTROLS
┌────────────────────────────────────────────────────┐
│ Action                    Keyboard     Gamepad     │
│ Confirm / Play            [ Enter ]    [ A ]       │
│ Cancel / Back             [ Esc   ]    [ B ]       │
│ End Turn                  [ E     ]    [ X ]       │
│ Deck                      [ D     ]    [ Y ]       │
│ Armoury                   [ R     ]    [ LB ]      │
│ Character                 [ T     ]    [ RB ]      │
└────────────────────────────────────────────────────┘
```

```text
REBIND END TURN
Current: E
Press a key…

Esc cancels this rebind.

F is already assigned to Use Flask 1.
[ Choose another ] [ Replace ] [ Cancel ]
```

Keep the current mobile stacking. Clamp only the wide-screen table, align input columns, and keep the help text adjacent to the binding it explains.

## C. Shrine transactions

### Issue screenshots

![Shrine choices commit without a review step](../../tools/results/current-build-ux-audit/28-shrine-options-no-exit-confirmation-desktop.png)

![Smith selection has no title, preview, or confirmation](../../tools/results/current-build-ux-audit/30-smith-upgrade-selection.png)

### Proposed flow

```text
SHRINE OF EMBER
┌────────────────────────────────────────┐
│ [♨] Rest · HP +16 · MP +3             ▸│
│ [⚒] Smith · Upgrade one card          ▸│
│ [⚗] Reallocate · 4/4 assigned         ▸│
│ [✦] Level up · 800 cinders · +1       ▸│
└────────────────────────────────────────┘
```

```text
REST — REVIEW                         LEAVES SHRINE
┌──────────────────────────────────────────────┐
│ HP 34  +16  -> 50/50                         │
│ MP  1   +3  ->  4/4                         │
│ This ends your shrine visit.                 │
└──────────────────────────────────────────────┘
[ Back ]                              [ Rest & Continue ]
```

```text
SMITH — CHOOSE ONE CARD                    20 eligible
[ Back to shrine ]

[ Slashing Strike ] [ Shield Defend ] [ ... ]

SELECTED: SLASHING STRIKE
Before: Deal 7 damage.
After:  Deal 10 damage.                 LEAVES SHRINE
[ Back ]                           [ Review Upgrade ]
```

All committed shrine choices use one `PendingShrineAction` and one review overlay. First click selects; only the final action commits.

## D. Character attributes

### Issue screenshot

![Attribute rule mismatch and narrow expanded disclosure](../../tools/results/current-build-ux-audit/05-assign-points-strength-rule-mismatch.png)

### Proposed allocator card

```text
ASSIGN POINTS
┌──────────────────────────────────────────────┐
│ STR                               13  [-][+] │
├──────────────────────────────────────────────┤
│ Strength — raw force                         │
│ • Strike damage = -6 + STR                   │
│ • Greatsword requires STR 12                 │
└──────────────────────────────────────────────┘
│ DEX                               11  [-][+] │
│ CON                               14  [-][+] │
```

The expanded child occupies the full allocation grid width. `AttributeRuleCatalog` supplies the mechanics, short copy, thresholds, and generated bullets to Character, creation, shrine level-up, tooltips, and tests.

## E. Armoury tray system

### Issue screenshots

![Open trays have almost no usable content height](../../tools/results/current-build-ux-audit/18-armoury-hybrid-all-trays-open.png)

![Short lists leave large dead space](../../tools/results/current-build-ux-audit/20-armoury-inventory-default-trays.png)

### Proposed sizing behavior

```text
ONE OPEN TRAY — first opening in a play session
┌ INVENTORY · 5 ITEMS ────────────────────────┐
│ item                                        │
│ item                                        │  default 45vh
│ item                                        │
└─────────────────────────────────────────────┘

THREE OPEN TRAYS
┌ INVENTORY ─────────────────────── min 30vh ┐
│ internal scroll                            │
├ CARDS ────────────────────────── min 30vh ┤
│ internal scroll                            │
├ STATS ────────────────────────── min 30vh ┤
│ internal scroll                            │
└────────────────────────────────────────────┘
Each tray owns its scrollport; no expanded tray may shrink below 30vh.
```

Authored snap stops: `30vh | 40vh | 50vh | 60vh | 70vh | 80vh | 90vh`.
The first opening defaults to `45vh`. Folding returns to header height; reopening
restores the last expanded stop for that tray during the current play session.
Starting or resuming a run, or returning to Title, clears fold and size memory.

Default open state remains view-specific: Character opens Character; Inventory
opens Armaments and Inventory; Hybrid opens Armaments. Supporting-tray fold and
height memory is keyed by stable tray ID and exists only in memory for the
current play session.

Each item face shows name, category/slot, one or two salient stats, count, and a textual location such as `Equipped · Right Hand 1`. Expanded comparison owns explicit actions such as `Equip to Left Hand 1`, `Move Right Hand 1 -> Left Hand 1`, and `Unequip from Armour`. Hover remains an enhancement, never the only way to read a comparison.

List/Grid is a labeled segmented control, separate from Sort:

```text
ARMAMENTS · 3                         [ List | Grid ]  v
```

Each face remains at least 44px, exposes selected state semantically, and preserves the selected item while presentation changes.

## F. Tooltips and combatant inspection

### Issue screenshot

![Combatant status is visible but no touch details surface exists](../../tools/results/current-build-ux-audit/17-combat-healing-after.png)

### Proposed placement and inspector

```text
TOP 25% OF VIEWPORT     tooltip opens below/centerward
LEFT 30%                tooltip opens right/centerward
RIGHT 30%               tooltip opens left/centerward
MIDDLE                  tooltip opens above
```

```text
┌ PLAYER DETAILS ┐                           ┌ ENEMY DETAILS ┐
│ HP / Block     │    [ BATTLEFIELD ]        │ Intent        │
│ Statuses       │                           │ Statuses      │
│ Active skills  │                           │ Active skills │
└────────────────┘                           └────────────────┘
     player click/tap -> left tray       enemy click/tap -> right tray
```

Touch/click opens the expanded inspector. Desktop hover/focus after configurable `0.5s` opens the folded tooltip. Clicking away, screen transition, mutation of the anchor, or closing the tray dismisses it. Tooltip placement always prefers the viewport center and offsets only when it would cover key combat information.

Only one combatant inspector is open at once. Its folded rail remains a 44px target; its expanded body is approximately `20rem`/`34vw` maximum on desktop and `62vw` maximum on narrow screens, with internal scroll. Armed targeting always wins over inspection, and the open model updates live as HP, Block, Poise, intent, skills, or statuses change.

## G. Responsive and copy polish

### Issue screenshot

![Opaque title card behind the startup mark](../../tools/results/current-build-ux-audit/01-title-entry.png)

### Proposed title treatment

```text
                  ASHEN SPIRE
              A ROGUELIKE DECKBUILDER
                     ──◇──
              PRESS ENTER OR SPACE

transparent card surface and border
viewport-centered as one measured mark
```

Fullscreen is hidden or disabled when unsupported. When supported, the adapter waits for `fullscreenchange`, visual viewport resize, and one layout settle before recentering the current map node. Advanced copy becomes: “Optional gameplay rules, interface tuning, and diagnostics.”

## Proposed incremental delivery order

1. **Stabilize the local remediation branch:** finish browser behavior checks for allocation geometry,
   uniform Shrine cards, tray snap/fold/session reset, then rerun exact-head gates.
2. **Persistence (P1):** Load/New selection first; then explicitly choose exact
   combat snapshot versus renamed checkpoint semantics and implement that contract.
3. **Input (P1):** Escape-safe capture and an explicit replace/cancel conflict flow.
4. **Shrine transactions (P1):** semantic actions, one shared review overlay,
   Rest, Level Up, and Smith choose/preview/confirm flows. Uniform card size alone
   does not close these findings.
5. **Attribute rules (P1):** reconcile the authored formula catalog with the
   actual engine calculations. The local full-width disclosure closes layout only.
6. **Combat inspection (P1):** edge-aware tooltip service, combatant semantics,
   tap/click inspectors, outside-click dismissal, and foldable side trays.
7. **Controls and action labels (P2):** distinct D/R/T destinations plus the
   centered, clamped desktop binding table.
8. **Responsive polish (P2/P3):** transparent centered title surface, fullscreen
   capability/recenter, and current Settings copy.
9. **Integration:** preserve the dirty lane, isolate source commits, integrate
   sequentially, regenerate once, then run targeted and full QA at desktop,
   `390x844`, and `320x640` with behavior receipts and screenshot pairs.

## Evidence and decision limits

- Screenshots do not prove focus order, screen-reader output, saved-state round trips, or event consumption. Those need behavioral tests.
- The exact-save versus checkpoint-save choice materially changes the persistence implementation; this document recommends exact save because the current button says **Save Game**.
- Real iPhone Safari fullscreen remains device evidence, not something the in-app responsive override can certify.
