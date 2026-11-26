# Score Studio use cases and proposed UI paths

These 64 cases are planning references, not executed tests or implementation status. The [implementation plan](IMPLEMENTATION-PLAN.md) owns delivery priority and dependencies. Counts are proposed pointer targets; text entry, gestures, native picker actions and gameplay are separate. The [first story](stories/SS-001-persistent-workspace.md) has its own bounded criteria.


## 01 Tune one card's numbers

**Packages:** W04.

**Proposed target:** 3 pointer activations; 1 interface(s), 0 workspace/game transitions and 0 contextual window(s).

- select visible card (1 activation(s)).
- focus damage field (1 activation(s)).
- Apply (1 activation(s)).

**Repeat target:** 3 clicks for another visible card; no window reopening

## 02 Compose a supported effect

**Packages:** W04.

**Proposed target:** 8 pointer activations; 2 interface(s), 0 workspace/game transitions and 1 contextual window(s).

- select card (1 activation(s)).
- Duplicate (1 activation(s)).
- Add effect (1 activation(s)).
- choose template (1 activation(s)).
- focus amount (1 activation(s)).
- open target selector and choose target (2 activation(s)).
- Apply (1 activation(s)).

**Repeat target:** 4–6 clicks to add another defaulted rider to the already selected card

## 03 Change tradition alone

**Packages:** W04.

**Proposed target:** 4 pointer activations; 1 interface(s), 0 workspace/game transitions and 0 contextual window(s).

- select card (1 activation(s)).
- open Tradition (1 activation(s)).
- choose Arcane (1 activation(s)).
- Apply (1 activation(s)).

**Repeat target:** 3 clicks when card already selected

## 04 Assign school and camp clearly

**Packages:** W04.

**Proposed target:** 6 pointer activations; 1 interface(s), 0 workspace/game transitions and 0 contextual window(s).

- select card (1 activation(s)).
- open Camp and choose Magic (2 activation(s)).
- open School and choose Fire (2 activation(s)).
- Apply (1 activation(s)).

**Repeat target:** 5 clicks when card already selected

## 05 Give a spell Attack stance

**Packages:** W04.

**Proposed target:** 4 pointer activations; 1 interface(s), 0 workspace/game transitions and 0 contextual window(s).

- select card (1 activation(s)).
- open Stance (1 activation(s)).
- choose Attack (1 activation(s)).
- Apply (1 activation(s)).

**Repeat target:** 3 clicks when card already selected

## 06 Create a variant from a template

**Packages:** W04.

**Proposed target:** 7 pointer activations; 1 interface(s), 0 workspace/game transitions and 0 contextual window(s).

- select template card (1 activation(s)).
- Duplicate (1 activation(s)).
- focus name (1 activation(s)).
- open class and choose Reaver (2 activation(s)).
- focus one parameter (1 activation(s)).
- Validate and apply (1 activation(s)).

**Repeat target:** 3–5 clicks when a named template supplies class and parameters

## 07 Install a card in a class starter

**Packages:** W06.

**Proposed target:** 7 pointer activations; 2 interface(s), 0 workspace/game transitions and 1 contextual window(s).

- select card (1 activation(s)).
- Add to starter (1 activation(s)).
- open class and choose Reaver (2 activation(s)).
- focus copy count (1 activation(s)).
- choose replacement row (1 activation(s)).
- Apply starter change (1 activation(s)).

**Repeat target:** 4–5 clicks using remembered class/replacement defaults

## 08 Test a locked class safely

**Packages:** W08.

**Proposed target:** 5 pointer activations; 2 interface(s), 1 workspace/game transitions and 0 contextual window(s).

- choose Scenarios tab (1 activation(s)).
- open class and choose Starseer (2 activation(s)).
- enable temporary unlock (1 activation(s)).
- Start scenario (1 activation(s)).

**Repeat target:** 2 clicks from a saved scenario: select and Start

## 09 Start a normal run with the candidate revision

**Packages:** W07.

