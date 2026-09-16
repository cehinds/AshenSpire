# New-game save-slot selection remediation — item #2

## Status and authority

- Owner: AshenSpire App Team 1.
- Routing override: Constantine assigned this numbered remediation queue
  directly to App Team 1 instead of the normal IT Support intake.
- Scope: item #2 only. Item #3 and every later item remain blocked until Main
  confirms item #2 is independently approved, integrated, and refreshed from
  live `dev`.
- Lane: `C:\repos\AshenSpire-qa-02-new-slot`, branch
  `codex/qa-02-new-slot`, deliberately rebased from staged candidate
  `fa7e9061cc2beef569e4fd7ed70db0257ae0559b` onto
  `origin/dev@9a37d67f567b7dca0b17977872b4b504bccb6a16`.
- Delivery state: local candidate only. No push, PR, merge, project-board
  mutation, hosted deployment, publication, release promotion, or item #3 work.

## Observed player problem and reconciliation

The staged pre-item-#1 candidate found two divergent title states. New Game
selected the first empty slot, but focused the first row; activating another
slot also read the nonexistent `data-slot` attribute, which could erase visible
selection while leaving Continue enabled for an invalid slot.

Item #1's integrated title work already replaced that stale attribute path with
the shared `activateSlot(+button.dataset.slotPick)` event. The item #2 rebase
therefore preserved item #1 instead of replaying the obsolete handler. The
remaining live-base defect was exact: slot 2 rendered selected and owned the
Continue target while unified focus stayed on occupied slot 1.

## Player contract

```text
Open New Game
    |
    v
first empty slot = selected card = aria-pressed = focus = action target
    |
    +-- activate same slot ----------> same state, no deselection
    |
    +-- activate another slot -------> all five signals move together
    |
    `-- Continue --------------------> create in that exact selected slot
                                           |
                                           `-- Save and Quit changes only it
```

- `saveSlotSelectionModel` is a DOM-free immutable component aggregate shared
  by Load and New Game.
- Each selectable slot emits a semantic `select-save-slot` Behavior Model.
- The primary action carries either `create-in-save-slot` or `load-save-slot`
  with the same slot projected as selected.
- The title screen owns lifecycle and callbacks, restores unified focus to the
  model's selected slot, and commits only the model's action payload.

## Changed stable components

- `title-menu-modal`
- `title-save-slot-list`
- `title-save-slot`
- `title-modal-actions`
- `title-modal-continue-control`

Model owner: `saveSlotSelectionModel`. Screen host/renderer:
`title.mountTitle`.

## RED-first and behavior evidence

- Focused item #2 gate: 12/12 source checks across immutable model projection,
  390x844 pointer flow, 1200x730 keyboard flow, responsive fit, and a full
  Create → Map → Save and Quit → Load storage receipt.
- Item #2 same-door corpus: 4/4 plants caught; clean copied tree green. Plants
  cover stale slot attributes, initial focus drift, wrong initial-slot choice,
  and a primary action targeting a different slot.
- Shared component gate: 20/20 contracts; 20/20 planted regressions observed
  red, including detaching Title from the save-slot model.
- Existing startup/title gate: 62/62, including all item #1 Load selection,
  review, Back/Escape, hold, keyboard, pad, and tap-floor evidence.

## Exact artifact and visual evidence

- Build: `0.4.0.1368`.
- Source digest: `ebdc7c0ea9` over 308 canonical source files.
- Generated aliases: `AshenSpire.html`, `build/AshenSpire.html`,
  `dist/AshenSpire.html`, and `dist/AshenSpire-0.4.0.1368.html` are
  byte-identical at 4,129,346 bytes.
- Artifact SHA-256:
  `c281747ab43c06471609ea1fe9f067cb622e4fec29e3c543f422efdef3d45f1a`.
- Local exact-source preview: <http://localhost:8583/?shot=title>.

- [390x844 selected New Game slot](../preview/qa-new-slot-selected-mobile-390x844.png)
  — SHA-256 `fb1f8630cdcabdabfa6d6e2157a458019f714442d066c06b09974548ffe68d26`.
- [1200x730 selected New Game slot](../preview/qa-new-slot-selected-wide-1200x730.png)
  — SHA-256 `55958086bac63a51f0b9d0518c17371db906ae370f73617e50015feb18521a18`.

Both captures were reviewed at original resolution. Slot 3 has one visible
selected treatment and one unified-focus outline, Continue is enabled, the
modal is unclipped with zero horizontal overflow, and selected-slot/action
controls clear the authored 44px tap floor.

## Verification receipt

- `node tools/title-new-slot.mjs`: 12/12.
- `node tools/title-new-slot.mjs --selftest`: 4/4 plants; clean copy green.
- `node tools/startup-gate.mjs`: 62/62.
- `node tools/startup-gate.mjs --selftest`: 25/25 plants; clean copy green.
- `node tools/ui-components.mjs`: 20/20.
- `node tools/ui-components.mjs --selftest`: 20/20 plants.
- `node tests/run-node.mjs`: 110 passed, 0 failed.
- `node tools/testnumbers.mjs --raw`: 108 labels, no duplicates.
- `node tools/content-build.mjs --check`: generated content current.
- `node tools/linkcheck.mjs`: 357/357 module graphs link.
- `node tools/verify-shipped.mjs`: 6/6 byte/provenance checks.
- `node tools/verify-shipped.mjs --selftest`: 25/25 checks.
- In-app exact-source console review: zero warning/error entries; displayed
  stamp, selected slot, focus slot, and action target all matched build 1368 / slot 2.
- `git diff --check`: clean before commit.

## Remaining boundaries

- The desktop item #2 flow uses real keyboard events; a physical controller was
  not used for the new-slot flow. The unchanged shared controller input and
  item #1 Load controller path remain green.
- Real-device Safari was not run.
- Independent QA remains separate from this maker receipt and must be
  coordinated through Main before integration approval.
- Release/main authority remains Constantine-only.
