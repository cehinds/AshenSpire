# Modernization runbook

1. Begin with a read-only, risk-ranked register entry naming maintenance or
   player outcome, evidence, dependencies, candidate paths, tests, independent
   QA, and rollback.
2. Do not use a big-bang rewrite. Settle architecture/data/schema/asset authority
   before moving code or ownership.
3. Characterize observable behavior first. Extract one seam, shared service,
   component, model, schema owner, or mechanical gate per ticket.
4. Prefer reusable composition, generic services/controllers, data-driven
   configuration, explicit schemas, external asset manifests/paths,
   deterministic migrations, and mechanically enforced policy.
5. Preserve product behavior, mechanics, art direction, and scope unless a
   separately approved ticket changes them.
6. Run targeted negative evidence, relevant full suites, documentation/contract
   checks, and independent QA. A refactor that changes behavior returns to the
   IT Manager III for scope classification and product-authority routing.
7. Return the consolidated receipt; update the register with resolved debt,
   residual risk, evidence freshness, and follow-up—not an automatic next patch.

Idle modernization is read-only. Rollback restores the pre-extraction public
seam and removes only the bounded gate/adapter introduced by the ticket.
