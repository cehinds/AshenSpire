# Unique seats and authoritative claims

Issue #269 cannot safely transfer work between shared role actors such as
`maker`. A seat therefore has a provider-neutral ID of the form
`seat:<team>:<uuid-v4>` and a random capability held outside Git. Git stores
only its SHA-256 fingerprint. GitHub identity, provider name, chat title, and
role name are never seat identity.

A claim binds exactly one ticket, seat, writer lease, ref, and path set. Every
mutation names the expected claim hash. A transfer succeeds only when IT
Manager III authorizes it, the target seat proves its capability, the expected
hash matches, the lease is current, and no live claim overlaps the target path
or ref. One atomic claim write and one chained audit event are the complete
mutation. Project, protected refs, and product files are outside this layer.

Expiry does not silently release work. It makes the claim recoverable by IT
Manager III; recovery uses the same CAS, target proof, collision checks, and
audit event. Rollback is another forward event restoring the prior body.

Wake packets carry only `seat_id`, ticket, claim hash, lease ID, expiry,
objective/next action, and bounded evidence pointers. They never carry the
capability, full history, backlog, or unrelated claims.
