# Default combat perspective and branch consolidation

- Owner decision, October 9, 2026: the approved alternative combat perspective moves into regular `dev`, then regular `test`. All pending combat changes follow that path.
  - Keep the foreground player, centered distant enemy formation, approved stature and hand overlap from `alternativeCombatComposition`.
  - Keep the authored alternative art, animation stages, compositor and equipment mapping. The existing Alternative display appearance remains the fresh-install default; a player's explicit Classic preference remains usable.
  - Keep the readable cards, stance/counter/status/Blight/intent/knowledge/Upcast mechanics and the reviewed compact-screen control fixes from both pending feature branches.
- `alternative/dev` and `alternative/test` are frozen historical refs. Do not merge, push or automatically sync further updates into them.
  - Frozen `alternative/dev`: `faf922cb3bd22468f63115350e1288bce236110b`.
  - Frozen `alternative/test`: `c63e4524b2197745fd1c931a436ba82541f704ee`.
  - Repository update restriction `24812247` protects these exact refs with no bypass actors. It also blocks writes from old workflow definitions retained on those branches.
  - The dedicated root alternative-sync workflow is disabled. Pair synchronization excludes the exact root pair; named variants retain their preservation and atomic-push rules.
- Deliver changes through reviewed PRs to `dev`, required fast CI, successful current-tip architecture sync and normal `dev` to `test` promotion.
  - Source/core results, native gameplay/screenshots, actual device/LAN checks and published-channel acceptance are separate evidence.
  - The former four-channel plan is replaced by regular Dev/Test delivery. Frozen alternative publications remain historical previews.

See [CONTRIBUTING.md](../CONTRIBUTING.md) and the [component catalog](component-catalog.html).
