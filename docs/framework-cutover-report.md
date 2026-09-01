# Data-Driven Property Framework — replacement candidate & cutover report

Status: **complete replacement candidate delivered; cutover NOT performed.**
Per the framework contract's own failure path (`One-shot replacement and atomic
cutover`): when any required gate is not PASS, the current runtime is preserved
and every failure is reported. This document is that report, and the standing
boundary until a recorded cutover decision closes it.

Run the gate yourself:

```sh
node tools/framework-gate.mjs            # report mode
node tools/framework-gate.mjs --cutover  # exit 0 only on full SUCCESS
```

## What the candidate is

Everything under `src/framework/` plus the authored data in
`content/framework/` (compiled to `src/framework/data/` by
`tools/framework-data-build.mjs`, `--check` guards drift):

| Layer | Home | Contract section |
|---|---|---|
| Canonical registries (Property/Term/Asset/Content/Confirmation/Theme) | `src/framework/registries.js`, `schema.js` | Canonical relational model |
| Deterministic property compiler | `src/framework/compiler.js` | Deterministic compiler |
| Card lifecycle & zones | `src/framework/lifecycle.js` | Card lifecycle |
| Cost compilation & atomic alternative costs | `src/framework/costs.js` | Cost compilation |
| Deck composition, weapon card plans, unarmed fallback | `src/framework/deck.js` | Deck composition, Unarmed fallback |
| Mana & Stamina rules | `src/framework/resources.js` | Mana and Stamina |
| Weight Class & Dodge Roll | `src/framework/weight.js` | Weight Class and Dodge Roll |
| Whitelisted inheritance (PERMITS relations) | `src/framework/inheritance.js` | Whitelisted inheritance |
| Shared presentation (components, tooltip engine, confirmation grammar, fitText) | `src/framework/presentation/` | Shared presentation system, Modal grammar, Tooltip behavior, Theme and layout data |
| Legacy importer (all 392 entities) | `src/framework/importer.js` | One-shot replacement |
| Complete validation + known-bad corpus | `src/framework/validate.js`, `tests/framework.test.mjs` | Complete validation |
| Cutover gate | `src/framework/candidate.js`, `tools/framework-gate.mjs` | Cutover gate |

Nothing in the running game imports `src/framework`; the legacy runtime
(`src/content` + `src/engine` + `src/ui`) remains the sole production
authority. That is the contract's required posture for a candidate that has
not passed every gate — no mixed old/new authority.

## Gate status (2026-09-01, this tree)

| Required gate | Status | Evidence |
|---|---|---|
| schema and reference validation | **PASS** | `validateAllContent` — zero failures over authored + imported rows |
| property-conflict and cycle validation | **PASS** | every entity compiles; conflicts/requirements/cycles checked; known-bads observed red |
| complete entity counts | **PASS** | 392/392 legacy entities imported (195 cards, 41 equipment, 50 statuses, 19 enemies, 4 classes, 55 relics, 7 flasks, 20 locations, 1 UI surface) |
| asset and terminology validation | **PASS** | typed fallback chains terminate; zero terminology drift against legacy keywords |
| save compatibility | **PASS** (data level) | every imported entity carries its legacy id verbatim; the candidate never reads or writes a save |
| unchanged-gameplay equivalence | **PASS** (data level) | all 180 legacy cards round-trip: type, cost, manaCost, keywords, damage school, targets reconstruct exactly from compiled properties. Runtime replay equivalence is gated by the regression suite. |
| approved new-mechanics acceptance | **NOT_RUN** | stamina/weight/dodge/seal/recall/alternative-cost services implemented and unit-tested; acceptance sign-off is a human decision, not this tool's |
| responsive UI and accessibility | **PASS** (component level) | accessible-name/tooltip-fallback walks and measured contrast pairs; browser-level responsive proof stays with the existing shot tooling |
| full regression suite | **PASS** | `tests/framework.test.mjs` 43/43 green; `tests/run-node.mjs` green (the one baseline red, test 19, was fixed upstream by the item-upgrade redesign merged in #507) |
| proof that legacy runtime authority is unreachable | **FAIL** (by design, honestly) | cutover has not been performed; legacy consumers still read `src/content`/`src/engine` directly |

## Port progress (legacy consumers now deciding through the framework)

The port runs behind the legacy interfaces via `src/framework/bridge.js`
(attached to every `createRegistries()` result as `registries.framework`).
Decisions run on the RESOLVED card def — upgrades and mods can change
keywords — mapped through the importer's one card-mechanics mapping, and a
framework test sweeps every card, base and upgraded, proving bridge
decisions equal the legacy keyword rules.

| Decision | Legacy home | Now decided by |
|---|---|---|
| Innate draw-pile ordering | `engine/combat.js`, `engine/coopCombat.js` | `lifecycle.innate` via bridge `isInnate` |
| Unplayable play-legality | both engines + `ui/screens/combat.js` (×2) | `internal.unplayable` via bridge `isUnplayable` |
| After-play placement (exhaust / power removal / discard) | both engines | `destinationAfterPlay` via bridge |
| End-turn fate (retain / ethereal / discard) | both engines | `endTurnCleanup` via bridge |
| Keyword names + tooltips | `ui/components/card.js` | TermRegistry via bridge `keywordDisplay` |
| Card cost profile (action/mana/stamina, X, Power reduction) | both engines + the end-turn playability pulse | `compileCosts` via bridge `costProfile` |
| Load/quit confirmation severity | `main.js` (both dialogs) | ConfirmationRegistry via bridge `confirmationTone` |

Two legacy rules the contract does not name are preserved in the framework
lifecycle explicitly: an Ethereal card in hand Exhausts at end of turn
(Retain wins on a card carrying both), and a played Power is removed from
play (Exhaust still wins on a Power that carries it).

`content/framework/` is registered with the content pipeline's stray-source
sweep: a framework JSON without its generated mirror in
`src/framework/data/` still fails by name.

Still legacy-decided (next tranches): deck composition, status/stance
semantics, every screen's presentation components, the generic
option-decision confirmation router (`holdconfirm`/`optionDecision`), and
cost/keyword DISPLAY strings on card faces (the decisions are ported; the
formatting is the presentation tranche's).

## Unresolved contradictions (reported before cutover, per the contract)

1. **Legacy armour ids are not globally unique.** `outfits.csv` ids are unique
   per class only. The import key is `armor.<classId>.<id>`; the legacy pair is
   preserved in `explicitOverrides` so save identity is untouched. Cutover
   needs a decision on whether armour gets globally unique authored ids.
2. **The contract's equipment fields are unauthored.** `itemWeight`,
   `attackRatingBonus`, `defenseRating` exist in no legacy table; they import
   as inert `0`, which keeps the Weight Class system dormant (everything is
   Light at zero load). Cutover needs authored weights per armament/outfit —
   numbers this candidate must not invent.
3. **The contract's rarity ladder (`BASIC…MYTHIC`) omits `uncommon`,
   `starter`, `special`, `boss`** — all live legacy rarities. The importer
   accepts the union; the canonical ladder needs an owner's ruling.
4. **Legacy card type `power`/`curse`/`status` and `X` costs** are outside the
   contract's named classifications and cost model. They are preserved as
   classification properties and `{amount: 0, variable: true}` parameters;
   the contract does not define their replacement, so none was invented.
5. **`staff` armaments** import as category `WEAPON` (the contract has no
   STAFF category); the legacy kind rides in `explicitOverrides`.
6. **Stamina/weight/dodge starting-resource feasibility** — the contract
   itself flags "Starting-resource feasibility and Guard stacking require
   explicit balance validation." The services are implemented and tested;
   the balance validation over real class loadouts is future work with the
   balance owner.
7. **Baseline red resolved upstream:** legacy test 19 (Whetstone Memory)
   was red on `dev` when this candidate was built; the item-upgrade
   redesign (#507) rewrote both the mechanic and the assertion, and this
   branch carries that fix via merge. This candidate's tree diffs against
   `dev` as pure additions.

## What cutover will take (in order)

1. Owner rulings on contradictions 1–5; author the missing equipment data.
2. Port the legacy engine/UI consumers to the framework services and shared
   components (the candidate's services are drop-in shaped; the port is
   mechanical but wide).
3. Human acceptance pass on the new mechanics.
4. `node tools/framework-gate.mjs --cutover` green, then one recorded atomic
   switch and the `assertNoLegacyRuntimeAuthorityRemainsReachable` proof
   (no production import of `src/content`/`src/engine` outside the framework).
