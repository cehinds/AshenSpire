# QA Testing

This is the repeatable player-flow review for an AshenSpire build. It complements automated gates; it does not replace them.

## Evidence contract

Record all of the following before judging a build:

- exact playable artifact, build number, and displayed source receipt;
- local branch/HEAD and whether the worktree contains unbundled edits;
- browser, viewport, input method, and save slot used;
- a screenshot for every visual finding;
- before/after state for behavioral findings;
- a clear `PASS`, `FAIL`, `BLOCKED`, or `NOT RUN` verdict.

A screenshot proves pixels only. A behavior requires a state transition or command-log observation as well.

## Feature design-build-QA loop

Use the complete reusable contract in [FEATURE-DELIVERY-LOOP.md](FEATURE-DELIVERY-LOOP.md).
For every player-facing feature:

1. write the observed problem, acceptance criteria, affected stable component IDs,
   and an ASCII state/flow illustration before editing;
2. identify the existing model, component, service, and design-system primitives to reuse;
3. implement source changes without regenerating shipped aliases mid-edit;
4. run focused static/model checks, then regenerate the build once after source freezes;
5. test the real player flow in the selected browser, including cancel/back, keyboard,
   destructive confirmation, focus return, responsive geometry, and console state;
6. compare the screenshot to the approved illustration and acceptance criteria;
7. if any criterion fails, record the finding, redesign the smallest responsible
   model/component, rebuild, and repeat the same focused test;
8. publish screenshots plus behavior evidence, update the component catalogs and
   relevant docs, then report local, pushed, merged, hosted, and released state separately.

## Core pass

Run these in order so later steps exercise real state produced by earlier steps.

1. **Startup and title**
   - Enter by pointer and keyboard.
   - Check title centering, opacity, build receipt, responsive fit, and quick display/audio controls.
2. **Save slots**
   - Open Continue, Load, and New.
   - Select each available slot once.
   - Confirm the selected card, primary action state, deletion boundary, Back, and Close.
3. **Character creation**
   - Test list/grid class selection.
   - Expand each attribute card and compare every displayed rule to the configured calculation.
   - Test point assignment, reset, name, seed, starting equipment, and Back/Begin.
4. **Map**
   - Confirm current-node centering after entry, resize, fullscreen lifecycle, and return from menus.
   - Test zoom, legend, fog/path mode, map header, HUD compact/unfolded state, and quick controls.
5. **Combat**
   - Select cards by pointer, keyboard, and touch when available.
   - Target player/enemy/multiple targets, cancel, page the hand, use flasks, and end the turn.
   - On touch, test both tap and a deliberate hold on End Turn.
   - Confirm intent, health, poise, statuses, combatant details, and no HUD/action-card overlap.
6. **Armoury**
   - Open Character, Inventory, and Hybrid.
   - Open/close every tray; test list/grid, sort, resize snaps, and remembered sizes.
   - Test either-hand selection, cross-hand movement, unequip return to the one shared Inventory, close, and reopen.
7. **Menu, Settings, and Controls**
   - Open every Settings category and Advanced subsection.
   - Alternate Settings/Controls repeatedly, scroll each direction, and close/reopen.
   - Rebind one key, try Escape, try a conflicting key, cancel, and restore defaults.
   - Test Quick Menu Settings, Controls, Fullscreen, Music, Inventory, Character, Load, Save, Save and Quit, and Quit Without Saving.
8. **Shrine and healing**
   - Use a combat flask and verify health/charge deltas.
   - At a shrine, test Rest, Smith, flask reallocation, and Level up.
   - Before committing, verify the confirmation shows exact costs, stat/resource deltas, whether the choice leaves the shrine, Back, and Continue.
   - For Smith, verify Confirm starts disabled; each candidate is one distinct owned armament,
     not a deck copy. Selecting one must show its tier, 1-Stone cost, purse or shortfall, and
     every grouped sourced-basic-card delta without mutating the deck. Back and Escape preserve
     the run and return focus. Confirm remains disabled at zero Stones; when affordable it spends
     exactly 1 Stone, promotes exactly one armament to tier 1, refreshes all current and future
     sourced basic cards, records a durable receipt, and leaves the Shrine.
   - Verify a Smithing tier survives save/load, active-combat save/load, and swapping away from
     and back to the armament. Verify elite and boss victories grant exactly 1 Stone once while
     normal and treasure pools grant 0, including save/load between grant and replay.
9. **Persistence**
   - Save in a stable map state and in combat.
   - Return to title, Continue, and explicitly Load the slot.
   - Compare location, encounter, HP/MP/SP, flask charges, hand, and pending choices.
10. **Diagnostics**
    - Review console warnings/errors and the in-game Command Log.
    - Record unsupported platform features explicitly; unsupported is not a pass.

## Responsive matrix

Minimum viewports:

- desktop: `1200x730`;
- phone portrait: `390x844`;
- small phone: `320x640`;
- short landscape: `844x390`;
- Text XL at phone portrait and short landscape.

At every viewport check horizontal overflow, clipped primary actions, tooltip direction, 44 px touch targets, top/bottom HUD clearance, and scroll ownership.

## Finding format

```text
[P1] Short outcome
State: FAIL
Reproduction: exact numbered actions
Observed: measured state
Expected: player-facing contract
Evidence: screenshot and/or state log
Smallest fix: one bounded implementation lane
Retest: focused behavior + responsive regression
```

Priority meaning:

- **P0**: data loss, crash, or progression cannot continue.
- **P1**: core action fails, lies, or creates a destructive/ambiguous choice.
- **P2**: important accessibility or layout regression with a workaround.
- **P3**: polish, wording, or low-risk consistency issue.
