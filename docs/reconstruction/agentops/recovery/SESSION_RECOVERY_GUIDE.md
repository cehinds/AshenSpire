# AshenSpire physical-ledger session recovery guide

This is the restart contract for every new, resumed, delegated, or context-wiped session. Physical files are workflow truth; chat context, memory, persona, and dispatch messages are not.

## Bounded cold start

1. Open the team's `START_HERE.md`.
2. Validate `INDEX.json` → team `POINTER.json` → `BACKLOG.json`, readable backlog view, and current append-only continuity-node hashes.
3. Confirm the exact Team Lead, seat, session/task ID, node revision and predecessor, selected row, authority, currentness, and expiry.
4. Read only the selected row and directly referenced evidence. Do not copy the full queue into chat or context unless an explicit portfolio audit requires it.
5. `PROPOSED_NOT_ENTERED` means no work has started. The Lead must append a continuity revision recording the exact session/task, writer, authority, entered-at time, and receipt before execution is credited.
6. Perform only the single recorded next action. Drift or ambiguity stops only the affected row and wakes the Lead.

## Material transition protocol

After assignment, entered-work ACK, blocker attempt/escalation, evidence return, reassignment, authority change, completion, or retirement:

1. Validate the current pointer, node, and backlog hashes.
2. Create the next immutable `continuity/session-rNNNN.json` and matching Markdown view. Bind `previous_node_or_none` to the prior path, SHA256, and revision.
3. Validate referenced evidence, writer ownership, workspace/ref/process/residue facts, and expiry.
4. Atomically replace `POINTER.json` last; then refresh the root index pointer hash.
5. Preserve all prior nodes, receipts, and history. Never choose authority by file modification time.

Two writers claiming one next revision is a collision: stop both writers and have the Team Lead reconcile exactly one successor.

## Required seat node

Each occupied seat records exact session/task identity, selected row and priority, bounded objective, one next action, evidence target, blocker/attempts/owner/wake, writer, entered-work receipt, returned evidence, authority ceiling/expiry, workspace/ref/process/residue state, and predecessor/current-node identity.

## Delegation and cleanup

A child gets only its selected row, objective, evidence target, authority, expiry, and parent pointer—not the whole backlog. Dispatch is not entered work. The child ACKs before execution and returns exact evidence or an exact blocker. The Lead reviews the return before completion, retires child authority/resources, and preserves task history/evidence/receipts. Child spawning requires explicit Lead authority.

## Priority and blockers

Delegate all suitable independent work first, then attack the highest-impact blocker. Escalation is Team Lead → Help Desk/IT Support → IT Manager III → Review Hub. Blockers name the condition, attempts, evidence, owner, elapsed basis, and wake event. Unaffected seats continue, and a completed or legitimately blocked seat advances to the next actionable row.

## Authority boundary

No ledger row or continuity node grants push, merge, deployment, publication, delivery, release, deletion, or another role's protected verdict. #029 preserves exact-object Application → CQM → Data → QA1 → QA2 → ITM3 order. The 13 ledgers are functional routing groups covering 20 canonical homes; they do not replace P/T taxonomy.

## Fail closed

Missing, malformed, stale, expired, ambiguous, or hash-failed pointers/nodes are `UNKNOWN/WITHHOLD` for affected work. Never reconstruct from memory. Preserve the last verified head and route exact repair evidence.