**Proposed target:** 3 pointer activations; 3 interface(s), 1 workspace/game transitions and 1 contextual window(s).

- Review changes (1 activation(s)).
- Start normal run in drawer (1 activation(s)).
- confirm test profile when needed (1 activation(s)).

**Repeat target:** 2 clicks when a previously chosen test profile needs no additional confirmation

## 10 Save a focused real-game scenario

**Packages:** W08, W21.

**Proposed target:** 10 pointer activations; 2 interface(s), 1 workspace/game transitions and 0 contextual window(s).

- New scenario (1 activation(s)).
- choose class (2 activation(s)).
- choose deck (2 activation(s)).
- choose encounter (2 activation(s)).
- focus resources (1 activation(s)).
- focus seed (1 activation(s)).
- Save and start (1 activation(s)).

**Repeat target:** 2 clicks to select and start a saved scenario; 1 to Restart the current scenario

## 11 Find and sort the cards I am balancing

**Packages:** W05.

**Proposed target:** 3 pointer activations; 1 interface(s), 0 workspace/game transitions and 0 contextual window(s).

- open named-list selector (1 activation(s)).
- choose list (1 activation(s)).
- click CP ascending header (1 activation(s)).

**Repeat target:** 1 click to change sort; zero to restore a saved view on reload

## 12 Make a bounded bulk edit

**Packages:** W11.

**Proposed target:** 10 pointer activations; 2 interface(s), 0 workspace/game transitions and 1 contextual window(s).

- focus filter (1 activation(s)).
- Select all matching (1 activation(s)).
- Bulk edit (1 activation(s)).
- choose Damage (2 activation(s)).
- choose Add delta (2 activation(s)).
- focus delta (1 activation(s)).
- Preview (1 activation(s)).
- Apply selected (1 activation(s)).

**Repeat target:** 5–7 clicks using the last valid operation/field

## 13 Rebalance only the intended scope

**Packages:** W14.

**Proposed target:** 6 pointer activations; 2 interface(s), 0 workspace/game transitions and 1 contextual window(s).

- select named deck (2 activation(s)).
- Rebalance (1 activation(s)).
- focus target CP (1 activation(s)).
- Preview (1 activation(s)).
- Apply (1 activation(s)).

**Repeat target:** 4 clicks for another target with the same selected deck

## 14 Understand and tune scoring weights

**Packages:** W18.

**Proposed target:** 3 pointer activations; 1 interface(s), 0 workspace/game transitions and 0 contextual window(s).

- select weight term (1 activation(s)).
- focus coefficient (1 activation(s)).
- Apply (1 activation(s)).

**Repeat target:** 2 clicks when the term is selected; save-as-preset is a separate operation

## 15 Control generated naming conventions

**Packages:** W15.

**Proposed target:** 6 pointer activations; 1 interface(s), 0 workspace/game transitions and 0 contextual window(s).

- open Naming (1 activation(s)).
- focus dictionary word (1 activation(s)).
- choose scope (2 activation(s)).
- Preview names (1 activation(s)).
- Apply (1 activation(s)).

**Repeat target:** 4 clicks when Naming and scope are already retained

## 16 Enforce readable names without silent loss

**Packages:** W15.

**Proposed target:** 5 pointer activations; 1 interface(s), 0 workspace/game transitions and 0 contextual window(s).

- open Naming (1 activation(s)).
- focus max length (1 activation(s)).
- move one priority using labelled button (1 activation(s)).
- Preview (1 activation(s)).
- Apply (1 activation(s)).

**Repeat target:** 4 clicks when Naming is already open

## 17 Generate exact quotas honestly

**Packages:** W13.

**Proposed target:** 8 pointer activations; 2 interface(s), 0 workspace/game transitions and 1 contextual window(s).

- Generate Pool (1 activation(s)).
- load named preset (2 activation(s)).
- focus three quota fields (3 activation(s)).
- Generate preview (1 activation(s)).
- Accept batch (1 activation(s)).

**Repeat target:** 4 clicks using a complete preset without changed quota fields

