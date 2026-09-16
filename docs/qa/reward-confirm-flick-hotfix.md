# Reward confirmation repair

The reward chooser accepts the first touch, keeps the pending selection when returning from Back, and rolls back a failed or refused card save so Confirm can retry without duplicating a card. Collection remains a separate explicit action.

The original PR also proposed a competing flick implementation. Conflict resolution preserves the newer TouchFlickModel, nearest legal target selection, cancellation behavior, and Accessibility controls already delivered by PR #856. The obsolete implementation and its temporary recovery bundle are retained in Git history, not shipped alongside the current model.

Validation includes tests/reward-confirm.test.mjs, the full Node suite, build identity and shipped-artifact checks, and browser confirmation and retry flows. See the PR for results from the final revision.
