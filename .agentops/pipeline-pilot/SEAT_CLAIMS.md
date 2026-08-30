# Unique seats and authoritative claims

Issue #269 cannot safely transfer work between shared role actors such as
`maker`. A seat therefore has a provider-neutral ID of the form
`seat:<team>:<uuid-v4>` and a random capability held outside Git. Git stores
only its SHA-256 fingerprint in a separately issued trusted seat registry.
GitHub identity, provider name, chat title, and role name are never seat
identity. The transfer caller cannot supply or replace that fingerprint.

A claim binds exactly one ticket, seat, writer lease, ref, and path set. The
live denominator is held outside the checkout under the repository-wide
Git-local scheduler state so assignment cannot dirty `dev`; the runtime config
points to the canonical claims, leases, events, trusted registry, and per-seat
capability files. Every
mutation names the expected claim hash. A transfer succeeds only when IT
Manager III authorizes it, the target seat proves its capability, the expected
hash matches, the exact sealed lease is current and congruent, and no live
claim overlaps the target path or ref. A repository-local transaction lock and
recovery journal bind the claim, lease, and chained audit event; a crash is
completed forward before another CAS attempt. Project, protected refs, and
product files are outside this layer.

Expiry does not silently release work. It makes the claim recoverable by IT
Manager III; recovery uses the same CAS, target proof, collision checks, and
audit event. Rollback is another forward event restoring the prior body.

Wake packets carry only `seat_id`, ticket, claim hash, lease ID, expiry,
objective/next action, and bounded evidence pointers. They never carry the
capability, full history, backlog, or unrelated claims.

The watcher plans against tracked AgentOps capsules and role leases, then binds
that offer to the exact unique-seat claim and lease before mutation. A safe
offer becomes `ASSIGNED` only after the recoverable claim+lease+event journal
commits. `ALREADY_ASSIGNED` is an idempotent no-op. A missing or contradictory
runtime, bad capability, stale CAS, duplicate ticket, overlapping path/ref, or
failed journal leaves the terminal identity unprocessed so the next clean
cycle may retry. Stopping the watcher disables assignment; rollback is a new
forward CAS transfer and audit event, never deletion or history rewrite.
