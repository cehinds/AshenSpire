# SS-004 Claude execution prompt

Copy the prompt below into Claude. The [SS-004 story](SS-004-card-templates.md) is the acceptance reference. Check live branch and PR state before you start; the status in this prompt is a snapshot.

```text
Implement Score Studio story SS-004: card templates.

Build it and verify it through the Studio UI. The story and its acceptance criteria are the reference. Do not stop after a plan.

Repository
C:\repos\AshenSpire
https://github.com/cehinds/AshenSpire

Read CLAUDE.md, CONTRIBUTING.md, DEVELOPER.md and the guidance they point to before changing anything. Follow the delegation rules. Keep existing edits, drafts, untracked files and worktrees. Never reset, clean or overwrite unrelated work.

References
- docs/score-studio/stories/SS-004-card-templates.md (decisions, field table, AC01 to AC12, reuse list, traps)
- docs/score-studio/stories/SS-003-studio-save.md (the Save path this story writes through)
- docs/EDITOR-SPEC.md, section 6 (templates with new stable identity) and section 7
- docs/score-studio/IMPLEMENTATION-PLAN.md (W12)

DEPENDENCY

SS-004 needs SS-003, which needs SS-001 (PR #3008) and SS-002. Check what is merged into dev. If SS-003 is not merged, stop and report; do not build a second save path. The reuse list was read at 086c16900ed and will have moved.

USER STORY

As a designer, I want to save a card's mechanics as a named template and start new cards from it, so I can make cards of a kind I use often without copying a card and then undoing its name and ID by hand.

OWNER DECISIONS

1. Stored in committed content/source/studio/templates.json via the SS-003 Save path, not browser storage.
2. A template keeps mechanics only: type, target, school, costs, effects, tags, rarity and art layers. It drops the ID, the name and Studio-only _ flags. A card made from it gets a fresh ID and a generated name.
3. Copy, not linked: later template edits never change existing cards.
4. Created from the card ⋮ menu "Save as template…" with a name prompt, checked by cardJsonProblem, normalizeStudioCard and a scoring dry run, the same as the JSON dialog. A taken name asks "Replace template <name>?"; only Replace overwrites it (same ID), Cancel stores nothing.
5. Used from Add card, which opens a small picker: Blank, then templates grouped by card type. Duplicate stays for one-offs.
6. Managed in Tools > Card templates…: Rename, Delete, Import JSON, Export JSON.

The story's field table says which card fields each mechanic maps to. Art layers are shared match rules, so a template records the matching layer IDs and never copies layers.

ACCEPTANCE CRITERIA

Use the full table in the story. In short:

AC01 Save as template stores a template under its type; the source card is unchanged; indicator reads Draft.
AC02 Exported templates hold only the listed fields.
AC03 Invalid cards, empty names, and a taken name followed by Cancel store nothing, with a clear message.
AC04 The Add card tile and File > New card open one picker: Blank first, then by type; Blank equals today's New; Escape creates nothing.
AC05 A card from a template has a fresh ID, a generated name, the template's mechanics, is active and in view; one Undo removes it.
AC06 Renaming, replacing (taken name, then confirm Replace) or deleting a template leaves earlier cards byte-identical.
AC07 File > Save writes templates.json; templates return after clearing site data and reloading.
AC08 Rename and Delete are one Undo step each; Delete names the template; no card changes.
AC09 Export then Import round-trips; a broken file changes nothing; clashing names get a number and fresh IDs.
AC10 Keyboard and 390 x 844: all actions reachable, focus starts on Blank and returns to Add card.
AC11 Web mode: templates work in session and are in the SS-003 download; no /__studio/ request.
AC12 Duplicate, New and the JSON dialog unchanged; the game does not read templates.json; an ordinary card plays.

IMPLEMENTATION TASKS

Follow T01 to T10 in the story. Start with T02: a pure, unit-tested helper for card to template and template to card.

ENGINEERING CONSTRAINTS

- Deep-clone on both directions so no array is shared.
- Reuse New's fresh ID loop; set _autoName and let syncAutoNames name the card.
- Copy target and school together, then normalizeStudioCard.
- Do not create, copy or change art layers.
- Keep the Add card tile one accessible action that never selects a card.
- Validate the whole input before touching state.
- Add templates to the snapshot and draft so Undo and Auto-save cover them.
- The game must not read templates.json.
- Acceptance uses UI controls only. No console state injection, no hand-edited saves.
- Do not weaken tests. Small commits, each pushed as made.

MEASUREMENTS

For each workflow in the story record: I want to, starting state, activations, field edits, menus, maximum modal depth, scroll travel, expected, actual and evidence.

Targets:
- Save as template: 2 activations, the name, Enter.
- Card from template: 2 activations.
- Blank card: 2 activations (one more than today; record it).
- Rename a template: 3 activations, the name, Enter.

Targets are not results.

DELIVERY

Return:
1. Branch, base and commits.
2. What changed and why.
3. AC01 to AC12 PASS or FAIL with evidence.
4. Checks run and results.
5. Fresh 1280 x 800 and 390 x 844 screenshots of the ⋮ menu, picker and Templates list, and a preview link.
6. Measured interaction costs.
7. Remaining work.

Tick story tasks only after verification. Do not claim the story is done from unit tests or screenshots alone.
```
