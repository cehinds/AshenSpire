# QA remediation item #3 — exact combat Save Game

## Routing and scope

Constantine assigned the numbered remediation queue to App Team 1 through
AshenSpire — Main, overriding ordinary Help Desk intake for implementation.
Help Desk remains the intake/status ledger; Main remains the mandatory relay,
technical triage, sequencing, and approval authority. This candidate changes
item #3 only. Item #4, GitHub delivery, Project mutation, publication, release,
and `main`/`release` remain out of scope.

The maker lane is `C:\repos\AshenSpire-qa-03-combat-save` on
`codex/qa-03-combat-save`, refreshed and deliberately rebased from exact live
`origin/dev@d6318d063fe47419d263f7d3a5a6041d7c0fdade` after item #2 integrated.

## Broken player contract

The in-combat controls were named **Save** and **Save and Quit**, but the stored
`combatEntered` receipt could behave only as an encounter-entry checkpoint.
Continue could therefore refund spent resources, rebuild the opening hand and
piles, and reroll/replay setup instead of returning to the state the player
explicitly saved.

## Repair

- `src/model/combatSnapshot.js` owns one closed, versioned persisted model and
  field-addressed structural/content-reference validation.
- `src/engine/combatSnapshot.js` owns `CombatSnapshotService`: serialize only a
  fully committed boundary, restore without replay, and project the same live
  resources/loadout into the run and slot summary.
- Save and Save and Quit enter the same `commitCombatSnapshot` command. The
  load door refuses and archives malformed or dangling exact snapshots.
- Older `combatEntered` records without a snapshot remain supported as the
  deterministic encounter-restart compatibility path.
- Player help now says both commands write the exact committed combat turn.

The player can now end a turn, Save in place or Save and Quit, reopen the slot,
and resume the exact turn, phase, HP/resources, enemies/intents, hand/piles,
statuses, triggers, equipment state, and event history they saved.

## RED-first and behavior evidence

The inherited snapshot roundtrip covered a well-formed model but accepted a
planted invalid phase. Test 75 was first extended to require a named refusal;
the observed RED was:

```text
FAIL 75 ... malformed exact snapshot must be refused by its field, got ""
```

After the repair, test 75 also proves the real load/archive door, dangling card
references, live-queue refusal, slot-summary projection, next-turn/RNG parity,
and legacy checkpoint compatibility.

`node tools/combat-save.mjs` drives the rendered player path at 1200×730 and
390×844: non-entry End Turn → Save (stays in combat with Slot 1 receipt) → Save
and Quit → Load → occupied slot review → Load Save. It compares the complete
serialized state before Save and after Load, and checks the standing controls
fit each viewport and retain at least 44×44 input targets. Its `--selftest`
plants three known-bads through copied real source doors: encounter restart,
both commit calls removed, and restored hand dropped.

## Catalog coverage

- `save-game-control`
- `save-quit-control`

Both catalog entries name the shared `CombatSnapshotService` command and the
desktop/phone behavior gate. Markdown and interactive HTML catalogs carry the
same stable IDs.

## Candidate and verification

- Base: `origin/dev@d6318d063fe47419d263f7d3a5a6041d7c0fdade`.
- Branch: `codex/qa-03-combat-save`; the exact local candidate head is reported
  with this receipt after the final commit (a commit cannot contain its own SHA).
- Shipped build: `0.4.0.1371`; source digest `41b67b338b`; artifact SHA-256
  `3ad3fbfae2e5715811bcd2e7e80a844a802c2ebb6012d93bf5aa4c37ca798d63`;
  root/build/dist aliases are byte-identical at 4,142,693 bytes.
- Focused rendered source door: `10/10`; copied-tree known-bad corpus: `3/3`
  caught by `COMBAT-SAVE-EXACT-RESUME`, followed by a clean green copy.
- Exact shipped browser door: `10/10` across 1200×730 and 390×844.
- Full Node suite: `111 passed, 0 failed`; focused test 75 PASS.
- Save fixed-point door: `14/14`, 664 fields compared.
- Component contract: `20/20`; component known-bads: `20/20` red.
- Link contract: `360/360`; link known-bads: `5/5` red.
- Shipped artifact: `6/6`; build-version provenance: `8/8`; bundler corpus:
  `0 failing cases`; content projection current; About/Changelog: 42 receipts.
- `git diff --check`: clean.

Exact-build screenshots:

- `docs/preview/qa-combat-save-before-wide-1200x730.png`
- `docs/preview/qa-combat-save-resumed-wide-1200x730.png`
- `docs/preview/qa-combat-save-before-mobile-390x844.png`
- `docs/preview/qa-combat-save-resumed-mobile-390x844.png`

The images show the same turn-2 state before Save and after Load: HP 49/62,
MP 1/1, SP 2/2, the same enemies/intents, and the same five-card hand. The
browser assertion compares the complete snapshot rather than inferring exactness
from pixels.

## Remaining boundaries

This maker evidence covers automated Chrome on Windows at 1200×730 and an
emulated 390×844 touch viewport. It does not claim physical iOS/Android,
Safari/Firefox, controller hardware, interrupted/quota-failed storage writes,
or independent QA. Exact snapshot validation covers the current version and the
explicit older checkpoint compatibility edge; it is not a corpus of every
historical run schema. Item #4 remains blocked.
