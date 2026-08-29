# UI runbook

1. Name the player task, stable component/model IDs, states, inputs, viewports,
   accessibility contract, source/data owners, and reuse plan.
2. Claim the smallest component/model/host/style/test/catalog/evidence paths.
   Do not create a screen-specific service when a shared boundary fits.
3. Preserve mechanics and art direction unless the ticket separately approves
   them. Keep player text in established data/config owners when supported.
4. Verify the real behavior for pointer, keyboard, touch, and gamepad paths that
   the change affects; cover persistence and unavailable/fallback states.
5. Run independent Functional QA. Run Experience QA at the frozen head with
   representative desktop and approximately `390x844` phone evidence,
   relevant text sizes, focus/reading order, contrast, motion, and touch target
   review.
6. Update both component catalogs and stable IDs in the origin-bound change when
   a component surface changes.

Screenshots prove pixels only and must be paired with state-transition/behavior
evidence. Rollback restores the prior public mount/component contract and its
catalog entry as one unit.
