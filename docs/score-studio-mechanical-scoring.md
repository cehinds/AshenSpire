# Score Studio mechanical scoring

Card CP now uses the same neutral mechanical values as the static card face. The shared projection applies the existing profile, class reference, equipment and rounding before the authored scoring weights. Sampled combat damage, temporary stances and enemy mitigation do not define this baseline. Conditional effects and next-card charges retain their estimated reliability.

An authored amount is a model input. For example, Serrated Cut authored damage 8 and 7 both display 3 damage and have the same CP; authored 16 displays 5 damage and changes CP. Rebalance comparisons show the mechanical numbers. Generation, subclass preview/download/export, upgrade eligibility and the command-line report use this shared projection.

Upgrade budgets reuse the bound game profile's neutral class reference, including custom and saved profile rules. Numeric damage upgrades also pass a first-play incoming-damage check: the shared combat offense calculation rejects increases that disappear under intrinsic stance and element rounding. This check uses a detached attacker without an enemy, temporary statuses, or elemental flux; CP continues to price the neutral static face. Conditional payloads, charges, variants, and Counter returns retain their existing eligibility checks.

The shared-reader extraction preserves the existing saved-runtime fingerprint. Mechanic ownership still names the canonical engine entrypoints; the generator verifies their direct calls into the shared implementations before attributing those readers. Existing save validation remains in force, and this extraction requires no save migration.

The owner-approved Studio weights and authoring bundle are retained in `content/source/scoring.json`, `tools/score-studio/saved-scoring.json`, and `content/source/studioDecks.json`. Five ranks use 20 CP bands; the generator ceiling is 100 CP. The official `combat-power` and `level-lists` builders derive current scores and reward eligibility from those settings. Historical arithmetic tests explicitly load the pre-edit scoring fixture; current-policy tests exercise shipped rank, rarity and level-budget decisions.

The active eleven-card Starseer list is installed in the Core pack, including the three custom card IDs. New Starseer runs start with four Ward, one Arcane Bolt, one Mana Rite, and four Arcane Strike, plus the existing equipment-granted art. Authored base effects, upgrades and rating values are preserved; all resource variants use the updated prices. Existing saved profiles retain their own content and starter deck. The raw Studio bundle also preserves other decks and unfinished authoring cards, without installing its blank placeholder into the game.

The 180 subclass cards remain an opt-in Studio catalog. They were not installed into the task checkout's canonical game content. A separate temporary fixture verifies export, both content pipelines, all four builders, idempotency and score agreement after reload. Forced low-rank recipes report an actionable miss or unavailable signature upgrade when their actual mechanical ceilings cannot accommodate the request; no CP pins hide that result.

Verification includes 900 requested-rank variants, 180 default authored upgrades with actual mechanical changes, shared renderer/export metadata checks, and the official freshness checks.