## 18 Reproduce a generation or run seed

**Packages:** W13, W16.

**Proposed target:** 4 pointer activations; 2 interface(s), 1 workspace/game transitions and 0 contextual window(s).

- select recorded result (1 activation(s)).
- Reproduce (1 activation(s)).
- choose baseline or candidate inline (1 activation(s)).
- Start (1 activation(s)).

**Repeat target:** 2 clicks to select and reproduce a result with remembered revision choice

## 19 Reuse defaults and named presets

**Packages:** W12.

**Proposed target:** 4 pointer activations; 1 interface(s), 0 workspace/game transitions and 0 contextual window(s).

- open preset selector (1 activation(s)).
- choose preset (1 activation(s)).
- focus optional seed (1 activation(s)).
- Preview (1 activation(s)).

**Repeat target:** 2 clicks to recall and preview with unchanged seed

## 20 Compare baseline and candidate batches

**Packages:** W16.

**Proposed target:** 7 pointer activations; 3 interface(s), 2 workspace/game transitions and 0 contextual window(s).

- select three list rows using explicit checkboxes (3 activation(s)).
- Compare (1 activation(s)).
- choose saved scenario (2 activation(s)).
- Run pair (1 activation(s)).

**Repeat target:** 3 clicks from saved comparison: select, choose run action, Run

## 21 Adjust loot eligibility and rarity

**Packages:** W30.

**Proposed target:** 7 pointer activations; 1 interface(s), 0 workspace/game transitions and 0 contextual window(s).

- select card (1 activation(s)).
- expand Reward eligibility (1 activation(s)).
- choose pool (2 activation(s)).
- focus weight (1 activation(s)).
- Preview eligibility (1 activation(s)).
- Apply (1 activation(s)).

**Repeat target:** 5 clicks when card/section are already selected

## 22 Tune reward cadence and offer mix

**Packages:** W30.

**Proposed target:** 5 pointer activations; 1 interface(s), 0 workspace/game transitions and 0 contextual window(s).

- select stage/tier row (1 activation(s)).
- focus offer count (1 activation(s)).
- focus category weight (1 activation(s)).
- Preview schedule (1 activation(s)).
- Apply (1 activation(s)).

**Repeat target:** 3 clicks for a one-field change with the row retained

## 23 Adjust shop prices and economy

**Packages:** W30.

**Proposed target:** 4 pointer activations; 1 interface(s), 0 workspace/game transitions and 0 contextual window(s).

- select service (1 activation(s)).
- focus price (1 activation(s)).
- Preview budget (1 activation(s)).
- Apply (1 activation(s)).

**Repeat target:** 3 clicks when the service is selected

## 24 Tune enemy durability and threat

**Packages:** W31.

**Proposed target:** 5 pointer activations; 1 interface(s), 0 workspace/game transitions and 0 contextual window(s).

- focus enemy search (1 activation(s)).
- select result (1 activation(s)).
- focus authored stat input (1 activation(s)).
- choose comparison level (1 activation(s)).
- Apply (1 activation(s)).

**Repeat target:** 3 clicks when enemy is already selected and level is retained

## 25 Adjust enemy move weights and repetition

**Packages:** W31.

**Proposed target:** 7 pointer activations; 1 interface(s), 0 workspace/game transitions and 0 contextual window(s).

- select enemy (1 activation(s)).
- open Moves (1 activation(s)).
- select move (1 activation(s)).
- focus weight (1 activation(s)).
- focus repeat limit (1 activation(s)).
- Preview sequence (1 activation(s)).
- Apply (1 activation(s)).

**Repeat target:** 4 clicks for a single repeated edit to the selected move

## 26 Author encounter pools

**Packages:** W31.

**Proposed target:** 10 pointer activations; 2 interface(s), 1 workspace/game transitions and 0 contextual window(s).

- New from template (1 activation(s)).
- choose template (1 activation(s)).
- choose first enemy (2 activation(s)).
- choose second enemy (2 activation(s)).
- choose stage/tier (2 activation(s)).
- focus weight (1 activation(s)).
- Validate and test (1 activation(s)).

