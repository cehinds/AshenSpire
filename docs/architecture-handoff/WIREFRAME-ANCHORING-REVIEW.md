# Wireframe anchoring review

Reviewed the documentation generator and its rendered ASCII output. These findings concern the handoff drawings, not a browser audit of the game.

| Finding | Correction |
|---|---|
| Header close controls used fixed spaces and drifted from the right corner across widths | Shared semantic left/right header slots; title wrapping preserves the close corner |
| Several child footers placed Back and Primary adjacent at the left | Shared footer endpoints: Back left, Primary right |
| Single primary actions inherited left alignment | Exactly one footer action spans the full usable footer width; two actions retain left/right anchors |
| Mobile overflow split control labels across lines | Keep the footer on one horizontal row; use concise action labels and validated sizing, never stacked buttons |
| Category/detail dividers stopped or drifted when content wrapped | Structured rail/body cells and connected separator junctions |
| Main-menu title/entries relied on fixed indentation | True center alignment within the full frame; Profile anchored right; preview affects body only |
| Dialogue speaker portraits/buttons used fixed whitespace | Left/right portrait anchors and Back/Skip/Continue endpoint/center slots |
| Combat group had different manual offsets across views | Center the whole packed group; keep minimal internal gaps as explicitly requested |
| Parent drawings shared no ultimate chrome authority | W0 introduced as master of all four families, with inherited slots/effects/lifecycle |

W0 defaults: title top-left, exit top-right, Back bottom-left, Primary bottom-right. W3 title-center and W4a combat-centered controls are explicit previously requested variants. A single authoritative slot-placement policy owns each variation. Controls absent by capability must not shift their siblings or create fake actions.

Verification: regenerate all drawings through `generate-responsive-wireframes.mjs`, check consistent row widths and balanced fenced code blocks, and validate W0 → four parents → lettered children in `wireframe-catalog.json`. Actual frontend implementation still requires browser/input checks from the execution plan.


