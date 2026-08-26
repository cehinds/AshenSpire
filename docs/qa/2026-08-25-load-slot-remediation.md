# Load-slot selection and review remediation — item #1

## Status and authority

- Owner: AshenSpire App Team 1.
- Routing override: Constantine assigned this 27-item remediation queue directly
  to App Team 1 instead of the normal IT Support intake.
- Scope: item #1 only. Item #2 and every later item remain gated on Main's
  confirmation that the previous item was approved and integrated.
- Lane: `C:\repos\AshenSpire-qa-01-load-slot`, branch
  `codex/qa-01-load-slot`, based on
  `origin/dev@75061e3ae78d8ca52df414b12d7548157ce0cf0f`.
- Delivery state: local candidate only. No push, PR, merge, project-board
  mutation, hosted deployment, release promotion, tag, or publication.

## Observed player problem

An occupied Load Game slot could look selected while Continue was disabled.
The visible single-select state and the command state disagreed, so the player
could not tell whether activating the highlighted save would select it, deselect
it, or load it.

## Player contract

```text
Open Load Game
    |
    v
occupied slot visibly selected + Continue enabled
    |
    +-- first activation ------> selection/focus preserved
    |
    +-- second activation -----> themed review
    |                              |-- Back/Escape -> same selected slot
    |                              `-- Load Save --> selected run
    |
    `-- 600 ms pointer/touch hold ----------------> selected run
```

- A selected occupied slot and enabled Continue now derive from the same slot.
- First activation is idempotent and leaves selection, focus, and Continue intact.
- Second activation opens a themed review with neutral **Back to Saves** and
  green **Load Save** actions.
- Back and Escape return to the Load list with the same slot selected and focused.
- A stationary 600 ms pointer/touch hold loads directly. The slot exposes
  **HOLD** plus explicit tooltip and accessible help.
- Keyboard and controller activation use the same deterministic first/second
  activation state; neither depends on browser double-click timing or inherits
  the timed pointer shortcut.

## Stable components and owners

Changed catalog components:

- `title-menu-modal`
- `title-save-slot`
- `title-modal-actions`
- `title-modal-back-control`
- `title-modal-continue-control`

The controller remains `title.mountTitle`; the shared pointer/touch gesture is
`holdconfirm.armHold`; the duration is authored at
`balance.ui.titleLoadHold.ms` and validated by `validateContent`.

## Exact artifact

- Build: `0.4.0.1365`
- Source digest: `ab582e3a9b`
- Generated aliases: `AshenSpire.html`, `build/AshenSpire.html`,
  `dist/AshenSpire.html`, and the local stamped alias are byte-identical.
- SHA-256: `89e0dfbedf643d60f44a2f570b276ef311c8204c3d13969758b44bcc87894a0c`
- Local source preview: <http://localhost:8582/?shot=title>

## Behavior and visual evidence

- Full focused browser gate: 60/60 at the exact displayed build/source stamp.
- Compact browser gate: 51/51.
- Same-door known-bad corpus: 23/23 plants caught; clean copied tree green.
- Covered state transitions: initial selection/Continue agreement; idempotent
  first activation; pointer, keyboard, and production-poller controller second
  activation; Back; Escape; review commit; direct mobile touch hold; help copy;
  responsive startup/title shapes; zero unavailable/UNKNOWN result.

Visual captures were preserved from the inherited frozen UI state and reviewed
at original resolution; later changes were test/evidence-only and did not alter
the rendered title UI:

- [390x844 Load list](../preview/qa-load-slot-list-mobile-390x844.png)
- [390x844 load review](../preview/qa-load-slot-review-mobile-390x844.png)
- [1200x730 load review](../preview/qa-load-slot-review-wide-1200x730.png)

The phone list shows the selected occupied slot, enabled Continue, visible HOLD
instruction, and explicit help. Both review captures show unclipped neutral Back
to Saves and green Load Save actions.

## Verification receipt

- `node tests/run-node.mjs`: 110 passed, 0 failed after the exact build.
- `node tools/testnumbers.mjs --raw`: 108 labels, no duplicates.
- `node tools/content-build.mjs --check`: generated content current.
- `node tools/ui-components.mjs`: 19/19 contracts.
- `node tools/ui-components.mjs --selftest`: 19/19 plants observed red.
- `node tools/linkcheck.mjs`: 355/355 module graphs link.
- `node tools/verify-shipped.mjs`: 6/6 checks.
- `node tools/verify-shipped.mjs --selftest`: 25/25 known-bad/control checks.
- `git diff --check`: required in final commit receipt.

## Remaining boundaries

- The browser controller evidence uses a standard-mapping gamepad shim read by
  the production poller; a physical controller was not used.
- Real-device Safari was not run.
- Independent QA review remains separate from this maker receipt and must be
  requested through Main before integration approval.
- Release readiness remains RED and Constantine-only.