**Repeat target:** 3–5 clicks to adjust and test an existing encounter

## 27 Tune progression pace and class unlock policy

**Packages:** W32.

**Proposed target:** 5 pointer activations; 1 interface(s), 0 workspace/game transitions and 0 contextual window(s).

- choose policy tab (1 activation(s)).
- select curve or milestone (1 activation(s)).
- focus changed field (1 activation(s)).
- Preview (1 activation(s)).
- Apply (1 activation(s)).

**Repeat target:** 3 clicks for a selected one-field policy edit

## 28 Build reusable difficulty presets

**Packages:** W32.

**Proposed target:** 8 pointer activations; 2 interface(s), 1 workspace/game transitions and 0 contextual window(s).

- select Standard preset (1 activation(s)).
- Duplicate (1 activation(s)).
- focus name (1 activation(s)).
- focus two bounded settings (2 activation(s)).
- Review diff (1 activation(s)).
- Save preset (1 activation(s)).
- Test (1 activation(s)).

**Repeat target:** 3 clicks to select, review and test a saved preset

## 29 Adjust route quotas and map constraints

**Packages:** W33.

**Proposed target:** 6 pointer activations; 1 interface(s), 0 workspace/game transitions and 0 contextual window(s).

- choose route preset (2 activation(s)).
- focus rest depth (1 activation(s)).
- focus seed (1 activation(s)).
- Preview and validate (1 activation(s)).
- Apply (1 activation(s)).

**Repeat target:** 3 clicks for a selected preset with unchanged seed

## 30 Run a saved regression pack

**Packages:** W23.

**Proposed target:** 4 pointer activations; 2 interface(s), 1 workspace/game transitions and 0 contextual window(s).

- select regression pack (1 activation(s)).
- choose baseline/candidate pair (1 activation(s)).
- Run pack (1 activation(s)).
- open first failure (1 activation(s)).

**Repeat target:** 2 clicks to select and run the last revision pair

## 31 Tune supported presentation values

**Packages:** W28.

**Proposed target:** 6 pointer activations; 3 interface(s), 2 workspace/game transitions and 0 contextual window(s).

- select card preview (1 activation(s)).
- Open presentation setting (1 activation(s)).
- focus size (1 activation(s)).
- choose second viewport preset (1 activation(s)).
- Apply (1 activation(s)).
- Test game (1 activation(s)).

**Repeat target:** 4 clicks when the setting and viewport are already selected

## 32 Discover the right tool quickly

**Packages:** W03.

**Proposed target:** 2 pointer activations; 3 interface(s), 1 workspace/game transitions and 1 contextual window(s).

- open command search (1 activation(s)).
- choose matching task result (1 activation(s)).

**Repeat target:** 0 mouse clicks by keyboard; 2 clicks/taps by pointer

## 33 Undo a design experiment completely

**Packages:** W09.

**Proposed target:** 1 pointer activations; 1 interface(s), 0 workspace/game transitions and 0 contextual window(s).

- Undo latest named action (1 activation(s)).

**Repeat target:** 1 click or keyboard shortcut; zero workspace switches

## 34 Save, load and hand off a complete design project

**Packages:** W02, W09.

**Proposed target:** 3 pointer activations; 2 interface(s), 0 workspace/game transitions and 1 contextual window(s).

- Import project (1 activation(s)).
- Review imported diff after native selection (1 activation(s)).
- Apply import (1 activation(s)).

**Repeat target:** 2–3 editor clicks to import a conflict-free known bundle, plus native chooser actions

## 35 Archive and restore obsolete features

**Packages:** W17.

**Proposed target:** 4 pointer activations; 3 interface(s), 1 workspace/game transitions and 1 contextual window(s).

- Manage features (1 activation(s)).
- select definition (1 activation(s)).
- Archive (1 activation(s)).
- confirm reviewed impact (1 activation(s)).

**Repeat target:** 2 clicks to archive from registry; Restore requires select plus Restore

