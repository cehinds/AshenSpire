# Combat CI repairs

The changes below correct independently reproduced failures. Historical rule tests use the authored rule shapes from the commits that introduced the cases. Existing frozen save fixtures and generated gameplay locks are unchanged.

| Commit | Failure and contract | Verification |
| --- | --- | --- |
| `12fcba8a97f` | Live Intelligence entered Arcane receipts twice. SPEC §25's live-stat rule uses the effective INT for Arcane, WIS for Divine and max(INT, WIS) for shared spells. Removed the duplicate live boost stage. The named Intelligence status retains its own receipt modifier. | Card-face and gameplay/economy tests: 49 passed. New test compares the live forecast and the committed hit under each dominant attribute. Original engine source fails the original shared-WIS check and the new regression with 13 versus 12. |
| `f4ebe9e13af` | The Smite fixture left Poise after the live Divine contact, then a relic broke it. SPEC's Divine Smite rule requires the Divine contact itself to break Poise. The fixture now sets a consistent three-Poise target. The quote equals the direct hit plus the separately emitted Smite rider and actual HP loss. | `node --test tests/spell-tradition-combat.test.mjs` passed all 16, including historical profiles. |
| `27e086425ec`, `54548d8709b` | The magic-Poise-first, Force split and intent-Poise suites had loaded current weapon-Poise rules. Their fixtures now use the exact historical Poise/Ward shapes from `6e91894e54c`, `672b3970cac`, and `71ad5e7024e` respectively. SPEC §4.1a preserves older Ward routing. The current weapon-Poise path from `15d221435d` has separate coverage in `gameplay-economy-bugfixes.test.mjs` and a new intent case for an enemy weapon consuming one Poise and breaking the target through a fully blocked hit. | All original arithmetic, preview-to-live, tooltip, and BREAK assertions retained. |
| `5683b8bc0cb` | All eight Flowing Transition tests relied on the older opening draw revealing the tested card by chance. This low-level combat fixture now deals a one-card deck, so it always tests stance choices through the same real dispatch calls. | Combined Poise, Force, intent and Flowing Transition run passed 42 tests. |

```powershell
node --test tests/magic-poise-first.test.mjs tests/flowing-transition-stance.test.mjs tests/intent-poise.test.mjs tests/force-poise-split.test.mjs
```

The unchanged core lane completed 151 checks, and `npm run code:check` passed on the INT/WIS fix. Inherited combat failures in other files remain under review.
