# SS-004 Card templates

Status: specified; implementation and acceptance are pending. Depends on SS-003 (the Save tier).

Execution handoff: [Claude prompt for this story](SS-004-claude-execution-prompt.md).

The [editor specification](../../EDITOR-SPEC.md) controls the persistent workbench (§6 "Duplicate from supported templates with new stable identity"; §7 presets). This story is a W12 slice in the [prioritized plan](../IMPLEMENTATION-PLAN.md). It covers card templates only, not tool or section presets. It serves "Expose naming rules, independent tool/section presets and consistent state memory" and "Create, duplicate and edit supported cards" in [Tool features](../FEATURE-CHECKLIST.md#first-delivery-tool-features).

## User story

As a designer, I want to save a card's mechanics as a named template and start new cards from it, so I can make cards of a kind I use often without copying a card and then undoing its name and ID by hand.

## Decisions

The owner accepted these decisions.

1. Storage. Templates live in a committed Studio file, `content/source/studio/templates.json`, written by the SS-003 Save path. Not browser storage. Until File > Save, a new or changed template is part of the draft like any other change, and the indicator reads Draft.
2. Content. A template keeps mechanics only: type, target, school, costs, effects, tags, rarity and art layers. It drops the ID, the name and the Studio-only `_` flags. A card made from it gets a fresh ID and a generated name.
3. Copy, not linked. Later template edits never change existing cards. A card made from a template stores no link to it.
4. Create. The card ⋮ menu gets "Save as template…". It asks for a name. The card is checked by the same checks as the JSON dialog: `cardJsonProblem`, then `normalizeStudioCard`, then a scoring dry run.
5. Use. Add card opens a small picker: Blank first, then templates grouped by card type. Duplicate stays for one-offs.
6. Manage. Tools > Card templates… lists them, with Rename, Delete, Import JSON and Export JSON.

## What a template holds

How the six mechanics map to today's card fields (read from `studio.js` at `086c16900ed`):

| Mechanic | Card fields kept |
| --- | --- |
| Type | `type` (`icon` and `kindIds` are derived again by `normalizeStudioCard`) |
| Target | the `targeting.*` tags and each effect's `target` (`getCardTarget` and `setCardTarget`) |
| School | `damageSchool`, `magicShare` and the `camp:*` tag |
| Costs | `cost`, `staminaCost`, `manaCost`, `costRule` |
| Effects | `effects` |
| Tags | `tags` and `keywords` |
| Rarity | `rarity` |
| Art layers | `artLayerIds`: the IDs of the card art layers that match the source card when saved (`matchingCustomLayers`) |

Dropped: `id`, `name`, every `_` field, everything in `STUDIO_ONLY_FIELDS` (including `scoringOverride`), and any field not in the table (`class`, `textTemplate`, `upgradeMenu` and others). A card made from a template takes the New card defaults for dropped fields (class `colorless`, Auto-name on, automatic text).

Art layers in this Studio are shared rules that match cards by type, tag or status. Cards have no art of their own. So a template does not copy layers. It records which layers matched, and a card made from it matches the same layers through its type and tags. The picker notes a template whose recorded layers no longer exist.

File format: `{ kind: "ashenspire.studioCardTemplates", formatVersion: 1, templates: [{ id, name, cardType, createdAt, card, artLayerIds }] }`. Template IDs are `template.<slug>` and stay unique. The same shape is used for Import and Export.

## Scope

In scope:

- "Save as template…" in the card ⋮ menu, with a name prompt and the JSON dialog checks.
- The Add card picker on the Add card tile and File > New card.
- Tools > Card templates…: list, Rename, Delete, Import JSON, Export JSON.
- `templates.json` as a third fixed file in the SS-003 Save path, loaded on start.
- One Undo step for each template change (save, rename, delete, import).

Out of scope:

- Item templates and deck templates.
- Tool and section presets: generation, rebalance and naming settings, Last used, Set default (the rest of W12).
- Linked templates or "update cards from template".
- Effect or feature-definition templates (W17).
- Export to the game (later).

## Acceptance criteria

All criteria are pending until executed. Counts below are targets, not measured results.

| ID | Given and when | Observable pass condition |
| --- | --- | --- |
| AC01 | A disposable QA card is active. Open the card ⋮ menu, choose Save as template…, type a name, press Enter. | The template appears in Tools > Card templates… under its card type. The QA card is byte-identical. The indicator reads Draft. |
| AC02 | Export the templates as JSON and read the file. | Each template holds only the fields in "What a template holds". No `id` or `name` of the source card, no `_` field and no `scoringOverride`. |
| AC03 | Try Save as template on a card the JSON dialog would refuse, and with an empty or duplicate name. | Nothing is stored. The message matches the JSON dialog's message, or names the name problem. |
| AC04 | Activate the Add card tile, and separately File > New card. | Both open the same picker: Blank first, then templates grouped by card type. Blank makes the same card New makes today. Escape closes it and creates nothing. |
| AC05 | Choose a template in the picker. | A new card appears with a fresh unique ID, a generated name and mechanics equal to the template. It is the active card (SS-002), in view and in the banner. One Undo removes it. |
| AC06 | Make a card from a template, then rename the template, replace it with a new Save as template of the same name, and delete it. | The card made earlier is byte-identical after each step. |
| AC07 | File > Save, clear site data, reload. | `content/source/studio/templates.json` holds the templates and they return in the picker and the list. The indicator reads Saved. |
| AC08 | Rename and delete a template in the list, then Undo each. | Rename keeps the template's ID and content. Delete asks once and names the template. Each is one Undo step. No card changes. |
| AC09 | Export the templates, then Import that file into a Studio with none. Import a broken file. Import a file whose names clash. | The round trip reproduces the templates. A broken file changes nothing and names its first problem. Clashing names get a number, and every imported template gets a fresh ID. |
| AC10 | Use the picker and the list with keyboard only, and at 390 x 844. | Every action is reachable without hover. Focus starts on Blank, Escape returns focus to Add card, and nothing is clipped or overflows. |
| AC11 | Web mode (GitHub Pages). | Templates work for the session. The SS-003 download includes them. Tools > Card templates… export works. No request goes to `/__studio/`. |
| AC12 | Use Duplicate, New and the JSON dialog after this change, then open the actual local game. | Duplicate, New and the JSON dialog behave as before. The game does not read `templates.json`; an ordinary card renders and plays. |

## Reference UI workflow and measurement

Starting point: local Studio docked at 1280 x 800, a disposable QA card active.

1. Save the card as a template. Target: 2 activations (⋮, Save as template…), the name, then Enter. 0 extra dialogs.
2. Make a card from a template. Target: 2 activations (Add card, the template). 0 menus.
3. Make a blank card. Target: 2 activations (Add card, Blank). This is one more than today; record it.
4. Rename a template. Target: 3 activations (Tools, Card templates…, Rename), the name, then Enter.
5. Repeat 1 and 2 with keyboard and at 390 x 844. Record the actual path.

Record for each step: I want to, starting state, activations, field edits, menus, maximum modal depth, scroll travel, expected, actual and evidence. Do not present targets as results.

## Implementation task checklist

- [ ] T01 Confirm SS-003 is merged or name the branch you build on. Record the baseline worktree, draft and saved files.
- [ ] T02 Write a pure helper that turns a card into a template and a template into a new card, with the field table above. Unit-test it first.
- [ ] T03 Add `templates.json` to the SS-003 read, save and download paths, with schema checks and the same guards.
- [ ] T04 Add `templates` to the Studio state, the snapshot and the draft, so Undo and Auto-save cover it.
- [ ] T05 Add Save as template… to `cardMenuActions` with the name prompt and the JSON dialog checks.
- [ ] T06 Add the Add card picker; route the Add card tile and File > New card through it. Keep New's current Blank behavior.
- [ ] T07 Add Tools > Card templates…: list grouped by type, Rename, Delete, Import JSON, Export JSON.
- [ ] T08 Add tests: helper fields, validation refusals, copy-not-linked, picker order, Undo steps, import round trip and broken import. Run the existing Studio checks.
- [ ] T09 Execute AC01 to AC11 through the actual Studio UI, desktop, narrow and keyboard; record measurements.
- [ ] T10 Execute AC12 in the actual local game. Restore QA files, review the diff and publish criterion-by-criterion PASS/FAIL.

## Reuse candidates

Read from PR #3008's branch at `086c16900ed`. Confirm names and line numbers before editing; SS-002 and SS-003 move them.

Studio, `tools/score-studio/studio.js`:

- `cardMenuActions()` (about 1930) builds the card ⋮ menu. The dock renders it through `ctx.getCardActions` (`cardEditorDock.js` about 153). "Export card JSON" (about 1950) already strips `_` fields.
- `cardJsonProblem(card)` (about 1982) and `applyCardJson()` (about 1993): the check order is JSON shape, `cardJsonProblem`, then `scoreCardEntry(normalizeStudioCard(clone(next)))` as a dry run. Reuse that exact order.
- `normalizeStudioCard(def)` (about 180) and `scoreCardEntry(def)` (about 308).
- `STUDIO_ONLY_FIELDS` (about 606): the fields to drop besides `id` and `name`.
- `getCardTarget(def)` and `setCardTarget(def, target)` (about 282 and 293): target lives in tags and effect targets.
- `matchingCustomLayers(def)` (about 591): the art layers that match a card.
- The New card handler on `btn-new-card` (about 4272): fresh ID loop, Blank defaults, filter reset, `animateCardInsertion`. The picker's Blank must keep this. Duplicate (about 4298) sets `_autoName: true` so the name is generated.
- `syncAutoNames()` (about 776) runs from `saveDraft()` and names cards with `_autoName`.
- `renderCardsGrid()` (about 1483) inserts the Add card tile from `createAddCardTile` (`addCardTile.js` about 2) with `onAdd`.
- `setupStudioMenubar()` (about 3948): `move('file', 'btn-new-card', 'New card')` and the `group('tools', 'Cards')` block (about 4005).
- `pushHistory()` and `snapshotState()` (about 358 and 338): add `templates` to the snapshot.

Tools dialogs, `tools/score-studio/studioToolsModal.js`:

- `downloadJsonFile(filename, data)` (about 30) for Export.
- `wireFileLoadInput(inputId)` (about 230) and `applyImportedBundle(rawText)` (about 170): file input, parse, `pushHistory`, change, `syncAllViews`, `saveDraft`. Copy the flow, but check the whole file before changing state.
- `renderDecksModal()` and `openDecksModal()` (about 617 and 677): a list in a dialog with row actions.

Save path: the SS-003 helpers in `tools/score-studio-save.mjs` and the endpoint in `tools/serve.mjs`, once SS-003 lands.

Tests:

- `tests/score-studio-editor-dock.test.mjs`, "the Add card cell is one accessible action and never participates in card selection or position capture" (about 165): keep it true with the picker.
- `tests/score-studio.browser.mjs`, step 7 (about 356 to 387): the Blank defaults New must keep.
- `tests/score-studio.test.mjs`: the save helper tests SS-003 extends.

## Engineering traps

- Copy, not linked: build the new card from a deep clone. A shared `effects` or `tags` array would make a template edit change cards.
- Fresh IDs: reuse New's ID loop and check against every card, not only visible ones. Template IDs must also stay unique after Import.
- Generated name: set `_autoName: true` and let `syncAutoNames` name the card. Do not copy the template's name onto the card.
- Target and school are spread over tags, effects and fields. Copy them together, or a card may end up with a spell camp and a physical school. Run `normalizeStudioCard` on the result.
- Art layers are shared rules. Do not create, copy or change layers when saving or using a template.
- The Add card tile must stay one accessible action that never selects a card. The picker opens from it; it does not replace it.
- Blank costs one more activation than today. Make Blank the first, focused choice, and record the cost.
- Validate before you touch state, as `applyCardJson` does. A refused template or import changes nothing.
- Templates are Studio config. The game must not read `templates.json`, and Export to the game stays a separate later step.
- Acceptance uses UI controls only. Do not inject console state or hand-edit saves.

## Definition of done

All twelve criteria have actual results and relevant checks pass. Screenshots and measurements are reviewed, QA files are restored and the exact diff is reviewed. Merging this document records the specification only; it does not tick any checkbox.
