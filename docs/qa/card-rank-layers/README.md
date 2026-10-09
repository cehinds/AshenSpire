# Native card layers and rank placement

Open `/docs/qa/card-rank-layers/preview.html` on the repository preview server.
The examples use the native renderer, canonical profiles and pinned artwork:
Cinder Sigil at Rank 0, 1 and 3; Guard Counter at Rank 2; Ember Hew at Rank 4;
and Radiant Spray at Rank 5. Rank 0 has no visible label. Positive authored
ranks use the complete wording `Rank X`. Legacy cards without an explicit rank remain unlabelled;
explicit legacy ranks, including Rank 1, use the same visible wording.

The renderer declares the following paint order, back to front:

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
| 9 | Rank label above the effect panel |

Complementary clips separate the existing painted component fills and trims.
The panel fill and trim resize together. The rank follows the panel's top edge
and reserves clearance below the title. It may share a row with the right icon
column when their horizontal bounds do not overlap. It does not consume effect
text space or change gameplay values, rank resolution, costs or payment.

`rank-examples.png` and `rank-phone.png` show desktop and phone examples.
`corpus/report.json` records the source revision, uncommitted state and browser
checks for the full card corpus. Reproduce with `node tools/card-sigils-qa.mjs`
and `SIGIL_QA_OUT=docs/qa/card-rank-layers/corpus`.
