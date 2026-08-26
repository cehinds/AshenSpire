# Defect runbook

1. Help Desk records the player/maintenance impact, environment, exact SHA,
   reproduction, expected/actual result, severity, evidence, and owner.
2. Reproduce from the real failing surface. Create the smallest discriminating
   known-bad fixture or flow before repair when practical.
3. Main resolves scope, ownership, architecture, or product ambiguity. A maker
   claims only the repair, regression, and required evidence paths.
4. Implement the smallest behavior-preserving repair outside the defect.
5. Run the focused regression, relevant suites, persistence/input/viewports as
   applicable, and `git diff --check`.
6. Freeze the exact head. Independent Functional QA reruns the real flow and
   negative plant; Experience QA follows when the defect is experience-bearing.
7. Return the consolidated receipt with rollback boundary and separate delivery
   facts.

Rollback restores the pre-repair behavior and removes the new regression only
as one reviewed unit. A failed or unknown test remains blocking; QA does not
repair maker-owned product paths without reassignment.
