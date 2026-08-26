# Feature runbook

1. Record player outcome, SPEC/GDD acceptance, non-goals, data/schema/save
   impact, dependencies, authority, fresh base, claimed paths, tests, QA, and
   rollback in a contract-ready ticket.
2. Reuse existing models, components, services, controllers, and data owners.
   A new shared boundary requires an IT Manager III architecture decision; a
   mechanic requires approval from its existing product authority through the
   technical relay.
3. Implement one bounded vertical slice without unrelated cleanup. Keep source
   authority distinct from generated projections and serialized artifacts.
4. Run targeted and negative checks, applicable full suites, and the
   [Feature Delivery Loop](../../FEATURE-DELIVERY-LOOP.md).
5. Update affected authoritative documentation, config/schema references,
   component/asset catalogs, changelog projection, and evidence in the same
   origin-bound ticket when required.
6. Freeze one head for independent Functional QA and applicable Experience QA.
7. Return a consolidated receipt that does not equate local, PR, integration,
   hosted, resolved, or released states.

Rollback is the smallest vertical slice. Preserve compatibility for saved or
public identifiers; migrations and generated artifacts follow their own
runbooks/gates.