## 36 Add a supported feature from a catalogue

**Packages:** W17.

**Proposed target:** 4 pointer activations; 2 interface(s), 0 workspace/game transitions and 1 contextual window(s).

- Add from catalogue (1 activation(s)).
- focus search (1 activation(s)).
- select template (1 activation(s)).
- Add to project (1 activation(s)).

**Repeat target:** 3 clicks with retained catalogue search

## 37 Create or rename a feature definition safely

**Packages:** W17.

**Proposed target:** 4 pointer activations; 1 interface(s), 0 workspace/game transitions and 0 contextual window(s).

- select definition (1 activation(s)).
- focus display name (1 activation(s)).
- Preview affected labels (1 activation(s)).
- Apply (1 activation(s)).

**Repeat target:** 3 clicks when definition selected; no rename modal needed

## 38 Choose a scoring structure and tune parameters

**Packages:** W18.

**Proposed target:** 7 pointer activations; 1 interface(s), 0 workspace/game transitions and 0 contextual window(s).

- select feature (1 activation(s)).
- open Scoring (1 activation(s)).
- choose supported structure (2 activation(s)).
- focus coefficient (1 activation(s)).
- focus bound or stacking parameter (1 activation(s)).
- Apply (1 activation(s)).

**Repeat target:** 3–5 clicks for a parameter-only edit to a selected template

## 39 Bind a template to an existing game effect

**Packages:** W19.

**Proposed target:** 10 pointer activations; 2 interface(s), 2 workspace/game transitions and 0 contextual window(s).

- select feature (1 activation(s)).
- open Runtime binding (1 activation(s)).
- choose supported capability (2 activation(s)).
- choose parameter binding (2 activation(s)).
- choose applicability (2 activation(s)).
- Test binding (1 activation(s)).
- Apply after test (1 activation(s)).

**Repeat target:** 3–5 clicks for a parameter change, test and Apply using remembered mapping

## 40 Migrate and exchange feature registries reversibly

**Packages:** W20.

**Proposed target:** 5 pointer activations; 2 interface(s), 0 workspace/game transitions and 1 contextual window(s).

- Import registry (1 activation(s)).
- choose migration policy after native selection (2 activation(s)).
- expand affected references (1 activation(s)).
- Apply migration (1 activation(s)).

**Repeat target:** 3–5 editor clicks plus native chooser actions when policy/reference details need review

## 41 Select the exact intended cards

**Packages:** W05.

**Proposed target:** 2 pointer activations; 1 interface(s), 0 workspace/game transitions and 0 contextual window(s).

- select range anchor (1 activation(s)).
- Shift-click endpoint (1 activation(s)).

**Repeat target:** 2 range-selection clicks; keyboard/touch alternatives explicit

## 42 Drag a selection without losing definitions

**Packages:** W10.

**Proposed target:** 3 pointer activations; 1 interface(s), 0 workspace/game transitions and 0 contextual window(s).

- select three source rows (3 activation(s)).

**Repeat target:** 1 drag gesture after selection, or 3 menu clicks; gesture is counted separately

## 43 Use context actions with an explicit scope

**Packages:** W11.

**Proposed target:** 2 pointer activations; 2 interface(s), 0 workspace/game transitions and 1 contextual window(s).

- open context menu (1 activation(s)).
- choose scope-labelled action (1 activation(s)).

**Repeat target:** 2 clicks before any action-specific review

## 44 Build decks beside the content library

**Packages:** W05, W06.

**Proposed target:** 4 pointer activations; 1 interface(s), 0 workspace/game transitions and 0 contextual window(s).

- select deck (1 activation(s)).
- select card (1 activation(s)).
- Add (1 activation(s)).
- increase quantity (1 activation(s)).

**Repeat target:** 2 clicks with deck/card retained

## 45 Keep my working context across views and tools

**Packages:** W03, W05, W12.

**Proposed target:** 1 pointer activations; 1 interface(s), 0 workspace/game transitions and 0 contextual window(s).

