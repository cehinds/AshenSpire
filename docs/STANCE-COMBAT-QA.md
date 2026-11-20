# Stance combat screenshot coverage

`tools/attic/stance-combat-qa.mjs` captures the production combat screen in Chromium at 1440×1000 and 390×844. It was run by the `ward-to-block-cards` workflow, which was deleted (M10); run it by hand. It writes PNG, JPEG, and a compact JSON report to `outputs/stance-combat/`; generated screenshots are not committed.

The captures cover the player HP row with Evade, Poise, Ward, and Block; inspection of a defense, counter, and spell card; a selected damaging card against a known enemy; percentage suppression for an unknown enemy; and neutral, advantage, and disadvantage hit previews. Event frames capture Hit, Hit — Evade Failed, and Missed callouts.

The script uses the application’s screenshot route and production combat renderer, production card and enemy definitions, and deterministic fixture state for the hand, combat meters, observer knowledge, stance flags, and Accuracy RNG stream. The report identifies these fixtures so the screenshots are not mistaken for recorded playthroughs.

Review every PNG for layout, artwork, text legibility, and callout timing. The script fails on missing expected DOM states and browser or network errors; the screenshots provide the visual evidence.
