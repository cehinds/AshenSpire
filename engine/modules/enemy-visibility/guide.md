# Enemy visibility module (`enemy-visibility@1.0.0`)

What the player sees of an enemy. `shown` (default HP, poise, intent, defense, statuses) is always visible; each other field is revealed by a tag the player holds (`revealedBy`, e.g. insight, bestiary). Read with `enemyVisibleFields(settings, viewerTags)`. Off: everything is visible.

Turn off from `game.json`: `{ "modules": { "enemy-visibility": false } }`.
