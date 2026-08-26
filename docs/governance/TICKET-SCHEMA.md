# Ticket schema

Schema version: `1.0.0`

The ticket or issue is durable truth for outcome, acceptance, evidence, and
decisions. Project #4 `Status` owns workflow state. A receipt may project this
schema but must not replace it.

## Required ticket contract

| Field | Contract |
|---|---|
| `ticket_id` | Stable unique identifier. |
| `submitted_at` | Timestamp with timezone. |
| `requester` | Human or authoritative source. |
| `type` | `defect`, `feature`, `ui`, `art`, `save-migration`, `modernization`, `release`, `docs`, or recorded extension. |
| `risk` | `P0`–`P3` with one-sentence rationale. |
| `outcome` | Player-visible or maintenance result, not an implementation prescription. |
| `acceptance` | Observable conditions and explicitly out-of-scope behavior. |
| `authority` | Granted local and remote actions; omitted actions remain unauthorized. |
| `owner` / `pod` | Lead, maker, up to three bounded helpers, and capability pools. |
| `status` | Exact Project #4 lifecycle value plus timestamp. |
| `base` / `head` | Exact SHAs and repository/worktree paths; head may be pending before implementation. |
| `claimed_paths` | Exclusive source, test, evidence, docs, and serialized-lane paths. |
| `dependencies` | Ticket/decision/owner and satisfied or blocking state. |
| `test_plan` | Targeted, negative/RED, full-suite, browser, artifact, and docs checks as applicable. |
| `qa_plan` | Functional QA and whether Experience QA applies; independent reviewer. |
| `rollback` | Smallest reversible boundary and any compatibility constraint. |
| `evidence` | Exact command/flow, result, SHA, environment, timestamp, and durable link/path. |
| `decisions` | Decision ID/link, owner, options, answer, scope effect, and timestamp. |
| `policy_activation_head` | For policy work, the exact governance head named by successful independent policy QA; canonical `dev` containment derives Approved versus Active. |
| `independence_check` | Itemized `PASS`, `FAIL`, or `UNKNOWN` result for dependencies, unfinished-work independence, shared-path/serialized-lane collision, maker completion, immutable head, QA/gates, fresh base/head/PR/mergeability/CI, unchanged scope, and exact evidence. |
| `delivery_disposition` | Main's `WAIT`, `DELIVER TO DEV`, or `NOT YET DECIDED` result with exact head and timestamp. A `PASS` permits discretion but creates no duty. |
| `wait_rationale` | When disposition is `WAIT`: evidence-based reason, owner, retry trigger, safe work if any, and smallest next action. |
| `promotion_packet` | When promotion review is proposed: decision/action requested; fresh branch heads; candidate/PR/review/CI; dependencies and independence result; scope/paths; maker and QA evidence; artifact path/hash/build/source/provenance; strong playtest; current/desired Pages source and deploy/hosted proof; rollback target/procedure/trigger/actor/authority; recommendation and exact Constantine request. |
| `delivery_facts` | Separate local, pushed, PR, integrated, hosted, resolved, and released facts. |
| `next` / `block` | Smallest next action; blocker owner and retry trigger. |

## Lifecycle event

Append events; do not overwrite history.

```yaml
- at: 2026-08-25T23:59:00-08:00
  from: IN PROGRESS
  to: CANDIDATE FROZEN
  actor: maker-or-help-desk
  head: 0123456789abcdef0123456789abcdef01234567
  evidence: durable-link-or-path
  reason: Candidate and required evidence frozen for independent QA.
```

Legacy values are retained in the original event and followed by a mapped
canonical event referencing
[0002](DECISIONS/0002-lifecycle-and-legacy-mapping.md).

## Receipt projection

Internal receipts use:

```text
TICKET|STATUS|OUTCOME
PATH|BASE|HEAD|CLEAN
EVIDENCE
BLOCK
NEXT
AUTH
```

Decision packets use:

```text
EVIDENCE|OPTIONS|REC|NEXT|AUTH
```

Receipts are concise projections. The ticket retains the complete acceptance,
event, decision, and evidence history.

## Flow-metric events

Record timestamps and links sufficient to derive the following without a
second, manually retyped ledger:

| Metric | Derivation |
|---|---|
| Cycle time | `CONTRACT READY` and `IN PROGRESS` to `READY FOR MAIN`, `DEV INTEGRATED`, and `RESOLVED`; report the start used. |
| Blocked time | Sum of `BLOCKED` and `WAITING ON DECISION` intervals, separated by reason and owner. |
| Decision latency | Decision-packet timestamp to recorded decision timestamp. |
| Rebase churn | Base invalidations/rebases plus commits/files changed only to absorb base movement. |
| Escaped/reopened defects | Defects discovered after `DEV INTEGRATED`/`HOSTED VERIFIED`, or work returning from `RESOLVED`. |
| QA rejection rate | Frozen candidates returned from Functional or Experience QA to `IN PROGRESS`, divided by candidates entering that QA stage; classify reason. |
| Evidence freshness | Elapsed time from newest required exact-head evidence plus a candidate/head SHA-match result. |
| Duplicated ownership | Concurrent active claims on the same path or serialized lane. |
| Generated-artifact collisions | Overlapping, aborted, manually resolved, or repeated root/build/dist/buildordinal writes in one integration window. |

Observe distributions before setting performance targets. Hard invariants are
zero duplicated active path ownership, zero unauthorized generated-artifact
collisions, and exact-head evidence for a green claim. Do not optimize by
skipping required states or deleting inconvenient history.