- switch table or gallery view (1 activation(s)).

**Repeat target:** 1 click; linked workspace visit and Return are two extra switches

## 46 Configure and import a supported game profile

**Packages:** W01, W02.

**Proposed target:** 4 pointer activations; 2 interface(s), 1 workspace/game transitions and 0 contextual window(s).

- select game profile (1 activation(s)).
- focus supported setting (1 activation(s)).
- validate/build (1 activation(s)).
- review/start game (1 activation(s)).

**Repeat target:** 2 clicks for an unchanged valid saved setup

## 47 Manage supporting definitions and asset assignments

**Packages:** W27, W33.

**Proposed target:** 3 pointer activations; 1 interface(s), 0 workspace/game transitions and 0 contextual window(s).

- select entity (1 activation(s)).
- focus description (1 activation(s)).
- Apply (1 activation(s)).

**Repeat target:** 2 clicks with entity selected; asset picker adds separate steps

## 48 Cancel or recover a long operation safely

**Packages:** W09, W23.

**Proposed target:** 1 pointer activations; 1 interface(s), 0 workspace/game transitions and 0 contextual window(s).

- Cancel job (1 activation(s)).

**Repeat target:** 1 click; post-commit recovery is Undo rather than cancel

## 49 Design a card's visual appearance

**Packages:** W24.

**Proposed target:** 4 pointer activations; 1 interface(s), 0 workspace/game transitions and 0 contextual window(s).

- Appearance tab (1 activation(s)).
- focus size (1 activation(s)).
- phone preview (1 activation(s)).
- Apply (1 activation(s)).

**Repeat target:** 2 clicks for a retained field/sample

## 50 Design mechanics while watching actual behavior

**Packages:** W19.

**Proposed target:** 5 pointer activations; 2 interface(s), 2 workspace/game transitions and 0 contextual window(s).

- choose template (2 activation(s)).
- focus parameter (1 activation(s)).
- Test scenario (1 activation(s)).
- Apply after returning (1 activation(s)).

**Repeat target:** 3 clicks for parameter, Test and Apply, plus gameplay inputs

## 51 Feel a card in a controlled card lab

**Packages:** W21.

**Proposed target:** 5 pointer activations; 3 interface(s), 2 workspace/game transitions and 0 contextual window(s).

- Test selected card (1 activation(s)).
- choose fixture (2 activation(s)).
- choose paid/training mode (1 activation(s)).
- Start (1 activation(s)).

**Repeat target:** 1 Start or Reset from a retained fixture

## 52 Test an encounter's edge conditions

**Packages:** W21.

**Proposed target:** 7 pointer activations; 2 interface(s), 1 workspace/game transitions and 0 contextual window(s).

- choose fixture (2 activation(s)).
- select enemy (1 activation(s)).
- focus defense (1 activation(s)).
- choose intent (2 activation(s)).
- Start (1 activation(s)).

**Repeat target:** 2–3 clicks to modify a retained fixture and start

## 53 Configure a full normal-run test

**Packages:** W07, W08.

**Proposed target:** 3 pointer activations; 2 interface(s), 1 workspace/game transitions and 0 contextual window(s).

- select saved setup (1 activation(s)).
- review effective setup (1 activation(s)).
- Start normal run (1 activation(s)).

**Repeat target:** 2 clicks from a retained setup, plus normal game inputs

## 54 Recall a scenario that reveals a card's tradeoffs

**Packages:** W21, W23.

**Proposed target:** 3 pointer activations; 2 interface(s), 1 workspace/game transitions and 0 contextual window(s).

- select scenario pack (1 activation(s)).
- Run pack (1 activation(s)).
- focus note or rating (1 activation(s)).

**Repeat target:** 2 clicks to run and annotate a retained pack

## 55 Pause, step and compare actual actions

**Packages:** W22.

**Proposed target:** 3 pointer activations; 1 interface(s), 0 workspace/game transitions and 0 contextual window(s).

