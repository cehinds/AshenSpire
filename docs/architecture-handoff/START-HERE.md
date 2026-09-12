# AshenSpire architecture and wireframe handoff

Open [the interactive atlas](wireframe-gallery.html). Its 151 entries each offer Wide, Compact, iPhone SE and Galaxy S24 layouts, with Wireframe, Example and Component composition tabs. This is executable reference documentation; it does not change the game.

Start with [CURRENT-SPECIFICATION.md](CURRENT-SPECIFICATION.md), then [wireframe.md](wireframe.md). Each entry includes placement, language-agnostic pseudocode, model/config JSON, source description, inheritance, linked children and actual reference renderer/style files. Navigation separates foundations, workspaces, gameplay, cards and reusable components.

- [Execution plan](EXECUTION-PLAN.md): architecture, 3NF data contracts, migration steps and source anchors. Revalidate historical line references before implementation.
- [Current source audit](CURRENT-SOURCE-AUDIT.md): differences between the documentation baseline and the owner's current checkout.
- [Progression specification](PROGRESSION-SPECIFICATION.md): proposed weapon/skill practice workspaces and normalized data model.
- [Configuration defaults](reference-defaults.json) and [coverage manifest](reference-coverage.json): generated per-entry contracts.
- [Validation](VALIDATION.md): completed checks and their limits.

The HUD playground exposes individual layers, current/proposed placement and context. The proposed blue XP strip spans the host width immediately below the HUD and defaults to combat only. Its award preview changes sample data. Weapon and skill progression likewise use illustrative practice/threshold data, not implemented mechanics.

## Build and preview

From the repository root:

```sh
node docs/architecture-handoff/build-reference.mjs
node docs/architecture-handoff/validate-reference-atlas.mjs
node docs/architecture-handoff/serve-reference.mjs
```

Open http://127.0.0.1:4179/wireframe-gallery.html. Reference validation → Check every reference exercises every entry and preview tab in the browser. To resolve source references against another checkout, pass `--source-root PATH` to the build command. Generated HTML and Markdown are rebuilt from reference modules; edit those sources, not generated output. The card-anatomy page redirects to the shared card reference to prevent competing implementations.

W0 owns corner anchors and inline footer actions. Cards preserve their aspect ratio; combatants use their own borderless assembly. Composition renders reuse component factories. JSON/CSV/database adapters and 3NF relations remain implementation specifications; no live database or game refactor is included here.
