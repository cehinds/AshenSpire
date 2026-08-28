# AS-HD-20260826-049 current-base security and canonical projection correction

BASE | `origin/dev@5af802e619ec5093a058c50511e14e97ea99bf12`

LANE | `codex/coordination-structure-reset-current` in `C:\repos\AshenSpire-coordination-reset-current`; sole writer `/root/ticket_dedupe`.

SECURITY | Escalation reads now accept only a safe Help Desk ticket filename component, remain inside the escalation root after realpath resolution, reject symlinks/non-files, and cap item/history bytes at 1 MiB. Traversal and oversized-record plants are required.

OPERATING MODEL | Canonical authority, ticket, team, plural feature, and migration paths are compatibility projections. Every projection is hash-bound to its authoritative source and contains no copied lifecycle, assignment, permission, or channel state. `POINTER.json` remains the sole entry and directly binds the migration manifest.

ARCHIVE | `tickets/COORDINATION-STRUCTURE-RESET/ticket.json` is retained byte-identical as `HISTORICAL_NONCURRENT`, superseded by `AS-HD-20260826-049`; it is not pointer-selected. Cleanup inventory is `migrations/archive-inventory.json`.

AUTOMATION | Current repository state is a manual read-only reconciler, not a scheduled mutation. External automation is `UNKNOWN` and is not inferred.

ROLLBACK | Revert the single local correction commit before remote delivery, or append a later pointer/history correction. Never rewrite the prior chain, delete the retained historical ticket, or remove the only origin ref for unintegrated work.

BOUNDARY | Local implementation, tests, evidence, and commit only. No push, PR, merge, publication, deployment, or release.
