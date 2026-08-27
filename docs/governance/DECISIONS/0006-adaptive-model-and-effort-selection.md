# 0006 — Adaptive model and effort selection

- Decision status: **Approved**
- Policy effective condition: independently reviewed governance head contained
  in fresh canonical `dev`
- Decision owner: IT Manager III, Integration & Delivery
- Initiative: `AS-HD-20260826-024`

## Decision

Model and reasoning effort are selected for the assignment's risk and station,
not for a person's title, seniority, pool, or authority. Every new assignment or
reassignment packet records, on one line:

```text
MODEL <model> | EFFORT <effort> | WHY <risk-and-station reason> | ESCALATE WHEN <observable trigger>
```

Use the smallest capable pairing supported by the current execution venue:

| Risk and station | Default pairing | Typical work |
|---|---|---|
| Low-risk routine coordination | `gpt-5.6-luna` with `low` or `medium` | Intake normalization, status projection, known-format evidence indexing, and bounded read-only checks. |
| Bounded delivery or verification under known contracts | `gpt-5.6-terra` with `medium` or `high` | Small implementation, documentation, focused testing, and ordinary independent QA. |
| High-risk or cross-system reasoning | `gpt-5.6-sol` with `high` or `xhigh` | Architecture, governance, schema/save compatibility, security, incident/P0 analysis, integration, and promotion-readiness analysis. |
| Exceptional unresolved multi-system risk | A capable available model with `max` | Only when the packet records the exceptional reason that lesser effort is inadequate. |

Availability is checked at assignment time. If a named default is unavailable,
the assigning authority records the supported substitute and why it is capable;
this is a reassignment and requires a complete packet.

The selected pairing remains fixed for the active turn. A model or effort
change requires an escalation receipt that records the trigger, partial
evidence, new pairing, reason, ownership/path continuity, and authority. The
new assignment does not erase the prior receipt.

## Authority and independence

Model selection grants no product, path, board, integration, delivery,
publication, or release authority. A stronger model does not outrank a weaker
one. QA independence comes from a non-maker reviewer, an immutable exact head,
and independently produced evidence; using a different model is neither
required nor sufficient.

## Rollback or supersession

Revert this bounded governance commit before activation, or append a later
decision that replaces the matrix and provides an assignment migration rule.