- Pause (1 activation(s)).
- Step game action (1 activation(s)).
- Resume (1 activation(s)).

**Repeat target:** 1 Restart or Replay; no promised backward game scrub

## 56 Explain what happened in the real game

**Packages:** W22.

**Proposed target:** 3 pointer activations; 2 interface(s), 0 workspace/game transitions and 1 contextual window(s).

- open event log (1 activation(s)).
- select real event (1 activation(s)).
- expand decision (1 activation(s)).

**Repeat target:** 1 click to inspect the next event with drawer retained

## 57 Author a presentation timeline

**Packages:** W25.

**Proposed target:** 5 pointer activations; 1 interface(s), 0 workspace/game transitions and 0 contextual window(s).

- select clip (1 activation(s)).
- select marker (1 activation(s)).
- focus time (1 activation(s)).
- Play preview (1 activation(s)).
- Apply draft (1 activation(s)).

**Repeat target:** 3 clicks with selected marker retained

## 58 Map animations to tags predictably

**Packages:** W26.

**Proposed target:** 7 pointer activations; 1 interface(s), 0 workspace/game transitions and 0 contextual window(s).

- select rule (1 activation(s)).
- choose predicate (2 activation(s)).
- choose clip (2 activation(s)).
- Preview matches (1 activation(s)).
- Apply (1 activation(s)).

**Repeat target:** 3–5 clicks with rule/context retained

## 59 Align actors and effects in the scene

**Packages:** W27.

**Proposed target:** 5 pointer activations; 1 interface(s), 0 workspace/game transitions and 0 contextual window(s).

- select anchor (1 activation(s)).
- focus X and Y (2 activation(s)).
- Apply to selected frames (1 activation(s)).
- Preview (1 activation(s)).

**Repeat target:** 3 clicks for a retained one-axis anchor edit and preview

## 60 Import a sprite sheet or atlas safely

**Packages:** W27, W29.

**Proposed target:** 7 pointer activations; 2 interface(s), 0 workspace/game transitions and 1 contextual window(s).

- Import assets (1 activation(s)).
- choose detected layout (1 activation(s)).
- review frames (1 activation(s)).
- choose anchor preset (2 activation(s)).
- Validate (1 activation(s)).
- Accept (1 activation(s)).

**Repeat target:** Preset reduces layout/anchor steps; native chooser counted separately

## 61 Edit sprite timing and inspect motion

**Packages:** W27.

**Proposed target:** 4 pointer activations; 1 interface(s), 0 workspace/game transitions and 0 contextual window(s).

- select frame (1 activation(s)).
- focus duration (1 activation(s)).
- Play (1 activation(s)).
- Apply (1 activation(s)).

**Repeat target:** 3 clicks for a retained frame

## 62 Review action coverage across classes and equipment

**Packages:** W27.

**Proposed target:** 5 pointer activations; 2 interface(s), 0 workspace/game transitions and 1 contextual window(s).

- select coverage cell (1 activation(s)).
- Assign (1 activation(s)).
- choose clip (1 activation(s)).
- Preview (1 activation(s)).
- Apply (1 activation(s)).

**Repeat target:** 3 clicks with retained cell and approved clip choice

## 63 Open the right existing tool

**Packages:** W01, W24, W25, W29.

**Proposed target:** 3 pointer activations; 2 interface(s), 2 workspace/game transitions and 0 contextual window(s).

- Open owning tool (1 activation(s)).
- Return with proposal (1 activation(s)).
- Accept reviewed diff (1 activation(s)).

**Repeat target:** 3 coordination clicks, with actual edit actions additional

## 64 Tune feedback without obscuring play

**Packages:** W25, W28.

**Proposed target:** 6 pointer activations; 2 interface(s), 1 workspace/game transitions and 0 contextual window(s).

- select event (1 activation(s)).
- focus opacity (1 activation(s)).
- choose motion preset (2 activation(s)).
- Preview (1 activation(s)).
- Test real card (1 activation(s)).

**Repeat target:** 3–4 clicks with retained event/preset, plus gameplay
