# Native card layers and rank placement

Open `/docs/qa/card-rank-layers/preview.html` on the repository preview server.
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

`rank-examples.png` and `rank-phone.png` show desktop and phone examples.
`corpus/report.json` records the source revision, uncommitted state and browser
checks for the full card corpus. Reproduce with `node tools/card-sigils-qa.mjs`
and `SIGIL_QA_OUT=docs/qa/card-rank-layers/corpus`.

Regenerate the six illustrations and their desktop/phone checks with
`node tools/card-rank-layers-qa.mjs`. Use `ASHEN_ART_SOURCE=cache` with the
published pin, `PLAYWRIGHT_MODULE` for Playwright and `CHROME` for the browser
when these are not on the default module/executable paths.

[Continuation status and remaining gates](STATUS.md) records the pushed
checkpoint, test commands, review status and delivery boundaries.
