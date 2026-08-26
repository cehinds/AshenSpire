# AshenSpire development coordination workflow

This path is the compatibility entry point for AshenSpire coordination. The
versioned policy and contract set is the [governance index](governance/README.md).
The index owns the current documents rather than duplicating them here.

## Canonical policy map

- [Authority](governance/AUTHORITY.md) — IT Manager III, Integration & Delivery,
  Help Desk, delegated authority, decisions, exceptions, integration, and the
  release boundary.
- [Team charters](governance/TEAM-CHARTERS.md) — capability pools and temporary
  lead-owned delivery pods.
- [Workflow](governance/WORKFLOW.md) — typed truth, lifecycle, routing, WIP,
  receipts, and context hygiene.
- [Quality gates](governance/QUALITY-GATES.md) — exact-head evidence,
  functional and experience QA, generated artifacts, and rollback.
- [Ticket schema](governance/TICKET-SCHEMA.md) — the required durable work
  contract and lifecycle event record.
- [Decisions](governance/DECISIONS/README.md) — approved policy decisions and
  their effective state.
- [Runbooks](governance/RUNBOOKS/README.md) — defect, feature, UI, art, save
  migration, modernization, and release procedures.

Project #4 `Status` is workflow truth. The ticket or issue owns outcome,
acceptance, and decisions; versioned documents own policy and contracts;
Git/PR/CI own code and integration evidence; Pages owns hosted evidence; issue
[#183](https://github.com/cehinds/AshenSpire/issues/183) is a reporting
projection; chats are non-authoritative workspaces.

Routine intake and status go to Help Desk. Decisions, exceptions, contested
ownership, unresolved blockers, and integration rulings go to IT Manager III,
Integration & Delivery. Release authority remains separate. This entry point
grants no implementation, push, merge, publication, deployment, board mutation,
archive, deletion, or release authority.
