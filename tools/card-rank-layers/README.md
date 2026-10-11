# Native card layers and rank placement

Open `/tools/card-rank-layers/preview.html` on the repository preview server.
The examples use the native renderer, canonical profiles and pinned artwork:
Cinder Sigil at Rank 0, 1 and 3; Guard Counter at Rank 2; Ember Hew at Rank 4;
and Radiant Spray at Rank 5. Rank 0 has no visible label. Positive authored
ranks use the complete wording `Rank X`. Legacy cards without an explicit rank remain unlabelled;
explicit legacy ranks, including Rank 1, use the same visible wording.

These semantic layer numbers identify components. The shared game JSON's
`order` array controls their paint order (front to back); the current layout
places layer 5 ahead of layer 6.

| Layer | Contents |
| --- | --- |
| 1 | Card background |
| 2 | Artwork |
| 3 | Heading fade and footer backing |
| 4 | Footer trim |
| 5 | Banner and text box fills |
| 6 | Card, banner and text box trims |
| 7 | Resource, primary tag and footer action icons |
| 8 | Title, costs, effects and footer name |
| 9 | Blue rank bar and label anchored to the effect panel |

Complementary clips separate the existing painted component fills and trims.
The panel fill, trim, rules and rank form the `textBox` group. Moving or scaling
the group keeps the blue rank bar anchored to the panel's upper edge. The rules
reserve a header below the rank; dense effects expand the panel upward and the
rank follows it. Gameplay values, rank resolution, costs and payment are unchanged.

`src/content/card-layout.json` is the shared layout source, using the explorer's
`version`, `order`, `layouts` and `coordinateSpace` fields. **Save to game** and
**Export JSON** write that source and regenerate native card definitions on the
local server started with `--editor-write`. Export also downloads the same JSON.

Desktop and phone examples, and the full-corpus browser checks, are not kept in
the tree (removed 2026-10-11; CI artifacts hold new runs). Reproduce the corpus
checks with `node tools/card-sigils-qa.mjs`, writing to `SIGIL_QA_OUT`.

Regenerate the six illustrations and their desktop/phone checks with
`node tools/card-rank-layers-qa.mjs`. Use `ASHEN_ART_SOURCE=cache` with the
published pin, `PLAYWRIGHT_MODULE` for Playwright and `CHROME` for the browser
when these are not on the default module/executable paths.

The continuation status note (STATUS.md) was removed 2026-10-11; see
`docs/ai/session-continuations/2026-10-08/card-layers-and-rank.md` for the history.
